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
