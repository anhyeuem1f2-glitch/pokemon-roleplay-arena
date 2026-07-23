// ============ BẢN ĐỒ NHẠC NỀN (đợt 28) ============
// Quy tắc chung: mỗi "ngữ cảnh" (khu vực bản đồ / trận đấu / shop / title...)
// được dịch ra 1 DANH SÁCH ứng viên track theo thứ tự ưu tiên. musicManager
// sẽ thử phát lần lượt từng ứng viên: file nào không tồn tại trong
// public/music/ thì tự nhảy sang ứng viên kế tiếp, hết danh sách thì im lặng
// — nghĩa là bạn CHỈ CẦN bỏ vài file là nhạc chạy, thiếu file không bao giờ
// gây lỗi. Danh sách tên file chuẩn: xem public/music/README.txt.
//
// Đây là dữ liệu curated thủ công (giống regions.js) — mapping từ khoá địa
// danh → "chất nhạc" là kiến thức nhỏ, ổn định, chấp nhận gõ tay.

import { getBossTier } from './bossTiers.js'
import { getArea, getRegion } from './regions.js'

// --- Phân loại "chất nhạc" của khu vực theo từ khoá trong TÊN khu ---
// Thứ tự QUAN TRỌNG: rule đứng trước thắng (VD "Cave of Origin" phải ăn
// endgame trước khi rơi vào cave; "Mt. Chimney" ăn volcano trước cave).
// So khớp trên chuỗi ghép name + keys của khu, lowercase.
const AREA_TYPE_RULES = [
  {
    type: 'endgame', // nơi huyền thoại trú ngụ / không gian dị thường
    words: [
      'ultra space', 'ultra wormhole', 'area zero', 'great crater', 'spear pillar',
      'turnback cave', 'sky pillar', 'cave of origin', 'giant chasm', 'dyna tree',
      'crown tundra', 'cerulean cave', 'mt. silver', 'mount silver',
    ],
  },
  {
    type: 'victory-road', // đường tới nhà vô địch
    words: ['victory road', 'indigo', 'league', 'champion', 'plateau', 'lanakila', 'ever grande', 'wyndon'],
  },
  {
    type: 'tower', // tháp / nơi u linh
    words: ['lavender', 'tower', 'pyre', 'burned', 'ruins', 'relic castle'],
  },
  {
    type: 'volcano',
    words: ['volcano', 'chimney', 'lavaridge', 'cinnabar', 'stark mountain', 'wela', 'jagged pass'],
  },
  {
    type: 'ice',
    words: ['ice path', 'snowpoint', 'snowbelle', 'frost', 'glaseado', 'montenevera', 'acuity', 'icefall'],
  },
  {
    type: 'cave', // hang động / lòng núi / hầm mỏ
    words: [
      'cave', 'tunnel', 'mt. moon', 'mount moon', 'mt. coronet', 'coronet', 'mine',
      'chargestone', 'twist mountain', 'granite', 'seafloor', 'terminus', 'inlet grotto',
      'ten carat', 'hokulani', 'union',
    ],
  },
  {
    type: 'sea', // biển / đảo / hải trình
    words: ['sea', 'island', 'islands', 'whirl', 'seafolk', 's.s. anne', 'ss anne', 'poni', 'dewford', 'slateport', 'hulbury', 'olivine'],
  },
  {
    type: 'forest', // rừng
    words: [
      'forest', 'woods', 'jungle', 'tangle', 'ilex', 'eterna', 'pinwheel', 'viridian',
      'petalburg', 'santalune', 'glimwood', 'lush', 'slumbering weald', 'dappled grove', 'kitakami',
    ],
  },
  {
    type: 'city', // đô thị lớn
    words: [
      'city', 'saffron', 'celadon', 'goldenrod', 'castelia', 'lumiose', 'mesagoza',
      'motostoke', 'hammerlocke', 'jubilife', 'hearthome', 'veilstone', 'nimbasa',
      'lilycove', 'mauville', 'malie', 'levincia', 'cascarrafa', 'medali',
    ],
  },
  {
    type: 'town', // thị trấn khởi đầu / làng nhỏ yên bình
    words: [
      'pallet', 'town', 'new bark', 'littleroot', 'twinleaf', 'nuvema', 'vaniville',
      'postwick', 'wedgehurst', 'cabo poco', 'oldale', 'accumula', 'aquacorde', 'village',
    ],
  },
]

/** Phân loại chất nhạc của 1 khu → 'cave'|'sea'|... hoặc null (dùng theme vùng). */
export function classifyAreaType(area) {
  if (!area) return null
  const hay = `${area.name} ${(area.keys ?? []).join(' ')}`.toLowerCase()
  for (const rule of AREA_TYPE_RULES) {
    if (rule.words.some((w) => hay.includes(w))) return rule.type
  }
  return null
}

/**
 * Danh sách ứng viên nhạc KHÁM PHÁ cho vị trí hiện tại, ưu tiên từ cụ thể →
 * chung: area-<type> → region-<vùng> → exploration. Chưa xác định vị trí thì
 * chỉ còn exploration.
 * @param {{regionKey, areaKey}|null} location
 * @returns {string[]} danh sách track key (tên file không đuôi trong public/music/)
 */
export function resolveAreaTrackKeys(location) {
  const keys = []
  if (location) {
    const region = getRegion(location.regionKey)
    const area = getArea(location.regionKey, location.areaKey)
    const type = classifyAreaType(area)
    if (type) keys.push(`area-${type}`)
    if (region) keys.push(`region-${region.key}`)
  }
  keys.push('exploration')
  return keys
}

/**
 * Danh sách ứng viên nhạc TRẬN ĐẤU theo đối thủ: huyền thoại bậc cao →
 * battle-legendary-high, bậc thấp/huyền ảo → battle-legendary, thường →
 * battle-wild. Luôn fallback dần về 'battle' để chỉ cần 1 file battle.mp3
 * là mọi trận có nhạc.
 * @param {{name?:string}|null} enemyMon
 * @returns {string[]}
 */
export function resolveBattleTrackKeys(enemyMon) {
  const tier = getBossTier(enemyMon?.name)
  if (tier?.key === 'high') return ['battle-legendary-high', 'battle-legendary', 'battle-boss', 'battle-wild', 'battle']
  if (tier) return ['battle-legendary', 'battle-boss', 'battle-wild', 'battle']
  return ['battle-wild', 'battle']
}

/** Nhạc màn hình mở đầu (title screen). */
export const TITLE_TRACK_KEYS = ['title', 'exploration']

/** Nhạc trong cửa hàng. */
export const SHOP_TRACK_KEYS = ['shop']

/** Jingle kết quả (phát 1 lần, không loop, xong tự quay lại nhạc nền). */
export const VICTORY_TRACK_KEYS = ['victory']
export const DEFEAT_TRACK_KEYS = ['defeat']
