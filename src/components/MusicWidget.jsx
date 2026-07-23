import React, { useEffect, useState } from 'react'
import { musicManager } from '../utils/musicManager.js'

// ============ WIDGET NHẠC NỀN (đợt 28) ============
// Ô điều khiển nhỏ: bật/tắt, kéo âm lượng, hiện tên track đang phát.
// Dùng ở RightHUD (compact) và SettingsPage (kèm hướng dẫn). Subscribe thẳng
// vào musicManager — không đi qua GameContext để Dev tab cũng dùng được.

export default function MusicWidget({ compact = false }) {
  const [state, setState] = useState(() => musicManager.getState())

  useEffect(() => {
    const unsub = musicManager.subscribe(() => setState(musicManager.getState()))
    setState(musicManager.getState())
    return unsub
  }, [])

  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 10,
        background: 'var(--bg-deep)',
        padding: compact ? 10 : 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, color: 'var(--amber)' }}>
          🎵 NHẠC NỀN
        </span>
        <button
          className="btn"
          style={{ padding: '2px 8px', fontSize: 12 }}
          title={state.enabled ? 'Tắt nhạc' : 'Bật nhạc'}
          onClick={() => musicManager.setEnabled(!state.enabled)}
        >
          {state.enabled ? '🔊' : '🔇'}
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(state.volume * 100)}
        onChange={(e) => musicManager.setVolume(Number(e.target.value) / 100)}
        disabled={!state.enabled}
        style={{ width: '100%' }}
        title={`Âm lượng: ${Math.round(state.volume * 100)}%`}
      />
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, minHeight: 13 }}>
        {!state.enabled
          ? 'Đang tắt'
          : state.currentKey
            ? `Đang phát: ${state.currentKey}${state.locked ? ' (bấm vào trang để phát)' : ''}`
            : 'Chưa có file nhạc khớp — xem public/music/README.txt'}
      </div>
    </div>
  )
}
