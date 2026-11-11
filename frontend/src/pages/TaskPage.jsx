import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Code2,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Play,
  RotateCcw,
  Route,
  Sparkles,
  Terminal,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { api } from '../api'
import { useApp, useBi } from '../state/AppContext'
import { isDone, pick, pluralRu, progressIndex } from '../lib/format'
import { pathContext } from '../lib/path'
import PathNext from '../components/PathNext'
import { Badge, CodeEditor, HintList, Markdown } from '../components/ui'

function value(value) {
  if (value === undefined) return '—'
  if (value === null) return 'None'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function stepText(text) {
  return String(text || '').replace(/^\s*\d+[.)]\s*/, '')
}

function TaskTutorial({ task }) {
  const { lang } = useApp()
  const bi = useBi()
  if (task.type !== 'code') return null

  const examples = task.examples || []
  const plan = task.walkthrough?.length ? task.walkthrough : task.hints || []
  if (!examples.length && !plan.length && !task.explanation && !task.pitfalls) return null

  return (
    <section className="task-tutorial">
      <div className="tutorial-head">
        <div>
          <div className="eyebrow"><BookOpen size={15} /> {bi('Разбор перед практикой', 'Практикага чейин талдоо')}</div>
          <h2>{bi('Сначала пойми, потом пиши', 'Адегенде түшүн, анан жаз')}</h2>
          <p>
            {bi(
              'Прочитай примеры и план. Код напиши сам — готовый пример можно открыть ниже, если застрял.',
              'Мисалдарды жана планды оку. Кодду өзүң жаз — кыстыгып калсаң, даяр мисалды төмөнөн ачсаң болот.',
            )}
          </p>
        </div>
        <Badge tone="cyan">{bi('учимся', 'үйрөнөбүз')}</Badge>
      </div>

      <div className="tutorial-grid">
        {examples.length > 0 && (
          <div className="note-block">
            <div className="note-title"><Terminal size={16} /> {bi('Примеры', 'Мисалдар')}</div>
            <div className="example-list">
              {examples.map((example, index) => (
                <div className="example-row" key={`${example.input}-${index}`}>
                  <code>{example.input}</code>
                  <span className="example-arrow">→</span>
                  <code>{value(example.expected)}</code>
                </div>
              ))}
            </div>
          </div>
        )}

        {task.explanation && (
          <div className="note-block">
            <div className="note-title"><Lightbulb size={16} /> {bi('Идея', 'Идея')}</div>
            <p>{pick(task.explanation, lang)}</p>
          </div>
        )}

        {plan.length > 0 && (
          <div className="note-block tutorial-wide">
            <div className="note-title"><ListChecks size={16} /> {bi('План по шагам', 'Кадам-кадам план')}</div>
            <ol>
              {plan.map((step, index) => (
                <li key={index}>{stepText(pick(step, lang))}</li>
              ))}
            </ol>
          </div>
        )}

        {task.pitfalls && (
          <div className="note-block note-warn tutorial-wide">
            <div className="note-title"><TriangleAlert size={16} /> {bi('Типичная ошибка', 'Типтүү ката')}</div>
            <p>{pick(task.pitfalls, lang)}</p>
          </div>
        )}

        {task.exam_tip && (
          <div className="note-block note-tip tutorial-wide">
            <div className="note-title"><GraduationCap size={16} /> {bi('На экзамене', 'Экзаменде')}</div>
            <p>{pick(task.exam_tip, lang)}</p>
          </div>
        )}
      </div>
    </section>
  )
}

function StudyNotes({ task }) {
  const { lang } = useApp()
  const bi = useBi()
  const hasNotes = task.walkthrough?.length || task.pitfalls || task.exam_tip
  if (!hasNotes) return null

  return (
    <section className="study-notes">
      {task.walkthrough?.length > 0 && (
        <div className="note-block">
          <div className="note-title"><Route size={16} /> {bi('Разбор по шагам', 'Кадамдап талдоо')}</div>
          <ol>
            {task.walkthrough.map((step, index) => (
              <li key={index}>{stepText(pick(step, lang))}</li>
            ))}
          </ol>
        </div>
      )}
      {task.pitfalls && (
        <div className="note-block note-warn">
          <div className="note-title"><TriangleAlert size={16} /> {bi('Типичная ошибка', 'Типтүү ката')}</div>
          <p>{pick(task.pitfalls, lang)}</p>
        </div>
      )}
      {task.exam_tip && (
        <div className="note-block note-tip">
          <div className="note-title"><GraduationCap size={16} /> {bi('На экзамене', 'Экзаменде')}</div>
          <p>{pick(task.exam_tip, lang)}</p>
        </div>
      )}
    </section>
  )
}

export default function TaskPage() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const { data, refresh, lang } = useApp()
  const bi = useBi()
  const [task, setTask] = useState(null)
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [solution, setSolution] = useState(null)
  const [showSolution, setShowSolution] = useState(false)
  const [theoryAnswer, setTheoryAnswer] = useState('')
  const [showModel, setShowModel] = useState(false)
  const [running, setRunning] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [runError, setRunError] = useState('')
  const index = progressIndex(data?.progress)
  const done = isDone(index, 'task', slug)
  const pathInfo = pathContext(data, params, 'task', slug)
  const module = useMemo(
    () => data?.modules.find((item) => item.slug === task?.module),
    [data?.modules, task?.module],
  )

  useEffect(() => {
    let active = true
    setTask(null)
    setResult(null)
    setSolution(null)
    setShowSolution(false)
    setShowModel(false)
    setLoadError('')
    setRunError('')
    api
      .task(slug)
      .then((payload) => {
        if (!active) return
        setTask(payload.task)
        setCode(payload.task.starter_code || '')
      })
      .catch((err) => active && setLoadError(err.message))
    return () => {
      active = false
    }
  }, [slug])

  async function run() {
    setRunning(true)
    setRunError('')
    try {
      const next = await api.runTask(slug, code)
      setResult(next)
      await refresh(true).catch(() => {})
    } catch (err) {
      setRunError(err.message)
    } finally {
      setRunning(false)
    }
  }

  async function revealSolution() {
    try {
      if (!solution) {
        const next = await api.solution(slug)
        setSolution(next)
      }
      setShowSolution(true)
    } catch (err) {
      setRunError(err.message)
    }
  }

  async function complete(confidence) {
    await api.completeTask(slug, confidence)
    await refresh(true)
  }

  if (loadError) return <div className="page"><p className="form-error">{loadError}</p></div>
  if (!task) return <div className="page"><div className="skeleton tall" /></div>

  const isCode = task.type === 'code'
  const selfQuestions = task.subquestions?.length
    ? task.subquestions
    : isCode
      ? [
          { ru: 'Что подаётся на вход и что нужно вернуть?', kg: 'Кирүүгө эмне берилет жана эмнени кайтаруу керек?' },
          { ru: 'Какой крайний случай может сломать решение?', kg: 'Кайсы четки учур чечимди бузушу мүмкүн?' },
          { ru: 'Почему твой алгоритм работает за ожидаемое время?', kg: 'Эмне үчүн алгоритмиң күтүлгөн убакытта иштейт?' },
        ]
      : [
          { ru: 'Можешь дать определение одним предложением?', kg: 'Бир сүйлөм менен аныктама бере аласыңбы?' },
          { ru: 'Где это применяется на практике?', kg: 'Бул практикада кайда колдонулат?' },
          { ru: 'Какое ограничение или типичная ошибка здесь есть?', kg: 'Бул жерде кандай чектөө же типтүү ката бар?' },
        ]

  return (
    <div className="page task-page">
      <Link className="back-link" to={pathInfo ? '/start' : '/practice'}>
        <ArrowLeft size={16} /> {pathInfo ? bi('К маршруту', 'Маршрутка') : bi('К практике', 'Практикага')}
      </Link>

      {pathInfo && (
        <div className="path-banner">
          <Route size={15} />
          <strong>{pick(pathInfo.path.title, lang)}</strong>
          <span>{bi('Шаг', 'Кадам')} {pathInfo.index + 1} / {pathInfo.steps.length}</span>
          <Link to="/start">{bi('Весь маршрут', 'Бүт маршрут')}</Link>
        </div>
      )}

      <header className="task-head">
        <div>
          <div className="task-head-meta">
            <Badge tone={isCode ? 'violet' : 'cyan'}>{isCode ? 'code' : 'theory'}</Badge>
            <span>{pick(module?.title, lang)}</span>
            <span><Clock size={14} /> {task.difficulty * 5} {bi('мин', 'мүн')}</span>
          </div>
          <h1>{pick(task.title, lang)}</h1>
          <p>{pick(task.prompt, lang)}</p>
        </div>
        <div className={`task-score ${done ? 'done' : ''}`}>
          {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          <strong>{task.points}</strong>
          <span>{bi(pluralRu(task.points, 'балл', 'балла', 'баллов'), 'балл')}</span>
        </div>
      </header>

      {done && pathInfo && <PathNext pathInfo={pathInfo} />}

      {!task.practice_only && <TaskTutorial task={task} />}

      <div className="task-layout">
        <div className="task-main">
          {isCode ? (
            <>
              <div className="editor-top">
                <div className="editor-label"><Code2 size={15} /> solution.py</div>
                <button className="text-button" onClick={() => setCode(task.starter_code || '')}>
                  <RotateCcw size={14} /> {bi('Сбросить', 'Кайтаруу')}
                </button>
              </div>
              <CodeEditor value={code} onChange={setCode} height="360px" />
              <div className="run-bar">
                <button className="btn btn-primary" onClick={run} disabled={running}>
                  <Play size={16} />
                  {running ? bi('Проверяем…', 'Текшерип жатабыз…') : bi('Запустить тесты', 'Тесттерди иштетүү')}
                </button>
                <span>{bi('Сервер выполнит код в отдельном процессе.', 'Сервер кодду өзүнчө процессте иштетет.')}</span>
              </div>
              {runError && <p className="form-error">{runError}</p>}

              {result && (
                <div className={`test-panel ${result.passed ? 'pass' : 'fail'}`}>
                  <div className="test-panel-head">
                    <div>
                      {result.passed ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                      <strong>
                        {result.passed
                          ? bi('Все тесты прошли', 'Бардык тесттер өттү')
                          : bi('Есть падающие тесты', 'Кулап жаткан тесттер бар')}
                      </strong>
                    </div>
                    <span>{result.score}/{result.max_score}</span>
                  </div>
                  <div className="test-cases">
                    {result.results.map((item, index) => (
                      <div className={`test-case ${item.ok ? 'ok' : 'bad'}`} key={`${item.input}-${index}`}>
                        <span>{item.ok ? 'PASS' : 'FAIL'}</span>
                        <code>{item.input}</code>
                        {!item.ok && (
                          <div className="test-case-detail">
                            <small>expected: {value(item.expected)}</small>
                            <small>actual: {value(item.error || item.actual)}</small>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {result.stderr && <pre className="runner-error">{result.stderr}</pre>}
                  {result.passed && result.explanation && (
                    <Markdown>{pick(result.explanation, lang)}</Markdown>
                  )}
                </div>
              )}

              <div className="solution-block">
                {!showSolution ? (
                  <button className="btn btn-ghost" onClick={revealSolution}>
                    <Sparkles size={16} /> {bi('Показать решение', 'Чечимди көрсөтүү')}
                  </button>
                ) : (
                  <>
                    <div className="section-title small">
                      <h2>{bi('Разбор решения', 'Чечимдин талдоосу')}</h2>
                      <button className="text-button" onClick={() => setShowSolution(false)}>
                        {bi('Скрыть', 'Жашуу')}
                      </button>
                    </div>
                    <CodeEditor value={solution?.solution || ''} readOnly height="240px" />
                    {solution?.explanation && <Markdown>{pick(solution.explanation, lang)}</Markdown>}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="theory-panel">
              <label className="field">
                <span>{bi('Твой ответ — сначала своими словами', 'Жообуң — адегенде өз сөзүң менен')}</span>
                <textarea
                  rows={9}
                  value={theoryAnswer}
                  onChange={(event) => setTheoryAnswer(event.target.value)}
                  placeholder={bi('Определение → зачем → пример → ограничение', 'Аныктама → эмне үчүн → мисал → чек')}
                />
              </label>
              <div className="theory-actions">
                <button className="btn btn-primary" onClick={() => setShowModel(true)}>
                  <Lightbulb size={16} /> {bi('Сверить с моделью', 'Модель менен салыштыруу')}
                </button>
                {done && <Badge tone="green"><CheckCircle2 size={14} /> {bi('уже отмечено', 'белгиленген')}</Badge>}
              </div>

              {showModel && (
                <div className="model-answer">
                  <div className="eyebrow">{bi('Модельный ответ', 'Моделдик жооп')}</div>
                  <Markdown>{pick(task.model_answer, lang)}</Markdown>
                  <StudyNotes task={task} />
                  <div className="self-rate">
                    <span>{bi('Насколько уверенно?', 'Канчалык ишенимдүү?')}</span>
                    <button onClick={() => complete('again')}>{bi('Ещё раз', 'Кайра')}</button>
                    <button onClick={() => complete('hard')}>{bi('Сложно', 'Кыйын')}</button>
                    <button onClick={() => complete('good')}>{bi('Норм', 'Жакшы')}</button>
                    <button onClick={() => complete('easy')}>{bi('Легко', 'Жеңил')}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="task-aside">
          <div className="subquestions">
            <div className="subquestions-head">
              <HelpCircle size={16} />
              <span>{bi('Проверь себя', 'Өзүңдү текшер')}</span>
            </div>
            <ol>
              {selfQuestions.map((question, index) => (
                <li key={index}>{pick(question, lang)}</li>
              ))}
            </ol>
            <small>{bi('Ответь вслух до просмотра решения.', 'Чечимди көрүүдөн мурун үн менен жооп бер.')}</small>
          </div>
          <HintList hints={task.hints || []} />
          <div className="aside-note">
            <strong>{isCode ? bi('Как решать', 'Кантип чечүү керек') : bi('Как отвечать', 'Кантип жооп берүү керек')}</strong>
            <p>
              {isCode
                ? bi(
                    'Сначала напиши решение, затем запусти тесты. Если упало — смотри expected и actual, а не угадывай.',
                    'Адегенде чечимди жаз, анан тесттерди иштет. Куласа — expected жана actualды кара, божомолдобо.',
                  )
                : bi(
                    'Назови определение, затем применение и ограничение. Этого достаточно для сильного ответа.',
                    'Аныктаманы ата, анан колдонуу жана чектөө. Бул күчтүү жоопко жетет.',
                  )}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
