import { readLargeCache, writeLargeCache } from './browserCache.js'

// Tên loài Pokémon bản địa hoá cho detector chính văn (đợt 143).
// Khác với tên chiêu UI, dữ liệu này KHÔNG thay name/species canonical bên trong
// battle engine. Nó chỉ thêm alias khi đọc câu chuyện tiếng Trung để "肯泰罗"
// được nối về Tauros thay vì rơi xuống encounter random.
const CACHE_KEY = 'trainer-arena:pokemon-species-names-zh-hans-v1'
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 90
const ZH_HANS_LANGUAGE_ID = '12'
const EN_LANGUAGE_ID = '9'

const SOURCES = [
  'https://cdn.jsdelivr.net/gh/PokeAPI/pokeapi@master/data/v2/csv/pokemon_species_names.csv',
  'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv',
]

function parseCsvLine(line) {
  const out = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"'
        i += 1
      } else quoted = !quoted
      continue
    }
    if (ch === ',' && !quoted) {
      out.push(value)
      value = ''
      continue
    }
    value += ch
  }
  out.push(value)
  return out
}

export function normalizeLocalizedPokemonName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s·・.'’"“”()（）\-—_:：]+/g, '')
    .trim()
}

/**
 * pokemon_species_names.csv: pokemon_species_id, local_language_id, name, genus.
 * Trả cả byId (dex num -> tên giản thể) và byName (tên chuẩn hoá -> dex num)
 * để detector có thể chạy hoàn toàn deterministic, không cần AI đoán tên.
 */
export function buildZhPokemonSpeciesNameMap(csvText) {
  const byId = {}
  const byName = {}
  const englishById = {}
  const byCanonical = {}
  const lines = String(csvText ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue
    const cols = parseCsvLine(lines[i])
    if (cols.length < 3) continue
    const speciesId = Number(cols[0])
    const languageId = cols[1]
    const name = String(cols[2] ?? '').trim()
    if (!Number.isFinite(speciesId) || speciesId <= 0 || !name) continue
    if (languageId === EN_LANGUAGE_ID) englishById[String(speciesId)] = name
    if (languageId !== ZH_HANS_LANGUAGE_ID) continue
    byId[String(speciesId)] = name
    const key = normalizeLocalizedPokemonName(name)
    if (key) byName[key] = speciesId
  }
  // Fallback cho Pokédex tĩnh 151 loài: các entry cũ không có field `num`.
  // Nối English canonical -> 简体中文 ngay từ cùng CSV để detector vẫn chạy.
  for (const [id, english] of Object.entries(englishById)) {
    const localized = byId[id]
    if (!localized) continue
    const key = normalizeLocalizedPokemonName(english)
    if (key) byCanonical[key] = localized
  }
  return { byId, byName, byCanonical }
}

async function fetchText(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/csv,text/plain;q=0.9,*/*;q=0.5' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.text()
  } finally {
    clearTimeout(timeout)
  }
}

let memoryCache = null
let inFlight = null

export function getCachedZhPokemonSpeciesNames() {
  return memoryCache
}

export async function loadZhPokemonSpeciesNames() {
  if (memoryCache?.byId && Object.keys(memoryCache.byId).length > 500) return memoryCache
  if (inFlight) return inFlight

  inFlight = (async () => {
    const cached = await readLargeCache(CACHE_KEY)
    const cachedData = cached?.data?.byId ? cached.data : null
    if (cachedData && Date.now() - Number(cached.savedAt || 0) < CACHE_MAX_AGE) {
      memoryCache = cachedData
      return cachedData
    }

    let lastError = null
    for (const url of SOURCES) {
      try {
        const csv = await fetchText(url)
        const data = buildZhPokemonSpeciesNameMap(csv)
        if (Object.keys(data.byId).length < 500) throw new Error('Catalog tên Pokémon Trung không đầy đủ')
        memoryCache = data
        await writeLargeCache(CACHE_KEY, { savedAt: Date.now(), data })
        return data
      } catch (error) {
        lastError = error
      }
    }

    // Cache cũ vẫn tốt hơn AI/random khi CDN tạm thời lỗi.
    if (cachedData && Object.keys(cachedData.byId).length > 500) {
      memoryCache = cachedData
      return cachedData
    }
    throw lastError ?? new Error('Không tải được catalog tên Pokémon tiếng Trung')
  })()

  try {
    return await inFlight
  } finally {
    inFlight = null
  }
}

export function zhSpeciesDetectOptions(catalog) {
  return catalog?.byId ? { localizedNamesByNum: catalog.byId, localizedNamesByCanonical: catalog.byCanonical ?? {} } : {}
}
