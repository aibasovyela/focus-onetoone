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
    getCalls: () => request('/calls'),
    icsLink: (n) => request('/calls/ics-link', { method: 'POST', body: JSON.stringify({ n }) }),
    hostStudents: () => request('/calls/host/students'),
    hostPatch: (studentId, calls) =>
      request(`/calls/host/students/${encodeURIComponent(studentId)}`, { method: 'PATCH', body: JSON.stringify({ calls }) }),
    hostHomework: () => request('/homework/host/all'),
    // payload: { content, link, files: [id загруженных файлов] }
    submitHomework: (moduleId, payload) =>
      request('/homework/submit', {
        method: 'POST',
        body: JSON.stringify({ moduleId, ...payload })
      })
  };
})();
