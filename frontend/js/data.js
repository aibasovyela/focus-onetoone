// API для работы с данными
const API = (() => {
  const baseUrl = 'api';

  const request = async (endpoint, options = {}, as = 'json') => {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': AUTH.getSessionId() || '',
        ...options.headers
      }
    });

    if (response.status === 401) {
      showLogin('Сессия завершена — войдите заново');
      throw new Error('unauthorized');
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Ошибка запроса');
    }
    return as === 'text' ? response.text() : response.json();
  };

  return {
    getMe: () => request('/modules/me'),
    getModules: () => request('/modules'),
    getModule: (moduleId) => request(`/modules/${moduleId}`),
    getLesson: (moduleId) => request(`/modules/${moduleId}/lesson`),
    getCheatsheet: (moduleId) => request(`/modules/${moduleId}/cheatsheet`, {}, 'text'),
    getHomework: (moduleId) => request(`/homework/${moduleId}`),
    submitHomework: (moduleId, content) =>
      request('/homework/submit', {
        method: 'POST',
        body: JSON.stringify({ moduleId, content })
      })
  };
})();
