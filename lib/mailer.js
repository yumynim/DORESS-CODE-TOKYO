/* =========================================================
   Resend 経由のメール送信（共通ヘルパー）
   ---------------------------------------------------------
   api/square-webhook.js（購入完了/キャンセル通知）と
   api/admin-announcements.js（お知らせ投稿の一斉/個人宛てメール）の両方から使う。

   RESEND_API_KEY / NOTIFY_FROM_EMAIL が未設定でもエラーにはせず、
   静かに何もしない（サイト内通知だけは別途届く設計のため）。

   注意: api/ 直下に置くと Vercel Functions のルートとして扱われてしまうため、
   このファイルは api/ の外（lib/）に置いている。
   ========================================================= */
const SITE_URL = (process.env.SITE_URL || 'https://dress-code-tokyo.com').replace(/\/$/, '');
const LOGO_URL = `${SITE_URL}/assets/images/logo.png`;

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// href に javascript: 等が紛れ込まないよう、http(s)以外は既定のサイトURLに差し替える
function sanitizeUrl(url) {
  if (typeof url === 'string' && /^https?:\/\//i.test(url.trim())) return url.trim();
  return SITE_URL;
}

function textToHtmlParagraphs(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map(block => `<p style="margin:0 0 16px;">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/* Apple / Stripe / Notion 的な、黒白ベースのシンプルなメールテンプレート。
   Gmail/Outlook等のクライアント差異に耐えるよう、CSSはすべてインラインで書く。 */
function buildEmailHtml({ heading, bodyHtml, ctaLabel, ctaUrl, footerNote }) {
  const cta = ctaLabel && ctaUrl ? `
    <tr>
      <td style="padding:8px 0 0;">
        <a href="${escapeHtml(sanitizeUrl(ctaUrl))}" style="display:inline-block; background:#16150f; color:#ffffff; text-decoration:none; font-size:14px; letter-spacing:0.02em; padding:14px 28px; border-radius:2px;">${escapeHtml(ctaLabel)}</a>
      </td>
    </tr>` : '';

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DRESS CODE TOKYO</title>
</head>
<body style="margin:0; padding:0; background:#f4f3f0; font-family:'Hiragino Sans','Hiragino Kaku Gothic ProN',-apple-system,BlinkMacSystemFont,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f0; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%; max-width:600px; background:#ffffff;">
          <tr>
            <td style="background:#16150f; padding:28px 32px; text-align:center;">
              <img src="${LOGO_URL}" alt="DRESS CODE TOKYO" height="28" style="height:28px; width:auto; display:inline-block;">
            </td>
          </tr>
          <tr>
            <td style="padding:40px 32px 8px;">
              <h1 style="margin:0 0 20px; font-size:19px; font-weight:600; color:#16150f; letter-spacing:0.02em;">${escapeHtml(heading)}</h1>
              <div style="height:1px; background:#e5e3dd; margin:0 0 24px;"></div>
              <div style="font-size:15px; line-height:1.9; color:#46443c;">
                ${bodyHtml}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                ${cta}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px; background:#f4f3f0; border-top:1px solid #e5e3dd;">
              <p style="margin:0 0 4px; font-size:12px; color:#8a877c;">DRESS CODE TOKYO</p>
              <p style="margin:0; font-size:12px; color:#8a877c;">${escapeHtml(footerNote || 'このメールに心当たりがない場合は破棄してください。')}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * @param {object} params
 * @param {string} params.to
 * @param {string} params.subject
 * @param {string} params.text            プレーンテキスト本文（HTML未対応クライアント向けに必ず送る）
 * @param {string} [params.ctaLabel]       ボタンの文言（例: 'マイページを見る'）
 * @param {string} [params.ctaUrl]         ボタンのリンク先（未指定ならボタンなし）
 * @param {string} [params.footerNote]     フッターの補足文（未指定なら既定文）
 */
async function sendEmail({ to, subject, text, ctaLabel, ctaUrl, footerNote }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL;
  if (!apiKey || !from || !to) return;

  const html = buildEmailHtml({
    heading: subject,
    bodyHtml: textToHtmlParagraphs(text),
    ctaLabel,
    ctaUrl,
    footerNote,
  });

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: `【DRESS CODE TOKYO】${subject}`,
        text,
        html,
      }),
    });
    if (!res.ok) console.error('Resend API error:', await res.text());
  } catch (e) {
    console.error('email send failed:', e);
  }
}

module.exports = { sendEmail, buildEmailHtml, textToHtmlParagraphs, SITE_URL };
