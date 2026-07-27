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
export function resolveBattleTrackKeys(enemyMon, sceneText = '') {
  const tier = getBossTier(enemyMon?.name)
  if (tier?.key === 'high') return ['battle-legendary-high', 'battle-legendary', 'battle-boss', 'battle-wild', 'battle']
  if (tier) return ['battle-legendary', 'battle-boss', 'battle-wild', 'battle']
  // Đợt 67: đối thủ thường — nhưng nếu chính văn cho thấy đây là trận GYM /
  // CHAMPION / trainer thì dùng nhạc tương ứng thay vì nhạc hoang dã.
  const scene = resolveSceneTrackKeys(sceneText)
  if (scene && scene[0].startsWith('battle-')) return scene
  return ['battle-wild', 'battle']
}

/** Nhạc màn hình mở đầu (title screen). */
export const TITLE_TRACK_KEYS = ['title', 'exploration']

/** Nhạc trong cửa hàng. */
export const SHOP_TRACK_KEYS = ['shop']

/** Jingle kết quả (phát 1 lần, không loop, xong tự quay lại nhạc nền). */
export const VICTORY_TRACK_KEYS = ['victory']
export const DEFEAT_TRACK_KEYS = ['defeat']


// ============ NHẠC THEO NGỮ CẢNH TRONG CHÍNH VĂN (đợt 67) ============
// Yêu cầu: "đúng hoàn cảnh trong chính văn thì chơi đúng bài nhạc đó".
// Trước đây nhạc chỉ đổi theo VỊ TRÍ bản đồ và lúc mở BattleModal — nên
// vào Trung tâm Pokémon, cắm trại nghỉ đêm hay đấu Gym đều dùng chung một
// bài. Nay quét chính văn lượt mới nhất để đoán "cảnh" đang diễn ra.
//
// Thứ tự QUAN TRỌNG: rule đứng trước thắng (đấu Champion phải ăn trước
// "đấu trainer"; Trung tâm Pokémon ăn trước "thị trấn").
const SCENE_RULES = [
  {
    keys: ['battle-champion-cynthia', 'battle-champion', 'battle-boss', 'battle'],
    words: ['cynthia'],
  },
  {
    keys: ['battle-champion', 'battle-boss', 'battle'],
    words: [
      'nhà vô địch', 'champion', 'tứ đại thiên vương', 'elite four', 'chung kết',
      'trận cuối cùng', 'ngôi vô địch',
    ],
  },
  {
    keys: ['battle-gym', 'battle-trainer', 'battle'],
    words: [
      'gym leader', 'chủ gym', 'phòng gym', 'thử thách gym', 'trận gym',
      'huy hiệu gym', 'giành huy hiệu', 'thủ lĩnh phòng tập',
    ],
  },
  {
    keys: ['battle-trainer-hard', 'battle-trainer', 'battle'],
    words: [
      'huấn luyện viên kỳ cựu', 'cao thủ', 'kẻ mạnh', 'đối thủ đáng gờm',
      'ace trainer', 'trainer kỳ cựu', 'thủ lĩnh băng', 'trùm',
    ],
  },
  {
    keys: ['battle-trainer', 'battle'],
    words: [
      'thách đấu', 'khiêu chiến', 'giao đấu với', 'đấu tập', 'trận đấu trainer',
      'huấn luyện viên khác', 'so tài',
    ],
  },
  {
    keys: ['pokecenter', 'rest', 'area-town'],
    words: [
      'trung tâm pokémon', 'trung tâm pokemon', 'pokémon center', 'pokemon center',
      'nurse joy', 'y tá joy', 'chữa trị cho pokémon', 'hồi phục pokémon',
      'máy hồi phục', 'quầy tiếp nhận pokémon',
    ],
  },
  {
    keys: ['rest', 'night', 'area-town'],
    words: [
      'cắm trại', 'dựng lều', 'quây quần', 'nghỉ chân', 'nghỉ ngơi', 'ngả lưng',
      'nhóm lửa trại', 'bữa tối', 'thả pokémon ra chơi', 'vuốt ve', 'ôm lấy',
      'chải lông', 'cho pokémon ăn',
    ],
  },
  {
    keys: ['area-endgame', 'battle-legendary', 'exploration'],
    words: [
      'huyền ảo', 'kỳ dị', 'không gian méo mó', 'ánh sáng huyền bí', 'cổ xưa bí ẩn',
      'luồng năng lượng lạ', 'thế giới khác', 'vết nứt không gian', 'điềm báo',
    ],
  },
]

/**
 * Dò "cảnh" từ chính văn → danh sách ứng viên nhạc, hoặc null nếu không rõ
 * (khi đó giữ nguyên nhạc theo vị trí bản đồ).
 * @param {string} text chính văn lượt mới nhất
 * @returns {string[]|null}
 */
export function resolveSceneTrackKeys(text) {
  if (!text) return null
  // Chỉ xét phần CUỐI của đoạn — cảnh hiện tại nằm ở cuối, mở bài có thể
  // còn nhắc chuyện cũ (VD "sau trận gym hôm qua, cậu vào quán trọ").
  const tail = text.slice(-1200).toLowerCase()
  // Chọn theo VỊ TRÍ XUẤT HIỆN MUỘN NHẤT, không phải theo thứ tự luật —
  // "Sau trận gym hôm qua, cậu bước vào Trung tâm Pokémon" phải ra nhạc
  // Trung tâm (cảnh hiện tại) chứ không phải nhạc gym (chuyện đã qua).
  // Khi hoà vị trí thì luật đứng trước thắng (Champion > trainer thường).
  let best = null
  for (let r = 0; r < SCENE_RULES.length; r++) {
    const rule = SCENE_RULES[r]
    for (const w of rule.words) {
      const at = tail.lastIndexOf(w)
      if (at === -1) continue
      if (!best || at > best.at || (at === best.at && r < best.rank)) {
        best = { keys: rule.keys, at, rank: r }
      }
    }
  }
  return best?.keys ?? null
}

/** Nhạc theo BUỔI trong ngày (đêm khuya dịu hơn) — ưu tiên thấp nhất. */
export function resolveTimeOfDayTrackKeys(datePart) {
  if (datePart === 'đêm' || datePart === 'tối') return ['night', 'rest']
  return null
}
