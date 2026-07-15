/* =========================================================
   DRESS CODE TOKYO — 描画スクリプト（基本さわらなくてOK）
   data.js の内容を読み取って各セクションに HTML を流し込みます。
   見た目（色・余白・ホバー）は css/style.css のクラスで管理。
   ========================================================= */
(function () {
  const S = window.SITE || {};
  function fill(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }

  /* ---------- ヒーローのメイン写真（あれば全面に） ---------- */
  if (S.heroImage) {
    const hero = document.getElementById('top');
    const media = document.getElementById('hero-media');
    if (hero && media) { hero.classList.add('has-img'); media.innerHTML = `<img src="${S.heroImage}" alt="">`; }
  }

  /* ---------- ナビ ---------- */
  const navHtml = (S.nav || []).map(i => `<a href="${i.href}">${i.label}</a>`).join('');
  fill('nav-desktop', navHtml);
  fill('nav-mobile', (S.nav || []).map(i => `<a href="${i.href}" data-close>${i.label}</a>`).join(''));
  fill('footer-sitemap', navHtml);

  /* ---------- カテゴリタイル（activities） ---------- */
  fill('tiles', (S.activities || []).map(a => {
    if (a.img) {
      return `<a href="${a.href || '#magazine'}" class="tile reveal">
        <div class="tile__media"><img src="${a.img}" alt="${a.jp}" loading="lazy" decoding="async"></div>
        <span class="tile__arrow">↗</span>
        <div class="tile__label"><span class="jp">${a.jp}</span><span class="en">${a.en}</span></div>
      </a>`;
    }
    return `<a href="${a.href || '#magazine'}" class="tile is-empty reveal">
      <span class="ph">Photo — 差し替え可</span>
      <span class="tile__arrow">↗</span>
      <div class="tile__label"><span class="jp">${a.jp}</span><span class="en">${a.en}</span></div>
    </a>`;
  }).join(''));

  /* ---------- About: 活動リスト ---------- */
  fill('about-activities', (S.activities || []).map(a =>
    `<div class="deflist__row"><span class="jp">${a.jp}</span><span class="en">${a.en}</span></div>`
  ).join(''));

  /* ---------- Event: 開催情報 ---------- */
  fill('event-info', (S.eventInfo || []).map(r =>
    `<div class="eventbar__row"><span class="k">${r.k}</span><span class="v">${r.v}</span></div>`
  ).join(''));

  /* ---------- Event: CTA ---------- */
  fill('event-ctas', (S.eventCtas || []).map(c =>
    `<a href="${c.href}"><span><span class="en">${c.en}</span><span class="jp">${c.jp}</span></span><span class="arrow">→</span></a>`
  ).join(''));

  /* ---------- Event: How to enjoy ---------- */
  fill('enjoy', (S.enjoy || []).map(e =>
    `<div><div class="enjoy__no">${e.no}</div><h4>${e.title}</h4><p>${e.body}</p></div>`
  ).join(''));

  /* ---------- Gallery ---------- */
  fill('gallery', (S.gallery || []).map(g => {
    // masonry（縦に流れる）レイアウト。写真は自然な高さで並ぶので動きが出る。
    // 写真が無い項目だけ ratio で高さを確保（プレースホルダー用）。
    const img = g.img
      ? `<img src="${g.img}" alt="${g.label}" loading="lazy" decoding="async">`
      : `<div class="gallery__ph" style="aspect-ratio:${g.ratio}"></div>`;
    return `<div class="gallery__item reveal${g.img ? ' has-img' : ''}">${img}<span class="label">${g.label}</span></div>`;
  }).join(''));

  /* ---------- Magazine: カテゴリ名の対応表（key→表示ラベル） ---------- */
  const MAGCATS = S.magCats || [{ key: 'fashion', label: 'Fashion' }, { key: 'shop', label: 'Shop' }];
  function magCatLabel(key) { const m = MAGCATS.find(c => c.key === key); return m ? m.label : (key || ''); }

  /* ---------- Magazine: 記事カード（画像の上にカテゴリ＋タイトルを重ねる。popeye風オーバーレイ） ---------- */
  function magCard(a) {
    const cover = (a.images && a.images[0]) || a.img || '';
    const media = cover
      ? `<img src="${cover}" alt="${a.title || ''}" loading="lazy" decoding="async">`
      : `<span class="card__ph">Photo</span>`;
    const sub = a.brand || a.credit || '';
    // 画像の上に載せる帯：カテゴリ（小さなラベル）→ タイトル → サブ（ブランド等）
    return `<a href="article.html?id=${a.slug}" class="magcard" data-cat="${a.cat || ''}">
      <div class="magcard__media">
        ${media}
        <div class="magcard__overlay">
          <span class="magcard__cat">${magCatLabel(a.cat)}</span>
          <div class="magcard__caption">
            <h3 class="magcard__title">${a.title || ''}</h3>
            ${sub ? `<p class="magcard__brand">${sub}</p>` : ''}
          </div>
          ${a.date ? `<span class="magcard__date">${a.date}</span>` : ''}
        </div>
      </div>
    </a>`;
  }
  // イベントレポート用のカード（フライヤー／写真。2枚以上あると左右矢印・スワイプで横にスライド切り替え）
  function reportCard(r) {
    const imgs = (r.images && r.images.length) ? r.images : (r.img ? [r.img] : []);
    const slides = imgs.length
      ? imgs.map(src => `<a class="rcard__slide" href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="${r.title || ''}" loading="lazy" decoding="async" draggable="false"></a>`).join('')
      : `<span class="card__ph">Photo</span>`;
    const nav = imgs.length > 1
      ? `<button type="button" class="rcard__nav rcard__nav--prev" aria-label="前の写真">‹</button>
         <button type="button" class="rcard__nav rcard__nav--next" aria-label="次の写真">›</button>
         <div class="rcard__dots">${imgs.map((_, i) => `<span class="${i === 0 ? 'is-active' : ''}"></span>`).join('')}</div>`
      : '';
    return `<div class="rcard reveal" data-count="${imgs.length}">
      <div class="rcard__media"><div class="rcard__track">${slides}</div>${nav}</div>
      <div class="rcard__body">
        ${r.date ? `<div class="rcard__date">${r.date}</div>` : ''}
        <h3 class="rcard__title">${r.title || ''}</h3>
        ${r.excerpt ? `<p class="rcard__excerpt">${r.excerpt}</p>` : ''}
      </div>
    </div>`;
  }
  // レポートカードの左右矢印・ドット・スワイプ操作を配線（複数枚あるカードのみ）
  function wireReportCarousels() {
    document.querySelectorAll('#reports .rcard').forEach(function (card) {
      const media = card.querySelector('.rcard__media');
      const track = card.querySelector('.rcard__track');
      const slides = [...card.querySelectorAll('.rcard__slide')];
      if (slides.length < 2) return;
      const dots = [...card.querySelectorAll('.rcard__dots span')];
      let idx = 0, dragging = false, moved = false, axis = null, startX = 0, startY = 0, deltaX = 0, pid = null;

      function render(withTransition) {
        track.style.transition = withTransition ? '' : 'none';
        track.style.transform = 'translateX(' + (-idx * 100) + '%)';
        dots.forEach((d, j) => d.classList.toggle('is-active', j === idx));
      }
      function goTo(i) { idx = (i + slides.length) % slides.length; render(true); }
      render(false);

      const prev = card.querySelector('.rcard__nav--prev');
      const next = card.querySelector('.rcard__nav--next');
      if (prev) prev.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); goTo(idx - 1); });
      if (next) next.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); goTo(idx + 1); });

      // スワイプ／ドラッグ：最初の指の動きで縦横を判定（軸ロック）。
      // 横方向のときだけ画像送り、縦方向のときはページスクロールに任せる
      // → 少し上下に指がぶれてもガタつかず、縦スクロールも妨げない。
      media.addEventListener('pointerdown', function (e) {
        if (e.target.closest('.rcard__nav')) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        dragging = true; moved = false; axis = null;
        startX = e.clientX; startY = e.clientY; deltaX = 0; pid = e.pointerId;
        track.style.transition = 'none';
      });
      media.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        const mx = e.clientX - startX;
        const my = e.clientY - startY;
        if (axis === null) {
          if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;   // まだ判定できる動きではない
          axis = Math.abs(mx) >= Math.abs(my) ? 'x' : 'y';    // 横優先で確定
          if (axis === 'x') { try { media.setPointerCapture(pid); } catch (_) {} }
        }
        if (axis !== 'x') return;                              // 縦 → 何もしない（スクロールに任せる）
        moved = true;
        deltaX = mx;
        // 端（1枚目で右／最後で左）は抵抗を付けて「これ以上ない」ことを指で伝える
        if ((idx === 0 && deltaX > 0) || (idx === slides.length - 1 && deltaX < 0)) deltaX = deltaX / 3;
        track.style.transform = 'translateX(calc(' + (-idx * 100) + '% + ' + deltaX + 'px))';
      });
      // 横スワイプ確定後は、ブラウザの縦スクロール横取りを止める（pointermoveのpreventDefaultでは
      // スクロールは止まらないため、非passiveなtouchmoveで止める。これがスマホでのガタつきの主因）
      media.addEventListener('touchmove', function (e) {
        if (axis === 'x' && e.cancelable) e.preventDefault();
      }, { passive: false });
      function endDrag() {
        if (!dragging) return;
        dragging = false;
        if (axis === 'x') {
          const w = media.clientWidth || 1;
          const threshold = Math.min(w * 0.14, 60);           // 送りやすいしきい値
          // スワイプは端でループさせない（1枚目→最後へ全スライド横断する巨大アニメを防ぐ）
          if (deltaX <= -threshold && idx < slides.length - 1) goTo(idx + 1);
          else if (deltaX >= threshold && idx > 0) goTo(idx - 1);
          else render(true);
        }
        axis = null;
      }
      media.addEventListener('pointerup', endDrag);
      media.addEventListener('pointercancel', endDrag);

      // ドラッグ（スワイプ）した直後は、写真の拡大リンクへ飛ばさない
      slides.forEach(s => s.addEventListener('click', e => { if (moved) e.preventDefault(); }));
    });
  }
  // カードを流し込む。中身が空のときは「近日公開」の控えめ表示にする。
  function fillCards(id, list, builder) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = (list && list.length)
      ? list.map(builder).join('')
      : '<p class="cards-empty">近日公開 — Coming soon.</p>';
  }
  fillCards('articles', S.articles, magCard);
  fillCards('reports', S.reports, reportCard);
  wireReportCarousels();

  /* ---------- チケット：Square 決済リンクのカード（フライヤー下・PCはカルーセル） ---------- */
  function yen(n) {
    const num = Number(String(n).replace(/[^\d.]/g, ''));
    return isFinite(num) && num > 0 ? '¥' + num.toLocaleString('ja-JP') : String(n || '');
  }
  function ticketCard(t) {
    const media = t.img
      ? `<img src="${t.img}" alt="${t.name || ''}" loading="lazy" decoding="async">`
      : `<span class="tcard__ph" aria-hidden="true">${(t.name || 'T').trim().charAt(0)}</span>`;
    const buy = t.url
      ? `<a class="tcard__buy" href="${t.url}" target="_blank" rel="noopener">今すぐ支払う</a>`
      : `<span class="tcard__buy is-disabled" aria-disabled="true">準備中</span>`;
    return `<div class="tcard reveal">
      <div class="tcard__media">${media}</div>
      <div class="tcard__body">
        <h4 class="tcard__name">${t.name || ''}</h4>
        ${t.note ? `<p class="tcard__note">${t.note}</p>` : ''}
        <div class="tcard__price"><span class="tcard__price-k">価格</span><span class="tcard__price-v">${yen(t.price)}</span><span class="tcard__tax">税込</span></div>
        ${buy}
      </div>
    </div>`;
  }
  (function () {
    const wrap = document.getElementById('tickets');
    const list = S.tickets || [];
    if (!wrap) return;
    if (!list.length) { wrap.hidden = true; return; }   // チケットが無いときはセクションごと非表示
    wrap.hidden = false;
    fillCards('ticket-cards', list, ticketCard);
  })();

  /* ---------- Magazine: カテゴリのフィルタ（All / Fashion / Shop） ---------- */
  (function () {
    const fbox = document.getElementById('mag-filters');
    const track = document.getElementById('articles');
    if (!fbox || !track) return;
    const btns = [{ key: 'all', label: 'All' }].concat(MAGCATS);
    fbox.innerHTML = btns.map((b, i) =>
      `<button type="button" class="magfilter__btn${i === 0 ? ' is-active' : ''}" data-cat="${b.key}">${b.label}</button>`
    ).join('');
    fbox.addEventListener('click', function (e) {
      const btn = e.target.closest('.magfilter__btn');
      if (!btn) return;
      const cat = btn.getAttribute('data-cat');
      fbox.querySelectorAll('.magfilter__btn').forEach(b => b.classList.toggle('is-active', b === btn));
      track.querySelectorAll('.magcard').forEach(card => {
        const show = (cat === 'all') || (card.getAttribute('data-cat') === cat);
        card.classList.toggle('is-hidden', !show);
      });
      track.scrollTo({ left: 0, behavior: 'smooth' });
      track.dispatchEvent(new Event('carousel:refresh'));
    });
  })();

  /* ---------- 汎用カルーセル（横スクロール＋PCの左右矢印） ---------- */
  document.querySelectorAll('.carousel').forEach(function (car) {
    const track = car.querySelector('.carousel__track');
    const prev = car.querySelector('.carousel__nav--prev');
    const next = car.querySelector('.carousel__nav--next');
    if (!track) return;
    function step() {
      const card = track.querySelector(':scope > *:not(.is-hidden)');
      const gap = parseFloat(getComputedStyle(track).columnGap) || 24;
      return card ? card.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
    }
    function update() {
      const max = track.scrollWidth - track.clientWidth - 2;
      const overflow = max > 2;
      car.classList.toggle('has-overflow', overflow);
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max;
    }
    if (prev) prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    if (next) next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    track.addEventListener('scroll', update, { passive: true });
    track.addEventListener('carousel:refresh', update);
    window.addEventListener('resize', update);
    // 画像読み込みで幅が変わるので、少し遅らせても再計算
    setTimeout(update, 60); setTimeout(update, 400);
    update();
  });

  /* ---------- Community（カードごとに別ページへ） ---------- */
  fill('community-cards', (S.community || []).map(c => {
    const href = c.href || '#contact';
    const ext = /^https?:/.test(href);
    const attr = ext ? ' target="_blank" rel="noopener"' : '';
    return `<a class="ccard reveal" href="${href}"${attr}>
      <div class="en">${c.en}</div>
      <h3>${c.jp}</h3>
      <p>${c.body}</p>
      <span class="more">${c.cta} →</span>
    </a>`;
  }).join(''));

  /* ---------- 運用メンバーのカードは、下の SNS アイコン定義のあとで描画します ---------- */

  /* ---------- Contact: 理由（embed のある項目は「＋」で開くフォーム） ---------- */
  fill('contact-reasons', (S.contactReasons || []).map(r => {
    if (r.embed) {
      // iframe は開くまで読み込ませない（src → data-src、lazy属性は除去）。
      // 開いた瞬間に src をセットして確実に表示する（display:none 内の lazy 未読込を回避）。
      const embed = r.embed.replace(/\sloading="lazy"/i, '').replace(/\ssrc=/i, ' data-src=');
      return `<div class="reasons__item">
        <button type="button" class="reasons__row reasons__row--toggle" aria-expanded="false">
          <span class="no">${r.no}</span><span class="jp">${r.jp}</span>
          <span class="reasons__plus" aria-hidden="true">＋</span>
        </button>
        <div class="reasons__panel"><div class="reasons__panel-in">${embed}</div></div>
      </div>`;
    }
    return `<div class="reasons__row"><span class="no">${r.no}</span><span class="jp">${r.jp}</span><span class="en">${r.en}</span></div>`;
  }).join(''));
  document.querySelectorAll('.reasons__row--toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const item = btn.closest('.reasons__item');
      const open = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        const ifr = item.querySelector('iframe[data-src]');
        if (ifr && !ifr.getAttribute('src')) { ifr.setAttribute('src', ifr.getAttribute('data-src')); }
      }
    });
  });

  /* ---------- SNS アイコン ---------- */
  var _SNS = {
    Instagram: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
    TikTok:    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
    Facebook:  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
    LINE:      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.365 9.863c.349 0 .63.285.63.63 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>',
    X:         '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    LinkedIn:  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/></svg>',
  };

  /* ---------- 運用メンバー（写真カード＋右下SNSバッジ） ---------- */
  fill('members-list', (S.members || []).map(function (m) {
    var sns = m.sns || {};
    var icon = _SNS[sns.type] || _SNS.Instagram;
    var badge = sns.href
      ? '<a class="mcard__sns" href="' + sns.href + '" target="_blank" rel="noopener" aria-label="' + (sns.type || 'SNS') + '">' + icon + '</a>'
      : '<span class="mcard__sns" aria-hidden="true">' + icon + '</span>';
    // desc（複数段落）があれば通常文で表示、無ければ catch（太字）を表示
    var body = (m.desc && m.desc.length)
      ? '<div class="mcard__desc">' + m.desc.map(function (p) { return '<p>' + p + '</p>'; }).join('') + '</div>'
      : (m.catch ? '<p class="mcard__catch">' + m.catch + '</p>' : '');
    return '<div class="mcard reveal">'
      + '<div class="mcard__media"><img src="' + m.photo + '" alt="' + m.name + '" loading="lazy" decoding="async">' + badge + '</div>'
      + '<div class="mcard__body">'
      + '<div class="mcard__person"><span class="mcard__name">' + m.name + '</span>'
      + (m.role ? '<span class="mcard__role">' + m.role + '</span>' : '')
      + '</div>'
      + (m.dept ? '<p class="mcard__dept">' + m.dept + '</p>' : '')
      + body
      + '</div>'
      + '</div>';
  }).join(''));

  var socialsHtml = (S.socials || []).map(function (s) {
    var icon = _SNS[s.label] || '';
    var ext = /^https?:/.test(s.href);
    var target = ext ? ' target="_blank" rel="noopener"' : '';
    var nick = s.nick ? '<span class="sns-nick">' + s.nick + '</span>' : '';
    return '<a class="sns-btn" href="' + s.href + '"' + target + ' aria-label="' + s.label + (s.sub ? ' ' + s.sub : '') + '" title="' + (s.sub || s.label) + '">' + icon + nick + '</a>';
  }).join('');
  (function () {
    ['contact-socials', 'footer-socials'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.className = 'sns-icons'; el.innerHTML = socialsHtml; }
    });
  })();

  /* ---------- 画像ライトボックス（チラシ等をタップで拡大） ---------- */
  function ensureLightbox() {
    let lb = document.getElementById('lightbox');
    if (lb) return lb;
    lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.innerHTML = '<button type="button" class="lightbox__close" aria-label="閉じる">×</button><img alt="">';
    document.body.appendChild(lb);
    function close() { lb.classList.remove('open'); document.body.style.overflow = ''; }
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.classList.contains('lightbox__close')) close();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    lb._close = close;
    return lb;
  }
  function openLightbox(src, alt) {
    const lb = ensureLightbox();
    const img = lb.querySelector('img');
    img.src = src; img.alt = alt || '';
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  /* ---------- Event キービジュアル写真（タップで拡大） ---------- */
  if (S.eventVisual) {
    const ev = document.getElementById('event-visual');
    if (ev) {
      ev.innerHTML = `<img src="${S.eventVisual}" alt="DRESS CODE MARKET チラシ" class="event-visual-img" loading="lazy" decoding="async">`
        + `<span class="event-visual__zoom" aria-hidden="true">`
        +   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`
        +   `<span>タップで拡大</span>`
        + `</span>`;
      ev.classList.add('event__visual--zoomable');
      ev.setAttribute('role', 'button');
      ev.setAttribute('tabindex', '0');
      ev.setAttribute('aria-label', 'DRESS CODE MARKET のチラシを拡大表示');
      ev.addEventListener('click', function () { openLightbox(S.eventVisual, 'DRESS CODE MARKET チラシ'); });
      ev.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(S.eventVisual, 'DRESS CODE MARKET チラシ'); } });
    }
  }

  /* ---------- 動画エンベッド ---------- */
  if (S.videoEmbed) { const v = document.getElementById('event-video'); if (v) v.innerHTML = S.videoEmbed; }

  /* ---------- ハンバーガーメニュー ---------- */
  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (menuBtn && mobileMenu) {
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mobileMenu.querySelectorAll('[data-close]').forEach(a =>
      a.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      })
    );
  }

  /* ---------- スクロールでヘッダーを少し引き締める ---------- */
  const header = document.querySelector('.header');
  if (header) {
    let scrolled = null, ticking = false;
    const update = () => {
      const s = window.scrollY > 24;
      if (s !== scrolled) { scrolled = s; header.classList.toggle('scrolled', s); }
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------- ナビのスクロール連動（今見ているセクションに下線） ---------- */
  const navLinks = document.querySelectorAll('#nav-desktop a');
  if (navLinks.length && 'IntersectionObserver' in window) {
    const spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          const href = '#' + e.target.id;
          navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === href));
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    // 監視するセクションは nav のリンク先から自動で揃える（#report などを足しても自動対応）
    (S.nav || []).map(i => i.href).filter(h => h && h.charAt(0) === '#').forEach(function (h) {
      const el = document.getElementById(h.slice(1)); if (el) spy.observe(el);
    });
  }

  /* ---------- スクロールで下からふわっと表示（同じ行はずらして演出） ---------- */
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          const sibs = Array.from(e.target.parentElement ? e.target.parentElement.children : []).filter(c => c.classList.contains('reveal'));
          const i = Math.max(0, sibs.indexOf(e.target));
          e.target.style.transitionDelay = (i % 4) * 80 + 'ms';
          e.target.classList.add('in');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('in'));
  }
})();
