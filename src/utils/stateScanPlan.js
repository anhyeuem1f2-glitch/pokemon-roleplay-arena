// ============ KẾ HOẠCH QUÉT STATE THÍCH ỨNG (đợt 102) ============
// Một lượt dài có nhiều loại biến rất dễ làm model "rụng" vài proposal dù
// prompt nói không có giới hạn. Thay vì ép một response JSON phải ôm tất cả,
// app dùng 2 pass rộng như cũ rồi, nếu lượt có mật độ state cao, chạy thêm
// các pass chuyên môn. Mỗi pass vẫn không có trần số operation.

export const STATE_FOCUS_GROUPS = [
  {
    id: 'economy',
    label: 'Kinh tế & vật phẩm',
    types: ['MONEY', 'ITEM', 'EQUIP', 'UNEQUIP', 'LOOT', 'SHOP', 'POKECENTER'],
  },
  {
    id: 'pokemon',
    label: 'Pokémon & sinh hoạt',
    types: ['POKEMON', 'EVOLVE', 'LEVEL', 'FRIEND', 'HUNGER', 'RIBBON', 'MARK'],
  },
  {
    id: 'world',
    label: 'Xã hội & thế giới',
    types: ['REL', 'BODY', 'MOVE', 'DATE', 'TRAIN', 'NPC', 'REP', 'WANTED'],
  },
  {
    id: 'progress',
    label: 'Tiến trình & ký ức',
    types: ['FACT', 'BADGE', 'QUEST', 'LEGENDARY_ACCESS'],
  },
]

const CUE_GROUPS = [
  /\b(?:thanh\s*to[aá]n|qu[eẹ]t\s*th[eẻ]|tr[aả]\s+(?:ti[eề]n|\d)|h[oó]a\s*[dđ][oơ]n|s[oố]\s*d[uư]|chuy[eể]n\s*kho[aả]n|ghi\s*c[oó])\b/iu,
  /\b(?:nh[aậ]n\s*(?:[dđ][uư][oợ]c|l[aấ]y)?|mua\s*(?:[dđ][uư][oợ]c)?|nh[aặ]t\s*[dđ][uư][oợ]c|c[aấ]t\s*v[aà]o\s*t[uú]i|m[aấ]t\s*(?:v[aậ]t\s*ph[aẩ]m|[dđ][oồ]))\b/iu,
  /\b(?:l[eê]n\s*c[aấ]p|level\s*up|ti[eế]n\s*h[oó]a|evolve|gia\s*nh[aậ]p|thu\s*ph[uụ]c|b[aắ]t\s*[dđ][uư][oợ]c)\b/iu,
  /\b(?:tin\s*t[uư][oở]ng|g[aắ]n\s*b[oó]|th[aâ]n\s*thi[eế]t|m[aấ]t\s*ni[eề]m\s*tin|qu[yý]\s*m[eế]n)\b/iu,
  /\b(?:b[iị]\s*th[uư][oơ]ng|ch[aả]y\s*m[aá]u|g[aã]y|b[oỏ]ng|h[oồ]i\s*ph[uụ]c|ch[uữ]a\s*tr[iị])\b/iu,
  /\b(?:[dđ]i\s*(?:t[oớ]i|[dđ][eế]n|v[aà]o)|b[uư][oớ]c\s*v[aà]o|[dđ][aặ]t\s*ch[aâ]n|r[oờ]i\s*kh[oỏ]i|t[oớ]i\s*n[oơ]i)\b/iu,
  /\b(?:[aă]n|u[oố]ng|d[uù]ng\s*b[uữ]a|[dđ][oó]i\s*b[uụ]ng|lao\s*l[uự]c)\b/iu,
  /\b(?:s[aá]ng\s*h[oô]m\s*sau|qua\s*[dđ][eê]m|ng[aà]y\s*tr[oô]i\s*qua|luy[eệ]n\s*t[aậ]p|hu[aấ]n\s*luy[eệ]n)\b/iu,
  /\b(?:nhi[eệ]m\s*v[uụ]|huy\s*hi[eệ]u|danh\s*ti[eế]ng|truy\s*n[aã]|l[eệ]nh\s*b[aắ]t|tri[eệ]u\s*h[oồ]i)\b/iu,
  /\b(?:g[aặ]p|xu[aấ]t\s*hi[eệ]n|gi[aá]o\s*s[uư]|y\s*t[aá]|nh[aâ]n\s*vi[eê]n|c[aả]nh\s*s[aá]t|trainer|gym\s*leader)\b/iu,
]

const STATE_TAG_RE = /\[\[\s*(?:MONEY|REL|BODY|POKEMON|EVOLVE|EVOLUTION|LEVEL|LV|FRIEND|FRIENDSHIP|ITEM|EQUIP|UNEQUIP|SHOP|LOOT|POKECENTER|HUNGER|DATE|TRAIN|MOVE|NPC|FACT|BADGE|QUEST|REP|WANTED|LEGENDARY_ACCESS|RIBBON|MARK)\b/giu

function sentenceLikeSegments(text) {
  return String(text ?? '')
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * Ước lượng MẬT ĐỘ thay đổi, không dùng để giới hạn state. Chỉ quyết định có
 * cần bật các pass cứu hộ chuyên môn hay không. Ưu tiên false-positive hơn
 * false-negative: tốn thêm vài call rẻ vẫn tốt hơn làm rơi save.
 */
export function estimateStateChangeLoad(storyText, explicitOperationCount = 0) {
  const text = String(storyText ?? '')
  const explicitTags = [...text.matchAll(STATE_TAG_RE)].length
  let semanticEvents = 0
  for (const segment of sentenceLikeSegments(text)) {
    let hits = 0
    for (const cue of CUE_GROUPS) if (cue.test(segment)) hits += 1
    semanticEvents += Math.min(3, hits)

    // Danh sách mua/nhận thường chứa nhiều operation ITEM trong cùng một câu.
    // x2/x3 hoặc nhiều dấu phẩy là tín hiệu để bật recovery, không tự tạo state.
    const quantities = segment.match(/(?:x|×)\s*\d+|\b\d+\s*(?:c[aá]i|chai|vi[eê]n|qu[aả]|g[oó]i|h[oộ]p|cu[oộ]n|b[oộ])\b/giu)?.length ?? 0
    if (quantities >= 2) semanticEvents += Math.min(4, quantities - 1)
  }
  return Math.max(Number(explicitOperationCount) || 0, explicitTags, semanticEvents)
}

export function shouldUseFocusedStateRecovery(storyText, explicitOperationCount = 0) {
  return estimateStateChangeLoad(storyText, explicitOperationCount) >= 4
}

/**
 * Pass rộng giữ hành vi cũ. Lượt phức tạp thêm 4 shard có focus tách biệt.
 * Không có "max variables" — mỗi shard vẫn được phép trả bao nhiêu proposal
 * tùy chính văn. API configs được RoleplayChat luân phiên độc lập với plan.
 */
export function buildStateScanPlan({ storyText = '', explicitOperationCount = 0, broadPasses = 2 } = {}) {
  const safeBroad = Math.max(1, Math.min(2, Math.trunc(Number(broadPasses) || 1)))
  const plan = [{ role: 'extractor', focus: null, label: 'Toàn bộ state' }]
  if (safeBroad > 1) plan.push({ role: 'auditor', focus: null, label: 'Audit toàn bộ' })
  if (shouldUseFocusedStateRecovery(storyText, explicitOperationCount)) {
    for (const group of STATE_FOCUS_GROUPS) {
      plan.push({ role: 'auditor', focus: group, label: group.label })
    }
  }
  return plan
}
