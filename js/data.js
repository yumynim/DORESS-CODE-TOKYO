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
    { jp: 'マーケットイベント',   en: 'Market Events', img: 'assets/images/group-5.jpg',      href: '#event' },
    { jp: 'スナップ',             en: 'Street Snap',   img: 'assets/images/fitting-selfie.jpg', href: '#magazine' },
    { jp: 'インタビュー',         en: 'Interview',     img: 'assets/images/boutique-talk.jpg',  href: '#magazine' },
    { jp: 'イベントレポート',     en: 'Report',        img: 'assets/images/street-night.jpg',   href: '#magazine' },
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

  /* ▼ Event：キービジュアル（中央の大きな写真枠）。空ならプレースホルダー表示 */
  eventVisual: 'assets/images/fitting-selfie.jpg',

  /* ▼ Event：動画エンベッド
     YouTube/Vimeo の埋め込みコード(<iframe ...>)をそのまま貼り付けると動画になります。
     '' （空）のままなら再生ボタン風のプレースホルダーが表示されます。
     例: videoEmbed: '<iframe src="https://www.youtube.com/embed/XXXX" allowfullscreen></iframe>', */
  videoEmbed: '<iframe width="560" height="315" src="https://www.youtube.com/embed/6T9vhaBwwYc?si=NhB53-W4oXu8NF_3" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>',

  /* ▼ Event：フォトギャラリー
     img に画像パスを入れると写真が表示されます（例: 'assets/images/snap01.jpg'）。
     img を空にすると色付きのプレースホルダーになります。
     ratio は枠の縦横比（'3/4' は縦長、'1/1' は正方形）。 */
  gallery: [
    { label: 'Snap 01',   ratio: '3/4', img: 'assets/images/fitting-selfie.jpg' },
    { label: 'Detail 02', ratio: '1/1', img: 'assets/images/icecream.jpg' },
    { label: 'Crowd 03',  ratio: '3/4', img: 'assets/images/group-5.jpg' },
    { label: 'Shop 04',   ratio: '1/1', img: 'assets/images/snap-polka.jpg' },
    { label: 'Street 05', ratio: '3/4', img: 'assets/images/street-candid.jpg' },
    { label: 'Floor 06',  ratio: '1/1', img: 'assets/images/snap-lumine.jpg' },
    { label: 'Night 07',  ratio: '3/4', img: 'assets/images/street-night.jpg' },
    { label: 'Back 08',   ratio: '1/1', img: 'assets/images/backstage-chair.jpg' },
  ],

  /* ▼ Magazine：カテゴリのタグ（見た目だけ。記事の cat とそろえると分かりやすい） */
  categories: ['Event Report', 'Street Snap', 'Interview', 'Brand Story', 'Fashion', 'Culture'],

  /* ▼ カテゴリごとの色（記事カードの丸ドット・記事ページの見出し色に使用）
     新カテゴリを増やすときは、ここに「'カテゴリ名': '#色'」を足してください。 */
  catColors: {
    'Event Report': '#e8533a',
    'Brand Story':  '#8b46c9',
    'Street Snap':  '#d4459a',
    'Culture':      '#3a4fd6',
    'Fashion':      '#9cc23f',
    'Interview':    '#3fb6a8',
  },

  /* ▼ Magazine：記事一覧 ★ここに { } を足すと記事カードが増えます★
     - cat     : カテゴリ名
     - date    : 日付（表示用の文字列）
     - title   : 記事タイトル
     - excerpt : 一覧に出る短い説明
     - href    : クリック先（記事ページを作ったら 'articles/xxx.html' などに）
     - img     : カバー画像パス（空ならプレースホルダー） */
  articles: [
    {
      cat: 'Event Report', date: '2025.11.18', slug: 'market-vol0',
      title: 'DRESS CODE MARKET Vol.0 開催レポート',
      excerpt: '初開催の熱気と、集まった多様なスタイル。一日のすべてを振り返る。',
      img: 'assets/images/team-cheers.jpg',
      body: [
        { p: '11月の週末、DRESS CODE MARKET の記念すべき Vol.0 が開催されました。「買うためではなく、出会うための一日」をコンセプトに、ブランド・クリエイター・来場者が同じ場所に集まった一日を振り返ります。' },
        { h: '街に散らばっていたスタイルが、一つの場所に' },
        { p: '会場に足を踏み入れてまず驚いたのは、来場者一人ひとりの「ドレスコード」のバラバラさでした。古着で固めた人、ハイブランドを一点だけ効かせた人、自作の服を着てきた人。正解のない着こなしが、そのまま街の多様さを映していました。' },
        { img: 'assets/images/group-5.jpg', cap: '出店者と来場者の距離が近いのも、マーケットならでは。' },
        { p: 'ブースを回るうちに自然と会話が生まれ、気づけば作り手とお客さんが一緒に写真を撮っている。そんな光景が会場のあちこちで見られました。' },
        { quote: '服を入り口に、人とカルチャーが交差する。最初の一歩を、たしかに踏み出せた一日でした。' },
        { p: '夜まで続いた熱気は、そのまま次回 Vol.1 への期待につながっています。次は、あなたのスタイルで参加してください。' },
        { img: 'assets/images/street-night.jpg', cap: 'イベント後も、街に余韻が残っていた。' },
      ],
    },
    {
      cat: 'Brand Story', date: '2025.11.02', slug: 'brand-interview',
      title: '出店ブランドインタビュー：東京の作り手たち',
      excerpt: 'マーケットに並ぶ服の、その向こうにある物語を聞いた。',
      img: 'assets/images/boutique-talk.jpg',
      body: [
        { p: 'マーケットに並ぶ一着には、必ず作り手の物語があります。今回は、出店ブランドの方々に「東京で服を作るということ」について話を聞きました。' },
        { h: '「誰かの普通」を、少しだけ更新したい' },
        { p: '「派手なものを作りたいわけじゃなくて、毎日の延長線上にある服を、ちょっとだけ良くしたいんです」。あるブランドの言葉が印象的でした。流行を追うのではなく、長く着られるものを。その姿勢は、来場者にもまっすぐ伝わっていました。' },
        { img: 'assets/images/fitting-selfie.jpg', cap: '試着して、鏡の前で笑う。その瞬間が一番うれしいと作り手は言う。' },
        { p: '対面で売ることの意味を、みんな口を揃えて語っていました。「反応がその場でわかる」「次に活かせる」。マーケットは、作り手にとっても学びの場になっているようです。' },
      ],
    },
    {
      cat: 'Street Snap', date: '2025.10.27', slug: 'snap-today',
      title: '来場者スナップ：今日のドレスコード',
      excerpt: '会場で出会った、忘れられない着こなしを切り取って。',
      img: 'assets/images/snap-polka.jpg',
      body: [
        { p: '「今日のドレスコードは?」——会場で出会った人たちに声をかけ、その日のスタイルを記録しました。' },
        { img: 'assets/images/snap-lumine.jpg', cap: 'お気に入りのショップ前で一枚。' },
        { p: '正解はありません。気分で選んだ一着も、こだわり抜いたコーディネートも、全部がその人のドレスコード。街で見かけたら、ぜひ声をかけてください。' },
      ],
    },
    {
      cat: 'Culture', date: '2025.10.10', slug: 'behind-the-scenes',
      title: 'イベントの裏側：マーケットができるまで',
      excerpt: '一つのイベントが立ち上がるまでの、舞台裏のドキュメント。',
      img: 'assets/images/backstage-chair.jpg',
      body: [
        { p: '華やかな一日の裏側には、地味で泥臭い準備の積み重ねがあります。会場探し、出店者への声かけ、当日の動線づくり。すべてが手探りでした。' },
        { img: 'assets/images/team-cheers.jpg', cap: '深夜の作戦会議。ここから全部が始まった。' },
        { p: '何度もぶつかって、笑って、アイスを片手にまた話し合って。完璧じゃないけど、自分たちの手で作ったという実感だけは確かにありました。' },
        { img: 'assets/images/icecream.jpg', cap: '差し入れのアイスで小休止。' },
      ],
    },
    {
      cat: 'Fashion', date: '2025.09.30', slug: 'next-highlights',
      title: '次回イベントの見どころ',
      excerpt: 'Vol.1で出会えるブランド、カルチャー、そして人。',
      img: 'assets/images/snap-lumine.jpg',
      body: [
        { p: 'Vol.1 では、出店ブランドも来場者参加の企画もさらにパワーアップ予定。ここでしか出会えないスタイルが、もっと増えます。' },
        { p: '詳細は順次このマガジンとコミュニティで発信していきます。お楽しみに。' },
      ],
    },
    {
      cat: 'Interview', date: '2025.09.12', slug: 'creator-talk',
      title: 'クリエイター対談：東京で作るということ',
      excerpt: '写真家、スタイリスト、デザイナー。街を作る三者が語る。',
      img: 'assets/images/group-5.jpg',
      body: [
        { p: '写真家、スタイリスト、デザイナー。立場の違う三人に、東京でものを作る面白さと難しさを語ってもらいました。' },
        { quote: '東京は、誰かの「好き」が必ず誰かに刺さる街。だから挑戦しがいがある。' },
        { p: '異なるジャンルが交差することで、新しい表現が生まれる。DRESS CODE は、その交差点でありたいと思っています。' },
      ],
    },
  ],

  /* ▼ Community：3つの募集カード
     href = カードのリンク先。外部URLでもOK（外部は自動で別タブで開きます）。 */
  community: [
    { en: 'For Everyone',   jp: 'メンバー募集',         body: 'イベントの先行案内や限定情報を受け取れる、DRESS CODE のコアコミュニティ。', cta: 'コミュニティに参加する', href: 'https://celestial-finalhomelink.vercel.app/' },
    { en: 'For Exhibitors', jp: '出店者向け先行案内',   body: '次回マーケットの出店枠を、一般公開より先にご案内します。',                 cta: '先行案内を受け取る',     href: 'community-exhibitor.html' },
    { en: 'For Creators',   jp: 'クリエイター募集',     body: '撮影・動画・SNS・広告など、イベントづくりに関わりたい人を募集中。',         cta: 'メンバー募集を見る',     href: 'community-creator.html' },
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
      slug: 'ran', name: 'RAN', role: 'Founder / Director',
      photo: 'assets/images/snap-lumine.jpg',
      intro: '東京のファッションとカルチャーをつなぐ場をつくりたくて DRESS CODE TOKYO を立ち上げ。マーケットの企画から全体のディレクションまでを担当しています。',
      bio: [
        'DRESS CODE TOKYO のファウンダー兼ディレクター。学生時代から古着とストリートカルチャーにのめり込み、「服をきっかけに人がつながる場所」を東京につくることを目標にしています。',
        'マーケットイベントの企画・出店者とのやりとり・当日のディレクションまで、イベント全体の舵取りを担当。「買うためではなく、出会うための一日」を合言葉に活動中。',
      ],
      gallery: ['assets/images/snap-lumine.jpg', 'assets/images/snap-polka.jpg', 'assets/images/fitting-selfie.jpg', 'assets/images/boutique-talk.jpg'],
    },
    {
      slug: 'kei', name: 'KEI', role: 'Photographer / Snap',
      photo: 'assets/images/street-candid.jpg',
      intro: '会場の空気や来場者のスタイルを切り取る、スナップ＆記録担当。マガジンの写真の多くを撮っています。',
      bio: [
        'イベントの記録とスナップを担当するフォトグラファー。会場の熱気、来場者の何気ない着こなし、出店者の表情——その場でしか撮れない一瞬を残すことを大切にしています。',
        'マガジンの「Street Snap」「Event Report」の写真の多くを担当。撮影だけでなく、動画やSNS用のコンテンツづくりにも関わっています。',
      ],
      gallery: ['assets/images/street-candid.jpg', 'assets/images/street-night.jpg', 'assets/images/group-5.jpg', 'assets/images/team-cheers.jpg'],
    },
    {
      slug: 'misaki', name: 'MISAKI', role: 'Community / Creative',
      photo: 'assets/images/group-5.jpg',
      intro: 'コミュニティ運営とクリエイティブ担当。出店者・来場者・クリエイターをつなぐ役回りです。',
      bio: [
        'コミュニティの運営とクリエイティブまわりを担当。先行案内やメンバー募集の窓口として、イベントに関わりたい人たちをつなげる役割を担っています。',
        'SNS の発信、ビジュアルづくり、当日の運営サポートまで幅広く担当。「関わる人みんなが主役になれるイベント」を目指しています。',
      ],
      gallery: ['assets/images/group-5.jpg', 'assets/images/icecream.jpg', 'assets/images/backstage-chair.jpg', 'assets/images/team-cheers.jpg'],
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
     LINE と Facebook の href は実際の URL に差し替えてください。 */
  socials: [
    { label: 'Instagram', sub: '@dress.code_tokyo',       href: 'https://www.instagram.com/dress.code_tokyo/' },
    { label: 'Instagram', sub: '@dresscode.tokyo_media',  href: 'https://www.instagram.com/dresscode.tokyo_media/' },
    { label: 'TikTok',    sub: '@dress.code_tokyo',       href: 'https://www.tiktok.com/@dress.code_tokyo' },
    { label: 'Facebook',  sub: 'Dress Code Tokyo',        href: '#' },
    { label: 'LINE',      sub: 'DRESS CODE TOKYO',        href: '#' },
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
