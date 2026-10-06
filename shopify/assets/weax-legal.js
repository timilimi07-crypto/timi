/* WEAX Rechtstexte – Inhaltsverzeichnis, Überschriften, Leiste aller Rechtstexte.
   Datei: assets/weax-legal.js (wird von snippets/weax-legal-style.liquid geladen) */
(function () {
  function slug(s, i) {
    return 'abschnitt-' + (i + 1) + '-' + s.toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  }

  // Fett gedruckte Absatz-Anfänge ("<p><strong>§ 1 …</strong><br>Text</p>") zu echten Überschriften machen
  function promoteHeadings(content) {
    content.querySelectorAll(':scope > p').forEach(function (p) {
      var first = p.firstElementChild;
      if (!first || first.tagName !== 'STRONG') return;
      var before = p.innerHTML.slice(0, p.innerHTML.indexOf('<strong')).trim();
      if (before) return;
      var title = first.textContent.trim();
      if (!title || title.length > 90) return;
      var h = document.createElement('h2');
      h.textContent = title;
      first.remove();
      while (p.firstChild && (p.firstChild.nodeName === 'BR' || (p.firstChild.nodeType === 3 && !p.firstChild.textContent.trim()))) p.firstChild.remove();
      p.parentNode.insertBefore(h, p);
      if (!p.textContent.trim() && !p.querySelector('img')) p.remove();
    });
  }

  function buildToc(content, holder) {
    var hs = content.querySelectorAll('h2');
    if (hs.length < 3 || !holder) return;
    var items = '';
    hs.forEach(function (h, i) {
      if (!h.id) h.id = slug(h.textContent, i);
      items += '<li><a href="#' + h.id + '">' + h.textContent.replace(/</g, '&lt;') + '</a></li>';
    });
    var open = window.matchMedia('(min-width: 901px)').matches ? ' open' : '';
    holder.innerHTML = '<details' + open + '><summary class="wl__toc-h">Inhalt</summary><ol>' + items + '</ol></details>';
    holder.hidden = false;
    holder.parentElement.classList.add('has-toc');

    if (!('IntersectionObserver' in window)) return;
    var links = holder.querySelectorAll('a');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    hs.forEach(function (h) { io.observe(h); });
  }

  function insertDocs(hero) {
    var tpl = document.getElementById('wl-docs-tpl');
    if (!tpl || !hero || hero.querySelector('.wl__docs')) return;
    var list = tpl.content.cloneNode(true);
    list.querySelectorAll('a').forEach(function (a) {
      if (a.pathname === location.pathname) a.setAttribute('aria-current', 'page');
    });
    hero.appendChild(list);
  }

  function init() {
    // Seiten mit der Vorlage "legal"
    document.querySelectorAll('.wl').forEach(function (root) {
      var content = root.querySelector('.wl__content');
      if (content) promoteHeadings(content);
      insertDocs(root.querySelector('[data-wl-docs]'));
      buildToc(content, root.querySelector('.wl__toc'));
    });

    // Shopify-Richtlinien unter /policies/...
    var pol = document.querySelector('.shopify-policy__container');
    if (pol && !pol.dataset.wlDone) {
      pol.dataset.wlDone = '1';
      var hero = pol.querySelector('.shopify-policy__title');
      if (hero) {
        var eb = document.createElement('span');
        eb.className = 'wl__eyebrow'; eb.textContent = 'Rechtliches';
        hero.insertBefore(eb, hero.firstChild);
        insertDocs(hero);
      }
      var body = pol.querySelector('.shopify-policy__body');
      var rte = body && (body.querySelector('.rte') || body);
      if (rte) {
        promoteHeadings(rte);
        var layout = document.createElement('div');
        layout.className = 'wl__layout';
        var toc = document.createElement('nav');
        toc.className = 'wl__toc'; toc.hidden = true; toc.setAttribute('aria-label', 'Inhalt');
        body.parentNode.insertBefore(layout, body);
        layout.appendChild(toc); layout.appendChild(body);
        buildToc(rte, toc);
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
