/* =========================================================
   POST /api/check-email
   ---------------------------------------------------------
   新規登録フォームでメールアドレス欄からフォーカスが外れたタイミングで呼び、
   「そのメールアドレスは既に会員登録済みか」だけを返す（{ exists: true/false }）。
   実際に登録処理は行わない。存在確認のみ。

   注意: 会員か否かをこのAPI経由で誰でも問い合わせられる（メールアドレス総当たりの
   列挙が理論上可能）。ただし登録フォーム自体も送信時に同じ情報を返すため、
   このAPIは「送信前に分かるようにした」だけで、新たに漏れる情報の種類は増えていない。
   ========================================================= */
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'このメソッドは対応していません' });
    return;
  }

  const email = String((req.body || {}).email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'メールアドレスの形式が正しくありません' });
    return;
  }

  try {
    const serviceClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    let page = 1;
    const perPage = 200;
    let exists = false;
    for (;;) {
      const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
      if (error) { console.error('check-email listUsers failed:', error.message); res.status(500).json({ error: '確認中にエラーが発生しました' }); return; }
      const users = (data && data.users) || [];
      if (users.some((u) => (u.email || '').toLowerCase() === email)) { exists = true; break; }
      if (users.length < perPage) break;
      page += 1;
    }
    res.status(200).json({ exists });
  } catch (err) {
    console.error('check-email handler error:', err);
    res.status(500).json({ error: 'サーバー内部でエラーが発生しました' });
  }
};
