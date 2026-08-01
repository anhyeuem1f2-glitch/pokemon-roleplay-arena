// Danh sách 151 loài Pokémon Gen 1 (dữ liệu công khai, thuần thông tin phân
// loại — tên & hệ, giống hệt kiểu dữ liệu trên Bulbapedia/Serebii/PokéAPI).
// species = slug khớp sprite Pokémon Showdown (ani/{species}.gif, ani-back/...).
import { getBossTier } from './bossTiers.js'
import { createStableId, publicPokemonCode } from './persistentIdentity.js'
import { ALL_TYPES, getEffectivenessMulti } from './pokemonTypes.js'
import { resolveAbilityForEntry } from './pokemonAbilities.js'
import { DEFAULT_FRIENDSHIP, friendshipTier, normalizeFriendship } from './pokemonFriendship.js'

export const POKEMON_SPECIES = [
  { name: 'Bulbasaur', species: 'bulbasaur', types: ['grass', 'poison'] },
  { name: 'Ivysaur', species: 'ivysaur', types: ['grass', 'poison'] },
  { name: 'Venusaur', species: 'venusaur', types: ['grass', 'poison'] },
  { name: 'Charmander', species: 'charmander', types: ['fire'] },
  { name: 'Charmeleon', species: 'charmeleon', types: ['fire'] },
  { name: 'Charizard', species: 'charizard', types: ['fire', 'flying'] },
  { name: 'Squirtle', species: 'squirtle', types: ['water'] },
  { name: 'Wartortle', species: 'wartortle', types: ['water'] },
  { name: 'Blastoise', species: 'blastoise', types: ['water'] },
  { name: 'Caterpie', species: 'caterpie', types: ['bug'] },
  { name: 'Metapod', species: 'metapod', types: ['bug'] },
  { name: 'Butterfree', species: 'butterfree', types: ['bug', 'flying'] },
  { name: 'Weedle', species: 'weedle', types: ['bug', 'poison'] },
  { name: 'Kakuna', species: 'kakuna', types: ['bug', 'poison'] },
  { name: 'Beedrill', species: 'beedrill', types: ['bug', 'poison'] },
  { name: 'Pidgey', species: 'pidgey', types: ['normal', 'flying'] },
  { name: 'Pidgeotto', species: 'pidgeotto', types: ['normal', 'flying'] },
  { name: 'Pidgeot', species: 'pidgeot', types: ['normal', 'flying'] },
  { name: 'Rattata', species: 'rattata', types: ['normal'] },
  { name: 'Raticate', species: 'raticate', types: ['normal'] },
  { name: 'Spearow', species: 'spearow', types: ['normal', 'flying'] },
  { name: 'Fearow', species: 'fearow', types: ['normal', 'flying'] },
  { name: 'Ekans', species: 'ekans', types: ['poison'] },
  { name: 'Arbok', species: 'arbok', types: ['poison'] },
  { name: 'Pikachu', species: 'pikachu', types: ['electric'] },
  { name: 'Raichu', species: 'raichu', types: ['electric'] },
  { name: 'Sandshrew', species: 'sandshrew', types: ['ground'] },
  { name: 'Sandslash', species: 'sandslash', types: ['ground'] },
  { name: 'Nidoran♀', species: 'nidoranf', types: ['poison'] },
  { name: 'Nidorina', species: 'nidorina', types: ['poison'] },
  { name: 'Nidoqueen', species: 'nidoqueen', types: ['poison', 'ground'] },
  { name: 'Nidoran♂', species: 'nidoranm', types: ['poison'] },
  { name: 'Nidorino', species: 'nidorino', types: ['poison'] },
  { name: 'Nidoking', species: 'nidoking', types: ['poison', 'ground'] },
  { name: 'Clefairy', species: 'clefairy', types: ['fairy'] },
  { name: 'Clefable', species: 'clefable', types: ['fairy'] },
  { name: 'Vulpix', species: 'vulpix', types: ['fire'] },
  { name: 'Ninetales', species: 'ninetales', types: ['fire'] },
  { name: 'Jigglypuff', species: 'jigglypuff', types: ['normal', 'fairy'] },
  { name: 'Wigglytuff', species: 'wigglytuff', types: ['normal', 'fairy'] },
  { name: 'Zubat', species: 'zubat', types: ['poison', 'flying'] },
  { name: 'Golbat', species: 'golbat', types: ['poison', 'flying'] },
  { name: 'Oddish', species: 'oddish', types: ['grass', 'poison'] },
  { name: 'Gloom', species: 'gloom', types: ['grass', 'poison'] },
  { name: 'Vileplume', species: 'vileplume', types: ['grass', 'poison'] },
  { name: 'Paras', species: 'paras', types: ['bug', 'grass'] },
  { name: 'Parasect', species: 'parasect', types: ['bug', 'grass'] },
  { name: 'Venonat', species: 'venonat', types: ['bug', 'poison'] },
  { name: 'Venomoth', species: 'venomoth', types: ['bug', 'poison'] },
  { name: 'Diglett', species: 'diglett', types: ['ground'] },
  { name: 'Dugtrio', species: 'dugtrio', types: ['ground'] },
  { name: 'Meowth', species: 'meowth', types: ['normal'] },
  { name: 'Persian', species: 'persian', types: ['normal'] },
  { name: 'Psyduck', species: 'psyduck', types: ['water'] },
  { name: 'Golduck', species: 'golduck', types: ['water'] },
  { name: 'Mankey', species: 'mankey', types: ['fighting'] },
  { name: 'Primeape', species: 'primeape', types: ['fighting'] },
  { name: 'Growlithe', species: 'growlithe', types: ['fire'] },
  { name: 'Arcanine', species: 'arcanine', types: ['fire'] },
  { name: 'Poliwag', species: 'poliwag', types: ['water'] },
  { name: 'Poliwhirl', species: 'poliwhirl', types: ['water'] },
  { name: 'Poliwrath', species: 'poliwrath', types: ['water', 'fighting'] },
  { name: 'Abra', species: 'abra', types: ['psychic'] },
  { name: 'Kadabra', species: 'kadabra', types: ['psychic'] },
  { name: 'Alakazam', species: 'alakazam', types: ['psychic'] },
  { name: 'Machop', species: 'machop', types: ['fighting'] },
  { name: 'Machoke', species: 'machoke', types: ['fighting'] },
  { name: 'Machamp', species: 'machamp', types: ['fighting'] },
  { name: 'Bellsprout', species: 'bellsprout', types: ['grass', 'poison'] },
  { name: 'Weepinbell', species: 'weepinbell', types: ['grass', 'poison'] },
  { name: 'Victreebel', species: 'victreebel', types: ['grass', 'poison'] },
  { name: 'Tentacool', species: 'tentacool', types: ['water', 'poison'] },
  { name: 'Tentacruel', species: 'tentacruel', types: ['water', 'poison'] },
  { name: 'Geodude', species: 'geodude', types: ['rock', 'ground'] },
  { name: 'Graveler', species: 'graveler', types: ['rock', 'ground'] },
  { name: 'Golem', species: 'golem', types: ['rock', 'ground'] },
  { name: 'Ponyta', species: 'ponyta', types: ['fire'] },
  { name: 'Rapidash', species: 'rapidash', types: ['fire'] },
  { name: 'Slowpoke', species: 'slowpoke', types: ['water', 'psychic'] },
  { name: 'Slowbro', species: 'slowbro', types: ['water', 'psychic'] },
  { name: 'Magnemite', species: 'magnemite', types: ['electric', 'steel'] },
  { name: 'Magneton', species: 'magneton', types: ['electric', 'steel'] },
  { name: "Farfetch'd", species: 'farfetchd', types: ['normal', 'flying'] },
  { name: 'Doduo', species: 'doduo', types: ['normal', 'flying'] },
  { name: 'Dodrio', species: 'dodrio', types: ['normal', 'flying'] },
  { name: 'Seel', species: 'seel', types: ['water'] },
  { name: 'Dewgong', species: 'dewgong', types: ['water', 'ice'] },
  { name: 'Grimer', species: 'grimer', types: ['poison'] },
  { name: 'Muk', species: 'muk', types: ['poison'] },
  { name: 'Shellder', species: 'shellder', types: ['water'] },
  { name: 'Cloyster', species: 'cloyster', types: ['water', 'ice'] },
  { name: 'Gastly', species: 'gastly', types: ['ghost', 'poison'] },
  { name: 'Haunter', species: 'haunter', types: ['ghost', 'poison'] },
  { name: 'Gengar', species: 'gengar', types: ['ghost', 'poison'] },
  { name: 'Onix', species: 'onix', types: ['rock', 'ground'] },
  { name: 'Drowzee', species: 'drowzee', types: ['psychic'] },
  { name: 'Hypno', species: 'hypno', types: ['psychic'] },
  { name: 'Krabby', species: 'krabby', types: ['water'] },
  { name: 'Kingler', species: 'kingler', types: ['water'] },
  { name: 'Voltorb', species: 'voltorb', types: ['electric'] },
  { name: 'Electrode', species: 'electrode', types: ['electric'] },
  { name: 'Exeggcute', species: 'exeggcute', types: ['grass', 'psychic'] },
  { name: 'Exeggutor', species: 'exeggutor', types: ['grass', 'psychic'] },
  { name: 'Cubone', species: 'cubone', types: ['ground'] },
  { name: 'Marowak', species: 'marowak', types: ['ground'] },
  { name: 'Hitmonlee', species: 'hitmonlee', types: ['fighting'] },
  { name: 'Hitmonchan', species: 'hitmonchan', types: ['fighting'] },
  { name: 'Lickitung', species: 'lickitung', types: ['normal'] },
  { name: 'Koffing', species: 'koffing', types: ['poison'] },
  { name: 'Weezing', species: 'weezing', types: ['poison'] },
  { name: 'Rhyhorn', species: 'rhyhorn', types: ['ground', 'rock'] },
  { name: 'Rhydon', species: 'rhydon', types: ['ground', 'rock'] },
  { name: 'Chansey', species: 'chansey', types: ['normal'] },
  { name: 'Tangela', species: 'tangela', types: ['grass'] },
  { name: 'Kangaskhan', species: 'kangaskhan', types: ['normal'] },
  { name: 'Horsea', species: 'horsea', types: ['water'] },
  { name: 'Seadra', species: 'seadra', types: ['water'] },
  { name: 'Goldeen', species: 'goldeen', types: ['water'] },
  { name: 'Seaking', species: 'seaking', types: ['water'] },
  { name: 'Staryu', species: 'staryu', types: ['water'] },
  { name: 'Starmie', species: 'starmie', types: ['water', 'psychic'] },
  { name: 'Mr. Mime', species: 'mrmime', types: ['psychic', 'fairy'] },
  { name: 'Scyther', species: 'scyther', types: ['bug', 'flying'] },
  { name: 'Jynx', species: 'jynx', types: ['ice', 'psychic'] },
  { name: 'Electabuzz', species: 'electabuzz', types: ['electric'] },
  { name: 'Magmar', species: 'magmar', types: ['fire'] },
  { name: 'Pinsir', species: 'pinsir', types: ['bug'] },
  { name: 'Tauros', species: 'tauros', types: ['normal'] },
  { name: 'Magikarp', species: 'magikarp', types: ['water'] },
  { name: 'Gyarados', species: 'gyarados', types: ['water', 'flying'] },
  { name: 'Lapras', species: 'lapras', types: ['water', 'ice'] },
  { name: 'Ditto', species: 'ditto', types: ['normal'] },
  { name: 'Eevee', species: 'eevee', types: ['normal'] },
  { name: 'Vaporeon', species: 'vaporeon', types: ['water'] },
  { name: 'Jolteon', species: 'jolteon', types: ['electric'] },
  { name: 'Flareon', species: 'flareon', types: ['fire'] },
  { name: 'Porygon', species: 'porygon', types: ['normal'] },
  { name: 'Omanyte', species: 'omanyte', types: ['rock', 'water'] },
  { name: 'Omastar', species: 'omastar', types: ['rock', 'water'] },
  { name: 'Kabuto', species: 'kabuto', types: ['rock', 'water'] },
  { name: 'Kabutops', species: 'kabutops', types: ['rock', 'water'] },
  { name: 'Aerodactyl', species: 'aerodactyl', types: ['rock', 'flying'] },
  { name: 'Snorlax', species: 'snorlax', types: ['normal'] },
  { name: 'Articuno', species: 'articuno', types: ['ice', 'flying'] },
  { name: 'Zapdos', species: 'zapdos', types: ['electric', 'flying'] },
  { name: 'Moltres', species: 'moltres', types: ['fire', 'flying'] },
  { name: 'Dratini', species: 'dratini', types: ['dragon'] },
  { name: 'Dragonair', species: 'dragonair', types: ['dragon'] },
  { name: 'Dragonite', species: 'dragonite', types: ['dragon', 'flying'] },
  { name: 'Mewtwo', species: 'mewtwo', types: ['psychic'] },
  { name: 'Mew', species: 'mew', types: ['psychic'] },
]

// Mỗi hệ có 1 chiêu tiêu biểu (STAB) dùng để tự sinh moveset — tránh phải gõ
// tay 4 chiêu cho từng loài trong 151 loài.
export const TYPE_SIGNATURE_MOVE = {
  normal: { name: 'Tackle', type: 'normal', power: 9, category: 'Physical' },
  fire: { name: 'Ember', type: 'fire', power: 12, category: 'Special' },
  water: { name: 'Water Gun', type: 'water', power: 12, category: 'Special' },
  electric: { name: 'Thunder Shock', type: 'electric', power: 12, category: 'Special' },
  grass: { name: 'Vine Whip', type: 'grass', power: 12, category: 'Physical' },
  ice: { name: 'Ice Shard', type: 'ice', power: 12, category: 'Physical' },
  fighting: { name: 'Karate Chop', type: 'fighting', power: 12, category: 'Physical' },
  poison: { name: 'Poison Sting', type: 'poison', power: 10, category: 'Physical' },
  ground: { name: 'Mud Slap', type: 'ground', power: 10, category: 'Special' },
  flying: { name: 'Gust', type: 'flying', power: 10, category: 'Special' },
  psychic: { name: 'Confusion', type: 'psychic', power: 12, category: 'Special' },
  bug: { name: 'Bug Bite', type: 'bug', power: 10, category: 'Physical' },
  rock: { name: 'Rock Throw', type: 'rock', power: 12, category: 'Physical' },
  ghost: { name: 'Lick', type: 'ghost', power: 9, category: 'Physical' },
  dragon: { name: 'Twister', type: 'dragon', power: 12, category: 'Special' },
  dark: { name: 'Bite', type: 'dark', power: 10, category: 'Physical' },
  steel: { name: 'Metal Claw', type: 'steel', power: 10, category: 'Physical' },
  fairy: { name: 'Fairy Wind', type: 'fairy', power: 10, category: 'Special' },
}

/**
 * Tự sinh 1 Pokémon chiến đấu từ dữ liệu loài (species trong POKEMON_SPECIES)
 * — moveset lấy STAB theo từng hệ của loài đó + 2 chiêu phụ trợ chung.
 */
// Công thức stat chuẩn của game Pokémon, giả định IV hoàn hảo (31) và không
// có EV/nature (đơn giản hoá, vì hệ thống này không quản lý IV/EV/nature).
// ============ IV / EV / NATURE — đúng công thức game gốc (đợt 48) ============
// - IV: 0-31 mỗi chỉ số, random lúc sinh, cố định trọn đời (như game).
// - EV: 0-252 mỗi chỉ số, tổng ≤ 510, nhận khi hạ đối thủ.
// - Nature: 25 tính cách, +10% một chỉ số / -10% một chỉ số (5 nature trung tính).
// Công thức Gen 3+: HP = ⌊(2·base + IV + ⌊EV/4⌋)·level/100⌋ + level + 10;
//                 khác = (⌊(2·base + IV + ⌊EV/4⌋)·level/100⌋ + 5)·nature.
export const NATURES = {
  Hardy: {}, Docile: {}, Serious: {}, Bashful: {}, Quirky: {},
  Lonely: { plus: 'atk', minus: 'def' }, Brave: { plus: 'atk', minus: 'spe' },
  Adamant: { plus: 'atk', minus: 'spa' }, Naughty: { plus: 'atk', minus: 'spd' },
  Bold: { plus: 'def', minus: 'atk' }, Relaxed: { plus: 'def', minus: 'spe' },
  Impish: { plus: 'def', minus: 'spa' }, Lax: { plus: 'def', minus: 'spd' },
  Timid: { plus: 'spe', minus: 'atk' }, Hasty: { plus: 'spe', minus: 'def' },
  Jolly: { plus: 'spe', minus: 'spa' }, Naive: { plus: 'spe', minus: 'spd' },
  Modest: { plus: 'spa', minus: 'atk' }, Mild: { plus: 'spa', minus: 'def' },
  Quiet: { plus: 'spa', minus: 'spe' }, Rash: { plus: 'spa', minus: 'spd' },
  Calm: { plus: 'spd', minus: 'atk' }, Gentle: { plus: 'spd', minus: 'def' },
  Sassy: { plus: 'spd', minus: 'spe' }, Careful: { plus: 'spd', minus: 'spa' },
}
const NATURE_NAMES = Object.keys(NATURES)
export function rollNature() {
  return NATURE_NAMES[Math.floor(Math.random() * NATURE_NAMES.length)]
}
export function rollIVs() {
  const r = () => Math.floor(Math.random() * 32)
  return { hp: r(), atk: r(), def: r(), spa: r(), spd: r(), spe: r() }
}
export function zeroEVs() {
  return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
}
function natureMult(nature, stat) {
  const n = NATURES[nature]
  if (!n) return 1
  if (n.plus === stat) return 1.1
  if (n.minus === stat) return 0.9
  return 1
}
/** Mô tả nature cho UI: "Adamant (+Atk −SpA)" / "Hardy (trung tính)". */
export function describeNature(nature) {
  const n = NATURES[nature]
  if (!n) return nature ?? '—'
  if (!n.plus) return `${nature} (trung tính)`
  const label = { atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' }
  return `${nature} (+${label[n.plus]} −${label[n.minus]})`
}

function computeStats(speciesEntry, level, build = null) {
  const base = speciesEntry.baseStats
  if (!base) return null
  // Back-compat: không truyền build → IV 31 / EV 0 / nature trung tính,
  // ra ĐÚNG số cũ (mọi caller cũ không đổi hành vi).
  const ivs = build?.ivs ?? { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
  const evs = build?.evs ?? zeroEVs()
  const nature = build?.nature ?? 'Hardy'
  const core = (k) => Math.floor(((2 * base[k] + (ivs[k] ?? 0) + Math.floor((evs[k] ?? 0) / 4)) * level) / 100)
  const nonHp = (k) => Math.floor((core(k) + 5) * natureMult(nature, k))
  return {
    hp: core('hp') + level + 10,
    atk: nonHp('atk'),
    def: nonHp('def'),
    spa: nonHp('spa'),
    spd: nonHp('spd'),
    spe: nonHp('spe'),
  }
}

/** Tính lại chỉ số 1 mon theo build hiện tại (sau khi nhận EV / lên level).
 * Giữ nguyên LƯỢNG máu đã mất: hp mới = hp cũ + (maxHp mới − maxHp cũ). */
export function recomputeMonStats(mon) {
  if (!mon?.baseStats) return mon
  const stats = computeStats({ baseStats: mon.baseStats }, mon.level, {
    ivs: mon.ivs, evs: mon.evs, nature: mon.nature,
  })
  if (!stats) return mon
  const newMax = mon.bossBars ? Math.round(stats.hp * (1 + 0.5 * (mon.bossBars - 1))) : stats.hp
  const hpDelta = newMax - (mon.maxHp ?? newMax)
  const wasFainted = Number(mon.hp) <= 0
  const adjustedHp = (mon.hp ?? newMax) + hpDelta
  return { ...mon, stats, maxHp: newMax, hp: wasFainted ? 0 : Math.max(1, Math.min(newMax, adjustedHp)) }
}

function rollGenderForSpecies(speciesEntry) {
  if (speciesEntry?.gender === 'N') return 'unknown'
  if (speciesEntry?.gender === 'M') return 'male'
  if (speciesEntry?.gender === 'F') return 'female'
  const maleChance = Number(speciesEntry?.genderRatio?.M)
  if (Number.isFinite(maleChance)) return Math.random() < maleChance ? 'male' : 'female'
  return Math.random() < 0.5 ? 'male' : 'female'
}

function rollTeraType(speciesEntry) {
  const native = (speciesEntry?.types ?? []).filter(Boolean)
  // Tera Type là thuộc tính cố định của cá thể. Phần lớn hoang dã mang hệ gốc,
  // nhưng vẫn có một phần nhỏ mang hệ khác để Tera không bị khóa vào types[0].
  if (native.length && Math.random() < 0.8) return native[Math.floor(Math.random() * native.length)]
  return ALL_TYPES[Math.floor(Math.random() * ALL_TYPES.length)] ?? native[0] ?? 'normal'
}

function withMovePp(move) {
  const maxPp = Math.max(1, Number(move?.maxPp ?? move?.pp) || 35)
  return { ...move, maxPp, currentPp: Math.max(0, Math.min(maxPp, Number(move?.currentPp ?? maxPp))) }
}

const EV_TOTAL_CAP = 510
const EV_STAT_CAP = 252
/** EV nhận được khi HẠ 1 đối thủ (đợt 48) — mô phỏng yield game gốc: cộng
 * vào CHỈ SỐ BASE CAO NHẤT của loài bị hạ; lượng theo độ mạnh (BST):
 * huyền thoại/BST≥600 → 3, tiến hoá cuối/BST≥490 → 2, còn lại → 1. */
export function applyEvGain(mon, defeated) {
  if (!mon?.baseStats || !defeated?.baseStats) return mon
  const evs = { ...(mon.evs ?? zeroEVs()) }
  const total = Object.values(evs).reduce((a, b) => a + b, 0)
  if (total >= EV_TOTAL_CAP) return mon
  const entries = Object.entries(defeated.baseStats).filter(([k]) => k in evs)
  entries.sort((a, b) => b[1] - a[1])
  const stat = entries[0]?.[0]
  if (!stat) return mon
  const bst = Object.values(defeated.baseStats).reduce((a, b) => a + b, 0)
  const amount = bst >= 600 ? 3 : bst >= 490 ? 2 : 1
  const grant = Math.min(amount, EV_STAT_CAP - evs[stat], EV_TOTAL_CAP - total)
  if (grant <= 0) return mon
  evs[stat] = evs[stat] + grant
  return recomputeMonStats({ ...mon, evs, evGainNote: `+${grant} EV ${stat}` })
}

// Vài loài có chiêu "đặc trưng" nổi tiếng trong cộng đồng thi đấu (dựa theo
// stat/ability đặc biệt của chúng) — ưu tiên học các chiêu này trước nếu học
// được, thay vì để thuật toán chấm điểm tự chọn (đôi khi sẽ ra kết quả khác
// dù vẫn hợp lý). Danh sách này CHỈ là điểm khởi đầu nhỏ, không phủ hết mọi
// loài — báo thêm loài nào cần bổ sung khi thấy chưa hợp lý.
const SIGNATURE_MOVE_OVERRIDES = {
  Aggron: ['Heavy Slam', 'Body Press'],
  Conkeldurr: ['Drain Punch', 'Mach Punch'],
  Ferrothorn: ['Power Whip', 'Gyro Ball'],
  Dragonite: ['Extreme Speed', 'Outrage'],
  Snorlax: ['Body Slam', 'Heavy Slam'],
  Gyarados: ['Waterfall', 'Crunch'],
  Metagross: ['Meteor Mash', 'Zen Headbutt'],
  Garchomp: ['Earthquake', 'Dragon Claw'],
  Tyranitar: ['Stone Edge', 'Crunch'],
  Excadrill: ['Earthquake', 'Iron Head'],
}

// Move mang tính "khựng lượt" — recharge (VD Hyper Beam) khiến mất nguyên 1
// lượt sau đó, cực kỳ rủi ro trong hệ thống lượt-đơn-giản (không mô phỏng
// được AI né đòn lúc khựng) — hạ điểm mạnh để tránh chọn trừ khi không còn
// lựa chọn nào khác.
function effectMultiplier(mv) {
  let mult = 1
  if (mv.flags?.recharge) mult *= 0.3
  if (Array.isArray(mv.recoil) && mv.recoil[0] / mv.recoil[1] >= 0.25) mult *= 0.75
  if (mv.secondary?.status) mult *= 1.25 // hiệu ứng phụ tốt (bỏng/tê liệt/ngủ...)
  if (mv.secondary?.boosts && Object.values(mv.secondary.boosts).some((v) => v < 0)) mult *= 1.15 // giảm chỉ số đối thủ
  return mult
}


// ============ HỌC CHIÊU KHI LÊN CẤP (đợt 82) ============
// Pokémon chỉ được mang tối đa 4 chiêu. Trước đây app chỉ sinh moveset lúc
// Pokémon được tạo, sau đó lên cấp KHÔNG BAO GIỜ dò learnset lại; save cũ tải
// trước khi movesDb sẵn sàng còn bị kẹt với 2 chiêu fallback (Ember/Scratch).
// Các helper dưới đây tạo hàng chờ học chiêu theo level, giữ hàng chờ ngay
// trên cá thể để persist qua reload và cho UI chuẩn "học / quên chiêu" xử lý.
export function moveId(value) {
  return String(value?.id ?? value?.name ?? value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function learnsetForMon(mon, movesDb) {
  if (!mon || !movesDb?.learnsets) return []
  const ids = [mon.species, mon.baseSpeciesId, mon.name].map(moveId).filter(Boolean)
  for (const id of ids) {
    if (movesDb.learnsets[id]?.length) return movesDb.learnsets[id]
  }
  return []
}

function fullMoveFromDb(moveRef, movesDb) {
  const id = moveId(moveRef?.move ?? moveRef)
  if (!id) return null
  const source = movesDb?.allMoves?.[id] ?? movesDb?.moves?.[id]
  if (!source) return null
  return { ...source, id: source.id ?? id }
}

/** Các chiêu level-up đi qua trong khoảng (fromLevel, toLevel]. */
export function levelUpMovesBetween(mon, fromLevel, toLevel, movesDb) {
  if (!mon || !movesDb?.allMoves || toLevel <= fromLevel) return []
  const known = new Set((mon.moves ?? []).map(moveId))
  const pending = new Set((mon.pendingMoveLearns ?? []).map(moveId))
  const seen = new Set()
  return learnsetForMon(mon, movesDb)
    .filter((entry) => entry.method === 'L' && entry.level > fromLevel && entry.level <= toLevel)
    .sort((a, b) => a.level - b.level || a.move.localeCompare(b.move))
    .map((entry) => {
      const move = fullMoveFromDb(entry, movesDb)
      return move ? { ...move, learnedAtLevel: entry.level } : null
    })
    .filter((move) => {
      const id = moveId(move)
      if (!id || known.has(id) || pending.has(id) || seen.has(id)) return false
      seen.add(id)
      return true
    })
}

/** Chiêu có level 0 trong learnset là chiêu học ngay khi tiến hoá. */
export function queueEvolutionMoves(mon, movesDb) {
  if (!mon || !movesDb?.allMoves) return mon
  const known = new Set((mon.moves ?? []).map(moveId))
  const pending = new Set((mon.pendingMoveLearns ?? []).map(moveId))
  const additions = []
  for (const entry of learnsetForMon(mon, movesDb)) {
    if (entry.method !== 'L' || entry.level !== 0) continue
    const move = fullMoveFromDb(entry, movesDb)
    const id = moveId(move)
    if (!move || !id || known.has(id) || pending.has(id)) continue
    additions.push({ ...move, learnedAtLevel: mon.level ?? 1, learnedOnEvolution: true })
    pending.add(id)
  }
  return additions.length ? { ...mon, pendingMoveLearns: [...(mon.pendingMoveLearns ?? []), ...additions] } : mon
}

/** Gắn các chiêu mới vào hàng chờ; không tự thay chiêu người chơi đang dùng. */
export function queueLevelUpMoves(mon, fromLevel, toLevel, movesDb) {
  if (!mon) return mon
  const additions = levelUpMovesBetween(mon, fromLevel, toLevel, movesDb)
  if (!additions.length) return mon
  return {
    ...mon,
    pendingMoveLearns: [...(mon.pendingMoveLearns ?? []), ...additions],
  }
}

/**
 * Sửa save cũ bị chỉ còn 0-2 chiêu hoặc move object thiếu metadata.
 * - Giữ các chiêu hiện có nếu hợp lệ.
 * - Bổ sung từ những chiêu level-up gần nhất mà loài đã đạt tới.
 * - Không vượt quá 4 và không tự thay bộ 4 chiêu hợp lệ của người chơi.
 */
export function repairOwnedMonMoves(mon, movesDb) {
  if (!mon || !movesDb?.allMoves) return mon
  const normalized = []
  const seen = new Set()
  for (const raw of mon.moves ?? []) {
    const id = moveId(raw)
    if (!id || seen.has(id)) continue
    const full = movesDb.allMoves[id]
    normalized.push(full
      ? withMovePp({ ...full, id, currentPp: raw?.currentPp })
      : (typeof raw === 'string' ? { id, name: raw, type: 'normal', category: 'Status', power: 0 } : { ...raw, id }))
    seen.add(id)
    if (normalized.length >= 4) break
  }

  if (normalized.length < 4) {
    const eligible = learnsetForMon(mon, movesDb)
      .filter((entry) => entry.method === 'L' && entry.level <= (mon.level ?? 1))
      .sort((a, b) => b.level - a.level || a.move.localeCompare(b.move))
    for (const entry of eligible) {
      if (normalized.length >= 4) break
      const move = fullMoveFromDb(entry, movesDb)
      const id = moveId(move)
      if (!move || !id || seen.has(id)) continue
      normalized.push(withMovePp(move))
      seen.add(id)
    }
  }

  if (!normalized.length) return mon
  const pending = (mon.pendingMoveLearns ?? [])
    .map((move) => {
      const id = moveId(move)
      const full = movesDb.allMoves[id]
      return full ? { ...full, id, learnedAtLevel: move.learnedAtLevel } : move
    })
    .filter((move) => !seen.has(moveId(move)))
  return {
    ...mon,
    moves: normalized.slice(0, 4),
    pendingMoveLearns: pending,
    moveDataVersion: 2,
  }
}

/** Học chiêu đầu hàng chờ; replaceIndex=null chỉ hợp lệ khi còn dưới 4 chiêu. */
export function resolvePendingMoveLearn(mon, { replaceIndex = null, skip = false } = {}) {
  if (!mon?.pendingMoveLearns?.length) return mon
  const [candidate, ...rest] = mon.pendingMoveLearns
  if (skip) return { ...mon, pendingMoveLearns: rest }
  const known = new Set((mon.moves ?? []).map(moveId))
  if (known.has(moveId(candidate))) return { ...mon, pendingMoveLearns: rest }
  const moves = [...(mon.moves ?? [])]
  if (moves.length < 4) moves.push(candidate)
  else if (Number.isInteger(replaceIndex) && replaceIndex >= 0 && replaceIndex < 4) moves[replaceIndex] = candidate
  else return mon
  return { ...mon, moves: moves.slice(0, 4), pendingMoveLearns: rest }
}

/**
 * Giao thức chọn chiêu:
 * 1. Lấy toàn bộ chiêu học được (level-up tới level hiện tại; + chiêu TM nếu
 *    là Pokémon CỦA TRAINER — `includeTm=true`).
 * 2. Nếu loài nằm trong SIGNATURE_MOVE_OVERRIDES và học được, ưu tiên chọn
 *    trước.
 * 3. Chia 2 nhóm theo chỉ số TẤN CÔNG cao hơn (Atk vs SpAtk) — ưu tiên học
 *    hết chiêu thuộc nhóm đó trước (tính điểm = power × stat tương ứng ×
 *    hệ số khắc chế đối thủ × hệ số hiệu ứng phụ).
 * 4. Nếu vẫn chưa đủ 4 chiêu, mới lấy thêm từ nhóm chỉ số còn lại (chiêu
 *    power cao) — ưu tiên chiêu không có tác dụng phụ khựng lượt, ưu tiên
 *    chiêu có hiệu ứng phụ tốt.
 */
export const ENCOUNTER_MOVESET_VERSION = 3

function trainerTmPolicy(level) {
  const lv = Math.max(1, Number(level) || 1)
  if (lv < 15) return { maxCount: 0, maxPower: 0 }
  if (lv < 30) return { maxCount: 1, maxPower: 60 }
  if (lv < 45) return { maxCount: 1, maxPower: 80 }
  if (lv < 60) return { maxCount: 2, maxPower: 100 }
  return { maxCount: 2, maxPower: Infinity }
}

function trainerTmIsAppropriate(move, level, policy) {
  if (!move || policy.maxCount <= 0) return false
  const power = Number(move.power) || 0
  if (power > policy.maxPower) return false
  // Những chiêu buộc khựng lượt hoặc có uy lực cực đoan không xuất hiện ở
  // trainer cấp thấp chỉ vì learnset ghi "học được bằng TM".
  if (move.flags?.recharge && level < 50) return false
  if (power >= 120 && level < 60) return false
  return true
}

function encounterMoveEntries(speciesEntry, level, movesDb, includeTm = false) {
  const learnable =
    movesDb?.learnsets?.[speciesEntry.species] ??
    (speciesEntry.baseSpeciesId ? movesDb?.learnsets?.[speciesEntry.baseSpeciesId] : null)
  if (!learnable?.length || !movesDb?.allMoves) return []

  const policy = trainerTmPolicy(level)
  const out = []
  const seen = new Set()
  for (const entry of learnable) {
    const isLevelMove = entry.method === 'L' && entry.level <= level
    const move = movesDb.allMoves[entry.move]
    const isTmMove = includeTm && entry.method === 'M' && trainerTmIsAppropriate(move, level, policy)
    if ((!isLevelMove && !isTmMove) || !move) continue
    const id = moveId(move)
    if (!id || seen.has(`${id}|${entry.method}`)) continue
    seen.add(`${id}|${entry.method}`)
    out.push({ move: { ...move }, method: entry.method, learnedAt: entry.level ?? 0 })
  }
  return out
}

function supportMoveScore(move) {
  let score = 0
  if (move.heal) score += 95
  if (move.status) score += 75
  if (move.weather) score += 55
  if (move.boosts) {
    const values = Object.values(move.boosts)
    if (values.some((value) => value > 0)) score += 70
    if (values.some((value) => value < 0)) score += 55
  }
  if (move.self?.boosts) score += 65
  if (move.secondary?.status) score += 25
  if (move.secondary?.boosts) score += 20
  return score || 12
}

/**
 * Chọn bộ 4 chiêu hợp lệ cho Pokémon gặp trong trận.
 * - Hoang dã: chỉ level-up move đã học tới level hiện tại.
 * - Trainer/NPC: level-up move + số TM giới hạn theo level; trainer cấp thấp
 *   không còn tự nhiên sở hữu Earthquake/Hyper Beam chỉ vì loài đó học TM.
 * - Ưu tiên thiên hướng Atk/SpA, STAB/coverage và giữ tối đa một chiêu hỗ trợ
 *   hữu ích trước khi lấp các ô còn lại.
 */
export function pickEncounterMoves(speciesEntry, level, movesDb, stats, opponentTypes = null, includeTm = false) {
  const entries = encounterMoveEntries(speciesEntry, level, movesDb, includeTm)
  if (!entries.length) return fallbackMoves(speciesEntry)

  const dominantStat = stats ? (stats.atk >= stats.spa ? 'Physical' : 'Special') : null
  const tmPolicy = trainerTmPolicy(level)
  const scored = entries.map((entry) => {
    const mv = entry.move
    const damaging = (Number(mv.power) || 0) > 0
    const offenseStat = stats ? (mv.category === 'Special' ? stats.spa : stats.atk) : 1
    const coverage = opponentTypes?.length ? getEffectivenessMulti(mv.type, opponentTypes) : 1
    const stab = speciesEntry.types?.includes(mv.type) ? 1.35 : 1
    const recentLevelBoost = entry.method === 'L'
      ? 1 + Math.min(0.35, Math.max(0, Number(entry.learnedAt) || 0) / Math.max(1, level) * 0.35)
      : 0.92
    const signature = SIGNATURE_MOVE_OVERRIDES[speciesEntry.name]?.includes(mv.name) ? 3 : 1
    const base = damaging
      ? (Number(mv.power) || 1) * Math.max(1, offenseStat) * coverage * stab * effectMultiplier(mv)
      : supportMoveScore(mv) * Math.max(40, level * 3)
    return { ...entry, score: base * recentLevelBoost * signature, damaging }
  })

  const picked = []
  const seen = new Set()
  let tmPicked = 0
  const take = (entry) => {
    if (!entry || picked.length >= 4) return false
    const id = moveId(entry.move)
    if (!id || seen.has(id)) return false
    if (entry.method === 'M' && tmPicked >= tmPolicy.maxCount) return false
    seen.add(id)
    if (entry.method === 'M') tmPicked += 1
    picked.push({ ...entry.move })
    return true
  }
  const ranked = (list) => [...list].sort((a, b) => b.score - a.score || b.learnedAt - a.learnedAt)

  // Chiêu đặc trưng hợp lệ được xét trước, nhưng vẫn tuân giới hạn TM/level.
  const signatures = ranked(scored.filter((entry) => SIGNATURE_MOVE_OVERRIDES[speciesEntry.name]?.includes(entry.move.name)))
  for (const entry of signatures) take(entry)

  const damaging = scored.filter((entry) => entry.damaging)
  if (dominantStat) {
    for (const entry of ranked(damaging.filter((item) => item.move.category === dominantStat))) take(entry)
  }

  // Giữ một lựa chọn chiến thuật thật sự hữu ích khi có đủ dữ liệu. Wild
  // cấp rất thấp vẫn ưu tiên các đòn gây sát thương cơ bản.
  if (level >= 8 && picked.length < 4) {
    const support = ranked(scored.filter((entry) => !entry.damaging))
    if (support.length) take(support[0])
  }

  for (const entry of ranked(damaging)) take(entry)
  for (const entry of ranked(scored)) take(entry)

  return picked.length ? picked.slice(0, 4) : fallbackMoves(speciesEntry)
}

// Tên cũ được giữ nội bộ để tránh làm hỏng các callsite cũ.
function pickMoves(speciesEntry, level, movesDb, stats, opponentTypes = null, includeTm = false) {
  return pickEncounterMoves(speciesEntry, level, movesDb, stats, opponentTypes, includeTm)
}

/**
 * Sửa Pokémon đối thủ được tạo khi learnset chưa tải xong hoặc snapshot cũ
 * còn bộ fallback/chiêu vượt level. Chỉ đụng moveset; HP, status, held item,
 * Ability và runtime trận được giữ nguyên. `movesetLocked` dành cho kịch bản
 * chủ động cấu hình bộ chiêu riêng trong tương lai.
 */
export function repairEncounterMonMoves(mon, speciesEntry, movesDb, opponentTypes = null) {
  if (!mon || !speciesEntry || !movesDb?.allMoves || !movesDb?.learnsets) return mon
  if (mon.movesetLocked) {
    const normalized = (mon.moves ?? []).map((raw) => movesDb.allMoves[moveId(raw)] ?? raw).filter(Boolean).slice(0, 4)
    const changed = normalized.some((move, index) => move !== mon.moves?.[index])
    return changed ? { ...mon, moves: normalized } : mon
  }

  const expected = pickEncounterMoves(
    speciesEntry,
    Math.max(1, Number(mon.level) || 1),
    movesDb,
    mon.stats,
    opponentTypes,
    Boolean(mon.isTrainerMon),
  )
  const currentIds = (mon.moves ?? []).map(moveId).filter(Boolean)
  const expectedIds = expected.map(moveId)
  const same = currentIds.length === expectedIds.length && currentIds.every((id, index) => id === expectedIds[index])
  const metadataComplete = (mon.moves ?? []).every((move) => {
    const full = movesDb.allMoves[moveId(move)]
    return full && move?.category === full.category && move?.type === full.type
  })
  if (same && metadataComplete && mon.movesetDataVersion === ENCOUNTER_MOVESET_VERSION) return mon

  const currentById = new Map((mon.moves ?? []).map((move) => [moveId(move), move]))
  return {
    ...mon,
    moves: expected.map((move) => withMovePp({ ...move, currentPp: currentById.get(moveId(move))?.currentPp })),
    movesetSource: mon.isTrainerMon ? 'trainer-level-aware' : 'wild-level-up',
    movesetDataVersion: ENCOUNTER_MOVESET_VERSION,
  }
}

function fallbackMoves(speciesEntry) {
  const stabMoves = speciesEntry.types.map((t) => TYPE_SIGNATURE_MOVE[t]).filter(Boolean)
  return [
    ...stabMoves,
    { name: 'Growl', type: 'normal', power: 0, category: 'Status', boosts: { atk: -1 }, target: 'normal' },
    { name: 'Quick Attack', type: 'normal', power: 8, category: 'Physical', priority: 1 },
    { name: 'Leer', type: 'normal', power: 0, category: 'Status', boosts: { def: -1 }, target: 'normal' },
  ].slice(0, 4)
}

/**
 * @param {object} speciesEntry
 * @param {number} level
 * @param {{moves: object, learnsets: object}} [movesDb] dữ liệu chiêu thật đã
 * tải (xem src/utils/movesFetch.js) — để trống thì dùng hệ STAB cố định cũ.
 * @param {string[]} [opponentTypes] hệ của đối thủ (đội hình người chơi) —
 * để ưu tiên chiêu khắc chế, có thể bỏ trống nếu không rõ.
 * @param {boolean} [isTrainerMon] true = Pokémon CỦA TRAINER (được xét thêm
 * chiêu học qua TM), false/mặc định = Pokémon hoang dã (chỉ chiêu level-up).
 */
/**
 * BỂ CHIÊU đầy đủ của 1 loài (đợt 26 — cho combat anime): MỌI chiêu trong
 * learnset gen hiện tại (level-up bất kỳ level + TM), kể cả chiêu Status —
 * KHÔNG giới hạn 4 chiêu như hệ theo lượt. Trả về mảng {name, type, power,
 * category} đã khử trùng lặp, sort theo tên. Trống nếu chưa tải movesDb.
 */
export function getMovePool(speciesEntry, movesDb) {
  if (!movesDb?.learnsets || !movesDb?.allMoves) return []
  const learnset =
    movesDb.learnsets[speciesEntry.species] ??
    (speciesEntry.baseSpeciesId ? movesDb.learnsets[speciesEntry.baseSpeciesId] : null)
  if (!learnset) return []
  const seen = new Set()
  const pool = []
  for (const e of learnset) {
    if (seen.has(e.move)) continue
    seen.add(e.move)
    const mv = movesDb.allMoves[e.move]
    if (mv) pool.push(mv)
  }
  return pool.sort((a, b) => a.name.localeCompare(b.name))
}

export function buildWildMon(speciesEntry, level = 10, movesDb = null, opponentTypes = null, isTrainerMon = false) {
  // IV/EV/Nature thật (đợt 48): mỗi cá thể sinh ra một khác — đúng game gốc.
  const ivs = rollIVs()
  const evs = zeroEVs()
  const nature = rollNature()
  const stats = computeStats(speciesEntry, level, { ivs, evs, nature })
  const moves = pickMoves(speciesEntry, level, movesDb, stats, opponentTypes, isTrainerMon)
  // HP dùng công thức thật nếu có baseStats (mỗi loài ra số khác nhau đúng
  // theo độ trâu thật của nó) — fallback công thức cũ (30+level*2) cho loài
  // không có baseStats (VD 151 loài tĩnh dự phòng khi chưa tải được pokedex).
  const maxHp = stats ? stats.hp : 30 + level * 2
  const uid = createStableId('pkm')
  const ability = resolveAbilityForEntry(speciesEntry, null, uid)
  const randomMark = Math.random() < 1 / 80
    ? ['Dấu Ấn Hiếu Kỳ', 'Dấu Ấn Điềm Tĩnh', 'Dấu Ấn Năng Động', 'Dấu Ấn Hay Đói', 'Dấu Ấn Lang Thang'][Math.floor(Math.random() * 5)]
    : null
  return {
    name: speciesEntry.name,
    species: speciesEntry.species,
    spriteId: speciesEntry.spriteId ?? speciesEntry.species,
    // Metadata Pokédex/sinh thái của cá thể. Save cũ không có vẫn được dò
    // ngược từ `species`; cá thể mới giữ sẵn để ghi seen/caught chính xác.
    dexNum: Number.isFinite(speciesEntry.num) ? speciesEntry.num : null,
    gen: Number.isFinite(speciesEntry.gen) ? speciesEntry.gen : null,
    forme: speciesEntry.forme ?? null,
    baseSpeciesId: speciesEntry.baseSpeciesId ?? null,
    level,
    types: speciesEntry.types,
    stats, // {hp,atk,def,spa,spd,spe} thật hoặc null — BattleModal dùng để tính sát thương đúng
    // Build cá thể (đợt 48) — baseStats lưu kèm để tính lại khi nhận EV.
    ivs, evs, nature,
    // EXP khởi điểm đúng mốc đầu cấp (đợt 65) — không có trường này thì
    // Pokémon mới bắt/nhận sẽ bị coi như 0 EXP và tụt cấp khi cộng EXP.
    exp: level * level * level,
    // MÃ ĐỊNH DANH cá thể (đợt 69): trước đây đồng bộ playerMon ↔ party khớp
    // theo TÊN, nên 2 con cùng loài (hoặc tên đổi) là lệch nhau — người chơi
    // báo "🧬 bảo lên Lv.8 mà HUD vẫn Lv.6". uid không đổi trọn đời cá thể.
    uid,
    // Đợt 87: mã công khai ổn định dùng cho trao đổi thử nghiệm. uid là
    // khoá nội bộ; pokemonId là mã ngắn người chơi có thể đối chiếu trên UI.
    pokemonId: publicPokemonCode(uid),
    originalTrainerId: null,
    currentTrainerId: null,
    tradeHistory: [],
    // Biến cá thể đời sống: shiny đúng tỉ lệ cơ bản 1/4096, giới tính/kích
    // thước cố định và Mark hiếm. Tất cả persist theo đúng cá thể.
    shiny: Math.random() < 1 / 4096,
    gender: rollGenderForSpecies(speciesEntry),
    genderRatio: speciesEntry.genderRatio ? { ...speciesEntry.genderRatio } : null,
    eggGroups: [...(speciesEntry.eggGroups ?? [])],
    eggSpecies: speciesEntry.eggSpecies ?? speciesEntry.species,
    eggSpeciesName: speciesEntry.eggSpeciesName ?? speciesEntry.name,
    teraType: rollTeraType(speciesEntry),
    gmaxFactor: false,
    sizeClass: Math.random() < 0.06 ? 'tiny' : Math.random() > 0.94 ? 'jumbo' : 'average',
    ribbons: [],
    marks: randomMark ? [randomMark] : [],
    // Ability + độ thân mật là biến CỦA CÁ THỂ, persist qua save/tiến hoá.
    ability: ability.name,
    abilitySlot: ability.slot,
    abilityHidden: ability.hidden,
    friendship: Number.isFinite(speciesEntry.baseFriendship)
      ? speciesEntry.baseFriendship
      : DEFAULT_FRIENDSHIP,
    baseStats: speciesEntry.baseStats ?? null,
    catchRate: Number.isFinite(speciesEntry.catchRate) ? speciesEntry.catchRate : 120,
    // Held item Eviolite và forme battle cần biết cá thể còn tiến hoá được.
    hasEvo: Boolean(speciesEntry.hasEvo),
    hasPrevo: Boolean(speciesEntry.hasPrevo),
    // Đợt 71: LƯU cờ này lên chính đối tượng mon. Trước đây `isTrainerMon`
    // chỉ là tham số dùng nội bộ cho pickMoves rồi bị vứt đi — nên
    // `enemyMon.isTrainerMon` luôn undefined, kéo theo 2 hậu quả: thưởng EXP
    // x1.5 cho trận trainer không bao giờ áp, và app không có cách nào biết
    // để chặn bắt Pokémon của huấn luyện viên khác.
    isTrainerMon: Boolean(isTrainerMon),
    maxHp,
    hp: maxHp,
    moves: moves.map(withMovePp),
    movesetSource: movesDb?.learnsets ? (isTrainerMon ? 'trainer-level-aware' : 'wild-level-up') : 'fallback',
    movesetDataVersion: movesDb?.learnsets ? ENCOUNTER_MOVESET_VERSION : 0,
  }
}

/**
 * Tạo Boss: dựa trên buildWildMon nhưng nhân thêm HP theo số thanh máu của
 * tier (2 thanh = x1.5 HP, 3 thanh = x2, 5 thanh = x3) để boss thật sự trâu
 * hơn hẳn Pokémon thường, không chỉ đơn thuần là "level cao hơn".
 * @param {object} speciesEntry
 * @param {number} level
 * @param {{hpBars:number,label:string}} tier từ getBossTier()/BOSS_TIERS
 * @param {object} [movesDb]
 */
export function buildBossMon(speciesEntry, level, tier, movesDb = null, opponentTypes = null, isTrainerMon = false) {
  const base = buildWildMon(speciesEntry, level, movesDb, opponentTypes, isTrainerMon)
  const hpMultiplier = 1 + 0.5 * (tier.hpBars - 1)
  const maxHp = Math.round(base.maxHp * hpMultiplier)
  return {
    ...base,
    maxHp,
    hp: maxHp,
    bossBars: tier.hpBars,
    bossTierLabel: tier.label,
  }
}

/**
 * Tự tạo Pokémon phe MÌNH thông minh: nếu loài được chọn là huyền thoại/huyền
 * ảo nằm trong BOSS_TIERS, vẫn cho nó đúng HP mạnh của bậc đó (không "nerf"
 * khi về đội mình) — level được ép không vượt quá trần của tier để tránh
 * vượt giới hạn thiết kế.
 */
export function buildMonSmart(speciesEntry, level, movesDb = null, opponentTypes = null, isTrainerMon = false) {
  const tier = getBossTier(speciesEntry.name)
  if (!tier) return buildWildMon(speciesEntry, level, movesDb, opponentTypes, isTrainerMon)
  const cappedLevel = Math.min(level, tier.maxLevel)
  return buildBossMon(speciesEntry, cappedLevel, tier, movesDb, opponentTypes, isTrainerMon)
}

function evolutionId(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Hai entry có quan hệ tiến hoá TRỰC TIẾP hay không. */
export function isDirectEvolution(fromEntry, toEntry) {
  if (!fromEntry || !toEntry) return false
  const fromIds = new Set([fromEntry.name, fromEntry.species].map(evolutionId).filter(Boolean))
  const toIds = new Set([toEntry.name, toEntry.species].map(evolutionId).filter(Boolean))
  const targetPrevo = evolutionId(toEntry.prevo)
  if (targetPrevo && fromIds.has(targetPrevo)) return true
  for (const evo of fromEntry.evos ?? []) {
    if (toIds.has(evolutionId(evo))) return true
  }
  return false
}

function evolutionTextId(value) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '')
}

/** Kiểm tra điều kiện tiến hoá được giữ từ Pokédex Showdown. */
export function validateEvolutionRequirements(mon, fromEntry, targetEntry, context = {}) {
  if (!mon || !targetEntry) return { ok: false, reason: 'thiếu dữ liệu Pokémon/loài đích' }
  if (targetEntry.battleOnly || targetEntry.changesFrom || /(?:mega|gmax|primal|eternamax|ultra)$/i.test(String(targetEntry.forme ?? ''))) {
    return { ok: false, reason: `${targetEntry.name} là dạng chiến đấu tạm thời, không phải tiến hoá vĩnh viễn` }
  }
  if (!context.adminMode && !isDirectEvolution(fromEntry, targetEntry)) {
    return { ok: false, reason: 'không phải nhánh tiến hoá trực tiếp' }
  }
  if (context.adminMode || context.mode !== 'realistic') return { ok: true, reason: '' }

  if (Number.isFinite(targetEntry.evoLevel) && (mon.level ?? 1) < targetEntry.evoLevel) {
    return { ok: false, reason: `cần Lv.${targetEntry.evoLevel}, hiện Lv.${mon.level ?? 1}` }
  }
  const knownMoves = new Set((mon.moves ?? []).map((move) => evolutionTextId(move.name ?? move.id)))
  if (targetEntry.evoMove && !knownMoves.has(evolutionTextId(targetEntry.evoMove))) {
    return { ok: false, reason: `cần biết chiêu ${targetEntry.evoMove}` }
  }
  const evoType = String(targetEntry.evoType ?? '').toLowerCase()
  if (evoType.includes('friendship') && Number(mon.friendship ?? 70) < 220) {
    return { ok: false, reason: `cần Friendship tối thiểu 220, hiện ${mon.friendship ?? 70}` }
  }
  const heldName = evolutionTextId(mon.heldItem?.name ?? mon.heldItem?.id)
  if (evoType.includes('hold') && targetEntry.evoItem && heldName !== evolutionTextId(targetEntry.evoItem)) {
    return { ok: false, reason: `cần cầm ${targetEntry.evoItem}` }
  }
  if (evoType.includes('trade') && !(mon.tradeHistory ?? []).length) {
    return { ok: false, reason: 'cần tiến hoá qua một giao dịch Pokémon hợp lệ' }
  }
  if (evoType.includes('trade') && targetEntry.evoItem && heldName !== evolutionTextId(targetEntry.evoItem)) {
    return { ok: false, reason: `cần cầm ${targetEntry.evoItem} trong lúc trao đổi` }
  }
  if (evoType.includes('useitem') && targetEntry.evoItem) {
    const itemId = evolutionTextId(targetEntry.evoItem)
    const stock = (context.inventory ?? []).filter((item) => evolutionTextId(`${item.id}${item.name}`) === itemId
      || evolutionTextId(item.id) === itemId || evolutionTextId(item.name) === itemId)
      .reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0)
    if (stock <= 0 || !evolutionTextId(context.storyText).includes(itemId)) {
      return { ok: false, reason: `cần sử dụng ${targetEntry.evoItem} đang có trong túi` }
    }
  }
  const condition = String(targetEntry.evoCondition ?? '').toLowerCase()
  const part = String(context.storyDate?.part ?? '').toLowerCase()
  if (targetEntry.evoGender && String(mon.gender).toLowerCase() !== String(targetEntry.evoGender).toLowerCase()) {
    return { ok: false, reason: `cần giới tính ${targetEntry.evoGender}` }
  }
  if (targetEntry.evoRegion) {
    const currentRegion = evolutionTextId(`${context.location?.regionKey ?? ''} ${context.location?.regionName ?? ''}`)
    if (!currentRegion.includes(evolutionTextId(targetEntry.evoRegion))) return { ok: false, reason: `chỉ tiến hoá tại vùng ${targetEntry.evoRegion}` }
  }
  if (/during the day|daytime|\bday\b/.test(condition) && /tối|đêm|night/.test(part)) return { ok: false, reason: 'chỉ tiến hoá ban ngày' }
  if (/at night|nighttime|\bnight\b/.test(condition) && !/tối|đêm|night/.test(part)) return { ok: false, reason: 'chỉ tiến hoá ban đêm' }
  if (/female/.test(condition) && mon.gender !== 'female') return { ok: false, reason: 'cần cá thể cái' }
  if (/male/.test(condition) && !/female/.test(condition) && mon.gender !== 'male') return { ok: false, reason: 'cần cá thể đực' }
  if (/attack\s*>\s*defense/.test(condition) && (mon.stats?.atk ?? 0) <= (mon.stats?.def ?? 0)) return { ok: false, reason: 'cần Attack lớn hơn Defense' }
  if (/attack\s*<\s*defense/.test(condition) && (mon.stats?.atk ?? 0) >= (mon.stats?.def ?? 0)) return { ok: false, reason: 'cần Attack nhỏ hơn Defense' }
  if (/attack\s*=\s*defense/.test(condition) && (mon.stats?.atk ?? 0) !== (mon.stats?.def ?? 0)) return { ok: false, reason: 'cần Attack bằng Defense' }
  if (condition && !/(day|night|male|female|attack|defense)/.test(condition)
    && !evolutionTextId(context.storyText).includes(evolutionTextId(condition))) {
    return { ok: false, reason: `cần điều kiện đặc biệt: ${targetEntry.evoCondition}` }
  }
  return { ok: true, reason: '' }
}

/**
 * Tiến hoá CÙNG MỘT CÁ THỂ (đợt 76).
 * Giữ uid/IV/EV/nature/EXP/trạng thái và lượng HP đã mất; chỉ thay dữ liệu
 * loài, sprite, hệ và base stats; bộ chiêu hiện tại được giữ nguyên.
 * Trước đây model dùng [[POKEMON Fletchinder]] khiến app sinh thêm Fletchinder nhưng Fletchling cũ vẫn còn.
 */
export function evolveOwnedMon(mon, targetEntry, movesDb = null) {
  if (!mon || !targetEntry) return mon
  const level = Math.max(1, Math.min(MAX_LEVEL, Number(mon.level) || 1))
  const generated = buildMonSmart(
    targetEntry,
    level,
    movesDb,
    null,
    Boolean(mon.isTrainerMon),
  )
  const wasFainted = (mon.hp ?? 1) <= 0
  const evolvedAbility = resolveAbilityForEntry(
    targetEntry,
    mon.abilitySlot,
    mon.uid ?? `${targetEntry.species}-${level}`,
  )
  const seed = {
    ...normalizeFriendship(mon),
    name: targetEntry.name,
    species: targetEntry.species,
    spriteId: targetEntry.spriteId ?? targetEntry.species,
    dexNum: Number.isFinite(targetEntry.num) ? targetEntry.num : null,
    gen: Number.isFinite(targetEntry.gen) ? targetEntry.gen : null,
    forme: targetEntry.forme ?? null,
    baseSpeciesId: targetEntry.baseSpeciesId ?? null,
    types: [...(targetEntry.types ?? generated.types ?? mon.types ?? [])],
    baseStats: targetEntry.baseStats ?? generated.baseStats ?? mon.baseStats ?? null,
    catchRate: Number.isFinite(targetEntry.catchRate) ? targetEntry.catchRate : (mon.catchRate ?? generated.catchRate ?? 120),
    hasEvo: Boolean(targetEntry.hasEvo),
    hasPrevo: Boolean(targetEntry.hasPrevo),
    genderRatio: targetEntry.genderRatio ? { ...targetEntry.genderRatio } : mon.genderRatio ?? null,
    eggGroups: [...(targetEntry.eggGroups ?? mon.eggGroups ?? [])],
    eggSpecies: targetEntry.eggSpecies ?? mon.eggSpecies ?? targetEntry.species,
    eggSpeciesName: targetEntry.eggSpeciesName ?? mon.eggSpeciesName ?? targetEntry.name,
    ability: evolvedAbility.name,
    abilitySlot: evolvedAbility.slot,
    abilityHidden: evolvedAbility.hidden,
    // Tiến hoá không được tự xoá bộ chiêu người chơi đang dùng. Chỉ lấy
    // moveset sinh tự động nếu save cũ thật sự chưa có chiêu nào.
    moves: mon.moves?.length ? mon.moves : generated.moves,
    level,
    exp: Math.max(Number(mon.exp) || expForLevel(level), expForLevel(level)),
    // recomputeMonStats cần maxHp/hp CŨ để cộng đúng phần máu tối đa tăng lên.
    maxHp: mon.maxHp,
    hp: mon.hp,
    evolvedFrom: mon.species ?? mon.name,
  }
  if (targetEntry.evoItem && /(?:trade|hold)/i.test(String(targetEntry.evoType ?? ''))) seed.heldItem = null
  const evolved = seed.baseStats ? recomputeMonStats(seed) : {
    ...seed,
    stats: generated.stats ?? mon.stats,
    maxHp: generated.maxHp ?? mon.maxHp,
    hp: Math.min(generated.maxHp ?? mon.maxHp ?? 1, mon.hp ?? generated.maxHp ?? 1),
  }
  const withEvolutionMoves = queueEvolutionMoves(evolved, movesDb)
  return wasFainted ? { ...withEvolutionMoves, hp: 0 } : withEvolutionMoves
}


/**
 * Dò xem đoạn text (thường là nội dung tin nhắn AI ngay trước marker
 * [[BATTLE]]) có nhắc tên loài nào trong danh sách không — để quả pokeball
 * bắt đúng Pokémon AI đã kể (VD truyện nói "Pidgey" thì phải là Pidgey, không
 * phải random). Ưu tiên tên dài hơn trước để tránh khớp nhầm (VD tên ngắn là
 * 1 phần của tên dài hơn).
 */
export function detectMentionedSpecies(text, speciesList, options = {}) {
  if (!text || !speciesList?.length) return null
  const lower = text.toLowerCase()
  // Đợt 65 — BUG người chơi báo: "đánh con nào cũng ra Charmander".
  // Nguyên nhân: hàm này quét cả tên Pokémon CỦA NGƯỜI CHƠI trong chính văn
  // ("Charmander của tôi lao vào cắn Rattata hoang") rồi sắp xếp theo ĐỘ DÀI
  // TÊN — "Charmander" (10 ký tự) luôn thắng "Rattata" (7) → đối thủ hoang
  // dã biến thành bản sao Pokémon của chính người chơi, lượt nào cũng vậy.
  // Sửa: (1) loại trừ tên trong đội hình người chơi; (2) chọn theo VỊ TRÍ
  // XUẤT HIỆN CUỐI (tên nhắc sau thường là đối thủ vừa xuất hiện) thay vì
  // theo độ dài tên.
  const exclude = new Set(
    (options.excludeNames ?? [])
      .filter(Boolean)
      .map((n) => String(n).toLowerCase()),
  )
  let best = null
  for (const entry of speciesList) {
    const name = entry.name.toLowerCase()
    if (exclude.has(name)) continue
    const at = lower.lastIndexOf(name)
    if (at === -1) continue
    // Ưu tiên tên xuất hiện MUỘN NHẤT; nếu cùng vị trí thì tên dài hơn
    // (tránh "Rat" ăn trước "Raticate").
    if (!best || at > best.at || (at === best.at && name.length > best.name.length)) {
      best = { entry, at, name }
    }
  }
  return best?.entry ?? null
}


/** Trả về nhiều loài được nhắc, theo thứ tự xuất hiện từ sớm tới muộn. */
export function detectMentionedSpeciesList(text, speciesList, options = {}) {
  if (!text || !speciesList?.length) return []
  const lower = text.toLowerCase()
  const exclude = new Set((options.excludeNames ?? []).filter(Boolean).map((n) => String(n).toLowerCase()))
  const hits = []
  for (const entry of speciesList) {
    const name = entry.name.toLowerCase()
    let at = lower.indexOf(name)
    while (at !== -1) {
      hits.push({ entry, at, end: at + name.length, len: name.length })
      at = lower.indexOf(name, at + Math.max(1, name.length))
    }
  }

  // Tên Pokémon có thể nằm trong tên khác (Mew trong Mewtwo, Mime trong
  // Mr. Mime). Chọn span dài nhất ở cùng vị trí rồi bỏ mọi hit chồng lấn.
  // Làm bước này TRƯỚC exclude để Pokémon phe mình bị loại không vô tình
  // để lại một tên ngắn giả ở bên trong tên của chính nó.
  hits.sort((a, b) => a.at - b.at || b.len - a.len)
  const nonOverlapping = []
  for (const hit of hits) {
    if (nonOverlapping.some((kept) => hit.at < kept.end && hit.end > kept.at)) continue
    nonOverlapping.push(hit)
  }

  const out = []
  const seen = new Set()
  for (const hit of nonOverlapping) {
    const key = hit.entry.name.toLowerCase()
    if (exclude.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push(hit.entry)
  }
  return out
}

/**
 * Chọn ngẫu nhiên 1 loài và sinh Pokémon hoang dã Lv.8-15.
 * @param {Array<{name,species,types}>} [list] danh sách loài để chọn — mặc
 * định dùng 151 loài Gen 1 tĩnh (fallback khi chưa tải được pokedex đầy đủ
 * từ Showdown, xem src/utils/pokedexFetch.js).
 */
export function randomWildMon(list = POKEMON_SPECIES, movesDb = null) {
  const pool = list?.length ? list : POKEMON_SPECIES
  const speciesEntry = pool[Math.floor(Math.random() * pool.length)]
  const level = 8 + Math.floor(Math.random() * 8)
  return buildWildMon(speciesEntry, level, movesDb)
}

// ============ TÍNH CÁCH → HÀNH VI (đợt 63) ============
// Yêu cầu beta: "tính cách giờ không chỉ tăng giảm chỉ số mà còn là cách mà
// Pokémon hành động". Bảng dưới mô tả NÉT HÀNH VI của từng nature để bơm
// vào prompt — AI phải cho Pokémon cư xử đúng cá tính, không phải con nào
// cũng ngoan ngoãn như nhau.
export const NATURE_BEHAVIOR = {
  Hardy: 'lì lợm, không dễ nao núng, ít bộc lộ cảm xúc',
  Docile: 'ngoan ngoãn, dễ bảo, hiếm khi cãi lệnh',
  Serious: 'nghiêm túc, tập trung, không thích đùa giỡn giữa trận',
  Bashful: 'bẽn lẽn, hay nấp sau chân huấn luyện viên khi gặp người lạ',
  Quirky: 'kỳ quặc, hành động khó đoán, thỉnh thoảng làm trò lạ đời',
  Lonely: 'sợ bị bỏ rơi, bám huấn luyện viên, khó chịu khi bị cho ra rìa',
  Brave: 'gan dạ, xông lên trước, không lùi kể cả trước đối thủ mạnh hơn',
  Adamant: 'bướng bỉnh, quyết làm theo ý mình, ghét bị ngăn cản',
  Naughty: 'nghịch ngợm, hay chọc phá, thích trêu đồng đội và đồ đạc',
  Bold: 'dạn dĩ, chắn trước bảo vệ đồng đội, không sợ va chạm',
  Relaxed: 'thong thả, chậm rãi, hay lười biếng nằm dài',
  Impish: 'tinh quái, bày trò nghịch ngầm rồi giả vờ vô can',
  Lax: 'lơ đễnh, dễ mất tập trung, hay ngáp giữa lúc quan trọng',
  Timid: 'nhút nhát, giật mình vì tiếng động, tránh đối đầu trực diện',
  Hasty: 'nóng vội, làm trước nghĩ sau, hay chạy vọt lên trước',
  Jolly: 'vui vẻ, hiếu động, nhảy nhót và kêu vui suốt ngày',
  Naive: 'ngây thơ, cả tin, dễ bị dụ bằng đồ ăn hoặc trò chơi',
  Modest: 'khiêm tốn, kín đáo, không phô trương sức mạnh',
  Mild: 'ôn hoà, dịu dàng, ít khi tỏ ra hung hăng',
  Quiet: 'trầm lặng, ít kêu, quan sát nhiều hơn hành động',
  Rash: 'bốc đồng, ra đòn thiếu tính toán khi bị khiêu khích',
  Calm: 'điềm tĩnh, giữ bình tĩnh cả khi bất lợi',
  Gentle: 'hiền lành, nhẹ nhàng với trẻ nhỏ và Pokémon yếu hơn',
  Sassy: 'đanh đá, hay "cãi" lại bằng tiếng kêu, thái độ khó chiều',
  Careful: 'cẩn trọng, dè chừng người lạ, kiểm tra kỹ trước khi tin',
}

/** Mô tả riêng phần hành vi của Nature để các luồng hội thoại ngoài main
 * prompt (battle/Safari) dùng chung, tránh mỗi nơi diễn giải Nature một kiểu. */
export function describeNatureBehavior(mon) {
  const nature = mon?.nature
  if (!nature) return 'chưa xác định'
  const behavior = NATURE_BEHAVIOR[nature]
  return behavior ? `${nature}: ${behavior}` : String(nature)
}

/** Mô tả 1 Pokémon cho prompt: tên, level, tính cách + nét hành vi. */
export function describeMonForPrompt(mon) {
  if (!mon?.name) return null
  const displayName = mon.nickname?.trim()
    ? `${mon.nickname.trim()} (${mon.name})`
    : mon.name
  const parts = [`${displayName} (Lv.${mon.level ?? '?'}`]
  if (mon.types?.length) parts.push(`, hệ ${mon.types.join('/')}`)
  parts.push(')')
  let line = parts.join('')
  if (mon.nature) line += ` — Nature ${describeNatureBehavior(mon)}`
  if (mon.ability) line += ` — Ability ${mon.ability}`
  const friendship = normalizeFriendship(mon)
  const bond = friendshipTier(friendship.friendship)
  line += ` — độ thân mật ${friendship.friendship}/255 (${bond.label}: ${bond.note})`
  return line
}

/** Note bơm vào prompt để AI cho Pokémon hành xử ĐÚNG cá tính (đợt 63). */
export function buildPartyBehaviorNote(party, activeMon) {
  // Đợt 85: save cũ hoặc một callback chạy giữa hai setter có thể có
  // playerMon thật nhưng party tạm rỗng/chưa đồng bộ. Luôn hợp nhất cá thể
  // đang hoạt động vào danh sách và khử trùng theo uid để Nature không biến
  // mất khỏi prompt đúng lúc Pokémon đang xuất hiện trong truyện.
  const list = []
  for (const mon of [...(party ?? []), activeMon]) {
    if (!mon?.name || list.some((entry) => isSameMon(entry, mon))) continue
    list.push(mon)
  }
  if (!list.length) return null
  const lines = list.map((m) => {
    const tag = activeMon && isSameMon(m, activeMon) ? ' [đang hoạt động]' : ''
    return `- ${describeMonForPrompt(m)}${tag}`
  })
  return [
    'HỒ SƠ HÀNH VI POKÉMON CỦA NGƯỜI CHƠI — CHỈ DẪN NHẬP VAI BẮT BUỘC:',
    '- Nature vừa giữ tác động tăng/giảm chỉ số của game, vừa là khí chất nền quyết định phản ứng, tiếng kêu, thói quen, mức chủ động, cách nghe lời hoặc bướng bỉnh trong chính văn.',
    '- Friendship điều chỉnh mức tin tưởng/phối hợp nhưng KHÔNG xoá cá tính: một Pokémon Adamant rất thân vẫn bướng theo cách thân thiết; một Pokémon Timid gắn bó có thể cố vượt sợ hãi để bảo vệ huấn luyện viên.',
    '- Thể hiện Nature bằng hành động cụ thể và biến hoá theo tình huống; không chỉ gọi tên tính cách, không biến thành một trò lặp lại ở mọi đoạn.',
    '- Chỉ cho Pokémon hành động khi nó đang ở ngoài Poké Ball hoặc bối cảnh cho phép; không tự thả cả đội chỉ để phô diễn Nature. Không nhắc tới hồ sơ hệ thống này trong truyện.',
    ...lines,
  ].join('\n')
}


// ============ HỆ KINH NGHIỆM / LÊN CẤP (đợt 65) ============
// Người chơi beta báo: "làm game quên mất exp, Pokémon không lên cấp được".
// Đúng — trước đây thắng trận chỉ cộng EV chứ KHÔNG có EXP, nên level đứng
// yên vĩnh viễn. Dưới đây là hệ EXP theo công thức game gốc.
//
// Nhóm tăng trưởng: dùng MEDIUM FAST (n^3) — nhóm phổ biến nhất trong game
// gốc, công thức gọn và dễ kiểm chứng: tổng EXP để đạt cấp n là n³.
export const MAX_LEVEL = 100

/** Tổng EXP cần để ĐẠT cấp `level` (medium fast: n³). */
export function expForLevel(level) {
  const n = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)))
  return n * n * n
}

/** Cấp tương ứng với tổng EXP đang có. */
export function levelFromExp(exp) {
  const e = Math.max(0, Number(exp) || 0)
  let lv = Math.floor(Math.cbrt(e))
  if (lv < 1) lv = 1
  if (lv > MAX_LEVEL) lv = MAX_LEVEL
  return lv
}

/** Tiến độ tới cấp kế tiếp: {current, need, ratio} — dùng cho thanh EXP. */
export function expProgress(mon) {
  const lv = mon?.level ?? 1
  if (lv >= MAX_LEVEL) return { current: 0, need: 0, ratio: 1 }
  const base = expForLevel(lv)
  const next = expForLevel(lv + 1)
  const total = Math.max(base, Number(mon?.exp) || base)
  return {
    current: total - base,
    need: next - base,
    ratio: Math.max(0, Math.min(1, (total - base) / (next - base))),
  }
}

/** EXP nhận được khi HẠ một Pokémon (mô phỏng công thức gốc b×L/7).
 * Không có bảng base-exp-yield riêng nên suy ra từ BST (đủ sát: loài mạnh
 * cho nhiều EXP hơn). Trainer thưởng gấp 1.5 như game gốc. */
export function expGainFrom(defeated, { isTrainerMon = false } = {}) {
  if (!defeated) return 0
  const bst = defeated.baseStats
    ? Object.values(defeated.baseStats).reduce((a, b) => a + b, 0)
    : 300
  const baseYield = Math.max(20, Math.round(bst / 3))
  const lv = Math.max(1, defeated.level ?? 1)
  const raw = Math.floor((baseYield * lv) / 7)
  return Math.max(1, Math.round(raw * (isTrainerMon ? 1.5 : 1)))
}

/**
 * Cộng EXP cho 1 Pokémon, tự lên cấp và tính lại chỉ số.
 * Trả về { mon, gained, levelsGained, newLevel } — KHÔNG sửa mon gốc.
 */
export function applyExpGain(mon, amount, movesDb = null) {
  if (!mon || !amount || amount <= 0) return { mon, gained: 0, levelsGained: 0, newLevel: mon?.level ?? 1 }
  const oldLevel = mon.level ?? 1
  if (oldLevel >= MAX_LEVEL) return { mon, gained: 0, levelsGained: 0, newLevel: MAX_LEVEL }
  // Mon cũ (trước đợt 65) chưa có trường exp → coi như đang ở mốc đầu cấp.
  const curExp = Number.isFinite(mon.exp) ? mon.exp : expForLevel(oldLevel)
  const newExp = curExp + amount
  const newLevel = Math.min(MAX_LEVEL, levelFromExp(newExp))
  let next = { ...mon, exp: newExp, level: newLevel }
  if (newLevel > oldLevel) {
    // Lên cấp: tính lại chỉ số theo IV/EV/nature; recomputeMonStats giữ
    // nguyên lượng máu đã mất và cộng thêm phần maxHp tăng lên.
    next = recomputeMonStats(next)
    next = queueLevelUpMoves(next, oldLevel, newLevel, movesDb)
  }
  return { mon: next, gained: amount, levelsGained: Math.max(0, newLevel - oldLevel), newLevel }
}


// ============ EXP TỪ LUYỆN TẬP / THỜI GIAN TRÔI (đợt 67) ============
// Người chơi báo: "phải thiết lập việc huấn luyện cũng tăng EXP chứ",
// "thử time skip xem có tăng lv không — không được". Đúng: trước đây EXP
// chỉ đến từ trận đấu qua BattleModal, nên roleplay thuần (đi đường, tập
// luyện, nghỉ dưỡng vài ngày) không làm Pokémon lớn lên chút nào.
//
// Nguyên tắc cân bằng: EXP từ thời gian phải THẤP HƠN NHIỀU so với đánh
// trận (không thì người chơi chỉ cần bấm "ngủ 30 ngày" là max cấp). Dùng
// mốc theo cấp hiện tại để cấp thấp lớn nhanh, cấp cao chậm dần — giống
// cảm giác game gốc.

/** EXP cho MỘT ngày trôi qua (nghỉ ngơi/di chuyển bình thường). */
export function expFromDays(mon, days) {
  if (!mon || !days || days <= 0) return 0
  const lv = Math.max(1, mon.level ?? 1)
  if (lv >= MAX_LEVEL) return 0
  // ~2% quãng đường lên cấp kế tiếp cho mỗi ngày.
  const span = expForLevel(lv + 1) - expForLevel(lv)
  return Math.max(1, Math.round(span * 0.02 * Math.min(days, 30)))
}

/** EXP cho một buổi LUYỆN TẬP có chủ đích (mạnh hơn ngày trôi thường). */
export function expFromTraining(mon, intensity = 1) {
  if (!mon) return 0
  const lv = Math.max(1, mon.level ?? 1)
  if (lv >= MAX_LEVEL) return 0
  const span = expForLevel(lv + 1) - expForLevel(lv)
  // ~8% quãng đường/buổi ở cường độ 1; cường độ do AI khai (1-3).
  const k = Math.max(1, Math.min(3, Number(intensity) || 1))
  return Math.max(1, Math.round(span * 0.08 * k))
}


/** Khớp 2 bản ghi CÙNG MỘT cá thể Pokémon (đợt 69).
 * Ưu tiên uid; mon cũ chưa có uid thì lùi về khớp tên (tương thích ngược). */
export function isSameMon(a, b) {
  if (!a || !b) return false
  if (a.uid && b.uid) return a.uid === b.uid
  return a.name === b.name
}

/** Thay thế cá thể tương ứng trong đội hình bằng bản mới. */
export function syncMonInParty(party, mon) {
  if (!mon) return party ?? []
  return (party ?? []).map((pm) => (isSameMon(pm, mon) ? mon : pm))
}


/**
 * Nâng đúng 1 cấp cho Pokémon (Kẹo Hiếm — đợt 72).
 * Đặt exp về ĐÚNG mốc đầu cấp mới, giống game gốc: ăn kẹo là mất phần EXP
 * dư đang tích luỹ, chứ không phải cộng thêm vào chỗ đang có.
 * Máu tăng theo maxHp mới (không hồi máu đã mất, đúng luật gốc).
 */
export function levelUpMon(mon, movesDb = null) {
  if (!mon) return mon
  const next = Math.min(MAX_LEVEL, (mon.level ?? 1) + 1)
  if (next === mon.level) return mon
  const leveled = recomputeMonStats({ ...mon, level: next, exp: expForLevel(next) })
  return queueLevelUpMoves(leveled, mon.level ?? 1, next, movesDb)
}


/**
 * Nâng một Pokémon tới cấp đích, chỉ cho phép ĐI LÊN (đợt 73).
 * Dùng cho [[LEVEL ...]] và đường tương thích ngược khi model cũ lạm dụng
 * [[POKEMON Loài | LvN]] để báo Pokémon đang có vừa lên cấp. Lặp qua
 * levelUpMon để giữ đúng quy tắc máu: maxHp tăng nhưng phần HP đã mất không
 * tự hồi đầy.
 */
export function raiseMonToLevel(mon, targetLevel, movesDb = null) {
  if (!mon) return mon
  const target = Math.max(mon.level ?? 1, Math.min(MAX_LEVEL, Number(targetLevel) || 1))
  let next = mon
  while ((next.level ?? 1) < target) next = levelUpMon(next, movesDb)
  return next
}

/** Áp một chỉ dẫn LEVEL dạng +N hoặc LvN, không bao giờ hạ cấp. */
export function applyLevelDirective(mon, directive, movesDb = null) {
  if (!mon || !directive) return mon
  const current = mon.level ?? 1
  const target = directive.mode === 'delta'
    ? current + Math.max(0, Number(directive.value) || 0)
    : Number(directive.value) || current
  return raiseMonToLevel(mon, target, movesDb)
}


// ============ CHỐT AN TOÀN CHỐNG TỤT CẤP (đợt 70) ============
// Tester báo 3 lần liền cùng một triệu chứng: "trước trận lên Lv6, tiếp tục
// diễn biến lại tụt về Lv5", "không nhận Exp", "đáng lẽ lên Lv7 mà không
// lên". Nguyên nhân gốc đã sửa ở RoleplayChat (đọc playerMon từ closure cũ),
// NHƯNG theo quy tắc số 5 của dự án — cái gì làm hỏng trải nghiệm thì phải
// CHẶN Ở PHÍA APP chứ không chỉ sửa một chỗ gọi. Level/EXP của MỘT cá thể là
// bất biến chỉ-tăng: bất kỳ luồng nào (API phụ chạy nền, dev tool, save cũ,
// code viết sau này) ghi đè bằng bản cũ hơn đều bị chặn tại đây.

/** Hai bản ghi có phải CÙNG một cá thể không — chặt hơn isSameMon.
 * Một bên có uid còn bên kia không = con vừa dựng mới thay cho con cũ (khác
 * cá thể), KHÔNG được coi là một → tránh khoá nhầm khi đổi Pokémon ra trận. */
function sameIndividual(a, b) {
  if (!a || !b) return false
  if (a.uid && b.uid) return a.uid === b.uid
  if (a.uid || b.uid) return false
  return a.name === b.name
}

/** Chặn một lần ghi đè làm TỤT level/EXP của cùng một cá thể. */
export function guardMonRegression(prev, next) {
  if (!prev || !next || !sameIndividual(prev, next)) return next
  const prevLv = prev.level ?? 1
  const nextLv = next.level ?? 1
  const prevExp = Number.isFinite(prev.exp) ? prev.exp : expForLevel(prevLv)
  const nextExp = Number.isFinite(next.exp) ? next.exp : expForLevel(nextLv)
  if (nextLv >= prevLv && nextExp >= prevExp) return next
  console.warn(
    `[guard] Chặn ghi đè làm tụt cấp ${prev.name}: Lv${prevLv}/${prevExp}exp → Lv${nextLv}/${nextExp}exp. Giữ mốc cao hơn.`,
  )
  const kept = { ...next, level: Math.max(prevLv, nextLv), exp: Math.max(prevExp, nextExp) }
  // Chỉ tính lại chỉ số khi LEVEL thực sự bị kéo về — nếu chỉ có exp lùi thì
  // giữ nguyên stats, tránh đụng vào các biến hình tạm (Dynamax nhân đôi
  // maxHp, Mega đổi baseStats) vốn cùng level nên không rơi vào nhánh này.
  return kept.level !== nextLv ? recomputeMonStats(kept) : kept
}

/** Bản áp cho cả đội hình: khớp từng cá thể với bản trước đó rồi chặn tụt. */
export function guardPartyRegression(prev, next) {
  if (!Array.isArray(next)) return next
  const before = Array.isArray(prev) ? prev : []
  if (before.length === 0) return next
  return next.map((m) => {
    const old = before.find((p) => sameIndividual(p, m))
    return old ? guardMonRegression(old, m) : m
  })
}

/** Bỏ toàn bộ chỉ số tạm của boss/trận trước khi một Pokémon trở thành sở
 * hữu của người chơi. Dùng chung cho Battle, Safari và các luồng thu phục
 * sau này để boss nhiều thanh máu không lọt nguyên vào đội hình. */
export function normalizeAcquiredMon(mon) {
  if (!mon) return mon
  const stripped = { ...mon, hp: mon.maxHp, status: null }
  for (const key of [
    'bossBars', 'bossTier', 'bossPhase', 'isTrainerMon', 'sleepTurns',
    'flashFireBoost', 'confusionTurns', 'recharge', 'flinched', 'protect',
    'dyna', 'dynaHpMultiplier', 'tera', 'origTypes',
  ]) delete stripped[key]
  const normalized = recomputeMonStats(stripped)
  return { ...normalized, hp: normalized.maxHp, status: null, isTrainerMon: false }
}
