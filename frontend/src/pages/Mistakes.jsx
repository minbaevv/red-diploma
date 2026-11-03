import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, RotateCcw } from 'lucide-react'
import { useApp, useBi } from '../state/AppContext'
import { collectMistakes, formatDate, pick } from '../lib/format'
import { EmptyState, PageHeader } from '../components/ui'

export default function Mistakes() {
  const { data, lang } = useApp()
  const bi = useBi()
  const mistakes = collectMistakes(data.attempts)
  const taskMap = new Map(data.tasks.map((task) => [task.slug, task]))
  const examMap = new Map(data.exams.map((exam) => [exam.slug, exam]))

  return (
    <div className="page">
      <PageHeader
        eyebrow={bi('Работа над ошибками', 'Каталар үстүндө иштөө')}
        title={bi('Разбор ошибок', 'Каталарды талдоо')}
        subtitle={bi(
          'Здесь только то, что уже падало. Вернись к задаче, пока она не станет лёгкой.',
          'Бул жерде мурун кулаган нерселер гана. Тапшырма жеңил болмогуча кайра кел.',
        )}
        action={
          <div className="mistake-count">
            <AlertTriangle size={18} />
            <strong>{mistakes.length}</strong>
            <span>{bi('на разбор', 'талдоого')}</span>
          </div>
        }
      />

      {!mistakes.length ? (
        <EmptyState
          title={bi('Ошибок пока нет', 'Азырынча ката жок')}
          text={bi(
            'Это хороший знак. Реши несколько задач или пройди пробный экзамен — сюда попадут только реальные промахи.',
            'Бул жакшы белги. Бир нече тапшырма чеч же сынак экзамен өт — бул жерде чыныгы каталар гана пайда болот.',
          )}
          action={<Link className="btn btn-primary" to="/practice">{bi('К практике', 'Практикага')}</Link>}
        />
      ) : (
        <div className="mistake-list">
          {mistakes.map((mistake) => {
            const task = taskMap.get(mistake.ref)
            const exam = examMap.get(mistake.ref)
            const title = task ? pick(task.title, lang) : exam ? pick(exam.title, lang) : mistake.ref
            return (
              <div className="mistake-row" key={mistake.key}>
                <div className="mistake-mark"><RotateCcw size={17} /></div>
                <div className="mistake-copy">
                  <div className="mistake-top">
                    <span>{mistake.kind === 'exam' ? bi('Экзамен', 'Экзамен') : bi('Задача', 'Тапшырма')}</span>
                    <small>{formatDate(mistake.at?.slice(0, 10), lang)}</small>
                  </div>
                  <h3>{title}</h3>
                  <p>{mistake.label}</p>
                </div>
                <Link
                  className="mistake-link"
                  to={mistake.kind === 'exam' ? `/exam/${mistake.ref}` : `/task/${mistake.ref}`}
                >
                  {bi('Повторить', 'Кайталоо')} <ArrowRight size={16} />
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
