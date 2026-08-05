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
const { qrDataUri } = require('../lib/qr');
const { categoryFromItems, getCatalogItem } = require('../lib/catalog');

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

// 1枚ごとのカテゴリ一覧を作る。「出店料1＋入場2」の混載カートで全部が出店者(S)コードに
// なると、受付で入場者2人が「出店者コード」に見えて現場が混乱するため、
// 出店料の枚数分は S、入場チケットの枚数分は N、と1枚ずつ正しく割り当てる。
function passCategoriesFor(purchase) {
  const items = Array.isArray(purchase && purchase.items) ? purchase.items : [];
  const cats = [];
  for (const it of items) {
    const entry = getCatalogItem(it && it.catalogObjectId);
    const qty = Number(it && it.quantity);
    if (!entry || !Number.isInteger(qty) || qty < 1) continue;
    for (let i = 0; i < qty && cats.length < 400; i += 1) cats.push(entry.category);
  }
  // 出店者(S)を先に並べる（連番と「1人目/2人目」ラベルが種類ごとにまとまるように）
  cats.sort().reverse();
  return cats;
}

// 受付コードの発行。数量2で買ったら別々のコードを2つ発行する（1コード＝1人＝1回入場）。
// 実際の生成・保存はDB関数 issue_entry_passes（supabase/schema_v16_entry_passes.sql）が
// 行ロック付きで行うので、Squareが同じ通知を再送して同時に2回呼ばれても二重発行にならない
// （2回目は発行済みのコードがそのまま返る）。
async function issueEntryPasses(serviceClient, purchase) {
  const categories = passCategoriesFor(purchase);
  const { data, error } = await serviceClient.rpc('issue_entry_passes', {
    p_purchase_id: purchase.id,
    p_event: currentEventId(),
    p_category: categoryFor(purchase), // 1枚ごとの割り当てが作れない古い購入用の予備
    p_categories: categories.length ? categories : null,
  });
  if (error) { console.error('issue_entry_passes failed:', error.message); return []; }
  // returns setof text は文字列の配列で返る（PostgRESTの仕様が変わっても拾えるよう両対応）
  return (data || [])
    .map((r) => (typeof r === 'string' ? r : (r && (r.issue_entry_passes || r.code))))
    .filter(Boolean);
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}


async function notifyPurchaser(serviceClient, purchase, newStatus) {
  const isPaid = newStatus === 'paid';
  const title = isPaid ? 'ご購入ありがとうございます' : 'お支払いがキャンセルされました';
  // 受付コードは1人1つ（数量2なら2つ）。issue_entry_passes の結果が入っている。
  const codes = Array.isArray(purchase.entry_codes) ? purchase.entry_codes : [];
  const codesText = codes.length
    ? (codes.length === 1
      ? `当日の受付コードは「${codes[0]}」です。`
      : `当日の受付コードは ${codes.map((c) => `「${c}」`).join(' ')} の${codes.length}つです。コードはお一人につき1つ・1回のみ有効です。ご同行者にはそれぞれのコード（QR）をお渡しください。`)
    : '';
  const body = isPaid
    ? `${purchase.ticket_name} のお支払いが完了しました。${codesText}マイページから購入内容を確認できます。`
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
  // QRはその場で生成してHTMLに直接埋め込む（外部サービスへの通信が発生しないため、
  // 何人分あっても確実に表示される。理由は下のメール送信部分のコメント参照）。
  const bodyHtml = (isPaid && codes.length)
    ? `<p>${escapeHtml(body)}</p>` + codes.map((c, i) =>
        `<p style="margin-top:10px; font-weight:700;">${codes.length > 1 ? `${i + 1}人目：` : ''}${escapeHtml(c)}</p>` +
        `<img src="${qrDataUri(c, 12)}" alt="受付QRコード ${escapeHtml(c)}" width="140" height="140" style="margin-top:4px;">`
      ).join('')
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

  let sent;
  if (isPaid && codes.length) {
    // 受付コードをQR画像付きで送る（当日スタッフがカメラで読み取れるように）。
    // まとめ買いのときは1人分ずつ「◯人目」のラベルを付けて全コードを載せる。
    //
    // QRは api.qrserver.com（外部の無料サービス）からURLで読み込む方式をやめ、
    // その場で生成してメールに直接埋め込む（data URI）方式にした。
    // 2人分以上のコードを1通のメールに載せたとき、メールソフトが複数の外部画像を
    // ほぼ同時に取得しようとして2人目以降の画像が表示されない事故が実際に起きたため
    // （受付コードは当日の入場そのものに関わるので、外部サービスの調子に
    // 左右されてはいけない）。埋め込み後は表示に一切の通信が発生しないので、
    // 何人分あっても確実に表示される。
    const blocks = [{ type: 'paragraph', text: body }];
    codes.forEach((c, i) => {
      if (codes.length > 1) blocks.push({ type: 'paragraph', text: `── ${i + 1}人目 ──　${c}` });
      blocks.push({ type: 'image', url: qrDataUri(c, 12), alt: '受付QRコード ' + c, width: 240 });
    });
    blocks.push({ type: 'button', label: 'マイページで確認する', url: SITE_URL + '/members-only.html' });
    sent = await sendEmail({ to, subject: title, blocks });
  } else {
    sent = await sendEmail({
      to,
      subject: title,
      text: body,
      ctaLabel: isPaid ? 'マイページで確認する' : 'サイトに戻る',
      ctaUrl: isPaid ? SITE_URL + '/members-only.html' : SITE_URL,
    });
  }

  // 確認メールを送れなかった場合、届かなかったこと自体には誰も気づけない
  // （サイト内通知は入っているので購入者は当日困らないが、「メールが来ない」と
  // 問い合わせが来る前にこちらから対応できるよう、運営に知らせておく）。
  // Squareの再送が来ても、上の重複チェックで打ち切られるため自動では再送されない。
  if (isPaid && !sent) {
    const adminTo = process.env.CONTACT_TO_EMAIL || process.env.NOTIFY_FROM_EMAIL;
    if (adminTo) {
      try {
        await sendEmail({
          to: adminTo,
          subject: '【要対応】購入確認メールを送信できませんでした',
          text: [
            `${purchase.ticket_name} の購入確認メールを ${to} に送信できませんでした（Resendのエラー）。`,
            `受付コード: ${codes.length ? codes.join(' / ') : '（未発行）'}`,
            'サイト内通知（マイページのお知らせ）には同じ内容が入っています。',
            '必要ならこのお客様に手動でメールしてください。',
          ].join('\n'),
        });
      } catch (e) { console.error('email-failure alert failed:', e); }
    }
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
  const adminCodes = Array.isArray(purchase.entry_codes) ? purchase.entry_codes : [];
  if (isPaid && adminCodes.length) lines.push(`受付コード: ${adminCodes.join(' / ')}`);
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
        "  select p.id, p.user_id, p.ticket_name, p.created_at from purchases p",
        "   where p.status='paid' and not exists (select 1 from entry_passes ep where ep.purchase_id = p.id);",
        '',
        'よくある原因: CURRENT_EVENT_ID の未設定、schema_v16_entry_passes.sql の未実行、issue_entry_passes 関数の権限不足。',
      ].join('\n'),
    });
  } catch (e) {
    console.error('entry code failure notify email failed:', e);
  }
}

// 返金が確定したときに運営へ知らせる。すでに入場済みだった場合は特に目立つようにする
// （入場した人に返金した、という状況は人手での確認が要るため）。
async function notifyRefund(purchase, passRows) {
  const adminTo = process.env.CONTACT_TO_EMAIL || process.env.NOTIFY_FROM_EMAIL;
  if (!adminTo) return;
  const safeName = String(purchase.ticket_name || '').replace(/[\r\n]+/g, ' ');
  const passes = Array.isArray(passRows) ? passRows : [];
  const usedPasses = passes.filter((p) => p.checked_in_at);
  const lines = [
    `${safeName} が返金されました。受付コードを無効にしました。`,
    passes.length ? `無効にしたコード: ${passes.map((p) => p.code).join(' / ')}` : (purchase.entry_code ? `無効にしたコード: ${purchase.entry_code}` : ''),
    usedPasses.length
      ? `※このうち ${usedPasses.length} 枚はすでに入場済みです（${usedPasses.map((p) => `${p.code}: ${new Date(p.checked_in_at).toLocaleString('ja-JP')}`).join(' / ')}）。ご確認ください。`
      : (purchase.checked_in_at ? `※このお客様は ${new Date(purchase.checked_in_at).toLocaleString('ja-JP')} に入場済みです。ご確認ください。` : ''),
  ].filter(Boolean);
  try {
    await sendEmail({ to: adminTo, subject: `【返金】${safeName}`, text: lines.join('\n') });
  } catch (e) {
    console.error('refund notify email failed:', e);
  }
}

// 一部返金（全額未満）のときは自動処理せず、運営に判断を求める。
async function notifyPartialRefund(purchase, refundAmount, passRows) {
  const adminTo = process.env.CONTACT_TO_EMAIL || process.env.NOTIFY_FROM_EMAIL;
  if (!adminTo) return;
  const safeName = String(purchase.ticket_name || '').replace(/[\r\n]+/g, ' ');
  const passes = Array.isArray(passRows) ? passRows : [];
  const codesLine = passes.length
    ? `この購入の受付コード: ${passes.map((p) => `${p.code}${p.status !== 'valid' ? '（無効化済み）' : p.checked_in_at ? '（入場済み）' : ''}`).join(' / ')}`
    : (purchase.entry_code ? `この購入の受付コード: ${purchase.entry_code}` : 'この購入に受付コードはありません。');
  try {
    await sendEmail({
      to: adminTo,
      subject: `【要対応】一部返金がありました（自動処理していません）`,
      text: [
        `${safeName}（合計 ${purchase.price}円）に対して ${refundAmount}円 の一部返金が確定しました。`,
        codesLine,
        'コードはすべて有効なままです。',
        '',
        '全額返金ではないため、受付コードの失効は自動では行っていません。',
        '1枚だけ無効にする場合は、Supabaseで該当コードの entry_passes.status を revoked に更新してください。',
        `購入ID: ${purchase.id}`,
      ].join('\n'),
    });
  } catch (e) {
    console.error('partial refund notify email failed:', e);
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

          // 現在の状態を見て、許される遷移だけ更新する（無条件に上書きしない）。
          //   ・canceled にできるのは initiated からだけ。
          //     1回目のカードが失敗→2回目で成功、の順で決済されたとき、Squareの通知は
          //     順不同で届き再送もされるため、遅れて来た FAILED が paid を上書きすると
          //     支払い済みのお客様のコードが消え、「キャンセルされました」メールまで届く。
          //   ・paid にできるのは initiated / canceled からだけ。
          //     refunded を paid に戻してしまうと、返金済みの人に新しいコードが発行される。
          const allowedFrom = newStatus === 'paid' ? ['initiated', 'canceled'] : ['initiated'];
          const { data: updatedRows, error } = await serviceClient
            .from('purchases')
            .update({ status: newStatus })
            .eq('square_order_id', orderId)
            .in('status', allowedFrom)
            .select('id, user_id, ticket_name, entry_code, items');
          if (error) console.error('purchases update failed:', error.message);
          else {
            let purchase = updatedRows && updatedRows[0];
            if (!purchase && newStatus === 'paid') {
              // 更新対象が0行 ＝ すでに paid（Squareの再送）か、refunded。
              // すでに paid の場合は、前回の処理がコード発行やメール送信の途中で
              // 落ちていた可能性があるので、続きだけやり直す（重複は各処理側で防いでいる）。
              const { data: existing } = await serviceClient
                .from('purchases')
                .select('id, user_id, ticket_name, entry_code, items, status')
                .eq('square_order_id', orderId)
                .maybeSingle();
              if (existing && existing.status === 'paid') purchase = existing;
            }
            if (purchase) {
              if (newStatus === 'paid') {
                // 受付コードを人数分発行する（1人1コード）。発行済みなら既存のコードが返るだけ
                // なので、Squareの再送で毎回コードが変わることはない。
                purchase.entry_codes = await issueEntryPasses(serviceClient, purchase);
                // 発行に失敗しても決済自体は成立しているので処理は続ける（購入者には通知が届く）。
                // ただしコード無しのまま放置すると当日その人が入場できないので、運営に知らせる。
                if (!purchase.entry_codes.length) await notifyEntryCodeFailure(purchase);
              }
              await notifyPurchaser(serviceClient, purchase, newStatus);
            }
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
          .select('id, user_id, ticket_name, entry_code, status, checked_in_at, price')
          .eq('square_order_id', orderId)
          .maybeSingle();

        // 一部返金（全額未満）かどうか。日本円は補助通貨が無いので amount がそのまま円。
        const refundAmount = refund.amount_money && Number(refund.amount_money.amount);

        if (error) console.error('refund lookup failed:', error.message);
        else if (!purchase) console.warn('返金通知に対応する購入記録が見つかりません order_id=', orderId);
        else if (purchase.status === 'refunded') {
          console.warn('返金済みとして処理済みです。スキップします purchase_id=', purchase.id);
        } else if (Number.isFinite(refundAmount) && refundAmount > 0 && refundAmount < Number(purchase.price)) {
          // 一部返金では自動で失効させない。
          // 例：「出店料＋入場×2」の注文で入場1枚分だけ返金したとき、全員のコードを
          // 消してしまうと、返金していない人まで入場できなくなる。何をどう減らすかは
          // 注文の中身によるので、機械的に決めず運営に判断を委ねる。
          const { data: partialPassRows } = await serviceClient
            .from('entry_passes')
            .select('code, status, checked_in_at')
            .eq('purchase_id', purchase.id);
          await notifyPartialRefund(purchase, refundAmount, partialPassRows || []);
        } else {
          // 順序が重要：先に受付コード（entry_passes）を無効化し、成功してから
          // purchases を refunded にする。逆にすると、無効化が一時エラーで失敗したとき
          // Squareの再送が「返金処理済み」としてスキップされ、返金した相手のコードが
          // 永久に有効なまま残る（当日入場できてしまう）。この順序なら、途中で失敗しても
          // status がまだ refunded ではないので、再送でやり直される。
          const { data: passRows } = await serviceClient
            .from('entry_passes')
            .select('code, checked_in_at')
            .eq('purchase_id', purchase.id);
          const { error: revokeErr } = await serviceClient
            .from('entry_passes')
            .update({ status: 'revoked' })
            .eq('purchase_id', purchase.id);
          if (revokeErr) { console.error('entry_passes revoke failed（Squareの再送でやり直されます）:', revokeErr.message); res.status(500).json({ error: 'internal error' }); return; }

          const { error: updateErr } = await serviceClient
            .from('purchases')
            .update({ status: 'refunded', entry_code: null })
            .eq('id', purchase.id);
          if (updateErr) { console.error('refund update failed（Squareの再送でやり直されます）:', updateErr.message); res.status(500).json({ error: 'internal error' }); return; }
          {
            // 購入時の「ご購入ありがとうございます」通知にはコードとQRが残っている。
            // そのままだと、返金後もマイページの通知欄に有効そうなQRが表示され続けて
            // 混乱のもとになる（コード自体はDB側で無効化済みなので入場はできない）。
            //
            // QR（body_html）を消すだけでは本文のコード文字列が残るため、本文にも
            // 無効である旨を追記する。これが無いと、通知を読んだ本人は有効なコードを
            // 持っているつもりで当日来場し、受付で初めて断られることになる。
            const REFUND_NOTE = '\n\n※この購入は返金済みです。上記の受付コードは無効となり、当日はご入場いただけません。';
            const { data: oldNotifs, error: oldNotifsErr } = await serviceClient
              .from('notifications')
              .select('id, body')
              .eq('purchase_id', purchase.id);
            if (oldNotifsErr) console.error('notification scrub lookup failed:', oldNotifsErr.message);
            for (const n of (oldNotifs || [])) {
              const oldBody = String(n.body || '');
              // Squareの再送で同じ処理が2回走っても、注意書きが二重に付かないようにする
              if (oldBody.includes('※この購入は返金済みです')) continue;
              const { error: scrubErr } = await serviceClient
                .from('notifications')
                .update({ body_html: null, body: oldBody + REFUND_NOTE })
                .eq('id', n.id);
              if (scrubErr) console.error('notification scrub failed:', scrubErr.message);
            }

            // 購入者本人にも知らせる（黙ってコードだけ消すと、当日無効なコードを
            // 持って来場してしまう。運営宛てだけでなく本人にも必ず伝える）。
            const { error: notifErr } = await serviceClient.from('notifications').insert({
              user_id: purchase.user_id,
              purchase_id: purchase.id,
              title: 'ご返金が完了しました',
              body: `${purchase.ticket_name} のご返金が完了しました。この購入の受付コードは無効になっています。当日はご入場いただけませんのでご注意ください。`,
            });
            if (notifErr) console.error('refund notification insert failed:', notifErr.message);

            const { data: userRes } = await serviceClient.auth.admin.getUserById(purchase.user_id);
            const buyerTo = userRes && userRes.user && userRes.user.email;
            if (buyerTo) {
              await sendEmail({
                to: buyerTo,
                subject: 'ご返金が完了しました',
                text: `${purchase.ticket_name} のご返金が完了しました。\nこの購入の受付コード${purchase.entry_code ? `（${purchase.entry_code}）` : ''}は無効になっています。当日はご入場いただけませんのでご注意ください。\n\nご不明な点がありましたら、お問い合わせフォームよりご連絡ください。`,
                ctaLabel: 'マイページで確認する',
                ctaUrl: SITE_URL + '/members-only.html',
              });
            }

            await notifyRefund(purchase, passRows || []);
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
