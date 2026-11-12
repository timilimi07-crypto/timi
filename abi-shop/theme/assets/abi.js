/* =========================================================
   ABIversum 2027 – Effekte & Shop-Logik (ohne externe Bibliotheken)
   ========================================================= */
(() => {
  'use strict';
  const cfg = window.abi || { fx: {}, colors: ['#ff3d9a', '#8b5cf6', '#22d3ee', '#fff'], routes: {}, text: {} };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  document.documentElement.classList.add('js');

  /* ---------- Geld formatieren ---------- */
  const currency = (window.Shopify && Shopify.currency && Shopify.currency.active) || 'EUR';
  const money = (cents) => new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(cents / 100);

  /* ---------- Header ---------- */
  const header = $('[data-header]');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
  const burger = $('[data-burger]');
  const nav = $('#abi-nav');
  if (burger && nav) {
    burger.addEventListener('click', () => {
      const open = burger.getAttribute('aria-expanded') !== 'true';
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
      nav.classList.toggle('is-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    $$('a', nav).forEach((a) => a.addEventListener('click', () => { if (nav.classList.contains('is-open')) burger.click(); }));
  }

  /* ---------- Scroll-Reveal ---------- */
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Motto in Buchstaben zerlegen (Wellen-Animation) ---------- */
  $$('[data-split] .hero__title-main').forEach((el) => {
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    const chars = Array.from(text);
    el.textContent = '';
    chars.forEach((c, i) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--ci', i);
      s.style.setProperty('--n', chars.length);
      s.textContent = c === ' ' ? ' ' : c;
      el.appendChild(s);
    });
  });

  /* ---------- Konfetti ---------- */
  const confettiCanvas = $('#fx-confetti');
  let confettiParts = [];
  let confettiRunning = false;
  function confetti(x = window.innerWidth / 2, y = window.innerHeight / 2, amount = 140) {
    if (!confettiCanvas || reduce || cfg.fx.confetti === false) return;
    const ctx = confettiCanvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    confettiCanvas.width = window.innerWidth * dpr;
    confettiCanvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const shapes = ['rect', 'circle', 'star'];
    for (let i = 0; i < amount; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 6 + Math.random() * 10;
      confettiParts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 7,
        w: 6 + Math.random() * 8, h: 4 + Math.random() * 6,
        r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        c: cfg.colors[i % cfg.colors.length], s: shapes[i % 3], life: 0
      });
    }
    if (confettiRunning) return;
    confettiRunning = true;
    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      confettiParts.forEach((p) => {
        p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life++;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        ctx.globalAlpha = Math.max(0, 1 - p.life / 160);
        if (p.s === 'rect') ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.life / 8)));
        else if (p.s === 'circle') { ctx.beginPath(); ctx.arc(0, 0, p.h / 1.6, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.font = `${p.w + 6}px sans-serif`; ctx.fillText('★', -p.w / 2, p.h / 2); }
        ctx.restore();
      });
      confettiParts = confettiParts.filter((p) => p.life < 160 && p.y < window.innerHeight + 40);
      if (confettiParts.length) requestAnimationFrame(tick);
      else { confettiRunning = false; ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); }
    };
    requestAnimationFrame(tick);
  }
  window.abiConfetti = confetti;

  /* ---------- Emoji-Regen ---------- */
  function emojiRain(list = ['🎓', '🎉', '🍰', '🥞', '🚀', '⭐', '💜', '🧁']) {
    if (reduce) return;
    for (let i = 0; i < 42; i++) {
      const s = document.createElement('span');
      s.className = 'rain';
      s.textContent = list[i % list.length];
      s.style.left = Math.random() * 100 + 'vw';
      s.style.animationDuration = 2.2 + Math.random() * 2.5 + 's';
      s.style.animationDelay = Math.random() * 1.2 + 's';
      s.style.fontSize = 22 + Math.random() * 30 + 'px';
      s.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      document.body.appendChild(s);
      s.addEventListener('animationend', () => s.remove());
    }
  }

  /* ---------- Easter Egg: 5× aufs Motto klicken ---------- */
  $$('[data-easter]').forEach((el) => {
    let clicks = 0; let timer;
    el.addEventListener('click', (e) => {
      clicks++;
      el.classList.remove('is-wobble'); void el.offsetWidth; el.classList.add('is-wobble');
      clearTimeout(timer);
      timer = setTimeout(() => { clicks = 0; }, 1500);
      if (clicks >= 5) {
        clicks = 0;
        confetti(e.clientX, e.clientY, 220);
        emojiRain();
        toast('🎓 ABI 2027 – WIR HABEN FERTIG! 🎉');
      }
    });
  });

  /* ---------- Sternenhimmel + Sternschnuppen ---------- */
  const starCanvas = $('#fx-stars');
  if (starCanvas && !reduce && cfg.fx.stars !== false) {
    const ctx = starCanvas.getContext('2d');
    let w, h, stars = [], shooters = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      starCanvas.width = w * dpr; starCanvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(220, Math.floor((w * h) / 7000));
      stars = Array.from({ length: count }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.4 + 0.2, t: Math.random() * Math.PI * 2, s: 0.01 + Math.random() * 0.03, d: Math.random() * 0.6 + 0.2 }));
    };
    resize();
    window.addEventListener('resize', resize);
    let scrollY = window.scrollY;
    window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      stars.forEach((s) => {
        s.t += s.s;
        const y = (s.y - scrollY * s.d * 0.15) % h;
        ctx.globalAlpha = 0.35 + Math.sin(s.t) * 0.35 + 0.3;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(s.x, y < 0 ? y + h : y, s.r, 0, Math.PI * 2); ctx.fill();
      });
      if (Math.random() < 0.006 && shooters.length < 2) {
        shooters.push({ x: Math.random() * w * 0.8 + w * 0.2, y: Math.random() * h * 0.4, vx: -(7 + Math.random() * 5), vy: 3 + Math.random() * 2, life: 0 });
      }
      shooters.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.life++;
        const grad = ctx.createLinearGradient(p.x, p.y, p.x - p.vx * 14, p.y - p.vy * 14);
        grad.addColorStop(0, 'rgba(255,255,255,.95)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = Math.max(0, 1 - p.life / 70);
        ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 14, p.y - p.vy * 14); ctx.stroke();
      });
      shooters = shooters.filter((p) => p.life < 70);
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  /* ---------- Glitzer-Spur hinter der Maus ---------- */
  if (!reduce && finePointer && cfg.fx.sparkles !== false) {
    let last = 0;
    window.addEventListener('pointermove', (e) => {
      const now = performance.now();
      if (now - last < 35) return;
      last = now;
      const s = document.createElement('span');
      s.className = 'sparkle';
      s.style.left = e.clientX + 'px';
      s.style.top = e.clientY + 'px';
      s.style.setProperty('--dx', (Math.random() * 40 - 20) + 'px');
      s.style.setProperty('--dy', (Math.random() * 30 + 10) + 'px');
      s.style.setProperty('--sc', cfg.colors[Math.floor(Math.random() * 3)]);
      document.body.appendChild(s);
      s.addEventListener('animationend', () => s.remove());
    }, { passive: true });
  }

  /* ---------- 3D-Tilt ---------- */
  if (!reduce && finePointer && cfg.fx.tilt !== false) {
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.classList.add('is-tilting');
        el.style.setProperty('--ry', ((px - 0.5) * 12).toFixed(2) + 'deg');
        el.style.setProperty('--rx', ((0.5 - py) * 10).toFixed(2) + 'deg');
        el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
      el.addEventListener('pointerleave', () => {
        el.classList.remove('is-tilting');
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ---------- Magnetische Buttons ---------- */
  if (!reduce && finePointer) {
    $$('[data-magnetic]').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        b.style.setProperty('--bx', ((e.clientX - r.left - r.width / 2) * 0.25).toFixed(1) + 'px');
        b.style.setProperty('--by', ((e.clientY - r.top - r.height / 2) * 0.35).toFixed(1) + 'px');
      });
      b.addEventListener('pointerleave', () => { b.style.setProperty('--bx', '0px'); b.style.setProperty('--by', '0px'); });
    });
  }

  /* ---------- Schwebende Emojis folgen der Maus (Parallax) ---------- */
  const hero = $('[data-hero]');
  if (hero && !reduce && finePointer) {
    const floaters = $$('.floater', hero);
    hero.addEventListener('pointermove', (e) => {
      const cx = e.clientX / window.innerWidth - 0.5;
      const cy = e.clientY / window.innerHeight - 0.5;
      floaters.forEach((f) => {
        const d = Number(f.dataset.depth || 1) * 14;
        f.style.setProperty('--px', (-cx * d).toFixed(1) + 'px');
        f.style.setProperty('--py', (-cy * d).toFixed(1) + 'px');
      });
    });
  }

  /* ---------- Countdown ---------- */
  $$('[data-countdown]').forEach((el) => {
    const raw = el.dataset.countdown.trim();
    const target = new Date(raw.length === 10 ? raw + 'T00:00' : raw).getTime();
    if (isNaN(target)) { el.hidden = true; return; }
    const cells = { d: $('[data-cd="d"]', el), h: $('[data-cd="h"]', el), m: $('[data-cd="m"]', el), s: $('[data-cd="s"]', el) };
    let fired = false;
    const set = (k, v) => {
      const txt = String(v).padStart(2, '0');
      if (cells[k].textContent !== txt) {
        cells[k].textContent = txt;
        cells[k].classList.remove('is-tick'); void cells[k].offsetWidth; cells[k].classList.add('is-tick');
      }
    };
    const update = () => {
      let diff = Math.max(0, target - Date.now());
      if (diff === 0) {
        if (!fired) {
          fired = true;
          $('.countdown__grid', el).innerHTML = `<p class="countdown__done">${el.dataset.done || '🎉'}</p>`;
          confetti(window.innerWidth / 2, window.innerHeight / 3, 200);
        }
        return;
      }
      const d = Math.floor(diff / 864e5); diff -= d * 864e5;
      const h = Math.floor(diff / 36e5); diff -= h * 36e5;
      const m = Math.floor(diff / 6e4); diff -= m * 6e4;
      set('d', d); set('h', h); set('m', m); set('s', Math.floor(diff / 1000));
      setTimeout(update, 1000);
    };
    update();
  });

  /* ---------- Toast ---------- */
  const toastEl = $('#abi-toast');
  let toastTimer;
  function toast(msg, withLink = false) {
    if (!toastEl) return;
    toastEl.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = msg;
    toastEl.appendChild(span);
    if (withLink && cfg.routes.cart) {
      const a = document.createElement('a');
      a.href = cfg.routes.cart; a.className = 'btn btn--glow btn--small'; a.textContent = cfg.text.toCart || 'Zum Warenkorb';
      toastEl.appendChild(a);
    }
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 4200);
  }

  /* ---------- Mengen-Buttons ---------- */
  $$('[data-qty]').forEach((q) => {
    const input = $('input', q);
    const step = (n) => {
      const min = Number(input.min || 0);
      const max = Number(input.max || 999);
      input.value = Math.min(max, Math.max(min, (Number(input.value) || 0) + n));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    $('[data-qty-minus]', q).addEventListener('click', () => step(-1));
    $('[data-qty-plus]', q).addEventListener('click', () => step(1));
  });
  // Warenkorb: Menge ändern → automatisch aktualisieren
  const cartForm = $('#cart-form');
  if (cartForm) {
    let t;
    $$('[data-autosubmit]', cartForm).forEach((i) => i.addEventListener('change', () => {
      clearTimeout(t);
      t = setTimeout(() => { const btn = $('button[name="update"]', cartForm); if (btn) btn.click(); }, 600);
    }));
  }

  /* ---------- Galerie ---------- */
  function showMedia(gallery, id) {
    if (!gallery || !id) return;
    const slide = $(`[data-media-id="${id}"]`, gallery);
    if (!slide) return;
    $$('.gallery__slide', gallery).forEach((s) => s.classList.toggle('is-active', s === slide));
    $$('[data-thumb]', gallery).forEach((t) => t.classList.toggle('is-active', t.dataset.thumb === String(id)));
  }
  $$('[data-gallery]').forEach((g) => {
    const first = $('[data-thumb]', g);
    if (first) first.classList.add('is-active');
    $$('[data-thumb]', g).forEach((t) => t.addEventListener('click', () => showMedia(g, t.dataset.thumb)));
  });

  /* ---------- Varianten (Größe/Farbe) ---------- */
  $$('[data-product-section]').forEach((section) => {
    const picker = $('[data-variant-picker]', section);
    if (!picker) return;
    const variants = JSON.parse($('[data-variants]', picker).textContent);
    const idInput = $('[data-variant-id]', section);
    const addBtn = $('[data-add-btn]', section);
    const addLabel = $('[data-add-label]', section);
    const defaultLabel = addLabel ? addLabel.textContent : '';
    const priceNow = $('[data-price-now]', section);
    const priceOld = $('[data-price-old]', section);
    const gallery = $('[data-gallery]', section);
    const groups = $$('.vp__group', picker);

    const selected = () => groups.map((g) => { const c = $('input:checked', g); return c ? c.value : null; });

    const markUnavailable = () => {
      const sel = selected();
      groups.forEach((g, gi) => {
        $$('input', g).forEach((inp) => {
          const test = sel.slice(); test[gi] = inp.value;
          const ok = variants.some((v) => v.available && v.options.every((o, i) => o === test[i]));
          inp.nextElementSibling.classList.toggle('is-unavailable', !ok);
        });
      });
    };

    const update = () => {
      const sel = selected();
      groups.forEach((g, i) => { const l = $(`[data-option-label="${i}"]`, picker); if (l) l.textContent = sel[i] || ''; });
      const v = variants.find((x) => x.options.every((o, i) => o === sel[i]));
      markUnavailable();
      if (!v) {
        if (addBtn) addBtn.disabled = true;
        if (addLabel) addLabel.textContent = 'Nicht verfügbar';
        return;
      }
      idInput.value = v.id;
      if (priceNow) priceNow.textContent = money(v.price);
      if (priceOld) { priceOld.hidden = !(v.compare_at_price > v.price); priceOld.textContent = v.compare_at_price ? money(v.compare_at_price) : ''; }
      if (addBtn) addBtn.disabled = !v.available;
      if (addLabel) addLabel.textContent = v.available ? defaultLabel : 'Ausverkauft';
      if (v.featured_media) showMedia(gallery, v.featured_media.id);
      const url = new URL(window.location.href);
      url.searchParams.set('variant', v.id);
      window.history.replaceState({}, '', url.toString());
    };
    picker.addEventListener('change', update);
    markUnavailable();
  });

  /* ---------- Datum: frühestens in X Tagen ---------- */
  $$('input[type="date"][data-min-days]').forEach((inp) => {
    const d = new Date();
    d.setDate(d.getDate() + Number(inp.dataset.minDays || 0));
    inp.min = d.toISOString().slice(0, 10);
  });

  /* ---------- In den Warenkorb (ohne Neuladen) + Konfetti ---------- */
  async function refreshCount() {
    try {
      const res = await fetch(cfg.routes.cartJs || '/cart.js', { headers: { Accept: 'application/json' } });
      const cart = await res.json();
      $$('[data-cart-count]').forEach((c) => { c.textContent = cart.item_count; c.hidden = cart.item_count === 0; });
      const btn = $('.cart-btn');
      if (btn) { btn.classList.remove('is-bump'); void btn.offsetWidth; btn.classList.add('is-bump'); }
    } catch (e) { /* egal */ }
  }
  $$('form[data-ajax-cart]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      if (!window.fetch || !cfg.routes.cartAdd) return;
      e.preventDefault();
      const btn = $('[data-add-btn]', form);
      const err = $('[data-buy-error]', form);
      if (err) err.hidden = true;
      if (btn) btn.disabled = true;
      try {
        const res = await fetch(cfg.routes.cartAdd + '.js', { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.description || data.message || cfg.text.error);
        const r = btn ? btn.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
        confetti(r.left + r.width / 2, r.top + r.height / 2, 120);
        toast(cfg.text.added || 'Liegt im Warenkorb 🎉', true);
        refreshCount();
      } catch (ex) {
        if (err) { err.textContent = ex.message || cfg.text.error; err.hidden = false; }
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  });

  /* ---------- Widerrufsbutton ---------- */
  $$('[data-withdraw]').forEach((box) => {
    const open = $('[data-withdraw-open]', box);
    const form = $('[data-withdraw-form]', box);
    if (open && form) open.addEventListener('click', () => { form.hidden = false; open.hidden = true; const f = $('input:not([type=hidden])', form); if (f) f.focus(); });
    const now = $('[data-now]', box);
    if (now) now.textContent = new Date().toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' }) + ' Uhr';
  });
})();
