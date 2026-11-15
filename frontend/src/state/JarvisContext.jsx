import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { api } from '../api'
import { useApp } from './AppContext'
import {
  cleanForSpeech,
  detectStopPhrase,
  detectWakeWord,
  ensureMicrophoneAccess,
  getRecognitionCtor,
  playTone,
  recognitionSupported,
  speakBrowser,
  stopBrowserSpeech,
} from '../components/jarvis/voice'

const JarvisContext = createContext(null)

const FALLBACK_CONFIG = {
  name: 'J.A.R.V.I.S.',
  version: '1.0',
  llm: { enabled: false, provider: 'local', model: null, label: 'Local Core' },
  tts: { enabled: false, provider: 'browser', label: 'Голос браузера' },
  stt: { provider: 'browser', label: 'Web Speech API' },
  languages: ['ru', 'kg'],
  wake_words: ['джарвис', 'жарвис', 'jarvis'],
}

let messageSeq = 0

function nextId() {
  messageSeq += 1
  return `j-${Date.now().toString(36)}-${messageSeq}`
}

export function JarvisProvider({ children }) {
  const { lang } = useApp()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [muted, setMuted] = useState(false)
  const [wakeMode, setWakeMode] = useState(false)
  const [wakeStarting, setWakeStarting] = useState(false)
  const [conversation, setConversation] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const [config, setConfig] = useState(FALLBACK_CONFIG)

  const messagesRef = useRef([])
  const busyRef = useRef(false)
  const mutedRef = useRef(false)
  const langRef = useRef(lang)
  const configRef = useRef(FALLBACK_CONFIG)
  const contextRef = useRef({
    page: '',
    task_slug: '',
    path_slug: '',
    code: '',
    last_result: null,
  })
  const audioRef = useRef(null)
  const urlRef = useRef(null)
  const speechTokenRef = useRef(0)
  const wakeOnRef = useRef(false)
  const recognitionRef = useRef(null)
  const pttRef = useRef(null)
  const restartRef = useRef(null)
  const conversationRef = useRef(false)
  const conversationTimerRef = useRef(null)
  const emptyTurnsRef = useRef(0)
  const speakingRef = useRef(false)
  const speechCooldownRef = useRef(0)
  const conversationResumeRef = useRef(() => {})
  const actionsRef = useRef({})
  const wakeCommitRef = useRef(null)
  const listenCommitRef = useRef(null)
  const listenLimitRef = useRef(null)
  const noSpeechRef = useRef(null)
  const autoWakeRef = useRef(true)
  const wakeStartingRef = useRef(false)
  const wakeTokenRef = useRef(0)
  const listenTokenRef = useRef(0)
  const micDeniedRef = useRef(false)
  const permissionRef = useRef(null)
  const wakeFailuresRef = useRef(0)

  useEffect(() => {
    langRef.current = lang
  }, [lang])

  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  useEffect(() => {
    api
      .jarvisConfig()
      .then((payload) => {
        configRef.current = payload
        setConfig(payload)
      })
      .catch(() => {})
  }, [])

  const appendMessage = useCallback((payload) => {
    const message = {
      id: nextId(),
      time: new Date(),
      ...payload,
    }
    messagesRef.current = [...messagesRef.current, message]
    setMessages(messagesRef.current)
    return message
  }, [])

  const stopSpeaking = useCallback(() => {
    speechTokenRef.current += 1
    speakingRef.current = false
    stopBrowserSpeech()
    const audio = audioRef.current
    if (audio) {
      try {
        audio.pause()
        audio.src = ''
      } catch {
        /* audio element may already be detached */
      }
      audioRef.current = null
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setSpeaking(false)
  }, [])

  const stopConversation = useCallback(() => {
    conversationRef.current = false
    setConversation(false)
    listenTokenRef.current += 1
    clearTimeout(conversationTimerRef.current)
    clearTimeout(listenCommitRef.current)
    clearTimeout(listenLimitRef.current)
    clearTimeout(noSpeechRef.current)
    const ptt = pttRef.current
    pttRef.current = null
    if (ptt) {
      try {
        ptt.onend = null
        ptt.abort()
      } catch {
        /* recognition may already be stopped */
      }
    }
    setListening(false)
    setTranscript('')
    stopSpeaking()
    // Return to wake standby whenever hands-free mode is on, even after a
    // manual mic turn. Disabling wake (the ear button) sets autoWake false.
    if (autoWakeRef.current && !micDeniedRef.current) {
      conversationTimerRef.current = setTimeout(() => actionsRef.current.startWake?.(), 350)
    }
  }, [stopSpeaking])

  const speak = useCallback(
    async (text, language, options = {}) => {
      const cleaned = cleanForSpeech(text)
      if (!cleaned || mutedRef.current) {
        options.onEnd?.()
        return
      }
      stopSpeaking()
      const token = speechTokenRef.current + 1
      speechTokenRef.current = token
      speakingRef.current = true
      setSpeaking(true)
      playTone('speak', mutedRef.current)

      const finish = () => {
        if (speechTokenRef.current !== token) return
        speakingRef.current = false
        // Ignore the echo tail briefly so Jarvis cannot wake itself.
        speechCooldownRef.current = Date.now() + 700
        setSpeaking(false)
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current)
          urlRef.current = null
        }
        options.onEnd?.()
      }

      const spokenLang = language || langRef.current
      const provider = configRef.current?.tts?.provider
      const browserFallback = () => {
        if (speechTokenRef.current !== token) return
        speakBrowser(cleaned, spokenLang, { onEnd: finish })
      }

      // Short activation phrases skip Piper: its first request can take seconds,
      // and the user should hear "да, сэр" immediately.
      if (provider === 'browser' || options.browser) {
        browserFallback()
        return
      }

      // Piper has no Kyrgyz voice: go straight to the browser instead of a 503.
      const voices = configRef.current?.tts?.voices
      if (provider === 'piper' && voices && !voices[spokenLang]) {
        browserFallback()
        return
      }

      try {
        const blob = await api.jarvisSpeech(cleaned, spokenLang)
        if (speechTokenRef.current !== token) return
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        const audio = new Audio(url)
        audioRef.current = audio
        audio.onended = finish
        audio.onerror = browserFallback
        await audio.play()
      } catch {
        browserFallback()
      }
    },
    [stopSpeaking],
  )

  const announce = useCallback(
    (text, options = {}) => {
      appendMessage({ role: 'assistant', content: text, intent: 'address', source: 'local' })
      if (!mutedRef.current) speak(text, langRef.current, options)
      else options.onEnd?.()
    },
    [appendMessage, speak],
  )

  const send = useCallback(
    async (raw, options = {}) => {
      const text = String(raw || '').trim()
      if (!text || busyRef.current) return
      const hidden = text === '__greeting__' || options.hidden

      const history = messagesRef.current
        .slice(-10)
        .map((item) => ({ role: item.role, content: String(item.content).slice(0, 2000) }))

      if (!hidden) {
        appendMessage({ role: 'user', content: text })
      }

      busyRef.current = true
      setBusy(true)
      setVoiceError('')
      stopSpeaking()

      try {
        const payload = await api.jarvisChat({
          message: text,
          history,
          context: { ...contextRef.current, language: langRef.current },
        })
        appendMessage({
          role: 'assistant',
          content: payload.reply,
          intent: payload.intent,
          source: payload.source,
          action: payload.action || null,
        })
        if (!mutedRef.current) {
          speak(payload.reply, payload.language, {
            onEnd: () => conversationResumeRef.current(),
          })
        } else {
          conversationResumeRef.current()
        }
      } catch (error) {
        appendMessage({
          role: 'assistant',
          content:
            langRef.current === 'kg'
              ? `Байланыш үзүлдү, сэр. ${error.message}`
              : `Связь с ядром прервана, сэр. ${error.message}`,
          error: true,
          source: 'error',
        })
        stopConversation()
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [appendMessage, speak, stopConversation, stopSpeaking],
  )

  const greet = useCallback(() => {
    if (busyRef.current || messagesRef.current.length > 0) return
    send('__greeting__', { hidden: true })
  }, [send])

  const openPanel = useCallback(() => {
    setOpen(true)
    playTone('open', mutedRef.current)
  }, [])

  const closePanel = useCallback(() => {
    setOpen(false)
    stopConversation()
  }, [stopConversation])

  const togglePanel = useCallback(() => {
    if (open) {
      setOpen(false)
      stopConversation()
      return
    }
    setOpen(true)
    playTone('open', mutedRef.current)
  }, [open, stopConversation])

  const stopWake = useCallback(() => {
    wakeOnRef.current = false
    wakeStartingRef.current = false
    wakeTokenRef.current += 1
    setWakeMode(false)
    setWakeStarting(false)
    clearTimeout(restartRef.current)
    clearTimeout(wakeCommitRef.current)
    wakeCommitRef.current = null
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (recognition) {
      try {
        recognition.onstart = null
        recognition.onresult = null
        recognition.onend = null
        recognition.onerror = null
        recognition.abort()
      } catch {
        /* recognition may already be stopped */
      }
    }
    setListening(false)
    setTranscript('')
  }, [])

  const startWake = useCallback(async () => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setVoiceError(
        langRef.current === 'kg'
          ? 'Бул браузер үн таанууну колдобойт. Chrome же Edge колдонуп көрүңүз.'
          : 'Этот браузер не поддерживает распознавание речи. Попробуйте Chrome или Edge.',
      )
      return
    }
    if (wakeStartingRef.current || wakeOnRef.current || conversationRef.current) return
    stopWake()
    const token = wakeTokenRef.current
    wakeStartingRef.current = true
    setWakeStarting(true)
    setVoiceError('')

    // Chrome's SpeechRecognition can fail with `not-allowed` while its own
    // permission prompt is still open. Ask through getUserMedia first, then
    // start recognition only after the microphone is actually granted.
    const access = await ensureMicrophoneAccess()
    if (token !== wakeTokenRef.current || conversationRef.current) return
    if (!access.ok) {
      wakeStartingRef.current = false
      setWakeStarting(false)
      if (access.reason === 'NotAllowedError' || access.reason === 'SecurityError') {
        micDeniedRef.current = true
        setVoiceError(
          langRef.current === 'kg'
            ? 'Микрофонго уруксат берилген жок. Браузердин сайт жөндөөлөрүнөн уруксат бериңиз.'
            : 'Доступ к микрофону запрещён. Разрешите микрофон в настройках сайта.',
        )
      } else if (access.reason === 'NotFoundError' || access.reason === 'DevicesNotFoundError') {
        setVoiceError(
          langRef.current === 'kg'
            ? 'Микрофон табылбады. Аны туташтырып, кайра аракет кылыңыз.'
            : 'Микрофон не найден. Подключите его и попробуйте снова.',
        )
      } else {
        setVoiceError(
          langRef.current === 'kg'
            ? 'Микрофонду ачуу мүмкүн болбоду.'
            : 'Не удалось получить доступ к микрофону.',
        )
      }
      return
    }
    micDeniedRef.current = false

    const recognition = new Ctor()
    let rest = ''
    recognition.lang = 'ru-RU'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    const clearPending = () => {
      clearTimeout(wakeCommitRef.current)
      wakeCommitRef.current = null
      rest = ''
    }

    const commitWake = () => {
      clearTimeout(wakeCommitRef.current)
      wakeCommitRef.current = null
      const phrase = rest
      rest = ''
      if (!wakeOnRef.current || conversationRef.current || busyRef.current || speakingRef.current) {
        return
      }
      playTone('listen', mutedRef.current)
      actionsRef.current.startConversation?.(phrase, { fromWake: true })
    }

    recognition.onstart = () => {
      if (token !== wakeTokenRef.current) return
      wakeFailuresRef.current = 0
      wakeOnRef.current = true
      wakeStartingRef.current = false
      setWakeStarting(false)
      setWakeMode(true)
      setVoiceError('')
      setListening(true)
    }
    recognition.onresult = (event) => {
      if (token !== wakeTokenRef.current) return
      let all = ''
      for (let index = 0; index < event.results.length; index += 1) {
        all += ` ${event.results[index][0]?.transcript || ''}`
      }
      const text = all.replace(/\s+/g, ' ').trim()
      setTranscript(text)
      // Never let Jarvis's own voice trigger the wake word.
      if (speakingRef.current || busyRef.current || conversationRef.current) return
      if (Date.now() < speechCooldownRef.current) return
      // Continuous recognition accumulates the whole session; keep the tail so
      // stale background speech cannot contaminate a fresh wake request.
      const tail = text.split(' ').slice(-30).join(' ')
      if (detectStopPhrase(tail)) {
        clearPending()
        setTranscript('')
        actionsRef.current.endConversation?.()
        return
      }
      const match = detectWakeWord(tail)
      if (!match.wake) return
      rest = match.rest
      // Do not abort on the first interim result. Wait for a pause so a full
      // request like "привет, Джарвис, дай подсказку" is captured to the end.
      clearTimeout(wakeCommitRef.current)
      wakeCommitRef.current = setTimeout(commitWake, 1500)
    }
    recognition.onerror = (event) => {
      if (token !== wakeTokenRef.current) return
      const error = event.error || 'unknown'
      if (error === 'aborted') return
      setListening(false)
      setTranscript('')
      if (error === 'not-allowed' || error === 'service-not-allowed') {
        micDeniedRef.current = true
        wakeOnRef.current = false
        wakeStartingRef.current = false
        setWakeStarting(false)
        setWakeMode(false)
        setVoiceError(
          langRef.current === 'kg'
            ? 'Микрофонго уруксат берилген жок. Браузердин сайт жөндөөлөрүнөн уруксат бериңиз.'
            : 'Доступ к микрофону запрещён. Разрешите микрофон в настройках сайта.',
        )
        return
      }
      if (error === 'audio-capture') {
        wakeOnRef.current = false
        wakeStartingRef.current = false
        setWakeStarting(false)
        setWakeMode(false)
        setVoiceError(
          langRef.current === 'kg'
            ? 'Микрофон табылбады. Аны туташтырып, кайра аракет кылыңыз.'
            : 'Микрофон не найден. Подключите его и попробуйте снова.',
        )
        return
      }
      if (error === 'network') {
        wakeFailuresRef.current += 1
        setVoiceError(
          langRef.current === 'kg'
            ? 'Үн таануу кызматына байланыш жок. Интернетти текшериңиз.'
            : 'Нет связи с сервисом распознавания речи. Проверьте интернет.',
        )
        if (wakeFailuresRef.current >= 3) {
          wakeOnRef.current = false
          wakeStartingRef.current = false
          setWakeStarting(false)
          setWakeMode(false)
          autoWakeRef.current = false
          setVoiceError(
            langRef.current === 'kg'
              ? 'Үн таануу иштебей жатат. Кулак баскычын басып, кайра аракет кылыңыз.'
              : 'Распознавание речи недоступно. Нажмите кнопку уха, чтобы попробовать снова.',
          )
        }
        return
      }
      if (error !== 'no-speech') {
        setVoiceError(
          langRef.current === 'kg' ? `Үн катасы: ${error}` : `Ошибка микрофона: ${error}`,
        )
      }
    }
    recognition.onend = () => {
      if (token !== wakeTokenRef.current) return
      setListening(false)
      setTranscript('')
      if (wakeCommitRef.current) {
        commitWake()
        return
      }
      wakeStartingRef.current = false
      setWakeStarting(false)
      if (!wakeOnRef.current || conversationRef.current) return
      wakeOnRef.current = false
      setWakeMode(false)
      recognitionRef.current = null
      try {
        recognition.onstart = null
        recognition.onresult = null
        recognition.onend = null
        recognition.onerror = null
      } catch {
        /* handlers may already be detached */
      }
      if (autoWakeRef.current && !micDeniedRef.current) {
        restartRef.current = setTimeout(
          () => {
            if (autoWakeRef.current && !conversationRef.current && !micDeniedRef.current) {
              actionsRef.current.startWake?.()
            }
          },
          wakeFailuresRef.current ? 1500 : 450,
        )
      }
    }

    recognitionRef.current = recognition
    wakeOnRef.current = true
    try {
      recognition.start()
    } catch {
      if (token !== wakeTokenRef.current) return
      wakeOnRef.current = false
      wakeStartingRef.current = false
      setWakeStarting(false)
      setWakeMode(false)
      setVoiceError(
        langRef.current === 'kg'
          ? 'Үн таанууну баштоо мүмкүн болбоду.'
          : 'Не удалось запустить распознавание речи.',
      )
    }
  }, [stopWake])

  const endConversation = useCallback(() => {
    const farewell = langRef.current === 'kg' ? 'Кош болуңуз, сэр.' : 'До связи, сэр.'
    // "пока, Джарвис" ends the current conversation but keeps wake standby:
    // saying "привет, Джарвис" later must work without reloading the page.
    stopConversation()
    setVoiceError('')
    appendMessage({ role: 'assistant', content: farewell, intent: 'farewell', source: 'local' })
    if (!mutedRef.current) speak(farewell, langRef.current, { browser: true })
  }, [appendMessage, speak, stopConversation])

  const toggleWake = useCallback(() => {
    if (wakeOnRef.current || wakeStartingRef.current) {
      autoWakeRef.current = false
      micDeniedRef.current = false
      stopWake()
      setVoiceError('')
      return
    }
    autoWakeRef.current = true
    micDeniedRef.current = false
    startWake()
  }, [startWake, stopWake])

  const listenOnce = useCallback(async () => {
    clearTimeout(listenCommitRef.current)
    clearTimeout(listenLimitRef.current)
    clearTimeout(noSpeechRef.current)
    if (pttRef.current) {
      try {
        pttRef.current.onend = null
        pttRef.current.onresult = null
        pttRef.current.abort()
      } catch {
        /* already stopped */
      }
      pttRef.current = null
    }
    if (busyRef.current) return
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setVoiceError(
        langRef.current === 'kg'
          ? 'Бул браузер үн таанууну колдобойт.'
          : 'Этот браузер не поддерживает распознавание речи.',
      )
      return
    }

    const token = listenTokenRef.current + 1
    listenTokenRef.current = token
    const wake = recognitionRef.current
    if (wake) {
      try {
        wake.onstart = null
        wake.onresult = null
        wake.onend = null
        wake.onerror = null
        wake.abort()
      } catch {
        /* ignore */
      }
      recognitionRef.current = null
    }
    wakeTokenRef.current += 1
    wakeOnRef.current = false
    wakeStartingRef.current = false
    setWakeMode(false)
    setWakeStarting(false)
    clearTimeout(restartRef.current)
    clearTimeout(wakeCommitRef.current)
    wakeCommitRef.current = null

    const access = await ensureMicrophoneAccess()
    if (token !== listenTokenRef.current) return
    if (!access.ok) {
      setVoiceError(
        access.reason === 'NotAllowedError' || access.reason === 'SecurityError'
          ? langRef.current === 'kg'
            ? 'Микрофонго уруксат берилген жок. Браузердин сайт жөндөөлөрүнөн уруксат бериңиз.'
            : 'Доступ к микрофону запрещён. Разрешите микрофон в настройках сайта.'
          : langRef.current === 'kg'
            ? 'Микрофонду ачуу мүмкүн болбоду.'
            : 'Не удалось получить доступ к микрофону.',
      )
      if (conversationRef.current) stopConversation()
      return
    }

    const recognition = new Ctor()
    let finalText = ''
    let interimText = ''
    let committed = false
    recognition.lang = 'ru-RU'
    // Keep one continuous session open: Chrome must not finalize the phrase
    // after the first pause and cut the user off mid-sentence.
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    const currentText = () => `${finalText} ${interimText}`.replace(/\s+/g, ' ').trim()

    const stopRecognition = () => {
      clearTimeout(listenCommitRef.current)
      clearTimeout(listenLimitRef.current)
      clearTimeout(noSpeechRef.current)
      pttRef.current = null
      setListening(false)
      setTranscript('')
      try {
        recognition.onend = null
        recognition.onresult = null
        recognition.onerror = null
        recognition.abort()
      } catch {
        /* recognition may already be stopped */
      }
    }

    const emptyTurn = () => {
      setListening(false)
      setTranscript('')
      if (!conversationRef.current) return
      emptyTurnsRef.current += 1
      if (emptyTurnsRef.current <= 2) {
        setVoiceError(langRef.current === 'kg' ? 'Угуп жатам… сүйлөңүз.' : 'Слушаю… говорите.')
        conversationTimerRef.current = setTimeout(() => {
          if (conversationRef.current) actionsRef.current.listen?.()
        }, 500)
      } else {
        conversationRef.current = false
        setConversation(false)
        setVoiceError(
          langRef.current === 'kg'
            ? 'Үн угулбады. Микрофонду басып кайра баштаңыз.'
            : 'Я вас не слышу. Нажмите микрофон, чтобы продолжить.',
        )
        if (autoWakeRef.current && !micDeniedRef.current) {
          restartRef.current = setTimeout(() => actionsRef.current.startWake?.(), 350)
        }
      }
    }

    const commit = () => {
      if (committed) return
      committed = true
      const heard = currentText()
      stopRecognition()
      if (!heard) {
        emptyTurn()
        return
      }
      emptyTurnsRef.current = 0
      if (detectStopPhrase(heard)) {
        actionsRef.current.endConversation?.()
        return
      }
      const { wake: hasWake, rest } = detectWakeWord(heard)
      if (hasWake) {
        if (rest) {
          actionsRef.current.send?.(rest)
        } else {
          actionsRef.current.announce?.(
            langRef.current === 'kg' ? 'Ооба, сэр. Угуп жатам.' : 'Да, сэр. Слушаю.',
            { onEnd: () => conversationResumeRef.current() },
          )
        }
      } else {
        actionsRef.current.send?.(heard)
      }
    }

    const armCommit = (delay) => {
      clearTimeout(listenCommitRef.current)
      listenCommitRef.current = setTimeout(commit, delay)
    }

    recognition.onstart = () => {
      setVoiceError('')
      setListening(true)
      setTranscript('')
      playTone('listen', mutedRef.current)
    }
    recognition.onresult = (event) => {
      finalText = ''
      interimText = ''
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index]
        const chunk = result[0]?.transcript || ''
        if (result.isFinal) finalText += ` ${chunk}`
        else interimText += ` ${chunk}`
      }
      setTranscript(currentText())
      clearTimeout(noSpeechRef.current)
      // Send only after a pause, so the user can finish the whole sentence.
      armCommit(1400)
    }
    recognition.onspeechend = () => {
      if (currentText()) armCommit(1000)
    }
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        committed = true
        setVoiceError(
          langRef.current === 'kg'
            ? 'Микрофонго уруксат берилген жок.'
            : 'Доступ к микрофону не разрешён.',
        )
        stopRecognition()
        if (conversationRef.current) stopConversation()
      } else if (event.error === 'no-speech' && !committed) {
        commit()
      }
    }
    recognition.onend = () => {
      if (committed) return
      // Chrome ends continuous recognition on its own after a long silence.
      commit()
    }

    pttRef.current = recognition
    try {
      recognition.start()
      noSpeechRef.current = setTimeout(() => {
        if (!committed && !currentText()) commit()
      }, 8000)
      listenLimitRef.current = setTimeout(() => {
        if (!committed) commit()
      }, 25000)
    } catch {
      pttRef.current = null
      setVoiceError(
        langRef.current === 'kg'
          ? 'Үн таанууну баштоо мүмкүн болбоду.'
          : 'Не удалось запустить распознавание речи.',
      )
    }
  }, [stopConversation])

  conversationResumeRef.current = () => {
    if (!conversationRef.current) return
    clearTimeout(conversationTimerRef.current)
    conversationTimerRef.current = setTimeout(() => {
      if (conversationRef.current) actionsRef.current.listen?.()
    }, 350)
  }

  const startConversation = useCallback(
    (initialMessage = '', options = {}) => {
      const Ctor = getRecognitionCtor()
      if (!Ctor) {
        setVoiceError(
          langRef.current === 'kg'
            ? 'Бул браузер үн таанууну колдобойт. Chrome же Edge колдонуп көрүңүз.'
            : 'Этот браузер не поддерживает распознавание речи. Попробуйте Chrome или Edge.',
        )
        return
      }
      conversationRef.current = true
      setConversation(true)
      emptyTurnsRef.current = 0
      setVoiceError('')
      openPanel()
      stopSpeaking()
      clearTimeout(conversationTimerRef.current)
      clearTimeout(restartRef.current)
      const wake = recognitionRef.current
      if (wake) {
        try {
          wake.onstart = null
          wake.onresult = null
          wake.onend = null
          wake.onerror = null
          wake.abort()
        } catch {
          /* wake recognition may already be stopped */
        }
        recognitionRef.current = null
      }
      wakeTokenRef.current += 1
      wakeOnRef.current = false
      wakeStartingRef.current = false
      setWakeMode(false)
      setWakeStarting(false)
      clearTimeout(wakeCommitRef.current)
      wakeCommitRef.current = null
      const phrase = String(initialMessage || '').trim()
      if (phrase) {
        send(phrase)
        return
      }
      const line = options.fromWake
        ? langRef.current === 'kg'
          ? 'Ооба, сэр. Эмнеге жардам берем?'
          : 'Да, сэр. Чем могу помочь?'
        : langRef.current === 'kg'
          ? 'Ооба, сэр. Угуп жатам.'
          : 'Да, сэр. Слушаю.'
      appendMessage({ role: 'assistant', content: line, intent: 'address', source: 'local' })
      if (options.fromWake && !mutedRef.current) {
        // Browser voice starts instantly; Piper's first request can take seconds.
        speak(line, langRef.current, {
          browser: true,
          onEnd: () => conversationResumeRef.current(),
        })
        return
      }
      // A mic click must start listening at once, with no greeting latency.
      setVoiceError(langRef.current === 'kg' ? 'Сүйлөңүз, сэр.' : 'Говорите, сэр.')
      conversationTimerRef.current = setTimeout(() => {
        if (conversationRef.current) actionsRef.current.listen?.()
      }, 120)
    },
    [appendMessage, openPanel, send, speak, stopSpeaking],
  )

  const toggleConversation = useCallback(() => {
    if (conversationRef.current) stopConversation()
    else startConversation()
  }, [startConversation, stopConversation])

  const updateContext = useCallback((patch) => {
    contextRef.current = { ...contextRef.current, ...patch }
  }, [])

  const openWith = useCallback(
    (text) => {
      setOpen(true)
      send(text)
    },
    [send],
  )

  const reset = useCallback(() => {
    stopSpeaking()
    messagesRef.current = []
    setMessages([])
    setTranscript('')
    setTimeout(() => actionsRef.current.greet?.(), 120)
  }, [stopSpeaking])

  actionsRef.current = {
    send,
    announce,
    openPanel,
    greet,
    startWake,
    stopWake,
    listen: listenOnce,
    startConversation,
    stopConversation,
    endConversation,
  }

  // Hands-free by default. Wake arms itself immediately when the microphone is
  // already granted, otherwise on the first click/keypress (browsers refuse a
  // permission prompt without a gesture). The listeners stay attached for the
  // page lifetime so a failed start can be retried by clicking again.
  useEffect(() => {
    if (!recognitionSupported()) {
      setVoiceError(
        langRef.current === 'kg'
          ? 'Бул браузер үн таанууну колдобойт. Chrome же Edge колдонуп көрүңүз.'
          : 'Этот браузер не поддерживает распознавание речи. Попробуйте Chrome или Edge.',
      )
      return undefined
    }
    autoWakeRef.current = true
    let cancelled = false
    let timer = null
    const maybeArm = () => {
      if (cancelled || !autoWakeRef.current || micDeniedRef.current) return
      if (wakeOnRef.current || wakeStartingRef.current || conversationRef.current) return
      actionsRef.current.startWake?.()
    }
    const onPermissionChange = () => {
      const status = permissionRef.current
      if (cancelled || !status) return
      if (status.state === 'granted') {
        micDeniedRef.current = false
        setVoiceError('')
        clearTimeout(timer)
        timer = setTimeout(maybeArm, 500)
        return
      }
      if (status.state === 'denied') {
        micDeniedRef.current = true
        actionsRef.current.stopWake?.()
        setVoiceError(
          langRef.current === 'kg'
            ? 'Микрофонго уруксат берилген жок. Браузердин сайт жөндөөлөрүнөн уруксат бериңиз.'
            : 'Доступ к микрофону запрещён. Разрешите микрофон в настройках сайта.',
        )
      }
    }
    try {
      navigator.permissions
        ?.query?.({ name: 'microphone' })
        .then((status) => {
          if (cancelled) return
          permissionRef.current = status
          status.onchange = onPermissionChange
          if (status.state === 'granted') {
            timer = setTimeout(maybeArm, 700)
          } else if (status.state === 'denied') {
            onPermissionChange()
          }
        })
        .catch(() => {})
    } catch {
      /* Permissions API is unavailable in some browsers */
    }
    window.addEventListener('pointerdown', maybeArm, true)
    window.addEventListener('keydown', maybeArm, true)
    return () => {
      cancelled = true
      window.removeEventListener('pointerdown', maybeArm, true)
      window.removeEventListener('keydown', maybeArm, true)
      clearTimeout(timer)
      if (permissionRef.current) permissionRef.current.onchange = null
    }
  }, [])

  useEffect(
    () => () => {
      stopWake()
      stopConversation()
      stopSpeaking()
      clearTimeout(restartRef.current)
      clearTimeout(conversationTimerRef.current)
      clearTimeout(wakeCommitRef.current)
      clearTimeout(listenCommitRef.current)
      clearTimeout(listenLimitRef.current)
      clearTimeout(noSpeechRef.current)
    },
    [stopConversation, stopSpeaking, stopWake],
  )

  const value = useMemo(
    () => ({
      open,
      messages,
      busy,
      speaking,
      listening,
      transcript,
      muted,
      wakeMode,
      wakeStarting,
      conversation,
      voiceError,
      config,
      voiceSupported: recognitionSupported(),
      openPanel,
      closePanel,
      togglePanel,
      openWith,
      send,
      reset,
      greet,
      toggleMute: () => setMuted((current) => !current),
      toggleWake,
      listenOnce,
      toggleConversation,
      stopSpeaking,
      updateContext,
    }),
    [
      open,
      messages,
      busy,
      speaking,
      listening,
      transcript,
      muted,
      wakeMode,
      wakeStarting,
      conversation,
      voiceError,
      config,
      openPanel,
      closePanel,
      togglePanel,
      openWith,
      send,
      reset,
      greet,
      toggleWake,
      listenOnce,
      toggleConversation,
      stopSpeaking,
      updateContext,
    ],
  )

  return <JarvisContext.Provider value={value}>{children}</JarvisContext.Provider>
}

export function useJarvis() {
  const value = useContext(JarvisContext)
  if (!value) throw new Error('useJarvis must be used inside JarvisProvider')
  return value
}
