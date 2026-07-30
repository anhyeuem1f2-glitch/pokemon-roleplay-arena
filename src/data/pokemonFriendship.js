// ============ ĐỘ THÂN MẬT POKÉMON (đợt 77) ============
// Dùng thang 0-255 như Friendship trong game gốc. Đây là biến của TỪNG CÁ THỂ,
// đi theo uid qua tiến hoá/đổi đội/PC. App dùng nó cho hành vi trong prompt và
// các thay đổi rõ trong chính văn; không tự biến thành buff sát thương vô cớ.

export const FRIENDSHIP_MIN = 0
export const FRIENDSHIP_MAX = 255
export const DEFAULT_FRIENDSHIP = 70

export function clampFriendship(value) {
  return Math.max(FRIENDSHIP_MIN, Math.min(FRIENDSHIP_MAX, Math.round(Number(value) || 0)))
}

export function normalizeFriendship(mon, fallback = DEFAULT_FRIENDSHIP) {
  if (!mon) return mon
  if (Number.isFinite(mon.friendship)) {
    const friendship = clampFriendship(mon.friendship)
    return friendship === mon.friendship ? mon : { ...mon, friendship }
  }
  return { ...mon, friendship: clampFriendship(fallback) }
}

export function adjustFriendship(mon, delta) {
  if (!mon) return mon
  const amount = Number(delta)
  if (!Number.isFinite(amount) || amount === 0) return normalizeFriendship(mon)
  const current = Number.isFinite(mon.friendship) ? mon.friendship : DEFAULT_FRIENDSHIP
  return { ...mon, friendship: clampFriendship(current + amount) }
}

export function friendshipTier(value) {
  const n = clampFriendship(value)
  if (n >= 220) return { key: 'devoted', label: 'Gắn bó tuyệt đối', note: 'tin tưởng sâu sắc, chủ động bảo vệ và phối hợp gần như không cần ra lệnh' }
  if (n >= 160) return { key: 'close', label: 'Rất thân thiết', note: 'tin tưởng, vui vẻ hợp tác và thường chủ động quan tâm người huấn luyện' }
  if (n >= 100) return { key: 'friendly', label: 'Thân thiện', note: 'đã quen và khá tin người huấn luyện, nhưng vẫn giữ cá tính riêng' }
  if (n >= 50) return { key: 'neutral', label: 'Đang làm quen', note: 'chưa đủ thân, nghe lời ở mức bình thường và còn quan sát' }
  if (n >= 20) return { key: 'wary', label: 'Dè chừng', note: 'thiếu tin tưởng, dễ chần chừ hoặc phản ứng phòng vệ khi bị ép' }
  return { key: 'hostile', label: 'Rạn nứt', note: 'hầu như không tin tưởng, cần được đối xử tử tế và kiên nhẫn để hàn gắn' }
}

export function describeFriendship(mon) {
  const normalized = normalizeFriendship(mon)
  const tier = friendshipTier(normalized?.friendship)
  return `${normalized?.friendship ?? DEFAULT_FRIENDSHIP}/255 — ${tier.label}`
}
