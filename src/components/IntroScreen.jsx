import React, { useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { chatCompletion } from '../services/aiClient.js'
import { buildMainApiMessages } from '../utils/buildMainMessages.js'
import { DIFFICULTIES, GENRES, buildToneNote } from '../data/storyTones.js'
import { cleanAiOutput } from '../utils/outputCleanup.js'
import { REGIONS, getRegion, getArea, detectMentionedArea } from '../data/regions.js'
import { parseStoryStateTags } from '../utils/storyStateProtocol.js'
import { clearMemory, rememberExchange } from '../utils/storyMemory.js'
import { clearNotebook } from '../utils/storyNotebook.js'
import { clearSummary } from '../utils/storySummary.js'
import { resetDirectorState } from '../data/storyDirector.js'
import { IDENTITIES_V2, getIdentityV2 } from '../data/identities.js'
import { OPENINGS } from '../data/openings.js'
import { getSeason } from '../data/weather.js'
import PokeballSpinner from './PokeballSpinner.jsx'

// ============ MÀN TẠO NHÂN VẬT v3 — WIZARD 4 TRANG (đợt 34) ============
// Thiết kế lại toàn bộ theo yêu cầu "bớt phèn": wizard nhiều trang, mọi lựa
// chọn quan trọng đều có MÔ TẢ đầy đủ (card thân phận theo nhóm, blurb từng
// vùng, mô tả tình huống mở đầu), thanh tiến trình, trang tổng kết.
// THAY ĐỔI LỚN: BỎ mục Pokémon khởi đầu — người chơi LUÔN bắt đầu tay
// trắng; việc nhận Pokémon đầu tiên là cột mốc của chương đầu (hoặc muộn
// hơn tuỳ tuổi/hoàn cảnh), cấp qua tag [[POKEMON]]. Roleplay, không phải
// màn chọn tướng.

const GENDERS = ['Nam', 'Nữ', 'Khác / không tiết lộ']

const STEPS = [
  { key: 'profile', label: 'Hồ sơ' },
  { key: 'identity', label: 'Thân phận' },
  { key: 'origin', label: 'Xuất thân' },
  // Đợt 50: trang chọn ĐỘ KHÓ + THỂ LOẠI — quyết định giọng văn toàn truyện
  // (thay cho tông REALISTIC hardcode cũ bị chê "đen tối quá").
  { key: 'tone', label: 'Tông truyện' },
  { key: 'opening', label: 'Mở đầu' },
]

// Blurb 9 vùng (kiến thức nổi tiếng + ổn định, viết nguyên bản, tông realistic).
const REGION_BLURBS = {
  kanto: 'Vùng đất kinh điển: đồng bằng, thị trấn nhỏ và các đô thị công nghiệp mọc quanh Saffron. Nơi Liên đoàn lâu đời nhất vận hành — và cũng là sân nhà cũ của Team Rocket.',
  johto: 'Láng giềng phía tây Kanto: đền tháp, nghề thủ công, những đô thị cổ giữ nếp xưa. Nhịp sống chậm, truyền thống nặng, chuyện cũ chưa bao giờ thật sự ngủ yên.',
  hoenn: 'Vùng nhiệt đới của biển và núi lửa: đảo, cảng cá, mưa nắng thất thường. Con người sống bám vào tự nhiên — và tranh cãi về tự nhiên cũng dữ dội nhất ở đây.',
  sinnoh: 'Vùng đất lạnh phương bắc quanh núi Coronet: mỏ than, đền cổ, hồ thiêng. Thần thoại khởi nguyên thấm vào đời sống thường ngày hơn bất kỳ đâu.',
  unova: 'Vùng đô thị hoá mạnh nhất: cầu vượt biển, cao ốc Castelia, sa mạc ven thành phố. Dòng người nhập cư tứ xứ — cơ hội nhiều, phân hoá cũng nhiều.',
  kalos: 'Vùng của thời trang, ẩm thực và lịch sử chiến tranh cũ. Lumiose hào nhoáng bao nhiêu thì những thị trấn ven lại tĩnh lặng bấy nhiêu.',
  alola: 'Quần đảo nghỉ dưỡng bốn hòn: văn hoá thờ Thần hộ đảo, nghi thức đảo thay cho gym truyền thống. Du lịch nuôi sống nơi này — và cũng đang thay đổi nó.',
  galar: 'Vùng công nghiệp kiểu cũ với văn hoá thi đấu như bóng đá: sân vận động, cổ động viên, hợp đồng tài trợ. Phía sau ánh đèn sân là những tập đoàn năng lượng nắm cả vùng.',
  paldea: 'Vùng đất rộng kiểu bán đảo: học viện lớn ở Mesagoza, làng nghề rải rác, và miệng hố khổng lồ Area Zero mà ai cũng nhắc nhưng ít ai hiểu.',
}

// Nhóm hiển thị thân phận theo poolKey → tiêu đề nhóm.
const POOL_GROUP_LABELS = {
  wanderer: 'Khởi đầu mở',
  laborer: 'Dân lao động',
  clan: 'Gia tộc & quyền quý',
  league: 'Giới thi đấu',
  street: 'Giới xám',
  criminal: 'Giới xám',
  police: 'Thực thi pháp luật',
  ranger: 'Kiểm lâm & tự nhiên',
  scholar: 'Học thuật',
  medic: 'Y tế',
  media: 'Truyền thông',
  performer: 'Biểu diễn',
  merchant: 'Thương nghiệp',
  breeder: 'Nhân giống',
}
const GROUP_ORDER = ['Khởi đầu mở', 'Dân lao động', 'Gia tộc & quyền quý', 'Giới thi đấu', 'Giới xám', 'Thực thi pháp luật', 'Kiểm lâm & tự nhiên', 'Học thuật', 'Y tế', 'Truyền thông', 'Biểu diễn', 'Thương nghiệp', 'Nhân giống']

function groupedIdentities() {
  const groups = new Map()
  for (const i of IDENTITIES_V2) {
    const label = POOL_GROUP_LABELS[i.poolKey] ?? 'Khác'
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label).push(i)
  }
  return GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({ label: g, items: groups.get(g) }))
}

// Card lựa chọn dùng chung (thân phận / vùng / mở đầu).
function PickCard({ selected, title, desc, onClick, compact }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        border: `1px solid ${selected ? 'var(--amber)' : 'var(--line)'}`,
        background: selected ? 'rgba(232,184,74,0.08)' : 'var(--bg-deep)',
        borderRadius: 10,
        padding: compact ? '8px 10px' : '10px 12px',
        cursor: 'pointer',
        display: 'block',
        width: '100%',
        color: 'inherit',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: selected ? 'var(--amber)' : 'var(--text-hi)' }}>
        {selected ? '● ' : ''}{title}
      </div>
      {desc && <div style={{ fontSize: 11.5, color: 'var(--text-mid)', marginTop: 3, lineHeight: 1.5 }}>{desc}</div>}
    </button>
  )
}

export default function IntroScreen({ onOpenSettings, onOpenDev }) {
  const {
    apiConfig, character, stylePreset, mainPreset, assistantPrefill,
    setPlayerName, setPlayerMon, setMessages, setGameStarted,
    pokedexSpecies, movesDb, setPlayerLocation, setParty,
    memoryApiConfig, playerIdentity, setPlayerIdentity,
    setPlayerCharacter, storyDate, setStoryDate, worldbook,
    messages,
    storyTone, setStoryTone,
    setInventory, setRelationships, setBodyStatus, setHunger, setPlayerProfile,
  } = useGame()

  const [stage, setStage] = useState('title') // 'title' | 'setup'
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Hồ sơ
  const [trainerName, setTrainerName] = useState('')
  const [gender, setGender] = useState('')
  const [age, setAge] = useState('')
  const [appearance, setAppearance] = useState('')
  // Thân phận custom
  const [customName, setCustomName] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  // Xuất thân + ngày
  const [originRegionKey, setOriginRegionKey] = useState('kanto')
  const [originAreaKey, setOriginAreaKey] = useState('')
  const [startDay, setStartDay] = useState(storyDate.day)
  const [startMonth, setStartMonth] = useState(storyDate.month)
  const [startYear, setStartYear] = useState(storyDate.year)
  // Mở đầu
  const [openingKey, setOpeningKey] = useState('auto')
  const [desiredOpening, setDesiredOpening] = useState('')

  const configured = Boolean(apiConfig.baseUrl && apiConfig.model)
  const originRegion = getRegion(originRegionKey)
  const isCustomIdentity = playerIdentity === 'custom'
  const identity = isCustomIdentity
    ? { name: customName.trim() || 'Thân phận riêng', desc: customDesc.trim() }
    : getIdentityV2(playerIdentity)

  function stepError() {
    // Validate khi bấm Tiếp tục ở từng trang.
    if (STEPS[step].key === 'identity' && isCustomIdentity && !customDesc.trim()) {
      return 'Thân phận tự tạo cần ít nhất phần mô tả — hoặc chọn một thân phận có sẵn.'
    }
    return null
  }

  function goNext() {
    const e = stepError()
    if (e) {
      setError(e)
      return
    }
    setError(null)
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  async function handleBegin() {
    if (loading) return
    setError(null)
    if (!configured) {
      setError('Chưa cấu hình API — quay lại màn đầu, bấm "Cài đặt API" đã nhé.')
      return
    }
    const e = stepError()
    if (e) {
      setError(e)
      return
    }

    const finalName = trainerName.trim() || 'Nhà Huấn Luyện'
    setPlayerName(finalName)
    setPlayerCharacter({
      gender: gender || '',
      age: age || '',
      appearance: appearance.trim(),
      originRegionKey,
      originAreaKey,
      customIdentity: isCustomIdentity ? { name: identity.name, desc: identity.desc } : null,
    })

    const d = Math.max(1, Math.min(31, Number(startDay) || 1))
    const m = Math.max(1, Math.min(12, Number(startMonth) || 1))
    const y = Math.max(1, Math.min(9999, Number(startYear) || 2000))
    setStoryDate({ day: d, month: m, year: y, part: 'sáng' })

    // LUÔN tay trắng (đợt 34): nhận Pokémon đầu tiên là cột mốc trong truyện.
    setPlayerMon(null)
    setParty([])
    // RESET HÀNH TRÌNH CŨ (đợt 46): trước đây tiền/túi đồ/quan hệ/thương
    // tích/độ no của run trước dính sang run mới (vì đều persist) — hành
    // trình MỚI phải sạch sẽ từ đầu.
    setInventory([])
    setRelationships([])
    setBodyStatus({ head: 0, torso: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 })
    setHunger({ player: 100, mon: 100 })
    setPlayerProfile((prof) => ({ ...prof, money: 3000 }))

    const originArea = originAreaKey ? getArea(originRegionKey, originAreaKey) : null
    if (originArea) setPlayerLocation({ regionKey: originRegionKey, areaKey: originAreaKey })

    const opening = OPENINGS.find((o) => o.key === openingKey) ?? null
    const ageNum = Number(age) || null
    const directive = [
      `[Chỉ dẫn hệ thống — không phải lời thoại nhân vật] Hãy viết đoạn MỞ ĐẦU cho câu chuyện.`,
      // Đợt 50: tông truyện do NGƯỜI CHƠI chọn (độ khó + thể loại) thay cho
      // tông REALISTIC hardcode cũ.
      buildToneNote(storyTone),
      `Nhân vật chính (người chơi): ${finalName}${gender ? `, giới tính ${gender}` : ''}${age ? `, ${age} tuổi` : ''}.`,
      appearance.trim() ? `Ngoại hình: ${appearance.trim()}.` : '',
      `Thân phận: ${identity.name} — ${identity.desc} Để thân phận thấm vào bối cảnh một cách TỰ NHIÊN, không kể lể dồn dập.`,
      originArea
        ? `Xuất thân: ${originArea.name}, vùng ${originRegion?.name}. Mở đầu diễn ra tại/gắn với nơi này (trừ khi tình huống mở đầu nói khác).`
        : `Xuất thân: vùng ${originRegion?.name} (tự chọn một nơi cụ thể hợp thân phận).`,
      `Ngày bắt đầu (lịch trong truyện): ngày ${d}/${m}/năm ${y}, buổi sáng, mùa ${getSeason(m)}.`,
      `Người chơi KHỞI ĐẦU TAY TRẮNG — CHƯA có Pokémon nào. Việc nhận Pokémon ĐẦU TIÊN phải là một cột mốc có ý nghĩa của chương đầu${ageNum && ageNum < 10 ? ' (nhân vật còn nhỏ tuổi — có thể để muộn hơn nữa, vài chương sau mới nhận, tuỳ hoàn cảnh)' : ' (hoặc muộn hơn nếu hoàn cảnh hợp lý hơn như vậy)'}, đến từ diễn biến tự nhiên; khi đó dùng tag [[POKEMON Tên | Lv..]]. TUYỆT ĐỐI không phát Pokémon ngay trong đoạn mở đầu.`,
      opening
        ? `TÌNH HUỐNG MỞ ĐẦU BẮT BUỘC BÁM THEO (đây là mong muốn của người chơi, phải là hạt nhân của đoạn mở đầu): ${opening.seed}`
        : openingKey === 'custom' && desiredOpening.trim()
          ? `TÌNH HUỐNG MỞ ĐẦU BẮT BUỘC BÁM THEO — người chơi tự viết, phải dựng đúng cảnh này làm mở màn (không thay bằng cảnh khác): "${desiredOpening.trim()}"`
          : `Người chơi không chọn tình huống cụ thể — TỰ SÁNG TẠO một khởi đầu hợp thân phận + xuất thân, đời thường và có sức sống.`,
      `Viết đoạn mở đầu CÓ CHIỀU SÂU, khoảng 400-700 từ (nhiều đoạn văn), giàu chi tiết giác quan và không khí — KHÔNG viết ngắn cụt lủn.`,
      `Bắt đầu thẳng vào câu chuyện, không hỏi lại người chơi, không liệt kê lựa chọn.`,
    ].filter(Boolean).join('\n')

    setLoading(true)
    try {
      const { apiMessages, callOptions, regexScripts } = buildMainApiMessages({
        character,
        playerName: finalName,
        stylePreset,
        mainPreset,
        history: [{ role: 'user', content: directive }],
        scanText: `${directive}\n${originArea?.name ?? ''} ${originRegion?.name ?? ''}`,
        identityContext: `THÂN PHẬN NHÂN VẬT CHÍNH (cố định, phải nhất quán xuyên suốt): ${identity.name} — ${identity.desc}`,
        worldbook,
        toneNote: buildToneNote(storyTone),
      })
      callOptions.assistantPrefill = assistantPrefill

      const reply = await chatCompletion(apiConfig, apiMessages, callOptions)
      const cleaned = cleanAiOutput(reply, regexScripts)
      if (!cleaned) {
        throw new Error('AI chỉ trả về phần suy nghĩ (CoT), chưa kịp viết chính văn. Thử tăng "Max tokens" của preset ở trang Cài đặt API.')
      }
      const parsed = parseStoryStateTags(cleaned)
      const openingText = parsed.cleaned
      setMessages([
        { role: 'user', hidden: true, resultLabel: 'Bắt đầu câu chuyện', content: directive },
        { role: 'assistant', content: openingText },
      ])
      // AI lỡ cấp Pokémon ngay mở đầu (đã cấm nhưng đề phòng) → vẫn tôn trọng tag.
      for (const pk of parsed.pokemons ?? []) {
        const entry = pokedexSpecies.find((sp) => sp.name.toLowerCase() === pk.species.toLowerCase())
        if (entry) {
          const { buildMonSmart } = await import('../data/pokemonSpecies.js')
          const mon = buildMonSmart(entry, pk.level, movesDb)
          setPlayerMon((cur) => cur ?? mon)
          setParty((cur) => (cur.length < 6 ? [...cur, mon] : cur))
        }
      }
      clearMemory()
      clearNotebook()
      clearSummary()
      resetDirectorState()
      const embCfg = memoryApiConfig?.embedding
      if (embCfg?.baseUrl && embCfg?.model) {
        rememberExchange(
          embCfg,
          `Mở đầu: ${finalName} (${identity.name}), xuất thân ${originArea?.name ?? originRegion?.name}, ngày ${d}/${m}/${y}.`,
          openingText,
          2,
        ).catch((memErr) => console.warn('[memory] ghi ký ức mở đầu lỗi (bỏ qua):', memErr.message))
      }
      const startArea = detectMentionedArea(openingText, null)
      if (startArea) setPlayerLocation(startArea)
      setGameStarted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (stage === 'title') {
    return (
      <div className="intro-bg">
        <div className="intro-content">
          <div>
            <div className="intro-title">TRAINER ARENA</div>
            <p style={{ color: 'var(--text-mid)', marginTop: 12, fontSize: 14 }}>
              Thế giới nhập vai của huấn luyện viên Pokémon
            </p>
          </div>
          {/* Đợt 46: còn truyện dở (messages đã persist) → cho quay lại chơi
              tiếp thay vì chỉ có đường tạo mới. */}
          {messages.length > 0 && (
            <button className="btn--gold" onClick={() => setGameStarted(true)}>
              ▶ Tiếp tục hành trình
            </button>
          )}
          <button className={messages.length > 0 ? 'btn' : 'btn--gold'} onClick={() => { setStage('setup'); setStep(0) }}>
            Bắt đầu một hành trình mới
          </button>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={onOpenSettings} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Cài đặt API
            </button>
            {/* Đợt 49: nút Dev ở TITLE SCREEN cũng phải theo cờ ?dev=1 —
                đây chính là cái nút "sống dai" trên bản deploy: đợt 48 chỉ
                ẩn nút ở header màn chơi mà quên mất màn hình chính có nút
                Dev RIÊNG của nó. Bài học: ẩn 1 tính năng phải grep TOÀN BỘ
                điểm vào, không chỉ chỗ mình nhớ. */}
            {typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('dev') && (
              <button className="btn" onClick={onOpenDev}>Chế độ Dev</button>
            )}
          </div>
          {!configured && (
            <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>Mẹo: bấm "Cài đặt API" ở trên trước khi bắt đầu.</p>
          )}
        </div>
      </div>
    )
  }

  const stepKey = STEPS[step].key

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 20 }}>
        <PokeballSpinner size={72} />
        <div style={{ fontSize: 15, color: 'var(--text-hi)', fontWeight: 600 }}>Đang viết khởi đầu cho hành trình của bạn...</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>AI đang dựng bối cảnh mở màn — chờ một chút nhé.</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="panel" style={{ width: 'min(720px, 100%)', maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}>
        {/* Thanh tiến trình */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          {STEPS.map((s2, i) => (
            <React.Fragment key={s2.key}>
              <button
                onClick={() => i < step && setStep(i)}
                style={{
                  border: 'none', background: 'none', cursor: i < step ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', gap: 6, padding: 0, color: 'inherit',
                }}
              >
                <span
                  style={{
                    width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: i === step ? 'var(--amber)' : i < step ? 'var(--mint)' : 'var(--bg-deep)',
                    color: i <= step ? '#0d1a16' : 'var(--text-dim)',
                    border: `1px solid ${i <= step ? 'transparent' : 'var(--line)'}`,
                  }}
                >
                  {i < step ? '✓' : i + 1}
                </span>
                <span style={{ fontSize: 11.5, color: i === step ? 'var(--amber)' : 'var(--text-dim)', fontWeight: i === step ? 700 : 400 }}>
                  {s2.label}
                </span>
              </button>
              {i < STEPS.length - 1 && <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />}
            </React.Fragment>
          ))}
        </div>
        <h2 className="page-title" style={{ marginTop: 8 }}>
          {stepKey === 'profile' && 'Bạn là ai?'}
          {stepKey === 'identity' && 'Thân phận — xuất phát điểm xã hội của bạn'}
          {stepKey === 'origin' && 'Quê nhà & thời điểm bắt đầu'}
          {stepKey === 'tone' && 'Tông truyện — bạn muốn thế giới này vận hành thế nào?'}
          {stepKey === 'opening' && 'Câu chuyện bắt đầu thế nào?'}
        </h2>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {/* ===== TRANG 1: HỒ SƠ ===== */}
          {stepKey === 'profile' && (
            <>
              <p className="page-subtitle">
                Điền thông tin cơ bản. Để trống phần nào cũng được — AI sẽ tự lo phần đó. Thế giới theo
                tông realistic kiểu Pokémon Special: có sinh kế, luật lệ, và mặt tối thật sự.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                <div className="field">
                  <label>Tên nhân vật</label>
                  <input value={trainerName} onChange={(e2) => setTrainerName(e2.target.value)} placeholder="Để trống = 'Nhà Huấn Luyện'" />
                </div>
                <div className="field">
                  <label>Giới tính</label>
                  <select value={gender} onChange={(e2) => setGender(e2.target.value)}>
                    <option value="">— Chọn —</option>
                    {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Tuổi</label>
                  <input type="number" min={6} max={99} value={age} onChange={(e2) => setAge(e2.target.value)} placeholder="VD 16" />
                </div>
              </div>
              <div className="field">
                <label>Đặc điểm ngoại hình (tuỳ chọn)</label>
                <textarea
                  value={appearance}
                  onChange={(e2) => setAppearance(e2.target.value)}
                  placeholder="VD: tóc đen cắt ngắn, da rám nắng, sẹo nhỏ trên mày trái, hay mặc áo khoác kaki bạc màu..."
                  style={{ minHeight: 64 }}
                />
                <small style={{ color: 'var(--text-dim)' }}>Ngoại hình được khai báo cố định trong prompt — NPC sẽ thật sự "nhìn thấy" bạn như mô tả này.</small>
              </div>
              <div className="field" style={{ background: 'rgba(95,215,232,0.06)', border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
                <label style={{ color: 'var(--mint)' }}>Về Pokémon khởi đầu</label>
                <small style={{ color: 'var(--text-mid)', lineHeight: 1.6 }}>
                  Bạn sẽ bắt đầu KHÔNG có Pokémon. Việc nhận Pokémon đầu tiên là một cột mốc trong truyện —
                  chương đầu, hoặc muộn hơn tuỳ tuổi và hoàn cảnh nhân vật. Đây là roleplay, không phải màn chọn tướng.
                </small>
              </div>
            </>
          )}

          {/* ===== TRANG 2: THÂN PHẬN ===== */}
          {stepKey === 'identity' && (
            <>
              <p className="page-subtitle">
                Thân phận quyết định cách thế giới nhìn bạn và những biến cố tự tìm tới bạn (Đạo diễn tình
                huống dùng đúng pool của thân phận này). Chọn một — hoặc tự viết ở cuối danh sách.
              </p>
              {groupedIdentities().map((g) => (
                <div key={g.label} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10.5, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--mint)', margin: '10px 0 6px' }}>
                    {g.label.toUpperCase()}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {g.items.map((i2) => (
                      <PickCard
                        key={i2.key}
                        selected={playerIdentity === i2.key}
                        title={i2.name}
                        desc={i2.desc}
                        onClick={() => setPlayerIdentity(i2.key)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 10.5, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--mint)', margin: '10px 0 6px' }}>
                  TỰ TẠO
                </div>
                <PickCard
                  selected={isCustomIdentity}
                  title="✎ Thân phận riêng của bạn"
                  desc="Tự viết xuất phát điểm xã hội, nghề/kỹ năng, ràng buộc và rắc rối đặc trưng — AI triển khai đúng theo mô tả."
                  onClick={() => setPlayerIdentity('custom')}
                />
                {isCustomIdentity && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input value={customName} onChange={(e2) => setCustomName(e2.target.value)} placeholder="Tên thân phận (VD: Thợ săn tiền thưởng có giấy phép)" />
                    <textarea
                      value={customDesc}
                      onChange={(e2) => setCustomDesc(e2.target.value)}
                      placeholder="Mô tả: xuất phát điểm xã hội, nghề/kỹ năng, ràng buộc, rắc rối đặc trưng..."
                      style={{ minHeight: 64 }}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* ===== TRANG 3: XUẤT THÂN + NGÀY ===== */}
          {stepKey === 'origin' && (
            <>
              <p className="page-subtitle">
                Quê nhà định hình giọng nói, mối quan hệ đầu đời — và tổ chức phản diện nào lảng vảng
                trong tin tức địa phương. Mỗi vùng một khí chất riêng.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                {REGIONS.map((r) => (
                  <PickCard
                    key={r.key}
                    compact
                    selected={originRegionKey === r.key}
                    title={`${r.name} (Gen ${r.gen})`}
                    desc={REGION_BLURBS[r.key]}
                    onClick={() => { setOriginRegionKey(r.key); setOriginAreaKey('') }}
                  />
                ))}
              </div>
              <div className="field">
                <label>Thành phố / khu xuất thân trong {originRegion?.name}</label>
                <select value={originAreaKey} onChange={(e2) => setOriginAreaKey(e2.target.value)}>
                  <option value="">— Để AI tự chọn nơi hợp thân phận —</option>
                  {(originRegion?.areas ?? []).map((a) => (
                    <option key={a.key} value={a.key}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Ngày bắt đầu (lịch trong truyện)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" min={1} max={31} value={startDay} onChange={(e2) => setStartDay(e2.target.value)} style={{ width: 70 }} title="Ngày" />
                  /
                  <input type="number" min={1} max={12} value={startMonth} onChange={(e2) => setStartMonth(e2.target.value)} style={{ width: 70 }} title="Tháng" />
                  /
                  <input type="number" min={1} max={9999} value={startYear} onChange={(e2) => setStartYear(e2.target.value)} style={{ width: 90 }} title="Năm" />
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    → mùa {getSeason(Math.max(1, Math.min(12, Number(startMonth) || 1)))}
                  </span>
                </div>
                <small style={{ color: 'var(--text-dim)' }}>
                  Lịch quyết định MÙA + THỜI TIẾT mỗi ngày và LỄ HỘI của vùng; AI tự đẩy lịch khi thời gian trôi,
                  và mốc ngày được gắn vào sổ tay để trí nhớ không lẫn trình tự.
                </small>
              </div>
            </>
          )}

          {/* ===== TRANG 4: MỞ ĐẦU + TỔNG KẾT ===== */}
          {stepKey === 'tone' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setStoryTone((t) => ({ ...t, difficulty: d.key }))}
                    style={{
                      textAlign: 'left', border: `1px solid ${storyTone.difficulty === d.key ? 'var(--amber)' : 'var(--line)'}`,
                      background: storyTone.difficulty === d.key ? 'var(--bg-deep)' : 'transparent',
                      borderRadius: 10, padding: '12px 14px', cursor: 'pointer', color: 'var(--text-main)',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14, color: storyTone.difficulty === d.key ? 'var(--amber)' : 'var(--text-main)' }}>{d.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: 4 }}>{d.desc}</div>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-mid)', marginBottom: 8 }}>
                  Thể loại chính (chọn tối đa 3 — có thể bỏ qua)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {GENRES.map((g) => {
                    const on = storyTone.genres?.includes(g.key)
                    return (
                      <button
                        key={g.key}
                        onClick={() => setStoryTone((t) => {
                          const cur = t.genres ?? []
                          if (cur.includes(g.key)) return { ...t, genres: cur.filter((k) => k !== g.key) }
                          if (cur.length >= 3) return t // trần 3 thể loại — nhiều hơn là loãng
                          return { ...t, genres: [...cur, g.key] }
                        })}
                        style={{
                          border: `1px solid ${on ? 'var(--mint)' : 'var(--line)'}`,
                          color: on ? 'var(--mint)' : 'var(--text-mid)',
                          background: 'transparent', borderRadius: 999, padding: '5px 14px',
                          fontSize: 12.5, cursor: 'pointer',
                        }}
                      >
                        {g.label}
                      </button>
                    )
                  })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
                  Độ khó quyết định giọng văn & mức rủi ro (Thực tế: có thể chết → game over). Thể loại là
                  gia vị AI sẽ ưu tiên dệt vào truyện. Đổi được giữa chừng trong Cài đặt sau này nếu cần.
                </div>
              </div>
            </div>
          )}

          {stepKey === 'opening' && (
            <>
              <p className="page-subtitle">Chọn cách câu chuyện mở màn — mỗi lựa chọn có mô tả đầy đủ bên dưới.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <PickCard
                  selected={openingKey === 'auto'}
                  title="🎲 Để AI tự nghĩ"
                  desc="AI tự sáng tạo khởi đầu hợp thân phận + xuất thân — đời thường và có sức sống."
                  onClick={() => setOpeningKey('auto')}
                />
                {OPENINGS.map((o) => (
                  <PickCard
                    key={o.key}
                    selected={openingKey === o.key}
                    title={o.name}
                    desc={o.seed}
                    onClick={() => setOpeningKey(o.key)}
                  />
                ))}
                <PickCard
                  selected={openingKey === 'custom'}
                  title="✎ Tự viết mở đầu riêng"
                  desc="Mô tả cảnh mở màn bạn muốn — AI viết dựa theo ý này."
                  onClick={() => setOpeningKey('custom')}
                />
              </div>
              {openingKey === 'custom' && (
                <textarea
                  value={desiredOpening}
                  onChange={(e2) => setDesiredOpening(e2.target.value)}
                  placeholder="VD: Mình muốn bắt đầu giữa đêm mưa, đang trực ca ở trung tâm Pokémon thì có người đập cửa..."
                  style={{ minHeight: 64, marginTop: 8, width: '100%' }}
                />
              )}
              {/* Tổng kết */}
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, marginTop: 14, background: 'var(--bg-deep)' }}>
                <div style={{ fontSize: 10.5, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--amber)', marginBottom: 6 }}>
                  TỔNG KẾT NHÂN VẬT
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-mid)' }}>
                  <b style={{ color: 'var(--text-hi)' }}>{trainerName.trim() || 'Nhà Huấn Luyện'}</b>
                  {gender && ` · ${gender}`}{age && ` · ${age} tuổi`}
                  <br />
                  Thân phận: <b style={{ color: 'var(--text-hi)' }}>{identity.name}</b>
                  <br />
                  Xuất thân: {originAreaKey ? getArea(originRegionKey, originAreaKey)?.name + ', ' : ''}{originRegion?.name}
                  {' '}· Bắt đầu ngày {startDay}/{startMonth}/{startYear} (mùa {getSeason(Math.max(1, Math.min(12, Number(startMonth) || 1)))})
                  <br />
                  Pokémon: <span style={{ color: 'var(--mint)' }}>tay trắng — sẽ nhận trong truyện</span>
                </div>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="status-pill status-pill--error" style={{ marginTop: 10 }}>{error}</div>
        )}

        <div className="btn-row" style={{ marginTop: 12 }}>
          <button
            className="btn"
            onClick={() => (step === 0 ? setStage('title') : setStep(step - 1))}
            disabled={loading}
          >
            ← {step === 0 ? 'Màn hình chính' : 'Quay lại'}
          </button>
          <span style={{ flex: 1 }} />
          {step < STEPS.length - 1 ? (
            <button className="btn btn--primary" onClick={goNext}>Tiếp tục →</button>
          ) : (
            <button className="btn btn--primary" onClick={handleBegin} disabled={loading}>
              ✦ Bắt đầu hành trình
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
