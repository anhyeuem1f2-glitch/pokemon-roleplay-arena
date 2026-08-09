import { normalizeMonTarget } from '../utils/ownedMonTarget.js'

const DEFAULT_STATS = { hp: 70, atk: 70, def: 70, spa: 70, spd: 70, spe: 70 }
const VALID_TYPES = new Set(['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'])

function slugify(value) {
  const normalized = normalizeMonTarget(value).replace(/\s+/g, '-')
  return normalized || 'custom-pokemon'
}

function normalizeStats(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const out = {}
  for (const key of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) {
    const n = Number(source[key])
    out[key] = Number.isFinite(n) ? Math.max(1, Math.min(255, Math.round(n))) : DEFAULT_STATS[key]
  }
  return out
}

function normalizeTypes(raw) {
  const values = Array.isArray(raw) ? raw : String(raw ?? '').split(/[\/,|+]/)
  const normalized = values.map((value) => String(value).trim().toLowerCase()).filter((value) => VALID_TYPES.has(value))
  return normalized.length ? [...new Set(normalized)].slice(0, 2) : ['normal']
}

/**
 * Dò Pokédex mềm: exact name/species trước, sau đó khớp chứa duy nhất. Không
 * tự chọn một loài mơ hồ vì fuzzy sai còn nguy hiểm hơn để custom fallback.
 */
export function resolveSpeciesEntryFlexible(pokedex = [], rawName = '') {
  const wanted = normalizeMonTarget(rawName)
  if (!wanted) return null
  const exact = (pokedex ?? []).find((entry) => [entry?.name, entry?.species, entry?.spriteId]
    .map(normalizeMonTarget).includes(wanted))
  if (exact) return exact

  const candidates = (pokedex ?? []).filter((entry) => {
    const names = [entry?.name, entry?.species, entry?.spriteId].map(normalizeMonTarget).filter(Boolean)
    return names.some((name) => (wanted.length >= 4 && name.includes(wanted)) || (name.length >= 4 && wanted.includes(name)))
  })
  if (candidates.length === 1) return candidates[0]
  return null
}

/**
 * Canon có thể tạo Pokémon/form fan-made. Ta tạo một species entry tối thiểu
 * nhưng hợp lệ với battle/UI thay vì vứt event chỉ vì Pokédex không biết nó.
 */
export function buildCustomSpeciesEntry(rawName, meta = {}) {
  const name = String(rawName ?? meta.name ?? 'Pokémon tự tạo').trim() || 'Pokémon tự tạo'
  const species = `custom-${slugify(name)}`
  const abilities = meta.abilities && typeof meta.abilities === 'object'
    ? meta.abilities
    : { 0: String(meta.ability ?? 'Không rõ') }
  return {
    name,
    species,
    spriteId: String(meta.spriteId ?? species),
    forme: meta.form ?? meta.forme ?? null,
    baseSpeciesId: null,
    types: normalizeTypes(meta.types),
    baseStats: normalizeStats(meta.baseStats ?? meta.stats),
    abilities,
    baseFriendship: Number.isFinite(Number(meta.friendship)) ? Math.max(0, Math.min(255, Number(meta.friendship))) : 70,
    catchRate: Number.isFinite(Number(meta.catchRate)) ? Math.max(1, Math.min(255, Number(meta.catchRate))) : 120,
    gender: meta.gender ?? null,
    genderRatio: meta.genderRatio ?? null,
    eggGroups: [],
    eggSpecies: species,
    eggSpeciesName: name,
    hasEvo: Boolean(meta.hasEvo),
    hasPrevo: Boolean(meta.hasPrevo),
    custom: true,
    description: String(meta.description ?? 'Pokémon hoặc hình thái do cốt truyện tạo ra.'),
  }
}
