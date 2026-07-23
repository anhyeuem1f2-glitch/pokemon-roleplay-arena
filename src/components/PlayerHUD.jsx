import React, { useState, useMemo } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { SHOP_ITEMS, SHOP_CATEGORY_LABELS } from '../data/shopItems.js'
import BodyFigure, { BODY_PARTS } from './BodyFigure.jsx'
import PokemonInfoModal from './PokemonInfoModal.jsx'

// ============ HUD DỌC BÊN TRÁI (chỉ hiện khi đang chơi game) ============
// Bố cục dọc lấy cảm hứng từ giao diện game text Phàm Nhân Tu Tiên: cột
// trạng thái cố định bên trái, trên xuống dưới: avatar → tên/tuổi/tiền →
// sinh lực theo bộ phận cơ thể (chế độ chân thực) → đội hình 6 ô (bấm để
// xem chi tiết) → quan hệ NPC (điểm hảo cảm) → khu vực hiện tại → 2 nút
// Cài đặt / Màn hình chính.

function SectionTitle({ children }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        letterSpacing: '0.12em',
        fontWeight: 700,
        color: 'var(--amber)',
        borderBottom: '1px solid var(--line)',
        padding: '10px 0 4px',
        marginBottom: 8,
      }}
    >
      ◆ {children}
    </div>
  )
}

function AffinityBar({ value }) {
  // Hảo cảm -100..100: vạch giữa là 0, kéo sang phải (xanh) khi quý mến,
  // sang trái (đỏ) khi thù ghét.
  const pct = Math.min(100, Math.abs(value)) / 2 // nửa thanh mỗi chiều
  const positive = value >= 0
  return (
    <div style={{ position: 'relative', height: 6, background: 'var(--bg-deep)', borderRadius: 3, border: '1px solid var(--line)' }}>
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--line)' }} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [positive ? 'left' : 'right']: '50%',
          width: `${pct}%`,
          background: positive ? 'var(--mint)' : '#d94f4f',
          borderRadius: 3,
        }}
      />
    </div>
  )
}

export default function PlayerHUD() {
  const {
    playerName, playerProfile, bodyStatus, setBodyStatus, hunger,
    party, setParty, playerMon, setPlayerMon,
    relationships, inventory, setInventory,
  } = useGame()
  const [infoMon, setInfoMon] = useState(null)

  return (
    <aside
      style={{
        width: 232,
        flexShrink: 0,
        borderRight: '1px solid var(--line)',
        background: 'var(--bg-panel)',
        padding: '14px 14px 18px',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: '100%',
          aspectRatio: '1',
          border: '1px solid var(--line)',
          borderRadius: 10,
          background: 'var(--bg-deep)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {playerProfile.avatarUrl ? (
          <img
            src={playerProfile.avatarUrl}
            alt="avatar"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <span style={{ fontSize: 40, color: 'var(--text-dim)' }}>{(playerName || '?')[0]?.toUpperCase()}</span>
        )}
      </div>

      {/* Tên / tuổi / tiền */}
      <SectionTitle>Thông tin cá nhân</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-dim)' }}>Tên</span>
          <strong>{playerName || '—'}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-dim)' }}>Tuổi</span>
          <strong>{playerProfile.age}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-dim)' }}>Tiền</span>
          <strong style={{ color: 'var(--amber)' }}>₽{Number(playerProfile.money).toLocaleString('vi-VN')}</strong>
        </div>
      </div>

      {/* Sinh lực theo bộ phận */}
      <SectionTitle>Sinh lực</SectionTitle>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <BodyFigure bodyStatus={bodyStatus} size={92} />
      </div>
      <div style={{ fontSize: 9.5, color: 'var(--text-dim)', textAlign: 'center', marginTop: 2 }}>
        xám lành lặn · vàng nhẹ · cam vừa · đỏ nặng · đen mất
      </div>

      {/* Độ no (đợt 36): tự trừ theo ngày trôi + AI tag khi ăn uống */}
      <SectionTitle>Độ no</SectionTitle>
      {/* Đợt 48 (yêu cầu beta): thanh Pokémon chuyển vào modal chi tiết —
          bấm ô đội hình của con đang ra trận mới thấy, HUD gọn lại. */}
      {[['Người', hunger.player]].map(([label, val]) => (
        <div key={label} style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-mid)' }}>
            <span>{label}</span>
            <span style={{ color: val < 30 ? '#d94f4f' : 'var(--text-dim)' }}>{val}/100{val < 30 ? ' — đói!' : ''}</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-deep)', border: '1px solid var(--line)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${val}%`, height: '100%', transition: 'width 0.4s ease',
                background: val < 30 ? '#d94f4f' : val < 60 ? '#e8b84a' : 'var(--mint)',
              }}
            />
          </div>
        </div>
      ))}

      {/* Đội hình 6 ô */}
      <SectionTitle>Đội hình</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {Array.from({ length: 6 }).map((_, i) => {
          const mon = party[i]
          return (
            <button
              key={i}
              onClick={() => mon && setInfoMon(mon)}
              title={mon ? `${mon.name} Lv${mon.level} — bấm xem chi tiết` : 'Ô trống'}
              style={{
                aspectRatio: '1',
                border: mon ? '1px solid var(--line)' : '1px dashed var(--line)',
                borderRadius: 8,
                background: 'var(--bg-deep)',
                cursor: mon ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 2,
                overflow: 'hidden',
              }}
            >
              {mon ? (
                <>
                  <img
                    src={`https://play.pokemonshowdown.com/sprites/home/${(mon.spriteId ?? mon.species).replace(/[^a-z0-9-]/g, '')}.png`}
                    alt={mon.name}
                    style={{ width: '78%', height: '68%', objectFit: 'contain' }}
                    onError={(e) => {
                      // Sprite lỗi → chữ cái đầu (fallback giống MonAvatar).
                      e.currentTarget.outerHTML = `<span style="font-size:15px;color:var(--text-mid)">${mon.name[0]}</span>`
                    }}
                  />
                  <span style={{ fontSize: 8.5, fontFamily: 'var(--font-mono)', color: 'var(--text-mid)' }}>
                    Lv{mon.level}
                  </span>
                </>
              ) : (
                <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>—</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Túi đồ TƯƠNG TÁC (đợt 26): phân mục đầy đủ, bấm item để dùng */}
      <SectionTitle>Túi đồ</SectionTitle>
      <InventoryPanel
        inventory={inventory}
        setInventory={setInventory}
        party={party}
        setParty={setParty}
        playerMon={playerMon}
        setPlayerMon={setPlayerMon}
        bodyStatus={bodyStatus}
        setBodyStatus={setBodyStatus}
      />

      {/* Quan hệ NPC */}
      <SectionTitle>Quan hệ</SectionTitle>
      {relationships.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Chưa gặp NPC nào.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {relationships.map((r) => (
            <div key={r.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                <span>{r.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: r.affinity >= 0 ? 'var(--mint)' : '#d94f4f' }}>
                  {r.affinity > 0 ? '+' : ''}
                  {r.affinity}
                </span>
              </div>
              <AffinityBar value={r.affinity} />
              {r.note && <div style={{ fontSize: 9.5, color: 'var(--text-dim)', marginTop: 2 }}>{r.note}</div>}
            </div>
          ))}
        </div>
      )}

      {infoMon && <PokemonInfoModal mon={infoMon} hungerMon={playerMon && infoMon.name === playerMon.name ? hunger.mon : null} onClose={() => setInfoMon(null)} />}
    </aside>
  )
}

// ============ TÚI ĐỒ TƯƠNG TÁC ============
// Phân mục đầy đủ theo danh mục shop (bóng / hồi phục Pokémon / chữa trạng
// thái / đồ cho người / tiện ích). Bấm item mở chi tiết + nút DÙNG:
// - Đồ hồi phục Pokémon: chọn 1 con trong đội để hồi HP (Full Restore chữa
//   cả trạng thái, Revive chỉ dùng cho con đã gục).
// - Đồ cho người: chọn bộ phận cơ thể để giảm thương tích (băng gạc -10,
//   túi cứu thương -30).
// - Bóng/chữa trạng thái/tiện ích: dùng trong trận/truyện (sẽ nối sau).
const HEAL_AMOUNTS = { potion: 20, superpotion: 60, hyperpotion: 120, freshwater: 30 }
const HUMAN_HEAL = { bandage: 10, medkit: 30 }

function InventoryPanel({ inventory, setInventory, party, setParty, playerMon, setPlayerMon, bodyStatus, setBodyStatus }) {
  const [openCat, setOpenCat] = useState('heal')
  const [openItem, setOpenItem] = useState(null) // item id đang mở chi tiết
  const [feedback, setFeedback] = useState(null)

  const catalog = useMemo(() => Object.fromEntries(SHOP_ITEMS.map((it) => [it.id, it])), [])
  const grouped = useMemo(() => {
    const g = {}
    for (const it of inventory) {
      const cat = catalog[it.id]?.category ?? 'misc'
      ;(g[cat] ??= []).push(it)
    }
    return g
  }, [inventory, catalog])

  function consume(itemId) {
    setInventory(
      inventory
        .map((it) => (it.id === itemId ? { ...it, qty: it.qty - 1 } : it))
        .filter((it) => it.qty > 0),
    )
  }

  function healPartyMon(item, monIndex) {
    const mon = party[monIndex]
    if (!mon) return
    const isRevive = item.id === 'revive'
    const isFull = item.id === 'fullrestore'
    if (isRevive && mon.hp > 0) {
      setFeedback(`${mon.name} chưa gục — Revive chỉ dùng cho Pokémon đã gục ngã.`)
      return
    }
    if (!isRevive && mon.hp <= 0) {
      setFeedback(`${mon.name} đã gục — cần Revive trước.`)
      return
    }
    let newHp
    if (isRevive) newHp = Math.floor(mon.maxHp / 2)
    else if (isFull) newHp = mon.maxHp
    else newHp = Math.min(mon.maxHp, mon.hp + (HEAL_AMOUNTS[item.id] ?? 20))
    const updated = { ...mon, hp: newHp, ...(isFull ? { status: null, sleepTurns: undefined } : {}) }
    setParty(party.map((m, i) => (i === monIndex ? updated : m)))
    // Đồng bộ con đang ra trận nếu chính là nó (so theo tên + level).
    if (playerMon && playerMon.name === mon.name && playerMon.level === mon.level) {
      setPlayerMon({ ...playerMon, hp: newHp, ...(isFull ? { status: null, sleepTurns: undefined } : {}) })
    }
    consume(item.id)
    setFeedback(`Đã dùng ${item.name} cho ${mon.name} → HP ${newHp}/${mon.maxHp}.`)
  }

  function healBodyPart(item, partKey) {
    const amount = HUMAN_HEAL[item.id] ?? 10
    const next = { ...bodyStatus, [partKey]: Math.max(0, (bodyStatus[partKey] ?? 0) - amount) }
    setBodyStatus(next)
    consume(item.id)
    const label = BODY_PARTS.find((b) => b.key === partKey)?.label
    setFeedback(`Đã dùng ${item.name} cho ${label} → thương tích còn ${next[partKey]}/100.`)
  }

  if (inventory.length === 0) {
    return <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Trống — mua đồ tại các cửa hàng trong truyện.</div>
  }

  return (
    <div>
      {/* Tabs phân mục — hiện đủ mọi mục, mục trống mờ đi */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {Object.entries(SHOP_CATEGORY_LABELS).map(([cat, label]) => {
          const count = grouped[cat]?.reduce((n, it) => n + it.qty, 0) ?? 0
          return (
            <button
              key={cat}
              onClick={() => { setOpenCat(cat); setOpenItem(null) }}
              style={{
                fontSize: 9.5,
                padding: '3px 8px',
                borderRadius: 999,
                border: `1px solid ${openCat === cat ? 'var(--amber)' : 'var(--line)'}`,
                background: openCat === cat ? 'var(--bg-deep)' : 'transparent',
                color: count > 0 ? 'var(--text-hi)' : 'var(--text-dim)',
                cursor: 'pointer',
              }}
            >
              {label} {count > 0 ? `(${count})` : ''}
            </button>
          )
        })}
      </div>

      {(grouped[openCat] ?? []).length === 0 ? (
        <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Mục này trống.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {grouped[openCat].map((it) => {
            const info = catalog[it.id]
            const isOpen = openItem === it.id
            const canHealMon = openCat === 'heal' && (it.id in HEAL_AMOUNTS || it.id === 'fullrestore' || it.id === 'revive')
            const canHealHuman = openCat === 'human' && it.id in HUMAN_HEAL
            return (
              <div key={it.id} style={{ border: '1px solid var(--line)', borderRadius: 7 }}>
                <button
                  onClick={() => setOpenItem(isOpen ? null : it.id)}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between',
                    background: 'transparent', border: 'none', color: 'var(--text-hi)',
                    padding: '5px 8px', fontSize: 11.5, cursor: 'pointer',
                  }}
                >
                  <span>{it.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-mid)' }}>x{it.qty}</span>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 8px 8px', fontSize: 10.5 }}>
                    <div style={{ color: 'var(--text-dim)', marginBottom: 6 }}>{info?.desc}</div>
                    {canHealMon && (
                      <div>
                        <div style={{ marginBottom: 4 }}>Dùng cho:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {party.map((mon, i) => (
                            <button key={i} className="btn" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => healPartyMon(info, i)}>
                              {mon.name} ({mon.hp}/{mon.maxHp})
                            </button>
                          ))}
                          {party.length === 0 && <span style={{ color: 'var(--text-dim)' }}>Đội hình trống.</span>}
                        </div>
                      </div>
                    )}
                    {canHealHuman && (
                      <div>
                        <div style={{ marginBottom: 4 }}>Sơ cứu bộ phận:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {BODY_PARTS.map((b) => (
                            <button key={b.key} className="btn" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => healBodyPart(info, b.key)}>
                              {b.label} ({bodyStatus[b.key] ?? 0})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {!canHealMon && !canHealHuman && (
                      <div style={{ color: 'var(--text-dim)' }}>Dùng trong trận/truyện — sẽ được nối ở đợt sau.</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {feedback && (
        <div style={{ fontSize: 10, color: 'var(--mint)', marginTop: 6 }}>{feedback}</div>
      )}
    </div>
  )
}
