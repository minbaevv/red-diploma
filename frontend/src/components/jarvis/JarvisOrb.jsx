import { useEffect, useRef } from 'react'

const PALETTE = {
  boot: { a: '#22d3ee', b: '#a5f3fc', glow: 'rgba(34, 211, 238, 0.55)' },
  idle: { a: '#22d3ee', b: '#67e8f9', glow: 'rgba(34, 211, 238, 0.42)' },
  listening: { a: '#34d399', b: '#a7f3d0', glow: 'rgba(52, 211, 153, 0.55)' },
  thinking: { a: '#a78bfa', b: '#ddd6fe', glow: 'rgba(167, 139, 250, 0.55)' },
  speaking: { a: '#22d3ee', b: '#cffafe', glow: 'rgba(34, 211, 238, 0.6)' },
  error: { a: '#fb7185', b: '#fecdd3', glow: 'rgba(251, 113, 133, 0.5)' },
}

function makeParticles(count) {
  return Array.from({ length: count }, (_, index) => {
    const seed = (index * 9301 + 49297) % 233280
    const random = seed / 233280
    return {
      angle: random * Math.PI * 2,
      radius: 0.56 + ((index * 37) % 100) / 230,
      speed: (0.08 + random * 0.22) * (index % 2 === 0 ? 1 : -1),
      size: 0.7 + random * 1.7,
      alpha: 0.22 + random * 0.6,
      depth: 0.4 + random * 0.6,
    }
  })
}

const PARTICLES = makeParticles(84)

function arc(ctx, cx, cy, radius, start, end, color, width, alpha, dash = []) {
  ctx.save()
  ctx.beginPath()
  ctx.setLineDash(dash)
  ctx.lineWidth = width
  ctx.strokeStyle = color
  ctx.globalAlpha = alpha
  ctx.arc(cx, cy, radius, start, end)
  ctx.stroke()
  ctx.restore()
}

export default function JarvisOrb({ state = 'idle', size = 'normal' }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d')
    if (!context) return undefined

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

    let frame = 0
    let width = 0
    let height = 0

    function resize() {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    observer?.observe(canvas)

    function draw(time) {
      const current = stateRef.current
      const palette = PALETTE[current] || PALETTE.idle
      const cx = width / 2
      const cy = height / 2
      const basis = Math.min(width, height)
      const radius = basis * 0.43
      const t = time / 1000
      const active = current === 'speaking' || current === 'listening'
      const thinking = current === 'thinking'
      const speed = thinking ? 1.9 : active ? 1.35 : 1

      context.clearRect(0, 0, width, height)

      const halo = context.createRadialGradient(cx, cy, 0, cx, cy, basis * 0.55)
      halo.addColorStop(0, palette.glow)
      halo.addColorStop(0.42, palette.glow.replace(/0?\.\d+\)/, '0.12)'))
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)')
      context.save()
      context.globalAlpha = active ? 0.95 : 0.7
      context.fillStyle = halo
      context.fillRect(0, 0, width, height)
      context.restore()

      context.save()
      context.translate(cx, cy)

      // Outer tick ring.
      const ticks = 88
      for (let index = 0; index < ticks; index += 1) {
        const angle = (index / ticks) * Math.PI * 2 + t * 0.06 * speed
        const major = index % 11 === 0
        const inner = radius * (major ? 0.94 : 0.965)
        const outer = radius * (major ? 1.03 : 1.005)
        context.beginPath()
        context.globalAlpha = major ? 0.72 : 0.24
        context.strokeStyle = palette.a
        context.lineWidth = major ? 1.4 : 0.7
        context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
        context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
        context.stroke()
      }
      context.globalAlpha = 1

      // Rotating dashed rings.
      arc(context, 0, 0, radius, t * 0.35 * speed, t * 0.35 * speed + Math.PI * 1.28, palette.a, 1.1, 0.5)
      arc(
        context,
        0,
        0,
        radius * 0.9,
        -t * 0.5 * speed,
        -t * 0.5 * speed + Math.PI * 1.05,
        palette.b,
        1.6,
        0.42,
        [2, 9],
      )
      arc(
        context,
        0,
        0,
        radius * 0.82,
        t * 0.8 * speed + 1.1,
        t * 0.8 * speed + Math.PI * 1.5,
        palette.a,
        2.4,
        0.65,
        [26, 14, 6, 14],
      )

      // Thinking scanner.
      if (thinking) {
        arc(
          context,
          0,
          0,
          radius * 0.7,
          t * 2.4,
          t * 2.4 + 0.55,
          '#ffffff',
          2,
          0.8,
        )
      }

      // Listening pulses.
      if (current === 'listening') {
        for (let index = 0; index < 3; index += 1) {
          const progress = ((t * 0.55 + index / 3) % 1)
          arc(
            context,
            0,
            0,
            radius * (0.55 + progress * 0.55),
            0,
            Math.PI * 2,
            palette.a,
            1.2,
            (1 - progress) * 0.5,
          )
        }
      }

      // Orbiting particles.
      for (const particle of PARTICLES) {
        const angle = particle.angle + t * particle.speed * speed
        const orbit = radius * particle.radius
        const x = Math.cos(angle) * orbit
        const y = Math.sin(angle) * orbit * 0.94
        const twinkle = 0.55 + Math.sin(t * 2.4 + particle.angle * 5) * 0.45
        context.beginPath()
        context.globalAlpha = particle.alpha * twinkle * particle.depth
        context.fillStyle = palette.b
        context.arc(x, y, particle.size, 0, Math.PI * 2)
        context.fill()
      }
      context.globalAlpha = 1

      // Waveform crown.
      if (active) {
        const bars = 64
        for (let index = 0; index < bars; index += 1) {
          const angle = (index / bars) * Math.PI * 2 - Math.PI / 2
          const wave =
            0.35 +
            Math.abs(Math.sin(t * 6.4 + index * 0.55)) * 0.5 +
            Math.abs(Math.sin(t * 11.3 + index * 1.7)) * 0.15
          const length = radius * 0.16 * wave
          const inner = radius * 0.6
          context.beginPath()
          context.globalAlpha = 0.28 + wave * 0.55
          context.strokeStyle = palette.b
          context.lineWidth = 1.6
          context.lineCap = 'round'
          context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
          context.lineTo(
            Math.cos(angle) * (inner + length),
            Math.sin(angle) * (inner + length),
          )
          context.stroke()
        }
        context.globalAlpha = 1
      }

      // Core rings.
      arc(context, 0, 0, radius * 0.56, 0, Math.PI * 2, palette.a, 1.2, 0.55)
      arc(
        context,
        0,
        0,
        radius * 0.46,
        -t * 1.1 * speed,
        -t * 1.1 * speed + Math.PI * 0.72,
        palette.b,
        2,
        0.75,
      )
      arc(
        context,
        0,
        0,
        radius * 0.46,
        Math.PI - t * 1.1 * speed,
        Math.PI - t * 1.1 * speed + Math.PI * 0.72,
        palette.b,
        2,
        0.75,
      )

      const corePulse = active ? 0.92 + Math.sin(t * 7) * 0.08 : 0.88 + Math.sin(t * 1.6) * 0.05
      const core = context.createRadialGradient(0, 0, 0, 0, 0, radius * 0.4)
      core.addColorStop(0, 'rgba(255, 255, 255, 0.98)')
      core.addColorStop(0.16, palette.b)
      core.addColorStop(0.44, palette.a)
      core.addColorStop(0.75, 'rgba(8, 20, 34, 0.85)')
      core.addColorStop(1, 'rgba(4, 10, 20, 0)')
      context.save()
      context.globalAlpha = corePulse
      context.fillStyle = core
      context.beginPath()
      context.arc(0, 0, radius * 0.4, 0, Math.PI * 2)
      context.fill()
      context.restore()

      // Reactor spokes.
      for (let index = 0; index < 3; index += 1) {
        const angle = (index / 3) * Math.PI * 2 + t * 0.4 * speed
        context.beginPath()
        context.globalAlpha = 0.5
        context.strokeStyle = palette.b
        context.lineWidth = 1
        context.moveTo(Math.cos(angle) * radius * 0.13, Math.sin(angle) * radius * 0.13)
        context.lineTo(Math.cos(angle) * radius * 0.31, Math.sin(angle) * radius * 0.31)
        context.stroke()
      }

      context.beginPath()
      context.globalAlpha = 0.9
      context.fillStyle = '#ffffff'
      context.arc(0, 0, Math.max(1.6, radius * 0.028), 0, Math.PI * 2)
      context.fill()
      context.restore()
    }

    function loop(time) {
      draw(time)
      frame = requestAnimationFrame(loop)
    }

    if (reduced) {
      draw(1200)
    } else {
      frame = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [])

  return (
    <div className={`jarvis-orb jarvis-orb-${state} jarvis-orb-${size}`}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <span className="jarvis-orb-scan" aria-hidden="true" />
    </div>
  )
}
