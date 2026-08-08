// ============ LỰA CHỌN HÀNH ĐỘNG THEO CHƯƠNG TRUYỆN (đợt 100) ============
// Chỉ coi một block là "lựa chọn hành động" khi nó thực sự mang ngữ nghĩa
// hành động cho người chơi. Preset SillyTavern thường dùng <selection>/<choice>
// cho scaffold văn phong, hướng truyện, phân đoạn... Nếu parser vơ tất cả các
// block đó thì UI sẽ hiện các câu kiểu "Góc nhìn", "Tag trạng thái" thay cho
// hành động. Vì vậy parser mới dùng whitelist + bộ lọc semantic fail-closed.

export const ACTION_CHOICES_INSTRUCTION = `LỰA CHỌN HÀNH ĐỘNG CHO NGƯỜI CHƠI (bắt buộc sau mỗi lượt kể bình thường):
- Sau khi hoàn tất CHÍNH VĂN, xuất thêm đúng một khối <actions>...</actions>. Nếu preset dùng <content>, đặt <actions> SAU </content>, không nhét vào chính văn.
- Tạo đúng 4 lựa chọn bằng tiếng Việt, bám sát đúng tình huống vừa xảy ra và tính cách/thân phận của người chơi. Mỗi lựa chọn phải là hành động hoặc lời nói có thể gửi ngay ở lượt sau; không phải lời bình luận về truyện, quy tắc prompt hay chỉ dẫn văn phong.
- Bốn hướng phải khác nhau rõ: A thận trọng/quan sát; B chủ động thúc đẩy cốt truyện; C tương tác với NPC hoặc Pokémon; D sáng tạo, mạo hiểm hoặc tấu hài nhưng vẫn hợp logic cảnh.
- Không dùng kiến thức mà nhân vật chưa biết. Không quyết định phản ứng/kết quả thay NPC, không tự tuyên bố hành động đã thành công, không ép người chơi phạm luật game.
- Viết gọn, cụ thể, mỗi lựa chọn 1-2 câu; có thể kèm lời thoại trong dấu ngoặc kép.
- Tuyệt đối không đưa các câu kiểu "góc nhìn", "văn phong", "phân đoạn", "tag trạng thái", "định hướng câu chuyện", "quy tắc", "prompt" vào lựa chọn.
- Nếu lượt đang dừng tại [[BATTLE]], đang chờ mua hàng, chữa trị hoặc dùng máy PC thì KHÔNG tạo lựa chọn vì app đã có nút tương tác riêng.
Định dạng duy nhất:
<actions>
[A|Thận trọng] Nội dung hành động
[B|Chủ động] Nội dung hành động
[C|Kết nối] Nội dung hành động
[D|Sáng tạo] Nội dung hành động
</actions>
Khối này chỉ là dữ liệu cho giao diện; không nhắc tới các quy tắc trên trong chính văn.`

const DEFAULT_LABELS = ['Thận trọng', 'Chủ động', 'Kết nối', 'Sáng tạo']
const REQUIRED_CHOICES = 4
const TRUSTED_ACTION_TAG = /<(actions?|action_choices?|actionchoices|player_actions?)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi
const LEGACY_GENERIC_TAG = /<(choices?|selection)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi

function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function cleanText(text) {
  return decodeEntities(text)
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<[^>]+>/g, '')
    // Không cho tag điều khiển state đi ngược vào ô nhập qua nút gợi ý.
    .replace(/\[\[[^\]\n]+\]\]/g, '')
    .replace(/^\s*[-–—•]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function fold(text) {
  return cleanText(text)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/đ/g, 'd')
}

function normalizeLabel(label, index) {
  const cleaned = cleanText(label)
    .replace(/^tùy\s*chọn\s*\d+\s*[·:|\-–—]?\s*/i, '')
    .replace(/^[A-D](?:\s*[·:|\-–—]\s*|\s+)/i, '')
    .trim()
  return cleaned.slice(0, 28) || DEFAULT_LABELS[index] || `Lựa chọn ${index + 1}`
}

function splitLabelAndText(body, index) {
  let text = cleanText(body)
  if (!text) return null

  // Một số preset viết "Thúc đẩy cốt truyện bình thường - hành động cụ thể".
  // Chỉ tách nhãn khi phần trước ngắn, tránh cắt nhầm dấu gạch trong câu.
  const dash = text.match(/^([^\n]{2,42}?)\s+[\-–—:]\s+(.{6,})$/)
  let label = DEFAULT_LABELS[index]
  if (dash) {
    label = dash[1]
    text = dash[2]
  }

  text = text
    .replace(/^(?:nội dung\s+tùy\s*chọn|tùy\s*chọn\s*(?:hành\s*động)?\s*[:：])\s*/i, '')
    .trim()

  if (text.length < 6) return null
  if (text.length > 420) text = `${text.slice(0, 417).trimEnd()}…`
  return { label: normalizeLabel(label, index), text }
}

/**
 * Những cụm này là scaffold/prompt chứ không phải hành động của nhân vật.
 * Danh sách cố tình chỉ chặn tín hiệu meta mạnh; không chặn từ phổ thông như
 * "không" để các lựa chọn kiểu "Không vội đáp, quan sát..." vẫn hợp lệ.
 */
export function isActionChoiceMetaScaffold(value) {
  const text = fold(value)
  if (!text) return true
  const metaPatterns = [
    /\btag trang thai\b/, /\bstate tags?\b/, /\bdinh huong cau chuyen\b/,
    /\bstory direction\b/, /\bphan doan\b/, /\bgoc nhin\b/, /\bpoint of view\b/,
    /\bvan phong\b/, /\bnhac nen\b/, /\bnhip ke\b/, /\bchinh van\b/,
    /\bprompt\b/, /\bsystem message\b/, /\bmetadata\b/, /\btemperature\b/,
    /\bmax tokens?\b/, /\bdinh dang dau ra\b/, /\bquy tac cap nhat\b/,
    /\bquy tac viet\b/, /\bkhong dung tu\b/, /\bkhong nhac toi quy tac\b/,
    /\btao (?:dung )?4 lua chon\b/, /\blua chon hanh dong cho nguoi choi\b/,
    /\bdo sau\b.*\bpreset\b/, /\bregex\b.*\bpreset\b/,
  ]
  return metaPatterns.some((pattern) => pattern.test(text))
}

export function isUsableActionChoice(choice) {
  if (!choice?.text || isActionChoiceMetaScaffold(choice.text)) return false
  const text = cleanText(choice.text)
  if (text.length < 6 || text.length > 420) return false
  // JSON/XML/prompt fragment không phải input nhập vai có thể gửi trực tiếp.
  if (/^\s*[<{][\s\S]*[>}]\s*$/.test(text)) return false
  if (/^\s*(?:system|assistant|user)\s*:/i.test(text)) return false
  return true
}

function parseBlock(block) {
  const normalized = String(block ?? '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>|<\/li>/gi, '\n')
    .replace(/<p[^>]*>|<li[^>]*>/gi, '')

  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const parsed = []

  for (const line of lines) {
    let match = line.match(/^\[\s*(?:tùy\s*chọn\s*)?(\d+|[A-D])\s*(?:[·|]\s*([^\]]+))?\]\s*(.+)$/i)
    if (match) {
      const item = splitLabelAndText(match[3], parsed.length)
      if (item) parsed.push({ ...item, label: normalizeLabel(match[2] || item.label, parsed.length) })
      continue
    }

    match = line.match(/^\[\s*([A-D])\s*\|\s*([^\]]+)\]\s*(.+)$/i)
    if (match) {
      const item = splitLabelAndText(match[3], parsed.length)
      if (item) parsed.push({ ...item, label: normalizeLabel(match[2], parsed.length) })
      continue
    }

    match = line.match(/^(?:tùy\s*chọn\s*)?(\d+|[A-D])\s*[.)、:：-]\s*(.+)$/i)
    if (match) {
      const item = splitLabelAndText(match[2], parsed.length)
      if (item) parsed.push(item)
      continue
    }

    // Dự phòng markdown chỉ trong một block action đã xác thực.
    match = line.match(/^[-–—•]\s+(.+)$/)
    if (match) {
      const item = splitLabelAndText(match[1], parsed.length)
      if (item) parsed.push(item)
    }
  }

  return parsed
}

function hasExplicitActionMarkers(block) {
  const text = String(block ?? '')
  const matches = text.match(/^\s*\[\s*[A-D]\s*\|[^\]]+\]/gim) ?? []
  return matches.length >= 3
}

function collectBlocks(raw) {
  const text = String(raw ?? '')
  const blocks = []
  let match

  TRUSTED_ACTION_TAG.lastIndex = 0
  while ((match = TRUSTED_ACTION_TAG.exec(text)) !== null) blocks.push(match[2])

  // Ako/Tawa đôi khi bọc UI action bằng <details> có summary rõ nghĩa.
  const details = /<details\b[^>]*>\s*<summary\b[^>]*>[^<]*(?:tùy\s*chọn\s*hành\s*động|lựa\s*chọn\s*hành\s*động|action choices?)[^<]*<\/summary>([\s\S]*?)<\/details>/gi
  while ((match = details.exec(text)) !== null) blocks.push(match[1])

  // Tương thích preset cũ: <selection>/<choice> CHỈ được nhận nếu block dùng
  // marker [A|Nhãn] rõ ràng. Không còn coi mọi <selection> là action nữa.
  LEGACY_GENERIC_TAG.lastIndex = 0
  while ((match = LEGACY_GENERIC_TAG.exec(text)) !== null) {
    const attrs = String(match[2] ?? '')
    const body = match[3]
    if (/\b(?:type|kind|role)\s*=\s*["']?(?:action|actions|player-action)/i.test(attrs)
      || hasExplicitActionMarkers(body)) blocks.push(body)
  }

  // Model quên thẻ bọc: chỉ nhận cụm [A|...]/[B|...]...; không còn nhận
  // danh sách A. hoặc 1. chung vì preset rất hay dùng dạng đó cho scaffold.
  if (!blocks.length) {
    const loose = text.match(/(?:^|\n)\s*\[\s*A\s*\|[^\]]+\][^\n]*(?:\n\s*\[\s*[B-D]\s*\|[^\]]+\][^\n]*){2,3}/i)
    if (loose) blocks.push(loose[0])
  }
  return blocks
}

function normalizeActionChoices(items) {
  const seen = new Set()
  const out = []
  for (const item of items) {
    if (!isUsableActionChoice(item)) continue
    const key = item.text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({
      id: String.fromCharCode(65 + out.length),
      label: normalizeLabel(item.label, out.length),
      text: cleanText(item.text),
    })
    if (out.length >= REQUIRED_CHOICES) break
  }
  // Fail closed: 1-3 lựa chọn lẻ thường là parser ăn nhầm scaffold. Lúc này
  // RoleplayChat sẽ gọi API chuyên sinh lựa chọn thay vì đem rác lên UI.
  return out.length === REQUIRED_CHOICES ? out : []
}

export function extractActionChoices(raw) {
  if (!raw) return []
  return normalizeActionChoices(collectBlocks(raw).flatMap(parseBlock))
}

function legacyBlockIsRealAction(body, attrs = '') {
  if (!(/\b(?:type|kind|role)\s*=\s*["']?(?:action|actions|player-action)/i.test(attrs)
    || hasExplicitActionMarkers(body))) return false
  return normalizeActionChoices(parseBlock(body)).length === REQUIRED_CHOICES
}

function legacyBlockIsMetaScaffold(body) {
  const parsed = parseBlock(body)
  if (parsed.length >= 2) {
    const metaCount = parsed.filter((item) => isActionChoiceMetaScaffold(item.text)).length
    if (metaCount >= Math.ceil(parsed.length * 0.6)) return true
  }
  return isActionChoiceMetaScaffold(body)
}

/** Gỡ block lựa chọn thật khỏi văn bản hiển thị nhưng KHÔNG đụng scaffold preset. */
export function stripActionChoiceBlocks(text) {
  if (!text) return text
  let output = String(text)
    .replace(/<(actions?|action_choices?|actionchoices|player_actions?)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<details\b[^>]*>\s*<summary\b[^>]*>[^<]*(?:tùy\s*chọn\s*hành\s*động|lựa\s*chọn\s*hành\s*động|action choices?)[^<]*<\/summary>[\s\S]*?<\/details>/gi, '')

  // Generic <selection>/<choice> có thể là prompt scaffold. Chỉ xóa khi
  // chính nội dung của block vượt qua parser action nghiêm ngặt.
  output = output.replace(/<(choices?|selection)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi, (whole, _tag, attrs, body) => (
    legacyBlockIsRealAction(body, attrs) || legacyBlockIsMetaScaffold(body) ? '' : whole
  ))

  // Loose fallback cũng chỉ xóa khi parse được đủ 4 action thật.
  const looseTail = output.match(/(?:^|\n)\s*\[\s*A\s*\|[^\]]+\][^\n]*(?:\n\s*\[\s*[B-D]\s*\|[^\]]+\][^\n]*){3}\s*$/i)
  if (looseTail && normalizeActionChoices(parseBlock(looseTail[0])).length === REQUIRED_CHOICES) {
    output = output.slice(0, looseTail.index).trimEnd()
  }
  return output
}
