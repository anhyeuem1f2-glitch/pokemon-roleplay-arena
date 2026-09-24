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

// Dot144: lõi alias offline cho các loài dễ gặp + các chuỗi tên Trung lồng
// nhau đã gây lỗi thật. Catalog mạng vẫn bổ sung đầy đủ 1025 loài, nhưng khi
// GitHub/jsDelivr chập chờn (đặc biệt ở Trung Quốc) battle không được rơi
// thẳng sang AI/random nữa.
const BUILTIN_ZH_SPECIES = [
  [25, '皮卡丘', 'Pikachu'], [26, '雷丘', 'Raichu'],
  [50, '地鼠', 'Diglett'], [51, '三地鼠', 'Dugtrio'],
  [74, '小拳石', 'Geodude'], [75, '隆隆石', 'Graveler'], [76, '隆隆岩', 'Golem'],
  [79, '呆呆兽', 'Slowpoke'], [80, '呆壳兽', 'Slowbro'],
  [92, '鬼斯', 'Gastly'], [93, '鬼斯通', 'Haunter'], [94, '耿鬼', 'Gengar'],
  [111, '独角犀牛', 'Rhyhorn'], [112, '钻角犀兽', 'Rhydon'],
  [128, '肯泰罗', 'Tauros'], [129, '鲤鱼王', 'Magikarp'], [130, '暴鲤龙', 'Gyarados'],
  [133, '伊布', 'Eevee'], [143, '卡比兽', 'Snorlax'], [150, '超梦', 'Mewtwo'], [151, '梦幻', 'Mew'],
  [304, '可可多拉', 'Aron'], [305, '可多拉', 'Lairon'], [306, '波士可多拉', 'Aggron'],
  [384, '烈空坐', 'Rayquaza'], [447, '利欧路', 'Riolu'], [448, '路卡利欧', 'Lucario'],
  [506, '小约克', 'Lillipup'], [507, '哈约克', 'Herdier'], [508, '长毛狗', 'Stoutland'],
]

function builtInCatalog() {
  const byId = {}
  const byName = {}
  const byCanonical = {}
  for (const [id, zh, en] of BUILTIN_ZH_SPECIES) {
    byId[String(id)] = zh
    byName[normalizeLocalizedPokemonName(zh)] = id
    byCanonical[normalizeLocalizedPokemonName(en)] = zh
  }
  return { byId, byName, byCanonical }
}

export function getBuiltInZhPokemonSpeciesNames() {
  return builtInCatalog()
}

function mergeCatalog(base, extra) {
  return {
    byId: { ...(base?.byId ?? {}), ...(extra?.byId ?? {}) },
    byName: { ...(base?.byName ?? {}), ...(extra?.byName ?? {}) },
    byCanonical: { ...(base?.byCanonical ?? {}), ...(extra?.byCanonical ?? {}) },
  }
}

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
  if (memoryCache?.byId) return memoryCache
  if (inFlight) return inFlight

  inFlight = (async () => {
    const offline = builtInCatalog()
    const cached = await readLargeCache(CACHE_KEY)
    const cachedData = cached?.data?.byId ? cached.data : null
    if (cachedData && Date.now() - Number(cached.savedAt || 0) < CACHE_MAX_AGE) {
      memoryCache = mergeCatalog(offline, cachedData)
      return memoryCache
    }

    let lastError = null
    for (const url of SOURCES) {
      try {
        const csv = await fetchText(url)
        const remote = buildZhPokemonSpeciesNameMap(csv)
        if (Object.keys(remote.byId).length < 500) throw new Error('Catalog tên Pokémon Trung không đầy đủ')
        const data = mergeCatalog(offline, remote)
        memoryCache = data
        await writeLargeCache(CACHE_KEY, { savedAt: Date.now(), data })
        return data
      } catch (error) {
        lastError = error
      }
    }

    // Stale cache hoặc lõi offline vẫn deterministic hơn AI/random. Không
    // ném lỗi chỉ vì CDN Trung Quốc chặn GitHub/jsDelivr.
    memoryCache = mergeCatalog(offline, cachedData)
    if (lastError && typeof console !== 'undefined') console.warn('[pokemon-name-zh] remote catalog unavailable; using offline aliases', lastError)
    return memoryCache
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
