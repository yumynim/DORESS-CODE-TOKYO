/* =========================================================
   /api/admin-announcements
   ---------------------------------------------------------
   お知らせの投稿／削除。admin-announcements.html（/console）から呼ばれる。
   2種類の送り先に対応:
     1. 全員宛て（announcements テーブル） … 会員全員のヘッダー通知に届く
     2. 個人宛て（notifications テーブル） … メールアドレスを指定した1人だけに届く
        （購入完了通知などと同じ仕組みを流用）

   認証は個人のSupabaseアカウントではなく、共通パスワード方式
   （api/admin-login.js が発行したトークンを lib/adminAuth.js で検証）。
   どちらのテーブルへの insert/delete も RLS 上どのユーザーにも
   許可していない（service role のみ）ので、トークン検証を通った
   リクエストだけが service role 経由でテーブルを操作できる。

   投稿（POST）が成功したら、Resend経由でメールも送る
   （RESEND_API_KEY / NOTIFY_FROM_EMAIL が未設定の場合は静かにスキップされる）。
   ========================================================= */
const { createClient } = require('@supabase/supabase-js');
const { sendEmail } = require('../lib/mailer');
const { verifyAdminToken } = require('../lib/adminAuth');

async function sendBroadcastEmail(serviceClient, { subject, text }) {
  // 会員数が多くなってきたら、ここは一括送信APIやキュー経由に切り替えたほうがよい
  // （今は一人ずつ順番に送っている）。
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
    if (error) { console.error('listUsers failed:', error.message); return; }
    const users = (data && data.users) || [];
    for (const u of users) {
      if (u.email) await sendEmail({ to: u.email, subject, text });
    }
    if (users.length < perPage) return;
    page += 1;
  }
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
        serviceClient.from('announcements').select('id, title, body, created_at').order('created_at', { ascending: false }).limit(100),
        // 個人宛て送信の履歴として表示するのは、購入通知等ではなくConsoleから送った分だけ
        // （purchase_id が付いていない = Webhookではなく管理者が手動で送ったもの、という区別）
        serviceClient.from('notifications').select('id, title, body, created_at, user_id').is('purchase_id', null).order('created_at', { ascending: false }).limit(50),
      ]);
      if (broadcastRes.error) { res.status(500).json({ error: '読み込みに失敗しました' }); return; }

      let personal = [];
      if (!personalRes.error && personalRes.data) {
        personal = await Promise.all(personalRes.data.map(async (n) => {
          const { data } = await serviceClient.auth.admin.getUserById(n.user_id);
          return { id: n.id, title: n.title, body: n.body, created_at: n.created_at, email: (data && data.user && data.user.email) || '（不明）' };
        }));
      }

      res.status(200).json({ announcements: broadcastRes.data || [], personal });
      return;
    }

    if (req.method === 'POST') {
      const { title, body, targetEmail } = req.body || {};
      if (!title || !String(title).trim() || !body || !String(body).trim()) {
        res.status(400).json({ error: 'タイトルと本文を入力してください' });
        return;
      }
      const cleanTitle = String(title).trim();
      const cleanBody = String(body).trim();

      if (targetEmail && String(targetEmail).trim()) {
        // ---------- 個人宛て ----------
        const user = await findUserByEmail(serviceClient, String(targetEmail));
        if (!user) { res.status(404).json({ error: 'そのメールアドレスの会員が見つかりませんでした' }); return; }

        const { data, error } = await serviceClient
          .from('notifications')
          .insert({ user_id: user.id, title: cleanTitle, body: cleanBody })
          .select()
          .single();
        if (error) { res.status(500).json({ error: '送信に失敗しました' }); return; }

        try {
          await sendEmail({ to: user.email, subject: cleanTitle, text: cleanBody });
        } catch (e) {
          console.error('personal email failed:', e);
        }

        res.status(200).json({ personal: { ...data, email: user.email } });
        return;
      }

      // ---------- 全員宛て ----------
      const { data, error } = await serviceClient
        .from('announcements')
        .insert({ title: cleanTitle, body: cleanBody })
        .select()
        .single();
      if (error) { res.status(500).json({ error: '投稿に失敗しました' }); return; }

      try {
        await sendBroadcastEmail(serviceClient, { subject: data.title, text: data.body });
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
