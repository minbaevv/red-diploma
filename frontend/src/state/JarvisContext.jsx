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
  const handledRef = useRef(false)
  const handledResetRef = useRef(null)
  const conversationRef = useRef(false)
  const conversationTimerRef = useRef(null)
  const emptyTurnsRef = useRef(0)
  const speakingRef = useRef(false)
  const conversationResumeRef = useRef(() => {})
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
    clearTimeout(conversationTimerRef.current)
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
    if (wakeOnRef.current) {
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
    if (conversationRef.current) {
      conversationRef.current = false
      setConversation(false)
      clearTimeout(conversationTimerRef.current)
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
      stopSpeaking()
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
      // Never let Jarvis's own voice trigger the wake word.
      if (speakingRef.current || busyRef.current) return
      if (handledRef.current) return
      const { wake, rest } = detectWakeWord(heard)
      if (!wake) return
      handledRef.current = true
      clearTimeout(handledResetRef.current)
      handledResetRef.current = setTimeout(() => {
        handledRef.current = false
      }, 1500)
      playTone('listen', mutedRef.current)
      actionsRef.current.startConversation?.(rest)
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
      if (wakeOnRef.current && !conversationRef.current) {
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
  }, [stopSpeaking, stopWake])

  const toggleWake = useCallback(() => {
    if (wakeOnRef.current) stopWake()
    else startWake()
  }, [startWake, stopWake])

  const listenOnce = useCallback(() => {
    if (pttRef.current) {
      try {
        pttRef.current.onend = null
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
        if (conversationRef.current) stopConversation()
      }
    }
    recognition.onend = () => {
      setListening(false)
      setTranscript('')
      pttRef.current = null
      const heard = finalText.replace(/\s+/g, ' ').trim()
      if (heard) {
        emptyTurnsRef.current = 0
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
      } else if (conversationRef.current) {
        emptyTurnsRef.current += 1
        if (emptyTurnsRef.current <= 2) {
          setVoiceError(
            langRef.current === 'kg' ? 'Угуп жатам… сүйлөңүз.' : 'Слушаю… говорите.',
          )
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
        }
      }
      if (!conversationRef.current && wakeOnRef.current) {
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
  }, [stopConversation])

  conversationResumeRef.current = () => {
    if (!conversationRef.current) return
    clearTimeout(conversationTimerRef.current)
    conversationTimerRef.current = setTimeout(() => {
      if (conversationRef.current) actionsRef.current.listen?.()
    }, 350)
  }

  const startConversation = useCallback(
    (initialMessage = '') => {
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
          wake.onend = null
          wake.abort()
        } catch {
          /* wake recognition may already be stopped */
        }
        recognitionRef.current = null
      }
      const phrase = String(initialMessage || '').trim()
      if (phrase) {
        send(phrase)
      } else {
        announce(langRef.current === 'kg' ? 'Ооба, сэр. Угуп жатам.' : 'Да, сэр. Слушаю.', {
          onEnd: () => conversationResumeRef.current(),
        })
      }
    },
    [announce, openPanel, send, stopSpeaking],
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
    listen: listenOnce,
    startConversation,
    stopConversation,
  }

  useEffect(
    () => () => {
      stopWake()
      stopConversation()
      stopSpeaking()
      clearTimeout(restartRef.current)
      clearTimeout(handledResetRef.current)
      clearTimeout(conversationTimerRef.current)
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
