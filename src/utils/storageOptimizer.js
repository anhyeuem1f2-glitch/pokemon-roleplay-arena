// ============ TỐI ƯU LƯU TRỮ SAVE (đợt 78) ============
// Chính văn phải được giữ trọn. Phần làm đầy bộ nhớ chủ yếu là raw/thinking
// lặp lại nội dung trong meta của HÀNG TRĂM lượt và các cache tải lại được.
// Khi persist, chỉ lược debug của lượt cũ; state React trong phiên vẫn giữ đủ.

export const MESSAGE_STORAGE_KEY = 'trainer-arena:messages'
const KEEP_DEBUG_TURNS = 24
const RECENT_RAW_LIMIT = 5000
const RECENT_THINKING_LIMIT = 3500

export const LEGACY_LARGE_CACHE_KEYS = [
  'trainer-arena:pokedex-cache-v9',
  'trainer-arena:pokedex-cache-v10',
  'trainer-arena:moves-cache-v7',
  'trainer-arena:learnsets-cache-v2',
  'trainer-arena:wiki-cache-v1',
]

function clip(value, limit) {
  const text = String(value ?? '')
  return text.length > limit ? `${text.slice(0, limit)}\n…[đã rút gọn khi lưu]` : text
}

export function compactMessagesForStorage(messages) {
  const list = Array.isArray(messages) ? messages : []
  const debugCutoff = Math.max(0, list.length - KEEP_DEBUG_TURNS * 2)
  return list.map((message, index) => {
    if (!message || typeof message !== 'object') return message
    let next = message

    if (message.meta) {
      const meta = { ...message.meta }
      if (index < debugCutoff) {
        // Tin cũ vẫn giữ danh sách biến đã áp; raw/thinking chỉ là debug trùng
        // chính văn và có thể xem ở các lượt gần nhất là đủ để bắt lỗi.
        delete meta.raw
        delete meta.thinking
      } else {
        if (meta.raw) meta.raw = clip(meta.raw, RECENT_RAW_LIMIT)
        if (meta.thinking) meta.thinking = clip(meta.thinking, RECENT_THINKING_LIMIT)
      }
      next = { ...next, meta }
    }

    // Runtime chỉ có ý nghĩa khi trận còn mở. Tin đã chốt battleUsed mà vẫn
    // sót snapshot từ save cũ thì bỏ để tránh nhân đôi cả đội hình trong lịch sử.
    if (next.battleUsed && (next.battleRuntime || next.doubleBattleRuntime || next.enemySnapshot || next.enemySnapshots)) {
      next = { ...next }
      delete next.battleRuntime
      delete next.doubleBattleRuntime
      delete next.enemySnapshot
      delete next.enemySnapshots
    }
    return next
  })
}

export function cleanupLegacyLargeCaches() {
  try {
    const prefixes = ['trainer-arena:pokedex-cache', 'trainer-arena:moves-cache', 'trainer-arena:learnsets-cache', 'trainer-arena:wiki-cache']
    const remove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}-v`))) remove.push(key)
    }
    for (const key of remove) localStorage.removeItem(key)
  } catch { /* ignore */ }
}

/** Persist lịch sử với 1 lần tự dọn cache rồi thử lại khi quota vừa đầy. */
export function persistMessagesSafely(messages) {
  const compact = compactMessagesForStorage(messages)
  const raw = JSON.stringify(compact)
  try {
    localStorage.setItem(MESSAGE_STORAGE_KEY, raw)
    return { ok: true, compact }
  } catch {
    cleanupLegacyLargeCaches()
    try {
      localStorage.setItem(MESSAGE_STORAGE_KEY, raw)
      return { ok: true, compact }
    } catch {
      return { ok: false, compact }
    }
  }
}

export function loadStoredMessages() {
  try {
    const saved = localStorage.getItem(MESSAGE_STORAGE_KEY)
    if (!saved) return []
    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
