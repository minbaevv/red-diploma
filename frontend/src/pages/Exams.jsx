import { Link } from 'react-router-dom'
import { ArrowRight, Clock, Target, Trophy } from 'lucide-react'
import { useApp, useBi } from '../state/AppContext'
import { pick, pluralRu } from '../lib/format'
import { Badge, PageHeader, ScoreBar } from '../components/ui'

export default function Exams() {
  const { data, lang, stats } = useApp()
  const bi = useBi()

  return (
    <div className="page">
      <PageHeader
        eyebrow={bi('Симуляция финала', 'Финал симуляциясы')}
        title={bi('Экзамены', 'Экзамендер')}
        subtitle={bi(
          'Три этапа: 20 + 30 + 50. Считается лучшая попытка, но ошибки видны сразу.',
          'Үч этап: 20 + 30 + 50. Эң жакшы аракет эсептелет, каталар дароо көрүнөт.',
        )}
        action={
          <div className="exam-total">
            <Trophy size={18} />
            <span>{stats.exam_points || 0} / 100</span>
            <Badge tone={(stats.exam_points || 0) >= 80 ? 'red' : 'neutral'}>
              {(stats.exam_points || 0) >= 80 ? bi('красный', 'кызыл') : bi('цель 80+', 'максат 80+')}
            </Badge>
          </div>
        }
      />

      <div className="exam-stage-list">
        {data.exams.map((exam) => {
          const percent = exam.points ? Math.round(((exam.best_score || 0) / exam.points) * 100) : 0
          return (
            <Link className="exam-stage-row" key={exam.slug} to={`/exam/${exam.slug}`}>
              <div className="exam-stage-index">0{exam.stage}</div>
              <div className="exam-stage-main">
                <div className="exam-stage-head">
                  <div>
                    <span className="task-kicker">{bi('Этап', 'Этап')} {exam.stage}</span>
                    <h2>{pick(exam.title, lang)}</h2>
                  </div>
                  <div className="exam-stage-score">
                    <strong>{exam.best_score || 0}</strong>
                    <span>/{exam.points}</span>
                  </div>
                </div>
                <p>{pick(exam.description, lang)}</p>
                <div className="exam-stage-bottom">
                  <ScoreBar score={exam.best_score || 0} max={exam.points} />
                  <div className="exam-stage-meta">
                    <span><Target size={14} /> {exam.question_count} {bi(pluralRu(exam.question_count, 'вопрос', 'вопроса', 'вопросов'), 'суроо')}</span>
                    <span><Clock size={14} /> {exam.minutes} {bi('мин', 'мүн')}</span>
                    <span className="go-label">{bi('Начать', 'Баштоо')} <ArrowRight size={15} /></span>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
