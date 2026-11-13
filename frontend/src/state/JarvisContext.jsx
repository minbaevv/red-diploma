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
  detectWakeWord,
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
  const handledRef = useRef(false)
  const handledResetRef = useRef(null)
  const actionsRef = useRef({})

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

  const speak = useCallback(
    async (text, language) => {
      const cleaned = cleanForSpeech(text)
      if (!cleaned || mutedRef.current) return
      stopSpeaking()
      const token = speechTokenRef.current + 1
      speechTokenRef.current = token
      setSpeaking(true)
      playTone('speak', mutedRef.current)

      const finish = () => {
        if (speechTokenRef.current !== token) return
        setSpeaking(false)
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current)
          urlRef.current = null
        }
      }

      const spokenLang = language || langRef.current
      const provider = configRef.current?.tts?.provider
      const browserFallback = () => {
        if (speechTokenRef.current !== token) return
        speakBrowser(cleaned, spokenLang, { onEnd: finish })
      }

      if (provider === 'browser') {
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
    (text) => {
      appendMessage({ role: 'assistant', content: text, intent: 'address', source: 'local' })
      if (!mutedRef.current) speak(text, langRef.current)
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
        if (!mutedRef.current) speak(payload.reply, payload.language)
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
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [appendMessage, speak, stopSpeaking],
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
    stopSpeaking()
  }, [stopSpeaking])

  const togglePanel = useCallback(() => {
    if (open) {
      setOpen(false)
      stopSpeaking()
      return
    }
    setOpen(true)
    playTone('open', mutedRef.current)
  }, [open, stopSpeaking])

  const stopWake = useCallback(() => {
    wakeOnRef.current = false
    setWakeMode(false)
    clearTimeout(restartRef.current)
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (recognition) {
      try {
        recognition.onend = null
        recognition.onerror = null
        recognition.stop()
      } catch {
        /* recognition may already be stopped */
      }
    }
    setListening(false)
    setTranscript('')
  }, [])

  const startWake = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setVoiceError(
        langRef.current === 'kg'
          ? 'Бул браузер үн таанууну колдобойт. Chrome же Edge колдонуп көрүңүз.'
          : 'Этот браузер не поддерживает распознавание речи. Попробуйте Chrome или Edge.',
      )
      return
    }
    stopWake()
    const recognition = new Ctor()
    recognition.lang = 'ru-RU'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setVoiceError('')
      setListening(true)
    }
    recognition.onresult = (event) => {
      let finalText = ''
      let interim = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const chunk = result[0]?.transcript || ''
        if (result.isFinal) finalText += ` ${chunk}`
        else interim += chunk
      }
      const heard = `${finalText} ${interim}`.replace(/\s+/g, ' ').trim()
      setTranscript(heard)
      if (handledRef.current) return
      const { wake, rest } = detectWakeWord(heard)
      if (!wake) return
      handledRef.current = true
      clearTimeout(handledResetRef.current)
      handledResetRef.current = setTimeout(() => {
        handledRef.current = false
      }, 3500)
      playTone('listen', mutedRef.current)
      actionsRef.current.openPanel?.()
      if (rest.length > 1) {
        actionsRef.current.send?.(rest)
      } else {
        actionsRef.current.announce?.(
          langRef.current === 'kg' ? 'Ооба, сэр. Угуп жатам.' : 'Да, сэр. Слушаю.',
        )
      }
    }
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceError(
          langRef.current === 'kg'
            ? 'Микрофонго уруксат берилген жок.'
            : 'Доступ к микрофону не разрешён.',
        )
        stopWake()
      }
    }
    recognition.onend = () => {
      setListening(false)
      setTranscript('')
      handledRef.current = false
      if (wakeOnRef.current) {
        restartRef.current = setTimeout(() => {
          try {
            recognition.start()
          } catch {
            /* restart can race with the browser shutting the stream down */
          }
        }, 500)
      }
    }

    recognitionRef.current = recognition
    wakeOnRef.current = true
    setWakeMode(true)
    setVoiceError('')
    try {
      recognition.start()
    } catch {
      stopWake()
      setVoiceError(
        langRef.current === 'kg'
          ? 'Үн таанууну баштоо мүмкүн болбоду.'
          : 'Не удалось запустить распознавание речи.',
      )
    }
  }, [stopWake])

  const toggleWake = useCallback(() => {
    if (wakeOnRef.current) stopWake()
    else startWake()
  }, [startWake, stopWake])

  const listenOnce = useCallback(() => {
    if (pttRef.current) {
      try {
        pttRef.current.onend = null
        pttRef.current.stop()
      } catch {
        /* already stopped */
      }
      pttRef.current = null
      setListening(false)
      return
    }
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setVoiceError(
        langRef.current === 'kg'
          ? 'Бул браузер үн таанууну колдобойт.'
          : 'Этот браузер не поддерживает распознавание речи.',
      )
      return
    }

    const wake = recognitionRef.current
    if (wake) {
      try {
        wake.onend = null
        wake.abort()
      } catch {
        /* ignore */
      }
      recognitionRef.current = null
    }
    clearTimeout(restartRef.current)

    const recognition = new Ctor()
    let finalText = ''
    recognition.lang = 'ru-RU'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setVoiceError('')
      setListening(true)
      setTranscript('')
      playTone('listen', mutedRef.current)
    }
    recognition.onresult = (event) => {
      let interim = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const chunk = result[0]?.transcript || ''
        if (result.isFinal) finalText += ` ${chunk}`
        else interim += chunk
      }
      setTranscript(`${finalText} ${interim}`.replace(/\s+/g, ' ').trim())
    }
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceError(
          langRef.current === 'kg'
            ? 'Микрофонго уруксат берилген жок.'
            : 'Доступ к микрофону не разрешён.',
        )
      }
    }
    recognition.onend = () => {
      setListening(false)
      setTranscript('')
      pttRef.current = null
      const heard = finalText.replace(/\s+/g, ' ').trim()
      if (heard) {
        const { wake: hasWake, rest } = detectWakeWord(heard)
        const message = hasWake && rest ? rest : heard
        if (message) actionsRef.current.send?.(message)
        else actionsRef.current.announce?.(
          langRef.current === 'kg' ? 'Ооба, сэр. Угуп жатам.' : 'Да, сэр. Слушаю.',
        )
      }
      if (wakeOnRef.current) {
        restartRef.current = setTimeout(() => actionsRef.current.startWake?.(), 550)
      }
    }

    pttRef.current = recognition
    try {
      recognition.start()
    } catch {
      pttRef.current = null
      setVoiceError(
        langRef.current === 'kg'
          ? 'Үн таанууну баштоо мүмкүн болбоду.'
          : 'Не удалось запустить распознавание речи.',
      )
    }
  }, [])

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
  }

  useEffect(
    () => () => {
      stopWake()
      stopSpeaking()
      clearTimeout(restartRef.current)
      clearTimeout(handledResetRef.current)
    },
    [stopSpeaking, stopWake],
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
