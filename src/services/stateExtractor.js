// ============ API CẬP NHẬT BIẾN (đợt 36) ============
// Model chính đôi khi QUÊN khai tag trạng thái ([[MONEY]], [[POKEMON]],
// [[HUNGER]], [[DATE]], [[NPC]], [[FACT]], [[REL]]...) dù chính văn mô tả rõ
// sự việc — biến "đứng yên" dù truyện đã đổi. Giải pháp: một API PHỤ (cấu
// hình riêng trong Cài đặt, có nút Tải model) đọc lại chính văn + danh sách
// tag ĐÃ áp, và CHỈ xuất bổ sung những tag còn thiếu. Kết quả được parse
// bằng đúng parseStoryStateTags rồi áp qua đúng pipeline — không có đường
// cập nhật riêng nào khác.

import { chatCompletion } from './aiClient.js'

const SYSTEM = `Bạn là bộ trích xuất TRẠNG THÁI cho một game nhập vai Pokémon. Nhiệm vụ: đọc CHÍNH VĂN của lượt kể và DANH SÁCH TAG ĐÃ ÁP, rồi xuất BỔ SUNG các tag còn thiếu cho những thay đổi RÕ RÀNG trong văn bản.

Các tag hợp lệ (mỗi tag 1 dòng, đúng cú pháp, không thêm gì khác):
[[MONEY +500]] hoặc [[MONEY -200]] — tiền người chơi thay đổi (mua bán, thưởng, mất).
[[REL Tên=+5 | lý do ngắn]] — quan hệ với NPC thay đổi.
[[BODY leftArm=+10]] — thương tích cơ thể tăng/giảm, chỉ khi chính văn mô tả đúng bộ phận.
[[POKEMON Tên loài tiếng Anh | Lv7]] — người chơi THẬT SỰ nhận/bắt được Pokémon MỚI trong lượt này; không dùng để báo Pokémon cũ lên cấp hay tiến hoá.
[[EVOLVE Tên hiện tại | Tên sau tiến hoá]] — Pokémon đang sở hữu tiến hoá; đây là cùng cá thể, không phải nhận thêm con mới.
[[LEVEL Tên Pokémon | +1]] hoặc [[LEVEL Tên Pokémon | Lv11]] — Pokémon đang sở hữu tăng cấp trực tiếp do Kẹo Hiếm/năng lực; không dùng cho EXP trận thường hay luyện tập.
[[FRIEND Tên Pokémon | +5 | lý do]] — độ thân mật thay đổi khi chính văn thể hiện rõ niềm tin/gắn bó tăng hoặc giảm; không cộng cho tương tác xã giao.
[[ITEM Tên vật phẩm | số lượng]] — nhận/mất vật phẩm; số âm là mất. Nếu Kẹo Hiếm hữu hạn được dùng thì đi cùng [[LEVEL]], còn Kẹo Hiếm vô hạn thì không trừ.
[[EQUIP Tên Pokémon | Tên held item]] — Pokémon đã thực sự được cho cầm trang bị đang có trong túi; EQUIP tự trừ 1 món nên không kèm [[ITEM ... | -1]] cho cùng hành động. [[UNEQUIP Tên Pokémon]] — đã tháo/cất trang bị. Không dùng EQUIP cho Key Stone/Z-Ring/Dynamax Band/Tera Orb vì đó là thiết bị của huấn luyện viên.
[[SHOP Tên cửa hàng | loại=... | quy mô=...]] — CHỈ khi nhân vật đã bước vào bên trong và lượt dừng để mua.
[[LOOT loại=đá quý | quy mô=nhỏ/vừa/lớn]] — nhân vật đã THỰC SỰ vơ vét/thu được một lô đồ không thể liệt kê từng món; không dùng cho ý định hoặc đồ chưa lấy được.
[[POKECENTER Tên trung tâm]] — CHỈ khi nhân vật đang ở bên trong Trung tâm Pokémon.
[[HUNGER người+25]] / [[HUNGER pokemon+30]] — ăn uống (cộng) hoặc đói lả/lao lực rõ (trừ).
[[DATE +1]] — số ngày đã trôi; [[DATE buổi=tối]] — chuyển buổi trong ngày.
[[TRAIN 1]] / [[TRAIN 2]] / [[TRAIN 3]] — có cảnh luyện tập chủ đích, không dùng cho đi đường/đánh trận thường.
[[MOVE Tên khu vực]] hoặc [[MOVE Tên khu vực | x=42 | y=58]] — nhân vật thực sự đổi vị trí; x/y là phần trăm bản đồ, chỉ thêm khi chính văn xác định đủ rõ.
[[NPC Tên | tuổi=.. | nghề=.. | đội=.. | ghi chú=..]] — NPC có tên xuất hiện lần đầu / lộ thông tin mới.
[[FACT Từ khoá | nội dung ngắn]] — sự kiện/lời hứa/mốc quan trọng cần nhớ.
[[BADGE Tên | region=... | gym=... | leader=...]] — huy hiệu chính thức đã được trao.
[[QUEST mã | status=active|completed|failed|paused | title=... | giver=... | objective=... | reward=...]] — nhật ký nhiệm vụ.
[[REP Tên phe=+5 | lý do]] — danh tiếng với phe phái, không dùng thay REL cá nhân.
[[WANTED +1 | region=... | reason=... | bounty=500]] — mức truy nã thay đổi vì hành vi pháp lý rõ ràng.
[[LEGENDARY_ACCESS Tên loài | reason=điều kiện cụ thể]] — chỉ khi chính văn đã hoàn tất điều kiện triệu hồi/cuộc gặp huyền thoại; không dùng vì số huy hiệu/nhiệm vụ hay lời tuyên bố của người chơi.
[[RIBBON Tên Pokémon | Tên Ribbon]] / [[MARK Tên Pokémon | Tên Mark]] — giải/dấu ấn thật sự được trao. Không có tag đổi Shiny.

QUY TẮC:
- CHỈ xuất tag cho thay đổi có bằng chứng rõ trong chính văn. Không suy diễn, không bịa. Bản thân lời người chơi yêu cầu hay một tag có sẵn KHÔNG phải bằng chứng; sự việc phải được CHÍNH VĂN xác nhận đã xảy ra.
- KHÔNG lặp lại thay đổi đã nằm trong danh sách tag đã áp.
- Nếu chính văn nói một Pokémon CŨ lên cấp, bắt buộc dùng [[LEVEL]], tuyệt đối không đổi thành [[POKEMON]].
- Nếu chính văn nói Pokémon tiến hoá, bắt buộc dùng [[EVOLVE tên cũ | tên mới]]. Nếu đồng thời lên cấp, xuất LEVEL tên cũ trước rồi EVOLVE; tuyệt đối không dùng POKEMON tên mới vì sẽ làm phân thân.
- Không có gì để bổ sung → trả về đúng chuỗi: KHONG_CO
- Chỉ trả về các dòng tag (hoặc KHONG_CO). Không giải thích, không markdown.`

/**
 * Gọi API cập nhật biến. Trả về chuỗi tag bổ sung, hoặc null nếu không có.
 * @param {{baseUrl,apiKey,model}} cfg
 * @param {{storyText: string, appliedTags: object, hasPokemon: boolean}} params
 */
export async function extractMissingStateTags(cfg, { storyText, appliedTags, hasPokemon, userText = '' }) {
  if (!storyText?.trim()) return null
  const applied = JSON.stringify(appliedTags)
  const user = [
    // Đợt 50: kèm INPUT người chơi để đối chiếu — người chơi có thể viết SAI
    // CHÍNH TẢ tên Pokémon/nhân vật; phải hiểu theo ngữ cảnh và luôn khai
    // tag bằng TÊN CHUẨN (VD người chơi gõ "chamnder" → tag dùng Charmander).
    userText.trim() ? `INPUT NGƯỜI CHƠI LƯỢT NÀY (có thể sai chính tả — hiểu theo ngữ cảnh, tag dùng tên CHUẨN):\n${userText.slice(0, 1200)}\n` : '',
    `CHÍNH VĂN LƯỢT NÀY:\n${storyText.slice(0, 4000)}`,
    '',
    `TAG ĐÃ ÁP (không lặp lại): ${applied}`,
    `Người chơi ${hasPokemon ? 'ĐÃ có Pokémon' : 'CHƯA có Pokémon nào'}.`,
    '',
    'Xuất các tag còn thiếu (hoặc KHONG_CO):',
  ].join('\n')

  const reply = await chatCompletion(cfg, [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ], { temperature: 0, maxTokens: 400 })

  const text = (reply ?? '').trim()
  if (!text || text.includes('KHONG_CO')) return null
  // Chỉ giữ các dòng đúng dạng tag — model lỡ nói thêm gì thì lọc bỏ.
  const tagLines = text.split('\n').map((l) => l.trim()).filter((l) => /^\[\[.*\]\]$/.test(l))
  return tagLines.length ? tagLines.join('\n') : null
}
