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
    tier: 'ace', label: 'Battle Club',
    words: ['battle club', 'câu lạc bộ chiến đấu', 'câu lạc bộ đấu pokémon', 'câu lạc bộ đấu pokemon', 'sàn đấu câu lạc bộ'],
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

// ---------- EASTER EGG: ĐỘI HÌNH THẬT CỦA CHỦ GYM (đợt 72) ----------
// Đội gym bình thường chỉ là BÀI KIỂM TRA CHO NGƯỜI MỚI — level khoá cứng.
// Nhưng chủ gym là người BẢO VỆ THÀNH PHỐ: ai chủ động đòi họ rút đội hình
// thật ra thì phải gánh đúng cái mình đòi (Lv70-80). Đây là phần thưởng cho
// người chơi tò mò, không phải bẫy — chính văn luôn phải có câu người chơi
// CHỦ ĐỘNG yêu cầu thì mới kích hoạt.
const REAL_TEAM_WORDS = [
  'đội hình thật', 'đội hình thật sự', 'đội hình chính thức', 'đội hình thi đấu',
  'đội hình liên đoàn', 'đội hình bảo vệ thành phố', 'đội hình mạnh nhất',
  'đội thật của', 'thực lực thật', 'thực lực thật sự', 'sức mạnh thật sự',
  'toàn lực', 'dùng hết sức', 'đừng giữ sức', 'không giữ sức', 'đừng nhường',
  'đánh nghiêm túc', 'nghiêm túc đi', 'ra hết đi', 'rút hết ra',
  'đấu thật', 'trận đấu thật sự',
]

/** Người chơi có ĐANG ĐÒI đối thủ rút đội hình thật không? */
export function detectRealTeamChallenge(text) {
  if (!text) return false
  return lastHit(text.slice(-TAIL_LEN).toLowerCase(), REAL_TEAM_WORDS) !== -1
}

/**
 * Trận sắp mở là với TRAINER hay POKÉMON HOANG DÃ?
 * @param {string} text chính văn của tin nhắn chứa [[BATTLE]]
 * @returns {{isTrainer: boolean, tier: string|null, label: string|null, realTeam: boolean}}
 */
export function detectTrainerBattle(text) {
  const none = { isTrainer: false, tier: null, label: null, realTeam: false }
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

  return {
    isTrainer: true, tier: best.rule.tier, label: best.rule.label,
    realTeam: detectRealTeamChallenge(text),
  }
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


// ---------- 3. CỬA HÀNG TƯƠNG TÁC (đợt 76) ----------
// Model từng gắn [[SHOP Trung tâm Mua sắm Lumiose]] chỉ vì nhân vật đi tới
// Lumiose rồi gặp Pokémon hoang trên đường. Nút shop vì thế xuất hiện dù
// chính văn không hề bước vào cửa hàng. Tag chỉ được tin khi VĂN BẢN tự nó
// chứng minh nhân vật đã ở bên trong và lượt kể đang dừng để mua sắm.
function normalizeSceneText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

const SHOP_NOUNS = [
  'cua hang', 'pokemart', 'poke mart', 'shop', 'sieu thi', 'trung tam mua sam',
  'bach hoa', 'tiem tap hoa', 'tiem quan ao', 'tiem do', 'quay ban hang',
]
const SHOP_INSIDE_CUES = [
  'buoc vao', 'di vao', 'tien vao', 're vao', 'ghe vao', 'mo cua buoc vao',
  'dat chan vao', 'ben trong', 'dung truoc quay', 'truoc quay thanh toan',
  'nhin cac ke hang', 'dao quanh cac ke', 'chu quan', 'nhan vien ban hang',
]
const SHOP_REJECT_CUES = [
  'khong vao', 'chua vao', 'di ngang qua', 'luot qua', 'bo qua cua hang',
  'roi khoi cua hang', 'buoc ra khoi', 'ra khoi cua hang', 'roi sieu thi',
]

/**
 * Kiểm tra tag SHOP có thật sự khớp cảnh hiện tại không.
 * @returns {{inside:boolean, reason:string}}
 */
export function detectInteractiveShop(text, shopName = '') {
  if (!text) return { inside: false, reason: 'empty-story' }
  const hay = normalizeSceneText(text.slice(-TAIL_LEN))
  const normalizedName = normalizeSceneText(shopName)
  const shopAt = Math.max(
    normalizedName ? hay.lastIndexOf(normalizedName) : -1,
    lastHit(hay, SHOP_NOUNS),
  )
  if (shopAt < 0) return { inside: false, reason: 'shop-not-mentioned' }

  const rejectAt = lastHit(hay, SHOP_REJECT_CUES)
  const insideAt = lastHit(hay, SHOP_INSIDE_CUES)
  if (rejectAt > insideAt && rejectAt >= shopAt - 180) {
    return { inside: false, reason: 'story-says-not-inside' }
  }
  if (insideAt < 0) return { inside: false, reason: 'no-entry-action' }

  // Câu chỉ dẫn vào cửa hàng và danh từ cửa hàng phải cùng một cảnh gần nhau;
  // tránh mở shop vì đoạn đầu hồi tưởng “đã bước vào shop hôm qua” nhưng cuối
  // lượt hiện đang đánh Pokémon hoang ngoài đường.
  if (Math.abs(insideAt - shopAt) > 320) return { inside: false, reason: 'entry-too-far' }
  return { inside: true, reason: 'confirmed-inside' }
}


// ---------- ĐẤU ĐÔI THỬ NGHIỆM (đợt 75) ----------
const BATTLE_CLUB_WORDS = [
  'battle club', 'câu lạc bộ chiến đấu', 'câu lạc bộ đấu pokémon',
  'câu lạc bộ đấu pokemon', 'sàn đấu câu lạc bộ',
]
const DOUBLE_BATTLE_WORDS = [
  'đấu đôi', 'đánh đôi', 'trận đôi', '2v2', '2 vs 2', 'hai đấu hai',
  'double battle', 'hai pokémon cùng lúc', 'hai pokemon cùng lúc',
]
const REQUEST_WORDS = [
  'xin', 'đề nghị', 'yêu cầu', 'muốn', 'cho tôi', 'cho tớ', 'cho mình',
  'có thể', 'đồng ý', 'chấp nhận', 'gật đầu', 'nhận lời',
]

/**
 * Chỉ bật 2v2 trong hai trường hợp beta đã duyệt:
 * 1) Battle Club; 2) người chơi chủ động xin Chủ Gym và cảnh hiện tại xác nhận
 * đấu đôi. `sourceText` nên ghép input người chơi + chính văn AI để app không
 * phụ thuộc model có nhắc lại nguyên câu yêu cầu hay không.
 */
export function detectDoubleBattle(sourceText, battleCtx = null) {
  if (!sourceText) return { isDouble: false, reason: null }
  const hay = sourceText.slice(-2400).toLowerCase()
  const hasDouble = lastHit(hay, DOUBLE_BATTLE_WORDS) !== -1
  const atClub = lastHit(hay, BATTLE_CLUB_WORDS) !== -1
  if (atClub && battleCtx?.isTrainer) return { isDouble: true, reason: 'battle-club' }
  const isGym = battleCtx?.tier === 'gym'
  const hasRequest = lastHit(hay, REQUEST_WORDS) !== -1
  if (isGym && hasDouble && hasRequest) return { isDouble: true, reason: 'gym-request' }
  return { isDouble: false, reason: null }
}
