import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { chatCompletion } from '../services/aiClient.js'
import { generateActionChoices } from '../services/actionChoiceGenerator.js'
import { extractSemanticStateEvents } from '../services/semanticStateEngine.js'
import { buildMainApiMessages } from '../utils/buildMainMessages.js'
import { GENRES, buildToneNote } from '../data/storyTones.js'
import { GAME_MODES, legendaryAccess, normalizeGameMode, sanitizeTraitsForMode } from '../data/gameModes.js'
import { ensurePokemonIdentity } from '../data/persistentIdentity.js'
import { buildWildMon, normalizeAcquiredMon, recomputeMonStats, NATURES } from '../data/pokemonSpecies.js'
import { applyWorldDirectives, DEFAULT_WORLD_PROGRESS } from '../data/worldProgress.js'
import { validateStateAgainstProse } from '../utils/stateEvidence.js'
import { DEFAULT_POKEMON_LIFE } from '../data/pokemonLife.js'
import { DEFAULT_TRADE_STATE } from '../data/trading.js'
import { PERSONALITY_TRAITS, SUPERPOWERS, buildCharacterTraitsNote } from '../data/characterTraits.js'
import { applyPerksToMon, describeCustomMechanicEffects, syncTraitGrantedItems } from '../data/playerPerks.js'
import { loadCharacterPresets, saveCharacterPreset, deleteCharacterPreset } from '../utils/characterPresets.js'
import AvatarPicker from './AvatarPicker.jsx'
import MonAvatar from './MonAvatar.jsx'
import { cleanAiOutput, extractStateTags } from '../utils/outputCleanup.js'
import { extractActionChoices } from '../utils/actionChoices.js'
import { REGIONS, getRegion, getArea } from '../data/regions.js'
import { applyStoryState, parseStoryStateTags } from '../utils/storyStateProtocol.js'
import { clearMemory, rememberExchange } from '../utils/storyMemory.js'
import { archiveExchange, clearArchive } from '../utils/storyArchive.js'
import { addFact, clearNotebook, upsertNpc } from '../utils/storyNotebook.js'
import { clearSummary } from '../utils/storySummary.js'
import { resetDirectorState } from '../data/storyDirector.js'
import { IDENTITIES_V2, buildIdentityContext, getIdentityV2, startingMoneyForIdentity } from '../data/identities.js'
import { OPENINGS } from '../data/openings.js'
import { getSeason } from '../data/weather.js'
import { SHOP_ITEMS, resolveItemByName, createCustomItemDescriptor, resolveInventoryItemByName } from '../data/shopItems.js'
import { HELD_ITEMS, normalizeHeldItem } from '../data/pokemonHeldItems.js'
import { normalizeAbilityOptions } from '../data/pokemonAbilities.js'
import { ALL_TYPES } from '../data/pokemonTypes.js'
import { generateLootItems } from '../data/shopGenerator.js'
import PokeballSpinner from './PokeballSpinner.jsx'
import RetroBattleIntro from './RetroBattleIntro.jsx'
import { musicManager } from '../utils/musicManager.js'
import { applyDynamicStateUpdates } from '../data/dynamicState.js'

// ============ MÀN TẠO NHÂN VẬT v3 — WIZARD 4 TRANG (đợt 34) ============
// Thiết kế lại toàn bộ theo yêu cầu "bớt phèn": wizard nhiều trang, mọi lựa
// chọn quan trọng đều có MÔ TẢ đầy đủ (card thân phận theo nhóm, blurb từng
// vùng, mô tả tình huống mở đầu), thanh tiến trình, trang tổng kết.
// Thực tế/Anime vẫn mặc định bắt đầu tay trắng để Pokémon đầu tiên là một
// cột mốc roleplay. Riêng Sandbox cho phép cấu hình state khởi đầu tự do
// (Pokémon/level/tiền/vật phẩm/sức mạnh) rồi sau đó vận hành theo luật Anime.

const GENDERS = ['Nam', 'Nữ', 'Khác / không tiết lộ']
const TITLE_INTRO_SESSION_KEY = 'trainer-arena-title-seen-v1'
const SANDBOX_STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
const SANDBOX_STAT_LABELS = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' }
const SANDBOX_DEFAULT_IVS = { hp: '31', atk: '31', def: '31', spa: '31', spd: '31', spe: '31' }
const SANDBOX_DEFAULT_EVS = { hp: '0', atk: '0', def: '0', spa: '0', spd: '0', spe: '0' }

function pokemonId(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function sandboxFormFamily(entry, pokedex = []) {
  if (!entry) return []
  const bySameDex = Number.isFinite(entry.num)
    ? pokedex.filter((candidate) => Number(candidate.num) === Number(entry.num))
    : []
  const rootId = pokemonId(entry.baseSpeciesId ?? entry.species ?? entry.name)
  const byRoot = pokedex.filter((candidate) => {
    const candidateRoot = pokemonId(candidate.baseSpeciesId ?? candidate.species ?? candidate.name)
    return candidateRoot === rootId || pokemonId(candidate.species) === rootId
  })
  const source = bySameDex.length ? bySameDex : byRoot
  const seen = new Set()
  return source
    .filter((candidate) => {
      const key = candidate.species ?? candidate.name
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => Number(Boolean(a.forme)) - Number(Boolean(b.forme)) || String(a.name).localeCompare(String(b.name)))
}

function sandboxGenderOptions(entry) {
  if (!entry) return [{ value: 'auto', label: 'Tự động theo canon' }]
  const fixed = String(entry.gender ?? '').toUpperCase()
  if (fixed === 'N') return [{ value: 'unknown', label: '◇ Vô giới tính' }]
  if (fixed === 'M') return [{ value: 'male', label: '♂ Đực' }]
  if (fixed === 'F') return [{ value: 'female', label: '♀ Cái' }]
  const male = Number(entry.genderRatio?.M)
  const female = Number(entry.genderRatio?.F)
  const options = [{ value: 'auto', label: '🎲 Tự động theo tỉ lệ canon' }]
  if (!Number.isFinite(male) || male > 0) options.push({ value: 'male', label: '♂ Đực' })
  if (!Number.isFinite(female) || female > 0) options.push({ value: 'female', label: '♀ Cái' })
  return options
}

function clampSandboxStats(raw, maxValue, fallback = 0) {
  return Object.fromEntries(SANDBOX_STAT_KEYS.map((key) => {
    const value = Math.floor(Number(raw?.[key]))
    return [key, Math.max(0, Math.min(maxValue, Number.isFinite(value) ? value : fallback))]
  }))
}

function starterGenderLabel(value) {
  if (value === 'male') return '♂ Đực'
  if (value === 'female') return '♀ Cái'
  if (value === 'unknown') return '◇ Vô giới tính'
  return '🎲 Tự động'
}



const INTRO_STATE_ARRAY_FIELDS = [
  'rel', 'body', 'shops', 'loots', 'npcs', 'facts', 'pokemons', 'levels', 'evolutions',
  'friendships', 'pokemonPatches', 'equipment', 'hunger', 'moves', 'moveDirectives', 'items',
  'badges', 'quests', 'reputations', 'wanted', 'legendaryAccess', 'collectionAwards', 'customEvents', 'dynamicUpdates',
]

function mergeIntroState(base, extra) {
  const out = {
    ...(base ?? {}),
    money: (Number(base?.money) || 0) + (Number(extra?.money) || 0),
    moneyEntries: [...(base?.moneyEntries ?? []), ...(extra?.moneyEntries ?? [])],
    dateAdvance: (Number(base?.dateAdvance) || 0) + (Number(extra?.dateAdvance) || 0),
    training: (Number(base?.training) || 0) + (Number(extra?.training) || 0),
    datePart: extra?.datePart ?? base?.datePart ?? null,
    pokecenter: extra?.pokecenter ?? base?.pokecenter ?? null,
  }
  for (const field of INTRO_STATE_ARRAY_FIELDS) out[field] = [...(base?.[field] ?? []), ...(extra?.[field] ?? [])]
  return out
}


const STEPS = [
  { key: 'mode', label: 'Chế độ' },
  { key: 'profile', label: 'Hồ sơ' },
  { key: 'identity', label: 'Thân phận' },
  // Đợt 61: tính cách + siêu năng lực — chống việc AI mặc định vẽ nhân vật
  // chính thành lạnh lùng/thực dụng.
  { key: 'traits', label: 'Tính cách' },
  { key: 'sandbox', label: 'Sandbox' },
  { key: 'origin', label: 'Xuất thân' },
  // Chế độ đã chọn ở bước đầu; đây chỉ là trang thể loại.
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

export default function IntroScreen({ onOpenSettings }) {
  const {
    apiConfig, character, stylePreset, mainPreset, assistantPrefill,
    setPlayerName, setPlayerMon, setMessages, setGameStarted, setPcBox, setPokedexRecords,
    resetTrainerIdentity, setWorldProgress, setPokemonLife, setTradeState, setDynamicState,
    pokedexSpecies, movesDb, setPlayerLocation, setParty,
    memoryApiConfig, playerIdentity, setPlayerIdentity,
    setPlayerCharacter, storyDate, setStoryDate, worldbook,
    messages,
    storyTone, setStoryTone,
    setPlayerTraits,
    setInventory, setRelationships, setBodyStatus, setHunger, playerProfile, setPlayerProfile,
  } = useGame()

  const [stage, setStage] = useState('title') // 'title' | 'setup'
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const introSeen = typeof window !== 'undefined' && window.sessionStorage.getItem(TITLE_INTRO_SESSION_KEY) === '1'
  const [showMenu, setShowMenu] = useState(introSeen)
  const [showHomage, setShowHomage] = useState(!introSeen)
  const [homageDimmed, setHomageDimmed] = useState(false)
  const [titlePhase, setTitlePhase] = useState(introSeen ? 'settled' : 'intro')
  const titleIntroHideTimerRef = useRef(null)
  const titleIntroSafetyTimerRef = useRef(null)

  const finishTitleIntro = useCallback((options = {}) => {
    const immediate = Boolean(options.immediate)
    if (showMenu && !showHomage) return
    if (typeof window !== 'undefined') {
      if (titleIntroHideTimerRef.current) window.clearTimeout(titleIntroHideTimerRef.current)
      if (titleIntroSafetyTimerRef.current) window.clearTimeout(titleIntroSafetyTimerRef.current)
    }
    setShowMenu(true)
    setHomageDimmed(true)
    setTitlePhase('reveal')
    const delay = immediate ? 150 : 260
    titleIntroHideTimerRef.current = window.setTimeout(() => {
      setShowHomage(false)
      setTitlePhase('settled')
    }, delay)
  }, [showHomage, showMenu])

  useEffect(() => {
    if (stage !== 'title') return undefined
    const seen = typeof window !== 'undefined' && window.sessionStorage.getItem(TITLE_INTRO_SESSION_KEY) === '1'
    if (seen) {
      setShowMenu(true)
      setShowHomage(false)
      setHomageDimmed(false)
      setTitlePhase('settled')
      return undefined
    }
    setShowMenu(false)
    setShowHomage(true)
    setHomageDimmed(false)
    setTitlePhase('intro')
    if (typeof window !== 'undefined') window.sessionStorage.setItem(TITLE_INTRO_SESSION_KEY, '1')
    const jingleTimer = window.setTimeout(() => musicManager.playJingle(['intro']), 120)
    titleIntroSafetyTimerRef.current = window.setTimeout(() => finishTitleIntro(), 11000)
    return () => {
      window.clearTimeout(jingleTimer)
      if (titleIntroHideTimerRef.current) window.clearTimeout(titleIntroHideTimerRef.current)
      if (titleIntroSafetyTimerRef.current) window.clearTimeout(titleIntroSafetyTimerRef.current)
    }
  }, [finishTitleIntro, stage])

  function skipTitleIntro() {
    finishTitleIntro({ immediate: true })
  }

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
  const [originAreaKey, setOriginAreaKey] = useState('pallet')
  const [startDay, setStartDay] = useState(storyDate.day)
  const [startMonth, setStartMonth] = useState(storyDate.month)
  const [startYear, setStartYear] = useState(storyDate.year)
  // Tính cách + siêu năng lực (đợt 61)
  const [personality, setPersonality] = useState([])
  const [superpower, setSuperpower] = useState('none')
  const [customPower, setCustomPower] = useState('')
  // Sandbox: state khởi đầu do người chơi tự chốt. Không dùng AI để suy ra
  // các giá trị này, tránh màn mở đầu kể một đằng HUD ghi một nẻo.
  const [sandboxMoney, setSandboxMoney] = useState('100000')
  const [sandboxStarters, setSandboxStarters] = useState([])
  const [sandboxStarterSpecies, setSandboxStarterSpecies] = useState('')
  const [sandboxStarterLevel, setSandboxStarterLevel] = useState('5')
  const [sandboxStarterFormSpecies, setSandboxStarterFormSpecies] = useState('')
  const [sandboxStarterGender, setSandboxStarterGender] = useState('auto')
  const [sandboxStarterShiny, setSandboxStarterShiny] = useState(false)
  const [sandboxStarterNature, setSandboxStarterNature] = useState('auto')
  const [sandboxStarterAbilitySlot, setSandboxStarterAbilitySlot] = useState('auto')
  const [sandboxStarterTeraType, setSandboxStarterTeraType] = useState('auto')
  const [sandboxStarterSize, setSandboxStarterSize] = useState('auto')
  const [sandboxStarterFriendship, setSandboxStarterFriendship] = useState('')
  const [sandboxStarterHeldItem, setSandboxStarterHeldItem] = useState('')
  const [sandboxStarterNickname, setSandboxStarterNickname] = useState('')
  const [sandboxStarterGmaxFactor, setSandboxStarterGmaxFactor] = useState(false)
  const [sandboxStarterIvMode, setSandboxStarterIvMode] = useState('max')
  const [sandboxStarterIvs, setSandboxStarterIvs] = useState({ ...SANDBOX_DEFAULT_IVS })
  const [sandboxStarterEvMode, setSandboxStarterEvMode] = useState('zero')
  const [sandboxStarterEvs, setSandboxStarterEvs] = useState({ ...SANDBOX_DEFAULT_EVS })
  const [editingSandboxStarterIndex, setEditingSandboxStarterIndex] = useState(null)
  const [sandboxItems, setSandboxItems] = useState([])
  const [sandboxItemId, setSandboxItemId] = useState('pokeball')
  const [sandboxItemQty, setSandboxItemQty] = useState('1')
  const [sandboxItemInfinite, setSandboxItemInfinite] = useState(false)
  // Mở đầu
  const [openingKey, setOpeningKey] = useState('auto')
  const [desiredOpening, setDesiredOpening] = useState('')
  // Preset nhân vật đã lưu (đợt 61)
  const [presets, setPresets] = useState(() => loadCharacterPresets())
  const [presetSaveName, setPresetSaveName] = useState('')

  // Gom toàn bộ thiết lập hiện tại thành 1 object để lưu / nạp.
  function collectSetup() {
    return {
      trainerName, gender, age, appearance,
      avatarUrl: playerProfile.avatarUrl || '',
      playerIdentity, customName, customDesc,
      originRegionKey, originAreaKey,
      personality, superpower, customPower,
      sandboxMoney, sandboxStarters, sandboxItems,
      storyTone,
      openingKey, desiredOpening,
    }
  }

  function applySetup(d) {
    if (!d) return
    setTrainerName(d.trainerName ?? '')
    setGender(d.gender ?? '')
    setAge(d.age ?? '')
    setAppearance(d.appearance ?? '')
    if (d.avatarUrl !== undefined) setPlayerProfile((prof) => ({ ...prof, avatarUrl: d.avatarUrl }))
    if (d.playerIdentity) setPlayerIdentity(d.playerIdentity)
    setCustomName(d.customName ?? '')
    setCustomDesc(d.customDesc ?? '')
    const presetRegionKey = d.originRegionKey || originRegionKey
    if (d.originRegionKey) setOriginRegionKey(d.originRegionKey)
    setOriginAreaKey(d.originAreaKey || getRegion(presetRegionKey)?.areas?.[0]?.key || '')
    setPersonality(d.personality ?? [])
    // Preset có thể mang thể loại cũ nhưng không được đổi CHẾ ĐỘ vừa chọn
    // ở bước đầu — tránh nạp hồ sơ để lách luật Thực tế.
    const incomingTone = d.storyTone ? { ...d.storyTone, difficulty: storyTone.difficulty } : storyTone
    const safeTraits = sanitizeTraitsForMode({ personality: d.personality, superpower: d.superpower, customPower: d.customPower }, incomingTone)
    setSuperpower(safeTraits.superpower)
    setCustomPower(safeTraits.customPower)
    setSandboxMoney(String(d.sandboxMoney ?? '100000'))
    setSandboxStarters(Array.isArray(d.sandboxStarters) ? d.sandboxStarters : [])
    setSandboxItems(Array.isArray(d.sandboxItems) ? d.sandboxItems : [])
    if (d.storyTone) setStoryTone(incomingTone)
    setOpeningKey(d.openingKey ?? 'auto')
    setDesiredOpening(d.desiredOpening ?? '')
  }

  const configured = Boolean(apiConfig.baseUrl && apiConfig.model)
  const originRegion = getRegion(originRegionKey)
  const isCustomIdentity = playerIdentity === 'custom'
  const identity = isCustomIdentity
    ? { name: customName.trim() || 'Thân phận riêng', desc: customDesc.trim() }
    : getIdentityV2(playerIdentity)
  const sandboxMode = normalizeGameMode(storyTone) === 'sandbox'
  const activeSteps = STEPS.filter((entry) => entry.key !== 'sandbox' || sandboxMode)
  const sandboxBaseStarterEntry = pokedexSpecies.find((entry) =>
    entry.name.toLowerCase() === sandboxStarterSpecies.trim().toLowerCase()
    || pokemonId(entry.species) === pokemonId(sandboxStarterSpecies),
  ) ?? null
  const sandboxStarterForms = sandboxFormFamily(sandboxBaseStarterEntry, pokedexSpecies)
  const sandboxEffectiveStarterEntry = (
    sandboxStarterFormSpecies
      ? pokedexSpecies.find((entry) => String(entry.species) === String(sandboxStarterFormSpecies))
      : null
  ) ?? sandboxBaseStarterEntry
  const sandboxStarterAbilityOptions = (() => {
    const own = normalizeAbilityOptions(sandboxEffectiveStarterEntry?.abilities)
    if (own.length) return own
    const base = sandboxEffectiveStarterEntry?.baseSpeciesId
      ? pokedexSpecies.find((entry) => pokemonId(entry.species) === pokemonId(sandboxEffectiveStarterEntry.baseSpeciesId))
      : null
    return normalizeAbilityOptions(base?.abilities)
  })()
  const sandboxStarterGenderOptions = sandboxGenderOptions(sandboxEffectiveStarterEntry)
  const sandboxPreviewMon = sandboxEffectiveStarterEntry ? {
    name: sandboxEffectiveStarterEntry.name,
    species: sandboxEffectiveStarterEntry.species,
    spriteId: sandboxEffectiveStarterEntry.spriteId ?? sandboxEffectiveStarterEntry.species,
    shiny: sandboxStarterShiny,
    gender: sandboxStarterGender === 'auto' ? null : sandboxStarterGender,
  } : null

  function resetSandboxStarterDraft({ keepLevel = true } = {}) {
    setSandboxStarterSpecies('')
    setSandboxStarterFormSpecies('')
    setSandboxStarterGender('auto')
    setSandboxStarterShiny(false)
    setSandboxStarterNature('auto')
    setSandboxStarterAbilitySlot('auto')
    setSandboxStarterTeraType('auto')
    setSandboxStarterSize('auto')
    setSandboxStarterFriendship('')
    setSandboxStarterHeldItem('')
    setSandboxStarterNickname('')
    setSandboxStarterGmaxFactor(false)
    setSandboxStarterIvMode('max')
    setSandboxStarterIvs({ ...SANDBOX_DEFAULT_IVS })
    setSandboxStarterEvMode('zero')
    setSandboxStarterEvs({ ...SANDBOX_DEFAULT_EVS })
    setEditingSandboxStarterIndex(null)
    if (!keepLevel) setSandboxStarterLevel('5')
  }

  function addSandboxStarter() {
    const species = sandboxEffectiveStarterEntry
    if (!species) {
      setError('Không tìm thấy Pokémon/form này trong Pokédex đã tải. Hãy chọn đúng tên trong danh sách gợi ý.')
      return
    }
    const level = Math.max(1, Math.min(100, Math.floor(Number(sandboxStarterLevel) || 1)))
    const allowedGenders = new Set(sandboxStarterGenderOptions.map((option) => option.value))
    const gender = sandboxStarterGender === 'auto' || allowedGenders.has(sandboxStarterGender) ? sandboxStarterGender : 'auto'
    const ivs = sandboxStarterIvMode === 'random'
      ? null
      : sandboxStarterIvMode === 'max'
        ? { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
        : clampSandboxStats(sandboxStarterIvs, 31, 31)
    const evs = sandboxStarterEvMode === 'max'
      ? { hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252 }
      : sandboxStarterEvMode === 'zero'
        ? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
        : clampSandboxStats(sandboxStarterEvs, 252, 0)
    const friendshipNumber = sandboxStarterFriendship === ''
      ? null
      : Math.max(0, Math.min(255, Math.floor(Number(sandboxStarterFriendship) || 0)))
    const starter = {
      species: species.name,
      speciesKey: species.species,
      level,
      gender,
      shiny: Boolean(sandboxStarterShiny),
      nature: sandboxStarterNature,
      abilitySlot: sandboxStarterAbilitySlot,
      abilityName: sandboxStarterAbilitySlot === 'auto'
        ? null
        : (sandboxStarterAbilityOptions.find((ability) => String(ability.slot) === String(sandboxStarterAbilitySlot))?.name ?? null),
      teraType: sandboxStarterTeraType,
      sizeClass: sandboxStarterSize,
      friendship: friendshipNumber,
      heldItemId: sandboxStarterHeldItem || null,
      nickname: sandboxStarterNickname.trim(),
      gmaxFactor: Boolean(sandboxStarterGmaxFactor),
      ivMode: sandboxStarterIvMode,
      ivs,
      evMode: sandboxStarterEvMode,
      evs,
    }
    setSandboxStarters((current) => {
      if (Number.isInteger(editingSandboxStarterIndex) && editingSandboxStarterIndex >= 0 && editingSandboxStarterIndex < current.length) {
        return current.map((entry, index) => index === editingSandboxStarterIndex ? starter : entry)
      }
      return [...current, starter]
    })
    resetSandboxStarterDraft({ keepLevel: true })
    setSandboxStarterLevel(String(level))
    setError(null)
  }

  function editSandboxStarter(index) {
    const starter = sandboxStarters[index]
    if (!starter) return
    const entry = pokedexSpecies.find((candidate) => candidate.species === starter.speciesKey)
      ?? pokedexSpecies.find((candidate) => candidate.name.toLowerCase() === String(starter.species).toLowerCase())
    const base = entry?.baseSpeciesId
      ? pokedexSpecies.find((candidate) => pokemonId(candidate.species) === pokemonId(entry.baseSpeciesId))
      : entry
    setSandboxStarterSpecies(base?.name ?? entry?.name ?? starter.species ?? '')
    setSandboxStarterFormSpecies(entry?.species ?? starter.speciesKey ?? '')
    setSandboxStarterLevel(String(starter.level ?? 5))
    setSandboxStarterGender(starter.gender ?? 'auto')
    setSandboxStarterShiny(Boolean(starter.shiny))
    setSandboxStarterNature(starter.nature ?? 'auto')
    setSandboxStarterAbilitySlot(starter.abilitySlot ?? 'auto')
    setSandboxStarterTeraType(starter.teraType ?? 'auto')
    setSandboxStarterSize(starter.sizeClass ?? 'auto')
    setSandboxStarterFriendship(starter.friendship === null || starter.friendship === undefined ? '' : String(starter.friendship))
    setSandboxStarterHeldItem(starter.heldItemId ?? '')
    setSandboxStarterNickname(starter.nickname ?? '')
    setSandboxStarterGmaxFactor(Boolean(starter.gmaxFactor))
    setSandboxStarterIvMode(starter.ivMode ?? (starter.ivs ? 'custom' : 'random'))
    setSandboxStarterIvs(Object.fromEntries(SANDBOX_STAT_KEYS.map((key) => [key, String(starter.ivs?.[key] ?? 31)])))
    setSandboxStarterEvMode(starter.evMode ?? (starter.evs ? 'custom' : 'zero'))
    setSandboxStarterEvs(Object.fromEntries(SANDBOX_STAT_KEYS.map((key) => [key, String(starter.evs?.[key] ?? 0)])))
    setEditingSandboxStarterIndex(index)
    setError(null)
  }

  function addSandboxItem() {
    const entry = SHOP_ITEMS.find((item) => item.id === sandboxItemId)
    if (!entry) return
    const qty = Math.max(1, Math.min(999999999, Math.floor(Number(sandboxItemQty) || 1)))
    setSandboxItems((current) => [...current, { id: entry.id, name: entry.name, qty, infinite: Boolean(sandboxItemInfinite) }])
    setSandboxItemQty('1')
    setSandboxItemInfinite(false)
  }

  function stepError() {
    // Validate khi bấm Tiếp tục ở từng trang.
    if (activeSteps[step]?.key === 'identity' && isCustomIdentity && !customDesc.trim()) {
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
    setStep((s) => Math.min(s + 1, activeSteps.length - 1))
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
    const originArea = (originAreaKey ? getArea(originRegionKey, originAreaKey) : null)
      ?? originRegion?.areas?.[0]
      ?? null
    const resolvedOriginAreaKey = originArea?.key ?? ''
    setPlayerName(finalName)
    const characterSetup = {
      gender: gender || '',
      age: age || '',
      appearance: appearance.trim(),
      originRegionKey,
      originAreaKey: resolvedOriginAreaKey,
      customIdentity: isCustomIdentity ? { name: identity.name, desc: identity.desc } : null,
    }
    setPlayerCharacter(characterSetup)

    const d = Math.max(1, Math.min(31, Number(startDay) || 1))
    const m = Math.max(1, Math.min(12, Number(startMonth) || 1))
    const y = Math.max(1, Math.min(9999, Number(startYear) || 2000))
    setStoryDate({ day: d, month: m, year: y, part: 'sáng' })

    // Thực tế/Anime vẫn tay trắng; Sandbox dựng state starter trước opening.
    // Đợt 69: lưu tính cách/thiên phú để MỌI LƯỢT sau đều gửi cho AI.
    // Đợt 73: cùng object này được app phân tích thành cơ chế tùy chỉnh thật.
    const traits = sanitizeTraitsForMode({ personality, superpower, customPower, perks: [] }, storyTone)
    setPlayerTraits(traits)
    const journeyTrainerId = resetTrainerIdentity()
    const sandboxOwned = sandboxMode ? sandboxStarters.flatMap((starter, index) => {
      const entry = pokedexSpecies.find((species) => String(species.species) === String(starter.speciesKey))
        ?? pokedexSpecies.find((species) => species.name.toLowerCase() === String(starter.species).toLowerCase())
      if (!entry) return []
      const level = Math.max(1, Math.min(100, Math.floor(Number(starter.level) || 1)))
      const built = normalizeAcquiredMon(buildWildMon(entry, level, movesDb))
      const abilities = (() => {
        const own = normalizeAbilityOptions(entry.abilities)
        if (own.length) return own
        const base = entry.baseSpeciesId
          ? pokedexSpecies.find((candidate) => pokemonId(candidate.species) === pokemonId(entry.baseSpeciesId))
          : null
        return normalizeAbilityOptions(base?.abilities)
      })()
      const chosenAbility = starter.abilitySlot && starter.abilitySlot !== 'auto'
        ? abilities.find((ability) => String(ability.slot) === String(starter.abilitySlot))
        : null
      const allowedGenders = new Set(sandboxGenderOptions(entry).map((option) => option.value))
      const requestedGender = starter.gender && starter.gender !== 'auto' && allowedGenders.has(starter.gender)
        ? starter.gender
        : built.gender
      let customized = {
        ...built,
        shiny: starter.shiny === undefined ? built.shiny : Boolean(starter.shiny),
        gender: requestedGender,
        nature: starter.nature && starter.nature !== 'auto' ? starter.nature : built.nature,
        ivs: starter.ivs ? clampSandboxStats(starter.ivs, 31, 31) : built.ivs,
        evs: starter.evs ? clampSandboxStats(starter.evs, 252, 0) : built.evs,
        teraType: starter.teraType && starter.teraType !== 'auto' ? starter.teraType : built.teraType,
        sizeClass: starter.sizeClass && starter.sizeClass !== 'auto' ? starter.sizeClass : built.sizeClass,
        friendship: Number.isFinite(starter.friendship) ? Math.max(0, Math.min(255, starter.friendship)) : built.friendship,
        heldItem: starter.heldItemId ? normalizeHeldItem(starter.heldItemId) : null,
        nickname: String(starter.nickname ?? '').trim() || undefined,
        gmaxFactor: Boolean(starter.gmaxFactor),
      }
      if (chosenAbility) {
        customized = {
          ...customized,
          ability: chosenAbility.name,
          abilitySlot: chosenAbility.slot,
          abilityHidden: Boolean(chosenAbility.hidden),
        }
      }
      customized = recomputeMonStats(customized)
      customized = { ...customized, hp: customized.maxHp, status: null }
      customized = applyPerksToMon(customized, traits)
      return [ensurePokemonIdentity({
        ...customized,
        acquisitionSourceId: `sandbox-${journeyTrainerId}:starter:${index}:${entry.species ?? entry.name.toLowerCase()}`,
      }, journeyTrainerId)]
    }) : []
    const openingParty = sandboxOwned.slice(0, 6)
    const openingPc = sandboxOwned.slice(6)
    setPlayerMon(openingParty[0] ?? null)
    setParty(openingParty)
    // Sandbox cho phép bao nhiêu starter cũng được; slot 7+ vào PC thay vì
    // phá giới hạn 6 ô chiến đấu của engine. Các mode khác vẫn bắt đầu sạch.
    setPcBox(openingPc)
    setPokedexRecords({})
    setWorldProgress({ ...DEFAULT_WORLD_PROGRESS, wanted: { ...DEFAULT_WORLD_PROGRESS.wanted } })
    setDynamicState({ version: 1, values: {} })
    setPokemonLife({ ...DEFAULT_POKEMON_LIFE })
    setTradeState({ ...DEFAULT_TRADE_STATE })
    clearMemory()
    // Biên niên sử được namespace theo trainer. Không xoá kho của các hành
    // trình cũ đang nằm trong ô save khi bắt đầu một hành trình mới.
    await clearArchive(journeyTrainerId)
    clearNotebook()
    clearSummary()
    resetDirectorState()
    // RESET HÀNH TRÌNH CŨ (đợt 46): trước đây tiền/túi đồ/quan hệ/thương
    // tích/độ no của run trước dính sang run mới (vì đều persist) — hành
    // trình MỚI phải sạch sẽ từ đầu.
    const sandboxOpeningItems = sandboxMode ? sandboxItems.reduce((items, configuredItem) => {
      const entry = SHOP_ITEMS.find((item) => item.id === configuredItem.id) ?? resolveItemByName(configuredItem.name)
      if (!entry) return items
      const qty = Math.max(1, Math.floor(Number(configuredItem.qty) || 1))
      const infinite = Boolean(configuredItem.infinite)
      const at = items.findIndex((item) => item.id === entry.id)
      if (at < 0) items.push({ ...entry, qty, infinite })
      else items[at] = {
        ...entry,
        ...items[at],
        qty: items[at].infinite || infinite ? Math.max(1, Number(items[at].qty) || 1) : (Number(items[at].qty) || 0) + qty,
        infinite: Boolean(items[at].infinite || infinite),
      }
      return items
    }, []) : []
    const openingInventory = syncTraitGrantedItems(sandboxOpeningItems, traits)
    setInventory(openingInventory)
    setRelationships([])
    setBodyStatus({ head: 0, torso: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 })
    setHunger({ player: 100, mon: 100 })
    // Tiền khởi đầu đi theo thân phận. Trước đây mọi người bị ép về 3.000 kể
    // cả “Con cháu đại gia tộc”, khiến thiết lập nhân vật tự mâu thuẫn.
    const ageNum = Number(age) || null
    const startingMoney = sandboxMode
      ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(Number(sandboxMoney) || 0)))
      : startingMoneyForIdentity(playerIdentity, characterSetup)
    const openingProfile = { ...playerProfile, name: finalName, age: ageNum ?? playerProfile.age, money: startingMoney, identityEconomyVersion: 1 }
    setPlayerProfile((prof) => ({ ...prof, ...openingProfile }))

    if (originArea) setPlayerLocation({ regionKey: originRegionKey, areaKey: resolvedOriginAreaKey })

    const opening = OPENINGS.find((o) => o.key === openingKey) ?? null
    const directive = [
      `[Chỉ dẫn hệ thống — không phải lời thoại nhân vật] Hãy viết đoạn MỞ ĐẦU cho câu chuyện.`,
      // Đợt 50: tông truyện do NGƯỜI CHƠI chọn (độ khó + thể loại) thay cho
      // tông REALISTIC hardcode cũ.
      buildToneNote(storyTone),
      `Nhân vật chính (người chơi): ${finalName}${gender ? `, giới tính ${gender}` : ''}${age ? `, ${age} tuổi` : ''}.`,
      appearance.trim() ? `Ngoại hình: ${appearance.trim()}.` : '',
      `Thân phận: ${identity.name} — ${identity.desc} Để thân phận thấm vào bối cảnh một cách TỰ NHIÊN, không kể lể dồn dập.`,
      // Tính cách + siêu năng lực (đợt 61).
      buildCharacterTraitsNote(traits, normalizeGameMode(storyTone)),
      originArea
        ? `VỊ TRÍ MỞ ĐẦU CỐ ĐỊNH: ${originArea.name}, vùng ${originRegion?.name}. Đây là state đã chọn, mở đầu PHẢI diễn ra tại đây; không thay bằng Pallet Town, Kanto hay quê mặc định khác. Chỉ được rời nơi này sau một cảnh di chuyển rõ ràng mà chính văn xác nhận.`
        : `Xuất thân: vùng ${originRegion?.name} (tự chọn một nơi cụ thể hợp thân phận).`,
      `Ngày bắt đầu (lịch trong truyện): ngày ${d}/${m}/năm ${y}, buổi sáng, mùa ${getSeason(m)}.`,
      // Đợt 63: nới luật — trước đây CẤM TUYỆT ĐỐI phát Pokémon ở mở đầu,
      // nên khi cảnh mở màn CHÍNH LÀ đi nhận Pokémon khởi đầu thì AI bị kẹt:
      // đuổi người chơi lên đường mà chưa giới thiệu/trao Pokémon nào (người
      // chơi beta phản ánh). Giờ: mặc định vẫn để dành làm cột mốc, NHƯNG
      // nếu cảnh mở màn xoay quanh việc nhận Pokémon thì phải diễn TRỌN VẸN.
      sandboxMode
        ? `SANDBOX — STATE KHỞI ĐẦU ĐÃ CHỐT TRƯỚC KHI KỂ: tiền=${startingMoney}; Pokémon đã sở hữu=${openingParty.length + openingPc.length ? [...openingParty, ...openingPc].map((mon) => `${mon.nickname ? `${mon.nickname} (${mon.name})` : mon.name} Lv${mon.level}${mon.shiny ? ' ✨' : ''}${mon.gender === 'female' ? ' ♀' : mon.gender === 'male' ? ' ♂' : mon.gender === 'unknown' ? ' ◇' : ''} [Nature ${mon.nature}; Ability ${mon.ability}; Tera ${String(mon.teraType ?? 'auto').toUpperCase()}]`).join(', ') : 'không có'}; vật phẩm=${openingInventory.length ? openingInventory.map((item) => `${item.name} ${item.infinite ? '∞' : `x${item.qty}`}`).join(', ') : 'không có'}. Đây là dữ liệu thật đã nằm trong save: KHÔNG dùng MONEY/ITEM/POKEMON để cấp lại chúng trong mở đầu. Hãy coi chúng là tài sản/cộng sự có sẵn trước cảnh đầu và bắt đầu câu chuyện theo nhịp Anime.`
        : `Người chơi KHỞI ĐẦU TAY TRẮNG — CHƯA có Pokémon nào. Bình thường, việc nhận Pokémon ĐẦU TIÊN nên là một cột mốc có ý nghĩa${ageNum && ageNum < 10 ? ' (nhân vật còn nhỏ tuổi — có thể để muộn hơn nữa, vài chương sau mới nhận)' : ''} đến từ diễn biến tự nhiên, KHÔNG phát vội ngay câu đầu. NHƯNG nếu tình huống mở đầu mà người chơi chọn CHÍNH LÀ cảnh đi nhận Pokémon (đến phòng nghiên cứu, gặp giáo sư, lễ trao Pokémon...) thì hãy diễn cảnh đó TRỌN VẸN và ĐẦY ĐỦ: giới thiệu từng Pokémon khởi đầu có mặt, cho người chơi cơ hội quan sát/tương tác/lựa chọn — TUYỆT ĐỐI không "đuổi" người chơi lên đường khi chưa giới thiệu hay trao Pokémon nào. Khi trao thật, hãy viết rõ trong chính văn rằng Pokémon nào đã thực sự thuộc về người chơi; Semantic State Engine sẽ tự đồng bộ.`,
      opening
        ? `TÌNH HUỐNG MỞ ĐẦU BẮT BUỘC BÁM THEO (đây là mong muốn của người chơi, phải là hạt nhân của đoạn mở đầu): ${opening.seed}`
        : openingKey === 'custom' && desiredOpening.trim()
          ? `TÌNH HUỐNG MỞ ĐẦU BẮT BUỘC BÁM THEO — người chơi tự viết, phải dựng đúng cảnh này làm mở màn (không thay bằng cảnh khác): "${desiredOpening.trim()}"`
          : `Người chơi không chọn tình huống cụ thể — TỰ SÁNG TẠO một khởi đầu hợp thân phận + xuất thân, đời thường và có sức sống.`,
      // Đợt 63: KHÔNG ép số chữ khi người chơi đang dùng preset — preset có
      // luật độ dài riêng, ép thêm ở đây làm chính văn sai yêu cầu preset
      // (người chơi beta báo "số chữ không đúng với preset").
      mainPreset
        ? `Độ dài đoạn mở đầu: TUÂN THEO đúng yêu cầu của preset đang dùng.`
        : `Viết đoạn mở đầu CÓ CHIỀU SÂU, khoảng 400-700 từ (nhiều đoạn văn), giàu chi tiết giác quan và không khí — KHÔNG viết ngắn cụt lủn.`,
      // Đợt 63: trả lại quyền TỰ DO SÁNG TẠO — người chơi phản ánh AI bị gò
      // bó bởi input, chỉ thuật đúng câu lệnh chứ không dựng cảnh sống động.
      `QUYỀN TỰ DO SÁNG TẠO: input của người chơi là HÀNH ĐỘNG của nhân vật chính, KHÔNG phải kịch bản giới hạn. Hãy chủ động dựng thêm chi tiết đời sống quanh hành động đó: NPC đang bận việc riêng của họ, Pokémon quanh cảnh đang làm gì đó theo bản tính, âm thanh/mùi/thời tiết, một sự cố nhỏ chen ngang, một câu chuyện phiếm nghe lỏm... Thế giới phải TIẾP DIỄN dù người chơi có làm gì hay không.`,
      `Bắt đầu thẳng vào câu chuyện, không hỏi lại người chơi. Sau chính văn, tạo khối lựa chọn hành động theo giao thức hệ thống để app hiển thị thành nút; không viết các lựa chọn lẫn vào đoạn truyện.`,
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
        identityContext: buildIdentityContext({
          identityKey: playerIdentity,
          playerCharacter: characterSetup,
          playerName: finalName,
          playerProfile: openingProfile,
          regionName: originRegion?.name,
          areaName: originArea?.name,
        }),
        worldbook,
        toneNote: buildToneNote(storyTone),
        lastUserMessage: directive,
      })
      callOptions.assistantPrefill = assistantPrefill

      const reply = await chatCompletion(apiConfig, apiMessages, callOptions)
      let actionChoices = extractActionChoices(reply)
      const cleaned = cleanAiOutput(reply, regexScripts)
      if (!cleaned) {
        throw new Error('AI chỉ trả về phần suy nghĩ (CoT), chưa kịp viết chính văn. Thử tăng "Max tokens" của preset ở trang Cài đặt API.')
      }
      // Tag cũ chỉ còn là compatibility. Mở đầu cũng dùng Semantic State
      // Engine giống các lượt thường, nếu không model mới viết văn tự nhiên sẽ
      // không còn tag để parser legacy cập nhật state.
      const rawStateTags = extractStateTags(reply).filter((tag) => !cleaned.includes(tag))
      let legacyParsed = parseStoryStateTags(cleaned + (rawStateTags.length ? '\n' + rawStateTags.join('\n') : ''))
      legacyParsed = validateStateAgainstProse(legacyParsed, cleaned, {
        playerName: finalName,
        party: openingParty,
        mode: normalizeGameMode(storyTone),
        adminMode: false,
        inventory: openingInventory,
        location: originArea ? { regionKey: originRegionKey, areaKey: resolvedOriginAreaKey } : null,
      }).parsed
      let parsed = legacyParsed
      try {
        const semantic = await extractSemanticStateEvents(apiConfig, {
          storyText: cleaned,
          userText: directive,
          stateSnapshot: {
            money: startingMoney,
            inventory: openingInventory.map((item) => ({ id: item.id, name: item.name, qty: item.qty, infinite: Boolean(item.infinite) })),
            party: openingParty.map((mon) => ({ uid: mon.uid, name: mon.name, species: mon.species, level: mon.level })),
            pc: openingPc.map((mon) => ({ uid: mon.uid, name: mon.name, species: mon.species, level: mon.level })),
            location: originArea ? { regionKey: originRegionKey, areaKey: resolvedOriginAreaKey } : null,
          },
          appliedState: sandboxMode ? {
            money: startingMoney,
            items: openingInventory.map((item) => ({ name: item.name, qty: item.qty })),
            pokemons: [...openingParty, ...openingPc].map((mon) => ({ species: mon.species ?? mon.name, level: mon.level })),
          } : null,
          mode: normalizeGameMode(storyTone),
          scanMode: 'extractor',
        })
        parsed = mergeIntroState(parsed, semantic.parsed)
      } catch (semanticError) {
        console.warn('[semantic-state:intro] fallback legacy:', semanticError.message)
      }
      const openingText = cleaned
      // Chương mở đầu cũng dùng cùng giao thức trạng thái như các lượt sau.
      // Trước đây tag MONEY/REL/BODY/HUNGER/ITEM/LOOT hợp lệ bị parse rồi bỏ
      // qua, khiến chính văn vừa trao đồ hoặc làm bị thương nhưng HUD vẫn giữ
      // nguyên giá trị khởi tạo.
      applyStoryState(parsed, { setPlayerProfile, setRelationships, setBodyStatus })
      const hungerDelta = (parsed.hunger ?? []).reduce((sum, entry) => {
        sum[entry.who === 'mon' ? 'mon' : 'player'] += Number(entry.delta) || 0
        return sum
      }, { player: 0, mon: 0 })
      if (hungerDelta.player || hungerDelta.mon) {
        setHunger((cur) => ({
          player: Math.max(0, Math.min(100, (Number(cur?.player) || 0) + hungerDelta.player)),
          mon: Math.max(0, Math.min(100, (Number(cur?.mon) || 0) + hungerDelta.mon)),
        }))
      }
      let resolvedOpeningInventory = openingInventory.map((item) => ({ ...item }))
      const mergeOpeningItem = (entry, qty, lootSourceId = '') => {
        if (!entry || !Number.isFinite(Number(qty)) || Number(qty) === 0) return
        const index = resolvedOpeningInventory.findIndex((item) => item.id === entry.id)
        if (Number(qty) > 0) {
          if (index < 0) {
            resolvedOpeningInventory.push({
              ...entry,
              qty: Number(qty),
              ...(lootSourceId ? { lootSourceIds: [lootSourceId] } : {}),
            })
          } else {
            const current = resolvedOpeningInventory[index]
            resolvedOpeningInventory[index] = {
              ...entry,
              ...current,
              qty: current.infinite ? current.qty : (Number(current.qty) || 0) + Number(qty),
              ...(lootSourceId ? { lootSourceIds: [...new Set([...(current.lootSourceIds ?? []), lootSourceId])] } : {}),
            }
          }
          return
        }
        if (index < 0 || resolvedOpeningInventory[index].infinite) return
        const left = Math.max(0, (Number(resolvedOpeningInventory[index].qty) || 0) + Number(qty))
        if (left > 0) resolvedOpeningInventory[index] = { ...resolvedOpeningInventory[index], qty: left }
        else resolvedOpeningInventory.splice(index, 1)
      }
      for (const item of parsed.items ?? []) {
        const entry = resolveInventoryItemByName(item.name, resolvedOpeningInventory)
          ?? resolveItemByName(item.name)
          ?? (Number(item.qty) > 0 ? createCustomItemDescriptor(item.name, item) : null)
        mergeOpeningItem(entry, item.qty)
      }
      for (const [lootIndex, loot] of (parsed.loots ?? []).entries()) {
        const lootSourceId = `intro-${journeyTrainerId}:loot:${lootIndex}`
        for (const item of generateLootItems(loot, lootSourceId)) mergeOpeningItem(item, item.qty, lootSourceId)
      }
      resolvedOpeningInventory = syncTraitGrantedItems(resolvedOpeningInventory, traits)
      setInventory(resolvedOpeningInventory)
      const openingWorldProgress = applyWorldDirectives(DEFAULT_WORLD_PROGRESS, parsed, {
        mode: storyTone, turn: 2, date: { day: d, month: m, year: y, part: 'sáng' },
      })
      setWorldProgress(openingWorldProgress)
      if ((parsed.dynamicUpdates?.length ?? 0) > 0) {
        const dynamicResult = applyDynamicStateUpdates({ version: 1, values: {} }, parsed.dynamicUpdates, { turn: 2, sourceMessageId: `intro-${journeyTrainerId}` })
        setDynamicState(dynamicResult.state)
      }
      for (const npc of parsed.npcs ?? []) upsertNpc(npc.name, npc.fields, 2)
      for (const fact of parsed.facts ?? []) addFact(fact.key, fact.text, 2)
      // Một số preset có regex loại khối lựa chọn khỏi prompt/đầu ra hoặc model
      // quên tuân thủ. Chỉ khi reply chính không có lựa chọn mới gọi thêm một
      // lượt ngắn để màn mở đầu cũng luôn có nút hành động phù hợp chương.
      if (!actionChoices.length && !openingText.includes('[[BATTLE]]')) {
        try {
          actionChoices = await generateActionChoices(apiConfig, {
            recentContext: directive,
            storyText: openingText,
            userText: 'Bắt đầu câu chuyện',
            playerName: finalName,
          })
        } catch (choiceErr) {
          console.warn('[action-choices:intro] bỏ qua:', choiceErr.message)
        }
      }
      setMessages([
        { role: 'user', hidden: true, resultLabel: 'Bắt đầu câu chuyện', content: directive },
        { role: 'assistant', content: openingText, actionChoices },
      ])
      // Nếu chính văn mở đầu trao thêm Pokémon hợp lệ, vẫn tôn trọng tag.
      // Sandbox có thể đã đủ 6 slot từ trước: cá thể thứ 7+ phải vào PC,
      // tuyệt đối không bị mất chỉ vì party đã đầy.
      const resolvedOpeningParty = [...openingParty]
      const resolvedOpeningPc = [...openingPc]
      for (const [pokemonIndex, pk] of (parsed.pokemons ?? []).entries()) {
        const entry = pokedexSpecies.find((sp) => sp.name.toLowerCase() === pk.species.toLowerCase())
        const access = legendaryAccess(entry, openingWorldProgress, storyTone)
        if (entry && access.allowed) {
          const { buildMonSmart } = await import('../data/pokemonSpecies.js')
          // Đợt 70: áp thiên phú cơ chế ngay cho con đầu tiên.
          const buildOwnedMon = normalizeGameMode(storyTone) === 'realistic' ? buildMonSmart : buildWildMon
          let acquired = normalizeAcquiredMon({
            ...buildOwnedMon(entry, pk.level, movesDb),
            ...(pk.gender ? { gender: pk.gender, genderSource: pk.semantic ? 'semantic' : 'story' } : {}),
            ...(pk.shiny !== undefined ? { shiny: Boolean(pk.shiny) } : {}),
            ...(pk.nature ? { nature: pk.nature } : {}),
            ...(pk.ability ? { ability: pk.ability } : {}),
            ...(pk.teraType ? { teraType: String(pk.teraType).toLowerCase() } : {}),
            ...(pk.nickname ? { nickname: pk.nickname } : {}),
            ...(pk.form ? { forme: pk.form } : {}),
            ...(Number.isFinite(Number(pk.friendship)) ? { friendship: Math.max(0, Math.min(255, Number(pk.friendship))) } : {}),
          })
          acquired = recomputeMonStats(acquired)
          const mon = ensurePokemonIdentity({
            ...applyPerksToMon(acquired, traits),
            acquisitionSourceId: `intro-${journeyTrainerId}:pokemon:${pk.species.toLowerCase()}:${pokemonIndex}`,
          }, journeyTrainerId)
          if (resolvedOpeningParty.length < 6) resolvedOpeningParty.push(mon)
          else resolvedOpeningPc.push(mon)
        } else if (entry) {
          console.warn(`[intro] Chặn ${entry.name}: ${access.reason}`)
        }
      }
      setParty(resolvedOpeningParty)
      setPcBox(resolvedOpeningPc)
      setPlayerMon(resolvedOpeningParty[0] ?? null)
      const embCfg = memoryApiConfig?.embedding
      archiveExchange(
        `Mở đầu: ${finalName} (${identity.name}), xuất thân ${originArea?.name ?? originRegion?.name}, ngày ${d}/${m}/${y}.`,
        openingText,
        2,
        1,
        journeyTrainerId,
      ).catch((archiveErr) => console.warn('[archive] ghi mở đầu lỗi (bỏ qua):', archiveErr.message))
      if (embCfg?.baseUrl && embCfg?.model) {
        rememberExchange(
          embCfg,
          `Mở đầu: ${finalName} (${identity.name}), xuất thân ${originArea?.name ?? originRegion?.name}, ngày ${d}/${m}/${y}.`,
          openingText,
          2,
        ).catch((memErr) => console.warn('[memory] ghi ký ức mở đầu lỗi (bỏ qua):', memErr.message))
      }
      // Không suy vị trí mở đầu ngược từ prose: nếu model lỡ nhắc một địa danh
      // khác, state người chơi đã chọn vẫn là nguồn sự thật thay vì bị kéo về Pallet.
      if (originArea) setPlayerLocation({ regionKey: originRegionKey, areaKey: resolvedOriginAreaKey })
      setGameStarted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (stage === 'title') {
    return (
      <div className={`intro-bg ${showMenu ? 'intro-bg--revealed' : ''}`}>
        {showHomage && <RetroBattleIntro active={!homageDimmed} dimmed={homageDimmed} onComplete={finishTitleIntro} />}
        {showHomage && (
          <button className="intro-skip" onClick={skipTitleIntro}>
            Bỏ qua intro
          </button>
        )}
        <div className={`intro-content intro-content--title ${showMenu ? 'is-visible' : 'is-hidden'}`}>
          <div className="intro-stage-card">
            <div>
              <div className="intro-title">TRAINER ARENA</div>
              <p className="intro-subtitle">Thế giới nhập vai của huấn luyện viên Pokémon</p>
            </div>

            <div className="intro-spinner-wrap intro-spinner-wrap--hero">
              <PokeballSpinner
                size={112}
                label={titlePhase === 'intro'
                  ? 'Đang phát intro...'
                  : titlePhase === 'reveal'
                    ? 'Intro vẫn đang chạy — màn hình chính đang hiện ra dần.'
                    : 'Sẵn sàng bắt đầu hành trình.'}
              />
            </div>

            <div className="intro-menu intro-menu--hero">
              {messages.length > 0 && (
                <button className="btn--gold intro-hero-btn intro-hero-btn--gold" onClick={() => setGameStarted(true)}>
                  ▶ Tiếp tục hành trình
                </button>
              )}
              <button className={messages.length > 0 ? 'btn intro-hero-btn' : 'btn--gold intro-hero-btn intro-hero-btn--gold'} onClick={() => { setStage('setup'); setStep(0) }}>
                Bắt đầu một hành trình mới
              </button>
              <div className="intro-actions-inline">
                <button className="btn intro-hero-btn intro-hero-btn--secondary" onClick={onOpenSettings}>
                  Cài đặt API
                </button>
              </div>
            </div>

            <div className="intro-meta-row">
              <span className={`status-pill ${configured ? 'status-pill--ok' : 'status-pill--error'}`}>
                {configured ? 'API đã sẵn sàng' : 'Chưa cấu hình API'}
              </span>
              <span className="status-pill">{messages.length > 0 ? 'Lưu truyện đã sẵn' : 'Màn khởi đầu mới'}</span>
            </div>

            {!configured && <p className="intro-hint">Mẹo: mở “Cài đặt API” trước khi bắt đầu để kiểm tra model và kết nối.</p>}
          </div>
        </div>
      </div>
    )
  }

  const stepKey = activeSteps[step]?.key ?? activeSteps[0].key

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
    <div className="wizard-wrap" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="panel panel--wizard" style={{ width: 'min(720px, 100%)', maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}>
        {/* Thanh tiến trình */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, overflowX: 'auto', paddingBottom: 3 }}>
          {activeSteps.map((s2, i) => (
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
              {i < activeSteps.length - 1 && <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />}
            </React.Fragment>
          ))}
        </div>
        <h2 className="page-title" style={{ marginTop: 8 }}>
          {stepKey === 'mode' && 'Chọn luật vận hành cho cả hành trình'}
          {stepKey === 'profile' && 'Bạn là ai?'}
          {stepKey === 'identity' && 'Thân phận — xuất phát điểm xã hội của bạn'}
          {stepKey === 'traits' && 'Tính cách & năng lực — nhân vật của bạn là người thế nào?'}
          {stepKey === 'sandbox' && 'Sandbox — chốt tài nguyên & Pokémon khởi đầu'}
          {stepKey === 'origin' && 'Quê nhà & thời điểm bắt đầu'}
          {stepKey === 'tone' && 'Thể loại — câu chuyện mang hương vị nào?'}
          {stepKey === 'opening' && 'Câu chuyện bắt đầu thế nào?'}
        </h2>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {/* Chế độ là lựa chọn đầu tiên và là luật dữ liệu, không chỉ giọng văn. */}
          {stepKey === 'mode' && (
            <div>
              <p className="page-subtitle">
                Chế độ quyết định luật dữ liệu, tiến trình và những gì chính văn được phép làm. Lựa chọn này được khoá theo hành trình để save và trao đổi không bị lách luật.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {GAME_MODES.map((mode) => (
                  <button
                    key={mode.key}
                    onClick={() => {
                      setStoryTone((tone) => ({ ...tone, difficulty: mode.key }))
                      if (mode.key === 'realistic' && superpower === 'custom') {
                        setSuperpower('none')
                        setCustomPower('')
                      }
                    }}
                    style={{
                      textAlign: 'left', border: `1px solid ${normalizeGameMode(storyTone) === mode.key ? 'var(--amber)' : 'var(--line)'}`,
                      background: normalizeGameMode(storyTone) === mode.key ? 'var(--bg-deep)' : 'transparent',
                      borderRadius: 12, padding: '14px 16px', cursor: 'pointer', color: 'var(--text-main)',
                    }}
                  >
                    <div style={{ fontWeight: 800, color: normalizeGameMode(storyTone) === mode.key ? 'var(--amber)' : 'var(--text-hi)' }}>{mode.label} · {mode.short}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.6, marginTop: 5 }}>{mode.desc}</div>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: 11, border: '1px dashed var(--line)', borderRadius: 10, color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.65 }}>
                Giao dịch multiplayer thử nghiệm chỉ xuất hiện ở <b style={{ color: 'var(--text-hi)' }}>Thực tế</b>. Anime và Sandbox có thể linh hoạt trong lời kể nhưng không được tạo gói chuyển quyền sở hữu Pokémon.
              </div>
            </div>
          )}

          {/* ===== TRANG 1: HỒ SƠ ===== */}
          {stepKey === 'profile' && (
            <>
              <p className="page-subtitle">
                Điền thông tin cơ bản. Để trống phần nào cũng được — AI sẽ tự lo phần đó. Luật thế giới
                đã được chốt ở bước Chế độ; preset nhân vật bên dưới không thể đổi lựa chọn ấy.
              </p>
              {/* NẠP hồ sơ nhân vật đã lưu (đợt 61) */}
              {presets.length > 0 && (
                <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 8, fontWeight: 700 }}>
                    ⚡ Nạp nhân vật đã lưu
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {presets.map((pr) => (
                      <div key={pr.name} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          className="btn"
                          style={{ flex: 1, textAlign: 'left', fontSize: 12.5 }}
                          onClick={() => { applySetup(pr.data); setError(null) }}
                        >
                          {pr.name}
                        </button>
                        <button
                          className="btn"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                          title="Xoá hồ sơ này"
                          onClick={() => setPresets(deleteCharacterPreset(pr.name))}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Ảnh đại diện (đợt 54): tải từ máy hoặc dán link. */}
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Ảnh đại diện (tuỳ chọn)</label>
                <AvatarPicker
                  value={playerProfile.avatarUrl}
                  onChange={(v) => setPlayerProfile({ ...playerProfile, avatarUrl: v })}
                  fallbackLetter={(trainerName || '?')[0]?.toUpperCase()}
                  size={104}
                />
              </div>

              <div className="grid-resp" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
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
                  {sandboxMode
                    ? 'Sandbox cho phép tự chọn bao nhiêu Pokémon khởi đầu tuỳ thích ở trang Sandbox. Tối đa 6 cá thể vào party; phần còn lại tự vào PC.'
                    : 'Bạn sẽ bắt đầu KHÔNG có Pokémon. Việc nhận Pokémon đầu tiên là một cột mốc trong truyện — chương đầu, hoặc muộn hơn tuỳ tuổi và hoàn cảnh nhân vật.'}
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
                  <div className="grid-resp" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
          {stepKey === 'traits' && (
            <div>
              <p className="page-subtitle">
                Chọn vài nét tính cách để AI khắc hoạ ĐÚNG nhân vật của bạn (không chọn thì AI dễ mặc
                định thành lạnh lùng, thực dụng). Có thể chọn nhiều nét.
              </p>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-mid)', margin: '4px 0 8px' }}>
                Tính cách (chọn bao nhiêu nét tuỳ thích)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PERSONALITY_TRAITS.map((t) => {
                  const on = personality.includes(t.key)
                  return (
                    <button
                      key={t.key}
                      onClick={() => setPersonality((cur) => {
                        if (cur.includes(t.key)) return cur.filter((k) => k !== t.key)
                        return [...cur, t.key]
                      })}
                      style={{
                        border: `1px solid ${on ? 'var(--mint)' : 'var(--line)'}`,
                        color: on ? 'var(--mint)' : 'var(--text-mid)',
                        background: 'transparent', borderRadius: 999, padding: '5px 14px',
                        fontSize: 12.5, cursor: 'pointer',
                      }}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>

              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-mid)', margin: '18px 0 8px' }}>
                Siêu năng lực (tuỳ chọn)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SUPERPOWERS.filter((p2) => normalizeGameMode(storyTone) !== 'realistic' || p2.key !== 'custom').map((p2) => (
                  <button
                    key={p2.key}
                    onClick={() => setSuperpower(p2.key)}
                    style={{
                      border: `1px solid ${superpower === p2.key ? 'var(--amber)' : 'var(--line)'}`,
                      color: superpower === p2.key ? 'var(--amber)' : 'var(--text-mid)',
                      background: 'transparent', borderRadius: 999, padding: '5px 14px',
                      fontSize: 12.5, cursor: 'pointer',
                    }}
                  >
                    {p2.label}
                  </button>
                ))}
              </div>
              {superpower === 'custom' && (
                <textarea
                  className="input"
                  style={{ width: '100%', marginTop: 10, minHeight: 70 }}
                  placeholder={sandboxMode ? 'Mô tả tự do một hoặc nhiều năng lực/cơ chế (có thể rất mạnh). VD: điều khiển thời tiết; toàn đội nhận EXP; vật phẩm X vô hạn...' : 'Mô tả siêu năng lực của bạn (VD: điều khiển thời tiết trong phạm vi nhỏ, nói chuyện với Pokémon hệ Ma...)'}
                  value={customPower}
                  onChange={(e) => setCustomPower(e.target.value)}
                />
              )}
              {superpower === 'custom' && customPower.trim() && (() => {
                const detected = describeCustomMechanicEffects({ superpower, customPower, perks: [] })
                return (
                  <div style={{ marginTop: 8, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 10.5, lineHeight: 1.7 }}>
                    <div style={{ color: 'var(--mint)', fontWeight: 700, marginBottom: 3 }}>⚙ App nhận diện cơ chế:</div>
                    {detected.length > 0 ? detected.map((label) => (
                      <div key={label} style={{ color: 'var(--text-mid)' }}>• {label}</div>
                    )) : (
                      <div style={{ color: 'var(--text-dim)' }}>
                        Chưa thấy hiệu ứng số liệu đủ rõ — đoạn này vẫn ảnh hưởng lời kể. Mẫu dễ nhận: “EXP sau trận ×3”,
                        “Kẹo Hiếm vô hạn”, “cả đội dù không ra trận vẫn nhận EXP”, “Pokémon sở hữu Max IV/EV”.
                      </div>
                    )}
                  </div>
                )
              })()}
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10 }}>
                {sandboxMode
                  ? 'Sandbox không ép trần sức mạnh ở khâu tạo nhân vật. Hãy mô tả rõ cơ chế bạn muốn; sau khi vào truyện, thế giới phản ứng theo nhịp Anime.'
                  : 'Siêu năng lực được thể hiện có chừng mực, có giới hạn và cái giá của nó — không biến nhân vật thành bất khả chiến bại.'}
              </div>

              <div
                style={{
                  marginTop: 16, padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--line)', background: 'rgba(120,200,170,0.04)',
                  fontSize: 11, color: 'var(--text-mid)', lineHeight: 1.7,
                }}
              >
                <strong style={{ color: 'var(--mint)' }}>⚙ Luật năng lực theo chế độ</strong><br />
                {normalizeGameMode(storyTone) === 'realistic'
                  ? 'Thực tế: chỉ chọn đúng một năng lực dựng sẵn (hoặc người thường). Không có ô tự tạo, Max IV/EV, nhân EXP, vật phẩm vô hạn hay cheat.'
                  : sandboxMode
                    ? 'Sandbox: có thể mô tả nhiều năng lực/cơ chế trong ô tự tạo. State khởi đầu được cấu hình ở trang Sandbox; khi vào truyện gameplay dùng luật Anime.'
                    : 'Anime: năng lực tự mô tả có thể tạo cơ chế số liệu nếu viết rõ. Các năng lực dựng sẵn vẫn chủ yếu ảnh hưởng nhập vai.'}
              </div>
            </div>
          )}

          {stepKey === 'sandbox' && (
            <div>
              <p className="page-subtitle">
                Chốt state khởi đầu tự do. Những gì đặt ở đây được ghi thẳng vào save trước khi AI viết mở đầu; sau đó hành trình vận hành như Anime.
              </p>

              <div className="field">
                <label>Tiền khởi đầu</label>
                <input
                  type="number" min="0" step="1" value={sandboxMoney}
                  onChange={(event) => setSandboxMoney(event.target.value)}
                  placeholder="VD: 1000000"
                />
                <small style={{ color: 'var(--text-dim)' }}>Không lấy mức tiền từ thân phận khi ở Sandbox.</small>
              </div>

              <div style={{ marginTop: 16, padding: 12, border: '1px solid var(--line)', borderRadius: 10 }}>
                <div style={{ color: 'var(--amber)', fontWeight: 800, marginBottom: 4 }}>Pokémon Builder · không giới hạn số lượng</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginBottom: 10 }}>
                  Mỗi cá thể được chốt riêng trước khi mở đầu. 6 con đầu vào Party, từ con thứ 7 vào PC. Không để AI random lại thuộc tính đã chọn.
                </div>

                <div className="grid-resp" style={{ display: 'grid', gridTemplateColumns: 'minmax(190px,1.4fr) minmax(170px,1fr) 100px', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Loài</label>
                    <input
                      list="sandbox-pokemon-list"
                      value={sandboxStarterSpecies}
                      onChange={(event) => {
                        setSandboxStarterSpecies(event.target.value)
                        setSandboxStarterFormSpecies('')
                        setSandboxStarterAbilitySlot('auto')
                        setSandboxStarterGender('auto')
                      }}
                      placeholder="VD: Garchomp, Eevee, Giratina"
                    />
                    <datalist id="sandbox-pokemon-list">
                      {pokedexSpecies.map((entry) => <option key={entry.species ?? entry.name} value={entry.name} />)}
                    </datalist>
                  </div>
                  <div>
                    <label style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Hình thái / Form</label>
                    <select
                      value={sandboxEffectiveStarterEntry?.species ?? ''}
                      disabled={!sandboxBaseStarterEntry}
                      onChange={(event) => {
                        setSandboxStarterFormSpecies(event.target.value)
                        setSandboxStarterAbilitySlot('auto')
                        setSandboxStarterGender('auto')
                      }}
                    >
                      {!sandboxBaseStarterEntry && <option value="">Chọn loài trước</option>}
                      {sandboxStarterForms.map((entry) => (
                        <option key={entry.species} value={entry.species}>
                          {entry.forme ? `${entry.forme} · ${entry.name}` : `Mặc định · ${entry.name}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Level</label>
                    <input type="number" min="1" max="100" value={sandboxStarterLevel} onChange={(event) => setSandboxStarterLevel(event.target.value)} title="Level 1-100" />
                  </div>
                </div>

                {sandboxEffectiveStarterEntry && (
                  <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(0,1fr)', gap: 12, alignItems: 'start', marginTop: 12, padding: 10, border: '1px solid var(--line)', borderRadius: 10, background: 'rgba(255,255,255,0.015)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <MonAvatar mon={sandboxPreviewMon} side="enemy" size={82} />
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>{sandboxEffectiveStarterEntry.name}</div>
                    </div>
                    <div style={{ display: 'grid', gap: 9 }}>
                      <div className="grid-resp" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(120px,1fr))', gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Giới tính</label>
                          <select value={sandboxStarterGenderOptions.some((option) => option.value === sandboxStarterGender) ? sandboxStarterGender : sandboxStarterGenderOptions[0]?.value} onChange={(event) => setSandboxStarterGender(event.target.value)}>
                            {sandboxStarterGenderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Nature</label>
                          <select value={sandboxStarterNature} onChange={(event) => setSandboxStarterNature(event.target.value)}>
                            <option value="auto">🎲 Tự động</option>
                            {Object.keys(NATURES).map((nature) => <option key={nature} value={nature}>{nature}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Ability</label>
                          <select value={sandboxStarterAbilitySlot} onChange={(event) => setSandboxStarterAbilitySlot(event.target.value)}>
                            <option value="auto">🎲 Tự động</option>
                            {sandboxStarterAbilityOptions.map((ability) => (
                              <option key={`${ability.slot}-${ability.name}`} value={ability.slot}>{ability.name}{ability.hidden ? ' · Hidden' : ''}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid-resp" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(110px,1fr))', gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Tera Type</label>
                          <select value={sandboxStarterTeraType} onChange={(event) => setSandboxStarterTeraType(event.target.value)}>
                            <option value="auto">🎲 Tự động</option>
                            {ALL_TYPES.map((type) => <option key={type} value={type}>{type.toUpperCase()}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Kích thước</label>
                          <select value={sandboxStarterSize} onChange={(event) => setSandboxStarterSize(event.target.value)}>
                            <option value="auto">🎲 Tự động</option>
                            <option value="tiny">Tiny</option>
                            <option value="average">Average</option>
                            <option value="jumbo">Jumbo</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Friendship 0–255</label>
                          <input type="number" min="0" max="255" value={sandboxStarterFriendship} onChange={(event) => setSandboxStarterFriendship(event.target.value)} placeholder="Auto" />
                        </div>
                        <div>
                          <label style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Nickname</label>
                          <input value={sandboxStarterNickname} onChange={(event) => setSandboxStarterNickname(event.target.value)} placeholder="Không bắt buộc" />
                        </div>
                      </div>

                      <div className="grid-resp" style={{ display: 'grid', gridTemplateColumns: 'minmax(170px,1fr) 1fr', gap: 8, alignItems: 'end' }}>
                        <div>
                          <label style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Held item</label>
                          <select value={sandboxStarterHeldItem} onChange={(event) => setSandboxStarterHeldItem(event.target.value)}>
                            <option value="">Không cầm</option>
                            {HELD_ITEMS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, minHeight: 34, alignItems: 'center' }}>
                          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5, color: 'var(--text-mid)' }}>
                            <input type="checkbox" checked={sandboxStarterShiny} onChange={(event) => setSandboxStarterShiny(event.target.checked)} /> ✨ Shiny
                          </label>
                          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5, color: 'var(--text-mid)' }} title="Cho phép dùng forme Gigantamax khi loài có Gmax và trận cho phép Dynamax.">
                            <input type="checkbox" checked={sandboxStarterGmaxFactor} onChange={(event) => setSandboxStarterGmaxFactor(event.target.checked)} /> G-Max Factor
                          </label>
                        </div>
                      </div>

                      <div style={{ padding: 9, border: '1px solid var(--line)', borderRadius: 8 }}>
                        <div className="grid-resp" style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr)', gap: 10, alignItems: 'start' }}>
                          <div>
                            <label style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>IV</label>
                            <select value={sandboxStarterIvMode} onChange={(event) => setSandboxStarterIvMode(event.target.value)}>
                              <option value="random">🎲 Random 0–31</option>
                              <option value="max">31 tất cả</option>
                              <option value="custom">Tự nhập</option>
                            </select>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(38px,1fr))', gap: 5 }}>
                            {SANDBOX_STAT_KEYS.map((key) => (
                              <label key={`iv-${key}`} style={{ fontSize: 9.5, color: 'var(--text-dim)', textAlign: 'center' }}>
                                {SANDBOX_STAT_LABELS[key]}
                                <input
                                  type="number" min="0" max="31"
                                  disabled={sandboxStarterIvMode !== 'custom'}
                                  value={sandboxStarterIvMode === 'max' ? '31' : sandboxStarterIvMode === 'random' ? '' : sandboxStarterIvs[key]}
                                  placeholder={sandboxStarterIvMode === 'random' ? '🎲' : '31'}
                                  onChange={(event) => setSandboxStarterIvs((current) => ({ ...current, [key]: event.target.value }))}
                                  style={{ padding: '6px 3px', textAlign: 'center' }}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="grid-resp" style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr)', gap: 10, alignItems: 'start', marginTop: 8 }}>
                          <div>
                            <label style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>EV</label>
                            <select value={sandboxStarterEvMode} onChange={(event) => setSandboxStarterEvMode(event.target.value)}>
                              <option value="zero">0 tất cả</option>
                              <option value="max">252 tất cả · Sandbox</option>
                              <option value="custom">Tự nhập</option>
                            </select>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(38px,1fr))', gap: 5 }}>
                            {SANDBOX_STAT_KEYS.map((key) => (
                              <label key={`ev-${key}`} style={{ fontSize: 9.5, color: 'var(--text-dim)', textAlign: 'center' }}>
                                {SANDBOX_STAT_LABELS[key]}
                                <input
                                  type="number" min="0" max="252"
                                  disabled={sandboxStarterEvMode !== 'custom'}
                                  value={sandboxStarterEvMode === 'max' ? '252' : sandboxStarterEvMode === 'zero' ? '0' : sandboxStarterEvs[key]}
                                  onChange={(event) => setSandboxStarterEvs((current) => ({ ...current, [key]: event.target.value }))}
                                  style={{ padding: '6px 3px', textAlign: 'center' }}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                        <div style={{ fontSize: 9.8, color: 'var(--text-dim)', marginTop: 6 }}>
                          Sandbox cho phép preset EV 252 ở cả 6 chỉ số để tạo cá thể siêu mạnh. Gameplay sau đó vẫn chạy bằng công thức battle hiện tại.
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
                        {editingSandboxStarterIndex !== null && (
                          <button className="btn" type="button" onClick={() => resetSandboxStarterDraft({ keepLevel: true })}>Huỷ sửa</button>
                        )}
                        <button className="btn btn--primary" type="button" onClick={addSandboxStarter}>
                          {editingSandboxStarterIndex !== null ? '✓ Lưu Pokémon' : '+ Thêm Pokémon'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {!sandboxEffectiveStarterEntry && (
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 7 }}>
                    Chọn đúng tên Pokémon để mở toàn bộ tuỳ chỉnh giới tính, form, Shiny, Nature, Ability, IV/EV và các thuộc tính cá thể.
                  </div>
                )}

                {sandboxStarters.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                    {sandboxStarters.map((entry, index) => (
                      <div key={`${entry.speciesKey ?? entry.species}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', padding: '8px 9px', border: `1px solid ${editingSandboxStarterIndex === index ? 'var(--amber)' : 'var(--line)'}`, borderRadius: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: 'var(--text-hi)', fontSize: 12, fontWeight: 700 }}>
                            {index < 6 ? `Party ${index + 1}` : `PC ${index - 5}`} · {entry.shiny ? '✨ ' : ''}{entry.nickname ? `${entry.nickname} (${entry.species})` : entry.species} · Lv.{entry.level} · {starterGenderLabel(entry.gender)}
                          </div>
                          <div style={{ fontSize: 9.8, color: 'var(--text-dim)', marginTop: 2 }}>
                            Nature {entry.nature === 'auto' ? 'Auto' : entry.nature} · Ability {entry.abilityName ?? (entry.abilitySlot === 'auto' ? 'Auto' : `slot ${entry.abilitySlot}`)} · Tera {entry.teraType === 'auto' ? 'Auto' : String(entry.teraType).toUpperCase()} · IV {entry.ivMode === 'random' ? 'Random' : entry.ivMode === 'max' ? '31×6' : 'Custom'} · EV {entry.evMode === 'max' ? '252×6' : entry.evMode === 'zero' ? '0' : 'Custom'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                          <button className="btn" type="button" onClick={() => editSandboxStarter(index)}>Sửa</button>
                          <button className="btn" type="button" onClick={() => {
                            setSandboxStarters((current) => current.filter((_, at) => at !== index))
                            if (editingSandboxStarterIndex === index) resetSandboxStarterDraft({ keepLevel: true })
                            else if (editingSandboxStarterIndex !== null && editingSandboxStarterIndex > index) setEditingSandboxStarterIndex(editingSandboxStarterIndex - 1)
                          }}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16, padding: 12, border: '1px solid var(--line)', borderRadius: 10 }}>
                <div style={{ color: 'var(--mint)', fontWeight: 800, marginBottom: 8 }}>Vật phẩm khởi đầu</div>
                <div className="grid-resp" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) 100px auto auto', gap: 8, alignItems: 'center' }}>
                  <select value={sandboxItemId} onChange={(event) => setSandboxItemId(event.target.value)}>
                    {SHOP_ITEMS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <input type="number" min="1" value={sandboxItemQty} onChange={(event) => setSandboxItemQty(event.target.value)} />
                  <label style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11.5, color: 'var(--text-mid)' }}>
                    <input type="checkbox" checked={sandboxItemInfinite} onChange={(event) => setSandboxItemInfinite(event.target.checked)} /> ∞
                  </label>
                  <button className="btn" type="button" onClick={addSandboxItem}>+ Thêm</button>
                </div>
                {sandboxItems.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {sandboxItems.map((entry, index) => (
                      <button key={`${entry.id}-${index}`} className="btn" type="button" title="Bấm để xoá" onClick={() => setSandboxItems((current) => current.filter((_, at) => at !== index))}>
                        {entry.name} {entry.infinite ? '∞' : `x${entry.qty}`} ×
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {stepKey === 'origin' && (
            <>
              <p className="page-subtitle">
                Quê nhà định hình giọng nói, mối quan hệ đầu đời — và tổ chức phản diện nào lảng vảng
                trong tin tức địa phương. Mỗi vùng một khí chất riêng.
              </p>
              <div className="grid-resp" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                {REGIONS.map((r) => (
                  <PickCard
                    key={r.key}
                    compact
                    selected={originRegionKey === r.key}
                    title={`${r.name} (Gen ${r.gen})`}
                    desc={REGION_BLURBS[r.key]}
                    onClick={() => { setOriginRegionKey(r.key); setOriginAreaKey(r.areas?.[0]?.key ?? '') }}
                  />
                ))}
              </div>
              <div className="field">
                <label>Thành phố / khu xuất thân trong {originRegion?.name}</label>
                <select value={originAreaKey} onChange={(e2) => setOriginAreaKey(e2.target.value)}>
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
              <div style={{ padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 9, color: 'var(--text-mid)', fontSize: 11.5 }}>
                Chế độ đã chọn: <b style={{ color: 'var(--amber)' }}>{GAME_MODES.find((m) => m.key === normalizeGameMode(storyTone))?.label}</b>. Bước này chỉ chọn thể loại; không thay luật dữ liệu.
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-mid)', marginBottom: 8 }}>
                  Tag văn phong (chọn tự do — có thể phối nhiều tag)
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
                  Đã chọn {storyTone.genres?.length ?? 0}/{GENRES.length}. Có thể chọn bao nhiêu tag tuỳ thích; AI sẽ phối chúng như gia vị văn phong. Luật chế độ đã được chọn từ bước đầu.
                </div>
              </div>
            </div>
          )}

          {stepKey === 'opening' && (
            <>
              <p className="page-subtitle">Chọn cách câu chuyện mở màn — mỗi lựa chọn có mô tả đầy đủ bên dưới.</p>
              <div className="grid-resp" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
                  Chế độ: <b style={{ color: 'var(--amber)' }}>{GAME_MODES.find((m) => m.key === normalizeGameMode(storyTone))?.label}</b>
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

        {/* LƯU hồ sơ nhân vật (đợt 61) — hiện ở trang cuối để lần sau chơi lại
            không phải setup từ đầu. */}
        {step === activeSteps.length - 1 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="input"
              style={{ flex: 1, minWidth: 160 }}
              placeholder="Đặt tên để lưu nhân vật này…"
              value={presetSaveName}
              onChange={(e) => setPresetSaveName(e.target.value)}
            />
            <button
              className="btn"
              disabled={loading}
              onClick={() => {
                const nm = presetSaveName.trim() || trainerName.trim() || 'Nhân vật'
                setPresets(saveCharacterPreset(nm, collectSetup()))
                setPresetSaveName('')
                setError(null)
              }}
            >
              💾 Lưu nhân vật
            </button>
          </div>
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
          {step < activeSteps.length - 1 ? (
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
