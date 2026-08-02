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

// お問い合わせへの返信専用の送信元。ドメイン全体がResendで認証済みなので、
// NOTIFY_FROM_EMAIL（noreply@）とは別にこのアドレスを使ってもDNSの追加設定は不要。
// 「noreply」という名前だと返信を想定していない印象になるため、問い合わせ対応にはこちらを使う。
const INQUIRY_FROM_EMAIL = 'DRESS CODE TOKYO <info@dress-code-tokyo.com>';

const MAX_BLOCKS = 30;
const MAX_PARAGRAPH_LEN = 4000;
const MAX_LABEL_LEN = 40;
const MAX_ALT_LEN = 140;

// Console配信エディタの文字色パターン（サイトの黒白ベースを崩さない範囲の少数精鋭）
const TEXT_COLORS = { default: '#46443c', ink: '#16150f', muted: '#8a877c', accent: '#a1402c' };
function resolveColor(key, fallback) {
  return TEXT_COLORS[key] || TEXT_COLORS[fallback] || TEXT_COLORS.default;
}
const HEADING_SIZES = { lg: '24px', md: '19px', sm: '16px' };

function isHttpUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

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

function buttonHtml(label, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
    <tr><td>
      <a href="${escapeHtml(sanitizeUrl(url))}" style="display:inline-block; background:#16150f; color:#ffffff; text-decoration:none; font-size:14px; letter-spacing:0.02em; padding:14px 28px; border-radius:2px;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

/* Console（管理画面）の配信エディタが送ってくる「ブロック」配列を、
   メール本文のHTML／プレーンテキストの両方に変換する。
   ブロックの種類:
     - heading:  { type: 'heading', text, size: 'lg'|'md'|'sm', color }  … 見出し
     - paragraph:{ type: 'paragraph', text, color }                     … 段落
     - callout:  { type: 'callout', text }                              … 背景付きの強調ボックス
     - image:    { type: 'image', url, alt }                            … 画像（外部URLのみ。アップロード機能はまだ無い）
     - divider:  { type: 'divider' }                                    … 区切り線
     - button:   { type: 'button', label, url }                         … ボタン（本文中に挿入）
   タイトルの未入力／本文が空のときは呼び出し側でプレースホルダーを渡す想定。 */
function renderBlocks(blocks) {
  const list = Array.isArray(blocks) ? blocks.slice(0, MAX_BLOCKS) : [];
  const htmlParts = [];
  const textParts = [];

  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    if (raw.type === 'heading') {
      const text = String(raw.text || '').slice(0, MAX_PARAGRAPH_LEN).trim();
      if (!text) continue;
      const size = HEADING_SIZES[raw.size] || HEADING_SIZES.md;
      const color = resolveColor(raw.color, 'ink');
      htmlParts.push(`<h2 style="margin:0 0 14px; font-size:${size}; line-height:1.5; font-weight:700; color:${color};">${escapeHtml(text)}</h2>`);
      textParts.push(`■ ${text}`);
    } else if (raw.type === 'paragraph') {
      const text = String(raw.text || '').slice(0, MAX_PARAGRAPH_LEN).trim();
      if (!text) continue;
      const color = resolveColor(raw.color, 'default');
      htmlParts.push(`<p style="margin:0 0 16px; color:${color};">${escapeHtml(text).replace(/\n/g, '<br>')}</p>`);
      textParts.push(text);
    } else if (raw.type === 'callout') {
      const text = String(raw.text || '').slice(0, MAX_PARAGRAPH_LEN).trim();
      if (!text) continue;
      htmlParts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="background:#f4f3f0; border-left:3px solid #16150f; padding:14px 16px; font-size:14px; line-height:1.8; color:#46443c;">${escapeHtml(text).replace(/\n/g, '<br>')}</td></tr></table>`);
      textParts.push(`※ ${text}`);
    } else if (raw.type === 'image') {
      if (!isHttpUrl(raw.url)) continue;
      const url = raw.url.trim();
      const alt = String(raw.alt || '').slice(0, MAX_ALT_LEN).trim();
      // width を指定した画像（QRコードなど）は、その幅で中央に置く。
      // 指定が無ければ従来通り本文幅いっぱいに広げる。
      // QRを幅いっぱいに引き伸ばすと粗くなって読み取れなくなるため。
      const fixedWidth = Number.isFinite(raw.width) && raw.width > 0 ? Math.min(Math.floor(raw.width), 536) : null;
      if (fixedWidth) {
        htmlParts.push(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" width="${fixedWidth}" style="display:block; width:${fixedWidth}px; max-width:100%; height:auto; margin:0 auto 20px; background:#ffffff; padding:12px; border-radius:4px;">`);
      } else {
        htmlParts.push(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" width="536" style="display:block; width:100%; max-width:536px; height:auto; margin:0 0 20px; border-radius:4px;">`);
      }
      textParts.push(alt ? `[画像: ${alt}]` : `[画像: ${url}]`);
    } else if (raw.type === 'divider') {
      htmlParts.push('<div style="height:1px; background:#e5e3dd; margin:24px 0;"></div>');
      textParts.push('----------');
    } else if (raw.type === 'button') {
      const label = String(raw.label || '').slice(0, MAX_LABEL_LEN).trim();
      if (!label) continue;
      const url = sanitizeUrl(raw.url);
      htmlParts.push(buttonHtml(label, url));
      textParts.push(`▶ ${label}: ${url}`);
    }
  }

  return { html: htmlParts.join(''), text: textParts.join('\n\n') };
}

/* Apple / Stripe / Notion 的な、黒白ベースのシンプルなメールテンプレート。
   Gmail/Outlook等のクライアント差異に耐えるよう、CSSはすべてインラインで書く。
   ヘッダーはロゴ画像ではなく欧文の総称フォントで組んだワードマーク
   （メールクライアントはWebフォントを読み込めないことが多いため）。 */
function buildEmailHtml({ heading, bodyHtml, ctaLabel, ctaUrl, footerNote }) {
  const cta = ctaLabel && ctaUrl ? buttonHtml(ctaLabel, ctaUrl) : '';

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
            <td style="padding:32px 32px 24px; text-align:center; border-bottom:1px solid #16150f;">
              <div style="font-family:Georgia,'Times New Roman',serif; font-size:24px; letter-spacing:0.06em; color:#16150f;">DRESS CODE</div>
              <div style="font-family:Arial,Helvetica,sans-serif; font-size:10.5px; letter-spacing:0.5em; color:#8a877c; margin-top:5px;">TOKYO</div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 32px 8px;">
              <h1 style="margin:0 0 20px; font-size:19px; font-weight:600; color:#16150f; letter-spacing:0.02em;">${escapeHtml(heading)}</h1>
              <div style="font-size:15px; line-height:1.9; color:#46443c;">
                ${bodyHtml}
              </div>
              ${cta}
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
 * @param {string|string[]} params.to      宛先。カンマ区切りの文字列（例: "a@x.com, b@y.com"）も複数宛先として扱う
 * @param {string} params.subject
 * @param {string} [params.text]           プレーンテキスト本文（blocksを渡さない場合に使う既定の書き方）
 * @param {string} [params.ctaLabel]       ボタンの文言（textを使う場合のみ有効。例: 'マイページを見る'）
 * @param {string} [params.ctaUrl]         ボタンのリンク先（未指定ならボタンなし）
 * @param {Array}  [params.blocks]         Console配信エディタのブロック配列。指定時は text/ctaLabel/ctaUrl より優先
 * @param {string} [params.footerNote]     フッターの補足文（未指定なら既定文）
 * @param {string} [params.replyTo]        返信先アドレス（未指定なら送信元宛て＝実質返信不可になる）
 * @param {string} [params.from]           送信元を差し替えたいときに指定（未指定なら既定の NOTIFY_FROM_EMAIL）
 */
// 送信に成功したら true、失敗（またはスキップ）なら false を返す。
// 呼び出し側は戻り値を無視してもよいが、「購入確認メールが届かなかった」のような
// 重要な失敗は戻り値を見て運営に知らせること（エラーはここで握りつぶされ、例外は投げない）。
async function sendEmail({ to, subject, text, ctaLabel, ctaUrl, blocks, footerNote, replyTo, from: fromOverride }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = fromOverride || process.env.NOTIFY_FROM_EMAIL;
  if (!apiKey || !from || !to) return false;

  // "a@x.com, b@y.com" のようなカンマ区切り文字列は複数宛先の配列に変換する
  // （環境変数1つに複数アドレスを入れて、テスト用と本番用を同時に受け取れるようにするため）
  const toList = Array.isArray(to) ? to : String(to).split(',').map((s) => s.trim()).filter(Boolean);
  if (!toList.length) return false;

  let bodyHtml;
  let plainText;
  if (Array.isArray(blocks) && blocks.length) {
    const rendered = renderBlocks(blocks);
    bodyHtml = rendered.html;
    plainText = rendered.text;
  } else {
    bodyHtml = textToHtmlParagraphs(text);
    plainText = text;
  }

  const html = buildEmailHtml({
    heading: subject,
    bodyHtml,
    ctaLabel: Array.isArray(blocks) && blocks.length ? undefined : ctaLabel,
    ctaUrl: Array.isArray(blocks) && blocks.length ? undefined : ctaUrl,
    footerNote,
  });

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: toList,
        subject: `【DRESS CODE TOKYO】${subject}`,
        text: plainText,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) { console.error('Resend API error:', await res.text()); return false; }
    return true;
  } catch (e) {
    console.error('email send failed:', e);
    return false;
  }
}

module.exports = { sendEmail, buildEmailHtml, textToHtmlParagraphs, renderBlocks, SITE_URL, INQUIRY_FROM_EMAIL };
