// ============ ĐỘ KHÓ & THỂ LOẠI TRUYỆN (đợt 50) ============
// Người chơi chọn ở màn tạo nhân vật (trang "Tông truyện"). Đây là nguồn
// CHÂN LÝ về giọng văn — thay cho câu "Tông REALISTIC... mặt tối" hardcode
// cũ (bị chê: đen tối quá, cố tỏ ra tàn khốc). Note sinh ra từ đây được chèn
// system message vào MỌI lượt gọi API chính.

export const DIFFICULTIES = [
  {
    key: 'sang',
    label: '✨ Sảng văn (dễ)',
    desc: 'Nhân vật chính thuận buồm xuôi gió, đối thủ vừa miếng, thắng lợi đều đặn — chơi để sướng, không để khổ.',
    note: [
      'ĐỘ KHÓ — SẢNG VĂN (dễ): người chơi là nhân vật chính được thế giới ưu ái. Cơ duyên đến đều, NPC đối địch vừa sức và thường non tay hơn, thất bại (nếu có) chỉ là bàn đạp cho màn lội ngược dòng.',
      'Giọng văn thoải mái, nhịp nhanh, thắng lợi phải ĐÃ — miêu tả kỹ khoảnh khắc toả sáng của người chơi. Không giết nhân vật chính, không đẩy vào ngõ cụt.',
    ].join(' '),
  },
  {
    key: 'anime',
    label: '🌸 Anime (chuẩn)',
    desc: 'Thế giới Pokémon tươi sáng đúng chất anime: tình bạn, hành trình, đối thủ đáng gờm nhưng fair-play.',
    note: [
      'ĐỘ KHÓ — ANIME (chuẩn): thế giới Pokémon TƯƠI SÁNG đúng tinh thần anime gốc. Con người và Pokémon gắn bó, thị trấn thân thiện, đối thủ có thể mạnh nhưng fair-play; phản diện tồn tại nhưng theo kiểu anime (Team Rocket khoa trương) chứ không tàn bạo.',
      'Giọng văn ấm áp, giàu năng lượng, có chỗ cho hài hước và cảm động. Thua trận là bài học chứ không phải thảm hoạ. Không mô tả bạo lực nặng hay chết chóc.',
    ].join(' '),
  },
  {
    key: 'realistic',
    label: '⚖ Thực tế (khó)',
    desc: 'Thế giới vận hành có logic: sinh kế, luật lệ, rủi ro thật. Bất cẩn có thể trả giá — kể cả game over.',
    note: [
      'ĐỘ KHÓ — THỰC TẾ (khó): thế giới Pokémon là một xã hội vận hành có logic — sinh kế, luật lệ, giá cả, rủi ro đều thật. NHƯNG tuyệt đối KHÔNG cố tỏ ra tăm tối, tàn khốc hay cynical để gây ấn tượng: đa số con người vẫn tử tế, phố xá vẫn bình thường; "thực tế" nghĩa là HẬU QUẢ CÓ THẬT chứ không phải u ám mọi lúc.',
      'Giọng văn điềm đạm, quan sát tinh, chi tiết đời thường chính xác. Người chơi phải để ý: tiền bạc, thương tích, độ no, quan hệ, lời hứa đều có hệ quả. Nguy hiểm thật sự tồn tại ở nơi hợp lý (hang sâu, Pokémon hoang cấp cao, tổ chức tội phạm) — nếu người chơi liều lĩnh vượt sức nhiều lần, họ CÓ THỂ chết: khi đó kể cái kết bi thảm một cách xứng đáng và kết bằng dòng [GAME OVER] ở cuối tin.',
    ].join(' '),
  },
]

export const GENRES = [
  { key: 'adventure', label: 'Phiêu lưu' },
  { key: 'sang', label: 'Sảng văn' },
  { key: 'comedy', label: 'Hài hước' },
  { key: 'romance', label: 'Romance' },
  { key: 'harem', label: 'Harem' },
  { key: 'sliceoflife', label: 'Đời thường' },
  { key: 'school', label: 'Học đường' },
  { key: 'mystery', label: 'Trinh thám / bí ẩn' },
  { key: 'horror', label: 'Kinh dị' },
  { key: 'tragedy', label: 'Bi kịch' },
  { key: 'drama', label: 'Chính kịch' },
  { key: 'conspiracy', label: 'Âm mưu / tổ chức ngầm' },
  { key: 'tournament', label: 'Thi đấu / giải đấu' },
  { key: 'survival', label: 'Sinh tồn' },
  { key: 'nurture', label: 'Chăm sóc / nuôi dưỡng' },
  { key: 'kingdom', label: 'Gây dựng thế lực' },
]

const GENRE_NOTES = {
  adventure: 'phiêu lưu — hành trình, khám phá vùng đất mới, cảm giác đường xa',
  sang: 'sảng văn — người chơi liên tục gặt thành quả, khoảnh khắc toả sáng phải đã tay',
  comedy: 'hài hước — tình huống dí dỏm, thoại duyên, nhân vật phụ lầy lội đúng lúc',
  romance: 'romance — phát triển tình cảm TỰ NHIÊN theo thời gian, tín hiệu tinh tế, có hồi hộp rung động',
  harem: 'harem — nhiều nhân vật nảy sinh tình cảm với người chơi, mỗi người một cá tính riêng rõ nét, có ghen tuông cạnh tranh nhẹ',
  sliceoflife: 'đời thường — nhịp chậm, bữa ăn, buổi chợ, khoảnh khắc nhỏ có dư vị',
  school: 'học đường — trường lớp/học viện trainer, bạn bè, kỳ thi, câu lạc bộ',
  mystery: 'trinh thám/bí ẩn — có manh mối cài cắm, bí ẩn mở dần, cho người chơi cơ hội tự suy luận',
  horror: 'kinh dị — không khí rùng rợn, đe doạ mơ hồ, dùng gợi mở thay vì gore',
  tragedy: 'bi kịch — mất mát có sức nặng, cảm xúc chân thật, không bi luỵ rẻ tiền',
  drama: 'chính kịch — xung đột con người sâu, lựa chọn khó, hệ quả đạo đức',
  conspiracy: 'âm mưu — tổ chức ngầm giật dây, thông tin nhiễu, không ai hoàn toàn đáng tin',
  tournament: 'thi đấu — giải đấu, bảng đấu, đối thủ định danh có phong cách riêng, khán đài rực lửa',
  survival: 'sinh tồn — tài nguyên khan hiếm, thiên nhiên khắc nghiệt, mỗi quyết định đánh đổi',
  nurture: 'nuôi dưỡng — chăm sóc Pokémon/đồng đội trưởng thành, gắn bó tăng dần thấy rõ',
  kingdom: 'gây dựng thế lực — xây cơ ngơi/đội nhóm/danh tiếng từ con số không',
}

export const DEFAULT_STORY_TONE = { difficulty: 'anime', genres: [] }

/** Note system chèn vào MỌI lượt gọi API chính (null nếu tone rỗng bất thường). */
export function buildToneNote(tone) {
  const t = tone ?? DEFAULT_STORY_TONE
  const diff = DIFFICULTIES.find((d) => d.key === t.difficulty) ?? DIFFICULTIES[1]
  const parts = [`[Hệ thống — TÔNG TRUYỆN (người chơi đã chọn, tuân thủ xuyên suốt, không nhắc tới ghi chú này):]`, diff.note]
  const gs = (t.genres ?? []).map((k) => GENRE_NOTES[k]).filter(Boolean)
  if (gs.length) {
    parts.push(`THỂ LOẠI CHÍNH người chơi muốn: ${gs.join('; ')}. Dệt các chất liệu này vào mạch truyện một cách tự nhiên — thể loại là GIA VỊ ưu tiên, không phải khuôn ép mọi cảnh.`)
  }
  return parts.join('\n')
}
