/* =====================================================================
   WEAX Night – product.js
   Variantenauswahl, Preis-/Bild-Update, Galerie (Swipe, Hover-Zoom, Lightbox),
   Sticky Add-to-Cart auf Mobile. Wird nur auf Produkt-Sections geladen.
   ===================================================================== */
(() => {
  'use strict';
  const W = window.WEAX || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function formatMoney(cents, format) {
    const fmt = format || W.moneyFormat || '{{amount_with_comma_separator}} €';
    const value = Number(cents) / 100;
    const fix = (n, d, ts, ds) => {
      const parts = n.toFixed(d).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ts);
      return parts.join(ds);
    };
    return fmt.replace(/\{\{\s*(\w+)\s*\}\}/, (_, key) => {
      switch (key) {
        case 'amount': return fix(value, 2, ',', '.');
        case 'amount_no_decimals': return fix(value, 0, ',', '.');
        case 'amount_no_decimals_with_comma_separator': return fix(value, 0, '.', ',');
        case 'amount_with_apostrophe_separator': return fix(value, 2, "'", '.');
        case 'amount_with_comma_separator':
        default: return fix(value, 2, '.', ',');
      }
    });
  }
  W.formatMoney = formatMoney;

  class Product {
    constructor(root) {
      this.root = root;
      this.picker = $('[data-variant-picker]', root);
      const vJson = this.picker && $('[data-variants]', this.picker);
      this.variants = vJson ? JSON.parse(vJson.textContent) : [];
      const inv = $('[data-inventory]', root);
      this.inventory = inv ? JSON.parse(inv.textContent) : {};
      this.lowThreshold = Number(root.dataset.lowThreshold || 5);
      this.form = $('form[data-product-form]', root);
      this.idInput = this.form && $('[data-variant-id]', this.form);
      this.gallery = $('[data-gallery]', root);
      this.track = this.gallery && $('.gallery__track', this.gallery);
      this.updateUrl = root.dataset.updateUrl === 'true';
      if (this.picker) this.picker.addEventListener('change', () => this.onChange());
      this.initGallery();
      this.initSticky();
      if (this.variants.length) this.markAvailability(this.current());
    }

    selected() { return $$('fieldset', this.picker).map((fs) => { const c = $('input:checked', fs); return c ? c.value : null; }); }
    current() { const id = this.idInput ? Number(this.idInput.value) : null; return this.variants.find((v) => v.id === id) || this.variants[0]; }

    onChange() {
      const sel = this.selected();
      let variant = this.variants.find((v) => v.options.every((o, i) => o === sel[i]));
      $$('fieldset', this.picker).forEach((fs, i) => { const out = $('[data-option-value]', fs); if (out) out.textContent = sel[i] || ''; });
      this.markAvailability(variant);
      this.update(variant);
    }

    // Nicht verfügbare Kombinationen durchstreichen
    markAvailability(variant) {
      if (!this.picker) return;
      const sel = variant ? variant.options : this.selected();
      $$('fieldset', this.picker).forEach((fs, idx) => {
        $$('input', fs).forEach((input) => {
          const test = sel.slice(); test[idx] = input.value;
          const match = this.variants.find((v) => v.options.every((o, i) => o === test[i]));
          const label = $(`label[for="${input.id}"]`, fs);
          if (label) label.classList.toggle('is-unavailable', !match || !match.available);
        });
      });
    }

    update(variant) {
      const btns = $$('[data-add-to-cart]', this.root).concat($$('[data-sticky-add]', document).filter((b) => b.dataset.stickyFor === this.root.id));
      const labels = $$('[data-add-label]', this.root).concat($$('[data-sticky-label]', document));
      if (!variant) {
        btns.forEach((b) => (b.disabled = true));
        labels.forEach((l) => (l.textContent = W.strings.unavailable));
        return;
      }
      if (this.idInput) { this.idInput.value = variant.id; this.idInput.dispatchEvent(new Event('change', { bubbles: true })); }
      btns.forEach((b) => (b.disabled = !variant.available));
      labels.forEach((l) => (l.textContent = variant.available ? W.strings.addToCart : W.strings.soldOut));

      // Preis
      $$('[data-price]', this.root).concat($$('[data-sticky-price]', document)).forEach((p) => {
        const cur = $('[data-price-current]', p) || p;
        cur.textContent = formatMoney(variant.price);
        const cmp = $('[data-price-compare]', p);
        if (cmp) {
          const sale = variant.compare_at_price && variant.compare_at_price > variant.price;
          cmp.hidden = !sale;
          cmp.textContent = sale ? formatMoney(variant.compare_at_price) : '';
          p.classList.toggle('price--sale', !!sale);
        }
      });

      // Bestand
      const stock = $('[data-stock]', this.root);
      if (stock) {
        const qty = this.inventory[variant.id];
        const s = this.root.dataset;
        let html;
        if (!variant.available) html = `<span class="stock__dot stock__dot--out"></span>${s.tOut}`;
        else if (qty !== null && qty !== undefined && qty > 0 && qty <= this.lowThreshold) html = `<span class="stock__dot stock__dot--low"></span>${s.tLow.replace('__COUNT__', qty)}`;
        else html = `<span class="stock__dot"></span>${s.tIn}`;
        stock.innerHTML = html;
      }

      // Bild der Variante zeigen
      if (variant.featured_media && this.track) {
        const item = $(`[data-media-id="${variant.featured_media.id}"]`, this.track);
        if (item) this.goTo(item);
      }

      // URL aktualisieren (teilbarer Link)
      if (this.updateUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());
      }
      this.root.dispatchEvent(new CustomEvent('variant:change', { detail: { variant }, bubbles: true }));
    }

    /* ---------- Galerie ---------- */
    goTo(item) {
      $$('.gallery__item', this.track).forEach((i) => i.classList.toggle('is-active', i === item));
      const horizontal = this.track.scrollWidth > this.track.clientWidth + 4;
      if (horizontal) this.track.scrollTo({ left: item.offsetLeft - this.track.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
      else if (this.gallery.classList.contains('gallery--grid') || this.gallery.classList.contains('gallery--stack')) {
        if (this.track.firstElementChild !== item) this.track.prepend(item); // Variantenbild nach vorne holen
      }
    }

    initGallery() {
      if (!this.gallery) return;
      const dots = $$('.gallery__dots span', this.gallery);
      // Punkte-Anzeige beim Swipen
      if (dots.length && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver((ens) => ens.forEach((en) => {
          if (en.isIntersecting && en.intersectionRatio > 0.6) {
            const i = Number(en.target.dataset.index);
            dots.forEach((d, j) => d.classList.toggle('is-active', i === j));
          }
        }), { root: this.track, threshold: [0.6] });
        $$('.gallery__item', this.track).forEach((it) => io.observe(it));
      }
      // Hover-Zoom (Desktop)
      if (finePointer && !reduce) {
        this.track.addEventListener('mousemove', (e) => {
          const z = e.target.closest('.gallery__zoom');
          if (!z) return;
          const img = $('img', z), r = z.getBoundingClientRect();
          img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
          z.classList.add('is-zooming');
        });
        this.track.addEventListener('mouseout', (e) => { const z = e.target.closest('.gallery__zoom'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('is-zooming'); });
      }
      // Lightbox
      const lb = $('[data-lightbox]', this.root);
      this.track.addEventListener('click', (e) => {
        const z = e.target.closest('[data-zoom]');
        if (!z || !lb) return;
        $$('img[data-src]', lb).forEach((img) => { img.src = img.dataset.src; img.removeAttribute('data-src'); });
        W.openOverlay(lb);
        const imgs = $$('.lightbox__track li', lb);
        const zoomIdx = $$('[data-zoom]', this.track).indexOf(z);
        const target = imgs[Math.max(0, zoomIdx)];
        if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'nearest', inline: 'start' }));
      });
    }

    /* ---------- Sticky Add-to-Cart (Mobile) ---------- */
    initSticky() {
      const bar = document.querySelector(`[data-sticky-atc="${this.root.id}"]`);
      const btn = this.form && $('[data-add-to-cart]', this.form);
      if (!bar || !btn || !('IntersectionObserver' in window)) return;
      new IntersectionObserver(([en]) => {
        const past = !en.isIntersecting && en.boundingClientRect.top < 0;
        bar.classList.toggle('is-visible', past);
      }).observe(btn);
      bar.addEventListener('click', (e) => {
        if (!e.target.closest('[data-sticky-add]')) return;
        e.preventDefault();
        if (this.form.requestSubmit) this.form.requestSubmit(); else btn.click();
      });
    }
  }

  function init(root = document) {
    $$('[data-product]', root).forEach((el) => { if (!el._product) el._product = new Product(el); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init()); else init();
  document.addEventListener('shopify:section:load', (e) => init(e.target));
})();
