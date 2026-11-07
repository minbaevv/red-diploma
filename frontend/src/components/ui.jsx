import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import {
  BarChart3,
  BookOpen,
  Code2,
  Database,
  Eye,
  GitBranch,
  Lightbulb,
  Server,
  Sparkles,
  Target,
  Terminal,
  Trophy,
} from 'lucide-react'
import { useBi } from '../state/AppContext'

const iconMap = {
  code: Code2,
  function: Code2,
  'git-branch': GitBranch,
  database: Database,
  terminal: Terminal,
  server: Server,
  chart: BarChart3,
  eye: Eye,
  spark: Sparkles,
  target: Target,
  book: BookOpen,
  trophy: Trophy,
}

export function ModuleIcon({ name, size = 20 }) {
  const Icon = iconMap[name] || BookOpen
  return <Icon size={size} strokeWidth={1.8} />
}

export function ProgressRing({ value = 0, label, size = 156 }) {
  const safe = Math.max(0, Math.min(100, value))
  return (
    <div
      className="progress-ring"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--ring-color, var(--violet)) ${safe * 3.6}deg, var(--ring-track, rgba(255,255,255,.08)) 0deg)`,
      }}
    >
      <div className="progress-ring-inner">
        <strong>{safe}%</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>
}

export function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </header>
  )
}

export function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({ label, value, hint, tone = 'light', icon: Icon }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-top">
        <span>{label}</span>
        {Icon && <Icon size={18} />}
      </div>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  )
}

export function Markdown({ children }) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {children || ''}
      </ReactMarkdown>
    </div>
  )
}

export function InlineMarkdown({ children }) {
  return (
    <span className="inline-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: (props) => <span {...props} />,
          a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {children || ''}
      </ReactMarkdown>
    </span>
  )
}

export function CodeEditor({ value, onChange, height = '330px', readOnly = false }) {
  return (
    <div className="code-shell">
      <CodeMirror
        value={value}
        height={height}
        theme="dark"
        readOnly={readOnly}
        extensions={[python()]}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: false,
          bracketMatching: true,
        }}
      />
    </div>
  )
}

export function HintList({ hints = [] }) {
  const [open, setOpen] = useState([])
  const bi = useBi()
  if (!hints.length) return null

  function toggle(index) {
    setOpen((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    )
  }

  return (
    <div className="hints">
      <div className="hints-head">
        <Lightbulb size={16} />
        <span>{bi('Подсказки — по одной', 'Подсказкалар — бирден')}</span>
      </div>
      {hints.map((hint, index) => {
        const isOpen = open.includes(index)
        return (
          <div className={`hint ${isOpen ? 'open' : ''}`} key={index}>
            <button onClick={() => toggle(index)}>
              <span>{bi('Подсказка', 'Подсказка')} {index + 1}</span>
              <span>{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && <p>{bi(hint.ru, hint.kg)}</p>}
          </div>
        )
      })}
    </div>
  )
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="empty-state">
      <div className="empty-mark">—</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function ScoreBar({ score = 0, max = 100, tone = 'red' }) {
  const percent = max ? Math.round((score / max) * 100) : 0
  return (
    <div className="score-bar">
      <div className="score-bar-track">
        <div className={`score-bar-fill ${tone}`} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      <span>{score} / {max}</span>
    </div>
  )
}
