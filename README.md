# DRESS CODE TOKYO — サイト編集ガイド

素の HTML/CSS/JS（ビルドステップなし）でできた静的サイトに、Vercel Functions（決済・メール）と Supabase（会員・DB）を足した構成です。

**技術的な現在地・未完了タスク・過去の経緯は [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) が正本です。** このREADMEは「日々の文章・画像の差し替え方」だけを扱います。

## フォルダ構成

```
DORESS CODE TOKYO/
├── index.html                  トップページ（レイアウトと一度きりの文章はここ）
├── article.html                記事詳細ページ
├── member.html                 メンバー個人ページ
├── members-only.html           マイページ（購入したチケット・お知らせ）
├── admin-announcements.html    管理者画面（/console、合言葉方式。お知らせ配信・問い合わせ対応・購入者/会員名簿）
├── checkin.html                当日の入場確認ページ（/checkin、合言葉方式）
├── tokutei-shotorihiki.html    特定商取引法に基づく表記
├── community-creator.html      コミュニティ（クリエイター向け・現在どこからもリンクしていない）
├── community-exhibitor.html    コミュニティ（出展者向け・現在どこからもリンクしていない）
├── css/style.css               全体スタイル（先頭の :root に色・余白をまとめてある）
├── js/
│   ├── data.js                 ★サイトの中身データ（記事・チケット・メンバー等はここを編集）
│   ├── render.js               データをHTMLに展開する仕組み（基本さわらない）
│   ├── auth.js                 会員登録・ログイン・マイページ
│   ├── auth-config.js          Supabaseの接続情報
│   ├── notifications.js        ヘッダーの通知ベル
│   └── cart.js                 カート
├── api/                        Vercel Functions（決済・Webhook・メール・管理画面のAPI）
├── lib/                        api/ から使う共通処理（メール送信・管理者トークン）
├── supabase/                   DBスキーマのSQL（v1〜v16。番号順に実行してきた履歴）
├── scripts/                    ローカル用の補助スクリプト
├── docs/PROJECT_STATE.md       ★開発の現在地（作業前に必ず読む）
├── assets/images/              画像置き場
└── DRESS CODE TOKYO.html       元の22MBバンドル（バックアップ。普段は使いません）
```

## プレビューの仕方

`index.html` をダブルクリックしても見た目は確認できますが、**ログイン・カート・決済・お知らせは動きません**（`api/` のサーバー処理が必要なため）。

- 見た目だけ直したいとき: 簡易サーバーで十分です。
  ```bash
  python3 -m http.server 8000
  ```
- 決済やログインまで含めて確認したいとき: 本番（`https://dress-code-tokyo.com`）にpushして確認するのが確実です。pushすると自動でVercelにデプロイされます。

## よくある編集

### 記事を追加する
`js/data.js` の `articles:` リストに `{ }` を1つ足します。カードをタップすると `article.html?id=<slug>` が開きます。

```js
{
  cat: 'fashion', slug: 'f3',
  title: 'タイトル',
  date: '2026.08.01',
  images: ['assets/images/mag-f3-1.jpg', 'assets/images/mag-f3-2.jpg'],
  body: '本文',
  tags: ['#dresscodetokyo'],
},
```

- `cat:` は `'fashion'` か `'shop'`（`magCats` で定義）。
- `slug:` は記事のURLに使うID。fashionは `f番号`、shopは `s番号`。既存と重複しないように。
- `images:` の1枚目がカードのカバー写真になります。

### チケット・出店料を変える
`js/data.js` の `ticketsC`（来場者向け）／ `ticketsB`（出店者向け）を編集します。

**価格や商品を変えるときは、Square側の商品も合わせて直す必要があります。** `catalogObjectId` は Square に登録した商品の **Item Variation ID**（Item IDではない）です。ここが合っていないと決済できません。

### 画像を入れる
1. 写真を `assets/images/` に入れる。
2. `data.js` の該当箇所に `img: 'assets/images/xxx.jpg'` と書く。
   - カテゴリタイル → `activities:` の各行の `img`
   - 記事 → `articles:` の各行の `images` 配列
   - メンバー → `members:` の各行の `photo`
   - イベントのチラシ → `eventVisualB`（出店者向け）/ `eventVisualC`（来場者向け）
   - メインビジュアル（ヒーロー全面）→ `heroImage`（空のままだとオフホワイト背景＋虹色モチーフ）

### メンバーを追加・編集する
`js/data.js` の `members:` を編集します。

- 紹介文は `desc:`（複数段落の配列）を使います。`desc` があれば `catch`（太字1行）より優先されます。
- **未入力の項目は空にしておくこと**。`'（役職）'` のようなプレースホルダーを入れたままにすると、そのままトップページに公開されてしまいます。

### 見た目（色・余白・フォント）を変える
`css/style.css` の先頭 `:root { ... }` にまとまっています。個別パーツは同ファイル内のクラス（`.tcard` `.mcard` `.hero` など）で調整します。

### お問い合わせフォーム
サイト内蔵のフォームです（Googleフォームは使っていません）。送信すると `api/contact.js` 経由で Supabase の `inquiries` テーブルに保存され、運営宛てに通知メールが届きます。返信は `/console` から行えます。

「ご用件」の選択肢を増やすには `js/data.js` の `contactReasons:` に1行足します。

### メニュー・SNSリンク
`js/data.js` の `nav:` / `socials:` を直すだけで、ヘッダー・フッターの両方に反映されます。

## 運用でよく使うページ

| URL | 用途 | 入り方 |
|---|---|---|
| `/console` | お知らせ配信・会員名簿・購入者一覧・問い合わせ返信 | 管理者パスワード（`ADMIN_CONSOLE_PASSWORD`） |
| `/checkin` | 当日の入場確認（QR読み取り／手入力） | 受付用パスワード（`CHECKIN_PASSWORD`。管理者パスワードでも入れる）。ボランティアには受付用だけを渡すこと（顧客情報や一斉配信には触れなくなる） |

## フォントについて

元は 864 個の woff2 を埋め込んでいたため 22MB でしたが、同じ Google Fonts を `<link>` 1行で読み込む形に変えました（Cormorant Garamond / Jost / Zen Kaku Gothic New / Zen Old Mincho）。見た目は同じです。表示にはインターネット接続が必要です。
