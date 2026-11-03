import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock, Code2 } from 'lucide-react'
import { api } from '../api'
import { useApp, useBi } from '../state/AppContext'
import { isDone, pick, pluralRu, progressIndex } from '../lib/format'
import TaskCard from '../components/TaskCard'
import { Badge, Markdown, ModuleIcon, ProgressRing, SectionTitle } from '../components/ui'

export default function ModulePage() {
  const { slug } = useParams()
  const { data, lang } = useApp()
  const bi = useBi()
  const [moduleData, setModuleData] = useState(null)
  const [error, setError] = useState('')
  const index = progressIndex(data?.progress)

  useEffect(() => {
    let active = true
    api
      .module(slug)
      .then((payload) => {
        if (active) setModuleData(payload.module)
      })
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [slug])

  if (error) return <div className="page"><p className="form-error">{error}</p></div>
  if (!moduleData) return <div className="page"><div className="skeleton tall" /></div>

  const module = moduleData
  const tasks = module.task_slugs.map((taskSlug) => data.tasks.find((item) => item.slug === taskSlug)).filter(Boolean)
  const lessonsDone = (module.lessons || []).filter((lesson) => isDone(index, 'lesson', lesson.slug)).length
  const tasksDone = (module.task_slugs || []).filter((taskSlug) => isDone(index, 'task', taskSlug)).length
  const total = (module.lessons?.length || 0) + (module.task_slugs?.length || 0)
  const done = lessonsDone + tasksDone
  const percent = total ? Math.round((done / total) * 100) : 0

  return (
    <div className="page">
      <Link className="back-link" to="/learn">
        <ArrowLeft size={16} /> {bi('К карте знаний', 'Билим картасына')}
      </Link>

      <header className="module-hero" style={{ '--accent': module.accent }}>
        <div className="module-hero-icon">
          <ModuleIcon name={module.icon} size={30} />
        </div>
        <div className="module-hero-copy">
          <div className="eyebrow">{bi('Модуль', 'Модуль')} {String(module.order).padStart(2, '0')}</div>
          <h1>{pick(module.title, lang)}</h1>
          <p>{pick(module.subtitle, lang)}</p>
          <div className="module-hero-meta">
            <Badge tone="neutral">{module.lessons?.length || 0} {bi(pluralRu(module.lessons?.length || 0, 'урок', 'урока', 'уроков'), 'сабак')}</Badge>
            <Badge tone="neutral">{module.task_slugs?.length || 0} {bi(pluralRu(module.task_slugs?.length || 0, 'задача', 'задачи', 'задач'), 'тапшырма')}</Badge>
            <Badge tone="neutral"><Clock size={13} /> {module.estimated_minutes} {bi('мин', 'мүн')}</Badge>
          </div>
        </div>
        <ProgressRing value={percent} label={bi('модуль', 'модуль')} size={126} />
      </header>

      <section className="dashboard-section">
        <SectionTitle
          title={bi('Уроки', 'Сабактар')}
          subtitle={bi('Сначала теория, потом задачи.', 'Адегенде теория, анан тапшырмалар.')}
        />
        <div className="lesson-list">
          {(module.lessons || []).map((lesson) => {
            const complete = isDone(index, 'lesson', lesson.slug)
            return (
              <Link className={`lesson-row ${complete ? 'done' : ''}`} key={lesson.slug} to={`/lesson/${lesson.slug}`}>
                <div className="lesson-row-icon">
                  {complete ? <CheckCircle2 size={19} /> : <BookOpen size={19} />}
                </div>
                <div className="lesson-row-copy">
                  <strong>{pick(lesson.title, lang)}</strong>
                  <span>{pick(lesson.summary, lang)}</span>
                </div>
                <div className="lesson-row-meta">{lesson.minutes} {bi('мин', 'мүн')}</div>
                <ArrowRight size={17} />
              </Link>
            )
          })}
        </div>
      </section>

      <section className="dashboard-section">
        <SectionTitle
          title={bi('Практика модуля', 'Модулдун практикасы')}
          subtitle={bi('Каждая задача — как вопрос на экзамене.', 'Ар бир тапшырма экзамен суроосуна окшош.')}
        />
        <div className="task-list">
          {tasks.map((task) => (
            <TaskCard
              key={task.slug}
              task={task}
              done={isDone(index, 'task', task.slug)}
              moduleTitle={pick(module.title, lang)}
            />
          ))}
        </div>
      </section>

      <details className="module-notes">
        <summary><Code2 size={16} /> {bi('Короткая шпаргалка модуля', 'Модулдун кыска шпаргалкасы')}</summary>
        <Markdown>{Array.isArray(module.lessons?.[0]?.content?.[lang]) ? module.lessons[0].content[lang].join('\n\n') : module.lessons?.[0]?.content?.[lang] || ''}</Markdown>
      </details>
    </div>
  )
}
