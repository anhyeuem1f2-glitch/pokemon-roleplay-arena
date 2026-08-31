// ============ UI AUTO TRANSLATE (đợt 123) ============
// Fallback cho các chuỗi UI chưa có trong bảng dịch tĩnh.
// Chỉ gửi TEXT UI (không gửi story/user input/API key) qua /api-bridge tới
// Google Translate web endpoint. Đợt 123 gom nhiều chuỗi thành batch nhỏ để
// tránh rate-limit khi màn tạo nhân vật render hàng chục lựa chọn cùng lúc.

import { normalizeUiLanguage } from '../i18n/uiLanguage.js'

const CACHE_PREFIX = 'trainer-arena:ui-google-translate:v3:'
const CACHE_LIMIT = 1800
const MAX_SOURCE_LENGTH = 1800
const CONCURRENCY = 2
const FAILURE_COOLDOWN_MS = 12_000
const BATCH_DEBOUNCE_MS = 70
const BATCH_MAX_ITEMS = 18
const BATCH_MAX_CHARS = 1200

const TARGET_LANGUAGE = Object.freeze({ en: 'en', zh: 'zh-CN' })
const memoryCache = new Map()
const pending = new Map()
const failures = new Map()
const queue = []
let active = 0
let persistTimer = null
let pumpTimer = null

const VI_DIACRITICS = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu
const VI_WORDS = /\b(?:không|được|của|và|với|khi|đang|chọn|bạn|người|màn|hình|tiếp|tục|quay|lại|cài|đặt|thông|tin|nhân|vật|tải|ảnh|dùng|bật|tắt|gửi|xuống|dòng|truyện|chiêu|thức|đội|hình|túi|đồ|bản|đồ|ngôn|ngữ|khởi|đầu|hành|trình|chế|độ|mô|hình|kết|nối|lưu|xoá|xóa|thêm|sửa|phụ|kiện|trang|bị|tiền|vật|phẩm|tính|cách|năng|lực|thân|phận|lao|động|gia|tộc|quyền|quý|nông|trại|mồ|côi|ấm|áp|vui|vẻ|dũng|cảm|hiền|lành|trung|thành|nhút|nhát|kiêu|hãnh|điềm|tĩnh|nhiệt|huyết|ranh|mãnh|lạnh|lùng|tham|vọng|trắc|ẩn)\b/iu
const DONT_SEND = /^(?:[\d\s.,:+\-/%×x]+|https?:\/\/\S+|[A-Z0-9_.:\-/]{1,32}|[A-Za-z0-9_.-]+@[^\s]+)$/u

function normalizedText(source) {
  return String(source ?? '').replace(/\s+/g, ' ').trim()
}

function cacheKey(language, source) {
  return `${normalizeUiLanguage(language)}\u0000${normalizedText(source)}`
}

function storageKey(language) {
  return `${CACHE_PREFIX}${normalizeUiLanguage(language)}`
}

function getLanguageCache(language) {
  const lang = normalizeUiLanguage(language)
  if (memoryCache.has(lang)) return memoryCache.get(lang)
  const map = new Map()
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(lang)) || '[]')
    if (Array.isArray(parsed)) {
      for (const pair of parsed.slice(-CACHE_LIMIT)) {
        if (Array.isArray(pair) && pair.length === 2 && pair[0] && pair[1]) map.set(pair[0], pair[1])
      }
    }
  } catch { /* ignore damaged cache */ }
  memoryCache.set(lang, map)
  return map
}

function schedulePersist(language) {
  if (persistTimer) window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    persistTimer = null
    try {
      for (const [lang, map] of memoryCache.entries()) {
        const entries = Array.from(map.entries()).slice(-CACHE_LIMIT)
        localStorage.setItem(storageKey(lang), JSON.stringify(entries))
      }
    } catch { /* localStorage unavailable/full */ }
  }, 600)
}

export function looksLikeVietnameseUi(source) {
  const text = normalizedText(source)
  if (!text || text.length > MAX_SOURCE_LENGTH || DONT_SEND.test(text)) return false
  return VI_DIACRITICS.test(text) || VI_WORDS.test(text)
}

export function getCachedUiAutoTranslation(source, language) {
  const lang = normalizeUiLanguage(language)
  if (lang === 'vi') return null
  return getLanguageCache(lang).get(normalizedText(source)) || null
}

export function clearUiAutoTranslationCache(language = null) {
  const langs = language ? [normalizeUiLanguage(language)] : ['en', 'zh']
  for (const lang of langs) {
    memoryCache.delete(lang)
    try {
      // Dọn cả cache v2 để người đã test bản 122 không bị giữ bản dịch/failure cũ.
      localStorage.removeItem(storageKey(lang))
      localStorage.removeItem(`trainer-arena:ui-google-translate:v2:${lang}`)
    } catch { /* ignore */ }
  }
}

export function parseGoogleTranslateResponse(payload) {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return ''
  return payload[0]
    .map((part) => (Array.isArray(part) ? part[0] : ''))
    .filter(Boolean)
    .join('')
    .trim()
}

export function buildGoogleTranslateTarget(source, language, host = 'translate.googleapis.com') {
  const lang = normalizeUiLanguage(language)
  const target = TARGET_LANGUAGE[lang]
  if (!target) return ''
  const q = encodeURIComponent(normalizedText(source))
  // UI gốc của dự án là tiếng Việt. sl=vi ổn định hơn sl=auto với label ngắn.
  return `https://${host}/translate_a/single?client=gtx&sl=vi&tl=${encodeURIComponent(target)}&dt=t&q=${q}`
}

async function fetchGoogleTarget(target) {
  let response
  try {
    response = await fetch('/api-bridge', {
      method: 'GET',
      headers: { 'x-target-url': target, Accept: 'application/json' },
    })
  } catch { /* direct fallback below */ }

  if (!response?.ok) {
    try { response = await fetch(target, { method: 'GET', headers: { Accept: 'application/json' } }) } catch { /* handled below */ }
  }
  return response
}

async function callGoogleTranslate(source, language) {
  // Thử hai hostname Google trước khi coi request thất bại.
  const hosts = ['translate.googleapis.com', 'translate.google.com']
  let lastStatus = 'network'
  for (const host of hosts) {
    const target = buildGoogleTranslateTarget(source, language, host)
    if (!target) return ''
    const response = await fetchGoogleTarget(target)
    lastStatus = response?.status || 'network'
    if (!response?.ok) continue
    try {
      const payload = await response.json()
      const translated = parseGoogleTranslateResponse(payload)
      if (translated) return translated
    } catch { /* try next Google hostname */ }
  }
  throw new Error(`Google Translate HTTP ${lastStatus}`)
}

function marker(index) {
  return `__TA_UI_SEG_${String(index).padStart(3, '0')}__`
}

export function splitUiTranslationBatch(translated, count) {
  const text = String(translated ?? '')
  if (!text || !Number.isFinite(Number(count)) || count < 1) return null
  const re = /__TA_UI_SEG_(\d{3})__/g
  const hits = [...text.matchAll(re)]
  if (hits.length !== count) return null
  const out = Array(count).fill('')
  for (let i = 0; i < hits.length; i += 1) {
    const idx = Number(hits[i][1])
    if (!Number.isInteger(idx) || idx < 0 || idx >= count) return null
    const start = hits[i].index + hits[i][0].length
    const end = i + 1 < hits.length ? hits[i + 1].index : text.length
    out[idx] = text.slice(start, end).replace(/^\s+|\s+$/g, '')
  }
  return out.every(Boolean) ? out : null
}

async function callGoogleTranslateBatch(jobs) {
  if (jobs.length === 1) return [await callGoogleTranslate(jobs[0].source, jobs[0].language)]
  const joined = jobs.map((job, index) => `${marker(index)}\n${job.source}`).join('\n')
  const translated = await callGoogleTranslate(joined, jobs[0].language)
  const split = splitUiTranslationBatch(translated, jobs.length)
  if (split) return split

  // Marker hiếm khi bị Google chỉnh. Nếu có, fallback từng chuỗi cho batch nhỏ này.
  return Promise.all(jobs.map((job) => callGoogleTranslate(job.source, job.language)))
}

function takeBatch() {
  if (!queue.length) return []
  const language = queue[0].language
  const jobs = []
  let chars = 0
  for (let i = 0; i < queue.length && jobs.length < BATCH_MAX_ITEMS;) {
    const job = queue[i]
    if (job.language !== language) { i += 1; continue }
    const nextChars = chars + job.source.length + 24
    if (jobs.length && nextChars > BATCH_MAX_CHARS) break
    jobs.push(job)
    chars = nextChars
    queue.splice(i, 1)
  }
  return jobs
}

function commitJob(job, translated) {
  if (translated) {
    const cache = getLanguageCache(job.language)
    cache.delete(job.normalized)
    cache.set(job.normalized, translated)
    schedulePersist(job.language)
    failures.delete(job.key)
  } else {
    failures.set(job.key, Date.now())
  }
  pending.delete(job.key)
  job.resolve(translated || null)
}

function pumpNow() {
  pumpTimer = null
  while (active < CONCURRENCY && queue.length) {
    const jobs = takeBatch()
    if (!jobs.length) break
    active += 1
    callGoogleTranslateBatch(jobs)
      .then((translations) => jobs.forEach((job, index) => commitJob(job, translations?.[index])))
      .catch(() => jobs.forEach((job) => commitJob(job, null)))
      .finally(() => {
        active -= 1
        if (queue.length) schedulePump(0)
      })
  }
}

function schedulePump(delay = BATCH_DEBOUNCE_MS) {
  if (pumpTimer != null) return
  pumpTimer = window.setTimeout(pumpNow, delay)
}

export function requestUiAutoTranslation(source, language) {
  const lang = normalizeUiLanguage(language)
  const normalized = normalizedText(source)
  if (lang === 'vi' || !looksLikeVietnameseUi(normalized)) return Promise.resolve(null)

  const cached = getLanguageCache(lang).get(normalized)
  if (cached) return Promise.resolve(cached)

  const key = cacheKey(lang, normalized)
  if (pending.has(key)) return pending.get(key)
  const failedAt = failures.get(key)
  if (failedAt && Date.now() - failedAt < FAILURE_COOLDOWN_MS) return Promise.resolve(null)

  const promise = new Promise((resolve) => {
    queue.push({ key, source: normalized, normalized, language: lang, resolve })
    // Màn lựa chọn thường đổ hàng chục text node cùng một tick: đợi 70ms để gom batch.
    schedulePump(queue.length >= BATCH_MAX_ITEMS ? 0 : BATCH_DEBOUNCE_MS)
  })
  pending.set(key, promise)
  return promise
}
