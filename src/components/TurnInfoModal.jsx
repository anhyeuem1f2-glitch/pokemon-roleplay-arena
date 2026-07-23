import React, { useState } from 'react'

// ============ XEM CHI TIẾT 1 LƯỢT AI (đợt 48) ============
// Học theo card Phàm Nhân Tu Tiên: mỗi tin AI có nút mở viewer 3 tab —
// (1) BIẾN CẬP NHẬT: mọi thay đổi trạng thái app đã áp từ tag của lượt này
//     (tiền, hảo cảm, thương tích, fact, NPC, di chuyển, ngày giờ...) —
//     "giấy trắng mực đen" để người chơi TỰ KIỂM CHỨNG hệ [[MONEY]]... có
//     chạy thật hay không.
// (2) SUY NGHĨ: phần CoT model viết trước chính văn.
// (3) VĂN GỐC: reply nguyên bản trước mọi bước làm sạch — soi lỗi preset.

const TABS = [
  { key: 'changes', label: '🧬 Biến cập nhật' },
  { key: 'thinking', label: '🧠 Suy nghĩ' },
  { key: 'raw', label: '📝 Văn gốc' },
]

export default function TurnInfoModal({ message, onClose }) {
  const [tab, setTab] = useState('changes')
  const meta = message?.meta ?? {}
  const changes = meta.changes ?? []

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()} className="panel" style={{ width: 'min(680px, 96vw)', maxHeight: '86vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span className="page-title" style={{ margin: 0 }}>Chi tiết lượt này</span>
          <button className="btn" style={{ padding: '4px 10px' }} onClick={onClose}>Đóng</button>
        </div>
        <div className="btn-row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className="btn"
              onClick={() => setTab(t.key)}
              style={tab === t.key ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'changes' && (
          <div>
            <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: '0 0 8px' }}>
              Các thay đổi trạng thái app ĐÃ ÁP từ tag của lượt này. Mục có (API phụ) là do API cập
              nhật biến bổ sung sau.
            </p>
            {changes.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                Lượt này không có thay đổi biến nào (AI không khai tag — bình thường với các lượt
                thuần hội thoại/miêu tả).
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
                {changes.map((c, i) => (
                  <li key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{c}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'thinking' && (
          <pre style={{ fontSize: 12, color: 'var(--text-mid)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', margin: 0, maxHeight: '62vh', overflowY: 'auto' }}>
            {meta.thinking || '(Lượt này không bóc được phần suy nghĩ — model không xuất CoT hoặc preset không dùng thẻ thinking.)'}
          </pre>
        )}

        {tab === 'raw' && (
          <pre style={{ fontSize: 12, color: 'var(--text-mid)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', margin: 0, maxHeight: '62vh', overflowY: 'auto' }}>
            {meta.raw || '(Không lưu văn gốc cho tin này — tin được tạo trước đợt 48.)'}
          </pre>
        )}
      </div>
    </div>
  )
}
