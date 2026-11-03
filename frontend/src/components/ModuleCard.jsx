import { ArrowUpRight, CircleCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ModuleIcon } from './ui'
import { pick, pluralRu } from '../lib/format'
import { useApp } from '../state/AppContext'

export default function ModuleCard({ module, progress = 0, done = 0, total = 0 }) {
  const { lang } = useApp()
  return (
    <Link
      className="module-card"
      style={{ '--accent': module.accent }}
      to={`/learn/${module.slug}`}
    >
      <div className="module-card-top">
        <div
          className="module-icon"
          style={{ background: `${module.accent}18`, color: module.accent }}
        >
          <ModuleIcon name={module.icon} size={21} />
        </div>
        {progress === 100 ? (
          <CircleCheck size={18} className="done-icon" />
        ) : (
          <ArrowUpRight size={18} className="module-arrow" />
        )}
      </div>
      <div className="module-order">{String(module.order).padStart(2, '0')}</div>
      <h3>{pick(module.title, lang)}</h3>
      <p>{pick(module.subtitle, lang)}</p>
      <div className="module-meta">
        <span>{module.lesson_count} {lang === 'kg' ? 'сабак' : pluralRu(module.lesson_count, 'урок', 'урока', 'уроков')}</span>
        <span>{module.task_count} {lang === 'kg' ? 'тапшырма' : pluralRu(module.task_count, 'задача', 'задачи', 'задач')}</span>
      </div>
      <div className="module-progress">
        <div className="module-progress-track">
          <div style={{ width: `${progress}%`, background: module.accent }} />
        </div>
        <span>{done}/{total}</span>
      </div>
    </Link>
  )
}
