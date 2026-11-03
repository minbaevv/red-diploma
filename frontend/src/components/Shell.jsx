import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Compass,
  Dumbbell,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Settings,
  Trophy,
  X,
} from 'lucide-react'
import { useApp, useBi } from '../state/AppContext'
import { api } from '../api'
import { daysLeft, daysWord, formatDate } from '../lib/format'

const nav = [
  { to: '/', end: true, icon: LayoutDashboard, ru: 'Обзор', kg: 'Көрүнүш' },
  { to: '/start', icon: Compass, ru: 'Старт', kg: 'Старт' },
  { to: '/learn', icon: BookOpen, ru: 'Обучение', kg: 'Окуу' },
  { to: '/practice', icon: Dumbbell, ru: 'Практика', kg: 'Практика' },
  { to: '/exams', icon: Trophy, ru: 'Экзамены', kg: 'Экзамендер' },
  { to: '/mistakes', icon: AlertTriangle, ru: 'Ошибки', kg: 'Каталар' },
]

const titles = {
  '/': { ru: 'Обзор', kg: 'Көрүнүш' },
  '/start': { ru: 'Старт', kg: 'Старт' },
  '/learn': { ru: 'Обучение', kg: 'Окуу' },
  '/practice': { ru: 'Практика', kg: 'Практика' },
  '/exams': { ru: 'Экзамены', kg: 'Экзамендер' },
  '/mistakes': { ru: 'Разбор ошибок', kg: 'Каталарды талдоо' },
}

function pageTitle(pathname, bi) {
  if (titles[pathname]) return bi(titles[pathname].ru, titles[pathname].kg)
  if (pathname.startsWith('/exam/')) return bi('Экзамен', 'Экзамен')
  if (pathname.startsWith('/task/')) return bi('Задача', 'Тапшырма')
  if (pathname.startsWith('/lesson/')) return bi('Урок', 'Сабак')
  if (pathname.startsWith('/learn/')) return bi('Модуль', 'Модуль')
  return bi('Красный диплом', 'Кызыл диплом')
}

export default function Shell() {
  const { data, loading, error, lang, setLanguage, refresh, settings } = useApp()
  const bi = useBi()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => setOpen(false), [location.pathname])

  if (loading) {
    return (
      <div className="boot-screen">
        <div className="boot-mark">КД</div>
        <p>{bi('Собираем твой экзамен-кокпит…', 'Экзамен-кокпитиңди куруп жатабыз…')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="boot-screen">
        <div className="boot-mark">!</div>
        <h1>{bi('Backend не отвечает', 'Backend жооп бербейт')}</h1>
        <p className="muted">{error}</p>
        <code>cd backend && py -3.13 -m uvicorn app.main:app --reload</code>
        <button className="btn btn-primary" onClick={() => refresh(false)}>
          {bi('Попробовать снова', 'Кайра аракет кылуу')}
        </button>
      </div>
    )
  }

  const left = daysLeft(settings.exam_date || data?.meta?.exam_date)

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">КД</div>
          <div>
            <div className="brand-name">{bi('Красный диплом', 'Кызыл диплом')}</div>
            <div className="brand-sub">{bi('backend + AI', 'backend + AI')}</div>
          </div>
        </div>

        <nav className="nav">
          {nav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{bi(item.ru, item.kg)}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="exam-mini">
            <CalendarDays size={16} />
            <div>
              <div className="exam-mini-label">{bi('До экзамена', 'Экзаменге чейин')}</div>
              <strong>{left === null ? '—' : `${left} ${bi(daysWord(left), 'күн')}`}</strong>
            </div>
          </div>
          <div className="sidebar-date">{formatDate(settings.exam_date, lang)}</div>
          <button className="settings-link" onClick={() => setSettingsOpen(true)}>
            <Settings size={16} />
            {bi('Настройки', 'Жөндөөлөр')}
          </button>
        </div>
      </aside>

      {open && <button className="scrim" aria-label="close" onClick={() => setOpen(false)} />}

      <div className="main-area">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setOpen((value) => !value)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="topbar-title">{pageTitle(location.pathname, bi)}</div>
          <div className="topbar-actions">
            <div className="lang-switch" aria-label="Language">
              <button className={lang === 'ru' ? 'active' : ''} onClick={() => setLanguage('ru')}>
                RU
              </button>
              <button className={lang === 'kg' ? 'active' : ''} onClick={() => setLanguage('kg')}>
                KG
              </button>
            </div>
            <button className="profile-chip" onClick={() => setSettingsOpen(true)}>
              <span className="profile-avatar">
                {(settings.student_name || 'S').slice(0, 1).toUpperCase()}
              </span>
              <span>{settings.student_name || 'Student'}</span>
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onSaved={() => refresh(true)}
        />
      )}
    </div>
  )
}

function SettingsModal({ onClose, onSaved }) {
  const { settings, lang, setLanguage } = useApp()
  const bi = useBi()
  const [name, setName] = useState(settings.student_name || 'Student')
  const [date, setDate] = useState(settings.exam_date || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await api.updateSettings({
        student_name: name,
        exam_date: date,
        language: lang,
      })
      await onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-wrap" role="dialog" aria-modal="true">
      <button className="scrim" aria-label="close" onClick={onClose} />
      <div className="modal">
        <div className="modal-head">
          <div>
            <div className="eyebrow">{bi('Личный режим', 'Жеке режим')}</div>
            <h2>{bi('Настройки', 'Жөндөөлөр')}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <label className="field">
          <span>{bi('Имя', 'Атың')}</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="field">
          <span>{bi('Дата экзамена', 'Экзамен күнү')}</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <div className="field">
          <span>{bi('Язык', 'Тил')}</span>
          <div className="lang-switch large">
            <button className={lang === 'ru' ? 'active' : ''} onClick={() => setLanguage('ru')}>
              Русский
            </button>
            <button className={lang === 'kg' ? 'active' : ''} onClick={() => setLanguage('kg')}>
              Кыргызча
            </button>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            {bi('Отмена', 'Жокко чыгаруу')}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? bi('Сохраняем…', 'Сактап жатабыз…') : bi('Сохранить', 'Сактоо')}
          </button>
        </div>
      </div>
    </div>
  )
}
