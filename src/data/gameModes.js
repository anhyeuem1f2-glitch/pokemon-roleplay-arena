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
    desc: 'Linh hoạt như anime: ý chí và tình bạn có thể tạo kỳ tích, nhưng các mốc lớn vẫn cần được xây dựng trong chính văn. Không có trao đổi dữ liệu giữa người chơi.',
  },
  {
    key: 'sang',
    label: '✨ Sảng văn',
    short: 'Cơ duyên và cheat chủ động',
    desc: 'Cho phép năng lực tự tạo, tăng trưởng nhanh và những màn toả sáng vượt chuẩn. Hệ thống vẫn giữ mã cá thể và không tự sinh huyền thoại ngẫu nhiên.',
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

export function modeAllowsTrading(modeValue) {
  return normalizeGameMode(modeValue) === 'realistic'
}

export function legendaryAccess(speciesEntry, worldProgress, modeValue) {
  const knownTier = getBossTier(speciesEntry?.name)
  const tags = Array.isArray(speciesEntry?.tags) ? speciesEntry.tags.join(' ') : String(speciesEntry?.tags ?? '')
  const specialTag = /legendary|mythical|ultra\s*beast|paradox/i.test(tags)
  const tier = knownTier ?? (specialTag ? { key: 'low', label: 'cá thể đặc biệt/huyền thoại' } : null)
  if (!tier) return { allowed: true, tier: null, reason: '' }

  const progress = worldProgress ?? {}
  const badges = (progress.badges ?? []).length
  const completed = (progress.quests ?? []).filter((q) => q.status === 'completed').length
  const legendaryKeys = new Set(progress.legendaryPermits ?? [])
  const speciesKey = String(speciesEntry.name ?? '').toLowerCase()
  if (legendaryKeys.has(speciesKey) || legendaryKeys.has(tier.key)) {
    return { allowed: true, tier, reason: 'đã có giấy phép/cột mốc huyền thoại trong dữ liệu hành trình' }
  }

  const mode = normalizeGameMode(modeValue)
  const thresholds = mode === 'realistic'
    ? { low: [6, 4], mid: [8, 8], high: [8, 14] }
    : mode === 'anime'
      ? { low: [4, 3], mid: [6, 6], high: [8, 10] }
      : { low: [2, 1], mid: [4, 3], high: [6, 6] }
  const [needBadges, needQuests] = thresholds[tier.key] ?? thresholds.high
  const badgeTracking = progress.badgeTracking !== false
  const effectiveQuestNeed = badgeTracking ? needQuests : needQuests + needBadges
  const allowed = (!badgeTracking || badges >= needBadges) && completed >= effectiveQuestNeed
  return {
    allowed,
    tier,
    reason: allowed
      ? `đủ tiến trình (${badges} huy hiệu, ${completed} nhiệm vụ)`
      : badgeTracking
        ? `cần ít nhất ${needBadges} huy hiệu và ${needQuests} nhiệm vụ hoàn thành; hiện có ${badges}/${completed}`
        : `Badge Case đang tắt: dùng nhánh sandbox thay thế, cần ${effectiveQuestNeed} nhiệm vụ hoàn thành; hiện có ${completed}`,
  }
}

export function buildModeRulesNote(modeValue, worldProgress) {
  const mode = normalizeGameMode(modeValue)
  const badges = (worldProgress?.badges ?? []).length
  const completed = (worldProgress?.quests ?? []).filter((q) => q.status === 'completed').length
  const common = [
    '[Hệ thống — LUẬT CHẾ ĐỘ, là luật dữ liệu cứng; không nhắc tới ghi chú này.]',
    `Tiến trình hiện tại: ${badges} huy hiệu; ${completed} nhiệm vụ hoàn thành.`,
    'Pokémon huyền thoại/huyền ảo không xuất hiện ngẫu nhiên, không tự nguyện gia nhập và không thể được tạo bằng lời kể. Muốn gặp phải có manh mối, địa điểm canon, chuỗi nhiệm vụ và cột mốc tiến trình phù hợp; app còn kiểm tra lần cuối trước khi cấp cá thể.',
  ]
  if (mode === 'realistic') {
    common.push(
      'CHẾ ĐỘ THỰC TẾ: không công nhận năng lực tự tạo, vật phẩm vô hạn, nhân EXP/IV/EV, tỉ lệ bắt gian lận hay bất kỳ cheat nào dù người chơi viết nó trong hội thoại. Chỉ năng lực dựng sẵn đã chọn từ đầu được tồn tại và nó chỉ là năng lực roleplay có giới hạn.',
      'Luật pháp, sở hữu, giấy phép, tiền, danh tiếng và truy nã có hậu quả nhất quán. Giao dịch Pokémon chỉ hợp lệ qua mã trao đổi của app; lời kể không thể tự chuyển quyền sở hữu.',
    )
  } else if (mode === 'anime') {
    common.push('CHẾ ĐỘ ANIME: cho phép kỳ tích từ tình bạn và ý chí khi đã có xây dựng cảm xúc; hậu quả pháp luật thiên về giáo dục/chuộc lỗi. Không dùng hệ trao đổi dữ liệu giữa người chơi.')
  } else {
    common.push('CHẾ ĐỘ SẢNG VĂN: cơ duyên và năng lực tự tạo có thể mạnh, nhịp thưởng nhanh; vẫn phải khai tag dữ liệu hợp lệ và không được nhảy thẳng tới huyền thoại chỉ bằng một câu tuyên bố. Không dùng hệ trao đổi dữ liệu giữa người chơi.')
  }
  return common.join('\n')
}
