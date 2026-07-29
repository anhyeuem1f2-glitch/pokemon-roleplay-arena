import React, { useState, useMemo } from 'react'
import { SHOP_ITEMS } from '../data/shopItems.js'

// ============ TÚI ĐỒ THEO NHÓM (đợt 69) ============
// Yêu cầu người chơi: "đại tu túi đồ theo giao diện như tính năng chiến đấu
// Mega — bấm vào túi đồ ra biểu tượng bóng Poké, bấm tiếp mới ra bảng các
// loại bóng". Trước đây mọi vật phẩm nhét thẳng thành một danh sách dài,
// đi bộ mãi mới tới thứ cần dùng.
//
// Dùng CHUNG cho cả trong trận (dùng được đồ) lẫn ngoài trận (chỉ xem).

export const BAG_POCKETS = [
  { key: 'ball', icon: '◓', label: 'Poké Ball', desc: 'Bóng bắt Pokémon' },
  { key: 'heal', icon: '✚', label: 'Hồi phục', desc: 'Hồi HP / hồi sinh' },
  { key: 'status', icon: '✦', label: 'Chữa trạng thái', desc: 'Độc, tê, ngủ, bỏng' },
  { key: 'pokefood', icon: '🍖', label: 'Thức ăn Pokémon', desc: 'Độ no cho Pokémon' },
  { key: 'food', icon: '🍙', label: 'Đồ ăn người', desc: 'Độ no cho người chơi' },
  { key: 'human', icon: '🩹', label: 'Y tế cho người', desc: 'Băng gạc, cứu thương' },
  { key: 'gimmick', icon: '💠', label: 'Trang bị đặc biệt', desc: 'Key Stone, Z-Ring, Tera Orb…' },
  { key: 'misc', icon: '🎒', label: 'Linh tinh', desc: 'Vật phẩm khác' },
]

// Vật phẩm kích hoạt Mega/Z/Dynamax/Terastal — gom riêng 1 ngăn cho dễ thấy.
const GIMMICK_IDS = /key-?stone|mega-?(ring|bracelet|stone)|z-?(ring|crystal|power)|dynamax-?band|tera-?orb/i

/** Xếp 1 vật phẩm vào ngăn nào. */
export function pocketOf(item) {
  if (!item) return 'misc'
  if (GIMMICK_IDS.test(item.id ?? '')) return 'gimmick'
  const known = SHOP_ITEMS.find((s) => s.id === item.id)
  const cat = known?.category ?? item.category
  return BAG_POCKETS.some((p) => p.key === cat) ? cat : 'misc'
}

/** Gom túi đồ thành {pocketKey: [item...]}, bỏ ngăn rỗng. */
export function groupByPocket(inventory) {
  const out = {}
  for (const it of inventory ?? []) {
    const k = pocketOf(it)
    ;(out[k] ??= []).push(it)
  }
  return out
}

/**
 * @param {object[]} inventory
 * @param {(item)=>void} [onUse]      bấm dùng (chỉ trong trận). Không truyền = chỉ xem.
 * @param {(item)=>boolean} [canUse]  item nào dùng được trong bối cảnh hiện tại
 * @param {boolean} [busy]
 * @param {()=>void} [onBack]
 */
export default function BagPanel({ inventory, onUse, canUse, busy = false, onBack }) {
  const [pocket, setPocket] = useState(null)
  const groups = useMemo(() => groupByPocket(inventory), [inventory])
  const pockets = BAG_POCKETS.filter((p) => (groups[p.key] ?? []).length > 0)

  if (!inventory?.length) {
    return (
      <div>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '4px 0 12px' }}>
          Túi đồ trống — mua vật phẩm tại các cửa hàng trong truyện.
        </p>
        {onBack && (
          <button className="btn" style={{ width: '100%' }} onClick={onBack}>← Quay lại</button>
        )}
      </div>
    )
  }

  // --- Màn 1: các NGĂN (biểu tượng lớn) ---
  if (!pocket) {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8, margin: '4px 0 10px' }}>
          {pockets.map((p) => {
            const pocketItems = groups[p.key] ?? []
            const hasInfinite = pocketItems.some((it) => it.infinite)
            const count = pocketItems.reduce((a, it) => a + (it.qty ?? 1), 0)
            return (
              <button
                key={p.key}
                onClick={() => setPocket(p.key)}
                title={p.desc}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '10px 6px', border: '1px solid var(--line)', borderRadius: 10,
                  background: 'var(--bg-deep)', color: 'var(--text-main)', cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>{p.icon}</span>
                <span style={{ fontSize: 11, textAlign: 'center' }}>{p.label}</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  {hasInfinite ? '∞' : count} món
                </span>
              </button>
            )
          })}
        </div>
        {onBack && (
          <button className="btn" style={{ width: '100%' }} onClick={onBack}>← Quay lại</button>
        )}
      </div>
    )
  }

  // --- Màn 2: vật phẩm TRONG ngăn đã chọn ---
  const info = BAG_POCKETS.find((p) => p.key === pocket)
  const items = groups[pocket] ?? []
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0 8px' }}>
        <span style={{ fontSize: 16 }}>{info?.icon}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-hi)' }}>{info?.label}</span>
        <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>· {info?.desc}</span>
      </div>
      <div style={{ marginBottom: 10, maxHeight: 220, overflowY: 'auto' }}>
        {items.map((it) => {
          const usable = onUse ? (canUse ? canUse(it) : true) : false
          const known = SHOP_ITEMS.find((s) => s.id === it.id)
          return (
            <button
              key={it.id}
              onClick={() => usable && onUse?.(it)}
              disabled={busy || !usable}
              title={known?.desc ?? it.name}
              style={{
                display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center',
                gap: 8, padding: '7px 10px', marginBottom: 4, border: '1px solid var(--line)',
                borderRadius: 8, background: 'transparent',
                color: usable || !onUse ? 'var(--text-main)' : 'var(--text-dim)',
                opacity: onUse && !usable ? 0.45 : 1,
                cursor: usable && !busy ? 'pointer' : 'default', fontSize: 12.5, textAlign: 'left',
              }}
            >
              <span>{it.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-mid)' }}>{it.infinite ? 'x∞' : `x${it.qty ?? 1}`}</span>
            </button>
          )
        })}
      </div>
      <button className="btn" style={{ width: '100%' }} onClick={() => setPocket(null)}>
        ← Các ngăn khác
      </button>
    </div>
  )
}
