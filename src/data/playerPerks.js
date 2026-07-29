// ============ THIÊN PHÚ CÓ TÁC ĐỘNG CƠ CHẾ (đợt 70) ============
// Tester báo (Bug 4): "chủ yếu kĩ năng và thiên phú xài không được", kèm một
// yêu cầu cụ thể: "Kỹ Năng: Pokemon mình bắt hay sở hữu (chỉ cần trong đội
// hình) sẽ MAX IV/EV ngay khi sở hữu — cái này là không chỉnh sửa được hà".
//
// Hai vấn đề tách bạch, sửa cả hai:
//   1. KHÔNG SỬA ĐƯỢC: thiên phú chỉ chọn được một lần duy nhất ở màn tạo
//      nhân vật (IntroScreen). Vào truyện rồi thì không có đường nào quay lại
//      → nay có bảng sửa mở thẳng từ HUD (TraitsModal).
//   2. XÀI KHÔNG ĐƯỢC: SUPERPOWERS cũ chỉ là một đoạn chữ nhét vào prompt —
//      AI kể cho vui, không có gì chạm vào biến game. File này là lớp thiên
//      phú CƠ CHẾ: mỗi perk có một hàm áp thật vào số liệu Pokémon/tỉ lệ.
//
// Perk cơ chế và siêu năng lực kể chuyện là HAI thứ song song, chọn độc lập:
// người chơi có thể vừa mang "Aura" (chất truyện) vừa bật "Huyết Thống Hoàn
// Mỹ" (chất số liệu).

import { recomputeMonStats, zeroEVs } from './pokemonSpecies.js'

const EV_STAT_CAP = 252
const EV_TOTAL_CAP = 510

export const MECHANIC_PERKS = [
  {
    key: 'maxIvEv',
    label: 'Huyết Thống Hoàn Mỹ',
    short: 'Max IV/EV khi sở hữu',
    desc:
      'Mọi Pokémon vào ĐỘI HÌNH của bạn (được tặng, bắt được, dụ theo) lập tức đạt IV 31 toàn bộ ' +
      'và EV kịch trần 252/252/6 dồn vào 3 chỉ số mạnh nhất của loài. Chỉ số được tính lại ngay.',
    note:
      'THIÊN PHÚ "Huyết Thống Hoàn Mỹ": mọi Pokémon về tay người chơi đều bộc lộ trọn vẹn tiềm năng ' +
      'huyết thống — khoẻ hơn hẳn cá thể cùng loài cùng cấp. Hãy phản ánh điều này trong lời kể (người ' +
      'am hiểu nhìn ra ngay đây là cá thể phẩm chất hiếm thấy), nhưng đừng biến nhân vật thành bất khả ' +
      'chiến bại: chỉ số cao KHÔNG bù được chênh lệch level, kinh nghiệm trận mạc hay quân số.',
  },
  {
    key: 'fastLearner',
    label: 'Thiên Phú Rèn Luyện',
    short: 'EXP luyện tập ×2',
    desc: 'EXP nhận từ luyện tập ([[TRAIN]]) và từ ngày tháng trôi qua được nhân đôi.',
    note:
      'THIÊN PHÚ "Thiên Phú Rèn Luyện": người chơi có con mắt huấn luyện thiên bẩm — cùng một buổi tập, ' +
      'Pokémon của họ tiến bộ nhanh gấp đôi người khác. Hãy để các cảnh luyện tập có sức nặng và tiến bộ rõ rệt.',
  },
  {
    key: 'tamer',
    label: 'Bàn Tay Thuần Phục',
    short: 'Tỉ lệ bắt +15%',
    desc: 'Cộng thẳng 15% vào tỉ lệ bắt Pokémon (vẫn bị kẹp trong khoảng 3–95% như cũ).',
    note:
      'THIÊN PHÚ "Bàn Tay Thuần Phục": Pokémon hoang dã bớt kháng cự trước người chơi một cách khó lý giải — ' +
      'bóng của họ ít khi bật ra. Tả cảnh bắt Pokémon theo hướng đó, nhưng vẫn có thể thất bại.',
  },
]

export function getPerk(key) {
  return MECHANIC_PERKS.find((p) => p.key === key) ?? null
}

export function hasPerk(perks, key) {
  return Array.isArray(perks) && perks.includes(key)
}

/**
 * Dồn EV kịch trần theo 3 chỉ số BASE mạnh nhất của loài: 252 / 252 / 6.
 * Đúng luật game gốc (mỗi chỉ số ≤ 252, tổng ≤ 510) nên không phá cân bằng
 * công thức — chỉ là bản build tối ưu mà người chơi hardcore vẫn tự nuôi được.
 */
function maxEvsFor(baseStats) {
  const evs = zeroEVs()
  if (!baseStats) return evs
  const order = Object.entries(baseStats)
    .filter(([k]) => k in evs)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
  let left = EV_TOTAL_CAP
  for (const stat of order) {
    if (left <= 0) break
    const grant = Math.min(EV_STAT_CAP, left)
    evs[stat] = grant
    left -= grant
  }
  return evs
}

/**
 * Áp toàn bộ perk cơ chế lên MỘT Pokémon vừa vào đội hình.
 * Trả về bản mới (không sửa mon gốc). Không có perk nào → trả nguyên mon.
 */
export function applyPerksToMon(mon, perks) {
  if (!mon || !hasPerk(perks, 'maxIvEv')) return mon
  const maxed = {
    ...mon,
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    evs: maxEvsFor(mon.baseStats),
    perkMark: 'maxIvEv', // để PokemonInfoModal ghi chú "IV/EV tối đa nhờ thiên phú"
  }
  // Mon không có baseStats (fallback 151 loài tĩnh khi chưa tải được pokedex)
  // thì recomputeMonStats trả về nguyên bản — vẫn an toàn, chỉ là không đổi số.
  return recomputeMonStats(maxed)
}

/** Áp cho cả một danh sách (đội hình). */
export function applyPerksToParty(party, perks) {
  if (!Array.isArray(party) || !hasPerk(perks, 'maxIvEv')) return party
  return party.map((m) => applyPerksToMon(m, perks))
}

/** Hệ số nhân EXP từ luyện tập / ngày trôi. */
export function trainingExpMultiplier(perks) {
  return hasPerk(perks, 'fastLearner') ? 2 : 1
}

/** Cộng thẳng vào tỉ lệ bắt (đơn vị: phần trăm tuyệt đối). */
export function catchRateBonus(perks) {
  return hasPerk(perks, 'tamer') ? 15 : 0
}


/** Note mô tả các perk đang bật, chèn vào prompt mỗi lượt (null nếu không có). */
export function buildPerksNote(perks) {
  const notes = (perks ?? []).map((k) => getPerk(k)?.note).filter(Boolean)
  return notes.length ? notes.join('\n') : null
}
