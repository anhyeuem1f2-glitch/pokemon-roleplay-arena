// ============ WORLDBOOK (World Info của SillyTavern) ============
// Dot146: hỗ trợ NHIỀU worldbook độc lập cùng lúc. Mỗi book giữ nguyên entry
// kiểu SillyTavern; toàn bộ book đang bật cùng tham gia quét keyword ở mỗi lượt.
// Dữ liệu cũ {name, entries:[...]} được migrate mềm sang {books:[...]}.

function normalizeEntry(e, i) {
  return {
    uid: e?.uid ?? i,
    keys: Array.isArray(e?.keys) ? e.keys.filter(Boolean) : (Array.isArray(e?.key) ? e.key.filter(Boolean) : []),
    keysecondary: Array.isArray(e?.keysecondary) ? e.keysecondary.filter(Boolean) : [],
    content: e?.content ?? '',
    constant: Boolean(e?.constant),
    disable: Boolean(e?.disable),
    selective: Boolean(e?.selective),
    selectiveLogic: e?.selectiveLogic ?? 0,
    order: typeof e?.order === 'number' ? e.order : 100,
    comment: e?.comment ?? '',
    caseSensitive: Boolean(e?.caseSensitive),
    matchWholeWords: e?.matchWholeWords !== false,
  }
}

/** Chuẩn hoá 1 worldbook JSON (ST) → book app dùng. */
export function parseWorldbook(json) {
  const rawEntries = json?.entries
  if (!rawEntries) return { name: json?.name ?? 'Worldbook', entries: [] }
  const list = Array.isArray(rawEntries) ? rawEntries : Object.values(rawEntries)
  const entries = list.map(normalizeEntry).filter((e) => String(e.content ?? '').trim())
  return { name: json?.name ?? 'Worldbook', entries }
}

function fallbackBookId(book, index) {
  const name = String(book?.name ?? 'worldbook').trim().toLowerCase().replace(/[^a-z0-9\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')
  return `wb-${index}-${name || 'worldbook'}`
}

/**
 * Chuẩn hoá state worldbook mới/cũ thành collection duy nhất.
 * - cũ: {name, entries}
 * - mới: {books:[{id,name,entries,disabled,sourceFileName}]}
 */
export function normalizeWorldbookCollection(value) {
  let rawBooks = []
  if (Array.isArray(value)) rawBooks = value
  else if (Array.isArray(value?.books)) rawBooks = value.books
  else if (value?.entries) rawBooks = [value]

  const books = rawBooks.map((book, index) => {
    const parsed = parseWorldbook(book)
    return {
      id: String(book?.id ?? fallbackBookId(book, index)),
      name: parsed.name || `Worldbook ${index + 1}`,
      sourceFileName: String(book?.sourceFileName ?? ''),
      disabled: Boolean(book?.disabled),
      entries: parsed.entries,
    }
  }).filter((book) => book.entries.length > 0)

  return { books }
}

/** Trả danh sách book đã normalize. */
export function getWorldbookBooks(value) {
  return normalizeWorldbookCollection(value).books
}

function keyHit(text, key, caseSensitive, wholeWord) {
  const hay = caseSensitive ? text : text.toLowerCase()
  const needle = caseSensitive ? key : key.toLowerCase()
  if (!needle) return false
  if (wholeWord) {
    // Khớp nguyên từ (biên là ký tự không phải chữ/số). An toàn Unicode.
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

function activeEntries(entries, scanText) {
  const text = scanText ?? ''
  return (entries ?? []).filter((e) => {
    if (e.disable) return false
    if (e.constant) return true
    const primaryHit = e.keys.some((k) => keyHit(text, k, e.caseSensitive, e.matchWholeWords))
    return primaryHit && secondaryOk(text, e)
  })
}

/**
 * API tương thích cũ: active content từ một mảng entry.
 */
export function getActiveWorldbook(entries, scanText, budgetChars = 2000000) {
  if (!entries?.length) return []
  const active = activeEntries(entries, scanText)
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

/**
 * Dot146: quét TẤT CẢ worldbook đang bật. Constant của mọi book luôn vào;
 * keyword hit từ mọi book được gộp theo order. Prefix tên book giúp model biết
 * nguồn nào cung cấp canon nào, nhưng canonical content không bị sửa.
 */
export function getActiveWorldbookCollection(value, scanText, budgetChars = 2000000) {
  const books = getWorldbookBooks(value).filter((book) => !book.disabled)
  if (!books.length) return []

  const constants = []
  const matched = []
  for (const book of books) {
    for (const entry of activeEntries(book.entries, scanText)) {
      const record = { bookName: book.name || 'Worldbook', entry }
      if (entry.constant) constants.push(record)
      else matched.push(record)
    }
  }
  constants.sort((a, b) => b.entry.order - a.entry.order)
  matched.sort((a, b) => b.entry.order - a.entry.order)

  const format = ({ bookName, entry }) => `[WORLDBOOK: ${bookName}]\n${entry.content}`
  const out = constants.map(format)
  let used = 0
  for (const record of matched) {
    const block = format(record)
    if (used + block.length > budgetChars) continue
    out.push(block)
    used += block.length
  }
  return out
}
