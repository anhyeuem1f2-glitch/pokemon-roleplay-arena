// ============ ĐỐI CHIẾU TAG VỚI CHÍNH VĂN (đợt 77) ============
// Tag chỉ là dữ liệu máy đọc, KHÔNG phải bằng chứng. Mọi thay đổi save phải
// được một câu người chơi thực sự nhìn thấy xác nhận là đã xảy ra.

function fold(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/đ/g, 'd')
    .replace(/[^a-z0-9+\- ]+/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function phraseRegex(value) {
  const normalized = fold(value)
  if (!normalized) return null
  const body = normalized.split(' ').filter(Boolean).map(escapeRegExp).join('\\s+')
  return new RegExp(`(?:^|\\s)${body}(?=\\s|$)`, 'i')
}

function hasPhrase(text, value) {
  const re = phraseRegex(value)
  return re ? re.test(fold(text)) : false
}

function hasAny(text, patterns) {
  const normalized = fold(text)
  return patterns.some((pattern) => typeof pattern === 'string'
    ? Boolean(phraseRegex(pattern)?.test(normalized))
    : pattern.test(normalized))
}

function words(value) {
  return fold(value).split(' ').filter((word) => word.length >= 2)
}

function mentions(text, value) {
  if (!value) return false
  if (hasPhrase(text, value)) return true
  const hay = fold(text)
  const tokens = words(value)
  return tokens.length > 0 && tokens.every((token) => phraseRegex(token)?.test(hay))
}

function genericMonTarget(value) {
  const key = fold(value)
  return key.includes('pokemon dang ra tran') || key.includes('pokemon hien tai') || key === 'pokemon'
}

function storySentences(text) {
  return String(text ?? '').split(/(?<=[.!?…])\s+|\n+/).map((line) => line.trim()).filter(Boolean)
}

const FUTURE_MARKERS = [
  'sẽ', 'sắp', 'định', 'dự định', 'có thể', 'nếu', 'hy vọng', 'cần phải',
  'nên', 'hãy', 'thử', 'mong muốn', 'muốn sẽ',
]
const NEGATION_MARKERS = ['chưa', 'không', 'chẳng', 'không hề']

function hasFutureOrConditional(line) {
  return hasAny(line, FUTURE_MARKERS)
}

function hasNegation(line) {
  return hasAny(line, NEGATION_MARKERS)
}

function containsFormattedNumber(text, value) {
  const n = Math.abs(Math.trunc(Number(value)))
  if (!Number.isFinite(n)) return false
  const digits = String(n).split('').join('[\\s.,]*')
  return new RegExp(`(^|\\D)${digits}(?=\\D|$)`).test(String(text ?? ''))
    || new RegExp(`(^|\\D)${digits}(?=\\D|$)`).test(fold(text))
}

/** Một câu phải chứa đúng target và hành động đã xảy ra. */
function sentenceEvidence(text, target, patterns, { allowGeneric = false, allowNegation = false } = {}) {
  for (const line of storySentences(text)) {
    const targetOk = allowGeneric && genericMonTarget(target) ? true : mentions(line, target)
    if (!targetOk || !hasAny(line, patterns)) continue
    if (hasFutureOrConditional(line)) continue
    if (!allowNegation && hasNegation(line)) continue
    return true
  }
  return false
}

const ACQUIRE = [
  'bắt được', 'bắt thành công', 'đã bắt', 'thu phục', 'thu vào bóng',
  'gia nhập', 'đi theo', 'nhận nuôi', 'được tặng', 'trao cho',
  'trở thành pokemon của', 'trở thành bạn đồng hành', 'vào đội', 'về đội',
  'đồng ý theo', 'chấp nhận đi cùng',
]
const LEVEL_UP = ['lên cấp', 'tăng cấp', 'level up', 'rare candy', 'kẹo hiếm', 'đạt lv', 'đạt level', 'cấp độ tăng', 'mạnh lên một bậc']
const EVOLVE = ['tiến hóa', 'evolve', 'hóa thành', 'biến đổi thành', 'lột xác thành']
const RECEIVE_ITEM = ['nhận được', 'được tặng', 'được trao', 'nhặt được', 'mua', 'lấy được', 'cất vào túi', 'bỏ vào túi', 'trao cho']
const LOSE_ITEM = ['sử dụng', 'dùng hết', 'đưa cho', 'trả lại', 'bị lấy', 'bị cướp', 'mất đi', 'ném', 'tiêu hao', 'ăn kẹo', 'cho ăn']
const MOVE = [
  'đi tới', 'đi đến', 'đã tới', 'đã đến', 'tới nơi', 'đến nơi', 'đặt chân',
  'rời khỏi', 'đi vào', 'bước vào', 'đi qua', 'tiến về', 'khởi hành tới',
  'di chuyển tới', 'cập bến', 'hạ cánh tại', 'đến được',
]
const BOND_POSITIVE = ['tin tưởng', 'thân thiết', 'gắn bó', 'quý mến', 'yêu mến', 'cảm mến', 'bảo vệ', 'chăm sóc', 'cứu', 'ôm', 'khen', 'cảm ơn', 'tha thứ', 'cùng vượt qua', 'dựa vào', 'rúc đầu']
const BOND_NEGATIVE = ['mất niềm tin', 'thất vọng', 'sợ hãi', 'dè chừng', 'giận dỗi', 'bị bỏ rơi', 'ngược đãi', 'phản bội', 'xa cách', 'không còn tin']
const REL_POSITIVE = ['cảm ơn', 'quý mến', 'tin tưởng', 'thân thiết', 'giúp đỡ', 'cứu', 'đồng ý', 'hảo cảm', 'mỉm cười', 'thán phục']
const REL_NEGATIVE = ['tức giận', 'thất vọng', 'ghét', 'mất lòng', 'cãi nhau', 'xung đột', 'đe dọa', 'phản bội', 'hảo cảm giảm']
const HURT = ['bị thương', 'vết thương', 'chảy máu', 'gãy', 'bỏng', 'bầm tím', 'đau nhức', 'rách', 'vỡ', 'trúng đòn', 'bị cắn', 'bị cào']
const HEAL = ['hồi phục', 'lành lại', 'chữa trị', 'băng bó', 'hết đau', 'khỏi', 'được trị liệu']
const EAT = ['ăn', 'uống', 'dùng bữa', 'no bụng', 'được cho ăn', 'cho pokemon ăn', 'nuốt', 'nhâm nhi']
const HUNGER_NEGATIVE = ['đói bụng', 'cảm thấy đói', 'đang đói', 'cơn đói', 'bỏ bữa', 'lao lực', 'kiệt sức', 'vận động nặng', 'độ no giảm']
const TIME_PASS = ['ngày trôi qua', 'đêm trôi qua', 'sáng hôm sau', 'qua đêm', 'ngủ một đêm', 'sau một ngày', 'sau hai ngày', 'mất một ngày', 'nhiều ngày', 'vài ngày trôi qua']
const DATE_PART_WORDS = ['buổi sáng', 'buổi trưa', 'buổi chiều', 'buổi tối', 'ban đêm', 'trời sáng', 'hoàng hôn']
const TIME_TRANSITION = ['đã sang', 'chuyển sang', 'trời đã', 'khi trời', 'lúc này là', 'bây giờ là', 'sáng hôm sau']
const TRAINING = ['luyện tập', 'huấn luyện', 'tập luyện', 'tập chiêu', 'đối luyện', 'chạy bền', 'khổ luyện', 'tập thể lực']
const CENTER_INSIDE = ['bước vào trung tâm pokemon', 'đi vào trung tâm pokemon', 'bên trong trung tâm pokemon', 'đứng trước quầy y tá', 'y tá joy chào']
const MONEY_CONTEXT = ['tiền', 'poke dollar', 'pokedollar', 'pokecoin', 'đồng', 'giá', 'thanh toán', 'trả', 'thưởng', 'mua', 'bán', 'bị cướp']
const MONEY_GAIN = ['nhận', 'được thưởng', 'thưởng cho', 'kiếm được', 'được trả công', 'trao tiền', 'hoàn tiền', 'nhặt được', 'bán được', 'thu về']
const MONEY_LOSS = ['trả', 'thanh toán', 'mua', 'chi', 'mất', 'bị cướp', 'nộp', 'đưa tiền', 'khấu trừ']
const BODY_TERMS = {
  head: ['đầu', 'trán', 'mặt'], torso: ['thân', 'ngực', 'bụng', 'lưng'],
  leftArm: ['tay trái', 'cánh tay trái'], rightArm: ['tay phải', 'cánh tay phải'],
  leftLeg: ['chân trái', 'đầu gối trái'], rightLeg: ['chân phải', 'đầu gối phải'],
}
const NUMBER_WORDS = {
  1: ['một'], 2: ['hai'], 3: ['ba'], 4: ['bốn'], 5: ['năm'], 6: ['sáu'],
  7: ['bảy'], 8: ['tám'], 9: ['chín'], 10: ['mười'],
}

function reject(rejected, type, entry, reason) {
  rejected.push({ type, entry, reason })
}


function dedupeEntries(entries, type, rejected) {
  const seen = new Set()
  const out = []
  for (const entry of entries ?? []) {
    const key = JSON.stringify(entry)
    if (seen.has(key)) {
      reject(rejected, type, entry, 'tag bị lặp lại — chỉ áp một lần theo cùng một sự kiện trong chính văn')
      continue
    }
    seen.add(key)
    out.push(entry)
  }
  return out
}

function proseSupportsTransaction(text, amount) {
  const lines = storySentences(text)
  const verbs = amount > 0 ? MONEY_GAIN : MONEY_LOSS
  for (let i = 0; i < lines.length; i++) {
    // Cho phép “giá 500.” + câu kế “Logan thanh toán.” nhưng không ghép xa hơn.
    const windows = [lines[i], `${lines[i]} ${lines[i + 1] ?? ''}`]
    for (const line of windows) {
      if (!containsFormattedNumber(line, amount) || !hasAny(line, MONEY_CONTEXT) || !hasAny(line, verbs)) continue
      if (hasFutureOrConditional(line) || hasNegation(line)) continue
      return true
    }
  }
  return false
}

function proseSupportsDateAdvance(text, days) {
  const value = Math.abs(Math.trunc(Number(days)))
  if (!value) return false
  for (const line of storySentences(text)) {
    if (hasFutureOrConditional(line) || hasNegation(line) || !hasAny(line, TIME_PASS)) continue
    if (value === 1) return true
    if (containsFormattedNumber(line, value) || (NUMBER_WORDS[value] ?? []).some((word) => hasPhrase(line, word))) return true
  }
  return false
}

function hungerEvidence(line, entry, playerName, partyNames) {
  if (hasFutureOrConditional(line) || hasNegation(line)) return false
  const positive = entry.delta > 0
  const actionOk = positive
    ? hasAny(line, EAT)
    : hasAny(line, HUNGER_NEGATIVE) || /(?:^|\s)đói(?=\s|[,.!?]|$)/i.test(line)
  if (!actionOk) return false
  const pokemonNamed = hasAny(line, ['pokemon', 'pokémon']) || partyNames.some((name) => mentions(line, name))
  if (entry.who === 'mon') return pokemonNamed
  const playerNamed = hasAny(line, ['bạn', 'người chơi', 'nhân vật']) || (playerName && mentions(line, playerName))
  return playerNamed || !pokemonNamed
}

export function proseSupportsMove(text, place = '') {
  return Boolean(place) && sentenceEvidence(text, place, MOVE)
}

/** Chỉ trả lại tag có bằng chứng trong CHÍNH VĂN người chơi nhìn thấy. */
export function validateStateAgainstProse(parsed, storyText, options = {}) {
  const prose = String(storyText ?? '')
  const rejected = []
  const next = { ...parsed }
  const playerName = options.playerName ?? ''
  const partyNames = (options.party ?? []).map((mon) => mon?.name).filter(Boolean)

  next.pokemons = (parsed?.pokemons ?? []).filter((entry) => {
    const ok = sentenceEvidence(prose, entry.species, ACQUIRE)
    if (!ok) reject(rejected, 'pokemon', entry, `chính văn chưa xác nhận người chơi nhận ${entry.species}`)
    return ok
  })
  next.levels = (parsed?.levels ?? []).filter((entry) => {
    const ok = sentenceEvidence(prose, entry.target, LEVEL_UP, { allowGeneric: true })
    if (!ok) reject(rejected, 'level', entry, `chính văn chưa xác nhận ${entry.target} tăng cấp trực tiếp`)
    return ok
  })
  next.evolutions = (parsed?.evolutions ?? []).filter((entry) => {
    const ok = storySentences(prose).some((line) => mentions(line, entry.from) && mentions(line, entry.to)
      && hasAny(line, EVOLVE) && !hasFutureOrConditional(line) && !hasNegation(line))
    if (!ok) reject(rejected, 'evolve', entry, `chính văn chưa xác nhận ${entry.from} đã tiến hoá thành ${entry.to}`)
    return ok
  })
  next.items = (parsed?.items ?? []).filter((entry) => {
    const ok = sentenceEvidence(prose, entry.name, Number(entry.qty) > 0 ? RECEIVE_ITEM : LOSE_ITEM)
    if (!ok) reject(rejected, 'item', entry, `chính văn chưa xác nhận thay đổi vật phẩm ${entry.name}`)
    return ok
  })
  next.moveDirectives = (parsed?.moveDirectives ?? []).filter((entry) => {
    const ok = proseSupportsMove(prose, entry.place)
    if (!ok) reject(rejected, 'move', entry, `chính văn chưa xác nhận đã di chuyển tới ${entry.place}`)
    return ok
  })
  next.moves = next.moveDirectives.map((entry) => entry.place)
  next.friendships = (parsed?.friendships ?? []).filter((entry) => {
    const ok = sentenceEvidence(prose, entry.target, entry.delta > 0 ? BOND_POSITIVE : BOND_NEGATIVE, { allowGeneric: true, allowNegation: entry.delta < 0 })
    if (!ok) reject(rejected, 'friendship', entry, `chính văn chưa thể hiện rõ độ thân mật của ${entry.target} thay đổi`)
    return ok
  })
  next.rel = (parsed?.rel ?? []).filter((entry) => {
    const ok = sentenceEvidence(prose, entry.name, entry.delta > 0 ? REL_POSITIVE : REL_NEGATIVE, { allowNegation: entry.delta < 0 })
    if (!ok) reject(rejected, 'rel', entry, `chính văn chưa thể hiện rõ hảo cảm của ${entry.name} thay đổi`)
    return ok
  })
  next.body = (parsed?.body ?? []).filter((entry) => {
    const terms = BODY_TERMS[entry.part] ?? []
    const ok = storySentences(prose).some((line) => hasAny(line, terms) && hasAny(line, entry.delta > 0 ? HURT : HEAL)
      && !hasFutureOrConditional(line) && !hasNegation(line))
    if (!ok) reject(rejected, 'body', entry, `chính văn chưa xác nhận thay đổi thương tích ${entry.part}`)
    return ok
  })
  next.hunger = (parsed?.hunger ?? []).filter((entry) => {
    const ok = storySentences(prose).some((line) => hungerEvidence(line, entry, playerName, partyNames))
    if (!ok) reject(rejected, 'hunger', entry, 'chính văn chưa xác nhận ăn uống/đói hoặc lao lực rõ ràng')
    return ok
  })

  if (parsed?.dateAdvance && !proseSupportsDateAdvance(prose, parsed.dateAdvance)) {
    reject(rejected, 'date', { value: parsed.dateAdvance }, 'chính văn chưa xác nhận đúng số ngày đã trôi qua')
    next.dateAdvance = 0
  }
  if (parsed?.datePart) {
    const ok = storySentences(prose).some((line) => hasAny(line, [parsed.datePart, ...DATE_PART_WORDS])
      && (hasAny(line, TIME_TRANSITION) || hasAny(line, TIME_PASS)) && !hasFutureOrConditional(line) && !hasNegation(line))
    if (!ok) {
      reject(rejected, 'date', { part: parsed.datePart }, `chính văn chưa xác nhận đã chuyển sang buổi ${parsed.datePart}`)
      next.datePart = null
    }
  }
  if (parsed?.training) {
    const ok = storySentences(prose).some((line) => hasAny(line, TRAINING) && !hasFutureOrConditional(line) && !hasNegation(line))
    if (!ok) {
      reject(rejected, 'training', { value: parsed.training }, 'chính văn chưa có cảnh luyện tập đã diễn ra')
      next.training = 0
    }
  }
  next.npcs = (parsed?.npcs ?? []).filter((entry) => {
    const ok = mentions(prose, entry.name)
    if (!ok) reject(rejected, 'npc', entry, `NPC ${entry.name} không xuất hiện trong chính văn`)
    return ok
  })
  next.facts = (parsed?.facts ?? []).filter((entry) => {
    const keys = String(entry.key ?? '').split(',').map((key) => key.trim()).filter(Boolean)
    const contentTokens = words(entry.text).filter((token) => token.length >= 4)
    const ok = keys.some((key) => mentions(prose, key))
      && contentTokens.filter((token) => phraseRegex(token)?.test(fold(prose))).length >= Math.min(3, contentTokens.length)
    if (!ok) reject(rejected, 'fact', entry, 'nội dung FACT chưa được chính văn xác nhận đủ rõ')
    return ok
  })

  // Model chính và API phụ đôi lúc lặp nguyên một tag trong cùng câu trả
  // lời. Cùng một bằng chứng chính văn chỉ được đổi biến một lần; nếu thật
  // sự có hai sự kiện, model phải gộp delta/số lượng (VD ITEM x2, FRIEND +10).
  next.pokemons = dedupeEntries(next.pokemons, 'pokemon', rejected)
  next.levels = dedupeEntries(next.levels, 'level', rejected)
  next.evolutions = dedupeEntries(next.evolutions, 'evolve', rejected)
  next.items = dedupeEntries(next.items, 'item', rejected)
  next.moveDirectives = dedupeEntries(next.moveDirectives, 'move', rejected)
  next.moves = next.moveDirectives.map((entry) => entry.place)
  next.friendships = dedupeEntries(next.friendships, 'friendship', rejected)
  next.rel = dedupeEntries(next.rel, 'rel', rejected)
  next.body = dedupeEntries(next.body, 'body', rejected)
  next.hunger = dedupeEntries(next.hunger, 'hunger', rejected)
  next.npcs = dedupeEntries(next.npcs, 'npc', rejected)
  next.facts = dedupeEntries(next.facts, 'fact', rejected)
  if (parsed?.pokecenter) {
    const named = parsed.pokecenter.name && parsed.pokecenter.name !== 'Trung tâm Pokémon'
      ? mentions(prose, parsed.pokecenter.name) : true
    const inside = storySentences(prose).some((line) => hasAny(line, CENTER_INSIDE)
      && !hasFutureOrConditional(line) && !hasNegation(line))
    if (!named || !inside) {
      reject(rejected, 'pokecenter', parsed.pokecenter, 'chính văn chưa xác nhận nhân vật đang ở bên trong Trung tâm Pokémon')
      next.pokecenter = null
    }
  }

  const moneyEntries = parsed?.moneyEntries?.length
    ? parsed.moneyEntries
    : parsed?.money ? [parsed.money] : []
  next.moneyEntries = moneyEntries.filter((value) => {
    const ok = proseSupportsTransaction(prose, Number(value))
    if (!ok) reject(rejected, 'money', { value }, `chính văn chưa xác nhận đúng giao dịch ${value > 0 ? '+' : ''}${value} tiền`)
    return ok
  })
  const seenMoney = new Set()
  next.moneyEntries = next.moneyEntries.filter((value) => {
    const key = Number(value)
    if (seenMoney.has(key)) {
      reject(rejected, 'money', { value }, 'tag giao dịch bị lặp lại — chỉ trừ/cộng một lần theo cùng bằng chứng chính văn')
      return false
    }
    seenMoney.add(key)
    return true
  })
  next.money = next.moneyEntries.reduce((sum, value) => sum + Number(value || 0), 0)

  return { parsed: next, rejected }
}

export function describeRejectedState(rejected = []) {
  return rejected.map((entry) => `⚠ KHÔNG ÁP ${entry.type.toUpperCase()}: ${entry.reason}`)
}
