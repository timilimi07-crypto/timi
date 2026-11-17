/* =====================================================================
   WEAX Night – effects.js
   Sternenhimmel + Sternschnuppen (Canvas), Custom Cursor mit Glow-Trail,
   3D-Tilt, magnetische Buttons, Text-Scramble, Parallax, Preloader,
   Seitenübergänge. Alles Vanilla JS, respektiert prefers-reduced-motion.
   ===================================================================== */
(() => {
  'use strict';
  const W = (window.WEAX = window.WEAX || {});
  const S = W.settings || {};
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isMobile = window.matchMedia('(max-width: 749px)').matches || !finePointer;
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- Preloader ---------- */
  function initPreloader() {
    const pl = document.querySelector('[data-preloader]');
    if (!pl) return;
    const start = performance.now();
    const done = () => {
      const wait = Math.max(0, 1500 - (performance.now() - start));
      setTimeout(() => {
        pl.classList.add('is-done');
        document.documentElement.classList.remove('is-preloading');
        setTimeout(() => pl.remove(), 800);
      }, wait);
    };
    if (document.readyState === 'complete') done(); else window.addEventListener('load', done, { once: true });
    setTimeout(done, 2600); // Sicherheitsnetz
  }

  /* ---------- Sternenhimmel ---------- */
  class Sky {
    constructor(canvas, opts = {}) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d', { alpha: true });
      this.o = Object.assign({ density: 55, speed: 40, shooting: 45, stars: true, fixed: true }, opts);
      this.dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
      this.stars = []; this.shooters = []; this.running = false; this.visible = true; this.mx = 0; this.my = 0;
      this.resize = this.resize.bind(this); this.loop = this.loop.bind(this);
      this.resize();
      window.addEventListener('resize', W.debounce ? W.debounce(this.resize, 200) : this.resize);
      if (!this.o.fixed && 'IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible) this.start(); }).observe(canvas);
      }
      if (finePointer && this.o.stars) {
        window.addEventListener('mousemove', (e) => { this.mx = (e.clientX / window.innerWidth - 0.5); this.my = (e.clientY / window.innerHeight - 0.5); }, { passive: true });
      }
    }
    resize() {
      const r = this.o.fixed ? { width: window.innerWidth, height: window.innerHeight } : this.c.getBoundingClientRect();
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
      this.c.width = Math.round(this.w * this.dpr); this.c.height = Math.round(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (this.o.stars) {
        const base = (this.w * this.h) / 9000;
        const count = Math.round(base * (this.o.density / 50) * (isMobile ? 0.55 : 1));
        this.stars = Array.from({ length: Math.min(count, 420) }, () => ({
          x: Math.random() * this.w, y: Math.random() * this.h,
          r: Math.random() < 0.08 ? rand(1.1, 1.8) : rand(0.3, 1),
          z: rand(0.2, 1), a: rand(0.3, 1), tw: rand(0.002, 0.012), ph: Math.random() * Math.PI * 2
        }));
      }
      if (reduce) this.draw(0);
    }
    spawn(burst = false) {
      const angle = rand(Math.PI * 0.12, Math.PI * 0.28);
      const speed = rand(9, 16) * (burst ? 1.2 : 1);
      this.shooters.push({
        x: rand(this.w * -0.1, this.w * 0.85), y: rand(-this.h * 0.1, this.h * (burst ? 0.6 : 0.45)),
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0, max: rand(45, 80), len: rand(120, 260)
      });
    }
    burst(n = 14) { if (reduce) return; for (let i = 0; i < n; i++) setTimeout(() => this.spawn(true), i * rand(40, 140)); this.start(); }
    draw(t) {
      const { ctx } = this;
      ctx.clearRect(0, 0, this.w, this.h);
      const sp = this.o.speed / 100;
      for (const s of this.stars) {
        if (!reduce) { s.y += s.z * 0.05 * sp; if (s.y > this.h + 2) { s.y = -2; s.x = Math.random() * this.w; } }
        const tw = reduce ? 1 : 0.55 + 0.45 * Math.sin(s.ph + t * s.tw);
        const px = s.x + this.mx * s.z * -18, py = s.y + this.my * s.z * -18;
        ctx.globalAlpha = s.a * tw;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(px, py, s.r, 0, 6.2832); ctx.fill();
        if (s.r > 1.2) { ctx.globalAlpha = s.a * tw * 0.18; ctx.beginPath(); ctx.arc(px, py, s.r * 3.5, 0, 6.2832); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      for (let i = this.shooters.length - 1; i >= 0; i--) {
        const m = this.shooters[i];
        m.x += m.vx * (0.6 + sp); m.y += m.vy * (0.6 + sp); m.life++;
        const p = m.life / m.max, fade = p < 0.15 ? p / 0.15 : 1 - Math.max(0, (p - 0.5) / 0.5);
        const tx = m.x - (m.vx / Math.hypot(m.vx, m.vy)) * m.len, ty = m.y - (m.vy / Math.hypot(m.vx, m.vy)) * m.len;
        const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
        g.addColorStop(0, `rgba(255,255,255,${0.95 * fade})`);
        g.addColorStop(0.25, `rgba(200,215,255,${0.35 * fade})`);
        g.addColorStop(1, 'rgba(200,215,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${fade})`; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(m.x, m.y, 1.6, 0, 6.2832); ctx.fill(); ctx.shadowBlur = 0;
        if (m.life >= m.max || m.x > this.w + 300 || m.y > this.h + 300) this.shooters.splice(i, 1);
      }
    }
    loop(t) {
      if (!this.running) return;
      if (document.hidden || !this.visible) { this.running = false; return; }
      const chance = (this.o.shooting / 100) * 0.006;
      if (Math.random() < chance) this.spawn();
      this.draw(t);
      requestAnimationFrame(this.loop);
    }
    start() {
      if (reduce) { this.draw(0); this.c.classList.add('is-ready'); return; }
      if (this.running) return;
      this.running = true; this.c.classList.add('is-ready');
      requestAnimationFrame(this.loop);
    }
  }
  W.Sky = Sky;

  function initSkies() {
    const global = document.getElementById('Starfield');
    if (global && S.starfield) {
      W.sky = new Sky(global, { density: S.starDensity, speed: S.starSpeed, shooting: S.shootingFreq, fixed: true });
      const go = () => W.sky.start();
      // Erst nach dem Laden starten, damit der Seitenaufbau (LCP) nicht gebremst wird
      if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 600);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) W.sky.start(); });
    }
    initLocalSkies(document);
  }
  function initLocalSkies(root) {
    $$('canvas[data-sky]', root).forEach((c) => {
      if (c._sky) return;
      c._sky = new Sky(c, {
        fixed: false, stars: c.dataset.sky === 'full', density: Number(c.dataset.density || 40),
        speed: Number(c.dataset.speed || S.starSpeed || 40), shooting: Number(c.dataset.shooting || 60)
      });
      c._sky.start();
    });
  }
  // Sternschnuppen-Regen bei Countdown-Ende
  document.addEventListener('countdown:end', (e) => {
    const local = e.target.closest('.shopify-section') && e.target.closest('.shopify-section').querySelector('canvas[data-sky]');
    if (local && local._sky) local._sky.burst(18);
    else if (W.sky) W.sky.burst(18);
  });
  W.shootingBurst = (n) => W.sky && W.sky.burst(n);

  /* ---------- Custom Cursor mit Glow-Trail ---------- */
  function initCursor() {
    if (!S.cursor || reduce || !finePointer) return;
    const el = document.querySelector('.cursor');
    if (!el) return;
    document.documentElement.classList.add('has-cursor');
    const dot = el.querySelector('.cursor__dot'), ring = el.querySelector('.cursor__ring');
    const trail = Array.from({ length: 8 }, (_, i) => {
      const t = document.createElement('span'); t.className = 'cursor-trail'; t.style.opacity = String(0.5 - i * 0.055);
      t.style.transform = 'translate(-100px,-100px)'; el.appendChild(t); return { el: t, x: -100, y: -100 };
    });
    let x = -100, y = -100, rx = -100, ry = -100, active = false;
    window.addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; if (!active) { active = true; rx = x; ry = y; requestAnimationFrame(tick); } }, { passive: true });
    document.addEventListener('mousedown', () => el.classList.add('is-down'));
    document.addEventListener('mouseup', () => el.classList.remove('is-down'));
    document.addEventListener('mouseover', (e) => { el.classList.toggle('is-hover', !!e.target.closest('a, button, [data-cursor], label, summary, .card')); });
    document.addEventListener('mouseleave', () => { el.style.opacity = '0'; });
    document.addEventListener('mouseenter', () => { el.style.opacity = '1'; });
    function tick() {
      rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
      dot.style.transform = `translate3d(${x}px,${y}px,0)`;
      ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      let px = x, py = y;
      trail.forEach((t, i) => {
        t.x += (px - t.x) * (0.42 - i * 0.03); t.y += (py - t.y) * (0.42 - i * 0.03);
        t.el.style.transform = `translate3d(${t.x}px,${t.y}px,0) scale(${1 - i * 0.09})`;
        px = t.x; py = t.y;
      });
      if (Math.abs(x - rx) + Math.abs(y - ry) > 0.1 || Math.abs(trail[7].x - x) > 0.3) requestAnimationFrame(tick); else active = false;
    }
  }

  /* ---------- 3D-Tilt + Glanz auf Produktkarten ---------- */
  function initTilt() {
    if (!S.tilt || reduce || !finePointer) return;
    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest && e.target.closest('[data-tilt]');
      if (!card) return;
      const wrap = card.querySelector('.card__media-wrap') || card;
      const r = wrap.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      if (px < 0 || px > 1 || py < 0 || py > 1) return;
      card.classList.add('is-tilting');
      wrap.style.transform = `rotateX(${(0.5 - py) * 10}deg) rotateY(${(px - 0.5) * 12}deg) translateZ(0)`;
      card.style.setProperty('--mx', `${px * 100}%`); card.style.setProperty('--my', `${py * 100}%`);
    }, { passive: true });
    document.addEventListener('pointerout', (e) => {
      const card = e.target.closest && e.target.closest('[data-tilt]');
      if (!card || (e.relatedTarget && card.contains(e.relatedTarget))) return;
      card.classList.remove('is-tilting');
      const wrap = card.querySelector('.card__media-wrap') || card;
      wrap.style.transform = '';
    });
  }

  /* ---------- Magnetische Buttons ---------- */
  function initMagnetic() {
    if (!S.magnetic || reduce || !finePointer) return;
    document.addEventListener('pointermove', (e) => {
      const b = e.target.closest && e.target.closest('.is-magnetic');
      if (!b) return;
      const r = b.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      b.style.transform = `translate(${dx * 0.25}px, ${dy * 0.35}px)`;
    }, { passive: true });
    document.addEventListener('pointerout', (e) => {
      const b = e.target.closest && e.target.closest('.is-magnetic');
      if (!b || (e.relatedTarget && b.contains(e.relatedTarget))) return;
      b.style.transform = '';
    });
  }

  /* ---------- Text-Scramble / Glitch ---------- */
  const GLYPHS = '!<>-_\\/[]{}—=+*^?#✦★01WEAX';
  function scramble(el) {
    if (el._scrambled) return;
    el._scrambled = true;
    const nodes = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    if (!nodes.length) return;
    el.style.minHeight = el.offsetHeight + 'px';
    const items = nodes.map((n) => ({ n, final: n.nodeValue }));
    const total = items.reduce((a, i) => a + i.final.length, 0);
    const dur = Math.min(1400, 400 + total * 22);
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      let offset = 0;
      items.forEach((it) => {
        let out = '';
        for (let i = 0; i < it.final.length; i++) {
          const ch = it.final[i];
          const reveal = (offset + i) / total;
          out += ch === ' ' || reveal < p * 1.15 - 0.15 ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        offset += it.final.length;
        it.n.nodeValue = out;
      });
      if (p < 1) requestAnimationFrame(step);
      else { items.forEach((it) => (it.n.nodeValue = it.final)); el.style.minHeight = ''; }
    };
    requestAnimationFrame(step);
  }
  function initScramble(root = document) {
    if (!S.scramble || reduce) return;
    const els = $$('[data-scramble]', root);
    if (!els.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((ens) => ens.forEach((en) => { if (en.isIntersecting) { scramble(en.target); io.unobserve(en.target); } }), { threshold: 0.4 });
    els.forEach((el) => { el._scrambled = false; io.observe(el); });
    // Glitch bei Hover erneut
    if (finePointer) els.forEach((el) => el.addEventListener('mouseenter', () => { el._scrambled = false; scramble(el); }));
  }

  /* ---------- Parallax (Maus + Scroll) ---------- */
  function initParallax(root = document) {
    if (reduce) return;
    $$('[data-parallax]', root).forEach((scene) => {
      if (scene._px) return; scene._px = true;
      const layers = $$('[data-depth]', scene);
      let mx = 0, my = 0, sy = 0, raf = 0;
      const apply = () => {
        raf = 0;
        layers.forEach((l) => {
          const d = Number(l.dataset.depth || 0.1);
          l.style.transform = `translate3d(${mx * d * 40}px, ${my * d * 40 + sy * d}px, 0)`;
        });
      };
      const queue = () => { if (!raf) raf = requestAnimationFrame(apply); };
      if (finePointer) scene.addEventListener('mousemove', (e) => {
        const r = scene.getBoundingClientRect();
        mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5; queue();
      }, { passive: true });
      if (!isMobile) window.addEventListener('scroll', () => {
        const r = scene.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        sy = -r.top * 0.6; queue();
      }, { passive: true });
    });
  }

  /* ---------- Seitenübergänge ---------- */
  function initTransitions() {
    if (!S.transitions || reduce || W.designMode) return;
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download') || a.dataset.noTransition !== undefined || a.closest('[data-no-transition]')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
      if (/\/(checkout|cart\/(add|change|clear)|account\/logout)/.test(url.pathname)) return;
      e.preventDefault();
      document.documentElement.classList.add('is-leaving');
      setTimeout(() => { location.href = url.href; }, 320);
    });
  }

  /* ---------- Start ---------- */
  function boot() {
    initPreloader();
    initSkies();
    initCursor();
    initTilt();
    initMagnetic();
    initScramble();
    initParallax();
    initTransitions();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  document.addEventListener('weax:section-load', (e) => {
    initLocalSkies(e.detail); initScramble(e.detail); initParallax(e.detail);
  });
})();
