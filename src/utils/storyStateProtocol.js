import { parseBadgeDirective, parseQuestDirective } from '../data/worldProgress.js'
import { normalizePokemonGender } from '../data/pokemonGender.js'

// ============ GIAO THỨC TRẠNG THÁI TRONG CHÍNH VĂN (đợt 24) ============
// Cùng triết lý với [[BATTLE]] và [[DMG]]: AI kể chuyện bằng lời, còn các
// thay đổi TRẠNG THÁI GAME (tiền, hảo cảm NPC, thương tích cơ thể, vào cửa
// hàng) được khai báo qua tag máy-đọc-được ở CUỐI tin nhắn. App parse tag,
// áp vào state thật (HUD cập nhật ngay), rồi ẨN tag khỏi văn bản hiển thị.
//
// Cú pháp (mỗi tag 1 dòng riêng, đặt ở cuối tin, có thể nhiều tag):
//   [[MONEY +500]]            — nhận/mất tiền (số âm là mất)
//   [[REL Misty=+10]]         — hảo cảm NPC thay đổi (upsert theo tên)
//   [[REL Misty=-15 | cãi nhau ở gym]]   — kèm ghi chú mới (tuỳ chọn)
//   [[BODY leftArm=+25]]      — bộ phận bị thương thêm (+) hoặc hồi phục (-)
//       bộ phận hợp lệ: head, torso, leftArm, rightArm, leftLeg, rightLeg
//   [[SHOP Tiệm PokéMart Cerulean]]      — người chơi ĐÃ bước vào bên trong
//       cửa hàng và có thể mua sắm → app hiện nút mở giao diện giỏ hàng.
//   [[EVOLVE Froakie | Frogadier]]       — cùng cá thể tiến hoá, không sinh con mới.
//   [[FRIEND Froakie | +5 | tin tưởng hơn]] — độ thân mật cá thể 0-255.

export const BODY_PART_KEYS = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']

export const STORY_STATE_INSTRUCTION = `ĐỒNG BỘ TRẠNG THÁI — SEMANTIC ENGINE:
- Hãy viết chính văn tự nhiên, rõ ràng về những gì THỰC SỰ đã xảy ra: ai nhận/mất gì, đã trả hay nhận tiền, Pokémon nào thay đổi, đang ở đâu, nhiệm vụ/NPC nào thay đổi.
- KHÔNG cần và KHÔNG nên tự chèn các tag [[MONEY]], [[ITEM]], [[POKEMON]], [[REL]]... vào lời kể. App có Semantic State Engine đọc chính văn sau khi hiển thị và tự cập nhật state.
- Vật phẩm, vé, thiết bị, danh hiệu, tài sản, NPC hay khái niệm do người chơi tự sáng tạo vẫn được coi là hợp lệ khi chính văn đã xác lập; đừng đổi tên chúng sang món gần giống trong database.
- Phân biệt việc đã hoàn tất với dự định/giá niêm yết/lời hứa. Nếu một giao dịch hoàn tất, hãy viết đủ rõ tổng tiền hoặc số dư; nếu nhận vật phẩm, hãy nói rõ tên và số lượng khi biết.
- Tag legacy nếu preset cũ tự sinh vẫn được app đọc để tương thích, nhưng bạn không phải tạo chúng.
- Marker tương tác riêng như [[BATTLE]] vẫn phải tuân theo hướng dẫn trận đấu.`

// Đợt 47: BỎ neo dòng (^…$) — thực chiến cho thấy model (nhất là khi CoT
// leak) hay nhét tag NẰM GIỮA câu văn ("…, [[MONEY -1000]], [[SHOP …]] .")
// → neo dòng làm tag câm hoàn toàn: tiền không trừ, fact không vào sổ tay,
// tag lộ nguyên văn ra màn hình. Tag có cặp [[..]] bao nên match giữa dòng
// vẫn an toàn, không đụng chính văn thường.
const MONEY_RE = /\[\[\s*MONEY\s*([+-]?\d+)\s*\]\]/gi
const POKEMON_RE = /\[\[\s*POKEMON\s+([^\]|]+?)\s*\|\s*Lv\.?\s*(\d+)\s*(?:\|\s*(?:giới\s*tính|gioi\s*tinh|gender)\s*=\s*([^\]|]+?))?\s*\]\]/gi
// Đợt 76: tiến hoá phải thay đúng cá thể, không được sinh thêm Pokémon cấp 2.
const EVOLVE_RE = /\[\[\s*(?:EVOLVE|EVOLUTION|TIẾN\s*(?:H[ÓO]A|HO[ÁA])|TIEN\s*HOA)\s+([^\]|]+?)\s*\|\s*([^\]]+?)\s*\]\]/gi
// Đợt 73: thay đổi cấp của Pokémon ĐANG SỞ HỮU. Trước đây model buộc phải
// lạm dụng [[POKEMON Froakie | Lv11]], app hiểu là nhận con mới rồi bỏ qua vì
// trùng loài — lời kể lên cấp nhưng biến đứng yên.
const LEVEL_RE = /\[\[\s*(?:LEVEL|LV|CẤP|CAP)\s+([^\]|]+?)\s*\|\s*(?:Lv\.?\s*)?([+-]?\d+)\s*\]\]/gi
const EQUIP_RE = /\[\[\s*(?:EQUIP|HOLD|TRANG\s*BỊ|TRANG\s*BI)\s+([^\]|]+?)\s*\|\s*([^\]]+?)\s*\]\]/gi
const UNEQUIP_RE = /\[\[\s*(?:UNEQUIP|UNHOLD|THÁO\s*TRANG\s*BỊ|THAO\s*TRANG\s*BI)\s+([^\]]+?)\s*\]\]/gi
const FRIEND_RE = /\[\[\s*(?:FRIEND|FRIENDSHIP|BOND|THÂN\s*MẬT|THAN\s*MAT)\s+([^\]|]+?)\s*\|\s*([+-]?\d+)\s*(?:\|\s*([^\]]*?))?\s*\]\]/gi
const DATE_ADV_RE = /\[\[\s*DATE\s*\+\s*(\d+)\s*\]\]/gi
// Đợt 67: buổi luyện tập có chủ đích → EXP cho Pokémon. cường độ 1-3.
const TRAIN_RE = /\[\[\s*TRAIN(?:\s+([^\]]*))?\s*\]\]/gi
const DATE_PART_RE = /\[\[\s*DATE\s+buổi\s*=\s*(sáng|trưa|chiều|tối|đêm)\s*\]\]/gi
const MOVE_RE = /\[\[\s*MOVE\s+([^\]]+?)\s*\]\]/gi
const HUNGER_RE = /\[\[\s*HUNGER\s+(người|nguoi|player|pokemon|pokémon)\s*([+-]\d+)\s*\]\]/gi
const NPC_RE = /\[\[\s*NPC\s+([^\]|]+?)\s*(?:\|\s*([^\]]*?)\s*)?\]\]/gi
const FACT_RE = /\[\[\s*FACT\s+([^\]|]+?)\s*\|\s*([^\]]+?)\s*\]\]/gi
const REL_RE = /\[\[\s*REL\s+([^=\]|]+?)\s*=\s*([+-]?\d+)\s*(?:\|\s*([^\]]*?)\s*)?\]\]/gi
const BODY_RE = /\[\[\s*BODY\s+(head|torso|leftArm|rightArm|leftLeg|rightLeg)\s*=\s*([+-]?\d+)\s*\]\]/gi
const SHOP_RE = /\[\[\s*SHOP\s+([^\]|]+?)(?:\s*\|\s*([^\]]*?))?\s*\]\]/gi
const LOOT_RE = /\[\[\s*LOOT\s+([^\]]+?)\s*\]\]/gi
// Đợt 71: nhân vật ĐANG Ở TRONG Trung tâm Pokémon → hiện nút Chữa trị + Máy PC.
// Tên sau tag là tuỳ chọn ([[POKECENTER]] hoặc [[POKECENTER Trung tâm Viridian]]).
// Đợt 72: AI TRAO / LẤY ĐI VẬT PHẨM. Đây là mắt xích còn thiếu khiến năng
// lực người chơi TỰ VIẾT không bao giờ thành hiện thực: tester viết "Rare
// Candy vô hạn" ở ô tùy chỉnh, AI kể "cho ăn kẹo, lên Lv11" nhưng biến không
// đổi — vì AI không hề có cách nào bỏ đồ vào túi. Nay có.
const ITEM_RE = /\[\[\s*ITEM\s+([^\]|]+?)(?:\s*\|\s*([+-]?\d+))?\s*\]\]/gi
const POKECENTER_RE = /\[\[\s*POKECENTER(?:\s+([^\]]+?))?\s*\]\]/gi
const BADGE_RE = /\[\[\s*BADGE\s+([^\]|]+?)(?:\s*\|\s*([^\]]*?))?\s*\]\]/gi
const QUEST_RE = /\[\[\s*QUEST\s+([^\]|]+?)(?:\s*\|\s*([^\]]*?))?\s*\]\]/gi
const REP_RE = /\[\[\s*REP\s+([^=\]|]+?)\s*=\s*([+-]?\d+)\s*(?:\|\s*([^\]]*?))?\s*\]\]/gi
const WANTED_RE = /\[\[\s*WANTED\s+([+-]?\d+)\s*(?:\|\s*([^\]]*?))?\s*\]\]/gi
const RIBBON_RE = /\[\[\s*RIBBON\s+([^\]|]+?)\s*\|\s*([^\]]+?)\s*\]\]/gi
const MARK_RE = /\[\[\s*MARK\s+([^\]|]+?)\s*\|\s*([^\]]+?)\s*\]\]/gi
const LEGENDARY_ACCESS_RE = /\[\[\s*LEGENDARY_ACCESS\s+([^\]|]+?)(?:\s*\|\s*reason\s*=\s*([^\]]+?))?\s*\]\]/gi

/**
 * Parse mọi tag trạng thái trong text. Trả về:
 * { money: tổng delta, rel: [{name, delta, note}], body: [{part, delta}],
 *   shops: [tên...], cleaned: text đã gỡ sạch tag }
 * Mỗi loại tag có regex riêng nên [[BATTLE]] và [[DMG]] không bị đụng tới.
 * Regex không neo dòng: model thực tế thường nhét tag giữa câu.
 */
export function parseStoryStateTags(text) {
  if (!text) return { money: 0, moneyEntries: [], rel: [], body: [], shops: [], loots: [], npcs: [], facts: [], pokemons: [], levels: [], evolutions: [], friendships: [], equipment: [], hunger: [], moves: [], moveDirectives: [], items: [], badges: [], quests: [], reputations: [], wanted: [], legendaryAccess: [], collectionAwards: [], dateAdvance: 0, training: 0, datePart: null, pokecenter: null, cleaned: text ?? '' }
  let money = 0
  const moneyEntries = []
  const rel = []
  const body = []
  const shops = []
  const loots = []
  const npcs = []
  const facts = []
  const pokemons = []
  const levels = []
  const evolutions = []
  const friendships = []
  const hunger = []
  const moves = []
  const moveDirectives = []
  let dateAdvance = 0
  let training = 0
  let datePart = null
  let pokecenter = null
  const items = []
  const badges = []
  const quests = []
  const reputations = []
  const wanted = []
  const legendaryAccess = []
  const collectionAwards = []

  for (const m of text.matchAll(MONEY_RE)) {
    const value = parseInt(m[1], 10)
    if (Number.isFinite(value) && value !== 0) {
      moneyEntries.push(value)
      money += value
    }
  }
  for (const m of text.matchAll(REL_RE)) {
    rel.push({ name: m[1].trim(), delta: parseInt(m[2], 10), note: (m[3] ?? '').trim() || null })
  }
  for (const m of text.matchAll(BODY_RE)) body.push({ part: m[1], delta: parseInt(m[2], 10) })
  // [[SHOP Tên | loại=... | quy mô=...]] (đợt 37) — shops giờ là OBJECT
  // {name, type, size}; code cũ nào còn đọc dạng string đã được cập nhật.
  for (const m of text.matchAll(SHOP_RE)) {
    const shop = { name: m[1].trim(), type: '', size: '' }
    if (m[2]) {
      for (const seg of m[2].split('|')) {
        const part = seg.trim()
        const eq = part.indexOf('=')
        if (eq > 0) {
          const k = part.slice(0, eq).trim().toLowerCase()
          const v = part.slice(eq + 1).trim()
          if (k.startsWith('loại') || k.startsWith('loai') || k === 'type') shop.type = v
          else if (k.startsWith('quy') || k === 'size') shop.size = v
        }
      }
    }
    shops.push(shop)
  }
  for (const m of text.matchAll(LOOT_RE)) {
    const loot = { type: 'tổng hợp', size: 'vừa' }
    for (const segment of String(m[1] ?? '').split('|')) {
      const part = segment.trim()
      const at = part.indexOf('=')
      if (at < 0) {
        if (part) loot.type = part
        continue
      }
      const key = part.slice(0, at).trim().toLowerCase()
      const value = part.slice(at + 1).trim()
      if (!value) continue
      if (key === 'type' || key.startsWith('loại') || key.startsWith('loai')) loot.type = value
      else if (key === 'size' || key.startsWith('quy')) loot.size = value
    }
    loots.push(loot)
  }
  // [[NPC Tên | key=value | key=value ...]] — phần sau tên là danh sách
  // trường key=value phân tách bởi |; đoạn không có dấu = thì gộp vào ghi chú.
  for (const m of text.matchAll(NPC_RE)) {
    const name = m[1].trim()
    const fields = {}
    if (m[2]) {
      for (const seg of m[2].split('|')) {
        const part = seg.trim()
        if (!part) continue
        const eq = part.indexOf('=')
        if (eq > 0) {
          const k = part.slice(0, eq).trim()
          const v = part.slice(eq + 1).trim()
          if (k && v) fields[k] = v
        } else {
          fields['ghi chú'] = fields['ghi chú'] ? `${fields['ghi chú']}; ${part}` : part
        }
      }
    }
    if (name) npcs.push({ name, fields })
  }
  for (const m of text.matchAll(FACT_RE)) {
    facts.push({ key: m[1].trim(), text: m[2].trim() })
  }
  // [[POKEMON Loài | Lv7]] — người chơi nhận Pokémon mới trong truyện (đợt 32).
  for (const m of text.matchAll(POKEMON_RE)) {
    const pokemon = {
      species: m[1].trim(),
      level: Math.max(1, Math.min(100, parseInt(m[2], 10))),
    }
    const gender = normalizePokemonGender(m[3])
    if (gender) pokemon.gender = gender
    pokemons.push(pokemon)
  }
  for (const m of text.matchAll(EVOLVE_RE)) {
    const from = m[1].trim()
    const to = m[2].trim()
    if (from && to) evolutions.push({ from, to })
  }
  for (const m of text.matchAll(LEVEL_RE)) {
    const raw = m[2].trim()
    const value = parseInt(raw, 10)
    if (Number.isFinite(value) && value !== 0) {
      levels.push({
        target: m[1].trim(),
        mode: /^[+-]/.test(raw) ? 'delta' : 'absolute',
        value: /^[+-]/.test(raw) ? value : Math.max(1, Math.min(100, value)),
      })
    }
  }
  for (const m of text.matchAll(FRIEND_RE)) {
    const delta = parseInt(m[2], 10)
    if (Number.isFinite(delta) && delta !== 0) friendships.push({
      target: m[1].trim(), delta, note: (m[3] ?? '').trim() || null,
    })
  }
  const equipment = []
  for (const m of text.matchAll(EQUIP_RE)) {
    const target = m[1].trim()
    const item = m[2].trim()
    if (target && item) equipment.push({ target, item, mode: 'equip' })
  }
  for (const m of text.matchAll(UNEQUIP_RE)) {
    const target = m[1].trim()
    if (target) equipment.push({ target, item: null, mode: 'unequip' })
  }
  for (const m of text.matchAll(DATE_ADV_RE)) dateAdvance += parseInt(m[1], 10)
  for (const m of text.matchAll(TRAIN_RE)) {
    const n = parseInt((m[1] ?? '').trim(), 10)
    training += Number.isFinite(n) ? Math.max(1, n) : 1
  }
  for (const m of text.matchAll(DATE_PART_RE)) datePart = m[1]
  for (const m of text.matchAll(ITEM_RE)) {
    const qty = m[2] ? Number(m[2]) : 1
    if (Number.isFinite(qty) && qty !== 0) items.push({ name: m[1].trim(), qty })
  }
  for (const m of text.matchAll(POKECENTER_RE)) pokecenter = { name: (m[1] ?? '').trim() || 'Trung tâm Pokémon' }
  // [[MOVE Nơi | x=.. | y=..]] (đợt 75): vẫn giữ `moves` dạng chuỗi cho
  // code cũ, đồng thời trả `moveDirectives` có toạ độ cho luồng mới.
  for (const m of text.matchAll(MOVE_RE)) {
    const segments = m[1].split('|').map((part) => part.trim()).filter(Boolean)
    const place = segments.shift() ?? ''
    let x = null
    let y = null
    for (const segment of segments) {
      const hit = segment.match(/^([xy])\s*=\s*(-?\d+(?:\.\d+)?)$/i)
      if (!hit) continue
      const value = Math.max(0, Math.min(100, Number(hit[2])))
      if (hit[1].toLowerCase() === 'x') x = value
      else y = value
    }
    if (place) {
      moves.push(place)
      moveDirectives.push({ place, x, y })
    }
  }
  for (const m of text.matchAll(HUNGER_RE)) {
    const who = /^p(okemon|okémon)$/i.test(m[1]) || m[1].toLowerCase().startsWith('pok') ? 'mon' : 'player'
    hunger.push({ who, delta: parseInt(m[2], 10) })
  }
  for (const m of text.matchAll(BADGE_RE)) badges.push(parseBadgeDirective(m[1], m[2]))
  for (const m of text.matchAll(QUEST_RE)) quests.push(parseQuestDirective(m[1], m[2]))
  for (const m of text.matchAll(REP_RE)) reputations.push({ name: m[1].trim(), delta: parseInt(m[2], 10), note: (m[3] ?? '').trim() })
  for (const m of text.matchAll(WANTED_RE)) {
    const fields = {}
    for (const segment of String(m[2] ?? '').split('|')) {
      const at = segment.indexOf('=')
      if (at > 0) fields[segment.slice(0, at).trim().toLowerCase()] = segment.slice(at + 1).trim()
    }
    wanted.push({ delta: parseInt(m[1], 10), region: fields.region ?? '', reason: fields.reason ?? '', bounty: parseInt(fields.bounty ?? '0', 10) || 0 })
  }
  for (const m of text.matchAll(RIBBON_RE)) collectionAwards.push({ kind: 'ribbon', target: m[1].trim(), name: m[2].trim() })
  for (const m of text.matchAll(MARK_RE)) collectionAwards.push({ kind: 'mark', target: m[1].trim(), name: m[2].trim() })
  for (const m of text.matchAll(LEGENDARY_ACCESS_RE)) legendaryAccess.push({ species: m[1].trim(), reason: (m[2] ?? '').trim() })

  const cleaned = text
    .replace(MONEY_RE, '')
    .replace(REL_RE, '')
    .replace(BODY_RE, '')
    .replace(SHOP_RE, '')
    .replace(LOOT_RE, '')
    .replace(POKECENTER_RE, '')
    .replace(ITEM_RE, '')
    .replace(NPC_RE, '')
    .replace(FACT_RE, '')
    .replace(POKEMON_RE, '')
    .replace(EVOLVE_RE, '')
    .replace(LEVEL_RE, '')
    .replace(FRIEND_RE, '')
    .replace(EQUIP_RE, '')
    .replace(UNEQUIP_RE, '')
    .replace(DATE_ADV_RE, '')
    .replace(TRAIN_RE, '')
    .replace(DATE_PART_RE, '')
    .replace(MOVE_RE, '')
    .replace(HUNGER_RE, '')
    .replace(BADGE_RE, '')
    .replace(QUEST_RE, '')
    .replace(REP_RE, '')
    .replace(WANTED_RE, '')
    .replace(RIBBON_RE, '')
    .replace(MARK_RE, '')
    .replace(LEGENDARY_ACCESS_RE, '')
    // Tag nằm giữa câu bị gỡ để lại vụn: ", ," / "( )" / 2 dấu cách — dọn nhẹ.
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;])\s*(?=[,;])/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]*[,.;]+[ \t]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { money, moneyEntries, rel, body, shops, loots, npcs, facts, pokemons, levels, evolutions, friendships, equipment, hunger, moves, moveDirectives, items, badges, quests, reputations, wanted, legendaryAccess, collectionAwards, dateAdvance,
    training, datePart, pokecenter, cleaned }
}

/**
 * Áp kết quả parse vào state game. Nhận state hiện tại + setters từ context.
 * Mọi giá trị đều được kẹp trong khoảng hợp lệ (tiền >= 0, hảo cảm -100..100,
 * thương tích 0..100) — AI có bịa số to cũng không phá được state.
 */
// LƯU Ý (đợt 45): dùng FUNCTIONAL UPDATER cho cả 3 setter — trước đây hàm
// này đọc state từ closure (playerProfile/relationships/bodyStatus) nên:
// (a) gọi từ callback nền của API cập nhật biến mà QUÊN truyền state hiện
//     tại → crash "undefined.money" (bị .catch nuốt → tiền/quan hệ bổ sung
//     rớt trong im lặng), và
// (b) closure cũ đè lên thay đổi mới khi 2 luồng (chính + API phụ) áp gần
//     nhau. Functional updater đọc state MỚI NHẤT nên hết cả 2 lỗi; các
//     tham số state cũ vẫn nhận vào cho tương thích chỗ gọi cũ nhưng không
//     dùng nữa. setRelationships/setBodyStatus trong GameContext đã được
//     nâng lên nhận functional updater (đợt 45).
export function applyStoryState(parsed, { setPlayerProfile, setRelationships, setBodyStatus }) {
  if (parsed.money !== 0) {
    setPlayerProfile((cur) => {
      const current = Number(cur?.money)
      const safeCurrent = Number.isFinite(current) ? current : 0
      return { ...(cur ?? {}), money: Math.max(0, safeCurrent + Number(parsed.money || 0)) }
    })
  }
  if (parsed.rel.length > 0) {
    setRelationships((cur) => {
      const next = [...(cur ?? [])]
      for (const r of parsed.rel) {
        const delta = Number(r.delta) || 0
        const idx = next.findIndex((x) => x.name.toLowerCase() === r.name.toLowerCase())
        if (idx >= 0) {
          next[idx] = {
            ...next[idx],
            affinity: Math.max(-100, Math.min(100, (Number(next[idx].affinity) || 0) + delta)),
            note: r.note ?? next[idx].note,
          }
        } else {
          next.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: r.name,
            affinity: Math.max(-100, Math.min(100, delta)),
            note: r.note ?? '',
          })
        }
      }
      return next
    })
  }
  if (parsed.body.length > 0) {
    setBodyStatus((cur) => {
      const next = { ...(cur ?? {}) }
      for (const b of parsed.body) {
        next[b.part] = Math.max(0, Math.min(100, (next[b.part] ?? 0) + b.delta))
      }
      return next
    })
  }
}
