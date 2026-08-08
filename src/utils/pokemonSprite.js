// ============ POKÉMON SPRITE RESOLVER (đợt 103) ============
// Một nguồn duy nhất cho thứ tự sprite. Shiny phải được thử HẾT kho shiny thật
// trước khi fallback về màu thường; như vậy UI không thể ghi Shiny nhưng lại
// vô tình chọn sprite normal chỉ vì một biến thể giới tính thiếu asset.

function sanitizeSpriteSlug(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '')
}

export function buildSpriteCandidates(mon, side = 'enemy') {
  const slug = sanitizeSpriteSlug(mon?.spriteId ?? mon?.species)
  if (!slug) return []

  const slugs = mon?.gender === 'female' && !slug.endsWith('-f') ? [`${slug}-f`, slug] : [slug]
  const urls = []

  const pushSet = (candidate, shiny) => {
    if (shiny) {
      const animatedDir = side === 'player' ? 'ani-back-shiny' : 'ani-shiny'
      urls.push(`https://play.pokemonshowdown.com/sprites/${animatedDir}/${candidate}.gif`)
      urls.push(`https://play.pokemonshowdown.com/sprites/home-shiny/${candidate}.png`)
      urls.push(`https://play.pokemonshowdown.com/sprites/dex-shiny/${candidate}.png`)
      return
    }

    const animatedDir = side === 'player' ? 'ani-back' : 'ani'
    urls.push(`https://play.pokemonshowdown.com/sprites/${animatedDir}/${candidate}.gif`)
    urls.push(`https://play.pokemonshowdown.com/sprites/home/${candidate}.png`)
    urls.push(`https://play.pokemonshowdown.com/sprites/dex/${candidate}.png`)
  }

  if (mon?.shiny) {
    for (const candidate of slugs) pushSet(candidate, true)
  }
  for (const candidate of slugs) pushSet(candidate, false)

  return [...new Set(urls)]
}

export function primarySpriteUrl(mon, side = 'enemy') {
  return buildSpriteCandidates(mon, side)[0] ?? null
}
