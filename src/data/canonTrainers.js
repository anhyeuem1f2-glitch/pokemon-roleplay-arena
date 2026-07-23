// ============ ĐỘI HÌNH CANON CỦA TRAINER GỐC (đợt 48) ============
// Yêu cầu beta: khi truyện nhắc tới nhân vật GỐC (gym leader, Tứ Đại Thiên
// Vương, Champion...), AI phải bám SÁT đội hình trong game gốc chứ không
// được bịa. Dữ liệu dưới đây lấy theo trận ĐẦU TIÊN gặp trong game nguồn
// của vùng đó (Gen 1 RBY cho Kanto, Gen 2 GSC cho Johto, Gen 3 RSE cho
// Hoenn, Gen 4 DPPt cho Sinnoh...). Hoạt động y hệt entry World Info: nhắc
// TÊN trainer trong ngữ cảnh gần → chèn đội hình vào prompt.
// (Bổ trợ cho lớp tra Bulbapedia trực tuyến — lớp này chạy cả khi offline.)

export const CANON_TRAINERS = [
  // ---- KANTO (Red/Blue/Yellow) ----
  { name: 'Brock', keys: ['Brock'], line: 'Gym Pewter City (hệ Đá): Geodude Lv.12, Onix Lv.14 — huy hiệu Boulder Badge.' },
  { name: 'Misty', keys: ['Misty'], line: 'Gym Cerulean City (hệ Nước): Staryu Lv.18, Starmie Lv.21 — huy hiệu Cascade Badge.' },
  { name: 'Lt. Surge', keys: ['Lt. Surge', 'Surge'], line: 'Gym Vermilion City (hệ Điện): Voltorb Lv.21, Pikachu Lv.18, Raichu Lv.24 — huy hiệu Thunder Badge.' },
  { name: 'Erika', keys: ['Erika'], line: 'Gym Celadon City (hệ Cỏ): Victreebel Lv.29, Tangela Lv.24, Vileplume Lv.29 — huy hiệu Rainbow Badge.' },
  { name: 'Koga', keys: ['Koga'], line: 'Gym Fuchsia City (hệ Độc): Koffing Lv.37, Muk Lv.39, Koffing Lv.37, Weezing Lv.43 — huy hiệu Soul Badge.' },
  { name: 'Sabrina', keys: ['Sabrina'], line: 'Gym Saffron City (hệ Tâm linh): Kadabra Lv.38, Mr. Mime Lv.37, Venomoth Lv.38, Alakazam Lv.43 — huy hiệu Marsh Badge.' },
  { name: 'Blaine', keys: ['Blaine'], line: 'Gym Cinnabar Island (hệ Lửa): Growlithe Lv.42, Ponyta Lv.40, Rapidash Lv.42, Arcanine Lv.47 — huy hiệu Volcano Badge.' },
  { name: 'Giovanni', keys: ['Giovanni'], line: 'Gym Viridian City (hệ Đất) kiêm trùm Team Rocket: Rhyhorn Lv.45, Dugtrio Lv.42, Nidoqueen Lv.44, Nidoking Lv.45, Rhydon Lv.50 — huy hiệu Earth Badge.' },
  { name: 'Lorelei', keys: ['Lorelei'], line: 'Tứ Đại Thiên Vương Kanto (hệ Băng/Nước): Dewgong Lv.54, Cloyster Lv.53, Slowbro Lv.54, Jynx Lv.56, Lapras Lv.56.' },
  { name: 'Bruno', keys: ['Bruno'], line: 'Tứ Đại Thiên Vương Kanto (hệ Giác đấu): Onix Lv.53, Hitmonchan Lv.55, Hitmonlee Lv.55, Onix Lv.56, Machamp Lv.58.' },
  { name: 'Agatha', keys: ['Agatha'], line: 'Tứ Đại Thiên Vương Kanto (hệ Ma/Độc): Gengar Lv.56, Golbat Lv.56, Haunter Lv.55, Arbok Lv.58, Gengar Lv.60.' },
  { name: 'Lance', keys: ['Lance'], line: 'Tứ Đại Thiên Vương Kanto (hệ Rồng), sau là Champion Johto: Gyarados Lv.58, Dragonair Lv.56 ×2, Aerodactyl Lv.60, Dragonite Lv.62. (Thời GSC: Gyarados Lv.44, Dragonite Lv.47 ×2, Aerodactyl Lv.46, Charizard Lv.46, Dragonite Lv.50.)' },
  { name: 'Blue', keys: ['Blue', 'Gary'], line: 'Kỳ phùng địch thủ / Champion Kanto: đội tiêu biểu Pidgeot, Alakazam, Rhydon, Arcanine/Gyarados/Exeggutor (tuỳ starter), ace là starter tiến hoá cuối (Venusaur/Charizard/Blastoise) Lv.61-65.' },
  { name: 'Red', keys: ['Red'], line: 'Trainer huyền thoại đỉnh Mt. Silver (GSC): Pikachu Lv.81, Espeon Lv.73, Snorlax Lv.75, Venusaur Lv.77, Charizard Lv.77, Blastoise Lv.77.' },

  // ---- JOHTO (Gold/Silver/Crystal) ----
  { name: 'Falkner', keys: ['Falkner'], line: 'Gym Violet City (hệ Bay): Pidgey Lv.7, Pidgeotto Lv.9 — huy hiệu Zephyr Badge.' },
  { name: 'Bugsy', keys: ['Bugsy'], line: 'Gym Azalea Town (hệ Bọ): Metapod Lv.14, Kakuna Lv.14, Scyther Lv.16 — huy hiệu Hive Badge.' },
  { name: 'Whitney', keys: ['Whitney'], line: 'Gym Goldenrod City (hệ Thường): Clefairy Lv.18, Miltank Lv.20 (Rollout khét tiếng) — huy hiệu Plain Badge.' },
  { name: 'Morty', keys: ['Morty'], line: 'Gym Ecruteak City (hệ Ma): Gastly Lv.21, Haunter Lv.21, Gengar Lv.25, Haunter Lv.23 — huy hiệu Fog Badge.' },
  { name: 'Chuck', keys: ['Chuck'], line: 'Gym Cianwood City (hệ Giác đấu): Primeape Lv.27, Poliwrath Lv.30 — huy hiệu Storm Badge.' },
  { name: 'Jasmine', keys: ['Jasmine'], line: 'Gym Olivine City (hệ Thép): Magnemite Lv.30 ×2, Steelix Lv.35 — huy hiệu Mineral Badge.' },
  { name: 'Pryce', keys: ['Pryce'], line: 'Gym Mahogany Town (hệ Băng): Seel Lv.27, Dewgong Lv.29, Piloswine Lv.31 — huy hiệu Glacier Badge.' },
  { name: 'Clair', keys: ['Clair'], line: 'Gym Blackthorn City (hệ Rồng): Dragonair Lv.37 ×3, Kingdra Lv.40 — huy hiệu Rising Badge.' },

  // ---- HOENN (Ruby/Sapphire/Emerald) ----
  { name: 'Roxanne', keys: ['Roxanne'], line: 'Gym Rustboro City (hệ Đá): Geodude Lv.14, Nosepass Lv.15 — huy hiệu Stone Badge.' },
  { name: 'Brawly', keys: ['Brawly'], line: 'Gym Dewford Town (hệ Giác đấu): Machop Lv.17, Makuhita Lv.18 — huy hiệu Knuckle Badge.' },
  { name: 'Wattson', keys: ['Wattson'], line: 'Gym Mauville City (hệ Điện): Magnemite Lv.22, Voltorb Lv.20, Magneton Lv.23 — huy hiệu Dynamo Badge.' },
  { name: 'Flannery', keys: ['Flannery'], line: 'Gym Lavaridge Town (hệ Lửa): Slugma Lv.26 ×2, Torkoal Lv.28 — huy hiệu Heat Badge.' },
  { name: 'Norman', keys: ['Norman'], line: 'Gym Petalburg City (hệ Thường), cha của nhân vật chính RSE: Slaking Lv.28, Vigoroth Lv.30, Slaking Lv.31 — huy hiệu Balance Badge.' },
  { name: 'Winona', keys: ['Winona'], line: 'Gym Fortree City (hệ Bay): Swellow Lv.31, Pelipper Lv.30, Skarmory Lv.32, Altaria Lv.33 — huy hiệu Feather Badge.' },
  { name: 'Tate', keys: ['Tate', 'Liza', 'Tate và Liza'], line: 'Gym đôi Mossdeep City (hệ Tâm linh): Solrock Lv.42 + Lunatone Lv.42 (đánh đôi) — huy hiệu Mind Badge.' },
  { name: 'Wallace', keys: ['Wallace'], line: 'Gym Sootopolis City (hệ Nước, RS) / Champion (Emerald): Wailord, Tentacruel, Ludicolo, Whiscash, Gyarados, ace Milotic.' },
  { name: 'Steven', keys: ['Steven', 'Steven Stone'], line: 'Champion Hoenn (RS): Skarmory Lv.57, Claydol Lv.55, Aggron Lv.56, Cradily Lv.56, Armaldo Lv.56, ace Metagross Lv.58.' },

  // ---- SINNOH (Diamond/Pearl/Platinum) ----
  { name: 'Roark', keys: ['Roark'], line: 'Gym Oreburgh City (hệ Đá): Geodude Lv.12, Onix Lv.12, Cranidos Lv.14 — huy hiệu Coal Badge.' },
  { name: 'Gardenia', keys: ['Gardenia'], line: 'Gym Eterna City (hệ Cỏ): Cherubi Lv.19, Turtwig Lv.19, Roserade Lv.22 — huy hiệu Forest Badge.' },
  { name: 'Maylene', keys: ['Maylene'], line: 'Gym Veilstone City (hệ Giác đấu): Meditite Lv.28, Machoke Lv.29, Lucario Lv.32 — huy hiệu Cobble Badge.' },
  { name: 'Fantina', keys: ['Fantina'], line: 'Gym Hearthome City (hệ Ma): Drifblim Lv.32, Gengar Lv.34, Mismagius Lv.36 (DP) — huy hiệu Relic Badge.' },
  { name: 'Cynthia', keys: ['Cynthia'], line: 'Champion Sinnoh: Spiritomb Lv.61, Roserade Lv.60, Togekiss Lv.60, Lucario Lv.63, Milotic Lv.63, ace Garchomp Lv.66 (Platinum).' },

  // ---- Nhân vật phản diện tiêu biểu ----
  { name: 'Jessie', keys: ['Jessie'], line: 'Team Rocket (anime): Ekans→Arbok, Wobbuffet; đi cùng James và Meowth biết nói. Chuyên bám theo Pikachu của Ash, độ nguy hiểm thấp, hay thất bại hài hước.' },
  { name: 'James', keys: ['James'], line: 'Team Rocket (anime): Koffing→Weezing, Growlithe (Growlie); đi cùng Jessie và Meowth. Xuất thân quý tộc bỏ nhà đi.' },
  { name: 'Archie', keys: ['Archie'], line: 'Thủ lĩnh Team Aqua (Hoenn): Mightyena, Crobat, ace Sharpedo — mục tiêu đánh thức Kyogre mở rộng biển.' },
  { name: 'Maxie', keys: ['Maxie'], line: 'Thủ lĩnh Team Magma (Hoenn): Mightyena, Crobat, ace Camerupt — mục tiêu đánh thức Groudon mở rộng đất liền.' },
]

const MAX_CANON_INJECT = 4

/** Dò ngữ cảnh gần → trả về các dòng đội hình canon của trainer được nhắc. */
export function findCanonTrainerLines(scanText) {
  if (!scanText) return []
  const lower = scanText.toLowerCase()
  const lines = []
  for (const t of CANON_TRAINERS) {
    if (t.keys.some((k) => lower.includes(k.toLowerCase()))) {
      lines.push(`${t.name} — ${t.line}`)
      if (lines.length >= MAX_CANON_INJECT) break
    }
  }
  return lines
}

/** Note chèn prompt (null nếu không nhắc trainer canon nào). */
export function buildCanonTrainerNote(scanText) {
  const lines = findCanonTrainerLines(scanText)
  if (!lines.length) return null
  return [
    '[Hệ thống — ĐỘI HÌNH CANON: các nhân vật gốc sau đang được nhắc tới. Đội Pokémon/vai trò của họ PHẢI bám sát dữ liệu game gốc dưới đây (có thể chênh level nhẹ theo mạch truyện, KHÔNG đổi loài, không bịa thành viên lạ). Không nhắc tới ghi chú này:]',
    ...lines.map((l, i) => `${i + 1}. ${l}`),
  ].join('\n')
}
