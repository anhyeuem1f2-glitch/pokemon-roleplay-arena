// ============ TÊN CHIÊU HIỂN THỊ (đợt 141) ============
// Gameplay/battle engine LUÔN giữ move.id + move.name canonical tiếng Anh.
// Module này chỉ quyết định tên HIỂN THỊ để localization không bao giờ làm
// hỏng lookup PP, held item, Z-Move, learnset hoặc save cũ.

export const MOVE_NAME_MODE_STORAGE_KEY = 'trainer-arena:move-name-mode'
export const DEFAULT_MOVE_NAME_MODE = 'ui'

export function normalizeMoveNameMode(value) {
  return value === 'en' ? 'en' : DEFAULT_MOVE_NAME_MODE
}

export function moveLookupId(value) {
  if (!value) return ''
  const raw = typeof value === 'object'
    ? (value.id ?? value.name ?? value.baseMoveName ?? '')
    : value
  return String(raw).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/**
 * Trả tên chỉ để render UI. Không được ghi kết quả này ngược vào move.name.
 * - mode=en: luôn giữ tên canonical English.
 * - mode=ui + UI zh: dùng tên giản thể nếu catalog có entry.
 * - VI/EN hoặc catalog chưa tải: giữ English an toàn.
 */
export function displayMoveName(move, uiLanguage, mode, zhNames = {}) {
  const canonical = typeof move === 'string'
    ? move
    : String(move?.name ?? move?.baseMoveName ?? move?.id ?? '')
  if (!canonical) return ''
  if (normalizeMoveNameMode(mode) === 'en' || uiLanguage !== 'zh') return canonical

  // Move sinh động trong battle (Max/Z) thường giữ id của chiêu gốc.
  // Với Max Move cần ưu tiên chính tên Max Move để không hiển thị nhầm tên
  // chiêu gốc; Z-Move custom của app thì giữ tiền tố Z- nhưng dịch phần gốc.
  if (typeof move === 'object' && move?.isMaxMove) {
    const maxName = zhNames?.[moveLookupId(move.name)]
    if (maxName) return maxName
  }
  if (typeof move === 'object' && move?.isZMove && move?.baseMoveName) {
    const base = zhNames?.[moveLookupId(move.baseMoveName)] || move.baseMoveName
    return `Z-${base}`
  }

  const id = moveLookupId(typeof move === 'object' ? (move.id ?? move.baseMoveName ?? move.name) : move)
  return zhNames?.[id] || canonical
}
