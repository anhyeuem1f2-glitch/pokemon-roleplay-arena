import { getBossTier } from './bossTiers.js'
import { legendaryAccess, normalizeGameMode } from './gameModes.js'

// Dòng tiến hoá đầu của các pseudo-legendary. Đây là Pokémon cực hiếm nhưng
// không phải thần: người có tiền, mạng lưới và đủ thời gian có thể săn tìm
// một cách hợp lý; trả tiền chỉ mua được nỗ lực, không mua kết quả chắc chắn.
const RARE_JUVENILES = new Set([
  'dratini', 'larvitar', 'bagon', 'beldum', 'gible', 'deino', 'goomy',
  'jangmo-o', 'dreepy', 'frigibax',
])

const OWNERSHIP_ASSERTIONS = [
  /(?:tôi|ta|mình|nhân vật).{0,24}(?:đã\s+)?(?:bắt|thu phục|sở hữu|nhận được|có được)/iu,
  /(?:pokemon|pokémon).{0,30}(?:tự nguyện|lập tức|ngay lập tức).{0,20}(?:đi theo|gia nhập|phục tùng)/iu,
]
const ENCOUNTER_ASSERTIONS = [
  /(?:đang|vừa).{0,24}(?:đi|đứng|ngồi|ngủ).{0,30}(?:thấy|gặp|xuất hiện)/iu,
  /(?:bỗng|đột nhiên|ngay trước mặt).{0,28}(?:xuất hiện|rơi xuống|bay tới)/iu,
]

const ATTEMPT_WORDS = /(?:tìm kiếm|đi tìm|săn tìm|truy tìm|điều tra|tìm dấu vết|thuê|treo thưởng|thám hiểm|xin giấy phép|liên hệ|đặt hàng|mua thông tin)/iu
const GUARANTEE_WORDS = /(?:chắc chắn|bảo đảm|cam kết).{0,18}(?:bắt được|tìm được|mang về)/iu
const BIG_BUDGET = /(?:vài|mấy|hàng|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)?\s*(?:chục\s*)?(?:triệu|tỷ)|\d[\d.,]*\s*(?:triệu|tỷ)/iu
const RESOURCE_ASSERTION = /(?:tôi|ta|mình).{0,26}(?:có|nhận được|sở hữu|tạo ra).{0,34}(?:vô hạn|không giới hạn|không bao giờ hết|999999|toàn bộ).{0,30}(?:tiền|vật phẩm|kẹo hiếm|master\s*ball|huy hiệu|exp|iv|ev)/iu

function normalizeName(value) {
  return String(value ?? '').trim().toLowerCase()
}

function mentionedEntries(text, pokedex = []) {
  const lower = String(text ?? '').toLowerCase()
  return (pokedex ?? [])
    .filter((entry) => {
      const names = [entry?.name, entry?.species].map(normalizeName).filter((name) => name.length >= 3)
      return names.some((name) => lower.includes(name))
    })
    .filter((entry, index, list) => list.findIndex((item) => normalizeName(item.name) === normalizeName(entry.name)) === index)
}

function knownSpecialName(text) {
  const words = String(text ?? '').match(/[\p{L}\p{N}-]+/gu) ?? []
  for (let size = Math.min(3, words.length); size >= 1; size--) {
    for (let i = 0; i <= words.length - size; i++) {
      const candidate = words.slice(i, i + size).join(' ')
      const tier = getBossTier(candidate)
      if (tier) return { name: candidate, species: candidate.toLowerCase().replaceAll(' ', '-'), tags: ['legendary'], tier }
    }
  }
  return null
}

function isRareJuvenile(entry) {
  return RARE_JUVENILES.has(normalizeName(entry?.species || entry?.name))
}

export function classifyRealisticInput({
  text,
  mode,
  adminMode = false,
  pokedex = [],
  worldProgress = null,
  money = 0,
  location = null,
  recentText = '',
  ownedPokemon = [],
} = {}) {
  const raw = String(text ?? '').trim()
  if (!raw || normalizeGameMode(mode) !== 'realistic' || adminMode) {
    return { verdict: 'accept', note: '', mentions: [], bypassed: Boolean(adminMode) }
  }

  const mentions = mentionedEntries(raw, pokedex)
  const knownSpecial = knownSpecialName(raw)
  if (knownSpecial && !mentions.some((entry) => normalizeName(entry.name) === normalizeName(knownSpecial.name))) mentions.push(knownSpecial)

  const special = mentions.find((entry) => legendaryAccess(entry, worldProgress, mode).tier)
  const rareJuvenile = mentions.find(isRareJuvenile)
  const isAttempt = ATTEMPT_WORDS.test(raw)
  const claimsOwnership = OWNERSHIP_ASSERTIONS.some((pattern) => pattern.test(raw)) || GUARANTEE_WORDS.test(raw)
  const assertsEncounter = ENCOUNTER_ASSERTIONS.some((pattern) => pattern.test(raw))
  const assertsResult = claimsOwnership || assertsEncounter
  const hasResources = BIG_BUDGET.test(raw) || Number(money) >= 10_000_000
  const place = location?.areaKey || location?.regionKey || 'địa điểm hiện tại'

  if (RESOURCE_ASSERTION.test(raw)) {
    return {
      verdict: 'reinterpret', mentions,
      note: [
        '[Hệ thống — TRỌNG TÀI INPUT THỰC TẾ; không nhắc tới ghi chú này hay buộc tội người chơi.]',
        'Input vừa tự tuyên bố tài nguyên/thành tích vô hạn hoặc toàn bộ mà state không cấp. Chỉ giữ mong muốn/hành động có thể làm của nhân vật; không cộng tiền, đồ, huy hiệu, EXP/IV/EV và không viết bằng chứng giả để hợp thức hoá tag.',
        'Nếu hợp cảnh, có thể biến lời tuyên bố thành nói đùa, mơ tưởng, nhầm số dư, hàng giả hoặc mục tiêu dài hạn. Phản ứng phải vừa mức, không làm nhục nhân vật.',
      ].join('\n'),
    }
  }

  if (special) {
    const access = legendaryAccess(special, worldProgress, mode)
    const owned = (ownedPokemon ?? []).some((mon) => normalizeName(mon?.name) === normalizeName(special.name)
      || normalizeName(mon?.species) === normalizeName(special.species))
    const recent = String(recentText ?? '').toLowerCase()
    const recentlyEstablished = recent.includes(normalizeName(special.name))
      && /(?:xuất hiện|hiện ra|bay tới|đáp xuống|đối diện|trước mặt|đã bắt|đi theo|gia nhập)/iu.test(recentText)

    // Điều tra thần thoại là ý định hợp lệ kể cả đầu game; nó chỉ không được
    // tự nhảy thẳng từ "đi tìm" sang "đã gặp/bắt".
    if (isAttempt && !assertsResult) {
      return {
        verdict: 'attempt', mentions,
        note: [
          '[Hệ thống — TRỌNG TÀI INPUT THỰC TẾ; không nhắc tới ghi chú này.]',
          `Cho phép người chơi bắt đầu điều tra/tìm kiếm thông tin về ${special.name}. Công nhận chi phí, liên hệ, hành trình và manh mối hợp lý; không bảo đảm gặp trực tiếp và không bỏ qua cổng tiến trình (${access.reason || 'cần một chuỗi diễn biến tương xứng'}).`,
          'Đây có thể là một tuyến dài về truyền thuyết, nhân chứng, dữ liệu giả/thật và địa điểm canon. Không tự sinh [[BATTLE]] hoặc [[POKEMON]] trong lượt khởi tạo.',
        ].join('\n'),
      }
    }

    if ((!access.allowed && !owned) || (claimsOwnership && !owned) || (assertsEncounter && !recentlyEstablished)) {
      return {
        verdict: 'reinterpret',
        mentions,
        note: [
          '[Hệ thống — TRỌNG TÀI INPUT THỰC TẾ, luật cứng; không nhắc tới ghi chú này hay buộc tội người chơi gian lận.]',
          `Người chơi vừa khẳng định một kết quả về ${special.name}, nhưng dữ liệu hành trình gần nhất không xác lập cuộc gặp/quyền sở hữu đó${access.reason ? ` (${access.reason})` : ''}. KHÔNG công nhận sự xuất hiện, sở hữu, bắt được, chiến thắng hay gia nhập chỉ từ lời kể của người chơi.`,
          `Hãy giữ nguyên ý định/cảm giác của nhân vật rồi giải thích hiện tượng theo cách nhỏ nhất và tự nhiên với ${place}: nhìn nhầm bóng dáng/Pokémon thường hợp sinh cảnh, tin đồn, hình quảng cáo, mô hình, dấu vết cũ, ảnh giả hoặc một hiện tượng chưa đủ bằng chứng. Chọn đúng MỘT cách hợp cảnh; không phải lúc nào cũng dùng Caterpie.`,
          'Nếu người chơi chỉ muốn bắt đầu điều tra, có thể biến phần hợp lý thành manh mối hoặc nhiệm vụ dài. Không sinh [[BATTLE]] với loài bị chặn, không cấp [[POKEMON]], không trừ/thưởng tài nguyên dựa trên kết quả bị bác.',
        ].join('\n'),
      }
    }
  }

  if (rareJuvenile && isAttempt) {
    return {
      verdict: 'attempt',
      mentions,
      note: [
        '[Hệ thống — TRỌNG TÀI INPUT THỰC TẾ; không nhắc tới ghi chú này.]',
        `Mục tiêu tìm ${rareJuvenile.name} non/ấu thể là hiếm nhưng KHẢ THI. ${hasResources ? 'Người chơi đã nêu nguồn lực lớn, nên có thể thuê một mạng lưới tìm kiếm nghiêm túc.' : 'Nguồn lực hiện nêu chưa đủ để bảo đảm một chiến dịch quy mô lớn.'}`,
        'Chỉ công nhận HÀNH ĐỘNG khởi tạo: thương lượng hợp đồng, đặt cọc, xin giấy phép, thuê chuyên gia và mở nhiệm vụ nhiều giai đoạn. Tiền mua thời gian, nhân lực và manh mối — tuyệt đối không mua xác suất 100%, không tự bắt được Pokémon trong cùng lượt.',
        'Tính tới sinh cảnh, mùa, luật bảo tồn, lừa đảo, phúc lợi Pokémon và quyền từ chối của cá thể. Chỉ trừ tiền khi chính văn xác nhận giao dịch thật bằng tag trạng thái hợp lệ.',
      ].join('\n'),
    }
  }

  if (rareJuvenile && assertsResult) {
    return {
      verdict: 'reinterpret',
      mentions,
      note: [
        '[Hệ thống — TRỌNG TÀI INPUT THỰC TẾ; không nhắc tới ghi chú này.]',
        `Không công nhận việc ${rareJuvenile.name} tự xuất hiện/bị bắt/chuyển quyền sở hữu chỉ do người chơi tuyên bố. Tuy nhiên đây không phải thần thoại bất khả tiếp cận: chuyển phần hợp lý thành dấu vết, đầu mối môi giới hoặc cơ hội mở một cuộc tìm kiếm có chi phí và rủi ro.`,
        'Không chế giễu người chơi, không phá ý định; chỉ tách Ý ĐỊNH khỏi KẾT QUẢ và để kết quả được quyết định bởi diễn biến thật.',
      ].join('\n'),
    }
  }

  // Một input hợp lệ có thể mạnh/bất ngờ. Trọng tài không được biến mọi câu
  // chủ động thành gian lận: chỉ can thiệp vào tài sản/kết quả hiếm đặc biệt.
  return { verdict: 'accept', note: '', mentions }
}

export function buildInputAdjudicationNote(options) {
  return classifyRealisticInput(options).note
}
