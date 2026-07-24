# CLAUDE.md

このファイルには、**すべてのセッションで必ず守る恒久的なルールだけ**を書きます。
一時的な作業内容・進捗・次にやることは書かないでください → [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) に書きます。

## プロジェクトの目的

DRESS CODE TOKYO のウェブサイト。静的サイト（素の HTML/CSS/JS）＋ Vercel Functions（Square 決済・Webhook）＋ Supabase（会員認証・購入履歴）。

## 使用している主要な技術

- フロントエンド: 素の HTML/CSS/JS（フレームワークなし、ビルドステップなし）。`js/data.js` にコンテンツデータ、`js/render.js` が描画。
- 認証: Supabase Auth（`js/auth.js`, `js/auth-config.js`）。Google サインイン対応。
- 決済: Square（Payment Link）。`js/cart.js` → `api/checkout.js` → Square API → `api/square-webhook.js` が決済完了を検知して DB を更新。
- DB: Supabase Postgres（`supabase/schema.sql`, `supabase/schema_v2_cart.sql`）。RLS 前提。
- ホスティング: Vercel（`vercel.json` にセキュリティヘッダー設定）。

## 必ず守る開発ルール

- ビルドステップなしの構成を維持する。npm 依存は最小限（現状 `@supabase/supabase-js` のみ）。
- Webhook（`api/square-webhook.js`）は署名検証を必ず通す。検証ロジックを弱めたり迂回したりしない。
- `purchases.status` をクライアントから直接書き換えられるようにしない（service role のみ更新可、というポリシーを崩さない）。
- Supabase の `service_role` キーはサーバー側（`api/`）以外に絶対に書かない・埋め込まない。
- 見た目（フォント・色・レイアウト）は既存デザインを踏襲する。大きく変える場合は先に確認する。
- コミット・push・破壊的な git 操作は明示的な指示がない限り行わない。

## 運営資料（ローカルのみ・参照すること）

リポジトリ直下に、事業運営に関する資料フォルダがある（`.gitignore`で除外されておりGitHubには上がらない、ローカル限定）。関連する作業をするときは参照すること。

- `方針/` — 運営方針・意思決定・事業としての進捗（技術的な進捗は`docs/PROJECT_STATE.md`側）
- `事業/` — 事業計画・収支・ロードマップ
- `案件/` — 出店者・協賛・コラボなど個別案件の資料
- `素材/` — 写真・動画などの元データ（サイトに使うものは`assets/images/`に取り込み済み）

## 作業開始時に確認すること

1. [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) を読み、現在地・未完了タスク・既知の問題を把握する。
2. `git status` / `git log --oneline -10` で直近の変更を確認する。
3. 事業・案件に関わる作業の場合は、上記の運営資料フォルダも確認する。

## 作業完了時に実行すること

1. [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) を更新する（変更内容・完了/未完了タスク・次にやること・最終更新日時）。
2. 一定量の作業が完了した区切り、または `/clear` ・ `compact` ・セッション終了・引き継ぎに言及があった場合も同様に更新する。

## 変更してはいけない重要な仕様

- `purchases` テーブルの `square_order_id` は Webhook が購入記録を突き止めるための一意キー。スキーマ変更時も一意性を保つ。
- Idempotency Key を使った Square 決済の二重注文防止ロジック（`api/checkout.js`）を外さない。
- `.env` 系ファイル（実際の秘密鍵）はコミットしない。テンプレートの `.env.example` のみコミット対象。

## セキュリティ上の注意事項

- Webhook の署名検証は `crypto.timingSafeEqual` を使う（タイミング攻撃対策）。単純な `===` 比較に戻さない。
- Sandbox 用と Production 用の Square 認証情報（ACCESS_TOKEN / LOCATION_ID / WEBHOOK_SIGNATURE_KEY）を混在させない。
- ブラウザ側コード（`js/*.js`）には anon key 以外の秘密情報を絶対に置かない。
- お知らせ投稿ページ（`/console` = `admin-announcements.html`）は共通パスワード方式（`ADMIN_CONSOLE_PASSWORD`）。パスワード比較も `crypto.timingSafeEqual` を使う（`api/admin-login.js`）。トークン検証（`lib/adminAuth.js`）を弱めたり、`announcements` テーブルへの insert/delete を service role 以外に開放したりしない。
