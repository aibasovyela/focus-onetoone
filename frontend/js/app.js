// Главное приложение «Фокус ИИ 1:1»
const APP = (() => {
  const modulesView = document.getElementById('modulesView');
  const moduleDetailView = document.getElementById('moduleDetailView');
  const modulesGrid = document.getElementById('modulesGrid');
  const homeworkModal = document.getElementById('homeworkModal');
  const homeworkSubmit = document.getElementById('homeworkSubmit');
  const toast = document.getElementById('toast');

  let modules = [];
  let student = null;
  let ready = false;
  let currentId = null;       // открытый модуль
  let lesson = null;          // { moduleId, data } — ответ /lesson для открытого модуля
  let afterDeckClose = null;  // действие после закрытия плеера (например, прокрутка к ДЗ)

  // #module-1 — страница модуля, #module-1/12 — плеер на 12-м слайде
  const parseHash = () => {
    const [id = '', slide = ''] = decodeURIComponent(location.hash.slice(1)).split('/');
    return { id, slide: /^\d+$/.test(slide) ? Number(slide) : null };
  };

  const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_READ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';

  const STATUS = {
    done: { label: 'Пройден', pill: 'pill-done' },
    active: { label: 'Сейчас', pill: 'pill-accent' },
    open: { label: 'Открыт', pill: 'pill-open' },
    locked: { label: 'Откроется после созвона', pill: 'pill-muted' }
  };

  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const showToast = (text) => {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => toast.classList.remove('show'), 2600);
  };

  // «2026-11-10 19:00» → «10 ноября, 19:00»; null → «дата уточняется»
  const formatDate = (value) => {
    if (!value) return 'дата уточняется';
    const [d, t] = String(value).split(/[ T]/);
    const date = new Date(`${d}T00:00:00`);
    if (isNaN(date)) return esc(value);
    const day = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    return t ? `${day}, ${t.slice(0, 5)}` : day;
  };

  const init = async () => {
    if (!ready) { setupEventListeners(); ready = true; }
    try {
      const [me, list] = await Promise.all([API.getMe(), API.getModules()]);
      modules = list;
      student = me;
      renderHero(me);
      renderModules();
      route();
      TOUR.maybeWelcome();
    } catch (error) {
      if (error.message !== 'unauthorized') showToast('Не удалось загрузить программу');
    }
  };

  const renderHero = (me) => {
    document.getElementById('userName').textContent = me.name || 'ученик';
    if (me.program?.format) document.getElementById('heroFormat').textContent = me.program.format;
    const done = modules.filter(m => m.status === 'done').length;
    const current = modules.find(m => m.status === 'active');
    document.getElementById('heroSub').textContent = current
      ? `Сейчас — блок ${current.number}: «${current.title}». ${modules.some(m => m.status === 'locked') ? 'Следующие блоки открываются после каждого созвона.' : 'Все блоки уже открыты — можно изучать заранее.'}`
      : 'Программа пройдена. Все материалы остаются с тобой.';
    document.getElementById('routeProgress').style.width = `${(done / modules.length) * 100}%`;
    document.getElementById('routeProgressLabel').textContent = `${done} из ${modules.length} пройдено`;
    const name = me.name || 'Ученик';
    document.getElementById('sideName').textContent = name;
    document.getElementById('sideAva').textContent = name.trim().charAt(0).toUpperCase();
    renderHeroNow(current);
  };

  // Прогресс урока-слайдов из localStorage плеера (без загрузки deck.json): { pos, seen, n, done }
  const deckState = (id) => {
    try {
      const st = JSON.parse(localStorage.getItem(`focus.deck.${id}`)) || {};
      return st.n ? { pos: Math.min(Number(st.pos) || 0, st.n - 1), seen: (st.seen || []).length, n: st.n, done: !!st.done } : null;
    } catch { return null; }
  };

  // Карточка «Сейчас» в хиро маршрута (на десктопе — справа от приветствия)
  const renderHeroNow = (current) => {
    const box = document.getElementById('heroNow');
    if (!current) { box.innerHTML = ''; return; }
    const st = deckState(current.id);
    const frac = st ? (st.done ? 1 : st.seen / st.n) : 0;
    const sub = st ? (st.done ? 'Урок пройден' : `Слайд ${st.pos + 1} из ${st.n}`) : 'Урок ещё не начат';
    box.innerHTML = `
      <a class="now-card" href="#${esc(current.id)}" data-mod="${current.number}">
        <span class="now-num" aria-hidden="true">${current.number}</span>
        <span class="now-body">
          <span class="now-kicker">Сейчас · блок ${current.number}</span>
          <span class="now-title">${esc(current.title)}</span>
          <span class="now-sub">${esc(sub)} · созвон ${esc(formatDate(current.callDate))}</span>
          <span class="now-bar" aria-hidden="true"><i style="transform:scaleX(${frac})"></i></span>
        </span>
        <span class="now-go">${st && !st.done ? 'Продолжить' : 'Открыть'}</span>
      </a>`;
  };

  // Боковая панель: 5 блоков, подсвечен ровно один — открытый
  const renderSide = () => {
    const { id } = parseHash();
    document.getElementById('sideModules').innerHTML = modules.map(m => {
      const st = STATUS[m.status] || STATUS.locked;
      const ds = m.status !== 'locked' ? deckState(m.id) : null;
      const frac = ds ? (ds.done ? 1 : ds.seen / ds.n) : m.status === 'done' ? 1 : 0;
      return `
        <li><a href="#${esc(m.id)}" class="side-item is-${m.status}${m.id === id ? ' is-on' : ''}" data-mod="${m.number}"${m.id === id ? ' aria-current="page"' : ''}>
          <span class="side-n">${m.status === 'done' ? '✓' : m.number}</span>
          <span class="side-t"><b>${esc(m.title)}</b><small>${esc(st.label)}${ds && !ds.done ? ` · ${Math.round(frac * 100)}%` : ''}</small></span>
          ${frac ? `<span class="side-bar" aria-hidden="true"><i style="transform:scaleX(${frac})"></i></span>` : ''}
        </a></li>`;
    }).join('');
    document.getElementById('sideHome').classList.toggle('is-on', !id);
    if (!id) document.getElementById('sideHome').setAttribute('aria-current', 'page'); else document.getElementById('sideHome').removeAttribute('aria-current');
  };

  // Маршрут 1→5
  const renderModules = () => {
    modulesGrid.innerHTML = modules.map(m => {
      const st = STATUS[m.status] || STATUS.locked;
      const open = m.status !== 'locked';
      return `
        <li class="route-step is-${m.status}" data-mod="${m.number}">
          <div class="route-dot">${m.status === 'done' ? '✓' : m.number}</div>
          <a href="#${m.id}" class="route-card">
            <span class="route-media" aria-hidden="true">${m.card ? `<img src="media/${esc(m.id)}/${esc(m.card)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<span class="route-num">${String(m.number).padStart(2, '0')}<i></i></span></span>
            <div class="route-top">
              <span class="eyebrow">Блок ${m.number} · ${esc(m.tag || '')}</span>
            </div>
            <h3 class="route-title">${esc(m.title)}</h3>
            <p class="route-result">${esc(m.result)}</p>
            <div class="route-meta">
              <span class="pill ${st.pill}">${st.label}</span>
              <span class="label">Созвон: ${formatDate(m.callDate)}</span>
            </div>
            <span class="route-open">${open ? 'Открыть урок →' : 'Посмотреть план →'}</span>
          </a>
        </li>`;
    }).join('');
  };

  // Детали модуля: компактное хиро с «Начать урок» → табы (главы / что получишь / план) → урок → ДЗ → материалы
  const showModuleDetail = (module) => {
    modulesView.style.display = 'none';
    moduleDetailView.style.display = 'block';
    moduleDetailView.dataset.mod = module.number;
    const locked = module.status === 'locked';
    lesson = null;

    document.getElementById('detailModuleNumber').textContent = `Блок ${module.number} из ${modules.length} · ${module.tag || ''}`;
    document.getElementById('detailModuleTitle').textContent = module.title;
    const promise = document.getElementById('detailPromise');
    promise.textContent = module.promise || module.description;
    promise.classList.add('is-clamped');
    const st = STATUS[module.status] || STATUS.locked;
    document.getElementById('detailMeta').innerHTML =
      `<span class="pill pill-light">${st.label}</span><span class="label">Созвон: ${formatDate(module.callDate)} · 2 часа</span>`;
    document.getElementById('detailCta').innerHTML = locked ? '' : '<div class="lc-skeleton" aria-hidden="true"></div>';
    document.getElementById('chaptersBlock').hidden = true;
    moduleDetailView.classList.remove('has-deck');
    renderOutcomes(module.goals || []);
    renderTabs(locked);

    document.getElementById('detailMaterialsList').innerHTML = (module.materials || []).map(mt => {
      const icon = mt.type === 'video' ? '▶' : '✦';
      const href = mt.type === 'cheatsheet' ? '#cheatsheetBlock' : (mt.url || '');
      const available = !locked && mt.available !== false && href;
      return `
        <li>
          <${available ? `a href="${esc(href)}" data-scroll="${mt.type === 'cheatsheet' ? 1 : ''}"` : 'div'} class="material-item ${available ? '' : 'material-unavailable'}">
            <span class="material-icon">${icon}</span>
            <div class="material-info">
              <div class="material-type">${mt.type === 'video' ? 'Запись' : 'Шпаргалка'}</div>
              <div class="material-title">${esc(mt.title)}</div>
            </div>
            <span class="material-badge">${available ? '↓' : esc(locked ? 'после созвона' : (mt.note || 'скоро'))}</span>
          </${available ? 'a' : 'div'}>
        </li>`;
    }).join('');

    renderUseful(module.useful || [], locked);
    renderHomework(module, module.homework, locked);
    document.getElementById('lesson').innerHTML = '';
    document.getElementById('lesson').style.display = '';
    document.getElementById('toc').style.display = 'none';
    document.getElementById('planList').innerHTML = '';
    document.getElementById('cheatsheetBlock').style.display = locked ? 'none' : '';
    loadLesson(module);
    if (!locked) { loadCheatsheet(module.id); loadHomeworkStatus(module.id); }
    window.scrollTo(0, 0);
  };

  // «Полезное» (meta.json → useful): внешние ссылки и переходы к главе урока ({ chapter: "examples" })
  const renderUseful = (list, locked) => {
    const box = document.getElementById('useful');
    box.hidden = locked || !list.length;
    document.getElementById('usefulList').innerHTML = list.map(it => {
      const url = /^https?:\/\//i.test(it.url || '') ? it.url : '';
      const tag = it.chapter ? `button type="button" data-useful-ch="${esc(it.chapter)}"` : url ? `a href="${esc(url)}" target="_blank" rel="noopener"` : 'div';
      return `
        <li>
          <${tag} class="material-item">
            <span class="material-icon" aria-hidden="true">${it.chapter ? '▶' : '↗'}</span>
            <div class="material-info">
              ${it.kicker ? `<div class="material-type">${esc(it.kicker)}</div>` : ''}
              <div class="material-title">${esc(it.label)}</div>
              ${it.text ? `<div class="material-text">${esc(it.text)}</div>` : ''}
            </div>
          </${tag.split(' ')[0]}>
        </li>`;
    }).join('');
  };

  const renderOutcomes = (list) => {
    document.getElementById('detailOutcomes').innerHTML = list
      .map(o => `<li>${esc(String(o).replace(/^к концу созвона( у тебя)?\s*[:—-]?\s*/i, ''))}</li>`).join('');
  };

  // Табы обзора: «Что получишь» · «План созвона»
  const renderTabs = (locked = false, active) => {
    const hasPlan = document.getElementById('planList').children.length > 0;
    const tabs = [['outcomes', 'Что получишь'], ...(hasPlan ? [['plan', 'План созвона']] : [])];
    const box = document.getElementById('overviewTabs');
    const current = active || box.dataset.active || tabs[0][0];
    const k = Math.max(0, tabs.findIndex(t => t[0] === current));
    box.style.setProperty('--n', tabs.length);
    box.hidden = tabs.length < 2;
    box.dataset.active = tabs[k][0];
    box.innerHTML = `<span class="seg-thumb" aria-hidden="true" style="transform:translateX(${k * 100}%)"></span>` +
      tabs.map(([key, label], n) => `<button type="button" role="tab" data-tab-key="${key}" aria-selected="${n === k}">${esc(label)}</button>`).join('');
    document.querySelectorAll('#overview .tab-panel').forEach(p => { p.hidden = p.dataset.panel !== tabs[k][0]; });
    document.getElementById('overview').classList.toggle('is-locked', locked);
  };

  const selectTab = (key) => {
    const box = document.getElementById('overviewTabs');
    const btns = [...box.querySelectorAll('[data-tab-key]')];
    const k = btns.findIndex(b => b.dataset.tabKey === key);
    if (k < 0) return;
    box.dataset.active = key;
    btns.forEach((b, n) => b.setAttribute('aria-selected', String(n === k)));
    box.querySelector('.seg-thumb').style.transform = `translateX(${k * 100}%)`;
    document.querySelectorAll('#overview .tab-panel').forEach(p => { p.hidden = p.dataset.panel !== key; });
  };

  const minutes = (n) => Math.max(1, Math.round(n * 0.4));

  // Карточка «Начать / Продолжить урок» в хиро и список глав — по прогрессу из localStorage
  const renderDeckEntry = () => {
    if (!lesson?.data.deck) return;
    const id = lesson.moduleId;
    const p = DECK.progress(id, lesson.data.deck);
    const curCh = p.chapters.find(c => c.current) || p.chapters[0];
    const resume = p.started && !p.done;
    const start = resume ? p.pos : 0;
    const label = p.done ? 'Пройти ещё раз' : resume ? 'Продолжить' : 'Начать урок';
    const head = resume ? `Глава ${curCh.n + 1} из ${p.chapters.length}` : p.done ? 'Урок пройден' : 'Урок в слайдах';
    const title = resume ? curCh.title : `${p.chapters.length} ${DECK.plural(p.chapters.length, ['глава', 'главы', 'глав'])} · ${DECK.slidesWord(p.total)}`;
    const sub = resume ? `Слайд ${p.pos + 1} из ${p.total} · осталось ~${minutes(p.total - p.pos)} мин` : `~${minutes(p.total)} мин · листай ← → или свайпом`;
    const frac = p.done ? 1 : resume ? (p.pos + 1) / p.total : 0;
    const cover = (resume ? curCh : p.chapters[0]).cover;
    document.getElementById('detailCta').innerHTML = `
      <button class="lesson-card" type="button" data-deck-start="${start}">
        <span class="lc-media">${cover ? `<img src="media/${esc(id)}/${esc(cover)}" alt="" onerror="this.remove()">` : ''}</span>
        <span class="lc-body">
          <span class="lc-kicker">${esc(head)}</span>
          <span class="lc-title">${esc(title)}</span>
          <span class="lc-sub">${esc(sub)}</span>
          <span class="lc-bar" aria-hidden="true"><i style="transform:scaleX(${frac})"></i></span>
        </span>
        <span class="lc-btn">${ICON_PLAY}<span>${label}</span></span>
      </button>`;
    document.getElementById('chaptersMeta').textContent = `${p.chapters.filter(c => c.done).length} из ${p.chapters.length} пройдено`;
    document.getElementById('chaptersPanel').innerHTML = p.chapters.map((c, k) => {
      const here = c.current && resume;
      const state = c.done ? 'пройдена' : here ? 'ты здесь' : c.seen ? `${c.seen} из ${c.count}` : `${minutes(c.count)} мин`;
      return `
        <li><button type="button" class="ch-row${c.done ? ' is-done' : ''}${here ? ' is-current' : ''}" data-deck-start="${here ? p.pos : c.start}">
          <span class="ch-thumb">${c.cover ? `<img src="media/${esc(id)}/${esc(c.cover)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<span class="ch-num">${k + 1}</span></span>
          <span class="ch-txt"><b>${esc(c.title)}</b><small>${DECK.slidesWord(c.count)} · ${esc(state)}</small>
            <span class="ch-bar" aria-hidden="true"><i style="transform:scaleX(${c.count ? c.seen / c.count : 0})"></i></span></span>
          <span class="ch-st" aria-hidden="true">${c.done ? ICON_CHECK : ICON_NEXT}</span>
        </button></li>`;
    }).join('');
    document.getElementById('chaptersBlock').hidden = false;
    document.getElementById('textVersionBtn').hidden = !lesson.data.markdown;
  };

  const openDeck = (start) => {
    const { id } = parseHash();
    history.pushState({ deck: 1 }, '', `#${id}/${Number(start) + 1}`);
    syncDeck();
  };

  const closeDeck = () => {
    if (history.state?.deck) { history.back(); return; } // hashchange → route → DECK.close()
    history.replaceState(null, '', `#${parseHash().id}`);
    DECK.close();
  };

  // Плеер следует за хэшем: #module-1/N — открыт, #module-1 — закрыт (кнопка «назад» закрывает плеер)
  const syncDeck = () => {
    const { id, slide } = parseHash();
    const deck = lesson && lesson.moduleId === id ? lesson.data.deck : null;
    if (slide && deck) {
      if (DECK.isOpen()) { DECK.goTo(slide - 1); return; }
      if (!history.state?.deck) { // прямая ссылка на слайд: подкладываем страницу модуля под плеер
        history.replaceState(null, '', `#${id}`);
        history.pushState({ deck: 1 }, '', `#${id}/${slide}`);
      }
      DECK.open({
        moduleId: id,
        mod: modules.find(m => m.id === id)?.number,
        title: modules.find(m => m.id === id)?.title || '',
        deck,
        diagrams: lesson.data.diagrams,
        start: slide - 1,
        onChange: (i) => history.replaceState(history.state, '', `#${id}/${i + 1}`),
        requestClose: closeDeck,
        onHomework: () => { afterDeckClose = () => document.getElementById('homework').scrollIntoView({ behavior: 'smooth', block: 'start' }); },
        onClose: () => {
          renderDeckEntry();
          renderSide();
          const next = afterDeckClose;
          afterDeckClose = null;
          requestAnimationFrame(() => { next ? next() : document.querySelector('.lesson-card')?.focus({ preventScroll: true }); });
        }
      });
    } else if (!slide && DECK.isOpen()) {
      DECK.close();
    } else if (slide && lesson && lesson.moduleId === id && !deck) {
      history.replaceState(null, '', `#${id}`); // у модуля нет слайдов — остаёмся на лонгриде
    }
  };

  const renderHomework = (module, hw, locked) => {
    document.getElementById('detailHomeworkContent').innerHTML = hw ? `
      <div class="homework-item">
        <h3 class="homework-title">${esc(hw.title)}</h3>
        <p class="homework-desc">${esc(hw.description)}</p>
        ${hw.criteria?.length ? `<div class="label hw-label">Готово, если</div><ul class="criteria-list">${hw.criteria.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
        <div class="homework-due">Срок: ${hw.dueDate ? formatDate(hw.dueDate) : esc(hw.dueLabel || 'дата уточняется')}</div>
        <div class="homework-status" id="homeworkStatus"></div>
        ${locked ? '' : `<button class="btn btn-primary hw-btn" data-hw="${esc(module.id)}">Сдать ДЗ</button>`}
      </div>` : '<p class="label">Задание появится после созвона</p>';
  };

  // Урок: план по минутам + слайды (deck.json) или лонгрид (lesson.md); для закрытого блока — только предпросмотр
  const loadLesson = async (module) => {
    const box = document.getElementById('lesson');
    try {
      const data = await API.getLesson(module.id);
      if (parseHash().id !== module.id) return; // успели уйти на другой блок
      if (data.promise) document.getElementById('detailPromise').textContent = data.promise;
      if (data.outcomes?.length) renderOutcomes(data.outcomes);

      const plan = data.plan || [];
      let t = 0;
      document.getElementById('planList').innerHTML = plan.map(p => {
        const from = t; t += Number(p.min) || 0;
        const hm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
        return `<li style="--w:${Math.max(6, (p.min / 120) * 100)}%">
          <span class="tl-time">${hm(from)}–${hm(t)}</span>
          <div class="tl-body"><strong>${esc(p.title)}</strong>${p.text ? `<span>${esc(p.text)}</span>` : ''}</div>
          <span class="tl-min">${p.min} мин</span>
        </li>`;
      }).join('');
      document.getElementById('planTotal').textContent = plan.length ? `${plan.length} блоков · ${t} минут живой работы` : '';

      if (data.homework) renderHomework(module, data.homework, data.locked);
      if (!data.locked) loadHomeworkStatus(module.id);

      const lockedNote = document.getElementById('lockedNote');
      const cta = document.getElementById('detailCta');
      if (data.locked) {
        box.innerHTML = '';
        lockedNote.style.display = '';
        lockedNote.innerHTML = `<span class="eyebrow">Блок закрыт</span><p>Полный урок, промпты и материалы откроются после созвона ${module.number}. Пока — план, чтобы знать, что нас ждёт.</p>`;
        cta.innerHTML = '';
        renderTabs(true, 'plan');
        buildToc([]);
        return;
      }
      lockedNote.style.display = 'none';
      lesson = { moduleId: module.id, data };

      if (data.deck) {
        // урок-слайды: лонгрид прячем (доступен по кнопке «Читать текстом»)
        box.style.display = 'none';
        document.getElementById('toc').style.display = 'none';
        moduleDetailView.classList.add('has-deck');
        renderTabs(false, 'outcomes');
        renderDeckEntry();
        syncDeck();
        return;
      }

      moduleDetailView.classList.remove('has-deck');
      const { html, toc } = MD.render(data.markdown || '', { diagrams: data.diagrams || {} });
      box.innerHTML = html;
      const words = (data.markdown || '').split(/\s+/).length;
      cta.innerHTML = html.trim() ? `
        <button class="cta-start" type="button" data-read-lesson>
          <span class="cta-ic">${ICON_READ}</span>
          <span class="cta-txt"><b>Читать урок</b><small>${toc.length} разделов · ~${Math.max(3, Math.round(words / 180))} мин чтения</small></span>
          <span class="cta-go" aria-hidden="true">↓</span>
        </button>` : '';
      renderTabs(false, 'outcomes');
      buildToc(toc);
      syncDeck();
    } catch (error) {
      if (error.message !== 'unauthorized') box.innerHTML = `<p class="label">${esc(error.message)}</p>`;
    }
  };

  const showTextVersion = () => {
    const box = document.getElementById('lesson');
    if (!box.innerHTML.trim()) {
      const { html, toc } = MD.render(lesson?.data.markdown || '', { diagrams: lesson?.data.diagrams || {} });
      box.innerHTML = html;
      buildToc(toc);
    }
    box.style.display = '';
    document.getElementById('toc').style.display = '';
    document.getElementById('textVersionBtn').hidden = true;
    moduleDetailView.classList.remove('has-deck');
    (document.getElementById('toc')).scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const buildToc = (toc) => {
    const tocEl = document.getElementById('toc');
    tocEl.style.display = toc.length ? '' : 'none';
    const items = [{ id: 'overview', title: 'Что получишь и план созвона' }, ...toc, { id: 'homework', title: 'Домашнее задание' }, { id: 'materials', title: 'Материалы' }]
      .filter(i => document.getElementById(i.id) && document.getElementById(i.id).style.display !== 'none');
    document.getElementById('tocList').innerHTML = items.map(i => `<li><a href="#${esc(i.id)}" data-toc="${esc(i.id)}">${esc(i.title)}</a></li>`).join('');
    document.getElementById('tocCount').textContent = `${items.length} разделов`;
    const details = document.querySelector('#toc details');
    if (details) details.open = window.innerWidth >= 768;
  };

  const updateReadProgress = () => {
    const bar = document.getElementById('readProgress');
    if (!bar || moduleDetailView.style.display === 'none' || DECK.isOpen()) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = `${max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0}%`;
  };

  const loadCheatsheet = async (moduleId) => {
    const box = document.getElementById('cheatsheet');
    box.innerHTML = '<p class="label">Загружаю…</p>';
    try {
      const md = await API.getCheatsheet(moduleId);
      box.innerHTML = MD.render(md).replace(/^\s*<h2>.*?<\/h2>/, ''); // заголовок модуля уже есть в шапке
    } catch (error) {
      if (error.message !== 'unauthorized') box.innerHTML = `<p class="label">${esc(error.message)}</p>`;
    }
  };

  const loadHomeworkStatus = async (moduleId) => {
    try {
      const hw = await API.getHomework(moduleId);
      const el = document.getElementById('homeworkStatus');
      const last = hw.submissions?.[hw.submissions.length - 1];
      if (el && last) {
        el.innerHTML = `<span class="pill pill-done">Отправлено ${formatDate(last.submittedAt.slice(0, 10))}</span>${last.feedback ? `<p class="homework-desc">${esc(last.feedback)}</p>` : ''}`;
      }
    } catch { /* статус необязателен */ }
  };

  const showList = () => {
    currentId = null;
    lesson = null;
    moduleDetailView.style.display = 'none';
    modulesView.style.display = 'block';
  };

  // Навигация через #module-N — работает кнопка «назад» в браузере
  const route = () => {
    const { id } = parseHash();
    renderSide();
    const module = modules.find(m => m.id === id);
    if (!module) {
      if (DECK.isOpen()) DECK.close();
      renderHeroNow(modules.find(m => m.status === 'active'));
      showList();
      return;
    }
    if (currentId !== id) {
      currentId = id;
      showModuleDetail(module);
    }
    syncDeck();
  };

  const goBack = () => {
    history.pushState('', '', location.pathname + location.search);
    renderSide();
    renderHeroNow(modules.find(m => m.status === 'active'));
    showList();
    window.scrollTo(0, 0);
  };

  const openHomeworkModal = (moduleId) => {
    const module = modules.find(m => m.id === moduleId);
    document.getElementById('homeworkModalTitle').textContent = module?.homework?.title || '';
    document.getElementById('homeworkTextarea').value = '';
    homeworkModal.classList.add('open');
    homeworkSubmit.onclick = () => submitHomework(moduleId);
  };

  const closeHomeworkModal = () => homeworkModal.classList.remove('open');

  const submitHomework = async (moduleId) => {
    const content = document.getElementById('homeworkTextarea').value.trim();
    if (!content) {
      showToast('Напиши, что получилось');
      return;
    }
    homeworkSubmit.disabled = true;
    try {
      await API.submitHomework(moduleId, content);
      closeHomeworkModal();
      showToast('ДЗ отправлено — куратор посмотрит до созвона');
      loadHomeworkStatus(moduleId);
    } catch (error) {
      if (error.message !== 'unauthorized') showToast('Ошибка отправки: ' + error.message);
    } finally {
      homeworkSubmit.disabled = false;
    }
  };

  const setupEventListeners = () => {
    window.addEventListener('hashchange', route);
    window.addEventListener('scroll', updateReadProgress, { passive: true });
    document.getElementById('detailBackBtn').addEventListener('click', goBack);
    document.getElementById('sideLogout').addEventListener('click', () => AUTH.logout());
    document.getElementById('detailBackBtn2').addEventListener('click', goBack);
    document.getElementById('homeworkCancel').addEventListener('click', closeHomeworkModal);
    homeworkModal.addEventListener('click', (e) => {
      if (e.target === homeworkModal) closeHomeworkModal();
    });

    document.getElementById('detailPromise').addEventListener('click', (e) => e.currentTarget.classList.remove('is-clamped'));

    document.addEventListener('click', (e) => {
      const start = e.target.closest('[data-deck-start]');
      if (start) { openDeck(Number(start.dataset.deckStart) || 0); return; }

      const usefulCh = e.target.closest('[data-useful-ch]');
      if (usefulCh) {
        if (!lesson?.data.deck) return;
        const ch = DECK.progress(lesson.moduleId, lesson.data.deck).chapters.find(c => c.id === usefulCh.dataset.usefulCh);
        if (ch) openDeck(ch.start);
        return;
      }

      const tab = e.target.closest('[data-tab-key]');
      if (tab) { selectTab(tab.dataset.tabKey); return; }

      if (e.target.closest('#textVersionBtn')) { showTextVersion(); return; }

      if (e.target.closest('[data-read-lesson]')) {
        document.getElementById('lesson').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      const hwBtn = e.target.closest('[data-hw]');
      if (hwBtn) openHomeworkModal(hwBtn.dataset.hw);

      const tocLink = e.target.closest('a[data-toc]');
      if (tocLink) {
        e.preventDefault();
        document.getElementById(tocLink.dataset.toc)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      const scroll = e.target.closest('a[data-scroll="1"]');
      if (scroll) {
        e.preventDefault();
        const cs = document.getElementById('cheatsheetBlock');
        cs.open = true;
        cs.scrollIntoView({ behavior: 'smooth' });
      }

      const copy = e.target.closest('.md-copy');
      if (copy) {
        const text = copy.parentElement.querySelector('code').textContent;
        navigator.clipboard?.writeText(text).then(() => {
          copy.textContent = 'Скопировано';
          setTimeout(() => { copy.textContent = 'Копировать'; }, 1500);
        });
      }
    });
  };

  // Для тура (js/tour.js): кто ученик, какой блок «текущий», перерисовка прогресса после тура
  const tourModule = () => modules.find(m => m.status === 'active') || modules.find(m => m.status !== 'locked') || modules[0];
  const refreshProgress = () => {
    renderSide();
    renderHeroNow(modules.find(m => m.status === 'active'));
    renderDeckEntry();
  };
  const hasDeck = () => !!lesson?.data?.deck;

  return { init, student: () => student, tourModule, refreshProgress, hasDeck };
})();

// Старт: если есть сессия — сразу в кабинет (сервер сам вернёт 401, если она истекла)
if (AUTH.isAuthenticated()) {
  showDashboard();
} else {
  showLogin();
}
