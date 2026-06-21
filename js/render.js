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

  /* ---------- Magazine: カテゴリタグ ---------- */
  fill('categories', (S.categories || []).map(c => `<span>${c}</span>`).join(''));

  /* ---------- Magazine: 記事 ---------- */
  const catColors = S.catColors || {};
  // 本文＋抜粋の文字数からおおよその読了時間（約400字/分）を算出
  function readMin(a) {
    let c = (a.excerpt || '').length;
    (a.body || []).forEach(b => { c += (b.p || b.h || b.quote || b.cap || '').length; });
    return Math.max(1, Math.round(c / 400));
  }
  fill('articles', (S.articles || []).map(a => {
    const color = catColors[a.cat] || 'var(--ink)';
    const cat = `<span class="card__cat"><span class="card__dot" style="background:${color}"></span>${a.cat}</span>`;
    const media = a.img
      ? `${cat}<img src="${a.img}" alt="" loading="lazy" decoding="async">`
      : `${cat}<span class="card__ph">Photo — 差し替え可</span>`;
    const link = a.slug ? `article.html?id=${a.slug}` : (a.href || '#');
    return `<a href="${link}" class="card reveal">
      <div class="card__media">${media}<div class="card__view"><span>Read →</span></div></div>
      <div class="card__body">
        <div class="card__date">${a.date} <span class="card__read">· 約${readMin(a)}分で読めます</span></div>
        <h3 class="card__title">${a.title}</h3>
        <p class="card__excerpt">${a.excerpt}</p>
        <span class="card__more">Read →</span>
      </div>
    </a>`;
  }).join(''));

  /* ---------- Community ---------- */
  fill('community-cards', (S.community || []).map(c =>
    `<div class="ccard reveal">
      <div class="en">${c.en}</div>
      <h3>${c.jp}</h3>
      <p>${c.body}</p>
      <a href="#contact" class="more">${c.cta} →</a>
    </div>`
  ).join(''));

  /* ---------- Contact: 理由 ---------- */
  fill('contact-reasons', (S.contactReasons || []).map(r =>
    `<div class="reasons__row"><span class="no">${r.no}</span><span class="jp">${r.jp}</span><span class="en">${r.en}</span></div>`
  ).join(''));

  /* ---------- SNS ---------- */
  const socialsHtml = (S.socials || []).map(s => `<a href="${s.href}">${s.label}</a>`).join('');
  fill('contact-socials', socialsHtml);
  fill('footer-socials', socialsHtml);

  /* ---------- Event キービジュアル写真 ---------- */
  if (S.eventVisual) {
    const ev = document.getElementById('event-visual');
    if (ev) ev.innerHTML = `<img src="${S.eventVisual}" alt="" class="event-visual-img" loading="lazy" decoding="async">`;
  }

  /* ---------- 動画エンベッド ---------- */
  if (S.videoEmbed) { const v = document.getElementById('event-video'); if (v) v.innerHTML = S.videoEmbed; }

  /* ---------- お問い合わせフォーム（インライン展開＋Google フォーム送信） ---------- */
  // ご用件の選択肢は contactReasons から自動生成（リストと自動で揃う）
  const typeSel = document.getElementById('form-type');
  if (typeSel) {
    typeSel.innerHTML = (S.contactReasons || []).map(r => `<option value="${r.jp}">${r.jp}</option>`).join('');
  }
  // タップで開閉
  const fwrap = document.getElementById('contact-form');
  const ftoggle = document.getElementById('form-toggle');
  if (fwrap && ftoggle) {
    ftoggle.addEventListener('click', function () {
      const open = fwrap.classList.toggle('open');
      ftoggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  // 送信（設定済みなら Google フォームへ。未設定ならデモで御礼表示）
  const dcform = document.getElementById('dcform');
  if (dcform) {
    dcform.addEventListener('submit', function (e) {
      e.preventDefault();
      const cfg = S.contactForm || {};
      const ent = cfg.entries || {};
      if (cfg.action && ent.name) {
        const el = dcform.elements;
        const body = new URLSearchParams();
        body.append(ent.name,    el['name'].value);
        body.append(ent.email,   el['email'].value);
        body.append(ent.type,    el['type'].value);
        body.append(ent.message, el['message'].value);
        fetch(cfg.action, { method: 'POST', mode: 'no-cors', body: body }).catch(function () {});
      }
      dcform.innerHTML = '<div class="dcform__done"><div class="t">Thank you.</div><p>お問い合わせを受け付けました。<br>担当より追ってご連絡いたします。</p></div>';
    });
  }

  /* ---------- ハンバーガーメニュー ---------- */
  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      mobileMenu.style.display = (mobileMenu.style.display === 'flex') ? 'none' : 'flex';
    });
    mobileMenu.querySelectorAll('[data-close]').forEach(a =>
      a.addEventListener('click', () => { mobileMenu.style.display = 'none'; })
    );
  }

  /* ---------- ニュースレター（簡易：送信先が未設定なら御礼表示） ---------- */
  const nl = document.getElementById('newsletter-form');
  if (nl) nl.addEventListener('submit', function () {
    const email = nl.querySelector('input').value.trim();
    if (email) nl.innerHTML = '<div style="padding:16px 0;font-family:var(--f-sans);letter-spacing:0.1em">ご登録ありがとうございます。先行案内をお送りします。</div>';
  });

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
    ['top', 'about', 'event', 'magazine', 'community', 'contact'].forEach(function (id) {
      const el = document.getElementById(id); if (el) spy.observe(el);
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
