/* =========================================================
   POST /api/admin-checkin
   ---------------------------------------------------------
   当日の入場確認用。受付コード（entry_code）を受け取り、
   支払い済みの購入かどうか・すでにチェックイン済みかどうかを判定し、
   未チェックインならその場でチェックイン済みにする。

   checkin.html（/checkin）のQRスキャン・手入力どちらからもここを呼ぶ。
   認証は/consoleと同じ共通パスワード方式（ADMIN_CONSOLE_PASSWORD）。
   ========================================================= */
const { createClient } = require('@supabase/supabase-js');
const { verifyAdminToken } = require('../lib/adminAuth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POSTのみ対応しています' });
    return;
  }

  const { code, token } = req.body || {};
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: '認証が切れました。もう一度パスワードを入力してください' });
    return;
  }

  const entryCode = String(code || '').trim().toUpperCase();
  if (!entryCode) {
    res.status(400).json({ error: 'コードを入力してください' });
    return;
  }

  try {
    const serviceClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: purchase, error } = await serviceClient
      .from('purchases')
      .select('id, user_id, ticket_name, status, checked_in_at')
      .eq('entry_code', entryCode)
      .maybeSingle();

    if (error) { console.error('admin-checkin lookup failed:', error.message); res.status(500).json({ error: '確認中にエラーが発生しました' }); return; }
    if (!purchase || purchase.status !== 'paid') {
      res.status(404).json({ error: 'そのコードの購入が見つかりませんでした（支払い未完了、または無効なコードです）' });
      return;
    }

    const { data: userRes } = await serviceClient.auth.admin.getUserById(purchase.user_id);
    const buyerEmail = (userRes && userRes.user && userRes.user.email) || '（不明）';

    if (purchase.checked_in_at) {
      res.status(200).json({
        alreadyCheckedIn: true,
        ticketName: purchase.ticket_name,
        buyerEmail,
        checkedInAt: purchase.checked_in_at,
      });
      return;
    }

    const checkedInAt = new Date().toISOString();
    const { error: updateErr } = await serviceClient
      .from('purchases')
      .update({ checked_in_at: checkedInAt })
      .eq('id', purchase.id);
    if (updateErr) { console.error('admin-checkin update failed:', updateErr.message); res.status(500).json({ error: '記録に失敗しました' }); return; }

    res.status(200).json({ alreadyCheckedIn: false, ticketName: purchase.ticket_name, buyerEmail, checkedInAt });
  } catch (err) {
    console.error('admin-checkin handler error:', err);
    res.status(500).json({ error: 'サーバー内部でエラーが発生しました' });
  }
};
