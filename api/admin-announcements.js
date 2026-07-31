/* =========================================================
   /api/admin-announcements
   ---------------------------------------------------------
   お知らせの投稿／削除。admin-announcements.html（/console）から呼ばれる。
   4種類の送り先に対応:
     1. 全員宛て（announcements テーブル） … 会員全員のヘッダー通知に届く
     2. 個人宛て（notifications テーブル） … メールアドレスを指定した1人だけに届く
        （購入完了通知などと同じ仕組みを流用）
     3. チケット購入者宛て（notifications テーブル） … 指定したチケットを買った人だけに届く
     4. 決済未完了者宛て（notifications テーブル） … purchases.status='initiated'のまま
        止まっている人だけに届く（気づかず放置している可能性があるため）

   認証は個人のSupabaseアカウントではなく、共通パスワード方式
   （api/admin-login.js が発行したトークンを lib/adminAuth.js で検証）。
   どちらのテーブルへの insert/delete も RLS 上どのユーザーにも
   許可していない（service role のみ）ので、トークン検証を通った
   リクエストだけが service role 経由でテーブルを操作できる。

   投稿（POST）が成功したら、Resend経由でメールも送る
   （RESEND_API_KEY / NOTIFY_FROM_EMAIL が未設定の場合は静かにスキップされる）。
   ========================================================= */
const { createClient } = require('@supabase/supabase-js');
const { sendEmail, renderBlocks } = require('../lib/mailer');
const { verifyAdminToken } = require('../lib/adminAuth');

async function sendBroadcastEmail(serviceClient, { subject, blocks }) {
  // 会員数が多くなってきたら、ここは一括送信APIやキュー経由に切り替えたほうがよい
  // （今は一人ずつ順番に送っている）。
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
    if (error) { console.error('listUsers failed:', error.message); return; }
    const users = (data && data.users) || [];
    for (const u of users) {
      if (u.email) await sendEmail({ to: u.email, subject, blocks });
    }
    if (users.length < perPage) return;
    page += 1;
  }
}

/* ---------- チケット単位のセグメント（＝購入者タグ） ----------
   専用のタグ用テーブルは作らず、既存の purchases.items（購入内訳のJSON）から
   「どのチケットを買った人か」を毎回集計する方式にしている。
   理由: チケットを1種類増やすたびに管理画面でタグを作り直す手間がなく、
   js/data.js にチケットを追加してSquareで売れた瞬間から自動的に絞り込み先として現れるため。

   1つのチケットを一意に表すキー（＝タグID）には Square の catalogObjectId を使う。
   Square未設定・単品購入などで catalogObjectId が空の場合は商品名で代用する。 */
function segmentKeyOf(item) {
  if (!item || typeof item !== 'object') return null;
  const id = item.catalogObjectId || item.catalog_object_id;
  if (id) return `id:${String(id)}`;
  const name = String(item.name || '').trim();
  return name ? `name:${name}` : null;
}

// 支払い済みの購入記録だけを対象に、チケットごとの購入者を集計する。
// 戻り値: Map<segmentKey, { key, name, userIds:Set<string> }>
async function collectSegments(serviceClient) {
  const { data, error } = await serviceClient
    .from('purchases')
    .select('user_id, items')
    .eq('status', 'paid');
  if (error) { console.error('segments query failed:', error.message); return new Map(); }

  const segments = new Map();
  for (const row of data || []) {
    const items = Array.isArray(row.items) ? row.items : [];
    for (const item of items) {
      const key = segmentKeyOf(item);
      if (!key) continue;
      if (!segments.has(key)) segments.set(key, { key, name: String(item.name || '（名称不明）').trim(), userIds: new Set() });
      if (row.user_id) segments.get(key).userIds.add(row.user_id);
    }
  }
  return segments;
}

/* ---------- 決済未完了者（status='initiated'のまま止まっている人） ----------
   チケット単位のセグメントとは別に、「カートまでは進んだが支払いが完了していない」
   会員だけを対象にした一斉送信。気づかず放置しているだけの可能性があるため、
   運営側から一声かけられるようにする。 */
async function collectPendingUserIds(serviceClient) {
  const { data, error } = await serviceClient.from('purchases').select('user_id').eq('status', 'initiated');
  if (error) { console.error('pending query failed:', error.message); return new Set(); }
  const ids = new Set();
  for (const row of data || []) { if (row.user_id) ids.add(row.user_id); }
  return ids;
}

async function findUserByEmail(serviceClient, email) {
  const target = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
    if (error) return null;
    const users = (data && data.users) || [];
    const found = users.find((u) => (u.email || '').toLowerCase() === target);
    if (found) return found;
    if (users.length < perPage) return null;
    page += 1;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
    res.status(405).json({ error: 'このメソッドは対応していません' });
    return;
  }

  // GETはクエリ文字列、POST/DELETEはJSONボディでトークンを受け取る
  const token = req.method === 'GET' ? req.query.token : (req.body || {}).token;
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: '認証が切れました。もう一度パスワードを入力してください' });
    return;
  }

  const serviceClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    if (req.method === 'GET') {
      const [broadcastRes, personalRes] = await Promise.all([
        serviceClient.from('announcements').select('id, title, body, body_html, created_at').order('created_at', { ascending: false }).limit(100),
        // 個人宛て送信の履歴として表示するのは、購入通知等ではなくConsoleから送った分だけ
        // （purchase_id が付いていない = Webhookではなく管理者が手動で送ったもの、という区別）
        serviceClient.from('notifications').select('id, title, body, body_html, created_at, user_id').is('purchase_id', null).order('created_at', { ascending: false }).limit(50),
      ]);
      if (broadcastRes.error) { res.status(500).json({ error: '読み込みに失敗しました' }); return; }

      let personal = [];
      if (!personalRes.error && personalRes.data) {
        personal = await Promise.all(personalRes.data.map(async (n) => {
          const { data } = await serviceClient.auth.admin.getUserById(n.user_id);
          return { id: n.id, title: n.title, body: n.body, body_html: n.body_html, created_at: n.created_at, email: (data && data.user && data.user.email) || '（不明）' };
        }));
      }

      // チケット購入者セグメント（管理画面の「チケット購入者に送る」の選択肢になる）
      const segmentMap = await collectSegments(serviceClient);
      const segments = [...segmentMap.values()]
        .map((s) => ({ key: s.key, name: s.name, count: s.userIds.size }))
        .sort((a, b) => b.count - a.count);

      const pendingCount = (await collectPendingUserIds(serviceClient)).size;

      res.status(200).json({ announcements: broadcastRes.data || [], personal, segments, pendingCount });
      return;
    }

    if (req.method === 'POST') {
      const { title, blocks, targetEmail, segmentKey, targetPending } = req.body || {};
      const cleanTitle = title && String(title).trim();
      // 送信の実体は「ブロック配列」（段落／区切り線／ボタン）。
      // サイト内通知・プレーンテキストメール用の本文は、ここから自動生成する。
      const rendered = renderBlocks(blocks);
      if (!cleanTitle || !rendered.text) {
        res.status(400).json({ error: 'タイトルと本文を入力してください' });
        return;
      }
      const cleanBody = rendered.text;

      if (targetPending) {
        // ---------- 決済未完了者宛て ----------
        const userIds = [...(await collectPendingUserIds(serviceClient))];
        if (!userIds.length) {
          res.status(404).json({ error: '決済が完了していない購入は見つかりませんでした' });
          return;
        }

        const { error } = await serviceClient
          .from('notifications')
          .insert(userIds.map((userId) => ({ user_id: userId, title: cleanTitle, body: cleanBody, body_html: rendered.html })));
        if (error) { console.error('pending notifications insert failed:', error.message); res.status(500).json({ error: '送信に失敗しました' }); return; }

        let sent = 0;
        for (const userId of userIds) {
          const { data: userRes } = await serviceClient.auth.admin.getUserById(userId);
          const email = userRes && userRes.user && userRes.user.email;
          if (!email) continue;
          try { await sendEmail({ to: email, subject: cleanTitle, blocks }); sent += 1; }
          catch (e) { console.error('pending email failed:', e); }
        }

        res.status(200).json({ pending: { recipients: userIds.length, mailed: sent } });
        return;
      }

      if (segmentKey && String(segmentKey).trim()) {
        // ---------- チケット購入者宛て ----------
        // 全員宛て（announcements）ではなく、対象者ひとりひとりの notifications に入れる。
        // そうしないと購入していない会員のヘッダー通知にも出てしまうため。
        const segmentMap = await collectSegments(serviceClient);
        const segment = segmentMap.get(String(segmentKey));
        if (!segment || segment.userIds.size === 0) {
          res.status(404).json({ error: 'そのチケットの購入者が見つかりませんでした' });
          return;
        }

        const userIds = [...segment.userIds];
        const { error } = await serviceClient
          .from('notifications')
          .insert(userIds.map((userId) => ({ user_id: userId, title: cleanTitle, body: cleanBody, body_html: rendered.html })));
        if (error) { console.error('segment notifications insert failed:', error.message); res.status(500).json({ error: '送信に失敗しました' }); return; }

        // メールは1人ずつ順番に送る（会員数が増えたら一括送信APIやキューへの切り替えを検討）
        let sent = 0;
        for (const userId of userIds) {
          const { data: userRes } = await serviceClient.auth.admin.getUserById(userId);
          const email = userRes && userRes.user && userRes.user.email;
          if (!email) continue;
          try { await sendEmail({ to: email, subject: cleanTitle, blocks }); sent += 1; }
          catch (e) { console.error('segment email failed:', e); }
        }

        res.status(200).json({ segment: { key: segment.key, name: segment.name, recipients: userIds.length, mailed: sent } });
        return;
      }

      if (targetEmail && String(targetEmail).trim()) {
        // ---------- 個人宛て ----------
        const user = await findUserByEmail(serviceClient, String(targetEmail));
        if (!user) { res.status(404).json({ error: 'そのメールアドレスの会員が見つかりませんでした' }); return; }

        const { data, error } = await serviceClient
          .from('notifications')
          .insert({ user_id: user.id, title: cleanTitle, body: cleanBody, body_html: rendered.html })
          .select()
          .single();
        if (error) { res.status(500).json({ error: '送信に失敗しました' }); return; }

        try {
          await sendEmail({ to: user.email, subject: cleanTitle, blocks });
        } catch (e) {
          console.error('personal email failed:', e);
        }

        res.status(200).json({ personal: { ...data, email: user.email } });
        return;
      }

      // ---------- 全員宛て ----------
      const { data, error } = await serviceClient
        .from('announcements')
        .insert({ title: cleanTitle, body: cleanBody, body_html: rendered.html })
        .select()
        .single();
      if (error) { res.status(500).json({ error: '投稿に失敗しました' }); return; }

      try {
        await sendBroadcastEmail(serviceClient, { subject: cleanTitle, blocks });
      } catch (e) {
        console.error('broadcast email failed:', e); // メール送信に失敗しても投稿自体は成功扱いにする
      }

      res.status(200).json({ announcement: data });
      return;
    }

    // DELETE
    const { id, type } = req.body || {};
    if (!id) { res.status(400).json({ error: 'idが必要です' }); return; }
    const table = type === 'personal' ? 'notifications' : 'announcements';
    const { error } = await serviceClient.from(table).delete().eq('id', id);
    if (error) { res.status(500).json({ error: '削除に失敗しました' }); return; }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('admin-announcements handler error:', err);
    res.status(500).json({ error: 'サーバー内部でエラーが発生しました' });
  }
};
