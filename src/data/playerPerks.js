// ============ THIÊN PHÚ CÓ TÁC ĐỘNG CƠ CHẾ (đợt 70, mở rộng đợt 73) ============
//
// Đợt 70 thêm 3 perk dựng sẵn. Tester đợt 73 tiếp tục báo đúng một khoảng
// trống: ô "Tự mô tả" cho phép người chơi viết luật riêng (VD EXP sau trận
// ×3, Rare Candy vô hạn, cả đội cùng nhận EXP), nhưng app chỉ gửi đoạn chữ
// đó cho AI kể — battle engine và túi đồ không đọc nó. Vì vậy lời kể đúng mà
// biến vẫn đứng yên.
//
// Đợt 73 thêm một bộ phân tích DETERMINISTIC cho các hiệu ứng đo được thường
// gặp. Không giao quyền sửa số liệu cho model; app tự đọc câu chữ của người
// chơi và biến thành cấu hình cơ chế. Câu không nhận diện được vẫn giữ tác
// dụng roleplay như cũ, còn HUD/bảng sửa sẽ báo rõ những hiệu ứng đã bắt được.

import { recomputeMonStats, zeroEVs } from './pokemonSpecies.js'

const EV_STAT_CAP = 252
const EV_TOTAL_CAP = 510
const MAX_CUSTOM_MULTIPLIER = 100

export const MECHANIC_PERKS = []

// Đợt 74: bỏ toàn bộ thiên phú cheat dựng sẵn. Các hiệu ứng có tác động
// số liệu (Max IV/EV, nhân EXP, Kẹo Hiếm vô hạn, cộng tỉ lệ bắt...) chỉ
// được phép bật khi người chơi chủ động chọn "Tự mô tả…" và viết rõ luật
// trong customPower. Save cũ còn mảng perks vẫn đọc được nhưng mảng đó vô hiệu.

export function getPerk(key) {
  return MECHANIC_PERKS.find((p) => p.key === key) ?? null
}

export function hasPerk(perks, key) {
  return Array.isArray(perks) && perks.includes(key)
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function traitsFrom(source) {
  if (Array.isArray(source)) return { perks: source, superpower: 'none', customPower: '' }
  return source && typeof source === 'object'
    ? {
        perks: Array.isArray(source.perks) ? source.perks : [],
        superpower: source.superpower ?? 'none',
        customPower: source.customPower ?? '',
      }
    : { perks: [], superpower: 'none', customPower: '' }
}

function customTextFrom(source) {
  if (typeof source === 'string') return source
  const traits = traitsFrom(source)
  return traits.superpower === 'custom' ? traits.customPower : ''
}

function clampMultiplier(value) {
  const n = Number(String(value ?? '').replace(',', '.'))
  if (!Number.isFinite(n) || n <= 1) return 1
  return Math.max(1, Math.min(MAX_CUSTOM_MULTIPLIER, n))
}

/**
 * Tìm hệ số EXP quanh từng lần xuất hiện chữ EXP/kinh nghiệm. Cách dùng cửa
 * sổ ngữ cảnh thay vì một regex khổng lồ giúp bắt được cả kiểu viết đời thường:
 * "EXP Pokémon nhận được sau trận đấu sẽ nhận 3 lần so với bình thường".
 */
function findExpMultipliers(text) {
  const found = { battle: 1, training: 1, generic: 1 }
  const expRe = /(?:\bexp\b|kinh nghiem)/g
  for (const match of text.matchAll(expRe)) {
    const at = match.index ?? 0
    const window = text.slice(Math.max(0, at - 120), Math.min(text.length, at + 190))
    const after = window.match(/(?:[x×]\s*|gap\s*|nhan(?:\s+duoc)?\s*|tang(?:\s+them)?\s*)(\d+(?:[.,]\d+)?)\s*(?:lan)?/)
    const before = window.match(/(\d+(?:[.,]\d+)?)\s*(?:lan\s*)?(?:[x×]\s*)?(?=(?:exp|kinh nghiem))/)
    const multiplier = clampMultiplier(after?.[1] ?? before?.[1])
    if (multiplier <= 1) continue

    const isBattle = /tran dau|chien dau|sau tran|thang tran|battle|ha doi thu|danh bai/.test(window)
    const isTraining = /luyen tap|huan luyen|tap luyen|time skip|ngay troi|thoi gian troi/.test(window)
    if (isBattle) found.battle = Math.max(found.battle, multiplier)
    else if (isTraining) found.training = Math.max(found.training, multiplier)
    else found.generic = Math.max(found.generic, multiplier)
  }
  return found
}

/**
 * Phân tích phần năng lực TỰ MÔ TẢ thành các hiệu ứng số liệu mà app hỗ trợ.
 * Đây không phải AI và không đoán ý mơ hồ: chỉ những mẫu chữ đủ rõ mới bật.
 */
export function parseCustomMechanicEffects(source) {
  const raw = customTextFrom(source)
  const text = normalizeText(raw)
  const exp = findExpMultipliers(text)

  const hasIv = /\biv\b/.test(text)
  const hasEv = /\bev\b/.test(text)
  const maxWords = /\bmax\b|toi da|kich tran|full chi so|hoan hao/.test(text)
  const maxIvEv = Boolean(text && hasIv && hasEv && maxWords)

  const rareAt = Math.max(text.indexOf('rare candy'), text.indexOf('keo hiem'))
  const infiniteAt = Math.max(text.indexOf('vo han'), text.indexOf('khong gioi han'), text.indexOf('infinite'))
  const infiniteRareCandy = rareAt >= 0 && infiniteAt >= 0 && Math.abs(rareAt - infiniteAt) <= 100

  const allPartyBattleExp = Boolean(
    text && (
      /(?:ca doi|toan doi|pokemon khac|pokemon du bi|khong ra tran|khong tham gia tran)[\s\S]{0,140}(?:exp|kinh nghiem)/.test(text)
      || /(?:exp|kinh nghiem)[\s\S]{0,140}(?:ca doi|toan doi|pokemon khac|pokemon du bi|khong ra tran)/.test(text)
    )
  )

  let customCatchBonus = 0
  const catchWindows = []
  for (const m of text.matchAll(/(?:ti le bat|bat pokemon|capture|catch)/g)) {
    const at = m.index ?? 0
    catchWindows.push(text.slice(Math.max(0, at - 60), Math.min(text.length, at + 110)))
  }
  for (const window of catchWindows) {
    const pct = window.match(/(?:\+|tang(?:\s+them)?\s*)(\d+(?:[.,]\d+)?)\s*%/)
    if (pct) customCatchBonus = Math.max(customCatchBonus, Number(String(pct[1]).replace(',', '.')) || 0)
  }
  customCatchBonus = Math.max(0, Math.min(92, customCatchBonus))

  const genericExp = exp.generic
  return {
    maxIvEv,
    battleExpMultiplier: Math.max(exp.battle, genericExp),
    trainingExpMultiplier: Math.max(exp.training, genericExp),
    allPartyBattleExp,
    infiniteRareCandy,
    catchRateBonus: customCatchBonus,
  }
}

/** Gộp perk dựng sẵn + luật tự mô tả thành một cấu hình duy nhất. */
export function resolveMechanicEffects(source) {
  // CHỈ phần siêu năng lực TỰ MÔ TẢ mới được bật cơ chế số liệu.
  // `parseCustomMechanicEffects` tự trả cấu hình rỗng khi superpower !== custom.
  const custom = parseCustomMechanicEffects(source)
  return {
    maxIvEv: custom.maxIvEv,
    battleExpMultiplier: custom.battleExpMultiplier,
    trainingExpMultiplier: custom.trainingExpMultiplier,
    allPartyBattleExp: custom.allPartyBattleExp,
    infiniteRareCandy: custom.infiniteRareCandy,
    catchRateBonus: custom.catchRateBonus,
    custom,
  }
}

/** Chuỗi ngắn để HUD/bảng sửa cho người chơi thấy app đã nhận diện gì. */
export function describeCustomMechanicEffects(source) {
  const effects = parseCustomMechanicEffects(source)
  const out = []
  if (effects.maxIvEv) out.push('Max IV/EV cho Pokémon sở hữu')
  if (effects.battleExpMultiplier > 1) out.push(`EXP sau trận ×${effects.battleExpMultiplier}`)
  if (effects.trainingExpMultiplier > 1) out.push(`EXP luyện tập/thời gian ×${effects.trainingExpMultiplier}`)
  if (effects.allPartyBattleExp) out.push('Cả đội cùng nhận EXP sau trận')
  if (effects.infiniteRareCandy) out.push('Kẹo Hiếm vô hạn')
  if (effects.catchRateBonus > 0) out.push(`Tỉ lệ bắt +${effects.catchRateBonus}%`)
  return out
}

/** Note riêng cho model: app đã tự xử lý số liệu, model chỉ cần kể khớp. */
export function buildCustomMechanicNote(source) {
  const effects = parseCustomMechanicEffects(source)
  const labels = describeCustomMechanicEffects(source)
  if (labels.length === 0) return null
  const rules = [
    `CƠ CHẾ TÙY CHỈNH APP ĐÃ NHẬN DIỆN VÀ TỰ ÁP: ${labels.join('; ')}.`,
    'Không tự cộng hiệu ứng lần thứ hai bằng cách bịa thêm EXP/vật phẩm ngoài kết quả mà app đã tính.',
  ]
  if (effects.infiniteRareCandy) {
    rules.push('Kẹo Hiếm là vô hạn trong túi. Khi nhân vật cho một Pokémon ăn, hãy viết rõ trong CHÍNH VĂN rằng Pokémon đó đã lên cấp; Semantic State Engine sẽ tự cập nhật level và không trừ Kẹo Hiếm vô hạn.')
  }
  if (effects.battleExpMultiplier > 1 || effects.allPartyBattleExp) {
    rules.push('EXP sau trận được battle engine tính tự động; chỉ kể đúng kết quả hệ thống cung cấp, không tự cộng thêm cấp sau một trận thường.')
  }
  return rules.join(' ')
}

/**
 * Dồn EV kịch trần theo 3 chỉ số BASE mạnh nhất của loài: 252 / 252 / 6.
 * Đúng luật game gốc (mỗi chỉ số ≤ 252, tổng ≤ 510) nên không phá cân bằng
 * công thức — chỉ là bản build tối ưu mà người chơi hardcore vẫn tự nuôi được.
 */
function maxEvsFor(baseStats) {
  const evs = zeroEVs()
  if (!baseStats) return evs
  const order = Object.entries(baseStats)
    .filter(([k]) => k in evs)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
  let left = EV_TOTAL_CAP
  for (const stat of order) {
    if (left <= 0) break
    const grant = Math.min(EV_STAT_CAP, left)
    evs[stat] = grant
    left -= grant
  }
  return evs
}

// Đợt 74: đợt 73 từng ghi đè IV/EV rồi chỉ lưu cờ `perkMark`, không lưu bản
// gốc. Khi bỏ thiên phú dựng sẵn, để cheat không tồn tại vĩnh viễn trong save
// cũ, cá thể có đúng cờ này sẽ được trả về một bộ IV hợp lệ, ổn định theo uid
// và EV = 0. Dùng seed cố định để reload không reroll chỉ số liên tục.
function seededLegacyIvs(mon) {
  const key = `${mon?.uid ?? ''}|${mon?.name ?? ''}|${mon?.species ?? ''}|${mon?.level ?? 1}|legacy-perk`
  let seed = 2166136261
  for (let i = 0; i < key.length; i++) {
    seed ^= key.charCodeAt(i)
    seed = Math.imul(seed, 16777619)
  }
  const next = () => {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822519)
    seed = Math.imul(seed ^ (seed >>> 13), 3266489917)
    seed ^= seed >>> 16
    return seed >>> 0
  }
  const roll = () => next() % 32
  return { hp: roll(), atk: roll(), def: roll(), spa: roll(), spd: roll(), spe: roll() }
}

/**
 * Gỡ riêng boost Max IV/EV do thiên phú dựng sẵn cũ từng áp.
 * - Có năng lực TỰ MÔ TẢ Max IV/EV hiện tại → giữ/áp max như bình thường.
 * - Không có → bỏ `perkMark`, trả IV về bộ hợp lệ cố định và EV về 0.
 * Pokémon không mang cờ perk cũ tuyệt đối không bị đụng tới.
 */
export function normalizeLegacyPerkBoost(mon, source) {
  if (!mon || mon.perkMark !== 'maxIvEv') return mon
  if (resolveMechanicEffects(source).maxIvEv) return applyPerksToMon(mon, source)

  const restored = {
    ...mon,
    ivs: seededLegacyIvs(mon),
    evs: zeroEVs(),
  }
  delete restored.perkMark
  return recomputeMonStats(restored)
}

/**
 * Áp toàn bộ perk cơ chế lên MỘT Pokémon vừa vào đội hình.
 * Trả về bản mới (không sửa mon gốc). Không có perk nào → trả nguyên mon.
 * `source` nhận cả mảng perks cũ lẫn object playerTraits mới để save cũ và
 * test cũ không vỡ.
 */
export function applyPerksToMon(mon, source) {
  if (!mon || !resolveMechanicEffects(source).maxIvEv) return mon
  const maxed = {
    ...mon,
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    evs: maxEvsFor(mon.baseStats),
    perkMark: 'maxIvEv', // để PokemonInfoModal ghi chú "IV/EV tối đa nhờ thiên phú"
  }
  // Mon không có baseStats (fallback 151 loài tĩnh khi chưa tải được pokedex)
  // thì recomputeMonStats trả về nguyên bản — vẫn an toàn, chỉ là không đổi số.
  return recomputeMonStats(maxed)
}

/** Áp cho cả một danh sách (đội hình). */
export function applyPerksToParty(party, source) {
  if (!Array.isArray(party) || !resolveMechanicEffects(source).maxIvEv) return party
  return party.map((m) => applyPerksToMon(m, source))
}

/** Hệ số nhân EXP từ luyện tập / ngày trôi. */
export function trainingExpMultiplier(source) {
  return resolveMechanicEffects(source).trainingExpMultiplier
}

/** Hệ số nhân EXP do battle engine trao sau trận. */
export function battleExpMultiplier(source) {
  return resolveMechanicEffects(source).battleExpMultiplier
}

/** Năng lực tự viết có cho toàn đội cùng nhận EXP sau trận không. */
export function sharesBattleExpWithParty(source) {
  return resolveMechanicEffects(source).allPartyBattleExp
}

/** Cộng thẳng vào tỉ lệ bắt (đơn vị: phần trăm tuyệt đối). */
export function catchRateBonus(source) {
  return resolveMechanicEffects(source).catchRateBonus
}

/** Kẹo Hiếm vô hạn do năng lực tự mô tả. */
export function hasInfiniteRareCandy(source) {
  return resolveMechanicEffects(source).infiniteRareCandy
}

/**
 * Đồng bộ vật phẩm được năng lực tự mô tả cấp trực tiếp. Kẹo vô hạn dùng cờ
 * `infinite` thay vì qty rất lớn để không tràn số và để UI hiện x∞. Khi người
 * chơi bỏ năng lực, bỏ cờ vô hạn nhưng giữ 1 viên — không âm thầm nuốt vật
 * phẩm đang nằm trong túi.
 */
export function syncTraitGrantedItems(inventory, source) {
  const next = [...(inventory ?? [])]
  const at = next.findIndex((it) => it.id === 'rarecandy')
  if (hasInfiniteRareCandy(source)) {
    if (at === -1) next.push({ id: 'rarecandy', name: 'Kẹo Hiếm', qty: 1, infinite: true, traitGranted: true })
    else next[at] = { ...next[at], qty: Math.max(1, next[at].qty ?? 1), infinite: true, traitGranted: true }
  } else if (at >= 0 && next[at].infinite) {
    const finite = { ...next[at] }
    delete finite.infinite
    delete finite.traitGranted
    next[at] = { ...finite, qty: Math.max(1, finite.qty ?? 1) }
  }
  return next
}

/** Note mô tả các perk dựng sẵn đang bật, chèn vào prompt mỗi lượt. */
export function buildPerksNote() {
  // Giữ export để save/code cũ không vỡ, nhưng thiên phú dựng sẵn đã bị xoá.
  return null
}
