/* =========================================================
   POST /api/contact
   ---------------------------------------------------------
   トップページ（index.html）の Contact セクションに埋め込んだ
   お問い合わせフォームの送信先。Googleフォームのiframe埋め込みから
   サイト内フォームに移行したことで追加された。

   やること:
     1. 内容を inquiries テーブルに保存する（これが正式な記録。
        /console の「お問い合わせ」タブから一覧・返信できる）
     2. 見逃し防止のため、運営の普段のメールアドレス（環境変数 CONTACT_TO_EMAIL、
        未設定なら NOTIFY_FROM_EMAIL）に「届きました」の通知メールを送る（ベストエフォート）
     3. 問い合わせ者本人に「受け付けました」の自動返信メールを送る（ベストエフォート）

   通知メールにはあえて Reply-To を設定していない（＝返信ボタンを押しても
   問い合わせ者には届かない）。理由: Gmail等で直接返信できてしまうと、
   consoleでの返信と二重に返事をしてしまう事故が起きるため。
   返信は必ず /console から行う運用にすることで、どのやり取りが「対応済み」かを
   inquiries.status で一元管理できるようにしている。

   迷惑メール対策:
     1. honeypot（人には見えない company フィールド）に入力があれば無言で破棄
     2. 同一IPからの連投を短時間だけブロック（インスタンス内メモリのみの簡易版）
   ========================================================= */
const { createClient } = require('@supabase/supabase-js');
const { sendEmail, SITE_URL, INQUIRY_FROM_EMAIL } = require('../lib/mailer');

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

  // ---------- 1. inquiries テーブルへ保存（これが正式な記録） ----------
  const serviceClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { error: insertErr } = await serviceClient.from('inquiries').insert({
    reason: cleanReason,
    name: cleanName,
    email: cleanEmail,
    message: cleanMessage,
  });
  if (insertErr) {
    console.error('inquiries insert failed:', insertErr.message);
    res.status(500).json({ error: '送信に失敗しました。時間をおいて再度お試しください。' });
    return;
  }

  // ---------- 2. 運営への通知メール（ベストエフォート。失敗しても保存自体は成功扱い） ----------
  const to = process.env.CONTACT_TO_EMAIL || process.env.NOTIFY_FROM_EMAIL;
  if (to) {
    const blocks = [
      { type: 'heading', text: `【${cleanReason}】${cleanName} 様よりお問い合わせ`, size: 'md' },
      { type: 'callout', text: `お名前: ${cleanName}\nメールアドレス: ${cleanEmail}\nご用件: ${cleanReason}` },
      { type: 'paragraph', text: cleanMessage },
      { type: 'button', label: 'コンソールで確認・返信する', url: `${SITE_URL}/admin-announcements.html` },
    ];
    try {
      await sendEmail({
        to,
        subject: `お問い合わせ（${cleanReason}）`,
        blocks,
        // 意図的にReply-Toを設定しない。ここに返信しても問い合わせ者には届かない
        // （consoleでの返信と二重対応になる事故を防ぐため）。
        footerNote: 'このメールに返信しても送信者には届きません。対応は「/console」の「お問い合わせ」から行ってください。',
      });
    } catch (err) {
      console.error('contact notification email failed:', err);
    }
  } else {
    console.warn('contact: CONTACT_TO_EMAIL / NOTIFY_FROM_EMAIL が未設定のため通知メールは送られません（inquiriesへの保存は成功しています）');
  }

  // ---------- 3. 問い合わせ者本人への自動返信（ベストエフォート） ----------
  // info@ から送る。相手がこれに返信した場合はCONTACT_TO_EMAIL（運営の普段のメール）に届く
  // （info@ 自体は受信箱を持たない送信専用アドレスのため）。
  try {
    await sendEmail({
      to: cleanEmail,
      subject: `お問い合わせを受け付けました（${cleanReason}）`,
      from: INQUIRY_FROM_EMAIL,
      blocks: [
        { type: 'paragraph', text: `${cleanName} 様` },
        { type: 'paragraph', text: 'このたびはお問い合わせいただき、誠にありがとうございます。以下の内容で受け付けました。24時間以内にご返信させていただきますので、今しばらくお待ちください。' },
        { type: 'divider' },
        { type: 'callout', text: `ご用件: ${cleanReason}\n\nお問い合わせ内容:\n${cleanMessage}` },
      ],
      replyTo: process.env.CONTACT_TO_EMAIL || undefined,
      footerNote: 'このメールは自動送信されています。',
    });
  } catch (err) {
    console.error('contact auto-reply email failed:', err);
  }

  res.status(200).json({ ok: true });
};
