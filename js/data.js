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

  /* ▼ ヘッダー / フッターのメニュー（リンク先は #セクションID）
     ★ 今後イベントを増やすとき（DRESS CODE SNAP / TALK / NIGHT 等）:
        1) 下に { label: 'DRESS CODE SNAP', href: '#snap' } のように1行足す
        2) index.html に <section id="snap"> を追加（#event のMARKET枠を複製して中身を差し替え） */
  nav: [
    { label: 'Top',                href: '#top' },
    { label: 'About',              href: '#about' },
    { label: 'DRESS CODE MARKET',  href: '#event' },
    { label: 'Magazine',           href: '#magazine' },
    { label: 'Event Report',       href: '#report' },
    { label: 'Community',          href: '#community' },
    { label: 'Members',            href: '#members' },
    { label: 'Contact',            href: '#contact' },
  ],

  /* ▼ 活動内容（カテゴリタイル＋About一覧で共用）
     img に画像パスを入れるとタイルに写真が表示されます（空ならプレースホルダー）。
     href はタイルのリンク先。 */
  activities: [
    { jp: 'マーケットイベント', en: 'Market Events', img: 'assets/images/tile-market.jpg',   href: '#event' },
    { jp: 'マガジン',           en: 'Magazine',      img: 'assets/images/tile-magazine.jpg', href: '#magazine' },
    { jp: 'イベントレポート',   en: 'Report',        img: 'assets/images/tile-report.jpg',   href: '#report' },
  ],

  /* ▼ Event：開催情報（詳細が決まり次第追加） */
  eventInfo: [
    { k: 'Location', v: 'TOKYO KINSHICHO' },
    { k: 'Concept',  v: 'FASHION' },
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
    { no: '03', title: 'Wear your story',  body: '撮影やコミュニティを通して、あなたのスタイルを街へ。' },
  ],

  /* ▼ Event：キービジュアル（マーケットの告知フライヤー）。空ならプレースホルダー表示 */
  eventVisual: 'assets/images/market-flyer.jpg',

  /* ▼ Event：動画（いずれ追加予定 — iframe を貼ると表示される）
  videoEmbed: '<iframe width="560" height="315" src="https://www.youtube.com/embed/..." allowfullscreen></iframe>', */

  /* ▼ Magazine：カテゴリのタグ（記事の cat とそろえてください） */
  categories: ['マーケットイベント', 'マガジン', 'イベントレポート'],

  /* ▼ カテゴリごとの色（記事カードの丸ドット・記事ページの見出し色に使用） */
  catColors: {
    'マーケットイベント': '#e8533a',
    'マガジン':           '#d4459a',
    'イベントレポート':   '#8b46c9',
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

  /* ▼ Magazine：記事が空のときに表示する「近日公開」画像（空にすると文字表示に戻る） */
  comingSoonImage: 'assets/images/coming-soon.png',

  /* ▼ イベントレポート：開催したイベントの記録（フライヤー／ポスター形式のカード）
     { date, title, excerpt, images } を追加。images は配列で、2枚以上あると
     カードに左右の矢印が出て、タップで次/前の写真に切り替えられます。 */
  reports: [
    {
      date: '2025.12.22 MON',
      title: 'UNLABELED MARKET Vol.1',
      excerpt: 'ブランド・クリエイターが集った一日限りのマーケット。会場は東京・錦糸（墨田区）。',
      images: [
        'assets/images/report-unlabeled.jpg',
        'assets/images/report-venue.jpg',
      ],
    },
  ],

  /* ▼ Community：3つの募集カード
     href = カードのリンク先。外部URLでもOK（外部は自動で別タブで開きます）。 */
  community: [
    { en: 'For Everyone',   jp: 'メンバー募集',     body: 'イベントの最新情報や限定コンテンツを受け取れる、DRESS CODE のコアコミュニティ。', cta: 'コミュニティに参加する', href: 'https://celestial-finalhomelink.vercel.app/' },
    { en: 'For Exhibitors', jp: '出店者向け案内',   body: '次回マーケットの出店についてご案内します。出店をご検討の方はこちらから。',         cta: '案内を受け取る',         href: 'community-exhibitor.html' },
    // クリエイター募集は一旦非表示 → 復活させるときは下の行のコメントを外す
    // { en: 'For Creators', jp: 'クリエイター募集', body: '撮影・動画・SNS・広告など、イベントづくりに関わりたい人を募集中。', cta: 'メンバー募集を見る', href: 'community-creator.html' },
  ],

  /* ▼ 運用メンバー（Members）— 写真カード（右下にSNSアイコン）＋キャッチコピー＋氏名/役職/所属
     ※テキストはサンプルです。実際の内容に書き換えてください。
     - photo : カードの写真
     - sns   : 右下のアイコンとリンク先。{ type:'Instagram', href:'https://...' }
               type は Instagram / X / LinkedIn / TikTok / Facebook / LINE が使えます。
               href が空のあいだはアイコンだけ表示（リンクなし）。インスタURLが届いたら href に貼る。
     - catch : キャッチコピー（太字の見出し）
     - role  : 役職（氏名の右に小さく出る。例：ディレクター）
     - dept  : 所属（例：○○○○○○営業部○○○○○○○○○課）
     - intro / bio / gallery : 個別ページ(member.html)用。今は未使用だが残しておく。 */
  members: [
    {
      slug: 'minami', name: 'MINAMI',
      photo: 'assets/images/member-minami.jpg',
      sns: { type: 'Instagram', href: '' },
      // desc: 複数段落の紹介文（あれば catch より優先して表示。役職・所属は省略可）
      desc: [
        'ファッションを起点に、メディア運営・イベント企画を行っています。',
        '「好き」が集まり、新しい出会いが生まれる場所をつくることをテーマに活動しています。',
        'DRESS CODEではファッションメディアを中心に、ブランド運営やイベント企画を通して、カルチャーの魅力を発信しています。',
      ],
      intro: '（ここに一言紹介を入れてください）',
      bio: ['（ここにプロフィール文を入れてください）'],
      gallery: ['assets/images/member-minami.jpg'],
    },
    {
      slug: 'tubasa', name: 'TSUBASA',
      photo: 'assets/images/member-tubasa.jpg',
      sns: { type: 'Instagram', href: '' },
      catch: 'キャッチコピーが入りますキャッチコピーが入ります',
      role: '（役職）',
      dept: '○○○○○○○○○○○○○○○○○○',
      intro: '（ここに一言紹介を入れてください）',
      bio: ['（ここにプロフィール文を入れてください）'],
      gallery: [],
    },
    {
      slug: 'haruki', name: 'HARUKI',
      photo: 'assets/images/member-haruki.jpg',
      sns: { type: 'Instagram', href: 'https://www.instagram.com/marzo_ll.13/' },
      catch: 'キャッチコピーが入りますキャッチコピーが入ります',
      role: '（役職）',
      dept: '○○○○○○○○○○○○○○○○○○',
      intro: '（ここに一言紹介を入れてください）',
      bio: ['（ここにプロフィール文を入れてください）'],
      gallery: ['assets/images/member-haruki.jpg'],
    },
    {
      slug: 'yui', name: 'YUI',
      photo: 'assets/images/member-yui.jpg',
      sns: { type: 'Instagram', href: 'https://www.instagram.com/yui.ishiko/' },
      catch: 'キャッチコピーが入りますキャッチコピーが入ります',
      role: '（役職）',
      dept: '○○○○○○○○○○○○○○○○○○',
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
