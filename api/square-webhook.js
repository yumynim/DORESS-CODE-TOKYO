/* =========================================================
   POST /api/square-webhook
   ---------------------------------------------------------
   Squareから「決済が完了しました」等の通知を受け取るエンドポイント。
   Square Developer Dashboard → Webhooks で、このURLを通知先として登録する
   （例: https://dress-code-tokyo.com/api/square-webhook）。

   最重要：署名を検証してから処理すること。
   検証しないと、誰でもこのURLに偽の「決済完了しました」を送りつけて、
   お金を払っていないのに購入済み扱いにできてしまう（なりすまし）。

   決済の結果（完了／キャンセル）が確定したら、購入者に2通りの方法で知らせる：
   1. サイト内通知（notifications テーブルに1件insert → マイページの「お知らせ」欄に出る）
   2. メール（Resend の API を利用。RESEND_API_KEY / NOTIFY_FROM_EMAIL が未設定の場合は
      サイト内通知だけ届き、メール送信は静かにスキップされる）
   ========================================================= */
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { sendEmail, SITE_URL } = require('../lib/mailer');

// 当日の入場確認用コード。「DCT-イベント識別番号-カテゴリ+連番」の形式
// （例: 2026年9月27日開催のイベントなら DCT-0927-S1（出店者1人目）、DCT-0927-N1（来場者1人目）…）。
// イベント識別番号はイベントごとにVercelの環境変数 CURRENT_EVENT_ID を変えるだけで良く、
// 変えると出店者(S)・来場者(N)の連番はどちらも1から自動的に再スタートする
// （supabase/schema_v10_event_sequence.sql の next_entry_seq() がイベントID×カテゴリ単位で数える）。
// 連番はDBの関数でアトミックに発行するため、同時に決済が完了しても重複しない。
function currentEventId() {
  return process.env.CURRENT_EVENT_ID || 'EVENT';
}

// チケット名からカテゴリ（S=出店者 / N=来場者）を判定する。
// js/data.js のticketsB（出店料）/ticketsC（1日入場チケット）の名前に含まれる語で判定しているだけなので、
// 将来チケットの名前を変えるときはこの判定も見直すこと。どちらにも一致しない場合はXにする。
function categoryFor(ticketName) {
  const name = String(ticketName || '');
  if (name.includes('出店')) return 'S';
  if (name.includes('入場')) return 'N';
  return 'X';
}

async function generateEntryCode(serviceClient, ticketName) {
  const eventId = currentEventId();
  const category = categoryFor(ticketName);
  const { data: seq, error } = await serviceClient.rpc('next_entry_seq', { p_event: eventId, p_category: category });
  if (error) { console.error('next_entry_seq failed:', error.message); return null; }
  return `DCT-${eventId}-${category}${seq}`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 受付コードのQR画像URL。外部の無料サービス（api.qrserver.com）に生成を任せる。
// 追加のライブラリ・課金無しで済ませるためで、渡すのは受付コードだけ（氏名・メール等の個人情報は含まない）。
// 注意: 受付コードはv10以降「イベントID+カテゴリ+連番」の推測できる値なので、これ単体を
// 秘密の入場鍵として扱わないこと。当日は/checkinに出る氏名・メールと本人を突き合わせて確認する。
function entryCodeQrUrl(code, size) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size || 240}x${size || 240}&data=${encodeURIComponent(code)}`;
}

// purchases.entry_code はユニーク制約があるため、衝突したら別の連番で数回だけ再試行する
// （next_entry_seq()はアトミックなので通常は衝突しないが、念のための保険）。
async function assignEntryCode(serviceClient, purchaseId, ticketName) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await generateEntryCode(serviceClient, ticketName);
    if (!code) return null;
    const { data, error } = await serviceClient
      .from('purchases')
      .update({ entry_code: code })
      .eq('id', purchaseId)
      .select('entry_code')
      .single();
    if (!error) return data.entry_code;
    if (error.code !== '23505') { console.error('entry_code assign failed:', error.message); return null; }
  }
  console.error('entry_code assign failed: 衝突が続いたため断念しました purchaseId=', purchaseId);
  return null;
}

async function notifyPurchaser(serviceClient, purchase, newStatus) {
  const isPaid = newStatus === 'paid';
  const title = isPaid ? 'ご購入ありがとうございます' : 'お支払いがキャンセルされました';
  const body = isPaid
    ? `${purchase.ticket_name} のお支払いが完了しました。${purchase.entry_code ? `当日の受付コードは「${purchase.entry_code}」です。` : ''}マイページから購入内容を確認できます。`
    : `${purchase.ticket_name} のお支払いがキャンセル、または失敗しました。お手数ですが再度お手続きください。`;

  // Squareはこちらの応答が遅いと同じ通知を再送してくることがある。
  // 同じ購入について同じ内容の通知が既にあれば、二重通知・二重メール送信を避けてここで打ち切る。
  const { data: existing, error: existingErr } = await serviceClient
    .from('notifications')
    .select('id')
    .eq('purchase_id', purchase.id)
    .eq('title', title)
    .limit(1);
  if (existingErr) console.error('duplicate check failed (続行して通知は送る):', existingErr.message);
  else if (existing && existing.length) {
    console.warn('重複したwebhook通知を検知、スキップします。purchase_id=', purchase.id);
    return;
  }

  // 通知ベルのドロワーは body_html があればそれを表示する（無ければ body のプレーンテキスト）。
  // 受付コードがある場合はQR画像もその場で見られるようにする（メール・マイページと同じ扱い）。
  const bodyHtml = (isPaid && purchase.entry_code)
    ? `<p>${escapeHtml(body)}</p><p style="margin-top:10px; font-weight:700;">${escapeHtml(purchase.entry_code)}</p>` +
      `<img src="${entryCodeQrUrl(purchase.entry_code, 140)}" alt="受付QRコード" width="140" height="140" style="margin-top:8px;">`
    : null;

  const { error: notifErr } = await serviceClient.from('notifications').insert({
    user_id: purchase.user_id,
    purchase_id: purchase.id,
    title,
    body,
    body_html: bodyHtml,
  });
  if (notifErr) console.error('notifications insert failed:', notifErr.message);

  const { data, error } = await serviceClient.auth.admin.getUserById(purchase.user_id);
  const to = data && data.user && data.user.email;
  if (error || !to) { console.error('email skipped: user email not found', error && error.message); return; }

  if (isPaid && purchase.entry_code) {
    // 受付コードをQR画像付きで送る（当日スタッフがカメラで読み取れるように）。
    // blocksを使う分岐に切り替えているだけで、届く見た目（黒×白のテンプレート）は他の通知と同じ。
    await sendEmail({
      to,
      subject: title,
      blocks: [
        { type: 'paragraph', text: body },
        { type: 'image', url: entryCodeQrUrl(purchase.entry_code), alt: '受付QRコード ' + purchase.entry_code },
        { type: 'button', label: 'マイページで確認する', url: SITE_URL },
      ],
    });
  } else {
    await sendEmail({
      to,
      subject: title,
      text: body,
      ctaLabel: isPaid ? 'マイページで確認する' : 'サイトに戻る',
      ctaUrl: SITE_URL,
    });
  }

  await notifyAdmin(purchase, newStatus, to);
}

// 運営（自分）宛ての通知。お問い合わせフォームと同じ宛先（CONTACT_TO_EMAIL、未設定ならNOTIFY_FROM_EMAIL）に送る。
// 未設定でもエラーにせず静かにスキップする（購入者本人への通知は既に送信済みのため、これが失敗しても支障は無い）。
async function notifyAdmin(purchase, newStatus, buyerEmail) {
  const adminTo = process.env.CONTACT_TO_EMAIL || process.env.NOTIFY_FROM_EMAIL;
  if (!adminTo) {
    console.warn('square-webhook: CONTACT_TO_EMAIL / NOTIFY_FROM_EMAIL が未設定のため運営宛て通知はスキップします');
    return;
  }
  const isPaid = newStatus === 'paid';
  const subject = isPaid ? `【購入通知】${purchase.ticket_name}` : `【キャンセル通知】${purchase.ticket_name}`;
  const lines = [
    `${purchase.ticket_name} が${isPaid ? 'ご購入' : 'キャンセル'}されました。`,
    `購入者: ${buyerEmail}`,
  ];
  if (isPaid && purchase.entry_code) lines.push(`受付コード: ${purchase.entry_code}`);
  try {
    await sendEmail({ to: adminTo, subject, text: lines.join('\n') });
  } catch (e) {
    console.error('admin notify email failed:', e);
  }
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function isValidSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const notificationUrl = process.env.SQUARE_WEBHOOK_URL || '';
  const hmac = crypto.createHmac('sha256', process.env.SQUARE_WEBHOOK_SIGNATURE_KEY);
  hmac.update(notificationUrl + rawBody);
  const expected = hmac.digest('base64');
  // timingSafeEqual でタイミング攻撃を防ぐ（単純な文字列比較 === は避ける）
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers['x-square-hmacsha256-signature'];

  if (!isValidSignature(rawBody, signature)) {
    console.warn('Square webhook: 署名が一致しませんでした（なりすましの可能性、または SQUARE_WEBHOOK_URL の設定ミス）');
    res.status(403).json({ error: 'invalid signature' });
    return;
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    res.status(400).json({ error: 'invalid JSON' });
    return;
  }

  try {
    // 支払い完了（payment.updated）だけを見る。他のイベント種別は無視してOK（200を返しておく）。
    if (event.type === 'payment.updated') {
      const payment = event.data && event.data.object && event.data.object.payment;
      const orderId = payment && payment.order_id;
      const status = payment && payment.status; // 'COMPLETED' | 'FAILED' | 'CANCELED' など

      if (orderId && status) {
        const newStatus = status === 'COMPLETED' ? 'paid' : (status === 'FAILED' || status === 'CANCELED') ? 'canceled' : null;
        if (newStatus) {
          const serviceClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
          const { data: purchase, error } = await serviceClient
            .from('purchases')
            .update({ status: newStatus })
            .eq('square_order_id', orderId)
            .select('id, user_id, ticket_name, entry_code')
            .single();
          if (error) console.error('purchases update failed:', error.message);
          else if (purchase) {
            // 受付コードは支払い完了(paid)の最初の1回だけ発行する（再送で毎回変わらないように既存値があれば使う）
            if (newStatus === 'paid' && !purchase.entry_code) {
              purchase.entry_code = await assignEntryCode(serviceClient, purchase.id, purchase.ticket_name);
            }
            await notifyPurchaser(serviceClient, purchase, newStatus);
          }
        }
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('square-webhook handler error:', err);
    // Squareは失敗時に再送してくるので、こちらの不具合で200を返し損ねても再試行される。
    // ただし故意に500を返し続けると通知が止められることがあるため、原因究明を優先する。
    res.status(500).json({ error: 'internal error' });
  }
}

module.exports = handler;
// Vercelの自動JSONパースを止めて、署名検証に必要な「生の（加工前の）本文」を自分で読む。
// 署名はこの生の文字列に対して計算されているため、一度でもJSONとしてパース→再構築すると
// 空白やキー順序が変わって署名が一致しなくなる（＝ここが一番ハマりやすいバグ）。
// 注意: module.exports を後から上書きすると config が消えるため、必ずこの順番で書くこと。
module.exports.config = { api: { bodyParser: false } };
