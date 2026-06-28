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
    { label: 'Members',   href: '#members' },
    { label: 'Contact',   href: '#contact' },
  ],

  /* ▼ 活動内容（カテゴリタイル＋About一覧で共用）
     img に画像パスを入れるとタイルに写真が表示されます（空ならプレースホルダー）。
     href はタイルのリンク先。 */
  activities: [
    { jp: 'マーケットイベント', en: 'Market Events', img: 'assets/images/tile-market.jpg',   href: '#event' },
    { jp: 'マガジン',           en: 'Magazine',      img: 'assets/images/tile-magazine.jpg', href: '#magazine' },
    { jp: 'イベントレポート',   en: 'Report',        img: 'assets/images/tile-report.jpg',   href: '#magazine' },
  ],

  /* ▼ Event：開催情報（詳細が決まり次第追加） */
  eventInfo: [
    { k: 'Location', v: 'TOKYO' },
    { k: 'Concept',  v: 'Wear your story.' },
  ],

  /* ▼ Event：ボタン */
  eventCtas: [
    { en: 'Get Notified',  jp: '開催情報を受け取る',  href: '#contact' },
    { en: 'For Exhibitors', jp: '出店について問い合わせる', href: '#contact' },
  ],

  /* ▼ Event：How to enjoy（3つの楽しみ方） */
  enjoy: [
    { no: '01', title: 'Discover brands',  body: '東京の作り手が集まるブースを巡り、まだ知らないブランドと出会う。' },
    { no: '02', title: 'Meet the people',  body: '出店者やクリエイターと直接話せる、マーケットならではの距離感。' },
    { no: '03', title: 'Wear your story',  body: 'スナップ撮影やコミュニティを通して、あなたのスタイルを街へ。' },
  ],

  /* ▼ Event：キービジュアル（中央の大きな写真枠）。空ならプレースホルダー表示 */
  eventVisual: 'assets/images/fitting-selfie.jpg',

  /* ▼ Event：動画（いずれ追加予定 — iframe を貼ると表示される）
  videoEmbed: '<iframe width="560" height="315" src="https://www.youtube.com/embed/..." allowfullscreen></iframe>', */

  /* ▼ Magazine：カテゴリのタグ（見た目だけ。記事の cat とそろえると分かりやすい） */
  categories: ['Event Report', 'Magazine', 'Brand Story', 'Fashion', 'Culture'],

  /* ▼ カテゴリごとの色（記事カードの丸ドット・記事ページの見出し色に使用）
     新カテゴリを増やすときは、ここに「'カテゴリ名': '#色'」を足してください。 */
  catColors: {
    'Event Report': '#e8533a',
    'Magazine':     '#d4459a',
    'Brand Story':  '#8b46c9',
    'Fashion':      '#9cc23f',
    'Culture':      '#3a4fd6',
  },

  /* ▼ Magazine：記事一覧 ★ここに { } を足すと記事カードが増えます★
     - cat     : カテゴリ名
     - date    : 日付（表示用の文字列）
     - title   : 記事タイトル
     - excerpt : 一覧に出る短い説明
     - href    : クリック先（記事ページを作ったら 'articles/xxx.html' などに）
     - img     : カバー画像パス（空ならプレースホルダー） */
  /* ▼ Magazine：記事一覧 ★ここに { } を足すと記事カードが増えます★
     記事を追加するときはこの下に { cat, date, slug, title, excerpt, img, body } を追加してください。 */
  articles: [],

  /* ▼ Community：3つの募集カード
     href = カードのリンク先。外部URLでもOK（外部は自動で別タブで開きます）。 */
  community: [
    { en: 'For Everyone',   jp: 'メンバー募集',       body: 'イベントの先行案内や限定情報を受け取れる、DRESS CODE のコアコミュニティ。', cta: 'コミュニティに参加する', href: 'https://celestial-finalhomelink.vercel.app/' },
    { en: 'For Exhibitors', jp: '出店者向け先行案内', body: '次回マーケットの出店枠を、一般公開より先にご案内します。',                 cta: '先行案内を受け取る',     href: 'community-exhibitor.html' },
    // クリエイター募集は一旦非表示 → 復活させるときは下の行のコメントを外す
    // { en: 'For Creators', jp: 'クリエイター募集', body: '撮影・動画・SNS・広告など、イベントづくりに関わりたい人を募集中。', cta: 'メンバー募集を見る', href: 'community-creator.html' },
  ],

  /* ▼ 運用メンバー（Members）
     トグルを開くと写真＋軽い紹介が出て、「詳細を見る」で member.html?id=slug の個別ページへ。
     ※名前・肩書き・紹介文はサンプルです。実際の内容に書き換えてください。
     - photo  : トグルを開いたときに出る写真
     - intro  : トグル内の軽い紹介文
     - bio    : 個別ページの紹介文（段落の配列）
     - gallery: 個別ページで流れる写真（何枚でも） */
  members: [
    {
      slug: 'minami', name: 'MINAMI', role: '',
      photo: 'assets/images/member-minami.jpg',
      intro: '（ここに一言紹介を入れてください）',
      bio: ['（ここにプロフィール文を入れてください）'],
      gallery: ['assets/images/member-minami.jpg'],
    },
    {
      slug: 'tubasa', name: 'TUBASA', role: '',
      photo: 'assets/images/member-tubasa.jpg',
      intro: '（ここに一言紹介を入れてください）',
      bio: ['（ここにプロフィール文を入れてください）'],
      gallery: [],
    },
    {
      slug: 'haruki', name: 'HARUKI', role: '',
      photo: 'assets/images/member-haruki.jpg',
      intro: '（ここに一言紹介を入れてください）',
      bio: ['（ここにプロフィール文を入れてください）'],
      gallery: ['assets/images/member-haruki.jpg'],
    },
    {
      slug: 'yui', name: 'YUI', role: '',
      photo: 'assets/images/member-yui.jpg',
      intro: '（ここに一言紹介を入れてください）',
      bio: ['（ここにプロフィール文を入れてください）'],
      gallery: ['assets/images/member-yui.jpg'],
    },
  ],

  /* ▼ Contact：お問い合わせ理由の一覧 */
  contactReasons: [
    { no: '01', jp: '掲載依頼',           en: 'Feature' },
    { no: '02', jp: '出店依頼',           en: 'Exhibit' },
    { no: '03', jp: 'コラボ依頼',         en: 'Collab' },
    { no: '04', jp: '広告掲載',           en: 'Advertise' },
    { no: '05', jp: 'その他お問い合わせ', en: 'Other' },
  ],

  /* ▼ Contact / Footer：SNSリンク
     nick = アイコン下に出る短いラベル（同じプラットフォームが複数あるときに使用）。 */
  socials: [
    { label: 'Instagram', sub: '@dress.code_tokyo',      nick: 'フリマ',  href: 'https://www.instagram.com/dress.code_tokyo/' },
    { label: 'Instagram', sub: '@dresscode.tokyo_media', nick: 'media',   href: 'https://www.instagram.com/dresscode.tokyo_media/' },
    { label: 'TikTok',    sub: '@dress.code_tokyo',                       href: 'https://www.tiktok.com/@dress.code_tokyo' },
    { label: 'Facebook',  sub: 'Dress Code Tokyo',                        href: 'https://www.facebook.com/share/1CwA4cQzvy/?mibextid=wwXIfr' },
    { label: 'LINE',      sub: 'DRESS CODE TOKYO',                        href: 'https://line.me/R/ti/p/@799fggke' },
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
