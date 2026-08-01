// Đọc "Chat Completion Preset" chuẩn SillyTavern (.json) — dùng làm preset
// cho API CHÍNH (viết chính văn). Preset dạng này gồm:
// - `prompts`: mảng các block { identifier, name, enabled, marker, content, role }
// - `prompt_order`: thứ tự + trạng thái bật/tắt THẬT SỰ sẽ dùng (ưu tiên hơn
//   thứ tự xuất hiện trong `prompts`, vì 1 preset có thể được sắp lại thứ tự
//   theo từng nhân vật)
// - các tham số sinh (temperature, top_p, openai_max_tokens...)
//
// 8 marker cố định của SillyTavern (worldInfoBefore, charDescription,
// personaDescription, charPersonality, scenario, worldInfoAfter,
// dialogueExamples, chatHistory) là vị trí chèn dữ liệu ĐỘNG — app này tự
// thay bằng dữ liệu tương ứng (character.description, lorebook đang kích
// hoạt, lịch sử chat...) thay vì để trống.

// Chỉ chặn số thật sự vô lý (VD gõ nhầm thêm số 0), không chặn mức cao hợp lý
// như 100000 — preset kiểu CoT (chuỗi suy nghĩ nhiều giai đoạn) cần trần cao
// vì phần suy nghĩ tốn phần lớn token trước khi ra tới chính văn, giống hệt
// cách SillyTavern để 100k mà chính văn thực tế chỉ ra ~4-6k chữ.
const MAX_SAFE_TOKENS = 200000

function normalizeOrder(data) {
  const byId = new Map(data.prompts.map((p) => [p.identifier, p]))
  const orderEntry = data.prompt_order?.[0]?.order

  const sequence = orderEntry
    ? orderEntry.map((o) => ({ identifier: o.identifier, enabled: o.enabled }))
    : data.prompts.map((p) => ({ identifier: p.identifier, enabled: p.enabled }))

  return sequence
    .map(({ identifier, enabled }) => {
      const block = byId.get(identifier)
      if (!block) return null
      return {
        identifier,
        name: block.name || identifier,
        marker: Boolean(block.marker),
        content: block.content || '',
        enabled: enabled !== false && block.enabled !== false,
      }
    })
    .filter(Boolean)
}

// Chuyển 1 chuỗi regex literal kiểu JS ("/pattern/flags") thành RegExp thật.
// Trả về null nếu không parse được (regex lỗi, tránh crash cả app).
export function parseRegexLiteral(str) {
  if (typeof str !== 'string' || !str.trim()) return null
  const source = str.trim()
  let pattern = source
  let flags = 'g'
  // SillyTavern chấp nhận cả literal `/.../gi` lẫn chuỗi regex trần.
  // Nhiều preset Trung/Việt dùng dạng trần, trước đây app âm thầm bỏ qua.
  if (source.startsWith('/')) {
    const lastSlash = source.lastIndexOf('/')
    if (lastSlash <= 0) return null
    pattern = source.slice(1, lastSlash)
    flags = source.slice(lastSlash + 1).trim()
  }
  flags = [...new Set(`${flags}g`.split('').filter((flag) => 'dgimsuvy'.includes(flag)))].join('')
  try {
    return new RegExp(pattern, flags)
  } catch {
    return null
  }
}

// Preset có thể nhúng 1 bộ regex xử lý output riêng (không phải "prompts" viết
// cho AI, mà là find/replace áp lên CHÍNH output của AI) — dưới dạng 1 prompt
// đặc biệt identifier "SPresetSettings" chứa JSON con `RegexBinding.regexes`.
// Đọc ra để người dùng tự bật/tắt từng script trong trang Cài đặt.
function extractRegexScripts(data) {
  const candidates = []
  if (Array.isArray(data.extensions?.regex_scripts)) candidates.push(...data.extensions.regex_scripts)
  const settingsBlock = data.prompts.find((p) => p.identifier === 'SPresetSettings')
  if (settingsBlock?.content) {
    try {
      const inner = JSON.parse(settingsBlock.content)
      if (Array.isArray(inner?.RegexBinding?.regexes)) candidates.push(...inner.RegexBinding.regexes)
    } catch {
      // Preset vẫn dùng được dù block thiết lập phụ bị hỏng JSON.
    }
  }
  const seen = new Set()
  return candidates
    .map((r) => {
      const regex = parseRegexLiteral(r.findRegex)
      if (!regex) return null
      const dedupeKey = r.id ? `id:${r.id}` : `${r.scriptName ?? ''}|${r.findRegex}|${r.replaceString ?? ''}`
      if (seen.has(dedupeKey)) return null
      seen.add(dedupeKey)
      const replaceString = r.replaceString ?? ''
      // Script "làm đẹp" thường chèn HTML/CSS dài (<style>, <div>...) — app
      // này hiện chỉ render text thuần (.story-text), chưa render HTML, nên
      // mặc định TẮT các script dạng này dù preset gốc có bật hay không, để
      // tránh in nguyên khối HTML/CSS thô vào giữa truyện. Vẫn hiện trong danh
      // sách để bạn tự bật lại nếu muốn (VD sau này app hỗ trợ render HTML).
      const isDecorative = /<style|<div|<button|class="/i.test(replaceString)
      return {
        id: r.id || r.scriptName || `regex-${seen.size}`,
        scriptName: r.scriptName || r.id || `Regex ${seen.size}`,
        findRegexRaw: r.findRegex,
        replaceString,
        placement: Array.isArray(r.placement) ? r.placement.map(Number).filter(Number.isFinite) : [2],
        minDepth: r.minDepth !== null && r.minDepth !== undefined && r.minDepth !== '' && Number.isFinite(Number(r.minDepth)) ? Number(r.minDepth) : null,
        maxDepth: r.maxDepth !== null && r.maxDepth !== undefined && r.maxDepth !== '' && Number.isFinite(Number(r.maxDepth)) ? Number(r.maxDepth) : null,
        markdownOnly: Boolean(r.markdownOnly),
        promptOnly: Boolean(r.promptOnly),
        isDecorative,
        enabled: !r.disabled && !isDecorative,
      }
    })
    .filter(Boolean)
}

function isInDepth(script, depth) {
  if (script.minDepth !== null && depth < script.minDepth) return false
  if (script.maxDepth !== null && depth > script.maxDepth) return false
  return true
}

/** Áp regex đúng phạm vi SillyTavern: placement 1=user, 2=assistant. */
export function applyPresetRegex(text, scripts, { phase = 'display', role = 'assistant', depth = 0 } = {}) {
  let out = String(text ?? '')
  const placement = role === 'user' ? 1 : 2
  for (const script of scripts ?? []) {
    if (!script?.enabled || !isInDepth(script, depth)) continue
    const legacyScript = script.promptOnly === undefined && script.markdownOnly === undefined
      && script.placement === undefined && script.minDepth === undefined && script.maxDepth === undefined
    // Save từ bản cũ chỉ lưu regex output, không lưu scope. Không được tự
    // đem chúng sang sửa prompt vì có thể xoá input. Nạp lại preset sẽ có đủ
    // metadata mới và chạy đúng cả hai pha.
    if (phase === 'prompt' && legacyScript) continue
    if (script.placement?.length && !script.placement.includes(placement)) continue
    // promptOnly: chỉ sửa bản gửi model; markdownOnly: chỉ sửa bản hiển thị.
    // Cả hai false nghĩa là dùng được ở cả hai pha như SillyTavern.
    if (phase === 'display' && script.promptOnly && !script.markdownOnly) continue
    if (phase === 'prompt' && script.markdownOnly && !script.promptOnly) continue
    const regex = parseRegexLiteral(script.findRegexRaw)
    if (!regex) continue
    try { out = out.replace(regex, script.replaceString ?? '') } catch { /* bỏ regex preset lỗi */ }
  }
  return out
}

/** Chạy regex lịch sử mà không cho preset xoá mất input mới nhất của người chơi. */
export function applyPresetRegexToMessages(messages, scripts) {
  const eligible = messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) =>
      (message?.role === 'user' || message?.role === 'assistant')
      && !String(message.content ?? '').startsWith('[Hệ thống'),
    )
  const depthByIndex = new Map(eligible.slice().reverse().map(({ index }, depth) => [index, depth]))
  return messages.map((message, index) => {
    if (!depthByIndex.has(index) || String(message.content ?? '').startsWith('[Hệ thống')) return message
    const depth = depthByIndex.get(index)
    const original = String(message.content ?? '')
    let content = applyPresetRegex(original, scripts, { phase: 'prompt', role: message.role, depth })
    // Lịch sử cũ được phép bị preset rút gọn; riêng user input mới nhất là dữ
    // liệu bất khả mất. Nếu regex dọn lịch sử nuốt nó, bọc lại theo giao thức chung.
    if (message.role === 'user' && depth === 0 && !content.trim() && original.trim()) {
      content = `<user_input>\n${original}\n</user_input>`
    }
    return { ...message, content }
  })
}

export async function importMainPreset(file) {
  const text = await file.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('File JSON không hợp lệ (parse thất bại).')
  }
  if (!Array.isArray(data.prompts)) {
    throw new Error('File này không có mảng "prompts" — không đúng định dạng Chat Completion Preset.')
  }

  const blocks = normalizeOrder(data)

  const meta = {
    temperature: typeof data.temperature === 'number' ? data.temperature : undefined,
    maxTokens:
      typeof data.openai_max_tokens === 'number'
        ? Math.min(data.openai_max_tokens, MAX_SAFE_TOKENS)
        : undefined,
    assistantPrefill: typeof data.assistant_prefill === 'string' ? data.assistant_prefill : '',
  }

  const regexScripts = extractRegexScripts(data)

  return { fileName: file.name, blocks, meta, regexScripts }
}

// --- Engine xử lý macro {{setvar::name::value}} / {{getvar::name}} / {{trim}} ---
//
// Nhiều preset (như của bạn) dùng {{setvar}} ở 1 block để "khai báo biến",
// rồi {{getvar}} ở block khác để lấy lại giá trị đó — đúng kiểu STscript của
// SillyTavern. Bản dưới đây hỗ trợ 2 lệnh phổ biến nhất: setvar/setglobalvar
// (gán) và getvar (lấy). CHƯA hỗ trợ các lệnh STscript khác (if, random,
// pick, add...) — nếu preset dùng thêm các lệnh đó, phần nội dung liên quan
// sẽ giữ nguyên dạng {{...}} thô thay vì được xử lý.
export function resolveSetvarMacros(text) {
  const vars = {}
  const setterRegex = /\{\{(?:setvar|setglobalvar)::([a-zA-Z0-9_]+)::([\s\S]*?)\}\}/g

  let withoutSetters = text.replace(setterRegex, (_match, name, value) => {
    vars[name] = value
    return ''
  })

  const getterRegex = /\{\{getvar::([a-zA-Z0-9_]+)\}\}/g
  let resolved = withoutSetters
  // Lặp vài vòng để xử lý trường hợp 1 biến chứa {{getvar}} tới biến khác.
  for (let i = 0; i < 4; i++) {
    const next = resolved.replace(getterRegex, (_match, name) => vars[name] ?? '')
    if (next === resolved) break
    resolved = next
  }

  resolved = resolved.replace(/\{\{trim\}\}/g, '')
  resolved = resolved.replace(/\n{3,}/g, '\n\n').trim()
  return resolved
}

const CHAT_HISTORY_SENTINEL = '\u0000__CHAT_HISTORY__\u0000'

/**
 * Ghép các block đã bật theo đúng thứ tự thành 1 chuỗi, thay marker bằng dữ
 * liệu động tương ứng, xử lý macro setvar/getvar, rồi cắt tại vị trí
 * "chatHistory" marker thành 2 phần:
 * - beforeHistory: dùng làm system prompt chính (system message đầu tiên)
 * - afterHistory: phần hướng dẫn đặt SAU lịch sử chat (kiểu "post-history
 *   instructions"/jailbreak block) — nếu có, app sẽ chèn thành 1 system
 *   message riêng ngay trước lượt gọi AI.
 *
 * @param {Array} blocks kết quả từ importMainPreset(...).blocks
 * @param {{charDescription, personaDescription, charPersonality, scenario, worldInfoBefore, worldInfoAfter, dialogueExamples}} dynamic
 */
export function buildPresetPrompt(blocks, dynamic) {
  const markerMap = {
    worldInfoBefore: dynamic.worldInfoBefore ?? '',
    charDescription: dynamic.charDescription ?? '',
    personaDescription: dynamic.personaDescription ?? '',
    charPersonality: dynamic.charPersonality ?? '',
    scenario: dynamic.scenario ?? '',
    worldInfoAfter: dynamic.worldInfoAfter ?? '',
    dialogueExamples: dynamic.dialogueExamples ?? '',
    chatHistory: CHAT_HISTORY_SENTINEL,
  }

  const raw = blocks
    .filter((b) => b.enabled)
    .map((b) => (b.marker ? markerMap[b.identifier] ?? '' : b.content))
    .join('\n\n')

  const commonMacros = raw
    .replace(/\{\{lastUserMessage\}\}/gi, dynamic.lastUserMessage ?? '')
    .replace(/\{\{user\}\}/gi, dynamic.user ?? dynamic.playerName ?? '')
    .replace(/\{\{char\}\}/gi, dynamic.char ?? dynamic.characterName ?? '')
  const resolved = resolveSetvarMacros(commonMacros)

  const idx = resolved.indexOf(CHAT_HISTORY_SENTINEL)
  if (idx === -1) {
    return { beforeHistory: resolved, afterHistory: '' }
  }
  return {
    beforeHistory: resolved.slice(0, idx).trim(),
    afterHistory: resolved.slice(idx + CHAT_HISTORY_SENTINEL.length).trim(),
  }
}
