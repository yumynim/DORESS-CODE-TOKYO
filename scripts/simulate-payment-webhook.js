#!/usr/bin/env node
/* =========================================================
   scripts/simulate-payment-webhook.js
   ---------------------------------------------------------
   Squareで実際にお金を動かさずに、決済完了後の一連の流れ
   （purchases.status更新 → 受付コード発行 → サイト内通知 → メール送信）
   をテストするためのスクリプト。

   仕組み: /api/square-webhook の署名検証は、こちらとSquareだけが知っている
   SQUARE_WEBHOOK_SIGNATURE_KEY で計算している。その鍵を自分で使って正しい
   署名を作れば、本物のSquare通知と同じように検証を通過する（＝検証ロジック
   を一切弱めていない。正しい鍵で正しい署名を計算しているだけ）。

   やること:
   1. 指定したメールアドレスのユーザーを探す（先にサイトから会員登録が必要）
   2. テスト用の purchases 行を1件作る（status: 'initiated', square_order_idはダミー）
   3. Squareの payment.updated（COMPLETED）通知と同じ形のJSONを作り、
      本物の署名鍵で署名して、本番の /api/square-webhook に送る

   使い方（プロジェクトルートで実行）:
     SUPABASE_URL=... \
     SUPABASE_SERVICE_ROLE_KEY=... \
     SQUARE_WEBHOOK_SIGNATURE_KEY=... \
     SQUARE_WEBHOOK_URL=https://dress-code-tokyo.com/api/square-webhook \
     node scripts/simulate-payment-webhook.js --email yui25250025@gmail.com --ticket "出店料（1ブース・2026.9.27）" --price 3000

   値はすべてVercelの環境変数ページ（Settings → Environment Variables）から
   コピーしてきてください。ターミナルの履歴やスクリプト内に書き残さないこと。
   ========================================================= */
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1];
  }
  return args;
}

async function findUserIdByEmail(serviceClient, email) {
  const target = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error('listUsers failed: ' + error.message);
    const users = (data && data.users) || [];
    const found = users.find((u) => (u.email || '').toLowerCase() === target);
    if (found) return found.id;
    if (users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const args = parseArgs();
  const email = args.email;
  const ticketName = args.ticket || '出店料（1ブース・2026.9.27）';
  const price = Number(args.price || 3000);
  const status = (args.status || 'completed').toUpperCase(); // COMPLETED | FAILED | CANCELED

  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SQUARE_WEBHOOK_SIGNATURE_KEY', 'SQUARE_WEBHOOK_URL'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error('環境変数が不足しています: ' + missing.join(', '));
    process.exit(1);
  }
  if (!email) {
    console.error('--email を指定してください（例: --email yui25250025@gmail.com）');
    process.exit(1);
  }

  const serviceClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  console.log(`1) ${email} のユーザーを検索中…`);
  const userId = await findUserIdByEmail(serviceClient, email);
  if (!userId) {
    console.error(`${email} のアカウントが見つかりません。先にサイトから会員登録（メール確認まで）を済ませてください。`);
    process.exit(1);
  }
  console.log('   user_id =', userId);

  const fakeOrderId = 'TEST-' + crypto.randomUUID();
  console.log('2) テスト用の purchases 行を作成中…（square_order_id =', fakeOrderId, '）');
  const { data: purchase, error: insertErr } = await serviceClient
    .from('purchases')
    .insert({
      user_id: userId,
      ticket_name: ticketName,
      price,
      status: 'initiated',
      square_order_id: fakeOrderId,
    })
    .select('id')
    .single();
  if (insertErr) { console.error('purchases insert failed:', insertErr.message); process.exit(1); }
  console.log('   purchases.id =', purchase.id);

  const event = {
    type: 'payment.updated',
    data: {
      object: {
        payment: {
          order_id: fakeOrderId,
          status, // 'COMPLETED' | 'FAILED' | 'CANCELED'
        },
      },
    },
  };
  const rawBody = JSON.stringify(event);

  // 403になった場合の切り分け用。鍵の中身は出さず、長さと前後の空白有無だけ見せる
  // （コピペ時に混入しやすい末尾の改行・空白がないか確認するため）。
  const rawKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const rawUrl = process.env.SQUARE_WEBHOOK_URL;
  console.log('   [debug] SQUARE_WEBHOOK_URL        = "' + rawUrl + '"');
  console.log('   [debug] SQUARE_WEBHOOK_SIGNATURE_KEY length = ' + rawKey.length + ' (trimmed length = ' + rawKey.trim().length + ')');
  if (rawKey !== rawKey.trim()) console.warn('   [debug] 警告: SIGNATURE_KEY の前後に空白/改行が混入しています');
  if (rawUrl !== rawUrl.trim()) console.warn('   [debug] 警告: WEBHOOK_URL の前後に空白/改行が混入しています');

  const hmac = crypto.createHmac('sha256', rawKey);
  hmac.update(rawUrl + rawBody);
  const signature = hmac.digest('base64');

  console.log('3) /api/square-webhook へ送信中…');
  const res = await fetch(process.env.SQUARE_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-square-hmacsha256-signature': signature,
    },
    body: rawBody,
  });
  const text = await res.text();
  console.log('   response status:', res.status);
  console.log('   response body:', text);

  if (res.ok) {
    console.log('\n完了。マイページ・通知・メールを確認してください。');
    console.log('テストが終わったら、Supabaseの purchases テーブルからこの行（id=' + purchase.id + '）を削除してください。');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
