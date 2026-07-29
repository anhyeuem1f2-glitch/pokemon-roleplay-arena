// ============ TEST REGRESSION ĐỢT 70 ============
// Chạy: node test-dot70.mjs   (từ thư mục gốc dự án)
// Bao trọn 4 bug tester báo trên Discord + kỹ năng Max IV/EV.

import {
  buildWildMon, applyExpGain, expForLevel, levelFromExp,
  guardMonRegression, guardPartyRegression, recomputeMonStats,
} from './src/data/pokemonSpecies.js'
import {
  applyPerksToMon, trainingExpMultiplier, catchRateBonus, buildPerksNote, hasPerk,
} from './src/data/playerPerks.js'
import { buildCharacterTraitsNote } from './src/data/characterTraits.js'
import { parseStoryStateTags } from './src/utils/storyStateProtocol.js'

let pass = 0, fail = 0
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${extra}`) }
}
function section(t) { console.log(`\n=== ${t} ===`) }

const FROAKIE = {
  name: 'Froakie', species: 'froakie', types: ['Water'],
  baseStats: { hp: 41, atk: 56, def: 40, spa: 62, spd: 44, spe: 71 },
}

// ---------------------------------------------------------------
section('1. Công thức EXP nền (medium fast n³) vẫn đúng')
ok('expForLevel(5) = 125', expForLevel(5) === 125)
ok('expForLevel(6) = 216', expForLevel(6) === 216)
ok('expForLevel(7) = 343', expForLevel(7) === 343)
let cbrtOk = true
for (let n = 1; n <= 100; n++) if (levelFromExp(expForLevel(n)) !== n) cbrtOk = false
ok('levelFromExp khớp ngược 100 cấp (không lệch số thực)', cbrtOk)

// ---------------------------------------------------------------
section('2. BUG 2 — "không nhận Exp": applyExpGain phải cộng thật')
const lv5 = buildWildMon(FROAKIE, 5)
ok('mon mới sinh có exp = level³', lv5.exp === 125)
const after = applyExpGain(lv5, 25)
ok('cộng 25 EXP → exp = 150', after.mon.exp === 150)
ok('chưa đủ 216 nên vẫn Lv5', after.mon.level === 5)
const up = applyExpGain(lv5, 100)
ok('cộng 100 EXP → lên Lv6', up.mon.level === 6, `(được ${up.mon.level})`)
ok('báo levelsGained = 1', up.levelsGained === 1)

// ---------------------------------------------------------------
section('3. BUG 1 + 3 — chốt chặn TỤT CẤP (guardMonRegression)')
// Mô phỏng đúng kịch bản tester: thắng trận lên Lv6, rồi một luồng chạy sau
// ghi đè bằng bản chụp Lv5 cũ (closure cũ / API phụ chạy nền).
const won = applyExpGain(lv5, 100).mon           // Lv6, exp 225
const staleCopy = { ...lv5 }                     // bản Lv5 cũ, CÙNG uid
const guarded = guardMonRegression(won, staleCopy)
ok('ghi đè bằng bản Lv5 cũ → giữ nguyên Lv6', guarded.level === 6, `(được Lv${guarded.level})`)
ok('exp cũng giữ mốc cao hơn', guarded.exp === 225, `(được ${guarded.exp})`)

const grownAgain = applyExpGain(won, 200).mon    // Lv6 → exp 425 → Lv7
ok('EXP cộng tiếp vẫn lên được Lv7', grownAgain.level === 7, `(được Lv${grownAgain.level})`)
ok('chốt chặn KHÔNG cản việc lên cấp hợp lệ',
  guardMonRegression(won, grownAgain).level === 7)

// Đổi con ra trận (uid khác) thì KHÔNG được khoá theo level con cũ.
const otherMon = buildWildMon(FROAKIE, 3)
ok('đổi sang cá thể khác (uid khác) → cho phép Lv thấp hơn',
  guardMonRegression(won, otherMon).level === 3)

// Save cũ chưa có uid: bản mới dựng (có uid) phải được coi là cá thể khác.
const legacy = { name: 'Froakie', level: 20, exp: 8000 }
const freshBuild = buildWildMon(FROAKIE, 5)
ok('mon save cũ (không uid) vs mon mới dựng (có uid) → 2 cá thể khác nhau',
  guardMonRegression(legacy, freshBuild).level === 5)
// Nhưng cập nhật tại chỗ chính con save cũ đó thì vẫn phải chặn tụt.
ok('save cũ cập nhật tại chỗ vẫn bị chặn tụt',
  guardMonRegression(legacy, { name: 'Froakie', level: 12, exp: 1728 }).level === 20)

// ---------------------------------------------------------------
section('4. Chốt chặn cho cả ĐỘI HÌNH')
const partyBefore = [won, buildWildMon(FROAKIE, 9)]
const partyStale = [{ ...lv5 }, { ...partyBefore[1] }]
const partyGuarded = guardPartyRegression(partyBefore, partyStale)
ok('phần tử bị ghi đè bằng bản cũ → giữ Lv6', partyGuarded[0].level === 6)
ok('phần tử không đổi → giữ nguyên Lv9', partyGuarded[1].level === 9)
ok('đội rỗng trước đó → không cản gì', guardPartyRegression([], partyStale)[0].level === 5)
ok('thêm con mới vào đội không bị chặn',
  guardPartyRegression(partyBefore, [...partyBefore, buildWildMon(FROAKIE, 2)]).length === 3)

// ---------------------------------------------------------------
section('5. BUG viewer — tag [[POKEMON]] trả về field .species')
const parsed = parseStoryStateTags('Giáo sư đưa bạn một con. [[POKEMON Froakie | Lv.7]]')
ok('parse ra 1 Pokémon', parsed.pokemons.length === 1)
ok('field là .species chứ không phải .name', parsed.pokemons[0].species === 'Froakie')
ok('level = 7', parsed.pokemons[0].level === 7)
ok('viewer dựng chuỗi không còn "undefined"',
  `Nhận Pokémon: ${parsed.pokemons[0].species ?? parsed.pokemons[0].name ?? '???'} Lv.${parsed.pokemons[0].level}`
  === 'Nhận Pokémon: Froakie Lv.7')

// ---------------------------------------------------------------
section('6. KỸ NĂNG tester xin — Max IV/EV khi sở hữu')
const plain = buildWildMon(FROAKIE, 20)
const maxed = applyPerksToMon(plain, ['maxIvEv'])
ok('IV toàn bộ = 31', Object.values(maxed.ivs).every((v) => v === 31))
const evTotal = Object.values(maxed.evs).reduce((a, b) => a + b, 0)
ok('tổng EV = 510 (đúng trần game gốc)', evTotal === 510, `(được ${evTotal})`)
ok('không chỉ số nào vượt 252', Object.values(maxed.evs).every((v) => v <= 252))
ok('EV dồn vào Spe (base cao nhất 71)', maxed.evs.spe === 252)
ok('EV dồn tiếp vào SpA (base 62)', maxed.evs.spa === 252)
ok('phần dư 6 vào Atk (base 56)', maxed.evs.atk === 6)
ok('chỉ số thật ĐÃ được tính lại (mạnh hơn bản thường)', maxed.stats.spe > plain.stats.spe,
  `(${plain.stats.spe} → ${maxed.stats.spe})`)
ok('level KHÔNG bị đụng tới', maxed.level === plain.level)
ok('exp KHÔNG bị đụng tới', maxed.exp === plain.exp)
ok('uid giữ nguyên (vẫn là cùng cá thể)', maxed.uid === plain.uid)
ok('không bật perk → trả về nguyên mon', applyPerksToMon(plain, []) === plain)
ok('perks undefined không crash', applyPerksToMon(plain, undefined) === plain)
ok('mon không có baseStats không crash',
  applyPerksToMon({ name: 'X', level: 5 }, ['maxIvEv']).name === 'X')

// Chốt chặn tụt cấp không được cản việc nâng IV/EV.
ok('guard cho qua bản đã max IV/EV (cùng level)',
  guardMonRegression(plain, maxed).evs.spe === 252)

// ---------------------------------------------------------------
section('7. Hai perk còn lại')
ok('Rèn Luyện → nhân EXP x2', trainingExpMultiplier(['fastLearner']) === 2)
ok('không có perk → x1', trainingExpMultiplier([]) === 1)
ok('Thuần Phục → +15% bắt', catchRateBonus(['tamer']) === 15)
ok('không có perk → +0%', catchRateBonus(['maxIvEv']) === 0)
ok('hasPerk hoạt động với mảng rỗng/undefined',
  hasPerk([], 'tamer') === false && hasPerk(undefined, 'tamer') === false)

// ---------------------------------------------------------------
section('8. Perk phải đi vào PROMPT (không thì AI kể lệch số liệu)')
const note = buildPerksNote(['maxIvEv'])
ok('buildPerksNote ra chữ', typeof note === 'string' && note.includes('Huyết Thống'))
ok('không perk → null', buildPerksNote([]) === null)
const full = buildCharacterTraitsNote({ personality: ['warm'], superpower: 'aura', perks: ['maxIvEv', 'tamer'] })
ok('note tổng có cả tính cách', full.includes('ấm áp'))
ok('note tổng có cả siêu năng lực', full.includes('aura'))
ok('note tổng có cả perk cơ chế', full.includes('Huyết Thống') && full.includes('Thuần Phục'))
ok('gọi không truyền perks (tương thích ngược) không crash',
  buildCharacterTraitsNote({ personality: ['warm'] }).includes('ấm áp'))
ok('gọi rỗng hoàn toàn → null', buildCharacterTraitsNote({}) === null)

// ---------------------------------------------------------------
section('9. Tương thích ngược với SAVE CŨ (quy tắc số 6)')
const oldSave = { name: 'Pikachu', level: 12, maxHp: 40, hp: 40 } // không exp, không uid
const grownOld = applyExpGain(oldSave, 500)
ok('mon cũ không có exp → coi như đầu cấp, cộng được EXP', grownOld.mon.exp === 12 * 12 * 12 + 500)
ok('mon cũ vẫn lên cấp bình thường', grownOld.mon.level >= 12)
ok('mon cũ không có baseStats → recompute trả nguyên bản',
  recomputeMonStats(oldSave).level === 12)

// ---------------------------------------------------------------
console.log(`\n${'='.repeat(46)}`)
console.log(`KẾT QUẢ: ${pass} đạt / ${fail} hỏng`)
console.log('='.repeat(46))
process.exit(fail === 0 ? 0 : 1)
