import React, { useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { PERSONALITY_TRAITS, SUPERPOWERS } from '../data/characterTraits.js'
import {
  applyPerksToMon,
  resolveMechanicEffects,
  describeCustomMechanicEffects,
  syncTraitGrantedItems,
} from '../data/playerPerks.js'
import { normalizeGameMode, sanitizeTraitsForMode } from '../data/gameModes.js'

// ============ CHỌN TÍNH CÁCH & NĂNG LỰC TRƯỚC HÀNH TRÌNH ============
// Toàn bộ hiệu ứng sửa số liệu chỉ được nhận từ ô "Tự mô tả…". Các lựa chọn
// dựng sẵn chỉ là chất liệu roleplay; không còn nút bật Max IV/EV/EXP/catch
// riêng để tránh người chơi vô tình kích hoạt cheat.

function ChoiceChip({ active, children, onClick, tone = 'amber', disabled = false }) {
  const color = tone === 'mint' ? 'var(--mint)' : 'var(--amber)'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${active ? color : 'var(--line)'}`,
        color: active ? color : 'var(--text-mid)',
        background: active ? `color-mix(in srgb, ${color} 9%, transparent)` : 'var(--bg-deep)',
        borderRadius: 999,
        padding: '7px 13px',
        fontSize: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !active ? 0.45 : 1,
        transition: 'transform .15s ease, border-color .15s ease, background .15s ease',
      }}
    >
      {active ? '● ' : ''}{children}
    </button>
  )
}

function SectionHeading({ eyebrow, title, note }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: 'var(--amber)', fontSize: 9.5, fontWeight: 800, letterSpacing: '.14em' }}>{eyebrow}</div>
      <div style={{ color: 'var(--text-hi)', fontSize: 15, fontWeight: 750, marginTop: 2 }}>{title}</div>
      {note && <div style={{ color: 'var(--text-dim)', fontSize: 10.5, marginTop: 3, lineHeight: 1.55 }}>{note}</div>}
    </div>
  )
}

export default function TraitsModal({ onClose }) {
  const { playerTraits, setPlayerTraits, party, setParty, setPlayerMon, setInventory, storyTone, gameStarted } = useGame()
  const realistic = normalizeGameMode(storyTone) === 'realistic'
  const [draft, setDraft] = useState(() => ({
    personality: playerTraits?.personality ?? [],
    superpower: playerTraits?.superpower ?? 'none',
    customPower: playerTraits?.customPower ?? '',
    // Giữ field để save cũ không vỡ, nhưng đợt 74 luôn vô hiệu hoá perk dựng sẵn.
    perks: [],
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

  const safeDraft = sanitizeTraitsForMode(draft, storyTone)
  const detectedCustom = describeCustomMechanicEffects(safeDraft)
  const resolvedEffects = resolveMechanicEffects(safeDraft)

  // Chốt an toàn ở chính component: kể cả một màn hình cũ hoặc code thử
  // nghiệm vô tình mở lại modal sau khi vào truyện, người chơi vẫn không có
  // đường sửa tính cách/thiên phú của hành trình đang diễn ra.
  if (gameStarted) {
    return (
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 95, padding: 18, display: 'grid', placeItems: 'center', background: 'rgba(3,8,12,.82)', backdropFilter: 'blur(8px)' }}
      >
        <div onClick={(event) => event.stopPropagation()} className="panel" style={{ width: 'min(460px, 94vw)', textAlign: 'center' }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🔒</div>
          <div className="page-title" style={{ margin: '0 0 8px' }}>Hồ sơ đã được chốt</div>
          <p style={{ color: 'var(--text-mid)', fontSize: 12.5, lineHeight: 1.7 }}>
            Tính cách và thiên phú chỉ được chọn trước khi bắt đầu hành trình, không thể sửa giữa lúc chơi.
          </p>
          <button className="btn" style={{ marginTop: 8 }} onClick={onClose}>Đóng</button>
        </div>
      </div>
    )
  }

  function save() {
    const nextTraits = sanitizeTraitsForMode(draft, storyTone)
    setPlayerTraits(nextTraits)

    // Chỉ áp cơ chế khi CHÍNH ô Tự mô tả nhận diện được luật tương ứng.
    if (resolvedEffects.maxIvEv) {
      setParty((cur) => (cur ?? []).map((m) => applyPerksToMon(m, nextTraits)))
      setPlayerMon((cur) => (cur ? applyPerksToMon(cur, nextTraits) : cur))
    }
    setInventory((cur) => syncTraitGrantedItems(cur, nextTraits))
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 95, padding: 18,
        display: 'grid', placeItems: 'center',
        background: 'radial-gradient(circle at 50% 16%, rgba(120,200,170,.13), transparent 38%), rgba(3,8,12,.78)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel"
        style={{
          width: 'min(760px, 96vw)', maxHeight: '91vh', overflow: 'hidden', padding: 0,
          borderRadius: 16, boxShadow: '0 28px 90px rgba(0,0,0,.52)',
        }}
      >
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
            padding: '16px 18px', borderBottom: '1px solid var(--line)',
            background: 'linear-gradient(135deg, rgba(232,184,74,.09), rgba(120,200,170,.06))',
          }}
        >
          <div>
            <div style={{ color: 'var(--amber)', fontSize: 9.5, fontWeight: 800, letterSpacing: '.15em' }}>HỒ SƠ NHÂN VẬT</div>
            <div className="page-title" style={{ margin: '3px 0 0' }}>Tính cách &amp; năng lực</div>
          </div>
          <button className="btn" style={{ padding: '7px 12px' }} onClick={onClose}>✕ Đóng</button>
        </div>

        <div style={{ padding: 18, overflowY: 'auto', maxHeight: 'calc(91vh - 132px)' }}>
          <section style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg-deep)' }}>
            <SectionHeading
              eyebrow="TÍNH KHÍ"
              title="Nhân vật sẽ phản ứng như thế nào?"
              note="Chọn tối đa 4 nét. Đây là chỉ dẫn nhất quán cho lời kể, không sửa chỉ số game."
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {PERSONALITY_TRAITS.map((t) => (
                <ChoiceChip key={t.key} active={draft.personality.includes(t.key)} onClick={() => togglePersonality(t.key)}>
                  {t.label}
                </ChoiceChip>
              ))}
            </div>
          </section>

          <section style={{ marginTop: 14, padding: 14, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg-deep)' }}>
            <SectionHeading
              eyebrow="NĂNG LỰC"
              title={realistic ? 'Chọn một năng lực dựng sẵn' : 'Chọn chất liệu roleplay hoặc tự viết luật riêng'}
              note={realistic
                ? 'Chế độ Thực tế khoá năng lực đã chọn lúc bắt đầu; năng lực tự tạo và mọi cheat cũng bị chặn ở tầng dữ liệu.'
                : 'Các lựa chọn có sẵn chỉ ảnh hưởng lời kể. Muốn cơ chế đặc biệt phải chọn “Tự mô tả…”.'}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {SUPERPOWERS.filter((p) => !realistic || p.key !== 'custom').map((p) => (
                <ChoiceChip
                  key={p.key}
                  active={draft.superpower === p.key}
                  tone={p.key === 'custom' ? 'mint' : 'amber'}
                  disabled={realistic}
                  onClick={() => setDraft((d) => ({ ...d, superpower: p.key }))}
                >
                  {p.label}
                </ChoiceChip>
              ))}
            </div>

            {!realistic && draft.superpower === 'custom' && (
              <>
                <textarea
                  className="input"
                  style={{ width: '100%', marginTop: 12, minHeight: 112, resize: 'vertical', lineHeight: 1.65 }}
                  placeholder={'Viết rõ luật bạn muốn. Ví dụ:\n• Pokémon sở hữu Max IV/EV\n• EXP sau trận ×3\n• Cả đội dù không ra trận vẫn nhận EXP\n• Kẹo Hiếm vô hạn'}
                  value={draft.customPower}
                  onChange={(e) => setDraft((d) => ({ ...d, customPower: e.target.value }))}
                />

                <div
                  style={{
                    marginTop: 10, borderRadius: 10, padding: '11px 12px',
                    border: `1px solid ${detectedCustom.length ? 'var(--mint)' : 'var(--line)'}`,
                    background: detectedCustom.length ? 'rgba(120,200,170,.06)' : 'rgba(255,255,255,.015)',
                  }}
                >
                  <div style={{ color: detectedCustom.length ? 'var(--mint)' : 'var(--text-mid)', fontWeight: 750, fontSize: 11.5 }}>
                    {detectedCustom.length ? '✓ App đã nhận diện cơ chế' : '○ Chưa có cơ chế số liệu rõ ràng'}
                  </div>
                  {detectedCustom.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 7, marginTop: 9 }}>
                      {detectedCustom.map((label) => (
                        <div key={label} style={{ padding: '7px 9px', borderRadius: 8, background: 'rgba(0,0,0,.16)', color: 'var(--text-hi)', fontSize: 11 }}>
                          ⚙ {label}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-dim)', fontSize: 10.5, lineHeight: 1.65, marginTop: 6 }}>
                      Đoạn mô tả vẫn đi vào lời kể. App chỉ chạm vào biến khi câu viết đủ rõ và thuộc cơ chế đang hỗ trợ.
                    </div>
                  )}
                </div>
              </>
            )}

            {draft.superpower !== 'custom' && (
              <div style={{ marginTop: 12, padding: '9px 11px', borderRadius: 9, border: '1px dashed var(--line)', color: 'var(--text-dim)', fontSize: 10.5, lineHeight: 1.65 }}>
                Chế độ tiêu chuẩn: không Max IV/EV tự động, không nhân EXP, không Kẹo Hiếm vô hạn và không cộng tỉ lệ bắt.
              </div>
            )}
          </section>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, padding: '13px 18px', borderTop: '1px solid var(--line)', background: 'var(--bg-panel)' }}>
          <button className="btn" onClick={onClose}>Huỷ</button>
          <button className="btn" style={{ borderColor: 'var(--mint)', color: 'var(--mint)', paddingInline: 18 }} onClick={save}>
            ✓ Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  )
}
