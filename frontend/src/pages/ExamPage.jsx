import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  RotateCcw,
  Send,
  Trophy,
  XCircle,
} from 'lucide-react'
import { api } from '../api'
import { useApp, useBi } from '../state/AppContext'
import { pick, pluralRu } from '../lib/format'
import { Badge, CodeEditor, Markdown, ProgressRing } from '../components/ui'

function formatTime(total) {
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function ExamPage() {
  const { slug } = useParams()
  const { refresh, lang } = useApp()
  const bi = useBi()
  const [exam, setExam] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    let active = true
    api
      .exam(slug)
      .then((payload) => {
        if (!active) return
        setExam(payload.exam)
        setAnswers({})
        setResult(null)
        setLoadError('')
        setSubmitError('')
        setRemaining(payload.exam.minutes * 60)
      })
      .catch((err) => active && setLoadError(err.message))
    return () => {
      active = false
    }
  }, [slug])

  useEffect(() => {
    if (!exam || result) return undefined
    const timer = window.setInterval(() => {
      setRemaining((value) => (value > 0 ? value - 1 : 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [exam, result])

  const answered = useMemo(
    () => exam ? exam.questions.filter((question) => answers[question.id]).length : 0,
    [answers, exam],
  )

  function setAnswer(id, value) {
    setAnswers((current) => ({ ...current, [id]: value }))
  }

  async function submit() {
    setSubmitting(true)
    setSubmitError('')
    try {
      const next = await api.submitExam(slug, answers)
      setResult(next)
      await refresh(true).catch(() => {})
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function retry() {
    setAnswers({})
    setResult(null)
    setRemaining(exam.minutes * 60)
  }

  if (loadError) return <div className="page"><p className="form-error">{loadError}</p></div>
  if (!exam) return <div className="page"><div className="skeleton tall" /></div>

  return (
    <div className="page exam-page">
      <Link className="back-link" to="/exams">
        <ArrowLeft size={16} /> {bi('К экзаменам', 'Экзамендерге')}
      </Link>

      <header className="exam-head">
        <div>
          <div className="eyebrow">{bi('Этап', 'Этап')} {exam.stage} · {exam.points} {bi('баллов', 'балл')}</div>
          <h1>{pick(exam.title, lang)}</h1>
          <p>{pick(exam.description, lang)}</p>
        </div>
        <div className="exam-clock">
          <Clock size={17} />
          <div>
            <span>{bi('Таймер', 'Таймер')}</span>
            <strong>{formatTime(remaining)}</strong>
          </div>
        </div>
      </header>

      {result && (
        <div className={`exam-result ${result.red ? 'red' : ''}`}>
          <ProgressRing value={result.percent} label={bi('результат', 'натыйжа')} size={132} />
          <div className="exam-result-copy">
            <div className="eyebrow">{result.red ? bi('Красный диплом', 'Кызыл диплом') : bi('Пока не красный', 'Азырынча кызыл эмес')}</div>
            <h2>{result.score} / {result.max_score}</h2>
            <p>
              {result.red
                ? bi('План работает. Закрепи слабые места на третьем этапе.', 'План иштейт. Алсыз жерлерди үчүнчү этапта бекемде.')
                : bi('Разбери ошибки ниже и вернись через день.', 'Төмөнкү каталарды талдап, бир күндөн кийин кайра кел.')}
            </p>
            <div className="exam-result-actions">
              <button className="btn btn-ghost" onClick={retry}><RotateCcw size={15} /> {bi('Пройти заново', 'Кайра өтүү')}</button>
              <Link className="btn btn-primary" to="/mistakes">{bi('Разобрать ошибки', 'Каталарды талдоо')}</Link>
            </div>
          </div>
        </div>
      )}

      <div className="exam-layout">
        <div className="exam-questions">
          {exam.questions.map((question, questionIndex) => {
            const answer = answers[question.id]
            const feedback = result?.results?.find((item) => item.id === question.id)
            return (
              <section className="exam-question" key={question.id}>
                <div className="question-head">
                  <span className="question-number">{String(questionIndex + 1).padStart(2, '0')}</span>
                  <div>
                    <div className="question-meta">
                      <Badge tone={question.type === 'code' ? 'red' : 'neutral'}>
                        {question.type === 'code' ? 'code' : 'quiz'}
                      </Badge>
                      <span>{question.points} {bi(pluralRu(question.points, 'балл', 'балла', 'баллов'), 'балл')}</span>
                    </div>
                    <h3>{pick(question.prompt, lang)}</h3>
                  </div>
                  {feedback && (
                    <span className={`answer-mark ${feedback.correct ? 'ok' : 'bad'}`}>
                      {feedback.correct ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    </span>
                  )}
                </div>

                {question.type === 'quiz' ? (
                  <div className="option-list">
                    {question.options.map((option) => {
                      const selected = answer === option.id
                      const isCorrect = feedback?.correct_answer === option.id
                      return (
                        <button
                          key={option.id}
                          className={`option ${selected ? 'selected' : ''} ${feedback ? (isCorrect ? 'correct' : 'muted') : ''}`}
                          onClick={() => !result && setAnswer(question.id, option.id)}
                          disabled={Boolean(result)}
                        >
                          <span className="option-letter">{option.id}</span>
                          <span>{pick(option.text, lang)}</span>
                          {isCorrect && <CheckCircle2 size={17} />}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="exam-code">
                    <CodeEditor
                      value={answer ?? question.starter_code ?? ''}
                      onChange={(value) => setAnswer(question.id, value)}
                      height="260px"
                      readOnly={Boolean(result)}
                    />
                    {feedback?.run && (
                      <div className={`test-panel compact ${feedback.correct ? 'pass' : 'fail'}`}>
                        <div className="test-panel-head">
                          <strong>{feedback.correct ? bi('Тесты прошли', 'Тесттер өттү') : bi('Тесты не прошли', 'Тесттер өтпөдү')}</strong>
                          <span>{feedback.earned}/{feedback.max}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {feedback?.explanation && (
                  <details className="answer-review">
                    <summary>{bi('Разбор', 'Талдоо')}</summary>
                    <Markdown>{pick(feedback.explanation, lang)}</Markdown>
                  </details>
                )}
                {feedback?.type === 'code' && feedback.solution && (
                  <details className="answer-review">
                    <summary>{bi('Эталонное решение', 'Эталондук чечим')}</summary>
                    <CodeEditor value={feedback.solution} readOnly height="220px" />
                  </details>
                )}
              </section>
            )
          })}
        </div>

        <aside className="exam-aside">
          <div className="exam-aside-card">
            <div className="eyebrow">{bi('Прогресс', 'Прогресс')}</div>
            <strong>{answered} / {exam.questions.length}</strong>
            <div className="exam-dots">
              {exam.questions.map((question, index) => (
                <span key={question.id} className={answers[question.id] ? 'filled' : ''}>
                  {index + 1}
                </span>
              ))}
            </div>
            {!result ? (
              <>
                {submitError && <p className="form-error">{submitError}</p>}
                <button className="btn btn-primary full" onClick={submit} disabled={submitting}>
                  <Send size={16} /> {submitting ? bi('Проверяем…', 'Текшерип жатабыз…') : bi('Сдать экзамен', 'Экзаменди тапшыруу')}
                </button>
              </>
            ) : (
              <div className="exam-submitted">
                <Trophy size={18} /> {bi('Попытка сохранена', 'Аракет сакталды')}
              </div>
            )}
            <p className="aside-fineprint">
              {bi(
                'Можно отвечать в любом порядке. Код проверяется тестами на сервере.',
                'Каалаган тартипте жооп берсе болот. Код серверде тесттер менен текшерилет.',
              )}
            </p>
          </div>
          <div className="aside-note">
            <strong>{bi('Совет', 'Кеңеш')}</strong>
            <p>{bi('Сначала забери короткие вопросы, потом код. Не оставляй пустых ответов.', 'Адегенде кыска суроолорду ал, анан код. Бош жооп калтырба.')}</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
