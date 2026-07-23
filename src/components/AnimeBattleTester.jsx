import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { chatCompletion } from '../services/aiClient.js'
import { cleanAiOutput } from '../utils/outputCleanup.js'
import { buildMonSmart, getMovePool } from '../data/pokemonSpecies.js'
import { getLegendLore, GENERIC_LEGEND_PERSUASION } from '../data/legendLore.js'
import { getArea, getRegion } from '../data/regions.js'
import SidePicker from './SidePicker.jsx'
import MonAvatar from './MonAvatar.jsx'
import TypeBadge from './TypeBadge.jsx'
import HealthBar from './HealthBar.jsx'
import { musicManager } from '../utils/musicManager.js'
import { resolveBattleTrackKeys, VICTORY_TRACK_KEYS, DEFEAT_TRACK_KEYS } from '../data/musicTracks.js'

// ============ CHẾ ĐỘ COMBAT ANIME (đại tu đợt 26) ============
//
// Trận đấu THỜI GIAN THỰC kiểu anime, người chơi GÕ CHỮ điều khiển. Khác bản
// đầu (đứng yên 2 góc, 4 chiêu, 1 phát = 1 cục sát thương), bản này có:
//
// 1. HỆ TOẠ ĐỘ SÂN ĐẤU: sân là lưới (x,y) 0..100. Mỗi Pokémon có vị trí
//    thật; trọng tài BẮT BUỘC suy luận hình học (đứng lệch hàng thì phun
//    thẳng là hụt) và cập nhật vị trí qua tag [[MOVE ...]] — app trượt
//    sprite tới toạ độ mới (CSS transition), kèm cú DASH lao về phía đối
//    thủ khi tấn công.
// 2. BỂ CHIÊU ĐẦY ĐỦ: không giới hạn 4 chiêu — mọi chiêu trong learnset
//    (kể cả Status) đều dùng được. Ô nhập có AUTOCOMPLETE: gõ dở tên chiêu
//    là gợi ý từ bể chiêu; chiêu được nhắc trong lệnh hiện CHIP màu — XANH
//    nếu con mình học được, ĐỎ nếu không (app tự báo phán quyết cho trọng
//    tài: chiêu không có trong bể = pha đó thất bại/yếu hẳn).
// 3. SÁT THƯƠNG THEO COMBO: phun liên tục/liên hoàn/combo được cộng dồn
//    đúng mô tả (không còn "1 phát" cào bằng), đổi lại combo dài = hở sườn.
// 4. MÔI TRƯỜNG: sân khởi tạo theo VỊ TRÍ HIỆN TẠI trên bản đồ 9 vùng;
//    chiêu thức tàn phá/biến đổi môi trường qua tag [[ENV ...]] — hiện
//    caption trên sân + đổi tông màu nền theo môi trường (mưa/lửa/băng...).

const DMG_TAG_REGEX = /\[\[\s*DMG([^\]]*)\]\]/i
const END_TAG_REGEX = /\[\[\s*END\s+result\s*=\s*(calm|join|flee)\s*\]\]/i
const MOVE_TAG_REGEX = /\[\[\s*MOVE([^\]]*)\]\]/i
const ENV_TAG_REGEX = /^\s*\[\[\s*ENV\s+([^\]]+?)\s*\]\]\s*$/im

function parseDamageTag(rawText) {
  const m = rawText.match(DMG_TAG_REGEX)
  if (!m) return { toPlayer: null, toEnemy: null }
  const inner = m[1]
  const playerMatch = inner.match(/player\s*=\s*(\d+)/i)
  const enemyMatch = inner.match(/enemy\s*=\s*(\d+)/i)
  return {
    toPlayer: playerMatch ? parseInt(playerMatch[1], 10) : 0,
    toEnemy: enemyMatch ? parseInt(enemyMatch[1], 10) : 0,
  }
}

// [[MOVE player=30,60 enemy=70,20]] — mỗi vế tuỳ chọn, toạ độ kẹp trong sân.
function parseMoveTag(rawText) {
  const m = rawText.match(MOVE_TAG_REGEX)
  if (!m) return { player: null, enemy: null }
  const inner = m[1]
  const grab = (side) => {
    const mm = inner.match(new RegExp(`${side}\\s*=\\s*(\\d+)\\s*,\\s*(\\d+)`, 'i'))
    if (!mm) return null
    return {
      x: Math.max(5, Math.min(95, parseInt(mm[1], 10))),
      y: Math.max(8, Math.min(84, parseInt(mm[2], 10))),
    }
  }
  return { player: grab('player'), enemy: grab('enemy') }
}

function stripAllTags(rawText) {
  return rawText
    .replace(/\[\[\s*CATCH[^\]]*\]\]/gi, '')
    .replace(DMG_TAG_REGEX, '')
    .replace(END_TAG_REGEX, '')
    .replace(new RegExp(MOVE_TAG_REGEX.source, 'gi'), '')
    .replace(new RegExp(ENV_TAG_REGEX.source, 'gim'), '')
    .trim()
}

// Tông màu nền sân theo từ khoá môi trường — mưa xanh, lửa đỏ, băng lam...
function envTint(envText) {
  const t = (envText ?? '').toLowerCase()
  if (/(mưa|nước|biển|ngập|lụt|sóng)/.test(t)) return 'rgba(64,130,220,0.14)'
  if (/(lửa|magma|cháy|hạn|nham thạch|thiêu)/.test(t)) return 'rgba(220,90,50,0.14)'
  if (/(băng|tuyết|đóng băng|giá lạnh)/.test(t)) return 'rgba(120,200,240,0.14)'
  if (/(bão|gió|lốc|giông)/.test(t)) return 'rgba(160,170,190,0.12)'
  if (/(đảo ngược|distortion|hư không|phản vật chất)/.test(t)) return 'rgba(150,90,220,0.14)'
  if (/(sét|điện|giông tố)/.test(t)) return 'rgba(230,210,80,0.10)'
  return null
}

function monBrief(mon) {
  const poolNote = mon.movePool?.length
    ? `Bể chiêu đầy đủ ${mon.movePool.length} chiêu (KHÔNG giới hạn 4 — được dùng mọi chiêu trong bể): ${mon.movePool
        .slice(0, 40)
        .map((mv) => mv.name)
        .join(', ')}${mon.movePool.length > 40 ? ',...' : ''}.`
    : `Chiêu thức: ${mon.moves.map((mv) => mv.name).join(', ')}.`
  return `${mon.name} Lv${mon.level}, hệ ${mon.types.join('/')}, HP tối đa ${mon.maxHp}. ${poolNote}`
}

function buildRefereeSystemPrompt(pMon, eMon, arenaName) {
  const eLore = getLegendLore(eMon)
  const pLore = getLegendLore(pMon)
  const isEnemyBoss = Boolean(eLore)
  return [
    `Bạn là TRỌNG TÀI kiêm NGƯỜI TƯỜNG THUẬT một trận đấu Pokémon phong cách ANIME thời gian thực. Trả lời hoàn toàn bằng tiếng Việt.`,
    `SÂN ĐẤU: ${arenaName}. Hệ toạ độ (x,y) từ 0..100 — x tăng từ TRÁI sang PHẢI, y tăng từ TRÊN xuống DƯỚI. Vị trí hiện tại của 2 bên được gửi kèm mỗi lượt.`,
    `Phe NGƯỜI CHƠI: ${monBrief(pMon)}`,
    `Phe ĐỊCH: ${monBrief(eMon)}`,
    `LUẬT BẮT BUỘC:`,
    `1. Người chơi gõ lệnh di chuyển/chiêu thức/combo cho Pokémon phe họ. Tường thuật pha đối đầu 2-5 câu kịch tính, gồm phản ứng/phản đòn THÔNG MINH của phe địch trong cùng pha (địch dùng đa dạng chiêu trong bể chiêu của nó, di chuyển chiến thuật, không đứng yên).`,
    `2. TỰ ĐỊNH HƯỚNG NHƯ ANIME: người chơi chỉ cần HÔ CHIÊU — Pokémon là chiến binh có bản năng, nó TỰ di chuyển/căn chỉnh/đổi góc để đánh TRÚNG mục tiêu (khai báo pha tự di chuyển đó qua tag MOVE). Đòn chỉ HỤT khi: đối thủ CHỦ ĐỘNG né/phản (phải tường thuật rõ pha né đó), địa hình/năng lực cản, hoặc lệnh phi lý. Vị trí sân vẫn là chiến thuật (tạt sườn, phục kích, kéo giãn, dồn góc) — người chơi ra lệnh vị trí cụ thể thì ưu tiên theo lệnh. MỖI KHI có bên di chuyển, khai báo vị trí mới: [[MOVE player=x,y enemy=x,y]] (vế nào đứng yên thì bỏ).`,
    `3. SÁT THƯƠNG THEO ĐÚNG HÀNH ĐỘNG MÔ TẢ: đòn đơn nhanh ≈4-8% máu tối đa bên trúng; LIÊN HOÀN/bắn liên tục/combo nhiều đòn CỘNG DỒN ≈12-25%; tuyệt chiêu toàn lực có chuẩn bị ≈20-35%; khắc hệ/đúng điểm yếu cộng thêm; né/hụt = 0. Trần 40%/pha. Đổi lại: combo càng dài bên đánh càng HỞ SƯỜN — phản đòn của đối thủ trong pha đó cũng mạnh hơn tương ứng. Hãy thưởng cho sự sáng tạo: combo khéo léo tận dụng địa hình/vị trí xứng đáng sát thương cao hơn đòn gọi tên suông.`,
    `3b. CHÊNH LỆCH LEVEL LÀ SỨC MẠNH TUYỆT ĐỐI: bên level vượt trội hẳn (gấp rưỡi, gấp đôi) phải ra đòn TÀN PHÁ hơn hẳn và gần như phủi tay trước đòn của bên yếu — Lv200 đấu Lv100 là voi với kiến, tường thuật đúng tầm chênh lệch đó (hệ thống cũng tự khuếch đại số theo level, nhưng lời kể của bạn phải khớp).`,
    `4. BỂ CHIÊU: hệ thống sẽ kèm phán quyết chiêu người chơi nhắc tới có trong bể chiêu không — chiêu KHÔNG có trong bể thì Pokémon không thể thi triển đúng nghĩa (pha đó thất bại/ra đòn yếu hẳn, tường thuật sự lúng túng). Phe địch cũng chỉ dùng chiêu trong bể của nó.`,
    `5. MÔI TRƯỜNG: chiêu thức TÁC ĐỘNG THẬT tới môi trường — Hydro Pump khoét vách đá, Flamethrower đốt rừng cây, Blizzard phủ băng mặt hồ, Earthquake xẻ rãnh sân... Tường thuật sự tàn phá và TẬN DỤNG môi trường (bụi che mắt, hố làm vấp, mặt nước dẫn điện...). Khi môi trường THAY ĐỔI đáng kể, khai báo bằng tag 1 dòng: [[ENV mô tả sân hiện tại, ngắn gọn]] — người chơi được tự do sáng tạo dựa trên môi trường, hãy chiều theo trí tưởng tượng hợp lý của họ.`,
    `6. KHÔNG tự kết thúc trận, không tuyên bố thắng/thua — hệ thống theo dõi HP. LUÔN kết thúc bằng đúng 1 dòng: [[DMG player=<HP phe người chơi mất>, enemy=<HP phe địch mất>]] (số nguyên ≥ 0). Các tag MOVE/ENV (nếu có) đặt trên các dòng riêng NGAY TRƯỚC dòng DMG.`,
    `7. Người chơi CHẦN CHỪ (hệ thống báo) → phe địch chủ động tấn công/di chuyển chiếm lợi thế.`,
    `8. Người chơi có thể NÓI CHUYỆN/THUYẾT PHỤC thay vì ra đòn — tường thuật phản ứng đối phương (hành vi/tiếng kêu, không nói tiếng người), vẫn giữ dòng DMG. CHỈ khi thực sự lay chuyển được thì thêm 1 dòng SAU dòng DMG: [[END result=calm|join|flee]].`,
    isEnemyBoss
      ? `9. QUY TẮC THUYẾT PHỤC PHE ĐỊCH (huyền thoại): ${eLore?.persuasion ?? GENERIC_LEGEND_PERSUASION}`
      : `9. Thuyết phục phe địch (hoang dã thường): dễ xuôi hơn khi HP đã yếu (<50%); join vẫn phải hiếm.`,
    eLore && `NĂNG LỰC HUYỀN THOẠI CỦA PHE ĐỊCH — ${eLore.name}: ${eLore.ability}`,
    pLore &&
      `NĂNG LỰC HUYỀN THOẠI CỦA PHE NGƯỜI CHƠI — ${pLore.name}: ${pLore.ability} (các cơ chế [APP] chỉ được app cưỡng chế cho phe địch trong bản test; với phe người chơi hãy tự phân xử hợp lý trong giới hạn tag DMG).`,
  ]
    .filter(Boolean)
    .join('\n')
}

function TypewriterText({ text, cps, onDone }) {
  const [shown, setShown] = useState(0)
  const doneRef = useRef(false)
  useEffect(() => {
    setShown(0)
    doneRef.current = false
    const interval = Math.max(8, 1000 / Math.max(1, cps))
    const timer = setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          clearInterval(timer)
          if (!doneRef.current) {
            doneRef.current = true
            setTimeout(() => onDone?.(), 0)
          }
          return n
        }
        return n + 1
      })
    }, interval)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])
  return <span>{text.slice(0, shown)}{shown < text.length ? '▌' : ''}</span>
}

function SideCard({ mon, side }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: side === 'enemy' ? 'row-reverse' : 'row' }}>
      <div style={{ minWidth: 160 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: side === 'enemy' ? 'flex-end' : 'flex-start' }}>
          <strong style={{ fontSize: 13 }}>{mon.name}</strong>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-mid)' }}>Lv.{mon.level}</span>
        </div>
        <div style={{ display: 'flex', gap: 4, margin: '4px 0 6px', justifyContent: side === 'enemy' ? 'flex-end' : 'flex-start' }}>
          {mon.types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </div>
        <HealthBar hp={mon.hp} maxHp={mon.maxHp} bars={1} />
      </div>
    </div>
  )
}

// Danh sách địa hình preset cho Dev test (đợt 27) — về sau khi nối vào truyện
// thật, AI sẽ tự tạo địa hình từ chính văn (chế độ "Tự nhập theo prompt" ở
// đây chính là để test trước luồng đó: dán mô tả bất kỳ xem trọng tài khai
// thác thế nào).
const TERRAIN_PRESETS = [
  { id: 'grass', name: 'Đồng cỏ trống', env: 'Đồng cỏ rộng bằng phẳng, gió nhẹ, vài tảng đá rải rác.' },
  { id: 'forest', name: 'Rừng rậm', env: 'Rừng cây dày đặc, tán lá che khuất tầm nhìn, thân cây làm vật cản và chỗ nấp.' },
  { id: 'cave', name: 'Hang động', env: 'Hang đá tối, trần thấp treo thạch nhũ, tiếng vọng lớn — đòn diện rộng dễ gây sập đá.' },
  { id: 'beach', name: 'Bờ biển', env: 'Bãi cát sát mép sóng, một nửa sân là nước nông — lợi thế hệ Nước, cát lún làm chậm bước chân.' },
  { id: 'volcano', name: 'Miệng núi lửa', env: 'Nền đá nóng rực, khe magma phun trào từng đợt — hệ Lửa hưng phấn, chạm magma là bỏng.' },
  { id: 'ice', name: 'Sân băng', env: 'Mặt băng trơn trượt, di chuyển dễ mất đà, hơi thở đóng tuyết.' },
  { id: 'city', name: 'Đường phố', env: 'Phố xá với xe cộ, cột điện, tường bê tông — đòn lạc là đổ vỡ hàng loạt.' },
  { id: 'desert', name: 'Sa mạc bão cát', env: 'Cát cuộn mù mịt hạn chế tầm nhìn, đụn cát nhấp nhô cao thấp.' },
  { id: 'storm', name: 'Giông bão', env: 'Mưa gió gào thét, sấm chớp liên hồi — mặt đất sũng nước dẫn điện.' },
  { id: 'rift', name: 'Khe nứt không gian', env: 'Không gian gãy khúc lơ lửng giữa hư không, trọng lực bất định.' },
]

// Khuếch đại/giảm sát thương theo CHÊNH LỆCH LEVEL (app cưỡng chế — đợt 27):
// model có cào bằng tới đâu thì Lv200 đánh Lv100 vẫn phải ra tấn voi đè kiến.
// mult = (atkLv/defLv)^1.25, kẹp 0.35..2.5 (gấp đôi level ≈ x2.4 sát thương).
function levelDamageMult(atkLv, defLv) {
  return Math.min(2.5, Math.max(0.35, Math.pow(atkLv / Math.max(1, defLv), 1.25)))
}

const P_START = { x: 16, y: 74 }
const E_START = { x: 80, y: 18 }
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

export default function AnimeBattleTester() {
  const { apiConfig, animeApiConfig, pokedexSpecies, movesDb, playerLocation, inventory, setInventory } = useGame()
  const refereeApi = animeApiConfig?.baseUrl && animeApiConfig?.model
    ? { ...apiConfig, ...animeApiConfig }
    : apiConfig

  // --- setup ---
  const [playerSpecies, setPlayerSpecies] = useState(null)
  const [enemySpecies, setEnemySpecies] = useState(null)
  const [playerLevel, setPlayerLevel] = useState(25)
  const [enemyLevel, setEnemyLevel] = useState(25)
  const [cps, setCps] = useState(45)
  const [idleSeconds, setIdleSeconds] = useState(25)
  // Địa hình: 'auto' = theo vị trí bản đồ; id preset; 'custom' = tự nhập prompt.
  const [terrainMode, setTerrainMode] = useState('auto')
  const [customEnv, setCustomEnv] = useState('')

  // --- trận đấu ---
  const [pMon, setPMon] = useState(null)
  const [eMon, setEMon] = useState(null)
  const [pPos, setPPos] = useState(P_START)
  const [ePos, setEPos] = useState(E_START)
  const [env, setEnv] = useState('') // mô tả môi trường hiện tại của sân
  const [arenaName, setArenaName] = useState('Đồng cỏ trống')
  const [feed, setFeed] = useState([])
  const [refHistory, setRefHistory] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [finished, setFinished] = useState(null) // null|'win'|'lose'|'calm'|'join'|'flee'
  const [countdown, setCountdown] = useState(null)
  const [paused, setPaused] = useState(false) // tạm dừng đồng hồ để suy nghĩ
  const [bench, setBench] = useState([]) // Pokémon dự bị (đổi ra/vào giữ nguyên HP)
  const [switchOpen, setSwitchOpen] = useState(false)
  const [benchSpecies, setBenchSpecies] = useState(null)
  const [benchLevel, setBenchLevel] = useState(25)
  const [fx, setFx] = useState(null) // {phase:'playerAtk'|'enemyAtk', dash, dmgE, dmgP, key}
  const feedIdRef = useRef(0)
  const scrollRef = useRef(null)
  const busyRef = useRef(false)
  const legendFlagsRef = useRef({ hoohRebirth: false })

  const started = Boolean(pMon && eMon)
  const lastNarratorId = [...feed].reverse().find((f) => f.who === 'narrator')?.id ?? null

  // --- Nhạc nền combat anime (đợt 28) ---
  // Trận đang chạy → override nhạc battle theo độ hoành tráng của ĐỊCH
  // (eMon.name không đổi giữa trận nên override idempotent, không cắt nhạc).
  // Trận kết thúc / rời tab → pop, nhạc nền cũ tự quay lại.
  useEffect(() => {
    if (started && !finished) {
      musicManager.pushOverride('anime-battle', resolveBattleTrackKeys(eMon))
    } else {
      musicManager.popOverride('anime-battle')
    }
  }, [started, finished, eMon?.name])
  useEffect(() => () => musicManager.popOverride('anime-battle'), [])

  // Jingle kết quả: chỉ chạy đúng 1 lần khi finished chuyển null → giá trị
  // ("Trận mới" reset về null nên trận sau vẫn có jingle).
  useEffect(() => {
    if (!finished) return
    if (['win', 'join', 'calm', 'caught'].includes(finished)) {
      musicManager.playJingle(VICTORY_TRACK_KEYS)
    } else if (finished === 'lose') {
      musicManager.playJingle(DEFEAT_TRACK_KEYS)
    }
  }, [finished])

  // Tập tên chiêu: bể chiêu của phe mình (chip XANH) + toàn bộ chiêu đã biết
  // (để nhận diện cả chiêu người chơi gõ nhưng con mình KHÔNG học được → ĐỎ).
  const poolNameSet = useMemo(
    () => new Set((pMon?.movePool ?? []).map((mv) => mv.name.toLowerCase())),
    [pMon],
  )
  const allMoveNames = useMemo(() => {
    if (!movesDb?.allMoves) return []
    return Object.values(movesDb.allMoves)
      .map((mv) => mv.name)
      .sort((a, b) => b.length - a.length) // dài trước — "Thunderbolt" ăn trước "Thunder"
  }, [movesDb])

  // Nhận diện chiêu được nhắc trong lệnh đang gõ → chips xanh/đỏ.
  const mentionedMoves = useMemo(() => {
    const text = input.toLowerCase()
    if (!text.trim() || allMoveNames.length === 0) return []
    let scan = text
    const found = []
    for (const name of allMoveNames) {
      const ln = name.toLowerCase()
      if (scan.includes(ln)) {
        found.push({ name, inPool: poolNameSet.has(ln) })
        scan = scan.split(ln).join(' '.repeat(ln.length)) // xoá để không match chồng
        if (found.length >= 8) break
      }
    }
    return found
  }, [input, allMoveNames, poolNameSet])

  // Autocomplete: từ đang gõ dở (sau dấu cách/phẩy cuối) khớp đầu tên chiêu trong BỂ.
  const suggestions = useMemo(() => {
    if (!pMon?.movePool?.length) return []
    const tail = input.split(/[\s,.!;:"']+/).pop() ?? ''
    if (tail.length < 2) return []
    const q = tail.toLowerCase()
    return pMon.movePool.filter((mv) => mv.name.toLowerCase().startsWith(q)).slice(0, 6)
  }, [input, pMon])

  function applySuggestion(name) {
    const idx = input.toLowerCase().lastIndexOf((input.split(/[\s,.!;:"']+/).pop() ?? '').toLowerCase())
    setInput(idx >= 0 ? input.slice(0, idx) + name + ' ' : input + name + ' ')
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [feed, loading])

  function pushFeed(who, text, typed = false) {
    feedIdRef.current += 1
    setFeed((f) => [...f, { id: feedIdRef.current, who, text, typed }])
  }

  function startBattle() {
    if (!playerSpecies || !enemySpecies) return
    const p = buildMonSmart(playerSpecies, playerLevel, movesDb, enemySpecies.types)
    const e = buildMonSmart(enemySpecies, enemyLevel, movesDb, playerSpecies.types)
    // Bể chiêu đầy đủ cho combat anime (đợt 26).
    p.movePool = getMovePool(playerSpecies, movesDb)
    e.movePool = getMovePool(enemySpecies, movesDb)
    // Môi trường khởi tạo theo lựa chọn địa hình (đợt 27): auto = vị trí bản
    // đồ, preset = địa hình chọn sẵn, custom = mô tả tự nhập (test luồng AI
    // tạo địa hình từ chính văn sau này).
    let arena
    let initialEnv
    if (terrainMode === 'custom' && customEnv.trim()) {
      arena = 'Địa hình tuỳ chỉnh'
      initialEnv = customEnv.trim()
    } else if (terrainMode !== 'auto' && terrainMode !== 'custom') {
      const preset = TERRAIN_PRESETS.find((t) => t.id === terrainMode)
      arena = preset?.name ?? 'Đồng cỏ trống'
      initialEnv = preset?.env ?? 'Sân trống.'
    } else {
      const area = playerLocation ? getArea(playerLocation.regionKey, playerLocation.areaKey) : null
      const region = playerLocation ? getRegion(playerLocation.regionKey) : null
      arena = area ? `${area.name} (${region?.name})` : 'Đồng cỏ trống ven đường'
      initialEnv = `Sân đấu tại ${arena} — chưa bị tàn phá.`
    }
    setArenaName(arena)
    setEnv(initialEnv)
    setPaused(false)
    setBench([])
    setSwitchOpen(false)
    setPMon(p)
    setEMon(e)
    setPPos(P_START)
    setEPos(E_START)
    setFeed([])
    setRefHistory([])
    setFinished(null)
    setError(null)
    setCountdown(null)
    setFx(null)
    feedIdRef.current = 0
    legendFlagsRef.current = { hoohRebirth: false }
    pushFeed(
      'system',
      `Trận đấu tại ${arena}! ${p.name} Lv${p.level} (bể chiêu ${p.movePool.length}) đối đầu ${e.name} Lv${e.level}. Gõ lệnh di chuyển/chiêu/combo — hoặc nói chuyện để thuyết phục. Chần chừ quá ${idleSeconds}s là ăn đòn!`,
    )
    const mUp = levelDamageMult(p.level, e.level)
    const mDown = levelDamageMult(e.level, p.level)
    if (mUp >= 1.35 || mDown >= 1.35) {
      pushFeed(
        'system',
        `Chênh lệch level: đòn của ${p.name} x${mUp.toFixed(1)}, đòn của ${e.name} x${mDown.toFixed(1)} (app tự khuếch đại theo level).`,
      )
    }
    setCountdown(idleSeconds)
  }

  function runFxSequence(dmgE, dmgP) {
    const seq = Date.now()
    if (dmgE > 0) {
      setFx({ phase: 'playerAtk', dash: true, dmgE, dmgP, key: seq })
      setTimeout(() => setFx((f) => (f?.key === seq ? { ...f, dash: false } : f)), 420)
      if (dmgP > 0) {
        setTimeout(() => setFx((f) => (f?.key === seq ? { ...f, phase: 'enemyAtk', dash: true, key: seq + 1 } : f)), 950)
        setTimeout(() => setFx((f) => (f?.key === seq + 1 ? { ...f, dash: false } : f)), 1370)
        setTimeout(() => setFx((f) => (f?.key === seq + 1 ? null : f)), 1900)
      } else {
        setTimeout(() => setFx((f) => (f?.key === seq ? null : f)), 1000)
      }
    } else if (dmgP > 0) {
      setFx({ phase: 'enemyAtk', dash: true, dmgE, dmgP, key: seq })
      setTimeout(() => setFx((f) => (f?.key === seq ? { ...f, dash: false } : f)), 420)
      setTimeout(() => setFx((f) => (f?.key === seq ? null : f)), 1000)
    }
  }

  async function sendAction(actionText, opts = {}) {
    const { isIdlePenalty = false, pOverride = null, catchBall = null } = opts
    // pOverride: dùng khi VỪA đổi Pokémon (state chưa kịp cập nhật trong closure).
    const activeP = pOverride ?? pMon
    if (busyRef.current || finished || !activeP || !eMon) return
    busyRef.current = true
    setLoading(true)
    setError(null)
    setCountdown(null)
    setPaused(false)

    if (!isIdlePenalty && actionText) pushFeed('player', actionText)

    // Phán quyết bể chiêu (app kiểm tra thay trọng tài — model không cần nhớ
    // hơn 900 chiêu): chiêu nhắc tới có trong bể của phe mình không.
    let moveVerdict = ''
    if (!isIdlePenalty && actionText) {
      const lower = actionText.toLowerCase()
      let scan = lower
      const found = []
      for (const name of allMoveNames) {
        const ln = name.toLowerCase()
        if (scan.includes(ln)) {
          found.push({ name })
          scan = scan.split(ln).join(' '.repeat(ln.length))
          if (found.length >= 8) break
        }
      }
      // Với Pokémon vừa đổi ra, dùng bể chiêu của chính nó (memo poolNameSet
      // vẫn trỏ con cũ trong lần gọi này).
      const activePool = new Set((activeP.movePool ?? []).map((mv) => mv.name.toLowerCase()))
      if (found.length > 0) {
        moveVerdict =
          ' [Phán quyết bể chiêu: ' +
          found
            .map((f) => (activePool.has(f.name.toLowerCase()) ? `${f.name} ✓ CÓ trong bể chiêu` : `${f.name} ✗ KHÔNG có trong bể chiêu của ${activeP.name} — pha dùng chiêu này thất bại/yếu hẳn`))
            .join('; ') +
          ']'
      }
    }

    const stateNote = `[HP — ${activeP.name}: ${activeP.hp}/${activeP.maxHp}, ${eMon.name}: ${eMon.hp}/${eMon.maxHp} | Vị trí (x,y) — ${activeP.name}: (${Math.round(pPos.x)},${Math.round(pPos.y)}), ${eMon.name}: (${Math.round(ePos.x)},${Math.round(ePos.y)}) | Môi trường: ${env}]`
    let userContent
    if (isIdlePenalty) {
      userContent = `${stateNote} [Người chơi chần chừ quá lâu — phe địch chủ động tấn công/di chuyển chiếm lợi thế.]`
    } else if (catchBall) {
      const hpPct = Math.round((eMon.hp / eMon.maxHp) * 100)
      userContent = `${stateNote} [Người chơi NÉM ${catchBall.name} vào ${eMon.name}! Phân xử pha bắt: HP địch còn ${hpPct}% (càng thấp càng dễ), loại bóng ${catchBall.name} (Poké Ball < Great Ball < Ultra Ball), độ hiếm loài (huyền thoại CỰC khó — gần như chỉ khi HP kiệt quệ + bóng xịn). Tường thuật bóng hút nó vào, lắc từng nhịp kịch tính. Vẫn giữ dòng [[DMG ...]] (thường 0,0 — trừ khi nó phá bóng vùng ra phản đòn). SAU dòng DMG thêm đúng 1 dòng: [[CATCH result=caught|escaped]].]`
    } else {
      userContent = `${stateNote}${moveVerdict} ${actionText}`
    }

    const nextHistory = [...refHistory, { role: 'user', content: userContent }]

    try {
      const raw = await chatCompletion(refereeApi, [
        { role: 'system', content: buildRefereeSystemPrompt(activeP, eMon, arenaName) },
        ...nextHistory,
      ])

      const { toPlayer, toEnemy } = parseDamageTag(raw)
      const moved = parseMoveTag(raw)
      const envMatch = raw.match(ENV_TAG_REGEX)
      const narration = cleanAiOutput(stripAllTags(raw)) || '(trọng tài không tường thuật gì)'

      setRefHistory([...nextHistory, { role: 'assistant', content: raw }])
      pushFeed('narrator', narration, true)

      // Cập nhật vị trí + môi trường (sprite tự trượt tới toạ độ mới).
      if (moved.player) setPPos(moved.player)
      if (moved.enemy) setEPos(moved.enemy)
      if (envMatch) {
        setEnv(envMatch[1].trim())
        pushFeed('system', `Môi trường: ${envMatch[1].trim()}`)
      }

      if (toPlayer === null) {
        pushFeed('system', 'Không tìm thấy tag [[DMG ...]] — pha này không tính sát thương (model chưa theo giao thức).')
        return
      }

      // Scale theo chênh lệch level TRƯỚC khi kẹp trần: đòn của phe mình nhân
      // theo (pLv/eLv)^1.25, đòn của địch nhân theo (eLv/pLv)^1.25.
      const scaledToEnemy = Math.round(Math.max(0, toEnemy ?? 0) * levelDamageMult(activeP.level, eMon.level))
      const scaledToPlayer = Math.round(Math.max(0, toPlayer) * levelDamageMult(eMon.level, activeP.level))
      const cappedToPlayer = Math.min(scaledToPlayer, Math.round(activeP.maxHp * 0.4))
      let cappedToEnemy = Math.min(scaledToEnemy, Math.round(eMon.maxHp * 0.4))

      // ===== CƠ CHẾ HUYỀN THOẠI CỨNG (phe địch) =====
      const eSlug = (eMon.spriteId ?? eMon.species ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
      if (eSlug.startsWith('giratina') && cappedToEnemy > 0) {
        const cap = Math.max(1, Math.round(eMon.maxHp * 0.03))
        if (cappedToEnemy > cap) {
          cappedToEnemy = cap
          pushFeed('system', `Lớp phản vật chất của ${eMon.name} nuốt gần trọn đòn đánh — chỉ ${cap} HP lọt qua.`)
        }
      }
      if (eSlug.startsWith('arceus') && cappedToEnemy > 0) {
        const cap = Math.max(1, Math.round(eMon.maxHp * 0.05))
        if (cappedToEnemy > cap) {
          cappedToEnemy = cap
          pushFeed('system', `Thân thể Đấng Sáng Thế gần như miễn nhiễm — chỉ ${cap} HP lọt qua.`)
        }
      }

      const playerHpAfter = Math.max(0, activeP.hp - cappedToPlayer)
      let enemyHpAfter = Math.max(0, eMon.hp - cappedToEnemy)
      let legendNote = null

      if (enemyHpAfter <= 0 && eSlug.startsWith('hooh') && !legendFlagsRef.current.hoohRebirth) {
        legendFlagsRef.current.hoohRebirth = true
        enemyHpAfter = eMon.maxHp
        legendNote = `${eMon.name} gục xuống... rồi BÙNG CHÁY trong ngọn lửa cầu vồng — Lửa Thiêng TÁI SINH, HP hồi về 100%! (chỉ 1 lần/trận)`
      } else if (enemyHpAfter > 0 && cappedToEnemy > 0 && eSlug.startsWith('dialga')) {
        enemyHpAfter = eMon.maxHp
        legendNote = `${eMon.name} gầm vang — thời gian quanh nó CHẢY NGƯỢC, vết thương khép lại như tua phim: HP hồi về 100%. Không hạ gục nó trong đúng 1 đòn thì vô nghĩa!`
      }

      setPMon((m) => (m ? { ...m, hp: playerHpAfter } : m))
      setEMon((m) => (m ? { ...m, hp: enemyHpAfter } : m))
      runFxSequence(cappedToEnemy, cappedToPlayer)

      if (cappedToPlayer > 0 || cappedToEnemy > 0) {
        pushFeed('system', `Sát thương pha này: ${eMon.name} -${cappedToEnemy} HP · ${activeP.name} -${cappedToPlayer} HP`)
      }
      if (legendNote) pushFeed('system', legendNote)

      if (enemyHpAfter <= 0 && playerHpAfter > 0) {
        pushFeed('system', `${eMon.name} đã gục ngã! Bạn THẮNG!`)
        setFinished('win')
      } else if (playerHpAfter <= 0) {
        pushFeed('system', `${activeP.name} đã gục ngã! Bạn THUA...`)
        setFinished('lose')
      } else {
        const catchMatch = raw.match(/\[\[\s*CATCH\s+result\s*=\s*(caught|escaped)\s*\]\]/i)
        if (catchMatch && catchMatch[1].toLowerCase() === 'caught') {
          pushFeed('system', `Cạch... cạch... cạch — TÁCH! Bắt thành công ${eMon.name}! (bản test — chưa vào đội thật)`)
          setFinished('caught')
        } else if (catchMatch) {
          pushFeed('system', `${eMon.name} phá bóng vùng ra! Chưa bắt được.`)
        }
        const endMatch = raw.match(END_TAG_REGEX)
        if (endMatch) {
          const r = endMatch[1].toLowerCase()
          if (r === 'calm') pushFeed('system', `${eMon.name} đã nguôi — trận kết thúc trong hoà bình.`)
          if (r === 'join') pushFeed('system', `${eMon.name} bị bạn thuyết phục, muốn ĐI THEO bạn! (bản test — chưa vào đội thật)`)
          if (r === 'flee') pushFeed('system', `${eMon.name} hoảng sợ bỏ chạy mất!`)
          setFinished(r)
        }
      }
    } catch (err) {
      setError(err.message)
      setCountdown(idleSeconds)
    } finally {
      setLoading(false)
      busyRef.current = false
    }
  }

  useEffect(() => {
    if (countdown === null || finished || loading || paused) return
    if (countdown <= 0) {
      sendAction('', { isIdlePenalty: true })
      return
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, finished, loading, paused])

  // Đổi Pokémon giữa trận: con cũ (giữ nguyên HP) vào ghế dự bị, con mới ra
  // sân — pha đổi người là 1 hành động thật gửi cho trọng tài (địch có thể
  // thừa cơ tấn công lúc mình hở nhịp).
  function performSwitch(newMon) {
    if (!newMon || loading || finished) return
    const old = pMon
    setBench([...bench.filter((b) => b !== newMon), old])
    setPMon(newMon)
    setSwitchOpen(false)
    sendAction(`(Thu hồi ${old.name}! ${newMon.name}, ra sân!)`, { pOverride: newMon })
  }

  function switchInNew() {
    if (!benchSpecies) return
    const total = 1 + bench.length
    if (total >= 4) return
    const m = buildMonSmart(benchSpecies, benchLevel, movesDb, eMon?.types)
    m.movePool = getMovePool(benchSpecies, movesDb)
    performSwitch(m)
    setBenchSpecies(null)
  }

  // Ném bóng bắt — dùng bóng THẬT trong túi đồ (mua ở shop/Test Shop).
  const balls = inventory.filter((it) => ['pokeball', 'greatball', 'ultraball'].includes(it.id))
  function throwBall(ball) {
    if (loading || finished) return
    setInventory(
      inventory.map((it) => (it.id === ball.id ? { ...it, qty: it.qty - 1 } : it)).filter((it) => it.qty > 0),
    )
    pushFeed('player', `(Ném ${ball.name}!)`)
    sendAction('', { catchBall: ball })
  }

  function handleSend() {
    const text = input.trim()
    if (!text || loading || finished) return
    setInput('')
    sendAction(text)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault()
      applySuggestion(suggestions[0].name)
    }
  }

  // Vị trí render: khi dash tấn công, kẻ tấn công trượt 55% quãng đường tới
  // đối thủ rồi quay về (CSS transition trên left/top tạo cú lao mượt).
  const renderPPos = fx?.phase === 'playerAtk' && fx.dash ? lerp(pPos, ePos, 0.55) : pPos
  const renderEPos = fx?.phase === 'enemyAtk' && fx.dash ? lerp(ePos, pPos, 0.55) : ePos
  const tint = envTint(env)

  return (
    <div className="panel">
      <h2 className="page-title">Test Combat Anime</h2>
      <p className="page-subtitle">
        Thời gian thực, gõ chữ điều khiển: di chuyển khắp sân theo toạ độ, bể chiêu đầy đủ (không
        giới hạn 4), combo cộng dồn sát thương, chiêu thức tàn phá môi trường. Chần chừ là ăn đòn.
        (Bản test — chưa nối vào truyện thật.)
      </p>

      <div className="status-pill" style={{ marginBottom: 12, display: 'inline-block' }}>
        Trọng tài dùng: {animeApiConfig?.model ? `API riêng (${animeApiConfig.model})` : 'API chính (cấu hình API Combat Anime riêng trong Cài đặt nếu muốn tách)'}
      </div>

      {!started || finished ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <SidePicker
              label="Phe mình"
              species={playerSpecies}
              onChangeSpecies={setPlayerSpecies}
              level={playerLevel}
              onChangeLevel={setPlayerLevel}
              pokedexSpecies={pokedexSpecies}
            />
            <SidePicker
              label="Phe địch"
              species={enemySpecies}
              onChangeSpecies={setEnemySpecies}
              level={enemyLevel}
              onChangeLevel={setEnemyLevel}
              pokedexSpecies={pokedexSpecies}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
            <div className="field">
              <label style={{ fontSize: 11.5 }}>Tốc độ chữ tường thuật: {cps} ký tự/giây</label>
              <input type="range" min="10" max="120" value={cps} onChange={(e) => setCps(Number(e.target.value))} />
            </div>
            <div className="field">
              <label style={{ fontSize: 11.5 }}>Giới hạn chần chừ: {idleSeconds} giây</label>
              <input type="range" min="10" max="60" value={idleSeconds} onChange={(e) => setIdleSeconds(Number(e.target.value))} />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11.5 }}>Địa hình sân đấu</label>
            <select value={terrainMode} onChange={(e) => setTerrainMode(e.target.value)}>
              <option value="auto">Theo vị trí bản đồ (mặc định — như khi chơi thật)</option>
              {TERRAIN_PRESETS.map((t) => (
                <option key={t.id} value={t.id}>Preset: {t.name}</option>
              ))}
              <option value="custom">✍ Tự nhập theo prompt (test luồng AI tạo địa hình từ chính văn)</option>
            </select>
            {terrainMode === 'custom' && (
              <textarea
                value={customEnv}
                onChange={(e) => setCustomEnv(e.target.value)}
                placeholder='Mô tả địa hình bất kỳ... VD: "Đỉnh tháp đồng hồ giữa cơn mưa axit, sàn kính rạn nứt, phía dưới là vực 50 tầng."'
                style={{ width: '100%', minHeight: 52, marginTop: 6 }}
              />
            )}
          </div>
          <button className="btn btn--primary" onClick={startBattle} disabled={!playerSpecies || !enemySpecies || (terrainMode === 'custom' && !customEnv.trim())}>
            {finished ? 'Trận mới' : 'Bắt đầu trận anime'}
          </button>
          {finished && (
            <span className={`status-pill ${finished === 'lose' ? 'status-pill--error' : 'status-pill--ok'}`} style={{ marginLeft: 10 }}>
              Kết quả trận vừa rồi: {({ win: 'Thắng', lose: 'Thua', calm: 'Hoà giải', join: 'Dụ dỗ thành công', flee: 'Đối phương bỏ chạy', caught: 'Bắt thành công' })[finished] ?? finished}
            </span>
          )}
        </div>
      ) : null}

      {started && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              border: '1px solid var(--line)',
              borderRadius: '8px 8px 0 0',
              padding: '10px 12px',
              background: 'var(--bg-panel)',
            }}
          >
            <SideCard mon={pMon} side="player" />
            <SideCard mon={eMon} side="enemy" />
          </div>

          {/* SÂN ĐẤU TOẠ ĐỘ: sprite đặt theo (x,y)% và TRƯỢT khi di chuyển. */}
          <div
            style={{
              position: 'relative',
              height: 240,
              border: '1px solid var(--line)',
              borderTop: 'none',
              borderRadius: '0 0 8px 8px',
              background: 'linear-gradient(180deg, #12181f 0%, #17202a 55%, #1b2733 100%)',
              overflow: 'hidden',
            }}
          >
            {tint && <div style={{ position: 'absolute', inset: 0, background: tint, pointerEvents: 'none' }} />}
            {/* caption môi trường */}
            <div
              style={{
                position: 'absolute',
                left: 8,
                bottom: 6,
                right: 8,
                fontSize: 10,
                color: 'var(--text-dim)',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                zIndex: 3,
              }}
              title={env}
            >
              ⛰ {arenaName} · {env}
            </div>

            {/* Địch */}
            <div
              className={fx?.phase === 'playerAtk' && !fx.dash && fx.dmgE > 0 ? 'anim-hurt' : undefined}
              style={{
                position: 'absolute',
                left: `${renderEPos.x}%`,
                top: `${renderEPos.y}%`,
                transform: 'translate(-50%, -50%)',
                transition: 'left 0.4s ease-in-out, top 0.4s ease-in-out',
                zIndex: 2,
              }}
            >
              <MonAvatar mon={eMon} side="enemy" />
              {fx?.phase === 'playerAtk' && fx.dmgE > 0 && (
                <React.Fragment key={fx.key}>
                  <div className="anim-impact" style={{ position: 'absolute', inset: '18%', pointerEvents: 'none' }} />
                  <span className="anim-dmg" style={{ position: 'absolute', top: -8, right: -10, fontSize: 17 }}>
                    -{fx.dmgE}
                  </span>
                </React.Fragment>
              )}
            </div>

            {/* Phe mình */}
            <div
              className={fx?.phase === 'enemyAtk' && !fx.dash && fx.dmgP > 0 ? 'anim-hurt' : undefined}
              style={{
                position: 'absolute',
                left: `${renderPPos.x}%`,
                top: `${renderPPos.y}%`,
                transform: 'translate(-50%, -50%)',
                transition: 'left 0.4s ease-in-out, top 0.4s ease-in-out',
                zIndex: 2,
              }}
            >
              <MonAvatar mon={pMon} side="player" />
              {fx?.phase === 'enemyAtk' && fx.dmgP > 0 && (
                <React.Fragment key={fx.key}>
                  <div className="anim-impact" style={{ position: 'absolute', inset: '18%', pointerEvents: 'none' }} />
                  <span className="anim-dmg" style={{ position: 'absolute', top: -8, left: -10, fontSize: 17 }}>
                    -{fx.dmgP}
                  </span>
                </React.Fragment>
              )}
            </div>
          </div>

          <div
            ref={scrollRef}
            style={{ maxHeight: 260, overflowY: 'auto', margin: '12px 0', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}
          >
            {feed.map((item) => {
              if (item.who === 'system') {
                return (
                  <div key={item.id} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--amber)' }}>
                    ⚡ {item.text}
                  </div>
                )
              }
              if (item.who === 'player') {
                return (
                  <p key={item.id} className="story-text story-text--player" style={{ margin: 0 }}>
                    » {item.text}
                  </p>
                )
              }
              const isLatestNarration = item.id === lastNarratorId
              return (
                <p key={item.id} className="story-text" style={{ margin: 0 }}>
                  {item.typed ? (
                    <TypewriterText text={item.text} cps={cps} onDone={isLatestNarration ? () => setCountdown((c) => c ?? idleSeconds) : undefined} />
                  ) : (
                    item.text
                  )}
                </p>
              )
            })}
            {loading && (
              <p style={{ color: 'var(--text-dim)', fontSize: 12, fontStyle: 'italic', margin: 0 }}>
                Trọng tài đang quan sát pha đấu...
              </p>
            )}
          </div>

          {error && (
            <div className="status-pill status-pill--error" style={{ marginBottom: 10 }}>
              {error}
            </div>
          )}

          {!finished && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: paused ? 'var(--amber)' : 'var(--text-dim)' }}>
                  {paused
                    ? '⏸ ĐANG TẠM DỪNG — cứ thong thả suy nghĩ.'
                    : countdown !== null
                      ? `Đối thủ sẽ chủ động tấn công sau: ${countdown}s`
                      : loading
                        ? 'Đồng hồ tạm dừng (đang xử lý pha đấu)...'
                        : 'Đồng hồ tạm dừng (đang tường thuật)...'}
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    className="btn"
                    style={{ fontSize: 11, padding: '3px 10px', borderColor: paused ? 'var(--amber)' : undefined }}
                    onClick={() => setPaused((v) => !v)}
                    disabled={loading}
                  >
                    {paused ? '▶ Tiếp tục' : '⏸ Tạm dừng'}
                  </button>
                  <button className="btn" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setSwitchOpen((v) => !v)} disabled={loading}>
                    🔄 Đổi Pokémon
                  </button>
                  {balls.map((b) => (
                    <button key={b.id} className="btn" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => throwBall(b)} disabled={loading} title="Ném bóng bắt (dùng bóng thật trong túi đồ)">
                      🎯 {b.name} x{b.qty}
                    </button>
                  ))}
                  {balls.length === 0 && (
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', alignSelf: 'center' }}>(Không có bóng — mua ở Test Shop)</span>
                  )}
                  <button className="btn" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => { setFinished('lose'); pushFeed('system', 'Bạn đã bỏ trận.') }}>
                    Bỏ trận
                  </button>
                </div>
              </div>

              {switchOpen && (
                <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 6 }}>
                    Đổi Pokémon (tối đa 4 con/trận — đổi người là hở nhịp, địch có thể thừa cơ đánh)
                  </div>
                  {bench.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {bench.map((m, i) => (
                        <button key={i} className="btn" style={{ fontSize: 11 }} onClick={() => performSwitch(m)} disabled={m.hp <= 0}>
                          {m.name} Lv{m.level} ({m.hp}/{m.maxHp}){m.hp <= 0 ? ' — đã gục' : ''}
                        </button>
                      ))}
                    </div>
                  )}
                  {1 + bench.length < 4 ? (
                    <div>
                      <SidePicker
                        label="Gọi con mới ra sân"
                        species={benchSpecies}
                        onChangeSpecies={setBenchSpecies}
                        level={benchLevel}
                        onChangeLevel={setBenchLevel}
                        pokedexSpecies={pokedexSpecies}
                      />
                      <button className="btn btn--primary" style={{ fontSize: 11 }} onClick={switchInNew} disabled={!benchSpecies}>
                        Tung ra sân!
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Đã đủ 4 con trong trận.</div>
                  )}
                </div>
              )}

              {/* Autocomplete từ BỂ CHIÊU (Tab = chọn gợi ý đầu) */}
              {suggestions.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  {suggestions.map((mv) => (
                    <button
                      key={mv.name}
                      className="btn"
                      style={{ fontSize: 11, padding: '2px 10px', borderColor: 'var(--mint)' }}
                      onClick={() => applySuggestion(mv.name)}
                    >
                      {mv.name} <span style={{ opacity: 0.6 }}>({mv.type}{mv.power > 0 ? ` ${mv.power}` : ''})</span>
                    </button>
                  ))}
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', alignSelf: 'center' }}>Tab = chọn gợi ý đầu</span>
                </div>
              )}

              {/* Chips xanh/đỏ: chiêu được nhắc có trong bể chiêu không */}
              {mentionedMoves.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  {mentionedMoves.map((f) => (
                    <span
                      key={f.name}
                      title={f.inPool ? `${pMon.name} học được chiêu này` : `${pMon.name} KHÔNG học được chiêu này — pha dùng nó sẽ thất bại`}
                      style={{
                        fontSize: 10.5,
                        fontFamily: 'var(--font-mono)',
                        padding: '2px 9px',
                        borderRadius: 999,
                        border: `1px solid ${f.inPool ? 'var(--mint)' : '#d94f4f'}`,
                        color: f.inPool ? 'var(--mint)' : '#d94f4f',
                      }}
                    >
                      {f.inPool ? '✓' : '✗'} {f.name}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ra lệnh cho ${pMon.name}: di chuyển, combo chiêu, tận dụng môi trường — hoặc NÓI để thuyết phục! VD: "Vòng ra sau lưng nó rồi liên hoàn ${pMon.movePool?.[0]?.name ?? 'chiêu'} 3 phát vào cánh!"`}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    maxHeight: 100,
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    color: 'var(--text-hi)',
                    padding: '10px 12px',
                    fontFamily: 'var(--font-body)',
                    fontSize: 13.5,
                  }}
                />
                <button className="btn btn--primary" onClick={handleSend} disabled={loading || !input.trim()}>
                  Ra lệnh
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
