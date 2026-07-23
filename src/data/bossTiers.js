// Phân bậc Boss cho Pokémon huyền thoại/huyền ảo — dùng cho tab "Test Boss"
// trong Dev Mode và (sau này) cho trận đấu boss thật trong truyện. Đây là
// phân loại thủ công dựa theo thiết kế game gốc (bộ ba/tứ, huyền ảo, huyền
// thoại đại diện game) — không lấy tự động từ pokedex.json vì Showdown không
// phân "độ hoành tráng" theo đúng tinh thần này.

// Bậc 1 — huyền thoại BỘ BA/TỨ (chim, thú, kiếm sĩ trừ Keldeo, titan, hồ,
// thần đảo, tam trụ tai ương, tam trụ trung thành...). Lv tối đa 120, 1 thanh máu (đợt 26: bỏ nhiều thanh máu theo yêu cầu, giữ trần level).
const LOW_TIER = [
  // Bộ ba chim huyền thoại (Kanto) + biến thể Galar
  'Articuno', 'Zapdos', 'Moltres', 'Articuno-Galar', 'Zapdos-Galar', 'Moltres-Galar',
  // Bộ ba thú huyền thoại (Johto)
  'Raikou', 'Entei', 'Suicune',
  // Bộ ba hồ (Sinnoh)
  'Uxie', 'Mesprit', 'Azelf',
  // Bộ ba kiếm sĩ chính nghĩa (Unova) — trừ Keldeo theo yêu cầu
  'Cobalion', 'Terrakion', 'Virizion',
  // Titan cổ đại (Hoenn) + bổ sung Gen 8
  'Regirock', 'Regice', 'Registeel', 'Regigigas', 'Regieleki', 'Regidrago',
  // Thần đảo Alola
  'Tapu Koko', 'Tapu Lele', 'Tapu Bulu', 'Tapu Fini',
  // Tam trụ tai ương (Paldea)
  'Wo-Chien', 'Chien-Pao', 'Ting-Lu', 'Chi-Yu',
  // Tam trụ trung thành (Paldea DLC)
  'Okidogi', 'Munkidori', 'Fezandipiti',
  // Shaymin dạng thường (Land Forme) và Phione — nhẹ hơn hẳn dạng/họ hàng
  // huyền ảo của chúng (Shaymin-Sky, Manaphy), nên hạ xuống bậc thấp.
  'Shaymin', 'Phione',
]

// Bậc 2 — huyền ảo (Mythical) + vài huyền thoại mạnh dạng đơn lẻ không phải
// đại diện game. Lv tối đa 150, 1 thanh máu (đợt 26).
const MID_TIER = [
  // Huyền ảo (Mythical) — không thể bắt bình thường trong game gốc
  'Mew', 'Celebi', 'Jirachi', 'Deoxys', 'Deoxys-Attack', 'Deoxys-Defense', 'Deoxys-Speed',
  'Manaphy', 'Darkrai', 'Shaymin-Sky', 'Victini', 'Keldeo', 'Keldeo-Resolute',
  'Meloetta', 'Meloetta-Pirouette', 'Genesect', 'Diancie', 'Hoopa',
  'Volcanion', 'Magearna', 'Marshadow', 'Zeraora', 'Meltan', 'Melmetal', 'Zarude', 'Pecharunt',
  // Huyền thoại mạnh dạng đơn/đôi, không phải "đại diện" 1 bản game cụ thể
  'Latios', 'Latias', 'Cresselia', 'Heatran',
]

// Bậc 3 — huyền thoại "đại diện" bản game (thường lên bìa hộp game). Lv tối
// đa 200, 1 thanh máu (đợt 26).
//
// LƯU Ý CÂN BẰNG (đợt 22): trần level 3 bậc hạ từ 150/200/300 xuống
// 120/150/200 theo yêu cầu — với công thức stat thật, level 300 khiến
// huyền thoại bậc cao gần như bất khả chiến bại.
const HIGH_TIER = [
  'Mewtwo', 'Lugia', 'Ho-Oh', 'Kyogre', 'Groudon', 'Rayquaza',
  'Dialga', 'Palkia', 'Giratina', 'Giratina-Origin',
  'Reshiram', 'Zekrom', 'Kyurem', 'Kyurem-Black', 'Kyurem-White',
  'Xerneas', 'Yveltal', 'Zygarde', 'Zygarde-Complete',
  'Solgaleo', 'Lunala', 'Necrozma', 'Necrozma-Dusk-Mane', 'Necrozma-Dawn-Wings', 'Necrozma-Ultra',
  'Zacian', 'Zacian-Crowned', 'Zamazenta', 'Zamazenta-Crowned', 'Eternatus',
  'Koraidon', 'Miraidon', 'Terapagos', 'Terapagos-Stellar',
  'Arceus',
  // Hoopa-Unbound: form giải phóng sức mạnh thật, mạnh vượt xa Hoopa
  // (Confined) — xứng đáng bậc cao thay vì chung rổ với bậc huyền ảo thường.
  'Hoopa-Unbound',
]

export const BOSS_TIERS = {
  low: { key: 'low', label: 'Bậc thấp (bộ ba/tứ)', maxLevel: 120, hpBars: 1, species: LOW_TIER },
  mid: { key: 'mid', label: 'Huyền ảo & huyền thoại mạnh', maxLevel: 150, hpBars: 1, species: MID_TIER },
  high: { key: 'high', label: 'Đại diện bản game', maxLevel: 200, hpBars: 1, species: HIGH_TIER },
}

const NAME_TO_TIER = new Map()
for (const tier of Object.values(BOSS_TIERS)) {
  for (const name of tier.species) {
    NAME_TO_TIER.set(name.toLowerCase(), tier)
  }
}

/** Trả về tier {key,label,maxLevel,hpBars} nếu tên loài nằm trong danh sách boss, ngược lại null. */
export function getBossTier(name) {
  if (!name) return null
  return NAME_TO_TIER.get(name.toLowerCase()) ?? null
}
