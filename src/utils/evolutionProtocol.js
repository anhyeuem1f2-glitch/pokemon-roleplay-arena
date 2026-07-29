// ============ GIAO THỨC TIẾN HOÁ TRONG CHÍNH VĂN (đợt 76) ============
// Tách logic thuần khỏi RoleplayChat để regression test trực tiếp. Model có
// thể quên [[EVOLVE]] hoặc tiếp tục dùng nhầm [[POKEMON loài cấp 2]]; app chỉ
// suy tiến hoá khi Pokédex xác nhận quan hệ trực tiếp và câu văn khẳng định
// sự kiện đã xảy ra.

import { isSameMon, isDirectEvolution } from '../data/pokemonSpecies.js'
import { normalizeMonTarget } from './ownedMonTarget.js'

function normalizeStoryPhrase(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Chính văn có khẳng định sự kiện tiến hoá đã xảy ra, không chỉ nói khả năng. */
export function storyClaimsEvolution(text, fromName, toName) {
  const hay = normalizeStoryPhrase(text)
  const from = normalizeStoryPhrase(fromName)
  const to = normalizeStoryPhrase(toName)
  if (!hay || !to) return false
  const targetAt = hay.lastIndexOf(to)
  if (targetAt < 0) return false
  const evoWords = [
    'tien hoa thanh', 'da tien hoa thanh', 'has evolved into', 'evolved into',
    'bien doi thanh',
  ]
  let evoAt = -1
  for (const word of evoWords) evoAt = Math.max(evoAt, hay.lastIndexOf(word, targetAt))
  if (evoAt < 0 || targetAt - evoAt > 180) return false
  // “có thể/sẽ/sắp tiến hoá thành” chỉ là khả năng tương lai, chưa được phép
  // đổi biến. Chỉ chấp nhận câu khẳng định sự kiện đã/đang xảy ra.
  const beforeEvolution = hay.slice(Math.max(0, evoAt - 55), evoAt)
  if (/(?:co the|co kha nang|se|sap|chua|du kien|mong muon)\s*$/.test(beforeEvolution)) return false
  if (!from) return true
  const fromAt = hay.lastIndexOf(from, evoAt)
  return fromAt >= 0 && evoAt - fromAt <= 260
}

/** Tìm entry Pokédex bằng tên hiển thị hoặc species slug. */
export function findEvolutionSpeciesEntry(pokedexSpecies, value) {
  const wanted = normalizeMonTarget(value)
  return (pokedexSpecies ?? []).find((entry) =>
    [entry.name, entry.species].map(normalizeMonTarget).includes(wanted),
  ) ?? null
}

/**
 * Chốt app-side khi model quên tag EVOLVE nhưng văn bản nói rõ A tiến hoá
 * thành B. Chỉ suy khi B là tiến hoá trực tiếp của cá thể đang sở hữu.
 */
export function inferEvolutionDirectives(parsed, storyText, pokedexSpecies, activeMon, party) {
  if (!storyText || (parsed?.evolutions ?? []).length > 0) return parsed
  const owned = []
  for (const mon of [activeMon, ...(party ?? [])]) {
    if (mon && !owned.some((x) => isSameMon(x, mon))) owned.push(mon)
  }

  for (const mon of owned) {
    const fromEntry = findEvolutionSpeciesEntry(pokedexSpecies, mon.species ?? mon.name)
    if (!fromEntry) continue
    for (const toEntry of pokedexSpecies ?? []) {
      if (!isDirectEvolution(fromEntry, toEntry)) continue
      if (!storyClaimsEvolution(storyText, mon.name ?? fromEntry.name, toEntry.name)) continue
      return {
        ...parsed,
        evolutions: [
          ...(parsed.evolutions ?? []),
          { from: mon.name ?? fromEntry.name, to: toEntry.name, inferred: true },
        ],
      }
    }
  }
  return parsed
}
