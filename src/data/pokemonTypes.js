// Bảng dữ liệu 18 hệ (type) chuẩn từ Gen 6 trở đi (có Fairy).
// Dùng để tính hệ số sát thương (super effective / not very effective / no effect).
// UI hiện tại (BattleModal) chỉ dùng bản đơn giản, nhưng data đã đủ để
// bạn nâng cấp công thức sát thương đầy đủ sau này.

export const TYPE_COLORS = {
  normal: '#a8a878',
  fire: '#f2673d',
  water: '#4d90d5',
  electric: '#f2b747',
  grass: '#6fbf5e',
  ice: '#7fd8e0',
  fighting: '#c0392b',
  poison: '#9d5bb5',
  ground: '#c9a35f',
  flying: '#9d8cf2',
  psychic: '#f26fa0',
  bug: '#a2b62f',
  rock: '#a89158',
  ghost: '#6a5a8c',
  dragon: '#6a3df2',
  dark: '#5a4a42',
  steel: '#9aa7b0',
  fairy: '#f2a0d0',
}

export const ALL_TYPES = Object.keys(TYPE_COLORS)

// effectiveness[attackType][defendType] = hệ số nhân sát thương
const chart = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice:      { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
}

/**
 * Trả về hệ số sát thương khi attackType đánh vào defendType.
 * Mặc định 1 nếu không có trong bảng.
 */
export function getEffectiveness(attackType, defendType) {
  return chart[attackType]?.[defendType] ?? 1
}

/**
 * Tính hệ số tổng khi phòng thủ có 1-2 hệ (VD Pokémon hệ đôi).
 */
export function getEffectivenessMulti(attackType, defendTypes = []) {
  return defendTypes.reduce((acc, t) => acc * getEffectiveness(attackType, t), 1)
}
