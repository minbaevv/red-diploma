export function pick(value, lang = 'ru') {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value[lang] ?? value.ru ?? ''
}

export function formatDate(value, lang = 'ru') {
  if (!value) return ''
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(lang === 'kg' ? 'ky-KG' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function daysLeft(value) {
  if (!value) return null
  const target = new Date(`${value}T23:59:59`)
  const now = new Date()
  const diff = target.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

export function pluralRu(value, one, few, many) {
  const n = Math.abs(Number(value)) % 100
  const last = n % 10
  if (n >= 11 && n <= 14) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

export function daysWord(value) {
  return pluralRu(value, 'день', 'дня', 'дней')
}

export function progressIndex(progress = []) {
  return new Map(progress.map((item) => [`${item.item_type}:${item.item_id}`, item]))
}

export function isDone(index, type, id) {
  return index.get(`${type}:${id}`)?.status === 'done'
}

export function moduleProgress(module, index) {
  const lessonIds = (module.lessons || []).map((lesson) => lesson.slug)
  const taskIds = module.task_slugs || []
  const total = lessonIds.length + taskIds.length
  if (!total) return 0
  const done =
    lessonIds.filter((id) => isDone(index, 'lesson', id)).length +
    taskIds.filter((id) => isDone(index, 'task', id)).length
  return Math.round((done / total) * 100)
}

export function collectMistakes(attempts = []) {
  const seen = new Set()
  const mistakes = []
  for (const attempt of attempts) {
    const results = attempt.details?.results || []
    for (const result of results) {
      if (result.correct || result.ok || !result.id) continue
      const key = `${attempt.ref}:${result.id}`
      if (seen.has(key)) continue
      seen.add(key)
      mistakes.push({
        key,
        ref: attempt.ref,
        kind: attempt.kind,
        id: result.id,
        label: result.input || result.id,
        at: attempt.created_at,
      })
    }
    if (attempt.details?.passed === false && attempt.kind === 'task') {
      for (const result of results) {
        if (result.ok) continue
        const key = `${attempt.ref}:${result.input}`
        if (seen.has(key)) continue
        seen.add(key)
        mistakes.push({
          key,
          ref: attempt.ref,
          kind: 'task',
          id: result.input,
          label: result.input,
          at: attempt.created_at,
        })
      }
    }
  }
  return mistakes
}
