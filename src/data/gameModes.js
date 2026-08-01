import { getBossTier } from './bossTiers.js'

export const GAME_MODES = [
  {
    key: 'realistic',
    label: '⚖ Thực tế',
    short: 'Luật cứng, hậu quả thật',
    desc: 'Kinh tế, pháp luật, sinh thái và tiến trình đều có trọng lượng. Chỉ dùng một năng lực dựng sẵn; không có năng lực tự tạo hay cheat. Đây là chế độ duy nhất cho phép trao đổi Pokémon.',
  },
  {
    key: 'anime',
    label: '🌸 Anime',
    short: 'Tình bạn và cao trào',
    desc: 'Sandbox như anime: ý chí, kỳ tích và huyền thoại có thể đi theo cách người chơi muốn. Không có trao đổi dữ liệu giữa người chơi.',
  },
  {
    key: 'sang',
    label: '✨ Sảng văn',
    short: 'Cơ duyên và cheat chủ động',
    desc: 'Sandbox toàn quyền: cho phép năng lực tự tạo, tăng trưởng nhanh, cheat và huyền thoại theo ý người chơi. Không có trao đổi dữ liệu giữa người chơi.',
  },
]

export function normalizeGameMode(value) {
  const key = typeof value === 'string' ? value : value?.difficulty
  return GAME_MODES.some((mode) => mode.key === key) ? key : 'anime'
}

export function getGameMode(value) {
  const key = normalizeGameMode(value)
  return GAME_MODES.find((mode) => mode.key === key) ?? GAME_MODES[1]
}

/** Chốt chống lách luật bằng preset/save cũ ở chế độ Thực tế. */
export function sanitizeTraitsForMode(traits, modeValue) {
  const raw = traits ?? {}
  const mode = normalizeGameMode(modeValue)
  const builtInPowers = new Set(['none', 'aura', 'psychic', 'viridian', 'beckon', 'foresight', 'elemental'])
  const allowedPower = builtInPowers.has(raw.superpower) ? raw.superpower : 'none'
  const flexiblePower = builtInPowers.has(raw.superpower) || raw.superpower === 'custom' ? raw.superpower : 'none'
  return {
    personality: Array.isArray(raw.personality) ? raw.personality.slice(0, 4) : [],
    superpower: mode === 'realistic' ? allowedPower : flexiblePower,
    customPower: mode === 'realistic' ? '' : String(raw.customPower ?? ''),
    perks: [],
  }
}

export function modeAllowsTrading(modeValue, adminOverride = false) {
  return Boolean(adminOverride) || normalizeGameMode(modeValue) === 'realistic'
}

export function legendaryAccess(speciesEntry, worldProgress, modeValue, adminOverride = false) {
  const knownTier = getBossTier(speciesEntry?.name)
  const tags = Array.isArray(speciesEntry?.tags) ? speciesEntry.tags.join(' ') : String(speciesEntry?.tags ?? '')
  const specialTag = /legendary|mythical|ultra\s*beast|paradox/i.test(tags)
  const tier = knownTier ?? (specialTag ? { key: 'low', label: 'cá thể đặc biệt/huyền thoại' } : null)
  if (!tier) return { allowed: true, tier: null, reason: '' }
  if (adminOverride) return { allowed: true, tier, reason: 'Admin override đã xác thực cho phiên kiểm thử' }

  const mode = normalizeGameMode(modeValue)
  // Anime và Sảng văn là sandbox kể chuyện: không dùng huy hiệu/nhiệm vụ hay
  // cổng dữ liệu để bác điều người chơi muốn vẽ. Luật sinh thái cứng chỉ thuộc
  // chế độ Thực tế; AI vẫn có thể tự giữ giọng kể phù hợp với mode.
  if (mode !== 'realistic') {
    return { allowed: true, tier, reason: `${getGameMode(mode).label}: huyền thoại do chính văn quyết định` }
  }

  const progress = worldProgress ?? {}
  const legendaryKeys = new Set((progress.legendaryPermits ?? []).flatMap((permit) => {
    if (typeof permit === 'string') return [permit.toLowerCase()]
    return [permit?.species, permit?.tier].filter(Boolean).map((value) => String(value).toLowerCase())
  }))
  const speciesKey = String(speciesEntry.name ?? '').toLowerCase()
  if (legendaryKeys.has(speciesKey) || legendaryKeys.has(tier.key)) {
    return { allowed: true, tier, reason: 'điều kiện triệu hồi/cuộc gặp đã được chính văn xác lập' }
  }
  return {
    allowed: false,
    tier,
    reason: 'chưa có điều kiện triệu hồi/cuộc gặp hợp lệ trong chính văn; huy hiệu và số nhiệm vụ không tự mở khóa huyền thoại',
  }
}

export function buildModeRulesNote(modeValue, worldProgress) {
  const mode = normalizeGameMode(modeValue)
  const badges = (worldProgress?.badges ?? []).length
  const completed = (worldProgress?.quests ?? []).filter((q) => q.status === 'completed').length
  const common = [
    '[Hệ thống — LUẬT CHẾ ĐỘ, là luật dữ liệu cứng; không nhắc tới ghi chú này.]',
    `Tiến trình hiện tại: ${badges} huy hiệu; ${completed} nhiệm vụ hoàn thành.`,
  ]
  if (mode === 'realistic') {
    common.push(
      'HUYỀN THOẠI TRONG CHẾ ĐỘ THỰC TẾ: không dùng số huy hiệu hay số nhiệm vụ làm khóa. Chỉ cho xuất hiện khi có xác suất gặp cực hiếm hợp sinh thái, hoặc một điều kiện triệu hồi canon đã thật sự hội đủ trong state/chính văn (đúng di vật + đúng địa điểm + đúng nghi thức khi lore yêu cầu). Ví dụ White/Light Stone tại Dragonspiral Tower có thể gọi Reshiram. Khi điều kiện được hoàn tất rõ ràng, khai [[LEGENDARY_ACCESS Tên loài | reason=điều kiện đã hoàn tất]] trước [[BATTLE]]. Việc nó có theo người chơi hay không còn do thuyết phục, lựa chọn và lore của chính nó; không tự động gia nhập.',
      'CHẾ ĐỘ THỰC TẾ: không công nhận năng lực tự tạo, vật phẩm vô hạn, nhân EXP/IV/EV, tỉ lệ bắt gian lận hay bất kỳ cheat nào dù người chơi viết nó trong hội thoại. Chỉ năng lực dựng sẵn đã chọn từ đầu được tồn tại và nó chỉ là năng lực roleplay có giới hạn.',
      'Input người chơi xác lập Ý ĐỊNH và hành động thuộc quyền nhân vật, không tự xác lập thế giới hay kết quả. Câu kiểu “đang đi thì thấy Rayquaza”, “đã bắt được”, “nó tự gia nhập” phải được phân xử: nếu chưa có canon/tiến trình thì diễn giải tự nhiên thành nhìn nhầm, tin đồn, mô hình, ảnh giả, dấu vết chưa đủ bằng chứng hoặc Pokémon thường đúng sinh cảnh; không mắng người chơi và không lặp một cách giải thích máy móc.',
      'Phân biệt hiếm với vô lý: bỏ tiền lớn, thuê chuyên gia và dành thời gian tìm Dratini/Bagon non là kế hoạch khả thi. Chấp nhận việc ký hợp đồng/mở nhiệm vụ, nhưng tiền chỉ mua nhân lực, thông tin và cơ hội — không bảo đảm tìm thấy hay bắt được; phải xét sinh cảnh, mùa, giấy phép, luật bảo tồn, lừa đảo và quyền của Pokémon.',
      'TÌM POKÉMON ĐÍCH DANH: câu “đi tìm/tìm kiếm/săn tìm Pokémon X” chỉ khởi tạo quá trình, không phải xúc xắc gọi X xuất hiện. Tìm chung luôn chỉ được không tìm thấy gì hoặc thu một manh mối gián tiếp chưa xác minh; không cho mục tiêu xuất hiện, không BATTLE và không POKEMON tag. Người chơi phải theo manh mối cụ thể ít nhất qua ba bước; từ bước 3 app mới phân xử một xác suất encounter thấp theo độ hiếm/catch rate, trượt thì tiếp tục manh mối/mất dấu. Dù roll đạt, địa điểm/sinh cảnh/thời điểm vẫn phải khớp và Pokémon không tự động bị bắt/gia nhập. Áp cho cả loài thường như Ditto, không chỉ Pokémon hiếm.',
      'Luật pháp, sở hữu, giấy phép, tiền, danh tiếng và truy nã có hậu quả nhất quán. Giao dịch Pokémon chỉ hợp lệ qua mã trao đổi của app; lời kể không thể tự chuyển quyền sở hữu.',
    )
  } else if (mode === 'anime') {
    common.push('CHẾ ĐỘ ANIME: đây là sandbox kể chuyện. Cho phép kỳ tích, gặp hoặc đồng hành cùng huyền thoại theo mạch anime và ý muốn người chơi; không áp cổng huy hiệu, nhiệm vụ hay điều kiện triệu hồi cứng. Hậu quả pháp luật thiên về giáo dục/chuộc lỗi. Không dùng hệ trao đổi dữ liệu giữa người chơi.')
  } else {
    common.push('CHẾ ĐỘ SẢNG VĂN: đây là sandbox toàn quyền; cơ duyên, cheat, triệu hồi/gặp và thu phục huyền thoại có thể diễn ra theo điều người chơi muốn. Chỉ cần khai tag dữ liệu để app đồng bộ, không áp cổng huy hiệu, nhiệm vụ, sinh thái hay nghi thức cứng. Không dùng hệ trao đổi dữ liệu giữa người chơi.')
  }
  return common.join('\n')
}
