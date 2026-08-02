/* =========================================================
   GET /api/env-check
   ---------------------------------------------------------
   デプロイ済みの関数から、必要な環境変数が「設定されているか」だけを
   確認するための診断用エンドポイント。値そのものは一切返さない。

   環境変数を追加したのに動かない、というときに、
   スペルミスやデプロイのタイミングの問題を素早く切り分けるために使う。
   ========================================================= */
const { verifyAdminToken } = require('../lib/adminAuth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'このメソッドは対応していません' });
    return;
  }

  // 以前は誰でも開けたが、どの外部サービスと繋がっているか・どのコミットが動いているかが
  // 分かってしまい、攻撃の下調べに使えるため管理者トークンを必須にした。
  // 使い方: /api/env-check?token=（/console にログインしたときに発行されるトークン）
  if (!verifyAdminToken(req.query.token)) {
    res.status(404).end();
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
    'CONTACT_TO_EMAIL',
    'ADMIN_CONSOLE_PASSWORD',
    // 下の2つは未設定でもエラーにならず既定値で動いてしまう（＝気づきにくい）ので、特にここで見えるようにしておく。
    // CURRENT_EVENT_ID: 未設定だと受付コードが DCT-EVENT-... という仮の値で発行されてしまう
    // SITE_URL: 未設定だとメール内のボタンのリンク先が既定のドメインになる
    'CURRENT_EVENT_ID',
    'SITE_URL',
  ];

  const status = {};
  keys.forEach((k) => { status[k] = !!process.env[k]; });
  // このデプロイが「本当に今回のpush・環境変数の変更を反映したものか」を見分けるための目印
  // （Vercelが自動で用意するSystem Environment Variables。プロジェクト設定で
  //  "Enable access to System Environment Variables" がオンである必要がある）
  status.__respondedAt = new Date().toISOString();
  status.__vercelUrl = process.env.VERCEL_URL || null;               // このデプロイ固有のURL
  status.__vercelEnv = process.env.VERCEL_ENV || null;                // production / preview / development
  status.__gitCommitSha = process.env.VERCEL_GIT_COMMIT_SHA || null;  // どのコミットからビルドされたか

  res.status(200).json(status);
};
