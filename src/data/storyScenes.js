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

// Đợt 113: chỉ NHẮC tới Nurse Joy/Pokémon Center không có nghĩa nhân vật
// đang ở trong đó. Reroll từng làm nút Chữa trị + Máy PC bật ngẫu nhiên chỉ
// vì model hồi tưởng/nhắc địa danh. Cần ít nhất một cue vào trong hoặc tương
// tác nội thất rõ ràng ở cùng đoạn cuối.
const POKECENTER_INSIDE_CUES = [
  'bước vào', 'đi vào', 'tiến vào', 'bên trong', 'ở trong trung tâm',
  'đứng trước quầy', 'sau quầy', 'quầy tiếp nhận', 'quầy y tá',
  'máy hồi phục', 'máy chữa trị', 'máy pc', 'terminal pc',
  'đưa pokémon cho y tá', 'đưa pokemon cho y tá', 'giao pokémon cho y tá', 'giao pokemon cho y tá',
  'y tá joy nhận', 'y tá joy trả lại', 'nurse joy nhận', 'nurse joy trả lại',
  'ngồi chờ chữa', 'đang chữa trị', 'hồi phục toàn đội',
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
  const local = hay.slice(Math.max(0, at - 420))
  const insideCue = lastHit(local, POKECENTER_INSIDE_CUES)
  if (insideCue === -1) return { inside: false, name: '' }
  // Cue rời đi nằm sau cue bên trong thì cảnh đã kết thúc.
  if (lastHit(local, LEFT_WORDS) > insideCue) return { inside: false, name: '' }
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
  'mart', 'department store', 'supermarket',
]
const SHOP_ENTRY_CUES = [
  'buoc vao', 'di vao', 'tien vao', 're vao', 'ghe vao', 'mo cua buoc vao',
  'dat chan vao', 'day cua', 'keo cua', 'buoc qua cua', 'di qua cua',
  'tien qua cua', 'lot vao', 'vao trong', 'chon vao',
]
const SHOP_INTERIOR_CUES = [
  'ben trong', 'dung truoc quay', 'truoc quay thanh toan', 'quay thu ngan',
  'nhin cac ke hang', 'dao quanh cac ke', 'giua cac ke hang', 'ke trung bay',
  'gio hang', 'xe day', 'nhan vien ban hang', 'nhan vien sieu thi', 'chu quan',
  'cua tu dong mo', 'canh cua truot mo', 'tieng chuong cua', 'may tinh tien',
  'bang gia', 'chon mon hang', 'lay hang tren ke',
]
const SHOP_REJECT_CUES = [
  'khong vao', 'chua vao', 'khong buoc vao', 'di ngang qua', 'luot qua',
  'bo qua cua hang', 'roi khoi cua hang', 'buoc ra khoi', 'ra khoi cua hang',
  'roi sieu thi', 'dung ben ngoai', 'truoc cua nhung khong vao',
]
const SHOP_FUTURE_CUES = [
  'se vao', 'se di vao', 'se buoc vao', 'dinh vao', 'dinh di vao',
  'muon vao', 'muon di vao', 'tinh vao', 'co the vao', 'sau nay vao',
  'lat nua vao', 'ngay mai vao', 'neu vao', 'chuan bi vao', 'chuan bi di vao',
]

function shopDescriptor(text, explicitName = '') {
  if (explicitName?.trim()) return { name: explicitName.trim(), type: '', size: '' }
  const hay = normalizeSceneText(text)
  if (hay.includes('pokemart') || hay.includes('poke mart')) return { name: 'Poké Mart', type: 'trainer', size: '' }
  if (hay.includes('trung tam mua sam')) return { name: 'Trung tâm Mua sắm', type: 'bách hoá', size: 'lớn' }
  if (hay.includes('sieu thi') || hay.includes('supermarket')) return { name: 'Siêu Thị', type: 'bách hoá', size: 'lớn' }
  if (hay.includes('bach hoa') || hay.includes('department store')) return { name: 'Cửa hàng Bách hoá', type: 'bách hoá', size: 'lớn' }
  if (hay.includes('tiem quan ao')) return { name: 'Tiệm Quần áo', type: 'quần áo', size: '' }
  if (hay.includes('tiem tap hoa')) return { name: 'Tiệm Tạp hoá', type: 'tạp hoá', size: '' }
  return { name: 'Cửa hàng', type: '', size: '' }
}

/**
 * Kiểm tra SHOP có thật sự là cảnh mua sắm tương tác.
 * `userText` được xét riêng vì người chơi thường gõ “tôi đi vào siêu thị”,
 * còn AI bắt đầu thẳng từ cảnh bên trong mà không lặp lại động từ “bước vào”.
 * @returns {{inside:boolean, reason:string, name?:string, type?:string, size?:string}}
 */
export function detectInteractiveShop(storyText, shopName = '', userText = '') {
  if (!storyText && !userText) return { inside: false, reason: 'empty-story' }
  const story = normalizeSceneText(String(storyText ?? '').slice(-TAIL_LEN))
  const user = normalizeSceneText(String(userText ?? '').slice(-600))
  const normalizedName = normalizeSceneText(shopName)

  const storyShopAt = Math.max(
    normalizedName ? story.lastIndexOf(normalizedName) : -1,
    lastHit(story, SHOP_NOUNS),
  )
  const userShopAt = Math.max(
    normalizedName ? user.lastIndexOf(normalizedName) : -1,
    lastHit(user, SHOP_NOUNS),
  )
  if (storyShopAt < 0 && userShopAt < 0) return { inside: false, reason: 'shop-not-mentioned' }

  const storyRejectAt = lastHit(story, SHOP_REJECT_CUES)
  const storyEntryAt = lastHit(story, SHOP_ENTRY_CUES)
  const storyInteriorAt = lastHit(story, SHOP_INTERIOR_CUES)
  const storyInsideAt = Math.max(storyEntryAt, storyInteriorAt)
  if (storyRejectAt > storyInsideAt && storyRejectAt >= storyShopAt - 220) {
    return { inside: false, reason: 'story-says-not-inside' }
  }

  // Đường đáng tin nhất: chính văn AI tự chứng minh đang ở trong cửa hàng.
  if (storyInsideAt >= 0) {
    const anchor = storyShopAt >= 0 ? storyShopAt : userShopAt
    if (anchor < 0 || Math.abs(storyInsideAt - anchor) <= 420 || storyInteriorAt >= 0) {
      return { inside: true, reason: 'story-confirmed-inside', ...shopDescriptor(`${userText}\n${storyText}`, shopName) }
    }
  }

  // Người chơi ra hành động trực tiếp “đi vào…”. Không nhận câu dự định/sẽ
  // vào, và AI vẫn phải nhắc cửa hàng hoặc chi tiết nội thất để chống nút shop
  // tự hiện ở cảnh đi đường như bug đợt 76.
  const userEntryAt = lastHit(user, SHOP_ENTRY_CUES)
  const userRejectAt = Math.max(lastHit(user, SHOP_REJECT_CUES), lastHit(user, SHOP_FUTURE_CUES))
  const directUserEntry = userEntryAt >= 0 && userEntryAt > userRejectAt
  const aiAcknowledgesShop = storyShopAt >= 0 || storyInteriorAt >= 0
  if (directUserEntry && aiAcknowledgesShop) {
    return { inside: true, reason: 'player-entered-and-story-acknowledged', ...shopDescriptor(`${userText}\n${storyText}`, shopName) }
  }

  return { inside: false, reason: directUserEntry ? 'story-did-not-acknowledge-shop' : 'no-entry-action' }
}

/** Suy SHOP khi model quên tag nhưng cảnh đã chứng minh đang mua sắm. */
export function inferInteractiveShop(storyText, userText = '') {
  const check = detectInteractiveShop(storyText, '', userText)
  if (!check.inside) return null
  return { name: check.name ?? 'Cửa hàng', type: check.type ?? '', size: check.size ?? '', inferred: true }
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
