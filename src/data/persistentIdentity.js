function hashText(value) {
  let hash = 2166136261
  for (const char of String(value ?? '')) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, '0')
}

export function createStableId(prefix = 'id') {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
  return `${prefix}_${random}`
}

export function publicTrainerCode(trainerId) {
  return `TR-${hashText(trainerId).slice(0, 4)}-${hashText(`${trainerId}:trainer`).slice(0, 4)}`
}

export function publicPokemonCode(uid) {
  return `PK-${hashText(uid).slice(0, 4)}-${hashText(`${uid}:pokemon`).slice(0, 4)}`
}

export function ensurePokemonIdentity(mon, ownerTrainerId = null) {
  if (!mon) return mon
  const uid = mon.uid || createStableId('pkm')
  return {
    ...mon,
    uid,
    pokemonId: mon.pokemonId || publicPokemonCode(uid),
    originalTrainerId: mon.originalTrainerId ?? ownerTrainerId ?? null,
    currentTrainerId: ownerTrainerId ?? mon.currentTrainerId ?? null,
    tradeHistory: Array.isArray(mon.tradeHistory) ? mon.tradeHistory : [],
    ribbons: Array.isArray(mon.ribbons) ? mon.ribbons : [],
    marks: Array.isArray(mon.marks) ? mon.marks : [],
    shiny: Boolean(mon.shiny),
    gender: mon.gender ?? 'unknown',
  }
}

export function deterministicNpcId(name) {
  return `NPC-${hashText(String(name ?? '').trim().toLowerCase()).slice(0, 8)}`
}
