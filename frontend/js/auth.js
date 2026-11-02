// Управление аутентификацией
const AUTH = (() => {
  const SESSION_KEY = 'focusSessionId';

  const login = async (pin) => {
    const response = await fetch('api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Неверный PIN');
    }
    localStorage.setItem(SESSION_KEY, data.sessionId);
    return data;
  };

  const clear = () => localStorage.removeItem(SESSION_KEY);

  const logout = async () => {
    const sessionId = getSessionId();
    clear();
    if (sessionId) {
      await fetch('api/auth/logout', { method: 'POST', headers: { 'X-Session-Id': sessionId } }).catch(() => {});
    }
    location.reload();
  };

  const isAuthenticated = () => !!localStorage.getItem(SESSION_KEY);
  const getSessionId = () => localStorage.getItem(SESSION_KEY);

  return { login, logout, clear, isAuthenticated, getSessionId };
})();

// DOM элементы
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginForm = document.getElementById('loginForm');
const pinInput = document.getElementById('pinInput');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

const showDashboard = () => {
  loginScreen.style.display = 'none';
  dashboardScreen.style.display = 'block';
  APP.init();
};

// Вызывается при 401 — сессия истекла или недействительна
const showLogin = (message = '') => {
  AUTH.clear();
  dashboardScreen.style.display = 'none';
  loginScreen.style.display = 'flex';
  loginError.textContent = message;
};

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pin = pinInput.value.trim();
  if (!pin) {
    loginError.textContent = 'Введите PIN';
    return;
  }
  const btn = loginForm.querySelector('button');
  btn.disabled = true;
  try {
    loginError.textContent = '';
    await AUTH.login(pin);
    pinInput.value = '';
    showDashboard();
  } catch (error) {
    loginError.textContent = error.message;
    pinInput.value = '';
  } finally {
    btn.disabled = false;
  }
});

logoutBtn.addEventListener('click', () => AUTH.logout());
