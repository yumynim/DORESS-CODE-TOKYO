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
├── member.html                 運用メンバー個人の紹介ページ
├── members-only.html           マイページ（購入したチケット・お知らせ。直リンク/ブックマーク用）
├── admin-announcements.html    お知らせ投稿ページ（管理者専用。profiles.is_admin=trueの人だけ使える）
├── community-creator.html      コミュニティ（クリエイター向け）ページ
├── community-exhibitor.html    コミュニティ（出展者向け）ページ
├── css/style.css               全体スタイル（:root にトークン集約）
├── js/
│   ├── data.js                 サイトのコンテンツデータ（記事・ギャラリー等）
│   ├── render.js                data.js を HTML に展開する描画ロジック
│   ├── auth.js                  Supabase Auth（会員登録/ログイン/ログアウト、Googleサインイン、ログイン再開）＋
│   │                             ヘッダーのマイページアイコン・マイページドロワー（購入履歴＋ログアウト）
│   ├── auth-config.js            Supabase の url / anonKey を入れる設定ファイル（設定済み）
│   ├── notifications.js          ヘッダーの通知ベルアイコン。ドロワーで「あなたへのお知らせ」／
│   │                             「ドレスコードからのお知らせ」をタブ分け表示
│   └── cart.js                   カート機能（localStorage）→ /api/checkout 呼び出し
├── api/
│   ├── checkout.js               POST /api/checkout（Vercel Function）: カート内容を受け取り Square Payment Link を発行
│   ├── square-webhook.js         POST /api/square-webhook（Vercel Function）: Square の決済完了通知を検証して purchases.status を更新
│   └── admin-announcements.js    POST/DELETE /api/admin-announcements（Vercel Function）: 管理者のみannouncementsを投稿/削除（投稿時に全会員へメールも送信）
├── lib/
│   └── mailer.js                 Resend経由のメール送信の共通処理（api/square-webhook.js・api/admin-announcements.js から利用）
├── supabase/
│   ├── schema.sql                 profiles / purchases テーブルの初期スキーマ
│   ├── schema_v2_cart.sql         purchases にカート対応カラム（square_order_id 等）を追加
│   ├── schema_v3_notifications.sql  notifications テーブル（本人だけに届くお知らせ、Webhookのみinsert可）
│   ├── schema_v4_announcements.sql  announcements テーブル（会員全員向けのお知らせ）
│   └── schema_v5_admin.sql          profiles.is_admin カラム＋本人が自分では変更できないようにするガード
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
- **（2026-07-25）ヘッダーUIを大幅変更：マイページ/通知をページ遷移せずドロワーで表示**:
  - 背景: 「マイページ」ボタンが `members-only.html` へのページ遷移だったため、押すと他のページを閲覧できなくなる不満があった
  - [`js/auth.js`](../js/auth.js): ログイン中はヘッダーの「ログイン」ボタンが人型アイコン（アバター）に変わり、押すと**ページ遷移せずドロワー**（カートと同じ仕組み）でマイページ（挨拶／購入したチケット／ログアウト）を表示するように変更。旧・未読バッジ表示ロジック（`refreshNotifBadge`/`.notif-dot`）は下記の通知ベルに統合したため削除
  - [`js/notifications.js`](../js/notifications.js)（新規）: ヘッダーに通知ベルアイコンを追加。押すとドロワーが開き、「あなたへのお知らせ」（`notifications`テーブル、本人専用）／「ドレスコードからのお知らせ」（`announcements`テーブル、会員全員向け）をタブで切り替えて表示。未読があると赤いバッジドット表示
  - [`supabase/schema_v4_announcements.sql`](../supabase/schema_v4_announcements.sql)（新規）: `announcements` テーブル。ログイン中の会員なら誰でも閲覧可、投稿はSupabaseダッシュボードから手動（管理画面は未実装）
  - `index.html` / `article.html` / `member.html` / `community-creator.html` / `community-exhibitor.html` のヘッダー（デスクトップ・モバイル両方）に通知ベルのトリガーボタンを追加、`js/notifications.js` を読み込み追加
  - `members-only.html` は変更なし（直リンク/ブックマーク用の「フルページ版」として残置。個人向けお知らせのみインライン表示、広報お知らせタブはヘッダーの通知ベル側のみ）
  - [`css/style.css`](../css/style.css): `.icon-btn`/`.icon-btn--mobile`（アイコン型ヘッダーボタンの共通土台）、`.notif-tabs`（通知タブ切替）を追加。既存の `@media (max-width: 1240px)` でのログインボタン非表示ルールを `.header__inner .header__cta` に変更（`.icon-btn`とのCSS詳細度衝突でモバイル幅でもアイコンが消えなかったバグを修正）
  - ローカルで新規登録→ログイン→マイページドロワー→通知ドロワー（タブ切替）→モバイル幅でのアイコン非表示、まで一通り動作確認済み
  - **注意**: 動作確認のため作成したテストユーザー（`dct-headertest-20260725@example.com`）がSupabaseに残っている。不要であればSupabaseダッシュボード → Authentication → Users から削除してよい
- **（2026-07-25）ユーザー要望で2点追加修正**:
  1. マイページボタンをアイコンのみ→**アイコン＋「マイページ」の文字**表示に変更（[`js/auth.js`](../js/auth.js) `paintAuthButtons`）。ローカルで表示確認済み
  2. お知らせ投稿の専用ページを新規作成（Supabaseの管理画面を都度開かなくて済むように）:
     - [`supabase/schema_v5_admin.sql`](../supabase/schema_v5_admin.sql)（新規）: `profiles.is_admin` カラムを追加。**本人を含め誰も自分では変更できないようトリガーでガード**（service role経由の変更のみ許可）。理由: 既存の `profiles_update_own` ポリシーはユーザー本人によるupdateを許可しているため、ガードがないと誰でも自分を管理者に昇格できてしまう
     - [`api/admin-announcements.js`](../api/admin-announcements.js)（新規）: POST（投稿）/DELETE（削除）。呼び出し元のセッションを検証→`profiles.is_admin`を確認→service roleで`announcements`を操作。announcementsへのinsert/deleteはRLSで誰にも許可していないため、この検証を通ったリクエストだけがservice role経由で書き込める
     - [`admin-announcements.html`](../admin-announcements.html)（新規）: 未ログイン/管理者でない/管理者、の3状態を出し分け。管理者にはタイトル・本文の投稿フォームと、投稿済み一覧（削除ボタン付き）を表示。サイトの主要ナビには載せていない（直リンクのみ）
     - ローカルでゲスト状態・権限なし状態の表示は確認済み。**実際の投稿(POST)はVercel Functionsが必要なためローカルでは確認できていない**（Vercel Functions共通の制約。既知の注意点参照）
     - **チームメンバーを管理者にする方法**: Supabaseダッシュボード → Table Editor → `profiles` → 対象ユーザーの行 → `is_admin` を `true` に変更（クライアント側からはできない仕様）
- **（2026-07-25）お知らせ投稿時に会員全員へメールも送るよう追加**:
  - [`lib/mailer.js`](../lib/mailer.js)（新規）: Resend送信処理を共通化。`api/square-webhook.js` にあった送信ロジックをここへ移動し、`api/admin-announcements.js` からも使えるようにした（`api/`直下に置くとVercel Functionsのルートとして扱われてしまうため、`lib/`に配置）
  - [`api/admin-announcements.js`](../api/admin-announcements.js): 投稿（POST）成功時に `serviceClient.auth.admin.listUsers()` で全会員を取得し、`lib/mailer.js` 経由で1件ずつメール送信。RESEND未設定なら従来通り静かにスキップ。メール送信に失敗しても投稿自体は成功扱いにする
  - 現状は会員を1人ずつ順番に送信（会員数が増えたらキュー送信等への切り替えを検討、とコード内にコメント済み）
  - Resend未設定のためこの一斉送信自体はまだ実地確認できていない
- **（2026-07-25）お知らせ投稿ページの認証方式を「Supabase個人アカウント」→「チーム共通パスワード」に変更**:
  - 背景: ユーザーから「このページを他の人にも共有したい、リンク＋パスワードで済むようにしたい」との要望。個人アカウント方式（`profiles.is_admin`）だと共有する相手ごとにSupabaseアカウント作成が必要で手間だったため
  - **`supabase/schema_v5_admin.sql`（`profiles.is_admin`）は現在未使用**。今回の変更で認証方式ごと差し替えたため、このマイグレーション自体は残しているが実質使っていない（クリーンアップしたい場合は別途相談）
  - [`lib/adminAuth.js`](../lib/adminAuth.js)（新規）: 合言葉方式のトークン発行／検証。`有効期限.HMAC署名` 形式、有効期限24時間。**署名鍵は`ADMIN_CONSOLE_PASSWORD`そのもの**なので、パスワードをローテーションすると発行済みトークンは全部自動失効する
  - [`api/admin-login.js`](../api/admin-login.js)（新規）: POST `{password}` → 合言葉が正しければトークンを発行。比較は`crypto.timingSafeEqual`（タイミング攻撃対策、既存のWebhook署名検証と同じ考え方）
  - [`api/admin-announcements.js`](../api/admin-announcements.js): 認証をSupabaseセッション検証から`verifyAdminToken`に置き換え。GET（一覧取得）も新規追加、トークンはクエリ文字列で受け取る
  - [`admin-announcements.html`](../admin-announcements.html): Supabase関連のscriptタグを全部削除（`js/auth.js`等は不要になった）。合言葉フォーム→成功したらトークンを`sessionStorage`（タブを閉じると消える。共有端末での使用も想定して意図的に選択）に保存→投稿フォーム・一覧を表示、という流れ
  - [`vercel.json`](../vercel.json): `/console` → `/admin-announcements.html` のrewriteを追加。共有用の短いURLとして`https://<本番ドメイン>/console`が使える
  - `.env.example` に `ADMIN_CONSOLE_PASSWORD` を追加（**未設定**。Vercelの環境変数に値を入れないと投稿ページが機能しない）
  - ローカルで「合言葉未入力→フォーム表示」「有効そうなトークンあり→投稿画面表示→一覧取得は通信エラー（ローカルにAPIサーバーが無いため想定通り）」まで確認。**実際のログイン/投稿/削除はVercel Functionsが必要なため未確認**

# 現在作業中の内容

Supabase接続・ヘッダーのマイページ/通知UI刷新・お知らせ投稿ページ（合言葉方式、`/console`）まで完了・ローカルで表示確認済み（未コミット）。Google OAuthとSquareはユーザーの意向で一旦後回し。次にpushしてVercel本番へ反映し、`ADMIN_CONSOLE_PASSWORD`をVercelに設定してから動作確認が必要。

# 未完了の作業（＝ユーザーが各サイトで行う作業）

- **（ブロッカー）Vercel — `ADMIN_CONSOLE_PASSWORD`未設定**: これを設定しないと `/console`（お知らせ投稿ページ）のログインが機能しない。Vercelの環境変数に追加してRedeployすること。
- ~~Supabase — schema_v5実行~~ 実行済みだが**現在は未使用**（認証方式を合言葉に変更したため。上記「完了済みの作業」参照）
- **Google OAuth**（後回し中）: Google Cloud ConsoleでOAuth同意画面→OAuthクライアントID作成→Client ID/SecretをSupabaseのGoogleプロバイダ設定に登録。リダイレクトURIはSupabaseのGoogleプロバイダ設定画面に表示されるCallback URLを使う。ボタン自体はログインモーダルに表示済み（押しても今はエラーになる想定内の状態）。
- **Square**（後回し中）: Developer Dashboardへのアクセス権限待ち（現状はSquareアプリのみ利用可）。権限取得後、アプリ作成→Sandbox Access Token/Location ID取得→商品登録してCatalog Object ID取得→`js/data.js`の`catalogObjectId`に設定→Webhook登録→Vercel環境変数設定。
- **Resend（メール通知）**: 未着手。Square Sandbox完了後に着手予定。アカウント作成→送信ドメイン認証→APIキー発行→Vercel環境変数（`RESEND_API_KEY`/`NOTIFY_FROM_EMAIL`）設定。
- 全て完了後、Sandboxでの一連の動作確認（ログイン/カート/決済/通知/メール）を経てSquareをProductionへ切替。

# 重要な仕様・決定事項

- **Webhook 署名検証必須**: `api/square-webhook.js` は `crypto.timingSafeEqual` で署名検証してから処理する。理由: 検証を省くと決済していないのに「決済完了」を偽装されうるため。
- **purchases.status の更新権限は service role のみ**: `supabase/schema_v2_cart.sql` の RLS ポリシーで、クライアント（anon key）からの直接更新を禁止。理由: 支払っていないのに `paid` に書き換える不正を防ぐため。
- **Idempotency Key 必須**: `api/checkout.js` は Square の Payment Link 作成時に Idempotency Key を付与し、二重注文を防止する。
- **ログイン再開は sessionStorage 経由**: Google ログインは別ドメインへのフルページ遷移を伴い JS のメモリ状態が消えるため、購入しようとしていたチケット情報は `sessionStorage`（キー: `dct_pending_ticket`）に保存してログイン後に復元する（`js/auth.js`）。
- **見た目は元デザインを維持**: 分割前の22MB HTMLと同じ見た目を保つ方針（README記載）。
- **announcements への書き込みは `/api/admin-announcements` 経由のみ**: RLSでinsert/deleteポリシーを意図的に作っておらず、サーバー側（service role）でしか書き込めない。理由: `purchases.status` と同じ考え方で、権限確認をクライアント任せにしない。
- **お知らせ投稿ページ（`/console`）はチーム共通の合言葉方式**: `ADMIN_CONSOLE_PASSWORD` 1つを知っている人なら誰でも会員全員へお知らせ（サイト内通知＋メール）を投稿できる。個人アカウント単位の権限管理ではないため、「誰が投稿したか」の記録は残らない。合言葉が漏れた場合は`ADMIN_CONSOLE_PASSWORD`を変更すれば、発行済みトークンも含めて即座に無効化される。

# 変更時の注意点

- `js/data.js` を編集すればコンテンツ（記事・ギャラリー・メニュー・SNSリンク等）は反映される。`js/render.js` は描画ロジックなので基本触らない。
- カラー・余白・フォントは `css/style.css` の `:root` にトークン化されている。全体に影響するので変更範囲に注意。
- 秘密鍵・アクセストークンの類は `.env.example` 以外のファイルに書かない。実値は Vercel の環境変数にのみ設定する（`.env.example` 内のコメントに明記済み）。
- Sandbox用とProduction用のSquare認証情報を混ぜない（`.env.example` に警告コメントあり）。

# 既知の問題・不具合

- Square Webhookが同じ決済結果を複数回送ってきた場合（Squareの仕様上リトライがありうる）、`notifications` insertと確認メール送信が重複しうる（購入記録の更新自体は`square_order_id`一致で冪等だが、通知/メールは冪等化していない）。実害が出るようなら「同じ`purchase_id`+`title`の通知が直近にないかチェックしてからinsertする」等の重複排除を追加する。
- issue管理の有無は未確認（GitHubのIssuesを使っているかは未調査）。

# 次に行うこと

1. `ADMIN_CONSOLE_PASSWORD` をVercelの環境変数に設定（十分に長い合言葉。まだ未設定）
2. コミット・push してVercel本番に反映（このセッションの変更はユーザー承認済み・push予定）
3. Vercel本番の `https://<本番ドメイン>/console` で「合言葉入力→投稿→一覧表示→削除」を一通り確認（ローカルでは未確認）
4. 共有したい相手に `/console` のURLと合言葉を伝える
5. （後回し中）Google OAuth設定（Cloud Console → OAuthクライアント作成 → SupabaseのGoogleプロバイダに登録）
6. （後回し中）Square Developer Dashboardへのアクセス権限取得後、Sandbox設定一式（Access Token/Location ID/Catalog Object ID/Webhook）
7. Resend設定（ドメイン認証→APIキー→Vercel環境変数）。設定できれば購入通知とお知らせ投稿の両方でメールが飛ぶようになる
8. Sandbox環境でログイン・Googleログイン・カート・Square決済・サイト内通知・メール送信を一通り確認
9. 問題なければ Square を Production に切り替え（Access Token/Location ID/Signature Keyを本番用に総入れ替え）

# 関連ファイル

- [README.md](../README.md) — 人間向け編集ガイド（プレビュー方法、記事追加、画像差し替え等）
- [CLAUDE.md](../CLAUDE.md) — 恒久ルール
- [js/data.js](../js/data.js) / [js/render.js](../js/render.js) — コンテンツと描画
- [js/auth.js](../js/auth.js) / [js/auth-config.js](../js/auth-config.js) — 認証・マイページドロワー
- [js/notifications.js](../js/notifications.js) — 通知ベル（あなたへのお知らせ／ドレスコードからのお知らせ）
- [admin-announcements.html](../admin-announcements.html)（`/console`） / [api/admin-announcements.js](../api/admin-announcements.js) / [api/admin-login.js](../api/admin-login.js) / [lib/adminAuth.js](../lib/adminAuth.js) — お知らせ投稿ページ（合言葉方式）
- [lib/mailer.js](../lib/mailer.js) — Resend送信の共通処理
- [js/cart.js](../js/cart.js) / [api/checkout.js](../api/checkout.js) / [api/square-webhook.js](../api/square-webhook.js) — 決済フロー＋購入通知（メール／サイト内通知）
- [supabase/schema.sql](../supabase/schema.sql) 〜 [schema_v5_admin.sql](../supabase/schema_v5_admin.sql) — DBスキーマ（v1〜v4は使用中、v5は現在未使用）
- [vercel.json](../vercel.json) — セキュリティヘッダー＋ `/console` のrewrite
- [.env.example](../.env.example) — 必要な環境変数一覧（実値はVercel側）

# 動作確認方法

- ローカルプレビュー: `index.html` をブラウザで直接開く、または `python3 -m http.server` で簡易サーバーを立てて確認（README記載）。
- Vercel Functions（`api/checkout.js` 等）を試す場合はローカルの簡易サーバーでは動かないため、Vercel CLI（`vercel dev`）または実デプロイでの確認が必要（未確認: このプロジェクトで Vercel CLI を使ったローカル実行が想定されているか）。
- 決済まわりは Square Sandbox 環境での動作確認を想定（`.env.example` の `SQUARE_ENVIRONMENT=sandbox`）。

# 最終更新

2026-07-25 — ヘッダーのマイページ／通知UIをドロワー形式に刷新（ページ遷移せず他ページを離脱しない）。マイページアイコン・通知ベル（本人向け／全体向けタブ分け）を追加し、announcementsテーブルを新設。お知らせ投稿ページ（`/console`）を新規追加、投稿時に会員全員へメールも送信。認証方式は当初`profiles.is_admin`（個人アカウント）で作ったが、「共有しやすくしたい」というユーザー要望を受けて**共通パスワード方式**（`ADMIN_CONSOLE_PASSWORD`）に差し替え済み（`schema_v5_admin.sql`は現在未使用）。push・ユーザー承認済み、コミット/push直前。Vercel側の`ADMIN_CONSOLE_PASSWORD`設定と本番動作確認はこれから。Google OAuth・Squareはユーザーの意向で後回し中。Resendは未着手。
