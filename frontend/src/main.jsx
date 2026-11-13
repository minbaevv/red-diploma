import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AppProvider } from './state/AppContext'
import { JarvisProvider } from './state/JarvisContext'
import '@fontsource-variable/manrope'
import '@fontsource-variable/unbounded'
import '@fontsource-variable/jetbrains-mono'
import './styles.css'
import './theme.css'
import './components/jarvis/jarvis.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <JarvisProvider>
          <App />
        </JarvisProvider>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
