// Bản đồ 9 vùng (9 thế hệ) — MỖI vùng là 1 chuỗi khu vực tiêu biểu theo đúng
// tiến trình game gốc, kèm dải level wild encounter hợp lý cho khu vực đó.
//
// Đây là dữ liệu ĐỊA LÝ curated thủ công (khác với species/stat/moveset —
// những thứ đó tuyệt đối không gõ tay, xem SKILL): địa danh Pokémon là kiến
// thức nổi tiếng, ổn định, số lượng nhỏ (~10 khu/vùng) nên gõ tay chấp nhận
// được. KHÔNG cố liệt kê đủ mọi route — chỉ các "chặng" tiêu biểu, mỗi chặng
// gộp các route/địa danh lân cận qua mảng `keys` để dò vị trí từ chính văn.
//
// `keys`: từ khoá dò trong text AI viết (không phân biệt hoa thường, ưu tiên
// key dài hơn trước để tránh khớp nhầm). Có thể thêm key tiếng Việt nếu
// preset của bạn hay dịch địa danh.
// `level`: [min, max] — dải level random khi gặp Pokémon hoang dã tại đây.

export const REGIONS = [
  {
    key: 'kanto', name: 'Kanto', gen: 1,
    areas: [
      { key: 'pallet', name: 'Pallet Town', keys: ['Pallet'], level: [2, 5] },
      { key: 'viridian-route', name: 'Route 1-2 / Viridian Forest', keys: ['Route 1', 'Route 2', 'Viridian'], level: [2, 7] },
      { key: 'pewter', name: 'Pewter City / Mt. Moon', keys: ['Pewter', 'Mt. Moon', 'Mount Moon'], level: [7, 12] },
      { key: 'cerulean', name: 'Cerulean / Route 24-25', keys: ['Cerulean', 'Route 24', 'Route 25', 'Nugget Bridge'], level: [10, 16] },
      { key: 'vermilion', name: 'Vermilion / S.S. Anne', keys: ['Vermilion', 'S.S. Anne', 'SS Anne'], level: [14, 20] },
      { key: 'lavender', name: 'Lavender / Rock Tunnel', keys: ['Lavender', 'Rock Tunnel', 'Pokémon Tower', 'Pokemon Tower'], level: [17, 24] },
      { key: 'celadon', name: 'Celadon / Saffron', keys: ['Celadon', 'Saffron', 'Silph'], level: [22, 30] },
      { key: 'fuchsia', name: 'Fuchsia / Safari Zone', keys: ['Fuchsia', 'Safari Zone'], level: [24, 34], safari: true },
      { key: 'cinnabar', name: 'Cinnabar / Seafoam Islands', keys: ['Cinnabar', 'Seafoam'], level: [28, 40] },
      { key: 'victory-road-kanto', name: 'Victory Road / Indigo Plateau', keys: ['Victory Road', 'Indigo Plateau', 'Indigo'], level: [40, 50] },
      { key: 'cerulean-cave', name: 'Cerulean Cave', keys: ['Cerulean Cave', 'Unknown Dungeon'], level: [50, 65] },
    ],
  },
  {
    key: 'johto', name: 'Johto', gen: 2,
    areas: [
      { key: 'newbark', name: 'New Bark Town / Route 29-31', keys: ['New Bark', 'Route 29', 'Route 30', 'Route 31'], level: [2, 6] },
      { key: 'violet', name: 'Violet City / Sprout Tower', keys: ['Violet City', 'Sprout Tower', 'Ruins of Alph'], level: [4, 9] },
      { key: 'azalea', name: 'Azalea / Union Cave / Ilex Forest', keys: ['Azalea', 'Union Cave', 'Ilex'], level: [7, 13] },
      { key: 'goldenrod', name: 'Goldenrod City / National Park', keys: ['Goldenrod', 'National Park'], level: [10, 16] },
      { key: 'ecruteak', name: 'Ecruteak / Burned Tower', keys: ['Ecruteak', 'Burned Tower', 'Tin Tower', 'Bell Tower'], level: [13, 20] },
      { key: 'olivine', name: 'Olivine / Whirl Islands', keys: ['Olivine', 'Whirl Islands', 'Cianwood'], level: [17, 25] },
      { key: 'mahogany', name: 'Mahogany / Lake of Rage', keys: ['Mahogany', 'Lake of Rage'], level: [20, 30] },
      { key: 'blackthorn', name: 'Blackthorn / Ice Path / Dragon\'s Den', keys: ['Blackthorn', 'Ice Path', "Dragon's Den"], level: [26, 36] },
      { key: 'victory-road-johto', name: 'Victory Road (Johto)', keys: ['Victory Road'], level: [38, 48] },
      { key: 'mt-silver', name: 'Mt. Silver', keys: ['Mt. Silver', 'Mount Silver'], level: [55, 70] },
    ],
  },
  {
    key: 'hoenn', name: 'Hoenn', gen: 3,
    areas: [
      { key: 'littleroot', name: 'Littleroot / Route 101-103', keys: ['Littleroot', 'Route 101', 'Route 102', 'Route 103', 'Oldale'], level: [2, 6] },
      { key: 'petalburg', name: 'Petalburg / Petalburg Woods', keys: ['Petalburg', 'Rustboro'], level: [4, 10] },
      { key: 'dewford', name: 'Dewford / Granite Cave', keys: ['Dewford', 'Granite Cave', 'Slateport'], level: [8, 15] },
      { key: 'mauville', name: 'Mauville / Route 110-111', keys: ['Mauville', 'Route 110', 'Route 111', 'Verdanturf'], level: [12, 19] },
      { key: 'fallarbor', name: 'Fallarbor / Mt. Chimney / Lavaridge', keys: ['Fallarbor', 'Mt. Chimney', 'Lavaridge', 'Jagged Pass'], level: [15, 23] },
      { key: 'fortree', name: 'Fortree / Route 119-120', keys: ['Fortree', 'Route 119', 'Route 120', 'Weather Institute'], level: [22, 30] },
      { key: 'lilycove', name: 'Lilycove / Mt. Pyre', keys: ['Lilycove', 'Mt. Pyre'], level: [26, 34] },
      { key: 'mossdeep', name: 'Mossdeep / Seafloor Cavern', keys: ['Mossdeep', 'Seafloor Cavern', 'Sootopolis'], level: [30, 40] },
      { key: 'victory-road-hoenn', name: 'Victory Road / Ever Grande', keys: ['Victory Road', 'Ever Grande'], level: [40, 50] },
      { key: 'sky-pillar', name: 'Sky Pillar / Cave of Origin', keys: ['Sky Pillar', 'Cave of Origin'], level: [50, 68] },
    ],
  },
  {
    key: 'sinnoh', name: 'Sinnoh', gen: 4,
    areas: [
      { key: 'twinleaf', name: 'Twinleaf / Lake Verity / Route 201', keys: ['Twinleaf', 'Lake Verity', 'Route 201', 'Sandgem'], level: [2, 6] },
      { key: 'jubilife', name: 'Jubilife / Oreburgh', keys: ['Jubilife', 'Oreburgh'], level: [4, 10] },
      { key: 'floaroma', name: 'Floaroma / Eterna Forest', keys: ['Floaroma', 'Eterna', 'Valley Windworks'], level: [8, 15] },
      { key: 'hearthome', name: 'Hearthome / Mt. Coronet (chân núi)', keys: ['Hearthome', 'Solaceon'], level: [14, 21] },
      { key: 'veilstone', name: 'Veilstone / Pastoria', keys: ['Veilstone', 'Pastoria', 'Great Marsh'], level: [18, 27], safari: true },
      { key: 'canalave', name: 'Canalave / Iron Island', keys: ['Canalave', 'Iron Island', 'Fuego Ironworks'], level: [24, 33] },
      { key: 'snowpoint', name: 'Snowpoint / Route 216-217', keys: ['Snowpoint', 'Route 216', 'Route 217', 'Acuity'], level: [30, 40] },
      { key: 'coronet', name: 'Mt. Coronet / Spear Pillar', keys: ['Mt. Coronet', 'Spear Pillar'], level: [38, 50] },
      { key: 'victory-road-sinnoh', name: 'Victory Road / Pokémon League', keys: ['Victory Road', 'Pokémon League', 'Pokemon League'], level: [42, 52] },
      { key: 'stark-mountain', name: 'Stark Mountain / Turnback Cave', keys: ['Stark Mountain', 'Turnback Cave', 'Battle Zone'], level: [52, 68] },
    ],
  },
  {
    key: 'unova', name: 'Unova', gen: 5,
    areas: [
      { key: 'nuvema', name: 'Nuvema / Route 1 / Accumula', keys: ['Nuvema', 'Accumula'], level: [2, 6] },
      { key: 'striaton', name: 'Striaton / Dreamyard', keys: ['Striaton', 'Dreamyard'], level: [4, 10] },
      { key: 'nacrene', name: 'Nacrene / Pinwheel Forest', keys: ['Nacrene', 'Pinwheel'], level: [8, 14] },
      { key: 'castelia', name: 'Castelia City', keys: ['Castelia'], level: [12, 19] },
      { key: 'nimbasa', name: 'Nimbasa / Desert Resort', keys: ['Nimbasa', 'Desert Resort', 'Relic Castle'], level: [16, 24] },
      { key: 'driftveil', name: 'Driftveil / Chargestone Cave', keys: ['Driftveil', 'Chargestone'], level: [22, 30] },
      { key: 'mistralton', name: 'Mistralton / Twist Mountain', keys: ['Mistralton', 'Twist Mountain', 'Celestial Tower'], level: [26, 34] },
      { key: 'opelucid', name: 'Opelucid / Dragonspiral Tower', keys: ['Opelucid', 'Dragonspiral'], level: [32, 42] },
      { key: 'victory-road-unova', name: 'Victory Road (Unova)', keys: ['Victory Road'], level: [42, 52] },
      { key: 'giant-chasm', name: 'Giant Chasm', keys: ['Giant Chasm'], level: [50, 66] },
    ],
  },
  {
    key: 'kalos', name: 'Kalos', gen: 6,
    areas: [
      { key: 'vaniville', name: 'Vaniville / Aquacorde / Santalune Forest', keys: ['Vaniville', 'Aquacorde', 'Santalune'], level: [2, 7] },
      { key: 'lumiose-low', name: 'Lumiose City (ngoại vi)', keys: ['Lumiose'], level: [6, 13] },
      { key: 'camphrier', name: 'Camphrier / Connecting Cave', keys: ['Camphrier', 'Connecting Cave', 'Ambrette'], level: [10, 17] },
      { key: 'geosenge', name: 'Geosenge / Reflection Cave / Shalour', keys: ['Geosenge', 'Reflection Cave', 'Shalour'], level: [15, 23] },
      { key: 'coumarine', name: 'Coumarine / Route 13-14', keys: ['Coumarine', 'Lumiose Badlands'], level: [20, 28] },
      { key: 'laverre', name: 'Laverre / Poké Ball Factory', keys: ['Laverre', 'Poké Ball Factory', 'Pokeball Factory'], level: [24, 32] },
      { key: 'anistar', name: 'Anistar / Frost Cavern / Dendemille', keys: ['Anistar', 'Frost Cavern', 'Dendemille'], level: [28, 38] },
      { key: 'snowbelle', name: 'Snowbelle / Pokémon Village', keys: ['Snowbelle', 'Pokémon Village', 'Pokemon Village'], level: [34, 44] },
      { key: 'victory-road-kalos', name: 'Victory Road (Kalos)', keys: ['Victory Road'], level: [44, 55] },
      { key: 'terminus-cave', name: 'Terminus Cave', keys: ['Terminus Cave'], level: [48, 62] },
    ],
  },
  {
    key: 'alola', name: 'Alola', gen: 7,
    areas: [
      { key: 'melemele', name: 'Đảo Melemele / Iki Town / Hau\'oli', keys: ['Melemele', 'Iki Town', "Hau'oli", 'Hauoli'], level: [2, 8] },
      { key: 'verdant', name: 'Verdant Cavern / Ten Carat Hill', keys: ['Verdant Cavern', 'Ten Carat'], level: [6, 12] },
      { key: 'akala', name: 'Đảo Akala / Heahea / Paniola', keys: ['Akala', 'Heahea', 'Paniola', 'Brooklet Hill'], level: [10, 18] },
      { key: 'wela', name: 'Wela Volcano / Lush Jungle', keys: ['Wela', 'Lush Jungle', 'Konikoni'], level: [16, 24] },
      { key: 'ulaula', name: 'Đảo Ula\'ula / Malie City', keys: ["Ula'ula", 'Ulaula', 'Malie'], level: [20, 28] },
      { key: 'thrifty', name: 'Mount Hokulani / Thrifty Megamart', keys: ['Hokulani', 'Thrifty Megamart', 'Tapu Village'], level: [26, 34] },
      { key: 'poni', name: 'Đảo Poni / Seafolk Village', keys: ['Poni', 'Seafolk'], level: [32, 42] },
      { key: 'vast-poni', name: 'Vast Poni Canyon / Altar', keys: ['Vast Poni', 'Altar of the Sunne', 'Altar of the Moone'], level: [40, 50] },
      { key: 'mount-lanakila', name: 'Mount Lanakila / Pokémon League', keys: ['Lanakila'], level: [44, 55] },
      { key: 'ultra-space', name: 'Ultra Space / Ultra Wormhole', keys: ['Ultra Space', 'Ultra Wormhole'], level: [55, 70] },
    ],
  },
  {
    key: 'galar', name: 'Galar', gen: 8,
    areas: [
      { key: 'postwick', name: 'Postwick / Wedgehurst / Slumbering Weald', keys: ['Postwick', 'Wedgehurst', 'Slumbering Weald'], level: [2, 7] },
      { key: 'wild-area-south', name: 'Wild Area (phía nam)', keys: ['Wild Area', 'Motostoke Riverbank', 'Dappled Grove'], level: [7, 18] },
      { key: 'motostoke', name: 'Motostoke / Galar Mine', keys: ['Motostoke', 'Galar Mine'], level: [10, 17] },
      { key: 'hulbury', name: 'Turffield / Hulbury', keys: ['Turffield', 'Hulbury'], level: [14, 22] },
      { key: 'hammerlocke', name: 'Hammerlocke / Route 6', keys: ['Hammerlocke'], level: [20, 28] },
      { key: 'stow-on-side', name: 'Stow-on-Side / Glimwood Tangle / Ballonlea', keys: ['Stow-on-Side', 'Glimwood', 'Ballonlea'], level: [24, 32] },
      { key: 'circhester', name: 'Circhester / Route 8-9', keys: ['Circhester'], level: [28, 38] },
      { key: 'spikemuth', name: 'Spikemuth / Route 10', keys: ['Spikemuth'], level: [34, 44] },
      { key: 'wyndon', name: 'Wyndon / Champion Cup', keys: ['Wyndon', 'Champion Cup'], level: [42, 52] },
      { key: 'crown-tundra', name: 'Isle of Armor / Crown Tundra', keys: ['Isle of Armor', 'Crown Tundra', 'Dyna Tree'], level: [55, 68] },
    ],
  },
  {
    key: 'paldea', name: 'Paldea', gen: 9,
    areas: [
      { key: 'cabo-poco', name: 'Cabo Poco / Poco Path / Los Platos', keys: ['Cabo Poco', 'Poco Path', 'Los Platos', 'Inlet Grotto'], level: [2, 7] },
      { key: 'mesagoza', name: 'Mesagoza / South Province', keys: ['Mesagoza', 'South Province'], level: [5, 14] },
      { key: 'cortondo', name: 'Cortondo / Alfornada', keys: ['Cortondo', 'Alfornada'], level: [12, 20] },
      { key: 'levincia', name: 'Levincia / East Province', keys: ['Levincia', 'East Province', 'Artazon'], level: [16, 26] },
      { key: 'cascarrafa', name: 'Cascarrafa / Asado Desert', keys: ['Cascarrafa', 'Asado Desert', 'Porto Marinada'], level: [22, 32] },
      { key: 'medali', name: 'Medali / West Province', keys: ['Medali', 'West Province'], level: [28, 38] },
      { key: 'montenevera', name: 'Montenevera / Glaseado Mountain', keys: ['Montenevera', 'Glaseado'], level: [34, 46] },
      { key: 'north-province', name: 'North Province / Team Star hideouts', keys: ['North Province', 'Team Star'], level: [40, 52] },
      { key: 'great-crater', name: 'Great Crater of Paldea / Area Zero', keys: ['Great Crater', 'Area Zero', 'Zero Lab'], level: [55, 70] },
      { key: 'kitakami', name: 'Kitakami / Blueberry Academy (DLC)', keys: ['Kitakami', 'Blueberry'], level: [55, 68] },
    ],
  },
]

const REGION_BY_KEY = new Map(REGIONS.map((r) => [r.key, r]))

export function getRegion(regionKey) {
  return REGION_BY_KEY.get(regionKey) ?? null
}

export function getArea(regionKey, areaKey) {
  const region = getRegion(regionKey)
  return region?.areas.find((a) => a.key === areaKey) ?? null
}

/**
 * Random level wild encounter theo khu vực hiện tại. Không có vị trí (hoặc
 * vị trí lỗi) → fallback dải 8-15 cũ để không bao giờ chặn trận đấu.
 */
export function randomWildLevel(location, partyLevel = null) {
  const area = location ? getArea(location.regionKey, location.areaKey) : null
  let [lo, hi] = area?.level ?? [8, 15]
  // Đợt 39 — HỢP LÝ HOÁ theo trình độ người chơi: Pokémon hoang không được
  // vượt quá tầm đội hình hiện tại quá nhiều (tránh cảnh "ngày đầu gặp Lv35").
  // Nếu có partyLevel, kẹp trần = partyLevel + 4 và sàn không âm; nhưng vẫn
  // tôn trọng dải khu (không cho cao hơn dải khu).
  if (partyLevel != null && partyLevel > 0) {
    const cap = partyLevel + 4
    const floor = Math.max(2, partyLevel - 3)
    hi = Math.min(hi, cap)
    lo = Math.max(2, Math.min(lo, hi))
    lo = Math.max(lo, Math.min(floor, hi))
  }
  if (hi < lo) hi = lo
  return lo + Math.floor(Math.random() * (hi - lo + 1))
}

/**
 * Dò xem đoạn text (chính văn AI vừa viết) có nhắc địa danh nào không — cùng
 * tinh thần detectMentionedSpecies: ưu tiên key DÀI hơn trước để tránh khớp
 * nhầm ("Victory Road" xuất hiện ở nhiều vùng → nếu đã biết vùng hiện tại,
 * ưu tiên khu thuộc vùng đó; chưa biết vùng thì lấy khớp đầu tiên).
 *
 * @param {string} text
 * @param {{regionKey, areaKey}|null} currentLocation vị trí hiện tại (để ưu tiên cùng vùng)
 * @returns {{regionKey, areaKey}|null} vị trí mới nếu dò được, ngược lại null
 */
// Dò vị trí từ DÒNG METADATA của preset (đợt 38). Nhiều preset xuất
// [Metadata|ngày|thứ|giờ|VÙNG|KHU|thời tiết] — đây là nguồn ĐÁNG TIN NHẤT
// để chốt vị trí (chính văn có thể nhắc nhiều địa danh gây nhảy lung tung).
// Tìm 2 token bất kỳ trong dòng khớp region.name + area (qua keys/name).
export function detectLocationFromMetadata(text, currentLocation = null) {
  if (!text) return null
  const line = (text.match(/\[\s*metadata[^\]]*\]/i) || [])[0]
  if (!line) return null
  const lower = line.toLowerCase()
  // Xác định vùng trước.
  let region = REGIONS.find((r) => lower.includes(r.name.toLowerCase()))
  const scanRegions = region ? [region] : REGIONS
  const cands = []
  for (const r of scanRegions) {
    for (const area of r.areas) {
      const names = [area.name, ...(area.keys ?? [])]
      for (const nm of names) {
        if (nm.length >= 3 && lower.includes(nm.toLowerCase())) {
          cands.push({ regionKey: r.key, areaKey: area.key, len: nm.length })
          break
        }
      }
    }
  }
  if (!cands.length) return null
  cands.sort((a, b) => b.len - a.len)
  const best = cands[0]
  if (currentLocation && best.regionKey === currentLocation.regionKey && best.areaKey === currentLocation.areaKey) return null
  return { regionKey: best.regionKey, areaKey: best.areaKey }
}

export function detectMentionedArea(text, currentLocation = null) {
  if (!text) return null
  const lower = text.toLowerCase()

  // Đợt 47: ĐẾM SỐ LẦN nhắc thay vì chỉ "có nhắc hay không". Bug thực tế:
  // truyện diễn ra ở Cerulean (nhắc 5-6 lần) nhưng có 1 câu nhắc "Mt. Moon"
  // (viên đá rơi từ Mt. Moon) → thuật toán cũ chọn Mt. Moon vì key dài hơn,
  // dịch chuyển người chơi sai chỗ.
  function countOccurrences(hay, needle) {
    let n = 0
    let i = hay.indexOf(needle)
    while (i !== -1) { n++; i = hay.indexOf(needle, i + needle.length) }
    return n
  }

  const candidates = []
  for (const region of REGIONS) {
    for (const area of region.areas) {
      let mentions = 0
      let keyLength = 0
      for (const k of area.keys) {
        const c = countOccurrences(lower, k.toLowerCase())
        if (c > 0) {
          mentions += c
          keyLength = Math.max(keyLength, k.length)
        }
      }
      if (mentions > 0) candidates.push({ regionKey: region.key, areaKey: area.key, mentions, keyLength })
    }
  }
  if (!candidates.length) return null

  // Ưu tiên: (1) cùng vùng hiện tại, (2) nhắc NHIỀU lần hơn, (3) key dài hơn.
  candidates.sort((a, b) => {
    const aSame = currentLocation && a.regionKey === currentLocation.regionKey ? 1 : 0
    const bSame = currentLocation && b.regionKey === currentLocation.regionKey ? 1 : 0
    if (aSame !== bSame) return bSame - aSame
    if (a.mentions !== b.mentions) return b.mentions - a.mentions
    return b.keyLength - a.keyLength
  })
  const best = candidates[0]

  // "Dính" khu hiện tại: nếu chính khu đang đứng cũng được nhắc với số lần
  // KHÔNG kém khu tốt nhất khác → coi như chưa rời đi (nhắc thoáng qua một
  // địa danh khác không phải là di chuyển; muốn di chuyển tường minh đã có
  // tag [[MOVE]]).
  if (currentLocation) {
    const cur = candidates.find(
      (c) => c.regionKey === currentLocation.regionKey && c.areaKey === currentLocation.areaKey,
    )
    if (cur && cur.mentions >= best.mentions) return null
  }

  // Không đổi gì nếu vẫn là đúng khu hiện tại.
  if (
    currentLocation &&
    best.regionKey === currentLocation.regionKey &&
    best.areaKey === currentLocation.areaKey
  ) {
    return null
  }
  return { regionKey: best.regionKey, areaKey: best.areaKey }
}


// ============ VÙNG SAFARI (đợt 37) ============
// Khu có field safari:true → vào là kích hoạt CHẾ ĐỘ SAFARI (ném bóng/mồi/
// dụ dỗ, KHÔNG đánh nhau). Từ khoá text cũng bắt "safari"/"great marsh" để
// AI mô tả vào khu Safari mà chưa cập nhật vị trí thì vẫn nhận diện được.
export function isSafariArea(location) {
  if (!location) return false
  const area = getArea(location.regionKey, location.areaKey)
  return Boolean(area?.safari)
}
export function textMentionsSafari(text) {
  return /safari zone|great marsh|vùng safari|khu safari/i.test(text ?? '')
}
