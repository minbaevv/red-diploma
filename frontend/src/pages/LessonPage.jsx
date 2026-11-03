import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock } from 'lucide-react'
import { api } from '../api'
import { useApp, useBi } from '../state/AppContext'
import { isDone, pick, progressIndex } from '../lib/format'
import TaskCard from '../components/TaskCard'
import { Badge, Markdown, SectionTitle } from '../components/ui'

export default function LessonPage() {
  const { slug } = useParams()
  const { data, refresh, lang } = useApp()
  const bi = useBi()
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const index = progressIndex(data?.progress)

  useEffect(() => {
    let active = true
    api
      .lesson(slug)
      .then((next) => active && setPayload(next))
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [slug])

  if (error) return <div className="page"><p className="form-error">{error}</p></div>
  if (!payload) return <div className="page"><div className="skeleton tall" /></div>

  const { module, lesson, tasks } = payload
  const blocks = lesson.content?.[lang] || lesson.content?.ru || []
  const content = Array.isArray(blocks) ? blocks.join('\n\n') : blocks
  const complete = isDone(index, 'lesson', lesson.slug)

  async function markDone() {
    setSaving(true)
    try {
      await api.completeLesson(lesson.slug)
      await refresh(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page lesson-page">
      <Link className="back-link" to={`/learn/${module.slug}`}>
        <ArrowLeft size={16} /> {pick(module.title, lang)}
      </Link>

      <div className="lesson-layout">
        <article className="lesson-article">
          <header className="lesson-head">
            <div className="eyebrow">{bi('Урок', 'Сабак')}</div>
            <h1>{pick(lesson.title, lang)}</h1>
            <p>{pick(lesson.summary, lang)}</p>
            <div className="lesson-meta">
              <Badge tone="neutral"><Clock size={13} /> {lesson.minutes} {bi('минут', 'мүнөт')}</Badge>
              {complete && <Badge tone="green"><CheckCircle2 size={13} /> {bi('пройден', 'өтүлдү')}</Badge>}
            </div>
          </header>
          <Markdown>{content}</Markdown>
          <div className="lesson-mark">
            <div>
              <strong>{bi('Теория закрыта?', 'Теория жабылдыбы?')}</strong>
              <span>{bi('Отметь урок и переходи к практике.', 'Сабакты белгилеп, практикага өт.')}</span>
            </div>
            <button className="btn btn-primary" onClick={markDone} disabled={saving || complete}>
              {complete
                ? bi('Урок пройден', 'Сабак өтүлдү')
                : saving
                  ? bi('Сохраняем…', 'Сактап жатабыз…')
                  : bi('Отметить пройденным', 'Өтүлдү деп белгилөө')}
            </button>
          </div>
        </article>

        <aside className="lesson-aside">
          <div className="aside-card">
            <div className="eyebrow">{bi('В этом уроке', 'Бул сабакта')}</div>
            <h3>{bi('Практика', 'Практика')}</h3>
            <div className="aside-task-list">
              {tasks.map((task) => (
                <Link key={task.slug} to={`/task/${task.slug}`} className="aside-task">
                  <span>{pick(task.title, lang)}</span>
                  <ArrowRight size={15} />
                </Link>
              ))}
            </div>
          </div>
          <div className="aside-note">
            <strong>{bi('Правило', 'Эреже')}</strong>
            <p>
              {bi(
                'Сначала ответь своими словами, потом открывай подсказку. Так ответ останется в голове.',
                'Адегенде өз сөзүң менен жооп бер, анан подсказканы ач. Ошентип жооп эсте калат.',
              )}
            </p>
          </div>
        </aside>
      </div>

      <section className="dashboard-section">
        <SectionTitle title={bi('Задачи урока', 'Сабактын тапшырмалары')} />
        <div className="task-list">
          {tasks.map((task) => (
            <TaskCard key={task.slug} task={task} done={isDone(index, 'task', task.slug)} moduleTitle={pick(module.title, lang)} />
          ))}
        </div>
      </section>
    </div>
  )
}
