import React, { useEffect, useState } from 'react'
import {
  getNotebook, removeNpc, removeFact, subscribeNotebook, formatNpcLine,
} from '../utils/storyNotebook.js'
import {
  getSummary, setSummaryText, clearSummary, subscribeSummary, isSummaryUpdating,
  forceUpdateSummary,
} from '../utils/storySummary.js'
import { useGame } from '../context/GameContext.jsx'
import { getMemoryCount, subscribeMemory } from '../utils/storyMemory.js'

// ============ SỔ TAY CỐT TRUYỆN (đợt 30) ============
// Modal xem/quản lý cả 3 lớp trí nhớ: (1) tóm tắt cốt truyện (sửa tay được —
// bạn toàn quyền nắn lại nếu AI tóm sai), (2) hồ sơ NPC, (3) fact theo
// keyword. Có nút xoá từng mục — mục sai thì dọn ngay khỏi trí nhớ AI.

export default function NotebookModal({ onClose }) {
  const { apiConfig, messages } = useGame()
  const [tab, setTab] = useState('summary') // 'summary' | 'npc' | 'fact'
  const [sumError, setSumError] = useState(null)
  const [nb, setNb] = useState(() => getNotebook())
  const [sum, setSum] = useState(() => getSummary())
  const [memCount, setMemCount] = useState(() => getMemoryCount())
  const [draft, setDraft] = useState(sum.text)
  const [updating, setUpdating] = useState(() => isSummaryUpdating())

  useEffect(() => {
    const u1 = subscribeNotebook(() => setNb(getNotebook()))
    const u2 = subscribeSummary(() => {
      const s = getSummary()
      setSum(s)
      setDraft((d) => (d === '' || d === sum.text ? s.text : d))
      setUpdating(isSummaryUpdating())
    })
    const u3 = subscribeMemory(() => setMemCount(getMemoryCount()))
    return () => { u1(); u2(); u3() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tabBtn = (key, label) => (
    <button
      className="btn"
      onClick={() => setTab(key)}
      style={tab === key ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}
    >
      {label}
    </button>
  )

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()} className="panel" style={{ width: 'min(640px, 96vw)', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span className="page-title" style={{ margin: 0 }}>📓 Sổ tay cốt truyện</span>
          <button className="btn" style={{ padding: '4px 10px' }} onClick={onClose}>Đóng</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
          3 lớp trí nhớ đang hoạt động: ký ức vector ({memCount}) · tóm tắt cốt truyện · sổ tay keyword
          ({nb.npcs.length} NPC, {nb.facts.length} fact)
        </div>
        <div className="btn-row" style={{ gap: 8, marginBottom: 12 }}>
          {tabBtn('summary', 'Tóm tắt')}
          {tabBtn('npc', `NPC (${nb.npcs.length})`)}
          {tabBtn('fact', `Fact (${nb.facts.length})`)}
        </div>

        {tab === 'summary' && (
          <div>
            <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: '0 0 8px' }}>
              Chạy bằng API CHÍNH (Cài đặt API), tự cập nhật mỗi ~12 tin{updating ? ' — ĐANG CẬP NHẬT…' : ''}.
              Muốn tóm ngay không cần chờ đủ tin thì bấm "Tóm tắt ngay". Bạn sửa tay được — bản này
              luôn được chèn đầu prompt để giữ mạch truyện.
            </p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Chưa có tóm tắt — sẽ tự sinh khi truyện đủ dài (hoặc bạn tự viết vào đây)."
              style={{ width: '100%', minHeight: 180, fontSize: 12.5 }}
            />
            {sumError && (
              <div className="status-pill status-pill--error" style={{ marginTop: 6 }}>{sumError}</div>
            )}
            <div className="btn-row" style={{ gap: 8, marginTop: 8 }}>
              <button className="btn btn--primary" onClick={() => setSummaryText(draft)} disabled={draft === sum.text}>
                Lưu tóm tắt
              </button>
              <button
                className="btn"
                disabled={updating || messages.length === 0}
                onClick={() => {
                  // Đợt 47: chạy tóm tắt NGAY bằng API chính, bỏ ngưỡng ~12 tin.
                  setSumError(null)
                  forceUpdateSummary(apiConfig, messages)
                    .then((t) => { if (t !== null && t !== undefined) setDraft(t) })
                    .catch((e) => setSumError(e.message))
                }}
              >
                {updating ? '⟳ Đang tóm tắt…' : '⟳ Tóm tắt ngay'}
              </button>
              <button
                className="btn"
                onClick={() => {
                  if (window.confirm('Xoá bản tóm tắt? (Sẽ được tự sinh lại từ các tin sắp tới.)')) {
                    clearSummary()
                    setDraft('')
                  }
                }}
              >
                Xoá
              </button>
            </div>
          </div>
        )}

        {tab === 'npc' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {nb.npcs.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Chưa có NPC nào — AI sẽ tự khai báo qua tag [[NPC]] khi nhân vật có tên xuất hiện.
              </p>
            )}
            {nb.npcs.map((n) => (
              <div key={n.name} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12 }}>{formatNpcLine(n)}</span>
                <button className="btn" style={{ padding: '2px 8px', fontSize: 10, alignSelf: 'flex-start' }} onClick={() => removeNpc(n.name)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'fact' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {nb.facts.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Chưa có fact nào — AI sẽ tự ghi qua tag [[FACT Từ khoá | nội dung]] khi có sự kiện quan trọng.
              </p>
            )}
            {[...nb.facts].reverse().map((f, i) => (
              <div key={`${f.key}-${i}`} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12 }}>
                  <b style={{ color: 'var(--mint)' }}>{f.key}</b>: {f.text}
                </span>
                <button className="btn" style={{ padding: '2px 8px', fontSize: 10, alignSelf: 'flex-start' }} onClick={() => removeFact(f)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
