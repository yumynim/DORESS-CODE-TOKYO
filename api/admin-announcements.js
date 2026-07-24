/* =========================================================
   /api/admin-announcements
   ---------------------------------------------------------
   お知らせ（announcements、会員全員向け）の投稿／削除。
   admin-announcements.html（/console）から呼ばれる。

   認証は個人のSupabaseアカウントではなく、共通パスワード方式
   （api/admin-login.js が発行したトークンを lib/adminAuth.js で検証）。
   announcements テーブルへの insert/delete は RLS 上どのユーザーにも
   許可していない（service role のみ）ので、トークン検証を通った
   リクエストだけが service role 経由でテーブルを操作できる。

   投稿（POST）が成功したら、サイト内通知（announcements）に加えて
   会員全員へ確認メールも送る（Resend経由。RESEND_API_KEY / NOTIFY_FROM_EMAIL
   が未設定の場合は square-webhook.js と同様に静かにスキップされる）。
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
      const { data, error } = await serviceClient
        .from('announcements')
        .select('id, title, body, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) { res.status(500).json({ error: '読み込みに失敗しました' }); return; }
      res.status(200).json({ announcements: data || [] });
      return;
    }

    if (req.method === 'POST') {
      const { title, body } = req.body || {};
      if (!title || !String(title).trim() || !body || !String(body).trim()) {
        res.status(400).json({ error: 'タイトルと本文を入力してください' });
        return;
      }
      const { data, error } = await serviceClient
        .from('announcements')
        .insert({ title: String(title).trim(), body: String(body).trim() })
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
    const { id } = req.body || {};
    if (!id) { res.status(400).json({ error: 'idが必要です' }); return; }
    const { error } = await serviceClient.from('announcements').delete().eq('id', id);
    if (error) { res.status(500).json({ error: '削除に失敗しました' }); return; }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('admin-announcements handler error:', err);
    res.status(500).json({ error: 'サーバー内部でエラーが発生しました' });
  }
};
