/* =========================================================
   DRESS CODE TOKYO — サイトの「中身」データ
   ---------------------------------------------------------
   ★ 記事やギャラリーを増やしたいときは、このファイルを編集します。
   ★ 各リストは [ ] の中に { } を「, 」で区切って並べるだけ。
   ★ 編集後はブラウザを再読み込みすれば反映されます。
   ========================================================= */

window.SITE = {

  /* ▼ ヒーロー（トップ最上部）のメイン写真
     パスを入れると全面写真＋中央テキスト（白文字）に切り替わります。
     空 '' のままなら、上品なオフホワイト背景＋虹色モチーフで表示。
     例: heroImage: 'assets/images/hero.jpg', */
  heroImage: '',

  /* ▼ ヘッダー / フッターのメニュー（リンク先は #セクションID） */
  nav: [
    { label: 'Top',       href: '#top' },
    { label: 'About',     href: '#about' },
    { label: 'Event',     href: '#event' },
    { label: 'Magazine',  href: '#magazine' },
    { label: 'Community', href: '#community' },
    { label: 'Contact',   href: '#contact' },
  ],

  /* ▼ 活動内容（カテゴリタイル＋About一覧で共用）
     img に画像パスを入れるとタイルに写真が表示されます（空ならプレースホルダー）。
     href はタイルのリンク先。 */
  activities: [
    { jp: 'マーケットイベント',   en: 'Market Events', img: '', href: '#event' },
    { jp: 'スナップ',             en: 'Street Snap',   img: '', href: '#magazine' },
    { jp: 'インタビュー',         en: 'Interview',     img: '', href: '#magazine' },
    { jp: 'イベントレポート',     en: 'Report',        img: '', href: '#magazine' },
  ],

  /* ▼ Event：開催情報（左 = 項目名 / 右 = 内容） */
  eventInfo: [
    { k: 'Date',     v: '2026.03.21 SAT – 22 SUN' },
    { k: 'Open',     v: '11:00 – 20:00' },
    { k: 'Location', v: 'TOKYO（会場は近日発表）' },
    { k: 'Entry',    v: '¥1,000 / 前売' },
    { k: 'Concept',  v: 'Wear your story.' },
  ],

  /* ▼ Event：4つのボタン */
  eventCtas: [
    { en: 'Visitor Entry',          jp: '来場予約する',          href: '#contact' },
    { en: 'Exhibitor Application',  jp: '出店応募する',          href: '#contact' },
    { en: 'Event Detail',           jp: 'イベント詳細を見る',    href: '#event' },
    { en: 'Past Events',            jp: '過去イベントを見る',    href: '#magazine' },
  ],

  /* ▼ Event：How to enjoy（3つの楽しみ方） */
  enjoy: [
    { no: '01', title: 'Discover brands',  body: '東京の作り手が集まるブースを巡り、まだ知らないブランドと出会う。' },
    { no: '02', title: 'Meet the people',  body: '出店者やクリエイターと直接話せる、マーケットならではの距離感。' },
    { no: '03', title: 'Wear your story',  body: 'スナップ撮影やコミュニティを通して、あなたのスタイルを街へ。' },
  ],

  /* ▼ Event：動画エンベッド
     YouTube/Vimeo の埋め込みコード(<iframe ...>)をそのまま貼り付けると動画になります。
     '' （空）のままなら再生ボタン風のプレースホルダーが表示されます。
     例: videoEmbed: '<iframe src="https://www.youtube.com/embed/XXXX" allowfullscreen></iframe>', */
  videoEmbed: '',

  /* ▼ Event：フォトギャラリー
     img に画像パスを入れると写真が表示されます（例: 'assets/images/snap01.jpg'）。
     img を空にすると色付きのプレースホルダーになります。
     ratio は枠の縦横比（'3/4' は縦長、'1/1' は正方形）。 */
  gallery: [
    { label: 'Snap 01',   ratio: '3/4', img: '' },
    { label: 'Booth 02',  ratio: '1/1', img: '' },
    { label: 'Crowd 03',  ratio: '3/4', img: '' },
    { label: 'Detail 04', ratio: '1/1', img: '' },
    { label: 'Stage 05',  ratio: '3/4', img: '' },
    { label: 'Snap 06',   ratio: '1/1', img: '' },
    { label: 'Street 07', ratio: '3/4', img: '' },
    { label: 'Night 08',  ratio: '1/1', img: '' },
  ],

  /* ▼ Magazine：カテゴリのタグ（見た目だけ。記事の cat とそろえると分かりやすい） */
  categories: ['Event Report', 'Street Snap', 'Interview', 'Brand Story', 'Fashion', 'Culture'],

  /* ▼ Magazine：記事一覧 ★ここに { } を足すと記事カードが増えます★
     - cat     : カテゴリ名
     - date    : 日付（表示用の文字列）
     - title   : 記事タイトル
     - excerpt : 一覧に出る短い説明
     - href    : クリック先（記事ページを作ったら 'articles/xxx.html' などに）
     - img     : カバー画像パス（空ならプレースホルダー） */
  articles: [
    { cat: 'Event Report', date: '2025.11.18', title: 'DRESS CODE MARKET Vol.0 開催レポート',          excerpt: '初開催の熱気と、集まった多様なスタイル。一日のすべてを振り返る。', href: '#contact', img: '' },
    { cat: 'Brand Story',  date: '2025.11.02', title: '出店ブランドインタビュー：東京の作り手たち',    excerpt: 'マーケットに並ぶ服の、その向こうにある物語を聞いた。',           href: '#contact', img: '' },
    { cat: 'Street Snap',  date: '2025.10.27', title: '来場者スナップ：今日のドレスコード',            excerpt: '会場で出会った、忘れられない着こなしを切り取って。',             href: '#contact', img: '' },
    { cat: 'Culture',      date: '2025.10.10', title: 'イベントの裏側：マーケットができるまで',        excerpt: '一つのイベントが立ち上がるまでの、舞台裏のドキュメント。',       href: '#contact', img: '' },
    { cat: 'Fashion',      date: '2025.09.30', title: '次回イベントの見どころ',                        excerpt: 'Vol.1で出会えるブランド、カルチャー、そして人。',               href: '#contact', img: '' },
    { cat: 'Interview',    date: '2025.09.12', title: 'クリエイター対談：東京で作るということ',        excerpt: '写真家、スタイリスト、デザイナー。街を作る三者が語る。',         href: '#contact', img: '' },
  ],

  /* ▼ Community：3つの募集カード（accent は左上のライン色） */
  community: [
    { accent: '#3a4fd6', en: 'For Everyone',   jp: 'メンバー募集',           body: 'イベントの先行案内や限定情報を受け取れる、DRESS CODE のコアコミュニティ。', cta: 'コミュニティに参加する' },
    { accent: '#e8533a', en: 'For Exhibitors', jp: '出店者向け先行案内',     body: '次回マーケットの出店枠を、一般公開より先にご案内します。',                 cta: '先行案内を受け取る' },
    { accent: '#9cc23f', en: 'For Creators',   jp: 'クリエイター募集',       body: '撮影・動画・SNS・広告など、イベントづくりに関わりたい人を募集中。',         cta: 'メンバー募集を見る' },
  ],

  /* ▼ Contact：お問い合わせ理由の一覧 */
  contactReasons: [
    { no: '01', jp: '掲載依頼',           en: 'Feature' },
    { no: '02', jp: '出店依頼',           en: 'Exhibit' },
    { no: '03', jp: 'コラボ依頼',         en: 'Collab' },
    { no: '04', jp: '広告掲載',           en: 'Advertise' },
    { no: '05', jp: 'その他お問い合わせ', en: 'Other' },
  ],

  /* ▼ Contact / Footer：SNSリンク（href を実際のURLに変えてください） */
  socials: [
    { label: 'Instagram',   href: '#' },
    { label: 'X / Twitter', href: '#' },
    { label: 'Note',        href: '#' },
  ],

  /* ▼ Contact：お問い合わせフォームの送信先（Google フォーム連携）
     ここが空のあいだは「デモ動作（送信すると御礼が出るだけ）」です。
     --------------------------------------------------------------
     【設定方法】Google フォームを作成 → ⋮メニュー →「事前入力したリンクを取得」
     → 各項目に適当な値を入れて送信 → 出てきた URL を私（Claude）に渡せば、
     下の action と entry 番号を私が埋めます。それだけで本番送信が有効になります。 */
  contactForm: {
    action: '',          // 例: https://docs.google.com/forms/d/e/XXXX/formResponse
    entries: {
      name:    '',       // 例: entry.1111111
      email:   '',       // 例: entry.2222222
      type:    '',       // 例: entry.3333333
      message: '',       // 例: entry.4444444
    },
  },
};
