// ============ TƯ LIỆU CANON TỪ BULBAPEDIA (đợt 33) ============
// Vấn đề: AI hay bịa sai thông tin nhân vật GỐC (game/anime/manga) — Misty
// tóc màu gì, Cynthia dùng đội nào... Giải pháp: khi truyện nhắc tên một
// nhân vật canon, app tự tra Bulbapedia (MediaWiki API hỗ trợ CORS qua
// origin=*) lấy đoạn tóm tắt mở đầu của trang, cache lại, và bơm vào prompt
// như "tư liệu phải nhất quán". Tiếng Anh — AI được dặn dùng thông tin
// nhưng kể bằng tiếng Việt.
//
// Thiết kế an toàn: có công tắc bật/tắt (mặc định bật), timeout 5s, lỗi
// mạng chỉ bỏ qua không chặn truyện, cache localStorage TTL 7 ngày + trần
// 60 trang, mỗi lượt tra tối đa 2 tên, mỗi tên đã bơm thì 10 lượt sau mới
// bơm lại (đỡ phình prompt).

import { CANON_CHARACTERS } from '../data/canonCharacters.js'

const API = 'https://bulbapedia.bulbagarden.net/w/api.php'
const CACHE_KEY = 'trainer-arena:wiki-cache-v1'
const SETTINGS_KEY = 'trainer-arena:wiki-settings'
const TTL_MS = 7 * 24 * 3600 * 1000
const MAX_CACHE = 60
const MAX_EXTRACT_CHARS = 900
const REINJECT_GAP = 10 // lượt

let settings = null
let cache = null
const injectedAtTurn = new Map() // title → turn đã bơm gần nhất (RAM, theo phiên)
const listeners = new Set()

function loadSettings() {
  if (settings) return settings
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(SETTINGS_KEY) : null
    if (saved) {
      settings = { enabled: JSON.parse(saved).enabled !== false }
      return settings
    }
  } catch { /* làm mới */ }
  settings = { enabled: true }
  return settings
}

export function getWikiSettings() {
  return { ...loadSettings() }
}
export function setWikiEnabled(enabled) {
  settings = { enabled: Boolean(enabled) }
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* ignore */ }
  for (const fn of listeners) {
    try { fn() } catch { /* ignore */ }
  }
}
export function subscribeWiki(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function loadCache() {
  if (cache) return cache
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null
    if (saved) {
      cache = JSON.parse(saved)
      if (cache && typeof cache === 'object') return cache
    }
  } catch { /* làm mới */ }
  cache = {}
  return cache
}

function persistCache() {
  try {
    const entries = Object.entries(cache)
    if (entries.length > MAX_CACHE) {
      entries.sort((a, b) => (a[1].ts ?? 0) - (b[1].ts ?? 0))
      cache = Object.fromEntries(entries.slice(entries.length - MAX_CACHE))
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch { /* ignore */ }
}

export function clearWikiCache() {
  cache = {}
  try { localStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
}

export function getWikiCacheCount() {
  return Object.keys(loadCache()).length
}

/**
 * Parse response MediaWiki extracts → text tóm tắt (null nếu trang không có).
 * Tách riêng để unit test được với dữ liệu mock.
 */
export function parseWikiExtract(json) {
  const pages = json?.query?.pages
  if (!pages) return null
  for (const page of Object.values(pages)) {
    if (page?.extract) {
      const text = page.extract.replace(/\n{2,}/g, '\n').trim()
      return text.length > MAX_EXTRACT_CHARS ? `${text.slice(0, MAX_EXTRACT_CHARS)}…` : text
    }
  }
  return null
}

/** Fetch tóm tắt 1 trang Bulbapedia (cache + TTL + timeout). */
export async function fetchWikiSummary(title) {
  const c = loadCache()
  const hit = c[title]
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.text // text có thể null (trang không tồn tại) — cache cả kết quả rỗng
  const url =
    `${API}?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&format=json&origin=*` +
    `&titles=${encodeURIComponent(title)}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const text = parseWikiExtract(json)
    c[title] = { text, ts: Date.now() }
    persistCache()
    return text
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Dò các tên nhân vật canon xuất hiện trong text (khớp nguyên tên, ưu tiên
 * tên DÀI trước để "Ash Ketchum" thắng "Ash"). Trả tối đa `limit` mục
 * {name, title} CHƯA bơm gần đây.
 */
export function detectCanonMentions(text, turn, limit = 2) {
  if (!text) return []
  const found = []
  for (const c of CANON_CHARACTERS) {
    if (!text.includes(c.name)) continue
    const last = injectedAtTurn.get(c.title)
    if (last !== undefined && turn - last < REINJECT_GAP) continue
    found.push(c)
  }
  found.sort((a, b) => b.name.length - a.name.length)
  // Khử trùng title (nhiều alias trỏ về cùng trang).
  const seen = new Set()
  const out = []
  for (const c of found) {
    if (seen.has(c.title)) continue
    seen.add(c.title)
    out.push(c)
    if (out.length >= limit) break
  }
  return out
}

/**
 * Pipeline mỗi lượt: dò tên canon trong ngữ cảnh gần → fetch tóm tắt →
 * dựng note (null nếu không có gì / tắt / lỗi). Lỗi mạng chỉ warn.
 */
export async function buildCanonNote(scanText, turn) {
  if (!loadSettings().enabled) return null
  const mentions = detectCanonMentions(scanText, turn)
  if (!mentions.length) return null
  const results = await Promise.allSettled(mentions.map((m) => fetchWikiSummary(m.title)))
  const lines = []
  for (let i = 0; i < mentions.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled' && r.value) {
      injectedAtTurn.set(mentions[i].title, turn)
      lines.push(`### ${mentions[i].name}\n${r.value}`)
    } else if (r.status === 'rejected') {
      console.warn('[wiki] tra Bulbapedia lỗi (bỏ qua):', mentions[i].title, r.reason?.message)
    }
  }
  if (!lines.length) return null
  return [
    '[Hệ thống — TƯ LIỆU CANON (trích Bulbapedia, tiếng Anh): thông tin CHÍNH XÁC về nhân vật gốc đang được nhắc tới. PHẢI nhất quán với tư liệu này (ngoại hình, vai trò, đội Pokémon, quan hệ) — không bịa khác đi; kể bằng tiếng Việt; không nhắc tới ghi chú này.]',
    ...lines,
  ].join('\n')
}
