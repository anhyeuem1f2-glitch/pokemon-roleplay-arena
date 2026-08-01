import { abilityId, hasAbility, statusIsBlocked } from './pokemonAbilities.js'

// ============ TRANG BỊ / HELD ITEM (đợt 81) ============
// Thiết kế theo kiểu event-hook của Pokémon Showdown: dữ liệu vật phẩm chỉ
// mô tả điều kiện, còn battle engine gọi đúng hook trước sát thương, sau sát
// thương và cuối lượt. Nhờ vậy cùng một món không bị áp hai lần giữa đánh đơn
// và đánh đôi, và vật phẩm tiêu hao biến mất đúng trên CÁ THỂ đang giữ nó.

export function itemId(value) {
  if (value && typeof value === 'object') return itemId(value.id ?? value.name)
  return String(value ?? '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '')
}

const TYPE_LABEL = {
  normal: 'Normal', fire: 'Fire', water: 'Water', electric: 'Electric', grass: 'Grass', ice: 'Ice',
  fighting: 'Fighting', poison: 'Poison', ground: 'Ground', flying: 'Flying', psychic: 'Psychic',
  bug: 'Bug', rock: 'Rock', ghost: 'Ghost', dragon: 'Dragon', dark: 'Dark', steel: 'Steel', fairy: 'Fairy',
}

const TYPE_BOOSTERS = {
  normal: ['silkscarf', 'Silk Scarf'], fire: ['charcoal', 'Charcoal'], water: ['mysticwater', 'Mystic Water'],
  electric: ['magnet', 'Magnet'], grass: ['miracleseed', 'Miracle Seed'], ice: ['nevermeltice', 'Never-Melt Ice'],
  fighting: ['blackbelt', 'Black Belt'], poison: ['poisonbarb', 'Poison Barb'], ground: ['softsand', 'Soft Sand'],
  flying: ['sharpbeak', 'Sharp Beak'], psychic: ['twistedspoon', 'Twisted Spoon'], bug: ['silverpowder', 'Silver Powder'],
  rock: ['hardstone', 'Hard Stone'], ghost: ['spelltag', 'Spell Tag'], dragon: ['dragonfang', 'Dragon Fang'],
  dark: ['blackglasses', 'Black Glasses'], steel: ['metalcoat', 'Metal Coat'], fairy: ['fairyfeather', 'Fairy Feather'],
}

const TYPE_CRYSTALS = {
  normaliumz: 'normal', firiumz: 'fire', wateriumz: 'water', electriumz: 'electric', grassiumz: 'grass',
  iciumz: 'ice', fightiniumz: 'fighting', poisoniumz: 'poison', groundiumz: 'ground', flyiniumz: 'flying',
  psychiumz: 'psychic', buginiumz: 'bug', rockiumz: 'rock', ghostiumz: 'ghost', dragoniumz: 'dragon',
  darkiniumz: 'dark', steeliumz: 'steel', fairiumz: 'fairy',
}

// Fallback cho cache Pokédex cũ chưa có `requiredItem`. Tên nhiều Mega
// Stone không thể suy máy móc từ tên loài (Mewtwonite, Sablenite, Diancite...),
// nên dùng bảng rõ ràng thay vì đoán rồi cho phép sai viên đá.
const MEGA_STONE_BY_FORME = {
  abomasnowmega: 'abomasite', absolmega: 'absolite', aerodactylmega: 'aerodactylite', aggronmega: 'aggronite',
  alakazammega: 'alakazite', altariamega: 'altarianite', ampharosmega: 'ampharosite', audinomega: 'audinite',
  banettemega: 'banettite', beedrillmega: 'beedrillite', blastoisemega: 'blastoisinite', blazikenmega: 'blazikenite',
  cameruptmega: 'cameruptite', charizardmegax: 'charizarditex', charizardmegay: 'charizarditey', dianciemega: 'diancite',
  gallademega: 'galladite', garchompmega: 'garchompite', gardevoirmega: 'gardevoirite', gengarmega: 'gengarite',
  glaliemega: 'glalitite', gyaradosmega: 'gyaradosite', heracrossmega: 'heracronite', houndoommega: 'houndoominite',
  kangaskhanmega: 'kangaskhanite', latiasmega: 'latiasite', latiosmega: 'latiosite', lopunnymega: 'lopunnite',
  lucariomega: 'lucarionite', manectricmega: 'manectite', mawilemega: 'mawilite', medichammega: 'medichamite',
  metagrossmega: 'metagrossite', mewtwomegax: 'mewtwonitex', mewtwomegay: 'mewtwonitey', pidgeotmega: 'pidgeotite',
  pinsirmega: 'pinsirite', sableyemega: 'sablenite', salamencemega: 'salamencite', sceptilemega: 'sceptilite',
  scizormega: 'scizorite', sharpedomega: 'sharpedonite', slowbromega: 'slowbronite', steelixmega: 'steelixite',
  swampertmega: 'swampertite', tyranitarmega: 'tyranitarite', venusaurmega: 'venusaurite',
}

// Z-Crystal riêng phải khớp CẢ loài/forme lẫn chiêu gốc. Bản cũ chỉ dò xem
// tên crystal có chứa tên loài nên Pikanium Z không bao giờ khớp Pikachu, còn
// một số crystal tên gần giống lại có nguy cơ mở sai. Danh sách này bám đúng
// điều kiện dữ liệu item của Showdown, nhưng engine hiện chỉ hỗ trợ Z-Move gây
// sát thương (chưa triển khai Z-Status).
const SPECIAL_Z_CRYSTALS = {
  aloraichiumz: { species: ['raichualola'], moves: ['thunderbolt'] },
  decidiumz: { species: ['decidueye'], moves: ['spiritshackle'] },
  eeviumz: { species: ['eevee'], moves: ['lastresort'] },
  inciniumz: { species: ['incineroar'], moves: ['darkestlariat'] },
  kommoniumz: { species: ['kommoo'], moves: ['clangingscales'] },
  lunaliumz: { species: ['lunala', 'necrozmadawnwings'], moves: ['moongeistbeam'] },
  lycaniumz: { species: ['lycanroc', 'lycanrocmidnight', 'lycanrocdusk'], moves: ['stoneedge'] },
  marshadiumz: { species: ['marshadow'], moves: ['spectralthief'] },
  mewniumz: { species: ['mew'], moves: ['psychic'] },
  mimikiumz: { species: ['mimikyu', 'mimikyubusted'], moves: ['playrough'] },
  pikaniumz: { species: ['pikachu'], moves: ['volttackle'] },
  pikashuniumz: { species: ['pikachu'], moves: ['thunderbolt'] },
  primariumz: { species: ['primarina'], moves: ['sparklingaria'] },
  snorliumz: { species: ['snorlax'], moves: ['gigaimpact'] },
  solganiumz: { species: ['solgaleo', 'necrozmaduskmane'], moves: ['sunsteelstrike'] },
  tapuniumz: { species: ['tapukoko', 'tapulele', 'tapubulu', 'tapufini'], moves: ['naturesmadness'] },
  ultranecroziumz: { species: ['necrozma', 'necrozmaduskmane', 'necrozmadawnwings'], moves: ['photongeyser'] },
}

const RESIST_BERRIES = {
  occaberry: 'fire', passhoberry: 'water', wacanberry: 'electric', rindoberry: 'grass', yacheberry: 'ice',
  chopleberry: 'fighting', kebiaberry: 'poison', shucaberry: 'ground', cobaberry: 'flying', payapaberry: 'psychic',
  tangaberry: 'bug', chartiberry: 'rock', kasibberry: 'ghost', habanberry: 'dragon', colburberry: 'dark',
  babiriberry: 'steel', roseliberry: 'fairy', chilanberry: 'normal',
}

function entry(id, name, desc, extra = {}) {
  return { id, name, desc, category: extra.category ?? 'held', noShop: extra.noShop ?? true, holdable: extra.holdable ?? true, ...extra }
}

export const TRAINER_GEAR_ITEMS = [
  entry('key-stone', 'Key Stone', 'Thiết bị của huấn luyện viên để kích hoạt Mega Evolution; không phải đồ Pokémon cầm.', { category: 'gimmick', holdable: false }),
  entry('mega-ring', 'Mega Ring', 'Một dạng Key Stone đeo tay của huấn luyện viên.', { category: 'gimmick', holdable: false, gear: 'mega' }),
  entry('mega-bracelet', 'Mega Bracelet', 'Một dạng Key Stone đeo tay của huấn luyện viên.', { category: 'gimmick', holdable: false, gear: 'mega' }),
  entry('z-ring', 'Z-Ring', 'Thiết bị của huấn luyện viên để dùng Z-Move; Pokémon vẫn phải cầm đúng Z-Crystal.', { category: 'gimmick', holdable: false, gear: 'zmove' }),
  entry('z-power-ring', 'Z-Power Ring', 'Thiết bị của huấn luyện viên để dùng Z-Move.', { category: 'gimmick', holdable: false, gear: 'zmove' }),
  entry('dynamax-band', 'Dynamax Band', 'Thiết bị của huấn luyện viên để Dynamax tại nơi cho phép.', { category: 'gimmick', holdable: false, gear: 'dynamax' }),
  entry('tera-orb', 'Tera Orb', 'Thiết bị của huấn luyện viên để Terastalize.', { category: 'gimmick', holdable: false, gear: 'tera' }),
]

export const HELD_ITEMS = [
  entry('leftovers', 'Leftovers', 'Cuối mỗi lượt hồi 1/16 HP tối đa.'),
  entry('black-sludge', 'Black Sludge', 'Pokémon hệ Poison hồi 1/16 HP mỗi lượt; Pokémon khác mất 1/8 HP.'),
  entry('life-orb', 'Life Orb', 'Chiêu gây sát thương mạnh hơn 30%; sau khi gây sát thương mất 1/10 HP (Magic Guard chặn phản lực).'),
  entry('expert-belt', 'Expert Belt', 'Chiêu siêu hiệu quả mạnh hơn 20%.'),
  entry('muscle-band', 'Muscle Band', 'Chiêu Physical mạnh hơn 10%.'),
  entry('wise-glasses', 'Wise Glasses', 'Chiêu Special mạnh hơn 10%.'),
  entry('choice-band', 'Choice Band', 'Tăng Attack 50%, nhưng sau khi ra chiêu chỉ được dùng lại chiêu đó cho tới khi đổi Pokémon.'),
  entry('choice-specs', 'Choice Specs', 'Tăng Special Attack 50%, nhưng bị khóa vào chiêu đầu tiên.'),
  entry('choice-scarf', 'Choice Scarf', 'Tăng Speed 50%, nhưng bị khóa vào chiêu đầu tiên.'),
  entry('assault-vest', 'Assault Vest', 'Tăng Special Defense 50%, nhưng không thể dùng chiêu Status.'),
  entry('eviolite', 'Eviolite', 'Pokémon còn có thể tiến hóa được tăng Defense và Special Defense 50%.'),
  entry('focus-sash', 'Focus Sash', 'Nếu đang đầy HP, một đòn đủ hạ gục sẽ để lại 1 HP rồi vật phẩm bị tiêu hao.'),
  entry('focus-band', 'Focus Band', 'Có 10% cơ hội sống ở 1 HP trước đòn hạ gục; không bị tiêu hao.'),
  entry('weakness-policy', 'Weakness Policy', 'Khi bị chiêu siêu hiệu quả gây sát thương, tăng Attack và Special Attack 2 bậc rồi tiêu hao.'),
  entry('air-balloon', 'Air Balloon', 'Miễn nhiễm chiêu Ground cho tới khi bị một chiêu gây sát thương làm vỡ.'),
  entry('rocky-helmet', 'Rocky Helmet', 'Kẻ đánh bằng chiêu tiếp xúc mất 1/6 HP tối đa.'),
  entry('shell-bell', 'Shell Bell', 'Hồi HP bằng 1/8 sát thương vừa gây ra.'),
  entry('sitrus-berry', 'Sitrus Berry', 'Khi HP còn không quá một nửa, hồi 1/4 HP rồi tiêu hao.'),
  entry('oran-berry', 'Oran Berry', 'Khi HP còn không quá một nửa, hồi 10 HP rồi tiêu hao.'),
  entry('lum-berry', 'Lum Berry', 'Chữa bất kỳ trạng thái chính nào rồi tiêu hao.'),
  entry('chesto-berry', 'Chesto Berry', 'Chữa ngủ rồi tiêu hao.'),
  entry('cheri-berry', 'Cheri Berry', 'Chữa tê liệt rồi tiêu hao.'),
  entry('pecha-berry', 'Pecha Berry', 'Chữa độc rồi tiêu hao.'),
  entry('rawst-berry', 'Rawst Berry', 'Chữa bỏng rồi tiêu hao.'),
  entry('aspear-berry', 'Aspear Berry', 'Chữa đóng băng rồi tiêu hao.'),
  entry('flame-orb', 'Flame Orb', 'Cuối lượt gây bỏng cho Pokémon giữ nếu không miễn nhiễm.'),
  entry('toxic-orb', 'Toxic Orb', 'Cuối lượt gây độc cho Pokémon giữ nếu không miễn nhiễm.'),
  entry('sticky-barb', 'Sticky Barb', 'Cuối lượt mất 1/8 HP.'),
  entry('iron-ball', 'Iron Ball', 'Giảm Speed còn một nửa và làm mất miễn nhiễm Ground của Flying/Levitate.'),
  entry('lagging-tail', 'Lagging Tail', 'Pokémon giữ thường hành động sau trong cùng mức ưu tiên.'),
  entry('damp-rock', 'Damp Rock', 'Mưa do Pokémon tạo kéo dài 8 lượt thay vì 5.'),
  entry('heat-rock', 'Heat Rock', 'Nắng do Pokémon tạo kéo dài 8 lượt thay vì 5.'),
  entry('smooth-rock', 'Smooth Rock', 'Bão cát do Pokémon tạo kéo dài 8 lượt thay vì 5.'),
  entry('icy-rock', 'Icy Rock', 'Tuyết do Pokémon tạo kéo dài 8 lượt thay vì 5.'),
  entry('light-ball', 'Light Ball', 'Pikachu tăng gấp đôi Attack và Special Attack.'),
  entry('thick-club', 'Thick Club', 'Cubone hoặc Marowak tăng gấp đôi Attack.'),
  entry('quick-powder', 'Quick Powder', 'Ditto chưa biến hình tăng gấp đôi Speed.'),
  entry('metal-powder', 'Metal Powder', 'Ditto chưa biến hình tăng Defense và Special Defense 50%.'),
  entry('deep-sea-tooth', 'Deep Sea Tooth', 'Clamperl tăng gấp đôi Special Attack.'),
  entry('deep-sea-scale', 'Deep Sea Scale', 'Clamperl tăng gấp đôi Special Defense.'),
  // Vật phẩm tiến hoá qua trao đổi/cầm khi lên cấp. Chúng phải là held item
  // thật để EQUIP và bộ kiểm tra evolution cùng nhìn thấy đúng một trạng thái.
  entry('kings-rock', "King's Rock", 'Vật phẩm tiến hoá của Poliwhirl/Slowpoke khi trao đổi.'),
  entry('dragon-scale', 'Dragon Scale', 'Vật phẩm tiến hoá của Seadra khi trao đổi.'),
  entry('upgrade', 'Upgrade', 'Vật phẩm tiến hoá của Porygon khi trao đổi.'),
  entry('dubious-disc', 'Dubious Disc', 'Vật phẩm tiến hoá của Porygon2 khi trao đổi.'),
  entry('protector', 'Protector', 'Vật phẩm tiến hoá của Rhydon khi trao đổi.'),
  entry('electirizer', 'Electirizer', 'Vật phẩm tiến hoá của Electabuzz khi trao đổi.'),
  entry('magmarizer', 'Magmarizer', 'Vật phẩm tiến hoá của Magmar khi trao đổi.'),
  entry('reaper-cloth', 'Reaper Cloth', 'Vật phẩm tiến hoá của Dusclops khi trao đổi.'),
  entry('razor-claw', 'Razor Claw', 'Vật phẩm tiến hoá khi cầm và lên cấp vào ban đêm.'),
  entry('razor-fang', 'Razor Fang', 'Vật phẩm tiến hoá của Gligar khi cầm và lên cấp vào ban đêm.'),
  entry('prism-scale', 'Prism Scale', 'Vật phẩm tiến hoá của Feebas khi trao đổi.'),
  entry('whipped-dream', 'Whipped Dream', 'Vật phẩm tiến hoá của Swirlix khi trao đổi.'),
  entry('sachet', 'Sachet', 'Vật phẩm tiến hoá của Spritzee khi trao đổi.'),
  entry('oval-stone', 'Oval Stone', 'Vật phẩm tiến hoá của Happiny khi cầm và lên cấp ban ngày.'),
  entry('soul-dew', 'Soul Dew', 'Latias/Latios tăng sức mạnh chiêu Psychic và Dragon 20%.'),
  ...Object.entries(TYPE_BOOSTERS).map(([type, [id, name]]) => entry(id, name, `Chiêu hệ ${TYPE_LABEL[type]} mạnh hơn 20%.`, { boostType: type })),
  ...Object.entries(TYPE_CRYSTALS).map(([id, type]) => entry(id, `${TYPE_LABEL[type]}ium Z`, `Z-Crystal hệ ${TYPE_LABEL[type]}; cần Z-Ring và chiêu gây sát thương cùng hệ.`, { zType: type, ignoreKlutz: true })),
  ...Object.entries(RESIST_BERRIES).map(([id, type]) => entry(id, id.replace(/berry$/, ' Berry').replace(/(^|\s)\w/g, (m) => m.toUpperCase()), `Giảm một nửa sát thương từ một chiêu hệ ${TYPE_LABEL[type]} siêu hiệu quả rồi tiêu hao.`, { resistType: type })),
]

export const ALL_EQUIPMENT_ITEMS = [...TRAINER_GEAR_ITEMS, ...HELD_ITEMS]
const BY_ID = new Map(ALL_EQUIPMENT_ITEMS.map((it) => [itemId(it.id), it]))

export function normalizeHeldItem(raw) {
  if (!raw) return null
  const resolved = resolveHeldItemByName(raw)
  return resolved ? { id: resolved.id, name: resolved.name, ...(raw?.fromInfinite || raw?.infinite ? { fromInfinite: true } : {}) } : null
}

export function heldItemData(monOrItem) {
  const raw = monOrItem && typeof monOrItem === 'object' && Object.prototype.hasOwnProperty.call(monOrItem, 'heldItem')
    ? monOrItem.heldItem
    : monOrItem
  return resolveHeldItemByName(raw)
}

export function heldItemLabel(mon) {
  return heldItemData(mon)?.name ?? 'Không có'
}

export function resolveHeldItemByName(raw) {
  const id = itemId(raw)
  if (!id) return null
  if (BY_ID.has(id)) return BY_ID.get(id)
  // Mega Stone: Showdown đặt tên Charizardite X, Gengarite, v.v. Đây là
  // trang bị hợp lệ dù chưa cần gõ tay hàng trăm viên đá.
  if (/(ite|itex|itey)$/.test(id) && id.length > 4) {
    const name = typeof raw === 'object' ? (raw.name ?? raw.id) : String(raw)
    return entry(id, name, 'Mega Stone dành cho đúng loài/forme; cần thêm Key Stone của huấn luyện viên.', { megaStone: true, ignoreKlutz: true })
  }
  if (id.endsWith('z') && id.length > 2) {
    const name = typeof raw === 'object' ? (raw.name ?? raw.id) : String(raw)
    return entry(id, name, 'Z-Crystal đặc biệt; chỉ hoạt động khi đúng Pokémon/chiêu và huấn luyện viên có Z-Ring.', { zCrystal: true, ignoreKlutz: true })
  }
  return null
}

export function isHoldableItem(raw) {
  return Boolean(resolveHeldItemByName(raw)?.holdable)
}

export function isTrainerGear(raw) {
  const it = resolveHeldItemByName(raw)
  return Boolean(it && !it.holdable)
}

export function heldItemIsActive(mon) {
  const it = heldItemData(mon)
  if (!it) return false
  return it.ignoreKlutz || !hasAbility(mon, 'Klutz')
}

export function consumeHeldItem(mon) {
  if (!mon?.heldItem) return mon
  const next = { ...mon, heldItem: null, consumedHeldItem: heldItemData(mon)?.id ?? itemId(mon.heldItem) }
  if (hasAbility(mon, 'Unburden')) next.unburdenActive = true
  return next
}

function speciesId(mon) {
  return abilityId(mon?.baseSpeciesId ?? mon?.species ?? mon?.name)
}

function formeId(mon) {
  return abilityId(mon?.species ?? mon?.name ?? mon?.baseSpeciesId)
}

export function heldItemStatMultiplier(mon, stat) {
  if (!heldItemIsActive(mon)) return 1
  const id = heldItemData(mon)?.id
  const species = speciesId(mon)
  if (!mon?.dyna && id === 'choice-band' && stat === 'atk') return 1.5
  if (!mon?.dyna && id === 'choice-specs' && stat === 'spa') return 1.5
  if (id === 'assault-vest' && stat === 'spd') return 1.5
  if (id === 'eviolite' && mon?.hasEvo && (stat === 'def' || stat === 'spd')) return 1.5
  if (id === 'light-ball' && species === 'pikachu' && (stat === 'atk' || stat === 'spa')) return 2
  if (id === 'thick-club' && ['cubone', 'marowak', 'marowakalola'].includes(species) && stat === 'atk') return 2
  if (id === 'metal-powder' && species === 'ditto' && !mon?.transformed && (stat === 'def' || stat === 'spd')) return 1.5
  if (id === 'deep-sea-tooth' && species === 'clamperl' && stat === 'spa') return 2
  if (id === 'deep-sea-scale' && species === 'clamperl' && stat === 'spd') return 2
  return 1
}

export function heldItemSpeedMultiplier(mon) {
  if (!heldItemIsActive(mon)) return hasAbility(mon, 'Unburden') && mon?.unburdenActive ? 2 : 1
  const id = heldItemData(mon)?.id
  let mult = 1
  if (!mon?.dyna && id === 'choice-scarf') mult *= 1.5
  if (id === 'iron-ball') mult *= 0.5
  if (id === 'quick-powder' && speciesId(mon) === 'ditto' && !mon?.transformed) mult *= 2
  if (hasAbility(mon, 'Unburden') && mon?.unburdenActive) mult *= 2
  return mult
}

export function heldItemPriorityPenalty(mon) {
  return heldItemIsActive(mon) && heldItemData(mon)?.id === 'lagging-tail' ? -0.1 : 0
}

export function groundedByHeldItem(mon) {
  return heldItemIsActive(mon) && heldItemData(mon)?.id === 'iron-ball'
}

/** Trả về bảng hệ dùng để tính khắc hệ sau khi xét Iron Ball. Dùng chung cho
 * sát thương, nhãn hiệu quả, Weakness Policy, Expert Belt và resist Berry để
 * các nhánh không tự tính mỗi kiểu. */
export function defenderTypesWithHeldItem(defender, moveType) {
  const types = defender?.types ?? []
  if (abilityId(moveType) !== 'ground' || !groundedByHeldItem(defender)) return types
  return types.filter((type) => abilityId(type) !== 'flying')
}

export function canKnockOffHeldItem(mon) {
  const it = heldItemData(mon)
  if (!mon?.heldItem || !it) return false
  // Sticky Hold giữ chặt vật phẩm. Chặn ngay từ bước tính điều kiện để Knock Off
  // không vừa được tăng lực vừa âm thầm làm mất trang bị trong state trận.
  if (hasAbility(mon, 'Sticky Hold')) return false
  // Z-Crystal và Mega Stone được xem là vật phẩm khóa forme/gimmick; không
  // cho Knock Off gỡ để tránh mở trạng thái không hợp lệ giữa trận.
  return !it.zType && !it.zCrystal && !it.megaStone
}

function knockOffHeldItem(mon) {
  if (!canKnockOffHeldItem(mon)) return mon
  const next = { ...mon, knockedOffHeldItem: mon.heldItem, heldItem: null }
  if (hasAbility(mon, 'Unburden')) next.unburdenActive = true
  return next
}

/** Knock Off chỉ gỡ món trong runtime trận. Khi trận kết thúc, món không tiêu
 * hao phải quay lại đúng cá thể; Berry/Focus Sash/Life Orb tiêu hao không có
 * `knockedOffHeldItem` nên không được phục hồi nhầm. */
export function restoreTransientHeldItem(mon) {
  if (!mon) return mon
  const next = { ...mon }
  if (!next.heldItem && next.knockedOffHeldItem) next.heldItem = next.knockedOffHeldItem
  delete next.knockedOffHeldItem
  return next
}

export function heldItemDamageMultiplier(attacker, move, effectiveness = 1, defender = null) {
  if (!move || Number(move.power) <= 0) return 1
  const it = heldItemIsActive(attacker) ? heldItemData(attacker) : null
  let mult = 1
  const moveKey = itemId(move?.baseMoveName ?? move?.name)
  // Các chiêu phụ thuộc held item thường bị bỏ sót khi chỉ đọc basePower tĩnh
  // từ moves.json. Acrobatics tăng lực khi thật sự không còn item; Knock Off
  // chỉ tăng lực khi mục tiêu đang có món có thể bị gỡ trong trận.
  if (moveKey === 'acrobatics' && !attacker?.heldItem) mult *= 2
  if (moveKey === 'knockoff' && canKnockOffHeldItem(defender)) mult *= 1.5
  if (it?.id === 'life-orb') mult *= 1.3
  if (it?.id === 'expert-belt' && effectiveness > 1) mult *= 1.2
  if (it?.id === 'muscle-band' && move.category === 'Physical') mult *= 1.1
  if (it?.id === 'wise-glasses' && move.category === 'Special') mult *= 1.1
  if (it?.boostType && abilityId(move.type) === it.boostType) mult *= 1.2
  if (it?.id === 'soul-dew' && ['latias', 'latios'].includes(speciesId(attacker)) && ['psychic', 'dragon'].includes(abilityId(move.type))) mult *= 1.2
  return mult
}

function moveIdentity(move) {
  return move?.baseMoveName ?? move?.name ?? ''
}

export function heldItemMoveAllowed(mon, move) {
  if (!move) return { allowed: false, reason: 'Không có chiêu hợp lệ.' }
  if (heldItemIsActive(mon) && heldItemData(mon)?.id === 'assault-vest' && move.category === 'Status') {
    return { allowed: false, reason: `${heldItemData(mon).name} không cho dùng chiêu Status.` }
  }
  if (!mon?.dyna && heldItemIsActive(mon) && ['choice-band', 'choice-specs', 'choice-scarf'].includes(heldItemData(mon)?.id) && mon.choiceLock && itemId(mon.choiceLock) !== itemId(moveIdentity(move))) {
    return { allowed: false, reason: `${heldItemData(mon).name} đang khóa ${mon.name} vào ${mon.choiceLock}.` }
  }
  return { allowed: true, reason: '' }
}

export function lockChoiceMove(mon, move) {
  if (!mon || !move || !heldItemIsActive(mon) || mon?.dyna) return mon
  if (!['choice-band', 'choice-specs', 'choice-scarf'].includes(heldItemData(mon)?.id)) return mon
  return mon.choiceLock ? mon : { ...mon, choiceLock: moveIdentity(move) }
}

export function clearHeldItemVolatile(mon) {
  if (!mon) return mon
  const next = { ...mon }
  delete next.choiceLock
  delete next.unburdenActive
  return next
}

export function weatherTurnsFromHeldItem(mon, weatherKey, fallback = 5) {
  if (!heldItemIsActive(mon)) return fallback
  const id = heldItemData(mon)?.id
  if (weatherKey === 'rain' && id === 'damp-rock') return 8
  if (weatherKey === 'sun' && id === 'heat-rock') return 8
  if (weatherKey === 'sandstorm' && id === 'smooth-rock') return 8
  if (weatherKey === 'snow' && id === 'icy-rock') return 8
  return fallback
}

export function beforeDamageHeldItem({ attacker, defender, move, damage, effectiveness = 1, berryBlocked = false }) {
  let nextDefender = { ...defender }
  let nextDamage = Math.max(0, Number(damage) || 0)
  const logs = []
  if (!heldItemIsActive(nextDefender) || nextDamage <= 0) return { defender: nextDefender, damage: nextDamage, logs }
  const it = heldItemData(nextDefender)
  const moveType = abilityId(move?.type)
  if (it.id === 'air-balloon' && moveType === 'ground') {
    return { defender: nextDefender, damage: 0, logs: [`Air Balloon giúp ${nextDefender.name} tránh chiêu hệ Ground!`], immune: true }
  }
  if (!berryBlocked && it.resistType === moveType && (effectiveness > 1 || it.id === 'chilanberry')) {
    nextDamage = Math.max(1, Math.floor(nextDamage / 2))
    logs.push(`${it.name} làm yếu đòn siêu hiệu quả!`)
    nextDefender = consumeHeldItem(nextDefender)
  }
  if (nextDamage >= nextDefender.hp && nextDefender.hp === nextDefender.maxHp) {
    if (it.id === 'focus-sash') {
      nextDamage = Math.max(0, nextDefender.hp - 1)
      logs.push(`${nextDefender.name} bám trụ ở 1 HP nhờ Focus Sash!`)
      nextDefender = consumeHeldItem(nextDefender)
    } else if (it.id === 'focus-band' && Math.random() < 0.1) {
      nextDamage = Math.max(0, nextDefender.hp - 1)
      logs.push(`${nextDefender.name} bám trụ ở 1 HP nhờ Focus Band!`)
    }
  }
  return { defender: nextDefender, damage: nextDamage, logs }
}

function isContact(move) {
  return Boolean(move?.flags?.contact)
}

export function afterDamageHeldItem({ attacker, defender, move, damage, effectiveness = 1, berryBlocked = false }) {
  let nextAttacker = { ...attacker }
  let nextDefender = { ...defender }
  let attackerBoosts = null
  const logs = []
  if (damage <= 0) return { attacker: nextAttacker, defender: nextDefender, attackerBoosts, logs }

  if (heldItemIsActive(nextDefender) && heldItemData(nextDefender)?.id === 'air-balloon') {
    logs.push(`Air Balloon của ${nextDefender.name} đã vỡ!`)
    nextDefender = consumeHeldItem(nextDefender)
  }
  if (heldItemIsActive(nextDefender) && heldItemData(nextDefender)?.id === 'weakness-policy' && effectiveness > 1 && nextDefender.hp > 0) {
    logs.push(`Weakness Policy của ${nextDefender.name} kích hoạt!`)
    attackerBoosts = { atk: 2, spa: 2, target: 'defender' }
    nextDefender = consumeHeldItem(nextDefender)
  }
  if (heldItemIsActive(nextDefender) && heldItemData(nextDefender)?.id === 'rocky-helmet' && isContact(move) && nextAttacker.hp > 0 && !hasAbility(nextAttacker, 'Magic Guard')) {
    const recoil = Math.max(1, Math.floor(nextAttacker.maxHp / 6))
    nextAttacker.hp = Math.max(0, nextAttacker.hp - recoil)
    logs.push(`${nextAttacker.name} mất ${recoil} HP vì Rocky Helmet.`)
  }
  // Berry hồi máu kích hoạt ngay giữa chuỗi multi-hit, giống battle event của
  // Showdown; không chờ tới cuối lượt. Unnerve của đối thủ chặn việc ăn Berry.
  if (!berryBlocked) {
    const berry = berryHeal(nextDefender)
    nextDefender = berry.mon
    logs.push(...berry.logs)
  }
  if (itemId(move?.baseMoveName ?? move?.name) === 'knockoff' && canKnockOffHeldItem(nextDefender)) {
    const removed = heldItemData(nextDefender)?.name
    nextDefender = knockOffHeldItem(nextDefender)
    logs.push(`${nextDefender.name} bị đánh rơi ${removed}!`)
  }
  return { attacker: nextAttacker, defender: nextDefender, attackerBoosts, logs }
}

/** Hiệu ứng của vật phẩm bên tấn công chỉ chạy MỘT LẦN sau toàn bộ chiêu.
 * Tách khỏi afterDamageHeldItem để Life Orb/Shell Bell không bị nhân theo số
 * hit hoặc số mục tiêu trong đấu đôi. */
export function afterMoveHeldItem({ attacker, move, totalDamage }) {
  let nextAttacker = { ...attacker }
  const logs = []
  if (!nextAttacker || totalDamage <= 0) return { attacker: nextAttacker, logs }
  const id = heldItemData(nextAttacker)?.id
  if (heldItemIsActive(nextAttacker) && id === 'life-orb' && nextAttacker.hp > 0
    && !hasAbility(nextAttacker, 'Magic Guard')
    && !(hasAbility(nextAttacker, 'Sheer Force') && move?.secondary)) {
    const recoil = Math.max(1, Math.floor(nextAttacker.maxHp / 10))
    nextAttacker.hp = Math.max(0, nextAttacker.hp - recoil)
    logs.push(`${nextAttacker.name} mất ${recoil} HP vì Life Orb.`)
  }
  if (heldItemIsActive(nextAttacker) && id === 'shell-bell' && nextAttacker.hp > 0) {
    const heal = Math.max(1, Math.floor(totalDamage / 8))
    const before = nextAttacker.hp
    nextAttacker.hp = Math.min(nextAttacker.maxHp, nextAttacker.hp + heal)
    if (nextAttacker.hp > before) logs.push(`${nextAttacker.name} hồi ${nextAttacker.hp - before} HP nhờ Shell Bell.`)
  }
  return { attacker: nextAttacker, logs }
}

function berryHeal(mon) {
  if (!heldItemIsActive(mon) || mon.hp <= 0 || mon.hp > Math.floor(mon.maxHp / 2)) return { mon, logs: [] }
  const id = heldItemData(mon)?.id
  let heal = 0
  if (id === 'sitrus-berry') heal = Math.max(1, Math.floor(mon.maxHp / 4))
  if (id === 'oran-berry') heal = 10
  if (!heal) return { mon, logs: [] }
  const before = mon.hp
  let next = { ...mon, hp: Math.min(mon.maxHp, mon.hp + heal) }
  const item = heldItemData(mon)?.name
  next = consumeHeldItem(next)
  return { mon: next, logs: [`${mon.name} hồi ${next.hp - before} HP nhờ ${item}.`] }
}

export function afterStatusHeldItem(mon, berryBlocked = false) {
  if (!mon?.status || !heldItemIsActive(mon) || berryBlocked) return { mon, logs: [] }
  const id = heldItemData(mon)?.id
  const cures = { 'chesto-berry': 'slp', 'cheri-berry': 'par', 'pecha-berry': 'psn', 'rawst-berry': 'brn', 'aspear-berry': 'frz' }
  if (id !== 'lum-berry' && cures[id] !== mon.status) return { mon, logs: [] }
  const item = heldItemData(mon).name
  const next = consumeHeldItem({ ...mon, status: null, sleepTurns: undefined })
  return { mon: next, logs: [`${item} chữa trạng thái cho ${mon.name}.`] }
}

export function endTurnHeldItemEffect(mon, berryBlocked = false) {
  if (!mon || mon.hp <= 0) return { mon, logs: [] }
  let next = { ...mon }
  const logs = []
  if (heldItemIsActive(next)) {
    const id = heldItemData(next)?.id
    const poisonType = next.types?.some((type) => abilityId(type) === 'poison')
    if (id === 'leftovers' || (id === 'black-sludge' && poisonType)) {
      const heal = Math.max(1, Math.floor(next.maxHp / 16))
      const before = next.hp
      next.hp = Math.min(next.maxHp, next.hp + heal)
      if (next.hp > before) logs.push(`${next.name} hồi ${next.hp - before} HP nhờ ${heldItemData(mon).name}.`)
    } else if ((id === 'black-sludge' || id === 'sticky-barb') && !hasAbility(next, 'Magic Guard')) {
      const loss = Math.max(1, Math.floor(next.maxHp / 8))
      next.hp = Math.max(0, next.hp - loss)
      logs.push(`${next.name} mất ${loss} HP vì ${heldItemData(mon).name}.`)
    } else if (id === 'flame-orb' && !next.status && !statusIsBlocked(next, 'brn')) {
      next.status = 'brn'
      logs.push(`Flame Orb làm ${next.name} bị bỏng.`)
    } else if (id === 'toxic-orb' && !next.status && !statusIsBlocked(next, 'psn')) {
      next.status = 'psn'
      logs.push(`Toxic Orb làm ${next.name} bị độc.`)
    }
  }
  if (!berryBlocked) {
    const berry = berryHeal(next)
    next = berry.mon
    logs.push(...berry.logs)
  }
  const cured = afterStatusHeldItem(next, berryBlocked)
  next = cured.mon
  logs.push(...cured.logs)
  return { mon: next, logs }
}

export function trainerHasGear(inventory, kind) {
  const accepted = {
    mega: ['key-stone', 'mega-ring', 'mega-bracelet'],
    zmove: ['z-ring', 'z-power-ring'],
    dynamax: ['dynamax-band'],
    tera: ['tera-orb'],
  }[kind] ?? []
  return (inventory ?? []).some((raw) => (raw?.infinite || (raw?.qty ?? 1) > 0) && accepted.includes(resolveHeldItemByName(raw)?.id ?? itemId(raw)))
}

export function megaStoneMatches(mon, megaEntry) {
  if (!mon || !megaEntry || !heldItemIsActive(mon)) return false
  const held = itemId(heldItemData(mon)?.id)
  const required = [megaEntry.requiredItem, ...(megaEntry.requiredItems ?? [])].filter(Boolean).map(itemId)
  if (required.length) return required.includes(held)
  const forme = itemId(megaEntry.name)
  const exactFallback = MEGA_STONE_BY_FORME[forme]
  if (exactFallback) return held === exactFallback
  // Chỉ còn dùng suy tên cho forme không có trong bảng; dữ liệu mới luôn ưu
  // tiên requiredItem/requiredItems ở trên.
  const expected = itemId(String(megaEntry.name ?? '').replace(/-Mega-?/i, 'ite '))
  return held === expected
}

export function zCrystalMatchesMove(mon, move) {
  if (!mon || !move || Number(move.power) <= 0 || !heldItemIsActive(mon)) return false
  const it = heldItemData(mon)
  if (!it) return false
  if (it.zType) return abilityId(move.type) === it.zType
  if (it.zCrystal) {
    const rule = SPECIAL_Z_CRYSTALS[itemId(it.id)]
    if (!rule) return false // crystal chưa có rule thì không giả vờ hoạt động
    const species = formeId(mon)
    return rule.species.includes(species) && rule.moves.includes(itemId(move?.baseMoveName ?? move?.name))
  }
  return false
}

export function canUseMegaWithItems(mon, megaEntry, inventory, dev = false) {
  if (dev) return { ok: true, reason: '' }
  if (!trainerHasGear(inventory, 'mega')) return { ok: false, reason: 'Huấn luyện viên cần Key Stone/Mega Ring trong túi.' }
  const rayquaza = itemId(mon?.species ?? mon?.name) === 'rayquaza' && /rayquaza.*mega/i.test(megaEntry?.name ?? '')
  if (rayquaza) {
    const knowsDragonAscent = (mon.moves ?? []).some((move) => itemId(move.id ?? move.name) === 'dragonascent')
    return knowsDragonAscent
      ? { ok: true, reason: '' }
      : { ok: false, reason: 'Rayquaza phải biết Dragon Ascent để Mega Evolution; nó không dùng Mega Stone.' }
  }
  if (!megaStoneMatches(mon, megaEntry)) return { ok: false, reason: `Pokémon phải cầm đúng ${megaEntry?.requiredItem ?? 'Mega Stone của forme này'}.` }
  return { ok: true, reason: '' }
}

export function canUseZMoveWithItems(mon, inventory, dev = false) {
  if (!dev && !trainerHasGear(inventory, 'zmove')) return { ok: false, reason: 'Huấn luyện viên cần Z-Ring trong túi.' }
  const moves = (mon?.moves ?? []).filter((move) => zCrystalMatchesMove(mon, move))
  if (!moves.length && !dev) return { ok: false, reason: 'Pokémon phải cầm Z-Crystal cùng hệ với một chiêu gây sát thương.' }
  return { ok: moves.length > 0 || dev, reason: moves.length || dev ? '' : 'Không có chiêu tương thích.', moves }
}

export function heldItemDescription(raw) {
  return resolveHeldItemByName(raw)?.desc ?? 'Chưa có cơ chế cho vật phẩm này.'
}
