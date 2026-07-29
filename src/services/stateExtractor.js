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
[[POKEMON Tên loài tiếng Anh | Lv7]] — người chơi THẬT SỰ nhận/bắt được Pokémon MỚI trong lượt này; không dùng để báo Pokémon cũ lên cấp.
[[LEVEL Tên Pokémon | +1]] hoặc [[LEVEL Tên Pokémon | Lv11]] — Pokémon đang sở hữu tăng cấp trực tiếp do Kẹo Hiếm/năng lực; không dùng cho EXP trận thường hay luyện tập.
[[ITEM Tên vật phẩm | số lượng]] — nhận/mất vật phẩm; số âm là mất. Nếu Kẹo Hiếm hữu hạn được dùng thì đi cùng [[LEVEL]], còn Kẹo Hiếm vô hạn thì không trừ.
[[HUNGER người+25]] / [[HUNGER pokemon+30]] — ăn uống (cộng) hoặc đói lả/lao lực rõ (trừ).
[[DATE +1]] — số ngày đã trôi; [[DATE buổi=tối]] — chuyển buổi trong ngày.
[[MOVE Tên khu vực]] hoặc [[MOVE Tên khu vực | x=42 | y=58]] — nhân vật thực sự đổi vị trí; x/y là phần trăm bản đồ, chỉ thêm khi chính văn xác định đủ rõ.
[[NPC Tên | tuổi=.. | nghề=.. | đội=.. | ghi chú=..]] — NPC có tên xuất hiện lần đầu / lộ thông tin mới.
[[FACT Từ khoá | nội dung ngắn]] — sự kiện/lời hứa/mốc quan trọng cần nhớ.

QUY TẮC:
- CHỈ xuất tag cho thay đổi có bằng chứng rõ trong chính văn. Không suy diễn, không bịa.
- KHÔNG lặp lại thay đổi đã nằm trong danh sách tag đã áp.
- Nếu chính văn nói một Pokémon CŨ lên cấp, bắt buộc dùng [[LEVEL]], tuyệt đối không đổi thành [[POKEMON]].
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
