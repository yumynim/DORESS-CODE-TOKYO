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
   - ギャラリー → `gallery:` の各行の `img`
   - 記事カバー → `articles:` の各行の `img`
   - メインビジュアル → `index.html` の `assets/images/photo-sample.jpg` を差し替え

### 動画を入れる
`data.js` の `videoEmbed:` に YouTube/Vimeo の埋め込み `<iframe>` を貼り付け。

```js
videoEmbed: '<iframe src="https://www.youtube.com/embed/動画ID" allowfullscreen></iframe>',
```

### お問い合わせフォーム
`data.js` の `contactFormEmbed:` に Google フォームの埋め込み `<iframe>` を貼り付け。

### メニュー・SNSリンク・開催情報など
すべて `data.js` の各リスト（`nav` / `socials` / `eventInfo` …）を直すだけで反映されます。

## フォントについて
元は 864 個の woff2 をファイルに埋め込んでいたため 22MB でしたが、
同じ Google Fonts を `index.html` 内の `<link>` 1行で読み込む形に変えました
（Cormorant Garamond / Jost / Zen Kaku Gothic New / Zen Old Mincho）。見た目は同じです。
※ 表示にはインターネット接続が必要です。
