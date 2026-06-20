/* =========================================================
   DRESS CODE TOKYO — 描画スクリプト（基本さわらなくてOK）
   data.js の中身を読み取って、各セクションに HTML を流し込みます。
   見た目を細かく直したいときは、下のテンプレート文字列を編集します。
   ========================================================= */
(function () {
  const S = window.SITE || {};

  /* 指定した id の要素に HTML を入れる小さなヘルパー */
  function fill(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  /* data-hover="..." が付いた要素に、マウスを乗せたときだけ
     その style を追加する処理（元デザインの style-hover の再現） */
  function applyHover() {
    document.querySelectorAll('[data-hover]').forEach(function (el) {
      if (el.__hoverBound) return;
      el.__hoverBound = true;
      const base = el.getAttribute('style') || '';
      const hover = el.getAttribute('data-hover');
      el.addEventListener('mouseenter', function () { el.setAttribute('style', base + ';' + hover); });
      el.addEventListener('mouseleave', function () { el.setAttribute('style', base); });
    });
  }

  /* ---------- 各リストのテンプレート ---------- */

  const navDesktop = (S.nav || []).map(function (item) {
    return `<a href="${item.href}" data-hover="opacity:1" style="position:relative;font-family:'Jost',sans-serif;font-size:12.5px;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;text-decoration:none;color:#16150f;padding:6px 0;opacity:0.82;transition:opacity .3s ease">${item.label}</a>`;
  }).join('');

  const navMobile = (S.nav || []).map(function (item) {
    return `<a href="${item.href}" data-close style="font-family:'Jost',sans-serif;font-size:15px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;text-decoration:none;color:#16150f;padding:13px 0;border-bottom:1px solid #efece5">${item.label}</a>`;
  }).join('');

  const navFooter = (S.nav || []).map(function (item) {
    return `<a href="${item.href}" data-hover="color:#fff" style="font-family:'Jost',sans-serif;font-size:12.5px;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;color:#c9c6bc;transition:color .3s ease">${item.label}</a>`;
  }).join('');

  const activities = (S.activities || []).map(function (a) {
    return `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:16px 0;border-bottom:1px solid #e7e4dd">
      <span style="font-size:14.5px;color:#16150f">${a.jp}</span>
      <span style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:17px;color:#9a978d">${a.en}</span>
    </div>`;
  }).join('');

  const eventInfo = (S.eventInfo || []).map(function (row) {
    return `<div style="display:flex;justify-content:space-between;gap:16px;padding:13px 0;border-top:1px solid #2c2a23">
      <span style="font-family:'Jost',sans-serif;font-size:10.5px;letter-spacing:0.18em;text-transform:uppercase;color:#8b887e;flex:none">${row.k}</span>
      <span style="font-size:13.5px;color:#e7e4db;text-align:right">${row.v}</span>
    </div>`;
  }).join('');

  const eventCtas = (S.eventCtas || []).map(function (c) {
    return `<a href="${c.href}" data-hover="background:#201e18" style="background:#16150f;padding:24px 28px;display:flex;align-items:center;justify-content:space-between;gap:14px;text-decoration:none;transition:background .35s ease">
      <span>
        <span style="display:block;font-family:'Jost',sans-serif;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8b887e">${c.en}</span>
        <span style="display:block;margin-top:6px;font-size:15px;color:#f7f5f0">${c.jp}</span>
      </span>
      <span style="font-size:18px;color:#f7f5f0">→</span>
    </a>`;
  }).join('');

  const enjoy = (S.enjoy || []).map(function (e) {
    return `<div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:30px;font-style:italic;color:#8b887e">${e.no}</div>
      <h4 style="margin:14px 0 0;font-size:16px;font-weight:700;color:#f7f5f0">${e.title}</h4>
      <p style="margin:10px 0 0;font-size:13.5px;line-height:1.95;color:#b3b0a6">${e.body}</p>
    </div>`;
  }).join('');

  const gallery = (S.gallery || []).map(function (g) {
    const media = g.img ? `<img src="${g.img}" alt="${g.label}" class="dct-media-img">` : '';
    return `<div data-hover="border-color:#5a584f" style="position:relative;aspect-ratio:${g.ratio};background:#1f1e18;border:1px solid #2c2a23;overflow:hidden;display:flex;align-items:flex-end;cursor:pointer;transition:border-color .35s ease">
      ${media}
      <span style="position:relative;padding:12px 14px;font-family:'Jost',sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#807d74">${g.label}</span>
    </div>`;
  }).join('');

  const categories = (S.categories || []).map(function (cat) {
    return `<span data-hover="border-color:#16150f;color:#16150f" style="font-family:'Jost',sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#56544c;border:1px solid #e0ddd5;padding:7px 13px;transition:all .3s ease">${cat}</span>`;
  }).join('');

  const articles = (S.articles || []).map(function (a) {
    const cover = a.img ? `<img src="${a.img}" alt="" class="dct-media-img">` : '';
    const placeholder = a.img ? '' : `<span style="position:relative;padding:14px;font-family:'Jost',sans-serif;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#a8a59b">Photo — 差し替え可</span>`;
    return `<a href="${a.href}" style="text-decoration:none;color:inherit;display:block">
      <div style="position:relative;aspect-ratio:4/3;background:#f4f2ed;border:1px solid #e7e4dd;overflow:hidden;display:flex;align-items:flex-end">
        ${cover}
        <span style="position:absolute;top:14px;left:14px;display:inline-flex;align-items:center;gap:7px;background:#fff;padding:6px 11px;font-family:'Jost',sans-serif;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#16150f">${a.cat}</span>
        ${placeholder}
      </div>
      <div style="padding:18px 2px 0">
        <div style="font-family:'Jost',sans-serif;font-size:11px;letter-spacing:0.1em;color:#a09d93">${a.date}</div>
        <h3 style="margin:9px 0 0;font-size:18px;font-weight:700;line-height:1.5;color:#16150f">${a.title}</h3>
        <p style="margin:10px 0 0;font-size:13.5px;line-height:1.9;color:#6c6a61">${a.excerpt}</p>
        <span style="display:inline-block;margin-top:14px;font-family:'Jost',sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#16150f;border-bottom:1px solid #16150f;padding-bottom:2px">Read →</span>
      </div>
    </a>`;
  }).join('');

  const community = (S.community || []).map(function (c) {
    return `<div data-hover="transform:translateY(-5px);box-shadow:0 18px 40px rgba(0,0,0,0.07)" style="background:#fff;border:1px solid #e7e4dd;padding:clamp(26px,3vw,40px);display:flex;flex-direction:column;min-height:300px;transition:transform .4s cubic-bezier(.2,.7,.2,1),box-shadow .4s ease">
      <span style="width:30px;height:2px;background:${c.accent}"></span>
      <div style="margin-top:20px;font-family:'Jost',sans-serif;font-size:10.5px;letter-spacing:0.22em;text-transform:uppercase;color:#a09d93">${c.en}</div>
      <h3 style="margin:8px 0 0;font-size:21px;font-weight:700;color:#16150f">${c.jp}</h3>
      <p style="margin:14px 0 0;font-size:13.5px;line-height:1.95;color:#6c6a61;flex:1">${c.body}</p>
      <a href="#contact" style="margin-top:22px;font-family:'Jost',sans-serif;font-size:11.5px;letter-spacing:0.16em;text-transform:uppercase;text-decoration:none;color:#16150f;border-bottom:1px solid #16150f;padding-bottom:3px;align-self:flex-start">${c.cta} →</a>
    </div>`;
  }).join('');

  const contactReasons = (S.contactReasons || []).map(function (r) {
    return `<div style="display:flex;align-items:center;gap:14px;padding:15px 0;border-top:1px solid #e7e4dd">
      <span style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:18px;color:#b5b2a8;width:28px">${r.no}</span>
      <span style="font-size:14.5px;color:#16150f">${r.jp}</span>
      <span style="margin-left:auto;font-family:'Jost',sans-serif;font-size:10.5px;letter-spacing:0.14em;text-transform:uppercase;color:#a09d93">${r.en}</span>
    </div>`;
  }).join('');

  const socialsContact = (S.socials || []).map(function (s) {
    return `<a href="${s.href}" data-hover="background:#16150f;color:#fff;border-color:#16150f" style="display:inline-flex;align-items:center;gap:8px;border:1px solid #d9d6cf;padding:11px 18px;font-family:'Jost',sans-serif;font-size:11.5px;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;color:#16150f;transition:all .3s ease">${s.label}</a>`;
  }).join('');

  const socialsFooter = (S.socials || []).map(function (s) {
    return `<a href="${s.href}" data-hover="color:#fff" style="font-family:'Jost',sans-serif;font-size:12.5px;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;color:#c9c6bc;transition:color .3s ease">${s.label}</a>`;
  }).join('');

  /* ---------- 各セクションへ流し込み ---------- */
  fill('nav-desktop', navDesktop);
  fill('nav-mobile', navMobile);
  fill('footer-sitemap', navFooter);
  fill('about-activities', activities);
  fill('event-info', eventInfo);
  fill('event-ctas', eventCtas);
  fill('enjoy', enjoy);
  fill('gallery', gallery);
  fill('categories', categories);
  fill('articles', articles);
  fill('community-cards', community);
  fill('contact-reasons', contactReasons);
  fill('contact-socials', socialsContact);
  fill('footer-socials', socialsFooter);

  /* ---------- 動画エンベッド（あれば差し込み） ---------- */
  if (S.videoEmbed) {
    const v = document.getElementById('event-video');
    if (v) v.innerHTML = `<div style="position:absolute;inset:0">${S.videoEmbed}</div>
      <style>#event-video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style>`;
  }

  /* ---------- お問い合わせフォーム（あれば差し込み） ---------- */
  if (S.contactFormEmbed) {
    const f = document.getElementById('contact-form');
    if (f) f.innerHTML = `${S.contactFormEmbed}
      <style>#contact-form iframe{width:100%;min-height:560px;border:0}</style>`;
  }

  /* ---------- ハンバーガーメニューの開閉 ---------- */
  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  function closeMenu() { if (mobileMenu) mobileMenu.style.display = 'none'; }
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', function () {
      mobileMenu.style.display = (mobileMenu.style.display === 'flex') ? 'none' : 'flex';
    });
    mobileMenu.querySelectorAll('[data-close]').forEach(function (a) {
      a.addEventListener('click', closeMenu);
    });
  }

  applyHover();
})();
