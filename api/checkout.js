/* =========================================================
   POST /api/checkout
   ---------------------------------------------------------
   カートの中身（商品ID＋数量の配列）を受け取り、
   Squareの決済ページ（Payment Link）をまとめて1つ作って、そのURLを返す。
   フロント側（js/cart.js）はこのURLに window.location で飛ばすだけでよい。

   やっていること：
   1. ログイン中のユーザーを確認（Supabaseのアクセストークンを検証）
   2. Idempotency Key を必ず付けて、二重注文を防止
   3. Squareの Create Payment Link API を1回だけ呼ぶ
   4. 購入記録（status: 'initiated'）をSupabaseに保存
      → 決済完了は Webhook（api/square-webhook.js）が後から 'paid' に更新する
   ========================================================= */
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { getCatalogItem } = require('../lib/catalog');
const { SITE_URL } = require('../lib/mailer');

// 1回の注文で受け付ける上限。無制限だと巨大な配列を投げつけられる。
const MAX_LINE_ITEMS = 20;
const MAX_QUANTITY_PER_ITEM = 20;

// SandboxとProductionでAPIホストが異なる（トークンの種類では自動判別されない）。
// SQUARE_ENVIRONMENT=production のときだけ本番ホストを使い、それ以外（未設定含む）はSandboxホストを使う。
const SQUARE_API_BASE = process.env.SQUARE_ENVIRONMENT === 'production'
  ? 'https://connect.squareup.com'
  : 'https://connect.squareupsandbox.com';
const SQUARE_VERSION = '2026-07-15';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POSTのみ対応しています' });
    return;
  }

  try {
    const { items, access_token } = req.body || {};

    // ---------- 入力チェック ----------
    // ブラウザから受け取るのは「どの商品を何個か」だけ。商品名と価格は信用せず、
    // lib/catalog.js（サーバー側の正本）から引き直す。
    // ここを緩めると、安い商品を買いながら高い商品の名前で記録させて、
    // 出店者用の受付コードを取る、といった抜け道ができる。
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'カートが空です' });
      return;
    }
    if (items.length > MAX_LINE_ITEMS) {
      res.status(400).json({ error: '一度にお申し込みできる商品の種類が多すぎます' });
      return;
    }

    const resolvedItems = [];
    for (const it of items) {
      const catalogObjectId = it && it.catalogObjectId;
      const quantity = it && it.quantity;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_ITEM) {
        res.status(400).json({ error: '数量が正しくありません' });
        return;
      }
      const entry = getCatalogItem(catalogObjectId);
      if (!entry) {
        console.warn('checkout: 未知のcatalogObjectIdを拒否しました:', catalogObjectId);
        res.status(400).json({ error: 'お取り扱いのない商品が含まれています' });
        return;
      }
      resolvedItems.push({
        catalogObjectId,
        quantity,
        name: entry.name,
        price: entry.price,
      });
    }
    if (!access_token) {
      res.status(401).json({ error: 'ログインが必要です' });
      return;
    }

    // ---------- ログイン中のユーザーを確認（anon keyでOK。サーバー側から誰の操作か検証するだけ） ----------
    const authClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: userData, error: userErr } = await authClient.auth.getUser(access_token);
    if (userErr || !userData || !userData.user) {
      res.status(401).json({ error: 'ログイン情報を確認できませんでした。再度ログインしてください' });
      return;
    }
    const userId = userData.user.id;

    // ---------- Squareへ Payment Link 作成をリクエスト ----------
    const idempotencyKey = crypto.randomUUID(); // 二重決済防止：この注文1回だけを表すキー
    const squareRes = await fetch(`${SQUARE_API_BASE}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        'Square-Version': SQUARE_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        order: {
          location_id: process.env.SQUARE_LOCATION_ID,
          line_items: resolvedItems.map(it => ({
            catalog_object_id: it.catalogObjectId,
            quantity: String(it.quantity), // Square APIは数量を文字列で受け取る
          })),
        },
        checkout_options: {
          // 決済完了後に戻ってくる先。?thanks=1 は「Squareから戻ってきた直後」の合図
          // （members-only.htmlがこれを見て「ありがとうございました」表示を出す。詳細は同ファイル参照）。
          //
          // 以前は req.headers.origin をそのまま使っていたが、Originヘッダは送信側が
          // 自由に付けられるため、攻撃者が別サイトを指定すると「Squareの本物の決済ページから
          // 攻撃者のサイトへ遷移する」導線を作れてしまう（フィッシングに悪用できる）。
          // 戻り先は必ずこちらで決め打ちにする。
          redirect_url: `${SITE_URL}/members-only.html?thanks=1`,
        },
      }),
    });

    const squareJson = await squareRes.json();
    if (!squareRes.ok) {
      console.error('Square API error:', squareJson);
      res.status(502).json({ error: 'Square側でエラーが発生しました', detail: squareJson.errors || squareJson });
      return;
    }

    const paymentLink = squareJson.payment_link;
    const checkoutUrl = paymentLink && paymentLink.url;
    const squareOrderId = paymentLink && paymentLink.order_id;
    if (!checkoutUrl) {
      res.status(502).json({ error: 'Squareから決済ページURLを取得できませんでした' });
      return;
    }

    // ---------- 購入記録を保存（status: 'initiated'。決済完了はWebhookが 'paid' に更新） ----------
    // 名前と価格は resolvedItems（＝lib/catalog.js から引いた正しい値）を使う。
    const total = resolvedItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
    const summaryName = resolvedItems.map(it => `${it.name}×${it.quantity}`).join(', ');
    const serviceClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { error: insertErr } = await serviceClient.from('purchases').insert({
      user_id: userId,
      ticket_name: summaryName,
      price: total,
      status: 'initiated',
      square_url: checkoutUrl,
      square_order_id: squareOrderId,
      square_checkout_id: paymentLink.id,
      items: resolvedItems,
      // 何人分入場できるか。まとめ買いされたとき、受付でその人数まで通せるようにする
      // （supabase/schema_v13_checkin_count.sql 参照）。
      quantity: resolvedItems.reduce((sum, it) => sum + it.quantity, 0),
    });
    if (insertErr) {
      // 記録できないまま決済させると、Webhookが購入者を特定できず受付コードを発行できない
      // （square_order_idで購入記録を突き止める設計のため）。決済ページを返さずここで止める。
      console.error('purchases insert failed:', insertErr.message);
      res.status(500).json({ error: 'お申し込みの記録に失敗しました。お手数ですが少し時間をおいて再度お試しください' });
      return;
    }

    res.status(200).json({ url: checkoutUrl });
  } catch (err) {
    console.error('checkout handler error:', err);
    res.status(500).json({ error: 'サーバー内部でエラーが発生しました' });
  }
};
