/* =========================================================
   DRESS CODE TOKYO — 会員登録・ログイン
   ---------------------------------------------------------
   Supabase（js/auth-config.js に URL / anon key を設定）を使って
   ・新規登録／ログイン／ログアウト
   ・ヘッダーの「ログイン」ボタンの出し分け（未ログイン→ログイン導線／ログイン中→マイページ導線）
   ・チケット購入ボタン：未ログインならログインを促す。ログイン中なら購入履歴を記録
   を行います。
   auth-config.js が空のままでも壊れないよう、その場合は「準備中」表示にフォールバックします。
   ========================================================= */
(function () {
  var CONFIG = window.SUPABASE_CONFIG || { url: '', anonKey: '' };
  var CONFIGURED = !!(CONFIG.url && CONFIG.anonKey);
  var client = null;
  if (CONFIGURED && window.supabase && window.supabase.createClient) {
    client = window.supabase.createClient(CONFIG.url, CONFIG.anonKey);
  }

  var session = null;              // 現在のログインセッション（未ログインなら null）
  var pendingTicket = null;        // ログイン前にチケット購入を押した場合、ログイン後に再開するための一時保存
  var listeners = [];              // ログイン状態が変わったときに呼ぶコールバック

  function notify() { listeners.forEach(function (fn) { try { fn(session); } catch (e) {} }); }

  /* ---------- モーダル DOM を組み立てて body 末尾に差し込む ---------- */
  function buildModal() {
    var wrap = document.createElement('div');
    wrap.id = 'auth-modal';
    wrap.className = 'auth-modal';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML =
      '<div class="auth-modal__backdrop" data-auth-close></div>' +
      '<div class="auth-modal__panel" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">' +
      '  <button type="button" class="auth-modal__close" data-auth-close aria-label="閉じる">×</button>' +
      '  <div class="auth-modal__tabs">' +
      '    <button type="button" class="auth-modal__tab is-active" data-auth-tab="signin">ログイン</button>' +
      '    <button type="button" class="auth-modal__tab" data-auth-tab="signup">新規登録</button>' +
      '  </div>' +
      '  <h3 id="auth-modal-title" class="auth-modal__title">アカウントにログイン</h3>' +
      '  <p class="auth-modal__lead" id="auth-modal-lead" hidden></p>' +
      '  <p class="auth-modal__notice" id="auth-modal-notice" hidden></p>' +
      '  <form id="auth-form-signin" class="auth-form">' +
      '    <label>メールアドレス<input type="email" name="email" required autocomplete="email"></label>' +
      '    <label>パスワード<input type="password" name="password" required autocomplete="current-password"></label>' +
      '    <p class="auth-form__error" hidden></p>' +
      '    <button type="submit" class="btn btn--solid auth-form__submit">ログイン</button>' +
      '  </form>' +
      '  <form id="auth-form-signup" class="auth-form" hidden>' +
      '    <label>お名前<input type="text" name="displayName" required autocomplete="name"></label>' +
      '    <label>メールアドレス<input type="email" name="email" required autocomplete="email"></label>' +
      '    <label>パスワード（6文字以上）<input type="password" name="password" required minlength="6" autocomplete="new-password"></label>' +
      '    <p class="auth-form__error" hidden></p>' +
      '    <button type="submit" class="btn btn--solid auth-form__submit">登録する</button>' +
      '  </form>' +
      '</div>';
    document.body.appendChild(wrap);
    return wrap;
  }

  var modal = null, elLead = null, elNotice = null, formSignin = null, formSignup = null, tabBtns = null, titleEl = null;

  function ensureModal() {
    if (modal) return modal;
    modal = buildModal();
    elLead = modal.querySelector('#auth-modal-lead');
    elNotice = modal.querySelector('#auth-modal-notice');
    formSignin = modal.querySelector('#auth-form-signin');
    formSignup = modal.querySelector('#auth-form-signup');
    tabBtns = modal.querySelectorAll('.auth-modal__tab');
    titleEl = modal.querySelector('#auth-modal-title');

    modal.querySelectorAll('[data-auth-close]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.getAttribute('data-auth-tab')); });
    });

    if (!CONFIGURED) {
      elNotice.hidden = false;
      elNotice.textContent = 'ログイン機能は現在準備中です。もうしばらくお待ちください。';
      formSignin.hidden = true;
      formSignup.hidden = true;
      modal.querySelector('.auth-modal__tabs').hidden = true;
    } else {
      formSignin.addEventListener('submit', handleSignin);
      formSignup.addEventListener('submit', handleSignup);
    }
    return modal;
  }

  function switchTab(name) {
    tabBtns.forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-auth-tab') === name); });
    var isSignin = name === 'signin';
    formSignin.hidden = !isSignin;
    formSignup.hidden = isSignin;
    titleEl.textContent = isSignin ? 'アカウントにログイン' : '新規登録して会員になる';
    clearFormErrors();
  }

  function clearFormErrors() {
    modal.querySelectorAll('.auth-form__error').forEach(function (p) { p.hidden = true; p.textContent = ''; });
  }
  function showFormError(form, message) {
    var p = form.querySelector('.auth-form__error');
    p.textContent = message;
    p.hidden = false;
  }

  function openModal(opts) {
    opts = opts || {};
    ensureModal();
    if (session) { window.location.href = 'members-only.html'; return; }
    if (opts.lead) { elLead.hidden = false; elLead.textContent = opts.lead; } else { elLead.hidden = true; }
    if (CONFIGURED) switchTab(opts.tab || 'signin');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var firstInput = modal.querySelector(CONFIGURED ? ((opts.tab === 'signup') ? '#auth-form-signup input' : '#auth-form-signin input') : '.auth-modal__notice');
    if (firstInput && firstInput.focus) setTimeout(function () { firstInput.focus(); }, 50);
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function setButtonBusy(btn, busy, label) {
    btn.disabled = busy;
    btn.textContent = busy ? '処理中…' : label;
  }

  function handleSignin(e) {
    e.preventDefault();
    clearFormErrors();
    var f = e.target;
    var email = f.email.value.trim();
    var password = f.password.value;
    var btn = f.querySelector('.auth-form__submit');
    setButtonBusy(btn, true, 'ログイン');
    client.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      setButtonBusy(btn, false, 'ログイン');
      if (res.error) { showFormError(f, 'ログインできませんでした：' + res.error.message); return; }
      onAuthed(res.data.session);
    });
  }

  function handleSignup(e) {
    e.preventDefault();
    clearFormErrors();
    var f = e.target;
    var displayName = f.displayName.value.trim();
    var email = f.email.value.trim();
    var password = f.password.value;
    var btn = f.querySelector('.auth-form__submit');
    setButtonBusy(btn, true, '登録する');
    client.auth.signUp({
      email: email, password: password,
      options: { data: { display_name: displayName } }
    }).then(function (res) {
      setButtonBusy(btn, false, '登録する');
      if (res.error) { showFormError(f, '登録できませんでした：' + res.error.message); return; }
      if (res.data.session) { onAuthed(res.data.session); return; }
      // メール確認が必須の設定の場合はセッションが返らない
      elNotice.hidden = false;
      elNotice.textContent = '確認メールを送りました。メール内のリンクを開いて登録を完了してください。';
    });
  }

  function onAuthed(newSession) {
    session = newSession;
    closeModal();
    notify();
    if (pendingTicket) {
      var t = pendingTicket; pendingTicket = null;
      recordPurchase(t);
      window.open(t.url, '_blank', 'noopener');
    }
  }

  function recordPurchase(t) {
    if (!client || !session) return;
    client.from('purchases').insert({
      user_id: session.user.id,
      ticket_name: t.name,
      price: t.price,
      status: 'initiated',
      square_url: t.url,
    }).then(function (res) {
      if (res.error) console.warn('purchases insert failed:', res.error.message);
    });
  }

  /* ---------- ヘッダーの「ログイン」ボタンの出し分け ---------- */
  function paintAuthButtons() {
    document.querySelectorAll('[data-auth-trigger]').forEach(function (btn) {
      if (!CONFIGURED) { btn.textContent = 'ログイン'; return; }
      if (session) {
        var name = (session.user.user_metadata && session.user.user_metadata.display_name) || session.user.email;
        btn.textContent = 'マイページ';
        btn.setAttribute('title', name + ' としてログイン中');
      } else {
        btn.textContent = 'ログイン';
        btn.removeAttribute('title');
      }
    });
  }

  function wireAuthButtons() {
    document.querySelectorAll('[data-auth-trigger]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (CONFIGURED && session) { window.location.href = 'members-only.html'; return; }
        openModal({ tab: 'signin' });
      });
    });
  }

  /* ---------- チケット購入ボタン：未ログインならログインへ誘導、ログイン中なら履歴を記録 ---------- */
  function wireTicketButtons() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.tcard__buy[data-ticket-name]');
      if (!btn) return;
      if (!CONFIGURED) return; // 未設定時は今まで通りそのままリンクを開く
      var ticket = {
        name: btn.getAttribute('data-ticket-name'),
        price: Number(btn.getAttribute('data-ticket-price')) || 0,
        url: btn.getAttribute('href'),
      };
      if (!session) {
        e.preventDefault();
        pendingTicket = ticket;
        openModal({ tab: 'signup', lead: 'チケットの購入にはログイン（または新規登録）が必要です。' });
        return;
      }
      recordPurchase(ticket); // リンクはそのまま開かせる（購入自体はSquare側で完結）
    });
  }

  /* ---------- 初期化 ---------- */
  function init() {
    wireAuthButtons();
    wireTicketButtons();
    if (!CONFIGURED) { paintAuthButtons(); return; }
    client.auth.getSession().then(function (res) {
      session = res.data.session;
      paintAuthButtons();
      notify();
    });
    client.auth.onAuthStateChange(function (_event, newSession) {
      session = newSession;
      paintAuthButtons();
      notify();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  /* 他のページ（マイページ等）から使えるように公開 */
  window.DCT_AUTH = {
    isConfigured: function () { return CONFIGURED; },
    getClient: function () { return client; },
    getSession: function () { return session; },
    onChange: function (fn) { listeners.push(fn); },
    signOut: function () { return client ? client.auth.signOut() : Promise.resolve(); },
    openModal: openModal,
  };
})();
