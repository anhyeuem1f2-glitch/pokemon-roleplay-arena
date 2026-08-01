import React, { useMemo, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { awardContest, campWithPokemon, careForEgg, CONTEST_CATEGORIES, contestScore, createEgg, rollPokemonLifeTraits } from '../data/pokemonLife.js'
import { buildMonSmart, normalizeAcquiredMon, recomputeMonStats } from '../data/pokemonSpecies.js'
import { genderLabel, genderSymbol } from '../data/pokemonGender.js'

const sameMon = (a, b) => Boolean(a && b && (a.uid === b.uid || a.pokemonId === b.pokemonId))

export default function PokemonLifeModal({ onClose }) {
  const { party, setParty, pcBox, setPcBox, playerMon, setPlayerMon, pokemonLife, setPokemonLife, trainerId, storyDate, pokedexSpecies, movesDb, adjustHunger } = useGame()
  const owned = useMemo(() => [...party, ...pcBox, playerMon].filter(Boolean).filter((mon, index, all) => all.findIndex((x) => sameMon(x, mon)) === index), [party, pcBox, playerMon])
  const [tab, setTab] = useState('camp')
  const [firstId, setFirstId] = useState(owned[0]?.uid ?? '')
  const [secondId, setSecondId] = useState(owned[1]?.uid ?? '')
  const [selectedId, setSelectedId] = useState(owned[0]?.uid ?? '')
  const [category, setCategory] = useState('cool')
  const [notice, setNotice] = useState('')

  function updateOwned(target, transform) {
    setParty((cur) => cur.map((mon) => sameMon(mon, target) ? transform(mon) : mon))
    setPcBox((cur) => cur.map((mon) => sameMon(mon, target) ? transform(mon) : mon))
    setPlayerMon((cur) => sameMon(cur, target) ? transform(cur) : cur)
  }

  function camp() {
    const mon = owned.find((item) => item.uid === selectedId)
    if (!mon) return setNotice('Hãy chọn một Pokémon.')
    const campedToday = pokemonLife.campLog.some((entry) => entry.pokemonId === mon.pokemonId
      && entry.date?.day === storyDate.day && entry.date?.month === storyDate.month && entry.date?.year === storyDate.year)
    if (campedToday) return setNotice(`${mon.name} đã nhận lợi ích cắm trại trong ngày này; hãy để thời gian trong truyện trôi tiếp.`)
    updateOwned(mon, (current) => campWithPokemon(current, storyDate))
    adjustHunger({ player: 12, mon: 18 })
    setPokemonLife((cur) => ({ ...cur, campLog: [...cur.campLog, { pokemonId: mon.pokemonId, date: storyDate }].slice(-40) }))
    setNotice(`${mon.name} được +3 thân mật; cả nhóm đã ăn và nghỉ.`)
  }

  function breed() {
    try {
      const first = owned.find((item) => item.uid === firstId)
      const second = owned.find((item) => item.uid === secondId)
      const pair = [first?.uid, second?.uid].sort().join('|')
      const pendingPair = pokemonLife.eggs.some((item) => [...(item.parentIds ?? [])].sort().join('|') === pair)
      if (pendingPair) throw new Error('Cặp này đã có một trứng đang ấp; hãy chăm sóc/nở trứng đó trước.')
      const egg = createEgg(first, second, trainerId, storyDate)
      setPokemonLife((cur) => ({ ...cur, eggs: [...cur.eggs, egg] }))
      setNotice(`Đã nhận trứng ${egg.eggCode}. Chăm sóc ${egg.neededCare} lần để sẵn sàng nở.`)
    } catch (error) { setNotice(error.message) }
  }

  function care(egg) {
    try {
      // Tính trước updater để lỗi "đã chăm hôm nay" được bắt tại đây thay vì
      // bị ném muộn từ callback setState của React.
      const caredEgg = careForEgg(egg, storyDate)
      setPokemonLife((cur) => ({ ...cur, eggs: cur.eggs.map((item) => item.id === egg.id ? caredEgg : item) }))
      setNotice('Đã chăm sóc trứng. Tiến độ ấp tăng 1.')
    } catch (error) { setNotice(error.message) }
  }

  function hatch(egg) {
    const entry = pokedexSpecies.find((item) => String(item.species).toLowerCase() === String(egg.species).toLowerCase() || item.name.toLowerCase() === String(egg.speciesName).toLowerCase())
    if (!entry) return setNotice('Chưa tìm thấy dữ liệu loài để nở trứng.')
    let mon = rollPokemonLifeTraits(normalizeAcquiredMon(buildMonSmart(entry, 1, movesDb)), trainerId, entry)
    mon = recomputeMonStats({
      ...mon,
      nature: egg.inheritedNature ?? mon.nature,
      ivs: { ...mon.ivs, ...(egg.inheritedIvs ?? {}) },
    })
    if (party.length < 6) {
      setParty((cur) => [...cur, mon])
      setPlayerMon((cur) => cur ?? mon)
    } else setPcBox((cur) => [...cur, mon])
    setPokemonLife((cur) => ({ ...cur, eggs: cur.eggs.filter((item) => item.id !== egg.id) }))
    setNotice(`${mon.name} đã nở · mã ${mon.pokemonId}${party.length >= 6 ? ' · gửi vào PC' : ''}.`)
  }

  function contest() {
    const mon = owned.find((item) => item.uid === selectedId)
    if (!mon) return setNotice('Hãy chọn một Pokémon.')
    const alreadyEntered = pokemonLife.contestRecords.some((record) => record.pokemonId === mon.pokemonId
      && record.category === category && record.date?.day === storyDate.day
      && record.date?.month === storyDate.month && record.date?.year === storyDate.year)
    if (alreadyEntered) return setNotice(`${mon.name} đã thi hạng mục này trong ngày hôm nay.`)
    const score = contestScore(mon, category)
    const rank = score >= 100 ? 'Master' : score >= 80 ? 'Hyper' : score >= 60 ? 'Great' : 'Normal'
    if (score >= 60) updateOwned(mon, (current) => awardContest(current, category, rank))
    setPokemonLife((cur) => ({ ...cur, contestRecords: [...cur.contestRecords, { id: `${Date.now()}`, pokemonId: mon.pokemonId, category, score, rank, date: storyDate }].slice(-100) }))
    setNotice(`${mon.name} đạt ${score} điểm · hạng ${rank}${score >= 60 ? ' · nhận Ribbon' : ''}.`)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 97, padding: 16, display: 'grid', placeItems: 'center', background: 'rgba(2,7,11,.82)', backdropFilter: 'blur(8px)' }}>
      <div onClick={(event) => event.stopPropagation()} className="panel" style={{ width: 'min(820px,97vw)', maxHeight: '92vh', overflow: 'hidden', padding: 0, borderRadius: 16 }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}><div><div style={{ color: 'var(--mint)', fontSize: 10, fontWeight: 800 }}>ĐỜI SỐNG POKÉMON</div><div className="page-title" style={{ margin: 0 }}>Picnic · Trứng · Contest</div></div><button className="btn" onClick={onClose}>✕ Đóng</button></div>
        <div style={{ padding: 10, display: 'flex', gap: 6, borderBottom: '1px solid var(--line)' }}>{[['camp', 'Cắm trại'], ['eggs', 'Trứng'], ['contest', 'Contest'], ['collection', 'Shiny/Ribbon/Mark']].map(([key, label]) => <button className="btn" key={key} onClick={() => setTab(key)} style={{ color: tab === key ? 'var(--mint)' : undefined }}>{label}</button>)}</div>
        <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(92vh - 150px)', color: 'var(--text-mid)', fontSize: 12 }}>
          {notice && <div style={{ marginBottom: 12, padding: 10, border: '1px solid var(--mint)', borderRadius: 9, color: 'var(--mint)' }}>{notice}</div>}
          {tab === 'camp' && <Section title="Picnic / cắm trại"><MonSelect owned={owned} value={selectedId} onChange={setSelectedId} /><button className="btn" onClick={camp} style={{ marginTop: 10 }}>⛺ Ăn và nghỉ cùng nhau</button><p>Hồi độ no cho cả nhóm và +3 thân mật. Không tự hồi HP để giữ luật Trung tâm Pokémon/vật phẩm.</p></Section>}
          {tab === 'eggs' && <><Section title="Nhân giống"><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><MonSelect owned={owned} value={firstId} onChange={setFirstId} /><MonSelect owned={owned} value={secondId} onChange={setSecondId} /></div><button className="btn" onClick={breed} style={{ marginTop: 10 }}>🥚 Kiểm tra và nhận trứng</button><p>Dùng Egg Group, giới tính và Ditto đúng luật; loài Undiscovered không thể sinh sản. Trứng nở thành dạng cơ bản của dòng tiến hóa.</p></Section><div style={{ display: 'grid', gap: 8 }}>{pokemonLife.eggs.map((egg) => <Section key={egg.id} title={`${egg.eggCode} · ${egg.speciesName}`}><div>Ấp: {egg.care}/{egg.neededCare}</div>{egg.status === 'ready' ? <button className="btn" onClick={() => hatch(egg)}>Nở trứng</button> : <button className="btn" onClick={() => care(egg)}>Chăm sóc</button>}</Section>)}</div></>}
          {tab === 'contest' && <Section title="Pokémon Contest"><MonSelect owned={owned} value={selectedId} onChange={setSelectedId} /><select value={category} onChange={(event) => setCategory(event.target.value)} style={{ marginLeft: 8 }}>{CONTEST_CATEGORIES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select><button className="btn" onClick={contest} style={{ marginLeft: 8 }}>Biểu diễn</button><div style={{ marginTop: 12 }}>Thành tích gần đây: {pokemonLife.contestRecords.slice(-5).reverse().map((record) => <div key={record.id}>{record.category} · {record.score} · {record.rank}</div>)}</div></Section>}
          {tab === 'collection' && <div style={{ display: 'grid', gap: 8 }}>{owned.map((mon) => <Section key={mon.uid} title={`${mon.shiny ? '✨ ' : ''}${mon.name} · ${mon.pokemonId}`}><div>Giới tính: {genderSymbol(mon.gender)} {genderLabel(mon.gender)} · kích thước: {mon.sizeClass}</div><div>Ribbon: {(mon.ribbons ?? []).join(', ') || 'chưa có'}</div><div>Mark: {(mon.marks ?? []).join(', ') || 'chưa có'}</div></Section>)}</div>}
        </div>
      </div>
    </div>
  )
}

function MonSelect({ owned, value, onChange }) { return <select value={value} onChange={(event) => onChange(event.target.value)}><option value="">— Chọn Pokémon —</option>{owned.map((mon) => <option key={mon.uid} value={mon.uid}>{mon.shiny ? '✨ ' : ''}{mon.name} Lv{mon.level} · {mon.pokemonId}</option>)}</select> }
function Section({ title, children }) { return <section style={{ border: '1px solid var(--line)', borderRadius: 11, padding: 12, background: 'var(--bg-deep)', marginBottom: 10 }}><b style={{ color: 'var(--text-hi)', display: 'block', marginBottom: 8 }}>{title}</b>{children}</section> }
