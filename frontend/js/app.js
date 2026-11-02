// Главное приложение Focus 1-on-1
const APP = (() => {
  // DOM элементы
  const modulesView = document.getElementById('modulesView');
  const moduleDetailView = document.getElementById('moduleDetailView');
  const modulesGrid = document.getElementById('modulesGrid');
  const detailBackBtn = document.getElementById('detailBackBtn');
  const homeworkModal = document.getElementById('homeworkModal');
  const homeworkCancel = document.getElementById('homeworkCancel');
  const homeworkSubmit = document.getElementById('homeworkSubmit');

  let currentModule = null;
  let modules = [];

  // Инициализация
  const init = async () => {
    try {
      modules = await loadModules();
      renderModules();
      setupEventListeners();
    } catch (error) {
      console.error('Ошибка инициализации:', error);
      alert('Ошибка загрузки данных');
    }
  };

  // Рендер списка модулей
  const renderModules = () => {
    modulesGrid.innerHTML = '';

    modules.forEach(module => {
      const card = document.createElement('div');
      card.className = `module-card ${module.status === 'locked' ? 'locked' : ''}`;

      const statusIcon = module.status === 'active' ? '🔓' : '🔒';
      const statusText = module.status === 'active' ? 'Доступен' : 'Заблокирован';

      card.innerHTML = `
        <div class="module-header">
          <div class="module-number">${statusIcon} Модуль ${module.number}</div>
          <h2 class="module-title">${module.title}</h2>
        </div>
        <div class="module-body">
          <p class="module-description">${module.description}</p>
          <div class="module-meta">
            <span class="pill pill-accent">${statusText}</span>
          </div>
          <div class="module-progress">
            <div class="progress-label">
              <span>Прогресс</span>
              <span>0%</span>
            </div>
            <div class="progress">
              <i style="width: 0%"></i>
            </div>
          </div>
          <button class="btn btn-primary btn-module">
            ${module.status === 'active' ? 'Открыть' : 'Недоступно'}
          </button>
        </div>
      `;

      if (module.status === 'active') {
        card.addEventListener('click', () => showModuleDetail(module));
      }

      modulesGrid.appendChild(card);
    });
  };

  // Показать детали модуля
  const showModuleDetail = (module) => {
    currentModule = module;
    modulesView.style.display = 'none';
    moduleDetailView.style.display = 'block';

    document.getElementById('detailModuleNumber').textContent = `Модуль ${module.number}`;
    document.getElementById('detailModuleTitle').textContent = module.title;
    document.getElementById('detailModuleDescription').textContent = module.description;
    document.getElementById('detailStatus').textContent = module.status;

    // Цели
    const goalsList = document.getElementById('detailGoalsList');
    goalsList.innerHTML = '';
    module.goals.forEach(goal => {
      const li = document.createElement('li');
      li.textContent = goal;
      goalsList.appendChild(li);
    });

    // Материалы
    const materialsList = document.getElementById('detailMaterialsList');
    materialsList.innerHTML = '';
    module.materials.forEach(material => {
      const li = document.createElement('li');
      li.innerHTML = `
        <a href="${material.url}" class="material-item ${material.available === false ? 'material-unavailable' : ''}">
          <span class="material-icon">📄</span>
          <div class="material-info">
            <div class="material-type">${material.type}</div>
            <div class="material-title">${material.title}</div>
          </div>
          ${material.available === false ? '<span class="material-badge">Скоро</span>' : '<span class="material-badge">→</span>'}
        </a>
      `;
      materialsList.appendChild(li);
    });

    // ДЗ
    const homeworkContent = document.getElementById('detailHomeworkContent');
    if (module.homework) {
      homeworkContent.innerHTML = `
        <div class="homework-item">
          <h3 class="homework-title">${module.homework.title}</h3>
          <p class="homework-desc">${module.homework.description}</p>
          <div class="homework-due">Срок: ${formatDate(module.homework.dueDate)}</div>
          <div class="homework-btn-group">
            <button class="btn btn-primary" onclick="APP.openHomeworkModal('${module.id}', '${module.homework.title}')">
              Загрузить ДЗ
            </button>
            <button class="btn btn-ghost" onclick="APP.viewHomeworkStatus('${module.id}')">
              Статус
            </button>
          </div>
        </div>
      `;
    }

    window.scrollTo(0, 0);
  };

  // Вернуться к списку модулей
  const backToModules = () => {
    moduleDetailView.style.display = 'none';
    modulesView.style.display = 'block';
    currentModule = null;
    window.scrollTo(0, 0);
  };

  // Открыть модаль ДЗ
  const openHomeworkModal = (moduleId, title) => {
    document.getElementById('homeworkModalTitle').textContent = `${title}`;
    document.getElementById('homeworkTextarea').value = '';
    document.getElementById('homeworkTextarea').focus();
    homeworkModal.classList.add('open');

    // Переопределяем обработчик отправки
    homeworkSubmit.onclick = () => submitHomework(moduleId);
  };

  // Закрыть модаль ДЗ
  const closeHomeworkModal = () => {
    homeworkModal.classList.remove('open');
    document.getElementById('homeworkTextarea').value = '';
  };

  // Отправить ДЗ
  const submitHomework = async (moduleId) => {
    const content = document.getElementById('homeworkTextarea').value.trim();

    if (!content) {
      alert('Введите ДЗ');
      return;
    }

    try {
      const sessionId = AUTH.getSessionId();
      await API.submitHomework(sessionId, moduleId, content);
      alert('ДЗ отправлено! Ожидает проверки');
      closeHomeworkModal();
    } catch (error) {
      alert('Ошибка отправки: ' + error.message);
    }
  };

  // Просмотр статуса ДЗ
  const viewHomeworkStatus = (moduleId) => {
    alert('Статус ДЗ: На проверке');
  };

  // Утилиты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Обработчики событий
  const setupEventListeners = () => {
    detailBackBtn.addEventListener('click', backToModules);
    homeworkCancel.addEventListener('click', closeHomeworkModal);
    homeworkModal.addEventListener('click', (e) => {
      if (e.target === homeworkModal) closeHomeworkModal();
    });
  };

  // API для внешних вызовов
  window.APP = {
    openHomeworkModal,
    viewHomeworkStatus
  };

  return {
    init,
    showModuleDetail,
    backToModules
  };
})();

// Инициализировать приложение при загрузке
if (AUTH.isAuthenticated()) {
  document.addEventListener('DOMContentLoaded', () => {
    APP.init();

    // Показать список модулей
    document.getElementById('modulesView').style.display = 'block';
  });
}
