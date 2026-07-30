import { readLargeCache, writeLargeCache, removeLegacyLocalCache } from './browserCache.js'

// Tải dữ liệu CHIÊU THỨC THẬT (power/type/category) và LEARNSET THẬT (chiêu
// nào học được ở level nào). PokémonDB là nguồn đối chiếu dễ đọc cho người
// chơi; runtime dùng JSON có cấu trúc của Pokémon Showdown để phủ toàn bộ loài
// mà không phải scrape HTML/CORS ở từng trang Pokédex. Hai nguồn cùng biểu diễn
// learnset theo thế hệ; app lọc đúng Gen 9 rồi mở màn học/quên chiêu khi lên cấp.

const MOVES_URL = 'https://play.pokemonshowdown.com/data/moves.json'
const LEARNSETS_URL = 'https://play.pokemonshowdown.com/data/learnsets.json'
// v5 (đợt 35): bảng all giữ thêm boosts/target/self/secondary — bắt buộc bump
// key vì cache lưu output ĐÃ xử lý, người dùng cache cũ sẽ thiếu field mới.
const MOVES_CACHE_KEY = 'trainer-arena:moves-cache-v8'
const LEARNSETS_CACHE_KEY = 'trainer-arena:learnsets-cache-v3'
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 30 // 30 ngày

// Gen hiện tại dùng để lọc learnset — learnsets.json ghi lịch sử học chiêu
// qua TỪNG thế hệ (VD "9L20" = Gen 9, học qua Level-up ở level 20). Chỉ lấy
// đúng gen mới nhất để không lẫn chiêu chỉ học được ở bản cũ.
const CURRENT_GEN_PREFIX = '9'

async function fetchJsonCached(url, cacheKey, transform) {
  const cachedDb = await readLargeCache(cacheKey)
  if (cachedDb && Date.now() - cachedDb.savedAt < CACHE_MAX_AGE && cachedDb.data) {
    removeLegacyLocalCache(cacheKey)
    return cachedDb.data
  }

  // Migration cache localStorage đời cũ. Sau khi chuyển xong phải xoá bản cũ
  // để trả lại vài MB cho chính văn và các ô save.
  try {
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Date.now() - parsed.savedAt < CACHE_MAX_AGE && parsed.data) {
        await writeLargeCache(cacheKey, parsed)
        removeLegacyLocalCache(cacheKey)
        return parsed.data
      }
    }
  } catch {
    /* cache hỏng — tải lại từ mạng */
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Không tải được ${url} (${res.status})`)
  const raw = await res.json()
  const data = transform(raw)

  await writeLargeCache(cacheKey, { savedAt: Date.now(), data })
  removeLegacyLocalCache(cacheKey)
  return data
}

/**
 * Tải bảng chiêu thức thật. Trả về:
 * { damaging: { [moveId]: {name, power, type, ...} },  ← chỉ move power>0,
 *     dùng cho hệ chiến đấu theo lượt (giữ nguyên hành vi cũ)
 *   all: { [moveId]: {name, type, category, power} }   ← MỌI move kể cả
 *     Status (Thunder Wave, Recover...), dùng cho BỂ CHIÊU của combat anime
 *     và autocomplete/validate khi người chơi gõ tên chiêu (đợt 26). }
 */
export async function loadMovesData() {
  return fetchJsonCached(MOVES_URL, MOVES_CACHE_KEY, (raw) => {
    const out = {}
    const all = {}
    for (const [id, m] of Object.entries(raw)) {
      if (m.isZ || m.isMax) continue // bỏ Z-move/Max move — không thuộc bể chiêu thường
      all[id] = {
        id,
        name: m.name,
        type: (m.type || 'Normal').toLowerCase(),
        category: m.category,
        power: m.basePower || 0,
        // Đợt 35 (bug Growl/String Shot câm): chiêu Status cần các field hiệu
        // ứng để trận đấu áp bậc chỉ số — trước đây bị cắt sạch ở đây.
        boosts: m.boosts || null,
        target: m.target || 'normal',
        self: m.self || null,
        secondary: m.secondary || null,
        accuracy: m.accuracy ?? true,
        flags: m.flags || {},
        status: m.status || null,
        heal: m.heal || null,
        drain: m.drain || null,
        recoil: m.recoil || null,
        multihit: m.multihit || null,
        priority: m.priority || 0,
        weather: m.weather || null,
        pp: m.pp ?? null,
        description: m.shortDesc || m.desc || '',
      }
      if (!m.basePower || m.basePower <= 0) continue
      out[id] = {
        id,
        name: m.name,
        power: m.basePower,
        type: (m.type || 'Normal').toLowerCase(),
        category: m.category,
        // Dùng cho giao thức chọn chiêu + hiệu ứng trạng thái trong trận:
        flags: m.flags || {}, // VD flags.recharge = true (Hyper Beam...)
        recoil: m.recoil || null, // VD [33,100] = mất 33% sát thương gây ra dạng hồi lực
        // {chance, status: 'brn'|'par'|'slp'..., boosts: {...}}
        // LƯU Ý: 1 số chiêu (Fire Fang / Ice Fang / Thunder Fang...) dùng field
        // "secondaries" (MẢNG nhiều hiệu ứng) thay vì "secondary" — chuẩn hoá
        // về 1 field duy nhất, ưu tiên entry có gây trạng thái, để hệ thống
        // trạng thái trong trận không bỏ sót các chiêu này (bug cũ: các chiêu
        // Fang không bao giờ proc bỏng/tê liệt vì chỉ đọc "secondary").
        secondary:
          m.secondary ||
          (Array.isArray(m.secondaries)
            ? m.secondaries.find((s) => s?.status) || m.secondaries[0] || null
            : null),
        self: m.self || null, // 1 số chiêu tự gây hiệu ứng phụ cho chính mình
        boosts: m.boosts || null, // hiếm chiêu sát thương có boosts top-level
        target: m.target || 'normal',
        accuracy: m.accuracy ?? true,
        drain: m.drain || null,
        multihit: m.multihit || null,
        priority: m.priority || 0,
        weather: m.weather || null,
        pp: m.pp ?? null,
        description: m.shortDesc || m.desc || '',
      }
    }
    return { damaging: out, all }
  })
}

/**
 * Tải learnset thật, trả về object { [speciesId]: [{move: moveId, level}] }
 * — CHỈ giữ chiêu học qua level-up (method "L") ở gen mới nhất, đã lược bớt
 * hẳn TM/tutor/egg/event move và lịch sử các gen cũ để nhẹ hơn nhiều so với
 * file gốc (file gốc ghi lịch sử mọi cách học qua mọi thế hệ).
 */
export async function loadLearnsets() {
  return fetchJsonCached(LEARNSETS_URL, LEARNSETS_CACHE_KEY, (raw) => {
    const out = {}
    for (const [speciesId, entry] of Object.entries(raw)) {
      const learnset = entry?.learnset
      if (!learnset) continue
      const moves = []
      for (const [moveId, methods] of Object.entries(learnset)) {
        let gotLevelUp = false
        let gotTm = false
        for (const m of methods) {
          if (!m.startsWith(CURRENT_GEN_PREFIX)) continue
          const method = m[CURRENT_GEN_PREFIX.length]
          if (method === 'L' && !gotLevelUp) {
            const level = parseInt(m.slice(CURRENT_GEN_PREFIX.length + 1), 10)
            if (!Number.isNaN(level)) {
              moves.push({ move: moveId, level, method: 'L' })
              gotLevelUp = true
            }
          } else if (method === 'M' && !gotTm) {
            // Chiêu học qua TM/Máy dạy — không gắn với level, chỉ dùng cho
            // Pokémon CỦA TRAINER (huấn luyện viên có thể dạy TM bất kỳ lúc
            // nào), không áp dụng cho Pokémon hoang dã.
            moves.push({ move: moveId, level: 0, method: 'M' })
            gotTm = true
          }
        }
      }
      if (moves.length) out[speciesId] = moves
    }
    return out
  })
}
