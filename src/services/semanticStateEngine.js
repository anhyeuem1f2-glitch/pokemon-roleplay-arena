// ============ SEMANTIC STATE ENGINE (đợt 106) ============
// Đường cập nhật state chính không còn phụ thuộc cú pháp [[TAG]]. Model phụ
// đọc DUY NHẤT chính văn đã hiển thị và trả danh sách SỰ KIỆN có nghĩa.
// App chuyển event -> directive nội bộ, rồi commit từng directive độc lập.
// Tag cũ vẫn được giữ ở parser legacy để tương thích save/preset cũ.

import { chatCompletion } from './aiClient.js'
import { normalizePokemonGender } from '../data/pokemonGender.js'
import { parseBadgeDirective, parseQuestDirective } from '../data/worldProgress.js'
import { proseSupportsPokemonAcquisition } from '../utils/stateEvidence.js'
import { craftedPokemonAccessoryName, resolveItemByName } from '../data/shopItems.js'

const KIND_ALIASES = {
  money: 'money_change', money_change: 'money_change', payment: 'money_change', income: 'money_change', expense: 'money_change',
  item: 'item_change', item_change: 'item_change', inventory: 'item_change', inventory_change: 'item_change',
  item_received: 'item_change', receive_item: 'item_change', item_gain: 'item_change', item_lost: 'item_change', item_used: 'item_change', consume_item: 'item_change',
  item_created: 'item_change', item_crafted: 'item_change', craft_item: 'item_change', crafted_item: 'item_change', create_item: 'item_change', item_owned: 'item_change', item_possessed: 'item_change',
  item_patch: 'item_patch', item_update: 'item_patch', inventory_patch: 'item_patch', item_property: 'item_patch', item_metadata: 'item_patch',
  pokemon_acquired: 'pokemon_acquired', pokemon_gain: 'pokemon_acquired', acquire_pokemon: 'pokemon_acquired', catch_pokemon: 'pokemon_acquired',
  pokemon_received: 'pokemon_acquired', receive_pokemon: 'pokemon_acquired', pokemon_owned: 'pokemon_acquired', pokemon_joined: 'pokemon_acquired',
  pokemon_removed: 'pokemon_removed', release_pokemon: 'pokemon_removed', pokemon_released: 'pokemon_removed', pokemon_lost: 'pokemon_removed', pokemon_traded_away: 'pokemon_removed',
  pokemon_level: 'pokemon_level', level: 'pokemon_level', level_change: 'pokemon_level',
  pokemon_evolve: 'pokemon_evolve', evolve: 'pokemon_evolve', evolution: 'pokemon_evolve',
  pokemon_friendship: 'pokemon_friendship', friendship: 'pokemon_friendship', bond: 'pokemon_friendship',
  pokemon_patch: 'pokemon_patch', pokemon_update: 'pokemon_patch', pokemon_attribute: 'pokemon_patch',
  relationship: 'relationship_change', relationship_change: 'relationship_change', affinity: 'relationship_change',
  body: 'body_change', body_change: 'body_change', injury: 'body_change', heal: 'body_change',
  hunger: 'hunger_change', hunger_change: 'hunger_change', satiety: 'hunger_change',
  move: 'move', location: 'move', location_change: 'move', travel: 'move',
  time: 'time_advance', time_advance: 'time_advance', date: 'time_advance',
  time_of_day: 'time_of_day', daypart: 'time_of_day',
  training: 'training', train: 'training',
  npc: 'npc_upsert', npc_upsert: 'npc_upsert',
  fact: 'fact_upsert', fact_upsert: 'fact_upsert', memory: 'fact_upsert',
  badge: 'badge_gain', badge_gain: 'badge_gain',
  quest: 'quest_update', quest_update: 'quest_update',
  reputation: 'reputation_change', reputation_change: 'reputation_change',
  wanted: 'wanted_change', wanted_change: 'wanted_change',
  legendary_access: 'legendary_access', legendary: 'legendary_access',
  ribbon: 'ribbon_gain', ribbon_gain: 'ribbon_gain',
  mark: 'mark_gain', mark_gain: 'mark_gain',
  shop: 'shop_enter', shop_enter: 'shop_enter',
  pokecenter: 'pokecenter_enter', pokemon_center: 'pokecenter_enter', pokecenter_enter: 'pokecenter_enter',
  equip: 'equip', unequip: 'unequip',
  custom: 'custom_state', custom_state: 'custom_state', world_state: 'custom_state', dynamic_state: 'custom_state', state_change: 'custom_state',
}

const SEMANTIC_SYSTEM = `Bạn là CANON STATE INTERPRETER của game nhập vai Pokémon.

MỤC TIÊU DUY NHẤT: biến CHÍNH VĂN CUỐI CÙNG người chơi thực sự nhìn thấy thành các SỰ KIỆN TRẠNG THÁI đã xảy ra. Bạn không kiểm luật game, không kiểm database, không viết tag, không đòi đúng từ khóa. Nếu chính văn đã canon hóa một việc thì state phải phản chiếu việc đó.

NGUYÊN TẮC CỐT LÕI:
1. CHÍNH VĂN là nguồn sự thật. INPUT chỉ để hiểu chủ thể/ý định, không tự tạo state.
2. Đọc theo NGỮ NGHĨA: đại từ, biệt danh, lược chủ ngữ, câu dài, nhiều đoạn, diễn đạt gián tiếp, danh sách, hóa đơn, chuyển khoản, đồ/NPC/quyền/năng lực tự sáng tạo đều hợp lệ.
3. KHÔNG BAO GIỜ bác một sự kiện chỉ vì "không có trong Pokédex/danh mục/database". Pokédex cũng có thể là TÊN MỘT VẬT PHẨM trong truyện. Database là việc của app sau này.
4. Nếu chính văn nói người chơi đã nhận/sở hữu một vật, Pokémon, quyền, danh hiệu, giấy tờ, thiết bị... thì xuất event tương ứng. Không cần câu phải chứa đúng "nhận được". Đặc biệt với VẬT PHẨM TỰ SÁNG TẠO: nếu STATE snapshot chưa có item nhưng chính văn cho thấy người chơi đang rút nó từ balo, đang cầm/sở hữu/mang theo hoặc dùng nó như tài sản sẵn có, hãy reconciliation bằng item_change quantity=+1/operation=possess (trừ khi cuối lượt nó đã bị tiêu hao/mất). Không được bác chỉ vì không có acquisition verb trong chính lượt.
5. Nếu chính văn nói Pokémon đã thuộc về NGƯỜI CHƠI/đội của người chơi, đó là pokemon_acquired. Nếu một cá thể của người chơi đã được thả, trao đi hoặc trade khỏi quyền sở hữu thì pokemon_removed. Nếu Pokémon chỉ xuất hiện, được nhìn thấy, hoặc thuộc NPC thì KHÔNG phải pokemon_acquired.
6. Nếu một Pokémon đã có trong PARTY/PC, các thay đổi của nó phải nhắm vào đúng cá thể hiện có (ưu tiên uid nếu snapshot có), không tạo bản sao.
7. Event nào đã xảy ra thì status=completed. Việc đang cân nhắc/dự định/giá niêm yết/khả năng tương lai thì bỏ.
8. Không giới hạn số event. Mỗi event độc lập; một event mơ hồ không được làm mất các event rõ khác.
9. Vật phẩm: trả NET CHANGE của từng tên vật phẩm trong lượt. Nhận 3 rồi dùng 1 => quantity=2. Mất/dùng/trả => quantity âm. Vật phẩm lạ vẫn giữ nguyên tên.
9a. TRANG SỨC/PHỤ KIỆN POKÉMON là entity RIÊNG với held item chiến đấu. Nếu người chơi dùng Leaf Stone/Fire Stone/vật liệu canon để CHẾ thành bông tai, vòng cổ, mặt dây, vòng tay, nơ... thì THÀNH PHẨM phải có TÊN RIÊNG khác nguyên liệu (VD Leaf Stone -> Bông Tai Lá Xanh / Vòng Cổ Lá Xanh / Phụ Kiện Lá Xanh), category=accessory, wearable=true, pokemonAccessory=true, holdable=false, sourceMaterial=<tên nguyên liệu>. TUYỆT ĐỐI không biến chính Leaf Stone thành đồ đeo.
9b. Khi chính văn nói Pokémon đeo/tháo phụ kiện, dùng kind=equip/unequip với details.slot="accessory" và item=<tên thành phẩm>. Held item battle vẫn dùng details.slot="held" hoặc bỏ slot.
10. MONEY: chỉ tiền thật sự vào/ra. Giá niêm yết không phải giao dịch. Nếu có số dư trước→sau, dùng chênh lệch. Nếu đã thanh toán hóa đơn, dùng tổng đã trả. operation=spend/payment phải có amount âm; income/reward/refund phải dương.
11. Quan hệ/thân mật/danh tiếng là thang điểm chủ quan: khi cảm xúc thay đổi rõ nhưng văn không cho số, tự chọn delta nhỏ-vừa hợp lý thay vì bỏ event.
12. Anime/Sandbox: những thứ tự sáng tạo đã được chính văn xác lập là hợp lệ. Realistic cũng vậy ở bước này: app đã dùng luật để định hướng câu chuyện trước đó; SAU KHI CHÍNH VĂN ĐÃ HIỂN THỊ thì interpreter chỉ có nhiệm vụ đồng bộ canon, không được phủ quyết.
13. confidence đo độ chắc rằng SỰ KIỆN ĐÃ XẢY RA trong canon. Đừng hạ confidence chỉ vì entity lạ hoặc phi canon. Với sự kiện đã được câu chữ xác lập rõ, ưu tiên >=0.8 dù đó là đồ/Pokémon fan-made.
14. evidence là một mô tả ngắn/paraphrase của căn cứ. KHÔNG cần copy nguyên văn.
15. owner: với item_change/pokemon_acquired, chỉ xuất nếu thay đổi tài sản của NGƯỜI CHƠI. Có thể ghi owner="player".

KIND chuẩn:
money_change, item_change, item_patch, pokemon_acquired, pokemon_removed, pokemon_level, pokemon_evolve, pokemon_friendship, pokemon_patch, relationship_change, body_change, hunger_change, move, time_advance, time_of_day, training, npc_upsert, fact_upsert, badge_gain, quest_update, reputation_change, wanted_change, legendary_access, ribbon_gain, mark_gain, shop_enter, pokecenter_enter, equip, unequip, custom_state.

Định dạng ưu tiên JSONL — MỖI EVENT MỘT OBJECT RIÊNG:
<STATE_EVENTS>
{"kind":"item_change","target":"Pokédex","quantity":1,"operation":"receive","owner":"player","status":"completed","confidence":0.96,"evidence":"giáo sư trao Pokédex cho người chơi","details":{"description":"Thiết bị tra cứu Pokémon","category":"key"}}
{"kind":"pokemon_acquired","target":"Ditto","owner":"player","level":12,"status":"completed","confidence":0.94,"evidence":"Ditto chính thức gia nhập đội"}
{"kind":"money_change","amount":-5000,"operation":"payment","status":"completed","confidence":0.98,"evidence":"người chơi đã thanh toán 5.000"}
</STATE_EVENTS>

Field tùy kind: id, target, uid, owner, source, amount, quantity, level, mode(delta|absolute), from, to, gender, status, confidence, evidence, note, place, x, y, days, dayPart, intensity, fields, details.
- pokemon_patch.details: gender, shiny, nature, ability, teraType, nickname, form, friendship, heldItem, accessories, ivs, evs, status, customAttributes và mọi thuộc tính fan-made khác.
- ABILITY KHÔNG phải quyền chỉnh tự do trong gameplay. Chỉ xuất pokemon_patch thay ability nếu STATE.player.abilityRewriteAllowed=true VÀ chính văn xác nhận người chơi đã dùng thiên phú đó để thay/chọn/xóa Ability. Nếu cờ false, không tự đổi Ability chỉ vì người chơi mong muốn. Nếu thiên phú xóa một Ability mà không thay bằng Ability khác, ghi ability="None" để state battle không còn nhận Ability cũ. Ability của Pokémon mới nhận hoặc thay đổi do tiến hóa/form chính thức đi theo event tương ứng.
- SHINY là một cờ boolean ĐỘC LẬP với màu lửa/aura/hiệu ứng tự sáng tạo. Nếu chính văn nói 'Charmander Shiny với lửa tím', BẮT BUỘC shiny=true; 'lửa tím' phải nằm trong customAttributes.appearanceNote/visualTraits, KHÔNG được biến thành form riêng và KHÔNG được dùng thay cho shiny. Sprite/model đặc biệt ngoài Shiny chuẩn là việc của UI; interpreter chỉ lưu mô tả canon.
- pokemon_acquired.details có thể thêm types, baseStats, moves, ability, description nếu là Pokémon/form fan-made.
- item_change.details: category, holdable, wearable, pokemonAccessory, accessorySlot, sourceMaterial, infinite, keyItem, effect/effects, charges, durability, rarity, usage, customAttributes và mọi thuộc tính fan-made đã được canon xác lập. description KHÔNG bắt buộc; nếu chính văn không nói rõ thì bỏ trống. Mô tả item động sẽ do Item Description Protocol riêng tạo từ canon, không tự mượn mô tả vật phẩm khác.
- item_patch: dùng khi VẬT PHẨM ĐÃ CÓ trong túi được chính văn bổ sung/thay đổi thuộc tính mà số lượng KHÔNG đổi (công dụng mới, trạng thái, số lần dùng, độ bền, quyền truy cập, ngoại hình, liên kết chủ sở hữu, hiệu ứng fan-made...). target là đúng tên/id vật phẩm; details/fields chứa các thuộc tính mới. KHÔNG dùng item_change quantity=0 cho việc này.
- quest_update.details: id,status,title,giver,objective,reward,region.
- custom_state dùng cho mọi state mới không khớp loại chuẩn: target là khóa; namespace; operation=set|merge|delta|append|remove; value/details là dữ liệu.
- Unknown kind cũng được app giữ như dynamic state, nhưng hãy ưu tiên kind chuẩn khi có thể.
Nếu thật sự không có thay đổi state nào, trả <STATE_EVENTS>{"events":[]}</STATE_EVENTS>.
Không markdown, không giải thích ngoài khối STATE_EVENTS.`

function normalizeKind(value) {
  const key = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return KIND_ALIASES[key] ?? key
}

function asNumber(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  let raw = String(value ?? '').trim()
  if (!raw) return fallback
  // Chấp nhận 5.000₽ / 5,000 / 1.250,50 / 1,250.50 thay vì bắt model
  // chuẩn hóa tuyệt đối trước khi app hiểu được một con số.
  raw = raw.replace(/[^\d+\-.,]/g, '')
  if (!raw) return fallback
  const dots = (raw.match(/\./g) ?? []).length
  const commas = (raw.match(/,/g) ?? []).length
  if (dots && commas) {
    const lastDot = raw.lastIndexOf('.')
    const lastComma = raw.lastIndexOf(',')
    const decimal = lastDot > lastComma ? '.' : ','
    const thousand = decimal === '.' ? ',' : '.'
    raw = raw.split(thousand).join('').replace(decimal, '.')
  } else if (dots > 1 || commas > 1 || /^[+\-]?\d{1,3}[.,]\d{3}$/.test(raw)) {
    raw = raw.replace(/[.,]/g, '')
  } else {
    raw = raw.replace(',', '.')
  }
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function signedQuantity(event) {
  const explicit = event.quantity ?? event.qty ?? event.amount ?? event.delta
  const numeric = asNumber(explicit, NaN)
  const direction = String(event.operation ?? event.op ?? event.action ?? event.direction ?? '').toLowerCase()
  const negativeDirection = /remove|lose|lost|use|used|consume|consumed|give|gave|sell|sold|spend|discard|return|returned|pay/.test(direction)
  const positiveDirection = /add|gain|gained|receive|received|obtain|obtained|acquire|acquired|buy|bought|find|found|reward|create|created|craft|crafted|forge|forged|make|made|own|owned|possess|possessed|carry|carried|have/.test(direction)
  if (Number.isFinite(numeric) && numeric !== 0) {
    if (negativeDirection) return -Math.abs(numeric)
    if (positiveDirection) return Math.abs(numeric)
    return numeric
  }
  if (negativeDirection) return -1
  if (positiveDirection) return 1
  return 0
}

function signedMoneyAmount(event) {
  let amount = asNumber(event.amount ?? event.delta ?? event.value, 0)
  const direction = String(event.operation ?? event.op ?? event.action ?? event.direction ?? event.kind ?? '').toLowerCase()
  if (!amount && Number.isFinite(asNumber(event.before, NaN)) && Number.isFinite(asNumber(event.after, NaN))) {
    amount = asNumber(event.after) - asNumber(event.before)
  }
  if (!amount) return 0
  if (/spend|spent|pay|paid|payment|purchase|buy|bought|fee|cost|debit|lose|lost/.test(direction)) return -Math.abs(amount)
  if (/income|reward|refund|receive|received|gain|gained|credit|earn|earned/.test(direction)) return Math.abs(amount)
  return amount
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, asNumber(value)))
}

function emptyParsed() {
  return {
    money: 0, moneyEntries: [], rel: [], body: [], shops: [], loots: [], npcs: [], facts: [],
    pokemons: [], pokemonRemovals: [], levels: [], evolutions: [], friendships: [], pokemonPatches: [], equipment: [], hunger: [],
    moves: [], moveDirectives: [], items: [], itemPatches: [], badges: [], quests: [], reputations: [], wanted: [],
    legendaryAccess: [], collectionAwards: [], dateAdvance: 0, training: 0, datePart: null,
    pokecenter: null, customEvents: [], dynamicUpdates: [],
  }
}

function balancedObjectSlices(text) {
  const out = []
  let depth = 0
  let start = -1
  let quote = false
  let escape = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quote) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') quote = false
      continue
    }
    if (ch === '"') { quote = true; continue }
    if (ch === '{') {
      if (depth === 0) start = i
      depth += 1
    } else if (ch === '}') {
      depth -= 1
      if (depth === 0 && start >= 0) {
        out.push(text.slice(start, i + 1))
        start = -1
      }
    }
  }
  return out
}

export function parseSemanticStateResponse(raw) {
  const text = String(raw ?? '')
  const block = text.match(/<STATE_EVENTS>\s*([\s\S]*?)(?:<\/STATE_EVENTS>|$)/i)?.[1]
    ?? text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
    ?? text
  let payload = null
  let malformed = false
  let salvaged = false
  try {
    payload = JSON.parse(block.trim())
  } catch {
    malformed = true
  }
  let events = Array.isArray(payload) ? payload : payload?.events
  if (!Array.isArray(events)) {
    events = []
    const eventArea = block.includes('"events"') ? block.slice(block.indexOf('"events"')) : block
    for (const slice of balancedObjectSlices(eventArea)) {
      try {
        const obj = JSON.parse(slice)
        if (obj && typeof obj === 'object' && obj.kind) events.push(obj)
        else if (Array.isArray(obj?.events)) events.push(...obj.events)
      } catch { /* salvage best effort */ }
    }
    salvaged = events.length > 0
  }
  const normalized = events
    .filter((event) => event && typeof event === 'object')
    .map((event, index) => ({
      ...event,
      id: String(event.id ?? `semantic-${index}`),
      kind: normalizeKind(event.kind ?? event.type),
      status: String(event.status ?? 'completed').toLowerCase(),
      confidence: clamp(event.confidence ?? 0.82, 0, 1),
      evidence: String(event.evidence ?? event.reason ?? '').trim(),
      details: event.details && typeof event.details === 'object' ? event.details : {},
    }))
    .filter((event) => event.kind && !['planned', 'intent', 'pending', 'future', 'failed', 'cancelled', 'canceled'].includes(event.status))
  return { events: normalized, malformed, salvaged }
}

function customFact(event) {
  const key = String(event.target ?? event.key ?? event.kind ?? 'Sự kiện').trim() || 'Sự kiện'
  const details = event.details && Object.keys(event.details).length ? ` ${JSON.stringify(event.details)}` : ''
  const value = event.value != null ? ` ${String(event.value)}` : ''
  const text = String(event.note ?? event.evidence ?? '').trim() || `${key}${value}${details}`.trim()
  return { key, text }
}

export function semanticEventsToParsed(events, { minConfidence = 0.30 } = {}) {
  const parsed = emptyParsed()
  const acceptedEvents = []
  const rejectedEvents = []
  for (const event of events ?? []) {
    if (asNumber(event.confidence, 0.82) < minConfidence) {
      rejectedEvents.push({ event, reason: `confidence ${event.confidence} < ${minConfidence}` })
      continue
    }
    const kind = normalizeKind(event.kind)
    const target = String(event.target ?? event.name ?? '').trim()
    const details = event.details ?? {}
    let accepted = true
    switch (kind) {
      case 'money_change': {
        const amount = signedMoneyAmount(event)
        if (amount) { parsed.moneyEntries.push(amount); parsed.money += amount } else accepted = false
        break
      }
      case 'item_change': {
        const qty = signedQuantity(event)
        if (target && qty) parsed.items.push({
          name: target,
          qty,
          ...details,
          semantic: true,
          evidence: event.evidence,
          source: event.source ?? '',
          semanticEventId: event.id,
          confidence: event.confidence,
          canon: true,
        })
        else accepted = false
        break
      }
      case 'item_patch': {
        const itemTarget = String(event.itemId ?? event.idRef ?? target).trim()
        const fields = { ...details, ...(event.fields && typeof event.fields === 'object' ? event.fields : {}) }
        for (const key of ['category', 'holdable', 'wearable', 'pokemonAccessory', 'accessorySlot', 'sourceMaterial', 'infinite', 'keyItem', 'price', 'effect', 'effects', 'charges', 'durability', 'rarity', 'usage', 'tags', 'customAttributes']) {
          if (event[key] !== undefined) fields[key] = event[key]
        }
        if (itemTarget && Object.keys(fields).length) parsed.itemPatches.push({
          target: itemTarget,
          fields,
          semantic: true, canon: true, semanticEventId: event.id, evidence: event.evidence, confidence: event.confidence,
        })
        else accepted = false
        break
      }
      case 'pokemon_acquired': {
        const species = String(event.species ?? target).trim()
        if (!species) { accepted = false; break }
        const mon = {
          species,
          level: clamp(event.level ?? details.level ?? 1, 1, 100),
          semantic: true,
          canon: true,
          semanticEventId: event.id,
          confidence: event.confidence,
          evidence: event.evidence,
          owner: event.owner ?? 'player',
          details: { ...details },
        }
        const gender = normalizePokemonGender(event.gender ?? details.gender)
        if (gender) mon.gender = gender
        for (const key of ['shiny', 'nature', 'ability', 'teraType', 'nickname', 'form', 'friendship', 'types', 'baseStats', 'moves', 'description']) {
          if ((event[key] ?? details[key]) != null) mon[key] = event[key] ?? details[key]
        }
        parsed.pokemons.push(mon)
        break
      }
      case 'pokemon_removed': {
        const pokemonTarget = String(event.uid ?? event.species ?? target).trim()
        if (pokemonTarget) parsed.pokemonRemovals.push({
          target: pokemonTarget,
          reason: String(event.note ?? event.evidence ?? details.reason ?? ''),
          semantic: true, canon: true, semanticEventId: event.id, evidence: event.evidence,
        })
        else accepted = false
        break
      }
      case 'pokemon_level': {
        const pokemonTarget = String(event.uid ?? target).trim()
        const value = asNumber(event.level ?? event.value ?? event.amount, 0)
        if (!pokemonTarget || !value) { accepted = false; break }
        const mode = String(event.mode ?? '').toLowerCase() === 'absolute' || event.level != null ? 'absolute' : 'delta'
        parsed.levels.push({ target: pokemonTarget, mode, value: mode === 'absolute' ? clamp(value, 1, 100) : value, semantic: true, canon: true, semanticEventId: event.id, evidence: event.evidence })
        break
      }
      case 'pokemon_evolve': {
        const from = String(event.uid ?? event.from ?? target).trim()
        const to = String(event.to ?? event.value ?? details.to ?? '').trim()
        if (from && to) parsed.evolutions.push({ from, to, semantic: true, canon: true, semanticEventId: event.id, evidence: event.evidence, details: { ...details } }); else accepted = false
        break
      }
      case 'pokemon_friendship': {
        const pokemonTarget = String(event.uid ?? target).trim()
        const delta = asNumber(event.amount ?? event.delta ?? event.value, 0)
        if (pokemonTarget && delta) parsed.friendships.push({ target: pokemonTarget, delta, note: event.note ?? event.evidence ?? '', semantic: true, canon: true, semanticEventId: event.id }); else accepted = false
        break
      }
      case 'pokemon_patch': {
        const pokemonTarget = String(event.uid ?? target).trim()
        const fields = { ...details }
        for (const key of ['gender', 'shiny', 'nature', 'ability', 'teraType', 'nickname', 'form', 'friendship', 'heldItem', 'accessories', 'ivs', 'evs', 'status', 'customAttributes']) {
          if (event[key] !== undefined) fields[key] = event[key]
        }
        if (pokemonTarget && Object.keys(fields).length) parsed.pokemonPatches.push({ target: pokemonTarget, fields, semantic: true, canon: true, semanticEventId: event.id, evidence: event.evidence })
        else accepted = false
        break
      }
      case 'relationship_change': {
        const delta = asNumber(event.amount ?? event.delta ?? event.value, 0)
        if (target && delta) parsed.rel.push({ name: target, delta, note: event.note ?? event.evidence ?? '', semantic: true, canon: true, semanticEventId: event.id }); else accepted = false
        break
      }
      case 'body_change': {
        const part = String(event.part ?? target).trim()
        const delta = asNumber(event.amount ?? event.delta ?? event.value, 0)
        if (part && delta) parsed.body.push({ part, delta, semantic: true, canon: true, semanticEventId: event.id }); else accepted = false
        break
      }
      case 'hunger_change': {
        const who = /pok|mon/i.test(String(event.who ?? target)) ? 'mon' : 'player'
        const delta = asNumber(event.amount ?? event.delta ?? event.value, 0)
        if (delta) parsed.hunger.push({ who, delta, semantic: true, canon: true, semanticEventId: event.id }); else accepted = false
        break
      }
      case 'move': {
        const place = String(event.place ?? target).trim()
        if (place) {
          const d = { place, x: Number.isFinite(Number(event.x)) ? clamp(event.x, 0, 100) : null, y: Number.isFinite(Number(event.y)) ? clamp(event.y, 0, 100) : null, semantic: true, canon: true, semanticEventId: event.id, evidence: event.evidence }
          parsed.moveDirectives.push(d)
          parsed.moves.push(place)
          // Bản đồ engine chỉ biết địa danh chuẩn. Mirror vị trí bằng state động
          // để địa điểm fan-made vẫn được nhớ qua các lượt dù không có map pin.
          parsed.dynamicUpdates.push({
            kind: 'custom_state', target: 'Vị trí truyện', namespace: 'world',
            operation: 'set', value: { place, x: d.x, y: d.y },
            semantic: true, canon: true, semanticEventId: event.id,
          })
        } else accepted = false
        break
      }
      case 'time_advance': {
        const days = Math.max(0, Math.trunc(asNumber(event.days ?? event.amount ?? event.value, 0)))
        if (days) parsed.dateAdvance += days; else accepted = false
        break
      }
      case 'time_of_day': parsed.datePart = String(event.dayPart ?? event.value ?? target).trim() || parsed.datePart; break
      case 'training': parsed.training += Math.max(1, Math.trunc(asNumber(event.intensity ?? event.amount ?? event.value, 1))); break
      case 'npc_upsert': {
        if (target) parsed.npcs.push({ name: target, fields: { ...(event.fields ?? details) }, semantic: true, canon: true, semanticEventId: event.id }); else accepted = false
        break
      }
      case 'fact_upsert': parsed.facts.push(customFact(event)); break
      case 'badge_gain': {
        if (target) parsed.badges.push({ ...parseBadgeDirective(target, `region=${details.region ?? event.region ?? ''}|gym=${details.gym ?? ''}|leader=${details.leader ?? ''}`), semantic: true, canon: true, semanticEventId: event.id, evidence: event.evidence }); else accepted = false
        break
      }
      case 'quest_update': {
        const q = { ...details, ...(event.fields ?? {}) }
        const id = String(q.id ?? target ?? q.title ?? 'quest').trim()
        parsed.quests.push({ ...parseQuestDirective(id, `status=${q.status ?? event.status ?? 'active'}|title=${q.title ?? target ?? id}|giver=${q.giver ?? ''}|objective=${q.objective ?? ''}|reward=${q.reward ?? ''}|region=${q.region ?? ''}`), semantic: true, canon: true, semanticEventId: event.id, evidence: event.evidence })
        break
      }
      case 'reputation_change': {
        const delta = asNumber(event.amount ?? event.delta ?? event.value, 0)
        if (target && delta) parsed.reputations.push({ name: target, delta, note: event.note ?? event.evidence ?? '', semantic: true, canon: true, semanticEventId: event.id }); else accepted = false
        break
      }
      case 'wanted_change': parsed.wanted.push({ delta: asNumber(event.amount ?? event.delta ?? event.value, 0), region: event.region ?? details.region ?? '', reason: event.note ?? event.evidence ?? '', bounty: asNumber(event.bounty ?? details.bounty, 0) }); break
      case 'legendary_access': if (target) parsed.legendaryAccess.push({ species: target, reason: event.note ?? event.evidence ?? '', semantic: true, canon: true, semanticEventId: event.id }); else accepted = false; break
      case 'ribbon_gain': if (target && (event.value ?? details.name)) parsed.collectionAwards.push({ kind: 'ribbon', target, name: String(event.value ?? details.name) }); else accepted = false; break
      case 'mark_gain': if (target && (event.value ?? details.name)) parsed.collectionAwards.push({ kind: 'mark', target, name: String(event.value ?? details.name) }); else accepted = false; break
      case 'shop_enter': if (target) parsed.shops.push({ name: target, type: details.type ?? '', size: details.size ?? '', semantic: true }); else accepted = false; break
      case 'pokecenter_enter': parsed.pokecenter = { name: target || 'Trung tâm Pokémon' }; break
      case 'equip': {
        const item = event.item ?? event.value ?? details.item
        if (target && item) parsed.equipment.push({
          target, item: String(item), mode: 'equip',
          equipmentKind: String(event.slot ?? details.slot ?? '').toLowerCase() === 'accessory' || details.pokemonAccessory ? 'accessory' : 'held',
          semantic: true, canon: true, semanticEventId: event.id, evidence: event.evidence,
        }); else accepted = false
        break
      }
      case 'unequip': {
        const item = event.item ?? event.value ?? details.item ?? null
        if (target) parsed.equipment.push({
          target, item: item ? String(item) : null, mode: 'unequip',
          equipmentKind: String(event.slot ?? details.slot ?? '').toLowerCase() === 'accessory' || details.pokemonAccessory ? 'accessory' : 'held',
          semantic: true, canon: true, semanticEventId: event.id, evidence: event.evidence,
        }); else accepted = false
        break
      }
      case 'custom_state': {
        const update = {
          ...event,
          kind,
          target: target || String(event.key ?? event.name ?? '').trim(),
          namespace: String(event.namespace ?? event.scope ?? 'world'),
          operation: String(event.operation ?? event.op ?? 'set'),
          value: event.value,
          details: { ...details },
          semantic: true,
          canon: true,
          semanticEventId: event.id,
        }
        if (!update.target) { accepted = false; break }
        parsed.customEvents.push(update)
        parsed.dynamicUpdates.push(update)
        parsed.facts.push(customFact(event))
        break
      }
      default: {
        // Không vứt sự kiện lạ: persist như một dynamic state + FACT. Đây là
        // điểm khiến hệ thống mở rộng được với biến người chơi tự nghĩ ra mà
        // không phải chờ dev bổ sung một TAG mới.
        const update = {
          ...event,
          kind,
          target: target || String(event.key ?? event.name ?? kind).trim(),
          namespace: String(event.namespace ?? event.scope ?? 'world'),
          operation: String(event.operation ?? event.op ?? 'set'),
          value: event.value,
          details: { ...details },
          semantic: true,
          canon: true,
          semanticEventId: event.id,
        }
        parsed.customEvents.push(update)
        parsed.dynamicUpdates.push(update)
        parsed.facts.push(customFact(event))
        break
      }
    }
    if (accepted) acceptedEvents.push(event)
    else rejectedEvents.push({ event, reason: 'thiếu field bắt buộc hoặc delta = 0' })
  }
  return { parsed, acceptedEvents, rejectedEvents }
}


function normalizeSearchText(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

function escapeRegex(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function splitNarrativeSentences(text) {
  return String(text ?? '').split(/(?<=[.!?。！？\n])\s*/).map((part) => part.trim()).filter(Boolean)
}

function sentenceClaimsShiny(sentence) {
  const text = normalizeSearchText(sentence)
  if (!/(?:\bshiny\b|dị sắc|di sac)/i.test(text)) return false
  // Chỉ phủ định khi cụm phủ định đứng rất gần từ shiny/dị sắc.
  if (/(?:không|khong|chẳng|chang|chưa|chua|not|isn['’]?t|is not)\s+(?:phải\s+|phai\s+)?(?:là\s+|la\s+)?(?:một\s+|mot\s+)?(?:con\s+)?(?:shiny|dị sắc|di sac)/i.test(text)) return false
  return true
}

function appearanceNoteFromSentence(sentence) {
  const text = String(sentence ?? '').trim()
  if (!text) return ''
  return /(lửa|lua|flame|aura|hào quang|hao quang|ánh sáng|anh sang|màu|mau|tím|tim|vàng|vang|đỏ|do|xanh|purple|gold|golden|violet|blue|red)/i.test(text)
    ? text.slice(0, 320)
    : ''
}

/**
 * Chốt deterministic cho ca model hay bỏ sót: "Charmander shiny với lửa tím".
 * Shiny chuẩn luôn là boolean riêng; màu lửa/aura chỉ được lưu như mô tả canon
 * để prompt các lượt sau nhớ, tuyệt đối không ép UI tìm một sprite không tồn tại.
 */
export function enrichNarrativePokemonAppearance(events, storyText, stateSnapshot) {
  const rows = Array.isArray(events) ? events.map((event) => ({ ...event, details: { ...(event?.details ?? {}) } })) : []
  const sentences = splitNarrativeSentences(storyText)
  if (!sentences.length) return rows

  const owned = [
    ...(stateSnapshot?.party ?? []),
    ...(stateSnapshot?.pc ?? []),
  ].filter(Boolean)
  const candidates = new Map()
  for (const event of rows) {
    const kind = normalizeKind(event.kind ?? event.type)
    if (!['pokemon_acquired', 'pokemon_patch', 'pokemon_level', 'pokemon_evolve', 'pokemon_friendship'].includes(kind)) continue
    const label = String(event.uid ?? event.species ?? event.target ?? event.name ?? '').trim()
    if (label) candidates.set(normalizeSearchText(label), { label, uid: event.uid ?? null })
  }
  for (const mon of owned) {
    for (const label of [mon.nickname, mon.name, mon.species, mon.pokemonId, mon.uid]) {
      if (label) candidates.set(normalizeSearchText(label), { label: String(label), uid: mon.uid ?? null })
    }
  }

  // Đợt 108: model semantic đôi khi vừa thấy một Charmander đã có trong
  // snapshot vừa trả pokemon_acquired chỉ vì câu mới mô tả "Charmander Shiny".
  // Nếu canon KHÔNG hề có hành vi nhận/bắt/gia nhập mà cá thể cùng loài đã sở
  // hữu, reinterpret event thành PATCH cho cá thể cũ. Trường hợp thật sự bắt
  // thêm con thứ hai vẫn qua vì proseSupportsPokemonAcquisition() xác nhận.
  for (const event of rows) {
    if (normalizeKind(event.kind ?? event.type) !== 'pokemon_acquired') continue
    const label = String(event.species ?? event.target ?? event.name ?? '').trim()
    if (!label || proseSupportsPokemonAcquisition(storyText, label)) continue
    const key = normalizeSearchText(label)
    const existing = owned.find((mon) => [mon.nickname, mon.name, mon.species, mon.pokemonId, mon.uid]
      .filter(Boolean).some((value) => normalizeSearchText(value) === key))
    if (!existing) continue
    const details = { ...(event.details ?? {}) }
    for (const field of ['gender', 'shiny', 'nature', 'ability', 'teraType', 'nickname', 'form', 'friendship']) {
      if (event[field] != null && details[field] == null) details[field] = event[field]
    }
    event.kind = 'pokemon_patch'
    event.uid = existing.uid ?? event.uid
    event.target = existing.uid ? undefined : (existing.nickname || existing.name || label)
    event.details = details
    event.evidence = event.evidence || `Cập nhật thuộc tính cá thể ${label} đã sở hữu; canon không có hành vi nhận thêm Pokémon.`
  }

  for (const candidate of candidates.values()) {
    const nameRe = new RegExp(escapeRegex(candidate.label), 'i')
    const sentence = sentences.find((part) => nameRe.test(part) && sentenceClaimsShiny(part))
    if (!sentence) continue
    const note = appearanceNoteFromSentence(sentence)
    let matched = false
    for (const event of rows) {
      const kind = normalizeKind(event.kind ?? event.type)
      if (!['pokemon_acquired', 'pokemon_patch'].includes(kind)) continue
      const target = normalizeSearchText(event.uid ?? event.species ?? event.target ?? event.name)
      if (target !== normalizeSearchText(candidate.label) && !(candidate.uid && target === normalizeSearchText(candidate.uid))) continue
      event.shiny = true
      event.details = { ...(event.details ?? {}), shiny: true }
      if (note) {
        event.details.customAttributes = {
          ...(event.details.customAttributes ?? {}),
          appearanceNote: note,
        }
      }
      matched = true
    }
    // Nếu model hoàn toàn quên pokemon_patch nhưng cá thể đã tồn tại, tự thêm
    // patch từ canon. Không tự tạo acquisition chỉ vì một Pokémon được nhắc.
    if (!matched && owned.some((mon) => [mon.uid, mon.pokemonId, mon.nickname, mon.name, mon.species]
      .filter(Boolean).some((label) => normalizeSearchText(label) === normalizeSearchText(candidate.label)))) {
      rows.push({
        id: `canon-shiny-${candidate.uid ?? normalizeSearchText(candidate.label)}`,
        kind: 'pokemon_patch',
        uid: candidate.uid ?? undefined,
        target: candidate.uid ? undefined : candidate.label,
        shiny: true,
        status: 'completed',
        confidence: 1,
        evidence: sentence.slice(0, 260),
        details: {
          shiny: true,
          ...(note ? { customAttributes: { appearanceNote: note } } : {}),
        },
      })
    }
  }
  return rows
}


const CRAFT_ACCESSORY_MATERIALS = [
  ['leaf-stone', /\b(?:leaf\s*stone|đá\s*lá|da\s*la)\b/i],
  ['fire-stone', /\b(?:fire\s*stone|đá\s*lửa|da\s*lua)\b/i],
  ['water-stone', /\b(?:water\s*stone|đá\s*nước|da\s*nuoc)\b/i],
  ['thunder-stone', /\b(?:thunder\s*stone|đá\s*(?:sét|điện)|da\s*(?:set|dien))\b/i],
  ['moon-stone', /\b(?:moon\s*stone|đá\s*mặt\s*trăng|da\s*mat\s*trang)\b/i],
  ['sun-stone', /\b(?:sun\s*stone|đá\s*mặt\s*trời|da\s*mat\s*troi)\b/i],
  ['shiny-stone', /\b(?:shiny\s*stone|đá\s*sáng|da\s*sang)\b/i],
  ['dusk-stone', /\b(?:dusk\s*stone|đá\s*(?:bóng\s*tối|hoàng\s*hôn)|da\s*(?:bong\s*toi|hoang\s*hon))\b/i],
  ['dawn-stone', /\b(?:dawn\s*stone|đá\s*bình\s*minh|da\s*binh\s*minh)\b/i],
  ['ice-stone', /\b(?:ice\s*stone|đá\s*băng|da\s*bang)\b/i],
]

function craftedAccessoryTypeFromSentence(sentence) {
  if (/bông\s*tai|earrings?/i.test(sentence)) return 'bông tai'
  if (/vòng\s*cổ|necklace|collar/i.test(sentence)) return 'vòng cổ'
  if (/mặt\s*dây|pendant/i.test(sentence)) return 'mặt dây'
  if (/vòng\s*tay|bracelet/i.test(sentence)) return 'vòng tay'
  if (/\bnơ\b|\bbow\b|ribbon/i.test(sentence)) return 'nơ'
  return 'phụ kiện'
}

/**
 * Chốt deterministic cho lỗi Leaf Stone bị đem đeo trực tiếp. Khi canon nói
 * rõ nguyên liệu canon đã được CHẾ thành trang sức/phụ kiện, state phải có một
 * thành phẩm tên riêng. Không sửa item nếu câu chỉ nói cầm/nhặt Leaf Stone.
 */
export function enrichCraftedPokemonAccessories(events, storyText) {
  const rows = Array.isArray(events) ? events.map((event) => ({ ...event, details: { ...(event?.details ?? {}) } })) : []
  for (const sentence of splitNarrativeSentences(storyText)) {
    if (!/(?:chế|che|làm|lam|tạo|tao|gia\s*công|craft|made|make)/i.test(sentence)) continue
    if (!/(?:phụ\s*kiện|phu\s*kien|trang\s*sức|trang\s*suc|bông\s*tai|vòng\s*cổ|mặt\s*dây|vòng\s*tay|\bnơ\b|earring|necklace|pendant|bracelet|collar|accessor)/i.test(sentence)) continue
    const materialRow = CRAFT_ACCESSORY_MATERIALS.find(([, re]) => re.test(sentence))
    if (!materialRow) continue
    const material = resolveItemByName(materialRow[0]) ?? { id: materialRow[0], name: materialRow[0] }
    let productName = craftedPokemonAccessoryName(material, craftedAccessoryTypeFromSentence(sentence))
    const materialKey = String(material?.id ?? materialRow[0]).toLowerCase()
    // Nếu model/chính văn đã cho thành phẩm một tên RIÊNG thì giữ tên đó;
    // chỉ dùng tên suy dẫn khi model vẫn gọi nhầm thành phẩm bằng tên nguyên liệu.
    const explicitProduct = rows.find((event) => {
      if (normalizeKind(event.kind ?? event.type) !== 'item_change') return false
      if (Number(event.quantity ?? event.amount ?? 0) <= 0) return false
      const target = String(event.target ?? event.name ?? '').trim()
      const resolved = resolveItemByName(target)
      if (resolved?.id === materialKey) return false
      const d = event.details ?? {}
      return d.category === 'accessory' || d.pokemonAccessory === true || d.wearable === true
        || /(?:phụ\s*kiện|trang\s*sức|bông\s*tai|vòng\s*cổ|mặt\s*dây|vòng\s*tay|accessor|earring|necklace|pendant)/i.test(String(event.evidence ?? ''))
    })
    if (explicitProduct?.target || explicitProduct?.name) productName = String(explicitProduct.target ?? explicitProduct.name).trim() || productName
    let hasProduct = false
    let equipTargetsProduct = false
    for (const event of rows) {
      const kind = normalizeKind(event.kind ?? event.type)
      const target = String(event.target ?? event.name ?? '').trim()
      const eventItem = String(event.item ?? event.value ?? event.details?.item ?? '').trim()
      const eventTargetItem = resolveItemByName(target)
      const eventEquipItem = resolveItemByName(eventItem)
      const accessoryFlag = event.details?.category === 'accessory' || event.details?.pokemonAccessory || event.details?.wearable
      const evidenceMentionsCraft = /(?:phụ\s*kiện|trang\s*sức|bông\s*tai|vòng\s*cổ|mặt\s*dây|vòng\s*tay|accessor|necklace|earring|pendant)/i.test(String(event.evidence ?? ''))
      if (kind === 'item_change' && Number(event.quantity ?? event.amount ?? 0) > 0
        && eventTargetItem?.id === materialKey && (accessoryFlag || evidenceMentionsCraft)) {
        event.target = productName
        event.details = {
          ...(event.details ?? {}), category: 'accessory', wearable: true, pokemonAccessory: true,
          holdable: false, sourceMaterial: material.name,
        }
        hasProduct = true
      } else if (kind === 'item_change' && Number(event.quantity ?? event.amount ?? 0) > 0
        && (normalizeSearchText(target) === normalizeSearchText(productName) || (accessoryFlag && eventTargetItem?.id !== materialKey))) {
        event.details = {
          ...(event.details ?? {}), category: 'accessory', wearable: true, pokemonAccessory: true,
          holdable: false, sourceMaterial: event.details?.sourceMaterial ?? material.name,
        }
        hasProduct = true
      }
      if (kind === 'equip' && eventEquipItem?.id === materialKey) {
        event.item = productName
        event.details = {
          ...(event.details ?? {}), item: productName, slot: 'accessory', category: 'accessory',
          wearable: true, pokemonAccessory: true, holdable: false, sourceMaterial: material.name,
        }
        equipTargetsProduct = true
      } else if (kind === 'equip' && normalizeSearchText(eventItem) === normalizeSearchText(productName)) {
        event.details = { ...(event.details ?? {}), slot: 'accessory', pokemonAccessory: true }
        equipTargetsProduct = true
      }
    }
    if (!hasProduct) {
      rows.push({
        id: `canon-crafted-accessory-${materialKey}-${rows.length}`,
        kind: 'item_change', target: productName, quantity: 1, operation: 'craft', owner: 'player',
        status: 'completed', confidence: 1, evidence: sentence.slice(0, 280),
        details: { category: 'accessory', wearable: true, pokemonAccessory: true, holdable: false, sourceMaterial: material.name },
      })
    }
    // equipTargetsProduct chỉ đánh dấu việc model đã nhận diện đeo; không tự
    // đoán Pokémon đích nếu văn không cho event target đủ rõ.
    void equipTargetsProduct
  }
  return rows
}

function focusKinds(focus) {
  const map = {
    economy: ['money_change', 'item_change', 'item_patch', 'equip', 'unequip', 'shop_enter', 'pokecenter_enter'],
    pokemon: ['pokemon_acquired', 'pokemon_removed', 'pokemon_level', 'pokemon_evolve', 'pokemon_friendship', 'pokemon_patch', 'hunger_change', 'ribbon_gain', 'mark_gain'],
    world: ['relationship_change', 'body_change', 'move', 'time_advance', 'time_of_day', 'training', 'npc_upsert', 'reputation_change', 'wanted_change'],
    progress: ['fact_upsert', 'badge_gain', 'quest_update', 'legendary_access', 'custom_state'],
  }
  return map[focus?.id] ?? null
}

export async function extractSemanticStateEvents(config, {
  storyText,
  userText = '',
  stateSnapshot = null,
  appliedState = null,
  mode = 'anime',
  scanMode = 'extractor',
  focus = null,
} = {}) {
  if (!config?.baseUrl || !config?.model) throw new Error('Semantic State Engine chưa có API/model.')
  const kinds = focusKinds(focus)
  const focusNote = kinds ? `\nPASS CHUYÊN MÔN: chỉ tìm ${kinds.join(', ')}. Không trả loại ngoài nhóm.` : ''
  const auditNote = scanMode === 'auditor'
    ? '\nĐây là AUDITOR pass: state đã áp là ledger. Chỉ bổ sung sự kiện còn thiếu; rà kỹ các chi tiết diễn đạt gián tiếp.'
    : '\nĐây là EXTRACTOR pass: ưu tiên bao phủ đầy đủ mọi thay đổi đã hoàn tất.'
  const messages = [
    { role: 'system', content: `${SEMANTIC_SYSTEM}${auditNote}${focusNote}` },
    { role: 'user', content: `CHẾ ĐỘ GAME: ${mode}\n\nSTATE HIỆN TẠI:\n${JSON.stringify(stateSnapshot ?? {}, null, 2)}\n\nLEDGER ĐÃ ÁP TRONG LƯỢT:\n${JSON.stringify(appliedState ?? {}, null, 2)}\n\nINPUT NGƯỜI CHƠI (chỉ để phân biệt ý định, KHÔNG dùng làm canon):\n${userText}\n\nCHÍNH VĂN CANON CẦN ĐỌC:\n${storyText}` },
  ]
  let raw = await chatCompletion(config, messages, { temperature: 0.12, maxTokens: 6000, debugLabel: `Semantic ${scanMode}${focus?.id ? ` · ${focus.id}` : ''}`, debugRole: scanMode })
  let parsedResponse = parseSemanticStateResponse(raw)
  let repairAttempted = false
  // Provider đôi khi bọc JSON sai, cắt schema hoặc trả lời bằng văn xuôi.
  // Chỉ khi KHÔNG cứu được event nào mới gọi một lượt sửa FORMAT rất ngắn;
  // event đã salvage được thì giữ nguyên để tránh tăng latency vô ích.
  if (parsedResponse.malformed && parsedResponse.events.length === 0 && String(raw ?? '').trim()) {
    repairAttempted = true
    try {
      const repairedRaw = await chatCompletion(config, [
        { role: 'system', content: 'Bạn là bộ sửa định dạng. Hãy chuyển nội dung dưới đây thành <STATE_EVENTS> với MỖI event là một JSON object độc lập trên một dòng. Giữ nguyên ý nghĩa, không thêm sự kiện mới. Nếu nội dung nói không có thay đổi thì trả {"events":[]} trong khối. Không giải thích.' },
        { role: 'user', content: String(raw) },
      ], { temperature: 0, maxTokens: 3500, debugLabel: 'Semantic · format repair', debugRole: 'repair' })
      const repaired = parseSemanticStateResponse(repairedRaw)
      if (repaired.events.length || !repaired.malformed) {
        raw = `${raw}

[FORMAT_REPAIR]
${repairedRaw}`
        parsedResponse = { ...repaired, repaired: true, originalMalformed: true }
      }
    } catch { /* pass khác/auditor vẫn có thể cứu; không làm hỏng lượt */ }
  }
  const accessoryEnrichedEvents = enrichCraftedPokemonAccessories(parsedResponse.events, storyText)
  const enrichedEvents = enrichNarrativePokemonAppearance(accessoryEnrichedEvents, storyText, stateSnapshot)
  const converted = semanticEventsToParsed(enrichedEvents)
  return {
    raw,
    ...parsedResponse,
    events: enrichedEvents,
    repairAttempted,
    ...converted,
    proposedCount: enrichedEvents.length,
    acceptedCount: converted.acceptedEvents.length,
    rejectedCount: converted.rejectedEvents.length,
  }
}
