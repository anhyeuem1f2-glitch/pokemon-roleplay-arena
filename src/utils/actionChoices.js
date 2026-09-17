// ============ LỰA CHỌN HÀNH ĐỘNG THEO CHƯƠNG TRUYỆN (đợt 100) ============
// Chỉ coi một block là "lựa chọn hành động" khi nó thực sự mang ngữ nghĩa
// hành động cho người chơi. Preset SillyTavern thường dùng <selection>/<choice>
// cho scaffold văn phong, hướng truyện, phân đoạn... Nếu parser vơ tất cả các
// block đó thì UI sẽ hiện các câu kiểu "Góc nhìn", "Tag trạng thái" thay cho
// hành động. Vì vậy parser mới dùng whitelist + bộ lọc semantic fail-closed.

const ACTION_LABELS = Object.freeze({
  vi: ['Thận trọng', 'Chủ động', 'Kết nối', 'Sáng tạo'],
  en: ['Cautious', 'Proactive', 'Connect', 'Creative'],
  zh: ['谨慎', '主动', '互动', '创意'],
})

const ACTION_LANGUAGE_NAMES = Object.freeze({
  vi: 'Vietnamese (Tiếng Việt)',
  en: 'English',
  zh: 'Simplified Chinese (简体中文)',
})

function normalizeActionLanguage(language = 'vi') {
  return ACTION_LABELS[language] ? language : 'vi'
}

export function actionChoiceLabel(index, language = 'vi') {
  const lang = normalizeActionLanguage(language)
  return ACTION_LABELS[lang][index] ?? `${String.fromCharCode(65 + index)}`
}

export function buildActionChoicesInstruction(language = 'vi') {
  const lang = normalizeActionLanguage(language)
  const labels = ACTION_LABELS[lang]
  const languageName = ACTION_LANGUAGE_NAMES[lang]
  return `PLAYER ACTION CHOICES — UI LANGUAGE RULE:
- After the narrative, output exactly one <actions>...</actions> block unless the turn is stopped at [[BATTLE]] or waiting for a dedicated shop/heal/PC interaction.
- CHOICE OUTPUT LANGUAGE: ${languageName}. This comes from the language selected in the app UI. It applies ONLY to the <actions> block and overrides the story/preset language inside this block. Do not copy another language from the narrative when the UI language differs.
- Create exactly 4 choices. Each choice must be a concrete action or line the player can send next, grounded in the scene and the player character.
- The four directions must be distinct: A cautious/observe; B proactive/advance the scene; C interact with an NPC or Pokémon; D creative/risky/comedic while remaining logically valid.
- Do not use knowledge the character does not have. Do not decide NPC reactions/results for them. Do not claim success before it happens. Do not invent items, Pokémon or powers the player does not possess.
- Keep each choice concise (1-2 sentences). Never include prompt rules, writing directions, point-of-view notes, state tags, metadata or story-planning commentary.
- The labels are fixed by the UI language. Use these exact labels and do not translate them to the narrative language.
Required format:
<actions>
[A|${labels[0]}] ...
[B|${labels[1]}] ...
[C|${labels[2]}] ...
[D|${labels[3]}] ...
</actions>
The <actions> block is UI data. Do not mention these rules in the narrative.`
}

const DEFAULT_LABELS = ACTION_LABELS.vi
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

function normalizeLabel(_label, index, language = 'vi') {
  // Dot134: the four category labels are UI chrome, not model-authored prose.
  // Always render them in the language selected in the app instead of trusting
  // whatever language the model/preset happened to emit inside [A|...].
  return actionChoiceLabel(index, language)
}

function splitLabelAndText(body, index, language = 'vi') {
  let text = cleanText(body)
  if (!text) return null

  // Một số preset viết "Thúc đẩy cốt truyện bình thường - hành động cụ thể".
  // Chỉ tách nhãn khi phần trước ngắn, tránh cắt nhầm dấu gạch trong câu.
  const dash = text.match(/^([^\n]{2,42}?)\s+[\-–—:]\s+(.{6,})$/)
  const labels = ACTION_LABELS[language] ?? DEFAULT_LABELS
  let label = labels[index]
  if (dash) {
    label = dash[1]
    text = dash[2]
  }

  text = text
    .replace(/^(?:nội dung\s+tùy\s*chọn|tùy\s*chọn\s*(?:hành\s*động)?\s*[:：])\s*/i, '')
    .trim()

  if (text.length < 6) return null
  if (text.length > 420) text = `${text.slice(0, 417).trimEnd()}…`
  return { label: normalizeLabel(label, index, language), text }
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

function parseBlock(block, language = 'vi') {
  const normalized = String(block ?? '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>|<\/li>/gi, '\n')
    .replace(/<p[^>]*>|<li[^>]*>/gi, '')

  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const parsed = []

  for (const line of lines) {
    let match = line.match(/^\[\s*(?:tùy\s*chọn\s*)?(\d+|[A-D])\s*(?:[·|]\s*([^\]]+))?\]\s*(.+)$/i)
    if (match) {
      const item = splitLabelAndText(match[3], parsed.length, language)
      if (item) parsed.push({ ...item, label: normalizeLabel(match[2] || item.label, parsed.length, language) })
      continue
    }

    match = line.match(/^\[\s*([A-D])\s*\|\s*([^\]]+)\]\s*(.+)$/i)
    if (match) {
      const item = splitLabelAndText(match[3], parsed.length, language)
      if (item) parsed.push({ ...item, label: normalizeLabel(match[2], parsed.length, language) })
      continue
    }

    match = line.match(/^(?:tùy\s*chọn\s*)?(\d+|[A-D])\s*[.)、:：-]\s*(.+)$/i)
    if (match) {
      const item = splitLabelAndText(match[2], parsed.length, language)
      if (item) parsed.push(item)
      continue
    }

    // Dự phòng markdown chỉ trong một block action đã xác thực.
    match = line.match(/^[-–—•]\s+(.+)$/)
    if (match) {
      const item = splitLabelAndText(match[1], parsed.length, language)
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

function normalizeActionChoices(items, language = 'vi') {
  const seen = new Set()
  const out = []
  for (const item of items) {
    if (!isUsableActionChoice(item)) continue
    const key = item.text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({
      id: String.fromCharCode(65 + out.length),
      label: normalizeLabel(item.label, out.length, language),
      text: cleanText(item.text),
    })
    if (out.length >= REQUIRED_CHOICES) break
  }
  // Fail closed: 1-3 lựa chọn lẻ thường là parser ăn nhầm scaffold. Lúc này
  // RoleplayChat sẽ gọi API chuyên sinh lựa chọn thay vì đem rác lên UI.
  return out.length === REQUIRED_CHOICES ? out : []
}


const VIETNAMESE_MARKS = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/giu
const HAN_CHARACTERS = /[\u3400-\u9fff\uf900-\ufaff]/gu

function countMatches(text, regex) {
  return String(text ?? '').match(regex)?.length ?? 0
}

/**
 * Fail-closed language guard for model-generated suggestions.
 * It intentionally uses lightweight script/stop-word evidence instead of a
 * remote translator or language API. If the main model ignores the selected
 * UI language, RoleplayChat can discard the block and ask the dedicated
 * action-choice generator to retry in the correct language.
 */
export function actionChoicesMatchLanguage(choices, language = 'vi') {
  if (!Array.isArray(choices) || choices.length !== REQUIRED_CHOICES) return false
  const lang = normalizeActionLanguage(language)
  const text = choices.map((choice) => cleanText(choice?.text)).join(' ').trim()
  if (!text) return false

  const hanCount = countMatches(text, HAN_CHARACTERS)
  const viMarkCount = countMatches(text, VIETNAMESE_MARKS)
  const folded = ` ${fold(text)} `

  if (lang === 'zh') {
    // Four 1-2 sentence Chinese choices should contain clear Han evidence even
    // when Pokémon/proper names remain Latin.
    return hanCount >= 8
  }

  if (lang === 'en') {
    if (hanCount > 0 || viMarkCount > 0) return false
    const englishSignals = countMatches(folded, /\b(?:the|a|an|to|and|with|ask|look|watch|check|try|go|talk|tell|wait|approach|follow|investigate|use|move|stay|help|search|observe)\b/gi)
    return englishSignals >= 3
  }

  if (hanCount > 0) return false
  const vietnameseSignals = countMatches(folded, /\b(?:toi|minh|ban|cau|anh|chi|em|khong|mot|voi|va|de|cho|den|vao|ra|nhin|thu|hoi|noi|danh|choi|doi|tiep|quan sat|kiem tra)\b/gi)
  return viMarkCount >= 2 || vietnameseSignals >= 4
}

export function extractActionChoices(raw, language = 'vi') {
  if (!raw) return []
  return normalizeActionChoices(collectBlocks(raw).flatMap((block) => parseBlock(block, language)), language)
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
