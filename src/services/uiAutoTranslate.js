// ============ UI AUTO TRANSLATE (đợt 122) ============
// Fallback cho các chuỗi UI chưa có trong bảng dịch tĩnh.
// Chỉ gửi TEXT UI (không gửi story/user input/API key) qua /api-bridge tới
// Google Translate web endpoint. Kết quả được cache cục bộ để không gọi lại.

import { normalizeUiLanguage } from '../i18n/uiLanguage.js'

const CACHE_PREFIX = 'trainer-arena:ui-google-translate:v2:'
const CACHE_LIMIT = 1200
const MAX_SOURCE_LENGTH = 1800
const CONCURRENCY = 2
const FAILURE_COOLDOWN_MS = 45_000

const TARGET_LANGUAGE = Object.freeze({ en: 'en', zh: 'zh-CN' })
const memoryCache = new Map()
const pending = new Map()
const failures = new Map()
const queue = []
let active = 0
let persistTimer = null

const VI_DIACRITICS = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu
const VI_WORDS = /\b(?:không|được|của|và|với|khi|đang|chọn|bạn|người|màn|hình|tiếp|tục|quay|lại|cài|đặt|thông|tin|nhân|vật|tải|ảnh|dùng|bật|tắt|gửi|xuống|dòng|truyện|chiêu|thức|đội|hình|túi|đồ|bản|đồ|ngôn|ngữ|khởi|đầu|hành|trình|chế|độ|mô|hình|kết|nối|lưu|xoá|xóa|thêm|sửa|phụ|kiện|trang|bị|tiền|vật|phẩm)\b/iu
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
    try { localStorage.removeItem(storageKey(lang)) } catch { /* ignore */ }
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

export function buildGoogleTranslateTarget(source, language) {
  const lang = normalizeUiLanguage(language)
  const target = TARGET_LANGUAGE[lang]
  if (!target) return ''
  const q = encodeURIComponent(normalizedText(source))
  return `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${q}`
}

async function callGoogleTranslate(source, language) {
  const target = buildGoogleTranslateTarget(source, language)
  if (!target) return ''

  // Production: dùng cầu nối server hiện có để không phụ thuộc CORS của Google.
  // Local dev: nếu /api-bridge chưa chạy, thử gọi trực tiếp như fallback.
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
  if (!response?.ok) throw new Error(`Google Translate HTTP ${response?.status || 'network'}`)
  const payload = await response.json()
  const translated = parseGoogleTranslateResponse(payload)
  if (!translated) throw new Error('Google Translate trả về bản dịch rỗng')
  return translated
}

function pump() {
  while (active < CONCURRENCY && queue.length) {
    const job = queue.shift()
    active += 1
    callGoogleTranslate(job.source, job.language)
      .then((translated) => {
        const cache = getLanguageCache(job.language)
        cache.delete(job.normalized)
        cache.set(job.normalized, translated)
        schedulePersist(job.language)
        failures.delete(job.key)
        job.resolve(translated)
      })
      .catch(() => {
        failures.set(job.key, Date.now())
        job.resolve(null)
      })
      .finally(() => {
        pending.delete(job.key)
        active -= 1
        pump()
      })
  }
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
    pump()
  })
  pending.set(key, promise)
  return promise
}
