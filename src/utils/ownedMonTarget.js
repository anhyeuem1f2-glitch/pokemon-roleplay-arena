// ============ DÒ ĐÚNG CÁ THỂ POKÉMON TỪ TAG TRẠNG THÁI (đợt 74) ============
// Model không phải lúc nào cũng ghi đúng tên trần. Nó có thể trả
// "Froakie của tôi", "Pokémon Froakie" hoặc "Pokémon đang ra trận".
// Các hàm thuần ở đây dùng cho cả luồng áp biến và regression test để DNA
// không tuyên bố tăng cấp khi app thực tế không tìm thấy Pokémon tương ứng.

import { isSameMon } from '../data/pokemonSpecies.js'

export function normalizeMonTarget(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function isActiveMonTarget(target) {
  const t = normalizeMonTarget(target)
  return [
    'pokemon dang ra tran',
    'dang ra tran',
    'active',
    'pokemon active',
    'pokemon hien tai',
    'hien tai',
  ].includes(t)
}

/** Khớp đúng cá thể đã chốt trước đó; ưu tiên uid, save cũ mới lùi về tên. */
export function monIdentityMatches(mon, identity) {
  if (!mon || !identity) return false
  if (identity.uid && mon.uid) return identity.uid === mon.uid
  return normalizeMonTarget(mon.name) === normalizeMonTarget(identity.name)
}

function monTargetScore(mon, target, activeMon = null) {
  if (!mon) return -1
  if (isActiveMonTarget(target)) return activeMon && isSameMon(mon, activeMon) ? 1000 : -1

  const wanted = normalizeMonTarget(target)
  if (!wanted) return -1
  const names = [mon.name, mon.species, mon.nickname, mon.displayName]
    .map(normalizeMonTarget)
    .filter(Boolean)

  let best = -1
  for (const name of names) {
    if (wanted === name) best = Math.max(best, 900)
    else if (wanted.includes(name)) best = Math.max(best, 700 + Math.min(100, name.length))
    else if (name.includes(wanted) && wanted.length >= 4) best = Math.max(best, 600 + Math.min(100, wanted.length))
  }
  return best
}

/**
 * Dò target cho [[LEVEL]]. Exact/uid luôn thắng; câu đời thường được phép chứa
 * tên. Chỉ khi người chơi có đúng một Pokémon mới fallback sang cá thể đó.
 */
export function resolveOwnedMonTarget(target, activeMon, party) {
  const unique = []
  for (const mon of [activeMon, ...(party ?? [])]) {
    if (!mon) continue
    if (!unique.some((x) => isSameMon(x, mon))) unique.push(mon)
  }

  const ranked = unique
    .map((mon) => ({ mon, score: monTargetScore(mon, target, activeMon) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)

  if (ranked.length > 0) return ranked[0].mon
  return unique.length === 1 ? unique[0] : null
}

/** Dò loài đã sở hữu cho nhánh tương thích [[POKEMON Loài | LvN]]. */
export function resolveOwnedSpeciesTarget(species, activeMon, party) {
  const wanted = normalizeMonTarget(species)
  const unique = []
  for (const mon of [activeMon, ...(party ?? [])]) {
    if (!mon || unique.some((x) => isSameMon(x, mon))) continue
    unique.push(mon)
  }
  return unique.find((mon) => [mon.name, mon.species].map(normalizeMonTarget).includes(wanted)) ?? null
}
