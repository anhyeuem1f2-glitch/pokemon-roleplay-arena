// ============ GIAO THỨC TRẠNG THÁI TRONG CHÍNH VĂN (đợt 24) ============
// Cùng triết lý với [[BATTLE]] và [[DMG]]: AI kể chuyện bằng lời, còn các
// thay đổi TRẠNG THÁI GAME (tiền, hảo cảm NPC, thương tích cơ thể, vào cửa
// hàng) được khai báo qua tag máy-đọc-được ở CUỐI tin nhắn. App parse tag,
// áp vào state thật (HUD cập nhật ngay), rồi ẨN tag khỏi văn bản hiển thị.
//
// Cú pháp (mỗi tag 1 dòng riêng, đặt ở cuối tin, có thể nhiều tag):
//   [[MONEY +500]]            — nhận/mất tiền (số âm là mất)
//   [[REL Misty=+10]]         — hảo cảm NPC thay đổi (upsert theo tên)
//   [[REL Misty=-15 | cãi nhau ở gym]]   — kèm ghi chú mới (tuỳ chọn)
//   [[BODY leftArm=+25]]      — bộ phận bị thương thêm (+) hoặc hồi phục (-)
//       bộ phận hợp lệ: head, torso, leftArm, rightArm, leftLeg, rightLeg
//   [[SHOP Tiệm PokéMart Cerulean]]      — người chơi ĐANG đứng trong 1 cửa
//       hàng và có thể mua sắm → app hiện nút mở giao diện giỏ hàng.

export const BODY_PART_KEYS = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']

export const STORY_STATE_INSTRUCTION = `GIAO THỨC TRẠNG THÁI (bắt buộc tuân theo): khi diễn biến trong đoạn bạn viết làm thay đổi trạng thái game, hãy khai báo bằng tag ở CUỐI tin nhắn, mỗi tag 1 dòng riêng (người chơi không nhìn thấy tag — đừng nhắc tới chúng trong lời kể):
- Tiền thay đổi (được thưởng, mua bán lẻ, bị cướp...): [[MONEY +500]] hoặc [[MONEY -200]].
- Hảo cảm NPC thay đổi (giúp đỡ, cãi vã, tặng quà...): [[REL Tên NPC=+10]] (từ -100 tới +100, mỗi lần đổi 1-15 điểm là hợp lý; có thể kèm ghi chú: [[REL Misty=+8 | cùng nhau tuần tra bờ hồ]]). Chỉ dùng cho NPC có tên, xuất hiện thật trong truyện.
- Nhân vật chính BỊ THƯƠNG hoặc HỒI PHỤC phần thân thể nào (thế giới này Pokémon tấn công con người là chuyện bình thường): [[BODY leftArm=+25]] (dương = thương thêm, âm = hồi phục; bộ phận: head, torso, leftArm, rightArm, leftLeg, rightLeg; 0 lành lặn, 100 là mất/hỏng hẳn — vết cào nhẹ +5~10, trúng đòn nặng +20~40, gãy/bỏng nặng +50+). Mô tả vết thương trong lời kể phải khớp với tag.
- Câu chuyện dẫn tới việc MUA SẮM tại một cửa hàng: [[SHOP Tên cửa hàng | loại=... | quy mô=nhỏ/vừa/lớn]] — loại ∈ {trainer (Poké Mart: bóng/thuốc như game), tạp hoá, quần áo, dã ngoại, leo núi, bách hoá}; hệ thống TỰ SINH danh sách hàng thật (30-300 món tuỳ quy mô, có thương hiệu Silph Co./Devon Corp./hãng nhỏ) — đừng tự liệt kê hàng trong chính văn, chỉ tả không khí cửa hàng. Cửa hàng nhỏ ven đường = quy mô nhỏ, siêu thị thành phố = lớn.
- Người chơi THẬT SỰ có được một Pokémon mới trong diễn biến (được tặng, nhận nuôi, thu phục ngoài trận, cứu và nó đi theo...): [[POKEMON Tên loài | Lv7]] — hệ thống sẽ tự dựng chỉ số thật và đưa vào đội. Mở đầu "tay trắng" thì việc nhận Pokémon ĐẦU TIÊN phải là một khoảnh khắc có ý nghĩa, đến từ diễn biến hợp lý (không rơi từ trên trời); level hợp HOÀN CẢNH THẾ GIỚI chứ không theo sức người chơi: khu an toàn gần thị trấn lớn / có champion hay giáo sư canh giữ (VD Pallet Town có Giáo sư Oak) thì Pokémon YẾU và non; càng vào sâu hang/núi/đường hiểm thì càng mạnh; con đầu đàn mạnh hơn hẳn con thường; loài đã tiến hoá hết thì level cao. Pokémon của NPC trainer thì theo THÂN PHẬN + TUỔI + KINH NGHIỆM của trainer đó (học sinh mới yếu, gym leader/elite/trùm tổ chức rất mạnh). App sẽ tự nắn mềm nếu lệch, nhưng hãy ghi level đúng tinh thần này. KHÔNG cấp Pokémon bừa bãi hay dồn dập — cả một chương truyện có khi chỉ 1 lần, và người chơi phải là người CHỌN nhận.
- Nhân vật DI CHUYỂN tới một địa danh mới (thành phố/khu vực/route): [[MOVE Tên khu vực]] — VD [[MOVE Cerulean City]], [[MOVE Viridian Forest]]; giúp bản đồ + level Pokémon hoang cập nhật đúng vị trí. Chỉ tag khi THỰC SỰ đổi chỗ.
- Nhân vật hoặc Pokémon ĂN UỐNG / bỏ bữa / lao lực rõ rệt trong diễn biến: [[HUNGER người+25]] hoặc [[HUNGER pokemon+30]] (độ NO 0-100; ăn = cộng, đói lả/vận động nặng = trừ; app tự trừ dần theo ngày nên chỉ tag khi có sự kiện rõ ràng).
- Thời gian trong truyện trôi qua (ngủ một đêm, đi đường nhiều ngày, chờ đợi...): [[DATE +1]] (số ngày trôi); chuyển buổi trong cùng ngày: [[DATE buổi=sáng|trưa|chiều|tối|đêm]]. Ngày giờ hiện tại luôn được cung cấp trong ngữ cảnh — lời kể về thời gian phải khớp với nó.
- NPC CÓ TÊN xuất hiện lần đầu, hoặc lộ thông tin quan trọng mới: khai báo hồ sơ bằng [[NPC Tên | tuổi=24 | nghề=Kiểm lâm | đội=Pikachu Lv25, Luxray Lv30 | ghi chú=em gái của trưởng gym]] — các trường tuổi/nghề/đội/ghi chú đều tuỳ chọn, cập nhật NPC cũ thì chỉ cần ghi trường thay đổi. QUY TẮC TẠO NPC: tên phải ĐA DẠNG đúng chất thế giới Pokémon (đừng lặp lại mãi vài cái tên quen tay như "Elara"); tuổi + nghề nghiệp hợp bối cảnh (dân thường đa số KHÔNG phải trainer); nếu là trainer thì đội hình 1-4 Pokémon hợp nghề/vùng, LEVEL PHẢI HỢP LÝ với khu vực hiện tại và trình độ người chơi (dân thường/tân binh thấp, kiểm lâm/cảnh sát trung bình, gym leader cao) — không lạm phát level.
- Sự kiện/thoả thuận/mốc thời gian/địa danh QUAN TRỌNG cần nhớ lâu dài: [[FACT từ khoá 1, từ khoá 2 | nội dung CHI TIẾT]] — hoạt động như một entry World Info: phần trước dấu | là 1-3 TỪ KHOÁ KÍCH HOẠT (cách nhau bằng dấu phẩy: tên người, tên Pokémon, địa danh, tên vật phẩm...), phần sau là NỘI DUNG ĐẦY ĐỦ của sự kiện (ai, cái gì, ở đâu, điều kiện/hệ quả) để lần sau đọc lại là hiểu ngay ngữ cảnh — KHÔNG viết cụt kiểu vài chữ. VD: [[FACT Cubone, bà lão Lavender | Ngày 12/4 tại Lavender, người chơi hứa với bà lão Yui sẽ quay lại giúp tìm con Cubone bị mất trước mùa đông; bà hứa trả công bằng chiếc Moon Stone gia truyền]]. Chỉ ghi thông tin THẬT đã xảy ra, mỗi fact 1 dòng riêng.
Không bịa thay đổi không có trong diễn biến. Không dùng tag nào khác ngoài danh sách trên (và [[BATTLE]]). Mọi tag ĐẶT Ở CUỐI TIN, mỗi tag 1 dòng riêng — KHÔNG nhét tag vào giữa câu văn hay vào phần suy nghĩ.`

// Đợt 47: BỎ neo dòng (^…$) — thực chiến cho thấy model (nhất là khi CoT
// leak) hay nhét tag NẰM GIỮA câu văn ("…, [[MONEY -1000]], [[SHOP …]] .")
// → neo dòng làm tag câm hoàn toàn: tiền không trừ, fact không vào sổ tay,
// tag lộ nguyên văn ra màn hình. Tag có cặp [[..]] bao nên match giữa dòng
// vẫn an toàn, không đụng chính văn thường.
const MONEY_RE = /\[\[\s*MONEY\s*([+-]?\d+)\s*\]\]/gi
const POKEMON_RE = /\[\[\s*POKEMON\s+([^\]|]+?)\s*\|\s*Lv\.?\s*(\d+)\s*\]\]/gi
const DATE_ADV_RE = /\[\[\s*DATE\s*\+\s*(\d+)\s*\]\]/gi
const DATE_PART_RE = /\[\[\s*DATE\s+buổi\s*=\s*(sáng|trưa|chiều|tối|đêm)\s*\]\]/gi
const MOVE_RE = /\[\[\s*MOVE\s+([^\]]+?)\s*\]\]/gi
const HUNGER_RE = /\[\[\s*HUNGER\s+(người|nguoi|player|pokemon|pokémon)\s*([+-]\d+)\s*\]\]/gi
const NPC_RE = /\[\[\s*NPC\s+([^\]|]+?)\s*(?:\|\s*([^\]]*?)\s*)?\]\]/gi
const FACT_RE = /\[\[\s*FACT\s+([^\]|]+?)\s*\|\s*([^\]]+?)\s*\]\]/gi
const REL_RE = /\[\[\s*REL\s+([^=\]|]+?)\s*=\s*([+-]?\d+)\s*(?:\|\s*([^\]]*?)\s*)?\]\]/gi
const BODY_RE = /\[\[\s*BODY\s+(head|torso|leftArm|rightArm|leftLeg|rightLeg)\s*=\s*([+-]?\d+)\s*\]\]/gi
const SHOP_RE = /\[\[\s*SHOP\s+([^\]|]+?)(?:\s*\|\s*([^\]]*?))?\s*\]\]/gi

/**
 * Parse mọi tag trạng thái trong text. Trả về:
 * { money: tổng delta, rel: [{name, delta, note}], body: [{part, delta}],
 *   shops: [tên...], cleaned: text đã gỡ sạch tag }
 * Regex neo theo DÒNG nên [[BATTLE]] và [[DMG]] không bị đụng tới.
 */
export function parseStoryStateTags(text) {
  if (!text) return { money: 0, rel: [], body: [], shops: [], npcs: [], facts: [], pokemons: [], hunger: [], moves: [], dateAdvance: 0, datePart: null, cleaned: text ?? '' }
  let money = 0
  const rel = []
  const body = []
  const shops = []
  const npcs = []
  const facts = []
  const pokemons = []
  const hunger = []
  const moves = []
  let dateAdvance = 0
  let datePart = null

  for (const m of text.matchAll(MONEY_RE)) money += parseInt(m[1], 10)
  for (const m of text.matchAll(REL_RE)) {
    rel.push({ name: m[1].trim(), delta: parseInt(m[2], 10), note: (m[3] ?? '').trim() || null })
  }
  for (const m of text.matchAll(BODY_RE)) body.push({ part: m[1], delta: parseInt(m[2], 10) })
  // [[SHOP Tên | loại=... | quy mô=...]] (đợt 37) — shops giờ là OBJECT
  // {name, type, size}; code cũ nào còn đọc dạng string đã được cập nhật.
  for (const m of text.matchAll(SHOP_RE)) {
    const shop = { name: m[1].trim(), type: '', size: '' }
    if (m[2]) {
      for (const seg of m[2].split('|')) {
        const part = seg.trim()
        const eq = part.indexOf('=')
        if (eq > 0) {
          const k = part.slice(0, eq).trim().toLowerCase()
          const v = part.slice(eq + 1).trim()
          if (k.startsWith('loại') || k.startsWith('loai') || k === 'type') shop.type = v
          else if (k.startsWith('quy') || k === 'size') shop.size = v
        }
      }
    }
    shops.push(shop)
  }
  // [[NPC Tên | key=value | key=value ...]] — phần sau tên là danh sách
  // trường key=value phân tách bởi |; đoạn không có dấu = thì gộp vào ghi chú.
  for (const m of text.matchAll(NPC_RE)) {
    const name = m[1].trim()
    const fields = {}
    if (m[2]) {
      for (const seg of m[2].split('|')) {
        const part = seg.trim()
        if (!part) continue
        const eq = part.indexOf('=')
        if (eq > 0) {
          const k = part.slice(0, eq).trim()
          const v = part.slice(eq + 1).trim()
          if (k && v) fields[k] = v
        } else {
          fields['ghi chú'] = fields['ghi chú'] ? `${fields['ghi chú']}; ${part}` : part
        }
      }
    }
    if (name) npcs.push({ name, fields })
  }
  for (const m of text.matchAll(FACT_RE)) {
    facts.push({ key: m[1].trim(), text: m[2].trim() })
  }
  // [[POKEMON Loài | Lv7]] — người chơi nhận Pokémon mới trong truyện (đợt 32).
  for (const m of text.matchAll(POKEMON_RE)) {
    pokemons.push({ species: m[1].trim(), level: Math.max(1, Math.min(100, parseInt(m[2], 10))) })
  }
  for (const m of text.matchAll(DATE_ADV_RE)) dateAdvance += parseInt(m[1], 10)
  for (const m of text.matchAll(DATE_PART_RE)) datePart = m[1]
  // [[HUNGER người+25]] — độ no của người / Pokémon (đợt 36).
  for (const m of text.matchAll(MOVE_RE)) moves.push(m[1].trim())
  for (const m of text.matchAll(HUNGER_RE)) {
    const who = /^p(okemon|okémon)$/i.test(m[1]) || m[1].toLowerCase().startsWith('pok') ? 'mon' : 'player'
    hunger.push({ who, delta: parseInt(m[2], 10) })
  }

  const cleaned = text
    .replace(MONEY_RE, '')
    .replace(REL_RE, '')
    .replace(BODY_RE, '')
    .replace(SHOP_RE, '')
    .replace(NPC_RE, '')
    .replace(FACT_RE, '')
    .replace(POKEMON_RE, '')
    .replace(DATE_ADV_RE, '')
    .replace(DATE_PART_RE, '')
    .replace(MOVE_RE, '')
    .replace(HUNGER_RE, '')
    // Tag nằm giữa câu bị gỡ để lại vụn: ", ," / "( )" / 2 dấu cách — dọn nhẹ.
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;])\s*(?=[,;])/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]*[,.;]+[ \t]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { money, rel, body, shops, npcs, facts, pokemons, hunger, moves, dateAdvance, datePart, cleaned }
}

/**
 * Áp kết quả parse vào state game. Nhận state hiện tại + setters từ context.
 * Mọi giá trị đều được kẹp trong khoảng hợp lệ (tiền >= 0, hảo cảm -100..100,
 * thương tích 0..100) — AI có bịa số to cũng không phá được state.
 */
// LƯU Ý (đợt 45): dùng FUNCTIONAL UPDATER cho cả 3 setter — trước đây hàm
// này đọc state từ closure (playerProfile/relationships/bodyStatus) nên:
// (a) gọi từ callback nền của API cập nhật biến mà QUÊN truyền state hiện
//     tại → crash "undefined.money" (bị .catch nuốt → tiền/quan hệ bổ sung
//     rớt trong im lặng), và
// (b) closure cũ đè lên thay đổi mới khi 2 luồng (chính + API phụ) áp gần
//     nhau. Functional updater đọc state MỚI NHẤT nên hết cả 2 lỗi; các
//     tham số state cũ vẫn nhận vào cho tương thích chỗ gọi cũ nhưng không
//     dùng nữa. setRelationships/setBodyStatus trong GameContext đã được
//     nâng lên nhận functional updater (đợt 45).
export function applyStoryState(parsed, { setPlayerProfile, setRelationships, setBodyStatus }) {
  if (parsed.money !== 0) {
    setPlayerProfile((cur) => ({ ...cur, money: Math.max(0, Number(cur.money) + parsed.money) }))
  }
  if (parsed.rel.length > 0) {
    setRelationships((cur) => {
      const next = [...(cur ?? [])]
      for (const r of parsed.rel) {
        // Kẹp delta 1 lần đổi trong ±30 để 1 tin nhắn không lật ngược cả mối quan hệ.
        const delta = Math.max(-30, Math.min(30, r.delta))
        const idx = next.findIndex((x) => x.name.toLowerCase() === r.name.toLowerCase())
        if (idx >= 0) {
          next[idx] = {
            ...next[idx],
            affinity: Math.max(-100, Math.min(100, next[idx].affinity + delta)),
            note: r.note ?? next[idx].note,
          }
        } else {
          next.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: r.name,
            affinity: Math.max(-100, Math.min(100, delta)),
            note: r.note ?? '',
          })
        }
      }
      return next
    })
  }
  if (parsed.body.length > 0) {
    setBodyStatus((cur) => {
      const next = { ...(cur ?? {}) }
      for (const b of parsed.body) {
        next[b.part] = Math.max(0, Math.min(100, (next[b.part] ?? 0) + b.delta))
      }
      return next
    })
  }
}
