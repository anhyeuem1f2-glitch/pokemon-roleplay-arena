// Giới tính cá thể dùng dữ liệu loài chuẩn (cùng tỉ lệ được Pokémon Database
// công bố). Pokédex runtime truyền `gender` M/F/N hoặc `genderRatio` M/F.
// Save cũ được bốc bằng seed ổn định để cùng một uid không đổi giới tính giữa
// playerMon, đội hình, PC và snapshot chiến đấu trong lúc migration.

export const GENDER_DATA_VERSION = 2

export function normalizePokemonGender(value) {
  const key = String(value ?? '').trim().toLowerCase()
  if (['male', 'm', 'đực', 'duc', '♂'].includes(key)) return 'male'
  if (['female', 'f', 'cái', 'cai', '♀'].includes(key)) return 'female'
  if (['unknown', 'genderless', 'none', 'n', 'vô giới tính', 'vo gioi tinh', '—', '◇'].includes(key)) return 'unknown'
  return null
}

export function genderSymbol(value) {
  const gender = normalizePokemonGender(value)
  if (gender === 'male') return '♂'
  if (gender === 'female') return '♀'
  if (gender === 'unknown') return '◇'
  return '?'
}

export function genderLabel(value) {
  const gender = normalizePokemonGender(value)
  if (gender === 'male') return 'Đực'
  if (gender === 'female') return 'Cái'
  if (gender === 'unknown') return 'Vô giới tính'
  return 'Chưa xác định'
}

function normalizedRatio(speciesEntry) {
  if (!speciesEntry) return null
  const fixed = String(speciesEntry?.gender ?? '').toUpperCase()
  if (fixed === 'M') return { M: 1, F: 0 }
  if (fixed === 'F') return { M: 0, F: 1 }
  if (fixed === 'N') return { M: 0, F: 0 }

  const male = Number(speciesEntry?.genderRatio?.M)
  const female = Number(speciesEntry?.genderRatio?.F)
  // Trong Pokédex nguồn, 50/50 là mặc định nên nhiều loài không ghi field
  // genderRatio. Có entry loài nhưng thiếu field phải hiểu là 0.5/0.5; chỉ
  // khi hoàn toàn chưa tìm thấy entry mới được xem là chưa có dữ liệu.
  if (!Number.isFinite(male) && !Number.isFinite(female)) return { M: 0.5, F: 0.5 }
  const m = Number.isFinite(male) ? Math.max(0, male) : Math.max(0, 1 - female)
  const f = Number.isFinite(female) ? Math.max(0, female) : Math.max(0, 1 - male)
  const total = m + f
  if (total <= 0) return { M: 0, F: 0 }
  return { M: m / total, F: f / total }
}

export function genderRatioForSpecies(speciesEntry) {
  return normalizedRatio(speciesEntry)
}

function foldStory(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/đ/g, 'd')
    .replace(/[^a-z0-9♂♀]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Tìm evidence giới tính trong CHÍNH VĂN. Quét từ cuối về đầu để nếu cùng
 * một lượt có thông tin cũ rồi được sửa/khẳng định lại, câu mới nhất thắng.
 * Chỉ xét câu chứa đúng target và câu liền sau để đại từ của NPC khác không
 * vô tình đổi giới tính Pokémon của người chơi.
 */
function findPokemonGenderEvidence(storyText, target) {
  if (!storyText || !target) return null
  const targetKey = foldStory(target)
  if (!targetKey) return null
  const lines = String(storyText).split(/(?<=[.!?…])\s+|\n+/).map((line) => line.trim()).filter(Boolean)
  const female = /(?:gioi\s*tinh|giong|ca\s*the|con|dang|hinh\s*thai|phien\s*ban|form)\s*(?::|la)?\s*(?:cai|female)\b|\bfemale(?:\s+form)?\b|♀|\bco\s*be\b/
  const male = /(?:gioi\s*tinh|giong|ca\s*the|con|dang|hinh\s*thai|phien\s*ban|form)\s*(?::|la)?\s*(?:duc|male)\b|\bmale(?:\s+form)?\b|♂|\bcau\s*be\b/
  for (let index = lines.length - 1; index >= 0; index--) {
    if (!foldStory(lines[index]).includes(targetKey)) continue
    const local = foldStory(lines.slice(index, Math.min(lines.length, index + 2)).join(' '))
    const isFemale = female.test(local)
    const isMale = male.test(local)
    if (isFemale !== isMale) {
      return { gender: isFemale ? 'female' : 'male', index, evidence: lines.slice(index, Math.min(lines.length, index + 2)).join(' ') }
    }
  }
  return null
}

export function inferPokemonGenderFromStory(storyText, target) {
  return findPokemonGenderEvidence(storyText, target)?.gender ?? null
}

/**
 * Quét nhiều bí danh của cùng cá thể (tên hiện tại, species, dạng trước tiến
 * hoá...). Evidence xuất hiện muộn nhất trong chính văn thắng.
 */
export function inferPokemonGenderForMonFromStory(storyText, mon, aliases = []) {
  if (!mon) return null
  const targets = [...new Set([
    mon.name,
    mon.species,
    mon.evolvedFrom,
    ...aliases,
  ].filter(Boolean).map((value) => String(value).trim()).filter(Boolean))]
  let best = null
  for (const target of targets) {
    const found = findPokemonGenderEvidence(storyText, target)
    if (found && (!best || found.index > best.index)) best = found
  }
  return best?.gender ?? null
}

function stableUnit(value) {
  let hash = 2166136261
  for (const char of String(value ?? '')) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}

function stableGenderSeed(mon) {
  return [
    mon?.uid,
    mon?.pokemonId,
    mon?.acquisitionSourceId,
    mon?.originalTrainerId,
    mon?.species,
    mon?.name,
  ].filter(Boolean).join('|')
}

export function rollGenderForSpecies(speciesEntry, random = Math.random) {
  const ratio = normalizedRatio(speciesEntry)
  if (!ratio) return random() < 0.5 ? 'male' : 'female'
  if (ratio.M === 0 && ratio.F === 0) return 'unknown'
  if (ratio.M >= 1) return 'male'
  if (ratio.F >= 1) return 'female'
  return random() < ratio.M ? 'male' : 'female'
}

function ratioEqual(a, b) {
  if (!a && !b) return true
  if (!a || !b) return false
  return Math.abs(Number(a.M) - Number(b.M)) < 1e-9
    && Math.abs(Number(a.F) - Number(b.F)) < 1e-9
}

/**
 * Nâng một Pokémon trong save cũ lên dữ liệu giới tính hiện tại.
 * - Cá thể đã có male/female hợp lệ được giữ nguyên.
 * - Loài chỉ đực/chỉ cái/vô giới tính luôn được sửa về đúng canon.
 * - Cá thể thiếu giới tính được bốc theo đúng tỉ lệ loài bằng seed ổn định.
 */
export function ensurePokemonGender(mon, speciesEntry) {
  if (!mon) return mon
  const ratio = normalizedRatio(speciesEntry)
  if (!ratio) return mon

  const current = normalizePokemonGender(mon.gender)
  let gender
  if (ratio.M === 0 && ratio.F === 0) gender = 'unknown'
  else if (ratio.M >= 1) gender = 'male'
  else if (ratio.F >= 1) gender = 'female'
  else if (current === 'male' || current === 'female') gender = current
  else {
    const seed = stableGenderSeed(mon)
    const unit = seed ? stableUnit(seed) : Math.random()
    gender = unit < ratio.M ? 'male' : 'female'
  }

  const nextRatio = { ...ratio }
  if (gender === mon.gender && ratioEqual(mon.genderRatio, nextRatio)
    && mon.genderDataVersion === GENDER_DATA_VERSION) return mon
  return { ...mon, gender, genderRatio: nextRatio, genderDataVersion: GENDER_DATA_VERSION }
}

/**
 * Áp evidence giới tính của chính văn lên một cá thể rồi chạy lại canon ratio.
 * Với loài chỉ đực/chỉ cái/vô giới tính, canon species vẫn có quyền cao hơn
 * một câu văn bất khả thi. Với loài có cả hai giới, evidence story thắng roll.
 */
export function applyNarrativeGenderEvidence(mon, storyText, speciesEntry, aliases = [], sourceMessageId = '') {
  if (!mon) return mon
  const inferred = inferPokemonGenderForMonFromStory(storyText, mon, [
    speciesEntry?.name,
    speciesEntry?.species,
    ...aliases,
  ])
  const seeded = inferred ? { ...mon, gender: inferred } : mon
  const ensured = ensurePokemonGender(seeded, speciesEntry)
  if (!inferred || normalizePokemonGender(ensured?.gender) !== inferred) return ensured
  const evidenceId = sourceMessageId || mon.genderEvidenceMessageId || null
  if (ensured.genderSource === 'story' && ensured.genderEvidenceMessageId === evidenceId) return ensured
  return {
    ...ensured,
    genderSource: 'story',
    ...(evidenceId ? { genderEvidenceMessageId: evidenceId } : {}),
  }
}

export function genderRatioLabel(monOrEntry) {
  const ratio = normalizedRatio(monOrEntry)
  if (!ratio) return 'Tỉ lệ loài chưa tải'
  if (ratio.M === 0 && ratio.F === 0) return 'Loài vô giới tính'
  if (ratio.M >= 1) return 'Loài chỉ có cá thể đực'
  if (ratio.F >= 1) return 'Loài chỉ có cá thể cái'
  const percent = (value) => {
    const n = value * 100
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')
  }
  return `Tỉ lệ loài: ${percent(ratio.M)}% đực · ${percent(ratio.F)}% cái`
}
