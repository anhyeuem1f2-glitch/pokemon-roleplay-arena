import React, { useState } from 'react'
import {
  listSaves, saveToSlot, loadFromSlot, deleteSlot, exportSaveFile, importSaveFile, MAX_SLOTS,
} from '../utils/saveManager.js'

// ============ MÀN HÌNH LƯU / TẢI GAME (đợt 69) ============
// Mô phỏng màn save của Pokémon gốc: 3 ô, mỗi ô hiện tên người chơi, số
// Pokémon, cấp cao nhất, tiền, ngày trong truyện và số lượt đã chơi.
//
// Sau khi TẢI, trang tự tải lại — vì toàn bộ state nằm trong React context
// đã khởi tạo từ localStorage lúc mở trang; ghi đè localStorage rồi mà
// không reload thì màn hình vẫn hiển thị ván cũ.

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '' }
}

export default function SaveModal({ onClose }) {
  const [saves, setSaves] = useState(() => listSaves())
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  function doSave(slot) {
    setErr(null)
    try {
      if (saves[slot] && !window.confirm(`Ghi đè ô ${slot + 1}? Dữ liệu cũ trong ô này sẽ mất.`)) return
      setSaves(saveToSlot(slot))
      setMsg(`Đã lưu vào ô ${slot + 1}.`)
    } catch (e) {
      setErr(e.message)
    }
  }

  function doLoad(slot) {
    if (!window.confirm(
      `Tải ván chơi ở ô ${slot + 1}? Ván đang chơi hiện tại sẽ bị thay thế ` +
      '(hãy lưu lại trước nếu muốn giữ). Trang sẽ tự tải lại.',
    )) return
    if (loadFromSlot(slot)) window.location.reload()
  }

  function doDelete(slot) {
    if (!window.confirm(`Xoá ô save ${slot + 1}? Không hoàn tác được.`)) return
    setSaves(deleteSlot(slot))
    setMsg(`Đã xoá ô ${slot + 1}.`)
  }

  async function doImport(file) {
    setErr(null)
    try {
      if (!window.confirm('Nạp file save này? Ván đang chơi sẽ bị thay thế. Trang sẽ tự tải lại.')) return
      await importSaveFile(file)
      window.location.reload()
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 95, padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()} className="panel" style={{ width: 'min(560px, 96vw)', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span className="page-title" style={{ margin: 0 }}>💾 Lưu / Tải game</span>
          <button className="btn" style={{ padding: '4px 10px' }} onClick={onClose}>Đóng</button>
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: '0 0 12px', lineHeight: 1.6 }}>
          Save nằm trong trình duyệt của bạn. Xoá dữ liệu duyệt web là mất — nên nếu ván chơi quan
          trọng, hãy bấm <b>Xuất ra file</b> để cất một bản ra ngoài. File save KHÔNG chứa API key.
        </p>

        {Array.from({ length: MAX_SLOTS }, (_, i) => {
          const s = saves[i]
          return (
            <div
              key={i}
              style={{
                border: `1px solid ${s ? 'var(--line)' : 'var(--line)'}`,
                borderRadius: 10, padding: 10, marginBottom: 8,
                background: s ? 'var(--bg-deep)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-hi)' }}>
                    Ô {i + 1}
                    {!s && <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}> — trống</span>}
                  </div>
                  {s && (
                    <>
                      <div style={{ fontSize: 12, color: 'var(--text-main)', marginTop: 3 }}>
                        {s.info.playerName} · {s.info.partyCount} Pokémon
                        {s.info.topLevel > 0 && ` · cao nhất Lv.${s.info.topLevel}`}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        ₽{Number(s.info.money).toLocaleString('vi-VN')}
                        {s.info.date && ` · ngày ${s.info.date}`}
                        {` · ${s.info.turns} lượt`}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>
                        Lưu lúc {fmtTime(s.savedAt)}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="btn-row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <button className="btn" style={{ fontSize: 12 }} onClick={() => doSave(i)}>
                  {s ? '💾 Ghi đè' : '💾 Lưu vào ô này'}
                </button>
                {s && (
                  <>
                    <button className="btn btn--primary" style={{ fontSize: 12 }} onClick={() => doLoad(i)}>
                      ▶ Tải ván này
                    </button>
                    <button className="btn" style={{ fontSize: 12 }} onClick={() => doDelete(i)}>✕ Xoá</button>
                  </>
                )}
              </div>
            </div>
          )
        })}

        <div className="btn-row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn" style={{ fontSize: 12 }} onClick={() => { exportSaveFile(); setMsg('Đã xuất file save.') }}>
            ⬇ Xuất ra file
          </button>
          <label className="btn" style={{ fontSize: 12, cursor: 'pointer' }}>
            ⬆ Nạp từ file
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) doImport(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>

        {msg && <div className="status-pill status-pill--ok" style={{ marginTop: 10 }}>{msg}</div>}
        {err && <div className="status-pill status-pill--error" style={{ marginTop: 10, display: 'block' }}>{err}</div>}
      </div>
    </div>
  )
}
