export const WAKE_WORDS = ['джарвис', 'жарвис', 'jarvis']

export function getRecognitionCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export function recognitionSupported() {
  return Boolean(getRecognitionCtor())
}

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function detectWakeWord(text) {
  const value = String(text || '').trim()
  if (!value) return { wake: false, rest: '' }
  const pattern = /(^|[\s,.;:!?—–-])(джарвис|жарвис|jarvis)(?=$|[\s,.;:!?—–-])/i
  const match = value.match(pattern)
  if (!match) return { wake: false, rest: '' }
  const end = match.index + match[0].length
  return {
    wake: true,
    rest: value.slice(end).replace(/^[\s,.;:!?—–-]+/, '').trim(),
  }
}

export function cleanForSpeech(markdown = '') {
  let text = String(markdown || '')
  text = text.replace(/```[\s\S]*?```/g, ' ')
  text = text.replace(/`([^`]*)`/g, '$1')
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  text = text.replace(/^#{1,6}\s+/gm, '')
  text = text.replace(/[*_~>|]/g, ' ')
  text = text.replace(/^\s*[-–—]\s+/gm, '')
  text = text.replace(/\s+/g, ' ').trim()
  if (text.length > 900) {
    const cut = text.slice(0, 900)
    const boundary = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
    text = boundary > 300 ? cut.slice(0, boundary + 1) : `${cut}…`
  }
  return text
}

function pickVoice(voices, lang) {
  const prefixes = lang === 'kg' ? ['ky', 'ru'] : ['ru']
  const candidates = voices.filter((voice) =>
    prefixes.some((prefix) => String(voice.lang || '').toLowerCase().startsWith(prefix)),
  )
  const preferred = /dmitry|yuri|pavel|george|daniel|alex|male|муж/i
  return (
    candidates.find((voice) => preferred.test(voice.name || '')) ||
    candidates[0] ||
    null
  )
}

export function speakBrowser(text, lang, handlers = {}) {
  if (!speechSupported()) {
    handlers.onEnd?.()
    return null
  }
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang === 'kg' ? 'ky-KG' : 'ru-RU'
  utterance.rate = 1.02
  utterance.pitch = 0.82
  utterance.volume = 1
  const voice = pickVoice(synth.getVoices(), lang)
  if (voice) utterance.voice = voice

  // Some browsers queue an utterance but never fire `end` (no voice pack,
  // hidden tab, audio device removed). Never leave the orb stuck "speaking".
  let finished = false
  let safety = 0
  const finish = () => {
    if (finished) return
    finished = true
    clearTimeout(safety)
    handlers.onEnd?.()
  }

  utterance.onstart = () => handlers.onStart?.()
  utterance.onend = finish
  utterance.onerror = finish
  safety = setTimeout(finish, Math.min(60_000, Math.max(5_000, text.length * 110)))
  synth.speak(utterance)
  return utterance
}

export function stopBrowserSpeech() {
  try {
    window.speechSynthesis?.cancel()
  } catch {
    /* speech synthesis can be unavailable in some browsers */
  }
}

let audioContext = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  if (!audioContext) audioContext = new Ctor()
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {})
  return audioContext
}

export function playTone(kind = 'chirp', muted = false) {
  if (muted) return
  const context = getAudioContext()
  if (!context) return
  const now = context.currentTime
  const notes = {
    open: [220, 440, 660],
    listen: [660, 880],
    send: [520],
    close: [440, 220],
    speak: [392, 523],
  }[kind] || [520]
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, now + index * 0.06)
    gain.gain.setValueAtTime(0.0001, now + index * 0.06)
    gain.gain.exponentialRampToValueAtTime(0.035, now + index * 0.06 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.06 + 0.18)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(now + index * 0.06)
    oscillator.stop(now + index * 0.06 + 0.2)
  })
}

export function playBootSequence(muted = false) {
  if (muted) return
  const context = getAudioContext()
  if (!context) return
  const now = context.currentTime
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'triangle'
  oscillator.frequency.setValueAtTime(70, now)
  oscillator.frequency.exponentialRampToValueAtTime(240, now + 1.1)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.05, now + 0.18)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.25)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + 1.3)
}
