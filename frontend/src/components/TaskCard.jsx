import { ArrowRight, CircleCheck, Code2, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { pick } from '../lib/format'
import { useApp } from '../state/AppContext'
import { Badge } from './ui'

export default function TaskCard({ task, done = false, moduleTitle }) {
  const { lang } = useApp()
  const isCode = task.type === 'code'
  return (
    <Link className={`task-card ${done ? 'done' : ''}`} to={`/task/${task.slug}`}>
      <div className="task-type">
        {isCode ? <Code2 size={16} /> : <Sparkles size={16} />}
      </div>
      <div className="task-card-body">
        <div className="task-card-top">
          <span className="task-kicker">{moduleTitle || task.module}</span>
          <span className="task-points">+{task.points}</span>
        </div>
        <h3>{pick(task.title, lang)}</h3>
        <p>{pick(task.prompt, lang)}</p>
        <div className="task-card-foot">
          <Badge tone={isCode ? 'violet' : 'cyan'}>
            {isCode ? (lang === 'kg' ? 'код' : 'код') : (lang === 'kg' ? 'теория' : 'теория')}
          </Badge>
          <span>{'●'.repeat(task.difficulty || 1)}</span>
          {done && (
            <span className="task-done-label">
              <CircleCheck size={14} /> {lang === 'kg' ? 'аткарылды' : 'решено'}
            </span>
          )}
        </div>
      </div>
      <ArrowRight size={18} className="task-arrow" />
    </Link>
  )
}
