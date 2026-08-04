/* =========================================================
   GET /api/admin-members
   ---------------------------------------------------------
   /console の「会員名簿」セクション用。会員1人ずつについて、
   こちらが把握している情報をひとまとめにして返す。

     ・登録情報（お名前・メールアドレス・登録日・メール確認済みか・最終ログイン）
     ・購入履歴（チケット・金額・状態・受付コード・入場したかどうか）
     ・その人あてに配信したお知らせ（購入通知／個人宛て／購入者セグメント宛て／
       決済未完了者宛て のすべて。notifications テーブルに入るものが全部対象）
     ・その人のメールアドレスから届いたお問い合わせと、返信したかどうか

   なぜまとめるか: これまで「購入者一覧」「個人宛てに送った履歴」「お問い合わせ」が
   別々のセクションに分かれていて、「この人に今まで何を送ったか」を知るには
   3箇所を目で突き合わせる必要があった。二重に案内を送ったり、逆に必要な連絡が
   漏れたりする原因になるため、人単位で1箇所にまとめる。

   ■ 権限について（重要）
   ここは氏名・メールアドレス・購入履歴・問い合わせ本文という、このサイトで
   最も秘匿性の高い情報がまとめて出てくる。必ず 'admin' 権限
   （ADMIN_CONSOLE_PASSWORD 側）を要求すること。当日スタッフ用の 'checkin' 権限では
   決して開けないようにする。
   ========================================================= */
const { createClient } = require('@supabase/supabase-js');
const { verifyAdminToken } = require('../lib/adminAuth');

// 1回の表示で扱う上限。名簿が想定以上に増えたときに、
// 画面が固まる・タイムアウトするのを防ぐための保険。
const MAX_USERS = 2000;
const MAX_ROWS = 5000;

// auth のユーザーをページングしながら全部集める
async function listAllUsers(serviceClient) {
  const users = [];
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
    if (error) { console.error('listUsers failed:', error.message); break; }
    const batch = (data && data.users) || [];
    users.push(...batch);
    if (batch.length < perPage || users.length >= MAX_USERS) break;
    page += 1;
  }
  return users;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'このメソッドは対応していません' });
    return;
  }

  // トークンはヘッダーのみで受け取る（URLの ?token= はアクセスログに残るため受け付けない）。
  // 個人情報をまとめて返すエンドポイントなので 'admin' 権限を必須にする。
  const token = req.headers['x-admin-token'];
  if (!verifyAdminToken(token, 'admin')) {
    res.status(401).json({ error: '認証が切れました。もう一度パスワードを入力してください' });
    return;
  }

  const serviceClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const [users, purchasesRes, passesRes, notificationsRes, inquiriesRes, announcementsRes] = await Promise.all([
      listAllUsers(serviceClient),
      serviceClient.from('purchases')
        .select('id, user_id, ticket_name, price, status, created_at, entry_code')
        .order('created_at', { ascending: false }).limit(MAX_ROWS),
      serviceClient.from('entry_passes')
        .select('purchase_id, code, status, checked_in_at')
        .limit(MAX_ROWS),
      serviceClient.from('notifications')
        .select('id, user_id, purchase_id, title, body, created_at, read')
        .order('created_at', { ascending: false }).limit(MAX_ROWS),
      serviceClient.from('inquiries')
        .select('id, reason, name, email, message, status, replied_at, created_at')
        .order('created_at', { ascending: false }).limit(MAX_ROWS),
      serviceClient.from('announcements').select('id', { count: 'exact', head: true }),
    ]);

    // 購入IDごとの受付コード
    const passesByPurchase = new Map();
    for (const p of (passesRes.data || [])) {
      if (!passesByPurchase.has(p.purchase_id)) passesByPurchase.set(p.purchase_id, []);
      passesByPurchase.get(p.purchase_id).push({
        code: p.code,
        // 返金で無効化されたコードも隠さず出す。「昔このコードを案内した」という事実が
        // 残っていないと、お客様から問い合わせが来たときに突き合わせられない。
        revoked: p.status !== 'valid',
        checkedInAt: p.checked_in_at,
      });
    }
    // コードは短い順（＝連番の数字順）に並べる。文字列順だと N10 が N2 より前に来てしまう。
    for (const list of passesByPurchase.values()) {
      list.sort((a, b) => a.code.length - b.code.length || a.code.localeCompare(b.code));
    }

    const purchasesByUser = new Map();
    for (const row of (purchasesRes.data || [])) {
      if (!row.user_id) continue;
      if (!purchasesByUser.has(row.user_id)) purchasesByUser.set(row.user_id, []);
      const codes = passesByPurchase.get(row.id) || [];
      purchasesByUser.get(row.user_id).push({
        id: row.id,
        ticketName: row.ticket_name,
        price: row.price,
        status: row.status,
        createdAt: row.created_at,
        // 旧方式（1購入1コード）で発行された購入は entry_passes に行が無いことがある
        codes: codes.length ? codes : (row.entry_code ? [{ code: row.entry_code, revoked: false, checkedInAt: null }] : []),
      });
    }

    const notificationsByUser = new Map();
    for (const row of (notificationsRes.data || [])) {
      if (!row.user_id) continue;
      if (!notificationsByUser.has(row.user_id)) notificationsByUser.set(row.user_id, []);
      notificationsByUser.get(row.user_id).push({
        id: row.id,
        title: row.title,
        body: row.body,
        createdAt: row.created_at,
        read: !!row.read,
        // purchase_id が付いているものは決済に連動して自動送信されたもの。
        // 付いていないものは /console から手で送ったもの（個人宛て・セグメント・決済未完了者）。
        kind: row.purchase_id ? 'auto' : 'manual',
      });
    }

    // お問い合わせはメールアドレスで会員に紐づける（会員でない人からの問い合わせもあるため、
    // 一致しないものは名簿には出さない。従来どおり「お問い合わせ」セクションで見る）。
    const inquiriesByEmail = new Map();
    for (const row of (inquiriesRes.data || [])) {
      const key = String(row.email || '').trim().toLowerCase();
      if (!key) continue;
      if (!inquiriesByEmail.has(key)) inquiriesByEmail.set(key, []);
      inquiriesByEmail.get(key).push({
        id: row.id,
        reason: row.reason,
        message: row.message,
        status: row.status,
        repliedAt: row.replied_at,
        createdAt: row.created_at,
      });
    }

    const members = users.map((u) => {
      const email = u.email || '';
      const purchases = purchasesByUser.get(u.id) || [];
      const notifications = notificationsByUser.get(u.id) || [];
      const inquiries = inquiriesByEmail.get(email.trim().toLowerCase()) || [];
      const paid = purchases.filter((p) => p.status === 'paid');
      return {
        id: u.id,
        email: email || '（不明）',
        name: (u.user_metadata && u.user_metadata.display_name) || '',
        createdAt: u.created_at || null,
        lastSignInAt: u.last_sign_in_at || null,
        emailConfirmed: !!(u.email_confirmed_at || u.confirmed_at),
        purchases,
        notifications,
        inquiries,
        // 一覧の見出しに出す要約（開かなくても状況が分かるように）
        paidCount: paid.length,
        codeCount: paid.reduce((n, p) => n + p.codes.filter((c) => !c.revoked).length, 0),
        checkedInCount: paid.reduce((n, p) => n + p.codes.filter((c) => c.checkedInAt).length, 0),
        notificationCount: notifications.length,
        inquiryCount: inquiries.length,
      };
    });

    // 新しく登録した人が上に来るように
    members.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    /* 支払い済みなのに有効な受付コードが1枚も無い購入を拾う。
       Webhookが届かなかった・コード発行に失敗した、といった事故が起きると、
       お客様は「払ったのに入場できない」状態のまま当日を迎えることになるが、
       こちらは本人から連絡が来るまで気づけない。ここで見えるようにしておく。
       （返金済みはコードが無くて正常なので対象外） */
    const paidWithoutCodes = [];
    for (const m of members) {
      for (const p of m.purchases) {
        if (p.status !== 'paid') continue;
        if (p.codes.some((c) => !c.revoked)) continue;
        paidWithoutCodes.push({
          purchaseId: p.id,
          email: m.email,
          name: m.name,
          ticketName: p.ticketName,
          createdAt: p.createdAt,
        });
      }
    }

    res.status(200).json({
      members,
      paidWithoutCodes,
      // 全員向けのお知らせは会員全員に配信されるので、人ごとには持たず件数だけ返す
      broadcastCount: announcementsRes.count || 0,
      truncated: users.length >= MAX_USERS,
    });
  } catch (err) {
    console.error('admin-members handler error:', err);
    res.status(500).json({ error: 'サーバー内部でエラーが発生しました' });
  }
};
