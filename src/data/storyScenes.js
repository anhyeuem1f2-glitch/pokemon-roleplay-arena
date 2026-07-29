// ============ DÒ CẢNH TỪ CHÍNH VĂN (đợt 71) ============
// Hai thứ app cần biết mà trước giờ hoàn toàn không biết:
//
// 1. TRẬN NÀY LÀ VỚI TRAINER HAY VỚI POKÉMON HOANG DÃ?
//    Bug người chơi nghi ngờ và tôi đã xác nhận: `BattleModal` có tham số
//    `isWild` với cơ chế chặn bắt Pokémon đàng hoàng, NHƯNG không một chỗ
//    gọi nào truyền giá trị vào — nên nó luôn là mặc định `true`. Hậu quả:
//    ném bóng bắt được Pokémon của huấn luyện viên khác, chạy trốn khỏi
//    trận với trainer, dụ Pokémon của người ta bỏ chủ theo mình, và mốc
//    thưởng EXP x1.5 cho trận trainer không bao giờ được áp.
//
// 2. NHÂN VẬT CÓ ĐANG Ở TRUNG TÂM POKÉMON KHÔNG?
//    Cần cho nút Chữa trị / Máy PC hiện trong dòng truyện.
//
// Cách dò giống `resolveSceneTrackKeys` trong musicTracks.js — quét phần
// CUỐI đoạn văn và lấy cảnh được nhắc MUỘN NHẤT, vì mở bài hay nhắc lại
// chuyện cũ ("sau trận gym hôm qua, cậu bước vào Trung tâm Pokémon").

const TAIL_LEN = 1600

/** Vị trí xuất hiện MUỘN NHẤT của bất kỳ từ khoá nào, -1 nếu không có. */
function lastHit(hay, words) {
  let best = -1
  for (const w of words) {
    const at = hay.lastIndexOf(w)
    if (at > best) best = at
  }
  return best
}

// ---------- 1. TRẬN VỚI TRAINER ----------
// tier khớp với TRAINER_TIERS trong levelLogic.js để suy ra level đội hình.
// Thứ tự QUAN TRỌNG: luật đứng trước thắng khi hoà vị trí (Champion phải ăn
// trước "huấn luyện viên" chung chung).
const TRAINER_RULES = [
  {
    tier: 'champion', label: 'Nhà vô địch',
    words: ['nhà vô địch', 'champion', 'ngôi vô địch', 'quán quân'],
  },
  {
    tier: 'elite', label: 'Tứ Đại Thiên Vương',
    words: ['tứ đại thiên vương', 'tứ thiên vương', 'elite four', 'elite 4', 'thiên vương'],
  },
  {
    tier: 'gym', label: 'Chủ Gym',
    words: ['gym leader', 'chủ gym', 'thủ lĩnh phòng tập', 'trận gym', 'thử thách gym', 'giành huy hiệu', 'huy hiệu gym'],
  },
  {
    tier: 'boss', label: 'Trùm tổ chức',
    words: ['trùm tổ chức', 'thủ lĩnh băng', 'ông trùm', 'boss của tổ chức', 'giovanni', 'cyrus', 'ghetsis', 'lysandre'],
  },
  {
    tier: 'admin', label: 'Admin tổ chức',
    words: ['admin tổ chức', 'phó tướng', 'cấp cao của tổ chức', 'chỉ huy đội'],
  },
  {
    tier: 'grunt', label: 'Lính tổ chức',
    words: [
      'lính tổ chức', 'tay sai', 'grunt', 'đội rocket', 'team rocket', 'team magma',
      'team aqua', 'team galactic', 'team plasma', 'team flare', 'team skull', 'team yell',
      'gã áo đen', 'bọn cướp pokémon', 'bọn cướp pokemon',
    ],
  },
  {
    tier: 'ace', label: 'Ace Trainer',
    words: ['ace trainer', 'cao thủ', 'kỳ thủ', 'tuyển thủ'],
  },
  {
    tier: 'veteran', label: 'Trainer kỳ cựu',
    words: [
      'huấn luyện viên kỳ cựu', 'trainer kỳ cựu', 'lão làng', 'kiểm lâm', 'cảnh sát',
      'ngư dân', 'thuỷ thủ', 'nhà khoa học', 'đối thủ đáng gờm',
    ],
  },
  {
    tier: 'rookie', label: 'Huấn luyện viên',
    words: [
      'huấn luyện viên khác', 'một huấn luyện viên', 'nhà huấn luyện khác',
      'thách đấu bạn', 'thách đấu cậu', 'khiêu chiến', 'so tài', 'đấu tập',
      'trận đấu trainer', 'giao đấu với', 'đối thủ của bạn', 'kình địch', 'rival',
    ],
  },
  {
    tier: 'youth', label: 'Thiếu niên tập sự',
    words: ['cậu bé bắt côn trùng', 'bug catcher', 'youngster', 'lass', 'thiếu niên tập sự', 'học viên'],
  },
]

// Dấu hiệu RÕ RÀNG là Pokémon hoang dã — dùng để lật ngược kết luận trainer
// khi nó được nhắc muộn hơn ("gã trainer bỏ đi, rồi một Pidgey hoang lao ra").
const WILD_WORDS = [
  'hoang dã', 'hoang dại', 'wild pokémon', 'wild pokemon', 'pokémon hoang', 'pokemon hoang',
  'từ bụi rậm lao ra', 'nhảy ra từ bụi', 'con vật hoang', 'chưa có chủ', 'không ai thuần hoá',
  'lang thang trong rừng', 'sống hoang',
]

/**
 * Trận sắp mở là với TRAINER hay POKÉMON HOANG DÃ?
 * @param {string} text chính văn của tin nhắn chứa [[BATTLE]]
 * @returns {{isTrainer: boolean, tier: string|null, label: string|null}}
 */
export function detectTrainerBattle(text) {
  const none = { isTrainer: false, tier: null, label: null }
  if (!text) return none
  const hay = text.slice(-TAIL_LEN).toLowerCase()

  let best = null
  for (let r = 0; r < TRAINER_RULES.length; r++) {
    const at = lastHit(hay, TRAINER_RULES[r].words)
    if (at === -1) continue
    // Muộn hơn thì thắng; hoà vị trí thì luật đứng trước (bậc cao hơn) thắng.
    if (!best || at > best.at || (at === best.at && r < best.rank)) {
      best = { rule: TRAINER_RULES[r], at, rank: r }
    }
  }
  if (!best) return none

  // Có nhắc Pokémon hoang dã MUỘN HƠN cả trainer → cảnh hiện tại là hoang dã.
  if (lastHit(hay, WILD_WORDS) > best.at) return none

  return { isTrainer: true, tier: best.rule.tier, label: best.rule.label }
}

// ---------- 2. TRUNG TÂM POKÉMON ----------
const POKECENTER_WORDS = [
  'trung tâm pokémon', 'trung tâm pokemon', 'pokémon center', 'pokemon center',
  'pokécenter', 'pokecenter', 'nurse joy', 'y tá joy', 'quầy tiếp nhận pokémon',
  'trạm hồi phục pokémon', 'trung tâm chăm sóc pokémon',
]

// Dấu hiệu ĐÃ RỜI ĐI — tránh nút Trung tâm dính lại ở những lượt sau.
const LEFT_WORDS = [
  'rời khỏi trung tâm', 'bước ra khỏi trung tâm', 'ra khỏi trung tâm',
  'tạm biệt y tá', 'rời trung tâm pokémon', 'rời trung tâm pokemon',
  'cánh cửa tự động khép lại sau lưng',
]

/**
 * Nhân vật có đang Ở TRONG Trung tâm Pokémon không?
 * @returns {{inside: boolean, name: string}}
 */
export function detectPokecenter(text) {
  if (!text) return { inside: false, name: '' }
  const hay = text.slice(-TAIL_LEN).toLowerCase()
  const at = lastHit(hay, POKECENTER_WORDS)
  if (at === -1) return { inside: false, name: '' }
  if (lastHit(hay, LEFT_WORDS) > at) return { inside: false, name: '' }
  return { inside: true, name: 'Trung tâm Pokémon' }
}
