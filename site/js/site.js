/* Growth Gusto · site pages: menu, header shadow, reveal on scroll, gentle parallax on phones, reading progress. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  const top = $('.top');
  const onScroll = () => { if (top) top.classList.toggle('sc', scrollY > 8); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  const bg = $('#burger'), menu = $('#menu');
  if (bg && menu) bg.addEventListener('click', () => { const o = menu.hidden; menu.hidden = !o; bg.setAttribute('aria-expanded', o); });
  if (menu) menu.addEventListener('click', (e) => { if (e.target.closest('a')) { menu.hidden = true; bg.setAttribute('aria-expanded', 'false'); } });

  const els = $$('[data-r]');
  if (reduce || !('IntersectionObserver' in window)) els.forEach((el) => el.classList.add('in'));
  else {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px', threshold: .06 });
    els.forEach((el) => io.observe(el));
  }

  if (!reduce) {
    const ph = $$('.stage .phone');
    const bar = $('.progress'), art = $('.prose');
    let tick = false;
    const frame = () => {
      tick = false;
      const vh = innerHeight;
      ph.forEach((p) => { const r = p.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return; const k = (r.top + r.height / 2 - vh / 2) / vh; p.style.transform = `translateY(${(k * -26).toFixed(1)}px)`; });
      if (bar && art) { const r = art.getBoundingClientRect(); const k = Math.min(1, Math.max(0, (vh * .3 - r.top) / (r.height - vh * .4))); bar.style.transform = `scaleX(${k})`; }
    };
    addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(frame); } }, { passive: true });
    frame();
  }
})();
