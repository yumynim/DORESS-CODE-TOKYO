/* =========================================================
   POST /api/admin-preview-email
   ---------------------------------------------------------
   admin-announcements.html（/console）の配信エディタ用。
   タイトルとブロック配列（段落／区切り線／ボタン）を受け取り、
   実際に送るメールとまったく同じ組み立て（lib/mailer.js）でHTMLを
   生成して返すだけの、送信を伴わないプレビュー専用エンドポイント。
   認証はほかの管理API同様、共通パスワードのトークン（lib/adminAuth.js）。
   ========================================================= */
const { verifyAdminToken } = require('../lib/adminAuth');
const { buildEmailHtml, renderBlocks } = require('../lib/mailer');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'このメソッドは対応していません' });
    return;
  }

  const { token, title, blocks } = req.body || {};
  if (!verifyAdminToken(token, 'admin')) {
    res.status(401).json({ error: '認証が切れました。もう一度パスワードを入力してください' });
    return;
  }

  const heading = (title && String(title).trim()) || 'タイトル未入力';
  const rendered = renderBlocks(blocks);
  const bodyHtml = rendered.html || '<p style="margin:0 0 16px; color:#a5a297;">本文はまだ入力されていません。</p>';

  const html = buildEmailHtml({ heading, bodyHtml });

  res.status(200).json({ html });
};
