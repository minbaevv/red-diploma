const jsonHeaders = { 'Content-Type': 'application/json' }

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: jsonHeaders,
    ...options,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.detail || `Request failed: ${response.status}`)
  }
  return payload
}

export const api = {
  bootstrap: () => request('/api/bootstrap'),
  module: (slug) => request(`/api/modules/${slug}`),
  lesson: (slug) => request(`/api/lessons/${slug}`),
  task: (slug) => request(`/api/tasks/${slug}`),
  runTask: (slug, code) =>
    request(`/api/tasks/${slug}/run`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  solution: (slug) => request(`/api/tasks/${slug}/solution`),
  completeTask: (slug, confidence = 'good') =>
    request(`/api/tasks/${slug}/complete`, {
      method: 'POST',
      body: JSON.stringify({ confidence }),
    }),
  completeLesson: (slug) =>
    request(`/api/lessons/${slug}/complete`, { method: 'POST' }),
  exam: (slug) => request(`/api/exams/${slug}`),
  submitExam: (slug, answers) =>
    request(`/api/exams/${slug}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),
  drills: () => request('/api/drills'),
  drill: (slug) => request(`/api/drills/${slug}`),
  checkDrill: (slug, questionId, option) =>
    request(`/api/drills/${slug}/check`, {
      method: 'POST',
      body: JSON.stringify({ question_id: questionId, option }),
    }),
  submitDrill: (slug, answers) =>
    request(`/api/drills/${slug}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),
  updateSettings: (payload) =>
    request('/api/settings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  notes: () => request('/api/notes'),
  addNote: (payload) =>
    request('/api/notes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteNote: (id) => request(`/api/notes/${id}`, { method: 'DELETE' }),
  jarvisConfig: () => request('/api/jarvis/config'),
  jarvisChat: (payload) =>
    request('/api/jarvis/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  jarvisSpeech: async (text, lang = 'ru') => {
    const response = await fetch('/api/jarvis/speech', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ text, lang }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail || `Speech failed: ${response.status}`)
    }
    return response.blob()
  },
}
