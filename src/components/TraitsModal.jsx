import React, { useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { PERSONALITY_TRAITS, SUPERPOWERS } from '../data/characterTraits.js'
import { MECHANIC_PERKS, applyPerksToMon, hasPerk, resolveMechanicEffects, describeCustomMechanicEffects, syncTraitGrantedItems } from '../data/playerPerks.js'

// ============ SỬA TÍNH CÁCH & THIÊN PHÚ GIỮA TRUYỆN (đợt 70) ============
// Tester báo: "Kỹ Năng: Pokemon mình bắt hay sở hữu sẽ Max IV/EV... cái này
// là KHÔNG CHỈNH SỬA ĐƯỢC hà Red" và "kĩ năng và thiên phú xài không được".
// Đúng: đợt 61-69 chỉ cho chọn ĐÚNG MỘT LẦN ở màn tạo nhân vật, vào truyện
// rồi là chốt cứng, không có đường quay lại — kể cả khi bấm nhầm. Bảng này
// mở thẳng từ HUD, sửa lúc nào cũng được, lưu ngay vào localStorage.

/** Ô chọn thiên phú CƠ CHẾ — dùng chung cho màn tạo nhân vật và bảng sửa. */
export function PerkPicker({ perks, onToggle }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {MECHANIC_PERKS.map((p) => {
        const on = hasPerk(perks, p.key)
        return (
          <button
            key={p.key}
            onClick={() => onToggle(p.key)}
            style={{
              textAlign: 'left',
              border: `1px solid ${on ? 'var(--mint)' : 'var(--line)'}`,
              background: on ? 'rgba(120,200,170,0.07)' : 'transparent',
              borderRadius: 8,
              padding: '9px 11px',
              cursor: 'pointer',
              color: 'inherit',
            }}
          >
            <div style={{ fontSize: 12.5, color: on ? 'var(--mint)' : 'var(--text-mid)', fontWeight: 600 }}>
              {on ? '☑' : '☐'} {p.label} <span style={{ opacity: 0.75, fontWeight: 400 }}>— {p.short}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3, lineHeight: 1.6 }}>{p.desc}</div>
          </button>
        )
      })}
    </div>
  )
}

export default function TraitsModal({ onClose }) {
  const { playerTraits, setPlayerTraits, party, setParty, playerMon, setPlayerMon, setInventory } = useGame()
  const [draft, setDraft] = useState(() => ({
    personality: playerTraits?.personality ?? [],
    superpower: playerTraits?.superpower ?? 'none',
    customPower: playerTraits?.customPower ?? '',
    perks: playerTraits?.perks ?? [],
  }))

  function togglePersonality(key) {
    setDraft((d) => ({
      ...d,
      personality: d.personality.includes(key)
        ? d.personality.filter((k) => k !== key)
        : d.personality.length >= 4
          ? d.personality
          : [...d.personality, key],
    }))
  }

  function togglePerk(key) {
    setDraft((d) => ({
      ...d,
      perks: d.perks.includes(key) ? d.perks.filter((k) => k !== key) : [...d.perks, key],
    }))
  }

  const detectedCustom = describeCustomMechanicEffects(draft)
  const resolvedEffects = resolveMechanicEffects(draft)

  function save() {
    setPlayerTraits(draft)
    // ÁP NGAY CHO ĐỘI HÌNH HIỆN TẠI. Nếu chỉ áp cho Pokémon nhận SAU khi bật
    // thì tester bật lên sẽ chẳng thấy gì đổi và lại báo "xài không được" —
    // nên bật "Huyết Thống Hoàn Mỹ" là cả đội đang có được nâng luôn.
    // Chỉ NÂNG chỉ số, không bao giờ hạ: tắt perk thì Pokémon giữ nguyên
    // những gì đã có (không tịch thu lại của người chơi).
    if (resolvedEffects.maxIvEv) {
      setParty((cur) => (cur ?? []).map((m) => applyPerksToMon(m, draft)))
      setPlayerMon((cur) => (cur ? applyPerksToMon(cur, draft) : cur))
    }
    // Năng lực "Kẹo Hiếm vô hạn" tạo vật phẩm x∞ ngay khi lưu; không phải
    // chờ model nhớ phát [[ITEM]] ở lượt sau nữa.
    setInventory((cur) => syncTraitGrantedItems(cur, draft))
    onClose()
  }

  const monCount = (party ?? []).length

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 95, padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()} className="panel" style={{ width: 'min(560px, 96vw)', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span className="page-title" style={{ margin: 0 }}>Tính cách &amp; Thiên phú</span>
          <button className="btn" style={{ padding: '4px 10px' }} onClick={onClose}>Đóng</button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Tính cách <span style={{ color: 'var(--text-dim)', textTransform: 'none' }}>(tối đa 4)</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {PERSONALITY_TRAITS.map((t) => {
            const on = draft.personality.includes(t.key)
            return (
              <button
                key={t.key}
                onClick={() => togglePersonality(t.key)}
                style={{
                  border: `1px solid ${on ? 'var(--amber)' : 'var(--line)'}`,
                  color: on ? 'var(--amber)' : 'var(--text-mid)',
                  background: 'transparent', borderRadius: 999, padding: '5px 12px',
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Siêu năng lực <span style={{ color: 'var(--text-dim)', textTransform: 'none' }}>(ảnh hưởng LỜI KỂ)</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SUPERPOWERS.map((p) => (
            <button
              key={p.key}
              onClick={() => setDraft((d) => ({ ...d, superpower: p.key }))}
              style={{
                border: `1px solid ${draft.superpower === p.key ? 'var(--amber)' : 'var(--line)'}`,
                color: draft.superpower === p.key ? 'var(--amber)' : 'var(--text-mid)',
                background: 'transparent', borderRadius: 999, padding: '5px 12px',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {draft.superpower === 'custom' && (
          <textarea
            className="input"
            style={{ width: '100%', marginTop: 10, minHeight: 70 }}
            placeholder="Mô tả năng lực riêng của bạn…"
            value={draft.customPower}
            onChange={(e) => setDraft((d) => ({ ...d, customPower: e.target.value }))}
          />
        )}
        {draft.superpower === 'custom' && (
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.7 }}>
            Đây là chỗ duy nhất bạn tự đặt luật cho nhân vật của mình. AI sẽ tôn trọng đúng những gì
            bạn viết và dùng tag để biến nó thành số liệu thật khi cần (nhận vật phẩm, tiền, Pokémon…).
            Viết càng cụ thể thì càng chạy đúng.
          </div>
        )}
        {draft.superpower === 'custom' && draft.customPower.trim() && (
          <div style={{ marginTop: 8, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 10.5, lineHeight: 1.7 }}>
            <div style={{ color: 'var(--mint)', fontWeight: 700, marginBottom: 3 }}>⚙ App nhận diện cơ chế:</div>
            {detectedCustom.length > 0 ? detectedCustom.map((label) => (
              <div key={label} style={{ color: 'var(--text-mid)' }}>• {label}</div>
            )) : (
              <div style={{ color: 'var(--text-dim)' }}>
                Chưa thấy hiệu ứng số liệu đủ rõ — đoạn này vẫn ảnh hưởng lời kể. Mẫu dễ nhận: “EXP sau trận ×3”,
                “Kẹo Hiếm vô hạn”, “cả đội dù không ra trận vẫn nhận EXP”, “Pokémon sở hữu Max IV/EV”.
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--text-mid)', margin: '18px 0 6px', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Thiên phú cơ chế <span style={{ color: 'var(--mint)', textTransform: 'none' }}>(áp THẲNG vào số liệu game)</span>
        </div>
        <PerkPicker perks={draft.perks} onToggle={togglePerk} />

        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 12, lineHeight: 1.7 }}>
          Bật <strong>Huyết Thống Hoàn Mỹ</strong> sẽ nâng luôn {monCount > 0 ? `${monCount} Pokémon đang có trong đội` : 'mọi Pokémon bạn nhận sau này'}.
          Tắt perk KHÔNG thu hồi chỉ số đã nâng — Pokémon giữ nguyên những gì đã có.
        </div>

        <div className="btn-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Huỷ</button>
          <button className="btn" style={{ borderColor: 'var(--mint)', color: 'var(--mint)' }} onClick={save}>
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  )
}
