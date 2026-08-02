/* =========================================================
   販売する商品の正本（サーバー側）
   ---------------------------------------------------------
   js/data.js はブラウザに配るファイルなので、そこに書いてある
   商品名・価格は「表示用」でしかなく、利用者が自由に書き換えて
   /api/checkout に送れてしまう。
   実際に何を売ったことにするかは、必ずこのファイルを正本として決める。

   ■ なぜ必要になったか（2026-08-03）
   以前は /api/checkout がブラウザから送られてきた name と price を
   そのまま purchases に保存していた。決済金額そのものはSquareが
   カタログ側の値段で請求するので不正はできなかったが、
     ・1,000円の入場チケットを買いながら、名前だけ「出店料…」と送る
     → purchases.ticket_name が「出店料…」になる
     → api/square-webhook.js が名前に「出店」を含むかどうかで
       出店者(S)/来場者(N)を判定していたため、S扱いの受付コードが発行される
   という抜け道があった（5,000円の出店枠を1,000円で取得できてしまう）。
   カテゴリも商品名も、ここに書いた catalogObjectId から引くように変更した。

   ■ 商品を増やす・変えるとき
   Square側の商品を作った後、ここに1行足すこと。ここに無い
   catalogObjectId は /api/checkout が受け付けない（意図しない商品や
   アーカイブ済み商品を勝手に買われるのを防ぐため）。
   js/data.js 側の表示用の値も忘れずに合わせること。

   category: 'S' = 出店者 / 'N' = 来場者（受付コードの記号になる）
   ========================================================= */

const CATALOG = {
  // Square Production: 出店料 Item Variation ID
  HHMIQQDFKFPB3BOK6VB2CGSQ: {
    name: '出店料（1ブース・2026.9.27）',
    price: 5000,
    category: 'S',
  },
  // Square Production: 1日入場チケット Item Variation ID
  NIZFJLDR6HEA7ML765JFBAS2: {
    name: '1日入場チケット（2026.9.27）',
    price: 1000,
    category: 'N',
  },
};

function getCatalogItem(catalogObjectId) {
  if (typeof catalogObjectId !== 'string') return null;
  // プロトタイプ汚染（'__proto__' 等を渡される）を避けるため hasOwnProperty で確認する
  if (!Object.prototype.hasOwnProperty.call(CATALOG, catalogObjectId)) return null;
  return CATALOG[catalogObjectId];
}

/* purchases.items（カート内容）から受付コードのカテゴリを決める。
   出店枠と入場チケットを同時に買った場合は、上位である出店者(S)を優先する。
   カタログに無いIDしか無い場合（過去データ等）は null を返し、
   呼び出し側で従来どおり商品名から推測させる。 */
function categoryFromItems(items) {
  if (!Array.isArray(items)) return null;
  let found = null;
  for (const it of items) {
    const entry = getCatalogItem(it && (it.catalogObjectId || it.catalog_object_id));
    if (!entry) continue;
    if (entry.category === 'S') return 'S';
    found = found || entry.category;
  }
  return found;
}

module.exports = { CATALOG, getCatalogItem, categoryFromItems };
