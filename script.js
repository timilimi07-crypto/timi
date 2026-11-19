/* ==========================================================================
   Restaurant Xanthi – script.js
   --------------------------------------------------------------------------
   OBEN: Alles, was der Inhaber selbst pflegen kann (Hinweisfeld, Zeiten,
         Speisekarte). Einfach Texte/Preise ändern, speichern, fertig.
   UNTEN: Technik (Live-Status, Speisekarte, Animationen). Hier muss im
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
   3. SPEISEKARTE
   Pro Gericht:  name, beschreibung (optional), preis (Zahl), veg (true = vegetarisch)
   Neue Kategorie = neuer Block { id, titel, kurz, gerichte: [...] }
   ========================================================================== */
const SPEISEKARTE = [
  {
    id: 'suppen', titel: 'Suppen', kurz: 'Suppen',
    gerichte: [
      { name: 'Hühnersuppe', preis: 5.80 },
      { name: 'Tomatensuppe', beschreibung: 'mit Croûtons', preis: 5.80, veg: true },
      { name: 'Gulaschsuppe', beschreibung: 'groß, scharf', preis: 7.60 }
    ]
  },
  {
    id: 'salate', titel: 'Salate', kurz: 'Salate',
    gerichte: [
      { name: 'Kleiner gemischter Salat', preis: 5.20, veg: true },
      { name: 'Gemischter Salat mit Thunfisch', beschreibung: 'mit Thunfisch, Käse, Oliven und Peperoni', preis: 10.50 },
      { name: 'Gemischter Salat mit Putenbrust', beschreibung: 'mit gebratener Putenbrust', preis: 12.50 },
      { name: 'Gemischter Salat mit Scampi', beschreibung: 'mit 2 Scampispießen', preis: 13.50 }
    ]
  },
  {
    id: 'vorspeisen', titel: 'Vorspeisen', kurz: 'Vorspeisen',
    gerichte: [
      { name: 'Tzatziki', preis: 5.20, veg: true },
      { name: 'Tarama', beschreibung: 'Kaviarcreme', preis: 6.70 },
      { name: 'Überbackener Schafskäse', beschreibung: 'mit Peperoni und Tomate', preis: 9.60, veg: true },
      { name: 'Garides', beschreibung: 'Scampis mit Zwiebeln und Feta in Tomatensauce', preis: 11.50 }
    ]
  },
  {
    id: 'gyros', titel: 'Gyros', kurz: 'Gyros',
    gerichte: [
      { name: 'Gyros Teller', beschreibung: 'mit Salat, Tzatziki und Pommes', preis: 16.50 },
      { name: 'Gyros Champignon', preis: 17.90 },
      { name: 'Gyros Fourno', beschreibung: 'mit Champignons und Metaxasauce, überbacken, dazu Brot', preis: 19.50 }
    ]
  },
  {
    id: 'grill', titel: 'Vom Grill', kurz: 'Vom Grill',
    gerichte: [
      { name: 'Souvlaki', beschreibung: '2 Schweinespieße mit Salat, Tzatziki und Reis', preis: 17.20 },
      { name: 'Bifteki', beschreibung: 'gefüllt mit Tomate, Feta und Peperoni', preis: 17.80 },
      { name: 'Paidakia', beschreibung: '5 Lammkoteletts', preis: 21.50 },
      { name: 'Filet-Teller', beschreibung: 'Schwein, Hähnchen, Pute und Lamm', preis: 25.50 }
    ]
  },
  {
    id: 'grill-spezial', titel: 'Spezialitäten vom Grill', kurz: 'Grill-Spezialitäten',
    gerichte: [
      { name: 'Schweinefilet', beschreibung: 'mit Champignons', preis: 20.40 },
      { name: 'Herkules-Spieß', beschreibung: 'Pute und Schwein', preis: 19.40 },
      { name: 'Lammfilets', beschreibung: 'mit Kräuterbutter und Kartoffelecken', preis: 26.50 },
      { name: 'Entrecôte', beschreibung: 'ca. 250 g, mit Kräuterbutter und Champignons', preis: 25.80 }
    ]
  },
  {
    id: 'pfanne', titel: 'Aus der Pfanne', kurz: 'Pfanne',
    gerichte: [
      { name: 'Grillpfanne Zeus', preis: 23.20 },
      { name: 'Schlemmerröllchen Akropolis', preis: 19.20 },
      { name: 'Putenbrust Athene', beschreibung: 'mit Broccoli und Sahnesauce', preis: 19.80 },
      { name: 'Veggi-Pfanne', beschreibung: 'mit Reisnudeln und Gemüse', preis: 15.50, veg: true }
    ]
  },
  {
    id: 'ofen', titel: 'Aus dem Ofen', kurz: 'Ofen',
    gerichte: [
      { name: 'Lammhaxe Stifado', preis: 20.50 },
      { name: 'Lammhaxe Fasolia', beschreibung: 'mit grünen Bohnen und Fladenbrot', preis: 20.50 },
      { name: 'Juwetzi Lamm', preis: 20.20 }
    ]
  },
  {
    id: 'gefluegel', titel: 'Geflügel', kurz: 'Geflügel',
    gerichte: [
      { name: 'Hähnchenbrust mit Ananas', beschreibung: 'mit Ananas und Metaxasauce', preis: 19.50 },
      { name: 'Putenbrust vom Grill', beschreibung: 'mit Kräuterbutter', preis: 17.80 },
      { name: 'Hähnchenbrustfilet', beschreibung: 'mit Metaxasauce', preis: 18.80 },
      { name: 'Putenpfanne Hera', preis: 19.60 }
    ]
  },
  {
    id: 'meer', titel: 'Aus dem Meer', kurz: 'Fisch',
    gerichte: [
      { name: 'Seezungenfilet', beschreibung: 'mit Knoblauchsauce', preis: 20.20 },
      { name: 'Fischplatte Poseidon', beschreibung: 'Rotbarsch, Lachs und Seezunge', preis: 16.80 },
      { name: 'Kalamaris', beschreibung: 'aus der Pfanne', preis: 19.80 },
      { name: 'Scampis auf Bandnudeln', beschreibung: 'in Hummersauce', preis: 18.90 }
    ]
  },
  {
    id: 'klein', titel: 'Für den kleinen Hunger', kurz: 'Kleiner Hunger',
    gerichte: [
      { name: 'Gyros Teller klein', preis: 11.80 },
      { name: 'Bifteki klein', preis: 13.90 },
      { name: 'Rinderleberpfanne', preis: 13.80 },
      { name: 'Putenbrust überbacken', preis: 12.80 }
    ]
  }
];


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

  /* ---------- 3. Speisekarte mit Tabs ---------- */
  const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function renderCategory(cat) {
    const items = cat.gerichte.map((g, i) => `
      <li class="dish" style="--i:${i}">
        <span class="dish__name">${esc(g.name)}${g.veg ? '<span class="veg-badge" title="vegetarisch"><svg class="icon" aria-hidden="true"><use href="#i-leaf"/></svg>veg.<span class="visually-hidden">, vegetarisch</span></span>' : ''}</span>
        <span class="dish__price">${euro.format(g.preis)}</span>
        <span class="dish__desc">${g.beschreibung ? esc(g.beschreibung) : ''}</span>
      </li>`).join('');
    return `
      <div class="menu__panel-inner">
        <h3 class="menu__cat-title">${esc(cat.titel)}<span class="menu__cat-count">${cat.gerichte.length} Gerichte</span></h3>
        <ul class="menu__list">${items}</ul>
      </div>`;
  }

  function initMenu() {
    const tabs = $('#menu-tabs');
    const panel = $('#menu-panel');
    if (!tabs || !panel || !SPEISEKARTE.length) return;

    tabs.innerHTML = SPEISEKARTE.map((cat, i) => `
      <button class="menu__tab" type="button" role="tab" id="tab-${cat.id}"
        aria-controls="menu-panel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"
        data-index="${i}">${esc(cat.kurz || cat.titel)}</button>`).join('');

    const buttons = $$('.menu__tab', tabs);
    let current = 0;
    let busy = null;

    function show(index, focus) {
      if (index === current && panel.firstElementChild) return;
      buttons.forEach((b, i) => {
        b.setAttribute('aria-selected', i === index);
        b.tabIndex = i === index ? 0 : -1;
      });
      const btn = buttons[index];
      panel.setAttribute('aria-labelledby', btn.id);
      if (focus) btn.focus();
      // aktiven Tab in der horizontalen Leiste sichtbar machen (ohne die Seite vertikal zu scrollen)
      tabs.scrollTo({ left: btn.offsetLeft - tabs.clientWidth / 2 + btn.clientWidth / 2, behavior: MOTION ? 'smooth' : 'auto' });

      const swap = () => { panel.innerHTML = renderCategory(SPEISEKARTE[index]); current = index; };
      const old = $('.menu__panel-inner', panel);
      clearTimeout(busy);
      if (MOTION && old) {
        old.classList.add('is-leaving');           // weiches Ausblenden …
        busy = setTimeout(swap, 200);               // … dann neue Gerichte einfliegen lassen
      } else {
        swap();
      }
    }

    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.menu__tab');
      if (btn) show(Number(btn.dataset.index));
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
      show(next, true);
    });

    panel.innerHTML = renderCategory(SPEISEKARTE[0]);
    panel.setAttribute('aria-labelledby', buttons[0].id);
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
    }

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
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
