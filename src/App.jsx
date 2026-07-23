import React, { useState, useEffect } from 'react'
import { useGame } from './context/GameContext.jsx'
import RoleplayChat from './components/RoleplayChat.jsx'
import IntroScreen from './components/IntroScreen.jsx'
import SettingsPage from './components/SettingsPage.jsx'
import DevPage from './components/DevPage.jsx'
import PlayerHUD from './components/PlayerHUD.jsx'
import RightHUD from './components/RightHUD.jsx'

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

// ===== CỜ PUBLIC BETA (đợt 49) =====
// Nút "Chế độ Dev" mặc định ẨN Ở MỌI NƠI (kể cả chạy local) — KHÔNG còn dựa
// vào import.meta.env.PROD nữa (thực chiến: build trên Netlify không đảm
// bảo biến env như kỳ vọng → nút vẫn lộ trên bản deploy). Cách duy nhất
// mở Dev: thêm ?dev=1 vào URL (VD http://localhost:5173/?dev=1 hoặc
// https://ten-site.netlify.app/?dev=1) — deterministic, môi trường nào
// cũng vậy, người chơi thường không bao giờ thấy.
const SHOW_DEV_MODE =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('dev')


// ===== MOBILE (đợt 53) =====
// Bố cục 3 cột (HUD trái + truyện + HUD phải) không vừa màn hình điện thoại.
// Dưới 820px: xếp DỌC, 2 HUD thu vào 2 tab bật/tắt để chính văn được ưu tiên.
function useIsMobile(breakpoint = 820) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= breakpoint,
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const onChange = (e) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [breakpoint])
  return isMobile
}

export default function App() {
  const { apiConfig, gameStarted, setGameStarted } = useGame()
  const [showSettings, setShowSettings] = useState(false)
  const [showDev, setShowDev] = useState(false)
  const isMobile = useIsMobile()
  // Trên mobile: mở/đóng từng HUD (mặc định đóng — chính văn là chính).
  const [mobilePanel, setMobilePanel] = useState(null) // null | 'left' | 'right'
  const configured = Boolean(apiConfig.baseUrl && apiConfig.model)

  if (showSettings) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-deep)' }}>
        <SettingsPage onBack={() => setShowSettings(false)} />
      </div>
    )
  }

  if (showDev) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-deep)' }}>
        {/* onEnterGame (đợt 45): SimulationTester setGameStarted(true) xong
            PHẢI đóng luôn màn Dev — vì App check showDev TRƯỚC gameStarted,
            không đóng thì người chơi kẹt lại ở màn Dev dù truyện đã sẵn sàng
            (bug "giả lập xong không vào màn chơi"). */}
        <DevPage onBack={() => setShowDev(false)} onEnterGame={() => setShowDev(false)} />
      </div>
    )
  }

  if (!gameStarted) {
    // Màn hình mở đầu full-bleed, không có header chung để giữ cảm giác title screen.
    return <IntroScreen onOpenSettings={() => setShowSettings(true)} onOpenDev={() => setShowDev(true)} />
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '10px 12px' : '14px 24px',
          gap: 8,
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--line)',
          position: 'sticky',
          top: 0,
          background: 'var(--bg-deep)',
          zIndex: 10,
        }}
      >
        <div className="sidebar__brand" style={{ padding: 0 }}>
          TRAINER ARENA
          <span>roleplay × battle engine</span>
        </div>
        <div className="btn-row" style={{ gap: isMobile ? 6 : 12, flexWrap: 'wrap' }}>
          <span className={`status-pill ${configured ? 'status-pill--ok' : ''}`}>
            {configured ? apiConfig.model : 'Chưa cấu hình API'}
          </span>
          {SHOW_DEV_MODE && (
            <button className="btn" onClick={() => setShowDev(true)}>
              Chế độ Dev
            </button>
          )}
          <button
            className="btn"
            onClick={() => setShowSettings(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <GearIcon />
            {isMobile ? 'API' : 'Cài đặt API'}
          </button>
        </div>
      </header>

      {/* Mobile (đợt 53): 2 nút bật/tắt HUD thay cho 2 cột dọc. */}
      {isMobile && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 12px 0' }}>
          {[
            { key: 'left', label: '👤 Nhân vật' },
            { key: 'right', label: '🗺 Bản đồ & menu' },
          ].map((t) => (
            <button
              key={t.key}
              className="btn"
              style={{
                flex: 1, fontSize: 12,
                borderColor: mobilePanel === t.key ? 'var(--amber)' : undefined,
                color: mobilePanel === t.key ? 'var(--amber)' : undefined,
              }}
              onClick={() => setMobilePanel((cur) => (cur === t.key ? null : t.key))}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'flex-start' }}>
        {/* HUD dọc trái kiểu Phàm Nhân Tu Tiên — chỉ hiện trong màn chơi. */}
        {(!isMobile || mobilePanel === 'left') && <PlayerHUD mobile={isMobile} />}
        <main style={{ flex: 1, width: isMobile ? '100%' : undefined, maxWidth: isMobile ? '100%' : 760, margin: '0 auto', padding: isMobile ? '14px 12px 20px' : '24px 20px', minWidth: 0 }}>
          <RoleplayChat />
        </main>
        {/* Cột phải (đợt 26): mini map + Cài đặt + Màn hình chính. */}
        {(!isMobile || mobilePanel === 'right') && (
        <RightHUD
          mobile={isMobile}
          onOpenSettings={() => setShowSettings(true)}
          onHome={() => {
            if (window.confirm('Về màn hình chính? Truyện hiện tại đã được LƯU — bấm "Tiếp tục hành trình" ở màn hình chính để chơi tiếp; "Bắt đầu một hành trình mới" sẽ tạo truyện mới.')) {
              setGameStarted(false)
            }
          }}
        />
        )}
      </div>
    </div>
  )
}
