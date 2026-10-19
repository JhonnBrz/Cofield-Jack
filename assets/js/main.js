/* Cofield · landing — interações de scroll */
(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');
  if (reduce) root.classList.add('no-motion');

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  /* ---------- scroll suave ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);

    // âncoras internas passam pelo Lenis, com compensação do header
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      const target = id === '#topo' ? 0 : document.querySelector(id);
      if (target === null) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: target === 0 ? 0 : -88, duration: 1.4 });
      if (target !== 0) history.replaceState(null, '', id);
    });
  }

  /* ---------- entrada dos elementos ---------- */
  const inEls = [...document.querySelectorAll('[data-in]')];
  // escalonamento por grupo de irmãos
  const groups = new Map();
  inEls.forEach((el) => {
    const parent = el.parentElement;
    const i = groups.get(parent) || 0;
    el.style.setProperty('--stagger', Math.min(i, 6) * 90);
    groups.set(parent, i + 1);
  });
  if (reduce || !('IntersectionObserver' in window)) {
    inEls.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    inEls.forEach((el) => io.observe(el));
  }

  /* ---------- progresso ligado ao scroll ---------- */
  // p = 0 quando o topo do elemento está em data-start * vh, 1 em data-end * vh
  const progEls = [...document.querySelectorAll('[data-progress]')].map((el) => ({
    el,
    start: parseFloat(el.dataset.start || '1'),
    end: parseFloat(el.dataset.end || '0.3'),
    last: -1,
    counter: el.querySelector('.res__big span'),
    cut: parseFloat(getComputedStyle(el).getPropertyValue('--cut')) || 0,
  }));
  const readbar = document.querySelector('[data-readbar]');
  const hdr = document.querySelector('[data-hdr]');
  let lastY = window.scrollY;

  const update = () => {
    const vh = window.innerHeight;
    const y = window.scrollY;

    progEls.forEach((o) => {
      let p = 1;
      if (!reduce) {
        const top = o.el.getBoundingClientRect().top;
        p = clamp((o.start * vh - top) / ((o.start - o.end) * vh));
      }
      p = Math.round(p * 1000) / 1000;
      if (p === o.last) return;
      o.last = p;
      o.el.style.setProperty('--p', p);
      if (o.counter && o.cut) o.counter.textContent = Math.round(o.cut * p);
    });

    // linha do tempo do header
    const max = document.documentElement.scrollHeight - vh;
    if (readbar) readbar.style.setProperty('--read', max > 0 ? (y / max).toFixed(4) : 0);

    // header some ao descer, volta ao subir
    if (hdr) {
      const down = y > lastY + 4;
      const up = y < lastY - 4;
      if (y < 200 || up) hdr.classList.remove('is-hidden');
      else if (down) hdr.classList.add('is-hidden');
    }
    lastY = y;
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  };
  if (lenis) lenis.on('scroll', onScroll);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();

  /* ---------- contadores ---------- */
  const fmt = (n, d) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const counters = [...document.querySelectorAll('[data-count]')];
  if (!reduce && 'IntersectionObserver' in window) {
    counters.forEach((el) => { el.textContent = fmt(0, +(el.dataset.decimals || 0)); });
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        cio.unobserve(el);
        const to = parseFloat(el.dataset.count);
        const d = +(el.dataset.decimals || 0);
        const dur = 1800;
        const t0 = performance.now();
        const step = (t) => {
          const k = clamp((t - t0) / dur);
          const e = 1 - Math.pow(1 - k, 4);
          el.textContent = fmt(to * e, d);
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => cio.observe(el));
  }

  /* ---------- telas do hero (abas) ---------- */
  const tabs = [...document.querySelectorAll('.screen__tabs [role="tab"]')];
  const views = [...document.querySelectorAll('.screen__view img')];
  let current = 0;
  let timer = null;
  const show = (i, focus = false) => {
    current = (i + tabs.length) % tabs.length;
    tabs.forEach((t, j) => {
      const on = j === current;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    views.forEach((v, j) => v.classList.toggle('is-on', j === current));
  };
  const stop = () => { clearInterval(timer); timer = null; };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { stop(); show(i); });
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); stop(); show(current + 1, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); stop(); show(current - 1, true); }
    });
  });
  if (!reduce && tabs.length) {
    const screen = document.querySelector('.screen');
    const start = () => { if (!timer) timer = setInterval(() => show(current + 1), 5200); };
    // só alterna enquanto a tela está visível
    new IntersectionObserver(([en]) => (en.isIntersecting ? start() : stop()), { threshold: 0.3 }).observe(screen);
    screen.addEventListener('pointerenter', stop, { once: true });
  }

  /* ---------- marquee de clientes ---------- */
  const track = document.querySelector('.marquee__track');
  if (track && !reduce) {
    [...track.children].forEach((li) => {
      const c = li.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      c.querySelector('img').alt = '';
      track.appendChild(c);
    });
  }

  /* ---------- ecossistema: palco fixo ---------- */
  const mods = [...document.querySelectorAll('[data-eco]')];
  const slides = [...document.querySelectorAll('[data-slide]')];
  const ticks = [...document.querySelectorAll('.eco__ticks i')];
  const activate = (i) => {
    mods.forEach((m, j) => m.classList.toggle('is-active', j === i));
    slides.forEach((s, j) => s.classList.toggle('is-on', j === i));
    ticks.forEach((t, j) => t.classList.toggle('is-on', j <= i));
  };
  if (mods.length && 'IntersectionObserver' in window) {
    activate(0);
    const eio = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) activate(+en.target.dataset.eco); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    mods.forEach((m) => eio.observe(m));
  }

  /* ---------- +300 obras: uma marca por obra ---------- */
  const dots = document.querySelector('.res__dots');
  if (dots) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 300; i++) {
      const d = document.createElement('i');
      d.style.setProperty('--d', Math.round((i % 30) * 14 + Math.floor(i / 30) * 40));
      frag.appendChild(d);
    }
    dots.appendChild(frag);
    const res = dots.closest('.res');
    if (reduce) res.classList.add('is-in');
  }
})();
