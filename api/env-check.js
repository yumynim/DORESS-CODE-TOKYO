/* =========================================================
   GET /api/env-check
   ---------------------------------------------------------
   デプロイ済みの関数から、必要な環境変数が「設定されているか」だけを
   確認するための診断用エンドポイント。値そのものは一切返さない。

   環境変数を追加したのに動かない、というときに、
   スペルミスやデプロイのタイミングの問題を素早く切り分けるために使う。
   ========================================================= */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'このメソッドは対応していません' });
    return;
  }

  const keys = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SQUARE_ENVIRONMENT',
    'SQUARE_ACCESS_TOKEN',
    'SQUARE_LOCATION_ID',
    'SQUARE_WEBHOOK_SIGNATURE_KEY',
    'SQUARE_WEBHOOK_URL',
    'RESEND_API_KEY',
    'NOTIFY_FROM_EMAIL',
    'ADMIN_CONSOLE_PASSWORD',
    'DEBUG_PING', // 切り分け用の使い捨て変数。原因が分かったら削除してよい
  ];

  const status = {};
  keys.forEach((k) => { status[k] = !!process.env[k]; });

  res.status(200).json(status);
};
