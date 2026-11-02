// Управление аутентификацией
const AUTH = (() => {
  const SESSION_KEY = 'focusSessionId';
  const PIN_KEY = 'focusPinHash';

  const login = async (pin) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      if (!response.ok) {
        throw new Error('Неверный PIN');
      }

      const data = await response.json();
      sessionStorage.setItem(SESSION_KEY, data.sessionId);
      sessionStorage.setItem(PIN_KEY, hashPin(pin));
      return data;
    } catch (error) {
      throw new Error('Ошибка входа: ' + error.message);
    }
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(PIN_KEY);
    location.reload();
  };

  const isAuthenticated = () => {
    return !!sessionStorage.getItem(SESSION_KEY);
  };

  const getSessionId = () => {
    return sessionStorage.getItem(SESSION_KEY);
  };

  const hashPin = (pin) => {
    // Простой хеш для примера (в бою нужна криптография)
    return btoa(pin);
  };

  return { login, logout, isAuthenticated, getSessionId };
})();

// DOM элементы
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginForm = document.getElementById('loginForm');
const pinInput = document.getElementById('pinInput');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

// Обработка формы входа
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pin = pinInput.value.trim();

  if (!pin) {
    loginError.textContent = 'Введите PIN';
    return;
  }

  try {
    loginError.textContent = '';
    await AUTH.login(pin);
    showDashboard();
  } catch (error) {
    loginError.textContent = error.message;
    pinInput.value = '';
  }
});

// Выход
logoutBtn.addEventListener('click', () => {
  AUTH.logout();
});

// Показать экран входа или кабинет
const showDashboard = () => {
  loginScreen.style.display = 'none';
  dashboardScreen.style.display = 'block';
};

const showLogin = () => {
  loginScreen.style.display = 'block';
  dashboardScreen.style.display = 'none';
  pinInput.focus();
};

// Проверить аутентификацию при загрузке
if (AUTH.isAuthenticated()) {
  showDashboard();
} else {
  showLogin();
}
