/* =========================================================
   DRESS CODE TOKYO — お知らせ（ヘッダーの通知アイコン）
   ---------------------------------------------------------
   js/auth.js（window.DCT_AUTH）に依存。2種類のお知らせをタブで分けて表示する：
   ・あなたへのお知らせ … notifications テーブル（購入完了/キャンセルなど、本人だけ）
   ・ドレスコードからのお知らせ … announcements テーブル（会員全員向け、未読はブラウザ内で判定）
   ========================================================= */
(function () {
  var LAST_SEEN_KEY = 'dct_announcements_last_seen';
  var drawer = null, listPersonalEl = null, listBroadcastEl = null, tabBtns = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  function ensureDrawer() {
    if (drawer) return drawer;
    drawer = document.createElement('div');
    drawer.id = 'notif-drawer';
    drawer.className = 'drawer';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML =
      '<div class="drawer__backdrop" data-notif-close></div>' +
      '<div class="drawer__panel" role="dialog" aria-modal="true">' +
      '  <button type="button" class="drawer__close" data-notif-close aria-label="閉じる">×</button>' +
      '  <h3 class="drawer__title">お知らせ</h3>' +
      '  <div class="notif-tabs">' +
      '    <button type="button" class="notif-tab is-active" data-notif-tab="personal">あなたへのお知らせ</button>' +
      '    <button type="button" class="notif-tab" data-notif-tab="broadcast">ドレスコードからのお知らせ</button>' +
      '  </div>' +
      '  <div id="notif-list-personal" class="mypage__notifications"><p class="cards-empty">読み込み中…</p></div>' +
      '  <div id="notif-list-broadcast" class="mypage__notifications" hidden><p class="cards-empty">読み込み中…</p></div>' +
      '</div>';
    document.body.appendChild(drawer);
    listPersonalEl = drawer.querySelector('#notif-list-personal');
    listBroadcastEl = drawer.querySelector('#notif-list-broadcast');
    tabBtns = drawer.querySelectorAll('[data-notif-tab]');
    drawer.querySelectorAll('[data-notif-close]').forEach(function (el) { el.addEventListener('click', closeDrawer); });
    tabBtns.forEach(function (btn) { btn.addEventListener('click', function () { switchTab(btn.getAttribute('data-notif-tab')); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
    return drawer;
  }

  function switchTab(name) {
    tabBtns.forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-notif-tab') === name); });
    listPersonalEl.hidden = name !== 'personal';
    listBroadcastEl.hidden = name !== 'broadcast';
  }

  function renderList(el, items, emptyMsg) {
    if (!items.length) { el.innerHTML = '<p class="cards-empty">' + emptyMsg + '</p>'; return; }
    el.innerHTML = items.map(function (n) {
      return '<div class="mypage__notification' + (n.unread ? ' is-unread' : '') + '">' +
        '<div class="mypage__notification-head"><h3>' + esc(n.title) + '</h3>' +
        '<span class="mypage__notification-date">' + new Date(n.created_at).toLocaleDateString('ja-JP') + '</span></div>' +
        '<p>' + esc(n.body) + '</p></div>';
    }).join('');
  }

  function loadPersonal(session) {
    var client = window.DCT_AUTH.getClient();
    client.from('notifications')
      .select('id, title, body, read, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { listPersonalEl.innerHTML = '<p class="cards-empty">読み込みに失敗しました。</p>'; return; }
        var list = res.data || [];
        renderList(listPersonalEl, list.map(function (n) {
          return { title: n.title, body: n.body, created_at: n.created_at, unread: !n.read };
        }), 'お知らせはありません。');
        var unreadIds = list.filter(function (n) { return !n.read; }).map(function (n) { return n.id; });
        if (unreadIds.length) {
          client.from('notifications').update({ read: true }).in('id', unreadIds).then(function () { refreshBadge(); });
        }
      });
  }

  function loadBroadcast() {
    var client = window.DCT_AUTH.getClient();
    client.from('announcements')
      .select('id, title, body, created_at')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(function (res) {
        if (res.error) { listBroadcastEl.innerHTML = '<p class="cards-empty">読み込みに失敗しました。</p>'; return; }
        var list = res.data || [];
        var lastSeen = localStorage.getItem(LAST_SEEN_KEY);
        renderList(listBroadcastEl, list.map(function (n) {
          return { title: n.title, body: n.body, created_at: n.created_at, unread: !lastSeen || new Date(n.created_at) > new Date(lastSeen) };
        }), 'お知らせはありません。');
        if (list.length) { localStorage.setItem(LAST_SEEN_KEY, list[0].created_at); }
        refreshBadge();
      });
  }

  function openDrawer() {
    if (!window.DCT_AUTH || !window.DCT_AUTH.isConfigured()) { window.DCT_AUTH && window.DCT_AUTH.openModal({ tab: 'signin' }); return; }
    var session = window.DCT_AUTH.getSession();
    if (!session) { window.DCT_AUTH.openModal({ tab: 'signin', lead: 'お知らせを見るにはログイン（または新規登録）が必要です。' }); return; }
    ensureDrawer();
    switchTab('personal');
    loadPersonal(session);
    loadBroadcast();
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function setBadge(show) {
    document.querySelectorAll('[data-notif-trigger] .icon-btn__badge').forEach(function (dot) { dot.hidden = !show; });
  }

  function refreshBadge() {
    if (!window.DCT_AUTH || !window.DCT_AUTH.isConfigured()) { setBadge(false); return; }
    var session = window.DCT_AUTH.getSession();
    if (!session) { setBadge(false); return; }
    var client = window.DCT_AUTH.getClient();
    Promise.all([
      client.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id).eq('read', false),
      client.from('announcements').select('created_at').order('created_at', { ascending: false }).limit(1),
    ]).then(function (results) {
      var personalCount = results[0].count || 0;
      var latest = results[1].data && results[1].data[0];
      var lastSeen = localStorage.getItem(LAST_SEEN_KEY);
      var broadcastUnread = !!latest && (!lastSeen || new Date(latest.created_at) > new Date(lastSeen));
      setBadge(personalCount > 0 || broadcastUnread);
    });
  }

  function wireTrigger() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-notif-trigger]');
      if (btn) openDrawer();
    });
  }

  function init() {
    wireTrigger();
    if (!window.DCT_AUTH || !window.DCT_AUTH.isConfigured()) return;
    refreshBadge();
    window.DCT_AUTH.onChange(function () { refreshBadge(); });
  }

  if (window.DCT_AUTH) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
