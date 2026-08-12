// ============ QUYỀN SỞ HỮU TRẬN ĐẤU (đợt 119) ============
// [[BATTLE]] là side-effect dành cho NGƯỜI CHƠI. Một cảnh NPC/bạn đồng hành
// thách đấu Gym trong khi người chơi chỉ đứng xem không được biến thành trận
// của party người chơi chỉ vì model đặt marker ở cuối response.

const PLAYER_BATTLE_RE = /(?:\b(?:tôi|mình|ta|main|người\s*chơi|nhân\s*vật\s*chính|(?<!của\s)cậu)\b.{0,28}(?:thách\s*đấu|khiêu\s*chiến|giao\s*đấu|tham\s*gia\s*(?:trận|đấu)|bước\s*(?:ra|vào)\s*sân|vào\s*trận|đấu\s+với|đánh\s+với|sẽ\s+đấu|muốn\s+đấu)|(?:đối\s*thủ|trận\s*đấu)\s+của\s+(?:tôi|mình|cậu))/iu

const PLAYER_SENDS_MON_RE = /\b(?:tôi|mình|ta|main|người\s*chơi|nhân\s*vật\s*chính|(?<!của\s)cậu)\b.{0,65}(?:tung\s+ra|gọi\s+ra|cử\s+ra|chọn\s+.+?\s+ra\s+sân|ra\s+lệnh\s+cho)/iu

const THIRD_PARTY_ACTOR = '(?:bạn(?:\\s+của\\s+(?:tôi|mình|cậu))?|người\\s*bạn|bạn\\s*đồng\\s*hành|đồng\\s*hành|nhỏ\\s*đó|cô\\s*ấy|cậu\\s*ấy|anh\\s*ấy|chị\\s*ấy|hắn|nó|friend|companion)'
const THIRD_PARTY_GYM_RE = new RegExp(`${THIRD_PARTY_ACTOR}.{0,70}(?:thử\\s*thách|thách\\s*đấu|khiêu\\s*chiến|challenge|đấu\\s+với).{0,55}(?:gym|chủ\\s*gym|gym\\s*leader|nhà\\s*thi\\s*đấu)`, 'iu')
const GYM_THIRD_PARTY_RE = new RegExp(`(?:gym|chủ\\s*gym|gym\\s*leader|nhà\\s*thi\\s*đấu).{0,75}${THIRD_PARTY_ACTOR}.{0,55}(?:thử\\s*thách|thách\\s*đấu|khiêu\\s*chiến|challenge|đấu)`, 'iu')
const SPECTATOR_RE = /(?:đứng\s*xem|ngồi\s*xem|xem\s+(?:bạn|nhỏ\s*đó|cô\s*ấy|cậu\s*ấy|anh\s*ấy|chị\s*ấy|trận)|quan\s*sát|theo\s*dõi\s*trận|cổ\s*vũ|ở\s*khán\s*đài|watch(?:ing)?|spectat(?:e|ing))/iu

const PLAYER_SPECTATES_THIRD_PARTY_RE = /(?:\b(?:tôi|mình|ta|main|người\s*chơi|nhân\s*vật\s*chính|cậu)\b.{0,40}(?:xem|quan\s*sát|theo\s*dõi|cổ\s*vũ).{0,45}(?:bạn|người\s*bạn|nhỏ\s*đó|cô\s*ấy|cậu\s*ấy|anh\s*ấy|chị\s*ấy).{0,45}(?:thử\s*thách|thách\s*đấu|khiêu\s*chiến|đấu|challenge))/iu

function ownMonIsActive(text, ownNames = []) {
  const lower = String(text ?? '').toLowerCase()
  if (!lower || !ownNames?.length) return false
  const activeCue = /(xuất\s*trận|ra\s*sân|tung\s+ra|gọi\s+ra|cử\s+ra|vào\s*sân|sent\s+out|entered\s+the\s+field|ra\s*lệnh)/iu
  for (const rawName of ownNames) {
    const name = String(rawName ?? '').trim().toLowerCase()
    if (!name) continue
    let at = lower.indexOf(name)
    while (at >= 0) {
      const window = lower.slice(Math.max(0, at - 70), Math.min(lower.length, at + name.length + 90))
      if (activeCue.test(window)) return true
      at = lower.indexOf(name, at + name.length)
    }
  }
  return false
}

/**
 * false chỉ khi có bằng chứng rõ trận thuộc về NPC/người bạn và không có
 * bằng chứng người chơi tham chiến. Trường hợp mơ hồ giữ true để tương thích
 * với các encounter cũ; gate canon khác vẫn phải xác nhận đối thủ/cue battle.
 */
export function battleBelongsToPlayer({ storyText = '', userText = '', ownNames = [] } = {}) {
  const combined = `${String(userText ?? '')}\n${String(storyText ?? '')}`
  const ownActive = ownMonIsActive(combined, ownNames)
  if (ownActive) return true
  // Câu kiểu “tôi tới Gym xem bạn thách đấu” không được để regex thấy chữ
  // “tôi ... thách đấu” ở cùng câu rồi gán nhầm trận cho người chơi.
  if (PLAYER_SPECTATES_THIRD_PARTY_RE.test(combined)) return false
  if (PLAYER_BATTLE_RE.test(combined) || PLAYER_SENDS_MON_RE.test(combined)) return true

  const thirdPartyGym = THIRD_PARTY_GYM_RE.test(combined) || GYM_THIRD_PARTY_RE.test(combined)
  const spectator = SPECTATOR_RE.test(combined)
  if (thirdPartyGym) return false
  if (spectator && /(?:gym|trận\s*đấu|battle|thách\s*đấu|khiêu\s*chiến)/iu.test(combined)) return false
  return true
}
