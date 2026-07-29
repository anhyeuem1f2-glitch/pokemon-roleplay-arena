import React, { useState, useEffect, useRef } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { musicManager } from '../utils/musicManager.js'
import { POKECENTER_TRACK_KEYS } from '../data/musicTracks.js'
import { isSameMon } from '../data/pokemonSpecies.js'

// ============ TRUNG TÂM POKÉMON (đợt 71) ============
// Từ đợt này máu KHÔNG còn tự hồi sau trận, nên phải có chỗ chữa trị thật.
// Hai lựa chọn, đúng như bố cục quầy trong game gốc:
//   ✚ CHỮA TRỊ — y tá nhận khay Poké Ball, máy chạy, cả đội đầy máu.
//   💻 MÁY PC   — hòm Pokémon, kéo thả chuột để đổi giữa ĐỘI HÌNH và HÒM.
// Nhạc pokecenter được push khi mở và pop khi đóng.

const BALL_SPIN_MS = 2600

function spriteUrl(mon) {
  return `https://play.pokemonshowdown.com/sprites/home/${String(mon.spriteId ?? mon.species).replace(/[^a-z0-9-]/g, '')}.png`
}

/** Quả Poké Ball vẽ bằng SVG — dùng cho animation máy hồi phục. */
function Ball({ size = 34, delay = 0, spinning }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      style={{
        display: 'block',
        animation: spinning ? `pc-ball-spin 1.1s ${delay}ms linear infinite` : 'none',
        filter: spinning ? 'drop-shadow(0 0 6px rgba(233,106,92,0.85))' : 'none',
        transition: 'filter 0.3s ease',
      }}
    >
      <circle cx="20" cy="20" r="18" fill="#eef3f6" stroke="#0d131a" strokeWidth="2" />
      <path d="M2 20a18 18 0 0136 0z" fill="#ea6a5c" stroke="#0d131a" strokeWidth="2" />
      <line x1="2" y1="20" x2="38" y2="20" stroke="#0d131a" strokeWidth="2" />
      <circle cx="20" cy="20" r="6" fill="#eef3f6" stroke="#0d131a" strokeWidth="2" />
      <circle cx="20" cy="20" r="2.4" fill="#0d131a" />
    </svg>
  )
}

/** Ô hiển thị 1 Pokémon, kéo thả được. */
function MonSlot({ mon, from, index, onDragStart, onDrop, selected, onClick, empty }) {
  if (!mon) {
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onDrop?.(from, index) }}
        onClick={() => onClick?.(from, index)}
        style={{
          aspectRatio: '1', border: '1px dashed var(--line)', borderRadius: 8,
          background: 'var(--bg-deep)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'var(--text-dim)', fontSize: 13,
          cursor: empty ? 'default' : 'pointer',
        }}
      >
        —
      </div>
    )
  }
  const hpRatio = Math.max(0, Math.min(1, (mon.hp ?? 0) / Math.max(1, mon.maxHp ?? 1)))
  const fainted = (mon.hp ?? 0) <= 0
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart?.(from, index) }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onDrop?.(from, index) }}
      onClick={() => onClick?.(from, index)}
      title={`${mon.name} Lv${mon.level} — ${mon.hp}/${mon.maxHp} HP${fainted ? ' (đã gục)' : ''}`}
      style={{
        aspectRatio: '1', borderRadius: 8, padding: 3, cursor: 'grab',
        border: `1px solid ${selected ? 'var(--amber)' : 'var(--line)'}`,
        background: selected ? 'rgba(232,184,74,0.12)' : 'var(--bg-deep)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', overflow: 'hidden', position: 'relative',
        opacity: fainted ? 0.55 : 1,
      }}
    >
      <img
        src={spriteUrl(mon)}
        alt={mon.name}
        draggable={false}
        style={{ width: '72%', height: '56%', objectFit: 'contain', filter: fainted ? 'grayscale(1)' : 'none' }}
        onError={(e) => {
          e.currentTarget.outerHTML = `<span style="font-size:15px;color:var(--text-mid)">${mon.name[0]}</span>`
        }}
      />
      <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-mid)', lineHeight: 1.3 }}>
        Lv{mon.level}
      </span>
      <div style={{ width: '80%', height: 3, borderRadius: 999, background: 'var(--bg-panel)', overflow: 'hidden', marginTop: 1 }}>
        <div
          style={{
            width: `${hpRatio * 100}%`, height: '100%',
            background: hpRatio < 0.25 ? '#d94f4f' : hpRatio < 0.5 ? '#e8b84a' : 'var(--mint)',
          }}
        />
      </div>
    </div>
  )
}

export default function PokecenterModal({ centerName, initialTab = 'menu', onClose, onFinish }) {
  const { party, setParty, pcBox, setPcBox, playerMon, setPlayerMon, healAll } = useGame()
  const [tab, setTab] = useState(initialTab) // menu | heal | pc
  const [healing, setHealing] = useState(false)
  const [healed, setHealed] = useState(false)
  const dragRef = useRef(null) // {from:'party'|'pc', index}
  const [picked, setPicked] = useState(null) // chọn bằng CHẠM (mobile không kéo thả được)

  // Nhạc Trung tâm Pokémon — push khi mở, pop khi đóng.
  useEffect(() => {
    musicManager.pushOverride('pokecenter', POKECENTER_TRACK_KEYS)
    return () => musicManager.popOverride('pokecenter')
  }, [])

  const hurt = [...(party ?? [])].filter((m) => (m.hp ?? 0) < (m.maxHp ?? 0) || m.status)

  function startHeal() {
    if (healing || healed) return
    setTab('heal')
    setHealing(true)
    setTimeout(() => {
      healAll()
      setHealing(false)
      setHealed(true)
    }, BALL_SPIN_MS)
  }

  // ---------- ĐỔI POKÉMON GIỮA ĐỘI HÌNH ↔ HÒM PC ----------
  // Quy tắc: đội hình không bao giờ được rỗng (luôn còn ít nhất 1 con) và
  // không quá 6. Thả vào ô trống = CHUYỂN; thả lên ô có con = HOÁN ĐỔI.
  function moveMon(from, fromIdx, to, toIdx) {
    const p = [...(party ?? [])]
    const b = [...(pcBox ?? [])]
    const src = from === 'party' ? p : b
    const dst = to === 'party' ? p : b
    const mon = src[fromIdx]
    if (!mon) return
    if (from === to && fromIdx === toIdx) return
    if (from === 'party' && to === 'pc' && p.length <= 1) {
      window.alert('Phải giữ ít nhất 1 Pokémon trong đội hình.')
      return
    }
    const target = dst[toIdx]
    if (target) {
      // Hoán đổi hai bên — tổng số Pokémon không đổi nên không cần xét sức chứa.
      src[fromIdx] = target
      dst[toIdx] = mon
    } else {
      // Chỉ xét sức chứa khi CHUYỂN GIỮA HAI danh sách. Kéo thả để sắp xếp
      // lại thứ tự TRONG chính đội hình thì tổng số không tăng — nếu xét
      // p.length >= 6 ở đây thì đội đủ 6 con sẽ không đổi thứ tự được.
      if (to === 'party' && from !== 'party' && p.length >= 6) return
      src.splice(fromIdx, 1)
      if (to === 'party') dst.push(mon)
      else dst.splice(Math.min(toIdx, dst.length), 0, mon)
    }
    setParty(p.filter(Boolean))
    setPcBox(b.filter(Boolean))
    // Con đang ra trận bị gửi vào hòm → chọn lại con đầu đội.
    if (playerMon && !p.filter(Boolean).some((m) => isSameMon(m, playerMon))) {
      setPlayerMon(p.filter(Boolean)[0] ?? null)
    }
  }

  function handleDragStart(from, index) { dragRef.current = { from, index }; setPicked(null) }
  function handleDrop(to, toIdx) {
    const d = dragRef.current
    dragRef.current = null
    if (d) moveMon(d.from, d.index, to, toIdx)
  }
  // Bấm chọn rồi bấm đích — đường thay thế cho kéo thả (dùng được trên điện thoại).
  function handleClick(where, index) {
    if (!picked) {
      const list = where === 'party' ? party : pcBox
      if (!list?.[index]) return
      setPicked({ from: where, index })
      return
    }
    moveMon(picked.from, picked.index, where, index)
    setPicked(null)
  }

  const boxSlots = Math.max(30, (pcBox ?? []).length + 6)

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}
    >
      <style>{`
        @keyframes pc-ball-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes pc-ball-rise { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-9px) } }
        @keyframes pc-glow { 0%,100% { opacity: 0.35 } 50% { opacity: 1 } }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        className="panel"
        style={{ width: 'min(620px, 96vw)', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span className="page-title" style={{ margin: 0 }}>✚ {centerName || 'Trung tâm Pokémon'}</span>
          <button className="btn" style={{ padding: '4px 10px' }} onClick={onClose}>Đóng</button>
        </div>

        {/* ---------- MÀN CHỌN: 2 NÚT ---------- */}
        {tab === 'menu' && (
          <>
            <p style={{ fontSize: 12.5, color: 'var(--text-mid)', margin: '0 0 16px', lineHeight: 1.7 }}>
              “Chào mừng đến Trung tâm Pokémon! Chúng tôi có thể chữa trị cho Pokémon của bạn,
              hoặc bạn có thể dùng máy PC để sắp xếp đội hình.”
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button
                onClick={startHeal}
                style={{
                  border: '1px solid #e05a5a', background: 'var(--bg-deep)', borderRadius: 12,
                  padding: '22px 10px', cursor: 'pointer', color: 'inherit',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                }}
              >
                {/* Chữ thập đỏ */}
                <svg width="46" height="46" viewBox="0 0 40 40">
                  <rect x="15" y="4" width="10" height="32" rx="2.5" fill="#e05a5a" />
                  <rect x="4" y="15" width="32" height="10" rx="2.5" fill="#e05a5a" />
                </svg>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#e05a5a' }}>CHỮA TRỊ</span>
                <span style={{ fontSize: 10.5, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5 }}>
                  {hurt.length > 0
                    ? `${hurt.length} Pokémon đang bị thương`
                    : 'Cả đội đang khoẻ mạnh'}
                </span>
              </button>

              <button
                onClick={() => setTab('pc')}
                style={{
                  border: '1px solid var(--mint)', background: 'var(--bg-deep)', borderRadius: 12,
                  padding: '22px 10px', cursor: 'pointer', color: 'inherit',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                }}
              >
                {/* Màn hình máy tính */}
                <svg width="46" height="46" viewBox="0 0 40 40">
                  <rect x="4" y="6" width="32" height="22" rx="3" fill="none" stroke="var(--mint)" strokeWidth="2.5" />
                  <rect x="8" y="10" width="24" height="14" rx="1.5" fill="var(--mint)" opacity="0.25" />
                  <rect x="15" y="30" width="10" height="3" fill="var(--mint)" />
                  <rect x="10" y="33" width="20" height="3" rx="1.5" fill="var(--mint)" />
                </svg>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--mint)' }}>MÁY PC</span>
                <span style={{ fontSize: 10.5, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5 }}>
                  Đội {(party ?? []).length}/6 · Hòm {(pcBox ?? []).length} con
                </span>
              </button>
            </div>
          </>
        )}

        {/* ---------- CHỮA TRỊ: ANIMATION CẦU XOAY ---------- */}
        {tab === 'heal' && (
          <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
            {/* Khay máy hồi phục */}
            <div
              style={{
                display: 'inline-flex', gap: 14, padding: '20px 26px', borderRadius: 14,
                background: 'var(--bg-deep)', border: '1px solid var(--line)',
                boxShadow: healing ? '0 0 26px rgba(233,106,92,0.35)' : 'none',
                transition: 'box-shadow 0.4s ease',
              }}
            >
              {Array.from({ length: Math.max(1, Math.min(6, (party ?? []).length || 1)) }).map((_, i) => (
                <div key={i} style={{ animation: healing ? `pc-ball-rise 1.1s ${i * 140}ms ease-in-out infinite` : 'none' }}>
                  <Ball delay={i * 140} spinning={healing} />
                </div>
              ))}
            </div>

            <p style={{ fontSize: 13.5, color: healed ? 'var(--mint)' : 'var(--text-mid)', marginTop: 20, lineHeight: 1.8 }}>
              {healing ? (
                <span style={{ animation: 'pc-glow 1.2s ease-in-out infinite' }}>
                  Máy đang chạy… xin chờ một lát.
                </span>
              ) : (
                <>
                  “Pokémon của bạn đã hoàn toàn khoẻ mạnh!”
                  <br />
                  <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                    Cả đội đã hồi đầy máu và hết mọi trạng thái bất lợi.
                  </span>
                </>
              )}
            </p>

            {!healing && (
              <div className="btn-row" style={{ justifyContent: 'center', marginTop: 8 }}>
                <button className="btn" onClick={() => setTab('menu')}>Quay lại quầy</button>
                <button
                  className="btn"
                  style={{ borderColor: 'var(--mint)', color: 'var(--mint)' }}
                  onClick={() => onFinish?.('heal')}
                >
                  Rời trung tâm
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------- MÁY PC ---------- */}
        {tab === 'pc' && (
          <div>
            <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: '0 0 12px', lineHeight: 1.6 }}>
              Kéo thả chuột để chuyển Pokémon giữa đội hình và hòm (hoặc bấm chọn một con rồi bấm vào
              ô đích). Thả lên ô đã có con = hoán đổi. Đội hình luôn phải còn ít nhất 1 Pokémon.
              {picked && <strong style={{ color: 'var(--amber)' }}> — đang chọn, bấm ô đích để chuyển.</strong>}
            </p>

            <div style={{ fontSize: 11.5, color: 'var(--text-mid)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Đội hình ({(party ?? []).length}/6)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 18 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <MonSlot
                  key={`p${i}`}
                  mon={(party ?? [])[i]}
                  from="party"
                  index={i}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onClick={handleClick}
                  selected={picked?.from === 'party' && picked.index === i}
                />
              ))}
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--text-mid)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Hòm PC ({(pcBox ?? []).length} con)
            </div>
            <div
              style={{
                display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6,
                maxHeight: 250, overflowY: 'auto', padding: 6,
                border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-deep)',
              }}
            >
              {Array.from({ length: boxSlots }).map((_, i) => (
                <MonSlot
                  key={`b${i}`}
                  mon={(pcBox ?? [])[i]}
                  from="pc"
                  index={i}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onClick={handleClick}
                  selected={picked?.from === 'pc' && picked.index === i}
                />
              ))}
            </div>

            <div className="btn-row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
              <button className="btn" onClick={() => { setPicked(null); setTab('menu') }}>Quay lại quầy</button>
              <button
                className="btn"
                style={{ borderColor: 'var(--mint)', color: 'var(--mint)' }}
                onClick={() => onFinish?.('pc')}
              >
                Rời trung tâm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
