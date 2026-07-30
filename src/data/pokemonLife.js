import { createStableId, ensurePokemonIdentity } from './persistentIdentity.js'
import { getBossTier } from './bossTiers.js'

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

export function rollPokemonLifeTraits(mon, ownerTrainerId = null) {
  const base = ensurePokemonIdentity(mon, ownerTrainerId)
  if (!base) return base
  const shiny = mon.shiny === undefined ? Math.random() < 1 / 4096 : Boolean(mon.shiny)
  const gender = mon.gender ?? (Math.random() < 0.5 ? 'male' : 'female')
  const sizeClass = mon.sizeClass ?? (Math.random() < 0.06 ? 'tiny' : Math.random() > 0.94 ? 'jumbo' : 'average')
  const marks = [...(base.marks ?? [])]
  if (marks.length === 0 && Math.random() < 1 / 80) {
    const pool = ['Dấu Ấn Hiếu Kỳ', 'Dấu Ấn Điềm Tĩnh', 'Dấu Ấn Năng Động', 'Dấu Ấn Hay Đói', 'Dấu Ấn Lang Thang']
    marks.push(pool[Math.floor(Math.random() * pool.length)])
  }
  return { ...base, shiny, gender, sizeClass, marks }
}

export function breedingCompatibility(first, second) {
  if (!first || !second || first.uid === second.uid) return { ok: false, reason: 'Cần hai cá thể khác nhau.' }
  if (getBossTier(first.name) || getBossTier(second.name)) return { ok: false, reason: 'Pokémon huyền thoại/huyền ảo không tham gia nhân giống.' }
  const a = String(first.name ?? '').toLowerCase()
  const b = String(second.name ?? '').toLowerCase()
  const ditto = a === 'ditto' || b === 'ditto'
  if (!ditto && a !== b) return { ok: false, reason: 'Bản thử nghiệm chỉ hỗ trợ Ditto hoặc hai Pokémon cùng loài.' }
  if (!ditto && first.gender !== 'unknown' && second.gender !== 'unknown' && first.gender === second.gender) {
    return { ok: false, reason: 'Hai Pokémon cùng giới tính không tạo trứng trong luật hiện tại.' }
  }
  return { ok: true, reason: 'Tương thích.' }
}

export function createEgg(first, second, trainerId, storyDate) {
  const compatibility = breedingCompatibility(first, second)
  if (!compatibility.ok) throw new Error(compatibility.reason)
  const child = String(first.name).toLowerCase() === 'ditto' ? second : first
  return {
    id: createStableId('egg'),
    eggCode: `EG-${String(createStableId('e')).slice(-8).toUpperCase()}`,
    species: child.species ?? child.name,
    speciesName: child.name,
    parentIds: [first.uid, second.uid],
    ownerTrainerId: trainerId,
    createdDate: storyDate ? { ...storyDate } : null,
    care: 0,
    neededCare: 4,
    status: 'incubating',
  }
}

export function careForEgg(egg) {
  const care = Math.min(egg.neededCare ?? 4, (egg.care ?? 0) + 1)
  return { ...egg, care, status: care >= (egg.neededCare ?? 4) ? 'ready' : 'incubating' }
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
