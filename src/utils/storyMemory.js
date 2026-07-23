// ============ TRÍ NHỚ DÀI HẠN CHO CHÍNH VĂN (đợt 29) ============
// Vấn đề: truyện dài → gửi toàn bộ lịch sử cho model chính vừa tốn token vừa
// vượt context, model "quên" diễn biến cũ. Giải pháp RAG kiểu SillyTavern
// vector storage:
//   1. Sau MỖI lượt kể, cặp (người chơi nói gì → AI kể gì) được embed thành
//      vector và lưu lại làm 1 "ký ức" (chạy nền, lỗi không chặn truyện).
//   2. Trước khi gọi AI, nếu truyện đã dài: chỉ gửi CỬA SỔ tin gần nhất +
//      truy hồi các ký ức CŨ liên quan nhất tới tình huống hiện tại (cosine
//      similarity trên vector), tuỳ chọn cho model RERANK chấm lại độ liên
//      quan, rồi chèn vào prompt như một ghi chú hệ thống.
//
// Lưu trữ: localStorage 'trainer-arena:story-memory-v1'. Vector nén Float32
// → base64 (~4 byte/chiều thay vì ~8-10 ký tự JSON). Trần 400 ký ức, đầy
// hoặc dính QuotaExceeded thì tự cắt ký ức CŨ nhất. Mọi thao tác storage
// bọc try/catch — môi trường chặn localStorage vẫn chạy được trong phiên.

import { embedTexts, rerankDocs } from '../services/aiClient.js'

const STORAGE_KEY = 'trainer-arena:story-memory-v1'
const MAX_ENTRIES = 400
/** Cắt mỗi vế của ký ức về tối đa ngần này ký tự trước khi embed/lưu. */
const MAX_SIDE_CHARS = 700
/** Số ứng viên lấy theo cosine trước khi đưa cho rerank. */
const CANDIDATE_K = 24
/** Số ký ức cuối cùng chèn vào prompt. */
const TOP_K = 6

// ---------- mã hoá vector ----------
export function encodeVec(arr) {
  const f32 = new Float32Array(arr)
  const bytes = new Uint8Array(f32.buffer)
  // KHÔNG spread mảng lớn vào String.fromCharCode (bài học PNG card đợt 21
  // — RangeError). Ghép theo chunk nhỏ.
  let bin = ''
  const CHUNK = 8192
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

export function decodeVec(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Float32Array(bytes.buffer)
}

/** Cosine similarity — nhận cả Array lẫn Float32Array. */
export function cosineSim(a, b) {
  const n = Math.min(a.length, b.length)
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

// ---------- store ----------
let cache = null // {entries: [{id, turn, text, vec(b64)}], nextId}
let decodedCache = new Map() // id → Float32Array (giải mã 1 lần mỗi phiên)
const listeners = new Set()

function load() {
  if (cache) return cache
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed?.entries)) {
        cache = { entries: parsed.entries, nextId: parsed.nextId ?? parsed.entries.length + 1 }
        return cache
      }
    }
  } catch { /* hỏng thì làm mới */ }
  cache = { entries: [], nextId: 1 }
  return cache
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // QuotaExceeded (hoặc bị chặn): cắt 25% ký ức cũ nhất rồi thử lại 1 lần.
    try {
      cache.entries = cache.entries.slice(Math.ceil(cache.entries.length / 4))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
    } catch { /* vẫn không được — chỉ giữ trong RAM phiên này */ }
  }
}

function notify() {
  for (const fn of listeners) {
    try { fn() } catch { /* ignore */ }
  }
}

/** Cho UI theo dõi số ký ức thay đổi (SettingsPage). */
export function subscribeMemory(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getMemoryCount() {
  return load().entries.length
}

export function clearMemory() {
  cache = { entries: [], nextId: 1 }
  decodedCache = new Map()
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  notify()
}

function addEntry(text, vector, turn) {
  const store = load()
  const entry = { id: store.nextId++, turn: turn ?? 0, text, vec: encodeVec(vector) }
  store.entries.push(entry)
  if (store.entries.length > MAX_ENTRIES) {
    const removed = store.entries.splice(0, store.entries.length - MAX_ENTRIES)
    for (const r of removed) decodedCache.delete(r.id)
  }
  persist()
  notify()
  return entry
}

function vecOf(entry) {
  let v = decodedCache.get(entry.id)
  if (!v) {
    v = decodeVec(entry.vec)
    decodedCache.set(entry.id, v)
  }
  return v
}

// ---------- văn bản ký ức ----------
function clip(s, max = MAX_SIDE_CHARS) {
  const t = (s ?? '').trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/** Ghép 1 lượt (người chơi ↔ AI) thành 1 đoạn ký ức gọn. */
export function buildExchangeText(userText, assistantText) {
  const u = clip(userText)
  const a = clip(assistantText)
  if (!u) return a
  return `Người chơi: ${u}\nDiễn biến: ${a}`
}

// ---------- API cấp cao ----------
/**
 * Ghi nhớ 1 lượt truyện (chạy NỀN sau khi AI trả lời xong — lỗi embedding
 * không được phép chặn truyện, caller chỉ cần .catch để log).
 * @param {{baseUrl,apiKey,model}} embeddingConfig
 * @param {string} userText lời người chơi (hoặc chỉ dẫn hệ thống) của lượt đó
 * @param {string} assistantText chính văn AI vừa kể
 * @param {number} turn vị trí lượt trong mảng messages (để loại ký ức còn
 *   nằm trong cửa sổ gần khi truy hồi)
 */
export async function rememberExchange(embeddingConfig, userText, assistantText, turn) {
  const text = buildExchangeText(userText, assistantText)
  if (!text) return null
  const [vector] = await embedTexts(embeddingConfig, [text])
  return addEntry(text, vector, turn)
}

/**
 * Truy hồi ký ức CŨ liên quan nhất tới tình huống hiện tại.
 * Pipeline: embed câu truy vấn → cosine top CANDIDATE_K (chỉ xét ký ức có
 * turn < maxTurn, tức đã RA KHỎI cửa sổ tin gần) → nếu có rerankConfig thì
 * đưa model rerank chấm lại → trả TOP_K. Rerank lỗi → degrade an toàn về
 * kết quả cosine (không ném lỗi).
 * @returns {Promise<Array<{text: string, score: number}>>}
 */
export async function recallRelevant({ embeddingConfig, rerankConfig, queryText, maxTurn = Infinity, topK = TOP_K }) {
  const store = load()
  const pool = store.entries.filter((e) => (e.turn ?? 0) < maxTurn)
  if (!pool.length || !queryText?.trim()) return []

  const [qVec] = await embedTexts(embeddingConfig, [clip(queryText, 1000)])
  const scored = pool
    .map((e) => ({ entry: e, score: cosineSim(qVec, vecOf(e)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATE_K)

  if (rerankConfig?.baseUrl && rerankConfig?.model && scored.length > 1) {
    try {
      const docs = scored.map((s) => s.entry.text)
      const ranked = await rerankDocs(rerankConfig, clip(queryText, 1000), docs, topK)
      const picked = ranked
        .filter((r) => r.index >= 0 && r.index < scored.length)
        .slice(0, topK)
        .map((r) => ({ text: scored[r.index].entry.text, score: r.score }))
      if (picked.length) return picked
    } catch (err) {
      // Rerank hỏng thì dùng luôn thứ hạng cosine — có trí nhớ vẫn hơn không.
      console.warn('[storyMemory] rerank lỗi, dùng cosine:', err.message)
    }
  }
  return scored.slice(0, topK).map((s) => ({ text: s.entry.text, score: s.score }))
}

/** Dựng ghi chú ký ức chèn vào prompt (role user, kiểu note hệ thống quen thuộc của app). */
export function buildMemoryNote(memories) {
  if (!memories?.length) return null
  const lines = memories.map((m, i) => `${i + 1}. ${m.text.replace(/\n/g, ' — ')}`)
  return [
    '[Hệ thống — KÝ ỨC DÀI HẠN: dưới đây là các diễn biến CŨ trong truyện có liên quan tới tình huống hiện tại, được truy hồi tự động. Hãy dùng chúng để giữ mạch truyện, tên nhân vật, lời hứa, ân oán... NHẤT QUÁN. KHÔNG kể lại nguyên văn, không nhắc tới ghi chú này.]',
    ...lines,
  ].join('\n')
}
