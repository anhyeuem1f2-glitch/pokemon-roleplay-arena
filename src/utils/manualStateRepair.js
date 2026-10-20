// Dot152: Strict, evidence-backed manual corrections. This module never trusts
// a player's description as proof, and never permits species/UID/form changes.
import { validateCorrectionProposal, normalizedQuote } from './stateCorrection.js'
import { resolveItemByName } from '../data/shopItems.js'

const normalize = (value) => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[\s·・.()（）'’"“”\-—_:：]+/gu, '')
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const COMPLETED_GAIN = /(?:\b(?:received|obtained|picked\s*up|found|bought|purchased|earned|was\s+given|took)\b|(?:đã\s*)?(?:nhận\s*được|nhặt\s*được|mua\s*được|được\s*(?:tặng|trao)|lấy\s*được)|(?:获得|得到|领取|收下|买到|购买了|捡到|拾得|交给了你|送给了你|给了你|交给了玩家|赠送给玩家))/iu
const COMPLETED_SPEND = /(?:\b(?:used|consumed|spent|gave\s+away|handed\s+over|lost)\b|(?:đã\s*)?(?:sử\s*dụng|tiêu\s*thụ|đã\s*đưa|đưa\s*đi|mất|dùng\s*hết)|(?:使用了|消耗了|用掉了|交出了|交给了|失去了|花掉了))/iu
const PENDING = /(?:\b(?:will|would|might|may|planning\s+to|want\s+to|intends?\s+to|did\s+not|has\s+not|never)\b|(?:sẽ|định|dự\s*định|chưa|không\s*(?:nhận|mua|dùng|tiêu)|nếu)|(?:准备|打算|想要|将会|尚未|还没|没有|并未|如果|可能|要是))/iu
const PLAYER_ACTOR = /(?:\b(?:you|your|player|trainer|i\s+(?:received|got|bought|used)|my\s+bag)\b|(?:người\s*chơi|nhân\s*vật\s*chính|bạn|cậu|tôi|mình|túi\s*(?:đồ\s*)?của\s*(?:bạn|cậu|tôi))|(?:玩家|主角|你|你的|我|我的|背包))/iu
const BALANCE = /(?:\b(?:balance|wallet\s+balance|remaining\s+(?:money|cash)|currently\s+have)\b|(?:số\s*dư|trong\s*ví|còn\s+lại|tiền\s*hiện\s*có|tổng\s*tiền)|(?:余额|结余|剩余(?:金额|现金|的钱)|现有(?:钱|资金)|钱包(?:余额|里)))/iu
const CHINESE_NUMBERS = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }

function findCanonProof(quoteText, sourceMessageId, canonMessages) {
  const quote = normalizedQuote(quoteText)
  if (quote.length < 8 || quote.length > 400) return { error: 'Cần trích nguyên văn 8–400 ký tự từ chính văn.' }
  const source = (canonMessages ?? []).find((message) => message?.id === sourceMessageId && message.role === 'assistant' && !message.hidden)
  if (!source) return { error: 'Không tìm thấy lượt chính văn gốc.' }
  if (!normalizedQuote(source.meta?.evidenceText || source.content).includes(quote)) return { error: 'Trích dẫn không khớp chính văn đã lưu.' }
  if (PENDING.test(quote)) return { error: 'Đoạn dẫn chứng chứa điều kiện, dự định hoặc phủ định; không thể khẳng định đã hoàn tất.' }
  return { source, quote }
}

function proofMentionsName(quote, name) {
  if (!String(name ?? '').trim()) return false
  const raw = String(name).trim()
  const q = normalize(quote), n = normalize(raw)
  if (!n || !q.includes(n)) return false
  // English names must match token boundaries: "Potion" cannot authorize "Super Potion".
  if (/^[\p{Script=Latin}\s.'’-]+$/u.test(raw)) {
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(raw).replace(/\\ /g, '\\s+')}($|[^\\p{L}\\p{N}])`, 'iu').test(quote)
  }
  return true
}

function proofEstablishesPlayerPokemon(quote, names = [], playerName = '') {
  for (const name of names) {
    if (!name || !proofMentionsName(quote, name)) continue
    const n = escapeRegExp(String(name).trim())
    const owner = '(?:you|your|player|trainer|\\bmy\\b|bạn|cậu|tôi|mình|người chơi|của bạn|của cậu|你的|我的|玩家的|主角的)'
    const player = playerName ? escapeRegExp(playerName) : null
    const who = player ? `(?:${owner}|${player})` : owner
    if (new RegExp(`${who}[^.!?。！？]{0,20}${n}|${n}[^.!?。！？]{0,20}(?:của bạn|của cậu|của tôi|của mình|belongs to you|your Pokémon|归你|属于你)`, 'iu').test(quote)) return true
  }
  return false
}

function explicitCountNearName(quote, name) {
  const at = String(quote).toLocaleLowerCase().indexOf(String(name).toLocaleLowerCase())
  if (at < 0) return null
  const before = quote.slice(Math.max(0, at - 16), at)
  const after = quote.slice(at + name.length, at + name.length + 18)
  const prior = before.match(/(?:\b|^)(\d{1,3})\s*(?:个|颗|枚|份|瓶|个|quả|viên|cái|chiếc|x|×)?\s*$/iu)
  const post = after.match(/^\s*(?:[x×*:]\s*|có\s+)?(\d{1,3})(?!\d)/iu)
  const chinese = before.match(/([一二两三四五六七八九十])\s*(?:个|颗|枚|份|瓶|只|颗)?\s*$/u)
  const count = prior ? +prior[1] : post ? +post[1] : chinese ? CHINESE_NUMBERS[chinese[1]] : null
  return count && count >= 1 && count <= 99 ? count : null
}

function matchesMoney(quote, target) {
  // A balance must be clearly stated in the same sentence as the number.
  const match = [...quote.matchAll(/(?:[₽¥$]\s*)?([\d][\d.,\s]{0,14})\s*(?:₽|円|元|đồng|poke\s*dollars?)?/giu)]
  return match.some((m) => {
    const raw = m[1].replace(/[^\d]/g, '')
    return raw && Number(raw) === target && BALANCE.test(quote.slice(Math.max(0, m.index - 35), m.index + m[0].length + 15))
  })
}

// Actor must own the completed transaction, not merely appear somewhere in
// the same paragraph ("Brock received balls. You watched." is NOT a gain).
function provenPlayerItemAction(quote, name, positive) {
  const action = positive ? COMPLETED_GAIN : COMPLETED_SPEND
  const pieces = quote.split(/[.!?。！？；;\n]+/u)
  return pieces.some((piece) => {
    if (!proofMentionsName(piece, name) || !action.test(piece)) return false
    if (/(?:bạn\s+(?:ấy|của\s+(?:bạn|cậu|tôi|mình))|(?:你的|我)朋友|your\s+friend)[^.!?。！？]{0,30}(?:nhận|mua|sử dụng|received|bought|used|获得|得到|购买|使用)/iu.test(piece)) return false
    const patterns = [
      /(?:\b(?:you|player|trainer|i)\b|bạn|cậu|người chơi|nhân vật chính|\btôi\b|\bmình\b|你|玩家|主角|我)[^.!?。！？]{0,35}(?:nhận|nhặt|mua|sử dụng|dùng|tiêu|received|obtained|picked|bought|used|spent|获得|得到|领取|购买|使用|消耗|捡到)/iu,
      /(?:được trao|được tặng|交给了你|送给了你|给了你|交给了玩家|赠送给玩家|was given to you|given to the player)/iu,
      /(?:trong|vào)\s+túi\s+(?:của\s+)?(?:bạn|cậu|tôi|mình)/iu,
      /(?:your bag|your inventory|你的背包|我的背包)/iu,
    ]
    return patterns.some((re) => re.test(piece))
  })
}

function provenPlayerBalance(quote, amount) {
  return matchesMoney(quote, amount) && /(?:số\s*dư\s*(?:trong\s*)?(?:ví|của\s*)(?:bạn|cậu|tôi|mình)|(?:trong\s*)?ví\s*(?:của\s*)?(?:bạn|cậu|tôi|mình)|(?:bạn|cậu|tôi|mình)\s*(?:còn|có)\s*(?:lại)?|your\s+(?:wallet|balance)|you\s+(?:have|had)\s*|(?:你的|我的|玩家的)(?:钱包|余额|账户)|(?:你|我)\s*(?:还剩|剩下|现有))/iu.test(quote)
}

function alreadyApplied(source, kind, target, delta) {
  const applied = source.meta?.appliedState || {}
  if (kind === 'item_delta') {
    const sameItem = (a, b) => (resolveItemByName(a)?.id && resolveItemByName(a)?.id === resolveItemByName(b)?.id) || normalize(a) === normalize(b)
    return (applied.items || []).some((i) => sameItem(i.name, target) && Math.sign(Number(i.qty)) === Math.sign(delta))
  }
  if (kind === 'money_balance') return Boolean(Number(applied.money))
  return false
}

export function validateManualStateRepair(input, { canonMessages = [], roster = [], inventory = [], money = 0, history = [], aliases = [], speciesEntry, playerName = '' } = {}) {
  const { kind, sourceMessageId, evidenceQuote } = input || {}
  const proof = findCanonProof(evidenceQuote, sourceMessageId, canonMessages)
  if (proof.error) return { ok: false, error: proof.error }
  const { source, quote } = proof
  if ((history ?? []).some((item) => item?.kind === kind && item?.sourceMessageId === source.id && item?.evidenceQuote === quote)) {
    return { ok: false, error: 'Đoạn chính văn này đã được dùng để hiệu chỉnh; không cộng lặp.' }
  }
  if (kind === 'pokemon_attribute') {
    if (!PLAYER_ACTOR.test(quote)) return { ok: false, error: 'Cần dẫn chứng xác định đây là Pokémon của người chơi, không phải NPC.' }
    const mon = roster.find((m) => m.uid === input.targetUid)
    if (!mon) return { ok: false, error: 'Không tìm thấy Pokémon hiện có trong đội hoặc PC.' }
    if (!proofEstablishesPlayerPokemon(quote, [mon.species, mon.name, mon.nickname, ...aliases], playerName)) return { ok: false, error: 'Không có bằng chứng nêu rõ đây là Pokémon của người chơi.' }
    const similar = roster.filter((m) => normalize(m.species || m.name) === normalize(mon.species || mon.name))
    if (similar.length > 1 && !mon.nickname) return { ok: false, error: 'Có nhiều Pokémon cùng loài chưa có biệt danh; không thể gắn dẫn chứng cho một cá thể duy nhất.' }
    if (similar.length > 1 && !quote.includes(mon.nickname)) return { ok: false, error: 'Phải nêu đúng biệt danh để phân biệt các cá thể cùng loài.' }
    const result = validateCorrectionProposal({ targetUid: mon.uid, field: input.field, value: input.value, evidenceQuote: quote }, { mon, speciesEntry, canonMessages: [source], aliases })
    return result.ok ? { ok: true, patch: { ...result.patch, kind, sourceMessageId: source.id } } : result
  }
  if (kind === 'item_delta') {
    const name = String(input.itemName || '').trim()
    const delta = Number(input.delta)
    if (!name || name.length > 90 || !Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 99) return { ok: false, error: 'Tên vật phẩm hoặc số lượng không hợp lệ (tối đa 99).' }
    if (!proofMentionsName(quote, name)) return { ok: false, error: 'Không tìm thấy đúng tên vật phẩm trong đoạn chính văn.' }
    if (!provenPlayerItemAction(quote, name, delta > 0)) return { ok: false, error: 'Chưa có bằng chứng người chơi thực sự nhận/tiêu vật phẩm (có thể NPC là người nhận).' }
    if (!(delta > 0 ? COMPLETED_GAIN : COMPLETED_SPEND).test(quote)) return { ok: false, error: 'Chưa có hành động nhận/tiêu thụ hoàn tất phù hợp với dấu +/−.' }
    const count = explicitCountNearName(quote, name)
    if (count !== Math.abs(delta)) return { ok: false, error: 'Số lượng phải được ghi rõ cạnh tên vật phẩm trong chính văn.' }
    if (alreadyApplied(source, kind, name, delta)) return { ok: false, error: 'Lượt này đã có event nhận/tiêu cùng vật phẩm trong ledger.' }
    const mapped = resolveItemByName(name)
    const owned = inventory.find((i) => (mapped && i.id === mapped.id) || normalize(i.name) === normalize(name) || normalize(i.id) === normalize(name))
    if (owned?.infinite) return { ok: false, error: 'Không được sửa vật phẩm vô hạn.' }
    const have = Math.max(0, Number(owned?.qty) || 0)
    if (delta < 0 && have < -delta) return { ok: false, error: 'Không đủ vật phẩm hiện có để trừ. Hãy đồng bộ lượt nhận trước.' }
    return { ok: true, patch: { kind, itemName: name, delta, before: have, value: have + delta, evidenceQuote: quote, sourceMessageId: source.id } }
  }
  if (kind === 'canon_fact') {
    const key = String(input.factKey ?? '').trim()
    const value = String(input.factValue ?? '').trim()
    if (!key || key.length > 80 || value.length < 2 || value.length > 240) return { ok: false, error: 'Tên và nội dung biến truyện không hợp lệ.' }
    if (/(pok[eé]mon|宝可梦|精灵|species|uid|level|等级|money|余额|wallet|inventory|túi|tiền|iv|ev|shiny|giới tính|gender|đội hình|party|master\s*ball)/iu.test(key)) return { ok: false, error: 'Biến này thuộc core gameplay, không cho dùng fact để vượt qua xác minh Pokémon/tài sản.' }
    if (!quote.includes(key) || !quote.includes(value)) return { ok: false, error: 'Cả tên biến và giá trị phải có nguyên văn trong đoạn dẫn chứng.' }
    const stateKey = `story:${key.toLocaleLowerCase()}`
    const previous = input.previous
    if (previous === value) return { ok: false, error: 'Fact đã trùng với trạng thái lưu.' }
    return { ok: true, patch: { kind, factKey:key, before:previous ?? null, value, evidenceQuote:quote, sourceMessageId:source.id, stateKey } }
  }
  if (kind === 'money_balance') {
    const amount = Number(input.value)
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000_000) return { ok: false, error: 'Số dư không hợp lệ.' }
    if (!provenPlayerBalance(quote, amount)) return { ok: false, error: 'Không tìm thấy số dư CHÍNH người chơi được xác nhận trong chính văn.' }
    if (alreadyApplied(source, kind, null, null)) return { ok: false, error: 'Lượt này đã có một giao dịch tiền trong ledger; cần kiểm tra trước để tránh ghi đè sai.' }
    if (amount === Number(money)) return { ok: false, error: 'Số dư hiện tại đã đúng.' }
    return { ok: true, patch: { kind, before: Number(money) || 0, value: amount, evidenceQuote: quote, sourceMessageId: source.id } }
  }
  return { ok: false, error: 'Loại sửa không được hỗ trợ; không cho phép đổi loài/UID Pokémon hoặc chỉnh IV/EV/level tùy ý.' }
}

export function repairEvidenceMessages(messages, limit = 80) {
  return (messages ?? []).filter((m) => m?.role === 'assistant' && !m.hidden && m.id && String(m.meta?.evidenceText || m.content || '').trim()).slice(-limit)
}
