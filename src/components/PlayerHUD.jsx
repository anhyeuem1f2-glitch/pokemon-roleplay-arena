import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useGame } from '../context/GameContext.jsx'
import { SHOP_ITEMS, SHOP_CATEGORY_LABELS } from '../data/shopItems.js'
import BodyFigure, { BODY_PARTS } from './BodyFigure.jsx'
import PokemonInfoModal from './PokemonInfoModal.jsx'
import MonAvatar from './MonAvatar.jsx'
import { genderLabel, genderSymbol } from '../data/pokemonGender.js'
import AvatarPicker from './AvatarPicker.jsx'
import { PERSONALITY_TRAITS, SUPERPOWERS } from '../data/characterTraits.js'
import { describeCustomMechanicEffects } from '../data/playerPerks.js'
import { levelUpMon, isSameMon } from '../data/pokemonSpecies.js'
import { heldItemDescription, heldItemLabel, isHoldableItem, isTrainerGear, normalizeHeldItem, resolveHeldItemByName } from '../data/pokemonHeldItems.js'

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

export default function PlayerHUD({ mobile = false }) {
  const {
    playerName, playerProfile, setPlayerProfile, bodyStatus, setBodyStatus, hunger, setHunger, playerTraits,
    party, setParty, playerMon, setPlayerMon,
    relationships, inventory, setInventory, movesDb,
  } = useGame()
  const [infoMon, setInfoMon] = useState(null)
  // Đợt 54: bấm khung avatar để đổi ảnh ngay giữa truyện.
  const [avatarOpen, setAvatarOpen] = useState(false)
  const customMechanics = describeCustomMechanicEffects(playerTraits)

  return (
    <>
    <aside
      style={{
        // Đợt 53: mobile → panel tràn ngang, cao tự nhiên, KHÔNG sticky/100vh
        // (điện thoại không đủ chỗ cho 2 cột dọc hai bên).
        width: mobile ? '100%' : 232,
        flexShrink: 0,
        borderRight: mobile ? 'none' : '1px solid var(--line)',
        borderBottom: mobile ? '1px solid var(--line)' : undefined,
        background: 'var(--bg-panel)',
        padding: '14px 14px 18px',
        position: mobile ? 'static' : 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        height: mobile ? 'auto' : '100vh',
        overflowY: 'auto',
      }}
    >
      {/* Avatar — bấm để đổi ảnh (đợt 54) */}
      <div
        onClick={() => setAvatarOpen(true)}
        title="Bấm để đổi ảnh đại diện"
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
          cursor: 'pointer',
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
      {/* Tính cách + Thiên phú (đợt 69) — người chơi báo "thiên phú không
          áp vào biến"; giờ hiện thẳng trên HUD như một chỉ số nhân vật. */}
      <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionTitle>Tính cách &amp; Thiên phú</SectionTitle>
            <span
              title="Tính cách và thiên phú đã được chốt khi bắt đầu hành trình"
              style={{ border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text-dim)', fontSize: 9.5, padding: '1px 7px', marginTop: 12, whiteSpace: 'nowrap' }}
            >
              🔒 Đã khóa
            </span>
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.7, marginBottom: 10 }}>
            {playerTraits?.personality?.length > 0 && (
              <div style={{ color: 'var(--text-mid)' }}>
                {playerTraits.personality
                  .map((k) => PERSONALITY_TRAITS.find((t) => t.key === k)?.label)
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            )}
            {playerTraits?.superpower && playerTraits.superpower !== 'none' && (
              <div style={{ color: 'var(--amber)', marginTop: 3 }}>
                ✦ {playerTraits.superpower === 'custom'
                  ? (playerTraits.customPower || 'Năng lực riêng')
                  : (SUPERPOWERS.find((sp) => sp.key === playerTraits.superpower)?.label ?? playerTraits.superpower)}
              </div>
            )}
            {/* Đợt 74: chỉ cơ chế đọc từ ô Tự mô tả mới hiện ở đây. */}
            {customMechanics.map((label) => (
              <div key={`custom-${label}`} style={{ color: 'var(--mint)', marginTop: 3 }}>
                ⚙ Tùy chỉnh — {label}
              </div>
            ))}
            {!(playerTraits?.personality?.length > 0)
              && (!playerTraits?.superpower || playerTraits.superpower === 'none')
              && customMechanics.length === 0 && (
              <div style={{ color: 'var(--text-dim)' }}>Không chọn trong hồ sơ khởi đầu.</div>
            )}
          </div>
        </>

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
              title={mon ? `${mon.name} ${genderSymbol(mon.gender)} ${genderLabel(mon.gender)} · Lv${mon.level} — ${mon.hp}/${mon.maxHp} HP${(mon.hp ?? 0) <= 0 ? ' (đã gục — cần Trung tâm Pokémon)' : ''}${mon.status ? ` [${mon.status}]` : ''} — bấm xem chi tiết` : 'Ô trống'}
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
                  <MonAvatar mon={mon} side="enemy" size={44} />
                  <span style={{ fontSize: 8.5, fontFamily: 'var(--font-mono)', color: 'var(--text-mid)' }}>
                    {genderSymbol(mon.gender)} · Lv{mon.level}
                  </span>
                  {/* Đợt 71: máu KHÔNG còn tự hồi sau trận nữa, nên đội hình
                      phải nhìn thấy được con nào đang thương tích — không thì
                      người chơi chẳng biết khi nào cần vào Trung tâm. */}
                  {(() => {
                    const r = Math.max(0, Math.min(1, (mon.hp ?? 0) / Math.max(1, mon.maxHp ?? 1)))
                    return (
                      <div style={{ width: '82%', height: 3, borderRadius: 999, background: 'var(--bg-panel)', overflow: 'hidden', marginTop: 2 }}>
                        <div style={{ width: `${r * 100}%`, height: '100%', background: r <= 0 ? '#6b6b6b' : r < 0.25 ? '#d94f4f' : r < 0.5 ? '#e8b84a' : 'var(--mint)' }} />
                      </div>
                    )
                  })()}
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
        hunger={hunger}
        setHunger={setHunger}
        movesDb={movesDb}
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

    </aside>

    {/* Modal phải thoát khỏi stacking context của sidebar sticky. Nếu để bên
        trong <aside>, nội dung cột truyện (đặc biệt lựa chọn hành động) có thể
        được trình duyệt vẽ đè lên cửa sổ Pokémon dù modal có z-index cao. */}
    {typeof document !== 'undefined' && createPortal(<>
      {avatarOpen && (
        <div
          onClick={() => setAvatarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} className="panel" style={{ width: 'min(460px, 96vw)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span className="page-title" style={{ margin: 0 }}>Ảnh đại diện</span>
              <button className="btn" style={{ padding: '4px 10px' }} onClick={() => setAvatarOpen(false)}>Đóng</button>
            </div>
            <AvatarPicker
              value={playerProfile.avatarUrl}
              onChange={(v) => setPlayerProfile({ ...playerProfile, avatarUrl: v })}
              fallbackLetter={(playerName || '?')[0]?.toUpperCase()}
              size={120}
            />
          </div>
        </div>
      )}

      {infoMon && <PokemonInfoModal mon={infoMon} party={party} activeMon={playerMon} hunger={hunger.mon} onSelect={setInfoMon} onClose={() => setInfoMon(null)} />}
    </>, document.body)}
    </>
  )
}

// ============ TÚI ĐỒ TƯƠNG TÁC ============
// Phân mục đầy đủ theo danh mục shop (bóng / hồi phục Pokémon / chữa trạng
// thái / đồ cho người / tiện ích). Bấm item mở chi tiết + nút DÙNG:
// - Đồ hồi phục Pokémon: chọn 1 con trong đội để hồi HP (Full Restore chữa
//   cả trạng thái, Revive chỉ dùng cho con đã gục).
// - Đồ cho người: chọn bộ phận cơ thể để giảm thương tích (băng gạc -10,
//   túi cứu thương -30).
// - Thuốc chữa trạng thái dùng được cả ngoài trận; bóng và tiện ích theo ngữ
//   cảnh trận đấu/chính văn tương ứng.
const HEAL_AMOUNTS = { potion: 20, superpotion: 60, hyperpotion: 120, freshwater: 30 }
const STATUS_CURES = {
  antidote: ['psn', 'tox'], paralyzeheal: ['par'], awakening: ['slp'], burnheal: ['brn'],
  iceheal: ['frz'], fullheal: ['psn', 'tox', 'par', 'slp', 'brn', 'frz'],
}
const HUMAN_HEAL = { bandage: 10, firstaidkit: 18, medkit: 30 }

function InventoryPanel({ inventory, setInventory, party, setParty, playerMon, setPlayerMon, bodyStatus, setBodyStatus, hunger, setHunger, movesDb }) {
  const [openCat, setOpenCat] = useState('heal')
  const [openItem, setOpenItem] = useState(null) // item id đang mở chi tiết
  const [feedback, setFeedback] = useState(null)

  const catalog = useMemo(() => Object.fromEntries(SHOP_ITEMS.map((it) => [it.id, it])), [])
  const grouped = useMemo(() => {
    const g = {}
    for (const it of (inventory ?? [])) {
      const cat = catalog[it.id]?.category ?? resolveHeldItemByName(it)?.category ?? it.category ?? 'misc'
      ;(g[cat] ??= []).push(it)
    }
    return g
  }, [inventory, catalog])

  function addInventoryItem(item) {
    if (!item) return
    const resolved = resolveHeldItemByName(item) ?? item
    setInventory((cur) => {
      const list = [...(cur ?? [])]
      const idx = list.findIndex((it) => it.id === resolved.id)
      if (idx >= 0) list[idx] = { ...list[idx], qty: (list[idx].qty ?? 1) + 1 }
      else list.push({ id: resolved.id, name: resolved.name, qty: 1 })
      return list
    })
  }

  function consume(itemId) {
    setInventory((cur) =>
      (cur ?? [])
        .map((it) => (it.id === itemId && !it.infinite ? { ...it, qty: (it.qty ?? 1) - 1 } : it))
        .filter((it) => it.infinite || (it.qty ?? 0) > 0),
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
    if (!isRevive && mon.hp >= mon.maxHp && (!isFull || !mon.status)) {
      setFeedback(`${mon.name} không cần dùng ${item.name} lúc này.`)
      return
    }
    let newHp
    if (isRevive) newHp = Math.max(1, Math.floor(mon.maxHp / 2))
    else if (isFull) newHp = mon.maxHp
    else newHp = Math.min(mon.maxHp, mon.hp + (HEAL_AMOUNTS[item.id] ?? 20))
    const updated = { ...mon, hp: newHp, ...(isFull ? { status: null, sleepTurns: undefined, toxicCounter: undefined } : {}) }
    setParty(party.map((m, i) => (i === monIndex ? updated : m)))
    // Đồng bộ đúng CÁ THỂ đang ra trận (ưu tiên uid, save cũ mới lùi về tên).
    if (playerMon && isSameMon(playerMon, mon)) {
      setPlayerMon({ ...playerMon, hp: newHp, ...(isFull ? { status: null, sleepTurns: undefined, toxicCounter: undefined } : {}) })
    }
    consume(item.id)
    setFeedback(`Đã dùng ${item.name} cho ${mon.name} → HP ${newHp}/${mon.maxHp}.`)
  }

  function curePartyMon(item, monIndex) {
    const mon = party[monIndex]
    const cures = STATUS_CURES[item.id] ?? []
    if (!mon || mon.hp <= 0 || !mon.status || !cures.includes(mon.status)) {
      setFeedback(`${item.name} không chữa được trạng thái hiện tại của ${mon?.name ?? 'Pokémon này'}.`)
      return
    }
    const updated = { ...mon, status: null, sleepTurns: undefined, toxicCounter: undefined }
    setParty(party.map((entry, index) => index === monIndex ? updated : entry))
    if (playerMon && isSameMon(playerMon, mon)) setPlayerMon({ ...playerMon, status: null, sleepTurns: undefined, toxicCounter: undefined })
    consume(item.id)
    setFeedback(`Đã dùng ${item.name}; ${mon.name} khỏi trạng thái xấu.`)
  }

  // ===== KẸO HIẾM (đợt 72) =====
  // Tester báo: cho ăn Rare Candy trong lời kể thì AI mô tả "lên Lv11" nhưng
  // BIẾN KHÔNG ĐỔI — vì trước đợt này Kẹo Hiếm không hề tồn tại như một vật
  // phẩm, chỉ là chữ trong truyện. Nay nó là món thật, bấm là level đổi thật.
  function feedRareCandy(item, monIndex) {
    const mon = party[monIndex]
    if (!mon) return
    if ((mon.level ?? 1) >= 100) {
      setFeedback(`${mon.name} đã đạt cấp tối đa (Lv.100).`)
      return
    }
    const leveled = levelUpMon(mon, movesDb)
    setParty(party.map((m, i) => (i === monIndex ? leveled : m)))
    if (playerMon && isSameMon(playerMon, mon)) setPlayerMon(leveled)
    consume(item.id)
    setFeedback(`${mon.name} ăn ${item.name} → Lv.${mon.level} ⭢ Lv.${leveled.level}! (HP ${leveled.hp}/${leveled.maxHp})`)
  }


  function equipHeldItem(item, monIndex) {
    const mon = party[monIndex]
    const equipment = resolveHeldItemByName(item)
    if (!mon || !equipment) return
    if (!equipment.holdable) {
      setFeedback(`${equipment.name} là thiết bị của huấn luyện viên, không thể cho Pokémon cầm.`)
      return
    }
    if (!item.infinite && (item.qty ?? 1) <= 0) return
    const oldItem = mon.heldItem ? resolveHeldItemByName(mon.heldItem) : null
    if (oldItem?.id === equipment.id) {
      setFeedback(`${mon.name} đang cầm ${equipment.name}.`)
      return
    }
    // Tính toàn bộ kết quả trước rồi mới setState: tránh lỗi React updater
    // ghi đè túi/đội hình khi vừa tháo món cũ vừa đeo món mới.
    const updated = { ...mon, heldItem: normalizeHeldItem({ ...equipment, fromInfinite: Boolean(item.infinite) }) }
    const nextParty = party.map((m, i) => (i === monIndex ? updated : m))
    setParty(nextParty)
    if (playerMon && isSameMon(playerMon, mon)) setPlayerMon({ ...playerMon, heldItem: updated.heldItem })
    setInventory((cur) => {
      let next = (cur ?? []).map((it) => (
        it.id === item.id && !it.infinite ? { ...it, qty: (it.qty ?? 1) - 1 } : it
      )).filter((it) => it.infinite || (it.qty ?? 0) > 0)
      if (oldItem && !mon.heldItem?.fromInfinite) {
        const idx = next.findIndex((it) => it.id === oldItem.id)
        if (idx >= 0) next[idx] = { ...next[idx], qty: (next[idx].qty ?? 1) + 1 }
        else next.push({ id: oldItem.id, name: oldItem.name, qty: 1 })
      }
      return next
    })
    setFeedback(`${mon.name} đã cầm ${equipment.name}.${oldItem && !mon.heldItem?.fromInfinite ? ` ${oldItem.name} được cất lại vào túi.` : ''}`)
  }

  function unequipHeldItem(monIndex) {
    const mon = party[monIndex]
    const oldItem = resolveHeldItemByName(mon?.heldItem)
    if (!mon || !oldItem) return
    const updated = { ...mon, heldItem: null }
    setParty(party.map((m, i) => (i === monIndex ? updated : m)))
    if (playerMon && isSameMon(playerMon, mon)) setPlayerMon({ ...playerMon, heldItem: null })
    if (!mon.heldItem?.fromInfinite) addInventoryItem(oldItem)
    setFeedback(mon.heldItem?.fromInfinite
      ? `Đã tháo ${oldItem.name} khỏi ${mon.name}; bản vô hạn vẫn nằm sẵn trong túi.`
      : `Đã tháo ${oldItem.name} khỏi ${mon.name} và cất lại vào túi.`)
  }

  function healBodyPart(item, partKey) {
    const amount = Number(item.humanHeal) || HUMAN_HEAL[item.id] || 10
    if ((bodyStatus[partKey] ?? 0) <= 0) {
      setFeedback(`${BODY_PARTS.find((b) => b.key === partKey)?.label} không bị thương; không cần dùng ${item.name}.`)
      return
    }
    const next = { ...bodyStatus, [partKey]: Math.max(0, (bodyStatus[partKey] ?? 0) - amount) }
    setBodyStatus(next)
    consume(item.id)
    const label = BODY_PARTS.find((b) => b.key === partKey)?.label
    setFeedback(`Đã dùng ${item.name} cho ${label} → thương tích còn ${next[partKey]}/100.`)
  }

  function feedPlayer(item) {
    const gain = Math.max(0, Number(item.hungerPlayer) || 0)
    if (!gain) return
    if ((hunger?.player ?? 100) >= 100) {
      setFeedback('Nhân vật đang no; chưa cần dùng món này.')
      return
    }
    const nextValue = Math.min(100, (hunger?.player ?? 0) + gain)
    setHunger((cur) => ({ ...cur, player: nextValue }))
    consume(item.id)
    setFeedback(`Đã dùng ${item.name}: độ no người ${hunger?.player ?? 0} → ${nextValue}.`)
  }

  function feedPokemon(item, monIndex) {
    const mon = party[monIndex]
    const gain = Math.max(0, Number(item.hungerMon) || 0)
    if (!mon || !gain) return
    if ((hunger?.mon ?? 100) >= 100 && !(Number(item.friendship) > 0)) {
      setFeedback('Pokémon đang no; chưa cần dùng món này.')
      return
    }
    const friendshipGain = Math.max(0, Number(item.friendship) || 0)
    const updated = friendshipGain ? { ...mon, friendship: Math.min(255, (Number(mon.friendship) || 70) + friendshipGain) } : mon
    if (updated !== mon) {
      setParty(party.map((entry, index) => index === monIndex ? updated : entry))
      if (playerMon && isSameMon(playerMon, mon)) setPlayerMon(updated)
    }
    const nextValue = Math.min(100, (hunger?.mon ?? 0) + gain)
    setHunger((cur) => ({ ...cur, mon: nextValue }))
    consume(item.id)
    setFeedback(`Đã cho ${mon.name} dùng ${item.name}: độ no Pokémon ${hunger?.mon ?? 0} → ${nextValue}${friendshipGain ? `, thân mật +${friendshipGain}` : ''}.`)
  }

  if ((inventory ?? []).length === 0 && !party.some((mon) => mon?.heldItem)) {
    return <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Trống — mua hoặc nhận đồ trong truyện.</div>
  }

  return (
    <div>
      {party.some((mon) => mon.heldItem) && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 7, marginBottom: 8 }}>
          <div style={{ fontSize: 10.5, color: 'var(--amber)', marginBottom: 5 }}>TRANG BỊ ĐANG MANG</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {party.map((mon, i) => mon.heldItem && (
              <div key={mon.uid ?? i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', fontSize: 10.5 }}>
                <span title={heldItemDescription(mon.heldItem)}>{mon.name} — {heldItemLabel(mon)}</span>
                <button className="btn" style={{ fontSize: 9.5, padding: '2px 7px' }} onClick={() => unequipHeldItem(i)}>Tháo</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Tabs phân mục — hiện đủ mọi mục, mục trống mờ đi */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {Object.entries(SHOP_CATEGORY_LABELS).map(([cat, label]) => {
          const hasInfinite = grouped[cat]?.some((it) => it.infinite) ?? false
          const count = grouped[cat]?.reduce((n, it) => n + (it.qty ?? 0), 0) ?? 0
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
              {label} {hasInfinite ? '(∞)' : count > 0 ? `(${count})` : ''}
            </button>
          )
        })}
      </div>

      {(grouped[openCat] ?? []).length === 0 ? (
        <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Mục này trống.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {grouped[openCat].map((it) => {
            const info = catalog[it.id] ?? resolveHeldItemByName(it) ?? it
            const isOpen = openItem === it.id
            const canHealMon = it.id in HEAL_AMOUNTS || it.id === 'fullrestore' || it.id === 'revive'
            const canCureMon = Boolean(STATUS_CURES[it.id])
            const canHealHuman = it.id in HUMAN_HEAL || Number(info?.humanHeal) > 0
            const canFeedPlayer = Number(info?.hungerPlayer) > 0
            const canFeedMon = Number(info?.hungerMon) > 0
            const canEquip = isHoldableItem(info)
            const trainerGear = isTrainerGear(info)
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
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-mid)' }}>{it.infinite ? 'x∞' : `x${it.qty}`}</span>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 8px 8px', fontSize: 10.5 }}>
                    <div style={{ color: 'var(--text-dim)', marginBottom: 6 }}>{info?.desc}</div>
                    {it.id === 'rarecandy' && (
                      <div>
                        <div style={{ marginBottom: 4 }}>Cho Pokémon ăn (+1 cấp):</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {party.map((mon, i) => (
                            <button key={i} className="btn" style={{ fontSize: 10, padding: '2px 8px', borderColor: 'var(--amber)', color: 'var(--amber)' }} onClick={() => feedRareCandy(info, i)}>
                              {mon.name} (Lv.{mon.level})
                            </button>
                          ))}
                          {party.length === 0 && <span style={{ color: 'var(--text-dim)' }}>Đội hình trống.</span>}
                        </div>
                      </div>
                    )}
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
                    {canCureMon && (
                      <div>
                        <div style={{ marginBottom: 4 }}>Chữa trạng thái cho:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {party.map((mon, i) => (
                            <button key={mon.uid ?? i} className="btn" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => curePartyMon(info, i)}>
                              {mon.name} {mon.status ? `[${mon.status.toUpperCase()}]` : '· bình thường'}
                            </button>
                          ))}
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
                    {canFeedPlayer && (
                      <button className="btn" style={{ fontSize: 10, padding: '3px 9px' }} onClick={() => feedPlayer(info)}>
                        Ăn / uống · độ no người {hunger?.player ?? 0}/100
                      </button>
                    )}
                    {canFeedMon && (
                      <div>
                        <div style={{ marginBottom: 4 }}>Cho Pokémon dùng:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {party.map((mon, index) => <button key={mon.uid ?? index} className="btn" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => feedPokemon(info, index)}>{mon.name}</button>)}
                        </div>
                      </div>
                    )}
                    {canEquip && (
                      <div>
                        <div style={{ marginBottom: 4, color: 'var(--amber)' }}>Cho Pokémon cầm:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {party.map((mon, i) => (
                            <button key={mon.uid ?? i} className="btn" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => equipHeldItem(it, i)}>
                              {mon.name} · đang cầm: {heldItemLabel(mon)}
                            </button>
                          ))}
                          {party.length === 0 && <span style={{ color: 'var(--text-dim)' }}>Đội hình trống.</span>}
                        </div>
                      </div>
                    )}
                    {trainerGear && (
                      <div style={{ color: 'var(--text-dim)' }}>Thiết bị này nằm trong túi của huấn luyện viên và tự được kiểm tra khi dùng Mega/Z/Dynamax/Tera; không cho Pokémon cầm.</div>
                    )}
                    {!canHealMon && !canCureMon && !canHealHuman && !canFeedPlayer && !canFeedMon && !canEquip && !trainerGear && it.id !== 'rarecandy' && (
                      <div style={{ color: 'var(--text-dim)' }}>Vật phẩm này chưa có thao tác trực tiếp trong giao diện.</div>
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
