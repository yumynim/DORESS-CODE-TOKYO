/* =========================================================
   /api/admin-announcements
   ---------------------------------------------------------
   お知らせ（announcements、会員全員向け）の投稿／削除。
   admin-announcements.html から呼ばれる。

   announcements テーブルへの insert/delete は RLS 上どのユーザーにも
   許可していない（service role のみ）ので、ここで
   1. ログイン中のユーザーを確認
   2. profiles.is_admin が true か確認
   を行ってから、service role でテーブルを操作する。

   投稿（POST）が成功したら、サイト内通知（announcements）に加えて
   会員全員へ確認メールも送る（Resend経由。RESEND_API_KEY / NOTIFY_FROM_EMAIL
   が未設定の場合は square-webhook.js と同様に静かにスキップされる）。
   ========================================================= */
const { createClient } = require('@supabase/supabase-js');
const { sendEmail } = require('../lib/mailer');

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

async function requireAdmin(req, authClient, serviceClient) {
  const access_token = (req.body || {}).access_token;
  if (!access_token) return { error: 'ログインが必要です', status: 401 };

  const { data: userData, error: userErr } = await authClient.auth.getUser(access_token);
  if (userErr || !userData || !userData.user) return { error: 'ログイン情報を確認できませんでした。再度ログインしてください', status: 401 };

  const { data: profile, error: profileErr } = await serviceClient
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single();
  if (profileErr || !profile || !profile.is_admin) return { error: '投稿権限がありません', status: 403 };

  return { userId: userData.user.id };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.status(405).json({ error: 'このメソッドは対応していません' });
    return;
  }

  const authClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const serviceClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const auth = await requireAdmin(req, authClient, serviceClient);
  if (auth.error) { res.status(auth.status).json({ error: auth.error }); return; }

  try {
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
