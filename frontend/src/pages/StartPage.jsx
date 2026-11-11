import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  Code2,
  Compass,
  Sparkles,
} from 'lucide-react'
import { useApp, useBi } from '../state/AppContext'
import { isDone, pick, pluralRu, progressIndex } from '../lib/format'
import {
  pathStats,
  sectionSteps,
  stepKey,
  stepTitle,
  stepUrl,
} from '../lib/path'
import { Badge, EmptyState, PageHeader, ProgressRing } from '../components/ui'

export default function StartPage() {
  const { data, lang } = useApp()
  const bi = useBi()
  const [params] = useSearchParams()
  const paths = data.paths || []
  const requested = params.get('path')
  const path = paths.find((item) => item.slug === requested) || paths[0]

  if (!path) {
    return (
      <div className="page">
        <EmptyState
          title={bi('Маршрут пока не готов', 'Маршрут азырынча даяр эмес')}
          text={bi(
            'Обнови backend, чтобы загрузить пошаговый план.',
            'Кадам-кадам планды жүктөө үчүн backendди жаңырт.',
          )}
          action={<Link className="btn btn-primary" to="/learn">{bi('Открыть обучение', 'Окууну ачуу')}</Link>}
        />
      </div>
    )
  }

  const index = progressIndex(data.progress)
  const stats = pathStats(path, index)
  const currentKey = stats.current ? stepKey(stats.current) : ''
  const started = stats.done > 0
  const finished = stats.done === stats.total

  return (
    <div className="page start-page">
      <PageHeader
        eyebrow={bi('Пошаговый маршрут', 'Кадам-кадам маршрут')}
        title={pick(path.title, lang)}
        subtitle={pick(path.subtitle, lang)}
        action={
          <Badge tone={finished ? 'green' : 'cyan'}>
            {finished ? bi('готово', 'даяр') : `${stats.done} / ${stats.total}`}
          </Badge>
        }
      />

      {paths.length > 1 && (
        <nav className="path-switcher" aria-label={bi('Выбор маршрута', 'Маршрут тандоо')}>
          {paths.map((item) => (
            <Link
              key={item.slug}
              to={`/start?path=${item.slug}`}
              className={`path-switch ${item.slug === path.slug ? 'active' : ''}`}
              aria-current={item.slug === path.slug ? 'page' : undefined}
            >
              <span>{pick(item.title, lang)}</span>
              <small>{pick(item.subtitle, lang)}</small>
            </Link>
          ))}
        </nav>
      )}

      <section className="path-hero">
        <div className="path-hero-copy">
          <div className="hero-kicker">
            <Sparkles size={15} />
            {finished
              ? bi('Маршрут завершён', 'Маршрут аяктады')
              : bi('Следующий шаг', 'Кийинки кадам')}
          </div>
          <h2>
            {finished
              ? bi('Проект собран. Пора защищать.', 'Долбоор даяр. Коргоого убакыт.')
              : stepTitle(stats.current, data, lang)}
          </h2>
          <p>{pick(path.description, lang)}</p>
          <div className="path-progress" aria-label={bi('Прогресс маршрута', 'Маршруттун прогресси')}>
            <div style={{ width: `${stats.percent}%` }} />
          </div>
          <div className="path-hero-meta">
            <span>
              {stats.done} / {stats.total}{' '}
              {bi(pluralRu(stats.total, 'шаг', 'шага', 'шагов'), 'кадам')}
            </span>
            <span>
              {path.sections.length}{' '}
              {bi(pluralRu(path.sections.length, 'этап', 'этапа', 'этапов'), 'этап')}
            </span>
            <Badge tone={finished ? 'green' : 'violet'}>
              {finished ? bi('маршрут пройден', 'маршрут өтүлдү') : `${stats.percent}%`}
            </Badge>
          </div>
          <div className="hero-actions">
            <Link className="btn btn-primary" to={stats.current ? stepUrl(stats.current, path.slug) : '/exams'}>
              {finished
                ? bi('К экзаменам', 'Экзамендерге')
                : started
                  ? bi('Продолжить обучение', 'Окууну улантуу')
                  : bi('Начать обучение', 'Окууну баштоо')}
              <ArrowRight size={16} />
            </Link>
            <Link className="btn btn-ghost" to="/learn">
              {bi('Все модули', 'Бардык модулдар')}
            </Link>
          </div>
        </div>
        <div className="path-hero-score">
          <ProgressRing value={stats.percent} label={bi('маршрут', 'маршрут')} size={142} />
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-title">
          <div>
            <h2>{bi('Маршрут по шагам', 'Кадам-кадам маршрут')}</h2>
            <p>
              {bi(
                'Иди по порядку. После каждого шага появится кнопка «Продолжить».',
                'Ирети менен өт. Ар бир кадамдан кийин «Улантуу» баскычы пайда болот.',
              )}
            </p>
          </div>
        </div>

        <div className="path-section-list">
          {path.sections.map((section) => {
            const steps = sectionSteps(stats.steps, section.id)
            const done = steps.filter((step) => isDone(index, step.type, step.slug)).length
            const active = steps.some((step) => stepKey(step) === currentKey)
            return (
              <article className={`path-section ${active ? 'current' : ''}`} key={section.id}>
                <header className="path-section-head">
                  <div>
                    <h3>{pick(section.title, lang)}</h3>
                    <p>{pick(section.goal, lang)}</p>
                  </div>
                  <span className="path-section-progress">{done} / {steps.length}</span>
                </header>

                <div className="path-step-list">
                  {steps.map((step) => {
                    const complete = isDone(index, step.type, step.slug)
                    const current = stepKey(step) === currentKey
                    const task = step.type === 'task' ? data.tasks?.find((item) => item.slug === step.slug) : null
                    const tone = step.type === 'lesson' ? 'blue' : task?.type === 'code' ? 'violet' : 'cyan'
                    const label =
                      step.type === 'lesson'
                        ? bi('урок', 'сабак')
                        : task?.type === 'code'
                          ? bi('код', 'код')
                          : bi('теория', 'теория')
                    const Icon = step.type === 'lesson' ? BookOpen : Code2
                    return (
                      <Link
                        className={`path-step ${complete ? 'done' : ''} ${current ? 'current' : ''}`}
                        key={stepKey(step)}
                        to={stepUrl(step, path.slug)}
                      >
                        <span className="path-step-status">
                          {complete ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                        </span>
                        <span className="path-step-icon"><Icon size={15} /></span>
                        <span className="path-step-copy">
                          <strong>{stepTitle(step, data, lang)}</strong>
                          <span>{pick(step.note, lang)}</span>
                        </span>
                        {current && <Badge tone="cyan">{bi('сейчас', 'азыр')}</Badge>}
                        <Badge tone={tone}>{label}</Badge>
                        <ArrowRight className="path-step-arrow" size={16} />
                      </Link>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="path-note">
        <Compass size={20} />
        <div>
          <strong>{bi('Как это работает', 'Бул кантип иштейт')}</strong>
          <p>
            {bi(
              'Каждый шаг помечается автоматически: урок — после кнопки «Отметить пройденным», код — после зелёных тестов, теория — после сверки с моделью. Дальше открывается кнопка «Продолжить» со следующим шагом.',
              'Ар бир кадам автоматтык белгиленет: сабак — «Өтүлдү деп белгилөө» баскычынан кийин, код — жашыл тесттерден кийин, теория — модель менен салыштыргандан кийин. Андан кийин кийинки кадамга «Улантуу» баскычы ачылат.',
            )}
          </p>
        </div>
      </section>
    </div>
  )
}
