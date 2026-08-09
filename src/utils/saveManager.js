import { deleteLargeCache, readLargeCache, writeLargeCache } from './browserCache.js'
import { exportArchiveEntries, importArchiveEntries } from './storyArchive.js'

// ============ LƯU / TẢI GAME (đợt 69) ============
// Yêu cầu người chơi: "cập nhật thêm tính năng save game như Pokémon gốc".
//
// Cách làm: KHÔNG liệt kê tay từng biến (dễ bỏ sót khi thêm tính năng mới).
// Thay vào đó CHỤP toàn bộ khoá `trainer-arena:*` trong localStorage —
// mọi state của game đều nằm ở đó. Trừ ra các khoá thuộc về THIẾT BỊ chứ
// không thuộc về ván chơi: cấu hình API (chứa API key — không được lọt vào
// file save đem chia sẻ), preset nhân vật, âm lượng.

const PREFIX = 'trainer-arena:'
const SLOT_KEY = 'trainer-arena-saves:v1'
const SLOT_DB_KEY = 'save-slots:v2'
const TURN_CHECKPOINT_KEY = 'turn-checkpoint:v1'
const BRANCH_CHECKPOINT_KEY = 'branch-checkpoint:v1'
const BRANCH_CHECKPOINT_INDEX_KEY = 'branch-checkpoint-index:v1'
const MAX_BRANCH_CHECKPOINTS = 96
export const MAX_SLOTS = 3

// Khoá KHÔNG thuộc ván chơi → không lưu vào save, không ghi đè khi tải.
const EXCLUDE = [
  'api-config', 'outcome-api', 'anime-api', 'state-api', 'memory-api', 'wiki',
  'char-presets', 'music-volume', 'music-muted', 'music-settings', 'bridge-needed',
  // Đợt 78: đây là cache tải lại được, không phải save. Đặc biệt `saves`
  // tuyệt đối không được chụp vào chính một ô save — code cũ tạo save lồng
  // save, mỗi lần ghi đè lại phình theo cấp số nhân đến đầy localStorage.
  'pokedex-cache', 'moves-cache', 'learnsets-cache', 'wiki-cache', 'saves',
]

function isGameKey(key) {
  if (!key.startsWith(PREFIX) || key === SLOT_KEY) return false
  const short = key.slice(PREFIX.length)
  return !EXCLUDE.some((ex) => short.includes(ex))
}

function sanitizeSnapshot(data) {
  const clean = {}
  for (const [key, value] of Object.entries(data ?? {})) {
    if (isGameKey(key) && typeof value === 'string') clean[key] = value
  }
  return clean
}

/** Chụp toàn bộ trạng thái ván chơi hiện tại. */
export function snapshotGame() {
  const data = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && isGameKey(k)) data[k] = localStorage.getItem(k)
    }
  } catch { /* ignore */ }
  return data
}

/**
 * Checkpoint duy nhất cho lượt đang chờ/đã trả lời gần nhất. Reroll trong UI chỉ
 * được phép ở lượt cuối nên không cần giữ 2.000 bản sao state. Lưu IndexedDB để
 * party/worldbook lớn không ăn quota localStorage.
 */
export async function saveTurnCheckpoint(trainerId, baseMessages, userText, userMessageId = '') {
  const data = snapshotGame()
  delete data['trainer-arena:messages']
  const payload = {
    trainerId: String(trainerId ?? ''),
    savedAt: Date.now(),
    data,
    baseMessages: Array.isArray(baseMessages) ? baseMessages : [],
    userText: String(userText ?? ''),
    userMessageId: String(userMessageId ?? ''),
  }
  if (!await writeLargeCache(`${TURN_CHECKPOINT_KEY}:${payload.trainerId}`, payload)) {
    throw new Error('Không tạo được checkpoint an toàn cho lượt mới; hãy giải phóng bộ nhớ trình duyệt rồi thử lại.')
  }
  return payload
}

export async function restoreTurnCheckpoint(trainerId, replacementUserText = null, expectedUserIndex = null) {
  const key = `${TURN_CHECKPOINT_KEY}:${String(trainerId ?? '')}`
  const checkpoint = await readLargeCache(key)
  if (!checkpoint || checkpoint.trainerId !== String(trainerId ?? '')) return null
  if (Number.isInteger(expectedUserIndex) && (checkpoint.baseMessages?.length ?? 0) !== expectedUserIndex) return null
  applySnapshot(checkpoint.data)
  const userText = replacementUserText === null ? checkpoint.userText : String(replacementUserText)
  const restoredMessages = [...(checkpoint.baseMessages ?? []), { ...(checkpoint.userMessageId ? { id: checkpoint.userMessageId } : {}), role: 'user', content: userText }]
  try { localStorage.setItem('trainer-arena:messages', JSON.stringify(restoredMessages)) } catch { /* storageOptimizer sẽ xử lý lại sau reload */ }
  return { ...checkpoint, userText, restoredMessages }
}

/**
 * Checkpoint lịch sử cho từng NHÁNH chat. Khác TURN_CHECKPOINT (chỉ giữ lượt
 * cuối để reroll), checkpoint này chỉ chụp STATE game trước khi gửi một input
 * và KHÔNG nhân bản transcript. Nhờ vậy xoá/reroll một nhánh có thể hoàn tác
 * Pokémon/tiền/item/world state thay vì chỉ xoá chữ khỏi màn hình.
 *
 * Để IndexedDB không phình vô hạn, chỉ giữ 96 checkpoint gần nhất mỗi trainer.
 * Save cũ hơn vẫn có fallback source-ledger, nhưng mọi lượt mới đều rollback
 * chính xác trong cửa sổ này.
 */
export async function saveBranchStateCheckpoint(trainerId, turnId) {
  const trainer = String(trainerId ?? '')
  const id = String(turnId ?? '').trim()
  if (!trainer || !id) return false
  const data = snapshotGame()
  delete data['trainer-arena:messages']
  const key = `${BRANCH_CHECKPOINT_KEY}:${trainer}:${id}`
  const payload = { trainerId: trainer, turnId: id, savedAt: Date.now(), data }
  if (!await writeLargeCache(key, payload)) return false

  const indexKey = `${BRANCH_CHECKPOINT_INDEX_KEY}:${trainer}`
  const existing = await readLargeCache(indexKey)
  const rows = Array.isArray(existing) ? existing.filter((row) => row?.turnId !== id) : []
  rows.push({ turnId: id, savedAt: payload.savedAt })
  rows.sort((a, b) => Number(a.savedAt) - Number(b.savedAt))
  while (rows.length > MAX_BRANCH_CHECKPOINTS) {
    const old = rows.shift()
    if (old?.turnId) await deleteLargeCache(`${BRANCH_CHECKPOINT_KEY}:${trainer}:${old.turnId}`)
  }
  await writeLargeCache(indexKey, rows)
  return true
}

/** Khôi phục state trước một input nhưng để caller quyết định transcript giữ lại. */
export async function restoreBranchStateCheckpoint(trainerId, turnId, restoredMessages = null) {
  const trainer = String(trainerId ?? '')
  const id = String(turnId ?? '').trim()
  if (!trainer || !id) return null
  const checkpoint = await readLargeCache(`${BRANCH_CHECKPOINT_KEY}:${trainer}:${id}`)
  if (!checkpoint || checkpoint.trainerId !== trainer || checkpoint.turnId !== id) return null
  applySnapshot(checkpoint.data)
  if (Array.isArray(restoredMessages)) {
    try { localStorage.setItem('trainer-arena:messages', JSON.stringify(restoredMessages)) } catch { /* reload sẽ đọc bản đã persist được */ }
  }
  return checkpoint
}

export async function deleteBranchStateCheckpoint(trainerId, turnId) {
  const trainer = String(trainerId ?? '')
  const id = String(turnId ?? '').trim()
  if (!trainer || !id) return false
  const ok = await deleteLargeCache(`${BRANCH_CHECKPOINT_KEY}:${trainer}:${id}`)
  const indexKey = `${BRANCH_CHECKPOINT_INDEX_KEY}:${trainer}`
  const existing = await readLargeCache(indexKey)
  if (Array.isArray(existing)) {
    await writeLargeCache(indexKey, existing.filter((row) => row?.turnId !== id))
  }
  return ok
}

/** Thông tin tóm tắt để hiển thị trên ô save (như màn hình save game gốc). */
export function describeSnapshot(data) {
  const read = (k, fallback) => {
    try { return JSON.parse(data[PREFIX + k]) } catch { return fallback }
  }
  const name = (() => {
    try { return data[PREFIX + 'player-name'] ?? '' } catch { return '' }
  })()
  const party = read('party', []) ?? []
  const profile = read('player-profile', {}) ?? {}
  const date = read('story-date', null)
  const messages = read('messages', []) ?? []
  return {
    playerName: name || 'Chưa đặt tên',
    partyCount: party.length,
    topLevel: party.reduce((m, p) => Math.max(m, p?.level ?? 0), 0),
    money: profile?.money ?? 0,
    turns: messages.filter((m) => m?.role === 'assistant').length,
    date: date ? `${date.day}/${date.month}/${date.year}` : null,
    avatarUrl: profile?.avatarUrl || '',
  }
}

async function loadSlots() {
  let source = null
  let fromLegacyLocal = false

  // Đợt 78: ô save chứa cả lịch sử truyện nên có thể lớn hơn quota
  // localStorage. IndexedDB có quota rộng hơn; localStorage chỉ còn là
  // fallback cho trình duyệt không hỗ trợ/đang chặn IndexedDB.
  const stored = await readLargeCache(SLOT_DB_KEY)
  if (stored && typeof stored === 'object') {
    source = stored.slots ?? stored
  }

  if (!source) {
    try {
      const raw = localStorage.getItem(SLOT_KEY)
      if (raw) {
        source = JSON.parse(raw)
        fromLegacyLocal = true
      }
    } catch { /* ignore */ }
  }

  const parsed = source ?? {}
  let changed = false
  const cleaned = {}
  for (const [slot, entry] of Object.entries(parsed ?? {})) {
    if (!entry?.data) continue
    const data = sanitizeSnapshot(entry.data)
    if (Object.keys(data).length !== Object.keys(entry.data).length) changed = true
    cleaned[slot] = { ...entry, data, info: describeSnapshot(data) }
  }

  if (changed || fromLegacyLocal) {
    await persistSlots(cleaned)
  }
  return cleaned
}

async function persistSlots(slots) {
  const payload = { version: 2, slots }
  if (await writeLargeCache(SLOT_DB_KEY, payload)) {
    try { localStorage.removeItem(SLOT_KEY) } catch { /* ignore */ }
    return
  }
  // Fallback an toàn: app vẫn lưu được trên trình duyệt không có IndexedDB,
  // chỉ bị giới hạn quota nhỏ như các bản cũ.
  localStorage.setItem(SLOT_KEY, JSON.stringify(slots))
}

/** Chạy migration dọn save lồng/cache cũ ngay khi app mở. */
export async function repairSaveSlots() {
  try {
    const slots = await loadSlots()
    await persistSlots(slots)
    return slots
  } catch {
    return {}
  }
}

/** Danh sách 3 ô save (null = ô trống). */
export async function listSaves() {
  const slots = await loadSlots()
  return Array.from({ length: MAX_SLOTS }, (_, i) => {
    const s = slots[i]
    if (!s) return null
    return { slot: i, savedAt: s.savedAt, info: s.info }
  })
}

/** Lưu ván hiện tại vào ô `slot`. Ném lỗi nếu bộ nhớ đầy. */
export async function saveToSlot(slot) {
  const data = snapshotGame()
  const archive = await exportArchiveEntries(data[PREFIX + 'trainer-id'] || 'legacy')
  const slots = await loadSlots()
  slots[slot] = { savedAt: Date.now(), info: describeSnapshot(data), data, archive }
  try {
    await persistSlots(slots)
  } catch {
    throw new Error(
      'Bộ nhớ trình duyệt đã đầy nên không lưu được. Hãy xoá bớt một ô save cũ, ' +
      'hoặc dùng "Xuất ra file" để cất ván chơi ra ngoài rồi xoá bớt.',
    )
  }
  return listSaves()
}

/** Ghi đè trạng thái game bằng dữ liệu của ô `slot`. Trả về false nếu ô trống. */
export async function loadFromSlot(slot) {
  const slots = await loadSlots()
  const entry = slots[slot]
  if (!entry?.data) return false
  applySnapshot(entry.data)
  // Save đời cũ chưa đóng gói archive: xoá nhánh IndexedDB tương lai của
  // cùng trainer rồi để backfill từ messages của slot chạy sau reload.
  await importArchiveEntries(Array.isArray(entry.archive) ? entry.archive : [], entry.data[PREFIX + 'trainer-id'] || 'legacy')
  return true
}

export async function deleteSlot(slot) {
  const slots = await loadSlots()
  delete slots[slot]
  await persistSlots(slots)
  return listSaves()
}

/** Ghi đè localStorage bằng snapshot (xoá state ván cũ trước cho sạch). */
export function applySnapshot(data) {
  try {
    const cleanData = sanitizeSnapshot(data)
    // Xoá state ván hiện tại (giữ nguyên cấu hình API/thiết bị).
    const toRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && isGameKey(k)) toRemove.push(k)
    }
    for (const k of toRemove) localStorage.removeItem(k)
    for (const [k, v] of Object.entries(cleanData)) localStorage.setItem(k, v)
  } catch { /* ignore */ }
}

/** Xuất ván hiện tại ra file .json để cất ra ngoài trình duyệt. */
export async function exportSaveFile() {
  const data = snapshotGame()
  const payload = {
    format: 'trainer-arena-save',
    version: 2,
    exportedAt: new Date().toISOString(),
    info: describeSnapshot(data),
    data,
    archive: await exportArchiveEntries(data[PREFIX + 'trainer-id'] || 'legacy'),
  }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `trainer-arena-save-${stamp}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Nạp ván chơi từ file .json đã xuất. Ném lỗi nếu file sai định dạng. */
export async function importSaveFile(file) {
  if (!file) throw new Error('Chưa chọn file nào.')
  const text = await file.text()
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('File không đọc được — có phải file save của Trainer Arena không?')
  }
  if (payload?.format !== 'trainer-arena-save' || !payload?.data) {
    throw new Error('File này không phải file save của Trainer Arena.')
  }
  applySnapshot(payload.data)
  await importArchiveEntries(Array.isArray(payload.archive) ? payload.archive : [], payload.data[PREFIX + 'trainer-id'] || 'legacy')
  return describeSnapshot(payload.data)
}
