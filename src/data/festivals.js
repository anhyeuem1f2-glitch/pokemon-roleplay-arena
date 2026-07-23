// ============ LỊCH LỄ HỘI THEO VÙNG (đợt 33) ============
// Mỗi vùng có lễ hội riêng hợp văn hoá/khí chất vùng đó (data curated thủ
// công, lấy cảm hứng từ lore chính thống nhưng viết nguyên bản). Tới ngày
// (hoặc sắp tới trong vài ngày) và người chơi ĐANG Ở vùng đó thì thông tin
// được bơm vào ngữ cảnh — thế giới có nhịp sống theo mùa, không phải ngày
// nào cũng như ngày nào.

export const FESTIVALS = [
  // Kanto
  { regionKey: 'kanto', month: 4, day: 5, duration: 3, name: 'Hội hoa đầu xuân Pallet', desc: 'lễ hội ngắm hoa của các thị trấn nhỏ quanh Pallet: trải bạt dưới tán cây, đồ ăn nhà làm, Pokémon cỏ được dịp cưng chiều' },
  { regionKey: 'kanto', month: 8, day: 15, duration: 1, name: 'Đêm đèn lồng Lavender', desc: 'đêm tưởng niệm những Pokémon đã khuất — cả thị trấn thả đèn, chuông Tháp Pokémon ngân suốt đêm; không khí trang nghiêm, không phải hội vui' },
  // Johto
  { regionKey: 'johto', month: 5, day: 20, duration: 2, name: 'Lễ rước lông vũ Ecruteak', desc: 'lễ cổ truyền tôn kính Ho-Oh: múa Kimono, rước kiệu qua hai toà tháp; khách thập phương đổ về Ecruteak đông nghẹt' },
  { regionKey: 'johto', month: 3, day: 12, duration: 1, name: 'Hội trà Azalea', desc: 'phiên hội nhỏ ấm cúng quanh giếng Slowpoke: trà, bánh, và những chuyện kể của thợ làm bóng Kurt' },
  // Hoenn
  { regionKey: 'hoenn', month: 7, day: 1, duration: 3, name: 'Hội biển Slateport', desc: 'mùa hè tại cảng: chợ hải sản mở khuya, đua bơi cùng Pokémon nước, người tứ xứ chen chân' },
  { regionKey: 'hoenn', month: 10, day: 8, duration: 1, name: 'Lễ cầu mùa Fortree', desc: 'dân thành phố trên cây tạ ơn rừng: treo bùa gió khắp các cầu treo, thả hạt giống theo gió' },
  // Sinnoh
  { regionKey: 'sinnoh', month: 12, day: 1, duration: 2, name: 'Đêm tuyết đầu mùa Snowpoint', desc: 'đón trận tuyết đầu: đèn băng, canh nóng, và tục im lặng một phút hướng về đền Snowpoint' },
  { regionKey: 'sinnoh', month: 10, day: 18, duration: 1, name: 'Lễ chuyện cổ Celestic', desc: 'đêm kể chuyện khởi nguyên bên hồ: người già Celestic kể tích Dialga–Palkia cho trẻ con và khách lạ' },
  // Unova
  { regionKey: 'unova', month: 9, day: 22, duration: 2, name: 'Hội mùa gặt Floccesy', desc: 'hội nông trang: thi Miltank cho sữa, đấu giá berry, nhảy dân vũ tới khuya' },
  { regionKey: 'unova', month: 6, day: 30, duration: 1, name: 'Đêm ánh sáng cầu Skyarrow', desc: 'Castelia tắt bớt đèn cao ốc một đêm để thắp sáng cây cầu — dòng người đi bộ qua cầu như sông' },
  // Kalos
  { regionKey: 'kalos', month: 9, day: 5, duration: 4, name: 'Tuần thời trang Lumiose', desc: 'kinh đô ánh sáng vào mùa: sàn diễn, thợ ảnh, và cả một nền kinh tế vỉa hè ăn theo' },
  { regionKey: 'kalos', month: 4, day: 22, duration: 1, name: 'Hội hoa Camphrier', desc: 'hội hoa cổ kính bên lâu đài: triển lãm Flabébé theo màu, trà chiều ngoài bãi cỏ' },
  // Alola
  { regionKey: 'alola', month: 6, day: 25, duration: 3, name: 'Hội lửa bãi biển Alola', desc: 'đêm hội đảo: lửa trại dọc bãi cát, nhảy múa, nướng cá — mỗi đảo một sắc thái riêng' },
  { regionKey: 'alola', month: 1, day: 10, duration: 1, name: 'Lễ tạ ơn Thần hộ đảo', desc: 'các làng dâng lễ vật lên bàn thờ Tapu; du khách được dặn giữ lễ, người bản địa nghiêm cẩn khác hẳn ngày thường' },
  // Galar
  { regionKey: 'galar', month: 8, day: 10, duration: 2, name: 'Ngày hội khán đài Wyndon', desc: 'không khí bóng đá kiểu Galar cho mùa giải gym: diễu hành cổ động viên, áo đấu, kèn trống rợp phố' },
  { regionKey: 'galar', month: 11, day: 5, duration: 1, name: 'Đêm lửa đồng hoang', desc: 'tục đốt lửa lớn cuối thu của các thị trấn quanh Motostoke — xua cái lạnh và những điều gở' },
  // Paldea
  { regionKey: 'paldea', month: 3, day: 15, duration: 3, name: 'Hội ẩm thực Mesagoza', desc: 'phố lớn thành chợ đồ ăn khổng lồ: sandwich thi thố, quầy nào cũng tự nhận "ngon nhất Paldea"' },
  { regionKey: 'paldea', month: 5, day: 28, duration: 1, name: 'Ngày hội trường Naranja–Uva', desc: 'ngày hội mở cửa của học viện: gian trò chơi, trận giao hữu học sinh, phụ huynh đông hơn học sinh' },
]

/** Ngày trong năm (xấp xỉ, đủ cho so khoảng cách lễ hội). */
function dayOfYear(month, day) {
  const cum = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  return cum[month - 1] + day
}

/**
 * Lễ hội ĐANG diễn ra + SẮP diễn ra (trong lookahead ngày) tại vùng hiện tại.
 * @param {{day,month}} storyDate
 * @param {string|null} regionKey
 * @returns {{today: Array, upcoming: Array<{festival, inDays}>}}
 */
export function getFestivalContext(storyDate, regionKey, lookahead = 6) {
  if (!regionKey) return { today: [], upcoming: [] }
  const now = dayOfYear(storyDate.month, storyDate.day)
  const today = []
  const upcoming = []
  for (const f of FESTIVALS) {
    if (f.regionKey !== regionKey) continue
    const start = dayOfYear(f.month, f.day)
    const end = start + f.duration - 1
    // Khoảng cách có vòng năm (lễ đầu tháng 1 nhìn từ cuối tháng 12).
    let delta = start - now
    if (delta < -370 + lookahead) delta += 365
    if (now >= start && now <= end) today.push(f)
    else if (delta > 0 && delta <= lookahead) upcoming.push({ festival: f, inDays: delta })
    else if (delta < 0 && delta + 365 <= lookahead) upcoming.push({ festival: f, inDays: delta + 365 })
  }
  return { today, upcoming }
}

/** Dựng dòng ngữ cảnh lễ hội cho prompt (null nếu không có gì). */
export function buildFestivalLine(storyDate, regionKey) {
  const { today, upcoming } = getFestivalContext(storyDate, regionKey)
  const parts = []
  for (const f of today) {
    parts.push(`HÔM NAY đang trong "${f.name}" (${f.desc}) — không khí vùng này khác ngày thường, hãy để nó thấm vào cảnh.`)
  }
  for (const u of upcoming) {
    parts.push(`${u.inDays} ngày nữa tới "${u.festival.name}" — dân địa phương đã lục tục chuẩn bị, có thể nhắc thoáng qua.`)
  }
  return parts.length ? parts.join(' ') : null
}
