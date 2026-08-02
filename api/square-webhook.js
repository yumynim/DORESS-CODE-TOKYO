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
const { categoryFromItems } = require('../lib/catalog');

// 当日の入場確認用コード。「DCT-イベント識別番号-カテゴリ+連番-ランダム4文字」の形式
// （例: 2026年9月27日開催のイベントなら DCT-0927-S1-7K4M（出店者1人目）、DCT-0927-N1-QX52（来場者1人目）…）。
// イベント識別番号はイベントごとにVercelの環境変数 CURRENT_EVENT_ID を変えるだけで良く、
// 変えると出店者(S)・来場者(N)の連番はどちらも1から自動的に再スタートする
// （supabase/schema_v10_event_sequence.sql の next_entry_seq() がイベントID×カテゴリ単位で数える）。
// 連番はDBの関数でアトミックに発行するため、同時に決済が完了しても重複しない。
//
// 末尾のランダム4文字は、連番だけだと次の人のコードが簡単に推測できてしまうため
// （DCT-0927-N1 の次は N2）、他人になりすまして入場されるのを防ぐ目的で付けている。
function currentEventId() {
  return process.env.CURRENT_EVENT_ID || 'EVENT';
}

// 受付コード末尾のランダム部分に使う文字。口頭で伝えることを想定して、
// 聞き間違い・見間違いしやすい文字（0とO、1とI・L）は最初から除いてある。
const ENTRY_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const ENTRY_CODE_RANDOM_LENGTH = 4;

function randomEntryCodeSuffix() {
  let out = '';
  for (let i = 0; i < ENTRY_CODE_RANDOM_LENGTH; i += 1) {
    out += ENTRY_CODE_ALPHABET[crypto.randomInt(ENTRY_CODE_ALPHABET.length)];
  }
  return out;
}

// カテゴリ（S=出店者 / N=来場者）は、購入時に保存した items の catalogObjectId から
// lib/catalog.js（サーバー側の正本）を引いて決める。
//
// 以前はチケット名に「出店」「入場」が含まれるかで判定していたが、その名前は
// ブラウザから送られてきた値をそのまま保存していたため、
//   1,000円の入場チケットを買いながら name だけ「出店料…」と送る
//   → 5,000円の出店者用コード(S)が発行される
// という抜け道があった。名前は表示用と割り切り、判定には使わない。
//
// itemsが無い古い購入記録のためだけに、名前による判定を残してある。
function categoryFor(purchase) {
  const fromItems = categoryFromItems(purchase && purchase.items);
  if (fromItems) return fromItems;

  const name = String((purchase && purchase.ticket_name) || '');
  if (name.includes('出店')) return 'S';
  if (name.includes('入場')) return 'N';
  return 'X';
}

// 連番部分（DCT-0927-N1 まで）を発行する。ランダム部分は assignEntryCode 側で付ける。
// 分けているのは、書き込みに失敗して再試行するときに連番まで取り直すと
// 番号が飛んでしまう（1人しか買っていないのに N3 になる）ため。
async function generateEntryCodePrefix(serviceClient, purchase) {
  const eventId = currentEventId();
  const category = categoryFor(purchase);
  const { data: seq, error } = await serviceClient.rpc('next_entry_seq', { p_event: eventId, p_category: category });
  if (error) { console.error('next_entry_seq failed:', error.message); return null; }
  return `DCT-${eventId}-${category}${seq}`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 受付コードのQR画像URL。外部の無料サービス（api.qrserver.com）に生成を任せる。
// 追加のライブラリ・課金無しで済ませるためで、渡すのは受付コードだけ（氏名・メール等の個人情報は含まない）。
// 受付コードの末尾4文字はランダムなので、他人のコードから次の人のコードを推測することはできない。
function entryCodeQrUrl(code, size) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size || 240}x${size || 240}&data=${encodeURIComponent(code)}`;
}

// purchases.entry_code はユニーク制約があるため、衝突したらランダム部分だけ変えて数回再試行する。
// 連番（prefix）は最初に1回だけ取る（再試行のたびに取り直すと番号が飛ぶため）。
async function assignEntryCode(serviceClient, purchase) {
  const prefix = await generateEntryCodePrefix(serviceClient, purchase);
  if (!prefix) return null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `${prefix}-${randomEntryCodeSuffix()}`;
    const { data, error } = await serviceClient
      .from('purchases')
      .update({ entry_code: code })
      .eq('id', purchase.id)
      .select('entry_code')
      .single();
    if (!error) return data.entry_code;
    // 23505 = ユニーク制約違反。ランダム部分がたまたま既存と被った場合なので引き直す。
    // それ以外のエラー（該当行が無い等）は引き直しても直らないので即あきらめる。
    if (error.code !== '23505') { console.error('entry_code assign failed:', error.message); return null; }
  }
  console.error('entry_code assign failed: 衝突が続いたため断念しました purchaseId=', purchase.id);
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
  // 件名に改行が混ざらないようにする（ticket_nameはカタログ由来だが、念のため）
  const safeName = String(purchase.ticket_name || '').replace(/[\r\n]+/g, ' ');
  const subject = isPaid ? `【購入通知】${safeName}` : `【キャンセル通知】${safeName}`;
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

// チャンクをBufferのまま集めてから最後に文字列化する。
// `data += chunk` のように1チャンクずつ文字列化すると、日本語などのマルチバイト文字が
// チャンクの境目で分断されたときに文字化けし、署名計算の対象がSquareの送った本文と
// 変わってしまう（＝正規の通知なのに署名不一致で弾かれ、決済が反映されなくなる）。
// 受付コードを発行できなかったときに運営へ知らせる。
// これを出さないと、購入者にはコードの無いメールが届くだけで、
// こちらは当日その人が受付に来るまで気づけない。
async function notifyEntryCodeFailure(purchase) {
  const adminTo = process.env.CONTACT_TO_EMAIL || process.env.NOTIFY_FROM_EMAIL;
  if (!adminTo) return;
  const safeName = String(purchase.ticket_name || '').replace(/[\r\n]+/g, ' ');
  try {
    await sendEmail({
      to: adminTo,
      subject: '【要対応】受付コードを発行できませんでした',
      text: [
        `${safeName} の決済は完了しましたが、受付コードを発行できませんでした。`,
        `購入ID: ${purchase.id}`,
        '',
        'このままだと当日この方が入場できません。Supabaseで下記を確認し、手動で対応してください。',
        "  select id, user_id, ticket_name, created_at from purchases where status='paid' and entry_code is null;",
        '',
        'よくある原因: CURRENT_EVENT_ID の未設定、next_entry_seq 関数の権限不足（schema_v14参照）。',
      ].join('\n'),
    });
  } catch (e) {
    console.error('entry code failure notify email failed:', e);
  }
}

// 返金が確定したときに運営へ知らせる。すでに入場済みだった場合は特に目立つようにする
// （入場した人に返金した、という状況は人手での確認が要るため）。
async function notifyRefund(purchase) {
  const adminTo = process.env.CONTACT_TO_EMAIL || process.env.NOTIFY_FROM_EMAIL;
  if (!adminTo) return;
  const safeName = String(purchase.ticket_name || '').replace(/[\r\n]+/g, ' ');
  const lines = [
    `${safeName} が返金されました。受付コードを無効にしました。`,
    purchase.entry_code ? `無効にしたコード: ${purchase.entry_code}` : '',
    purchase.checked_in_at
      ? `※このお客様は ${new Date(purchase.checked_in_at).toLocaleString('ja-JP')} に入場済みです。ご確認ください。`
      : '',
  ].filter(Boolean);
  try {
    await sendEmail({ to: adminTo, subject: `【返金】${safeName}`, text: lines.join('\n') });
  } catch (e) {
    console.error('refund notify email failed:', e);
  }
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => { chunks.push(Buffer.from(chunk)); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function isValidSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;

  // 署名鍵が未設定・空文字なら必ず false を返す（＝全部拒否する）。
  // 空文字のままだと createHmac は例外を投げずに動いてしまい、「鍵が空文字」という
  // 誰でも知っている鍵で署名を検証することになる。つまりVercelの環境変数を
  // うっかり空で保存しただけで、誰でも「決済が完了しました」を送り込めるようになる。
  const secret = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!secret) {
    console.error('SQUARE_WEBHOOK_SIGNATURE_KEY が未設定です。Webhookをすべて拒否します。');
    return false;
  }

  const notificationUrl = process.env.SQUARE_WEBHOOK_URL || '';
  const hmac = crypto.createHmac('sha256', secret);
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
            .select('id, user_id, ticket_name, entry_code, items')
            .single();
          if (error) console.error('purchases update failed:', error.message);
          else if (purchase) {
            // 受付コードは支払い完了(paid)の最初の1回だけ発行する（再送で毎回変わらないように既存値があれば使う）
            if (newStatus === 'paid' && !purchase.entry_code) {
              purchase.entry_code = await assignEntryCode(serviceClient, purchase);
              // 発行に失敗しても決済自体は成立しているので処理は続ける（購入者には通知が届く）。
              // ただしコード無しのまま放置すると当日その人が入場できないので、運営に知らせる。
              if (!purchase.entry_code) await notifyEntryCodeFailure(purchase);
            }
            await notifyPurchaser(serviceClient, purchase, newStatus);
          }
        }
      }
    }

    // 返金（refund.created / refund.updated）。
    // Squareで返金しても payment.status は COMPLETED のままなので、上の分岐には入らない。
    // ここを実装していないと「返金したのに受付コードが有効なまま」になり、
    // お金を返した相手がそのまま入場できてしまう。
    if (event.type === 'refund.created' || event.type === 'refund.updated') {
      const refund = event.data && event.data.object && event.data.object.refund;
      const orderId = refund && refund.order_id;
      const refundStatus = refund && refund.status; // 'PENDING' | 'COMPLETED' | 'REJECTED' | 'FAILED'

      // 返金が確定したときだけ取り消す（申請中・失敗では取り消さない）
      if (orderId && refundStatus === 'COMPLETED') {
        const serviceClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { data: purchase, error } = await serviceClient
          .from('purchases')
          .select('id, user_id, ticket_name, entry_code, status, checked_in_at')
          .eq('square_order_id', orderId)
          .maybeSingle();

        if (error) console.error('refund lookup failed:', error.message);
        else if (!purchase) console.warn('返金通知に対応する購入記録が見つかりません order_id=', orderId);
        else if (purchase.status === 'refunded') {
          console.warn('返金済みとして処理済みです。スキップします purchase_id=', purchase.id);
        } else {
          // 受付コードを外して入場できないようにする。
          // 入場後に返金された場合は checked_in_at が残るので、運営が後から気づける。
          const { error: updateErr } = await serviceClient
            .from('purchases')
            .update({ status: 'refunded', entry_code: null })
            .eq('id', purchase.id);
          if (updateErr) console.error('refund update failed:', updateErr.message);
          else await notifyRefund(purchase);
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
