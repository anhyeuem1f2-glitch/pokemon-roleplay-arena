import { readLargeCache, writeLargeCache, removeLegacyLocalCache } from './browserCache.js'

// Tải TOÀN BỘ pokedex thật (mọi Gen, mọi form Mega/Gigantamax/vùng miền) trực
// tiếp từ chính server Pokémon Showdown lúc app chạy — đây là nguồn dữ liệu
// GỐC mà trang sprite dùng, nên species slug khớp 100% với sprite, không cần
// gõ tay hàng nghìn dòng (dễ sai) như cách làm cũ với 151 loài Gen 1.
//
// Lưu ý: "Dynamax" không có species/sprite riêng trong dữ liệu game — bất kỳ
// Pokémon nào cũng Dynamax được mà không đổi hình dạng, nên không có "loài"
// nào tên "-dynamax" cả. Chỉ "Gigantamax" (đuôi "-Gmax") mới có sprite riêng
// cho 1 số loài nhất định, và những loài đó ĐÃ nằm sẵn trong dữ liệu tải về.

const POKEDEX_URL = 'https://play.pokemonshowdown.com/data/pokedex.json'
// v11 giữ dex number/gen/form/tags để Pokédex hành trình và encounter sinh
// thái không phải đoán từ tên. Giữ tên v10 ở hằng legacy để regression cũ
// nhận diện đường migration và localStorage cũ được dọn sau khi tải lại.
const CACHE_KEY = 'trainer-arena:pokedex-cache-v11'
const LEGACY_CACHE_KEY = 'trainer-arena:pokedex-cache-v10'
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 30 // 30 ngày

function toID(text) {
  return String(text ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function generationFromNum(num) {
  if (!Number.isFinite(num) || num <= 0) return null
  if (num <= 151) return 1
  if (num <= 251) return 2
  if (num <= 386) return 3
  if (num <= 493) return 4
  if (num <= 649) return 5
  if (num <= 721) return 6
  if (num <= 809) return 7
  if (num <= 905) return 8
  return 9
}

function normalizeEntry(species, key) {
  if (!species?.types || !Array.isArray(species.types)) return null
  // "CAP" = Create-A-Pokémon, Pokémon fan-made của cộng đồng Smogon để cân
  // bằng metagame, KHÔNG phải Pokémon thật trong game (VD "Voodoll"/"Voodoom").
  // Field đúng là "isNonstandard", không phải "tier" (bug cũ khiến CAP lọt qua).
  // Thêm chặn num <= 0 làm lưới an toàn thứ 2 — CAP mon luôn có dexnum âm/0.
  if (species.isNonstandard === 'CAP') return null
  if (typeof species.num === 'number' && species.num <= 0) return null

  // QUAN TRỌNG: key phẳng trong JSON (VD "raichualola") KHÔNG phải lúc nào
  // cũng khớp tên file sprite thật trên server (VD "raichu-alola.png", có
  // gạch nối). Sprite thật đặt tên theo {baseSpecies}-{forme} (mỗi phần qua
  // toID riêng) — nên với form không phải mặc định (có field "forme"), phải
  // tự ghép lại đúng dạng có gạch nối này thay vì dùng thẳng key phẳng.
  const spriteId =
    species.forme && species.baseSpecies
      ? `${toID(species.baseSpecies)}-${toID(species.forme)}`
      : key

  return {
    name: species.name,
    species: key,
    spriteId,
    num: Number.isFinite(species.num) ? species.num : null,
    gen: Number.isFinite(species.gen) ? species.gen : generationFromNum(species.num),
    forme: species.forme ?? null,
    tags: Array.isArray(species.tags) ? [...species.tags] : [],
    isNonstandard: species.isNonstandard ?? null,
    types: species.types.map((t) => t.toLowerCase()),
    // Base stats THẬT (hp/atk/def/spa/spd/spe) — dùng để tính HP và sát
    // thương đúng theo từng loài, thay vì công thức chung chung khiến 2 loài
    // khác hẳn nhau (VD Ho-Oh vs Zekrom) lại ra máu/sát thương y hệt nhau.
    baseStats: species.baseStats ?? null,
    // Đợt 77: giữ Ability thật của loài. Trước đây normalizeEntry vứt field
    // này nên BattleModal không có dữ liệu để kích hoạt Drizzle/Drought,
    // Levitate, Intimidate... Cache phải bump để save trình duyệt tải lại.
    abilities: species.abilities
      ? Object.entries(species.abilities).map(([slot, name]) => ({
          slot, name, hidden: slot === 'H', special: slot === 'S',
        }))
      : [],
    // Một số loài bắt đầu với mức thân mật khác 70 (đặc biệt nhóm huyền
    // thoại). Giữ dữ liệu thật nếu Showdown cung cấp; save cũ vẫn fallback 70.
    baseFriendship: Number.isFinite(species.baseFriendship) ? species.baseFriendship : 70,
    // Nhiều form/mega/regional (VD Necrozma-Ultra) KHÔNG có learnset riêng
    // trong dữ liệu — cần fallback về learnset của loài GỐC (VD Necrozma) vì
    // trong game thật, các form này thường học đúng bộ chiêu của loài gốc.
    baseSpeciesId: species.forme && species.baseSpecies ? toID(species.baseSpecies) : null,
    // Đợt 81: forme Mega trong Showdown khai đúng viên đá bắt buộc. Giữ
    // các field này để battle không còn mở Mega chỉ vì có một món bất kỳ.
    requiredItem: species.requiredItem ?? null,
    requiredItems: Array.isArray(species.requiredItems) ? [...species.requiredItems] : [],
    battleOnly: species.battleOnly ?? null,
    changesFrom: species.changesFrom ?? null,
    // Đợt 39 — suy MỨC LEVEL HỢP LÝ: hasPrevo (đã tiến hoá từ loài khác),
    // hasEvo (còn tiến hoá được), BST (tổng base stats) làm proxy độ mạnh.
    hasPrevo: Boolean(species.prevo),
    hasEvo: Array.isArray(species.evos) && species.evos.length > 0,
    // Đợt 76: giữ TÊN mắt xích tiến hoá thật thay vì chỉ boolean. Luồng
    // roleplay cần biết Fletchling → Fletchinder là THAY CÙNG CÁ THỂ, không
    // phải nhận thêm một con mới. Bump cache v9 để cache cũ thiếu ability/tiến hoá
    // này không tiếp tục gây phân thân Pokémon.
    prevo: species.prevo ?? null,
    evos: Array.isArray(species.evos) ? [...species.evos] : [],
    evoLevel: Number.isFinite(species.evoLevel) ? species.evoLevel : null,
    bst: species.baseStats ? Object.values(species.baseStats).reduce((a, b) => a + b, 0) : null,
  }
}

/**
 * Tải toàn bộ pokedex (ưu tiên cache trong localStorage nếu còn mới), trả về
 * mảng {name, species, spriteId, types}. Ném lỗi nếu cả cache lẫn mạng đều
 * thất bại — nơi gọi nên tự fallback về danh sách tĩnh nhỏ (POKEMON_SPECIES).
 */
export async function loadFullPokedex() {
  // Đợt 78: ưu tiên IndexedDB. Dữ liệu Pokédex lớn chỉ là cache tải lại được,
  // không được tranh quota localStorage với lịch sử truyện/save người chơi.
  const cachedDb = await readLargeCache(CACHE_KEY)
  if (cachedDb && Date.now() - cachedDb.savedAt < CACHE_MAX_AGE && cachedDb.list?.length > 500) {
    removeLegacyLocalCache(CACHE_KEY)
    removeLegacyLocalCache(LEGACY_CACHE_KEY)
    return cachedDb.list
  }

  // Migration một lần từ cache localStorage đời cũ sang IndexedDB.
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Date.now() - parsed.savedAt < CACHE_MAX_AGE && parsed.list?.length > 500) {
        await writeLargeCache(CACHE_KEY, parsed)
        removeLegacyLocalCache(CACHE_KEY)
        removeLegacyLocalCache(LEGACY_CACHE_KEY)
        return parsed.list
      }
    }
  } catch {
    /* cache hỏng — bỏ qua, tải lại từ mạng */
  }

  const res = await fetch(POKEDEX_URL)
  if (!res.ok) throw new Error(`Không tải được pokedex.json (${res.status})`)
  const data = await res.json()
  const list = Object.entries(data)
    .map(([key, species]) => normalizeEntry(species, key))
    .filter(Boolean)

  if (list.length < 500) {
    throw new Error('Dữ liệu tải về bất thường (quá ít loài) — có thể định dạng đã đổi.')
  }

  await writeLargeCache(CACHE_KEY, { savedAt: Date.now(), list })
  removeLegacyLocalCache(CACHE_KEY)
  removeLegacyLocalCache(LEGACY_CACHE_KEY)
  return list
}
