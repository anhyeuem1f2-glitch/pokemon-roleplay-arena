import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import MusicController from './components/MusicController.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { GameProvider } from './context/GameContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
    <GameProvider>
      {/* Điều phối nhạc nền (đợt 28) — mount ở đây để chạy trên MỌI màn
          hình (title / truyện / Dev / Settings), không phụ thuộc App return
          sớm ở nhánh nào. */}
      <MusicController />
      <App />
    </GameProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
