/* =========================================================
   DRESS CODE TOKYO — カート（複数商品をまとめてSquareで決済）
   ---------------------------------------------------------
   対象は catalogObjectId が設定されている商品だけ（js/data.js参照）。
   未設定の商品は今まで通り「今すぐ支払う」の単品購入のみ表示される。

   流れ：
   商品カードの「カートに追加」→ カートに貯める（localStorage）→
   カートを開いて「レジに進む」→ 未ログインならログインを促す →
   /api/checkout に送信 → Squareの決済ページへ遷移
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

  /* ---------- チェックアウト：/api/checkout に送って Square の決済ページへ ---------- */
  function startCheckout() {
    errorEl.hidden = true;
    const auth = window.DCT_AUTH;
    if (!auth || !auth.isConfigured()) { showError('ログイン機能が準備中のため、まだ購入できません。'); return; }
    const session = auth.getSession();
    if (!session) {
      closeCart();
      auth.openModal({ tab: 'signup', lead: 'カートのお会計にはログイン（または新規登録）が必要です。' });
      return;
    }
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
        writeCart([]); // 決済ページへ渡した後はカートを空にする
        window.location.href = data.url;
      })
      .catch(() => {
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = 'レジに進む（Squareで決済）';
        showError('通信エラーが発生しました。時間をおいて再度お試しください。');
      });
  }

  /* ---------- 「カートに追加」ボタンの配線（tcard内、data-catalog-id を持つもの） ---------- */
  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('.tcard__cart-add');
    if (btn) {
      addToCart({
        catalogObjectId: btn.getAttribute('data-catalog-id'),
        name: btn.getAttribute('data-name'),
        price: Number(btn.getAttribute('data-price')) || 0,
      });
      return;
    }
    if (e.target.closest && e.target.closest('[data-cart-trigger]')) { openCart(); }
  });

  document.addEventListener('DOMContentLoaded', function () { ensurePanel(); updateBadge(); });
  if (document.readyState !== 'loading') { ensurePanel(); updateBadge(); }
})();
