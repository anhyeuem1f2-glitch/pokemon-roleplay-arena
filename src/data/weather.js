// ============ THỜI TIẾT THEO LỊCH (đợt 33) ============
// Thời tiết sinh từ (ngày in-game + khu vực) một cách DETERMINISTIC — cùng
// ngày cùng khu luôn ra cùng thời tiết (reload không "đổi trời"), ngày mới
// là trời mới. Mùa tính theo tháng của lịch trong truyện; "chất" khu vực
// (biển/núi lửa/băng/hang...) tái dùng classifyAreaType của hệ nhạc nền.
// Kết quả được bơm vào system prompt mỗi lượt + hiện ở RightHUD; AI được
// dặn kể chuyện khớp thời tiết và không tự đổi trời vô cớ.

import { classifyAreaType } from './musicTracks.js'
import { getArea } from './regions.js'

/** Mùa theo tháng: 3-5 xuân, 6-8 hạ, 9-11 thu, 12/1/2 đông. */
export function getSeason(month) {
  if (month >= 3 && month <= 5) return 'xuân'
  if (month >= 6 && month <= 8) return 'hạ'
  if (month >= 9 && month <= 11) return 'thu'
  return 'đông'
}

// Bảng thời tiết theo mùa — mỗi mục {label, icon, weight}. Trọng số nghiêng
// về thời tiết "thường" để ngày đặc biệt thấy đặc biệt thật.
const SEASON_WEATHER = {
  'xuân': [
    { label: 'nắng nhẹ, trời trong', icon: '🌤', weight: 30 },
    { label: 'mưa phùn lất phất', icon: '🌦', weight: 20 },
    { label: 'âm u nhiều mây', icon: '☁️', weight: 18 },
    { label: 'gió xuân lộng, hoa cỏ bay', icon: '🌬', weight: 14 },
    { label: 'sương sớm dày, tan dần về trưa', icon: '🌫', weight: 10 },
    { label: 'mưa rào ngắn rồi hửng', icon: '🌧', weight: 8 },
  ],
  'hạ': [
    { label: 'nắng gắt, trời xanh gay', icon: '☀️', weight: 30 },
    { label: 'oi nồng, không khí đứng gió', icon: '🥵', weight: 18 },
    { label: 'mưa rào chiều bất chợt', icon: '🌦', weight: 18 },
    { label: 'giông kéo về chiều tối, sấm xa', icon: '⛈', weight: 12 },
    { label: 'nắng có gió, dễ chịu hiếm hoi', icon: '🌤', weight: 14 },
    { label: 'mưa lớn kéo dài', icon: '🌧', weight: 8 },
  ],
  'thu': [
    { label: 'se lạnh, nắng vàng hanh', icon: '🍂', weight: 28 },
    { label: 'gió heo may, lá rụng', icon: '🌬', weight: 20 },
    { label: 'âm u, mưa nhỏ rả rích', icon: '🌧', weight: 16 },
    { label: 'sương mù sáng sớm', icon: '🌫', weight: 14 },
    { label: 'trời trong veo, tầm nhìn xa', icon: '🌤', weight: 14 },
    { label: 'mưa dông trái mùa', icon: '⛈', weight: 8 },
  ],
  'đông': [
    { label: 'lạnh khô, trời xám', icon: '☁️', weight: 26 },
    { label: 'rét đậm, gió cắt da', icon: '🥶', weight: 18 },
    { label: 'mưa lạnh dai dẳng', icon: '🌧', weight: 16 },
    { label: 'nắng đông hiếm hoi, ấm giả', icon: '🌤', weight: 16 },
    { label: 'sương giá phủ sáng sớm', icon: '🌫', weight: 14 },
    { label: 'tuyết rơi nhẹ', icon: '🌨', weight: 10 },
  ],
}

// Ghi đè theo "chất" khu vực — khu đặc thù có tiểu khí hậu riêng.
const AREA_OVERRIDES = {
  cave: () => ({ label: 'không khí trong hang ổn định, mát và ẩm — không thấy trời', icon: '🕳' }),
  // Nơi huyền thoại trú ngụ (Cerulean Cave, Spear Pillar, Area Zero...): tách
  // khỏi thời tiết thường — không khí nặng và tĩnh khác thường.
  endgame: () => ({ label: 'không khí nơi này nặng và tĩnh khác thường, như tách khỏi thời tiết bên ngoài', icon: '🌀' }),
  volcano: (season) => ({
    label: season === 'đông' ? 'hơi nóng núi lửa át cái lạnh, tro bụi lảng bảng' : 'nóng hầm hập, hơi lưu huỳnh thoảng trong gió',
    icon: '🌋',
  }),
  ice: (season) => ({
    label: season === 'hạ' ? 'lạnh quanh năm, tuyết cũ đọng trong bóng râm' : 'tuyết phủ, hơi thở đông thành khói',
    icon: '❄️',
  }),
}

// Biến thể phụ cho khu biển: gió mạnh hơn, mưa tới nhanh đi nhanh.
const SEA_TWIST = ' — gió biển mạnh, thời tiết đổi nhanh'

/** Hash chuỗi đơn giản, deterministic (djb2 rút gọn). */
function hashStr(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

function weightedIndex(list, roll) {
  const total = list.reduce((s, e) => s + e.weight, 0)
  let r = roll % total
  for (let i = 0; i < list.length; i++) {
    r -= list[i].weight
    if (r < 0) return i
  }
  return list.length - 1
}

/**
 * Thời tiết của 1 ngày tại 1 khu — deterministic theo (ngày + khu).
 * @param {{day,month,year}} storyDate
 * @param {{regionKey,areaKey}|null} location
 * @returns {{season: string, label: string, icon: string}}
 */
export function getWeather(storyDate, location) {
  const season = getSeason(storyDate.month)
  const area = location ? getArea(location.regionKey, location.areaKey) : null
  const type = classifyAreaType(area)

  if (type && AREA_OVERRIDES[type]) {
    const o = AREA_OVERRIDES[type](season)
    return { season, ...o }
  }

  const table = SEASON_WEATHER[season]
  const seed = hashStr(`${storyDate.year}-${storyDate.month}-${storyDate.day}-${location?.areaKey ?? 'x'}`)
  const picked = table[weightedIndex(table, seed)]
  const label = type === 'sea' ? picked.label + SEA_TWIST : picked.label
  return { season, label, icon: picked.icon }
}
