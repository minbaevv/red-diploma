import { Route, Routes } from 'react-router-dom'
import Shell from './components/Shell'
import Dashboard from './pages/Dashboard'
import Learn from './pages/Learn'
import ModulePage from './pages/ModulePage'
import LessonPage from './pages/LessonPage'
import Practice from './pages/Practice'
import TaskPage from './pages/TaskPage'
import Exams from './pages/Exams'
import ExamPage from './pages/ExamPage'
import Mistakes from './pages/Mistakes'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="learn" element={<Learn />} />
        <Route path="learn/:slug" element={<ModulePage />} />
        <Route path="lesson/:slug" element={<LessonPage />} />
        <Route path="practice" element={<Practice />} />
        <Route path="task/:slug" element={<TaskPage />} />
        <Route path="exams" element={<Exams />} />
        <Route path="exam/:slug" element={<ExamPage />} />
        <Route path="mistakes" element={<Mistakes />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
