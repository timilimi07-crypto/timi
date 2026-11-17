/* =====================================================================
   WEAX Night – theme.js
   Kern-Funktionen: Header, Menü, Suche, Warenkorb (AJAX), Quick-Add,
   Mengenfelder, Modals, Scroll-Reveal, Countdown, Slider.
   Kein Framework, keine Abhängigkeiten.
   ===================================================================== */
(() => {
  'use strict';

  const W = (window.WEAX = window.WEAX || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  W.reduceMotion = reduceMotion;
  W.$ = $; W.$$ = $$;

  const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  W.debounce = debounce;

  /* ---------- Toast ---------- */
  let toastTimer;
  W.toast = (msg) => {
    const el = $('[data-toast]');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
  };

  /* ---------- Fokus-Falle für Drawer/Modals ---------- */
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';
  let lastFocus = null;
  function trapFocus(container) {
    lastFocus = document.activeElement;
    const handler = (e) => {
      if (e.key !== 'Tab') return;
      const els = $$(FOCUSABLE, container).filter((el) => el.offsetParent !== null);
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    container._trap = handler;
    container.addEventListener('keydown', handler);
    const first = $(FOCUSABLE, container);
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
  }
  function releaseFocus(container) {
    if (container._trap) container.removeEventListener('keydown', container._trap);
    if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  W.trapFocus = trapFocus; W.releaseFocus = releaseFocus;

  /* ---------- Overlays (Drawer, Modals, Suche, Menü) ---------- */
  const openOverlays = new Set();
  function openOverlay(el, htmlClass = 'drawer-open') {
    if (!el) return;
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add(htmlClass);
    openOverlays.add(el);
    trapFocus(el);
    el.dispatchEvent(new CustomEvent('overlay:open', { bubbles: true }));
  }
  function closeOverlay(el, htmlClass = 'drawer-open') {
    if (!el || !el.classList.contains('is-open')) return;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    openOverlays.delete(el);
    if (!openOverlays.size) document.documentElement.classList.remove('drawer-open', 'menu-open');
    else document.documentElement.classList.remove(htmlClass);
    releaseFocus(el);
    $$(`[aria-controls="${el.id}"]`).forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }
  W.openOverlay = openOverlay; W.closeOverlay = closeOverlay;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openOverlays.size) {
      const last = Array.from(openOverlays).pop();
      closeOverlay(last, last.classList.contains('menu-drawer') ? 'menu-open' : 'drawer-open');
    }
  });

  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open]');
    if (opener) {
      const target = document.getElementById(opener.dataset.open);
      if (target) {
        e.preventDefault();
        opener.setAttribute('aria-expanded', 'true');
        if (target.id === 'CartDrawer') { W.cart.open(); return; }
        openOverlay(target, target.classList.contains('menu-drawer') ? 'menu-open' : 'drawer-open');
        if (target.dataset.searchModal !== undefined) { const inp = $('input[type="search"]', target); if (inp) setTimeout(() => inp.focus(), 80); }
      }
      return;
    }
    const closer = e.target.closest('[data-close]');
    if (closer) {
      const target = closer.closest('.drawer, .modal, .menu-drawer, .search-modal');
      if (target) { e.preventDefault(); closeOverlay(target, target.classList.contains('menu-drawer') ? 'menu-open' : 'drawer-open'); }
    }
  });

  /* ---------- Header: Glass-Blur beim Scrollen, Smart-Hide ---------- */
  function initHeader() {
    const wrap = $('[data-header]');
    if (!wrap) return;
    const smart = wrap.dataset.sticky === 'smart';
    let lastY = window.scrollY, ticking = false;
    const update = () => {
      const y = window.scrollY;
      wrap.classList.toggle('is-solid', y > 10);
      if (smart) {
        const down = y > lastY && y > 300;
        wrap.classList.toggle('is-hidden', down && !document.documentElement.classList.contains('menu-open'));
      }
      lastY = y; ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
    update();
    const setH = () => document.documentElement.style.setProperty('--header-real-h', wrap.offsetHeight + 'px');
    setH(); window.addEventListener('resize', debounce(setH, 150));
  }

  /* ---------- Predictive Search ---------- */
  function initSearch() {
    if (!W.settings || !W.settings.predictiveSearch) return;
    $$('[data-predictive-search]').forEach((form) => {
      const input = $('input[type="search"]', form);
      const results = $('[data-predictive-results]', form.closest('.search-modal') || form);
      if (!input || !results) return;
      let ctrl;
      const run = debounce(async () => {
        const q = input.value.trim();
        if (q.length < 2) { results.innerHTML = ''; return; }
        if (ctrl) ctrl.abort();
        ctrl = new AbortController();
        try {
          const url = `${W.routes.predictiveSearch}?q=${encodeURIComponent(q)}&section_id=predictive-search&resources[limit]=6&resources[type]=product,collection,page,article`;
          const res = await fetch(url, { signal: ctrl.signal });
          if (!res.ok) return;
          const html = await res.text();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const inner = $('[data-predictive-inner]', doc);
          results.innerHTML = inner ? inner.innerHTML : '';
        } catch (err) { /* abgebrochen */ }
      }, 220);
      input.addEventListener('input', run);
    });
  }

  /* ---------- Warenkorb ---------- */
  const cart = {
    get drawer() { return document.getElementById('CartDrawer'); },
    sections() {
      const ids = ['cart-drawer'];
      if ($('[data-main-cart]')) ids.push($('[data-main-cart]').dataset.sectionId);
      return ids;
    },
    open() {
      if (!this.drawer || W.settings.cartType !== 'drawer') { window.location.href = W.routes.cart; return; }
      openOverlay(this.drawer);
    },
    close() { closeOverlay(this.drawer); },
    setCount(count) {
      $$('[data-cart-count]').forEach((el) => {
        const prev = el.dataset.count;
        el.dataset.count = count;
        el.textContent = count > 0 ? count : '';
        if (String(prev) !== String(count)) { el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump'); }
      });
      $$('[data-cart-count-text]').forEach((el) => { el.textContent = count; });
    },
    renderSections(sections) {
      if (!sections) return;
      Object.entries(sections).forEach(([id, html]) => {
        if (!html) return;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        if (id === 'cart-drawer') {
          const fresh = $('[data-drawer-content]', doc);
          const current = this.drawer && $('[data-drawer-content]', this.drawer);
          if (fresh && current) current.innerHTML = fresh.innerHTML;
          const countEl = $('[data-item-count]', doc);
          if (countEl) this.setCount(parseInt(countEl.dataset.itemCount, 10) || 0);
        } else {
          const target = document.getElementById(`shopify-section-${id}`);
          const src = $(`#shopify-section-${id}`, doc);
          if (target && src) target.innerHTML = src.innerHTML;
          const countEl = $('[data-item-count]', doc);
          if (countEl) this.setCount(parseInt(countEl.dataset.itemCount, 10) || 0);
        }
      });
      document.dispatchEvent(new CustomEvent('cart:updated'));
    },
    async add(items, btn) {
      if (btn) { btn.classList.add('is-loading'); btn.setAttribute('aria-busy', 'true'); }
      try {
        const res = await fetch(`${W.routes.cartAdd}.js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ items, sections: this.sections(), sections_url: window.location.pathname })
        });
        const data = await res.json();
        if (!res.ok || data.status) throw new Error(data.description || data.message || W.strings.cartError);
        if (data.sections) this.renderSections(data.sections);
        else await this.refreshCount();
        if (W.settings.cartType === 'drawer' && this.drawer) this.open();
        else { W.toast(W.strings.added); await this.refreshCount(); }
        document.dispatchEvent(new CustomEvent('cart:added', { detail: data }));
        return data;
      } catch (err) {
        W.toast(err.message || W.strings.cartError);
        throw err;
      } finally {
        if (btn) { btn.classList.remove('is-loading'); btn.removeAttribute('aria-busy'); }
      }
    },
    async change(line, quantity, row) {
      if (row) row.classList.add('is-updating');
      try {
        const res = await fetch(`${W.routes.cartChange}.js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ line, quantity, sections: this.sections(), sections_url: window.location.pathname })
        });
        const data = await res.json();
        if (!res.ok || data.status) throw new Error(data.description || data.message || W.strings.cartError);
        this.renderSections(data.sections);
        this.setCount(data.item_count);
      } catch (err) {
        W.toast(err.message || W.strings.cartError);
        if (row) row.classList.remove('is-updating');
      }
    },
    async updateNote(note) {
      await fetch(`${W.routes.cartUpdate}.js`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note })
      });
    },
    async refreshCount() {
      try { const r = await fetch(`${W.routes.cart}.js`); const c = await r.json(); this.setCount(c.item_count); } catch (e) {}
    }
  };
  W.cart = cart;

  // Produktformulare (Produktseite, Featured Product)
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-product-form]');
    if (!form) return;
    e.preventDefault();
    const fd = new FormData(form);
    const id = fd.get('id');
    if (!id) return;
    const item = { id: Number(id), quantity: Number(fd.get('quantity') || 1) };
    const props = {};
    for (const [k, v] of fd.entries()) { const m = k.match(/^properties\[(.+)\]$/); if (m && v) props[m[1]] = v; }
    if (Object.keys(props).length) item.properties = props;
    if (fd.get('selling_plan')) item.selling_plan = fd.get('selling_plan');
    cart.add([item], $('[type="submit"]', form) || $('[data-add-to-cart]', form)).catch(() => {});
  });

  // Quick-Add (Produktkarten) & Mengen/Entfernen im Warenkorb
  document.addEventListener('click', (e) => {
    const quick = e.target.closest('[data-quick-add]');
    if (quick) {
      e.preventDefault();
      cart.add([{ id: Number(quick.dataset.quickAdd), quantity: 1 }], quick).catch(() => {});
      return;
    }
    const remove = e.target.closest('[data-line-remove]');
    if (remove) {
      e.preventDefault();
      cart.change(Number(remove.dataset.lineRemove), 0, remove.closest('[data-line-item]'));
      return;
    }
    const step = e.target.closest('[data-qty-step]');
    if (step) {
      const wrap = step.closest('.qty');
      const input = wrap && $('input', wrap);
      if (!input) return;
      const min = Number(input.min || 0), max = input.max ? Number(input.max) : Infinity;
      const next = Math.min(max, Math.max(min, Number(input.value || 0) + Number(step.dataset.qtyStep)));
      if (next === Number(input.value)) return;
      input.value = next;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  document.addEventListener('change', (e) => {
    const input = e.target.closest('[data-line-qty]');
    if (input) cart.change(Number(input.dataset.lineQty), Number(input.value), input.closest('[data-line-item]'));
    const note = e.target.closest('[data-cart-note]');
    if (note) cart.updateNote(note.value);
  });

  /* ---------- Scroll-Reveal (IntersectionObserver) ---------- */
  let revealIO;
  function initReveal(root = document) {
    const els = $$('[data-reveal]:not(.is-in)', root);
    if (!document.body.classList.contains('has-reveal') || reduceMotion || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    if (!revealIO) {
      revealIO = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) { en.target.classList.add('is-in'); revealIO.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    }
    els.forEach((el) => revealIO.observe(el));
  }
  W.initReveal = initReveal;

  /* ---------- Marquee: pausiert außerhalb des Viewports ---------- */
  function initMarquees(root = document) {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => $$('.marquee__track', en.target).forEach((t) => { t.style.animationPlayState = en.isIntersecting ? '' : 'paused'; }));
    });
    $$('.marquee', root).forEach((m) => io.observe(m));
  }

  /* ---------- Countdown ---------- */
  function initCountdowns(root = document) {
    $$('[data-countdown]', root).forEach((el) => {
      if (el._cd) clearInterval(el._cd);
      const target = new Date(el.dataset.countdown).getTime();
      const units = { d: $('[data-cd-days]', el), h: $('[data-cd-hours]', el), m: $('[data-cd-minutes]', el), s: $('[data-cd-seconds]', el) };
      const pad = (n) => String(n).padStart(2, '0');
      const tick = () => {
        const diff = target - Date.now();
        if (isNaN(target) || diff <= 0) {
          clearInterval(el._cd);
          Object.values(units).forEach((u) => u && (u.textContent = '00'));
          if (!el.classList.contains('is-ended')) {
            el.classList.add('is-ended');
            el.dispatchEvent(new CustomEvent('countdown:end', { bubbles: true }));
          }
          return;
        }
        const d = Math.floor(diff / 864e5), h = Math.floor((diff % 864e5) / 36e5), m = Math.floor((diff % 36e5) / 6e4), s = Math.floor((diff % 6e4) / 1e3);
        if (units.d) units.d.textContent = pad(d);
        if (units.h) units.h.textContent = pad(h);
        if (units.m) units.m.textContent = pad(m);
        if (units.s) units.s.textContent = pad(s);
      };
      tick();
      el._cd = setInterval(tick, 1000);
    });
  }
  W.initCountdowns = initCountdowns;

  /* ---------- Slider-Pfeile ---------- */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-slider-prev], [data-slider-next]');
    if (!btn) return;
    const slider = document.getElementById(btn.getAttribute('aria-controls'));
    if (!slider) return;
    const item = slider.firstElementChild;
    const w = item ? item.getBoundingClientRect().width + 16 : slider.clientWidth * 0.8;
    slider.scrollBy({ left: btn.hasAttribute('data-slider-next') ? w : -w, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* ---------- Teilen-Button ---------- */
  document.addEventListener('click', async (e) => {
    const share = e.target.closest('[data-share]');
    if (!share) return;
    e.preventDefault();
    const data = { title: document.title, url: share.dataset.share || location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(data.url); W.toast(W.strings.copied); }
    } catch (err) {}
  });

  /* ---------- Lazy Videos (erst laden, wenn sichtbar) ---------- */
  function initLazyVideos(root = document) {
    const vids = $$('video[data-lazy-video]', root);
    if (!vids.length) return;
    const load = (v) => {
      $$('source[data-src]', v).forEach((s) => { s.src = s.dataset.src; s.removeAttribute('data-src'); });
      v.load();
      if (!reduceMotion && v.hasAttribute('autoplay')) v.play().catch(() => {});
    };
    if (!('IntersectionObserver' in window)) { vids.forEach(load); return; }
    const io = new IntersectionObserver((ens) => ens.forEach((en) => { if (en.isIntersecting) { load(en.target); io.unobserve(en.target); } }), { rootMargin: '200px' });
    vids.forEach((v) => io.observe(v));
  }

  /* ---------- Init ---------- */
  function initAll(root = document) {
    initReveal(root);
    initMarquees(root);
    initCountdowns(root);
    initLazyVideos(root);
  }

  function boot() {
    initHeader();
    initSearch();
    initAll();
    requestAnimationFrame(() => document.documentElement.classList.add('is-loaded'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  // Zurück-Navigation (bfcache): Übergangs-Schleier entfernen
  window.addEventListener('pageshow', (e) => { if (e.persisted) document.documentElement.classList.remove('is-leaving'); document.documentElement.classList.add('is-loaded'); });

  // Theme-Editor: Sections nach dem Bearbeiten neu initialisieren
  document.addEventListener('shopify:section:load', (e) => { initAll(e.target); document.dispatchEvent(new CustomEvent('weax:section-load', { detail: e.target })); });
  document.addEventListener('shopify:block:select', (e) => {
    const slide = e.target.closest('.slider > *');
    if (slide) slide.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  });
  document.addEventListener('shopify:section:select', (e) => {
    const drawer = e.target.querySelector('#CartDrawer');
    if (drawer) cart.open();
  });
  document.addEventListener('shopify:section:deselect', (e) => {
    const drawer = e.target.querySelector('#CartDrawer');
    if (drawer) cart.close();
  });
})();
