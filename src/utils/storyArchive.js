// ============ BIÊN NIÊN SỬ CHÍNH XÁC DÀI HẠN (đợt 88) ============
// Vector memory cũ hữu ích cho liên tưởng ngữ nghĩa nhưng từng cắt ở 400 lượt.
// Kho này giữ từng trao đổi trong IndexedDB, không tự xoá lượt cũ. Truy hồi
// lai: tên/từ khoá chính xác + mốc "lượt N/chương N/lần đầu". Vì vậy một chi
// tiết ở lượt 5 vẫn có đường quay lại sau hàng nghìn lượt mà không phải nhồi
// toàn bộ 2000 lượt vào context model.

const DB_NAME = 'trainer-arena-story-archive'
const DB_VERSION = 2
const STORE = 'exchanges'
export const ARCHIVE_CHAPTER_SIZE = 20
// Giữ gần như trọn một lượt chính văn chuẩn 300-600 từ; IndexedDB chịu dữ
// liệu lớn tốt hơn localStorage nên không cần hy sinh nửa sau của cảnh.
const MAX_SIDE = 6000
const MAX_RESULTS = 8

// Token đã được bỏ dấu trước khi so, nên stopword cũng để ở dạng đã fold.
const STOP = new Set('va la cua co mot nhung cac cho voi trong nay do toi ta minh ban nguoi pokemon dien bien dang da se thi ma duoc tu tai nhu khong hay vua rat cung lai di tiep noi lam xem den ve ra vao len xuong'.split(' '))
const memoryFallback = new Map()

function clip(value, max = MAX_SIDE) {
  const text = String(value ?? '').trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function fold(value) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
}

export function memoryTerms(value) {
  return [...new Set((fold(value).match(/[a-z0-9][a-z0-9'-]{1,}/g) ?? []).filter((term) => !STOP.has(term)))]
}

function archiveNamespace(value) {
  return String(value || 'legacy').replace(/[^a-z0-9_-]/gi, '').slice(0, 96) || 'legacy'
}

function exchangeId(turn, namespace = 'legacy') {
  return `${archiveNamespace(namespace)}:turn-${Math.max(0, Number(turn) || 0).toString().padStart(8, '0')}`
}

export function makeArchiveEntry(userText, assistantText, turn, storyTurn = null, namespace = 'legacy') {
  const safeTurn = Math.max(0, Number(turn) || 0)
  const safeStoryTurn = Math.max(1, Number(storyTurn) || Math.ceil(safeTurn / 2) || 1)
  const user = clip(userText)
  const assistant = clip(assistantText)
  const text = user ? `Người chơi: ${user}\nDiễn biến: ${assistant}` : assistant
  return {
    id: exchangeId(safeTurn, namespace),
    namespace: archiveNamespace(namespace),
    turn: safeTurn,
    storyTurn: safeStoryTurn,
    chapter: Math.floor((safeStoryTurn - 1) / ARCHIVE_CHAPTER_SIZE) + 1,
    user,
    assistant,
    text,
    terms: memoryTerms(text),
    important: /(?:lời hứa|thề|bí mật|qua đời|mất tích|phản bội|bắt được|tiến hóa|tiến hoá|huy hiệu|nhiệm vụ|gặp lần đầu|fact|npc)/iu.test(text),
    savedAt: Date.now(),
  }
}

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB không khả dụng'))
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('turn', 'turn', { unique: false })
        store.createIndex('chapter', 'chapter', { unique: false })
        store.createIndex('namespace', 'namespace', { unique: false })
      } else {
        const store = request.transaction.objectStore(STORE)
        if (!store.indexNames.contains('namespace')) store.createIndex('namespace', 'namespace', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Không mở được kho biên niên sử'))
  })
}

async function withStore(mode, callback) {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const store = tx.objectStore(STORE)
      let request
      try { request = callback(store) } catch (error) { reject(error); return }
      request.onerror = () => reject(request.error ?? new Error('Lỗi kho biên niên sử'))
      tx.oncomplete = () => resolve(request.result ?? null)
      tx.onabort = () => reject(tx.error ?? new Error('Giao dịch biên niên sử bị huỷ'))
      tx.onerror = () => reject(tx.error ?? new Error('Lỗi giao dịch biên niên sử'))
    })
  } finally { db.close() }
}

export async function archiveExchange(userText, assistantText, turn, storyTurn = null, namespace = 'legacy') {
  const entry = makeArchiveEntry(userText, assistantText, turn, storyTurn, namespace)
  if (!entry.text) return null
  memoryFallback.set(entry.id, entry)
  try { await withStore('readwrite', (store) => store.put(entry)) } catch { /* RAM vẫn giữ được trong phiên */ }
  return entry
}

/** Nâng cấp save cũ theo lô trong một transaction, không gọi API và không sửa messages. */
export async function backfillArchiveFromMessages(messages, namespace = 'legacy') {
  const list = Array.isArray(messages) ? messages : []
  const entries = []
  let storyTurn = 0
  for (let i = 0; i < list.length; i++) {
    if (list[i]?.role !== 'assistant') continue
    storyTurn += 1
    let userText = ''
    for (let j = i - 1; j >= 0; j--) {
      if (list[j]?.role === 'user' && !list[j]?.hidden) { userText = list[j].content; break }
      if (list[j]?.role === 'assistant') break
    }
    const entry = makeArchiveEntry(userText, list[i].content, i, storyTurn, namespace)
    if (entry.text) entries.push(entry)
  }
  for (const entry of entries) memoryFallback.set(entry.id, entry)
  if (!entries.length) return 0
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      for (const entry of entries) store.put(entry)
      tx.oncomplete = resolve
      tx.onabort = () => reject(tx.error ?? new Error('Backfill biên niên sử bị huỷ'))
      tx.onerror = () => reject(tx.error ?? new Error('Lỗi backfill biên niên sử'))
    })
    db.close()
  } catch { /* IndexedDB không có: RAM vẫn dùng được trong phiên */ }
  return entries.length
}

async function listArchiveEntries(namespace = 'legacy') {
  const wanted = archiveNamespace(namespace)
  try {
    const records = await withStore('readonly', (store) => store.getAll())
    if (Array.isArray(records)) {
      for (const entry of records) memoryFallback.set(entry.id, entry)
      return records.filter((entry) => archiveNamespace(entry.namespace) === wanted)
    }
  } catch { /* dùng RAM */ }
  return [...memoryFallback.values()].filter((entry) => archiveNamespace(entry.namespace) === wanted)
}

/** Snapshot nhẹ cho Sổ tay; mặc định chỉ trả 200 mục mới nhất nhưng count là toàn bộ. */
export async function getArchiveSnapshot(limit = 200, namespace = 'legacy') {
  const entries = (await listArchiveEntries(namespace)).sort((a, b) => (a.turn ?? 0) - (b.turn ?? 0))
  return {
    count: entries.length,
    entries: entries.slice(-Math.max(1, Number(limit) || 200)).map(({ id, turn, storyTurn, chapter, text }) => ({ id, turn, storyTurn, chapter, text })),
  }
}

function temporalHint(query) {
  const folded = fold(query)
  const turn = folded.match(/(?:luot|turn)\s*(?:thu\s*)?(\d{1,6})/i)
  const chapter = folded.match(/(?:chuong|chapter|hoi)\s*(?:thu\s*)?(\d{1,5})/i)
  return {
    turn: turn ? Number(turn[1]) : null,
    chapter: chapter ? Number(chapter[1]) : null,
    first: /(?:lan dau|dau tien|thuở dau|thuo dau|ban dau)/i.test(folded),
  }
}

export function scoreArchiveEntries(entries, queryText, { maxTurn = Infinity, topK = MAX_RESULTS } = {}) {
  const query = String(queryText ?? '').trim()
  if (!query) return []
  const queryTerms = memoryTerms(query)
  const queryFolded = fold(query)
  const hint = temporalHint(query)
  const scored = []

  for (const entry of entries ?? []) {
    if ((entry.turn ?? 0) >= maxTurn) continue
    const terms = new Set(entry.terms?.length ? entry.terms : memoryTerms(entry.text))
    let score = 0
    for (const term of queryTerms) {
      if (terms.has(term)) score += term.length >= 7 ? 4 : term.length >= 4 ? 2 : 1
    }
    const textFolded = fold(entry.text)
    if (queryFolded.length >= 12 && textFolded.includes(queryFolded)) score += 16
    if (hint.turn != null) score += Math.max(0, 30 - Math.abs((entry.storyTurn ?? entry.turn ?? 0) - hint.turn) * 4)
    if (hint.chapter != null && entry.chapter === hint.chapter) score += 22
    if (hint.first) score += Math.max(0, 12 - (entry.turn ?? 0) / 4)
    if (entry.important && score > 0) score += 1.5
    if (score > 0) scored.push({ ...entry, score, source: 'archive' })
  }
  return scored.sort((a, b) => b.score - a.score || a.turn - b.turn).slice(0, topK)
}

/** Truy hồi từ chính mảng messages để save cũ được lợi ngay, chưa cần đợi backfill IndexedDB. */
export function recallFromTranscript(messages, queryText, { maxTurn = Infinity, topK = MAX_RESULTS } = {}) {
  const entries = []
  const list = Array.isArray(messages) ? messages : []
  let storyTurn = 0
  for (let i = 0; i < Math.min(list.length, maxTurn); i++) {
    const message = list[i]
    if (message?.role !== 'assistant') continue
    storyTurn += 1
    let userText = ''
    for (let j = i - 1; j >= 0; j--) {
      if (list[j]?.role === 'user' && !list[j]?.hidden) { userText = list[j].content; break }
      if (list[j]?.role === 'assistant') break
    }
    entries.push(makeArchiveEntry(userText, message.content, i, storyTurn))
  }
  return scoreArchiveEntries(entries, queryText, { maxTurn, topK })
}

export async function recallArchive({ queryText, maxTurn = Infinity, topK = MAX_RESULTS, namespace = 'legacy' } = {}) {
  return scoreArchiveEntries(await listArchiveEntries(namespace), queryText, { maxTurn, topK })
}

export async function forgetArchiveRange(turnFrom, turnTo, namespace = 'legacy') {
  const wanted = archiveNamespace(namespace)
  const lo = Math.min(Number(turnFrom) || 0, Number(turnTo) || 0)
  const hi = Math.max(Number(turnFrom) || 0, Number(turnTo) || 0)
  for (const [id, entry] of memoryFallback) if (archiveNamespace(entry.namespace) === wanted && entry.turn >= lo && entry.turn <= hi) memoryFallback.delete(id)
  try {
    const records = await listArchiveEntries(namespace)
    const targets = records.filter((entry) => entry.turn >= lo && entry.turn <= hi)
    if (!targets.length) return
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      for (const entry of targets) store.delete(entry.id)
      tx.oncomplete = resolve
      tx.onabort = () => reject(tx.error ?? new Error('Xoá nhánh biên niên sử bị huỷ'))
      tx.onerror = () => reject(tx.error ?? new Error('Lỗi xoá nhánh biên niên sử'))
    })
    db.close()
  } catch { /* ignore */ }
}

export async function clearArchive(namespace = null) {
  if (namespace !== null && namespace !== undefined) {
    await forgetArchiveRange(0, Number.MAX_SAFE_INTEGER, namespace)
    return
  }
  memoryFallback.clear()
  try { await withStore('readwrite', (store) => store.clear()) } catch { /* ignore */ }
}

/** Đóng gói toàn bộ biên niên của một hành trình vào save/file xuất. */
export async function exportArchiveEntries(namespace = 'legacy') {
  return (await listArchiveEntries(namespace)).map((entry) => ({ ...entry, terms: [...(entry.terms ?? [])] }))
}

/** Khôi phục biên niên khi tải ô save hoặc nạp file trên thiết bị khác. */
export async function importArchiveEntries(entries, namespace = 'legacy', { replace = true } = {}) {
  const wanted = archiveNamespace(namespace)
  if (replace) await clearArchive(wanted)
  const prepared = (Array.isArray(entries) ? entries : []).map((entry) => ({
    ...makeArchiveEntry(entry?.user, entry?.assistant, entry?.turn, entry?.storyTurn, wanted),
    savedAt: Number(entry?.savedAt) || Date.now(),
  })).filter((entry) => entry.text)
  for (const entry of prepared) memoryFallback.set(entry.id, entry)
  if (!prepared.length) return 0
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      for (const entry of prepared) store.put(entry)
      tx.oncomplete = resolve
      tx.onabort = () => reject(tx.error ?? new Error('Khôi phục biên niên sử bị huỷ'))
      tx.onerror = () => reject(tx.error ?? new Error('Lỗi khôi phục biên niên sử'))
    })
    db.close()
  } catch { /* IndexedDB không khả dụng: bản RAM vẫn có hiệu lực trong phiên */ }
  return prepared.length
}

export function mergeMemoryResults(...groups) {
  const seen = new Set()
  const out = []
  for (const group of groups) {
    for (const item of group ?? []) {
      const key = fold(item.text).slice(0, 240)
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
  }
  return out.slice(0, MAX_RESULTS)
}
