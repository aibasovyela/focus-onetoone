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
          <${open ? `a href="#${m.id}"` : 'div'} class="route-card">
            <div class="route-top">
              <span class="eyebrow">Блок ${m.number} · ${esc(m.tag || '')}</span>
            </div>
            <h3 class="route-title">${esc(m.title)}</h3>
            <p class="route-result">${esc(m.result)}</p>
            <div class="route-meta">
              <span class="pill ${st.pill}">${st.label}</span>
              <span class="label">Созвон: ${formatDate(m.callDate)}</span>
            </div>
            ${open ? '<span class="route-open">Открыть блок →</span>' : ''}
          </${open ? 'a' : 'div'}>
        </li>`;
    }).join('');
  };

  // Детали модуля
  const showModuleDetail = (module) => {
    modulesView.style.display = 'none';
    moduleDetailView.style.display = 'block';

    document.getElementById('detailModuleNumber').textContent = `Блок ${module.number} из ${modules.length} · ${module.tag || ''}`;
    document.getElementById('detailModuleTitle').textContent = module.title;
    document.getElementById('detailModuleDescription').textContent = module.description;
    document.getElementById('detailResult').textContent = module.result;
    const st = STATUS[module.status] || STATUS.locked;
    document.getElementById('detailMeta').innerHTML =
      `<span class="pill pill-light">${st.label}</span><span class="label">Созвон: ${formatDate(module.callDate)} · 2 часа</span>`;

    document.getElementById('detailGoalsList').innerHTML =
      module.goals.map(g => `<li>${esc(g)}</li>`).join('');

    document.getElementById('detailMaterialsList').innerHTML = module.materials.map(mt => {
      const icon = mt.type === 'video' ? '▶' : '✦';
      const href = mt.type === 'cheatsheet' ? '#cheatsheetBlock' : (mt.url || '');
      const available = mt.available !== false && href;
      return `
        <li>
          <${available ? `a href="${esc(href)}" data-scroll="${mt.type === 'cheatsheet' ? 1 : ''}"` : 'div'} class="material-item ${available ? '' : 'material-unavailable'}">
            <span class="material-icon">${icon}</span>
            <div class="material-info">
              <div class="material-type">${mt.type === 'video' ? 'Запись' : 'Шпаргалка'}</div>
              <div class="material-title">${esc(mt.title)}</div>
            </div>
            <span class="material-badge">${available ? '↓' : esc(mt.note || 'скоро')}</span>
          </${available ? 'a' : 'div'}>
        </li>`;
    }).join('');

    const hw = module.homework;
    document.getElementById('detailHomeworkContent').innerHTML = hw ? `
      <div class="homework-item">
        <h3 class="homework-title">${esc(hw.title)}</h3>
        <p class="homework-desc">${esc(hw.description)}</p>
        ${hw.criteria?.length ? `<div class="label hw-label">Готово, если</div><ul class="criteria-list">${hw.criteria.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
        <div class="homework-due">Срок: ${hw.dueDate ? formatDate(hw.dueDate) : esc(hw.dueLabel || 'дата уточняется')}</div>
        <div class="homework-status" id="homeworkStatus"></div>
        <button class="btn btn-primary hw-btn" data-hw="${esc(module.id)}">Сдать ДЗ</button>
      </div>` : '<p class="label">Задание появится после созвона</p>';

    loadCheatsheet(module.id);
    loadHomeworkStatus(module.id);
    window.scrollTo(0, 0);
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
    const module = modules.find(m => m.id === id && m.status !== 'locked');
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
    document.getElementById('detailBackBtn').addEventListener('click', goBack);
    document.getElementById('detailBackBtn2').addEventListener('click', goBack);
    document.getElementById('homeworkCancel').addEventListener('click', closeHomeworkModal);
    homeworkModal.addEventListener('click', (e) => {
      if (e.target === homeworkModal) closeHomeworkModal();
    });

    document.addEventListener('click', (e) => {
      const hwBtn = e.target.closest('[data-hw]');
      if (hwBtn) openHomeworkModal(hwBtn.dataset.hw);

      const scroll = e.target.closest('a[data-scroll="1"]');
      if (scroll) {
        e.preventDefault();
        document.getElementById('cheatsheetBlock').scrollIntoView({ behavior: 'smooth' });
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
