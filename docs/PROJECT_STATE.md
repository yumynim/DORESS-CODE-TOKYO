# プロジェクト概要

DRESS CODE TOKYO のウェブサイト。もともと claudedesign 制作の 22MB 1枚 HTML（`DRESS CODE TOKYO.html`、バックアップとして保持）を、編集しやすい構成（HTML/CSS/JS 分離）に組み直したもの。見た目は元のまま。
その後、会員登録・ログイン（Supabase Auth）、チケット購入（Square 決済）を追加する方向で開発が進んでいる。

- リポジトリ: `https://github.com/yumynim/DORESS-CODE-TOKYO`（origin, git remote -v で確認）
- 人間向けの編集ガイドは [`README.md`](../README.md) を参照。

# 現在の構成

```
DORESS CODE TOKYO/
├── index.html                トップページ本体
├── article.html               記事詳細ページ
├── member.html                 会員向けページ（未確認: 用途詳細）
├── members-only.html           会員限定ページ（未確認: 用途詳細）
├── community-creator.html      コミュニティ（クリエイター向け）ページ
├── community-exhibitor.html    コミュニティ（出展者向け）ページ
├── css/style.css               全体スタイル（:root にトークン集約）
├── js/
│   ├── data.js                 サイトのコンテンツデータ（記事・ギャラリー等）
│   ├── render.js                data.js を HTML に展開する描画ロジック
│   ├── auth.js                  Supabase Auth（会員登録/ログイン/ログアウト、Googleサインイン、ログイン再開）
│   ├── auth-config.js            Supabase の url / anonKey を入れる設定ファイル（現状は空欄のプレースホルダー）
│   └── cart.js                   カート機能（localStorage）→ /api/checkout 呼び出し
├── api/
│   ├── checkout.js               POST /api/checkout（Vercel Function）: カート内容を受け取り Square Payment Link を発行
│   └── square-webhook.js         POST /api/square-webhook（Vercel Function）: Square の決済完了通知を検証して purchases.status を更新
├── supabase/
│   ├── schema.sql                 profiles / purchases テーブルの初期スキーマ
│   ├── schema_v2_cart.sql         purchases にカート対応カラム（square_order_id 等）を追加
│   └── schema_v3_notifications.sql  notifications テーブル（サイト内お知らせ、Webhookのみinsert可）
├── assets/images/                 画像
├── vercel.json                    セキュリティヘッダー設定
├── .env.example                   環境変数テンプレート（実値は Vercel の環境変数に設定する想定）
├── DRESS CODE TOKYO.html          元の22MBバンドル（バックアップ、gitignore対象・デプロイ不要）
└── 添付資料/                       元画像の受け取りフォルダ（gitignore対象）
```

# 使用技術・外部サービス

- フロントエンド: 素の HTML/CSS/JS。ビルドステップなし。フォントは Google Fonts を `<link>` で読み込み（Cormorant Garamond / Jost / Zen Kaku Gothic New / Zen Old Mincho）。
- 認証: Supabase Auth（メール/パスワード + Google OAuth）。プロジェクト作成済み（`dresscode-tokyo`, Tokyo region, Free）。`js/auth-config.js` に Project URL / Publishable Key を設定済み（2026-07-24、ローカルサーバーでログインモーダルが「準備中」ではなく実フォームで表示されることを確認済み）。Vercel環境変数（`SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`）も設定・Redeploy済み。Secret Keyはローテーション済み・Vercel側も更新済み。Google OAuthプロバイダ（Client ID/Secret）は未設定。
- 決済: Square API（Create Payment Link）。`SQUARE_ENVIRONMENT`（sandbox/production）等は `.env.example` にテンプレートあり、実値は未確認。
- DB: Supabase Postgres。RLS 有効。`purchases.status` の更新は service role のみ許可（クライアントから直接書き換え不可）。
- ホスティング/デプロイ: Vercel（`vercel.json`）。`api/` 配下が Vercel Functions として動く前提。
- 依存パッケージ: `@supabase/supabase-js` のみ（`package.json`）。

# 完了済みの作業

git log（直近）で確認できた範囲:

- サイトの HTML/CSS/JS 分離、SEO対策一式（robots.txt / sitemap.xml / canonical / 構造化データ）
- Magazine（記事）システム、Field Report フォトカルーセル（TikTok風ドットインジケーター、トラックパッド/モバイルスワイプ対応）
- 会員ログイン/サインアップ UI とチケット詳細ドロワー（Supabase 接続準備、当時は未接続）
- Square チケットカルーセルセクション
- カート機能（複数商品まとめて1回払い）＋ `/api/checkout` ＋ Webhook（`api/square-webhook.js`）を追加（コミット `3a0ef21`）
- Google サインイン追加＋ OAuth のフルページリダイレクトを跨いでログイン再開できるように（コミット `7956562`、sessionStorageで`dct_pending_ticket`を保持）
- モバイルのスクロールジャンク修正、ドットインジケーターのタップ領域拡大
- **（未コミット・2026-07-24）購入通知（メール＋サイト内通知）を実装**:
  - [`supabase/schema_v3_notifications.sql`](../supabase/schema_v3_notifications.sql) を新規追加（`notifications` テーブル、RLSでinsertはservice roleのみ）
  - [`api/square-webhook.js`](../api/square-webhook.js) が決済 `paid`/`canceled` 確定時に `notifications` へ1件insert、かつ Resend API 経由でメール送信（`RESEND_API_KEY`/`NOTIFY_FROM_EMAIL` 未設定ならメールだけ静かにスキップ、サイト内通知は届く）
  - [`members-only.html`](../members-only.html) のマイページに「お知らせ」セクションを追加。開くと未読を既読化
  - [`js/auth.js`](../js/auth.js) がヘッダーの「ログイン/マイページ」ボタンに未読バッジ（赤丸）を表示する仕組みを追加（`refreshNotifBadge`）
  - ついでに `members-only.html` の購入履歴表示にあった未エスケープ出力（`ticket_name` 等をinnerHTMLに直挿し）をエスケープするよう修正（保存型XSSの芽を摘んだ）
  - `.env.example` に `RESEND_API_KEY` / `NOTIFY_FROM_EMAIL` を追記
  - **カート機能自体（`js/cart.js` / `api/checkout.js`）はロジックは元々完成していたためコード変更なし。** 動かない原因は外部サービス未接続（下記参照）
- **（2026-07-24）Supabaseプロジェクト作成〜Vercel反映まで完了**（ユーザー作業）:
  - Organization作成、Project名 `dresscode-tokyo`、Region: Northeast Asia (Tokyo)、Freeプラン
  - `schema.sql` → `schema_v2_cart.sql` → `schema_v3_notifications.sql` をSQL Editorで順に実行、全て成功
  - Project URL / Publishable Key(anon) / Secret Key(service_role) を取得
  - Vercel Environment Variablesに `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` を設定してRedeploy済み
  - **注意**: Secret Keyを一度チャットに貼ってしまったとのことで、本番公開前にローテーション予定（ローテーション後はVercel側の`SUPABASE_SERVICE_ROLE_KEY`も再設定が必要）
  - Google OAuthはGoogle Cloud Console側のClient ID/Secret未発行のため保留
- **（2026-07-24）Secret Keyローテーション完了・`js/auth-config.js` 設定完了**:
  - ユーザーがSecret Keyをローテーションし、Vercelの`SUPABASE_SERVICE_ROLE_KEY`も新しい値に更新済み
  - Project URL（`https://qyqeyinkvofosmcwskwx.supabase.co`）とPublishable Keyを共有してもらい、[`js/auth-config.js`](../js/auth-config.js) に設定
  - ローカルサーバー（`python3 -m http.server`）でログインモーダルを開き、「準備中」ではなく実際のログイン/新規登録フォーム（Googleサインインボタン含む）が表示されることを確認済み

# 現在作業中の内容

Supabase側の接続（DB・フロント・Vercel環境変数）は一通り完了・動作確認済み。次はGoogle OAuthの認証情報発行と、Square Developer Dashboardへのアクセス権限待ち。

# 未完了の作業（＝ユーザーが各サイトで行う作業）

- **Google OAuth**: Google Cloud ConsoleでOAuth同意画面→OAuthクライアントID作成→Client ID/SecretをSupabaseのGoogleプロバイダ設定に登録。リダイレクトURIはSupabaseのGoogleプロバイダ設定画面に表示されるCallback URLを使う。
- **Square**: Developer Dashboardへのアクセス権限待ち（現状はSquareアプリのみ利用可）。権限取得後、アプリ作成→Sandbox Access Token/Location ID取得→商品登録してCatalog Object ID取得→`js/data.js`の`catalogObjectId`に設定→Webhook登録→Vercel環境変数設定。
- **Resend（メール通知）**: 未着手。Square Sandbox完了後に着手予定。アカウント作成→送信ドメイン認証→APIキー発行→Vercel環境変数（`RESEND_API_KEY`/`NOTIFY_FROM_EMAIL`）設定。
- 全て完了後、Sandboxでの一連の動作確認（ログイン/カート/決済/通知/メール）を経てSquareをProductionへ切替。

# 重要な仕様・決定事項

- **Webhook 署名検証必須**: `api/square-webhook.js` は `crypto.timingSafeEqual` で署名検証してから処理する。理由: 検証を省くと決済していないのに「決済完了」を偽装されうるため。
- **purchases.status の更新権限は service role のみ**: `supabase/schema_v2_cart.sql` の RLS ポリシーで、クライアント（anon key）からの直接更新を禁止。理由: 支払っていないのに `paid` に書き換える不正を防ぐため。
- **Idempotency Key 必須**: `api/checkout.js` は Square の Payment Link 作成時に Idempotency Key を付与し、二重注文を防止する。
- **ログイン再開は sessionStorage 経由**: Google ログインは別ドメインへのフルページ遷移を伴い JS のメモリ状態が消えるため、購入しようとしていたチケット情報は `sessionStorage`（キー: `dct_pending_ticket`）に保存してログイン後に復元する（`js/auth.js`）。
- **見た目は元デザインを維持**: 分割前の22MB HTMLと同じ見た目を保つ方針（README記載）。

# 変更時の注意点

- `js/data.js` を編集すればコンテンツ（記事・ギャラリー・メニュー・SNSリンク等）は反映される。`js/render.js` は描画ロジックなので基本触らない。
- カラー・余白・フォントは `css/style.css` の `:root` にトークン化されている。全体に影響するので変更範囲に注意。
- 秘密鍵・アクセストークンの類は `.env.example` 以外のファイルに書かない。実値は Vercel の環境変数にのみ設定する（`.env.example` 内のコメントに明記済み）。
- Sandbox用とProduction用のSquare認証情報を混ぜない（`.env.example` に警告コメントあり）。

# 既知の問題・不具合

- Square Webhookが同じ決済結果を複数回送ってきた場合（Squareの仕様上リトライがありうる）、`notifications` insertと確認メール送信が重複しうる（購入記録の更新自体は`square_order_id`一致で冪等だが、通知/メールは冪等化していない）。実害が出るようなら「同じ`purchase_id`+`title`の通知が直近にないかチェックしてからinsertする」等の重複排除を追加する。
- issue管理の有無は未確認（GitHubのIssuesを使っているかは未調査）。

# 次に行うこと

1. Google OAuth設定（Cloud Console → OAuthクライアント作成 → SupabaseのGoogleプロバイダに登録）
2. Square Developer Dashboardへのアクセス権限取得後、Sandbox設定一式（Access Token/Location ID/Catalog Object ID/Webhook）
3. Resend設定（ドメイン認証→APIキー→Vercel環境変数）
4. Sandbox環境でログイン・Googleログイン・カート・Square決済・サイト内通知・メール送信を一通り確認
5. 問題なければ Square を Production に切り替え（Access Token/Location ID/Signature Keyを本番用に総入れ替え）

# 関連ファイル

- [README.md](../README.md) — 人間向け編集ガイド（プレビュー方法、記事追加、画像差し替え等）
- [CLAUDE.md](../CLAUDE.md) — 恒久ルール
- [js/data.js](../js/data.js) / [js/render.js](../js/render.js) — コンテンツと描画
- [js/auth.js](../js/auth.js) / [js/auth-config.js](../js/auth-config.js) — 認証
- [js/cart.js](../js/cart.js) / [api/checkout.js](../api/checkout.js) / [api/square-webhook.js](../api/square-webhook.js) — 決済フロー＋購入通知（メール／サイト内通知）
- [supabase/schema.sql](../supabase/schema.sql) / [supabase/schema_v2_cart.sql](../supabase/schema_v2_cart.sql) / [supabase/schema_v3_notifications.sql](../supabase/schema_v3_notifications.sql) — DBスキーマ
- [.env.example](../.env.example) — 必要な環境変数一覧（実値はVercel側）

# 動作確認方法

- ローカルプレビュー: `index.html` をブラウザで直接開く、または `python3 -m http.server` で簡易サーバーを立てて確認（README記載）。
- Vercel Functions（`api/checkout.js` 等）を試す場合はローカルの簡易サーバーでは動かないため、Vercel CLI（`vercel dev`）または実デプロイでの確認が必要（未確認: このプロジェクトで Vercel CLI を使ったローカル実行が想定されているか）。
- 決済まわりは Square Sandbox 環境での動作確認を想定（`.env.example` の `SQUARE_ENVIRONMENT=sandbox`）。

# 最終更新

2026-07-24 — Supabase接続が一通り完了（プロジェクト作成・SQL実行・Secret Keyローテーション・Vercel環境変数・`js/auth-config.js` 設定）し、ログインフォーム表示を動作確認済み。Google OAuth・Square・Resendは未着手/保留中。購入通知機能（メール＋サイト内通知）のコード実装は完了済み（未コミット）。
