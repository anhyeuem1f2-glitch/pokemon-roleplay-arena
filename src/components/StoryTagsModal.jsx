import React, { useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { DIFFICULTIES, GENRES } from '../data/storyTones.js'

// Tag truyện chỉ điều khiển giọng văn được bơm vào API ở lượt kế tiếp.
// Không mở khoá lại chế độ, thiên phú, năng lực hay bất kỳ state gameplay nào.
export default function StoryTagsModal({ onClose }) {
  const { storyTone, setStoryTone } = useGame()
  const [draft, setDraft] = useState(() => [...(storyTone?.genres ?? [])])
  const difficulty = DIFFICULTIES.find((entry) => entry.key === storyTone?.difficulty)

  function toggle(key) {
    setDraft((current) => current.includes(key)
      ? current.filter((entry) => entry !== key)
      : [...current, key])
  }

  function save() {
    setStoryTone((current) => ({ ...current, genres: draft }))
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 90, padding: 16,
        display: 'grid', placeItems: 'center',
        background: 'radial-gradient(circle at 50% 12%, rgba(197,169,242,.14), transparent 38%), rgba(2,7,11,.82)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="panel"
        onClick={(event) => event.stopPropagation()}
        style={{ width: 'min(760px, 97vw)', maxHeight: '92vh', overflowY: 'auto', padding: 0, borderRadius: 16 }}
      >
        <div style={{
          position: 'sticky', top: 0, zIndex: 2, padding: '15px 17px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          borderBottom: '1px solid var(--line)', background: 'var(--bg-panel)',
        }}>
          <div>
            <div style={{ color: '#c5a9f2', fontSize: 9.5, fontWeight: 850, letterSpacing: '.14em' }}>VĂN PHONG API</div>
            <div className="page-title" style={{ margin: '3px 0 0' }}>Tag truyện</div>
          </div>
          <button className="btn" onClick={onClose}>✕ Đóng</button>
        </div>

        <div style={{ padding: 17 }}>
          <div style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text-mid)', fontSize: 11.5, lineHeight: 1.65 }}>
            Chế độ <b style={{ color: 'var(--amber)' }}>{difficulty?.label ?? storyTone?.difficulty}</b> vẫn được khóa theo save. Bạn chỉ đang đổi gia vị văn phong; các tag đã lưu sẽ đi vào prompt API ngay từ lượt kể tiếp theo.
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '15px 0 10px' }}>
            <div style={{ color: 'var(--text-hi)', fontWeight: 800, fontSize: 12.5 }}>
              Đã chọn {draft.length}/{GENRES.length} tag
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              <button className="btn" onClick={() => setDraft(GENRES.map((entry) => entry.key))}>Chọn tất cả</button>
              <button className="btn" onClick={() => setDraft([])}>Bỏ hết</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GENRES.map((genre) => {
              const selected = draft.includes(genre.key)
              return (
                <button
                  key={genre.key}
                  type="button"
                  onClick={() => toggle(genre.key)}
                  aria-pressed={selected}
                  style={{
                    border: `1px solid ${selected ? '#c5a9f2' : 'var(--line)'}`,
                    color: selected ? '#d8c5f8' : 'var(--text-mid)',
                    background: selected ? 'rgba(154,123,212,.10)' : 'transparent',
                    borderRadius: 999, padding: '7px 14px', fontSize: 12.5, cursor: 'pointer',
                    boxShadow: selected ? '0 0 0 1px rgba(154,123,212,.08) inset' : 'none',
                  }}
                >
                  {selected ? '✓ ' : ''}{genre.label}
                </button>
              )
            })}
          </div>

          <div style={{ marginTop: 13, color: 'var(--text-dim)', fontSize: 10.5, lineHeight: 1.65 }}>
            Không còn giới hạn 3 tag. Chọn nhiều tag sẽ tạo chất truyện pha trộn; API được dặn dùng chúng linh hoạt theo từng cảnh thay vì ép mọi tag xuất hiện cùng lúc.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 17, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <button className="btn" onClick={onClose}>Huỷ</button>
            <button className="btn btn--primary" onClick={save}>Lưu tag cho lượt sau</button>
          </div>
        </div>
      </div>
    </div>
  )
}
