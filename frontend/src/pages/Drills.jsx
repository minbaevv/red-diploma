import { Link } from 'react-router-dom'
import { ArrowRight, Clock, ListChecks, Target, Trophy } from 'lucide-react'
import { useApp, useBi } from '../state/AppContext'
import { pick, pluralRu } from '../lib/format'
import { Badge, ModuleIcon, PageHeader } from '../components/ui'

export default function Drills() {
  const { data, lang, stats } = useApp()
  const bi = useBi()
  const drills = data.drills || []
  const average = stats.drill_average || 0

  return (
    <div className="page drills-page">
      <PageHeader
        eyebrow={bi('Быстрые проверки', 'Тезек текшерүүлөр')}
        title={bi('Тренажёр', 'Тренажёр')}
        subtitle={bi(
          `${drills.length} ${pluralRu(drills.length, 'направление', 'направления', 'направлений')} и ${stats.drill_questions || 0} ${pluralRu(stats.drill_questions || 0, 'вопрос', 'вопроса', 'вопросов')}. В режиме «с подсказками» каждый ответ разбирается сразу, в режиме «без подсказок» разбор откроется только после сдачи.`,
          `${drills.length} багыт жана ${stats.drill_questions || 0} суроо. «Подсказкалар менен» режиминде ар бир жооп дароо талданат, «подсказкасыз» режиминде талдоо тапшыргандан кийин гана ачылат.`,
        )}
        action={
          <div className="exam-total">
            {average >= 80 ? <Trophy size={18} /> : <ListChecks size={18} />}
            <span>{bi('средний результат', 'орточо натыйжа')}</span>
            <Badge tone={average >= 80 ? 'red' : 'neutral'}>{average}%</Badge>
          </div>
        }
      />

      <div className="drill-summary">
        <span>
          <ListChecks size={15} />
          {drills.length} {bi(pluralRu(drills.length, 'направление', 'направления', 'направлений'), 'багыт')}
        </span>
        <span>
          <Target size={15} />
          {stats.drill_questions || 0} {bi(pluralRu(stats.drill_questions || 0, 'вопрос', 'вопроса', 'вопросов'), 'суроо')}
        </span>
        <span>
          <Trophy size={15} />
          {stats.drills_done || 0} / {stats.total_drills || drills.length} {bi('пройдено', 'өтүлдү')}
        </span>
      </div>

      <div className="drill-grid">
        {drills.map((drill) => {
          const percent = Math.max(0, Math.min(100, drill.best_percent || 0))
          return (
            <Link
              className="drill-card"
              key={drill.slug}
              to={`/drills/${drill.slug}`}
              style={{ '--drill-accent': drill.accent || '#8b5cf6' }}
            >
              <div className="drill-card-top">
                <span className="drill-icon">
                  <ModuleIcon name={drill.icon} size={20} />
                </span>
                <span className="drill-order">{String(drill.order || 0).padStart(2, '0')}</span>
              </div>

              <div className="drill-card-body">
                <h2>{pick(drill.title, lang)}</h2>
                <p>{pick(drill.description, lang)}</p>
              </div>

              <div className="drill-card-meta">
                <span>
                  <Target size={14} />
                  {drill.question_count} {bi(pluralRu(drill.question_count, 'вопрос', 'вопроса', 'вопросов'), 'суроо')}
                </span>
                <span>
                  <Clock size={14} />
                  {drill.minutes} {bi('мин', 'мүн')}
                </span>
                <span className="go-label">
                  {bi('Открыть', 'Ачуу')} <ArrowRight size={15} />
                </span>
              </div>

              <div className="drill-card-score">
                <div className="drill-score-head">
                  <span>{bi('Лучший результат', 'Эң жакшы натыйжа')}</span>
                  <strong>{percent}%</strong>
                </div>
                <div className="drill-score-track">
                  <div style={{ width: `${percent}%` }} />
                </div>
                <div className="drill-score-foot">
                  {drill.attempts
                    ? `${drill.attempts} ${bi(pluralRu(drill.attempts, 'попытка', 'попытки', 'попыток'), 'аракет')}`
                    : bi('Ещё не пройден', 'Азырынча өтүлгөн эмес')}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
