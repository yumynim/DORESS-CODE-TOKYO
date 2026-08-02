/* =========================================================
   POST /api/admin-login
   ---------------------------------------------------------
   お知らせ投稿ページ（/console）の合言葉を検証し、トークンを発行する。
   ADMIN_CONSOLE_PASSWORD をVercelの環境変数に設定してから使うこと。
   ========================================================= */
const crypto = require('crypto');
const { issueAdminToken } = require('../lib/adminAuth');
const { isRateLimited } = require('../lib/rateLimit');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    // 「合言葉が設定済みかどうか」を外部に教える必要は無い（攻撃者に、ここが生きた入口だと
    // 教えるだけになる）。ページ側もこの応答を使っていないので、常に404を返す。
    res.status(404).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'このメソッドは対応していません' });
    return;
  }

  // 合言葉の総当たり対策。ここが破られると顧客情報の閲覧・全会員へのメール送信まで通ってしまう。
  if (isRateLimited('admin-login', req, { windowMs: 5 * 60 * 1000, max: 10 })) {
    res.status(429).json({ error: '試行回数が多すぎます。しばらく時間をおいてからお試しください' });
    return;
  }

  const expected = process.env.ADMIN_CONSOLE_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: 'サーバー側でパスワードが設定されていません（ADMIN_CONSOLE_PASSWORD）' });
    return;
  }

  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'パスワードを入力してください' });
    return;
  }

  // 長さが違うと timingSafeEqual が例外を投げるため、先に長さを確認してから比較する
  const matches = (candidate) => {
    if (!candidate) return false;
    const a = Buffer.from(password);
    const b = Buffer.from(candidate);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };

  // 当日スタッフ用の合言葉（CHECKIN_PASSWORD）は /checkin だけに通す。
  // 未設定なら今まで通り運営用の合言葉だけで両方使える。
  if (matches(expected)) {
    res.status(200).json({ token: issueAdminToken('admin'), scope: 'admin' });
    return;
  }
  if (matches(process.env.CHECKIN_PASSWORD)) {
    res.status(200).json({ token: issueAdminToken('checkin'), scope: 'checkin' });
    return;
  }

  res.status(401).json({ error: 'パスワードが違います' });
};
