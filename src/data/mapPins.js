// ============ TOẠ ĐỘ PIN TRÊN ẢNH BẢN ĐỒ (đợt 36) ============
// Vị trí [x%, y%] của từng khu trên ảnh public/maps/<vùng>.* — dùng để vẽ
// CHẤM ĐỎ vị trí người chơi. Toạ độ đặt theo địa lý canonical của từng vùng
// (ảnh người dùng vẽ bám layout gốc — đã đối chiếu ảnh Kanto); lệch chỗ nào
// thì CHỈNH TAY con số % ngay tại đây, lưu là thấy ngay (x: 0 trái → 100
// phải, y: 0 trên → 100 dưới). Khu gộp nhiều địa danh lấy điểm đại diện.

export const MAP_PINS = {
  kanto: {
    'pallet': [25, 58], 'viridian-route': [26, 40], 'pewter': [26, 16],
    'cerulean': [66, 24], 'vermilion': [66, 49], 'lavender': [94, 39],
    'celadon': [49, 40], 'fuchsia': [50, 70], 'cinnabar': [16, 85],
    'victory-road-kanto': [5, 40], 'cerulean-cave': [63, 20],
  },
  johto: {
    'newbark': [88, 62], 'violet': [64, 42], 'azalea': [52, 76],
    'goldenrod': [40, 52], 'ecruteak': [44, 30], 'olivine': [22, 48],
    'mahogany': [64, 26], 'blackthorn': [80, 30],
    'victory-road-johto': [92, 46], 'mt-silver': [94, 34],
  },
  hoenn: {
    'littleroot': [30, 82], 'petalburg': [18, 64], 'dewford': [22, 90],
    'mauville': [44, 52], 'fallarbor': [30, 30], 'fortree': [58, 30],
    'lilycove': [74, 34], 'mossdeep': [88, 40],
    'victory-road-hoenn': [92, 62], 'sky-pillar': [78, 66],
  },
  sinnoh: {
    'twinleaf': [20, 78], 'jubilife': [27, 52], 'floaroma': [33, 30],
    'hearthome': [52, 52], 'veilstone': [72, 42], 'canalave': [16, 44],
    'snowpoint': [42, 10], 'coronet': [48, 44], 'victory-road-sinnoh': [82, 30],
    'stark-mountain': [90, 20],
  },
  unova: {
    'nuvema': [80, 82], 'striaton': [64, 68], 'nacrene': [50, 66],
    'castelia': [46, 78], 'nimbasa': [52, 56], 'driftveil': [36, 52],
    'mistralton': [26, 36], 'opelucid': [58, 26],
    'victory-road-unova': [50, 12], 'giant-chasm': [72, 20],
  },
  kalos: {
    'vaniville': [46, 82], 'lumiose-low': [50, 34], 'camphrier': [34, 56],
    'geosenge': [22, 52], 'coumarine': [16, 42], 'laverre': [72, 52],
    'anistar': [80, 30], 'snowbelle': [58, 76],
    'victory-road-kalos': [86, 62], 'terminus-cave': [70, 66],
  },
  alola: {
    'melemele': [22, 28], 'verdant': [28, 20], 'akala': [50, 44],
    'wela': [56, 36], 'ulaula': [72, 22], 'thrifty': [80, 16],
    'poni': [64, 80], 'vast-poni': [74, 72],
    'mount-lanakila': [78, 30], 'ultra-space': [50, 62],
  },
  galar: {
    'postwick': [50, 90], 'wild-area-south': [48, 74], 'motostoke': [52, 60],
    'hulbury': [64, 56], 'hammerlocke': [50, 44], 'stow-on-side': [30, 40],
    'circhester': [70, 30], 'spikemuth': [76, 42],
    'wyndon': [58, 12], 'crown-tundra': [88, 78],
  },
  paldea: {
    'cabo-poco': [42, 88], 'mesagoza': [46, 62], 'cortondo': [30, 68],
    'levincia': [78, 48], 'cascarrafa': [24, 46], 'medali': [36, 34],
    'montenevera': [56, 22], 'north-province': [64, 14],
    'great-crater': [50, 44], 'kitakami': [90, 12],
  },
}

/** Toạ độ pin [x%, y%] của 1 khu — null nếu chưa khai. */
export function getMapPin(regionKey, areaKey) {
  return MAP_PINS[regionKey]?.[areaKey] ?? null
}

// ============ TOẠ ĐỘ NGƯỜI CHƠI (đợt 75) ============
// `playerLocation` từ save cũ chỉ có regionKey/areaKey. Từ đợt này lưu thêm
// x/y theo phần trăm ảnh (0..100) để pin không bị buộc cứng vào đúng tâm khu
// đại diện. Nếu save/tag chưa có x/y thì tự rơi về MAP_PINS để tương thích.
export function clampMapCoord(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10))
}

export function getLocationCoords(location) {
  if (!location) return null
  const x = clampMapCoord(location.x)
  const y = clampMapCoord(location.y)
  if (x !== null && y !== null) return [x, y]
  return getMapPin(location.regionKey, location.areaKey)
}

export function findNearestMapArea(regionKey, x, y) {
  const nx = clampMapCoord(x)
  const ny = clampMapCoord(y)
  const pins = MAP_PINS[regionKey]
  if (!pins || nx === null || ny === null) return null
  let best = null
  for (const [areaKey, pin] of Object.entries(pins)) {
    const dx = pin[0] - nx
    const dy = pin[1] - ny
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (!best || distance < best.distance) best = { areaKey, distance }
  }
  return best
}

/** Chuẩn hoá location trước khi persist; giữ nguyên field tương lai. */
export function normalizeMapLocation(location) {
  if (!location?.regionKey) return location ?? null
  const explicitX = clampMapCoord(location.x)
  const explicitY = clampMapCoord(location.y)
  let areaKey = location.areaKey ?? null
  if (!areaKey && explicitX !== null && explicitY !== null) {
    areaKey = findNearestMapArea(location.regionKey, explicitX, explicitY)?.areaKey ?? null
  }
  const fallback = areaKey ? getMapPin(location.regionKey, areaKey) : null
  return {
    ...location,
    areaKey,
    x: explicitX ?? fallback?.[0] ?? null,
    y: explicitY ?? fallback?.[1] ?? null,
  }
}
