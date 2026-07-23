import React, { useRef, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { parseWorldbook } from '../utils/worldbook.js'

// ============ NHẬP & QUẢN LÝ WORLDBOOK (đợt 41) ============
// Nhập file World Info/Lorebook .json xuất từ SillyTavern. Worldbook độc lập
// với character card. Hiển thị số entry, cho bật/tắt nhanh, xoá.

export default function WorldbookSection() {
  const { worldbook, setWorldbook } = useGame()
  const fileRef = useRef(null)
  const [error, setError] = useState(null)
  const [ok, setOk] = useState(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setOk(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const parsed = parseWorldbook(json)
      if (!parsed.entries.length) {
        setError('File không có entry hợp lệ (cần định dạng World Info của SillyTavern: { entries: {...} }).')
        return
      }
      setWorldbook(parsed)
      setOk(`Đã nhập "${parsed.name}" — ${parsed.entries.length} entry (${parsed.entries.filter((x) => x.constant).length} luôn bật).`)
    } catch (err) {
      setError(`Không đọc được file: ${err.message}`)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const entries = worldbook?.entries ?? []

  return (
    <div className="field">
      <label>Worldbook (World Info / Lorebook)</label>
      <small>
        Nhập file .json xuất từ SillyTavern (World Info). AI sẽ đọc các entry được kích hoạt theo từ
        khoá (và các entry "luôn bật") để giữ đúng canon thế giới của bạn. Khi thông tin worldbook
        khác với wiki Bulbapedia, AI ưu tiên WORLDBOOK.
      </small>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn btn--primary" onClick={() => fileRef.current?.click()}>
          Nhập worldbook (.json)
        </button>
        <input ref={fileRef} type="file" accept=".json" onChange={handleFile} style={{ display: 'none' }} />
        {entries.length > 0 && (
          <button className="btn" onClick={() => { setWorldbook({ name: '', entries: [] }); setOk('Đã xoá worldbook.') }}>
            Xoá worldbook
          </button>
        )}
      </div>
      {error && <small style={{ display: 'block', marginTop: 6, color: '#d94f4f' }}>{error}</small>}
      {ok && <small style={{ display: 'block', marginTop: 6, color: 'var(--mint)' }}>{ok}</small>}

      {entries.length > 0 && (
        <div style={{ marginTop: 10, border: '1px solid var(--line)', borderRadius: 8, maxHeight: 240, overflowY: 'auto' }}>
          <div style={{ padding: '6px 10px', fontSize: 11.5, color: 'var(--text-dim)', borderBottom: '1px solid var(--line)' }}>
            {worldbook.name || 'Worldbook'} — {entries.length} entry
          </div>
          {entries.slice(0, 200).map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', fontSize: 11.5, borderBottom: '1px solid var(--line)', opacity: e.disable ? 0.45 : 1 }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.constant && <span style={{ color: 'var(--amber)' }}>★ </span>}
                {e.comment || (e.keys[0] ?? '(không tên)')}
                {e.keys.length > 0 && <span style={{ color: 'var(--text-dim)' }}> · {e.keys.slice(0, 4).join(', ')}</span>}
              </span>
              <button
                className="btn"
                style={{ padding: '1px 8px', fontSize: 10.5 }}
                onClick={() => {
                  const next = { ...worldbook, entries: entries.map((x, idx) => (idx === i ? { ...x, disable: !x.disable } : x)) }
                  setWorldbook(next)
                }}
              >
                {e.disable ? 'Bật' : 'Tắt'}
              </button>
            </div>
          ))}
          {entries.length > 200 && (
            <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text-dim)' }}>… và {entries.length - 200} entry nữa (vẫn hoạt động).</div>
          )}
        </div>
      )}
    </div>
  )
}
