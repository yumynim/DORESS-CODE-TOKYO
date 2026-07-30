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
└── 方針/ 事業/ 案件/ 素材/          運営資料（すべてgitignore対象・ローカルのみ。詳細はCLAUDE.md参照。
                                   「素材」は旧フォルダ名「添付資料」からリネーム）
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
- **（2026-07-25）`ADMIN_CONSOLE_PASSWORD`が反映されない問題の原因判明・解決**:
  - 長時間のトラブルシューティングの結果、**同じGitHubリポジトリが誤って複数のVercelプロジェクトにインポートされていた**ことが判明（`doress-code-tokyo-cip1` / `doress-code-tokyo` / `doress-code-tokyo-9qjj`）。本番ドメイン`dress-code-tokyo.com`は`-9qjj`にだけ紐づいており、ユーザーはずっと`-cip1`の方の環境変数を編集していたため反映されなかった
  - 切り分けのため `api/env-check.js`（新規）を追加：必要な環境変数が「設定されているか」を booleanで返す診断用エンドポイント。`VERCEL_URL`/`VERCEL_ENV`/`VERCEL_GIT_COMMIT_SHA` も返し、「どのデプロイ・どのコミットが実際にドメインに紐づいているか」を確認できるようにした（今後も同種のトラブルで使える）
  - `-9qjj`側に`ADMIN_CONSOLE_PASSWORD`を正しく設定・Redeployして解決。動作確認済み（本番で `/console` にログイン成功）
  - **後片付け**: 使っていなかった`doress-code-tokyo-cip1`・`doress-code-tokyo`の2プロジェクトはユーザーが削除済み。以後は`doress-code-tokyo-9qjj`のみを使う
- **（2026-07-25）運営資料フォルダを新設**: `方針/` `事業/` `案件/` `素材/` をリポジトリ直下に作成（すべて`.gitignore`対象、ローカルのみ）。`素材/`は旧`添付資料/`をリネームして中身をそのまま移動。`CLAUDE.md`に参照ルールを追記（詳細は「重要な仕様・決定事項」欄）
- **（2026-07-25）お知らせ投稿ページに「個人宛て送信」を追加**:
  - 背景: ユーザーから「Consoleにもっと自由度が欲しい、最低でも個人単体への配信が欲しい」との要望
  - [`admin-announcements.html`](../admin-announcements.html): 投稿フォームに「会員全員に送る」／「個人宛てに送る」のタブを追加。個人宛てを選ぶと宛先メールアドレス欄が出る。一覧も「全員向け」と「個人宛てに送った履歴」の2セクションに分離（削除ボタンはそれぞれ対応するテーブルを操作）
  - [`api/admin-announcements.js`](../api/admin-announcements.js): `targetEmail`が指定されていれば個人宛てモード。`serviceClient.auth.admin.listUsers()`をページングしながらメールアドレスで検索し、該当ユーザーが見つかれば`notifications`テーブルに1件insert（`purchase_id`はnull）＋その人だけにメール送信。見つからなければ404エラー。GET（一覧取得）は`announcements`と、`notifications`のうち`purchase_id`がnullなもの（＝Webhookではなくこの画面から送った個人宛て分）の両方を返す。個人宛て一覧の表示用に、各通知の宛先メールアドレスを`getUserById`で解決している
  - DELETE には `type`（`'announcement'` | `'personal'`）を追加し、どちらのテーブルを操作するか切り替え
  - ローカルでタブ切り替え（メール入力欄の表示/非表示）の動作確認済み。**実際の個人宛て送信（該当ユーザー検索・insert・メール送信）はVercel Functionsが必要なため未確認**

# 現在作業中の内容

Supabase接続・ヘッダーのマイページ/通知UI刷新・お知らせ投稿ページ（合言葉方式、`/console`、個人宛て送信対応）・Resendメール通知（テキスト＋HTML）まで完了。Google OAuthとSquareはユーザーの意向で一旦後回し。次はHTMLメールの実地確認（Gmail/Outlook等での表示崩れがないか）と、後回し中のGoogle OAuth・Squareの着手。

# 未完了の作業（＝ユーザーが各サイトで行う作業）

- **（ブロッカー）Vercel環境変数 `CONTACT_TO_EMAIL` 未設定**: サイト内蔵のお問い合わせフォーム（`api/contact.js`）の「届きました」通知メールの宛先。2026-07-30に`/api/env-check`で確認したところ未設定のままだった。未設定でも`inquiries`テーブルへの保存自体は行われる（`/console`で見られる）ため機能は止まらないが、能動的にconsoleを見ないと新着に気づけない。実際に受信できるアドレス（Gmail等でよい）を設定すること。**Resendの追加DNS設定は不要**（宛先にドメイン認証は要らないため）。
- **（ブロッカー）Supabase — `schema_v6_inquiries.sql` 未実行**: お問い合わせのDB保存・console返信機能に必要な`inquiries`テーブルがまだ存在しない。Supabase Dashboard → SQL Editor に[`supabase/schema_v6_inquiries.sql`](../supabase/schema_v6_inquiries.sql)の中身を貼ってRunするだけ。未実行の間は`/api/contact`が500エラーを返す（テーブルが無いため）。
- **（ブロッカー）Supabase Storage — `announcement-images`バケット未作成**: Console配信エディタの画像アップロード機能を使うには、Supabase Dashboard → Storage → New bucket で `announcement-images`（Public bucket: ON）を作成する必要がある。未作成の間はアップロードがエラーになる（URL直接貼り付けの画像ブロックは作成不要で使える）。
- ~~Supabase — schema_v5実行~~ 実行済みだが**現在は未使用**（認証方式を合言葉に変更したため。上記「完了済みの作業」参照）
- **Google OAuth**（後回し中）: Google Cloud ConsoleでOAuth同意画面→OAuthクライアントID作成→Client ID/SecretをSupabaseのGoogleプロバイダ設定に登録。リダイレクトURIはSupabaseのGoogleプロバイダ設定画面に表示されるCallback URLを使う。ボタン自体はログインモーダルに表示済み（押しても今はエラーになる想定内の状態）。
- **Square**（後回し中）: Developer Dashboardへのアクセス権限待ち（現状はSquareアプリのみ利用可）。権限取得後、アプリ作成→Sandbox Access Token/Location ID取得→商品登録してCatalog Object ID取得→`js/data.js`の`catalogObjectId`に設定→Webhook登録→Vercel環境変数設定。
- 全て完了後、Sandboxでの一連の動作確認（ログイン/カート/決済/通知/メール）を経てSquareをProductionへ切替。
- **（本番公開前チェックリスト・必須）Supabase Authenticationの「Confirm email」を有効化する**: 現在は開発・テスト効率優先でOFFにしており、メールアドレスを誤入力してもそのままアカウントが作成できてしまう。本番公開前に必ず以下を実施すること。
  - [ ] Supabase Dashboard → Authentication → Providers（またはEmail設定）で「Confirm email」をON
  - [ ] Resendの独自ドメイン認証（SPF/DKIM等）が完了していることを確認（[完了済みの作業]参照、2026-07-25に確認済みだが公開直前に再確認）
  - [ ] 新規登録時に確認メールが送信されることを確認
  - [ ] 確認メール内のリンクから認証できることを確認
  - [ ] 認証前はログインできず、認証後のみログインできることを確認
  - [ ] メールアドレスを誤入力した場合にアカウントを利用できないことを確認
  - [ ] 実際のユーザー視点で新規登録フローを最後までテストする
  - 完了するまでは公開しないこと（セキュリティとメールアドレスの正当性を保証するための必須項目）。

# 重要な仕様・決定事項

- **Webhook 署名検証必須**: `api/square-webhook.js` は `crypto.timingSafeEqual` で署名検証してから処理する。理由: 検証を省くと決済していないのに「決済完了」を偽装されうるため。
- **purchases.status の更新権限は service role のみ**: `supabase/schema_v2_cart.sql` の RLS ポリシーで、クライアント（anon key）からの直接更新を禁止。理由: 支払っていないのに `paid` に書き換える不正を防ぐため。
- **Idempotency Key 必須**: `api/checkout.js` は Square の Payment Link 作成時に Idempotency Key を付与し、二重注文を防止する。
- **ログイン再開は sessionStorage 経由**: Google ログインは別ドメインへのフルページ遷移を伴い JS のメモリ状態が消えるため、購入しようとしていたチケット情報は `sessionStorage`（キー: `dct_pending_ticket`）に保存してログイン後に復元する（`js/auth.js`）。
- **見た目は元デザインを維持**: 分割前の22MB HTMLと同じ見た目を保つ方針（README記載）。
- **announcements への書き込みは `/api/admin-announcements` 経由のみ**: RLSでinsert/deleteポリシーを意図的に作っておらず、サーバー側（service role）でしか書き込めない。理由: `purchases.status` と同じ考え方で、権限確認をクライアント任せにしない。
- **お知らせ投稿ページ（`/console`）はチーム共通の合言葉方式**: `ADMIN_CONSOLE_PASSWORD` 1つを知っている人なら誰でも会員全員／個人宛てにお知らせ（サイト内通知＋メール）を送れる。個人アカウント単位の権限管理ではないため、「誰が送ったか」の記録は残らない。合言葉が漏れた場合は`ADMIN_CONSOLE_PASSWORD`を変更すれば、発行済みトークンも含めて即座に無効化される。
- **Vercelのプロジェクトは`doress-code-tokyo-9qjj`が唯一の本番**: 過去に同じリポジトリを複数回インポートしてしまい、似た名前の重複プロジェクトができていたことがある（2026-07-25に発見・削除済み）。今後Vercelの環境変数を触るときは、必ずURLの末尾が`-9qjj`のプロジェクトを編集していることを確認する。原因切り分けには`/api/env-check`が使える。
- **Resendは設定済み・動作確認済み**（2026-07-25）: ドメイン認証（SPF/DKIM/DMARC）・APIキー発行・Vercel環境変数（`RESEND_API_KEY`/`NOTIFY_FROM_EMAIL`）設定まで完了し、`/console`からのメール送信を実地確認済み。送信元は`DRESS CODE TOKYO <noreply@dress-code-tokyo.com>`。メールはテキスト版とHTML版を同時送信（`lib/mailer.js`の`sendEmail`が両方生成）。設定直後に送信履歴が0件で「動いていないように見えた」原因は、Resend側ではなく管理画面→`serviceClient.auth.admin.listUsers()`が`SUPABASE_SERVICE_ROLE_KEY`の不整合で`invalid JWT`エラーを起こし、Resendまで処理が到達していなかったこと。最新のSecret Key（`sb_secret_...`形式）を取得してVercelの`SUPABASE_SERVICE_ROLE_KEY`を更新し解決。**教訓**: Supabaseのservice roleキーは形式が変わることがあるため、`invalid JWT`系のエラーが出たらまずこのキーを疑う。
- **HTMLメールテンプレート**（2026-07-25追加、同日ヘッダーデザイン修正・ブロックエディタ追加）: `lib/mailer.js`の`buildEmailHtml()`が黒×白ベースの共通レイアウト（見出し・本文・CTAボタン・フッター、max-width 600px、テーブルベースでインラインCSS）を生成する。ヘッダーは当初ロゴ画像を黒背景に載せていたが「ダサい」とのフィードバックを受け、白背景＋総称フォントの欧文ワードマーク（"DRESS CODE" / "TOKYO"、下線区切り）に変更済み（メールクライアントはWebフォント・カスタムロゴ画像の見え方が不安定なため、Georgia等の総称フォントで組んでいる）。
- **配信エディタ（ブロック方式）**（2026-07-25追加、同日ブロック種類を拡張）: `/console`のお知らせ投稿フォームは、Notionのブロック編集のような自由な組み立てができるエディタ（`admin-announcements.html`）。対応ブロックは「見出し（大/中/小、文字色）」「段落（文字色）」「ハイライト（背景付き強調ボックス）」「画像（外部URL指定）」「区切り線」「ボタン」の6種類。追加・並び替え（↑↓）・削除ができ、右側にAPIから取得した実際のメールHTML（`/api/admin-preview-email`、送信は伴わない）をリアルタイムプレビュー表示する。文字色は黒白ベースの世界観を崩さないよう「標準／濃い黒／グレー／えんじ」の4色に絞ってある（`lib/mailer.js`の`TEXT_COLORS`）。画像はURL貼り付けに加え、ファイルを直接アップロードもできる（`api/admin-upload-image.js`がSupabase Storageの`announcement-images`バケットへservice role経由でアップロードし、公開URLを返す。JPEG/PNG/WebP/GIF、3MBまで）。エディタ本体は横並び2カラム（左: エディタ／右: プレビュー、`.mypage--admin`で通常の720px幅制限をこのページだけ1160pxに拡張）。送信時はブロック配列をサーバー（`api/admin-announcements.js`）に渡し、`lib/mailer.js`の`renderBlocks()`でサイト内通知用のプレーンテキストとメールHTMLの両方を同じ処理から生成する（プレビューと実際のメールが常に一致する設計）。購入完了/キャンセル通知（`api/square-webhook.js`）は従来どおりの単純な`text`＋任意の単一CTAボタンの方式のまま（`sendEmail`はblocks指定時とtext指定時の両方に対応、後方互換）。
- **POP-UP MARKET（2026年9月27日）の開催情報を掲載**（2026-07-26）: 来場者向けチケットの「もっと見る」（`js/data.js`の`ticketsC[0].detail`）に開催場所・日時・入場料・CONCEPT・LIMITED ITEM・チェキ会・ご来場について・問い合わせ先を掲載。来場者向けチラシ（`assets/images/market-flyer-visitor.png`、元は`素材/マーケット一般.png`）を`eventVisualC`に設定し、出店者向けチラシ（`eventVisualB`）と同じ拡大表示の仕組みで表示している。あわせて`js/render.js`の`openTicketDrawer()`で`detail.body`の改行（`\n`）を`<br>`に変換するようにした（複数行の注意事項を書けるようにするため）。
  - 2026-07-29: 入場料を`¥1,000`に修正（ユーザー確認済み）。
- **チケット購入者セグメント配信（購入者タグ）**（2026-07-26追加）: `/console`の宛先タブに「チケット購入者に送る」を追加。チケット単位で購入者を絞り込んで一斉送信できる。**専用のタグ用テーブルは意図的に作っていない** — `purchases.items`（購入内訳のJSON）から毎回集計する方式（`api/admin-announcements.js`の`collectSegments()`）。理由: チケットを増やすたびに管理画面でタグを作り直す手間がなく、`js/data.js`にチケットを足してSquareで売れた瞬間から自動的に絞り込み先として現れるため。セグメントの一意キーは Square の `catalogObjectId`（未設定・単品購入時は商品名で代用）。対象は`status='paid'`の購入のみ。送信先は`announcements`ではなく対象者ひとりひとりの`notifications`に入れる（全員向けに入れると未購入の会員のヘッダー通知にも出てしまうため）。
- **お問い合わせフォームをサイト内蔵に変更**（2026-07-26、2026-07-29にご用件をラジオ→ドロップダウンに変更、2026-07-30にDB保存＋console返信機能を追加）: 以前はContactセクションの「＋」からGoogleフォームのiframeを開く方式だったが、サイト内で完結するフォームに置き換え（`js/render.js`の`contact-reasons`描画部分）。ご用件（`js/data.js`の`contactReasons`）は「カテゴリ *」ラベル付きのドロップダウン（`<select name="reason">`、プレースホルダー「選択してください」）で選び、お名前・メールアドレス・本文を書いて送信する。迷惑メール対策はhoneypot（隠しフィールド`company`）＋同一IPの簡易レート制限（1分3件）。
  - **正式な記録はDB（`inquiries`テーブル、`supabase/schema_v6_inquiries.sql`）**: `api/contact.js`が送信内容を保存し、`/console`の「お問い合わせ」セクション（`api/admin-inquiries.js`のGET）から一覧・本文を確認できる。
  - **通知メールは「見逃し防止のオマケ」**: `CONTACT_TO_EMAIL`（未設定なら`NOTIFY_FROM_EMAIL`）宛てに「届きました」メールを送るが、**意図的にReply-Toを設定していない**。理由: Gmail等で直接返信できてしまうと、consoleでの返信と二重に対応してしまう事故が起きるため（ユーザーからの明確な要望）。通知メールには「返信は`/console`から」という案内とconsoleへのボタンリンクを入れている。
  - **返信は`/console`からのみ行う設計**: `api/admin-inquiries.js`のPOSTが、送信元`info@dress-code-tokyo.com`（`lib/mailer.js`の`INQUIRY_FROM_EMAIL`。ドメイン全体がResend認証済みなので追加DNS設定なしで使える）から問い合わせ者本人へ返信メールを送り、`inquiries.status`を`replied`に更新して返信内容・日時を記録する。返信メールの`Reply-To`は`CONTACT_TO_EMAIL`（info@自体は受信箱を持たない送信専用アドレスのため、相手がさらに返信した場合の行き先として設定）。
  - `lib/mailer.js`の`sendEmail()`に`from`オプション（送信元の差し替え）を追加。既存の呼び出し（購入通知・お知らせ配信）は影響なし。
  - **問い合わせ者本人への自動受付メール**（2026-07-30）: `api/contact.js`が保存・運営通知に加えて、送信元`info@dress-code-tokyo.com`から問い合わせ者本人に「受け付けました。24時間以内にご返信します」の自動返信も送る。この自動返信の`Reply-To`も`CONTACT_TO_EMAIL`（相手が先走って返信してもきちんとあなたのメールに届くようにするため）。
- **画像アップロード用のSupabase Storageバケットが未作成（要ユーザー作業）**: `api/admin-upload-image.js`は`announcement-images`という名前の**公開（Public）バケット**がSupabaseに存在する前提で動く。Dashboard → Storage → New bucket → 名前`announcement-images` → Public bucket: ON、で作成すること。書き込みはservice roleで行うためRLSポリシーの追加は不要（バケットをPublicにしておけば読み取りは誰でも可）。バケット未作成の間は画像アップロードがエラーになるが、URL直接貼り付けの画像ブロックは引き続き使える。

# 変更時の注意点

- `js/data.js` を編集すればコンテンツ（記事・ギャラリー・メニュー・SNSリンク等）は反映される。`js/render.js` は描画ロジックなので基本触らない。
- カラー・余白・フォントは `css/style.css` の `:root` にトークン化されている。全体に影響するので変更範囲に注意。
- 秘密鍵・アクセストークンの類は `.env.example` 以外のファイルに書かない。実値は Vercel の環境変数にのみ設定する（`.env.example` 内のコメントに明記済み）。
- Sandbox用とProduction用のSquare認証情報を混ぜない（`.env.example` に警告コメントあり）。

# 既知の問題・不具合

- Square Webhookが同じ決済結果を複数回送ってきた場合（Squareの仕様上リトライがありうる）、`notifications` insertと確認メール送信が重複しうる（購入記録の更新自体は`square_order_id`一致で冪等だが、通知/メールは冪等化していない）。実害が出るようなら「同じ`purchase_id`+`title`の通知が直近にないかチェックしてからinsertする」等の重複排除を追加する。
- issue管理の有無は未確認（GitHubのIssuesを使っているかは未調査）。

# 次に行うこと

1. HTMLメールテンプレートの追加分（`lib/mailer.js`のCTAボタン対応）をコミット・push してVercel本番に反映
2. 本番で購入通知メール・`/console`からの一斉/個人宛てメールを実際に受信し、Gmail/Outlook/iPhoneメール等でHTMLの表示崩れがないか確認
3. （後回し中）Google OAuth設定（Cloud Console → OAuthクライアント作成 → SupabaseのGoogleプロバイダに登録）
4. （後回し中）Square Developer Dashboardへのアクセス権限取得後、Sandbox設定一式（Access Token/Location ID/Catalog Object ID/Webhook）
5. Sandbox環境でログイン・Googleログイン・カート・Square決済・サイト内通知・メール送信を一通り確認
6. 問題なければ Square を Production に切り替え（Access Token/Location ID/Signature Keyを本番用に総入れ替え）

# 関連ファイル

- [README.md](../README.md) — 人間向け編集ガイド（プレビュー方法、記事追加、画像差し替え等）
- [CLAUDE.md](../CLAUDE.md) — 恒久ルール
- [js/data.js](../js/data.js) / [js/render.js](../js/render.js) — コンテンツと描画
- [js/auth.js](../js/auth.js) / [js/auth-config.js](../js/auth-config.js) — 認証・マイページドロワー
- [js/notifications.js](../js/notifications.js) — 通知ベル（あなたへのお知らせ／ドレスコードからのお知らせ）
- [admin-announcements.html](../admin-announcements.html)（`/console`） / [api/admin-announcements.js](../api/admin-announcements.js) / [api/admin-login.js](../api/admin-login.js) / [lib/adminAuth.js](../lib/adminAuth.js) — お知らせ投稿ページ（合言葉方式、全員宛て／個人宛て対応）
- [api/env-check.js](../api/env-check.js) — 環境変数・デプロイ診断用エンドポイント（トラブル時に使う）
- [lib/mailer.js](../lib/mailer.js) — Resend送信の共通処理
- [js/cart.js](../js/cart.js) / [api/checkout.js](../api/checkout.js) / [api/square-webhook.js](../api/square-webhook.js) — 決済フロー＋購入通知（メール／サイト内通知）
- [supabase/schema.sql](../supabase/schema.sql) 〜 [schema_v5_admin.sql](../supabase/schema_v5_admin.sql) — DBスキーマ（v1〜v4は使用中、v5は現在未使用）
- [vercel.json](../vercel.json) — セキュリティヘッダー＋ `/console` のrewrite
- [.env.example](../.env.example) — 必要な環境変数一覧（実値はVercel側）
- `方針/` `事業/` `案件/` `素材/` — 運営資料（gitignore対象、ローカルのみ）

# 動作確認方法

- ローカルプレビュー: `index.html` をブラウザで直接開く、または `python3 -m http.server` で簡易サーバーを立てて確認（README記載）。
- Vercel Functions（`api/checkout.js` 等）を試す場合はローカルの簡易サーバーでは動かないため、Vercel CLI（`vercel dev`）または実デプロイでの確認が必要（未確認: このプロジェクトで Vercel CLI を使ったローカル実行が想定されているか）。
- 決済まわりは Square Sandbox 環境での動作確認を想定（`.env.example` の `SQUARE_ENVIRONMENT=sandbox`）。

# 最終更新

2026-07-25 — ヘッダーのマイページ／通知UIをドロワー形式に刷新、お知らせ投稿ページ（`/console`、共通パスワード方式）を追加し会員全員／個人宛ての両対応にした。Vercelに同名の重複プロジェクトが3つ存在していた問題を発見・解決し（本番は`doress-code-tokyo-9qjj`のみ）、不要な2つは削除済み。診断用の`/api/env-check`を追加。運営資料フォルダ（`方針/`・`事業/`・`案件/`・`素材/`、いずれもgitignore対象）を新設。Resendのドメイン認証・APIキー・Vercel環境変数設定が完了し、`/console`からのメール送信を実地確認済み（送信失敗の原因は`SUPABASE_SERVICE_ROLE_KEY`の`invalid JWT`で、Resend自体は無関係だった）。さらにHTMLメールテンプレート（黒白ベース・ロゴ・CTAボタン付き、`lib/mailer.js`の`buildEmailHtml`）を追加し、購入通知・お知らせ投稿の全パターンをテキスト＋HTML同時送信に対応。Google OAuth・Squareはユーザーの意向で後回し中。
