# 引き継ぎメモ（2026-08-03時点・最優先で読むこと）

**背景**: Square本番切り替え・受付コード(QR)・当日入場確認(`/checkin`)・Confirm email（メール確認）まで実装が完了。会話が長くなったための引き継ぎメモ。詳細な経緯は下の各セクション（特に「現在作業中の内容」）に書いてあるので、要点だけ知りたいときはここを読む。

## 今まさに問題になっていること（未解決・進行中）

0. **`supabase/schema_v11_notifications_update_guard.sql`が未実行**（セキュリティ・最優先）: 現状、ログイン中の会員が自分の通知の`title`/`body`/`body_html`を書き換えたり、`user_id`を他人のIDに付け替えて相手の通知欄に任意の文面を差し込んだりできる状態（`schema_v3`の`notifications_update_own`に`with check`と列制限が無いため）。クライアント側のコードは`read`しか更新しないが、ブラウザから直接Supabaseを叩けば何でも書ける。SQL Editorで実行すれば塞がる。

1. **実地テスト一式が未実施**（最優先）:
   - 実際の少額決済 → 決済直後の「ご購入ありがとうございました」画面 → 確認メール → 通知ドロワー → マイページ、すべてで受付コード・QRが正しい形式（`DCT-0927-N1`等）で表示されるか
   - `/checkin`で実際にQRスキャン／手入力→「入場OK」（お名前＋メールアドレス表示）→もう一度同じコードで「入場済みです」→検索→「取り消す」、が一通り動くか
   - まだ私（Claude）側では実行できていない。ユーザー側での実施待ち。

## 完了した項目（2026-08-03）

- Supabase URL Configuration修正（Site URL / Redirect URLs）→ Confirm emailの`otp_expired`エラー解消、認証フロー確認済み
- Vercel環境変数`CURRENT_EVENT_ID`を`0927`に設定・Redeploy済み（値は「イベントID」のみ。`S`/`N`の連番はカテゴリごとに独立管理され、`CURRENT_EVENT_ID`を新しい値に変えるたびにそのイベント用に1からカウントし直される設計）
- 確認メールの再送導線を強化（`js/auth.js`）: 新規登録直後の案内にも再送ボタンを表示。「確認待ちのメールで再登録しようとして失敗する」ケースを検知し、専用の案内＋再送ボタンを表示するように変更
- Supabase「Confirm signup」メールテンプレートをサイトのデザイン（黒白ベース・明朝体ロゴ）に合わせてカスタム化（Supabaseダッシュボード側の設定、コード管理外）
- `supabase/schema_v10_event_sequence.sql`実行済み（ユーザー側で実施）
- `/checkin`と`/console`の両方で、購入者をメールアドレスだけでなく登録名（お名前）も併せて表示するように変更（スキャン結果・チェックイン履歴・購入者一覧・送信済み個人宛てメッセージ履歴、検索対象にも登録名を追加）。`api/admin-checkin.js`と`api/admin-announcements.js`の`resolveEmails()`を`resolveUsers()`に変更し`user_metadata.display_name`も返すようにした。
- モーダル/ドロワーを開くとヘッダーがガタつくバグを修正（`html { scrollbar-gutter: stable; }`）
- 登録メールの再送エラーを詳しく判定（既に確認済みのアカウントで再送しようとした場合に専用の案内を出す）、新規登録フォームでメール入力後に既存会員かその場で警告する`/api/check-email`を追加
- パスワードの再設定機能を追加（ログインフォームに「パスワードをお忘れですか？」→再設定メール送信→リンクを開くと新パスワード入力画面）。Supabase側で「Reset Password」メールテンプレートもサイトデザインに合わせてカスタム化（Supabaseダッシュボード側の設定、コード管理外）
- `tokutei-shotorihiki.html`の返品・キャンセル条項を強化。類似サービス（Peatix等）を調査した上で、不可抗力（天候・災害等）による延期時の扱い、チケット・出店枠の第三者譲渡/転売の禁止、免責事項（サービス中断・当事者間トラブル・アカウント管理・不正利用/チャージバック・損害賠償上限）を追加。**法律の専門家によるレビューは受けていない**（ユーザーの了承のもとドラフトとして掲載）。個人名（齋藤南）の掲載は変更しない方針で確定（ユーザー判断）。
- 上記に加え、`js/data.js`の実装内容（チケット詳細・決済フロー）と照合したセルフレビューで4点修正：①「準備中」の消し忘れ文言を削除、②損害賠償上限の条項に故意・重過失の除外を追加（消費者契約法8条対策）、③所在地・電話番号の開示請求先をメールアドレスに明示、④「数量限定（先着順）」の販売条件を追記。**これも法律専門家のレビューではない**点は変わらず。

## 運用ルール変更

- **コミット・pushは、キリの良い変更が1つ完了するたびに自動で行う**（ユーザー指示: 「プッシュは毎回自動でしちゃって」）。破壊的なgit操作（force push等）のみ明示的指示が必要。CLAUDE.mdにも反映済み。

## 残タスク一覧（優先順）

1. **`supabase/schema_v11_notifications_update_guard.sql`をSQL Editorで実行**（上記0番のセキュリティ穴を塞ぐ）
2. 実際の少額決済で一連の流れを通しテスト（決済→ありがとう画面→確認メール→通知→マイページ、受付コード/QRの表示確認）— ユーザーが「このあとテストする」と発言、実施待ち
3. `/checkin`の動作を通しテスト（QRスキャン/手入力→入場OK（名前+メール表示）→再スキャンで入場済み→検索→取り消し）
4. `js/data.js`のTSUBASAの紹介文（`desc`/`role`/`dept`）を入れる。プレースホルダーがそのまま公開されていたため2026-08-03に空にした。今は写真＋名前だけのカードになっている
5. （未実装・以前の要望）`/checkin`のチェックイン履歴をイベントごとにトグルで分けて見られるようにする。今は全イベント分が1つの一覧に混ざる
6. （保留中）Google OAuth再開
7. （後片付け・急ぎではない）Sandboxテスト時代の「手続き中」テストデータを`purchases`から削除
8. （任意）`tokutei-shotorihiki.html`の新しい条項を、可能であれば一度専門家（弁護士等）にレビューしてもらう

## 2026-08-03 サイト全体の棚卸しで見つかったもの（未対応・急ぎではない）

コードの矛盾・無駄の洗い出しをした際に見つかったが、今すぐの実害が無いため手を付けていないもの。

- **孤立ページが3つ公開されている**: `member.html`（`js/render.js`のメンバーカードからリンクしていない）、`community-creator.html`、`community-exhibitor.html`（`js/data.js`の`community`配列でコメントアウト中）。URLを直接叩けば誰でも見られる。消すか、リンクを復活させるか、`noindex`のまま放置するかは運営判断。
- **`api/env-check.js`が認証なしで誰でも叩ける**: 環境変数の値そのものは返さないが、設定済みか否かとデプロイのコミットSHAが分かる。他の管理系APIは全て`verifyAdminToken`で守られている。
- **同じ処理のコピーが複数ある**: `resolveUsers()`が`api/admin-announcements.js`と`api/admin-checkin.js`に完全に同じものが2つ、メールからユーザーを探す処理が3箇所（`admin-announcements.js`/`check-email.js`/`scripts/simulate-payment-webhook.js`）にあり、エラー時の挙動が三者三様。ページング処理を直すときは全部直す必要がある。
- **`escapeHtml`の実装が場所によって違う**: サーバー側（`lib/mailer.js`・`api/square-webhook.js`）は`& < > " '`の5文字、クライアント側の多くは`& < >`の3文字のみ。`js/render.js`は`js/data.js`の値をエスケープせずHTML属性に埋めている（データは自分たちで書いているので今は問題にならない）。
- **`supabase/schema_v5_admin.sql`が丸ごと未使用**: `profiles.is_admin`はどのJSからも参照されていない（合言葉方式に移行したため）。
- **古いスキーマファイルのコメントが実態と違う**: `schema_v8_entry_code.sql`のカラムコメントは`DCT-購入日-ランダム4文字`という廃止済みの形式を説明したまま（v10で変更）。`schema_v2_cart.sql`の`items`のコメントはsnake_caseだが実際に保存されるのはcamelCase。
- **`js/auth.js`の単品購入ボタン経由の処理が到達不能**: `wireTicketButtons`/`recordPurchase`/`dct_pending_ticket`は、チケットに`catalogObjectId`が無いときだけ出るボタン用。今は両方のチケットに設定済みなので動かない。`catalogObjectId`を外せば復活するフォールバックなので残してある。

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
├── admin-announcements.html    お知らせ投稿ページ（/console、合言葉方式）
├── checkin.html                当日スタッフ向け入場確認ページ（/checkin、admin-announcementsと同じ合言葉方式）
├── tokutei-shotorihiki.html    特定商取引法に基づく表記
├── community-creator.html      コミュニティ（クリエイター向け）ページ
├── community-exhibitor.html    コミュニティ（出展者向け）ページ
├── css/style.css               全体スタイル（:root にトークン集約）
├── js/
│   ├── data.js                 サイトのコンテンツデータ（記事・ギャラリー等）
│   ├── render.js                data.js を HTML に展開する描画ロジック
│   ├── auth.js                  Supabase Auth（会員登録/ログイン/ログアウト/パスワード再設定/確認メール再送、ログイン再開。Googleサインインは実装済みだがGOOGLE_LOGIN_ENABLED=falseで非表示）＋
│   │                             ヘッダーのマイページアイコン・マイページドロワー（購入履歴＋ログアウト）
│   ├── auth-config.js            Supabase の url / anonKey を入れる設定ファイル（設定済み）
│   ├── notifications.js          ヘッダーの通知ベルアイコン。ドロワーで「あなたへのお知らせ」／
│   │                             「ドレスコードからのお知らせ」をタブ分け表示
│   └── cart.js                   カート機能（localStorage）→ /api/checkout 呼び出し
├── api/
│   ├── checkout.js               POST /api/checkout（Vercel Function）: カート内容を受け取り Square Payment Link を発行
│   ├── square-webhook.js         POST /api/square-webhook（Vercel Function）: Square の決済完了通知を検証して purchases.status を更新
│   ├── contact.js                 POST /api/contact: サイト内蔵お問い合わせフォームの送信先。inquiriesへ保存＋運営通知＋自動受付メール
│   ├── admin-login.js             POST /api/admin-login: /console 共通パスワードを検証しトークン発行
│   ├── admin-announcements.js    GET/POST/DELETE /api/admin-announcements: お知らせ投稿・削除（全員/個人宛て/チケット購入者宛て、投稿時にメールも送信）
│   ├── admin-inquiries.js         GET/POST /api/admin-inquiries: /console のお問い合わせ一覧・返信（返信はinfo@から送信しinquiries.statusを更新）
│   ├── admin-preview-email.js     POST /api/admin-preview-email: /console のブロックエディタのライブプレビュー用（送信は行わない）
│   ├── admin-upload-image.js      POST /api/admin-upload-image: /console の画像ブロック用、Supabase Storageへアップロード
│   ├── admin-checkin.js           GET/POST /api/admin-checkin: /checkin から呼ぶ。受付コードを照合し未チェックインならchecked_in_atを記録（GETは一覧、POST undo で取り消し）
│   ├── check-email.js             POST /api/check-email: 新規登録フォームで、そのメールアドレスが既に会員登録済みかだけを返す
│   └── env-check.js               GET /api/env-check: 環境変数が設定されているか（値は返さず真偽値のみ）を確認する診断用
├── lib/
│   ├── mailer.js                 Resend経由のメール送信の共通処理（購入通知・お知らせ配信・お問い合わせ対応で共用）。ブロック配列→HTML/テキスト変換、送信元アドレスの差し替えにも対応
│   └── adminAuth.js              /console・/checkin 共通の管理者トークン発行・検証（timingSafeEqual使用）
├── supabase/
│   ├── schema.sql                 profiles / purchases テーブルの初期スキーマ
│   ├── schema_v2_cart.sql         purchases にカート対応カラム（square_order_id 等）を追加
│   ├── schema_v3_notifications.sql  notifications テーブル（本人だけに届くお知らせ、Webhookのみinsert可）
│   ├── schema_v4_announcements.sql  announcements テーブル（会員全員向けのお知らせ）
│   ├── schema_v5_admin.sql          profiles.is_admin カラム＋本人が自分では変更できないようにするガード（現在は未使用。合言葉方式に変更したため）
│   ├── schema_v6_inquiries.sql      inquiries テーブル（サイトのお問い合わせフォームの内容・返信記録）
│   ├── schema_v7_notification_html.sql  notifications/announcements に body_html カラムを追加（画像付きお知らせをサイト内でも正しく表示するため）
│   ├── schema_v8_entry_code.sql   purchases に entry_code カラムを追加（当日の入場確認用コード。実行済み）
│   ├── schema_v9_checkin.sql      purchases に checked_in_at カラムを追加（当日のQR/手入力チェックイン記録。実行済み）
│   ├── schema_v10_event_sequence.sql  entry_code_counters テーブル＋next_entry_seq()関数を追加（イベント識別番号×カテゴリごとの連番発行。実行済み）
│   └── schema_v11_notifications_update_guard.sql  notificationsの更新をread列だけに制限（with check＋トリガー。★未実行★Supabaseで実行が必要）
├── scripts/
│   └── simulate-payment-webhook.js  実決済せずに決済完了後の一連の流れを試すローカル用スクリプト（署名鍵を使って正規の署名を作り、本番のWebhookを叩く）
├── assets/images/                 画像
├── vercel.json                    セキュリティヘッダー設定
├── .env.example                   環境変数テンプレート（実値は Vercel の環境変数に設定する想定）
├── DRESS CODE TOKYO.html          元の22MBバンドル（バックアップ、gitignore対象・デプロイ不要）
└── 方針/ 事業/ 案件/ 素材/          運営資料（すべてgitignore対象・ローカルのみ。詳細はCLAUDE.md参照。
                                   「素材」は旧フォルダ名「添付資料」からリネーム）
```

# 使用技術・外部サービス

- フロントエンド: 素の HTML/CSS/JS。ビルドステップなし。フォントは Google Fonts を `<link>` で読み込み（Cormorant Garamond / Jost / Zen Kaku Gothic New / Zen Old Mincho）。
- 認証: Supabase Auth（メール/パスワード + Google OAuth）。プロジェクト作成済み（`dresscode-tokyo`, Tokyo region, Free）。`js/auth-config.js` に Project URL / Publishable Key を設定済み（2026-07-24、ローカルサーバーでログインモーダルが「準備中」ではなく実フォームで表示されることを確認済み）。Vercel環境変数（`SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`）も設定・Redeploy済み。Secret Keyはローテーション済み・Vercel側も更新済み。Google OAuthプロバイダ（Client ID/Secret）は未設定のため、`js/auth.js`の`GOOGLE_LOGIN_ENABLED = false`でGoogleログインボタン自体を非表示にしている（再開するときはtrueに戻すだけでよい）。
- 決済: Square API（Create Payment Link、Orders APIのline_items経由）。**2026-08-01にProductionへ切り替え済み**（Vercel環境変数`SQUARE_ACCESS_TOKEN`/`SQUARE_LOCATION_ID`/`SQUARE_APPLICATION_ID`/`SQUARE_WEBHOOK_SIGNATURE_KEY`/`SQUARE_ENVIRONMENT=production`、Production側の商品登録・Webhook Subscription作成、`js/data.js`の`catalogObjectId`もProduction用IDに差し替え済み）。`SQUARE_WEBHOOK_URL`はSandbox/Production共通で変更不要。実際の少額決済でのエンドツーエンド確認はまだ（詳細は「未完了の作業」参照）。
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
  - ローカルサーバー（`python3 -m http.server`）でログインモーダルを開き、「準備中」ではなく実際のログイン/新規登録フォームが表示されることを確認済み（当時はGoogleサインインボタンも表示していたが、後に`GOOGLE_LOGIN_ENABLED = false`で非表示にした）
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

Supabase接続・ヘッダーのマイページ/通知UI刷新・お知らせ投稿ページ（合言葉方式、`/console`、全員/個人/チケット購入者宛て送信対応、Notion風ブロックエディタ）・Resendメール通知（テキスト＋HTML）・サイト内蔵お問い合わせフォーム（DB保存＋console返信、info@からの自動受付メール）まで完了。**2026-07-30、お問い合わせ機能一式を本番で実地確認済み**（`schema_v6_inquiries.sql`実行・`CONTACT_TO_EMAIL`設定・Redeploy後、フォーム送信→自動受付メール→管理者通知メール→Supabase保存→`/console`表示→console返信→返信メール受信、の一連の流れをユーザー自身がテストし、全て正常動作を確認）。Google OAuthはユーザーの意向で一旦後回し。

**（2026-08-01・コミット`de05648`でpush済み・本番デプロイ確認済み）Square Sandboxテストを開始**:
- ユーザーがSquare Sandboxで商品登録し、Item Variation ID を取得（Item IDではなくVariation IDを使う。理由: Orders APIの`line_items.catalog_object_id`はバリエーション単位を指す仕様のため）。
  - 1日入場チケット: `YFNRXOVTBA3L2NVJCHQXHJDB` → [`js/data.js`](../js/data.js) `ticketsC[0].catalogObjectId` に設定済み
  - 出店料: `J5FMYZYMXHOIGS3VXE6V6AUO` → [`js/data.js`](../js/data.js) `ticketsB[0].catalogObjectId` に設定済み
- **バグ修正**: [`api/checkout.js`](../api/checkout.js) の `SQUARE_API_BASE` が常に本番ホスト（`connect.squareup.com`）固定になっており、`.env.example`にある`SQUARE_ENVIRONMENT`もどこからも参照されていなかった。SquareはSandbox/Productionでホストが別（Sandbox: `connect.squareupsandbox.com`）なので、このままだとSandboxトークンで本番ホストに投げて401になっていたはず。`SQUARE_ENVIRONMENT === 'production'` のときだけ本番ホスト、それ以外はSandboxホストを使うよう修正。
- ユーザーがVercel環境変数（`SQUARE_ACCESS_TOKEN`/`SQUARE_LOCATION_ID`/`SQUARE_WEBHOOK_URL`/`SQUARE_WEBHOOK_SIGNATURE_KEY`/`SQUARE_APPLICATION_ID`/`SQUARE_ENVIRONMENT`）を設定済み（本人確認、スクリーンショットあり）。
- 上記2つのコード変更（`js/data.js`・`api/checkout.js`）はコミット・push済み（`de05648`）。Vercelへ自動デプロイ後、ユーザーが実機でカート追加→Sandboxチェックアウト→テスト決済まで実施し、Squareのテストパネルで「注文更新済み／支払い更新済み（webhookトリガー成功）」を確認。
- **（発見・修正済み）webhook重複による二重通知**: 上記の実地テストで、通知ドロワーに同じ「ご購入ありがとうございます」が2件（メールは1件のみ受信）現れた。原因はSquareのwebhook仕様上、こちらの応答（署名検証→Supabase更新→admin.getUserById→Resend送信、と処理が重い）が遅れるとSquareが同じイベントを再送してくること。[`docs/PROJECT_STATE.md`](#既知の問題不具合)に書いていた既知の懸念が実際に発生した形。[`api/square-webhook.js`](../api/square-webhook.js)の`notifyPurchaser`に、同じ`purchase_id`+`title`の通知が既にあればinsert・メール送信ともスキップする重複排除を追加（コミット`1c5d9ba`でpush済み）。**修正後にもう一度決済し直し、通知が1件になったことをユーザーが確認済み**（2026-08-01）。
- **（2026-08-01・コミット`f05bfff`でpush済み）チケットカードのUI/文言整理**:
  - `catalogObjectId`設定済み（＝カート決済対応済み）の商品は、単品リンク（「今すぐ支払う」「出店を申し込む」）や「準備中」表示を出さず「カートに追加」のみにするよう[`js/render.js`](../js/render.js)を変更。理由: カート決済がSandboxで動作確認できたため、旧経路のボタンが並ぶと分かりにくいだけになった。
  - [`js/data.js`](../js/data.js) `ticketsB[0]`（出店料）の`detail`を再構成: 1日入場チケット（`ticketsC[0]`）と重複していた会場・日時等の内容を揃え、出店固有の情報は「出店者注意点」として1つにまとめて強調表示。
  - 出店申し込みの流れを「Googleフォーム提出→お支払い」から**「カートでお支払い→お支払い確認後にGoogleフォームをお送りして詳細入力してもらう」**（支払い先行）に変更。ユーザーの意向（決済を先に済ませてから出店内容を確認する運用にしたい）による。
  - 出店料カードのnote欄に「※必ず詳細をご確認のうえお申し込みください」を追加。
  - **未実装**: 「お支払い確認後にGoogleフォームを送る」部分は現状まだ手動（Webhookで自動送信する仕組みは無い）。運営側が`purchases`テーブルや通知を見て都度Googleフォームのリンクを送る運用を想定。自動化するかは今後の相談。
- ~~**（要注意）本番ドメインでSquare Sandboxが露出している**~~ **→ 2026-08-01に本番切り替え完了により解消済み**（`SQUARE_ENVIRONMENT=production`＋Production用のcatalogObjectIdに変更済み。当時の記録: `dress-code-tokyo.com`は公開済みなのに`SQUARE_ACCESS_TOKEN`等がSandbox設定のままで、レジに進むとSquareの「APIサンドボックステストパネル」が表示されてしまう状態だった）。
- **（2026-08-01・コミット`a742450`でpush済み・本番デプロイ確認済み）チケットカードのUI追加調整**:
  - 出店料カードの`caution`（注意書き）を`note`から独立させ、赤字太字で目立つように変更（[`css/style.css`](../css/style.css)の`.tcard__caution`、[`js/data.js`](../js/data.js)の新フィールド`caution`、[`js/render.js`](../js/render.js)）。
  - チケットカードの「詳細・お問い合わせ」文言で「Instagramのみ」だった案内に、「ホームページ下部のお問い合わせフォームからでも承っております」を追記（出店料・1日入場チケット両方）。理由: 問い合わせ先がInstagramしか書かれていない箇所が複数あり、ユーザーが「信用が無さそうに見える」と懸念したため。
  - チケットカードの写真プレースホルダー（`.tcard__ph`、写真未設定時に出ていた大きな頭文字アイコンの灰色ボックス）を廃止。写真が無い商品は`.tcard__media`ごと出さず、カードを文字だけにするよう[`js/render.js`](../js/render.js)を変更（該当CSSも削除）。
  - **新規ページ [`tokutei-shotorihiki.html`](../tokutei-shotorihiki.html)（特定商取引法に基づく表記）を追加**、その後の会話で必須項目を記入済み（詳細は上記「特定商取引法に基づく表記は必須項目を記入済み」の項目を参照）。
- **（2026-08-01・コミット`c544ce0`でpush済み・本番デプロイ確認済み）出店フローの文言簡略化＋トップナビの導線バグ修正**:
  - [`js/data.js`](../js/data.js) `ticketsB[0].detail`の「出店者注意点」を書き直し。背景: 今回のチケットはDM等で事前に出店内容を確認してから購入してもらう流れが多い想定のため、「お支払い確認後、出店内容の確認が取れていない業者様に限りフォームをお送りします」という条件付きの案内に変更し、「当アカウントのフォロー・リツイート等にご協力ください」の一文は削除。あわせて矢印(→)の前で`\n`改行を入れ、詰まって読みにくかった1行の長文を複数行に分けた。
  - **（バグ修正）`/console`や特商法ページなどトップページ以外にいるとき、ヘッダーの上部ナビ（Top/About/DRESS CODE MARKET等）を押しても何も起きなかった問題**: [`js/render.js`](../js/render.js)のナビ描画が、`js/data.js`の`nav`配列の`href`（`#event`等、トップページ内のセクションIDが前提）をどのページでもそのまま使っていたため。トップページ以外で開いているときは、同じページ内に存在しないアンカーを探しにいくだけで無反応だった。`location.pathname`でトップページかどうか判定し、トップページ以外では`index.html#event`のように付け直すよう修正（`navHref()`ヘルパーを追加、nav-desktop/nav-mobile/footer-sitemapの3箇所に適用）。
- **（2026-08-01・コミット`1dbe928`でpush済み・本番デプロイ確認済み）「決済未完了者」向け一斉送信タブを追加**:
  - 背景: マイページの購入履歴に「手続き中」（`purchases.status='initiated'`のまま、決済ページまで進んだが支払いを完了していない）状態が残ることがあり、ユーザー本人が気づいていない可能性があるため、運営から一声かけられるようにしたいという要望。
  - [`api/admin-announcements.js`](../api/admin-announcements.js)に`collectPendingUserIds()`を追加（`purchases.status='initiated'`のuser_idを重複排除して集計）。POSTボディに`targetPending: true`が来た場合、対象者の`notifications`にinsert＋1人ずつメール送信（既存の「チケット購入者宛て」セグメント送信と同じパターン）。GETレスポンスに`pendingCount`（該当人数）を追加。
  - [`admin-announcements.html`](../admin-announcements.html)の宛先タブに「手続き中の人に送る」を追加（4つ目のタブ）。選択すると対象人数を表示するだけで、個別選択は不要（チケット単位の絞り込みはしていない＝ステータスが`initiated`の人全員が対象）。
  - **未確認（要実地テスト）**: 実際にSandboxで「手続き中」状態を作ってから、このタブで送信→対象者に通知・メールが届くかの実地テストはまだ。「次に行うこと」にも記載。
- **（2026-08-01・コミット`1dbe928`でpush済み・本番デプロイ確認済み）チケット名に日程を追加**:
  - [`js/data.js`](../js/data.js)の`ticketsB[0].name`を「出店料（1ブース・2026.9.27）」、`ticketsC[0].name`を「1日入場チケット（2026.9.27）」に変更。理由: ユーザーから「販売中のチケット名を見ただけでいつの開催分か分かるようにしたい」との要望。`name`は`purchases.ticket_name`としてそのまま保存されるため、マイページの購入履歴・購入完了/キャンセル通知・メール本文にも自動的に日付入りで反映される（コード変更は`js/data.js`のみで済んだ）。
- **（2026-08-01・コミット`b3f5f5c`でpush済み）PayPay表記の修正＋consoleに購入者一覧を追加**:
  - **PayPay表記の修正**: ユーザーが実際に本番決済ページ（Square Checkout）を開いたところGoogle Payは出るがPayPayは選べないことに気づき確認依頼。SquareのオンラインPayment Link/Checkoutはクレジットカード・Apple Pay・Google Payのみでオンライン決済としてのPayPay対応は無い（このAIの一般知識ベースの回答、Square公式の最新状況は都度要確認）。ユーザーの意向（「あとで導入するかもしれないので現状維持のまま正確に表示」）を踏まえ、[`js/data.js`](../js/data.js)の出店料カードnoteと[`tokutei-shotorihiki.html`](../tokutei-shotorihiki.html)の支払い方法欄を「クレジットカード（Square）のみ、現金・PayPay・口座振込は現在非対応」に修正。**未対応（コードでは直せない）**: 出店者向けフライヤー画像（`assets/images/market-flyer.jpg`）自体にPayPay等のアイコンが焼き込まれており、画像なので今回は手を付けていない。気になる場合は画像を作り直す必要がある。
  - **`/console`に「購入者一覧」セクションを追加**: チケットごとにトグル（開閉）でメールアドレス・購入日を一覧表示。人数が増えても圧迫しないように、他のトグル型セクション（お問い合わせ等）と同じ`.admin-toggle`パターンを流用。[`api/admin-announcements.js`](../api/admin-announcements.js)の`collectSegments()`に購入日(`purchasedAt`)を持たせ、新設の`resolveEmails()`でuser_id→メールアドレスをまとめて解決するように変更。対象は`status='paid'`の購入のみ（決済ページを開いただけの「手続き中」は含まれない）。
  - **確認済み事実（ユーザーからの質問に回答）**: 「カートに追加→レジに進む」だけでは`purchases`に`status:'initiated'`の行ができるだけで、購入者タグ（セグメント）にもメール送信にも影響しない。セグメント集計・購入完了メールともに`status='paid'`（＝Webhookが実際の決済完了を確認した後）にしか反応しないため、支払わずにテストしても誤タグ・誤送信の心配はないことをコードを読んで確認・回答した。
- **（2026-08-01・コミット`6fc011c`でpush済み）当日入場確認用の受付コード＋「手続き未完了」名簿を追加**:
  - 背景: ユーザーから「入場・識別に使える、当てずっぽうでは当たらない番号を購入者に振りたい。口頭で伝える想定なので大文字小文字の区別が無いのがいい」との要望。
  - **[`supabase/schema_v8_entry_code.sql`](../supabase/schema_v8_entry_code.sql)（実行済み）**: `purchases.entry_code`カラム（テキスト）＋一意インデックスを追加。**このマイグレーションを実行するまでは、以下のコードはエラーになるかentry_codeが常にnullになる**。
  - [`api/square-webhook.js`](../api/square-webhook.js): 支払いが`paid`に確定した最初の1回だけコードを発行して`entry_code`に保存。ユニーク制約に衝突したら別の値で最大5回まで再試行。Webhookの再送（既存の重複排除ロジック）が来ても、既にentry_codeがあれば再発行しない。購入完了メール・サイト内通知の本文にも「当日の受付コードは「○○」です」を追記。
    - **（2026-08-02更新）コード形式を変更**: 最初は6桁の数字のみだったが、ユーザーが他サービスの`TFM-20260802-A1B2`のような見た目の例を見て「そっちの方がやりやすい」と方針転換。`DCT-購入日(YYYYMMDD)-ランダム4文字`形式（例: `DCT-20260802-7K4M`）に変更。ランダム部分は見間違い・聞き間違いしやすい文字（`0/O`、`1/I/L`、`U/V`等）を除いた29文字のセットから選ぶ（同日内で約70万通り）。
  - 表示側: [`js/auth.js`](../js/auth.js)のヘッダーマイページドロワー、[`members-only.html`](../members-only.html)のフルページ版、両方の購入履歴に受付コードを表示するよう`select`にフィールド追加。
  - [`api/admin-announcements.js`](../api/admin-announcements.js): `collectSegments()`にstatus引数を追加して`'paid'`／`'initiated'`の両方に使えるようにし、`entry_code`も持たせた。GETレスポンスに`pendingSegments`（チケット単位の「手続き未完了」名簿、メール・購入試行日を含む）を追加。
  - [`admin-announcements.html`](../admin-announcements.html): 「購入者一覧」セクションを「支払い済み（受付コード付き）」と「手続き未完了」の2グループ表示に変更。
  - **次にやること**: Supabase SQL Editorで`schema_v8_entry_code.sql`を実行 → 動作確認（実際に支払い完了させてentry_codeが発行されるか、メール・マイページ・console双方に表示されるか）。
- **（2026-08-01・コミット`3cee7e3`でpush済み）「カートに追加」時点でログインを必須化**:
  - 背景: ユーザーから「未ログインの人でもチケットが買えるようになっている、購入を押したら強制的にログインさせたい。今後追加する商品にも全部適用したい」との指摘。調査した結果、`api/checkout.js`（サーバー側）と`js/cart.js`の`startCheckout()`（「レジに進む」を押した時点）では既にログイン必須だったが、**「カートに追加」ボタンだけは未ログインでも押せる**状態だった（カートに貯まるだけで実際の決済には進めないが、ユーザーの目には「ログイン無しで買えそう」に見えていた）。
  - [`js/cart.js`](../js/cart.js)の「カートに追加」クリックハンドラに、未ログインならその場でログイン/新規登録モーダルを開いてカートには入れない処理を追加（`sessionStorage`に商品情報を一時保存し、ログイン完了後に自動でカートへ追加する`PENDING_CART_ADD_KEY`の仕組み。既存の「レジに進むを保留してログイン後に再開する」処理と同じパターン）。
  - この処理は`catalogObjectId`を持つボタン全般（`.tcard__cart-add`）に共通でかかるため、**今後`js/data.js`に新しいチケットを追加してもコード変更なしで同じログイン必須の挙動になる**（ユーザーの「全てに今後も適用で」という要望を満たす）。
- **（2026-08-02・未コミット→ユーザー承認後push予定）consoleの各カードを1件ずつ開閉できるように、購入者一覧に検索を追加**:
  - 背景: ユーザーから「お問い合わせ・投稿済み一覧・個人宛て履歴のカードが常に全部展開されていて、増えるとスクロールが大変。1件ずつクリックで開閉したい」「購入者一覧をチケットごとに割り振った受付コードでも検索したい」との要望。
  - [`admin-announcements.html`](../admin-announcements.html)の`renderInquiries()`・`renderList()`が出力するカードを、`<div>`から`<details class="admin-item">`に変更。ヘッダー行（お名前/タイトル＋日付、お問い合わせは対応状況バッジも）だけが`<summary>`になり、本文・返信フォーム・削除ボタン等はクリックして開くまで非表示。既存の`.admin-toggle`（セクション単位の開閉）とは別に`.admin-item`という1件単位の開閉用クラスを新設（[`css/style.css`](../css/style.css)）。
  - 「購入者一覧」セクションに検索ボックスを追加。メールアドレス・受付コード（`entry_code`）の両方で絞り込める。検索中はヒットしたチケットのトグルを自動で開く（`renderPurchasers()`/`segmentGroupHtml()`に`forceOpen`引数を追加）。当日の入場確認で「このコードの人を探す」という使い方を想定。
- **（2026-08-02・コミット`3589529`でpush済み）購入時に運営（自分）宛てにも通知メールを送るように追加**:
  - 背景: ユーザーから「購入されたらこっちが登録しているメアドの方にもメールが来るようになっているか確認して、お問い合わせと同じメアドで問題ない」との確認依頼。調査した結果、`api/square-webhook.js`は購入者本人へのメールは送っていたが、**運営（自分）宛ての通知は存在していなかった**。
  - [`api/square-webhook.js`](../api/square-webhook.js)に`notifyAdmin()`を追加。購入者への通知メール送信後、`CONTACT_TO_EMAIL`（未設定なら`NOTIFY_FROM_EMAIL`。お問い合わせフォーム通知と同じ宛先ロジック）宛てに「【購入通知】」または「【キャンセル通知】」の件名で、チケット名・購入者メールアドレス・（支払い完了時のみ）受付コードを送る。宛先が未設定でもエラーにはせず静かにスキップする。
- **（2026-08-02・未コミット→ユーザー承認後push予定）決済完了直後の「ご購入ありがとうございました」画面を追加**:
  - 背景: ユーザーが以前使っていた別サービス（TFM）の決済完了画面のスクリーンショットを見せて「こういう感じで、戻ってきた直後にその場でコードが見られるようにしたい」と依頼。また会話の中で、[`member.html`](../member.html)（運営メンバー紹介ページ）と[`members-only.html`](../members-only.html)（会員個人のマイページ本体）を混同していたことが判明 — ヘッダーの「マイページ」ボタンはドロワーで簡易表示するだけなので、フルページ版の`members-only.html`を意識する機会がほとんど無かったのが原因。
  - [`api/checkout.js`](../api/checkout.js): Squareの`redirect_url`を`/members-only.html?thanks=1`に変更（決済ページから戻ってきたことの合図）。
  - [`members-only.html`](../members-only.html): `?thanks=1`があるときだけ「ご購入ありがとうございました」バナーを表示。Webhookの到達に多少タイムラグがあるため、直後は「お支払いの確認中です」と表示し、2秒おき最大8回（16秒）まで本人の最新の購入行を確認、`status='paid'`になった時点でチケット名・金額・受付コード（`entry_code`）を表示する。タイムアウトした場合は「購入したチケット」欄かメールを見るよう案内。表示後はURLから`?thanks=1`を消す（`history.replaceState`）ので、リロードでは再表示されない。
  - **未確認**: 実際にSquareの決済を完了させて、このバナー→受付コード表示までの流れをまだ実地確認していない。次にテストするタスク。
- **（2026-08-02・未コミット→ユーザー承認後push予定）members-only.htmlで「ログインが必要です」が誤表示される競合状態を修正**:
  - 背景: 上記の`?thanks=1`対応をテストする過程で、ログイン中のはずなのに`members-only.html`が「ログインが必要です」（ゲスト状態）を表示するとユーザーから報告。
  - 原因: [`js/auth.js`](../js/auth.js)のログイン状態確認（`client.auth.getSession()`）は非同期で、従来は`init()`（DOMContentLoaded後）の中で呼んでいた。一方`members-only.html`は`window.addEventListener('load', ...)`（画像等の読み込み完了後）のタイミングで`DCT_AUTH.getSession()`を読んでいたが、`getSession()`はローカルの確認だけで完了するため`load`イベントより先に確定→`notify()`が呼ばれてしまい、その時点ではまだ`members-only.html`側の`onChange`リスナーが登録されていない、というタイミングのズレが起きていた（一度きりの`notify()`を取りこぼすと、次にログイン状態が変わるまで誤ったまま）。
  - [`js/auth.js`](../js/auth.js): ログイン状態確認の`Promise`（`sessionReady`）をスクリプト読み込み時点（`init()`を待たず）で開始するように変更し、`DCT_AUTH.ready(fn)`という新しいAPIを追加（確認が終わってから`fn`を呼ぶ）。`init()`内部もこの`sessionReady`を再利用するよう統一。
  - [`members-only.html`](../members-only.html): `window.addEventListener('load', ...)` + `DCT_AUTH.getSession()`直読みを、`DCT_AUTH.ready(fn)`に置き換え。
  - **未確認**: この修正で実際に直ったかどうかは、もう一度Squareの決済を通してテストするまで確定していない。また、この不具合が本当に「決済ページから戻ってきた直後」特有のものか、単に直接URLを開いて未ログイン状態で見ていただけなのかは、ユーザーへの再現手順の確認待ち。
- **（2026-08-02・未コミット→ユーザー承認後push予定）当日の入場確認をQRコード対応にする一式を追加**:
  - 背景: ユーザーが以前使っていた別サービス（TFM）と同様に、受付コードをQR化してスタッフが読み取れるようにしたいという要望。実装にあたり「npm依存を増やしたくない」という懸念が出たため、**追加ライブラリ0個**で実現する方針にした（QR生成は外部の無料サービス`api.qrserver.com`の画像URLを直接`<img>`で使う。読み取りはAndroid/Chromeがブラウザ標準搭載の`BarcodeDetector`機能を使い、対応していないSafari/iPhoneは既存の手入力検索にフォールバックする）。
  - **[`supabase/schema_v9_checkin.sql`](../supabase/schema_v9_checkin.sql)（実行済み）**: `purchases.checked_in_at`カラムを追加。実行するまで`/checkin`は動かない。
  - **[`api/admin-checkin.js`](../api/admin-checkin.js)（新規）**: POST。`/console`と同じ合言葉トークン（`verifyAdminToken`）で認証。受付コードで`purchases`を検索（`status='paid'`のみ対象）→未チェックインならその場で`checked_in_at`を記録して購入者情報を返す→チェックイン済みなら「入場済みです（最初の入場時刻）」を返す→見つからなければ404。
  - **[`checkin.html`](../checkin.html)（新規、`/checkin`でアクセス）**: `/console`と同じ合言葉ログイン画面（トークンは同じ`sessionStorage`キー`dct_admin_token`を共有）。カメラでのQR読み取り（`BarcodeDetector`対応ブラウザのみ、非対応時は案内文を表示）と、手入力フォームの両方に対応。結果は「入場OK／入場済みです／無効なコード」の3状態で大きく表示し、直近の読み取り履歴も一覧表示する。[`vercel.json`](../vercel.json)に`/checkin`→`/checkin.html`のrewriteを追加。`Permissions-Policy`ヘッダーが`camera=()`（全面禁止）になっていたため`camera=(self)`に変更（変更しないとカメラが起動できない）。主要ナビ・フッターにはリンクを置かず、`/console`と同様URLを直接知っている人だけが使う想定。
  - **QRコードの表示側（購入者が見る側）を追加**: 受付コードが表示される4箇所（決済直後のありがとうございました画面・購入完了メール・ヘッダーのマイページドロワー・`members-only.html`の購入履歴）すべてに、コードのテキストと並べてQR画像（`https://api.qrserver.com/v1/create-qr-code/?data=...`）を表示するようにした（[`members-only.html`](../members-only.html)、[`js/auth.js`](../js/auth.js)、[`api/square-webhook.js`](../api/square-webhook.js)の`notifyPurchaser`。メールは`sendEmail`をblocks形式に切り替えて画像ブロックを追加）。
  - **未確認**: `schema_v9_checkin.sql`実行後、実際にQRを読み取って`/checkin`でチェックインできるか・二重チェックイン時に正しく「入場済みです」と出るか、まだ実地テストしていない。
- **（2026-08-02・未コミット→ユーザー承認後push予定）ヘッダー通知ドロワーにも受付コード/QRを表示、通知カードをトグル化**:
  - 背景: ユーザーからヘッダーの「お知らせ」ドロワーのスクリーンショットを見せられ、「購入者はこの画面からもコード・QRを見られるようにしてほしい」「1件ずつタップで開閉するトグルにして、メッセージが場所を取りすぎないようにしてほしい」との要望。
  - [`api/square-webhook.js`](../api/square-webhook.js): `notifications`テーブルへのinsertに`body_html`を追加。支払い完了（`paid`）かつ`entry_code`がある場合は、コードとQR画像を含むHTMLを生成して保存する（`escapeHtml`ヘルパーを新設）。これにより通知ベルのドロワー・`members-only.html`のお知らせ欄どちらでもQRが見えるようになる。**注意**: この`body_html`は今後発行される通知にのみ入る。過去の通知（このコミット以前に届いたもの）は遡って追加されない。
  - [`js/notifications.js`](../js/notifications.js): ヘッダー通知ドロワーの各カードを`<div>`から`<details>`に変更し、タイトル・日付だけの見出し行をタップすると本文（QR含む）が開く形にした。
  - [`members-only.html`](../members-only.html): 「お知らせ」セクションの`select`に`body_html`が漏れていて**常にプレーンテキストしか表示されない不具合**があったのを発見・修正。あわせて同様にトグル化。
  - 上記2箇所のトグルCSSはコンソール用に作った`.admin-item`系クラスをそのまま流用すると命名が紛らわしいため、`.toggle-item`にリネームして共通化（[`css/style.css`](../css/style.css)、[`admin-announcements.html`](../admin-announcements.html)側も追従）。
  - **未確認**: 実際に決済して、通知ドロワー・`members-only.html`の両方でQR付きの通知が正しく開閉表示されるか。
- **（2026-08-03・未コミット→ユーザー承認後push予定）受付コードをイベント識別番号ベースに変更、`/checkin`のチェックイン履歴を実データ化**:
  - **受付コードの形式変更**: `DCT-購入日-ランダム4文字`から`DCT-イベント識別番号-カテゴリ+連番`（例: `DCT-0927-S1`）に変更。詳細・運用ルールは上記「重要な仕様・決定事項」参照。[`supabase/schema_v10_event_sequence.sql`](../supabase/schema_v10_event_sequence.sql)（実行済み）で`entry_code_counters`テーブルと`next_entry_seq()`関数を追加。[`api/square-webhook.js`](../api/square-webhook.js)の`generateEntryCode`/`assignEntryCode`をこの関数を呼ぶ形に書き換え。[`.env.example`](../.env.example)に`CURRENT_EVENT_ID`を追加。
  - **`/checkin`のチェックイン履歴を実データ化**: 背景はユーザーから「読み取り履歴にトグルと検索が欲しい、消せるようにもしてほしい」との要望。今までは`checkin.html`内のJS変数だけに溜めていた（ページ再読み込みで消える、検索も削除もできない）簡易ログだったのを、[`api/admin-checkin.js`](../api/admin-checkin.js)にGET（チェックイン済み一覧取得）と`{undo:true, id}`での取り消し機能を追加し、実際に`purchases.checked_in_at`から読み書きする形に変更。[`checkin.html`](../checkin.html)側は「本日のチェックイン一覧」をトグル（`.admin-toggle`）＋検索ボックス＋各行に「取り消す」ボタン、という構成にした。チェックインするたびに一覧を自動で再読み込みする。
  - **未確認**: `schema_v10_event_sequence.sql`実行後、実際に決済してコードが`DCT-{CURRENT_EVENT_ID}-{S|N}{連番}`の形式で発行されるか、`/checkin`で検索・取り消しが動くか、まだ実地テストしていない。`CURRENT_EVENT_ID`もまだVercelに設定していない（未設定だと`'EVENT'`という既定値になる）。

# 未完了の作業（＝ユーザーが各サイトで行う作業）

- ~~Supabase — `schema_v8_entry_code.sql`実行~~ 2026-08-03実行済み
- ~~Supabase — `schema_v9_checkin.sql`実行~~ 2026-08-03実行済み
- ~~（ブロッカー）Supabase — `supabase/schema_v10_event_sequence.sql`をSQL Editorで実行する~~ **→ 2026-08-03実行済み**
- ~~（ブロッカー）Vercel環境変数 `CURRENT_EVENT_ID` を設定する~~ **→ 2026-08-03に`0927`を設定・Redeploy済み**。新しいイベントを開催するたびにこの値を変更すること（詳細は「重要な仕様・決定事項」参照）。
- **特定商取引法に基づく表記（[`tokutei-shotorihiki.html`](../tokutei-shotorihiki.html)）は必須項目を記入済み、公開判断待ち**:
  - ユーザーは個人事業主（屋号は無い）と確認。**販売事業者・運営統括責任者ともに本名「齋藤南」を記載**（2026-08-01）。「DRESS CODE TOKYO」は屋号ではないため事業者名としては使わない、とユーザーが判断。
  - メールアドレス: `info@dress-code-tokyo.com` 記入済み。
  - 所在地・電話番号: 個人事業主に認められている「ご請求があれば遅滞なく開示します」の書き方のまま伏せてある。
  - 支払い方法・引渡し時期・返品ポリシー等も記入済み。
  - **法律上必須の項目はこれで揃った**が、本名が検索エンジンに載る状態になるため、`<meta name="robots">`の`noindex`を外すかはユーザーに確認してから。正式公開前に一度、行政書士等の専門家に内容を確認してもらうことも推奨（このAIは法律専門家ではないため）。
- ~~Supabase — schema_v5実行~~ 実行済みだが**現在は未使用**（認証方式を合言葉に変更したため。上記「完了済みの作業」参照）
- **Google OAuth**（後回し中）: Google Cloud ConsoleでOAuth同意画面→OAuthクライアントID作成→Client ID/SecretをSupabaseのGoogleプロバイダ設定に登録。リダイレクトURIはSupabaseのGoogleプロバイダ設定画面に表示されるCallback URLを使う。ボタン自体はログインモーダルに表示済み（押しても今はエラーになる想定内の状態）。
- ~~Square Sandboxセットアップ~~ 2026-08-01完了（商品登録・Item Variation ID取得・`js/data.js`への設定・カート決済のSandbox実地テストまで完了。詳細は上記「Square Sandboxテストを開始」以降の各項目参照）。
- **Square本番切り替え（2026-08-01・コミット`9db9370`でpush済み）**: ユーザーが以下をすべて完了・確認済み。
  1. ~~Square Developer DashboardでProductionに切り替え~~ 完了
  2. ~~`SQUARE_ACCESS_TOKEN`・`SQUARE_LOCATION_ID`・`SQUARE_APPLICATION_ID`をProduction用の値に総入れ替え~~ Vercelで完了
  3. ~~商品（出店料・1日入場チケット）をProduction側のアイテムライブラリにも登録~~ 完了
  4. ~~`js/data.js`の`catalogObjectId`をProduction用IDに差し替え~~ 完了（出店料: `HHMIQQDFKFPB3BOK6VB2CGSQ` / 1日入場チケット: `NIZFJLDR6HEA7ML765JFBAS2`。Sandbox用ID(`YFNRXOVTBA3L2NVJCHQXHJDB`/`J5FMYZYMXHOIGS3VXE6V6AUO`)がリポジトリ内の他ファイルに残っていないかも確認済み、`docs/PROJECT_STATE.md`内の過去ログ以外に残存なし）
  5. ~~Production側でWebhook Subscription（`payment.updated`）を作成、`SQUARE_WEBHOOK_SIGNATURE_KEY`をVercelに設定~~ 完了。**`SQUARE_WEBHOOK_URL`はSandbox/Production共通で変更不要**（`https://dress-code-tokyo.com/api/square-webhook`のまま）とユーザーが確認済み
  6. ~~`SQUARE_ENVIRONMENT`を`production`に変更~~ Vercelで設定済み
  7. **【未実施・次にやること】少額の実カードで本人が1回テスト購入**し、課金→`purchases.status`が`paid`に更新→通知・メールが届く、まで確認（問題なければ返金/キャンセルしてOK）
  8. **【未実施】Sandboxテスト中にできた「手続き中」等のテスト用購入データを`purchases`テーブルから削除**（見た目の問題のみ、急ぎではない）
- **（本番公開前チェックリスト・必須・2026-08-03進行中）Supabase Authenticationの「Confirm email」を有効化する**:
  - [x] Resendのカスタムメールドメイン用APIキーを作り直し（旧キーの値を忘れてしまったため、Resend側で新規発行→Vercelの`RESEND_API_KEY`更新→再デプロイ→Supabase SMTP Passwordにも反映、の順で対応。旧キーは新キーでの送信確認後に削除済み）
  - [x] Supabase Dashboard → Authentication → Emails → SMTP SettingsでカスタムSMTP（Resend、`smtp.resend.com`:465、Username: `resend`固定）を設定・有効化（Enable custom SMTPがON）
  - [x] Supabase Dashboard → Authentication → Sign In / Providers → User Signupsで「Confirm email」をON、保存成功を確認
  - [ ] 新規登録時に確認メールが送信されることを確認 → **確認済み**（新しいメールアドレスで登録し、メール自体は届いた）
  - [ ] 確認メール内のリンクから認証できることを確認 → **未解決の問題あり**：リンクを開くと`localhost:3000/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`というエラーになった。**原因はおそらくSupabaseの Authentication → URL Configuration の「Site URL」が開発用の`localhost:3000`のままになっていること**（本番ドメイン`https://dress-code-tokyo.com`に直すよう案内済み、ユーザーが対応中）。直しても直らない場合は、Gmail等のリンク事前スキャンによってワンタイムトークンが本人のクリック前に消費されてしまう既知の問題も疑う。
  - [ ] 認証前はログインできず、認証後のみログインできることを確認（↑が直ってから）
  - [ ] メールアドレスを誤入力した場合にアカウントを利用できないことを確認
  - [ ] 実際のユーザー視点で新規登録フローを最後までテストする
  - **（2026-08-03・未コミット→ユーザー承認後push予定）「確認メールを再送する」機能を追加**: Confirm emailをONにしたことで、確認メールを見落とした／届かなかった人がログインしようとしてエラーになるケースが発生するはずなのに、再送する手段が無かった。[`js/auth.js`](../js/auth.js)のログインフォームに、Supabaseが「メール未確認」エラーを返したときだけ「確認メールを再送する」ボタンを出す処理を追加（`client.auth.resend({ type: 'signup', email })`を呼ぶ）。
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
- **受付コード（entry_code）は「イベント識別番号」ベース、新しいイベントのたびに`CURRENT_EVENT_ID`を変えること**（2026-08-03決定）: 形式は`DCT-{イベント識別番号}-{カテゴリ}{連番}`（例: `DCT-0927-S1`＝2026.9.27開催イベントの出店者1人目、`DCT-0927-N1`＝同イベントの来場者1人目）。
  - **イベント識別番号**（`0927`の部分）はVercel環境変数`CURRENT_EVENT_ID`で管理する。**MMDD形式**（同じ日に複数イベントを開催するときだけ`0927.01`のような枝番を足す）。**新しいイベントを開催するたびに、この値を新しいものに変更し、Redeployすること**（例: 次回が2026年12月1日開催なら`1201`）。値を変えると出店者(S)・来場者(N)の連番はどちらも自動的に1から再スタートする（`supabase/schema_v10_event_sequence.sql`の`entry_code_counters`テーブルが「イベントID×カテゴリ」ごとにカウンターを持っているため）。**同じイベント識別番号を使い続けている間は、番号は増え続ける**（出店が増えたらS2, S3…と自動的に増える）。
  - **カテゴリの判定はチケット名の文字列に依存**（`api/square-webhook.js`の`categoryFor()`）：チケット名に「出店」が含まれれば`S`、「入場」が含まれれば`N`、どちらでもなければ`X`。将来チケットの名前（`js/data.js`の`name`）を変える場合、この判定ロジックも見直すこと。
  - 環境変数の設定を忘れると`CURRENT_EVENT_ID`が未設定のまま`'EVENT'`という既定値が使われてしまうので、**イベントを開催する前に必ず`CURRENT_EVENT_ID`をVercelに設定/更新したか確認すること**。
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
- ~~画像アップロード用のSupabase Storageバケットが未作成~~ 2026-07-30に`announcement-images`（Public bucket）作成済み・完了。

# 変更時の注意点

- `js/data.js` を編集すればコンテンツ（記事・ギャラリー・メニュー・SNSリンク等）は反映される。`js/render.js` は描画ロジックなので基本触らない。
- カラー・余白・フォントは `css/style.css` の `:root` にトークン化されている。全体に影響するので変更範囲に注意。
- 秘密鍵・アクセストークンの類は `.env.example` 以外のファイルに書かない。実値は Vercel の環境変数にのみ設定する（`.env.example` 内のコメントに明記済み）。
- Sandbox用とProduction用のSquare認証情報を混ぜない（`.env.example` に警告コメントあり）。

# 既知の問題・不具合

- ~~Square Webhookが同じ決済結果を複数回送ってきた場合、`notifications` insertと確認メール送信が重複しうる~~ **（2026-08-01修正済み）**: Sandboxテストで実際に二重通知が発生したのを確認。`api/square-webhook.js`の`notifyPurchaser`に、同じ`purchase_id`+`title`の通知が既にあればinsert・メール送信ともスキップする重複排除を追加。
- issue管理の有無は未確認（GitHubのIssuesを使っているかは未調査）。

# 2026-07-30 の修正（モバイル不具合2件・console UX改善・Google連携の一時停止）

- **（修正済み）モバイルメニューでログインボタンが画面下に隠れる不具合**: `.mobile-menu.open`が`max-height: 85vh`固定＋`overflow:hidden`だったため、端末の画面が小さい／メニュー項目が多いと最後の「ログイン」ボタンが見切れて操作できなかった（ユーザーがスクリーンショット付きで報告）。`max-height: calc(100dvh - 70px)`＋`overflow-y: auto`に変更し、どの端末でも中身がヘッダー下の残り高さに収まらない場合は内部スクロールで必ず最後まで到達できるようにした（`css/style.css`の`.mobile-menu.open`）。
- **（修正済み）チケット周辺・EVENT REPORTのギャラリーでスマホの縦スクロールが効かない不具合**: `.carousel__track`（横スワイプのカルーセル、チケットカード・記事ギャラリー・Field Report写真で共用）に`touch-action: pan-x`を指定していたのが原因。これは「横方向のパンだけをブラウザに許可する」指定のため、このトラック上で指を置いた瞬間に縦スワイプの既定動作が丸ごと無効化され、ページ自体がスクロールできなくなっていた（コメントには「縦スクロールをページへ渡すため」と書かれていたが、実際の仕様は逆の効果だった＝過去の実装ミス）。`touch-action`指定を削除し既定値`auto`に戻すことで、ブラウザが指の動きの向きから横（カルーセル）／縦（ページ）を自動判定するようにした。
- **console（`/console`）のUX改善**（ユーザーからのフィードバック: 「増えてきたら使いづらくなる」への対応）:
  - 「お問い合わせ」「投稿済みのお知らせ（全員向け）」「個人宛てに送った履歴」の3セクションをNotionのトグルのような開閉式（`<details>`）に変更。お問い合わせは初期状態で開、履歴2つは初期状態で閉にして、ページ全体の縦の長さを抑えた。見出し横に件数バッジ（例:「(12)」）も追加。
  - 各セクションに検索ボックスを追加（お問い合わせ: お名前／メールアドレス／本文／カテゴリで検索、投稿済み一覧: タイトル／本文、個人宛て履歴: メールアドレス／タイトル／本文）。全件取得済みのデータをクライアント側でフィルタする方式（サーバーへの追加リクエストなし）。
  - ジャンプナビ（`#section-new`等へのリンク）をクリックしたときに、リンク先のトグルが閉じていれば自動で開いてからスクロールするようにした。
- **（保留）Googleログインをコードごと無効化**: ユーザーの意向でGoogleログインの実装を一旦保留することになったため、`js/auth.js`に`GOOGLE_LOGIN_ENABLED = false`というフラグを追加し、ログインモーダルからGoogleボタンと区切り線を非表示にした。メール/パスワードでのログイン・新規登録には一切影響しない。`signInWithGoogle()`や関連ロジックは削除せずそのまま残してあるので、再開する際は`GOOGLE_LOGIN_ENABLED`を`true`に戻すだけでよい。
- **（修正済み）通知に画像が表示されない不具合**: ユーザーから「個人宛てに送った履歴・サイトの通知ドロワーで画像が見れない（メールには届くのに）」と報告。原因は、`notifications`/`announcements`テーブルには`renderBlocks()`の**プレーンテキスト版**（`body`列）しか保存しておらず、画像ブロックはテキスト上`[画像: alt]`としてしか残らなかったため。メールは別途HTML版を都度生成して送っていたので画像が正しく表示されていた。対応として`body_html`列を追加し（[`supabase/schema_v7_notification_html.sql`](../supabase/schema_v7_notification_html.sql)、2026-07-31にユーザーが実行済み）、`api/admin-announcements.js`の3つのinsert（全員/個人/チケット購入者宛て）すべてで`renderBlocks().html`も一緒に保存するように変更。表示側（`js/notifications.js`のヘッダー通知ドロワー、`admin-announcements.html`のconsole履歴一覧）は`body_html`があればそれを、無ければ従来通り`body`（プレーンテキスト）にフォールバックする（`body_html`が null になるのは、このマイグレーション以前の過去のお知らせと、購入完了/キャンセル通知のようにブロックを使わない単純なテキスト通知）。
- **CONTACT_TO_EMAILを本番用アドレスに設定済み**（2026-07-30）: テスト用の自分のメアドから、実運用アドレス（`marrine.michan@gmail.com`）に切り替え済み。届いたテスト通知が迷惑メールフォルダに入っていただけで、コード・Supabaseとも問題なしと確認済み（2026-07-31）。
- **複数宛先対応**（2026-07-31）: `lib/mailer.js`の`sendEmail()`で、`to`にカンマ区切り文字列（例:`"a@x.com, b@y.com"`）を渡すと配列に変換してResendに渡すようにした。`CONTACT_TO_EMAIL`にテスト用・本番用のメアドを両方カンマ区切りで入れる、といった運用ができる。
- **モバイルのコンパクトヘッダーにログイン導線を追加**（2026-07-31）: これまでハンバーガーメニューを開かないと「ログイン」ボタンに到達できなかった（カート・お知らせアイコンは常時表示なのに、ログインだけ`.header__cta`が`max-width:1240px`で非表示になり、`.mobile-menu`内にしか出ていなかった）。カート・お知らせと同じ丸いアイコンボタン（`.header__cta-icon`、中身は人型アイコン）を追加し、コンパクトヘッダーでも常時ログイン/マイページに到達できるようにした（対象: `index.html`/`article.html`/`member.html`/`community-creator.html`/`community-exhibitor.html`の5ページ）。ログイン中は同じボタンがマイページアイコンとして機能する（`js/auth.js`の`paintAuthButtons()`が`.icon-btn`クラスかどうかで表示を出し分け）。
  - **実装上のハマりどころ**: `.header__cta-icon { display:none }` を単純なクラス指定だけで書くと、CSSファイル後方で定義されている`.icon-btn { display:flex }`（同じ詳細度）に負けて常に表示されてしまう。`.header__cta`の非表示ルールに既にあった同じ問題の回避策（`.header__inner`を付けて詳細度を上げる）を踏襲して解決した。

# 次に行うこと

**メール・お知らせ関連（完了済み）**
1. ~~`supabase/schema_v6_inquiries.sql` 実行・`CONTACT_TO_EMAIL`設定・Redeploy・お問い合わせ一連の動作確認~~ 2026-07-30完了
2. ~~`CONTACT_TO_EMAIL` を実運用で使うメアドに切り替える~~ 2026-07-30完了（`marrine.michan@gmail.com`）
3. ~~`announcement-images`バケット作成~~ 2026-07-30完了
4. ~~`supabase/schema_v7_notification_html.sql` をSupabase SQL Editorで実行~~ 2026-07-31完了

**Square（2026-08-01時点。SandboxからProductionへの切り替えは完了、実地の本番決済テストが残っている）**
5. ~~Sandboxアプリ作成・Access Token/Location ID/Webhook Subscription登録・Vercel環境変数6つ設定~~ 完了
6. ~~Sandboxで商品登録・Item Variation IDを`js/data.js`の`catalogObjectId`に設定~~ 完了
7. ~~`api/checkout.js`のSQUARE_API_BASEがSandboxで401になるバグ修正~~ 完了（`de05648`）
8. ~~カート追加→Sandboxチェックアウト→決済→webhook反映の一連のテスト~~ 成功済み（1日入場チケットで確認）
9. ~~webhook再送による通知重複バグの発見・修正~~ 完了（`1c5d9ba`）。修正後の再テストで通知1件になることも確認済み
10. ~~Square Production環境への切り替え~~ 完了（Access Token/Location ID/Application ID/Webhook Signature Key/`SQUARE_ENVIRONMENT=production`をVercelに設定、Production側の商品登録・Webhook Subscription作成、`js/data.js`の`catalogObjectId`をProduction用IDに差し替え、すべて`9db9370`）
11. ~~本番Checkoutページに実際に遷移できるかの一次確認~~ 完了（Google Pay等が表示される実際のSquare Checkout画面まで到達、401等のエラーなし）
12. **【未実施・重要】実カードでの少額決済テスト（1回）**: 1,000円の1日入場チケット等で実際に支払いを完了させ、`purchases.status`が`paid`に更新される→通知/メールが届く、まで確認。問題なければSquareダッシュボードから返金。**これが完了するまでは「Productionに切り替わっている」だけで「実際に決済〜通知まで動くこと」はまだ確認できていない**
13. **【未実施】出店料チケットでのカート決済テスト**（今まで確認できているのは1日入場チケットのみ）
14. **【未実施】「決済未完了者向け一斉送信」タブの実地テスト**（`purchases.status='initiated'`のまま止まる状態を作り、`/console`から送信→通知/メールが届くか確認）
15. **【未実施・急ぎではない】Sandboxテスト中にできた「手続き中」等のテスト購入データを`purchases`テーブルから削除**（見た目の問題のみ）

**保留中・後回し**
16. （保留中）Google OAuth — `js/auth.js`の`GOOGLE_LOGIN_ENABLED`を`true`に戻し、Cloud Console → OAuthクライアント作成 → SupabaseのGoogleプロバイダに登録
17. （公開判断待ち）[`tokutei-shotorihiki.html`](../tokutei-shotorihiki.html)の`noindex`を外すか（必須項目は記入済み、本名が検索に載る点をユーザーが判断。可能なら専門家レビューも推奨）
18. **【未着手・本番公開の必須条件】Supabase Authenticationの「Confirm email」を有効化**（上記「本番公開前チェックリスト」参照。先にResendをカスタムSMTPとして設定してから）

# 関連ファイル

- [README.md](../README.md) — 人間向け編集ガイド（プレビュー方法、記事追加、画像差し替え等）
- [CLAUDE.md](../CLAUDE.md) — 恒久ルール
- [js/data.js](../js/data.js) / [js/render.js](../js/render.js) — コンテンツと描画
- [js/auth.js](../js/auth.js) / [js/auth-config.js](../js/auth-config.js) — 認証・マイページドロワー
- [js/notifications.js](../js/notifications.js) — 通知ベル（あなたへのお知らせ／ドレスコードからのお知らせ）
- [admin-announcements.html](../admin-announcements.html)（`/console`） / [api/admin-announcements.js](../api/admin-announcements.js) / [api/admin-login.js](../api/admin-login.js) / [lib/adminAuth.js](../lib/adminAuth.js) — お知らせ投稿ページ（合言葉方式、全員宛て／個人宛て／チケット購入者宛て対応）
- [api/admin-inquiries.js](../api/admin-inquiries.js) / [api/contact.js](../api/contact.js) — サイト内蔵お問い合わせフォームの保存・console一覧・返信
- [api/env-check.js](../api/env-check.js) — 環境変数・デプロイ診断用エンドポイント（トラブル時に使う）
- [lib/mailer.js](../lib/mailer.js) — Resend送信の共通処理
- [js/cart.js](../js/cart.js) / [api/checkout.js](../api/checkout.js) / [api/square-webhook.js](../api/square-webhook.js) — 決済フロー＋購入通知（メール／サイト内通知）。SandboxとProductionでAPIホストが違う点に注意（`api/checkout.js`のコメント参照）
- [tokutei-shotorihiki.html](../tokutei-shotorihiki.html) — 特定商取引法に基づく表記（必須項目記入済み、公開判断待ち）
- [supabase/schema.sql](../supabase/schema.sql) 〜 [schema_v11_notifications_update_guard.sql](../supabase/schema_v11_notifications_update_guard.sql) — DBスキーマ（v1〜v4・v6〜v10は使用中、v5(`profiles.is_admin`)は合言葉方式に移行したため現在未使用、v11は未実行）
- [vercel.json](../vercel.json) — セキュリティヘッダー＋ `/console` のrewrite
- [.env.example](../.env.example) — 必要な環境変数一覧（実値はVercel側）
- `方針/` `事業/` `案件/` `素材/` — 運営資料（gitignore対象、ローカルのみ）

# 動作確認方法

- ローカルプレビュー: `index.html` をブラウザで直接開く、または `python3 -m http.server` で簡易サーバーを立てて確認（README記載）。
- Vercel Functions（`api/checkout.js` 等）を試す場合はローカルの簡易サーバーでは動かないため、Vercel CLI（`vercel dev`）または実デプロイでの確認が必要（未確認: このプロジェクトで Vercel CLI を使ったローカル実行が想定されているか）。
- 決済まわりは2026-08-01にSquare Production環境へ切り替え済み（`SQUARE_ENVIRONMENT=production`）。`.env.example`のsandbox表記はテンプレートの既定値であり、本番Vercelの設定とは別物。

2026-07-30 — お問い合わせ機能一式（DB保存・console返信・info@からの自動受付メール）を追加。あわせて全体の整理・点検を実施:
- **（修正）SEOメタデータが削除済みのVercelプロジェクトを指していた**: `index.html`ほか全ページのcanonical/og:url/構造化データ・`sitemap.xml`・`robots.txt`が`doress-code-tokyo-cip1.vercel.app`（2026-07-25に削除済みの重複プロジェクト、404確認済み）を指したままだった。すべて`https://dress-code-tokyo.com`に修正。
- **（修正）`/console`が縦に長くなり目的のセクションまで辿り着きにくくなっていた**: 新しいお知らせ／お問い合わせ／投稿済み一覧／個人宛て履歴の4セクションへのジャンプナビ（`.admin-jumpnav`）を追加。
- **（清掃）死んでいたCSS**: 旧ラジオ形式のお問い合わせUI（`.reasons__row`系）がドロップダウン化後も残っていたため削除。
- 確認したが問題なし: `console.log`等のデバッグ残骸なし、TODO類なし、`.env`系の誤コミットなし、`community-creator.html`/`community-exhibitor.html`は意図的に非表示中（`js/data.js`にコメントあり、事故ではない）。
- **（清掃）`api/env-check.js`の`DEBUG_PING`を削除**: 原因究明（`SUPABASE_SERVICE_ROLE_KEY`問題）済みの使い捨て変数で、コメント自体に「原因が分かったら削除してよい」とあったため削除した。

2026-07-25 — ヘッダーのマイページ／通知UIをドロワー形式に刷新、お知らせ投稿ページ（`/console`、共通パスワード方式）を追加し会員全員／個人宛ての両対応にした。Vercelに同名の重複プロジェクトが3つ存在していた問題を発見・解決し（本番は`doress-code-tokyo-9qjj`のみ）、不要な2つは削除済み。診断用の`/api/env-check`を追加。運営資料フォルダ（`方針/`・`事業/`・`案件/`・`素材/`、いずれもgitignore対象）を新設。Resendのドメイン認証・APIキー・Vercel環境変数設定が完了し、`/console`からのメール送信を実地確認済み（送信失敗の原因は`SUPABASE_SERVICE_ROLE_KEY`の`invalid JWT`で、Resend自体は無関係だった）。さらにHTMLメールテンプレート（黒白ベース・ロゴ・CTAボタン付き、`lib/mailer.js`の`buildEmailHtml`）を追加し、購入通知・お知らせ投稿の全パターンをテキスト＋HTML同時送信に対応。Google OAuth・Squareはユーザーの意向で後回し中。
