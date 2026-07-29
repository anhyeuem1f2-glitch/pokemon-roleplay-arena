import React, { useMemo, useState } from 'react'

// ============ CHI TIẾT LƯỢT AI (đợt 74) ============
// DNA không còn là bản sao tag. Dòng ✅ là app đã tìm được target và gửi
// cập nhật vào state; ⚠ là tag không áp được; ℹ là chỉ dẫn hợp lệ nhưng không
// làm thay đổi số liệu (VD yêu cầu Lv5 trong khi Pokémon đã Lv6).

const TABS = [
  { key: 'changes', icon: '🧬', label: 'Biến cập nhật', note: 'Kết quả áp state' },
  { key: 'thinking', icon: '🧠', label: 'Suy nghĩ', note: 'Phần model suy luận' },
  { key: 'raw', icon: '📝', label: 'Văn gốc', note: 'Trước khi làm sạch' },
]

function changeKind(line) {
  const text = String(line ?? '')
  if (text.startsWith('⚠')) return 'warning'
  if (text.startsWith('ℹ')) return 'info'
  if (text.startsWith('✅')) return 'success'
  return 'normal'
}

function ChangeCard({ line }) {
  const kind = changeKind(line)
  const palette = {
    success: { border: 'var(--mint)', bg: 'rgba(120,200,170,.07)', label: 'ĐÃ ÁP' },
    warning: { border: '#e09058', bg: 'rgba(224,144,88,.08)', label: 'KHÔNG ÁP' },
    info: { border: 'var(--line)', bg: 'rgba(255,255,255,.025)', label: 'KHÔNG ĐỔI' },
    normal: { border: 'var(--line)', bg: 'var(--bg-deep)', label: 'ĐÃ XỬ LÝ' },
  }[kind]

  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: '82px minmax(0,1fr)', gap: 10, alignItems: 'start',
        padding: '10px 11px', borderRadius: 10, border: `1px solid ${palette.border}`,
        background: palette.bg,
      }}
    >
      <span
        style={{
          width: 'fit-content', padding: '3px 6px', borderRadius: 6,
          border: `1px solid ${palette.border}`, color: palette.border,
          fontSize: 8.5, fontWeight: 850, letterSpacing: '.08em',
        }}
      >
        {palette.label}
      </span>
      <span style={{ color: kind === 'warning' ? '#efb083' : 'var(--text-hi)', fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.65 }}>
        {line}
      </span>
    </div>
  )
}

export default function TurnInfoModal({ message, onClose }) {
  const [tab, setTab] = useState('changes')
  const meta = message?.meta ?? {}
  const changes = meta.changes ?? []
  const counts = useMemo(() => changes.reduce((acc, line) => {
    acc[changeKind(line)] += 1
    return acc
  }, { success: 0, warning: 0, info: 0, normal: 0 }), [changes])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 90, padding: 16,
        display: 'grid', placeItems: 'center',
        background: 'radial-gradient(circle at 50% 12%, rgba(120,200,170,.12), transparent 36%), rgba(2,7,11,.80)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel"
        style={{
          width: 'min(900px, 97vw)', maxHeight: '92vh', overflow: 'hidden', padding: 0,
          borderRadius: 16, boxShadow: '0 28px 95px rgba(0,0,0,.55)',
        }}
      >
        <style>{`
          .turn-info-layout { display:grid; grid-template-columns:190px minmax(0,1fr); min-height:460px; }
          @media (max-width: 680px) {
            .turn-info-layout { grid-template-columns:1fr; min-height:0; }
            .turn-info-tabs { display:grid !important; grid-template-columns:repeat(3,1fr); border-right:0 !important; border-bottom:1px solid var(--line); }
            .turn-info-tab-note { display:none; }
          }
        `}</style>

        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            padding: '15px 17px', borderBottom: '1px solid var(--line)',
            background: 'linear-gradient(135deg, rgba(120,200,170,.08), rgba(232,184,74,.055))',
          }}
        >
          <div>
            <div style={{ color: 'var(--amber)', fontSize: 9.5, fontWeight: 850, letterSpacing: '.14em' }}>KIỂM TRA LƯỢT AI</div>
            <div className="page-title" style={{ margin: '3px 0 0' }}>Chi tiết lượt này</div>
          </div>
          <button className="btn" style={{ padding: '7px 12px' }} onClick={onClose}>✕ Đóng</button>
        </div>

        <div className="turn-info-layout">
          <nav className="turn-info-tabs" style={{ padding: 10, borderRight: '1px solid var(--line)', background: 'var(--bg-deep)' }}>
            {TABS.map((t) => {
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 11px', marginBottom: 7,
                    borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${active ? 'var(--mint)' : 'transparent'}`,
                    background: active ? 'rgba(120,200,170,.08)' : 'transparent', color: 'inherit',
                  }}
                >
                  <div style={{ color: active ? 'var(--mint)' : 'var(--text-hi)', fontSize: 11.5, fontWeight: 750 }}>
                    {t.icon} {t.label}
                  </div>
                  <div className="turn-info-tab-note" style={{ color: 'var(--text-dim)', fontSize: 9.5, marginTop: 3 }}>{t.note}</div>
                </button>
              )
            })}
          </nav>

          <main style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(92vh - 76px)' }}>
            {tab === 'changes' && (
              <div>
                <div
                  style={{
                    display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap',
                    paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid var(--line)',
                  }}
                >
                  <div style={{ maxWidth: 520 }}>
                    <div style={{ color: 'var(--text-hi)', fontSize: 13, fontWeight: 750 }}>Kết quả đồng bộ state</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 10.5, lineHeight: 1.65, marginTop: 4 }}>
                      DNA chỉ ghi “đã áp” khi app tìm được đúng Pokémon/vật phẩm. Tag sai target sẽ hiện cảnh báo, không còn báo theo lời kể rồi để biến đứng yên.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {counts.success > 0 && <span style={{ color: 'var(--mint)', fontSize: 10, border: '1px solid var(--mint)', borderRadius: 999, padding: '4px 8px' }}>✓ {counts.success} đã áp</span>}
                    {counts.warning > 0 && <span style={{ color: '#e9a06b', fontSize: 10, border: '1px solid #e9a06b', borderRadius: 999, padding: '4px 8px' }}>! {counts.warning} lỗi</span>}
                  </div>
                </div>

                {changes.length === 0 ? (
                  <div style={{ padding: 22, border: '1px dashed var(--line)', borderRadius: 11, textAlign: 'center' }}>
                    <div style={{ fontSize: 24 }}>○</div>
                    <div style={{ color: 'var(--text-mid)', fontSize: 12, marginTop: 5 }}>Lượt này không có thay đổi biến</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 10.5, marginTop: 4 }}>Bình thường với hội thoại hoặc miêu tả thuần túy.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {changes.map((line, index) => <ChangeCard key={`${index}-${line}`} line={line} />)}
                  </div>
                )}
              </div>
            )}

            {tab === 'thinking' && (
              <pre style={{ margin: 0, padding: 13, borderRadius: 11, border: '1px solid var(--line)', background: 'var(--bg-deep)', color: 'var(--text-mid)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.7, minHeight: 240 }}>
                {meta.thinking || '(Lượt này không bóc được phần suy nghĩ — model không xuất phần thinking hoặc preset không dùng thẻ tương ứng.)'}
              </pre>
            )}

            {tab === 'raw' && (
              <pre style={{ margin: 0, padding: 13, borderRadius: 11, border: '1px solid var(--line)', background: 'var(--bg-deep)', color: 'var(--text-mid)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.7, minHeight: 240 }}>
                {meta.raw || '(Không lưu văn gốc cho tin này — tin được tạo trước đợt 48.)'}
              </pre>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
