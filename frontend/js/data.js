// API для работы с данными
const API = (() => {
  const baseUrl = '/api';

  const request = async (endpoint, options = {}) => {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка запроса');
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  return {
    // Модули
    getModules: () => request('/modules'),
    getModule: (moduleId) => request(`/modules/${moduleId}`),

    // ДЗ
    submitHomework: (sessionId, moduleId, content) =>
      request('/homework/submit', {
        method: 'POST',
        body: JSON.stringify({ sessionId, moduleId, content })
      }),
    getHomework: (moduleId) => request(`/homework/${moduleId}`),

    // Проверка сессии
    verifySession: (sessionId) =>
      request('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ sessionId })
      })
  };
})();

// Кэш данных
const CACHE = (() => {
  let modules = null;

  return {
    setModules: (data) => { modules = data; },
    getModules: () => modules,
    clearAll: () => { modules = null; }
  };
})();

// Загрузить модули с кэшированием
const loadModules = async () => {
  if (CACHE.getModules()) {
    return CACHE.getModules();
  }

  try {
    const modules = await API.getModules();
    CACHE.setModules(modules);
    return modules;
  } catch (error) {
    console.error('Ошибка загрузки модулей:', error);
    throw error;
  }
};
