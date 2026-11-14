import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  AudioLines,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cpu,
  Ear,
  GraduationCap,
  Languages,
  ListChecks,
  Mic,
  MicOff,
  Orbit,
  Power,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useJarvis } from '../../state/JarvisContext'
import { Markdown } from '../ui'
import { pick } from '../../lib/format'
import { pathSteps, stepKey, stepTitle, stepUrl } from '../../lib/path'
import JarvisOrb from './JarvisOrb'
import { playBootSequence } from './voice'

const STATE_LABELS = {
  boot: ['ИНИЦИАЛИЗАЦИЯ ЯДРА', 'ЯДРОНУ ИШКЕ КИРГИЗҮҮ'],
  idle: ['ЯДРО В СЕТИ', 'ЯДРО ТАРМАКТА'],
  thinking: ['ОБРАБОТКА ЗАПРОСА', 'СУРАМ ИШТЕТҮҮДӨ'],
  speaking: ['ГОЛОСОВОЙ КАНАЛ', 'ҮН КАНАЛЫ'],
  listening: ['СЛУШАЮ ВАС', 'УГУП ЖАТАМ'],
}

const QUICK = [
  { ru: 'Статус', kg: 'Абал', message: 'статус' },
  { ru: 'Что дальше', kg: 'Кийинки', message: 'что дальше' },
  { ru: 'Разбери задачу', kg: 'Тапшырманы талда', message: 'объясни задачу' },
  { ru: 'Подсказка', kg: 'Подсказка', message: 'подсказка' },
  { ru: 'Проверь код', kg: 'Кодду текшер', message: 'проверь код' },
  { ru: 'Экзамен', kg: 'Экзамен', message: 'экзамен' },
  { ru: 'Кто ты', kg: 'Кимсиң', message: 'кто ты' },
  { ru: 'Кыргызча', kg: 'Кыргызча', message: 'кыргызча' },
]

function progressSet(data) {
  return new Set(
    (data?.progress || [])
      .filter((item) => item.status === 'done')
      .map((item) => `${item.item_type}:${item.item_id}`),
  )
}

function useNextStep(data, lang) {
  return useMemo(() => {
    if (!data) return null
    const done = progressSet(data)
    for (const path of data.paths || []) {
      const steps = pathSteps(path)
      const index = steps.findIndex((step) => !done.has(stepKey(step)))
      if (index < 0) continue
      const step = steps[index]
      return {
        path,
        step,
        index,
        total: steps.length,
        title: stepTitle(step, data, lang),
        url: stepUrl(step, path.slug),
      }
    }
    return null
  }, [data, lang])
}

function formatClock(date, lang) {
  const time = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
  const day = new Intl.DateTimeFormat(lang === 'kg' ? 'ky-KG' : 'ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
  return { time, day }
}

function RailRow({ icon: Icon, label, value, tone = '' }) {
  return (
    <div className={`jarvis-rail-row ${tone}`}>
      <span className="jarvis-rail-icon"><Icon size={14} /></span>
      <span className="jarvis-rail-label">{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Message({ message, lang, onAction, onSpeak, studentName }) {
  const assistant = message.role === 'assistant'
  const time = useMemo(
    () =>
      new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(
        message.time instanceof Date ? message.time : new Date(),
      ),
    [message.time],
  )

  return (
    <article className={`jarvis-msg ${assistant ? 'assistant' : 'user'} ${message.error ? 'error' : ''}`}>
      {assistant && <div className="jarvis-avatar">J</div>}
      <div className="jarvis-bubble">
        <header className="jarvis-bubble-head">
          <span>{assistant ? 'J.A.R.V.I.S.' : studentName}</span>
          <time>{time}</time>
        </header>
        {assistant ? <Markdown>{message.content}</Markdown> : <p>{message.content}</p>}
        <footer className="jarvis-bubble-foot">
          {message.action?.to && (
            <button className="jarvis-action" onClick={() => onAction(message.action)}>
              {message.action.label} <ArrowRight size={13} />
            </button>
          )}
          {assistant && !message.error && (
            <button
              className="jarvis-replay"
              onClick={() => onSpeak(message.content, lang)}
              title={lang === 'kg' ? 'Үн менен окуу' : 'Озвучить'}
            >
              <Volume2 size={13} />
            </button>
          )}
          {message.source === 'claude' && <span className="jarvis-source">claude haiku 4.5</span>}
          {message.source === 'ollama' && <span className="jarvis-source">ollama</span>}
          {message.source === 'local' && assistant && <span className="jarvis-source">local core</span>}
        </footer>
      </div>
    </article>
  )
}

export default function JarvisPanel() {
  const navigate = useNavigate()
  const { data, lang, settings, setLanguage, stats } = useApp()
  const {
    open,
    messages,
    busy,
    speaking,
    listening,
    transcript,
    muted,
    wakeMode,
    conversation,
    voiceError,
    config,
    voiceSupported,
    closePanel,
    send,
    reset,
    greet,
    toggleMute,
    toggleWake,
    toggleConversation,
    stopSpeaking,
    speak,
  } = useJarvis()

  const [draft, setDraft] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [booting, setBooting] = useState(false)
  const threadRef = useRef(null)
  const inputRef = useRef(null)
  const bootedRef = useRef(false)
  const bootSoundRef = useRef(false)

  const next = useNextStep(data, lang)
  const studentName = settings.student_name || 'Student'
  const orbState = booting
    ? 'boot'
    : busy
      ? 'thinking'
      : listening
        ? 'listening'
        : speaking
          ? 'speaking'
          : 'idle'
  const stateLabel = STATE_LABELS[orbState] || STATE_LABELS.idle
  const clock = formatClock(now, lang)

  useEffect(() => {
    if (!open) return undefined
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, closePanel])

  useEffect(() => {
    if (!open) return undefined
    if (bootedRef.current) {
      setBooting(false)
      return undefined
    }
    if (messages.length > 0) {
      bootedRef.current = true
      setBooting(false)
      return undefined
    }
    setBooting(true)
    if (!bootSoundRef.current) {
      bootSoundRef.current = true
      playBootSequence(muted)
    }
    const timer = setTimeout(() => {
      bootedRef.current = true
      setBooting(false)
      greet()
    }, 1750)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, messages.length])

  useEffect(() => {
    if (!open || booting) return
    const element = threadRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [open, booting, messages, busy, transcript])

  useEffect(() => {
    if (!open || booting) return
    const timer = setTimeout(() => inputRef.current?.focus(), 140)
    return () => clearTimeout(timer)
  }, [open, booting])

  if (!open) return null

  function submit(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    send(text)
  }

  function onComposerKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit(event)
    }
  }

  function handleAction(action) {
    if (!action?.to) return
    navigate(action.to)
    closePanel()
  }

  function ask(message) {
    if (busy) return
    send(message)
  }

  const readiness = stats.readiness || 0
  const tasksPercent = Math.round(((stats.tasks_done || 0) / (stats.total_tasks || 1)) * 100)
  const lessonsPercent = Math.round(
    ((stats.lessons_done || 0) / (stats.total_lessons || 1)) * 100,
  )

  return (
    <div className="jarvis-overlay" role="dialog" aria-modal="true" aria-label="J.A.R.V.I.S.">
      <button className="jarvis-backdrop" aria-label="Закрыть" onClick={closePanel} />
      <section className={`jarvis ${booting ? 'is-booting' : ''}`}>
        <span className="jarvis-corner tl" aria-hidden="true" />
        <span className="jarvis-corner tr" aria-hidden="true" />
        <span className="jarvis-corner bl" aria-hidden="true" />
        <span className="jarvis-corner br" aria-hidden="true" />

        <header className="jarvis-head">
          <div className="jarvis-brand">
            <div className="jarvis-mark"><Orbit size={22} /></div>
            <div>
              <div className="jarvis-name">J.A.R.V.I.S.</div>
              <div className="jarvis-sub">
                Red Diploma · {lang === 'kg' ? 'жеке интеллект' : 'личный интеллект'}
              </div>
            </div>
          </div>

          <div className="jarvis-statusline">
            <span className={`jarvis-status ${config.llm.enabled ? 'live' : ''}`}>
              <Cpu size={13} /> {(config.llm.label || 'LOCAL CORE').toUpperCase()}
            </span>
            <span className={`jarvis-status ${config.tts.provider !== 'browser' ? 'live' : ''}`}>
              <AudioLines size={13} /> {(config.tts.label || 'BROWSER VOICE').toUpperCase()}
            </span>
            <div className="jarvis-clock">
              <strong>{clock.time}</strong>
              <span>{clock.day}</span>
            </div>
          </div>

          <div className="jarvis-head-actions">
            <div className="jarvis-lang" aria-label="Language">
              <button className={lang === 'ru' ? 'active' : ''} onClick={() => setLanguage('ru')}>
                RU
              </button>
              <button className={lang === 'kg' ? 'active' : ''} onClick={() => setLanguage('kg')}>
                KG
              </button>
            </div>
            <button
              className={`jarvis-head-btn ${wakeMode ? 'wake-on' : ''}`}
              onClick={toggleWake}
              disabled={!voiceSupported}
              title={
                wakeMode
                  ? lang === 'kg' ? 'Үн режимин өчүрүү' : 'Выключить режим «Джарвис»'
                  : lang === 'kg' ? '«Джарвис» үн режими' : 'Голосовой режим «Джарвис»'
              }
              aria-label="Голосовой режим Джарвис"
            >
              <Ear size={16} />
            </button>
            <button
              className={`jarvis-head-btn ${muted ? 'off' : 'on'}`}
              onClick={toggleMute}
              title={muted ? 'Включить голос' : 'Выключить голос'}
              aria-label={muted ? 'Включить голос' : 'Выключить голос'}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button className="jarvis-close" onClick={closePanel} aria-label="Закрыть">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="jarvis-body">
          <aside className="jarvis-rail jarvis-rail-left">
            <div className="jarvis-rail-title">
              <Activity size={13} /> {lang === 'kg' ? 'СИСТЕМА' : 'СИСТЕМА'}
            </div>

            <div className="jarvis-gauge">
              <div className="jarvis-gauge-head">
                <span>{lang === 'kg' ? 'Даярдык' : 'Готовность'}</span>
                <strong>{readiness}%</strong>
              </div>
              <div className="jarvis-bar"><i style={{ width: `${readiness}%` }} /></div>
              <div className="jarvis-gauge-foot">
                <ShieldCheck size={12} />
                {readiness >= 80
                  ? lang === 'kg' ? 'максатка жакын' : 'цель близко'
                  : lang === 'kg' ? 'план боюнча' : 'по плану'}
              </div>
            </div>

            <div className="jarvis-rail-group">
              <RailRow
                icon={ListChecks}
                label={lang === 'kg' ? 'Тапшырмалар' : 'Задачи'}
                value={`${stats.tasks_done || 0}/${stats.total_tasks || 0}`}
              />
              <RailRow
                icon={BookOpen}
                label={lang === 'kg' ? 'Сабактар' : 'Уроки'}
                value={`${stats.lessons_done || 0}/${stats.total_lessons || 0}`}
              />
              <RailRow
                icon={Trophy}
                label={lang === 'kg' ? 'Экзамен' : 'Экзамен'}
                value={`${stats.exam_points || 0}/${stats.exam_max || 100}`}
              />
              <RailRow
                icon={Target}
                label={lang === 'kg' ? 'Тренажёр' : 'Тренажёр'}
                value={`${stats.drill_average || 0}%`}
              />
            </div>

            <div className="jarvis-rail-bars">
              <div>
                <span>{lang === 'kg' ? 'тапшырмалар' : 'задачи'}</span>
                <div className="jarvis-bar small"><i style={{ width: `${tasksPercent}%` }} /></div>
              </div>
              <div>
                <span>{lang === 'kg' ? 'сабактар' : 'уроки'}</span>
                <div className="jarvis-bar small"><i style={{ width: `${lessonsPercent}%` }} /></div>
              </div>
            </div>

            <div className="jarvis-rail-group jarvis-system">
              <div className="jarvis-rail-title">
                <Cpu size={13} /> {lang === 'kg' ? 'МОДУЛДАР' : 'МОДУЛИ'}
              </div>
              <div className="jarvis-sys-row"><Cpu size={12} /><span>LLM</span><strong>{config.llm.label}</strong></div>
              <div className="jarvis-sys-row"><AudioLines size={12} /><span>TTS</span><strong>{config.tts.label}</strong></div>
              <div className="jarvis-sys-row"><Ear size={12} /><span>STT</span><strong>{config.stt.label}</strong></div>
              <div className="jarvis-sys-row"><Languages size={12} /><span>LANG</span><strong>RU · KG</strong></div>
            </div>

            <div className="jarvis-rail-actions">
              <button
                className={`jarvis-wake ${wakeMode ? 'live' : ''}`}
                onClick={toggleWake}
                disabled={!voiceSupported}
                title={voiceSupported ? 'Режим ожидания слова «Джарвис»' : 'Браузер не поддерживает STT'}
              >
                <Ear size={15} />
                <span>
                  {wakeMode
                    ? lang === 'kg' ? 'Үн режими күйүк' : 'Голосовой режим включён'
                    : lang === 'kg' ? '«Джарвис» режими' : 'Режим «Джарвис»'}
                </span>
                <i className={wakeMode ? 'on' : ''} />
              </button>
              <button className="jarvis-reset" onClick={reset}>
                <RefreshCw size={14} /> {lang === 'kg' ? 'Сессияны тазалоо' : 'Сбросить сессию'}
              </button>
            </div>
          </aside>

          <div className="jarvis-center">
            <div className="jarvis-stage">
              <div className="jarvis-stage-grid" aria-hidden="true" />
              <div className="jarvis-telemetry left" aria-hidden="true">
                <span>PWR</span><strong>98.4</strong>
                <span>SYNC</span><strong>12ms</strong>
                <span>LINK</span><strong>SECURE</strong>
              </div>
              <JarvisOrb state={orbState} />
              <div className="jarvis-telemetry right" aria-hidden="true">
                <span>NEURAL</span><strong>{config.llm.provider === 'ollama' ? 'OLLAMA' : config.llm.provider === 'anthropic' ? 'CLOUD' : 'LOCAL'}</strong>
                <span>VOICE</span><strong>{muted ? 'MUTED' : 'ACTIVE'}</strong>
                <span>WAKE</span><strong>{conversation ? 'LIVE' : wakeMode ? 'ARMED' : 'STANDBY'}</strong>
              </div>
              <div className="jarvis-stage-meta">
                <span className={`jarvis-live-dot ${orbState}`} />
                <strong>{lang === 'kg' ? stateLabel[1] : stateLabel[0]}</strong>
                <small>
                  {orbState === 'thinking'
                    ? lang === 'kg' ? 'контекст талданып жатат' : 'анализирую контекст'
                    : orbState === 'listening'
                      ? lang === 'kg' ? 'сүйлөңүз, сэр' : 'говорите, сэр'
                      : orbState === 'speaking'
                        ? lang === 'kg' ? 'үн синтези' : 'синтез речи'
                        : conversation
                          ? lang === 'kg' ? 'үн чаты активдүү' : 'голосовой чат активен'
                          : `${studentName} · v${config.version || '1.0'}`}
                </small>
              </div>
            </div>

            {!booting && messages.length === 0 && (
              <div className="jarvis-intro">
                <Sparkles size={15} />
                <p>
                  {lang === 'kg'
                    ? 'Сэр, мен даярмын. Суроо бериңиз же тез буйруктардын бирин тандаңыз.'
                    : 'Сэр, я готов. Задайте вопрос или выберите быструю команду.'}
                </p>
              </div>
            )}

            <div className="jarvis-thread" ref={threadRef} aria-live="polite">
              {messages.map((message) => (
                <Message
                  key={message.id}
                  message={message}
                  lang={lang}
                  onAction={handleAction}
                  onSpeak={speak}
                  studentName={studentName}
                />
              ))}
              {busy && (
                <div className="jarvis-typing" aria-label="Jarvis is thinking">
                  <span /><span /><span />
                  <small>{lang === 'kg' ? 'ядро иштеп жатат' : 'ядро обрабатывает'}</small>
                </div>
              )}
              {transcript && (
                <div className="jarvis-interim">
                  <Mic size={13} /> {transcript}
                </div>
              )}
            </div>

            <div className="jarvis-suggestions">
              {QUICK.slice(0, 6).map((item) => (
                <button key={item.message} onClick={() => ask(item.message)} disabled={busy}>
                  {lang === 'kg' ? item.kg : item.ru}
                </button>
              ))}
            </div>

            <form className="jarvis-compose" onSubmit={submit}>
              <div className="jarvis-input-wrap">
                <button
                  type="button"
                  className={`jarvis-mic ${conversation ? 'live' : ''}`}
                  onClick={toggleConversation}
                  title={
                    !voiceSupported
                      ? lang === 'kg' ? 'STT жок' : 'STT недоступен'
                      : conversation
                        ? lang === 'kg' ? 'Үн чатын токтотуу' : 'Остановить голосовой чат'
                        : lang === 'kg' ? 'Үн чаты: басып сүйлөңүз' : 'Голосовой чат: нажмите и говорите'
                  }
                  aria-label={lang === 'kg' ? 'Үн чаты' : 'Голосовой чат'}
                  aria-pressed={conversation}
                  disabled={!voiceSupported}
                >
                  {conversation ? <Square size={15} /> : <Mic size={17} />}
                </button>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onComposerKey}
                  placeholder={
                    lang === 'kg'
                      ? 'Сэр, сурооңузду жазыңыз…'
                      : 'Сэр, напишите вопрос или скажите «Джарвис»…'
                  }
                  aria-label="Сообщение для Джарвиса"
                />
                {speaking && (
                  <button
                    type="button"
                    className="jarvis-stop"
                    onClick={stopSpeaking}
                    title={lang === 'kg' ? 'Үндү токтотуу' : 'Остановить голос'}
                  >
                    <Square size={13} />
                  </button>
                )}
                <button
                  type="submit"
                  className="jarvis-send"
                  disabled={!draft.trim() || busy}
                  aria-label="Отправить"
                >
                  <Send size={16} />
                </button>
              </div>
              <div className="jarvis-compose-foot">
                <span>
                  <kbd>Enter</kbd> {lang === 'kg' ? 'жөнөтүү' : 'отправить'}
                  <i>·</i>
                  <kbd>Shift+Enter</kbd> {lang === 'kg' ? 'жаңы сап' : 'новая строка'}
                </span>
                <span className={voiceError ? 'jarvis-voice-error' : ''}>
                  {voiceError ||
                    (conversation
                      ? lang === 'kg' ? 'Үн чаты: сүйлөңүз — угуп жатам' : 'Голосовой чат: говорите — я слушаю'
                      : wakeMode
                        ? lang === 'kg' ? '«Джарвис» деп айтыңыз' : 'Скажите «Джарвис»'
                        : lang === 'kg' ? 'Үн браузер аркылуу' : 'Голос через браузер')}
                </span>
              </div>
            </form>
          </div>

          <aside className="jarvis-rail jarvis-rail-right">
            <div className="jarvis-rail-title">
              <Zap size={13} /> {lang === 'kg' ? 'ТЕЗ БУЙРУКТАР' : 'БЫСТРЫЕ КОМАНДЫ'}
            </div>
            <div className="jarvis-quick">
              {QUICK.map((item) => (
                <button key={item.message} onClick={() => ask(item.message)} disabled={busy}>
                  <ChevronRight size={13} />
                  {lang === 'kg' ? item.kg : item.ru}
                </button>
              ))}
            </div>

            <div className="jarvis-rail-title spaced">
              <Target size={13} /> {lang === 'kg' ? 'КИЙИНКИ КАДАМ' : 'СЛЕДУЮЩИЙ ШАГ'}
            </div>
            {next ? (
              <button className="jarvis-next" onClick={() => handleAction({ to: next.url })}>
                <span className="jarvis-next-path">{pick(next.path.title, lang)}</span>
                <strong>{next.title}</strong>
                <span className="jarvis-next-meta">
                  {lang === 'kg' ? 'кадам' : 'шаг'} {next.index + 1}/{next.total}
                  <ArrowRight size={13} />
                </span>
              </button>
            ) : (
              <div className="jarvis-next done">
                <CheckCircle2 size={17} />
                <strong>
                  {lang === 'kg' ? 'Бардык маршруттар бүттү' : 'Все маршруты завершены'}
                </strong>
                <span>{lang === 'kg' ? 'Экзаменге өтүңүз' : 'Переходите к экзамену'}</span>
              </div>
            )}

            <div className="jarvis-rail-title spaced">
              <GraduationCap size={13} /> {lang === 'kg' ? 'ПРОТОКОЛ' : 'ПРОТОКОЛ'}
            </div>
            <div className="jarvis-protocol">
              <div><span>{lang === 'kg' ? 'Байланыш' : 'Связь'}</span><strong><i className="ok" /> ONLINE</strong></div>
              <div><span>{lang === 'kg' ? 'Тилдер' : 'Языки'}</span><strong>RU · KG</strong></div>
              <div><span>{lang === 'kg' ? 'Окуу' : 'Обучение'}</span><strong><i className="ok" /> ACTIVE</strong></div>
              <div><span>{lang === 'kg' ? 'Чечим' : 'Решение'}</span><strong><i className="warn" /> HIDDEN</strong></div>
            </div>

            <div className="jarvis-quote">
              <Power size={13} />
              <p>
                {lang === 'kg'
                  ? '«Мен сиздин окутуучуңузмун, сэр. Даяр чечим эмес — түшүнүү берем.»'
                  : '«Я ваш наставник, сэр. Даю понимание, а не готовое решение.»'}
              </p>
            </div>

            <div className="jarvis-hint">
              <Clock3 size={12} />
              {lang === 'kg'
                ? 'Ctrl+J — команддык борборду ачуу'
                : 'Ctrl+J — открыть командный центр'}
            </div>
          </aside>
        </div>

        {booting && (
          <div className="jarvis-boot" aria-hidden="true">
            <div className="jarvis-boot-orbit"><Orbit size={34} /></div>
            <div className="jarvis-boot-lines">
              <span style={{ animationDelay: '0.1s' }}>CORE INITIALIZATION...</span>
              <span style={{ animationDelay: '0.45s' }}>LINKING LEARNING CONTEXT...</span>
              <span style={{ animationDelay: '0.85s' }}>VOICE CHANNEL · READY</span>
              <strong style={{ animationDelay: '1.2s' }}>J.A.R.V.I.S. ONLINE</strong>
            </div>
            <div className="jarvis-boot-bar"><i /></div>
          </div>
        )}
      </section>
    </div>
  )
}
