// ============ WORLDBOOK (World Info của SillyTavern) — đợt 41 ============
// Worldbook độc lập (KHÔNG gắn với character card). Nhập từ file .json xuất
// từ SillyTavern (World Info / Lorebook): { entries: { "0": {...}, ... } }.
//
// Mỗi entry (giữ đúng field ST):
//   key[]         — từ khoá chính kích hoạt (OR)
//   keysecondary[]— từ khoá phụ (kết hợp theo selectiveLogic)
//   content       — nội dung nhồi vào prompt khi kích hoạt
//   constant      — luôn bật (không cần khớp từ khoá)
//   disable       — tắt entry
//   selective     — có dùng keysecondary không
//   selectiveLogic— 0 AND ANY / 1 NOT ALL / 2 NOT ANY / 3 AND ALL
//   order         — số càng cao càng ưu tiên (chèn trước)
//   comment       — tên gợi nhớ (hiển thị trong UI)
//   caseSensitive, matchWholeWords — tuỳ chọn khớp

/** Chuẩn hoá 1 worldbook JSON (ST) → mảng entry gọn app dùng. */
export function parseWorldbook(json) {
  const rawEntries = json?.entries
  if (!rawEntries) return { name: json?.name ?? 'Worldbook', entries: [] }
  const list = Array.isArray(rawEntries) ? rawEntries : Object.values(rawEntries)
  const entries = list.map((e, i) => ({
    uid: e.uid ?? i,
    keys: Array.isArray(e.key) ? e.key.filter(Boolean) : [],
    keysecondary: Array.isArray(e.keysecondary) ? e.keysecondary.filter(Boolean) : [],
    content: e.content ?? '',
    constant: Boolean(e.constant),
    disable: Boolean(e.disable),
    selective: Boolean(e.selective),
    selectiveLogic: e.selectiveLogic ?? 0,
    order: typeof e.order === 'number' ? e.order : 100,
    comment: e.comment ?? '',
    caseSensitive: Boolean(e.caseSensitive),
    matchWholeWords: e.matchWholeWords !== false,
  })).filter((e) => e.content.trim())
  return { name: json?.name ?? 'Worldbook', entries }
}

function keyHit(text, key, caseSensitive, wholeWord) {
  const hay = caseSensitive ? text : text.toLowerCase()
  const needle = caseSensitive ? key : key.toLowerCase()
  if (!needle) return false
  if (wholeWord) {
    // Khớp nguyên từ (biên là ký tự không phải chữ/số). An toàn với Unicode cơ bản.
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    try {
      return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, caseSensitive ? 'u' : 'iu').test(hay)
    } catch {
      return hay.includes(needle)
    }
  }
  return hay.includes(needle)
}

function secondaryOk(text, entry) {
  if (!entry.selective || !entry.keysecondary.length) return true
  const hits = entry.keysecondary.map((k) => keyHit(text, k, entry.caseSensitive, entry.matchWholeWords))
  const anyHit = hits.some(Boolean)
  const allHit = hits.every(Boolean)
  switch (entry.selectiveLogic) {
    case 1: return !allHit // NOT ALL
    case 2: return !anyHit // NOT ANY
    case 3: return allHit  // AND ALL
    default: return anyHit // 0 = AND ANY
  }
}

/**
 * Trả về nội dung các entry được kích hoạt theo scanText, đã sắp theo order
 * giảm dần. Entry `constant` luôn vào. Có trần ký tự để không phình prompt.
 * @param {Array} entries đã parse
 * @param {string} scanText
 * @param {number} [budgetChars]
 */
export function getActiveWorldbook(entries, scanText, budgetChars = 2000000) {
  if (!entries?.length) return []
  const text = scanText ?? ''
  const active = entries.filter((e) => {
    if (e.disable) return false
    if (e.constant) return true
    const primaryHit = e.keys.some((k) => keyHit(text, k, e.caseSensitive, e.matchWholeWords))
    return primaryHit && secondaryOk(text, e)
  })
  // Constant (luôn bật) LUÔN vào và KHÔNG tính vào budget của nhóm keyword —
  // nếu không, mấy entry constant to (thế giới quan) sẽ ăn hết chỗ khiến
  // entry khớp từ khoá (VD "Giáo sư Oak") bị loại oan (bug đợt 41).
  const constants = active.filter((e) => e.constant).sort((a, b) => b.order - a.order)
  const matched = active.filter((e) => !e.constant).sort((a, b) => b.order - a.order)
  const out = constants.map((e) => e.content)
  let used = 0
  for (const e of matched) {
    if (used + e.content.length > budgetChars) continue
    out.push(e.content)
    used += e.content.length
  }
  return out
}
