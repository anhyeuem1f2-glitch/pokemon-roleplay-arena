// Dot148 — shared Pokémon ownership firewall for ordinary turns and intro.
// Pure logic, no UI or state mutation. Source prose is authoritative.
import { normalizeMonTarget } from './ownedMonTarget.js'
import { proseSupportsPokemonAcquisition, proseSupportsSemanticPokemonAcquisition, countProvenPokemonAcquisitions } from './stateEvidence.js'

function rerollContextMentionsTarget(priorText, target) {
  const targetKey = normalizeMonTarget(target)
  const priorKey = normalizeMonTarget(priorText)
  return Boolean(targetKey && priorKey && priorKey.includes(targetKey))
}

export function gateSemanticOwnership(parsed, storyText, { reroll = false, priorText = '', playerName = '' } = {}) {
  if (!parsed) return parsed
  const kept = []
  const rejected = []
  const seenSemanticSpecies = new Map()
  for (const pk of parsed.pokemons ?? []) {
    const species = pk.species ?? pk.name
    const semantic = Boolean(pk?.semantic || pk?.canon)
    // Đợt 121: chính văn tiếng Trung có thể gọi loài bằng tên bản địa trong
    // khi Semantic Engine chuẩn hoá target về tên database tiếng Anh. Model
    // được yêu cầu giữ exact mention trong details.storyName để ownership gate
    // vẫn kiểm được canon mà không phải bỏ firewall chống Pokémon hallucinated.
    const storyName = pk?.details?.storyName ?? pk?.storyName ?? species
    const hasCanonAcquisition = semantic
      ? proseSupportsSemanticPokemonAcquisition(storyText, pk, { playerName })
      : (proseSupportsPokemonAcquisition(storyText, species)
        || (storyName !== species && proseSupportsPokemonAcquisition(storyText, storyName)))
    // Reroll chỉ được tái hiện Pokémon có liên hệ trực tiếp với nhánh trước đó.
    // Nếu model tự bịa một loài hoàn toàn mới trong biến thể reroll, dù chính
    // câu nó vừa viết có nói "nhận được", app vẫn không cho side-effect đó
    // trở thành state. Điều này chặn reroll tự sinh thêm Pokémon ngoài ý người chơi.
    const rerollHasPriorAnchor = !reroll || rerollContextMentionsTarget(priorText, species)
    if (semantic && (!hasCanonAcquisition || !rerollHasPriorAnchor)) {
      rejected.push({ ...pk, _reason: !hasCanonAcquisition ? 'no-canon-acquisition' : 'reroll-no-prior-anchor' })
      continue
    }
    const speciesKey = normalizeMonTarget(species)
    // Nhiều pass Semantic đôi khi mô tả cùng một acquisition hai lần với
    // level/nickname hơi khác. Trong một response chỉ giữ một acquisition cho
    // cùng loài; việc thật sự bắt thêm cá thể cùng loài ở lượt khác vẫn hợp lệ.
    const maxInProse = semantic ? countProvenPokemonAcquisitions(storyText, pk, { playerName }) : Infinity
    const seenCount = seenSemanticSpecies.get(speciesKey) ?? 0
    if (semantic && speciesKey && seenCount >= maxInProse) {
      rejected.push({ ...pk, _reason: 'same-pass-duplicate' })
      continue
    }
    if (semantic && speciesKey) seenSemanticSpecies.set(speciesKey, seenCount + 1)
    kept.push(pk)
  }
  return {
    ...parsed,
    pokemons: kept,
    _rejectedPokemonAcquisitions: [
      ...(parsed._rejectedPokemonAcquisitions ?? []),
      ...rejected,
    ],
  }
}

