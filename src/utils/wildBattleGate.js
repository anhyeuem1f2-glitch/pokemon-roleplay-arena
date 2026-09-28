// Wild encounter gate (Dot147)
// Pure helper so the story pipeline can stop prose exactly when a concrete
// wild Pokémon appears. No battle state is mutated here.

const DIRECT_WILD_ENCOUNTER_RE = /(pok[eé]mon\s+hoang|hoang\s+dã|wild\s+pok[eé]mon|wild\s+[a-z]|野生(?:宝可梦|精灵)?|lộ\s*diện|hiện\s+nguyên\s+hình|xuất\s+hiện|lao\s+(?:ra|tới|vào)|đối\s+diện|trước\s+mặt|appears?|emerges?|leaps?\s+out|rushes?\s+(?:out|toward)|出现|现身|冲出|扑出|窜出|对峙)/iu
const WILD_LORE_ONLY_RE = /(thường\s+gặp|sinh\s+sống|phân\s+bố|có\s+thể\s+gặp|môi\s+trường\s+sống|habitat|inhabit|commonly\s+found|can\s+be\s+found|栖息|分布|图鉴|生态)/iu

function battleOpponentAliases(entry, detectOptions = {}) {
  if (!entry) return []
  const names = [entry.name, entry.species].filter(Boolean).map(String)
  const num = Number(entry.num)
  if (Number.isFinite(num)) {
    const localized = detectOptions.localizedNamesByNum?.[String(num)] ?? detectOptions.localizedNamesByNum?.[num]
    if (localized) names.push(String(localized))
  }
  const canonicalKey = String(entry.name ?? entry.species ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  const byCanonical = canonicalKey ? detectOptions.localizedNamesByCanonical?.[canonicalKey] : null
  if (byCanonical) names.push(String(byCanonical))
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))]
}

/**
 * Return the character offset immediately after the paragraph where a concrete
 * wild opponent becomes a direct encounter. -1 means "not a direct encounter".
 */
export function directWildEncounterBoundary(text, opponent, detectOptions = {}) {
  const source = String(text ?? '')
  if (!source || !opponent) return -1
  const aliases = battleOpponentAliases(opponent, detectOptions)
  if (!aliases.length) return -1

  const paragraphRe = /[^\r\n]+(?:\r?\n(?!\r?\n)[^\r\n]+)*/g
  let match
  while ((match = paragraphRe.exec(source)) !== null) {
    const paragraph = match[0]
    const lower = paragraph.toLowerCase()
    if (!aliases.some((alias) => lower.includes(alias.toLowerCase()))) continue
    if (WILD_LORE_ONLY_RE.test(paragraph)) continue
    if (DIRECT_WILD_ENCOUNTER_RE.test(paragraph)) return match.index + paragraph.length
  }
  return -1
}
