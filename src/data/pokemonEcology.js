import { getArea, getRegion } from './regions.js'
import { getBossTier } from './bossTiers.js'

// ============ SINH THÁI ENCOUNTER (đợt 86) ============
// Đây là bộ lọc heuristic an toàn cho lúc chính văn KHÔNG nêu rõ loài.
// Loài được model nhắc tường minh vẫn được tôn trọng vì đó có thể là sự kiện
// có chủ ý. Bộ lọc không giả vờ thay thế encounter table canon từng route;
// nó bảo đảm tối thiểu rằng sinh cảnh/thời tiết/thời gian và vùng có ý nghĩa.

const HABITATS = [
  { key: 'water', label: 'sông hồ / ven biển', words: ['sea', 'island', 'lake', 'river', 'brook', 'whirl', 'seafloor', 'sootopolis', 'hulbury', 'port', 'canal', 'beach'], types: ['water', 'flying', 'ice', 'electric', 'poison'] },
  { key: 'snow', label: 'núi tuyết / khí hậu lạnh', words: ['snow', 'ice', 'frost', 'tundra', 'glaseado', 'acui', 'lanakila', 'circhester'], types: ['ice', 'water', 'steel', 'rock', 'flying'] },
  { key: 'volcano', label: 'núi lửa / địa nhiệt', words: ['volcano', 'chimney', 'lavaridge', 'stark', 'jagged', 'cinnabar'], types: ['fire', 'rock', 'ground', 'steel', 'poison'] },
  { key: 'desert', label: 'sa mạc / đất khô', words: ['desert', 'badland', 'asado', 'relic', 'route 111'], types: ['ground', 'rock', 'fire', 'steel', 'dark'] },
  { key: 'cave', label: 'hang động / lòng núi', words: ['cave', 'tunnel', 'mine', 'cavern', 'grotto', 'coronet', 'mount', 'mt.', 'rock', 'iron island', 'victory road'], types: ['rock', 'ground', 'steel', 'dark', 'ghost', 'poison'] },
  { key: 'haunted', label: 'di tích / nơi có linh khí', words: ['tower', 'ruins', 'burned', 'pyre', 'grave', 'cemet', 'ultra space', 'turnback', 'zero lab'], types: ['ghost', 'dark', 'psychic', 'fairy', 'poison'] },
  { key: 'forest', label: 'rừng / đầm lầy', words: ['forest', 'woods', 'jungle', 'grove', 'weald', 'marsh', 'safari', 'park', 'lush', 'ilex', 'pinwheel', 'petalburg'], types: ['grass', 'bug', 'poison', 'fairy', 'flying', 'water'] },
  { key: 'urban', label: 'đô thị / khu dân cư', words: ['city', 'town', 'village', 'factory', 'mart', 'mall', 'academy', 'school', 'lab', 'saffron', 'lumiose', 'mesagoza'], types: ['normal', 'electric', 'steel', 'poison', 'psychic', 'dark'] },
]

const DEFAULT_HABITAT = {
  key: 'grassland',
  label: 'đồng cỏ / đường mòn',
  types: ['normal', 'flying', 'grass', 'bug', 'ground', 'fairy'],
}

function textId(value) {
  return String(value ?? '').toLowerCase()
}

export function habitatForLocation(location) {
  const area = location ? getArea(location.regionKey, location.areaKey) : null
  const text = textId(`${area?.key ?? ''} ${area?.name ?? ''} ${(area?.keys ?? []).join(' ')}`)
  return HABITATS.find((habitat) => habitat.words.some((word) => text.includes(word))) ?? DEFAULT_HABITAT
}

function weatherTypes(weather) {
  const text = textId(`${weather?.label ?? ''} ${weather?.key ?? ''}`)
  if (/mưa|rain|giông|storm|ẩm/.test(text)) return ['water', 'electric', 'grass', 'poison']
  if (/tuyết|snow|băng|rét|frost/.test(text)) return ['ice', 'water', 'steel']
  if (/nắng|sun|nóng|oi/.test(text)) return ['fire', 'grass', 'ground']
  if (/sương|fog|âm u|cloud/.test(text)) return ['ghost', 'dark', 'psychic', 'flying']
  if (/gió|wind/.test(text)) return ['flying', 'dragon', 'normal']
  return []
}

function timeTypes(part) {
  const text = textId(part)
  if (/đêm|tối|night/.test(text)) return ['ghost', 'dark', 'psychic', 'poison']
  if (/sáng|morning/.test(text)) return ['normal', 'flying', 'bug', 'grass']
  if (/trưa|chiều|day|afternoon/.test(text)) return ['grass', 'fire', 'flying', 'ground']
  return []
}

function isRandomEncounterAllowed(entry, location) {
  if (!entry?.name || !Array.isArray(entry.types) || !entry.types.length) return false
  if (Number.isFinite(entry.num) && entry.num <= 0) return false
  if (entry.battleOnly) return false
  if (/(?:mega|gmax|gigantamax|primal|eternamax)/i.test(`${entry.forme ?? ''} ${entry.name} ${entry.spriteId ?? ''}`)) return false
  // Danh sách tier hiện tại là catalog Legendary/Mythical curated của app;
  // dùng làm chốt deterministic ngay cả khi cache Showdown cũ thiếu `tags`.
  if (getBossTier(entry.name)) return false

  const tags = (entry.tags ?? []).join(' ')
  if (/legendary|mythical/i.test(tags)) return false
  if (/ultra beast/i.test(tags) && location?.areaKey !== 'ultra-space') return false
  if (/paradox/i.test(tags) && location?.areaKey !== 'great-crater') return false
  return true
}

export function encounterSpeciesScore(entry, options = {}) {
  const { location = null, storyDate = null, weather = null, kind = 'wild' } = options
  if (!isRandomEncounterAllowed(entry, location)) return 0

  const region = location ? getRegion(location.regionKey) : null
  const area = location ? getArea(location.regionKey, location.areaKey) : null
  const habitat = habitatForLocation(location)
  const types = (entry.types ?? []).map(textId)
  let score = 1

  const gen = Number(entry.gen)
  if (region && Number.isFinite(gen)) {
    if (gen === region.gen) score += kind === 'trainer' ? 5 : 7
    else if (gen < region.gen) score += 2
    else score *= 0.35
  }

  const habitatMatches = types.filter((type) => habitat.types.includes(type)).length
  score += habitatMatches * (kind === 'trainer' ? 1.5 : 4)
  score += types.filter((type) => weatherTypes(weather).includes(type)).length * 1.6
  score += types.filter((type) => timeTypes(storyDate?.part).includes(type)).length * 1.2

  const maxLevel = area?.level?.[1] ?? 20
  if (maxLevel <= 20) {
    if (entry.hasEvo && !entry.hasPrevo) score += 3
    if (entry.hasPrevo) score *= 0.32
  } else if (maxLevel >= 45 && entry.hasPrevo) {
    score += 2
  }

  const bst = Number(entry.bst)
  if (Number.isFinite(bst) && bst >= 600) score *= 0.08
  else if (Number.isFinite(bst) && bst >= 550) score *= 0.35
  return Math.max(0, score)
}

export function pickEcologicalEncounter(options = {}) {
  const {
    pokedex = [], excludeNames = [], excludeSpecies = [], random = Math.random,
  } = options
  const excludedNames = new Set(excludeNames.map(textId))
  const excludedSpecies = new Set(excludeSpecies.map(textId))
  const candidates = []
  let total = 0

  for (const entry of pokedex ?? []) {
    if (excludedNames.has(textId(entry?.name)) || excludedSpecies.has(textId(entry?.species))) continue
    const score = encounterSpeciesScore(entry, options)
    if (!(score > 0)) continue
    total += score
    candidates.push({ entry, ceiling: total })
  }
  if (!candidates.length || !(total > 0)) return null
  const roll = Math.max(0, Math.min(0.999999999, Number(random()) || 0)) * total
  return candidates.find((candidate) => roll < candidate.ceiling)?.entry ?? candidates.at(-1).entry
}

export function buildEcologyNote({ location = null, storyDate = null, weather = null } = {}) {
  if (!location) return ''
  const region = getRegion(location.regionKey)
  const area = getArea(location.regionKey, location.areaKey)
  const habitat = habitatForLocation(location)
  return [
    'HỆ SINH THÁI POKÉMON (luật bối cảnh):',
    `Khu hiện tại là ${area?.name ?? location.areaKey}, vùng ${region?.name ?? location.regionKey}; sinh cảnh chính: ${habitat.label}.`,
    `Buổi ${storyDate?.part ?? 'chưa rõ'}; thời tiết: ${weather?.label ?? 'chưa rõ'}.`,
    `Pokémon hoang xuất hiện trong chính văn phải hợp vùng, sinh cảnh, thời gian và thời tiết; ưu tiên các hệ ${habitat.types.join('/')}. Loài ngoại vùng, dạng tiến hoá quá mạnh, huyền thoại, thần thoại hoặc dạng Mega/Gigantamax chỉ xuất hiện khi có nguyên nhân cốt truyện rõ ràng — không dùng như gặp ngẫu nhiên. Pokémon do trainer sở hữu không bị khóa cứng bởi sinh cảnh. Không nhắc tới ghi chú hệ thống này.`,
  ].join('\n')
}
