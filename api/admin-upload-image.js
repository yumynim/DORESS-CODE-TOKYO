/* =========================================================
   POST /api/admin-upload-image
   ---------------------------------------------------------
   admin-announcements.html（/console）の配信エディタ「画像」ブロック用。
   選択した画像ファイルをSupabase Storageにアップロードし、
   公開URLを返す（そのURLを画像ブロックの<img src>にそのまま使う）。

   事前準備が必要:
   Supabase Dashboard → Storage → New bucket
     - 名前: announcement-images
     - Public bucket: ON
   （書き込みはservice roleで行うのでRLSポリシーの追加は不要。
    Publicにしておくことで、アップロードした画像がメールやブラウザから
    誰でも見られる状態になる＝会員向けお知らせに載せる画像なので問題ない想定）

   認証はほかの管理APIと同じ、共通パスワードのトークン（lib/adminAuth.js）。
   ========================================================= */
const { createClient } = require('@supabase/supabase-js');
const { verifyAdminToken } = require('../lib/adminAuth');

const BUCKET = 'announcement-images';
const MAX_BYTES = 3 * 1024 * 1024; // 3MB（base64化すると約4MBになり、Vercel Functionsのリクエストサイズ上限内に収まる）
const EXT_BY_TYPE = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'このメソッドは対応していません' });
    return;
  }

  const { token, contentType, dataBase64 } = req.body || {};
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: '認証が切れました。もう一度パスワードを入力してください' });
    return;
  }

  const ext = EXT_BY_TYPE[contentType];
  if (!ext) {
    res.status(400).json({ error: '対応していない画像形式です（JPEG/PNG/WebP/GIFのみ）' });
    return;
  }
  if (!dataBase64 || typeof dataBase64 !== 'string') {
    res.status(400).json({ error: '画像データがありません' });
    return;
  }

  let buffer;
  try {
    buffer = Buffer.from(dataBase64, 'base64');
  } catch (e) {
    res.status(400).json({ error: '画像データを読み取れませんでした' });
    return;
  }
  if (buffer.length > MAX_BYTES) {
    res.status(400).json({ error: 'ファイルが大きすぎます（3MBまで）' });
    return;
  }

  const path = `console/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const serviceClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { error } = await serviceClient.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: false });
    if (error) {
      console.error('storage upload failed:', error.message);
      res.status(500).json({ error: 'アップロードに失敗しました（Supabaseに"announcement-images"という公開バケットがあるか確認してください）' });
      return;
    }
    const { data } = serviceClient.storage.from(BUCKET).getPublicUrl(path);
    res.status(200).json({ url: data.publicUrl });
  } catch (err) {
    console.error('admin-upload-image handler error:', err);
    res.status(500).json({ error: 'サーバー内部でエラーが発生しました' });
  }
};

// 画像はJSONボディ（base64）で受け取るため、既定のボディサイズ上限を少し広げる
module.exports.config = { api: { bodyParser: { sizeLimit: '5mb' } } };
