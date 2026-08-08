import { ALL_EQUIPMENT_ITEMS, resolveHeldItemByName } from './pokemonHeldItems.js'

// Danh mục vật phẩm bán trong shop — giá tham khảo theo game gốc. Dữ liệu
// nhỏ, nổi tiếng, ổn định nên gõ tay được (khác species/stat/moveset).
// AI kể chuyện có thể mở shop ở bất kỳ đâu qua tag [[SHOP Tên]]; danh mục
// dùng chung cho mọi shop (lọc theo category sau nếu muốn shop chuyên biệt).
export const SHOP_ITEMS = [
  // --- Poké Ball ---
  { id: 'pokeball', name: 'Poké Ball', price: 200, category: 'ball', desc: 'Bóng bắt Pokémon cơ bản.' },
  { id: 'greatball', name: 'Great Ball', price: 600, category: 'ball', desc: 'Tỉ lệ bắt tốt hơn Poké Ball.' },
  { id: 'ultraball', name: 'Ultra Ball', price: 1200, category: 'ball', desc: 'Tỉ lệ bắt cao, dùng cho Pokémon mạnh.' },
  { id: 'masterball', name: 'Master Ball', price: 0, category: 'ball', noShop: true, desc: 'Bắt chắc chắn Pokémon hoang dã. Vật phẩm độc nhất/hiếm, không bán đại trà.' },
  // Vật chứa đang có Pokémon nhưng chưa xác minh loài. Đây KHÔNG phải bóng
  // rỗng để dùng bắt Pokémon; khi chính văn mở bóng và xác định loài, app tự
  // tiêu thụ một vật chứa rồi mới tạo cá thể Pokémon tương ứng.
  { id: 'unknown-pokemon-ball', name: 'Poké Ball chưa xác định', price: 0, category: 'special', noShop: true, desc: 'Poké Ball có nội dung/tình trạng chưa xác định. Không thể dùng như bóng rỗng; cần kiểm tra hoặc mở trong chính văn.' },
  // --- Hồi phục Pokémon ---
  { id: 'potion', name: 'Potion', price: 300, category: 'heal', desc: 'Hồi 20 HP cho Pokémon.' },
  { id: 'superpotion', name: 'Super Potion', price: 700, category: 'heal', desc: 'Hồi 60 HP cho Pokémon.' },
  { id: 'hyperpotion', name: 'Hyper Potion', price: 1500, category: 'heal', desc: 'Hồi 120 HP cho Pokémon.' },
  { id: 'fullrestore', name: 'Full Restore', price: 3000, category: 'heal', desc: 'Hồi đầy HP + chữa mọi trạng thái.' },
  { id: 'revive', name: 'Revive', price: 2000, category: 'heal', desc: 'Hồi sinh Pokémon gục ngã với nửa HP.' },
  // --- Chữa trạng thái ---
  { id: 'antidote', name: 'Antidote', price: 200, category: 'status', desc: 'Chữa trúng độc.' },
  { id: 'paralyzeheal', name: 'Paralyze Heal', price: 300, category: 'status', desc: 'Chữa tê liệt.' },
  { id: 'awakening', name: 'Awakening', price: 250, category: 'status', desc: 'Đánh thức Pokémon đang ngủ.' },
  { id: 'burnheal', name: 'Burn Heal', price: 300, category: 'status', desc: 'Chữa bỏng.' },
  { id: 'iceheal', name: 'Ice Heal', price: 100, category: 'status', desc: 'Chữa đóng băng.' },
  { id: 'fullheal', name: 'Full Heal', price: 600, category: 'status', desc: 'Chữa mọi trạng thái chính.' },
  // --- Đồ cho NGƯỜI (chế độ chân thực — người cũng bị thương) ---
  { id: 'bandage', name: 'Băng gạc', price: 150, category: 'human', desc: 'Sơ cứu vết thương nhẹ cho người (-10 thương tích 1 bộ phận).' },
  { id: 'medkit', name: 'Túi cứu thương', price: 800, category: 'human', desc: 'Xử lý vết thương vừa cho người (-30 thương tích 1 bộ phận).' },
  { id: 'painkillers', name: 'Thuốc giảm đau', price: 400, category: 'human', desc: 'Chịu đựng tốt hơn khi bị thương nặng.' },
  // --- Tiện ích ---
  { id: 'escaperope', name: 'Escape Rope', price: 600, category: 'misc', desc: 'Thoát nhanh khỏi hang động.' },
  { id: 'repel', name: 'Repel', price: 400, category: 'misc', desc: 'Xua Pokémon hoang dã yếu trong 1 thời gian.' },
  { id: 'freshwater', name: 'Nước khoáng', price: 200, category: 'misc', hungerPlayer: 8, desc: 'Đồ uống — hồi 30 HP cho Pokémon, hoặc cho người uống.' },
  // Vật phẩm tiến hoá/key item cần có trong danh mục để tag ITEM, Admin và
  // bộ kiểm tra tiến hoá cùng nhận ra. Không bày ở mọi Poké Mart; chính văn
  // phải cho tìm/mua ở nơi chuyên biệt hoặc Admin cấp khi kiểm thử.
  ...[
    'Fire Stone', 'Water Stone', 'Thunder Stone', 'Leaf Stone', 'Moon Stone',
    'Sun Stone', 'Shiny Stone', 'Dusk Stone', 'Dawn Stone', 'Ice Stone',
    'Sweet Apple', 'Tart Apple', 'Cracked Pot', 'Chipped Pot',
    'Auspicious Armor', 'Malicious Armor', 'Galarica Cuff', 'Galarica Wreath',
    'Black Augurite', 'Peat Block', 'Linking Cord', 'Syrupy Apple',
    'Unremarkable Teacup', 'Masterpiece Teacup', 'Metal Alloy',
    'Scroll of Darkness', 'Scroll of Waters',
  ].map((name) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, price: 0,
    category: 'special', noShop: true, desc: 'Vật phẩm tiến hoá hiếm; chỉ nhận khi chính văn xác lập nguồn hợp lý.',
  })),
  ...[
    ['light-stone', 'Light Stone'], ['white-stone', 'White Stone'], ['dark-stone', 'Dark Stone'],
    ['azure-flute', 'Azure Flute'], ['reveal-glass', 'Reveal Glass'],
  ].map(([id, name]) => ({ id, name, price: 0, category: 'special', noShop: true, desc: 'Di vật/key item cốt truyện; không bán đại trà.' })),
  // --- ĐỢT 72: KHÔNG BÁN Ở ĐÂU CẢ ---
  // Chủ dự án: "thêm rare candy vào, nhưng đừng cho nó bán trong shop — cậu
  // nào thích chơi cheat thì tự mà cheat ra nhờ thiên phú chứ chơi bình
  // thường là chẳng bao giờ có đâu. Người ta chỉ có thể cheat trong tùy
  // chỉnh thôi."
  // Cờ `noShop` khiến generateShopItems bỏ qua món này ở MỌI cửa hàng. Đường
  // DUY NHẤT để có nó là AI trao qua tag [[ITEM]] — mà AI chỉ trao khi mạch
  // truyện (hoặc năng lực người chơi TỰ VIẾT ở màn tạo nhân vật) dẫn tới.
  // Người chơi bình thường không viết gì thì cả đời không thấy viên nào.
  // Vẫn phải nằm trong SHOP_ITEMS vì đây là danh mục TRA CỨU dùng chung (túi
  // đồ đọc tên/mô tả/phân mục từ đây) — bỏ ra ngoài thì túi hiện "không rõ".
  { id: 'rarecandy', name: 'Kẹo Hiếm', price: 0, category: 'special', noShop: true, desc: 'Nâng 1 Pokémon lên 1 cấp ngay lập tức. Không bán ở bất kỳ đâu.' },
  // Held item + thiết bị huấn luyện viên: mặc định KHÔNG bán đại trà. AI có
  // thể trao bằng [[ITEM]], còn shop chuyên biệt về sau mới được phép lọc và bán.
  ...ALL_EQUIPMENT_ITEMS,
]


// ===== Hàng DÂN SỰ + đồ dùng thường ngày (đợt 36) — thế giới thật thì
// cửa hàng bán cho cả người thường chứ không chỉ trainer =====
SHOP_ITEMS.push(
  // Đồ ăn thức uống (người)
  { id: 'ricemeal', name: 'Suất cơm nóng', price: 120, category: 'food', hungerPlayer: 35, desc: 'Bữa ăn tử tế cho người — no bụng (+35 độ no người).' },
  { id: 'sandwich', name: 'Sandwich', price: 80, category: 'food', hungerPlayer: 20, desc: 'Ăn nhanh dọc đường (+20 độ no người).' },
  { id: 'lemonade', name: 'Nước chanh', price: 35, category: 'food', hungerPlayer: 8, desc: 'Giải khát, tỉnh người (+8 độ no người).' },
  { id: 'instantnoodle', name: 'Mì gói', price: 25, category: 'food', hungerPlayer: 15, desc: 'Rẻ, nhẹ, cứu đói lúc lỡ độ đường (+15 độ no người).' },
  { id: 'driedration', name: 'Lương khô dã ngoại', price: 150, category: 'food', hungerPlayer: 30, desc: 'Gói khẩu phần đi đường dài, để được lâu (+30 độ no người).' },
  // Thức ăn Pokémon
  { id: 'pokefood', name: 'Thức ăn Pokémon (túi)', price: 100, category: 'pokefood', hungerMon: 30, desc: 'Khẩu phần tiêu chuẩn cho Pokémon (+30 độ no Pokémon).' },
  { id: 'pokefood-premium', name: 'Thức ăn Pokémon cao cấp', price: 250, category: 'pokefood', hungerMon: 45, desc: 'Dinh dưỡng đủ chất, Pokémon nào cũng chịu ăn (+45 độ no Pokémon).' },
  { id: 'pokepuff', name: 'Poké Puff', price: 60, category: 'pokefood', hungerMon: 10, friendship: 1, desc: 'Bánh ngọt cho Pokémon — vui miệng hơn là no (+10 độ no, +1 thân mật).' },
  // Đồ dùng sinh hoạt (người thường)
  { id: 'raincoat', name: 'Áo mưa', price: 180, category: 'daily', desc: 'Trời vùng này mưa lúc nào không ai báo trước.' },
  { id: 'flashlight', name: 'Đèn pin', price: 220, category: 'daily', desc: 'Hang tối và đường đêm — thứ đáng tiền nhất túi đồ.' },
  { id: 'sleepingbag', name: 'Túi ngủ', price: 600, category: 'daily', desc: 'Ngủ ngoài trời tử tế thay vì co ro cạnh đống lửa.' },
  { id: 'phonecard', name: 'Thẻ điện thoại', price: 50, category: 'daily', desc: 'Gọi về nhà từ trung tâm Pokémon.' },
  { id: 'firstaidkit', name: 'Túi sơ cứu (người)', price: 350, category: 'human', desc: 'Băng gạc, thuốc đỏ — sơ cứu nhẹ cho NGƯỜI, không phải Pokémon.' },
  { id: 'mapbook', name: 'Bản đồ vùng (giấy)', price: 90, category: 'daily', desc: 'Bản đồ gấp của dân địa phương, ghi chú tay lối tắt.' },
  { id: 'repelspray', name: 'Xịt chống côn trùng', price: 70, category: 'daily', desc: 'Đêm cắm trại bớt khổ — không tác dụng với Pokémon.' },
)

export const SHOP_CATEGORY_LABELS = {
  food: 'Đồ ăn thức uống',
  pokefood: 'Thức ăn Pokémon',
  daily: 'Đồ dùng sinh hoạt',
  clothes: 'Quần áo & phụ kiện',
  outdoor: 'Đồ dã ngoại',
  climbing: 'Đồ leo núi',
  grocery: 'Thực phẩm & tạp hoá',
  ball: 'Poké Ball',
  heal: 'Hồi phục Pokémon',
  status: 'Chữa trạng thái',
  human: 'Đồ cho người',
  misc: 'Tiện ích',
  held: 'Trang bị Pokémon',
  gimmick: 'Thiết bị chiến đấu',
  special: 'Đặc biệt',
  treasure: 'Vật phẩm giá trị',
}


// ============ TRA CỨU VẬT PHẨM THEO TÊN (đợt 72) ============
// AI trao đồ bằng TÊN tiếng Việt/tiếng Anh trong tag [[ITEM ...]], phải khớp
// về đúng id trong danh mục. Khớp lỏng: bỏ dấu, bỏ khoảng trắng thừa, không
// phân biệt hoa thường; kèm bảng tên gọi khác vì model dùng lẫn lộn Anh-Việt.
const ITEM_ALIASES = {
  rarecandy: ['rare candy', 'keo hiem', 'keo qui', 'keo hiem co', 'candy hiem'],
  pokeball: ['poke ball', 'bong poke', 'bong pokemon'],
  greatball: ['great ball', 'bong lon'],
  ultraball: ['ultra ball', 'sieu bong'],
  masterball: ['master ball', 'bong bac thay'],
  'unknown-pokemon-ball': ['poke ball chua xac dinh', 'pokeball chua xac dinh', 'qua bong chua xac dinh', 'poke ball niem phong'],
  potion: ['thuoc hoi mau', 'binh thuoc'],
  revive: ['hoi sinh', 'thuoc hoi sinh'],
  fullrestore: ['full restore', 'hoi phuc toan phan'],
  fullheal: ['full heal', 'chua moi trang thai'],
  iceheal: ['ice heal', 'thuoc tan bang'],
  escaperope: ['escape rope', 'day thoat hiem'],
  'fire-stone': ['da lua'],
  'water-stone': ['da nuoc'],
  'thunder-stone': ['da set', 'da dien'],
  'leaf-stone': ['da la'],
  'moon-stone': ['da mat trang'],
  'sun-stone': ['da mat troi'],
  'shiny-stone': ['da sang'],
  'dusk-stone': ['da bong toi', 'da hoang hon'],
  'dawn-stone': ['da binh minh'],
  'ice-stone': ['da bang'],
  'light-stone': ['white stone', 'bach thach', 'da trang'],
  'dark-stone': ['black stone', 'hac thach', 'da den'],
}

/** Bỏ dấu tiếng Việt + chuẩn hoá để so khớp lỏng. */
function normalizeName(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Tìm vật phẩm trong danh mục theo tên tự do AI viết ra.
 * @returns {object|null} entry của SHOP_ITEMS, hoặc null nếu không khớp.
 */
export function resolveItemByName(rawName) {
  const q = normalizeName(rawName)
  if (!q) return null
  // 1. Khớp chính xác theo tên hiển thị hoặc id.
  for (const it of SHOP_ITEMS) {
    if (normalizeName(it.name) === q || normalizeName(it.id) === q) return it
  }
  // 2. Khớp qua bảng tên gọi khác.
  for (const [id, names] of Object.entries(ITEM_ALIASES)) {
    if (names.some((n) => normalizeName(n) === q)) {
      const found = SHOP_ITEMS.find((it) => it.id === id)
      if (found) return found
    }
  }
  // 3. Khớp chứa — ưu tiên tên DÀI NHẤT để "Super Potion" không rơi vào
  // "Potion" (đúng bài học "đánh con nào cũng ra Charmander" ở đợt trước:
  // hàm dò tên sắp xếp sai thứ tự thì luôn trúng món ngắn nhất).
  // 3. Trang bị động (Mega Stone/Z-Crystal riêng) có thể chưa nằm trong
  // danh mục tĩnh nhưng vẫn phải được nhận diện từ tên Showdown.
  const dynamicHeld = resolveHeldItemByName(rawName)
  if (dynamicHeld) return dynamicHeld
  // 4. Khớp chứa — ưu tiên tên dài nhất.
  const candidates = SHOP_ITEMS
    .filter((it) => {
      const n = normalizeName(it.name)
      return n.length > 2 && (q.includes(n) || n.includes(q))
    })
    .sort((a, b) => normalizeName(b.name).length - normalizeName(a.name).length)
  return candidates[0] ?? null
}

// Đợt 105: inventory roleplay không được phụ thuộc hoàn toàn danh mục tĩnh.
// Vé tàu VIP, huy hiệu fan-made, thiết bị tự chế... phải có thể tồn tại như
// một item thật nếu chính văn đã canon hóa. ID ổn định theo tên để save và
// ledger có thể nhận diện cùng món qua các lượt.
export function createCustomItemDescriptor(rawName, meta = {}) {
  const name = String(rawName ?? '').trim()
  if (!name) return null
  const slug = normalizeName(name).replace(/\s+/g, '-') || 'custom-item'
  return {
    id: `custom-${slug}`,
    name,
    price: Number.isFinite(Number(meta.price)) ? Number(meta.price) : 0,
    category: String(meta.category ?? (meta.keyItem ? 'special' : 'custom')).trim() || 'custom',
    desc: String(meta.description ?? meta.desc ?? 'Vật phẩm do cốt truyện tạo ra.').trim(),
    noShop: true,
    custom: true,
    ...(meta.holdable ? { holdable: true } : {}),
    ...(meta.keyItem ? { keyItem: true } : {}),
  }
}

/** Tìm trong túi theo id/tên, kể cả item động không có trong SHOP_ITEMS. */
export function resolveInventoryItemByName(rawName, inventory = []) {
  const known = resolveItemByName(rawName)
  if (known) return known
  const q = normalizeName(rawName)
  if (!q) return null
  const found = (inventory ?? []).find((item) => normalizeName(item?.name) === q || normalizeName(item?.id) === q)
  return found ? { ...found } : null
}
