import { useMemo, useState } from 'react'
import { Layers3 } from 'lucide-react'
import { useApp, useBi } from '../state/AppContext'
import { isDone, moduleProgress, pluralRu, progressIndex } from '../lib/format'
import ModuleCard from '../components/ModuleCard'
import { PageHeader } from '../components/ui'

const tracks = [
  { id: 'all', ru: 'Все', kg: 'Баары' },
  { id: 'python', ru: 'Python', kg: 'Python' },
  { id: 'backend', ru: 'Backend', kg: 'Backend' },
  { id: 'ai', ru: 'AI', kg: 'AI' },
  { id: 'tools', ru: 'Инструменты', kg: 'Куралдар' },
]

export default function Learn() {
  const { data, stats } = useApp()
  const bi = useBi()
  const [track, setTrack] = useState('all')
  const index = progressIndex(data.progress)
  const modules = useMemo(
    () => data.modules.filter((module) => track === 'all' || module.track === track),
    [data.modules, track],
  )
  const moduleWord = pluralRu(data.modules.length, 'модуль', 'модуля', 'модулей')

  return (
    <div className="page">
      <PageHeader
        eyebrow={bi('Учебный маршрут', 'Окуу маршруту')}
        title={bi('Карта знаний', 'Билим картасы')}
        subtitle={bi(
          `${data.modules.length} ${moduleWord} от переменных до YOLO и RAG. Начни с того, где меньше всего прогресса.`,
          `${data.modules.length} модуль: өзгөрмөлөрдөн YOLO жана RAGга чейин. Прогресс аз жерден башта.`,
        )}
        action={
          <div className="learn-summary">
            <Layers3 size={18} />
            <span>{stats.lessons_done}/{stats.total_lessons} {bi(pluralRu(stats.total_lessons, 'урок', 'урока', 'уроков'), 'сабак')}</span>
          </div>
        }
      />

      <div className="filter-tabs">
        {tracks.map((item) => (
          <button
            key={item.id}
            className={track === item.id ? 'active' : ''}
            onClick={() => setTrack(item.id)}
          >
            {bi(item.ru, item.kg)}
          </button>
        ))}
      </div>

      <div className="module-grid wide">
        {modules.map((module) => {
          const total = (module.lessons?.length || 0) + (module.task_slugs?.length || 0)
          const done =
            (module.lessons || []).filter((lesson) => isDone(index, 'lesson', lesson.slug)).length +
            (module.task_slugs || []).filter((slug) => isDone(index, 'task', slug)).length
          return (
            <ModuleCard
              key={module.slug}
              module={module}
              progress={moduleProgress(module, index)}
              done={done}
              total={total}
            />
          )
        })}
      </div>
    </div>
  )
}
