import { isDone, pick } from './format'

export function pathSteps(path) {
  const steps = []
  for (const section of path?.sections || []) {
    for (const step of section.steps || []) {
      steps.push({
        ...step,
        index: steps.length,
        sectionId: section.id,
        sectionTitle: section.title,
      })
    }
  }
  return steps
}

export function stepKey(step) {
  return `${step.type}:${step.slug}`
}

export function stepUrl(step, pathSlug) {
  const params = new URLSearchParams({ path: pathSlug, step: String(step.index) })
  return `/${step.type}/${step.slug}?${params.toString()}`
}

export function stepTitle(step, data, lang) {
  if (!step) return ''
  const task = step.type === 'task' ? data?.tasks?.find((item) => item.slug === step.slug) : null
  const lesson =
    step.type === 'lesson'
      ? data?.modules
          ?.flatMap((module) => module.lessons || [])
          .find((item) => item.slug === step.slug)
      : null
  return pick(lesson?.title || task?.title, lang) || step.slug
}

export function pathContext(data, params, type, slug) {
  const requested = params.get('path')
  if (!requested) return null
  const path = (data?.paths || []).find((item) => item.slug === requested)
  if (!path) return null
  const steps = pathSteps(path)
  const index = Number(params.get('step'))
  if (!Number.isInteger(index) || index < 0 || index >= steps.length) return null
  const step = steps[index]
  if (step.type !== type || step.slug !== slug) return null
  return { path, steps, step, index, next: steps[index + 1] || null }
}

export function pathStats(path, index) {
  const steps = pathSteps(path)
  const done = steps.filter((step) => isDone(index, step.type, step.slug)).length
  const current = steps.find((step) => !isDone(index, step.type, step.slug)) || null
  return {
    steps,
    done,
    total: steps.length,
    percent: steps.length ? Math.round((done / steps.length) * 100) : 0,
    current,
  }
}

export function sectionSteps(steps, sectionId) {
  return steps.filter((step) => step.sectionId === sectionId)
}
