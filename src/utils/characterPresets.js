// ============ LƯU / NẠP HỒ SƠ NHÂN VẬT (đợt 61) ============
// Cho phép lưu toàn bộ thiết lập nhân vật (tên, ngoại hình, thân phận, tính
// cách, siêu năng lực, tông truyện...) để lần sau chơi lại không phải setup
// từ đầu. Lưu vào localStorage máy người chơi.

const KEY = 'trainer-arena:char-presets'

export function loadCharacterPresets() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

function persist(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* quota — bỏ qua */ }
}

/** Lưu 1 preset. Trùng tên thì GHI ĐÈ. Trả về danh sách mới. */
export function saveCharacterPreset(name, data) {
  const clean = (name || '').trim() || 'Nhân vật chưa đặt tên'
  const list = loadCharacterPresets()
  const idx = list.findIndex((p) => p.name.toLowerCase() === clean.toLowerCase())
  const entry = { name: clean, savedAt: Date.now(), data }
  if (idx >= 0) list[idx] = entry
  else list.unshift(entry)
  // Giữ tối đa 20 preset cho gọn.
  const trimmed = list.slice(0, 20)
  persist(trimmed)
  return trimmed
}

export function deleteCharacterPreset(name) {
  const list = loadCharacterPresets().filter((p) => p.name.toLowerCase() !== (name || '').toLowerCase())
  persist(list)
  return list
}
