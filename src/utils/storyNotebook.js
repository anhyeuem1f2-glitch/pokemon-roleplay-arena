// ============ SỔ TAY THẾ GIỚI — trí nhớ CHI TIẾT theo keyword (đợt 30) ============
// Phương pháp nhớ số 3 (bên cạnh RAG vector đợt 29 và tóm tắt cốt truyện
// storySummary.js): AI khai báo THÔNG TIN CỨNG qua tag [[NPC]] / [[FACT]]
// trong chính văn → app lưu thành sổ tay có KEY (tên nhân vật, tên Pokémon,
// địa điểm, thời gian...). Trước mỗi lượt gọi AI, app dò xem ngữ cảnh gần
// đây nhắc tới key nào thì chèn đúng các mục đó vào prompt — hoạt động y hệt
// World Info/Lorebook của SillyTavern nhưng do AI TỰ XÂY trong lúc chơi.
// Mục đích: chống AI bịa quá khứ — tên/tuổi/nghề/đội Pokémon của NPC, lời
// hứa, mốc thời gian... đều có "giấy trắng mực đen".

const STORAGE_KEY = 'trainer-arena:story-notebook-v1'
const MAX_NPCS = 80
const MAX_FACTS = 250
const MAX_FACTS_PER_KEY = 6
const MAX_INJECT = 8

let cache = null // {npcs: [{name, fields:{}, turn}], facts: [{key, text, turn}]}
const listeners = new Set()

function load() {
  if (cache) return cache
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (saved) {
      const p = JSON.parse(saved)
      if (Array.isArray(p?.npcs) && Array.isArray(p?.facts)) {
        cache = { npcs: p.npcs, facts: p.facts }
        return cache
      }
    }
  } catch { /* làm mới */ }
  cache = { npcs: [], facts: [] }
  return cache
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    try {
      // Quota: bỏ bớt fact cũ nhất rồi thử lại.
      cache.facts = cache.facts.slice(Math.ceil(cache.facts.length / 4))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
    } catch { /* giữ RAM */ }
  }
}

function notify() {
  for (const fn of listeners) {
    try { fn() } catch { /* ignore */ }
  }
}

export function subscribeNotebook(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getNotebook() {
  const s = load()
  return { npcs: [...s.npcs], facts: [...s.facts] }
}

export function getNotebookCounts() {
  const s = load()
  return { npcs: s.npcs.length, facts: s.facts.length }
}

export function clearNotebook() {
  cache = { npcs: [], facts: [] }
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  notify()
}

/** Upsert NPC theo tên (không phân biệt hoa thường) — field mới GHI ĐÈ field cũ cùng tên, field cũ khác giữ nguyên. */
export function upsertNpc(name, fields, turn) {
  const s = load()
  const idx = s.npcs.findIndex((n) => n.name.toLowerCase() === name.toLowerCase())
  if (idx >= 0) {
    s.npcs[idx] = { ...s.npcs[idx], fields: { ...s.npcs[idx].fields, ...fields }, turn }
  } else {
    s.npcs.push({ name, fields, turn })
    if (s.npcs.length > MAX_NPCS) s.npcs.shift()
  }
  persist()
  notify()
}

export function removeNpc(name) {
  const s = load()
  s.npcs = s.npcs.filter((n) => n.name.toLowerCase() !== name.toLowerCase())
  persist()
  notify()
}

/** Thêm 1 fact theo key. Trùng hệt (key+text) thì bỏ qua; mỗi key giữ tối đa MAX_FACTS_PER_KEY mục mới nhất. */
export function addFact(key, text, turn) {
  const s = load()
  const kLow = key.toLowerCase()
  if (s.facts.some((f) => f.key.toLowerCase() === kLow && f.text === text)) return
  s.facts.push({ key, text, turn })
  const ofKey = s.facts.filter((f) => f.key.toLowerCase() === kLow)
  if (ofKey.length > MAX_FACTS_PER_KEY) {
    const drop = ofKey[0]
    s.facts = s.facts.filter((f) => f !== drop)
  }
  if (s.facts.length > MAX_FACTS) s.facts.shift()
  persist()
  notify()
}

export function removeFact(fact) {
  const s = load()
  s.facts = s.facts.filter((f) => !(f.key === fact.key && f.text === fact.text && f.turn === fact.turn))
  persist()
  notify()
}

/** Format 1 NPC thành 1 dòng gọn cho prompt. */
export function formatNpcLine(npc) {
  const parts = Object.entries(npc.fields ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
  return `NPC ${npc.name}${parts.length ? ` — ${parts.join('; ')}` : ''}`
}

/**
 * Dò ngữ cảnh (văn bản các tin gần + input người chơi) xem nhắc tới key nào
 * trong sổ tay → trả về các mục khớp (NPC ưu tiên trước fact, key DÀI ưu
 * tiên trước — bài học "Cerulean Cave" > "Cerulean"). Tối đa MAX_INJECT mục.
 * @param {string} scanText
 * @returns {string[]} các dòng đã format sẵn để chèn prompt
 */
export function findRelevantNotes(scanText) {
  if (!scanText) return []
  const lower = scanText.toLowerCase()
  const s = load()

  const hits = []
  for (const npc of s.npcs) {
    if (npc.name.length >= 2 && lower.includes(npc.name.toLowerCase())) {
      hits.push({ keyLength: npc.name.length, kind: 0, line: formatNpcLine(npc) })
    }
  }
  for (const f of s.facts) {
    // Đợt 47: 1 fact có thể mang NHIỀU từ khoá kích hoạt (cách nhau bằng
    // dấu phẩy / gạch chéo) — y hệt entry World Info của SillyTavern. Khớp
    // BẤT KỲ từ khoá nào là chèn cả nội dung chi tiết vào prompt. Fact cũ
    // 1 keyword vẫn chạy nguyên (split trả về 1 phần tử).
    const keywords = f.key.split(/[,/]/).map((k) => k.trim()).filter((k) => k.length >= 2)
    let bestLen = 0
    for (const k of keywords) {
      if (lower.includes(k.toLowerCase())) bestLen = Math.max(bestLen, k.length)
    }
    if (bestLen > 0) {
      hits.push({ keyLength: bestLen, kind: 1, line: `${f.key}: ${f.text}` })
    }
  }
  hits.sort((a, b) => (a.kind !== b.kind ? a.kind - b.kind : b.keyLength - a.keyLength))
  // Khử trùng lặp dòng (NPC nhắc nhiều lần / fact trùng key).
  const seen = new Set()
  const lines = []
  for (const h of hits) {
    if (seen.has(h.line)) continue
    seen.add(h.line)
    lines.push(h.line)
    if (lines.length >= MAX_INJECT) break
  }
  return lines
}

/** Dựng note sổ tay chèn vào prompt. */
export function buildNotebookNote(lines) {
  if (!lines?.length) return null
  return [
    '[Hệ thống — SỔ TAY THẾ GIỚI: thông tin ĐÃ XÁC LẬP trong truyện, liên quan tới ngữ cảnh hiện tại. Phải giữ NHẤT QUÁN tuyệt đối với các thông tin này (tên, tuổi, nghề, đội Pokémon, lời hứa, mốc thời gian...) — KHÔNG bịa lại khác đi, không nhắc tới ghi chú này.]',
    ...lines.map((l, i) => `${i + 1}. ${l}`),
  ].join('\n')
}
