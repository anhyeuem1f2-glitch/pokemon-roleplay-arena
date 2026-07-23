// Character card mẫu, theo đúng tinh thần field của SillyTavern
// (name / description / personality / scenario / first_mes / mes_example).
export const SAMPLE_CHARACTER = {
  name: 'Elira',
  description:
    'Một huấn luyện viên Pokémon trẻ tuổi đến từ vùng núi phía bắc, luôn mang theo cuốn sổ tay ghi chép sinh vật lạ.',
  personality: 'Tò mò, thẳng thắn, hơi bốc đồng nhưng rất trung thành với bạn đồng hành.',
  scenario:
    'Người chơi vừa gặp Elira tại một trạm dừng chân trên đường tới Pokémon League. Cô ấy đang tìm bạn đồng hành mới.',
  first_mes:
    'Elira ngẩng đầu lên khỏi cuốn sổ tay, ánh mắt sáng lên khi thấy bạn. "Ồ! Một gương mặt mới. Cậu cũng đang trên đường tới League à? Này, hay là... đấu một trận thử xem sao nhỉ?"\n\n[[BATTLE]]',
  mes_example: '',
  // Ví dụ entry lorebook: khi văn bản gần đây nhắc tới "League" hoặc "Pokémon League",
  // đoạn content này sẽ được chèn vào system prompt để AI có thêm ngữ cảnh chính xác.
  lorebook: [
    {
      name: 'Pokémon League',
      keys: ['League', 'Pokémon League'],
      content:
        'Pokémon League vùng này tổ chức 4 năm 1 lần tại thành phố Aurelia, chỉ nhận huấn luyện viên có đủ 8 huy hiệu.',
    },
  ],
}

export const STARTERS = [
  {
    name: 'Charmander',
    species: 'charmander',
    types: ['fire'],
    moves: [
      { name: 'Ember', type: 'fire', power: 12 },
      { name: 'Scratch', type: 'normal', power: 8 },
      { name: 'Growl', type: 'normal', power: 0 },
      { name: 'Smokescreen', type: 'poison', power: 0 },
    ],
  },
  {
    name: 'Bulbasaur',
    species: 'bulbasaur',
    types: ['grass', 'poison'],
    moves: [
      { name: 'Vine Whip', type: 'grass', power: 12 },
      { name: 'Tackle', type: 'normal', power: 8 },
      { name: 'Growl', type: 'normal', power: 0 },
      { name: 'Poison Powder', type: 'poison', power: 0 },
    ],
  },
  {
    name: 'Squirtle',
    species: 'squirtle',
    types: ['water'],
    moves: [
      { name: 'Water Gun', type: 'water', power: 12 },
      { name: 'Tackle', type: 'normal', power: 8 },
      { name: 'Tail Whip', type: 'normal', power: 0 },
      { name: 'Withdraw', type: 'water', power: 0 },
    ],
  },
  {
    name: 'Pikachu',
    species: 'pikachu',
    types: ['electric'],
    moves: [
      { name: 'Thunder Shock', type: 'electric', power: 12 },
      { name: 'Quick Attack', type: 'normal', power: 8 },
      { name: 'Growl', type: 'normal', power: 0 },
      { name: 'Tail Whip', type: 'normal', power: 0 },
    ],
  },
]

function starterToMon(starter) {
  const maxHp = 40
  return { ...starter, level: 5, maxHp, hp: maxHp }
}
export { starterToMon }
export const SAMPLE_PLAYER_MON = {
  name: 'Charmander',
  species: 'charmander',
  level: 12,
  types: ['fire'],
  maxHp: 42,
  hp: 42,
  moves: [
    { name: 'Ember', type: 'fire', power: 12 },
    { name: 'Scratch', type: 'normal', power: 8 },
    { name: 'Growl', type: 'normal', power: 0 },
    { name: 'Smokescreen', type: 'poison', power: 0 },
  ],
}

export const SAMPLE_ENEMY_MON = {
  name: 'Bulbasaur',
  species: 'bulbasaur',
  level: 11,
  types: ['grass', 'poison'],
  maxHp: 44,
  hp: 44,
  moves: [
    { name: 'Vine Whip', type: 'grass', power: 10 },
    { name: 'Tackle', type: 'normal', power: 8 },
  ],
}
