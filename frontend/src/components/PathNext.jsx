import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Route } from 'lucide-react'
import { useApp, useBi } from '../state/AppContext'
import { pick } from '../lib/format'
import { stepTitle, stepUrl } from '../lib/path'

export default function PathNext({ pathInfo }) {
  const { data, lang } = useApp()
  const bi = useBi()
  if (!pathInfo) return null
  const { path, steps, index, next } = pathInfo
  const title = next ? stepTitle(next, data, lang) : pick(path.title, lang)
  const note = next
    ? pick(next.sectionTitle, lang)
    : bi('Все шаги маршрута пройдены.', 'Маршруттун бардык кадамдары өтүлдү.')

  return (
    <section className="path-next">
      <div className={`path-next-mark ${next ? '' : 'done'}`}>
        {next ? <Route size={20} /> : <CheckCircle2 size={20} />}
      </div>
      <div className="path-next-copy">
        <span>
          {next
            ? `${bi('Следующий шаг', 'Кийинки кадам')} ${index + 2} / ${steps.length}`
            : bi('Маршрут завершён', 'Маршрут аяктады')}
        </span>
        <strong>{title}</strong>
        <small>{note}</small>
      </div>
      <Link className="btn btn-primary" to={next ? stepUrl(next, path.slug) : '/start'}>
        {next ? bi('Продолжить', 'Улантуу') : bi('К маршруту', 'Маршрутка')}
        <ArrowRight size={16} />
      </Link>
    </section>
  )
}
