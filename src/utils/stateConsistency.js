// Dot150: deterministic guards for AI-proposed locations and semantic state identities.
import { POKEMON_SPECIES } from '../data/pokemonSpecies.js'
import { getBuiltInZhPokemonSpeciesNames } from './pokemonNameTranslations.js'

function normalize(value) {
  return String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

const MON_NAMES = new Set(POKEMON_SPECIES.flatMap((mon) => [mon.name, mon.species, mon.id, mon.slug]
  .filter((v) => typeof v === 'string' && v.trim()).map(normalize)))
for (const en of Object.keys(getBuiltInZhPokemonSpeciesNames().byCanonical ?? {})) MON_NAMES.add(normalize(en))
for (const zh of Object.keys(getBuiltInZhPokemonSpeciesNames().byName ?? {})) MON_NAMES.add(normalize(zh))

/** Reject an isolated species name as a physical location; retain themed locations like Pikachu Valley. */
export function isPokemonSpeciesAsLocation(place) {
  const label = normalize(place).replace(/^(?:place|location|địa điểm|地点)\s*[:：]\s*/iu, '')
  return !!label && MON_NAMES.has(label)
}

const NAMESPACES = new Set(['story', 'world', 'player', 'pokemon', 'npc', 'quest', 'location', 'item', 'battle', 'relationship'])
/** Normalize only exact, mechanically duplicated namespace prefixes, not unrelated semantic entities. */
export function canonicalStateIdentity(rawNamespace, rawTarget) {
  let namespace = normalize(rawNamespace) || 'world'
  let target = normalize(rawTarget)
  const prefixes = target.split(':').map((x) => x.trim()).filter(Boolean)
  if (prefixes.length > 1 && NAMESPACES.has(prefixes[0]) && (namespace === 'world' || namespace === prefixes[0])) {
    namespace = prefixes[0]
    prefixes.shift()
    target = prefixes.join(':')
  }
  const duplicate = `${namespace}:`
  while (target.startsWith(duplicate) && target.length > duplicate.length) {
    target = target.slice(duplicate.length).trim()
  }
  return { namespace, target, key: target ? `${namespace}:${target}` : '' }
}

export function canonicalStateFactKey(raw) {
  const text = String(raw ?? '').normalize('NFKC').trim()
  if (!text) return ''
  const first = text.split(':')[0].trim().toLowerCase()
  if (!NAMESPACES.has(first)) return text
  const identity = canonicalStateIdentity(first, text)
  return identity.key || text
}
