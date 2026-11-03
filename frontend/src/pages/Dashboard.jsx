import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Code2,
  Flame,
  Target,
} from 'lucide-react'
import { useApp, useBi } from '../state/AppContext'
import {
  collectMistakes,
  daysLeft,
  daysWord,
  formatDate,
  isDone,
  moduleProgress,
  pick,
  pluralRu,
  progressIndex,
} from '../lib/format'
import ModuleCard from '../components/ModuleCard'
import { Badge, PageHeader, ProgressRing, SectionTitle, StatCard } from '../components/ui'

export default function Dashboard() {
  const { data, lang, settings, stats } = useApp()
  const bi = useBi()
  const modules = data.modules || []
  const exams = data.exams || []
  const index = progressIndex(data.progress)
  const mistakes = collectMistakes(data.attempts)
  const left = daysLeft(settings.exam_date || data.meta?.exam_date)

  const taskMap = new Map((data.tasks || []).map((task) => [task.slug, task]))
  const examMap = new Map(exams.map((exam) => [exam.slug, exam]))
  let nextStep = null
  for (const module of modules) {
    const lesson = (module.lessons || []).find((item) => !isDone(index, 'lesson', item.slug))
    if (lesson) {
      nextStep = { type: 'lesson', module, lesson }
      break
    }
    const taskSlug = (module.task_slugs || []).find((slug) => !isDone(index, 'task', slug))
    if (taskSlug) {
      nextStep = { type: 'task', module, task: taskMap.get(taskSlug) }
      break
    }
  }

  const readiness = stats.readiness || 0
  const red = (stats.exam_points || 0) >= 80

  return (
    <div className="page dashboard">
      <PageHeader
        eyebrow={bi('Личный экзамен-кокпит', 'Жеке экзамен-кокпит')}
        title={bi('Собери красный диплом.', 'Кызыл дипломду жыйна.')}
        subtitle={bi(
          'Один экран: что учить, где потренироваться и сколько баллов уже в кармане.',
          'Бир экран: эмнени үйрөнүү, кайда машыгуу жана канча балл бар.',
        )}
        action={
          <div className="date-chip">
            <CalendarDays size={16} />
            <span>{formatDate(settings.exam_date, lang)}</span>
          </div>
        }
      />

      <section className="hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <Flame size={16} />
            {left !== null
              ? bi(`${left} ${daysWord(left)} до финала`, `Финалга ${left} күн`)
              : bi('Дата экзамена не задана', 'Экзамен күнү белгиленген эмес')}
          </div>
          <h2>
            {bi('Не идеально всё. ', 'Баарын идеалдуу эмес. ')}
            <span>{bi('Идеально — экзамен.', 'Идеалдуу — экзамен.')}</span>
          </h2>
          <p>
            {bi(
              'План на 80+ уже внутри: короткие уроки, задачи с тестами и три этапа по 20 + 30 + 50 баллов.',
              '80+ планы даяр: кыска сабактар, тесттери бар тапшырмалар жана 20 + 30 + 50 баллдык үч этап.',
            )}
          </p>
          <div className="hero-actions">
            {nextStep ? (
              <Link
                className="btn btn-primary"
                to={nextStep.type === 'lesson' ? `/lesson/${nextStep.lesson.slug}` : `/task/${nextStep.task.slug}`}
              >
                {bi('Продолжить', 'Улантуу')} <ArrowRight size={17} />
              </Link>
            ) : (
              <Link className="btn btn-primary" to="/exams">
                {bi('К финальному экзамену', 'Финалдык экзаменге')} <ArrowRight size={17} />
              </Link>
            )}
            <Link className="btn btn-ghost" to="/exams">
              {bi('Пробный экзамен', 'Сынак экзамени')}
            </Link>
          </div>
        </div>
        <div className="hero-score">
          <ProgressRing value={readiness} label={bi('готовность', 'даярдык')} />
          <div className="hero-score-foot">
            <div>
              <span>{bi('Баллы', 'Баллдар')}</span>
              <strong>{stats.exam_points || 0}<small>/100</small></strong>
            </div>
            <Badge tone={red ? 'red' : 'neutral'}>
              {red ? bi('красный диплом', 'кызыл диплом') : bi('до 80 баллов', '80 баллга чейин')}
            </Badge>
          </div>
        </div>
      </section>

      <div className="stat-grid">
        <StatCard
          label={bi('Уроки', 'Сабактар')}
          value={`${stats.lessons_done || 0}/${stats.total_lessons || 0}`}
          hint={bi('короткие блоки', 'кыска блоктор')}
          icon={BookOpen}
        />
        <StatCard
          label={bi('Задачи', 'Тапшырмалар')}
          value={`${stats.tasks_done || 0}/${stats.total_tasks || 0}`}
          hint={bi('код + теория', 'код + теория')}
          icon={Code2}
        />
        <StatCard
          label={bi('Ошибки', 'Каталар')}
          value={mistakes.length}
          hint={bi('в последних попытках', 'акыркы аракеттерде')}
          tone={mistakes.length ? 'warm' : 'light'}
          icon={AlertTriangle}
        />
        <StatCard
          label={bi('До экзамена', 'Экзаменге чейин')}
          value={left ?? '—'}
          hint={bi('дней', 'күн')}
          icon={Clock}
        />
      </div>

      {nextStep && (
        <section className="next-step">
          <div className="next-step-icon">
            {nextStep.type === 'lesson' ? <BookOpen size={20} /> : <Code2 size={20} />}
          </div>
          <div className="next-step-copy">
            <span>{bi('Следующий шаг', 'Кийинки кадам')}</span>
            <strong>
              {nextStep.type === 'lesson'
                ? nextStep.lesson.title?.[lang]
                : nextStep.task?.title?.[lang]}
            </strong>
            <small>{nextStep.module.title?.[lang]}</small>
          </div>
          <Link
            className="next-step-link"
            to={nextStep.type === 'lesson' ? `/lesson/${nextStep.lesson.slug}` : `/task/${nextStep.task.slug}`}
          >
            <ArrowRight size={18} />
          </Link>
        </section>
      )}

      <section className="dashboard-section">
        <SectionTitle
          title={bi('Этапы экзамена', 'Экзамен этаптары')}
          subtitle={bi('20 + 30 + 50 = 100. 80+ — красный диплом.', '20 + 30 + 50 = 100. 80+ — кызыл диплом.')}
          action={<Link className="text-link" to="/exams">{bi('Все экзамены', 'Баардык экзамендер')} <ArrowRight size={15} /></Link>}
        />
        <div className="stage-grid">
          {exams.map((exam) => {
            const percent = Math.round(((exam.best_score || 0) / exam.points) * 100)
            return (
              <Link className="stage-card" key={exam.slug} to={`/exam/${exam.slug}`}>
                <div className="stage-number">0{exam.stage}</div>
                <div className="stage-card-body">
                  <div className="stage-card-top">
                    <span>{bi('Этап', 'Этап')} {exam.stage}</span>
                    <strong>{exam.best_score || 0}<small>/{exam.points}</small></strong>
                  </div>
                  <h3>{exam.title?.[lang]}</h3>
                  <div className="stage-track">
                    <div style={{ width: `${percent}%` }} />
                  </div>
                  <div className="stage-meta">
                    <span>{exam.question_count} {bi(pluralRu(exam.question_count, 'вопрос', 'вопроса', 'вопросов'), 'суроо')}</span>
                    <span>{exam.minutes} {bi('минут', 'мүнөт')}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="dashboard-section">
        <SectionTitle
          title={bi('Карта знаний', 'Билим картасы')}
          subtitle={bi('9 модулей. Каждый закрывает свой кусок экзамена.', '9 модуль. Ар бири экзамендин бөлүгүн жабат.')}
          action={<Link className="text-link" to="/learn">{bi('Открыть обучение', 'Окууну ачуу')} <ArrowRight size={15} /></Link>}
        />
        <div className="module-grid">
          {modules.map((module) => {
            const total = (module.lessons?.length || 0) + (module.task_slugs?.length || 0)
            const done =
              (module.lessons || []).filter((lesson) => isDone(index, 'lesson', lesson.slug)).length +
              (module.task_slugs || []).filter((slug) => isDone(index, 'task', slug)).length
            return (
              <ModuleCard
                key={module.slug}
                module={module}
                progress={moduleProgress(module, index)}
                done={done}
                total={total}
              />
            )
          })}
        </div>
      </section>

      <section className="dashboard-section">
        <SectionTitle
          title={bi('Последние попытки', 'Акыркы аракеттер')}
          subtitle={bi('История проверок и экзаменов.', 'Текшерүүлөр жана экзамендер тарыхы.')}
        />
        <div className="attempt-list">
          {(data.attempts || []).slice(0, 5).map((attempt) => (
            <div className="attempt-row" key={attempt.id}>
              <div className="attempt-icon">
                {attempt.kind === 'exam' ? <Target size={17} /> : <CheckCircle2 size={17} />}
              </div>
              <div className="attempt-copy">
                <strong>
                  {pick(
                    attempt.kind === 'exam' ? examMap.get(attempt.ref)?.title : taskMap.get(attempt.ref)?.title,
                    lang,
                  ) || attempt.ref}
                </strong>
                <span>
                  {attempt.kind === 'exam'
                    ? bi('Экзамен', 'Экзамен')
                    : attempt.kind === 'theory'
                      ? bi('Теория', 'Теория')
                      : bi('Задача', 'Тапшырма')}
                  {' · '}
                  {formatDate(attempt.created_at?.slice(0, 10), lang)}
                </span>
              </div>
              <div className="attempt-score">{attempt.score}/{attempt.max_score}</div>
            </div>
          ))}
          {!(data.attempts || []).length && (
            <div className="attempt-empty">
              {bi('Пока пусто. Начни с первого урока — история появится здесь.', 'Азырынча бош. Биринчи сабактан башта.')}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
