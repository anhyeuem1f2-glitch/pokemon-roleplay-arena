// Kích hoạt lorebook kiểu "World Info" của SillyTavern: quét văn bản gần đây
// (vài tin nhắn cuối + tin người chơi vừa gửi), nếu chứa 1 trong các "keys"
// của 1 entry thì đưa content của entry đó vào system prompt.
//
// Đây là bản quét từ khoá đơn giản (substring, không phân biệt hoa thường).
// Chưa hỗ trợ: AND/OR nhiều keyword, "constant" entries (luôn bật), recursive
// scan, priority/budget token — có thể nâng cấp sau nếu lorebook lớn.

/**
 * @param {Array<{keys: string[], content: string}>} entries
 * @param {string} scanText
 * @returns {string[]} nội dung các entry được kích hoạt
 */
export function getActiveLoreEntries(entries, scanText) {
  if (!entries?.length || !scanText) return []
  const haystack = scanText.toLowerCase()
  return entries
    .filter((entry) => entry.keys.some((k) => k && haystack.includes(k.toLowerCase())))
    .map((entry) => entry.content)
}

/**
 * Gom N tin nhắn cuối (dạng {role, content}) thành 1 chuỗi để quét từ khoá.
 */
export function buildScanText(messages, extra = '', windowSize = 6) {
  const recent = messages.slice(-windowSize).map((m) => m.content).join('\n')
  return `${recent}\n${extra}`
}
