import { createStableId, ensurePokemonIdentity } from './persistentIdentity.js'
import { ensurePokemonGender } from './pokemonGender.js'

export const CONTEST_CATEGORIES = [
  { key: 'cool', label: 'Cool', stat: 'atk' },
  { key: 'beauty', label: 'Beauty', stat: 'spa' },
  { key: 'cute', label: 'Cute', stat: 'spd' },
  { key: 'clever', label: 'Clever', stat: 'spe' },
  { key: 'tough', label: 'Tough', stat: 'def' },
]

export const DEFAULT_POKEMON_LIFE = { eggs: [], contestRecords: [], campLog: [] }

export function normalizePokemonLife(value) {
  const raw = value ?? {}
  return {
    eggs: Array.isArray(raw.eggs) ? raw.eggs : [],
    contestRecords: Array.isArray(raw.contestRecords) ? raw.contestRecords : [],
    campLog: Array.isArray(raw.campLog) ? raw.campLog : [],
  }
}

export function rollPokemonLifeTraits(mon, ownerTrainerId = null, speciesEntry = null) {
  const base = ensurePokemonIdentity(mon, ownerTrainerId)
  if (!base) return base
  const shiny = mon.shiny === undefined ? Math.random() < 1 / 4096 : Boolean(mon.shiny)
  const sizeClass = mon.sizeClass ?? (Math.random() < 0.06 ? 'tiny' : Math.random() > 0.94 ? 'jumbo' : 'average')
  const marks = [...(base.marks ?? [])]
  if (marks.length === 0 && Math.random() < 1 / 80) {
    const pool = ['Dấu Ấn Hiếu Kỳ', 'Dấu Ấn Điềm Tĩnh', 'Dấu Ấn Năng Động', 'Dấu Ấn Hay Đói', 'Dấu Ấn Lang Thang']
    marks.push(pool[Math.floor(Math.random() * pool.length)])
  }
  return ensurePokemonGender({ ...base, shiny, sizeClass, marks }, speciesEntry)
}

export function breedingCompatibility(first, second) {
  if (!first || !second || first.uid === second.uid) return { ok: false, reason: 'Cần hai cá thể khác nhau.' }
  const a = String(first.species ?? first.name ?? '').toLowerCase()
  const b = String(second.species ?? second.name ?? '').toLowerCase()
  const ditto = a === 'ditto' || b === 'ditto'
  const firstGroups = new Set((first.eggGroups ?? []).map((group) => String(group).toLowerCase()))
  const secondGroups = new Set((second.eggGroups ?? []).map((group) => String(group).toLowerCase()))
  // Dữ liệu Egg Group mới là nguồn luật. Nhờ vậy hầu hết huyền thoại vẫn bị
  // chặn bởi Undiscovered, nhưng ngoại lệ canon Manaphy/Phione + Ditto hoạt
  // động thay vì bị một lệnh cấm "mọi boss" quá rộng chặn nhầm.
  if (firstGroups.has('undiscovered') || secondGroups.has('undiscovered')) {
    return { ok: false, reason: 'Một Pokémon thuộc Egg Group Undiscovered nên không thể sinh sản.' }
  }
  if (ditto && (a === 'ditto' && b === 'ditto')) return { ok: false, reason: 'Hai Ditto không thể tạo trứng.' }
  if (!ditto && (!firstGroups.size || !secondGroups.size || ![...firstGroups].some((group) => secondGroups.has(group)))) {
    return { ok: false, reason: 'Hai Pokémon không có Egg Group tương thích.' }
  }
  if (!ditto && (first.gender === 'unknown' || second.gender === 'unknown')) {
    return { ok: false, reason: 'Pokémon vô giới tính cần ghép với Ditto.' }
  }
  if (!ditto && first.gender === second.gender) {
    return { ok: false, reason: 'Hai Pokémon cùng giới tính không thể tạo trứng.' }
  }
  return { ok: true, reason: 'Tương thích.' }
}

export function createEgg(first, second, trainerId, storyDate) {
  const compatibility = breedingCompatibility(first, second)
  if (!compatibility.ok) throw new Error(compatibility.reason)
  const firstIsDitto = String(first.species ?? first.name).toLowerCase() === 'ditto'
  const secondIsDitto = String(second.species ?? second.name).toLowerCase() === 'ditto'
  const child = firstIsDitto ? second : secondIsDitto ? first : first.gender === 'female' ? first : second
  const childSpecies = String(child.eggSpecies ?? child.species ?? child.name)
  const manaphyEgg = childSpecies.toLowerCase().replace(/[^a-z0-9]/g, '') === 'manaphy'
  const inheritedIvs = {}
  const statKeys = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
  for (const stat of statKeys.sort(() => Math.random() - 0.5).slice(0, 3)) {
    const source = Math.random() < 0.5 ? first : second
    const inherited = Number(source.ivs?.[stat])
    if (Number.isFinite(inherited)) inheritedIvs[stat] = inherited
  }
  return {
    id: createStableId('egg'),
    eggCode: `EG-${String(createStableId('e')).slice(-8).toUpperCase()}`,
    species: manaphyEgg ? 'phione' : childSpecies,
    speciesName: manaphyEgg ? 'Phione' : (child.eggSpeciesName ?? child.name),
    inheritedIvs,
    inheritedNature: Math.random() < 0.5 ? first.nature : second.nature,
    parentIds: [first.uid, second.uid],
    ownerTrainerId: trainerId,
    createdDate: storyDate ? { ...storyDate } : null,
    care: 0,
    neededCare: 4,
    status: 'incubating',
  }
}

export function careForEgg(egg, storyDate = null) {
  const sameDay = storyDate && egg.lastCareDate
    && storyDate.day === egg.lastCareDate.day
    && storyDate.month === egg.lastCareDate.month
    && storyDate.year === egg.lastCareDate.year
  if (sameDay) throw new Error('Trứng đã được chăm sóc trong ngày này; hãy để thời gian chính văn trôi tiếp.')
  const care = Math.min(egg.neededCare ?? 4, (egg.care ?? 0) + 1)
  return { ...egg, care, lastCareDate: storyDate ? { ...storyDate } : egg.lastCareDate, status: care >= (egg.neededCare ?? 4) ? 'ready' : 'incubating' }
}

export function campWithPokemon(mon, storyDate) {
  if (!mon) return mon
  return {
    ...mon,
    friendship: Math.min(255, (Number(mon.friendship) || 70) + 3),
    campedAt: storyDate ? { ...storyDate } : null,
  }
}

export function contestScore(mon, categoryKey) {
  const category = CONTEST_CATEGORIES.find((item) => item.key === categoryKey) ?? CONTEST_CATEGORIES[0]
  const stat = Number(mon?.stats?.[category.stat]) || 20
  const friendship = Number(mon?.friendship) || 70
  const ribbonBonus = (mon?.ribbons ?? []).length * 4
  const markBonus = (mon?.marks ?? []).length * 2
  const natureVariance = [...String(mon?.nature ?? '')].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 16
  return Math.round(stat * 0.45 + friendship * 0.28 + ribbonBonus + markBonus + natureVariance)
}

export function awardContest(mon, categoryKey, rank = 'Normal') {
  const category = CONTEST_CATEGORIES.find((item) => item.key === categoryKey) ?? CONTEST_CATEGORIES[0]
  const ribbon = `${category.label} Ribbon · ${rank}`
  const ribbons = [...new Set([...(mon.ribbons ?? []), ribbon])]
  return { ...mon, ribbons }
}

export function addCollectionAward(mon, kind, name) {
  if (!mon || !name) return mon
  const key = kind === 'mark' ? 'marks' : 'ribbons'
  return { ...mon, [key]: [...new Set([...(mon[key] ?? []), name])] }
}
