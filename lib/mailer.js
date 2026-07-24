/* =========================================================
   Resend 経由のメール送信（共通ヘルパー）
   ---------------------------------------------------------
   api/square-webhook.js（購入完了/キャンセル通知）と
   api/admin-announcements.js（お知らせ投稿の一斉メール）の両方から使う。

   RESEND_API_KEY / NOTIFY_FROM_EMAIL が未設定でもエラーにはせず、
   静かに何もしない（サイト内通知だけは別途届く設計のため）。

   注意: api/ 直下に置くと Vercel Functions のルートとして扱われてしまうため、
   このファイルは api/ の外（lib/）に置いている。
   ========================================================= */
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

async function sendEmail({ to, subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL;
  if (!apiKey || !from || !to) return;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: `【DRESS CODE TOKYO】${subject}`,
        text,
        html: `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`,
      }),
    });
    if (!res.ok) console.error('Resend API error:', await res.text());
  } catch (e) {
    console.error('email send failed:', e);
  }
}

module.exports = { sendEmail };
