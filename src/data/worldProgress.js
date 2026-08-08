import { normalizeGameMode } from './gameModes.js'

export const DEFAULT_WORLD_PROGRESS = {
  badgeTracking: true,
  badges: [],
  quests: [],
  factions: [],
  wanted: { level: 0, bounty: 0, regions: [], history: [] },
  legendaryPermits: [],
}

const idPart = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9à-ỹ]+/gi, '-').replace(/^-|-$/g, '')
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0))

export function normalizeWorldProgress(value) {
  const raw = value ?? {}
  return {
    ...DEFAULT_WORLD_PROGRESS,
    ...raw,
    badgeTracking: raw.badgeTracking !== false,
    badges: Array.isArray(raw.badges) ? raw.badges.map((item) => ({ ...item })) : [],
    quests: Array.isArray(raw.quests) ? raw.quests.map((item) => ({ ...item })) : [],
    factions: Array.isArray(raw.factions) ? raw.factions.map((item) => ({ ...item })) : [],
    wanted: {
      ...DEFAULT_WORLD_PROGRESS.wanted,
      ...(raw.wanted ?? {}),
      regions: [...(raw.wanted?.regions ?? [])],
      history: (raw.wanted?.history ?? []).map((item) => ({ ...item })),
    },
    legendaryPermits: Array.isArray(raw.legendaryPermits) ? [...raw.legendaryPermits] : [],
  }
}

function parseFields(fields) {
  const out = {}
  for (const segment of String(fields ?? '').split('|')) {
    const at = segment.indexOf('=')
    if (at <= 0) continue
    out[segment.slice(0, at).trim().toLowerCase()] = segment.slice(at + 1).trim()
  }
  return out
}

export function parseBadgeDirective(name, fields = '') {
  const data = parseFields(fields)
  return { id: `badge-${idPart(data.region)}-${idPart(name)}`, name: String(name).trim(), region: data.region ?? '', gym: data.gym ?? '', leader: data.leader ?? '' }
}

export function parseQuestDirective(id, fields = '') {
  const data = parseFields(fields)
  return {
    id: idPart(id) || `quest-${Date.now().toString(36)}`,
    status: ['active', 'completed', 'failed', 'paused'].includes(data.status) ? data.status : 'active',
    title: data.title ?? String(id).trim(),
    giver: data.giver ?? '',
    objective: data.objective ?? '',
    reward: data.reward ?? '',
    region: data.region ?? '',
  }
}

export function applyWorldDirectives(current, parsed, options = {}) {
  const next = normalizeWorldProgress(current)
  const mode = normalizeGameMode(options.mode)
  const turn = Number(options.turn) || 0
  const date = options.date ? { ...options.date } : null

  if (next.badgeTracking) {
    for (const badge of parsed.badges ?? []) {
      const at = next.badges.findIndex((item) => item.id === badge.id || item.name.toLowerCase() === badge.name.toLowerCase())
      const record = { ...badge, earnedTurn: turn, earnedDate: date }
      if (at >= 0) next.badges[at] = { ...next.badges[at], ...record }
      else next.badges.push(record)
    }
  }

  for (const quest of parsed.quests ?? []) {
    const at = next.quests.findIndex((item) => item.id === quest.id)
    const record = { ...(at >= 0 ? next.quests[at] : {}), ...quest, updatedTurn: turn, updatedDate: date }
    if (at >= 0) next.quests[at] = record
    else next.quests.push(record)
  }

  for (const rep of parsed.reputations ?? []) {
    const at = next.factions.findIndex((item) => item.name.toLowerCase() === rep.name.toLowerCase())
    const delta = Number(rep.delta) || 0
    if (at >= 0) next.factions[at] = { ...next.factions[at], reputation: clamp(next.factions[at].reputation + delta, -100, 100), note: rep.note || next.factions[at].note, updatedTurn: turn }
    else next.factions.push({ id: `faction-${idPart(rep.name)}`, name: rep.name, reputation: delta, note: rep.note ?? '', updatedTurn: turn })
  }

  for (const wanted of parsed.wanted ?? []) {
    const delta = Number(wanted.delta) || 0
    next.wanted.level = clamp(next.wanted.level + delta, 0, mode === 'realistic' ? 5 : 3)
    next.wanted.bounty = Math.max(0, next.wanted.bounty + clamp(wanted.bounty, -9999999, 9999999))
    if (wanted.region && !next.wanted.regions.includes(wanted.region)) next.wanted.regions.push(wanted.region)
    if (wanted.reason) next.wanted.history = [...next.wanted.history, { delta, reason: wanted.reason, region: wanted.region, turn, date }]
  }
  if (mode === 'realistic') {
    for (const access of parsed.legendaryAccess ?? []) {
      const species = String(access.species ?? '').trim().toLowerCase()
      if (!species) continue
      const record = { species, reason: access.reason ?? '', grantedTurn: turn, grantedDate: date }
      const at = next.legendaryPermits.findIndex((permit) => (typeof permit === 'string' ? permit : permit?.species) === species)
      if (at >= 0) next.legendaryPermits[at] = record
      else next.legendaryPermits.push(record)
    }
  }
  if (next.wanted.level === 0) {
    next.wanted.bounty = 0
    next.wanted.regions = []
  }
  return next
}

export function buildWorldProgressNote(progress, modeValue) {
  const state = normalizeWorldProgress(progress)
  const mode = normalizeGameMode(modeValue)
  const active = state.quests.filter((q) => q.status === 'active')
  const factions = state.factions.filter((f) => Math.abs(f.reputation) >= 10)
  return [
    '[Hệ thống — NHẬT KÝ THẾ GIỚI, dữ liệu đã xác lập; giữ nhất quán và không nhắc tới ghi chú này.]',
    `Chế độ: ${mode}. Huy hiệu: ${state.badges.length}${state.badgeTracking ? '' : ' (người chơi đã tắt theo dõi)'}.`,
    active.length ? `Nhiệm vụ đang làm: ${active.map((q) => `${q.title}${q.objective ? ` — ${q.objective}` : ''}`).join('; ')}.` : 'Không có nhiệm vụ đang hoạt động.',
    factions.length ? `Danh tiếng đáng chú ý: ${factions.map((f) => `${f.name} ${f.reputation > 0 ? '+' : ''}${f.reputation}`).join('; ')}.` : '',
    state.wanted.level > 0 ? `Truy nã cấp ${state.wanted.level}/5, tiền thưởng ${state.wanted.bounty}; vùng áp dụng: ${state.wanted.regions.join(', ') || 'chưa rõ'}. Cảnh sát/tổ chức phải phản ứng phù hợp.` : 'Không bị truy nã.',
  ].filter(Boolean).join('\n')
}

export function directorPriority(progress) {
  const state = normalizeWorldProgress(progress)
  if (state.wanted.level >= 3) return `Ưu tiên hệ quả truy nã cấp ${state.wanted.level}: kiểm tra giấy tờ, tuần tra, người dân dè chừng hoặc thợ săn tiền thưởng; không tạo biến cố ngẫu nhiên không liên quan.`
  const urgent = state.quests.find((q) => q.status === 'active' && /khẩn|gấp|deadline|trước/i.test(`${q.title} ${q.objective}`))
  if (urgent) return `Ưu tiên đẩy nhiệm vụ đang khẩn “${urgent.title}”; cho dấu hiệu hoặc hệ quả cụ thể, không giải hộ người chơi.`
  const active = state.quests.find((q) => q.status === 'active')
  if (active) return `Nếu cần thúc đẩy, ưu tiên một manh mối nhỏ cho nhiệm vụ “${active.title}” thay vì biến cố ngẫu nhiên.`
  return ''
}
