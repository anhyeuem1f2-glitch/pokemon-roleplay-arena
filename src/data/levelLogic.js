// ============ GIAO THỨC LEVEL ĐA YẾU TỐ (đợt 40) ============
// Triết lý: level KHÔNG xoay quanh người chơi và KHÔNG phải "trần cứng" theo
// đội hình. Mỗi Pokémon có level là KẾT QUẢ của hoàn cảnh thế giới của NÓ:
//   • Pokémon HOANG: khu vực an toàn hay hiểm, có champion/tổ chức bảo kê
//     không, sâu trong hang/đỉnh núi hay ven thị trấn, con NON hay ĐẦU ĐÀN,
//     loài đang ở giai đoạn tiến hoá nào (một Charizard hoang thì phải cao
//     level — nhưng nó gần như không xuất hiện ở khu an toàn).
//   • Pokémon của NPC TRAINER: thân phận + tuổi + kinh nghiệm của trainer đó
//     quyết định (một Elite/Gym Leader mạnh hơn hẳn học sinh mới; một lão
//     làng nhiều năm mạnh hơn thiếu niên; trùm tổ chức tội phạm rất mạnh).
//
// Cơ chế: gom các HỆ SỐ/CỘNG-TRỪ từ nhiều nguồn → ra một "level trung tâm"
// + biên độ, rồi bốc ngẫu nhiên trong dải đó. Không chặn cứng — chỉ là các
// lực kéo có lý do. AI vẫn có thể ghi đè bằng tag tường minh khi cần.

import { getArea, getRegion } from './regions.js'

// ---------- 1. NỀN THEO KHU VỰC ----------
// Dải level nền lấy từ area.level (đã có sẵn trong regions.js). Đây là
// "khí hậu sức mạnh" của vùng — Pallet [2,5], Victory Road [40,50]...
function areaBand(location) {
  const area = location ? getArea(location.regionKey, location.areaKey) : null
  return area?.level ?? [4, 10]
}

// ---------- 2. HỆ SỐ ĐỊA HÌNH / CHIỀU SÂU ----------
// Khu an toàn (có champion/giáo sư/thị trấn lớn canh) kéo GIẢM; nơi hiểm sâu
// (hang, đỉnh, hầm ngục, endgame) kéo TĂNG. Dò theo tên/khoá khu.
const SAFE_KEYWORDS = ['pallet', 'town', 'village', 'littleroot', 'twinleaf', 'nuvema', 'postwick', 'cabo', 'aquacorde']
const DANGER_KEYWORDS = ['cave', 'tunnel', 'mt.', 'mount', 'victory road', 'chamber', 'pillar', 'crater', 'zero', 'stark', 'cerulean cave', 'giant chasm']

function terrainShift(location) {
  if (!location) return 0
  const area = getArea(location.regionKey, location.areaKey)
  if (!area) return 0
  const hay = `${area.name} ${(area.keys ?? []).join(' ')}`.toLowerCase()
  let shift = 0
  if (SAFE_KEYWORDS.some((k) => hay.includes(k))) shift -= 1
  if (DANGER_KEYWORDS.some((k) => hay.includes(k))) shift += 4
  if (area.safari) shift -= 1 // khu safari: quần thể được quản lý, hiền hơn
  return shift
}

// Một số khu "được canh giữ" bởi champion/giáo sư đời trước → giảm mạnh
// (Pallet có Giáo sư Oak — cựu champion — nên Pokémon mạnh gần như không mò
// tới). Có thể mở rộng danh sách này theo lore.
const GUARDED_AREAS = new Set(['kanto:pallet', 'kanto:viridian-route', 'johto:newbark', 'hoenn:littleroot', 'sinnoh:twinleaf', 'unova:nuvema', 'galar:postwick', 'paldea:cabo-poco'])
function guardedShift(location) {
  if (!location) return 0
  return GUARDED_AREAS.has(`${location.regionKey}:${location.areaKey}`) ? -1 : 0
}

// ---------- 3. VAI TRÒ CÁ THỂ (con non / thường / đầu đàn) ----------
export const WILD_ROLES = {
  young: { label: 'con non', shift: -3, spread: 1 },
  normal: { label: 'cá thể thường', shift: 0, spread: 2 },
  alpha: { label: 'đầu đàn', shift: +4, spread: 1 }, // to con, mạnh, hiếm
  ancient: { label: 'lão làng lãnh thổ', shift: +7, spread: 2 },
}
// Bốc vai trò ngẫu nhiên có trọng số (đa số là thường).
function rollRole(rng, allowAlpha = true) {
  const r = rng()
  if (r < 0.18) return WILD_ROLES.young
  if (allowAlpha && r > 0.93) return WILD_ROLES.ancient
  if (allowAlpha && r > 0.82) return WILD_ROLES.alpha
  return WILD_ROLES.normal
}

// ---------- 4. GIAI ĐOẠN TIẾN HOÁ CỦA LOÀI ----------
// Không phải "trần" — mà là XU HƯỚNG: loài đã tiến hoá hết (Charizard) tự
// nhiên xuất hiện ở level cao hơn; loài cơ bản còn non thì thấp hơn. Đây là
// lực kéo nhẹ để mức khớp với hình hài loài, nhưng KHÔNG chặn.
function evoBias(entry) {
  if (!entry) return 0
  const { hasPrevo, hasEvo } = entry
  if (!hasPrevo && hasEvo) return -1 // dạng cơ bản (Charmander): kéo nhẹ xuống
  if (hasPrevo && !hasEvo) return +4 // dạng cuối (Charizard): kéo lên
  if (hasPrevo && hasEvo) return +1 // dạng giữa
  return 0 // không nhánh tiến hoá / huyền thoại: để nền quyết định
}

function clampLv(n) {
  return Math.max(2, Math.min(100, Math.round(n)))
}

/**
 * LEVEL POKÉMON HOANG DÃ — tổng hợp mọi yếu tố thế giới.
 * @param {object} params
 * @param {{regionKey,areaKey}|null} params.location
 * @param {object} params.entry pokedex entry (hasPrevo/hasEvo/bst)
 * @param {'young'|'normal'|'alpha'|'ancient'} [params.role] ép vai trò (mặc định random)
 * @param {() => number} [params.rng]
 * @returns {{level: number, role: string}}
 */
export function wildLevel({ location, entry, role, rng = Math.random }) {
  const [lo, hi] = areaBand(location)
  const base = (lo + hi) / 2
  const pickedRole = role ? WILD_ROLES[role] ?? WILD_ROLES.normal : rollRole(rng, hi >= 10)
  const center =
    base +
    terrainShift(location) +
    guardedShift(location) +
    evoBias(entry) +
    pickedRole.shift
  const spread = Math.max(1, Math.round((hi - lo) / 2)) + pickedRole.spread
  const lv = center + (rng() * 2 - 1) * spread
  // Sàn mềm theo dải khu (không thấp hơn lo-2), trần mềm (không quá hi + shift đầu đàn).
  // Sàn mềm = lo-1 (giữ dải nền của khu, không dồn hết về 2).
  return { level: clampLv(Math.max(lo - 1, lv)), role: pickedRole.label }
}

// ---------- 5. POKÉMON CỦA NPC TRAINER ----------
// Level = hàm của THÂN PHẬN + TUỔI + KINH NGHIỆM của trainer sở hữu, cộng
// nền vùng (trainer ở vùng cao thì đội cũng nhỉnh hơn chút).
export const TRAINER_TIERS = {
  child: { label: 'trẻ con/mới tập', base: 6, perYear: 0.3 },
  youth: { label: 'thiếu niên tập sự', base: 10, perYear: 0.5 },
  rookie: { label: 'trainer non', base: 14, perYear: 0.6 },
  veteran: { label: 'trainer kỳ cựu', base: 30, perYear: 0.4 },
  ace: { label: 'ace/tinh nhuệ', base: 42, perYear: 0.3 },
  gym: { label: 'gym leader', base: 40, perYear: 0.3 },
  elite: { label: 'tứ thiên vương/elite', base: 55, perYear: 0.2 },
  champion: { label: 'nhà vô địch', base: 62, perYear: 0.2 },
  grunt: { label: 'lính tổ chức tội phạm', base: 16, perYear: 0.5 },
  admin: { label: 'admin tổ chức', base: 38, perYear: 0.3 },
  boss: { label: 'trùm tổ chức', base: 52, perYear: 0.2 },
}

/**
 * LEVEL 1 Pokémon trong đội của NPC trainer.
 * @param {object} params
 * @param {keyof TRAINER_TIERS} params.tier thân phận/đẳng cấp trainer
 * @param {number} [params.age] tuổi trainer (kinh nghiệm ~ theo tuổi)
 * @param {number} [params.experience] số năm kinh nghiệm (nếu biết rõ)
 * @param {number} [params.slot] vị trí trong đội (0 = quân đầu yếu hơn quân chủ lực)
 * @param {{regionKey,areaKey}|null} [params.location]
 * @param {() => number} [params.rng]
 */
export function trainerMonLevel({ tier, age, experience, slot = 0, teamSize = 1, location, rng = Math.random }) {
  const t = TRAINER_TIERS[tier] ?? TRAINER_TIERS.rookie
  // Kinh nghiệm: dùng experience nếu có, không thì suy từ tuổi (trên 10 tuổi
  // mới đi huấn luyện, mỗi năm thêm perYear).
  const years = experience != null ? experience : age != null ? Math.max(0, age - 10) : 4
  let lv = t.base + years * t.perYear
  // Nền vùng: trainer ở vùng level cao thì đội nhỉnh hơn (tối đa +6).
  const [, hi] = areaBand(location)
  lv += Math.min(6, hi * 0.12)
  // Quân chủ lực (slot cuối) mạnh hơn quân mở đầu: dàn đều trong ±3 quanh lv.
  if (teamSize > 1) lv += ((slot / (teamSize - 1)) - 0.5) * 6
  // Nhiễu nhẹ.
  lv += (rng() * 2 - 1) * 2
  return clampLv(lv)
}

/**
 * Level cho Pokémon người chơi NHẬN qua chính văn ([[POKEMON]]). KHÔNG chặn
 * cứng — nhưng nếu AI ghi mức lệch xa hoàn cảnh (starter Lv35 ngày đầu) thì
 * kéo mềm về vùng hợp lý theo nền khu + giai đoạn tiến hoá. Nếu AI KHÔNG ghi
 * level (0), tự sinh theo hoàn cảnh.
 */
export function receivedMonLevel({ entry, requestedLevel, location, rng = Math.random }) {
  if (requestedLevel && requestedLevel > 0) {
    // Có level AI đề xuất: tôn trọng, chỉ nắn nếu lệch quá xa nền + evo.
    const [lo, hi] = areaBand(location)
    const reasonableHi = hi + Math.max(0, evoBias(entry)) + 6
    if (requestedLevel <= reasonableHi) return clampLv(requestedLevel)
    // Lệch quá cao → kéo về mức hợp lý nhưng không dưới lo.
    return clampLv(Math.max(lo, reasonableHi))
  }
  // AI không ghi level → sinh theo hoàn cảnh (như một cá thể thường của vùng).
  return wildLevel({ location, entry, role: 'normal', rng }).level
}
