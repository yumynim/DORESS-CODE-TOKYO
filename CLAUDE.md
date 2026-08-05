# CLAUDE.md

このファイルには、**すべてのセッションで必ず守る恒久的なルールだけ**を書きます。
一時的な作業内容・進捗・次にやることは書かないでください → [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) に書きます。

## プロジェクトの目的

DRESS CODE TOKYO のウェブサイト。静的サイト（素の HTML/CSS/JS）＋ Vercel Functions（Square 決済・Webhook）＋ Supabase（会員認証・購入履歴）。

## 使用している主要な技術

- フロントエンド: 素の HTML/CSS/JS（フレームワークなし、ビルドステップなし）。`js/data.js` にコンテンツデータ、`js/render.js` が描画。
- 認証: Supabase Auth（`js/auth.js`, `js/auth-config.js`）。Google サインイン対応。
- 決済: Square（Payment Link）。`js/cart.js` → `api/checkout.js` → Square API → `api/square-webhook.js` が決済完了を検知して DB を更新。
- DB: Supabase Postgres（`supabase/schema.sql` 〜 `schema_v16_entry_passes.sql`。最新の一覧は`docs/PROJECT_STATE.md`の「現在の構成」参照）。RLS 前提。受付コードは**1人1コード方式**（`entry_passes` テーブル。1行＝1人＝1回入場。v16で移行済み、旧方式の`checkin_entry`/`undo_checkin`/人数カウントは廃止）。
- ホスティング: Vercel（`vercel.json` にセキュリティヘッダー設定）。

## 必ず守る開発ルール

- ビルドステップなしの構成を維持する。npm 依存は最小限（現状 `@supabase/supabase-js` のみ）。
- Webhook（`api/square-webhook.js`）は署名検証を必ず通す。検証ロジックを弱めたり迂回したりしない。
- `purchases.status` をクライアントから直接書き換えられるようにしない（service role のみ更新可、というポリシーを崩さない）。
- Supabase の `service_role` キーはサーバー側（`api/`）以外に絶対に書かない・埋め込まない。
- 見た目（フォント・色・レイアウト）は既存デザインを踏襲する。大きく変える場合は先に確認する。
- コミットは、キリの良い変更が1つ終わるごとに毎回自動で行い、そのままpushしてよい（ユーザーの指示: 「プッシュは毎回自動でしちゃって」）。ただし破壊的な git 操作（force push、reset --hard 等）は明示的な指示がない限り行わない。

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

## 引き継ぎのためこまめに記録すること

このプロジェクトは、別のセッション・別の会話・別のAIアシスタントが、今回のやり取りの文脈を一切知らないまま作業を引き継ぐ可能性がある。「作業完了時」だけでなく、**キリの良い変更を1つ終えるたびに** [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) を更新すること。特に以下は書き忘れると引き継ぎ先が誤った前提で動くため必須：

- **コミットしたがpushしていない変更**、**編集したがコミットしていない変更**がある場合は、その事実と理由を明記する（本番/プレビュー環境にまだ反映されていないことが伝わるように）。
- ユーザーに「〇〇して」と依頼されたが、環境変数の設定など**ユーザー側の作業待ちで完了していないタスク**。
- コード上の前提（例:「このAPIはSandboxとProductionでホストが違う」等）を修正した場合、なぜ直したかの理由。

作業を始める前に `git status` で未コミット・未push分がないか確認する習慣も、この理由から特に重要になる。

## 環境変数を扱うときの注意（ユーザー本人がVercelで変更する）

Vercelの環境変数はユーザー本人が手動で変更する（Claudeは直接変更できない）。以下の組は役割が違う別物だが、片方だけ変更して他方を放置すると事故になる。ユーザーが片方に言及したら、**もう片方の状態も確認するよう必ず案内する**こと。

- **`EVENT_DATE`** と **`CURRENT_EVENT_ID`**（`api/admin-checkin.js` の `eventGateInfo()`）:
  `CURRENT_EVENT_ID`＝発行するコードがどのイベント向けか（`0927`など）。`EVENT_DATE`＝`/checkin`が入場を受け付ける「今日」の一時的な上書き（テスト用）。**この2つは統合しない**（統合すると「本番イベント向けのコードのまま別日にテストする」ができなくなる）。
  ユーザーが「`EVENT_DATE`を設定した/変えた」と言ったら → テストが終わったら削除するよう念押しする。
  ユーザーが「本番イベントの日付/`CURRENT_EVENT_ID`を変えた」と言ったら → `EVENT_DATE`が残っていないか確認するよう促す（残っていると本番の入場が止まる）。
  なお `/checkin` には現在の状態を示すバナー（`checkin.html` の `#checkin-gate`、`renderGate()`）が実装済みで、ログインするたびに「本日は受付可能日か」「`EVENT_DATE`のテスト設定が残っていないか」を表示する。この仕組みは消さない。

## 返金について、話題に出たら毎回案内すること

Square で返金するとき、**全額返金でなければ受付コードは自動的に無効化されない**（`api/square-webhook.js` の一部返金判定。理由: 「出店料＋入場×2」のようなまとめ買いで一部だけ返金されたとき、機械的にコードを消すと返金していない人まで入場できなくなるため、あえて自動処理せず運営に判断を委ねる設計にしてある）。ユーザーが返金操作をする／しようとしている場面では、必ずこれを案内すること。

**1枚だけ返金してほしい（まとめ買いの一部）と言われたときの手順**:
1. Squareでその1枚分の金額だけ**一部返金**する。
2. 運営宛てに届く【要対応】一部返金メールで、購入IDと現在の受付コード一覧（`entry_passes`）を確認する。
3. Supabase の Table Editor（またはSQL Editor）で `entry_passes` テーブルを開き、無効化したいコードの行を特定する。
4. その行の `status` 列を `valid` → `revoked` に変更する。
   - SQL Editorでやる場合: `update entry_passes set status = 'revoked' where code = '該当コード';`
   - **`checked_in_at` に日時が入っている（＝すでに入場済みの）行は絶対に無効化しない**。すでに会場に入っている人を締め出すことになる。
5. `/checkin` の「コードが分からない方を探す」でそのコードを検索し、「返金済み」表示になっていることを確認する（他のコードは影響を受けず有効なまま）。

## 変更してはいけない重要な仕様

- `purchases` テーブルの `square_order_id` は Webhook が購入記録を突き止めるための一意キー。スキーマ変更時も一意性を保つ。
- Idempotency Key を使った Square 決済の二重注文防止ロジック（`api/checkout.js`）を外さない。
- `.env` 系ファイル（実際の秘密鍵）はコミットしない。テンプレートの `.env.example` のみコミット対象。

## セキュリティ上の注意事項

- Webhook の署名検証は `crypto.timingSafeEqual` を使う（タイミング攻撃対策）。単純な `===` 比較に戻さない。
- Sandbox 用と Production 用の Square 認証情報（ACCESS_TOKEN / LOCATION_ID / WEBHOOK_SIGNATURE_KEY）を混在させない。
- Square は Sandbox と Production で **APIホストが異なる**（`connect.squareupsandbox.com` / `connect.squareup.com`）。`api/checkout.js`は`SQUARE_ENVIRONMENT`で切り替えている（過去に本番ホスト固定でSandboxトークンが401になるバグがあったため、`SQUARE_ENVIRONMENT`を見ずにホストを決め打ちする実装に戻さない）。
- ブラウザ側コード（`js/*.js`）には anon key 以外の秘密情報を絶対に置かない。
- 管理者画面（`/console` = `admin-announcements.html`）と入場確認（`/checkin` = `checkin.html`）は共通パスワード方式。パスワード比較も `crypto.timingSafeEqual` を使う（`api/admin-login.js`）。**権限は2段階**（`lib/adminAuth.js`）: `ADMIN_CONSOLE_PASSWORD` → `admin` 権限（全部）、`CHECKIN_PASSWORD` → `checkin` 権限（入場確認のみ。当日ボランティア用）。トークンは「有効期限.権限.署名」形式で、署名鍵は `ADMIN_TOKEN_SECRET`（未設定なら合言葉のscrypt伸長値）。この権限分離・トークン検証を弱めない。`admin-members` など個人情報をまとめて返すAPIは `admin` 権限必須のまま維持する。
- 管理者トークンをURLのクエリ（`?token=`）で受け渡ししない（Vercelのアクセスログ・ブラウザ履歴に残るため）。全APIは `x-admin-token` ヘッダー（POSTはJSONボディ）で受け取る方針。クエリ方式に戻さない。
- `announcements`/`notifications`/`inquiries`/`entry_passes` テーブルへの書き込み、および入場系DB関数（`issue_entry_passes`/`checkin_pass`/`undo_pass`）の実行権限を service role 以外に開放しない（`inquiries` は問い合わせ者の氏名・メールアドレス・本文を含むため特に注意。`entry_passes` は入場の正当性そのもの）。
