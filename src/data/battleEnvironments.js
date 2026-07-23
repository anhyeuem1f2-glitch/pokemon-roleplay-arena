// ============ MÔI TRƯỜNG TRẬN ĐẤU (đợt 35) ============
// Môi trường/thời tiết nơi trận đấu diễn ra: hiện banner trong BattleModal
// + nhân hệ số sát thương theo HỆ chiêu cho CẢ 2 phe (xấp xỉ cơ chế weather
// của game gốc: mưa buff nước nerf lửa, nắng ngược lại...). Trận trong
// TRUYỆN tự lấy môi trường từ thời tiết theo lịch (envFromWeather); Dev
// Test Battle cho chọn tay để thử.

export const BATTLE_ENVS = [
  { key: 'none', label: 'Không có gì đặc biệt', desc: 'Trời quang, địa hình thường — không hiệu ứng.', mods: {} },
  { key: 'rain', label: '🌧 Trời mưa', desc: 'Chiêu hệ nước +25%, hệ lửa −25%.', mods: { water: 1.25, fire: 0.75 } },
  { key: 'sun', label: '☀️ Nắng gắt', desc: 'Chiêu hệ lửa +25%, hệ nước −25%.', mods: { fire: 1.25, water: 0.75 } },
  { key: 'storm', label: '⛈ Giông bão', desc: 'Chiêu hệ điện +25%, hệ nước +10%.', mods: { electric: 1.25, water: 1.1 } },
  { key: 'snow', label: '🌨 Tuyết / băng giá', desc: 'Chiêu hệ băng +20%.', mods: { ice: 1.2 } },
  { key: 'sandstorm', label: '🏜 Bão cát', desc: 'Chiêu hệ đá +20%, hệ đất +10%.', mods: { rock: 1.2, ground: 1.1 } },
  { key: 'volcano', label: '🌋 Hơi nóng núi lửa', desc: 'Chiêu hệ lửa +25%, hệ nước −10%, hệ băng −25%.', mods: { fire: 1.25, water: 0.9, ice: 0.75 } },
  { key: 'cave', label: '🕳 Hang tối', desc: 'Không gian kín — chưa có hiệu ứng chỉ số, thuần không khí.', mods: {} },
]

export function getBattleEnv(key) {
  return BATTLE_ENVS.find((e) => e.key === key) ?? BATTLE_ENVS[0]
}

/**
 * Suy môi trường trận từ chuỗi mô tả thời tiết của hệ weather.js (dò từ
 * khoá — bảng thời tiết là data nội bộ nên từ khoá ổn định). Trả null nếu
 * thời tiết không tạo hiệu ứng gì đáng kể.
 */
export function envFromWeather(weatherLabel) {
  if (!weatherLabel) return null
  const w = weatherLabel.toLowerCase()
  if (w.includes('hang')) return getBattleEnv('cave')
  if (w.includes('lưu huỳnh') || w.includes('núi lửa')) return getBattleEnv('volcano')
  if (w.includes('giông')) return getBattleEnv('storm')
  if (w.includes('tuyết') || w.includes('sương giá') || w.includes('lạnh quanh năm')) return getBattleEnv('snow')
  if (w.includes('mưa')) return getBattleEnv('rain')
  if (w.includes('nắng gắt') || w.includes('nóng hầm hập')) return getBattleEnv('sun')
  return null
}

/** Nhân hệ số môi trường vào sát thương (chỉ khi dmg > 0, tối thiểu 1). */
export function applyEnvToDamage(dmg, move, env) {
  if (!env || dmg <= 0) return dmg
  const mult = env.mods?.[move.type] ?? 1
  if (mult === 1) return dmg
  return Math.max(1, Math.round(dmg * mult))
}
