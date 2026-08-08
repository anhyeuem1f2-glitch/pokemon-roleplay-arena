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
[[POKEMON Tên loài tiếng Anh | Lv7 | giới tính=cái]] — người chơi THẬT SỰ nhận/bắt/mua được Pokémon MỚI trong lượt này. Nếu chính văn nói đực/cái/vô giới tính thì BẮT BUỘC giữ đúng ở field giới tính; không rõ mới được bỏ field để app roll theo loài. Gồm cả giao dịch chuyển Pokémon qua PC/Box khi hệ thống đã xác nhận giao hàng và nhân vật đã lấy Poké Ball. Không dùng khi mới hẹn “sẽ gửi”, chưa nhận hàng, hoặc để báo Pokémon cũ lên cấp/tiến hoá. Nếu chỉ lấy được Poké Ball chưa biết nội dung/tình trạng, chưa xuất POKEMON: xuất [[ITEM Poké Ball chưa xác định | 1]] và FACT về nguồn gốc. Chỉ sau khi mở/kiểm tra xác định loài mới xuất POKEMON; app tự tiêu thụ bóng chưa xác định. Nếu xác nhận bóng trống còn dùng được, xuất ITEM bóng chưa xác định -1 và ITEM Poké Ball +1; nếu hỏng/bị trả/bị tịch thu thì chỉ trừ bóng chưa xác định.
[[EVOLVE Tên hiện tại | Tên sau tiến hoá]] — Pokémon đang sở hữu tiến hoá; đây là cùng cá thể, không phải nhận thêm con mới.
[[LEVEL Tên Pokémon | +1]] hoặc [[LEVEL Tên Pokémon | Lv11]] — Pokémon đang sở hữu tăng cấp trực tiếp do Kẹo Hiếm/năng lực; không dùng cho EXP trận thường hay luyện tập.
[[FRIEND Tên Pokémon | +5 | lý do]] — độ thân mật thay đổi khi chính văn thể hiện rõ niềm tin/gắn bó tăng hoặc giảm; không cộng cho tương tác xã giao.
[[ITEM Tên vật phẩm | số lượng]] — nhận/mất vật phẩm; số âm là mất. Gồm cả vật đã nhặt/trộm/cuỗm thành công. Giữ đúng số lượng chính văn xác nhận. Poké Ball đang chứa Pokémon chưa rõ loài phải ghi đúng [[ITEM Poké Ball chưa xác định | 1]], không coi là bóng rỗng. Khi chính văn liệt kê chính xác các món đã mua rồi xác nhận thanh toán/đóng gói, xuất một ITEM đúng tên + đúng số lượng cho từng món; KHÔNG gom giao dịch mua sắm thành LOOT vì LOOT sinh đồ ngẫu nhiên. Nếu Kẹo Hiếm hữu hạn được dùng thì đi cùng [[LEVEL]], còn Kẹo Hiếm vô hạn thì không trừ.
[[EQUIP Tên Pokémon | Tên held item]] — Pokémon đã thực sự được cho cầm trang bị đang có trong túi; EQUIP tự trừ 1 món nên không kèm [[ITEM ... | -1]] cho cùng hành động. [[UNEQUIP Tên Pokémon]] — đã tháo/cất trang bị. Không dùng EQUIP cho Key Stone/Z-Ring/Dynamax Band/Tera Orb vì đó là thiết bị của huấn luyện viên.
[[SHOP Tên cửa hàng | loại=... | quy mô=...]] — CHỈ khi nhân vật đã bước vào bên trong và lượt dừng để mua.
[[LOOT loại=đá quý | quy mô=nhỏ/vừa/lớn]] — nhân vật đã THỰC SỰ vơ vét/thu được một lô đồ không thể liệt kê từng món; không dùng cho ý định, đồ chưa lấy được hoặc hàng mua tại cửa hàng.
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
- Xuất tag cho MỌI thay đổi đã xuất hiện/hoàn tất trong chính văn, kể cả được diễn đạt gián tiếp, dùng đại từ, tên gọi rút gọn, nằm cách nhau nhiều câu hoặc nhiều đoạn. Không đòi một câu máy móc chứa đồng thời tên + động từ + kết quả. Chỉ không áp ý định/lời hứa chưa xảy ra, phủ định, suy nghĩ, hoặc chi tiết chỉ nằm trong input người chơi mà chính văn chưa tiếp nhận.
- KHÔNG có trần số tag hay số mặt hàng: mua/nhận 5, 10 hoặc nhiều món thì xuất đủ một ITEM cho từng món; nhiều sự kiện khác cũng phải xuất đủ, không dừng giữa danh sách.
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
export async function extractMissingStateTags(cfg, { storyText, appliedTags, hasPokemon, userText = '', contextNote = '' }) {
  if (!storyText?.trim()) return null
  const applied = JSON.stringify(appliedTags)
  const user = [
    // Đợt 50: kèm INPUT người chơi để đối chiếu — người chơi có thể viết SAI
    // CHÍNH TẢ tên Pokémon/nhân vật; phải hiểu theo ngữ cảnh và luôn khai
    // tag bằng TÊN CHUẨN (VD người chơi gõ "chamnder" → tag dùng Charmander).
    contextNote.trim() ? `${contextNote.trim()}\n` : '',
    userText.trim() ? `INPUT NGƯỜI CHƠI LƯỢT NÀY (có thể sai chính tả — hiểu theo ngữ cảnh, tag dùng tên CHUẨN):\n${userText}\n` : '',
    `CHÍNH VĂN LƯỢT NÀY:\n${storyText}`,
    '',
    `TAG ĐÃ ÁP (không lặp lại): ${applied}`,
    `Người chơi ${hasPokemon ? 'ĐÃ có Pokémon' : 'CHƯA có Pokémon nào'}.`,
    '',
    'Xuất các tag còn thiếu (hoặc KHONG_CO):',
  ].join('\n')

  const reply = await chatCompletion(cfg, [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ], { temperature: 0, maxTokens: 4096 })

  const text = (reply ?? '').trim()
  if (!text || text === 'KHONG_CO') return null
  // Lấy mọi tag không tham lam, kể cả preset/model dồn nhiều tag lên cùng một
  // dòng. Parser cũ chỉ giữ “mỗi dòng đúng một tag”, khiến danh sách dài mất sạch.
  const tagLines = [...text.matchAll(/\[\[[\s\S]*?\]\]/g)]
    .map((match) => match[0].replace(/\s+/g, ' ').trim())
  return tagLines.length ? tagLines.join('\n') : null
}
