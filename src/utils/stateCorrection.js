// Dot149: evidence-backed, non-narrative Pokémon attribute correction.
// Proposals are NOT trusted as state. Only exact quotations from prior assistant
// canon can authorize a patch; the player must also confirm it in the UI.
import { genderRatioForSpecies, normalizePokemonGender } from '../data/pokemonGender.js'

const SUPPORTED_FIELDS = new Set(['gender', 'nickname', 'shiny'])
const GENDER_WORDS = {
  male: /(?:\bmale\b|♂|\bduc\b|\bđực\b|雄性|公的|公宝可梦|雄|公)/iu,
  female: /(?:\bfemale\b|♀|\bcai\b|\bcái\b|雌性|母的|母宝可梦|雌|母)/iu,
  unknown: /(?:genderless|无性别|無性別|vô giới tính)/iu,
}

export function parseCorrectionJson(raw) {
  const text = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try { return JSON.parse(text) } catch {
    const start = text.indexOf('{'), end = text.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try { return JSON.parse(text.slice(start, end + 1)) } catch { return null }
  }
}

export function normalizedQuote(value) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim()
}

export function validateCorrectionProposal(proposal, { mon, speciesEntry, canonMessages, aliases = [] } = {}) {
  if (!mon?.uid || !proposal || typeof proposal !== 'object') return { ok: false, error: 'Invalid Pokémon or proposal.' }
  if (proposal.targetUid !== mon.uid) return { ok: false, error: 'Proposal targets a different Pokémon UID.' }
  if (!SUPPORTED_FIELDS.has(proposal.field)) return { ok: false, error: 'Unsupported/unsafe field; no state was changed.' }
  const quote = normalizedQuote(proposal.evidenceQuote)
  if (quote.length < 5 || quote.length > 400) return { ok: false, error: 'Evidence quotation is absent or invalid.' }
  const evidenceSource = (canonMessages ?? []).find((message) => {
    if (message.role !== 'assistant' || message.hidden) return false
    return normalizedQuote(message.meta?.evidenceText || message.content).includes(quote)
  })
  if (!evidenceSource) return { ok: false, error: 'Evidence was not found verbatim in canonical assistant prose.' }
  // An evidence quotation must actually identify this species/individual.
  const names = [mon.species, mon.name, mon.nickname, ...aliases].filter(Boolean)
  const normalizeName = (value) => String(value ?? '').toLocaleLowerCase().replace(/[\s·・.()（）'’"“”\-—_:：]+/gu, '')
  if (!names.some((name) => normalizeName(quote).includes(normalizeName(name)))) {
    return { ok: false, error: 'Quotation does not identify this Pokémon; may refer to an NPC or another species.' }
  }
  let value = proposal.value
  if (proposal.field === 'gender') {
    value = normalizePokemonGender(value)
    if (!value || !GENDER_WORDS[value]?.test(quote)
      || (value === 'male' && GENDER_WORDS.female.test(quote))
      || (value === 'female' && GENDER_WORDS.male.test(quote))) {
      return { ok: false, error: 'The quoted prose does not unambiguously establish this gender.' }
    }
    const ratio = genderRatioForSpecies(speciesEntry)
    if (ratio && ((value === 'male' && ratio.M === 0) || (value === 'female' && ratio.F === 0) || (value === 'unknown' && ratio.M + ratio.F > 0))) {
      return { ok: false, error: 'Gender contradicts the species canon.' }
    }
  } else if (proposal.field === 'shiny') {
    if (typeof value !== 'boolean' || !/(shiny|闪光|異色|异色|màu sắc khác thường|ánh kim)/iu.test(quote)) return { ok: false, error: 'No explicit Shiny evidence.' }
  } else if (proposal.field === 'nickname') {
    if (typeof value !== 'string' || !value.trim() || value.length > 60 || !quote.includes(value)) {
      return { ok: false, error: 'Nickname not explicitly stated in quoted canon.' }
    }
    value = value.trim()
  }
  if (mon[proposal.field] === value) return { ok: false, error: 'Pokémon already has this value.' }
  return { ok: true, patch: { targetUid: mon.uid, field: proposal.field, before: mon[proposal.field] ?? null, value, evidenceQuote: quote, sourceMessageId: evidenceSource.id ?? null } }
}

export function patchPokemonAcrossRoster(mon, patch) {
  if (!mon || mon.uid !== patch?.targetUid) return mon
  if (!SUPPORTED_FIELDS.has(patch.field)) return mon
  return {
    ...mon,
    [patch.field]: patch.value,
    ...(patch.field === 'gender' ? { genderSource: 'manual-correction', genderEvidenceMessageId: patch.sourceMessageId ?? null } : {}),
  }
}

export function undoPokemonCorrection(mon, correction) {
  if (!mon || mon.uid !== correction?.targetUid || mon[correction.field] !== correction.value) return mon
  return {
    ...mon,
    [correction.field]: correction.before,
    ...(correction.field === 'gender' ? { genderSource: 'manual-undo', genderEvidenceMessageId: null } : {}),
  }
}

export function correctionHistoryKey(trainerId) {
  return `trainer-arena:correction-history:${String(trainerId ?? '')}`
}
