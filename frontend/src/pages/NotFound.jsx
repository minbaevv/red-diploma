import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useBi } from '../state/AppContext'

export default function NotFound() {
  const bi = useBi()
  return (
    <div className="not-found">
      <div className="not-found-code">404</div>
      <h1>{bi('Этой страницы нет в билете.', 'Бул барак билетте жок.')}</h1>
      <p>{bi('Вернись к карте знаний и продолжай.', 'Билим картасына кайтып, улант.')}</p>
      <Link className="btn btn-primary" to="/">
        <ArrowLeft size={16} /> {bi('На главную', 'Башкы бетке')}
      </Link>
    </div>
  )
}
