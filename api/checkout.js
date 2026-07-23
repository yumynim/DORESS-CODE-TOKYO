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

const SQUARE_API_BASE = 'https://connect.squareup.com'; // sandbox/productionともに同一ホスト。トークンの環境で自動的に振り分けられる
const SQUARE_VERSION = '2026-07-15';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POSTのみ対応しています' });
    return;
  }

  try {
    const { items, access_token } = req.body || {};

    // ---------- 入力チェック ----------
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'カートが空です' });
      return;
    }
    for (const it of items) {
      if (!it.catalogObjectId || !Number.isInteger(it.quantity) || it.quantity < 1) {
        res.status(400).json({ error: '商品データが不正です（catalogObjectId / quantity を確認してください）' });
        return;
      }
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
          line_items: items.map(it => ({
            catalog_object_id: it.catalogObjectId,
            quantity: String(it.quantity), // Square APIは数量を文字列で受け取る
          })),
        },
        checkout_options: {
          redirect_url: `${req.headers.origin || ''}/members-only.html`, // 決済完了後に戻ってくる先
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
    const total = items.reduce((sum, it) => sum + (it.price || 0) * it.quantity, 0);
    const summaryName = items.map(it => `${it.name}×${it.quantity}`).join(', ');
    const serviceClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { error: insertErr } = await serviceClient.from('purchases').insert({
      user_id: userId,
      ticket_name: summaryName,
      price: total,
      status: 'initiated',
      square_url: checkoutUrl,
      square_order_id: squareOrderId,
      square_checkout_id: paymentLink.id,
      items: items,
    });
    if (insertErr) {
      // 記録に失敗しても決済自体は進められるので、ログだけ残して処理は続行する
      console.error('purchases insert failed:', insertErr.message);
    }

    res.status(200).json({ url: checkoutUrl });
  } catch (err) {
    console.error('checkout handler error:', err);
    res.status(500).json({ error: 'サーバー内部でエラーが発生しました' });
  }
};
