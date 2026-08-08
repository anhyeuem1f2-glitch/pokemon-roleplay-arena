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
  /(?:tôi|ta|mình|nhân vật).{0,24}(?:(?:đã|vừa)\s*(?:bắt(?:\s+được)?|thu phục(?:\s+thành công)?)|(?:sở hữu|nhận được|có được))/iu,
  /(?:tôi|ta|mình|nhân vật).{0,24}(?:bắt|thu phục).{0,20}(?:thành công|thuộc về|là của)/iu,
  /(?:pokemon|pokémon).{0,30}(?:tự nguyện|lập tức|ngay lập tức).{0,20}(?:đi theo|gia nhập|phục tùng)/iu,
]
const ENCOUNTER_ASSERTIONS = [
  /(?:đang|vừa).{0,24}(?:đi|đứng|ngồi|ngủ).{0,30}(?:thấy|gặp|xuất hiện)/iu,
  /(?:bỗng|đột nhiên|ngay trước mặt).{0,28}(?:xuất hiện|rơi xuống|bay tới)/iu,
]

const ATTEMPT_WORDS = /(?:tìm kiếm|đi tìm|săn tìm|truy tìm|điều tra|tìm dấu vết|thuê|treo thưởng|thám hiểm|xin giấy phép|liên hệ|đặt hàng|mua thông tin)/iu
const POKEMON_SEARCH_WORDS = /(?:đi\s+tìm|tìm\s+kiếm|săn\s+tìm|săn\s+lùng|truy\s+tìm|lùng\s+tìm|dò\s+tìm|tìm\s+dấu\s+vết|tìm\s+hiểu\s+về|search(?:ing)?\s+for|hunt(?:ing)?\s+for|look(?:ing)?\s+for)/iu
const FOLLOW_CLUE_WORDS = /(?:theo|bám|lần theo|kiểm tra|xác minh|phân tích|đối chiếu|hỏi tiếp|đặt camera|mai phục|phục kích|quan sát|rọi đèn|lấy mẫu|theo dõi).{0,50}(?:manh mối|dấu vết|vệt|mẫu|tin|nhân chứng|camera|địa điểm|hang|cống|tổ|lông|vảy|dịch|chất nhầy)|(?:manh mối|dấu vết|vệt|mẫu|tin|nhân chứng).{0,50}(?:theo|bám|kiểm tra|xác minh|phân tích|đối chiếu)/iu
const GUARANTEE_WORDS = /(?:chắc chắn|bảo đảm|cam kết).{0,18}(?:bắt được|tìm được|mang về)/iu
const BIG_BUDGET = /(?:vài|mấy|hàng|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)?\s*(?:chục\s*)?(?:triệu|tỷ)|\d[\d.,]*\s*(?:triệu|tỷ)/iu
const RESOURCE_ASSERTION = /(?:tôi|ta|mình).{0,26}(?:có|nhận được|sở hữu|tạo ra).{0,34}(?:vô hạn|không giới hạn|không bao giờ hết|999999|toàn bộ).{0,30}(?:tiền|vật phẩm|kẹo hiếm|master\s*ball|huy hiệu|exp|iv|ev)/iu
const BADGE_COUNT_CLAIM = /(?:tôi|ta|mình).{0,24}(?:đã\s*)?(?:có|sở hữu|kiếm được|nhận được)\s*(\d{1,3})\s*(?:huy hiệu|badge)/iu
const QUEST_COUNT_CLAIM = /(?:tôi|ta|mình).{0,24}(?:đã\s*)?(?:hoàn thành|xong)\s*(\d{1,4})\s*(?:nhiệm vụ|quest)/iu
const MONEY_COUNT_CLAIM = /(?:tôi|ta|mình).{0,24}(?:đã\s*)?(?:có|sở hữu|nhận được|kiếm được)\s*([\d.,]+)\s*(?:(triệu|tỷ)(?:\s*(?:₽|pokédollar|pokedollar|đồng|tiền))?|(?:₽|pokédollar|pokedollar|đồng|tiền))/iu
const BIG_MONEY_ASSERTION = /(?:tôi|ta|mình).{0,24}(?:đã\s*)?(?:có|sở hữu|nhận được|kiếm được).{0,30}(?:vài|mấy|hàng|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|\d[\d.,]*)\s*(?:chục\s*)?(?:triệu|tỷ)/iu
const RARE_ITEM_CLAIM = /(?:tôi|ta|mình).{0,24}(?:đã\s*)?(?:có|sở hữu|nhặt được|nhận được|tìm thấy)\s*(\d{0,4})\s*(master\s*ball|rare\s*cand(?:y|ies)|kẹo\s*hiếm|mega\s*stone|key\s*stone|white\s*stone|light\s*stone|dark\s*stone)/iu
const TITLE_CLAIM = /(?:tôi|ta|mình).{0,20}(?:đã\s*)?(?:là|trở thành|đánh bại).{0,22}(?:champion|nhà vô địch|tứ thiên vương|elite\s*four)/iu

function normalizeName(value) {
  return String(value ?? '').trim().toLowerCase()
}

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function containsWholeName(text, value) {
  const name = normalizeName(value)
  if (!name) return false
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(name)}(?=$|[^\\p{L}\\p{N}])`, 'iu')
    .test(normalizeName(text))
}

function normalizeItemKey(value) {
  return normalizeName(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

function approximateWrittenMoneyClaim(text) {
  const match = String(text ?? '').match(/(?:tôi|ta|mình).{0,24}(?:đã\s*)?(?:có|sở hữu|nhận được|kiếm được).{0,30}(vài|mấy|hàng|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)\s*(chục\s*)?(triệu|tỷ)/iu)
  if (!match) return null
  const values = { vài: 2, mấy: 2, hàng: 2, một: 1, hai: 2, ba: 3, bốn: 4, năm: 5, sáu: 6, bảy: 7, tám: 8, chín: 9, mười: 10 }
  const amount = (values[match[1].toLowerCase()] ?? 1) * (match[2] ? 10 : 1)
  return amount * (match[3].toLowerCase() === 'tỷ' ? 1_000_000_000 : 1_000_000)
}

function mentionedEntries(text, pokedex = []) {
  return (pokedex ?? [])
    .filter((entry) => {
      const names = [entry?.name, entry?.species].map(normalizeName).filter((name) => name.length >= 3)
      return names.some((name) => containsWholeName(text, name))
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

function searchEncounterChance(entry, stage) {
  const catchRate = Number(entry?.catchRate)
  const base = Number.isFinite(catchRate)
    ? catchRate <= 45 ? 0.08 : catchRate <= 90 ? 0.12 : catchRate <= 150 ? 0.18 : 0.28
    : 0.12
  return Math.min(0.45, base + Math.max(0, Number(stage) - 3) * 0.05)
}

export function classifyRealisticInput({
  text,
  mode,
  adminMode = false,
  pokedex = [],
  worldProgress = null,
  money = 0,
  inventory = [],
  location = null,
  recentText = '',
  ownedPokemon = [],
  searchHistory = [],
  random = Math.random,
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
  const isPokemonSearch = POKEMON_SEARCH_WORDS.test(raw)
  const previousSearch = [...(searchHistory ?? [])].reverse().find((entry) =>
    Array.isArray(entry?.targets) && entry.targets.length > 0,
  ) ?? null
  const followsClue = !isPokemonSearch && Boolean(previousSearch) && FOLLOW_CLUE_WORDS.test(raw)
  const claimsOwnership = OWNERSHIP_ASSERTIONS.some((pattern) => pattern.test(raw)) || GUARANTEE_WORDS.test(raw)
  const assertsEncounter = ENCOUNTER_ASSERTIONS.some((pattern) => pattern.test(raw))
  const assertsResult = claimsOwnership || assertsEncounter
  const searchTargets = isPokemonSearch
    ? mentions.map((entry) => entry.name).filter(Boolean)
    : followsClue ? [...previousSearch.targets] : []
  const previousStage = searchTargets.length
    ? Math.max(0, ...(searchHistory ?? []).filter((entry) =>
      (entry?.targets ?? []).some((target) => searchTargets.some((current) => normalizeName(current) === normalizeName(target))),
    ).map((entry) => Number(entry.stage) || 0))
    : 0
  const searchStage = searchTargets.length ? previousStage + 1 : 0
  const searchedEntry = searchTargets.length
    ? (pokedex ?? []).find((entry) => searchTargets.some((target) => normalizeName(target) === normalizeName(entry.name)))
    : null
  // Gõ lại “đi tìm X” luôn chỉ là tìm chung. Chỉ một hành động THEO MANH
  // MỐI cụ thể từ bước 3 trở đi mới có cơ hội mở encounter, với tỉ lệ thấp
  // theo catch rate; trượt vẫn chỉ nhận thêm manh mối hoặc mất dấu.
  const encounterChance = followsClue && searchStage >= 3 ? searchEncounterChance(searchedEntry, searchStage) : 0
  const encounterEligible = encounterChance > 0 && Math.max(0, Math.min(0.999999, Number(random()) || 0)) < encounterChance
  const searchGate = searchTargets.length > 0 ? {
    blockEncounterThisTurn: !encounterEligible,
    blockPokemonAcquisitionThisTurn: !encounterEligible,
    searchTargets,
    searchStage,
    followsClue,
    encounterChance,
    encounterEligible,
  } : {}
  const hasResources = BIG_BUDGET.test(raw) || Number(money) >= 10_000_000
  const place = location?.areaKey || location?.regionKey || 'địa điểm hiện tại'

  const badgeClaim = raw.match(BADGE_COUNT_CLAIM)
  const questClaim = raw.match(QUEST_COUNT_CLAIM)
  const moneyClaim = raw.match(MONEY_COUNT_CLAIM)
  const rareItemClaim = raw.match(RARE_ITEM_CLAIM)
  const claimedMoney = moneyClaim ? (() => {
    const scale = moneyClaim[2]?.toLowerCase() === 'tỷ' ? 1_000_000_000 : moneyClaim[2] ? 1_000_000 : 1
    const rawNumber = moneyClaim[1]
    const numeric = scale > 1 && /^[0-9]+[.,][0-9]{1,2}$/.test(rawNumber)
      ? Number(rawNumber.replace(',', '.'))
      : Number(rawNumber.replace(/[.,]/g, ''))
    return numeric * scale
  })() : null
  const claimedWrittenMoney = BIG_MONEY_ASSERTION.test(raw) ? approximateWrittenMoneyClaim(raw) : null
  const claimedRareQty = rareItemClaim ? Math.max(1, Number(rareItemClaim[1]) || 1) : 0
  const claimedRareName = rareItemClaim?.[2]?.toLowerCase() ?? ''
  const claimedRareKey = normalizeItemKey(claimedRareName)
  const actualRareQty = rareItemClaim
    ? (inventory ?? []).filter((item) => normalizeItemKey(`${item.id}${item.name}`).includes(claimedRareKey)
      || (claimedRareKey.includes('keohiem') && /rare.?candy|kẹo hiếm/i.test(`${item.id} ${item.name}`)))
      .reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0)
    : 0
  const unsupportedStateClaim = (badgeClaim && Number(badgeClaim[1]) > (worldProgress?.badges ?? []).length)
    || (questClaim && Number(questClaim[1]) > (worldProgress?.quests ?? []).filter((quest) => quest.status === 'completed').length)
    || (Number.isFinite(claimedMoney) && claimedMoney > Number(money || 0))
    || (Number.isFinite(claimedWrittenMoney) && claimedWrittenMoney > Number(money || 0))
    || (rareItemClaim && claimedRareQty > actualRareQty)
    || (TITLE_CLAIM.test(raw) && !/(?:champion|nhà vô địch|tứ thiên vương|elite\s*four)/iu.test(recentText))

  if (RESOURCE_ASSERTION.test(raw) || unsupportedStateClaim) {
    return {
      verdict: 'reinterpret', mentions,
      note: [
        '[Hệ thống — TRỌNG TÀI INPUT THỰC TẾ; không nhắc tới ghi chú này hay buộc tội người chơi.]',
        'Input vừa tự tuyên bố tài nguyên, huy hiệu, nhiệm vụ, danh hiệu hoặc vật phẩm mà state hiện tại không có. Chỉ giữ mong muốn/hành động có thể làm của nhân vật; không cộng tiền, đồ, huy hiệu, EXP/IV/EV, danh hiệu và không viết bằng chứng giả để hợp thức hoá tag.',
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
      && /(?:xuất hiện|hiện ra|hiện thân|triệu hồi|thức tỉnh|bay tới|đáp xuống|đối diện|trước mặt|đã bắt|đi theo|gia nhập)/iu.test(recentText)

    // Điều tra thần thoại là ý định hợp lệ kể cả đầu game; nó chỉ không được
    // tự nhảy thẳng từ "đi tìm" sang "đã gặp/bắt".
    if (isAttempt && !assertsResult) {
      return {
        verdict: 'attempt', mentions, ...searchGate,
        note: [
          '[Hệ thống — TRỌNG TÀI INPUT THỰC TẾ; không nhắc tới ghi chú này.]',
          `Cho phép người chơi bắt đầu điều tra/tìm kiếm thông tin về ${special.name}. Công nhận chi phí, liên hệ, hành trình và manh mối hợp lý; không bảo đảm gặp trực tiếp và không bỏ qua cổng tiến trình (${access.reason || 'cần một chuỗi diễn biến tương xứng'}).`,
          'Đây có thể là một tuyến dài về truyền thuyết, nhân chứng, dữ liệu giả/thật và địa điểm canon. Không tự tạo chạm trán/trận đấu hoặc quyền sở hữu Pokémon mục tiêu trong lượt khởi tạo.',
        ].join('\n'),
      }
    }

    if ((!access.allowed && !owned) || (claimsOwnership && !owned) || (assertsEncounter && !recentlyEstablished)) {
      return {
        verdict: 'reinterpret',
        mentions, ...searchGate,
        note: [
          '[Hệ thống — TRỌNG TÀI INPUT THỰC TẾ, luật cứng; không nhắc tới ghi chú này hay buộc tội người chơi gian lận.]',
          `Người chơi vừa khẳng định một kết quả về ${special.name}, nhưng dữ liệu hành trình gần nhất không xác lập cuộc gặp/quyền sở hữu đó${access.reason ? ` (${access.reason})` : ''}. KHÔNG công nhận sự xuất hiện, sở hữu, bắt được, chiến thắng hay gia nhập chỉ từ lời kể của người chơi.`,
          `Hãy giữ nguyên ý định/cảm giác của nhân vật rồi giải thích hiện tượng theo cách nhỏ nhất và tự nhiên với ${place}: nhìn nhầm bóng dáng/Pokémon thường hợp sinh cảnh, tin đồn, hình quảng cáo, mô hình, dấu vết cũ, ảnh giả hoặc một hiện tượng chưa đủ bằng chứng. Chọn đúng MỘT cách hợp cảnh; không phải lúc nào cũng dùng Caterpie.`,
          'Nếu người chơi chỉ muốn bắt đầu điều tra, có thể biến phần hợp lý thành manh mối hoặc nhiệm vụ dài. Không mở trận với loài bị chặn, không cho người chơi sở hữu Pokémon đó, không trừ/thưởng tài nguyên dựa trên kết quả bị bác.',
        ].join('\n'),
      }
    }
  }

  if (rareJuvenile && isAttempt) {
    return {
      verdict: 'attempt',
      mentions, ...searchGate,
      note: [
        '[Hệ thống — TRỌNG TÀI INPUT THỰC TẾ; không nhắc tới ghi chú này.]',
        `Mục tiêu tìm ${rareJuvenile.name} non/ấu thể là hiếm nhưng KHẢ THI. ${hasResources ? 'Người chơi đã nêu nguồn lực lớn, nên có thể thuê một mạng lưới tìm kiếm nghiêm túc.' : 'Nguồn lực hiện nêu chưa đủ để bảo đảm một chiến dịch quy mô lớn.'}`,
        'Chỉ công nhận HÀNH ĐỘNG khởi tạo: thương lượng hợp đồng, đặt cọc, xin giấy phép, thuê chuyên gia và mở nhiệm vụ nhiều giai đoạn. Tiền mua thời gian, nhân lực và manh mối — tuyệt đối không mua xác suất 100%, không tự bắt được Pokémon trong cùng lượt.',
        'Tính tới sinh cảnh, mùa, luật bảo tồn, lừa đảo, phúc lợi Pokémon và quyền từ chối của cá thể. Chỉ trừ tiền khi chính văn xác nhận giao dịch thật đã hoàn tất; Semantic State Engine sẽ tự đồng bộ.',
      ].join('\n'),
    }
  }

  if (rareJuvenile && assertsResult) {
    return {
      verdict: 'reinterpret',
      mentions, ...searchGate,
      note: [
        '[Hệ thống — TRỌNG TÀI INPUT THỰC TẾ; không nhắc tới ghi chú này.]',
        `Không công nhận việc ${rareJuvenile.name} tự xuất hiện/bị bắt/chuyển quyền sở hữu chỉ do người chơi tuyên bố. Tuy nhiên đây không phải thần thoại bất khả tiếp cận: chuyển phần hợp lý thành dấu vết, đầu mối môi giới hoặc cơ hội mở một cuộc tìm kiếm có chi phí và rủi ro.`,
        'Không chế giễu người chơi, không phá ý định; chỉ tách Ý ĐỊNH khỏi KẾT QUẢ và để kết quả được quyết định bởi diễn biến thật.',
      ].join('\n'),
    }
  }

  // Cổng chung cho MỌI loài được gọi đích danh. Trước đây chỉ Legendary và
  // pseudo-legendary bị chặn, nên “đi tìm Ditto” có thể lập tức sinh Ditto
  // ngay dưới cống. Lượt khởi tạo tìm kiếm chỉ được trả manh mối hoặc thất bại.
  if (searchTargets.length > 0) {
    const targetLabel = searchTargets.join(', ')
    if (encounterEligible) {
      return {
        verdict: 'attempt', mentions, ...searchGate,
        note: [
          '[Hệ thống — TIẾN TRÌNH TÌM KIẾM POKÉMON Ở CHẾ ĐỘ THỰC TẾ; không nhắc tới ghi chú này.]',
          `Người chơi đang theo một manh mối cụ thể về ${targetLabel} ở bước ${searchStage}. Lần phân xử xác suất này cho phép một encounter trở thành KHẢ NĂNG, không phải kết quả bắt buộc.`,
          'Chỉ cho mục tiêu thật sự xuất hiện nếu địa điểm, sinh cảnh, thời điểm và manh mối trong chính văn khớp nhau; nếu không khớp, tiếp tục cho dấu vết sai/mất dấu. Dù gặp được, Pokémon vẫn có thể trốn, giả dạng, từ chối hoặc chống trả; tuyệt đối không tự động bị bắt hay gia nhập.',
        ].join('\n'),
      }
    }
    return {
      verdict: assertsResult ? 'reinterpret' : 'attempt', mentions, ...searchGate,
      note: [
        '[Hệ thống — CỔNG TÌM KIẾM POKÉMON Ở CHẾ ĐỘ THỰC TẾ; không nhắc tới ghi chú này.]',
        `Người chơi đang ${followsClue ? `theo manh mối ở bước ${searchStage}` : 'khởi tạo việc tìm'} ${targetLabel}. Trong CHÍNH LƯỢT NÀY, tuyệt đối không cho Pokémon mục tiêu xuất hiện trực tiếp, không nhìn thấy tận mắt, không chạm trán, không mở trận, không bắt/nhận và không xác lập quyền sở hữu Pokémon mục tiêu.`,
        `Kết quả hợp lệ chỉ là (a) KHÔNG tìm thấy gì đáng tin, hoặc (b) một MANH MỐI GIÁN TIẾP chưa đủ xác nhận như lời đồn, hồ sơ, dấu vết mơ hồ, nhân chứng không chắc chắn hay dấu hiệu có thể thuộc loài khác. Không được đặt ${targetLabel} ngay tại nơi người chơi đoán chỉ để thưởng cho hành động tìm kiếm.`,
        `Xét sinh cảnh, vùng, thời điểm, thời tiết, độ hiếm, khả năng ngụy trang/di chuyển và chất lượng phương pháp tìm. Muốn tiến thêm, người chơi phải chủ động theo một manh mối cụ thể ở lượt sau; mỗi bước vẫn có thể mất dấu hoặc đi sai hướng. Chỉ từ bước 3, hành động theo manh mối mới bắt đầu có xác suất thấp mở encounter; ${encounterChance > 0 ? `lượt này đã trượt lần phân xử ${Math.round(encounterChance * 100)}%` : 'tìm chung không được roll encounter'}.`,
        assertsResult ? 'Phần input tự khẳng định đã thấy/tìm được là kết quả ngoài quyền nhân vật: diễn giải lại thành nghi ngờ hoặc dấu hiệu chưa xác minh, không biến nó thành bằng chứng.' : '',
      ].filter(Boolean).join('\n'),
    }
  }

  // Một input hợp lệ có thể mạnh/bất ngờ. Trọng tài không được biến mọi câu
  // chủ động thành gian lận: chỉ can thiệp vào tài sản/kết quả hiếm đặc biệt.
  return { verdict: 'accept', note: '', mentions }
}

export function buildInputAdjudicationNote(options) {
  return classifyRealisticInput(options).note
}

/** Bản nháp AI có phá cổng tìm kiếm của chính lượt này không. */
export function responseViolatesSearchGate(text, adjudication = {}) {
  if (!adjudication.blockEncounterThisTurn) return false
  const raw = String(text ?? '')
  if (/\[\[\s*(?:BATTLE|POKEMON)\b/iu.test(raw)) return true
  const directEncounter = /(?:bắt gặp|tìm thấy|phát hiện|nhìn thấy|trông thấy|chạm trán|gặp được|xuất hiện|lộ diện|hiện ra|nhảy ra|bò ra|ở ngay trước mặt)/iu
  const negated = /(?:không|chưa|chẳng|không hề).{0,24}(?:bắt gặp|tìm thấy|phát hiện|nhìn thấy|trông thấy|chạm trán|gặp được)/iu
  const clueOnly = /(?:manh mối|dấu vết|tin đồn|lời đồn|hồ sơ|nhân chứng|camera|đoạn ghi hình|hình ảnh|không chắc|chưa xác minh|có thể|dường như|nghi là)/iu
  for (const sentence of raw.split(/(?<=[.!?…])\s+|\n+/).filter(Boolean)) {
    const targets = (adjudication.searchTargets ?? []).filter((target) => containsWholeName(sentence, target))
    if (!targets.length) continue
    if (negated.test(sentence) && !/(?:nhưng|tuy nhiên|bất chợt|đột nhiên)/iu.test(sentence)) continue
    for (const target of targets) {
      const name = escapeRegExp(normalizeName(target))
      const foundTarget = new RegExp(`(?:bắt gặp|tìm thấy|phát hiện|nhìn thấy|trông thấy|chạm trán|gặp được)\\s+(?:ngay\\s+)?(?:một\\s+)?(?:con\\s+)?${name}(?=$|[^\\p{L}\\p{N}])`, 'iu')
      const targetAppears = new RegExp(`(?:^|[^\\p{L}\\p{N}])${name}(?=$|[^\\p{L}\\p{N}])[^.!?…]{0,30}(?:xuất hiện|lộ diện|hiện ra|nhảy ra|bò ra|ở ngay trước mặt)`, 'iu')
      if (foundTarget.test(sentence) || (targetAppears.test(sentence) && !clueOnly.test(sentence))) return true
    }
    if (directEncounter.test(sentence) && !clueOnly.test(sentence)) return true
  }
  return false
}

export function buildSearchGateCorrection(adjudication = {}) {
  const targets = (adjudication.searchTargets ?? []).join(', ') || 'Pokémon mục tiêu'
  return `[Hệ thống — BẢN NHÁP VỪA VI PHẠM CỔNG TÌM KIẾM THỰC TẾ. Hãy viết lại TOÀN BỘ phản hồi cho cùng input. Lượt này chỉ được: không tìm thấy gì, hoặc có một manh mối gián tiếp chưa xác minh về ${targets}. Không cho mục tiêu xuất hiện trực tiếp/tận mắt, không chạm trán, không BATTLE, không bắt/nhận, không POKEMON tag. Giữ văn phong và các chi tiết hợp lệ khác; trả lại chính văn hoàn chỉnh cùng khối lựa chọn nếu giao thức yêu cầu. Không nhắc tới việc sửa bản nháp hay ghi chú này.]`
}

/** Chốt cuối nếu provider vẫn bỏ qua cả lần nhắc sửa hoặc lần gọi sửa lỗi. */
export function buildSearchGateFallback(adjudication = {}, place = '') {
  const targets = (adjudication.searchTargets ?? []).join(', ') || 'Pokémon mục tiêu'
  const where = place ? ` quanh ${place}` : ''
  return `Bạn dành thời gian dò tìm ${targets}${where}, kiểm tra những nơi có vẻ khả nghi và hỏi thăm vài nguồn có thể biết chuyện. Tuy vậy, cuộc tìm kiếm lần này không đem lại dấu vết nào đủ đáng tin để xác nhận ${targets} từng ở đây. Những gì còn lại đều quá mơ hồ để theo tiếp ngay; nếu muốn tiếp tục, bạn sẽ cần đổi phương pháp, tìm nguồn tin cụ thể hơn hoặc thử lại vào một thời điểm thích hợp.`
}
