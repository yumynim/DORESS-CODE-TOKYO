# DRESS CODE TOKYO — サイト編集ガイド

claudedesign が書き出した 22MB の1枚 HTML を、**編集しやすい構成**に組み直したものです。
見た目（フォント・色・レイアウト）は元のままです。

## フォルダ構成

```
DORESS CODE TOKYO/
├── index.html              ← ページ本体（レイアウトと一度きりの文章はここ）
├── css/
│   └── style.css           ← 全体の土台スタイル（フォント・色・スマホ対応）
├── js/
│   ├── data.js             ← ★サイトの中身データ（記事・ギャラリー等はここを編集）
│   └── render.js           ← データをHTMLに展開する仕組み（基本さわらない）
├── assets/
│   └── images/             ← 画像置き場
│       ├── logo.png        ← ヘッダーのロゴ
│       ├── mark.png        ← 装飾マーク
│       └── photo-sample.jpg← サンプル写真（メインビジュアルに使用中）
├── DRESS CODE TOKYO.html   ← 元の22MBバンドル（バックアップ。普段は使いません）
└── 画像/                   ← 受け取った元画像の保管場所
```

## プレビューの仕方

`index.html` をダブルクリックしてブラウザで開くだけでOKです。
（Google フォームや一部の埋め込みを確実に動かしたい場合は、簡易サーバー
`python3 -m http.server` を使うとより確実です。）

## よくある編集

### 記事を追加する
`js/data.js` の `articles:` リストに `{ }` を1つ足します。

```js
{ cat: 'Event Report', date: '2026.04.01', title: 'タイトル',
  excerpt: '一覧に出る短い説明', href: '#contact', img: 'assets/images/cover.jpg' },
```

- `img:` を空 `''` にするとプレースホルダー、画像パスを入れると写真が出ます。
- `href:` は今は `#contact`。記事ページを作ったら `articles/xxx.html` などに変えます。

### 画像を入れる
1. 写真を `assets/images/` に入れる（例: `snap01.jpg`）。
2. `data.js` の該当箇所に `img: 'assets/images/snap01.jpg'` と書く。
   - カテゴリタイル（トップの4枚）→ `activities:` の各行の `img`
   - ギャラリー → `gallery:` の各行の `img`
   - 記事カバー → `articles:` の各行の `img`
   - メインビジュアル（ヒーロー全面）→ `data.js` の `heroImage: 'assets/images/hero.jpg'`
     （写真を入れると全面写真＋白文字に自動で切り替わります）

### 見た目（色・余白・フォント）を変える
`css/style.css` の先頭 `:root { ... }` にまとまっています。色や余白の数値を変えるとサイト全体に反映されます。
個別パーツの見た目も同ファイル内のクラス（`.card` `.tile` `.hero` など）で調整できます。

### 動画を入れる
`data.js` の `videoEmbed:` に YouTube/Vimeo の埋め込み `<iframe>` を貼り付け。

```js
videoEmbed: '<iframe src="https://www.youtube.com/embed/動画ID" allowfullscreen></iframe>',
```

### お問い合わせフォーム（インライン展開＋Google フォーム連携）
Contact セクションの「応募・お問い合わせフォームを開く」をタップすると、サイトに合わせた
入力フォームが開きます。送信内容は **Google フォーム経由でスプレッドシートに記録**されます。

設定は `data.js` の `contactForm` に、Google フォームの送信先URLと各項目の `entry.xxxx` 番号を入れるだけ：

```js
contactForm: {
  action: 'https://docs.google.com/forms/d/e/XXXX/formResponse',
  entries: { name: 'entry.111', email: 'entry.222', type: 'entry.333', message: 'entry.444' },
},
```

番号は、Google フォーム → ⋮ →「事前入力したリンクを取得」で出る URL から拾えます
（未設定のあいだは送信すると御礼が出るデモ動作）。

### メニュー・SNSリンク・開催情報など
すべて `data.js` の各リスト（`nav` / `socials` / `eventInfo` …）を直すだけで反映されます。

## フォントについて
元は 864 個の woff2 をファイルに埋め込んでいたため 22MB でしたが、
同じ Google Fonts を `index.html` 内の `<link>` 1行で読み込む形に変えました
（Cormorant Garamond / Jost / Zen Kaku Gothic New / Zen Old Mincho）。見た目は同じです。
※ 表示にはインターネット接続が必要です。
