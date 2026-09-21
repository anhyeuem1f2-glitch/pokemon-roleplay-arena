import { readLargeCache, writeLargeCache } from './browserCache.js'
import { moveLookupId } from '../i18n/moveNames.js'

// PokeAPI data chứa tên bản địa hoá theo language_id. Dùng jsDelivr trước vì
// thân thiện hơn với người dùng quốc tế/Trung Quốc; raw GitHub là fallback.
// Chỉ tải khi người dùng thật sự bật UI 中文 + tên chiêu theo UI.
const CACHE_KEY = 'trainer-arena:move-names-zh-hans-v1'
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 90
const ZH_HANS_LANGUAGE_ID = '12'

const SOURCE_PAIRS = [
  {
    moves: 'https://cdn.jsdelivr.net/gh/PokeAPI/pokeapi@master/data/v2/csv/moves.csv',
    names: 'https://cdn.jsdelivr.net/gh/PokeAPI/pokeapi@master/data/v2/csv/move_names.csv',
  },
  {
    moves: 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/moves.csv',
    names: 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/move_names.csv',
  },
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

export function buildZhMoveNameMap(movesCsv, namesCsv) {
  const moveIdToIdentifier = new Map()
  const moveLines = String(movesCsv ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)
  for (let i = 1; i < moveLines.length; i++) {
    if (!moveLines[i]) continue
    const cols = parseCsvLine(moveLines[i])
    if (cols.length < 2) continue
    moveIdToIdentifier.set(cols[0], cols[1])
  }

  const out = {}
  const nameLines = String(namesCsv ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)
  for (let i = 1; i < nameLines.length; i++) {
    if (!nameLines[i]) continue
    const cols = parseCsvLine(nameLines[i])
    if (cols.length < 3 || cols[1] !== ZH_HANS_LANGUAGE_ID) continue
    const identifier = moveIdToIdentifier.get(cols[0])
    const key = moveLookupId(identifier)
    const name = cols.slice(2).join(',').trim()
    if (key && name) out[key] = name
  }
  return out
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

export async function loadZhMoveNames() {
  const cached = await readLargeCache(CACHE_KEY)
  const cachedData = cached?.data && typeof cached.data === 'object' ? cached.data : null
  if (cachedData && Date.now() - Number(cached.savedAt || 0) < CACHE_MAX_AGE) return cachedData

  let lastError = null
  for (const source of SOURCE_PAIRS) {
    try {
      const [movesCsv, namesCsv] = await Promise.all([fetchText(source.moves), fetchText(source.names)])
      const data = buildZhMoveNameMap(movesCsv, namesCsv)
      if (Object.keys(data).length < 500) throw new Error('Catalog tên chiêu Trung không đầy đủ')
      await writeLargeCache(CACHE_KEY, { savedAt: Date.now(), data })
      return data
    } catch (error) {
      lastError = error
    }
  }
  // Nếu mạng/CDN tạm lỗi nhưng thiết bị từng tải catalog, dùng bản cache cũ
  // thay vì làm UI quay về English hoàn toàn. Đây chỉ là dữ liệu hiển thị.
  if (cachedData && Object.keys(cachedData).length > 500) return cachedData
  throw lastError ?? new Error('Không tải được catalog tên chiêu tiếng Trung')
}
