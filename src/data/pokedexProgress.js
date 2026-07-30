// ============ POKÉDEX HÀNH TRÌNH (đợt 86) ============
// `pokedexSpecies` là cơ sở dữ liệu loài; file này lưu TIẾN ĐỘ của riêng
// hành trình: đã tận mắt gặp loài nào và đã sở hữu loài nào. Record dùng
// National Dex number khi có để các form không làm phình sai tổng số loài.

function id(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function dateStamp(date) {
  if (!date || !Number.isFinite(Number(date.day))) return null
  return {
    day: Number(date.day),
    month: Number(date.month) || 1,
    year: Number(date.year) || 2000,
    part: date.part || '',
  }
}

function locationStamp(location) {
  if (!location?.regionKey && !location?.areaKey) return null
  return {
    regionKey: location.regionKey ?? null,
    areaKey: location.areaKey ?? null,
  }
}

export function isDexTrackableEntry(entry) {
  if (!entry?.species && !entry?.name) return false
  if (Number.isFinite(entry.num) && entry.num <= 0) return false
  if (entry.battleOnly) return false
  return !/(?:^|[- ])(?:mega|gmax|gigantamax|primal|eternamax)(?:$|[- ])/i.test(
    `${entry.name ?? ''} ${entry.spriteId ?? ''}`,
  )
}

export function resolveDexEntry(subject, pokedex = []) {
  if (!subject) return null
  const keys = [subject.species, subject.spriteId, subject.baseSpeciesId, subject.name]
    .map(id)
    .filter(Boolean)
  const found = (pokedex ?? []).find((entry) => {
    const entryKeys = [entry.species, entry.spriteId, entry.baseSpeciesId, entry.name]
      .map(id)
      .filter(Boolean)
    return keys.some((key) => entryKeys.includes(key))
  })
  return found ?? subject
}

export function dexRecordKey(subject, pokedex = []) {
  const directNum = Number(subject?.num ?? subject?.dexNum)
  if (Number.isFinite(directNum) && directNum > 0) return `n${directNum}`
  const entry = resolveDexEntry(subject, pokedex)
  if (!entry) return null
  const num = Number(entry.num ?? entry.dexNum)
  if (Number.isFinite(num) && num > 0) return `n${num}`
  const species = id(entry.baseSpeciesId ?? entry.species ?? entry.name)
  return species ? `s:${species}` : null
}

export function normalizePokedexRecords(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const clean = {}
  for (const [fallbackKey, value] of Object.entries(source)) {
    if (!value || typeof value !== 'object') continue
    const key = value.key || fallbackKey
    if (!key) continue
    clean[key] = {
      ...value,
      key,
      seen: Boolean(value.seen || value.caught),
      caught: Boolean(value.caught),
    }
  }
  return clean
}

/**
 * Trả về chính object cũ nếu không có gì thay đổi để effect đồng bộ party
 * không tạo vòng render/persist vô ích.
 */
export function recordPokedexEncounter(records, subject, options = {}, pokedex = []) {
  const entry = resolveDexEntry(subject, pokedex)
  if (!entry) return records ?? {}
  const key = dexRecordKey(entry, pokedex)
  if (!key) return records ?? {}

  const current = normalizePokedexRecords(records)
  // Cache Pokédex fallback có thể từng ghi `s:bulbasaur`; khi database đầy
  // đủ tải xong ta biết #001 và phải nâng sang `n1`, không để đếm thành hai.
  const entryIds = [entry.species, entry.baseSpeciesId, entry.name].map(id).filter(Boolean)
  const alias = current[key]
    ? null
    : Object.entries(current).find(([, record]) => {
        const recordIds = [record.species, record.name].map(id).filter(Boolean)
        return entryIds.some((entryId) => recordIds.includes(entryId))
      })
  const aliasKey = alias?.[0] ?? null
  const previous = current[key] ?? alias?.[1] ?? null
  const caught = Boolean(previous?.caught || options.caught)
  const firstSeen = previous?.firstSeen ?? {
    date: dateStamp(options.date),
    location: locationStamp(options.location),
    source: options.source || 'encounter',
  }
  const firstCaught = caught
    ? (previous?.firstCaught ?? {
        date: dateStamp(options.date),
        location: locationStamp(options.location),
        source: options.source || 'caught',
      })
    : null
  const num = Number(entry.num ?? entry.dexNum)
  const nextRecord = {
    ...(previous ?? {}),
    key,
    num: Number.isFinite(num) && num > 0 ? num : null,
    species: entry.species ?? previous?.species ?? id(entry.name),
    name: entry.name ?? previous?.name ?? entry.species ?? 'Không rõ',
    spriteId: entry.spriteId ?? previous?.spriteId ?? entry.species ?? null,
    types: Array.isArray(entry.types) ? [...entry.types] : (previous?.types ?? []),
    gen: Number(entry.gen) || previous?.gen || null,
    seen: true,
    caught,
    firstSeen,
    firstCaught,
  }

  if (previous && !aliasKey && JSON.stringify(previous) === JSON.stringify(nextRecord)) return records
  const next = { ...current }
  if (aliasKey && aliasKey !== key) delete next[aliasKey]
  next[key] = nextRecord
  return next
}

export function pokedexProgress(records, pokedex = []) {
  const normalized = normalizePokedexRecords(records)
  const discovered = Object.values(normalized)
  const totalKeys = new Set()
  for (const entry of pokedex ?? []) {
    if (!isDexTrackableEntry(entry)) continue
    const key = dexRecordKey(entry, pokedex)
    if (key) totalKeys.add(key)
  }
  return {
    seen: discovered.filter((entry) => entry.seen).length,
    caught: discovered.filter((entry) => entry.caught).length,
    total: totalKeys.size || null,
  }
}

export function listPokedexRecords(records) {
  return Object.values(normalizePokedexRecords(records)).sort((a, b) => {
    if (a.num && b.num && a.num !== b.num) return a.num - b.num
    if (a.num && !b.num) return -1
    if (!a.num && b.num) return 1
    return String(a.name).localeCompare(String(b.name))
  })
}
