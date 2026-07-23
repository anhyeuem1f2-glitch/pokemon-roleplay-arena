import React, { useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { getArea, getRegion } from '../data/regions.js'
import RegionMap from './RegionMap.jsx'
import MusicWidget from './MusicWidget.jsx'
import NotebookModal from './NotebookModal.jsx'
import { getWeather } from '../data/weather.js'

// ============ CỘT HUD BÊN PHẢI (đợt 26) ============
// Theo yêu cầu chuyển Cài đặt / Màn hình chính / Bản đồ sang PHẢI (bố cục
// giống cột phải của giao diện Phàm Nhân Tu Tiên): trên cùng là MINI MAP —
// bấm vào mở modal bản đồ thật với vị trí hiện tại; dưới là 2 nút hệ thống.

export default function RightHUD({ onOpenSettings, onHome, mobile = false }) {
  const { playerLocation, setPlayerLocation, storyDate,
  } = useGame()
  const [mapOpen, setMapOpen] = useState(false)
  const [notebookOpen, setNotebookOpen] = useState(false)

  const region = playerLocation ? getRegion(playerLocation.regionKey) : null
  const area = playerLocation ? getArea(playerLocation.regionKey, playerLocation.areaKey) : null
  const areaIndex = region && area ? region.areas.findIndex((a) => a.key === area.key) : -1

  return (
    <aside
      style={{
        // Đợt 53: mobile → panel tràn ngang, cao tự nhiên, KHÔNG sticky/100vh
        // (điện thoại không đủ chỗ cho 2 cột dọc hai bên).
        width: mobile ? '100%' : 200,
        flexShrink: 0,
        borderLeft: mobile ? 'none' : '1px solid var(--line)',
        borderBottom: mobile ? '1px solid var(--line)' : undefined,
        background: 'var(--bg-panel)',
        padding: '14px 14px 18px',
        position: mobile ? 'static' : 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        height: mobile ? 'auto' : '100vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* MINI MAP — góc trên bên phải, bấm để mở bản đồ thật */}
      <button
        onClick={() => setMapOpen(true)}
        title="Bấm để mở bản đồ đầy đủ"
        style={{
          border: '1px solid var(--line)',
          borderRadius: 10,
          background: 'var(--bg-deep)',
          padding: 10,
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--text-hi)',
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, color: 'var(--amber)', marginBottom: 6 }}>
          🗺 BẢN ĐỒ
        </div>
        {area ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mint)' }}>{area.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>
              {region.name} (Gen {region.gen}) · wild Lv{area.level[0]}-{area.level[1]}
            </div>
            {/* Lộ trình vùng thu nhỏ: mỗi khu 1 chấm, khu hiện tại sáng xanh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
              {region.areas.map((a, i) => (
                <React.Fragment key={a.key}>
                  {i > 0 && <span style={{ width: 6, height: 1, background: 'var(--line)' }} />}
                  <span
                    title={a.name}
                    style={{
                      width: i === areaIndex ? 9 : 6,
                      height: i === areaIndex ? 9 : 6,
                      borderRadius: '50%',
                      background: i === areaIndex ? 'var(--mint)' : i < areaIndex ? 'var(--text-mid)' : 'var(--line)',
                      boxShadow: i === areaIndex ? '0 0 6px var(--mint)' : 'none',
                    }}
                  />
                </React.Fragment>
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Chưa xác định vị trí — bấm để chọn trên bản đồ.</div>
        )}
      </button>

      {/* Điều khiển nhạc nền (đợt 28) */}
      <MusicWidget compact />

      {/* Ngày giờ trong truyện (đợt 32) */}
      <div style={{ fontSize: 10.5, color: 'var(--text-mid)', fontFamily: 'var(--font-mono)', textAlign: 'center', border: '1px solid var(--line)', borderRadius: 8, padding: '5px 8px' }}>
        📅 Buổi {storyDate.part} · {storyDate.day}/{storyDate.month}/{storyDate.year}
        <div style={{ marginTop: 3, color: 'var(--text-dim)' }} title={getWeather(storyDate, playerLocation).label}>
          {getWeather(storyDate, playerLocation).icon} Mùa {getWeather(storyDate, playerLocation).season} · {getWeather(storyDate, playerLocation).label.split(',')[0].split(' — ')[0]}
        </div>
      </div>

      {/* Sổ tay cốt truyện (đợt 30): tóm tắt + NPC + fact */}
      <button className="btn" style={{ width: '100%' }} onClick={() => setNotebookOpen(true)}>
        📓 Sổ tay cốt truyện
      </button>

      <div style={{ flex: 1 }} />

      {/* Nút hệ thống */}
      <button className="btn" style={{ width: '100%' }} onClick={onOpenSettings}>
        ⚙ Cài đặt
      </button>
      <button className="btn" style={{ width: '100%' }} onClick={onHome}>
        ⌂ Màn hình chính
      </button>

      {notebookOpen && <NotebookModal onClose={() => setNotebookOpen(false)} />}

      {/* Modal bản đồ đầy đủ */}
      {mapOpen && (
        <div
          onClick={() => setMapOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} className="panel" style={{ width: 'min(680px, 96vw)', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="page-title" style={{ margin: 0 }}>Bản đồ thế giới</span>
              <button className="btn" style={{ padding: '4px 10px' }} onClick={() => setMapOpen(false)}>
                Đóng
              </button>
            </div>
            <RegionMap location={playerLocation} onSetLocation={setPlayerLocation} fixedRegion />
          </div>
        </div>
      )}
    </aside>
  )
}
