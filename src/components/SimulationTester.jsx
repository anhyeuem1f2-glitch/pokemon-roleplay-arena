import React, { useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { chatCompletion } from '../services/aiClient.js'
import { buildMainApiMessages } from '../utils/buildMainMessages.js'
import { cleanAiOutput } from '../utils/outputCleanup.js'
import { parseStoryStateTags } from '../utils/storyStateProtocol.js'
import { buildMonSmart } from '../data/pokemonSpecies.js'
import { REGIONS, getRegion, getArea, detectMentionedArea, detectLocationFromMetadata } from '../data/regions.js'
import { IDENTITIES_V2, getIdentityV2 } from '../data/identities.js'
import { clearMemory } from '../utils/storyMemory.js'
import { clearNotebook } from '../utils/storyNotebook.js'
import { clearSummary } from '../utils/storySummary.js'
import { resetDirectorState } from '../data/storyDirector.js'
import PokeballSpinner from './PokeballSpinner.jsx'

// ============ GIẢ LẬP CHƠI (đợt 44) ============
// Bỏ qua bước tạo nhân vật dài dòng: nhập 1 prompt tình huống → AI gen ra
// chương truyện đầu qua ĐÚNG pipeline chính (worldbook, wiki, đạo diễn, tag
// trạng thái...) → set state tối thiểu → nhảy thẳng vào màn chơi thật để
// test liên tục (cập nhật biến, battle, shop, tóm tắt, ký ức). Có nút
// "trang bị nhanh" để test gimmick/đồ mà không phải đi kiếm.

// Đợt 46: qty khai theo TỪNG món cho khớp tên hiển thị (trước đây đồng
// loạt 5 — "Poké Ball x10" mà trong túi chỉ có 5).
const QUICK_ITEMS = [
  { id: 'key-stone', name: 'Key Stone (test Mega)', qty: 1 },
  { id: 'mega-stone-generic', name: 'Mega Stone (test Mega)', qty: 1 },
  { id: 'z-ring', name: 'Z-Ring (test Z-Move)', qty: 1 },
  { id: 'z-crystal-generic', name: 'Z-Crystal (test Z-Move)', qty: 1 },
  { id: 'dynamax-band', name: 'Dynamax Band (test Dynamax)', qty: 1 },
  { id: 'tera-orb', name: 'Tera Orb (test Terastal)', qty: 1 },
  { id: 'potion', name: 'Potion x5', qty: 5 },
  { id: 'pokeball', name: 'Poké Ball x10', qty: 10 },
]

export default function SimulationTester({ onEnterGame }) {
  const {
    apiConfig, character, stylePreset, mainPreset, assistantPrefill, worldbook,
    setPlayerName, setPlayerMon, setParty, setMessages, setGameStarted,
    setPlayerLocation, setPlayerIdentity, setPlayerCharacter, setStoryDate,
    setInventory, setPlayerProfile, pokedexSpecies, movesDb,
    setRelationships, setBodyStatus, setHunger,
  } = useGame()

  const [scenario, setScenario] = useState('')
  const [name, setName] = useState('Test')
  const [identityKey, setIdentityKey] = useState('wanderer')
  const [regionKey, setRegionKey] = useState('kanto')
  const [areaKey, setAreaKey] = useState('pallet')
  const [starterName, setStarterName] = useState('')
  const [giveItems, setGiveItems] = useState(true)
  const [money, setMoney] = useState(50000)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const region = getRegion(regionKey)
  const starterEntry = starterName.trim()
    ? pokedexSpecies.find((e) => e.name.toLowerCase() === starterName.trim().toLowerCase())
    : null

  async function runSimulation() {
    if (loading) return
    setError(null)
    if (!apiConfig.baseUrl || !apiConfig.model) {
      setError('Chưa cấu hình API — vào Cài đặt API trước.')
      return
    }
    if (!scenario.trim()) {
      setError('Nhập tình huống/prompt để AI dựng chương truyện.')
      return
    }
    if (starterName.trim() && !starterEntry) {
      setError(`Không tìm thấy loài "${starterName.trim()}" — để trống nếu không cần Pokémon sẵn.`)
      return
    }

    setLoading(true)
    try {
      const identity = getIdentityV2(identityKey)
      const area = getArea(regionKey, areaKey)

      // Set state tối thiểu để màn chơi hoạt động.
      setPlayerName(name.trim() || 'Test')
      setPlayerIdentity(identityKey)
      setPlayerCharacter({ gender: '', age: '', appearance: '', originRegionKey: regionKey, originAreaKey: areaKey, customIdentity: null })
      setStoryDate({ day: 1, month: 4, year: 2000, part: 'sáng' })
      setPlayerLocation({ regionKey, areaKey })
      setPlayerProfile((p) => ({ ...p, money: Number(money) || 0 }))

      // Trang bị nhanh để test gimmick/đồ.
      if (giveItems) {
        setInventory(QUICK_ITEMS.map((it) => ({ id: it.id, name: it.name, qty: it.qty })))
      } else {
        setInventory([])
      }

      // Pokémon sẵn (tuỳ chọn) để test battle ngay.
      if (starterEntry) {
        const mon = buildMonSmart(starterEntry, 12, movesDb)
        setPlayerMon(mon)
        setParty([mon])
      } else {
        setPlayerMon(null)
        setParty([])
      }

      // Xoá ký ức + state run cũ (đợt 46: quan hệ/thương tích/độ no cũng
      // persist nên phải reset, không thì dính sang phiên giả lập mới).
      clearMemory(); clearNotebook(); clearSummary(); resetDirectorState()
      setRelationships([])
      setBodyStatus({ head: 0, torso: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 })
      setHunger({ player: 100, mon: 100 })

      // Directive: dùng ĐÚNG pipeline chính, nhưng seed bằng prompt của user.
      const directive = [
        `[Chỉ dẫn hệ thống — GIẢ LẬP TEST] Hãy viết một CHƯƠNG TRUYỆN mở đầu dựa trên tình huống người dùng đưa ra dưới đây. Tông realistic, văn xuôi đầy đủ nhiều đoạn.`,
        `Nhân vật chính: ${name.trim() || 'Test'} — thân phận ${identity.name}. Đang ở ${area?.name ?? region?.name}, vùng ${region?.name}, ngày 1/4/2000 buổi sáng.`,
        starterEntry ? `Người chơi đã có: ${starterEntry.name} (Lv12).` : `Người chơi chưa có Pokémon.`,
        `TÌNH HUỐNG NGƯỜI DÙNG (bám sát, đây là hạt nhân chương truyện):\n"${scenario.trim()}"`,
        `Bắt đầu thẳng vào truyện, không hỏi lại.`,
      ].join('\n')

      const { apiMessages, callOptions, regexScripts } = buildMainApiMessages({
        character, playerName: name.trim() || 'Test', stylePreset, mainPreset,
        history: [{ role: 'user', content: directive }],
        scanText: `${directive}\n${area?.name ?? ''} ${region?.name ?? ''}`,
        identityContext: `THÂN PHẬN NHÂN VẬT CHÍNH: ${identity.name} — ${identity.desc}`,
        worldbook,
      })
      callOptions.assistantPrefill = assistantPrefill

      const reply = await chatCompletion(apiConfig, apiMessages, callOptions)
      const cleaned = cleanAiOutput(reply, regexScripts)
      if (!cleaned) throw new Error('AI chỉ trả CoT, chưa ra chính văn — thử lại hoặc tăng max tokens.')

      const parsed = parseStoryStateTags(cleaned)
      setMessages([
        { role: 'user', hidden: true, resultLabel: 'Giả lập: ' + scenario.trim().slice(0, 40), content: directive },
        { role: 'assistant', content: parsed.cleaned },
      ])

      // Áp tag Pokémon/địa danh nếu AI khai ngay.
      for (const pk of parsed.pokemons ?? []) {
        const entry = pokedexSpecies.find((e) => e.name.toLowerCase() === pk.species.toLowerCase())
        if (entry) {
          const mon = buildMonSmart(entry, pk.level, movesDb)
          setPlayerMon((cur) => cur ?? mon)
          setParty((cur) => (cur.length < 6 ? [...cur, mon] : cur))
        }
      }
      // Vị trí (đợt 47): NGƯỜI DÙNG đã chọn tường minh vùng+khu ở form nên
      // đoạn mở đầu KHÔNG dùng quét-địa-danh mờ (detectMentionedArea) nữa —
      // truyện nhắc thoáng qua "Mt. Moon" là bị dịch chuyển sai khỏi khu đã
      // chọn. Chỉ tag [[MOVE]] tường minh hoặc dòng [Metadata|..] mới đè.
      let movedTo = null
      if ((parsed.moves ?? []).length) {
        movedTo = detectMentionedArea(parsed.moves[parsed.moves.length - 1], { regionKey, areaKey })
      }
      if (!movedTo) movedTo = detectLocationFromMetadata(reply, { regionKey, areaKey })
      if (movedTo) setPlayerLocation(movedTo)

      // NHẢY VÀO MÀN CHƠI THẬT — từ đây chơi tiếp y hệt bình thường.
      setGameStarted(true)
      // Đóng màn Dev (đợt 45): App ưu tiên showDev trước gameStarted, nên
      // nếu không đóng Dev thì vẫn kẹt ở màn giả lập dù truyện đã tạo xong.
      onEnterGame?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 40 }}>
        <PokeballSpinner size={64} />
        <div style={{ color: 'var(--text-mid)' }}>AI đang dựng chương truyện từ tình huống của bạn…</div>
      </div>
    )
  }

  return (
    <div className="panel">
      <h2 className="page-title">Giả lập chơi</h2>
      <p className="page-subtitle">
        Nhập một tình huống → AI gen chương truyện qua ĐÚNG pipeline chính (worldbook, đạo diễn, tag
        biến, battle, shop, tóm tắt…) → nhảy thẳng vào màn chơi thật để test liên tục. Bỏ qua bước
        tạo nhân vật cho nhanh.
      </p>

      <div className="field">
        <label>Tình huống / prompt khởi tạo</label>
        <textarea
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          placeholder="VD: Nhân vật vừa bước vào một cửa hàng bách hoá ở Cerulean để mua đồ đi đường, chủ quán là một bà lão vui tính. Hoặc: một trận đấu bất ngờ với tên trộm Pokémon trong hẻm tối..."
          style={{ minHeight: 90 }}
        />
        <small style={{ color: 'var(--text-dim)' }}>
          Muốn test shop thì tả cảnh vào cửa hàng; test battle thì tả gặp Pokémon/đối thủ; test biến thì
          tả mua bán/ăn uống/di chuyển… AI sẽ tự khai tag tương ứng.
        </small>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="field">
          <label>Tên</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Thân phận</label>
          <select value={identityKey} onChange={(e) => setIdentityKey(e.target.value)}>
            {IDENTITIES_V2.map((i) => <option key={i.key} value={i.key}>{i.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Vùng</label>
          <select value={regionKey} onChange={(e) => { setRegionKey(e.target.value); setAreaKey(getRegion(e.target.value).areas[0].key) }}>
            {REGIONS.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Khu</label>
          <select value={areaKey} onChange={(e) => setAreaKey(e.target.value)}>
            {region.areas.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Pokémon sẵn (tuỳ chọn, để test battle ngay)</label>
          <input value={starterName} onChange={(e) => setStarterName(e.target.value)} placeholder="VD Blastoise — để trống = tay trắng" />
          <small style={{ color: starterName.trim() && !starterEntry ? '#d94f4f' : 'var(--text-dim)' }}>
            {starterName.trim() ? (starterEntry ? `✓ ${starterEntry.name} Lv12` : 'không khớp loài') : 'để trống nếu không cần'}
          </small>
        </div>
        <div className="field">
          <label>Tiền khởi tạo</label>
          <input type="number" value={money} onChange={(e) => setMoney(e.target.value)} />
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, marginTop: 4 }}>
        <input type="checkbox" checked={giveItems} onChange={(e) => setGiveItems(e.target.checked)} />
        Trang bị nhanh (Key Stone, Z-Ring, Dynamax Band, Tera Orb, Potion, Poké Ball) để test gimmick/đồ
      </label>

      {error && <div className="status-pill status-pill--error" style={{ marginTop: 10 }}>{error}</div>}

      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn btn--primary" onClick={runSimulation}>
          ▶ Giả lập & vào chơi
        </button>
      </div>
    </div>
  )
}
