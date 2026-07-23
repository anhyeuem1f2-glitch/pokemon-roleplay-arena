import React from 'react'
import { useGame } from '../context/GameContext.jsx'

const NAV_ITEMS = [
  { id: 'setup', label: 'Cài đặt API' },
  { id: 'chat', label: 'Roleplay' },
  { id: 'battle', label: 'Chiến đấu (demo)' },
]

export default function Sidebar({ view, setView }) {
  const { apiConfig } = useGame()
  const connected = Boolean(apiConfig.baseUrl && apiConfig.model)

  return (
    <nav className="sidebar">
      <div className="sidebar__brand">
        TRAINER ARENA
        <span>roleplay × battle engine</span>
      </div>

      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          className="nav-btn"
          data-active={view === item.id}
          onClick={() => setView(item.id)}
        >
          <span className="nav-btn__dot" />
          {item.label}
        </button>
      ))}

      <div className="sidebar__status">
        {connected ? (
          <>Model: <strong style={{ color: 'var(--text-mid)' }}>{apiConfig.model}</strong></>
        ) : (
          'Chưa cấu hình API'
        )}
      </div>
    </nav>
  )
}
