/* =========================================================
   POST /api/admin-preview-email
   ---------------------------------------------------------
   admin-announcements.html（/console）の配信エディタ用。
   タイトル・本文・ボタン設定を受け取り、実際に送るメールと
   まったく同じ組み立て（lib/mailer.js の buildEmailHtml）でHTMLを
   生成して返すだけの、送信を伴わないプレビュー専用エンドポイント。
   認証はほかの管理API同様、共通パスワードのトークン（lib/adminAuth.js）。
   ========================================================= */
const { verifyAdminToken } = require('../lib/adminAuth');
const { buildEmailHtml, textToHtmlParagraphs, SITE_URL } = require('../lib/mailer');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'このメソッドは対応していません' });
    return;
  }

  const { token, title, body, ctaLabel, ctaUrl } = req.body || {};
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: '認証が切れました。もう一度パスワードを入力してください' });
    return;
  }

  const heading = (title && String(title).trim()) || 'タイトル未入力';
  const text = (body && String(body).trim()) || '本文はまだ入力されていません。';
  const label = ctaLabel && String(ctaLabel).trim();
  const url = ctaUrl && String(ctaUrl).trim();

  const html = buildEmailHtml({
    heading,
    bodyHtml: textToHtmlParagraphs(text),
    ctaLabel: label || undefined,
    ctaUrl: label ? (url || SITE_URL) : undefined,
  });

  res.status(200).json({ html });
};
