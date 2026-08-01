import React, { useMemo, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { SHOP_ITEMS } from '../data/shopItems.js'
import { buildWildMon, normalizeAcquiredMon } from '../data/pokemonSpecies.js'
import { ensurePokemonIdentity } from '../data/persistentIdentity.js'
import { ADMIN_SHORTCUT_LABEL } from '../data/adminMode.js'
import TradeModal from './TradeModal.jsx'

function Field({ label, children }) {
  return <label style={{ display: 'grid', gap: 5, color: 'var(--text-mid)', fontSize: 11 }}><span>{label}</span>{children}</label>
}

function ToolBox({ title, children }) {
  return <section style={{ border: '1px solid var(--line)', borderRadius: 11, padding: 12, display: 'grid', gap: 9 }}><b style={{ color: 'var(--text-hi)' }}>{title}</b>{children}</section>
}

export default function AdminModal({ onClose, onOpenDev }) {
  const game = useGame()
  const {
    adminMode, unlockAdmin, lockAdmin, playerProfile, setPlayerProfile,
    inventory, setInventory, pokedexSpecies, movesDb, trainerId,
    party, setParty, setPcBox, playerMon, setPlayerMon, healAll,
    worldProgress, setWorldProgress,
  } = game
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [moneyValue, setMoneyValue] = useState('1000000')
  const [itemId, setItemId] = useState('rarecandy')
  const [itemQty, setItemQty] = useState('10')
  const [speciesName, setSpeciesName] = useState('Rayquaza')
  const [level, setLevel] = useState('70')
  const [shiny, setShiny] = useState(false)
  const [tradeOpen, setTradeOpen] = useState(false)

  const itemOptions = useMemo(() => {
    const seen = new Set()
    return SHOP_ITEMS.filter((item) => item?.id && !seen.has(item.id) && seen.add(item.id))
  }, [])

  function submitCode(event) {
    event.preventDefault()
    if (unlockAdmin(code)) {
      setCode('')
      setNotice('Admin Mode đã mở cho phiên này.')
    } else setNotice('Mã không đúng.')
  }

  function changeMoney(mode) {
    const amount = Math.max(0, Math.floor(Number(moneyValue) || 0))
    setPlayerProfile((cur) => ({ ...cur, money: mode === 'set' ? amount : Math.max(0, Number(cur.money) + amount) }))
    setNotice(mode === 'set' ? `Đã đặt tiền = ₽${amount.toLocaleString('vi-VN')}.` : `Đã cộng ₽${amount.toLocaleString('vi-VN')}.`)
  }

  function giveItem() {
    const item = itemOptions.find((entry) => entry.id === itemId)
    const qty = Math.max(1, Math.min(9999, Math.floor(Number(itemQty) || 1)))
    if (!item) return
    setInventory((cur) => {
      const next = [...cur]
      const at = next.findIndex((entry) => entry.id === item.id)
      if (at >= 0) next[at] = { ...next[at], qty: Number(next[at].qty || 0) + qty }
      else next.push({ id: item.id, name: item.name, qty })
      return next
    })
    setNotice(`Đã cấp ${item.name} x${qty}.`)
  }

  function spawnPokemon(destination = 'party') {
    const query = speciesName.trim().toLowerCase()
    const entry = pokedexSpecies.find((candidate) =>
      candidate.name?.toLowerCase() === query || candidate.species?.toLowerCase() === query,
    )
    if (!entry) { setNotice(`Không tìm thấy loài “${speciesName}” trong Pokédex đã tải.`); return }
    const lv = Math.max(1, Math.min(200, Math.floor(Number(level) || 1)))
    // Admin là công cụ kiểm thử: tạo đúng level đã nhập, không áp trần boss hay sinh thái.
    const mon = ensurePokemonIdentity({ ...normalizeAcquiredMon(buildWildMon(entry, lv, movesDb)), shiny }, trainerId)
    if (destination === 'pc' || party.length >= 6) {
      setPcBox((cur) => [...cur, mon])
      setNotice(`Đã tạo ${mon.name} Lv.${mon.level}${shiny ? ' Shiny' : ''} trong PC.`)
      return
    }
    setParty((cur) => [...cur, mon])
    if (!playerMon) setPlayerMon(mon)
    setNotice(`Đã tạo ${mon.name} Lv.${mon.level}${shiny ? ' Shiny' : ''} trong đội.`)
  }

  function unlockProgress() {
    setWorldProgress((cur) => ({
      ...cur,
      badges: Array.from({ length: 8 }, (_, index) => cur.badges[index] ?? {
        id: `admin-badge-${index + 1}`, name: `Huy hiệu Admin ${index + 1}`, region: 'test', gym: 'Admin Lab', leader: 'Admin', earnedTurn: -1,
      }),
      legendaryPermits: [...new Set([...(cur.legendaryPermits ?? []), 'low', 'mid', 'high'])],
    }))
    setNotice('Đã mở 8 huy hiệu thử nghiệm và cổng huyền thoại mọi bậc.')
  }

  function clearWanted() {
    setWorldProgress((cur) => ({ ...cur, wanted: { ...cur.wanted, level: 0, bounty: 0, regions: [], history: [...(cur.wanted?.history ?? []), { delta: -99, reason: 'Admin reset', turn: -1 }] } }))
    setNotice('Đã xoá truy nã để test.')
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 160, padding: 16, display: 'grid', placeItems: 'center', background: 'rgba(1,4,8,.90)', backdropFilter: 'blur(10px)' }}>
      <div onClick={(event) => event.stopPropagation()} className="panel" style={{ width: 'min(900px, 98vw)', maxHeight: '94vh', overflowY: 'auto', borderRadius: 16, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div><div style={{ color: 'var(--amber)', fontSize: 9, letterSpacing: '.18em', fontWeight: 900 }}>HIDDEN TEST PROTOCOL</div><h2 className="page-title" style={{ margin: 0 }}>Admin Mode</h2></div>
          <button className="btn" onClick={onClose}>✕ Đóng</button>
        </div>

        {!adminMode ? (
          <form onSubmit={submitCode} style={{ marginTop: 18, display: 'grid', gap: 10 }}>
            <p style={{ color: 'var(--text-mid)', margin: 0 }}>Nhập mã quản trị. Giao diện này không xuất hiện trong menu thường.</p>
            <input autoFocus type="password" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Mã quản trị" style={{ maxWidth: 320 }} />
            <button className="btn btn--primary" type="submit" style={{ width: 'fit-content' }}>Xác thực</button>
            {notice && <div style={{ color: 'var(--amber)' }}>{notice}</div>}
          </form>
        ) : (
          <>
            <div style={{ marginTop: 12, padding: 10, border: '1px solid rgba(232,184,74,.5)', borderRadius: 9, color: 'var(--amber)', fontSize: 11 }}>
              Quyền admin đang bật cho mọi chế độ. Luật Thực tế, cổng huyền thoại và giới hạn trao đổi chỉ được bỏ qua bởi các nút trong bảng này; input thường vẫn chịu luật của chế độ.
            </div>
            {notice && <div style={{ marginTop: 10, color: 'var(--mint)' }}>{notice}</div>}
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 10 }}>
              <ToolBox title={`Tiền · hiện ₽${Number(playerProfile.money).toLocaleString('vi-VN')}`}>
                <Field label="Số tiền"><input type="number" min="0" value={moneyValue} onChange={(event) => setMoneyValue(event.target.value)} /></Field>
                <div className="btn-row"><button className="btn" onClick={() => changeMoney('add')}>+ Cộng</button><button className="btn" onClick={() => changeMoney('set')}>Đặt đúng số</button></div>
              </ToolBox>

              <ToolBox title="Vật phẩm">
                <Field label="Món"><select value={itemId} onChange={(event) => setItemId(event.target.value)}>{itemOptions.map((item) => <option key={item.id} value={item.id}>{item.name}{item.noShop ? ' · không bán' : ''}</option>)}</select></Field>
                <Field label="Số lượng"><input type="number" min="1" max="9999" value={itemQty} onChange={(event) => setItemQty(event.target.value)} /></Field>
                <button className="btn" onClick={giveItem}>Cấp vào túi</button>
              </ToolBox>

              <ToolBox title="Tạo Pokémon">
                <Field label="Tên loài chính xác"><input value={speciesName} onChange={(event) => setSpeciesName(event.target.value)} placeholder="Rayquaza" /></Field>
                <Field label="Level"><input type="number" min="1" max="200" value={level} onChange={(event) => setLevel(event.target.value)} /></Field>
                <label style={{ color: 'var(--text-mid)', fontSize: 11 }}><input type="checkbox" checked={shiny} onChange={(event) => setShiny(event.target.checked)} /> Shiny</label>
                <div className="btn-row"><button className="btn" onClick={() => spawnPokemon('party')}>Tạo vào đội</button><button className="btn" onClick={() => spawnPokemon('pc')}>Tạo vào PC</button></div>
              </ToolBox>

              <ToolBox title="Tiến trình & kiểm thử">
                <button className="btn" onClick={healAll}>Hồi đầy toàn đội</button>
                <button className="btn" onClick={unlockProgress}>Mở huy hiệu + cổng huyền thoại</button>
                <button className="btn" onClick={clearWanted}>Xoá truy nã</button>
                <button className="btn" onClick={() => setTradeOpen(true)}>Mở test trao đổi ở chế độ hiện tại</button>
                <button className="btn" onClick={() => { onClose(); onOpenDev?.() }}>Mở phòng Dev đầy đủ</button>
              </ToolBox>
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, color: 'var(--text-dim)', fontSize: 10 }}>
              <span>Mở lại bảng: {ADMIN_SHORTCUT_LABEL}</span>
              <button className="btn" onClick={() => { lockAdmin(); setNotice('Đã khoá Admin Mode.'); }}>Khoá quyền admin</button>
            </div>
          </>
        )}
        {tradeOpen && <TradeModal onClose={() => setTradeOpen(false)} />}
      </div>
    </div>
  )
}
