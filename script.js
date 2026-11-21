/* ==========================================================================
   Restaurant Xanthi – script.js
   --------------------------------------------------------------------------
   OBEN: Was der Inhaber selbst pflegen kann (Hinweisfeld, Öffnungszeiten
         für den Live-Status). Die SPEISEKARTE steht direkt in index.html.
   UNTEN: Technik (Live-Status, Speisekarten-Tabs, Animationen). Hier muss im
         Alltag nichts angepasst werden.
   ========================================================================== */


/* ==========================================================================
   1. HINWEISFELD (Betriebsurlaub, geänderte Zeiten …)
   --------------------------------------------------------------------------
   - aktiv:  true = Hinweis verwenden, false = komplett aus
   - von / bis: Zeitraum, in dem der Hinweis angezeigt wird (Format JJJJ-MM-TT,
     "bis" einschließlich). Danach verschwindet er automatisch.
   - geschlossen: true = Restaurant ist in diesem Zeitraum zu
     (dann zeigt der Live-Status oben "Betriebsurlaub" statt "Jetzt geöffnet").
   Tipp zum Ausprobieren: index.html?hinweis-vorschau im Browser aufrufen.
   ========================================================================== */
const HINWEIS = {
  aktiv: false,
  von: '2026-12-22',
  bis: '2027-01-06',
  geschlossen: true,
  titel: 'Betriebsurlaub:',
  text: 'Vom 22.12. bis einschließlich 06.01. machen wir Pause. Ab dem 07.01. sind wir wieder für Sie da – Kalí Chroniá!'
};


/* ==========================================================================
   2. ÖFFNUNGSZEITEN für den Live-Status ("Jetzt geöffnet")
   0 = Sonntag, 1 = Montag … 6 = Samstag. Leere Liste = Ruhetag.
   (Bei Änderungen bitte auch die Tabelle in index.html anpassen.)
   ========================================================================== */
const OEFFNUNGSZEITEN = {
  0: [['12:00', '14:30'], ['17:00', '21:00']], // Sonntag
  1: [],                                        // Montag – Ruhetag
  2: [],                                        // Dienstag – Ruhetag
  3: [['17:00', '22:00']],                      // Mittwoch
  4: [['17:00', '22:00']],                      // Donnerstag
  5: [['17:00', '22:00']],                      // Freitag
  6: [['17:00', '22:00']]                       // Samstag
};


/* ==========================================================================
   AB HIER: TECHNIK
   ========================================================================== */
(function () {
  'use strict';

  const root = document.documentElement;
  const MOTION = root.classList.contains('motion');
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  /* ---------- Zeit immer in deutscher Zeit (Europe/Berlin), egal wo der Besucher ist ---------- */
  function berlinNow() {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23'
    }).formatToParts(new Date()).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      day: days[parts.weekday],
      minutes: parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10)
    };
  }
  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  /* ---------- 1. Hinweisfeld ---------- */
  const preview = /[?&]hinweis-vorschau/.test(location.search);
  function noticeActive(today) {
    if (preview) return true;
    return HINWEIS.aktiv && today >= HINWEIS.von && today <= HINWEIS.bis;
  }
  function initNotice() {
    const el = $('#notice');
    if (!el || !noticeActive(berlinNow().date)) return;
    $('.notice__title', el).textContent = HINWEIS.titel;
    $('.notice__text', el).textContent = (preview && !HINWEIS.aktiv ? '[Vorschau] ' : '') + HINWEIS.text;
    el.hidden = false;
  }

  /* ---------- 2. Live-Status "Jetzt geöffnet / geschlossen" ---------- */
  function updateStatus() {
    const el = $('#live-status');
    if (!el) return;
    const now = berlinNow();
    const text = $('.status__text', el);
    let open = false;
    let msg;

    if (HINWEIS.geschlossen && noticeActive(now.date)) {
      msg = 'Derzeit Betriebsurlaub';
    } else {
      const today = OEFFNUNGSZEITEN[now.day] || [];
      const current = today.find(([a, b]) => now.minutes >= toMin(a) && now.minutes < toMin(b));
      if (current) {
        open = true;
        msg = `Jetzt geöffnet · bis ${current[1]} Uhr`;
      } else {
        const laterToday = today.find(([a]) => toMin(a) > now.minutes);
        if (laterToday) {
          msg = `Geschlossen · öffnet heute um ${laterToday[0]} Uhr`;
        } else {
          for (let i = 1; i <= 7; i++) {
            const d = (now.day + i) % 7;
            const slots = OEFFNUNGSZEITEN[d] || [];
            if (slots.length) {
              msg = `Geschlossen · öffnet ${i === 1 ? 'morgen' : WOCHENTAGE[d]} um ${slots[0][0]} Uhr`;
              break;
            }
          }
        }
      }
    }
    el.classList.toggle('is-open', open);
    el.classList.toggle('is-closed', !open);
    text.textContent = msg || 'Öffnungszeiten siehe unten';
  }

  /* ---------- Heutigen Tag in der Tabelle markieren ---------- */
  function markToday() {
    const row = $(`.hours__table tr[data-day="${berlinNow().day}"]`);
    if (row) {
      row.classList.add('is-today');
      row.setAttribute('aria-current', 'date');
    }
    return row;
  }

  /* ---------- 3. Speisekarte: Tabs aus dem vorhandenen HTML bauen ----------
     Die Gerichte stehen in index.html. Hier werden nur die Tabs ergänzt –
     ohne JS bleibt die komplette Karte sichtbar (Progressive Enhancement). */
  function initMenu() {
    const tabs = $('#menu-tabs');
    const cats = $$('#menu-panel .menu__cat');
    if (!tabs || !cats.length) return;

    // Anzahl der Gerichte und Stagger-Index automatisch ergänzen
    cats.forEach((cat) => {
      const dishes = $$('.dish', cat);
      $('.menu__cat-title', cat).insertAdjacentHTML('beforeend', `<span class="menu__cat-count">${dishes.length} Gerichte</span>`);
      dishes.forEach((d, i) => d.style.setProperty('--i', i));
    });

    const buttons = cats.map((cat) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'menu__tab';
      b.id = `tab-${cat.id}`;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', cat.id);
      b.textContent = cat.dataset.tab || $('.menu__cat-title', cat).firstChild.textContent.trim();
      tabs.appendChild(b);
      cat.setAttribute('role', 'tabpanel');
      cat.setAttribute('aria-labelledby', b.id);
      cat.tabIndex = 0;
      return b;
    });

    let current = -1;
    let timer = null;

    function select(index, focus) {
      if (index === current) return;
      buttons.forEach((b, i) => {
        b.setAttribute('aria-selected', i === index);
        b.tabIndex = i === index ? 0 : -1;
      });
      const btn = buttons[index];
      if (focus) btn.focus();
      // aktiven Tab in der horizontalen Leiste sichtbar machen (ohne die Seite vertikal zu scrollen)
      tabs.scrollTo({ left: btn.offsetLeft - tabs.clientWidth / 2 + btn.clientWidth / 2, behavior: MOTION ? 'smooth' : 'auto' });

      const old = cats[current];
      const next = cats[index];
      current = index;
      const swap = () => {
        // Kategorie wird wieder eingeblendet → die Gerichte-Animation startet neu
        cats.forEach((c) => { c.hidden = c !== next; c.classList.remove('is-leaving'); });
      };
      clearTimeout(timer);
      if (MOTION && old) {
        old.classList.add('is-leaving');   // weiches Ausblenden …
        timer = setTimeout(swap, 200);      // … dann fliegen die neuen Gerichte ein
      } else {
        swap();
      }
    }

    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.menu__tab');
      if (btn) select(buttons.indexOf(btn));
    });
    // Tastatur: Pfeiltasten, Pos1, Ende (ARIA-Tabs-Muster)
    tabs.addEventListener('keydown', (e) => {
      const max = buttons.length - 1;
      const map = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: max };
      if (!(e.key in map)) return;
      e.preventDefault();
      let next = map[e.key];
      if (next > max) next = 0;
      if (next < 0) next = max;
      select(next, true);
    });

    tabs.hidden = false;
    $('#menu-panel').classList.add('is-tabbed');
    select(0);
  }

  /* ---------- Zahlen hochzählen ---------- */
  function countUp(el) {
    const target = parseInt(el.dataset.count, 10);
    if (!MOTION || !target) return;
    const dur = 1400;
    const start = performance.now();
    el.textContent = '0';
    const tick = (t) => {
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Scroll-Reveal (IntersectionObserver) ---------- */
  function initReveal(todayRow) {
    const groups = $$('[data-reveal-group]');
    const meanders = $$('[data-meander]');

    // Reihenfolge innerhalb jeder Gruppe → Stagger-Index
    groups.forEach((g) => $$('[data-reveal]', g).forEach((el, i) => el.style.setProperty('--i', i)));

    if (!MOTION) return; // ohne Animationen ist bereits alles sichtbar

    const onGroupIn = (g) => {
      g.classList.add('is-in');
      $$('[data-count]', g).forEach((el) => setTimeout(() => countUp(el), 300));
      // nach dem Einblenden wieder schnelle Hover-Übergänge erlauben
      const items = $$('[data-reveal]', g);
      setTimeout(() => items.forEach((el) => el.classList.add('is-done')), 900 + items.length * 110);
      // Öffnungszeiten: heutiger Tag leuchtet zum Schluss kurz auf
      if (g.hasAttribute('data-hours') && todayRow) {
        const rows = $$('tr[data-reveal]', g).length;
        setTimeout(() => todayRow.classList.add('flash'), 150 + rows * 90 + 650);
      }
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el.hasAttribute('data-meander')) el.classList.add('is-drawn');
        else onGroupIn(el);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    groups.forEach((g) => io.observe(g));
    meanders.forEach((m) => io.observe(m));

    // Hero-Inhalte (bereits im Bild) zählen nicht dazu; die Hero-Mäanderlinie startet sofort
    const heroMeander = $('.meander--hero');
    if (heroMeander) requestAnimationFrame(() => heroMeander.classList.add('is-drawn'));
  }

  /* ---------- Scroll-Effekte: Fortschritt, Navigation, Parallax, Anruf-Button ---------- */
  function initScroll() {
    const header = $('.site-header');
    const bar = $('.progress__bar');
    const fab = $('.call-fab');
    const hero = $('.hero');
    const parallax = MOTION ? $$('[data-parallax]') : [];
    let ticking = false;

    function update() {
      ticking = false;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const max = document.documentElement.scrollHeight - vh;

      if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
      if (header) header.classList.toggle('is-solid', y > 24 || document.body.classList.contains('menu-open'));
      if (fab && hero) fab.classList.toggle('is-visible', y > hero.offsetHeight * 0.6);

      // Parallax: nur Elemente im/nahe dem Sichtbereich bewegen
      for (const el of parallax) {
        const host = el.closest('section') || el.parentElement;
        const r = host.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) continue;
        const speed = parseFloat(el.dataset.parallax) || 0;
        // Abstand der Sektion zur Bildschirmmitte als Basis → bewegt sich langsamer als der Inhalt
        const offset = host.classList.contains('hero') ? y : (r.top + r.height / 2 - vh / 2) * -1;
        el.style.setProperty('--py', `${(offset * speed).toFixed(1)}px`);
      }

      if (!MOTION) return;

      // Hero: Inhalt gleitet nach oben weg, die Sonne geht unter, der Himmel wird dunkler
      if (hero && y < heroH) {
        const p = y / heroH;
        if (heroContent) {
          heroContent.style.transform = `translate3d(0, ${(y * 0.32).toFixed(1)}px, 0)`;
          heroContent.style.opacity = Math.max(0, 1 - p * 1.4).toFixed(3);
        }
        if (dusk) dusk.style.opacity = Math.min(p * 1.1, 0.9).toFixed(3);
      }

      // Griechisches Schriftband: Zeilen laufen beim Scrollen gegenläufig seitwärts
      for (const row of scrollRows) {
        const r = row.parentElement.getBoundingClientRect();
        if (r.bottom < -50 || r.top > vh + 50) continue;
        const speed = parseFloat(row.dataset.scrollX) || 0;
        row.style.setProperty('--sx', `${((vh - r.top) * speed).toFixed(1)}px`);
      }
    }
    const heroContent = $('[data-hero-content]');
    const dusk = $('[data-dusk]');
    const scrollRows = $$('[data-scroll-x]');
    let heroH = hero ? hero.offsetHeight : 1;
    window.addEventListener('resize', () => { heroH = hero ? hero.offsetHeight : 1; }, { passive: true });

    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  /* ---------- Mobiles Menü ---------- */
  function initNav() {
    const toggle = $('.nav__toggle');
    const menu = $('#nav-menu');
    if (!toggle || !menu) return;
    const label = $('.visually-hidden', toggle);

    const setOpen = (open) => {
      // Overlay beginnt direkt unter der Navigation (auch wenn Demo-/Hinweisbalken darüber sichtbar sind)
      if (open) menu.style.setProperty('--menu-top', `${Math.max(0, $('.site-header').getBoundingClientRect().bottom)}px`);
      toggle.setAttribute('aria-expanded', open);
      menu.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
      label.textContent = open ? 'Menü schließen' : 'Menü öffnen';
      $('.site-header').classList.toggle('is-solid', open || window.scrollY > 24);
    };

    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
    });
    window.matchMedia('(min-width: 960px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
  }

  /* ---------- Aktiven Menüpunkt beim Scrollen markieren ---------- */
  function initScrollSpy() {
    const links = $$('.nav__links a');
    const map = new Map();
    links.forEach((a) => {
      const target = document.getElementById(a.getAttribute('href').slice(1));
      if (target) map.set(target, a);
    });
    if (!('IntersectionObserver' in window) || !map.size) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const link = map.get(e.target);
        if (e.isIntersecting) {
          links.forEach((l) => l.removeAttribute('aria-current'));
          link.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, section) => io.observe(section));
    // Ganz oben (Hero) ist kein Menüpunkt aktiv
    const hero = document.querySelector('.hero');
    if (hero) new IntersectionObserver(([e]) => {
      if (e.isIntersecting) links.forEach((l) => l.removeAttribute('aria-current'));
    }, { rootMargin: '-45% 0px -50% 0px' }).observe(hero);
  }

  /* ---------- Hero: Szene folgt sanft der Maus (Tiefenwirkung, nur Desktop) ---------- */
  function initPointerParallax() {
    const hero = $('.hero');
    if (!MOTION || !hero || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    const loop = () => {
      cx += (tx - cx) * 0.06;            // weiches Nachziehen
      cy += (ty - cy) * 0.06;
      hero.style.setProperty('--mx', cx.toFixed(3));
      hero.style.setProperty('--my', cy.toFixed(3));
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.001 ? requestAnimationFrame(loop) : null;
    };
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      tx = -((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = -((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(loop);
    });
    hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); });
  }

  /* ---------- Endlos-Animationen im Hero pausieren, wenn er nicht zu sehen ist ---------- */
  function initHeroPause() {
    const hero = $('.hero');
    if (!hero || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(([e]) => hero.classList.toggle('is-offscreen', !e.isIntersecting)).observe(hero);
  }

  /* ---------- Karten neigen sich 3D-artig zur Maus, mit Lichtreflex ---------- */
  function initTilt() {
    if (!MOTION || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    $$('[data-tilt]').forEach((card) => {
      let glare = null;
      const ready = () => !card.hasAttribute('data-reveal') || card.classList.contains('is-done');
      card.addEventListener('pointerenter', () => {
        if (!glare) { glare = document.createElement('span'); glare.className = 'tilt-glare'; card.appendChild(glare); }
      });
      card.addEventListener('pointermove', (e) => {
        if (!ready()) return;
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.transition = 'transform .12s ease-out, box-shadow .35s';
        card.style.transform = `perspective(900px) rotateX(${((0.5 - py) * 7).toFixed(2)}deg) rotateY(${((px - 0.5) * 9).toFixed(2)}deg) translateY(-4px)`;
        if (glare) glare.style.transform = `translate(${(px * r.width).toFixed(0)}px, ${(py * r.height).toFixed(0)}px)`;
      });
      card.addEventListener('pointerleave', () => {
        card.style.transition = '';
        card.style.transform = '';
      });
    });
  }

  /* ---------- Start ---------- */
  initNotice();
  updateStatus();
  setInterval(updateStatus, 60 * 1000);
  const todayRow = markToday();
  initMenu();
  initNav();
  initScroll();
  initReveal(todayRow);
  initScrollSpy();
  initPointerParallax();
  initHeroPause();
  initTilt();
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
