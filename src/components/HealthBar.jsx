import React from 'react'

// bars: số thanh máu (Boss có >1). Chia đều maxHp thành từng đoạn — đoạn nào
// đại diện phần HP còn lại mới bắt đầu vơi, các đoạn "cao hơn" (đã tính vào
// trước đó) hiện đầy, đoạn "thấp hơn" (chưa tới lượt) hiện rỗng. Đánh bại
// Boss = tổng HP toàn bộ về 0, không có cơ chế bất tử/khiên riêng từng đoạn.
export default function HealthBar({ hp, maxHp, bars = 1 }) {
  const safeHp = Math.max(0, hp)
  const segSize = maxHp / bars

  const segments = Array.from({ length: bars }, (_, i) => {
    const segStart = i * segSize
    const filled = Math.max(0, Math.min(segSize, safeHp - segStart))
    return (filled / segSize) * 100
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: bars > 1 ? 3 : 0 }}>
        {segments.map((pct, i) => {
          const color = pct > 50 ? 'var(--mint)' : pct > 20 ? 'var(--amber)' : 'var(--coral)'
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: 10,
                borderRadius: 999,
                background: 'var(--bg-deep)',
                border: '1px solid var(--line)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: color,
                  transition: 'width 0.3s ease, background 0.3s ease',
                }}
              />
            </div>
          )
        })}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-mid)',
          marginTop: 4,
          textAlign: 'right',
        }}
      >
        {Math.round(safeHp)} / {maxHp}
        {bars > 1 && <span style={{ color: 'var(--amber)' }}> · BOSS ({bars} thanh)</span>}
      </div>
    </div>
  )
}
