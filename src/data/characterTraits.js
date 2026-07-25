// ============ TÍNH CÁCH & SIÊU NĂNG LỰC (đợt 61) ============
// Người chơi chọn ở màn tạo nhân vật. Tính cách giải bài toán: nếu không nói
// gì, AI hay mặc định vẽ nhân vật chính thành "lạnh lùng, thực dụng, tính
// toán" — nên cho chọn nét tính cách rõ ràng để AI khắc hoạ đúng.

export const PERSONALITY_TRAITS = [
  { key: 'warm', label: 'Ấm áp, tốt bụng', note: 'ấm áp, tử tế, hay quan tâm người khác' },
  { key: 'cheerful', label: 'Vui vẻ, lạc quan', note: 'vui vẻ, lạc quan, tràn năng lượng tích cực' },
  { key: 'brave', label: 'Dũng cảm, gan dạ', note: 'dũng cảm, gan dạ, không ngại đối đầu khó khăn' },
  { key: 'gentle', label: 'Hiền lành, nhẹ nhàng', note: 'hiền lành, nhẹ nhàng, điềm tĩnh trong cư xử' },
  { key: 'curious', label: 'Tò mò, ham học hỏi', note: 'tò mò, ham khám phá, thích tìm hiểu cái mới' },
  { key: 'loyal', label: 'Trung thành, nghĩa khí', note: 'trung thành, coi trọng bạn bè và lời hứa' },
  { key: 'stubborn', label: 'Bướng bỉnh, kiên định', note: 'bướng bỉnh nhưng kiên định với mục tiêu' },
  { key: 'playful', label: 'Tinh nghịch, hài hước', note: 'tinh nghịch, hài hước, hay pha trò' },
  { key: 'shy', label: 'Nhút nhát, kín đáo', note: 'nhút nhát, kín đáo, cần thời gian mở lòng' },
  { key: 'proud', label: 'Kiêu hãnh, tự tin', note: 'kiêu hãnh, tự tin vào bản thân' },
  { key: 'calm', label: 'Điềm tĩnh, chín chắn', note: 'điềm tĩnh, chín chắn, suy nghĩ thấu đáo' },
  { key: 'hotblooded', label: 'Nhiệt huyết, bốc đồng', note: 'nhiệt huyết, sôi nổi, đôi khi bốc đồng' },
  { key: 'cunning', label: 'Ranh mãnh, mưu mẹo', note: 'ranh mãnh, nhiều mưu mẹo, biết luồn lách' },
  { key: 'cold', label: 'Lạnh lùng, ít nói', note: 'lạnh lùng, ít nói, khó gần nhưng không xấu' },
  { key: 'ambitious', label: 'Tham vọng, quyết đoán', note: 'tham vọng lớn, quyết đoán, khao khát vươn lên' },
  { key: 'kindhearted', label: 'Giàu lòng trắc ẩn', note: 'giàu lòng trắc ẩn, dễ đồng cảm với kẻ yếu' },
]

export const SUPERPOWERS = [
  { key: 'none', label: 'Không có (người thường)', note: null },
  { key: 'aura', label: 'Aura / Nội lực', note: 'cảm nhận và điều khiển aura (nội lực) như Lucario/Riolu trong lore — đọc cảm xúc sinh vật, tăng cường thể chất ngắn hạn' },
  { key: 'psychic', label: 'Psychic (Siêu năng lực)', note: 'năng lực tâm linh (Psychic): telekinesis nhẹ, cảm nhận suy nghĩ mờ nhạt, tương tác đặc biệt với Pokémon hệ Psychic' },
  { key: 'viridian', label: 'Viridian Force', note: 'sức mạnh bí ẩn "Viridian Force" gắn với rừng Viridian — cộng hưởng với thiên nhiên và Pokémon hoang dã, đôi khi cảm nhận được dòng năng lượng của đất' },
  { key: 'beckon', label: 'Thấu hiểu Pokémon', note: 'khả năng thiên phú thấu hiểu và giao cảm với Pokémon sâu hơn người thường — Pokémon hoang dã bớt cảnh giác, dễ tin tưởng' },
  { key: 'foresight', label: 'Linh cảm / Tiên tri', note: 'linh cảm mơ hồ về nguy hiểm hoặc sự kiện sắp tới, dưới dạng trực giác chợt đến chứ không phải nhìn rõ tương lai' },
  { key: 'elemental', label: 'Cảm ứng nguyên tố', note: 'cảm ứng với một hệ nguyên tố (lửa/nước/điện...) — chịu đựng tốt hơn và cộng hưởng nhẹ với Pokémon cùng hệ' },
  { key: 'custom', label: 'Tự mô tả…', note: null }, // người chơi tự viết
]

/** Note tính cách + siêu năng lực chèn vào prompt (null nếu không chọn gì). */
export function buildCharacterTraitsNote({ personality = [], superpower = 'none', customPower = '' }) {
  const parts = []
  const traits = personality.map((k) => PERSONALITY_TRAITS.find((t) => t.key === k)?.note).filter(Boolean)
  if (traits.length) {
    parts.push(
      `TÍNH CÁCH NHÂN VẬT CHÍNH (người chơi đã chọn — khắc hoạ ĐÚNG các nét này, KHÔNG tự mặc định nhân vật thành lạnh lùng/thực dụng/vô cảm nếu không có trong danh sách): ${traits.join('; ')}.`,
    )
  }
  if (superpower === 'custom' && customPower.trim()) {
    parts.push(`SIÊU NĂNG LỰC ĐẶC BIỆT: ${customPower.trim()}. Thể hiện năng lực này một cách CÓ CHỪNG MỰC, hợp lý theo mạch truyện — không biến nhân vật thành bất khả chiến bại.`)
  } else if (superpower && superpower !== 'none') {
    const p = SUPERPOWERS.find((s) => s.key === superpower)
    if (p?.note) {
      parts.push(`SIÊU NĂNG LỰC ĐẶC BIỆT: ${p.note}. Thể hiện CÓ CHỪNG MỰC, hợp mạch truyện — không biến nhân vật thành bất khả chiến bại, năng lực có giới hạn và cái giá của nó.`)
    }
  }
  return parts.length ? parts.join('\n') : null
}
