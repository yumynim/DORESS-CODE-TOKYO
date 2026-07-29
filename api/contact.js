/* =========================================================
   POST /api/contact
   ---------------------------------------------------------
   トップページ（index.html）の Contact セクションに埋め込んだ
   お問い合わせフォームの送信先。Googleフォームのiframe埋め込みから
   サイト内フォームに移行したことで追加された。

   受け取った内容を Resend 経由で運営のメールアドレスに転送する。
   宛先は環境変数 CONTACT_TO_EMAIL（未設定なら NOTIFY_FROM_EMAIL に届く）。
   送信元（From）はResendでドメイン認証済みのアドレス（NOTIFY_FROM_EMAIL）を使う必要があるため、
   問い合わせ者のアドレスは Reply-To に入れる（＝そのまま「返信」で本人に返せる）。

   迷惑メール対策:
     1. honeypot（人には見えない company フィールド）に入力があれば無言で破棄
     2. 同一IPからの連投を短時間だけブロック（インスタンス内メモリのみの簡易版）
   ========================================================= */
const { sendEmail } = require('../lib/mailer');

const MAX_NAME = 80;
const MAX_EMAIL = 160;
const MAX_MESSAGE = 4000;
const MAX_REASON = 40;

// 簡易レート制限。Vercel Functionsはインスタンスが使い回されている間だけ有効な
// ベストエフォート（完全な防御ではなく、明らかな連投を減らすためのもの）。
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 3;
const recentByIp = new Map();

function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const hits = (recentByIp.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  recentByIp.set(ip, hits);
  // Mapが無限に増えないよう、たまに古いエントリを掃除する
  if (recentByIp.size > 500) {
    for (const [key, times] of recentByIp) {
      if (!times.some((t) => now - t < RATE_WINDOW_MS)) recentByIp.delete(key);
    }
  }
  return hits.length > RATE_MAX;
}

function looksLikeEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'このメソッドは対応していません' });
    return;
  }

  const { reason, name, email, message, company } = req.body || {};

  // honeypot: 人間には見えない欄なので、埋まっていたらbot。
  // 相手に対策を教えないよう、エラーではなく成功を装って何もしない。
  if (company) { res.status(200).json({ ok: true }); return; }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (isRateLimited(ip)) {
    res.status(429).json({ error: '送信が集中しています。しばらく時間をおいてから再度お試しください。' });
    return;
  }

  const cleanName = String(name || '').trim().slice(0, MAX_NAME);
  const cleanEmail = String(email || '').trim().slice(0, MAX_EMAIL);
  const cleanMessage = String(message || '').trim().slice(0, MAX_MESSAGE);
  const cleanReason = String(reason || 'お問い合わせ').trim().slice(0, MAX_REASON) || 'お問い合わせ';

  if (!cleanName || !cleanMessage) {
    res.status(400).json({ error: 'お名前とお問い合わせ内容をご記入ください' });
    return;
  }
  if (!looksLikeEmail(cleanEmail)) {
    res.status(400).json({ error: 'メールアドレスの形式が正しくありません' });
    return;
  }

  const to = process.env.CONTACT_TO_EMAIL || process.env.NOTIFY_FROM_EMAIL;
  if (!to) {
    console.error('contact: CONTACT_TO_EMAIL / NOTIFY_FROM_EMAIL が未設定のため転送できません');
    res.status(500).json({ error: '現在お問い合わせを受け付けられません。お手数ですがSNSのDMからご連絡ください。' });
    return;
  }

  // 運営向けの通知メール。Reply-To に問い合わせ者を入れているので、
  // 受け取ったメールにそのまま「返信」すれば本人に届く。
  const blocks = [
    { type: 'heading', text: `【${cleanReason}】${cleanName} 様よりお問い合わせ`, size: 'md' },
    { type: 'callout', text: `お名前: ${cleanName}\nメールアドレス: ${cleanEmail}\nご用件: ${cleanReason}` },
    { type: 'paragraph', text: cleanMessage },
  ];

  try {
    await sendEmail({
      to,
      subject: `お問い合わせ（${cleanReason}）`,
      blocks,
      replyTo: cleanEmail,
      footerNote: 'このメールはサイトのお問い合わせフォームから自動送信されています。そのまま返信すると送信者本人に届きます。',
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('contact handler error:', err);
    res.status(500).json({ error: '送信に失敗しました。時間をおいて再度お試しください。' });
  }
};
