/* docs/bio.js — the floating biology layer, and the per-product hero that grows in from the right.
 *
 * The motifs are hand-drawn inline SVG rather than images: crisp at any size, a few hundred bytes
 * each, transparent by construction, and coloured from the page's own tokens. They are decoration
 * and nothing more — none of them is read from a result, and none sits on top of text.
 *
 * Everything here stops under prefers-reduced-motion: the motifs are placed and left still, and
 * the hero image appears without the grow-in.
 */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ── motifs: each is a viewBox-100 drawing using currentColor + one accent ──
  const M = {
    dna: `<path d="M30 6c0 22 40 22 40 44S30 72 30 94M70 6c0 22-40 22-40 44s40 22 40 44" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>
          <path d="M36 18h28M40 30h20M36 70h28M40 82h20M44 50h12" stroke="var(--m2)" stroke-width="4" stroke-linecap="round"/>`,
    cell: `<circle cx="50" cy="50" r="40" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="4"/>
           <circle cx="56" cy="46" r="15" fill="var(--m2)" fill-opacity=".85"/>
           <circle cx="56" cy="46" r="5" fill="#fff" fill-opacity=".85"/>
           <ellipse cx="32" cy="64" rx="8" ry="4.5" fill="currentColor" fill-opacity=".55" transform="rotate(-25 32 64)"/>
           <circle cx="70" cy="70" r="3.5" fill="currentColor" fill-opacity=".6"/><circle cx="28" cy="38" r="3" fill="currentColor" fill-opacity=".6"/>`,
    mito: `<ellipse cx="50" cy="50" rx="42" ry="22" fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="4"/>
           <path d="M16 50c6-12 10 12 16 0s10 12 16 0 10 12 16 0 10 12 16 0" fill="none" stroke="var(--m2)" stroke-width="4" stroke-linecap="round"/>`,
    leaf: `<path d="M18 82C18 40 46 14 86 14c0 40-26 68-68 68z" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
           <path d="M18 82C40 60 58 42 80 20M38 62l-2-16M52 48l14-2" fill="none" stroke="var(--m2)" stroke-width="3.5" stroke-linecap="round"/>`,
    hex: `<path d="M50 8l36 21v42L50 92 14 71V29z" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
          <circle cx="50" cy="8" r="6" fill="var(--m2)"/><circle cx="86" cy="71" r="6" fill="var(--m2)"/><circle cx="14" cy="71" r="6" fill="var(--m2)"/>`,
    neuron: `<circle cx="50" cy="48" r="13" fill="var(--m2)" fill-opacity=".85" stroke="currentColor" stroke-width="3.5"/>
             <path d="M50 35V10M39 42L18 26M61 42l20-16M42 58L22 76M58 58l12 30M70 88l10 4M70 88l-4 8" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`,
    flask: `<path d="M40 10h20M44 10v28L20 82a6 6 0 0 0 5 9h50a6 6 0 0 0 5-9L56 38V10" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
            <path d="M30 66h40l10 16a6 6 0 0 1-5 9H25a6 6 0 0 1-5-9z" fill="var(--m2)" fill-opacity=".7"/>
            <circle cx="44" cy="76" r="3.5" fill="#fff" fill-opacity=".8"/><circle cx="56" cy="72" r="2.5" fill="#fff" fill-opacity=".8"/>`,
    dish: `<ellipse cx="50" cy="56" rx="42" ry="16" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="4"/>
           <ellipse cx="50" cy="48" rx="42" ry="16" fill="none" stroke="currentColor" stroke-width="3" stroke-opacity=".6"/>
           <circle cx="36" cy="54" r="5" fill="var(--m2)"/><circle cx="58" cy="58" r="7" fill="var(--m2)" fill-opacity=".75"/><circle cx="66" cy="50" r="3.5" fill="var(--m2)"/>`,
    fish: `<path d="M12 50c16-20 46-26 66 0-20 26-50 20-66 0z" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
           <path d="M78 50l12-14v28z" fill="var(--m2)"/><path d="M44 36c8 6 12 12 6 22" fill="none" stroke="var(--m2)" stroke-width="3.5" stroke-linecap="round"/>
           <circle cx="26" cy="47" r="3.5" fill="currentColor"/>`,
    chromo: `<path d="M34 10c-6 14-6 30 6 40-12 10-12 26-6 40M66 10c6 14 6 30-6 40 12 10 12 26 6 40" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-opacity=".6"/>
             <circle cx="50" cy="50" r="7" fill="var(--m2)"/>`,
    scope: `<path d="M40 14l14 8-16 28-14-8z" fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
            <path d="M46 50a22 22 0 0 1 20 30M26 86h50M50 86V76" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
            <circle cx="30" cy="54" r="5" fill="var(--m2)"/>`,
    ribo: `<circle cx="38" cy="44" r="20" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="4"/>
           <circle cx="62" cy="58" r="16" fill="var(--m2)" fill-opacity=".55" stroke="currentColor" stroke-width="4"/>
           <path d="M10 86c20-8 30 4 50-4s22 0 32-6" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`,
  };

  // colour pairs drawn from the bright palette: stroke/fill + a second accent
  const PAL = [
    ['#0aa38a', '#f5b829'], ['#2f80ed', '#3fb950'], ['#ff7a59', '#0aa38a'],
    ['#3fb950', '#2f80ed'], ['#8b5cf6', '#f5b829'], ['#0aa38a', '#ff7a59'],
  ];

  function motifLayer() {
    const layer = document.createElement('div');
    layer.className = 'bio-layer';
    layer.setAttribute('aria-hidden', 'true');
    const keys = Object.keys(M);
    const N = innerWidth < 760 ? 10 : 18;
    const items = [];
    for (let i = 0; i < N; i++) {
      const k = keys[i % keys.length];
      const [c1, c2] = PAL[i % PAL.length];
      const size = 38 + ((i * 37) % 64);           // 38-102 px
      // Keep them out of the centre column, where the text and the 3D model live. Motifs that
      // drift across a caption stop being atmosphere and start being clutter.
      const side = i % 2 ? 1 : 0;                  // left gutter or right gutter
      const x = side ? 74 + ((i * 17) % 22) : 1 + ((i * 13) % 20);  // vw
      const y = ((i * 71) % 92) + 3;               // vh
      const depth = 0.25 + ((i * 29) % 75) / 100; // parallax 0.25-1.0
      const el = document.createElement('div');
      el.className = 'bio-m';
      el.style.cssText = `left:${x}vw;top:${y}vh;width:${size}px;height:${size}px;color:${c1};--m2:${c2};`
        + `--d:${(i % 7) * -2.3}s;--t:${16 + (i % 5) * 4}s;opacity:${(0.16 + depth * 0.28).toFixed(2)};`;
      el.innerHTML = `<svg viewBox="0 0 100 100">${M[k]}</svg>`;
      layer.appendChild(el);
      items.push({ el, depth });
    }
    document.body.prepend(layer);

    if (reduce) return;
    let ticking = false;
    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = scrollY;
        for (const it of items) it.el.style.translate = `0 ${(-y * it.depth * 0.18).toFixed(1)}px`;
        ticking = false;
      });
    }, { passive: true });
  }

  // ── per-product hero: grows in from the right whenever its tab is shown ──
  function heroes() {
    const panels = $$('.panel');
    const play = (panel) => {
      const fig = $('.phero-fig', panel);
      if (!fig) return;
      fig.classList.remove('in');
      void fig.offsetWidth;        // restart the transition on every tab switch
      requestAnimationFrame(() => fig.classList.add('in'));
    };
    const mo = new MutationObserver((recs) => {
      for (const r of recs) if (r.attributeName === 'hidden' && !r.target.hidden) play(r.target);
    });
    for (const p of panels) {
      mo.observe(p, { attributes: true, attributeFilter: ['hidden'] });
      if (!p.hidden) play(p);
      // a gentle 3D tilt that follows the pointer, so the hero object feels like an object
      const fig = $('.phero-fig', p);
      if (fig && !reduce) {
        fig.addEventListener('pointermove', (e) => {
          const r = fig.getBoundingClientRect();
          const dx = (e.clientX - r.left) / r.width - 0.5;
          const dy = (e.clientY - r.top) / r.height - 0.5;
          fig.style.setProperty('--rx', `${(-dy * 9).toFixed(2)}deg`);
          fig.style.setProperty('--ry', `${(dx * 12).toFixed(2)}deg`);
        });
        fig.addEventListener('pointerleave', () => {
          fig.style.setProperty('--rx', '0deg');
          fig.style.setProperty('--ry', '0deg');
        });
      }
    }
  }

  const go = () => { motifLayer(); heroes(); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', go);
  else go();
})();
