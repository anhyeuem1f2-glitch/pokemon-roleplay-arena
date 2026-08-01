// ============ BỘ SINH HÀNG HOÁ CỬA HÀNG (đợt 37) ============
// Mỗi cửa hàng xuất hiện trong chính văn có mặt hàng RIÊNG:
// - loại 'trainer' → danh sách tĩnh như game (bóng/thuốc/status... từ
//   shopItems.js) — đúng yêu cầu "cửa hàng trainer bán như trong game".
// - các loại DÂN DỤNG (tạp hoá/quần áo/dã ngoại/leo núi/bách hoá) → TỰ SINH
//   30-300 món theo QUY MÔ, tổ hợp: thương hiệu (Silph Co., Devon Corp. +
//   các hãng nhỏ tự chế) × dòng sản phẩm × biến thể (màu/size/cỡ), giá =
//   giá gốc × tier thương hiệu × dao động ±15%.
// DETERMINISTIC: seed từ TÊN cửa hàng (mulberry32) — mở lại đúng cửa hàng
// đó là đúng từng món từng giá, không "mọc" hàng mới mỗi lần mở.

import { SHOP_ITEMS } from './shopItems.js'

// ---------- RNG deterministic ----------
function hashStr(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}
function mulberry32(seed) {
  let a = seed >>> 0
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- Thương hiệu (lore lớn + hãng nhỏ tự chế) ----------
export const BRANDS = [
  { name: 'Silph Co.', tier: 1.6, blurb: 'hàng hiệu Saffron, tiền nào của nấy' },
  { name: 'Devon Corp.', tier: 1.7, blurb: 'đồ kỹ thuật Rustboro, bền nổi tiếng' },
  { name: 'Macro Cosmos', tier: 1.5, blurb: 'tập đoàn Galar, mẫu mã bóng bẩy' },
  { name: 'Mossdeep Gear', tier: 1.15, blurb: 'đồ biển đảo Hoenn' },
  { name: 'Snowbelle Textile', tier: 1.2, blurb: 'vải ấm xứ tuyết Kalos' },
  { name: 'Hulbury Marine', tier: 1.1, blurb: 'đồ đi biển Galar' },
  { name: 'Cascarrafa Trading', tier: 1.0, blurb: 'nhà buôn sa mạc Paldea' },
  { name: 'Jubilife Basics', tier: 0.85, blurb: 'bình dân, dùng được' },
  { name: 'Old Cedar Workshop', tier: 0.8, blurb: 'xưởng gia đình, mộc mạc' },
  { name: 'Wela Works', tier: 0.9, blurb: 'đồ chịu nhiệt vùng núi lửa' },
  { name: 'Azalea Craft', tier: 0.95, blurb: 'thủ công Johto' },
  { name: 'Route 9 Surplus', tier: 0.7, blurb: 'hàng thanh lý, hên xui' },
]

// ---------- Dòng sản phẩm theo LOẠI cửa hàng ----------
// Mỗi family: {base, price, cat, variants?, sizes?, desc}
const FAMILIES = {
  clothes: [
    { base: 'Áo khoác gió', price: 900, cat: 'clothes', variants: ['xanh rêu', 'xám tro', 'đỏ gạch', 'đen'], sizes: ['S', 'M', 'L'], desc: 'Chắn gió đi đường dài.' },
    { base: 'Áo thun trainer', price: 250, cat: 'clothes', variants: ['trắng', 'đen', 'xanh biển', 'vàng'], sizes: ['S', 'M', 'L'], desc: 'Cotton thoáng, in hoạ tiết Pokémon.' },
    { base: 'Quần trekking', price: 700, cat: 'clothes', variants: ['be', 'xám', 'xanh đen'], sizes: ['S', 'M', 'L'], desc: 'Vải bền, nhiều túi.' },
    { base: 'Áo mưa trùm', price: 350, cat: 'clothes', variants: ['vàng', 'xanh', 'trong suốt'], desc: 'Trùm cả balo.' },
    { base: 'Mũ lưỡi trai', price: 200, cat: 'clothes', variants: ['đỏ trắng', 'đen', 'xanh lam', 'kaki'], desc: 'Kiểu dáng trainer kinh điển.' },
    { base: 'Găng tay', price: 180, cat: 'clothes', variants: ['da', 'len', 'chống nước'], desc: 'Ấm tay mùa lạnh.' },
    { base: 'Khăn choàng', price: 220, cat: 'clothes', variants: ['len đỏ', 'len xám', 'lụa xanh'], desc: 'Vừa ấm vừa có dáng.' },
    { base: 'Giày đi bộ', price: 1100, cat: 'clothes', variants: ['nâu', 'đen', 'xám xanh'], sizes: ['38', '40', '42'], desc: 'Đế bám tốt, đi cả ngày không mỏi.' },
    { base: 'Tất dày', price: 60, cat: 'clothes', variants: ['trắng', 'đen', 'kẻ sọc'], desc: 'Bộ 2 đôi.' },
    { base: 'Áo len', price: 650, cat: 'clothes', variants: ['kem', 'nâu', 'xanh rêu'], sizes: ['S', 'M', 'L'], desc: 'Đan tay, ấm thật sự.' },
  ],
  outdoor: [
    { base: 'Lều', price: 2500, cat: 'outdoor', variants: ['2 người', '4 người'], desc: 'Chống mưa, dựng nhanh.' },
    { base: 'Túi ngủ', price: 800, cat: 'outdoor', variants: ['3 mùa', 'mùa đông'], desc: 'Cuộn gọn sau balo.' },
    { base: 'Bếp dã ngoại', price: 950, cat: 'outdoor', variants: ['gas mini', 'củi gấp'], desc: 'Nấu bữa nóng giữa đường.' },
    { base: 'Đèn pin', price: 300, cat: 'outdoor', variants: ['cầm tay', 'đội đầu'], desc: 'Pin bền, chống nước nhẹ.' },
    { base: 'Balo', price: 1400, cat: 'outdoor', variants: ['30L', '45L', '60L'], desc: 'Khung trợ lực, đai hông.' },
    { base: 'Bình nước', price: 220, cat: 'outdoor', variants: ['giữ nhiệt', 'gấp gọn'], desc: 'Đi đường xa không thể thiếu.' },
    { base: 'Dao đa năng', price: 550, cat: 'outdoor', variants: ['8 món', '12 món'], desc: 'Từ mở hộp tới cắt dây.' },
    { base: 'Tấm trải cách nhiệt', price: 280, cat: 'outdoor', desc: 'Ngủ đất không thấm lưng.' },
    { base: 'Bộ nồi dã ngoại', price: 700, cat: 'outdoor', desc: 'Lồng gọn vào nhau.' },
    { base: 'Võng du lịch', price: 450, cat: 'outdoor', variants: ['đơn', 'có màn'], desc: 'Mắc giữa hai thân cây.' },
  ],
  climbing: [
    { base: 'Dây leo núi', price: 1800, cat: 'climbing', variants: ['30m', '50m'], desc: 'Chịu tải chuẩn kiểm định.' },
    { base: 'Móc khoá carabiner', price: 250, cat: 'climbing', variants: ['thường', 'khoá tự động'], desc: 'Bán theo chiếc.' },
    { base: 'Đai bảo hộ', price: 1200, cat: 'climbing', sizes: ['S', 'M', 'L'], desc: 'Ôm hông, chia lực tốt.' },
    { base: 'Mũ bảo hộ', price: 900, cat: 'climbing', variants: ['trắng', 'cam', 'xanh'], desc: 'Đá rơi không đùa được.' },
    { base: 'Giày bám đá', price: 1600, cat: 'climbing', sizes: ['38', '40', '42'], desc: 'Mũi cứng, đế ma sát cao.' },
    { base: 'Phấn bám tay', price: 120, cat: 'climbing', desc: 'Túi phấn kèm hộp.' },
    { base: 'Rìu băng', price: 2200, cat: 'climbing', desc: 'Cho vách băng và dốc tuyết.' },
    { base: 'Đinh giày băng', price: 1300, cat: 'climbing', variants: ['10 mấu', '12 mấu'], desc: 'Gắn vào giày đi băng.' },
  ],
  grocery: [
    { base: 'Gạo', price: 90, cat: 'grocery', variants: ['1kg', '5kg'], hungerPlayer: 25, desc: 'Một khẩu phần đã nấu từ gạo địa phương.' },
    { base: 'Mì gói', price: 25, cat: 'grocery', variants: ['bò', 'gà', 'chay'], hungerPlayer: 15, desc: 'Cứu đói kinh điển.' },
    { base: 'Đồ hộp', price: 85, cat: 'grocery', variants: ['cá', 'thịt hầm', 'đậu'], hungerPlayer: 18, desc: 'Để được lâu.' },
    { base: 'Bánh mì', price: 40, cat: 'grocery', variants: ['ổ thường', 'nguyên cám'], hungerPlayer: 12, desc: 'Ra lò buổi sáng.' },
    { base: 'Trứng', price: 70, cat: 'grocery', variants: ['vỉ 6', 'vỉ 10'], hungerPlayer: 16, desc: 'Một khẩu phần trứng trại địa phương.' },
    { base: 'Berry tươi', price: 110, cat: 'grocery', variants: ['Oran', 'Sitrus', 'Pecha', 'Cheri'], hungerPlayer: 8, desc: 'Người ăn được, Pokémon càng thích.' },
    { base: 'Trà gói', price: 95, cat: 'grocery', variants: ['xanh', 'đen', 'hoa cúc'], hungerPlayer: 5, desc: 'Ấm bụng buổi tối.' },
    { base: 'Sữa Miltank', price: 130, cat: 'grocery', variants: ['tươi', 'tiệt trùng'], hungerPlayer: 10, desc: 'Nguồn Johto chính hiệu.' },
    { base: 'Muối - gia vị', price: 45, cat: 'grocery', variants: ['muối', 'tiêu', 'bột nêm'], desc: 'Bếp dã ngoại cần đủ vị.' },
    { base: 'Thức ăn Pokémon', price: 120, cat: 'pokefood', variants: ['túi thường', 'túi lớn', 'cao cấp'], hungerMon: 30, desc: 'Khẩu phần cân bằng.' },
    { base: 'Snack Pokémon', price: 55, cat: 'pokefood', variants: ['giòn', 'mềm'], hungerMon: 10, friendship: 1, desc: 'Thưởng khi ngoan.' },
  ],
  daily: [
    { base: 'Xà phòng', price: 35, cat: 'daily', variants: ['bánh', 'nước'], desc: 'Sạch bụi đường.' },
    { base: 'Khăn tắm', price: 120, cat: 'daily', variants: ['nhỏ', 'lớn'], desc: 'Khô nhanh.' },
    { base: 'Bàn chải - kem đánh răng', price: 60, cat: 'daily', desc: 'Bộ du lịch.' },
    { base: 'Pin tiểu', price: 80, cat: 'daily', variants: ['AA vỉ 4', 'AAA vỉ 4'], desc: 'Cho đèn và radio.' },
    { base: 'Hộp diêm - bật lửa', price: 30, cat: 'daily', variants: ['diêm', 'bật lửa'], desc: 'Lửa là sự sống.' },
    { base: 'Kim chỉ', price: 25, cat: 'daily', desc: 'Vá đồ giữa đường.' },
    { base: 'Túi sơ cứu (người)', price: 380, cat: 'human', humanHeal: 18, desc: 'Băng gạc, thuốc đỏ — giảm 18 thương tích một bộ phận.' },
    { base: 'Ô gấp', price: 160, cat: 'daily', variants: ['đen', 'xanh', 'chấm bi'], desc: 'Gọn trong balo.' },
  ],
}

const TYPE_FAMILIES = {
  clothes: ['clothes'],
  outdoor: ['outdoor', 'climbing'],
  climbing: ['climbing', 'outdoor'],
  grocery: ['grocery', 'daily'],
  general: ['grocery', 'daily', 'clothes', 'outdoor'],
}

export const GENERATED_CATEGORY_LABELS = {
  clothes: 'Quần áo & phụ kiện',
  outdoor: 'Đồ dã ngoại',
  climbing: 'Đồ leo núi',
  grocery: 'Thực phẩm & tạp hoá',
  daily: 'Đồ dùng sinh hoạt',
}

const LOOT_POOLS = {
  treasure: [
    { id: 'loot-rough-ruby', name: 'Hồng ngọc thô', price: 2400, category: 'treasure', desc: 'Đá quý thô có thể giám định hoặc bán lại.' },
    { id: 'loot-sapphire', name: 'Lam ngọc', price: 2600, category: 'treasure', desc: 'Viên đá xanh có giá trị, chưa có giấy giám định.' },
    { id: 'loot-pearl', name: 'Ngọc trai', price: 1400, category: 'treasure', desc: 'Ngọc trai tự nhiên dùng làm trang sức.' },
    { id: 'loot-big-pearl', name: 'Ngọc trai lớn', price: 4000, category: 'treasure', desc: 'Ngọc trai lớn hiếm gặp, giá trị cao.' },
    { id: 'loot-stardust', name: 'Stardust', price: 1000, category: 'treasure', desc: 'Bột đỏ lấp lánh được giới sưu tầm ưa chuộng.' },
    { id: 'loot-star-piece', name: 'Star Piece', price: 6000, category: 'treasure', desc: 'Mảnh tinh thể đỏ quý hiếm có giá trị sưu tầm.' },
    { id: 'loot-nugget', name: 'Nugget', price: 5000, category: 'treasure', desc: 'Khối vàng nguyên chất có thể bán với giá cao.' },
  ],
  medicine: [
    { id: 'potion', name: 'Potion', category: 'heal', desc: 'Hồi 20 HP cho Pokémon.' },
    { id: 'superpotion', name: 'Super Potion', category: 'heal', desc: 'Hồi 60 HP cho Pokémon.' },
    { id: 'antidote', name: 'Antidote', category: 'status', desc: 'Chữa trúng độc.' },
    { id: 'paralyzeheal', name: 'Paralyze Heal', category: 'status', desc: 'Chữa tê liệt.' },
    { id: 'bandage', name: 'Băng gạc', category: 'human', humanHeal: 10, desc: 'Sơ cứu vết thương nhẹ cho người.' },
  ],
  trainer: [
    { id: 'pokeball', name: 'Poké Ball', category: 'ball', desc: 'Bóng bắt Pokémon cơ bản.' },
    { id: 'greatball', name: 'Great Ball', category: 'ball', desc: 'Bóng bắt Pokémon cải tiến.' },
    { id: 'repel', name: 'Repel', category: 'misc', desc: 'Xua Pokémon hoang dã yếu trong một thời gian.' },
    { id: 'escaperope', name: 'Escape Rope', category: 'misc', desc: 'Dùng để thoát nhanh khỏi hang động.' },
  ],
  food: [
    { id: 'sandwich', name: 'Sandwich', category: 'food', hungerPlayer: 20, desc: 'Một phần ăn nhanh cho người.' },
    { id: 'driedration', name: 'Lương khô dã ngoại', category: 'food', hungerPlayer: 30, desc: 'Khẩu phần để được lâu.' },
    { id: 'pokefood', name: 'Thức ăn Pokémon (túi)', category: 'pokefood', hungerMon: 30, desc: 'Khẩu phần tiêu chuẩn cho Pokémon.' },
    { id: 'pokepuff', name: 'Poké Puff', category: 'pokefood', hungerMon: 10, friendship: 1, desc: 'Bánh ngọt cho Pokémon.' },
  ],
  technology: [
    { id: 'loot-data-drive', name: 'Ổ dữ liệu mã hoá', price: 1800, category: 'daily', desc: 'Thiết bị lưu trữ; nội dung cần được giải mã trong chính văn.' },
    { id: 'loot-circuit-board', name: 'Bo mạch Silph', price: 900, category: 'daily', desc: 'Linh kiện điện tử còn dùng được.' },
    { id: 'loot-lab-notes', name: 'Tập ghi chép phòng thí nghiệm', price: 0, category: 'special', desc: 'Tài liệu cốt truyện; nội dung do chính văn xác lập.' },
    { id: 'flashlight', name: 'Đèn pin', category: 'daily', desc: 'Đèn cầm tay dùng khi thám hiểm.' },
  ],
  clothing: [
    { id: 'loot-travel-coat', name: 'Áo khoác du hành', price: 500, category: 'clothes', desc: 'Áo khoác bền dùng khi đi đường.' },
    { id: 'loot-leather-gloves', name: 'Găng tay da', price: 220, category: 'clothes', desc: 'Găng tay bảo vệ tay khi làm việc.' },
    { id: 'raincoat', name: 'Áo mưa', category: 'daily', desc: 'Áo mưa gọn nhẹ.' },
  ],
}

function detectLootType(raw) {
  // Model thường viết giá trị tag dạng snake_case (đá_quý, công_nghệ).
  // Chuẩn hoá dấu phân cách trước khi dò để chúng không rơi nhầm vào pool tổng hợp.
  const type = String(raw ?? '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (/đá\s*quý|da\s*quy|ngọc|jewel|gem|kho\s*báu|treasure/.test(type)) return 'treasure'
  if (/thuốc|y\s*tế|medical|pharmacy|bệnh\s*viện/.test(type)) return 'medicine'
  if (/trainer|pok[eé]|bóng|ball/.test(type)) return 'trainer'
  if (/thực\s*phẩm|đồ\s*ăn|food|grocery|nhà\s*bếp/.test(type)) return 'food'
  if (/công\s*nghệ|điện\s*tử|tech|lab|phòng\s*thí\s*nghiệm/.test(type)) return 'technology'
  if (/quần\s*áo|thời\s*trang|clothes|kho\s*vải/.test(type)) return 'clothing'
  return 'general'
}

/** Sinh chiến lợi phẩm nhỏ gọn, deterministic theo nguồn sự kiện để callback lặp không reroll. */
export function generateLootItems(loot = {}, sourceSeed = '') {
  const type = detectLootType(loot.type)
  const rng = mulberry32(hashStr(`loot|${sourceSeed}|${loot.type ?? ''}|${loot.size ?? ''}`))
  const size = String(loot.size ?? '').toLowerCase()
  const count = /lớn|lon|large|to/.test(size) ? 5 : /nhỏ|nho|small|ít|it/.test(size) ? 2 : 3
  const scale = /lớn|lon|large|to/.test(size) ? 3 : /nhỏ|nho|small|ít|it/.test(size) ? 1 : 2
  const general = [...LOOT_POOLS.food, ...LOOT_POOLS.medicine, ...LOOT_POOLS.trainer, ...LOOT_POOLS.technology, ...LOOT_POOLS.clothing]
  const pool = [...(LOOT_POOLS[type] ?? general)]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(count, pool.length)).map((item) => ({
    ...item,
    qty: Math.max(1, 1 + Math.floor(rng() * scale)),
  }))
}

/** Suy LOẠI cửa hàng từ chuỗi loại AI khai (từ khoá VN/EN, mặc định general). */
export function detectShopType(typeStr) {
  const t = (typeStr ?? '').toLowerCase()
  if (/trainer|mart|poké|poke|bóng|thuốc/.test(t)) return 'trainer'
  if (/quần áo|thời trang|clothes|may mặc/.test(t)) return 'clothes'
  if (/leo núi|climb/.test(t)) return 'climbing'
  if (/dã ngoại|cắm trại|lều|outdoor|camping/.test(t)) return 'outdoor'
  if (/tạp hoá|tạp hóa|thực phẩm|grocery|chợ/.test(t)) return 'grocery'
  return 'general'
}

/** Số món theo quy mô: nhỏ 30-60, vừa 90-150, lớn 200-300 (seed quyết định số lẻ). */
function countForSize(sizeStr, rng) {
  const t = (sizeStr ?? '').toLowerCase()
  if (/lớn|to|big|large/.test(t)) return 200 + Math.floor(rng() * 101)
  if (/nhỏ|small|bé/.test(t)) return 30 + Math.floor(rng() * 31)
  return 90 + Math.floor(rng() * 61) // vừa (mặc định)
}

/**
 * Sinh danh sách hàng cho 1 cửa hàng. Trainer → danh sách tĩnh như game.
 * @param {{name: string, type?: string, size?: string}} shop
 * @returns {Array<{id,name,price,category,desc}>}
 */
export function generateShopItems(shop) {
  const type = detectShopType(shop?.type)
  // Đợt 72: lọc bỏ món có cờ `noShop` (Kẹo Hiếm) — nó nằm trong SHOP_ITEMS
  // chỉ để túi đồ tra được tên/mô tả, TUYỆT ĐỐI không được bày bán ở đâu.
  if (type === 'trainer') return SHOP_ITEMS.filter((it) => !it.noShop)

  const rng = mulberry32(hashStr(shop?.name ?? 'shop'))
  const shopKey = hashStr(`${shop?.name ?? 'shop'}|${shop?.type ?? ''}|${shop?.size ?? ''}`).toString(36)
  const target = countForSize(shop?.size, rng)
  const famKeys = TYPE_FAMILIES[type] ?? TYPE_FAMILIES.general
  const families = famKeys.flatMap((k) => FAMILIES[k])

  // Tổ hợp family × brand × variant × size, xáo theo rng, lấy đủ target.
  const combos = []
  for (const fam of families) {
    for (const brand of BRANDS) {
      const variants = fam.variants ?? [null]
      for (const v of variants) {
        const sizes = fam.sizes ?? [null]
        for (const sz of sizes) combos.push({ fam, brand, v, sz })
      }
    }
  }
  // Fisher-Yates với rng seed.
  for (let i = combos.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[combos[i], combos[j]] = [combos[j], combos[i]]
  }

  const items = []
  for (const c of combos.slice(0, Math.min(target, combos.length))) {
    const jitter = 0.85 + rng() * 0.3 // ±15%
    const price = Math.max(10, Math.round((c.fam.price * c.brand.tier * jitter) / 5) * 5)
    const parts = [c.v, c.sz].filter(Boolean).join(', ')
    items.push({
      // ID phải ổn định nhưng có namespace theo cửa hàng. `gen-0` cũ làm hai
      // món hoàn toàn khác ở hai shop bị gộp chung một slot trong túi.
      id: `gen-${shopKey}-${items.length}`,
      name: `${c.brand.name} ${c.fam.base}${parts ? ` (${parts})` : ''}`,
      price,
      category: c.fam.cat,
      hungerPlayer: c.fam.hungerPlayer ?? null,
      hungerMon: c.fam.hungerMon ?? null,
      friendship: c.fam.friendship ?? 0,
      humanHeal: c.fam.humanHeal ?? null,
      desc: `${c.fam.desc} — ${c.brand.blurb}.`,
    })
  }
  return items
}

// ---------- Tính cách chủ quán (giao thức suy nghĩ NPC) ----------
export const SHOPKEEPER_PERSONALITIES = [
  { key: 'xoiloi', desc: 'xởi lởi, thích buôn chuyện, dễ mềm lòng với khách lễ phép — chịu giảm 5-15% nếu khách dễ mến hoặc mua nhiều', bias: 'dễ' },
  { key: 'keokiet', desc: 'kỹ tính về tiền, ghét mặc cả, chỉ nhượng bộ khi khách mua số lượng lớn hoặc chỉ ra đúng khuyết điểm món hàng — tối đa 5-8%', bias: 'khó' },
  { key: 'metmoi', desc: 'cuối ngày mệt mỏi, muốn chốt nhanh — giảm nhanh 10% cho đơn gọn để khỏi đôi co, nhưng cáu nếu khách kỳ kèo dai', bias: 'vừa' },
  { key: 'giaotiep', desc: 'con buôn lão luyện: khen hàng trước, thả giá nhỏ giọt 3-5% mỗi lần, thích khách biết trả giá đúng bài', bias: 'vừa' },
  { key: 'thangthan', desc: 'giá niêm yết là giá bán, KHÔNG giảm vì nguyên tắc — nhưng hay tặng kèm món nhỏ cho khách mua kha khá', bias: 'khó' },
  { key: 'mesach', desc: 'chủ quán trẻ mê Pokémon, giảm hào phóng 10-20% cho trainer kể chuyện hành trình hay, hỏi han đội hình của khách', bias: 'dễ' },
]

/** Chọn tính cách chủ quán deterministic theo tên shop. */
export function pickShopkeeperPersonality(shopName) {
  const idx = hashStr(`nv-${shopName ?? ''}`) % SHOPKEEPER_PERSONALITIES.length
  return SHOPKEEPER_PERSONALITIES[idx]
}
