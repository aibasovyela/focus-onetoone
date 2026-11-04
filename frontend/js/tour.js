// Приветствие при первом входе + тур по кабинету (подсветка реальных элементов).
// Показ один раз на ученика: localStorage focus.tour.<id> = done; заново — кнопки [data-tour-start].
// Под автотестами (navigator.webdriver) само не всплывает, чтобы не перекрывать их клики;
// тест тура включает показ флагом localStorage focus.tour.test = 1.
const TOUR = (() => {
  const E = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDesk = () => matchMedia('(min-width: 1100px)').matches;
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  const key = () => `focus.tour.${APP.student()?.id || APP.student()?.name || 'anon'}`;
  const seen = () => { try { return localStorage.getItem(key()) === 'done'; } catch { return true; } };
  const markSeen = () => { try { localStorage.setItem(key(), 'done'); } catch { /* приватный режим */ } };
  const firstName = () => String(APP.student()?.name || '').trim().split(/\s+/)[0] || '';

  // ждём элемент (после смены экрана), до 3 с
  const find = async (sel) => {
    for (let t = 0; t < 60; t++) {
      const el = typeof sel === 'function' ? sel() : document.querySelector(sel);
      if (el && el.getClientRects().length && el.getBoundingClientRect().width > 0) return el;
      await wait(50);
    }
    return null;
  };

  // ---------- переходы между экранами для шагов ----------
  const modId = () => APP.tourModule()?.id || 'module-1';
  const setHash = (h) => { if (location.hash !== h) location.hash = h; };
  const goHome = async () => {
    if (DECK.isOpen()) { setHash(`#${modId()}`); await wait(260); }
    setHash('');
    await find('#modulesView .route-card');
  };
  // страница блока (#module-N: шапка + ДЗ) и страница урока (#module-N/lesson)
  const goModule = async () => {
    if (DECK.isOpen()) { setHash(`#${modId()}`); await wait(260); }
    setHash(`#${modId()}`);
    await find('#lessonEntry .lesson-entry');
  };
  const goLesson = async () => {
    if (DECK.isOpen()) { setHash(`#${modId()}/lesson`); await wait(260); }
    setHash(`#${modId()}/lesson`);
    await find('#detailCta .lesson-card, #detailCta .cta-start');
  };
  const goSlide = async (n) => {
    await goLesson();
    if (!APP.hasDeck()) return;
    setHash(`#${modId()}/lesson/${n}`);
    await find('.slide.is-current');
    await wait(reduced() ? 0 : 320);
  };
  // номер слайда с конструктором (или квизом) в текущем уроке
  const interactiveSlide = () => {
    const deck = window.__tourDeck;
    if (!deck) return 1;
    const { slides } = DECK.flatten(deck);
    const k = slides.findIndex(x => x.s.type === 'builder');
    const q = slides.findIndex(x => x.s.type === 'quiz');
    return (k >= 0 ? k : q >= 0 ? q : 0) + 1;
  };

  // ---------- шаги: общие и раздельные для телефона / десктопа ----------
  const STEPS = [
    {
      desk: { sel: '#sideNav .side-list', place: 'right' },
      mob: { sel: '#modulesGrid .route-step.is-active .route-card, #modulesGrid .route-card' },
      go: goHome,
      title: 'Маршрут из 5 блоков',
      text: () => isDesk()
        ? 'Слева — вся программа. Все пять блоков уже открыты, у каждого виден прогресс урока. Подсвечен тот, где ты сейчас.'
        : 'Это маршрут программы. Все пять блоков уже открыты: у карточки видны прогресс и дата созвона.'
    },
    {
      sel: '#heroNow .now-card',
      go: goHome,
      title: 'Продолжить с места',
      text: 'Карточка «Сейчас» — текущий блок. Кабинет помнит слайд, на котором ты остановился, и откроет урок именно там.'
    },
    {
      sel: '#lessonEntry .lesson-entry',
      go: goModule,
      title: 'Домашка и урок',
      text: 'На странице блока сразу под шапкой — домашнее задание: условие, критерии, срок и «Сдать ДЗ». Урок в слайдах — по кнопке «Открыть материал урока», около получаса; его стоит пройти до созвона.'
    },
    {
      sel: '#chaptersBlock',
      mob: { sel: '#chaptersBlock', parts: ['.block-head', '.ch-list li:nth-child(3)'] },
      go: goLesson,
      title: 'Главы и прогресс',
      text: 'Это страница урока. Главы с прогрессом — любую можно открыть сразу. Внизу «Текстовая версия»: весь урок на одной странице, если удобнее читать.'
    },
    {
      sel: '#overview',
      mob: { sel: '#overview', parts: ['.overview-tabs', '.tab-panel:not([hidden]) li:nth-child(2)'] },
      go: goLesson,
      title: 'Что получишь и план',
      text: 'Результаты, с которыми ты уйдёшь с созвона, и план двух часов по минутам. Ниже — материалы и переход к домашнему заданию.'
    },
    {
      desk: { sel: '.deck-rail', place: 'right' },
      mob: { sel: '.deck-foot' },
      need: () => !!window.__tourDeck,
      go: () => goSlide(2),
      title: 'Как листать',
      text: () => isDesk()
        ? 'Стрелки ← → на клавиатуре или кнопки внизу. Слева — оглавление: глава и слайд в один клик, сверху общий прогресс.'
        : 'Кнопки внизу или свайп влево-вправо. Название главы сверху открывает оглавление, полоски над ним — прогресс по главам.'
    },
    {
      sel: '.deck-stage',
      need: () => !!window.__tourDeck,
      go: () => goSlide(interactiveSlide()),
      title: 'Слайды, с которыми работают',
      text: 'Квизы с мгновенной проверкой, конструктор промпта и готовые промпты с кнопкой «Скопировать» — вставляй в ChatGPT, Claude или Gemini.'
    },
    {
      desk: { sel: '#sideNav .side-help', place: 'right', pad: 6 },
      mob: { sel: '.header-actions' },
      go: goModule,
      title: 'Тур всегда под рукой',
      text: () => (isDesk()
        ? '«Как пользоваться» запускает этот тур заново, внизу — «Выйти». Дата созвона — на странице блока и в маршруте.'
        : (matchMedia('(max-width: 479px)').matches ? 'Кнопка со знаком вопроса запускает этот тур заново' : '«Как пользоваться» запускает этот тур заново') + ', рядом — «Выйти». Дата созвона — на странице блока и в маршруте.')
    }
  ];

  // ---------- DOM ----------
  let root, hole, card, live;
  let state = null; // { steps, i, snapshot, busy }

  const ensure = () => {
    if (root) return;
    root = document.createElement('div');
    root.className = 'tour';
    root.hidden = true;
    root.innerHTML = `
      <div class="tour-block" aria-hidden="true"></div>
      <div class="tour-hole" aria-hidden="true"></div>
      <section class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourTitle" tabindex="-1">
        <button type="button" class="tour-x" data-t="close" aria-label="Закрыть тур"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <div class="tour-step"></div>
        <h3 class="tour-title" id="tourTitle"></h3>
        <p class="tour-text" aria-live="polite"></p>
        <div class="tour-dots" aria-hidden="true"></div>
        <div class="tour-nav">
          <button type="button" class="tour-btn tour-back" data-t="back">Назад</button>
          <button type="button" class="tour-btn tour-next" data-t="next">Далее</button>
        </div>
      </section>`;
    document.body.appendChild(root);
    hole = root.querySelector('.tour-hole');
    card = root.querySelector('.tour-card');
    live = root.querySelector('.tour-text');
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-t]')?.dataset.t;
      if (t === 'close') finish();
      else if (t === 'next') next(1);
      else if (t === 'back') next(-1);
    });
    swipe(card, (dir) => (dir === 'down' ? finish() : next(dir === 'left' ? 1 : -1)));
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
  };

  // свайп по карточке: влево/вправо — шаги, вниз — закрыть
  const swipe = (el, cb) => {
    let s = null;
    el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') s = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      if (!s) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      s = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3) cb(dx < 0 ? 'left' : 'right');
      else if (dy > 70 && dy > Math.abs(dx) * 1.3) cb('down');
    });
    el.addEventListener('pointercancel', () => { s = null; });
  };

  // клавиши перехватываем раньше плеера (capture), чтобы ←/→/Esc не листали слайды под туром
  const onKey = (e) => {
    if (!state && !welcomeEl) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); welcomeEl ? closeWelcome(false) : finish(); return; }
    if (!state) return;
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (e.key === 'Enter' && e.target.closest?.('[data-t]')) return; next(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); next(-1); }
    else if (e.key === 'Tab') { // фокус не уходит из карточки
      const f = [...card.querySelectorAll('button:not([disabled]):not([hidden])')];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  };
  window.addEventListener('keydown', onKey, true);

  const pick = (step) => {
    const v = (isDesk() ? step.desk : step.mob) || {};
    return { sel: v.sel || step.sel, place: v.place || step.place, pad: v.pad ?? step.pad ?? 8, parts: v.parts || step.parts };
  };

  // ---------- позиционирование: вырез вокруг элемента, карточка рядом и в пределах экрана ----------
  let target = null;
  let placeQueued = false;
  const place = () => {
    if (!state || !target || placeQueued) return;
    placeQueued = true;
    requestAnimationFrame(() => { placeQueued = false; layout(); });
  };

  // вырез по части элемента (например, заголовок + первые строки длинного списка)
  const rectOf = (el, parts) => {
    const list = (parts || []).map(p => el.querySelector(p)).filter(Boolean);
    if (!list.length) return el.getBoundingClientRect();
    const rs = list.map(n => n.getBoundingClientRect());
    const b = el.getBoundingClientRect();
    return { left: b.left, right: b.right, top: Math.min(...rs.map(x => x.top)), bottom: Math.max(...rs.map(x => x.bottom)) };
  };

  const layout = () => {
    if (!state || !target) return;
    const vw = innerWidth, vh = innerHeight, M = 12;
    const { pad, place: pref, parts } = pick(state.steps[state.i]);
    const r = rectOf(target, parts);
    const x0 = Math.max(M / 2, r.left - pad), y0 = Math.max(M / 2, r.top - pad);
    const x1 = Math.min(vw - M / 2, r.right + pad), y1 = Math.min(vh - M / 2, r.bottom + pad);
    hole.style.width = `${Math.max(0, x1 - x0)}px`;
    hole.style.height = `${Math.max(0, y1 - y0)}px`;
    hole.style.transform = `translate3d(${x0}px, ${y0}px, 0)`;

    const cw = card.offsetWidth, ch = card.offsetHeight;
    const fits = (x, y) => x >= M && y >= M && x + cw <= vw - M && y + ch <= vh - M;
    const clampX = (x) => Math.min(Math.max(M, x), vw - M - cw);
    const clampY = (y) => Math.min(Math.max(M, y), vh - M - ch);
    const cx = clampX((x0 + x1) / 2 - cw / 2);
    const cy = clampY((y0 + y1) / 2 - ch / 2);
    const options = {
      bottom: [cx, y1 + M],
      top: [cx, y0 - M - ch],
      right: [x1 + M + 4, cy],
      left: [x0 - M - 4 - cw, cy]
    };
    const order = [pref, 'bottom', 'top', 'right', 'left'].filter(Boolean);
    let pos = null;
    for (const k of order) { const [x, y] = options[k]; if (fits(x, y)) { pos = [x, y]; break; } }
    // не влезает рядом: на телефоне — к низу экрана, на десктопе — в угол поверх
    if (!pos) pos = isDesk() ? [vw - M - cw, vh - M - ch] : [clampX(M), vh - M - ch - (parseFloat(getComputedStyle(root).getPropertyValue('--safe-b')) || 0)];
    card.style.transform = `translate3d(${Math.round(pos[0])}px, ${Math.round(pos[1])}px, 0)`;
  };

  // ---------- шаги ----------
  const show = async (i, dir = 1) => {
    if (!state || state.busy) return;
    state.busy = true;
    let k = i;
    while (k >= 0 && k < state.steps.length && state.steps[k].need && !state.steps[k].need()) k += dir;
    if (k < 0) k = 0;
    if (k >= state.steps.length) { state.busy = false; finish(); return; }
    const step = state.steps[k];
    root.classList.add('is-moving');
    await step.go?.();
    if (!state) return;
    const { sel } = pick(step);
    const el = await find(sel);
    if (!state) return;
    state.i = k;
    target = el;
    const visible = state.steps.filter(s => !s.need || s.need());
    const n = visible.indexOf(step);
    root.querySelector('.tour-step').textContent = `Шаг ${n + 1} из ${visible.length}`;
    root.querySelector('.tour-title').textContent = step.title;
    live.textContent = typeof step.text === 'function' ? step.text() : step.text;
    root.querySelector('.tour-dots').innerHTML = visible.map((_, j) => `<i class="${j === n ? 'is-on' : j < n ? 'is-past' : ''}"></i>`).join('');
    const back = root.querySelector('.tour-back');
    back.disabled = n === 0;
    root.querySelector('.tour-next').textContent = n === visible.length - 1 ? 'Готово' : 'Далее';
    // элемент на странице (не в плеере/панели): прокрутить так, чтобы под ним поместилась карточка
    if (el && !el.closest('.deck, .side')) {
      const { parts } = pick(step);
      const head = isDesk() ? 0 : (document.querySelector('.header')?.offsetHeight || 0);
      const r = rectOf(el, parts);
      const room = innerHeight - head - card.offsetHeight - 40;
      if (r.bottom - r.top <= room || parts) window.scrollBy(0, r.top - head - 16);
      else el.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    await frame();
    root.classList.toggle('no-target', !el);
    const first = !root.classList.contains('is-placed');
    if (first) root.classList.add('no-anim');
    layout();
    if (first) { await frame(); root.classList.remove('no-anim'); root.classList.add('is-placed'); }
    root.classList.remove('is-moving');
    state.busy = false;
    if (!card.contains(document.activeElement)) root.querySelector('.tour-next').focus({ preventScroll: true });
  };

  const next = (d) => { if (state) show(state.i + d, d); };

  const start = async () => {
    closeWelcome(true);
    ensure();
    if (state) return;
    // тур открывает плеер — сохраняем и потом возвращаем прогресс урока как был
    const sk = `focus.deck.${modId()}`;
    let snapshot = null;
    try { snapshot = localStorage.getItem(sk); } catch { /* ок */ }
    state = { steps: STEPS, i: 0, snapshot, sk, from: location.hash, busy: false };
    window.__tourDeck = null;
    try { window.__tourDeck = (await API.getLesson(modId())).deck || null; } catch { /* без слайдов — шаги плеера пропустятся */ }
    root.hidden = false;
    document.documentElement.classList.add('tour-open');
    root.getBoundingClientRect();
    root.classList.add('is-open');
    show(0);
  };

  const finish = async () => {
    if (!state) return;
    const st = state;
    state = null;
    target = null;
    markSeen();
    root.classList.remove('is-open', 'is-placed');
    document.documentElement.classList.remove('tour-open');
    setTimeout(() => { if (!state) root.hidden = true; }, reduced() ? 0 : 220);
    // вернуть прогресс урока и экран модуля
    if (DECK.isOpen()) { setHash(`#${modId()}`); await wait(260); }
    try {
      if (st.snapshot === null) localStorage.removeItem(st.sk); else localStorage.setItem(st.sk, st.snapshot);
    } catch { /* ок */ }
    APP.refreshProgress();
    document.querySelector('[data-tour-start]:not([hidden])')?.blur();
  };

  // ---------- приветствие ----------
  let welcomeEl = null;

  const welcome = () => {
    if (welcomeEl) return;
    const name = firstName();
    const fmt = 'Пять индивидуальных созвонов по 2 часа: от базы ИИ до собственного агента.';
    const m = APP.tourModule();
    welcomeEl = document.createElement('div');
    welcomeEl.className = 'welcome';
    welcomeEl.innerHTML = `
      <div class="welcome-bg" aria-hidden="true"></div>
      <section class="welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcomeTitle" tabindex="-1">
        <div class="welcome-media" aria-hidden="true"><img src="media/module-1/cover-think.webp" alt="" onerror="this.remove()"></div>
        <div class="welcome-body">
          <div class="welcome-kicker">Фокус ИИ 1:1 · Yelumio</div>
          <h2 class="welcome-title" id="welcomeTitle">${name ? `${E(name)}, добро пожаловать` : 'Добро пожаловать'}</h2>
          <p class="welcome-text">${E(fmt)} Это твой кабинет: маршрут, уроки, домашние задания и материалы.</p>
          <ol class="welcome-list">
            <li><b>5 блоков</b><span>все уже открыты — изучай в своём темпе</span></li>
            <li><b>Начни с блока ${E(m?.number || 1)}</b><span>уроки можно пройти до созвонов</span></li>
            <li><b>Тур на минуту</b><span>покажем, где что лежит</span></li>
          </ol>
          <div class="welcome-actions">
            <button type="button" class="tour-btn tour-next welcome-go" data-w="go">Показать, как всё устроено</button>
            <button type="button" class="tour-btn tour-back welcome-skip" data-w="skip">Пропустить</button>
          </div>
        </div>
      </section>`;
    document.body.appendChild(welcomeEl);
    document.documentElement.classList.add('tour-open');
    welcomeEl.addEventListener('click', (e) => {
      const w = e.target.closest('[data-w]')?.dataset.w;
      if (w === 'go') start();
      else if (w === 'skip') closeWelcome(false);
    });
    welcomeEl.getBoundingClientRect();
    welcomeEl.classList.add('is-open');
    welcomeEl.querySelector('.welcome-go').focus({ preventScroll: true });
  };

  const closeWelcome = (toTour) => {
    if (!welcomeEl) return;
    const el = welcomeEl;
    welcomeEl = null;
    if (!toTour) { markSeen(); document.documentElement.classList.remove('tour-open'); }
    el.classList.remove('is-open');
    setTimeout(() => el.remove(), reduced() ? 0 : 220);
  };

  const maybeWelcome = () => {
    let test = false;
    try { test = localStorage.getItem('focus.tour.test') === '1'; } catch { /* ок */ }
    if (navigator.webdriver && !test) return;
    if (seen() || state || DECK.isOpen()) return;
    welcome();
  };

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-tour-start]')) { e.preventDefault(); start(); }
  });

  return { maybeWelcome, start, welcome, isOpen: () => !!state || !!welcomeEl, steps: () => STEPS.length };
})();
