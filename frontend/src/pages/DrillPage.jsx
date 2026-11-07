import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  ListChecks,
  RotateCcw,
  Send,
  Target,
  Trophy,
  XCircle,
} from 'lucide-react'
import { api } from '../api'
import { useApp, useBi } from '../state/AppContext'
import { pick, pluralRu } from '../lib/format'
import { Badge, InlineMarkdown, Markdown, ProgressRing } from '../components/ui'

export default function DrillPage() {
  const { slug } = useParams()
  const { data, refresh, lang } = useApp()
  const bi = useBi()
  const [drill, setDrill] = useState(null)
  const [mode, setMode] = useState('study')
  const [answers, setAnswers] = useState({})
  const [feedback, setFeedback] = useState({})
  const [result, setResult] = useState(null)
  const [checking, setChecking] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let active = true
    api
      .drill(slug)
      .then((payload) => {
        if (!active) return
        setDrill(payload.drill)
        setAnswers({})
        setFeedback({})
        setResult(null)
        setMode('study')
        setLoadError('')
        setActionError('')
      })
      .catch((err) => active && setLoadError(err.message))
    return () => {
      active = false
    }
  }, [slug])

  const questions = drill?.questions || []
  const summary = (data.drills || []).find((item) => item.slug === slug)
  const answered = useMemo(
    () => questions.filter((question) => answers[question.id]).length,
    [answers, questions],
  )
  const checked = useMemo(
    () => questions.filter((question) => feedback[question.id]).length,
    [feedback, questions],
  )
  const correctCount = useMemo(
    () => Object.values(feedback).filter((item) => item.correct).length,
    [feedback],
  )
  const allAnswered = questions.length > 0 && answered === questions.length

  function resetAttempt() {
    setAnswers({})
    setFeedback({})
    setResult(null)
    setActionError('')
  }

  function switchMode(next) {
    if (next === mode) return
    setMode(next)
    resetAttempt()
  }

  function choose(questionId, option) {
    if (feedback[questionId] || result) return
    setAnswers((current) => ({ ...current, [questionId]: option }))
  }

  async function check(question) {
    const option = answers[question.id]
    if (!option || checking) return
    setChecking(question.id)
    setActionError('')
    try {
      const next = await api.checkDrill(slug, question.id, option)
      setFeedback((current) => ({ ...current, [question.id]: next }))
    } catch (err) {
      setActionError(err.message)
    } finally {
      setChecking('')
    }
  }

  async function submit() {
    setSubmitting(true)
    setActionError('')
    try {
      const next = await api.submitDrill(slug, answers)
      setResult(next)
      const byId = Object.fromEntries((next.results || []).map((item) => [item.id, item]))
      setFeedback((current) => ({ ...current, ...byId }))
      await refresh(true).catch(() => {})
    } catch (err) {
      setActionError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) return <div className="page"><p className="form-error">{loadError}</p></div>
  if (!drill) return <div className="page"><div className="skeleton tall" /></div>

  const bestPercent = result?.best_percent ?? summary?.best_percent ?? 0
  const attempts = result?.attempts ?? summary?.attempts ?? 0

  return (
    <div className="page exam-page drill-page">
      <Link className="back-link" to="/drills">
        <ArrowLeft size={16} /> {bi('К тренажёру', 'Тренажёрго')}
      </Link>

      <header className="exam-head drill-head">
        <div>
          <div className="eyebrow">
            {bi('Тренажёр', 'Тренажёр')} · {String(drill.order || 0).padStart(2, '0')}
          </div>
          <h1>{pick(drill.title, lang)}</h1>
          <p>{pick(drill.description, lang)}</p>
          <div className="drill-head-meta">
            <Badge tone="neutral">
              <Target size={12} /> {drill.questions.length} {bi(pluralRu(drill.questions.length, 'вопрос', 'вопроса', 'вопросов'), 'суроо')}
            </Badge>
            <Badge tone="neutral">
              <Clock size={12} /> {drill.minutes} {bi('мин', 'мүн')}
            </Badge>
            <Badge tone={bestPercent >= 80 ? 'green' : 'neutral'}>
              <Trophy size={12} /> {bi('лучший', 'эң жакшы')} {bestPercent}%
            </Badge>
          </div>
        </div>

        <div className="drill-mode" role="group" aria-label={bi('Режим тренажёра', 'Тренажёр режими')}>
          <button
            className={mode === 'study' ? 'active' : ''}
            aria-pressed={mode === 'study'}
            onClick={() => switchMode('study')}
          >
            <Eye size={15} /> {bi('С подсказками', 'Подсказкалар менен')}
          </button>
          <button
            className={mode === 'exam' ? 'active' : ''}
            aria-pressed={mode === 'exam'}
            onClick={() => switchMode('exam')}
          >
            <EyeOff size={15} /> {bi('Без подсказок', 'Подсказкасыз')}
          </button>
        </div>
      </header>

      <p className="drill-mode-note">
        {mode === 'study' ? (
          <>
            <Eye size={15} />
            {bi(
              'Проверяй каждый вопрос отдельно: сразу увидишь разбор и пример. Результат сохраняется после ответа на все вопросы.',
              'Ар бир суроону өзүнчө текшер: талдоо жана мисал дароо көрүнөт. Натыйжа бардык суроолорго жооп бергенден кийин сакталат.',
            )}
          </>
        ) : (
          <>
            <EyeOff size={15} />
            {bi(
              'Ответы и разборы скрыты до сдачи. Можно отвечать в любом порядке — проверь себя без подсказок.',
              'Жооптор жана талдоолор тапшырганга чейин жашыруун. Каалаган тартипте жооп бер — өзүңдү подсказкасыз текшер.',
            )}
          </>
        )}
      </p>

      {result && (
        <div className={`exam-result ${result.percent >= 80 ? 'red' : ''}`}>
          <ProgressRing value={result.percent} label={bi('результат', 'натыйжа')} size={132} />
          <div className="exam-result-copy">
            <div className="eyebrow">
              {result.percent >= 80
                ? bi('Сильный результат', 'Күчтүү натыйжа')
                : bi('Есть что подтянуть', 'Бекемдей турган жер бар')}
            </div>
            <h2>{result.score} / {result.max_score}</h2>
            <p>
              {bi(
                `Лучший результат: ${result.best_percent}%. Попыток: ${result.attempts}. Разбор всех вопросов ниже.`,
                `Эң жакшы натыйжа: ${result.best_percent}%. Аракеттер: ${result.attempts}. Бардык суроолордун талдоосу төмөндө.`,
              )}
            </p>
            <div className="exam-result-actions">
              <button className="btn btn-ghost" onClick={resetAttempt}>
                <RotateCcw size={15} /> {bi('Пройти заново', 'Кайра өтүү')}
              </button>
              <Link className="btn btn-ghost" to="/drills">
                {bi('К тренажёру', 'Тренажёрго')}
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="drill-layout">
        <div className="drill-questions">
          {questions.map((question, questionIndex) => {
            const selected = answers[question.id]
            const item = feedback[question.id]
            return (
              <section
                className={`exam-question drill-question ${item ? (item.correct ? 'ok' : 'bad') : ''}`}
                key={question.id}
              >
                <div className="question-head">
                  <span className="question-number">{String(questionIndex + 1).padStart(2, '0')}</span>
                  <div>
                    <div className="question-meta">
                      <Badge tone="neutral">{bi('один ответ', 'бир жооп')}</Badge>
                      <span>{mode === 'study' ? bi('с разбором', 'талдоо менен') : bi('без подсказок', 'подсказкасыз')}</span>
                    </div>
                    <div className="drill-prompt">
                      <Markdown>{pick(question.prompt, lang)}</Markdown>
                    </div>
                  </div>
                  {item && (
                    <span className={`answer-mark ${item.correct ? 'ok' : 'bad'}`}>
                      {item.correct ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    </span>
                  )}
                </div>

                {question.code && (
                  <pre className="drill-snippet">
                    <code>{question.code}</code>
                  </pre>
                )}

                <div className="option-list drill-options">
                  {question.options.map((option) => {
                    const isSelected = selected === option.id
                    const isCorrect = item?.correct_answer === option.id
                    const isWrongPick = Boolean(item) && isSelected && !item.correct
                    return (
                      <button
                        key={option.id}
                        className={`option ${isSelected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrongPick ? 'wrong' : ''} ${item && !isCorrect && !isWrongPick ? 'muted' : ''}`}
                        onClick={() => choose(question.id, option.id)}
                        disabled={Boolean(item) || Boolean(result)}
                      >
                        <span className="option-letter">{option.id}</span>
                        <span>
                          <InlineMarkdown>{pick(option.text, lang)}</InlineMarkdown>
                        </span>
                        {isCorrect && <CheckCircle2 size={17} />}
                        {isWrongPick && <XCircle size={17} />}
                      </button>
                    )
                  })}
                </div>

                {mode === 'study' && !item && (
                  <div className="drill-check-row">
                    <button
                      className="btn btn-ghost"
                      onClick={() => check(question)}
                      disabled={!selected || checking === question.id}
                    >
                      {checking === question.id
                        ? bi('Проверяем…', 'Текшерип жатабыз…')
                        : bi('Проверить', 'Текшерүү')}
                    </button>
                    <span>
                      {selected
                        ? bi('Ответ выбран — можно проверять.', 'Жооп тандалды — текшерсең болот.')
                        : bi('Сначала выбери вариант.', 'Адегенде вариант танда.')}
                    </span>
                  </div>
                )}

                {item && (
                  <div className={`drill-feedback ${item.correct ? 'ok' : 'bad'}`}>
                    <div className="drill-feedback-head">
                      {item.correct ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                      <strong>{item.correct ? bi('Верно', 'Туура') : bi('Неверно', 'Туура эмес')}</strong>
                      {!item.correct && (
                        <span>
                          {bi('Правильный ответ:', 'Туура жооп:')} <b>{item.correct_answer}</b>
                        </span>
                      )}
                    </div>
                    {item.explanation && <Markdown>{pick(item.explanation, lang)}</Markdown>}
                    {item.example && (
                      <details className="answer-review drill-example">
                        <summary>{bi('Пример и код', 'Мисал жана код')}</summary>
                        <Markdown>{item.example}</Markdown>
                      </details>
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>

        <aside className="exam-aside drill-aside">
          <div className="exam-aside-card">
            <div className="eyebrow">
              {mode === 'study' ? bi('Режим тренировки', 'Машыгуу режими') : bi('Режим экзамена', 'Экзамен режими')}
            </div>
            <strong>
              {mode === 'study' ? checked : answered} / {questions.length}
            </strong>
            <div className="exam-dots">
              {questions.map((question, index) => {
                const item = feedback[question.id]
                return (
                  <span
                    key={question.id}
                    className={`${answers[question.id] ? 'filled' : ''} ${item ? (item.correct ? 'filled ok' : 'filled bad') : ''}`}
                  >
                    {index + 1}
                  </span>
                )
              })}
            </div>

            <div className="drill-aside-best">
              <span>{bi('Лучший результат', 'Эң жакшы натыйжа')}</span>
              <strong>{bestPercent}%</strong>
            </div>
            <div className="drill-aside-best">
              <span>{bi('Попыток', 'Аракеттер')}</span>
              <strong>{attempts}</strong>
            </div>

            {!result && (
              <>
                {mode === 'study' ? (
                  <button
                    className="btn btn-primary full"
                    onClick={submit}
                    disabled={submitting || !allAnswered}
                  >
                    <Send size={16} />
                    {submitting
                      ? bi('Проверяем…', 'Текшерип жатабыз…')
                      : bi('Сохранить результат', 'Натыйжаны сактоо')}
                  </button>
                ) : (
                  <button className="btn btn-primary full" onClick={submit} disabled={submitting}>
                    <Send size={16} />
                    {submitting
                      ? bi('Проверяем…', 'Текшерип жатабыз…')
                      : bi('Сдать без подсказок', 'Подсказкасыз тапшыруу')}
                  </button>
                )}
                <p className="aside-fineprint">
                  {mode === 'study'
                    ? allAnswered
                      ? bi(
                          'Все вопросы отвечены. Сохранение запишет попытку и лучший процент.',
                          'Бардык суроолорго жооп берилди. Сактоо аракетти жана эң жакшы пайызды жазат.',
                        )
                      : bi(
                          'Чтобы сохранить результат, ответь на все вопросы.',
                          'Натыйжаны сактоо үчүн бардык суроолорго жооп бер.',
                        )
                    : bi(
                        'Разбор откроется только после сдачи. Пустой ответ считается ошибкой.',
                        'Талдоо тапшыргандан кийин гана ачылат. Бош жооп ката катары эсептелет.',
                      )}
                </p>
              </>
            )}

            {result && (
              <div className="drill-aside-result">
                <div>
                  <span>{bi('Результат', 'Натыйжа')}</span>
                  <strong>{result.percent}%</strong>
                </div>
                <div>
                  <span>{bi('Верных', 'Туура')}</span>
                  <strong>{result.score} / {result.max_score}</strong>
                </div>
                <div>
                  <span>{bi('Лучший', 'Эң жакшы')}</span>
                  <strong>{result.best_percent}%</strong>
                </div>
              </div>
            )}

            {actionError && <p className="form-error">{actionError}</p>}
          </div>

          <div className="aside-note">
            <strong>{mode === 'study' ? bi('Как учиться', 'Кантип окуу') : bi('Совет', 'Кеңеш')}</strong>
            <p>
              {mode === 'study'
                ? bi(
                    'Сначала ответь сам, потом открывай разбор. Если ошибся — прочитай пример и вернись к вопросу через день.',
                    'Адегенде өзүң жооп бер, анан талдоону ач. Ката кетсе — мисалды окуп, бир күндөн кийин суроого кайра кел.',
                  )
                : bi(
                    'Не оставляй пустых ответов: даже догадка лучше пропуска. После сдачи разбери каждый промах.',
                    'Бош жооп калтырба: болжол дагы өткөрүүдөн жакшы. Тапшыргандан кийин ар бир катаны талда.',
                  )}
            </p>
          </div>

          {summary && (
            <div className="aside-note drill-aside-note">
              <ListChecks size={15} />
              <p>
                {bi(
                  `${summary.question_count} вопросов · ${summary.minutes} минут · ${summary.attempts || 0} попыток`,
                  `${summary.question_count} суроо · ${summary.minutes} мүнөт · ${summary.attempts || 0} аракет`,
                )}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
