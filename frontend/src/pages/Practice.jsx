import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useApp, useBi } from '../state/AppContext'
import { isDone, pick, pluralRu, progressIndex } from '../lib/format'
import TaskCard from '../components/TaskCard'
import { PageHeader } from '../components/ui'

const filters = [
  { id: 'all', ru: 'Все', kg: 'Баары' },
  { id: 'code', ru: 'Код', kg: 'Код' },
  { id: 'theory', ru: 'Теория', kg: 'Теория' },
]

export default function Practice() {
  const { data, lang } = useApp()
  const bi = useBi()
  const [type, setType] = useState('all')
  const [query, setQuery] = useState('')
  const index = progressIndex(data.progress)
  const moduleTitles = new Map(data.modules.map((module) => [module.slug, module.title]))

  const tasks = useMemo(() => {
    const term = query.trim().toLowerCase()
    return data.tasks.filter((task) => {
      if (type !== 'all' && task.type !== type) return false
      if (!term) return true
      return [task.title?.ru, task.title?.kg, task.prompt?.ru, task.prompt?.kg, task.slug]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    })
  }, [data.tasks, query, type])

  return (
    <div className="page">
      <PageHeader
        eyebrow={bi('Тренажёр', 'Тренажёр')}
        title={bi('Практика', 'Практика')}
        subtitle={bi(
          'Код проверяется тестами, теория — по модели ответа. Ошибки попадут в отдельный разбор.',
          'Код тесттер менен, теория моделдик жооп менен текшерилет. Каталар өзүнчө талдоого түшөт.',
        )}
      />

      <div className="practice-toolbar">
        <div className="filter-tabs compact">
          {filters.map((item) => (
            <button
              key={item.id}
              className={type === item.id ? 'active' : ''}
              onClick={() => setType(item.id)}
            >
              {bi(item.ru, item.kg)}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            placeholder={bi('Найти задачу…', 'Тапшырма издөө…')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="practice-count">
        {tasks.length} {bi(pluralRu(tasks.length, 'задача', 'задачи', 'задач'), 'тапшырма')} · {tasks.filter((task) => isDone(index, 'task', task.slug)).length} {bi('решено', 'чечилди')}
      </div>

      <div className="task-list">
        {tasks.map((task) => (
          <TaskCard
            key={task.slug}
            task={task}
            done={isDone(index, 'task', task.slug)}
            moduleTitle={pick(moduleTitles.get(task.module), lang)}
          />
        ))}
      </div>
    </div>
  )
}
