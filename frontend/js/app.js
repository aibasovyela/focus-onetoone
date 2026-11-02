// Главное приложение «Фокус ИИ 1:1»
const APP = (() => {
  const modulesView = document.getElementById('modulesView');
  const moduleDetailView = document.getElementById('moduleDetailView');
  const modulesGrid = document.getElementById('modulesGrid');
  const homeworkModal = document.getElementById('homeworkModal');
  const homeworkSubmit = document.getElementById('homeworkSubmit');
  const toast = document.getElementById('toast');

  let modules = [];
  let ready = false;

  const STATUS = {
    done: { label: 'Пройден', pill: 'pill-done' },
    active: { label: 'Сейчас', pill: 'pill-accent' },
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
      renderHero(me);
      renderModules();
      route();
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
      ? `Сейчас — блок ${current.number}: «${current.title}». Следующие блоки открываются после каждого созвона.`
      : 'Программа пройдена. Все материалы остаются с тобой.';
    document.getElementById('routeProgress').style.width = `${(done / modules.length) * 100}%`;
    document.getElementById('routeProgressLabel').textContent = `${done} из ${modules.length} пройдено`;
  };

  // Маршрут 1→5
  const renderModules = () => {
    modulesGrid.innerHTML = modules.map(m => {
      const st = STATUS[m.status] || STATUS.locked;
      const open = m.status !== 'locked';
      return `
        <li class="route-step is-${m.status}">
          <div class="route-dot">${m.status === 'done' ? '✓' : m.number}</div>
          <a href="#${m.id}" class="route-card">
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

  // Детали модуля: хиро → оглавление → план созвона → урок → ДЗ → материалы
  const showModuleDetail = (module) => {
    modulesView.style.display = 'none';
    moduleDetailView.style.display = 'block';
    const locked = module.status === 'locked';

    document.getElementById('detailModuleNumber').textContent = `Блок ${module.number} из ${modules.length} · ${module.tag || ''}`;
    document.getElementById('detailModuleTitle').textContent = module.title;
    document.getElementById('detailPromise').textContent = module.promise || module.description;
    const st = STATUS[module.status] || STATUS.locked;
    document.getElementById('detailMeta').innerHTML =
      `<span class="pill pill-light">${st.label}</span><span class="label">Созвон: ${formatDate(module.callDate)} · 2 часа</span>`;
    document.getElementById('detailOutcomes').innerHTML = (module.goals || []).map(g => `<li>${esc(g)}</li>`).join('');

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

    renderHomework(module, module.homework, locked);
    document.getElementById('lesson').innerHTML = '<p class="label">Загружаю урок…</p>';
    document.getElementById('planList').innerHTML = '';
    document.getElementById('cheatsheetBlock').style.display = locked ? 'none' : '';
    loadLesson(module);
    if (!locked) { loadCheatsheet(module.id); loadHomeworkStatus(module.id); }
    window.scrollTo(0, 0);
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

  // Урок: план по минутам + лонгрид; для закрытого блока — только предпросмотр
  const loadLesson = async (module) => {
    const box = document.getElementById('lesson');
    try {
      const data = await API.getLesson(module.id);
      if (location.hash.slice(1) !== module.id) return; // успели уйти на другой блок
      if (data.promise) document.getElementById('detailPromise').textContent = data.promise;
      if (data.outcomes?.length) {
        document.getElementById('detailOutcomes').innerHTML = data.outcomes.map(o => `<li>${esc(String(o).replace(/^к концу созвона( у тебя)?\s*[:—-]?\s*/i, ''))}</li>`).join('');
      }

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
      document.getElementById('plan').style.display = plan.length ? '' : 'none';

      if (data.homework) renderHomework(module, data.homework, data.locked);
      if (!data.locked) loadHomeworkStatus(module.id);

      const lockedNote = document.getElementById('lockedNote');
      if (data.locked) {
        box.innerHTML = '';
        lockedNote.style.display = '';
        lockedNote.innerHTML = `<span class="eyebrow">Блок закрыт</span><p>Полный урок, промпты и материалы откроются после созвона ${module.number}. Пока — план, чтобы знать, что нас ждёт.</p>`;
        buildToc([]);
        return;
      }
      lockedNote.style.display = 'none';
      const { html, toc } = MD.render(data.markdown || '', { diagrams: data.diagrams || {} });
      box.innerHTML = html;
      buildToc(toc);
    } catch (error) {
      if (error.message !== 'unauthorized') box.innerHTML = `<p class="label">${esc(error.message)}</p>`;
    }
  };

  const buildToc = (toc) => {
    const items = [{ id: 'plan', title: 'План созвона' }, ...toc, { id: 'homework', title: 'Домашнее задание' }, { id: 'materials', title: 'Материалы' }]
      .filter(i => document.getElementById(i.id) && document.getElementById(i.id).style.display !== 'none');
    document.getElementById('tocList').innerHTML = items.map(i => `<li><a href="#${esc(i.id)}" data-toc="${esc(i.id)}">${esc(i.title)}</a></li>`).join('');
    document.getElementById('tocCount').textContent = `${items.length} разделов`;
    const details = document.querySelector('#toc details');
    if (details) details.open = window.innerWidth >= 768;
  };

  const updateReadProgress = () => {
    const bar = document.getElementById('readProgress');
    if (!bar || moduleDetailView.style.display === 'none') return;
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
    moduleDetailView.style.display = 'none';
    modulesView.style.display = 'block';
  };

  // Навигация через #module-N — работает кнопка «назад» в браузере
  const route = () => {
    const id = location.hash.slice(1);
    const module = modules.find(m => m.id === id);
    if (module) {
      showModuleDetail(module);
    } else {
      showList();
    }
  };

  const goBack = () => {
    history.pushState('', '', location.pathname + location.search);
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
    document.getElementById('detailBackBtn2').addEventListener('click', goBack);
    document.getElementById('homeworkCancel').addEventListener('click', closeHomeworkModal);
    homeworkModal.addEventListener('click', (e) => {
      if (e.target === homeworkModal) closeHomeworkModal();
    });

    document.addEventListener('click', (e) => {
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

  return { init };
})();

// Старт: если есть сессия — сразу в кабинет (сервер сам вернёт 401, если она истекла)
if (AUTH.isAuthenticated()) {
  showDashboard();
} else {
  showLogin();
}
