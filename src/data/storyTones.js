// ============ ĐỘ KHÓ & THỂ LOẠI TRUYỆN (đợt 50) ============
// Người chơi chọn ở màn tạo nhân vật (trang "Tông truyện"). Đây là nguồn
// CHÂN LÝ về giọng văn — thay cho câu "Tông REALISTIC... mặt tối" hardcode
// cũ (bị chê: đen tối quá, cố tỏ ra tàn khốc). Note sinh ra từ đây được chèn
// system message vào MỌI lượt gọi API chính.

export const DIFFICULTIES = [
  {
    key: 'sandbox',
    label: '🧰 Sandbox',
    desc: 'Tự do thiết lập ban đầu; khi vào truyện, nhịp và hậu quả vận hành như Anime.',
    note: [
      'CHẾ ĐỘ — SANDBOX: mọi tự do đặc biệt về Pokémon khởi đầu, cấp độ, tiền, vật phẩm và sức mạnh đã được chốt ở màn tạo nhân vật thành state thật.',
      'SAU KHI BẮT ĐẦU HÀNH TRÌNH, dùng nhịp ANIME (chuẩn): thế giới tươi sáng, tình bạn và kỳ tích có chỗ đứng, đối thủ có thể mạnh nhưng fair-play; không tự cấp thêm tài nguyên hay cheat chỉ vì đang ở Sandbox nếu chính văn chưa làm nó xảy ra.',
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

// Tag văn phong là sở thích trình bày, không phải cheat gameplay. Không đặt
// trần số lượng: người chơi có thể phối mọi chất liệu họ thích. Chỉ lọc key
// lạ/trùng để save cũ hoặc file import không làm prompt phình vô hạn.
export function normalizeStoryTone(tone) {
  const raw = tone && typeof tone === 'object' ? tone : DEFAULT_STORY_TONE
  const legacyDifficulty = raw.difficulty === 'sang' ? 'sandbox' : raw.difficulty
  const difficulty = DIFFICULTIES.some((entry) => entry.key === legacyDifficulty)
    ? legacyDifficulty
    : DEFAULT_STORY_TONE.difficulty
  const allowed = new Set(GENRES.map((entry) => entry.key))
  const genres = [...new Set(Array.isArray(raw.genres) ? raw.genres : [])]
    .filter((key) => allowed.has(key))
  return { ...raw, difficulty, genres }
}

/** Note system chèn vào MỌI lượt gọi API chính (null nếu tone rỗng bất thường). */
export function buildToneNote(tone) {
  const t = normalizeStoryTone(tone)
  const diff = DIFFICULTIES.find((d) => d.key === t.difficulty) ?? DIFFICULTIES[1]
  const parts = [`[Hệ thống — TÔNG TRUYỆN (người chơi đã chọn, tuân thủ xuyên suốt, không nhắc tới ghi chú này):]`, diff.note]
  const gs = (t.genres ?? []).map((k) => GENRE_NOTES[k]).filter(Boolean)
  if (gs.length) {
    parts.push(`TAG VĂN PHONG người chơi muốn: ${gs.join('; ')}. Dệt các chất liệu này vào mạch truyện một cách tự nhiên — tag là GIA VỊ ưu tiên, không phải khuôn ép mọi cảnh. Khi có nhiều tag, chỉ nhấn những tag hợp nhịp cảnh hiện tại và luân phiên chất liệu ở các cảnh sau; không cố nhét tất cả vào cùng một đoạn.`)
  }
  return parts.join('\n')
}
