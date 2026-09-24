import { normalizeLocalizedPokemonName } from './pokemonNameTranslations.js'

const ITEM_COLLATOR = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

function normalizeSearch(value) {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase()
}

export function filterAndSortSandboxItems(items = [], query = '') {
  const q = normalizeSearch(query)
  return [...items]
    .filter((item) => {
      if (!q) return true
      return [item?.name, item?.id, item?.category, item?.desc]
        .some((value) => normalizeSearch(value).includes(q))
    })
    .sort((a, b) => ITEM_COLLATOR.compare(String(a?.name ?? ''), String(b?.name ?? '')))
}

export function groupSandboxItemsByInitial(items = []) {
  const groups = []
  const byInitial = new Map()
  for (const item of items) {
    const name = String(item?.name ?? '').trim()
    const first = (name.match(/[A-Za-z]/)?.[0] ?? '#').toUpperCase()
    if (!byInitial.has(first)) {
      const group = { initial: first, items: [] }
      byInitial.set(first, group)
      groups.push(group)
    }
    byInitial.get(first).items.push(item)
  }
  return groups.sort((a, b) => {
    if (a.initial === '#') return 1
    if (b.initial === '#') return -1
    return ITEM_COLLATOR.compare(a.initial, b.initial)
  })
}

export function localizedPokemonNameForEntry(entry, catalog) {
  if (!entry || !catalog) return ''
  const num = Number(entry.num)
  if (Number.isFinite(num) && catalog.byId?.[String(num)]) return catalog.byId[String(num)]
  const keys = [entry.name, entry.species, entry.baseSpeciesId]
    .map(normalizeLocalizedPokemonName)
    .filter(Boolean)
  for (const key of keys) {
    const localized = catalog.byCanonical?.[key]
    if (localized) return localized
  }
  return ''
}

function pokemonSearchScore(entry, queryKey, catalog) {
  const englishKeys = [entry?.name, entry?.species, entry?.baseSpeciesId]
    .map(normalizeLocalizedPokemonName)
    .filter(Boolean)
  const zh = localizedPokemonNameForEntry(entry, catalog)
  const zhKey = normalizeLocalizedPokemonName(zh)
  const all = [...englishKeys, zhKey].filter(Boolean)
  if (all.some((key) => key === queryKey)) return 0
  if (all.some((key) => key.startsWith(queryKey))) return 1
  if (all.some((key) => key.includes(queryKey))) return 2
  return Infinity
}

export function searchSandboxPokemon(entries = [], query = '', catalog = null, limit = 24) {
  const q = normalizeLocalizedPokemonName(query)
  if (!q) return []
  const seen = new Set()
  return entries
    .map((entry, index) => ({ entry, index, score: pokemonSearchScore(entry, q, catalog) }))
    .filter(({ score }) => Number.isFinite(score))
    .filter(({ entry }) => {
      const key = String(entry?.species ?? entry?.name ?? '')
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score
      const numA = Number(a.entry?.num)
      const numB = Number(b.entry?.num)
      if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) return numA - numB
      if (Boolean(a.entry?.forme) !== Boolean(b.entry?.forme)) return Number(Boolean(a.entry?.forme)) - Number(Boolean(b.entry?.forme))
      return a.index - b.index
    })
    .slice(0, Math.max(1, Number(limit) || 24))
    .map(({ entry }) => entry)
}

export function resolveSandboxPokemonEntry(entries = [], query = '', catalog = null) {
  const q = normalizeLocalizedPokemonName(query)
  if (!q) return null
  const exact = entries.filter((entry) => {
    const keys = [entry?.name, entry?.species]
      .map(normalizeLocalizedPokemonName)
      .filter(Boolean)
    const zh = normalizeLocalizedPokemonName(localizedPokemonNameForEntry(entry, catalog))
    return keys.includes(q) || (zh && zh === q)
  })
  if (!exact.length) return null
  return exact.find((entry) => !entry?.forme) ?? exact[0]
}
