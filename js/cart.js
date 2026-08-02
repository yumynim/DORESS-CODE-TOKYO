/* =========================================================
   DRESS CODE TOKYO — カート（複数商品をまとめてSquareで決済）
   ---------------------------------------------------------
   対象は catalogObjectId が設定されている商品だけ（js/data.js参照）。
   未設定の商品は今まで通り「今すぐ支払う」の単品購入のみ表示される。

   流れ：
   商品カードの「カートに追加」→ 未ログインならまずログインを促す →
   カートに貯める（localStorage）→ カートを開いて「レジに進む」→
   （念のためもう一度ログイン確認）→ /api/checkout に送信 → Squareの決済ページへ遷移
   ========================================================= */
(function () {
  const STORAGE_KEY = 'dct_cart_v1';

  function readCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function writeCart(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    renderCart();
    updateBadge();
  }

  function addToCart(item) {
    const list = readCart();
    const existing = list.find(i => i.catalogObjectId === item.catalogObjectId);
    if (existing) { existing.quantity += 1; }
    else { list.push({ catalogObjectId: item.catalogObjectId, name: item.name, price: item.price, quantity: 1 }); }
    writeCart(list);
    openCart();
  }
  function setQuantity(catalogObjectId, qty) {
    let list = readCart();
    if (qty <= 0) { list = list.filter(i => i.catalogObjectId !== catalogObjectId); }
    else {
      const item = list.find(i => i.catalogObjectId === catalogObjectId);
      if (item) item.quantity = qty;
    }
    writeCart(list);
  }
  function cartTotal(list) { return list.reduce((sum, i) => sum + i.price * i.quantity, 0); }
  function cartCount(list) { return list.reduce((sum, i) => sum + i.quantity, 0); }
  const yen = n => '¥' + Number(n).toLocaleString('ja-JP');

  /* ---------- ヘッダーのカートボタン（件数バッジ） ---------- */
  function updateBadge() {
    const count = cartCount(readCart());
    document.querySelectorAll('[data-cart-trigger] .cart-badge').forEach(el => {
      el.textContent = String(count);
      el.hidden = count === 0;
    });
  }

  /* ---------- カートパネル（ドロワー） ---------- */
  let panel = null, listEl = null, totalEl = null, checkoutBtn = null, errorEl = null;

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'cart-drawer';
    panel.className = 'drawer';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML =
      '<div class="drawer__backdrop" data-cart-close></div>' +
      '<div class="drawer__panel" role="dialog" aria-modal="true">' +
      '  <button type="button" class="drawer__close" data-cart-close aria-label="閉じる">×</button>' +
      '  <h3 class="drawer__title">カート</h3>' +
      '  <div id="cart-list" class="cart-list"></div>' +
      '  <p class="cart-error" id="cart-error" hidden></p>' +
      '  <div class="cart-summary">' +
      '    <span>合計</span><span id="cart-total">¥0</span>' +
      '  </div>' +
      '  <button type="button" class="btn btn--solid cart-checkout" id="cart-checkout">レジに進む（Squareで決済）</button>' +
      '</div>';
    document.body.appendChild(panel);
    listEl = panel.querySelector('#cart-list');
    totalEl = panel.querySelector('#cart-total');
    checkoutBtn = panel.querySelector('#cart-checkout');
    errorEl = panel.querySelector('#cart-error');
    panel.querySelectorAll('[data-cart-close]').forEach(el => el.addEventListener('click', closeCart));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });
    checkoutBtn.addEventListener('click', startCheckout);
    return panel;
  }

  function renderCart() {
    ensurePanel();
    const list = readCart();
    listEl.innerHTML = list.length ? list.map(i => `
      <div class="cart-item" data-id="${i.catalogObjectId}">
        <div class="cart-item__body">
          <span class="cart-item__name">${i.name}</span>
          <span class="cart-item__price">${yen(i.price)}</span>
        </div>
        <div class="cart-item__qty">
          <button type="button" class="cart-item__step" data-step="-1" aria-label="減らす">−</button>
          <span class="cart-item__n">${i.quantity}</span>
          <button type="button" class="cart-item__step" data-step="1" aria-label="増やす">＋</button>
        </div>
      </div>`).join('') : '<p class="cards-empty">カートは空です</p>';

    listEl.querySelectorAll('.cart-item__step').forEach(btn => {
      btn.addEventListener('click', function () {
        const row = btn.closest('.cart-item');
        const id = row.getAttribute('data-id');
        const item = readCart().find(i => i.catalogObjectId === id);
        const delta = Number(btn.getAttribute('data-step'));
        if (item) setQuantity(id, item.quantity + delta);
      });
    });

    totalEl.textContent = yen(cartTotal(list));
    checkoutBtn.disabled = list.length === 0;
  }

  function openCart() {
    ensurePanel();
    renderCart();
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeCart() {
    if (!panel) return;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  /* ---------- チェックアウト：/api/checkout に送って Square の決済ページへ ----------
     Googleログインは別画面へ丸ごと遷移する（=このページのJS状態は消える）ため、
     「カートのお会計をしようとしていた」という事実は sessionStorage に残しておき、
     ログインして戻ってきた時に自動でチェックアウトを再開する。 */
  // localStorage を使う。確認メールのリンクは「別のタブ」で開かれるため、
  // sessionStorage（タブごと）だと、そこで保留していた操作が消えてしまう。
  // 古い保留が延々残らないよう、保存時刻も一緒に入れて一定時間で無効にする。
  const PENDING_TTL_MS = 60 * 60 * 1000; // 1時間
  function setPending(key, value) {
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), value: value })); } catch (e) {}
  }
  function takePending(key) {
    var raw = null;
    try { raw = localStorage.getItem(key); } catch (e) { return null; }
    if (!raw) return null;
    try { localStorage.removeItem(key); } catch (e) {}
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.at !== 'number') return null;
      if (Date.now() - parsed.at > PENDING_TTL_MS) return null;
      return parsed.value;
    } catch (e) { return null; }
  }

  const PENDING_CHECKOUT_KEY = 'dct_pending_checkout';
  function startCheckout() {
    errorEl.hidden = true;
    const auth = window.DCT_AUTH;
    if (!auth || !auth.isConfigured()) { showError('ログイン機能が準備中のため、まだ購入できません。'); return; }
    // ログイン確認が終わる前に判定すると、ログイン済みの人にも新規登録を出してしまう
    auth.ready(function () { proceedCheckout(auth); });
  }

  function proceedCheckout(auth) {
    const session = auth.getSession();
    if (!session) {
      setPending(PENDING_CHECKOUT_KEY, 1);
      closeCart();
      auth.openModal({ tab: 'signup', lead: 'カートのお会計にはログイン（または新規登録）が必要です。' });
      return;
    }
    takePending(PENDING_CHECKOUT_KEY);
    const list = readCart();
    if (!list.length) return;

    checkoutBtn.disabled = true;
    checkoutBtn.textContent = '処理中…';
    fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: list.map(i => ({ catalogObjectId: i.catalogObjectId, quantity: i.quantity, name: i.name, price: i.price })),
        access_token: session.access_token,
      }),
    })
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = 'レジに進む（Squareで決済）';
        if (!ok || !data.url) { showError(data.error || '決済ページの作成に失敗しました。時間をおいて再度お試しください。'); return; }
        // ここでカートを空にしない。Squareの画面で戻ったり、カード入力をやめたりすると、
        // 「カートが空になっただけで何の説明も無い」状態になってしまうため。
        // 支払いが完了した人には members-only.html?thanks=1 側で空にする。
        window.location.href = data.url;
      })
      .catch(() => {
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = 'レジに進む（Squareで決済）';
        showError('通信エラーが発生しました。時間をおいて再度お試しください。');
      });
  }

  /* ---------- 「カートに追加」ボタンの配線（tcard内、data-catalog-id を持つもの） ----------
     未ログインのままカートに商品を貯められると「ログイン不要で買えそう」に見えてしまうため、
     カートに追加する時点でログインを必須にする（レジに進む時点でも別途チェックしているが、
     ここで先に止めることで未ログインの人が購入フローに入れないようにする）。
     ここは catalogObjectId を持つボタン全般にかかる共通処理なので、今後チケットを追加しても
     同じ仕組みがそのまま適用される。 */
  const PENDING_CART_ADD_KEY = 'dct_pending_cart_add';
  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('.tcard__cart-add');
    if (btn) {
      const item = {
        catalogObjectId: btn.getAttribute('data-catalog-id'),
        name: btn.getAttribute('data-name'),
        price: Number(btn.getAttribute('data-price')) || 0,
      };
      const auth = window.DCT_AUTH;
      if (auth && auth.isConfigured()) {
        // ログイン確認はSupabaseへの問い合わせ（非同期）なので、ページを開いた直後は
        // まだ結果が出ていない。ここで getSession() を直に見ると、ログイン済みの人にも
        // 「新規登録」を出してしまうため、必ず ready() で確認の完了を待つ。
        auth.ready(function () {
          if (!auth.getSession()) {
            setPending(PENDING_CART_ADD_KEY, item);
            auth.openModal({ tab: 'signup', lead: 'カートに追加するにはログイン（または新規登録）が必要です。' });
            return;
          }
          addToCart(item);
        });
        return;
      }
      addToCart(item);
      return;
    }
    if (e.target.closest && e.target.closest('[data-cart-trigger]')) { openCart(); }
  });

  document.addEventListener('DOMContentLoaded', function () { ensurePanel(); updateBadge(); });
  if (document.readyState !== 'loading') { ensurePanel(); updateBadge(); }

  /* ---------- ログイン状態が変わったら、保留中のカート追加／チェックアウトがあれば自動で再開 ---------- */
  function resumePending() {
    const pendingAdd = takePending(PENDING_CART_ADD_KEY);
    if (pendingAdd && pendingAdd.catalogObjectId) addToCart(pendingAdd);
    if (takePending(PENDING_CHECKOUT_KEY) && readCart().length) startCheckout();
  }

  function wireResumeCheckout() {
    if (!window.DCT_AUTH) return;
    // ログイン直後（モーダルで完了した場合）
    window.DCT_AUTH.onChange(function (session) { if (session) resumePending(); });
    // 確認メールのリンクを別タブで開いてログイン済みになった場合は onChange が来ないので、
    // ページを開いた時点でログイン済みなら、その場で保留分を処理する。
    window.DCT_AUTH.ready(function (session) { if (session) resumePending(); });
  }
  if (window.DCT_AUTH) { wireResumeCheckout(); }
  else { document.addEventListener('DOMContentLoaded', wireResumeCheckout); }
})();
