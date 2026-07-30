// ============ LỰA CHỌN HÀNH ĐỘNG THEO CHƯƠNG TRUYỆN (đợt 79) ============
// Các preset ngoài SillyTavern dùng nhiều định dạng khác nhau: <choice>,
// <selection>, <details> + [Tùy chọn N · Nhãn]... App phải bóc được hết,
// nhưng tuyệt đối không để scaffold lựa chọn lẫn vào chính văn.

export const ACTION_CHOICES_INSTRUCTION = `LỰA CHỌN HÀNH ĐỘNG CHO NGƯỜI CHƠI (bắt buộc sau mỗi lượt kể bình thường):
- Sau khi hoàn tất CHÍNH VĂN và các tag trạng thái, xuất thêm đúng một khối <actions>...</actions>. Nếu preset dùng <content>, đặt <actions> SAU </content>, không nhét vào chính văn.
- Tạo 4 lựa chọn bằng tiếng Việt, bám sát đúng tình huống vừa xảy ra và tính cách/thân phận của người chơi. Mỗi lựa chọn phải là hành động hoặc lời nói có thể gửi ngay ở lượt sau; không phải lời bình luận về truyện.
- Bốn hướng phải khác nhau rõ: A thận trọng/quan sát; B chủ động thúc đẩy cốt truyện; C tương tác với NPC hoặc Pokémon; D sáng tạo, mạo hiểm hoặc tấu hài nhưng vẫn hợp logic cảnh.
- Không dùng kiến thức mà nhân vật chưa biết. Không quyết định phản ứng/kết quả thay NPC, không tự tuyên bố hành động đã thành công, không ép người chơi phạm luật game.
- Viết gọn, cụ thể, mỗi lựa chọn 1-2 câu; có thể kèm lời thoại trong dấu ngoặc kép.
- Nếu lượt đang dừng tại [[BATTLE]], đang chờ mua hàng, chữa trị hoặc dùng máy PC thì KHÔNG tạo lựa chọn vì app đã có nút tương tác riêng.
Định dạng duy nhất:
<actions>
[A|Thận trọng] Nội dung hành động
[B|Chủ động] Nội dung hành động
[C|Kết nối] Nội dung hành động
[D|Sáng tạo] Nội dung hành động
</actions>
Khối này chỉ là dữ liệu cho giao diện; không nhắc tới các quy tắc trên trong chính văn.`

const DEFAULT_LABELS = ['Thận trọng', 'Chủ động', 'Kết nối', 'Sáng tạo', 'Khám phá', 'Chuyển tiếp']
const MAX_CHOICES = 6

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

function normalizeLabel(label, index) {
  const cleaned = cleanText(label)
    .replace(/^tùy\s*chọn\s*\d+\s*[·:|\-–—]?\s*/i, '')
    .replace(/^[A-F](?:\s*[·:|\-–—]\s*|\s+)/i, '')
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

  // Bỏ các tiền tố mô tả chức năng nhưng giữ nguyên hành động thực tế.
  text = text
    .replace(/^(?:nội dung\s+tùy\s*chọn|tùy\s*chọn\s*(?:hành\s*động)?\s*[:：])\s*/i, '')
    .trim()

  if (text.length < 6) return null
  if (text.length > 420) text = `${text.slice(0, 417).trimEnd()}…`
  return { label: normalizeLabel(label, index), text }
}

function parseBlock(block) {
  const normalized = String(block ?? '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>|<\/li>/gi, '\n')
    .replace(/<p[^>]*>|<li[^>]*>/gi, '')

  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const parsed = []

  for (const line of lines) {
    let match = line.match(/^\[\s*(?:tùy\s*chọn\s*)?(\d+|[A-F])\s*(?:[·|]\s*([^\]]+))?\]\s*(.+)$/i)
    if (match) {
      const item = splitLabelAndText(match[3], parsed.length)
      if (item) parsed.push({ ...item, label: normalizeLabel(match[2] || item.label, parsed.length) })
      continue
    }

    match = line.match(/^\[\s*([A-F])\s*\|\s*([^\]]+)\]\s*(.+)$/i)
    if (match) {
      const item = splitLabelAndText(match[3], parsed.length)
      if (item) parsed.push({ ...item, label: normalizeLabel(match[2], parsed.length) })
      continue
    }

    match = line.match(/^(?:tùy\s*chọn\s*)?(\d+|[A-F])\s*[.)、:：-]\s*(.+)$/i)
    if (match) {
      const item = splitLabelAndText(match[2], parsed.length)
      if (item) parsed.push(item)
      continue
    }

    // Dự phòng cho danh sách markdown "- hành động" trong đúng block choices.
    match = line.match(/^[-–—•]\s+(.+)$/)
    if (match) {
      const item = splitLabelAndText(match[1], parsed.length)
      if (item) parsed.push(item)
    }
  }

  return parsed
}

function collectBlocks(raw) {
  const text = String(raw ?? '')
  const blocks = []
  const tagged = /<(actions?|action_choices?|choices?|choice|selection)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi
  let match
  while ((match = tagged.exec(text)) !== null) blocks.push(match[2])

  // Ako: <details><summary>🌟 Tùy chọn hành động</summary>...</details>
  const details = /<details\b[^>]*>\s*<summary\b[^>]*>[^<]*(?:tùy\s*chọn|lựa\s*chọn)[^<]*<\/summary>([\s\S]*?)<\/details>/gi
  while ((match = details.exec(text)) !== null) blocks.push(match[1])

  // Model đôi khi quên thẻ đóng nhưng vẫn xuất đúng các dòng [A|...].
  if (!blocks.length) {
    const loose = text.match(/(?:^|\n)\s*(?:\[\s*(?:tùy\s*chọn\s*)?(?:\d+|[A-F])(?:\s*[·|][^\]]+)?\]|(?:\d+|[A-F])\s*[.)、:：-])[^\n]*(?:\n\s*(?:\[\s*(?:tùy\s*chọn\s*)?(?:\d+|[A-F])(?:\s*[·|][^\]]+)?\]|(?:\d+|[A-F])\s*[.)、:：-])[^\n]*){2,}/i)
    if (loose) blocks.push(loose[0])
  }
  return blocks
}

export function extractActionChoices(raw) {
  if (!raw) return []
  const all = collectBlocks(raw).flatMap(parseBlock)
  const seen = new Set()
  const out = []
  for (const item of all) {
    const key = item.text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({ id: String.fromCharCode(65 + out.length), label: item.label, text: item.text })
    if (out.length >= MAX_CHOICES) break
  }
  return out
}

/** Gỡ mọi block lựa chọn khỏi văn bản hiển thị nhưng giữ chính văn xung quanh. */
export function stripActionChoiceBlocks(text) {
  if (!text) return text
  return String(text)
    .replace(/<(actions?|action_choices?|choices?|choice|selection)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<details\b[^>]*>\s*<summary\b[^>]*>[^<]*(?:tùy\s*chọn|lựa\s*chọn)[^<]*<\/summary>[\s\S]*?<\/details>/gi, '')
    // Model đôi khi quên cả thẻ bọc. Chỉ gỡ một cụm lựa chọn nằm CUỐI bài
    // và có ít nhất 3 dòng A/B/C... hoặc [Tùy chọn ...], tránh ăn nhầm danh
    // sách đánh số bình thường trong chính văn.
    .replace(/(?:\n|^)(?:\s*(?:\[\s*(?:tùy\s*chọn\s*)?(?:\d+|[A-F])(?:\s*[·|][^\]]+)?\]|[A-F]\s*[.)、:：-])[^\n]*(?:\n|$)){3,}\s*$/i, '')
}
