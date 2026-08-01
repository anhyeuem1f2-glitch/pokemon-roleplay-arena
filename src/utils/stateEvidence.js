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

// Phủ định/tương lai phải giữ dấu tiếng Việt. Dùng fold() ở đây từng làm
// “chứa” = “chưa”, “dính” = “định”, “hay” = “hãy”, khiến bằng chứng đã xảy
// ra bị bác oan. Biên Unicode giữ đúng ranh giới từ cả khi có dấu.
function hasExactAny(text, patterns) {
  const raw = String(text ?? '').normalize('NFC').toLocaleLowerCase('vi')
  return patterns.some((pattern) => {
    const body = String(pattern).normalize('NFC').toLocaleLowerCase('vi')
      .split(/\s+/).filter(Boolean).map(escapeRegExp).join('\\s+')
    return body ? new RegExp(`(?:^|[^\\p{L}\\p{N}])${body}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(raw) : false
  })
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

function legendaryContextIsValid(entry, prose, options) {
  if (options.adminMode || String(options.mode ?? '').toLowerCase() !== 'realistic') return true
  const evidence = fold(`${entry.reason ?? ''} ${prose}`)
  if (!String(entry.reason ?? '').trim()) return false
  // Chỉ coi đây là nhánh triệu hồi khi lý do hoặc chính câu nói về loài đó
  // mô tả nghi thức. Một di vật được nhắc ở đoạn khác không được vô tình biến
  // cuộc gặp tự nhiên thành nghi thức rồi làm nó trượt kiểm tra địa điểm.
  const speciesLines = storySentences(prose).filter((line) => mentions(line, entry.species)).join(' ')
  const triggerEvidence = fold(`${entry.reason ?? ''} ${speciesLines}`)
  const summons = /\b(trieu hoi|goi den|danh thuc|nghi thuc|di vat|stone)\b/.test(triggerEvidence)
  if (!summons) return true // một cuộc gặp tự nhiên cực hiếm do chính văn phân xử

  const species = fold(entry.species).replace(/\s/g, '')
  const inventoryText = fold((options.inventory ?? []).filter((item) => item?.infinite || (item?.qty ?? 0) > 0)
    .map((item) => `${item.id} ${item.name}`).join(' '))
  const place = `${String(options.location?.regionKey ?? '').toLowerCase()}:${String(options.location?.areaKey ?? '').toLowerCase()}`
  // Các nghi thức canon có điều kiện máy có thể xác minh. Không biến chúng
  // thành khóa badge/quest; chỉ đối chiếu đúng di vật + đúng nơi nếu chính
  // văn chọn con đường TRIỆU HỒI này. Gặp tự nhiên vẫn là nhánh riêng ở trên.
  if (species === 'reshiram') {
    const hasStone = /\b(light stone|white stone|da trang|bach thach)\b/.test(inventoryText)
    return hasStone && place === 'unova:opelucid' && /dragonspiral/.test(evidence)
  }
  if (species === 'zekrom') {
    const hasStone = /\b(dark stone|black stone|da den|hac thach)\b/.test(inventoryText)
    return hasStone && place === 'unova:opelucid' && /dragonspiral/.test(evidence)
  }
  if (species === 'arceus' && /azure flute|sao thien|flute/.test(evidence)) {
    return /azure flute/.test(inventoryText) && /hall of origin|spear pillar/.test(evidence)
  }
  return true
}

function genericMonTarget(value) {
  const key = fold(value)
  return key.includes('pokemon dang ra tran') || key.includes('pokemon hien tai') || key === 'pokemon'
}

function storySentences(text) {
  return String(text ?? '').split(/(?<=[.!?…])\s+|\n+/).map((line) => line.trim()).filter(Boolean)
}

function storyClauses(text) {
  return String(text ?? '').split(/(?<=[,;:!?…])\s+|\s+[—–-]\s+|\n+/)
    .map((line) => line.trim()).filter(Boolean)
}

const FUTURE_MARKERS = [
  'sẽ', 'sắp', 'định', 'dự định', 'có thể', 'nếu', 'hy vọng', 'cần phải',
  'nên', 'hãy', 'thử', 'mong muốn', 'muốn sẽ',
]
const NEGATION_MARKERS = ['chưa', 'không', 'chẳng', 'không hề']

function hasFutureOrConditional(line) {
  return hasExactAny(line, FUTURE_MARKERS)
}

function hasNegation(line) {
  return hasExactAny(line, NEGATION_MARKERS)
}

// “Không do dự, cô nhận lấy bóng” là một hành động đã hoàn tất, không phải
// “không nhận”. Chỉ xét phủ định/tương lai trong MỆNH ĐỀ chứa động từ thay vì
// quét cả câu; đồng thời gỡ vài cụm “không” mô tả thái độ thường gặp.
function completedActionClause(line, patterns, { allowNegativeCompletion = [] } = {}) {
  for (const rawClause of storyClauses(line)) {
    if (!hasAny(rawClause, patterns)) continue
    if (hasAny(rawClause, allowNegativeCompletion)) return rawClause
    const clause = rawClause.replace(/\b(?:không|chẳng)\s+(?:hề\s+)?(?:do dự|chần chừ|ngần ngại|nói gì|phản đối|buông tay)\b/giu, ' ')
    if (!hasFutureOrConditional(clause) && !hasNegation(clause)) return rawClause
  }
  return null
}

function linkedSentenceEvidence(text, targets, patterns, {
  allowGeneric = false,
  maxDistance = 1,
  allowNegativeCompletion = [],
  quantity = null,
  matchAnyTarget = false,
} = {}) {
  const lines = storySentences(text)
  const wanted = (Array.isArray(targets) ? targets : [targets]).filter(Boolean)
  for (let index = 0; index < lines.length; index++) {
    const targetLine = lines[index]
    const hasAnchor = wanted.some((target) => (
      allowGeneric && genericMonTarget(target) ? true : mentions(targetLine, target)
    ))
    if (!hasAnchor) continue
    // Nếu câu neo có “không/sẽ” nhưng cũng chứa một mệnh đề hành động hoàn
    // tất (“không do dự, nhận lấy”), để bộ xét mệnh đề quyết định. Nếu chỉ là
    // “ngày mai sẽ trao Eevee”, không có mệnh đề hoàn tất nên phải bác.
    if ((hasFutureOrConditional(targetLine) || hasNegation(targetLine))
      && !completedActionClause(targetLine, patterns, { allowNegativeCompletion })) continue
    const start = Math.max(0, index - maxDistance)
    const end = Math.min(lines.length - 1, index + maxDistance)
    const evidenceWindow = lines.slice(start, end + 1).join(' ')
    const targetMatcher = (target) => (
      allowGeneric && genericMonTarget(target) ? true : mentions(evidenceWindow, target)
    )
    const allTargetsLinked = matchAnyTarget ? wanted.some(targetMatcher) : wanted.every(targetMatcher)
    if (!allTargetsLinked) continue
    for (let actionIndex = start; actionIndex <= end; actionIndex++) {
      const action = completedActionClause(lines[actionIndex], patterns, { allowNegativeCompletion })
      if (!action) continue
      if (quantity !== null && Math.abs(Number(quantity)) > 1 && !containsFormattedNumber(evidenceWindow, quantity)) continue
      return true
    }
  }
  return false
}

const VI_NUMBER_VALUES = {
  khong: 0, mot: 1, hai: 2, ba: 3, bon: 4, tu: 4,
  nam: 5, lam: 5, sau: 6, bay: 7, tam: 8, chin: 9,
}
const VI_NUMBER_TOKENS = new Set([
  ...Object.keys(VI_NUMBER_VALUES), 'muoi', 'tram', 'nghin', 'ngan',
  'trieu', 'ty', 'linh', 'le',
])

function parseVietnameseUnderThousand(tokens) {
  let value = 0
  for (let i = 0; i < tokens.length;) {
    const token = tokens[i]
    const digit = VI_NUMBER_VALUES[token]
    const next = tokens[i + 1]
    if (digit !== undefined && next === 'tram') {
      value += digit * 100
      i += 2
    } else if (token === 'tram') {
      value += 100
      i += 1
    } else if (digit !== undefined && next === 'muoi') {
      value += digit * 10
      i += 2
    } else if (token === 'muoi') {
      value += 10
      i += 1
    } else if (digit !== undefined) {
      value += digit
      i += 1
    } else {
      // “linh/lẻ” chỉ nối hàng trăm với hàng đơn vị.
      i += 1
    }
  }
  return value
}

function parseVietnameseNumberTokens(tokens) {
  let total = 0
  let group = []
  const flush = (scale = 1) => {
    const value = parseVietnameseUnderThousand(group)
    total += (value || (scale > 1 ? 1 : 0)) * scale
    group = []
  }
  for (const token of tokens) {
    if (token === 'nghin' || token === 'ngan') flush(1_000)
    else if (token === 'trieu') flush(1_000_000)
    else if (token === 'ty') flush(1_000_000_000)
    else group.push(token)
  }
  flush(1)
  return total
}

function containsVietnameseNumber(text, value) {
  const wanted = Math.abs(Math.trunc(Number(value)))
  if (!Number.isFinite(wanted)) return false
  const tokens = fold(text).split(' ').filter(Boolean)
  let run = []
  const matchesRun = () => run.length > 0 && parseVietnameseNumberTokens(run) === wanted
  for (const token of tokens) {
    if (VI_NUMBER_TOKENS.has(token)) run.push(token)
    else {
      if (matchesRun()) return true
      run = []
    }
  }
  return matchesRun()
}

function containsFormattedNumber(text, value) {
  const n = Math.abs(Math.trunc(Number(value)))
  if (!Number.isFinite(n)) return false
  const digits = String(n).split('').join('[\\s.,]*')
  return new RegExp(`(^|\\D)${digits}(?=\\D|$)`).test(String(text ?? ''))
    || new RegExp(`(^|\\D)${digits}(?=\\D|$)`).test(fold(text))
    || containsVietnameseNumber(text, n)
}

/** Một câu phải chứa đúng target và hành động đã xảy ra. */
function sentenceEvidence(text, target, patterns, { allowGeneric = false, allowNegation = false } = {}) {
  if (allowNegation) {
    return storySentences(text).some((line) => {
      const targetOk = allowGeneric && genericMonTarget(target) ? true : mentions(line, target)
      return targetOk && hasAny(line, patterns) && !hasFutureOrConditional(line)
    })
  }
  return linkedSentenceEvidence(text, target, patterns, { allowGeneric })
}

const ACQUIRE = [
  'bắt được', 'bắt thành công', 'đã bắt', 'thu phục', 'thu vào bóng',
  'gia nhập', 'đi theo', 'nhận nuôi', 'được tặng', 'trao cho',
  'trở thành pokemon của', 'trở thành bạn đồng hành', 'vào đội', 'về đội',
  'đồng ý theo', 'chấp nhận đi cùng',
]
// Mua/nhận qua PC không nhất thiết có câu máy móc “Ralts gia nhập đội”.
// Tách riêng khỏi ACQUIRE để “Ralts đã nhận một đòn” không bị hiểu nhầm là
// nhận Pokémon: nhánh này luôn đòi thêm ngữ cảnh sở hữu/giao dịch/ball.
const OWNERSHIP_ACQUIRE = [
  'đã mua', 'mua được', 'mua thành công', 'đã nhận', 'nhận được', 'nhận lấy', 'đón lấy',
  'đã tiếp nhận', 'tiếp nhận thành công', 'chuyển quyền sở hữu',
  'quyền sở hữu đã chuyển', 'đã sang tên', 'chuyển giao hoàn tất',
]
const OWNERSHIP_CONTEXT = [
  'poké ball', 'poke ball', 'quả bóng', 'quả cầu', 'pc', 'box',
  'storage system', 'giao dịch', 'thanh toán', 'quyền sở hữu',
  'sang tên', 'vào đội', 'bạn đồng hành',
]
const EXPLICIT_POKEMON_RECEIVE = [
  'nhận pokemon', 'nhận pokémon', 'nhận được pokemon', 'nhận được pokémon',
  'đã nhận pokemon', 'đã nhận pokémon',
]
const TRANSFER_LINK = [
  'mua', 'bán', 'rao bán', 'giao dịch', 'chuyển phát', 'chuyển giao',
  'chuyển vào pc', 'chuyển vào box', 'poké ball chứa', 'poke ball chứa',
  'đón lấy', 'nhận hàng', 'chiến lợi phẩm',
]
const TRANSFER_COMPLETE = [
  'đã tiếp nhận', 'tiếp nhận thành công', 'đã nhận hàng', 'nhận được hàng',
  'chuyển giao hoàn tất', 'giao dịch hoàn tất', 'quyền sở hữu đã chuyển',
  'đã sang tên', 'đã chuyển vào pc', 'đã chuyển vào box', 'đã nằm trong box',
  'đã nằm trong storage', 'xuất vật chất', 'extract',
]
const PC_TRANSFER_CONTEXT = [
  'pc', 'box', 'storage system', 'chuyển phát', 'chuyển giao',
  'truyền vật chất', 'khay', 'poké ball', 'poke ball',
]
const BALL_OBJECT = ['poké ball', 'poke ball', 'quả bóng', 'quả cầu']
const TAKE_POSSESSION = [
  'nhận lấy', 'lấy ra', 'rút ra', 'cầm', 'nắm', 'chạm vào', 'ôm',
  'thu vào', 'siết', 'áp vào ngực', 'thu nó',
]
const LEVEL_UP = ['lên cấp', 'tăng cấp', 'level up', 'rare candy', 'kẹo hiếm', 'đạt lv', 'đạt level', 'cấp độ tăng', 'mạnh lên một bậc']
const EVOLVE = ['tiến hóa', 'evolve', 'hóa thành', 'biến đổi thành', 'lột xác thành']
const EQUIP_ITEM = ['đeo', 'trang bị', 'cho cầm', 'đưa cho giữ', 'gắn vào', 'trao cho cầm', 'cầm lấy', 'giữ trên người', 'giữ', 'cầm', 'mang theo']
const UNEQUIP_ITEM = ['tháo', 'gỡ', 'cất lại', 'thu hồi', 'lấy lại', 'bỏ trang bị', 'không còn cầm']
const RECEIVE_ITEM = ['nhận được', 'được tặng', 'được trao', 'nhặt được', 'mua', 'lấy được', 'cất vào túi', 'bỏ vào túi', 'trao cho', 'trao']
const TAKE_ITEM_ILLEGALLY = ['trộm', 'trộm được', 'cuỗm', 'chôm', 'thó', 'giật lấy', 'cướp', 'chiếm đoạt', 'lấy trộm', 'nẫng', 'tịch thu']
const LOSE_ITEM = ['sử dụng', 'dùng hết', 'đưa cho', 'trả lại', 'bị lấy', 'bị cướp', 'mất đi', 'ném', 'tiêu hao', 'ăn kẹo', 'cho ăn']
const LOOT_ACTION = ['vơ vét', 'lấy sạch', 'cuỗm', 'trộm được', 'thu chiến lợi phẩm', 'gom hết', 'nhặt được', 'tịch thu', 'mang số đồ', 'bỏ chiến lợi phẩm vào túi']
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
const TIME_TRANSITION = ['đã sang', 'chuyển sang', 'trời đã', 'khi trời', 'lúc này là', 'bây giờ là', 'sáng hôm sau']
const TRAINING = ['luyện tập', 'huấn luyện', 'tập luyện', 'tập chiêu', 'đối luyện', 'chạy bền', 'khổ luyện', 'tập thể lực']
const CENTER_INSIDE = ['bước vào trung tâm pokemon', 'đi vào trung tâm pokemon', 'bên trong trung tâm pokemon', 'đứng trước quầy y tá', 'y tá joy chào']
const MONEY_CONTEXT = ['tiền', 'poke dollar', 'pokedollar', 'pokecoin', 'đồng', 'giá', 'tổng cộng', 'hóa đơn', 'thành tiền', 'số dư', 'thanh toán', 'trả', 'thưởng', 'mua', 'bán', 'bị cướp']
const MONEY_GAIN = ['nhận', 'được thưởng', 'thưởng cho', 'kiếm được', 'được trả công', 'trao tiền', 'hoàn tiền', 'nhặt được', 'bán được', 'thu về']
const MONEY_LOSS = ['trả', 'thanh toán', 'mua', 'chi', 'mất', 'bị cướp', 'nộp', 'đưa tiền', 'khấu trừ', 'bị trừ', 'trừ đi', 'quẹt thẻ', 'quẹt', 'giải ngân']
const SHOP_SELECT_ITEM = ['lấy cho tôi', 'thêm', 'nhặt', 'quăng thêm', 'chọn mua', 'đặt mua', 'gom hàng', 'đóng gói', 'cho vào xe', 'bỏ vào xe']
const SHOP_PAYMENT_COMPLETE = ['đã thanh toán', 'thanh toán thành công', 'quẹt thẻ', 'quẹt', 'bị trừ', 'trừ đi', 'nhận hóa đơn']
const SHOP_PACK_COMPLETE = ['đóng gói toàn bộ', 'xách theo đống hàng', 'xách theo hàng', 'toàn bộ đống vật tư']
const UNKNOWN_BALL_CONTEXT = [
  'chưa kiểm tra', 'chưa mở', 'chưa xác định', 'không biết bên trong', 'không rõ bên trong',
  'không biết chứa', 'chưa biết chứa', 'không biết pokemon gì', 'không biết pokémon gì',
  'không nhãn', 'mất nhãn', 'niêm phong', 'bóng lạ', 'quả bóng lạ',
]
const BALL_REVEAL = [
  'mở poké ball', 'mở poke ball', 'mở quả bóng', 'bật quả bóng', 'kích hoạt quả bóng',
  'thả ra', 'phóng thích', 'bên trong là', 'hóa ra là', 'hiện ra từ', 'xuất hiện từ',
  'tia sáng từ quả bóng', 'bước ra khỏi quả bóng',
]
const UNKNOWN_BALL_RESOLUTION = [
  'trống rỗng', 'không có pokemon', 'không có pokémon', 'bóng rỗng', 'quả bóng rỗng',
  'có thể sử dụng', 'vẫn dùng được', 'không còn pokemon bên trong', 'không còn pokémon bên trong',
  'bị hỏng', 'đã hỏng', 'nứt vỡ', 'không dùng được', 'bị tịch thu', 'đã trả lại', 'giao nộp',
]
const POSSESS_BALL = [
  ...TAKE_POSSESSION, ...TAKE_ITEM_ILLEGALLY, 'bóng của mình', 'quả bóng của mình',
  'trong túi', 'mang theo', 'đang giữ', 'vừa lấy', 'đã lấy',
]
const BODY_TERMS = {
  head: ['đầu', 'trán', 'mặt', 'thái dương', 'sọ', 'má', 'hàm', 'mũi', 'tai', 'mắt'],
  torso: ['thân', 'ngực', 'bụng', 'lưng', 'sườn', 'eo', 'hông'],
  leftArm: ['tay trái', 'cánh tay trái', 'vai trái', 'khuỷu tay trái', 'cổ tay trái', 'bàn tay trái', 'ngón tay trái'],
  rightArm: ['tay phải', 'cánh tay phải', 'vai phải', 'khuỷu tay phải', 'cổ tay phải', 'bàn tay phải', 'ngón tay phải'],
  leftLeg: ['chân trái', 'đầu gối trái', 'đùi trái', 'cẳng chân trái', 'cổ chân trái', 'bàn chân trái'],
  rightLeg: ['chân phải', 'đầu gối phải', 'đùi phải', 'cẳng chân phải', 'cổ chân phải', 'bàn chân phải'],
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

function transactionEvidenceCount(text, amount) {
  const lines = storySentences(text)
  const verbs = amount > 0 ? MONEY_GAIN : MONEY_LOSS
  let count = 0
  for (let i = 0; i < lines.length; i++) {
    const amountLine = lines[i]
    if (!containsFormattedNumber(amountLine, amount) || !hasAny(amountLine, MONEY_CONTEXT)) continue
    if (completedActionClause(amountLine, verbs)) {
      count += 1
      continue
    }
    // Văn dài thường báo tổng tiền, chen phản ứng nhân vật rồi mới quẹt thẻ.
    // Chỉ tìm tối đa 5 câu sau và câu hoàn tất phải tự đứng vững, không ghép
    // chữ “không” ở một câu miêu tả khác vào cả cửa sổ.
    for (let j = i + 1; j <= Math.min(lines.length - 1, i + 5); j++) {
      const paymentLine = lines[j]
      if (completedActionClause(paymentLine, verbs)) {
        count += 1
        break
      }
    }
  }
  return count
}

function proseSupportsItemChange(text, entry) {
  const qty = Number(entry?.qty) || 0
  const target = entry?.name ?? ''
  if (fold(target).includes('poke ball chua xac dinh')) {
    return qty > 0
      ? proseSupportsUnknownBallAcquisition(text, qty)
      : proseSupportsUnknownBallResolution(text, qty)
  }
  // Không cho model biến một bóng đang chứa Pokémon chưa rõ loài thành bóng
  // rỗng dùng để bắt chỉ vì nó xuất nhầm ITEM Poké Ball.
  if (['poke ball', 'pokeball'].includes(fold(target))) {
    if (qty > 0 && proseSupportsUnknownBallResolution(text, qty, { requireUsable: true })) return true
    if (proseSupportsUnknownBallAcquisition(text, Math.max(1, qty))) return false
  }
  if (linkedSentenceEvidence(text, target, qty > 0 ? [...RECEIVE_ITEM, ...TAKE_ITEM_ILLEGALLY] : LOSE_ITEM, { quantity: qty })) return true
  if (qty <= 0 || !target) return false

  const lines = storySentences(text)
  return lines.some((line, index) => {
    if (!mentions(line, target)) return false
    // Danh sách mua hàng trong hội thoại thường chỉ có động từ ở câu đầu,
    // hoặc “Escape Rope đúng không? Đóng gói năm cuộn.” tách target và số
    // lượng sang hai câu kề nhau.
    const selection = lines.slice(Math.max(0, index - 2), index + 2).join(' ')
    if (!hasAny(selection, SHOP_SELECT_ITEM)) return false
    const declarativeLine = line.replace(/đúng\s+không\s*[?？]?/giu, '')
    if (hasFutureOrConditional(declarativeLine) || hasNegation(declarativeLine)) return false
    if (Math.abs(qty) > 1 && !containsFormattedNumber(selection, qty)) return false
    const laterLines = lines.slice(index)
    const packedAll = laterLines.some((later) => hasAny(later, SHOP_PACK_COMPLETE)
      && !hasFutureOrConditional(later) && !hasNegation(later))
    const paidSoon = laterLines.slice(0, 10).some((later) => hasAny(later, SHOP_PAYMENT_COMPLETE)
      && !hasFutureOrConditional(later) && !hasNegation(later))
    return packedAll || paidSoon
  })
}

/**
 * Xác nhận người chơi đã sở hữu Pokémon, kể cả giao dịch/PC được kể qua
 * nhiều câu. Nhánh liên câu cố ý yêu cầu ba mắt xích độc lập để không biến
 * lời hứa “sẽ gửi” hoặc một tin rao bán thành Pokémon thật trong save.
 */
export function proseSupportsPokemonAcquisition(text, target) {
  if (!target) return false
  if (sentenceEvidence(text, target, ACQUIRE)) return true

  const lines = storySentences(text)
  const completedLine = (line, actions = null) => actions
    ? Boolean(completedActionClause(line, actions))
    : !hasFutureOrConditional(line) && !hasNegation(line)

  // Trường hợp cùng một câu: “An đã nhận quả Poké Ball chứa Ralts qua PC”
  // hoặc “An đã mua Ralts và hoàn tất thanh toán”.
  const directOwnership = lines.some((line) => mentions(line, target)
    && ((hasAny(line, OWNERSHIP_ACQUIRE) && hasAny(line, OWNERSHIP_CONTEXT))
      || hasAny(line, EXPLICIT_POKEMON_RECEIVE))
    && completedLine(line, [...OWNERSHIP_ACQUIRE, ...EXPLICIT_POKEMON_RECEIVE]))
  if (directOwnership) return true

  if (!mentions(text, target)) return false

  // Gắn đúng loài với giao dịch/kiện hàng trong một cửa sổ nhỏ quanh câu
  // nhắc tên. Tên loài chỉ xuất hiện đâu đó trong chương là chưa đủ.
  const targetLinked = lines.some((line, index) => {
    if (!mentions(line, target)) return false
    const local = lines.slice(Math.max(0, index - 2), index + 3).join(' ')
    return hasAny(local, TRANSFER_LINK)
  })
  if (!targetLinked) return false

  const transferCompleted = lines.some((line) => hasAny(line, TRANSFER_COMPLETE)
    && hasAny(line, PC_TRANSFER_CONTEXT)
    && completedLine(line))
  if (!transferCompleted) return false

  // Cho phép vật thể và động tác nằm ở hai câu kề nhau: văn chương thường
  // viết “quả Poké Ball trượt ra.” rồi mới “An vươn tay cầm lấy nó.”
  const ballTaken = lines.some((line, index) => {
    const local = lines.slice(Math.max(0, index - 1), index + 2).join(' ')
    return hasAny(local, BALL_OBJECT) && hasAny(local, TAKE_POSSESSION)
      && completedLine(line) && !hasFutureOrConditional(local) && !hasNegation(local)
  })
  return ballTaken
}

/**
 * Một Poké Ball đang chứa Pokémon nhưng chưa biết loài là một VẬT CHỨA đã
 * sở hữu, chưa phải Pokémon đã xác định và cũng không phải bóng rỗng để bắt.
 */
export function proseSupportsUnknownBallAcquisition(text, quantity = 1) {
  const lines = storySentences(text)
  return lines.some((line, index) => {
    const local = lines.slice(Math.max(0, index - 1), index + 2).join(' ')
    const ball = hasAny(local, BALL_OBJECT)
    const unknown = hasExactAny(local, UNKNOWN_BALL_CONTEXT)
    const taken = Boolean(completedActionClause(local, [...TAKE_POSSESSION, ...TAKE_ITEM_ILLEGALLY, ...RECEIVE_ITEM], {
      allowNegativeCompletion: UNKNOWN_BALL_CONTEXT,
    }))
    const countOk = Math.abs(Number(quantity)) <= 1 || containsFormattedNumber(local, quantity)
    return ball && unknown && taken && countOk
  })
}

/** Quả bóng đã được kiểm tra và không còn ở trạng thái “chưa xác định”. */
export function proseSupportsUnknownBallResolution(text, quantity = 1, { requireUsable = false } = {}) {
  const lines = storySentences(text)
  return lines.some((line, index) => {
    const local = lines.slice(Math.max(0, index - 2), index + 3).join(' ')
    const inspected = hasAny(local, [...BALL_REVEAL, 'kiểm tra', 'quét', 'soi', 'xác minh'])
    const resolved = Boolean(completedActionClause(local, UNKNOWN_BALL_RESOLUTION, {
      allowNegativeCompletion: ['không có pokemon', 'không có pokémon', 'không còn pokemon bên trong', 'không còn pokémon bên trong'],
    }))
    const usable = hasAny(local, ['trống rỗng', 'bóng rỗng', 'quả bóng rỗng', 'có thể sử dụng', 'vẫn dùng được'])
    const countOk = Math.abs(Number(quantity)) <= 1 || containsFormattedNumber(local, quantity)
    return hasAny(local, BALL_OBJECT) && inspected && resolved && (!requireUsable || usable) && countOk
  })
}

/** Xác minh loài trong một Poké Ball chưa xác định mà người chơi đang giữ. */
export function proseSupportsMysteryBallReveal(text, target, options = {}) {
  if (!target || !mentions(text, target)) return false
  const lines = storySentences(text)
  const inventoryHasBall = (options.inventory ?? []).some((item) => (
    item?.id === 'unknown-pokemon-ball' || fold(item?.name).includes('poke ball chua xac dinh')
  ) && (item?.infinite || Number(item?.qty) > 0))
  const sameTurnPossession = proseSupportsUnknownBallAcquisition(text, 1)
    || lines.some((line, index) => {
      if (!hasAny(line, BALL_OBJECT)) return false
      if (completedActionClause(line, POSSESS_BALL)) return true
      const nextLine = lines[index + 1] ?? ''
      return hasAny(nextLine, ['nó', 'quả ấy', 'vật ấy', 'quả bóng đó'])
        && Boolean(completedActionClause(nextLine, [...TAKE_POSSESSION, ...TAKE_ITEM_ILLEGALLY]))
    })
  if (!inventoryHasBall && !sameTurnPossession) return false
  return lines.some((line, index) => {
    if (!mentions(line, target)) return false
    const local = lines.slice(Math.max(0, index - 2), index + 3).join(' ')
    return hasAny(local, BALL_OBJECT) && Boolean(completedActionClause(local, BALL_REVEAL))
  })
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
  const positive = entry.delta > 0
  const actions = positive ? EAT : HUNGER_NEGATIVE
  const actionOk = Boolean(completedActionClause(line, actions))
    || (!positive && /(?:^|\s)đói(?=\s|[,.!?]|$)/iu.test(line) && !hasNegation(line) && !hasFutureOrConditional(line))
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
    if (options.blockPokemonAcquisition) {
      reject(rejected, 'pokemon', entry, 'lượt khởi tạo tìm kiếm ở chế độ Thực tế chỉ được có manh mối hoặc không tìm thấy; không thể nhận Pokémon ngay')
      return false
    }
    const ok = proseSupportsPokemonAcquisition(prose, entry.species)
      || proseSupportsMysteryBallReveal(prose, entry.species, options)
    if (!ok) reject(rejected, 'pokemon', entry, `chính văn chưa xác nhận người chơi nhận ${entry.species}`)
    return ok
  })
  next.levels = (parsed?.levels ?? []).filter((entry) => {
    const ok = sentenceEvidence(prose, entry.target, LEVEL_UP, { allowGeneric: true })
    if (!ok) reject(rejected, 'level', entry, `chính văn chưa xác nhận ${entry.target} tăng cấp trực tiếp`)
    return ok
  })
  next.evolutions = (parsed?.evolutions ?? []).filter((entry) => {
    const ok = linkedSentenceEvidence(prose, [entry.from, entry.to], EVOLVE, { maxDistance: 1 })
    if (!ok) reject(rejected, 'evolve', entry, `chính văn chưa xác nhận ${entry.from} đã tiến hoá thành ${entry.to}`)
    return ok
  })
  next.items = (parsed?.items ?? []).filter((entry) => {
    const ok = proseSupportsItemChange(prose, entry)
    if (!ok) reject(rejected, 'item', entry, `chính văn chưa xác nhận thay đổi vật phẩm ${entry.name}`)
    return ok
  })
  next.loots = (parsed?.loots ?? []).filter((entry) => {
    const type = fold(entry.type)
    const typeAliases = type.includes('da quy') || type.includes('ngoc') ? ['đá quý', 'ngọc', 'trang sức', 'kho báu']
      : type.includes('y te') || type.includes('thuoc') ? ['y tế', 'thuốc', 'phòng khám']
        : type.includes('trainer') ? ['trainer', 'poké mart', 'poke mart', 'poké ball', 'poke ball']
          : type.includes('thuc pham') || type.includes('do an') ? ['thực phẩm', 'đồ ăn', 'nhà bếp']
            : type.includes('cong nghe') ? ['công nghệ', 'điện tử', 'phòng thí nghiệm', 'thiết bị']
              : type.includes('quan ao') ? ['quần áo', 'thời trang', 'kho vải']
                : []
    const actionOk = storySentences(prose).some((line) => hasAny(line, LOOT_ACTION)
      && !hasFutureOrConditional(line) && !hasNegation(line))
    const typeOk = !type || type.includes('tong hop') || mentions(prose, entry.type) || hasAny(prose, typeAliases)
    const ok = actionOk && typeOk
    if (!ok) reject(rejected, 'loot', entry, 'chính văn chưa xác nhận đã lấy được chiến lợi phẩm đúng loại')
    return ok
  })
  next.moveDirectives = (parsed?.moveDirectives ?? []).filter((entry) => {
    const ok = proseSupportsMove(prose, entry.place)
    if (!ok) reject(rejected, 'move', entry, `chính văn chưa xác nhận đã di chuyển tới ${entry.place}`)
    return ok
  })
  next.moves = next.moveDirectives.map((entry) => entry.place)
  next.equipment = (parsed?.equipment ?? []).filter((entry) => {
    const targets = entry.mode === 'unequip' ? [entry.target] : [entry.target, entry.item]
    const ok = linkedSentenceEvidence(prose, targets, entry.mode === 'unequip' ? UNEQUIP_ITEM : EQUIP_ITEM, {
      allowGeneric: true,
      allowNegativeCompletion: entry.mode === 'unequip' ? ['không còn cầm', 'không còn đeo', 'không còn giữ'] : [],
    })
    if (!ok) reject(rejected, 'equipment', entry, `chính văn chưa xác nhận ${entry.mode === 'unequip' ? 'tháo trang bị khỏi' : 'trang bị cho'} ${entry.target}`)
    return ok
  })
  next.friendships = (parsed?.friendships ?? []).filter((entry) => {
    const ok = linkedSentenceEvidence(prose, entry.target, entry.delta > 0 ? BOND_POSITIVE : BOND_NEGATIVE, {
      allowGeneric: true,
      allowNegativeCompletion: entry.delta < 0 ? ['không còn tin'] : [],
    })
    if (!ok) reject(rejected, 'friendship', entry, `chính văn chưa thể hiện rõ độ thân mật của ${entry.target} thay đổi`)
    return ok
  })
  next.rel = (parsed?.rel ?? []).filter((entry) => {
    const ok = linkedSentenceEvidence(prose, entry.name, entry.delta > 0 ? REL_POSITIVE : REL_NEGATIVE)
    if (!ok) reject(rejected, 'rel', entry, `chính văn chưa thể hiện rõ hảo cảm của ${entry.name} thay đổi`)
    return ok
  })
  next.body = (parsed?.body ?? []).filter((entry) => {
    const terms = BODY_TERMS[entry.part] ?? []
    const ok = linkedSentenceEvidence(prose, terms, entry.delta > 0 ? HURT : HEAL, {
      allowNegativeCompletion: entry.delta < 0 ? ['không còn đau', 'không còn nhức', 'không còn chảy máu'] : [],
      matchAnyTarget: true,
    })
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
    const ok = linkedSentenceEvidence(prose, parsed.datePart, [...TIME_TRANSITION, ...TIME_PASS], { maxDistance: 1 })
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
    const overlap = contentTokens.filter((token) => phraseRegex(token)?.test(fold(prose))).length
    const requiredOverlap = contentTokens.length <= 2 ? contentTokens.length : Math.min(3, Math.max(1, Math.ceil(contentTokens.length * 0.25)))
    const ok = keys.some((key) => mentions(prose, key)) && overlap >= requiredOverlap
    if (!ok) reject(rejected, 'fact', entry, 'nội dung FACT chưa được chính văn xác nhận đủ rõ')
    return ok
  })
  next.badges = (parsed?.badges ?? []).filter((entry) => {
    const ok = linkedSentenceEvidence(prose, entry.name, ['huy hiệu', 'badge', 'trao', 'nhận được', 'được tặng'], { maxDistance: 1 })
    if (!ok) reject(rejected, 'badge', entry, `chính văn chưa xác nhận đã được trao huy hiệu ${entry.name}`)
    return ok
  })
  next.quests = (parsed?.quests ?? []).filter((entry) => {
    const target = entry.title || entry.objective
    const actions = entry.status === 'completed' ? ['hoàn thành', 'đã xong', 'thành công', 'bàn giao']
      : entry.status === 'failed' ? ['thất bại', 'không kịp', 'nhiệm vụ hỏng']
        : ['nhiệm vụ', 'giao việc', 'nhờ', 'nhận lời', 'chấp nhận', 'mục tiêu']
    const ok = linkedSentenceEvidence(prose, target, actions, { maxDistance: 1 })
    if (!ok) reject(rejected, 'quest', entry, `chính văn chưa xác nhận cập nhật nhiệm vụ ${entry.title}`)
    return ok
  })
  next.reputations = (parsed?.reputations ?? []).filter((entry) => {
    const ok = linkedSentenceEvidence(prose, entry.name, ['danh tiếng', 'uy tín', 'tin tưởng', 'kính trọng', 'căm ghét', 'thù địch', 'mất mặt', 'biết ơn'])
    if (!ok) reject(rejected, 'rep', entry, `chính văn chưa thể hiện danh tiếng với ${entry.name} thay đổi`)
    return ok
  })
  next.wanted = (parsed?.wanted ?? []).filter((entry) => {
    const ok = storySentences(prose).some((line) => Boolean(completedActionClause(line, entry.delta > 0
      ? ['truy nã', 'phạm pháp', 'bị cảnh sát phát hiện', 'bị bắt', 'treo thưởng', 'ban hành lệnh bắt']
      : ['xoá truy nã', 'minh oan', 'nộp phạt', 'được tha', 'huỷ lệnh bắt'])))
    if (!ok) reject(rejected, 'wanted', entry, 'chính văn chưa xác nhận mức truy nã thay đổi')
    return ok
  })
  next.legendaryAccess = (parsed?.legendaryAccess ?? []).filter((entry) => {
    const eventOk = linkedSentenceEvidence(prose, entry.species,
      ['triệu hồi', 'đáp lại', 'thức tỉnh', 'hiện thân', 'xuất hiện', 'cánh cổng', 'nghi thức', 'di vật'],
      { maxDistance: 1 })
    const reasonOk = !entry.reason || words(entry.reason).filter((token) => token.length >= 4)
      .some((token) => phraseRegex(token)?.test(fold(prose)))
    const ok = Boolean(eventOk && reasonOk && legendaryContextIsValid(entry, prose, options))
    if (!ok) reject(rejected, 'legendaryAccess', entry, `chính văn chưa xác nhận điều kiện triệu hồi/cuộc gặp ${entry.species}`)
    return ok
  })
  next.collectionAwards = (parsed?.collectionAwards ?? []).filter((entry) => {
    const ok = linkedSentenceEvidence(prose, [entry.target, entry.name], ['ribbon', 'ruy băng', 'mark', 'dấu ấn', 'trao', 'nhận được'], { allowGeneric: true })
    if (!ok) reject(rejected, entry.kind, entry, `chính văn chưa xác nhận ${entry.target} nhận ${entry.name}`)
    return ok
  })

  // Model chính và API phụ đôi lúc lặp nguyên một tag trong cùng câu trả
  // lời. Cùng một bằng chứng chính văn chỉ được đổi biến một lần; nếu thật
  // sự có hai sự kiện, model phải gộp delta/số lượng (VD ITEM x2, FRIEND +10).
  next.pokemons = dedupeEntries(next.pokemons, 'pokemon', rejected)
  next.levels = dedupeEntries(next.levels, 'level', rejected)
  next.evolutions = dedupeEntries(next.evolutions, 'evolve', rejected)
  next.items = dedupeEntries(next.items, 'item', rejected)
  next.loots = dedupeEntries(next.loots, 'loot', rejected)
  next.moveDirectives = dedupeEntries(next.moveDirectives, 'move', rejected)
  next.moves = next.moveDirectives.map((entry) => entry.place)
  next.equipment = dedupeEntries(next.equipment, 'equipment', rejected)
  next.friendships = dedupeEntries(next.friendships, 'friendship', rejected)
  next.rel = dedupeEntries(next.rel, 'rel', rejected)
  next.body = dedupeEntries(next.body, 'body', rejected)
  next.hunger = dedupeEntries(next.hunger, 'hunger', rejected)
  next.npcs = dedupeEntries(next.npcs, 'npc', rejected)
  next.facts = dedupeEntries(next.facts, 'fact', rejected)
  next.badges = dedupeEntries(next.badges, 'badge', rejected)
  next.quests = dedupeEntries(next.quests, 'quest', rejected)
  next.reputations = dedupeEntries(next.reputations, 'rep', rejected)
  next.wanted = dedupeEntries(next.wanted, 'wanted', rejected)
  next.legendaryAccess = dedupeEntries(next.legendaryAccess, 'legendaryAccess', rejected)
  next.collectionAwards = dedupeEntries(next.collectionAwards, 'collection', rejected)
  if (parsed?.pokecenter) {
    const named = parsed.pokecenter.name && parsed.pokecenter.name !== 'Trung tâm Pokémon'
      ? mentions(prose, parsed.pokecenter.name) : true
    const insidePatterns = [...CENTER_INSIDE, 'qua cửa trung tâm pokemon', 'cửa trung tâm khép sau lưng', 'cửa kính khép sau lưng', 'tới quầy y tá', 'tiến đến quầy y tá', 'đứng trong sảnh']
    const inside = storySentences(prose).some((line) => Boolean(completedActionClause(line, insidePatterns)))
    if (!named || !inside) {
      reject(rejected, 'pokecenter', parsed.pokecenter, 'chính văn chưa xác nhận nhân vật đang ở bên trong Trung tâm Pokémon')
      next.pokecenter = null
    }
  }

  const moneyEntries = parsed?.moneyEntries?.length
    ? parsed.moneyEntries
    : parsed?.money ? [parsed.money] : []
  // API phụ xét cùng chính văn sau luồng chính. Khởi tạo số bằng chứng đã
  // tiêu để một giao dịch không bị áp hai lần, nhưng hai lần trả cùng 500
  // vẫn có thể dùng hai bằng chứng độc lập.
  const priorMoneyEntries = options.alreadyApplied?.moneyEntries?.length
    ? options.alreadyApplied.moneyEntries
    : options.alreadyApplied?.money ? [options.alreadyApplied.money] : []
  const usedMoneyEvidence = new Map()
  for (const value of priorMoneyEntries) {
    const key = Number(value)
    usedMoneyEvidence.set(key, (usedMoneyEvidence.get(key) ?? 0) + 1)
  }
  next.moneyEntries = moneyEntries.filter((value) => {
    const key = Number(value)
    const available = transactionEvidenceCount(prose, key)
    const used = usedMoneyEvidence.get(key) ?? 0
    const ok = used < available
    if (ok) usedMoneyEvidence.set(key, used + 1)
    else reject(rejected, 'money', { value }, `chính văn chưa xác nhận đủ số lần giao dịch ${value > 0 ? '+' : ''}${value} tiền`)
    return ok
  })
  next.money = next.moneyEntries.reduce((sum, value) => sum + Number(value || 0), 0)

  return { parsed: next, rejected }
}

export function describeRejectedState(rejected = []) {
  return rejected.map((entry) => `⚠ KHÔNG ÁP ${entry.type.toUpperCase()}: ${entry.reason}`)
}
