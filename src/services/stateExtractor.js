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
[[POKEMON Tên loài tiếng Anh | Lv7]] — người chơi THẬT SỰ nhận/bắt được Pokémon mới trong lượt này.
[[HUNGER người+25]] / [[HUNGER pokemon+30]] — ăn uống (cộng) hoặc đói lả/lao lực rõ (trừ).
[[DATE +1]] — số ngày đã trôi; [[DATE buổi=tối]] — chuyển buổi trong ngày.
[[NPC Tên | tuổi=.. | nghề=.. | đội=.. | ghi chú=..]] — NPC có tên xuất hiện lần đầu / lộ thông tin mới.
[[FACT Từ khoá | nội dung ngắn]] — sự kiện/lời hứa/mốc quan trọng cần nhớ.

QUY TẮC:
- CHỈ xuất tag cho thay đổi có bằng chứng rõ trong chính văn. Không suy diễn, không bịa.
- KHÔNG lặp lại thay đổi đã nằm trong danh sách tag đã áp.
- Không có gì để bổ sung → trả về đúng chuỗi: KHONG_CO
- Chỉ trả về các dòng tag (hoặc KHONG_CO). Không giải thích, không markdown.`

/**
 * Gọi API cập nhật biến. Trả về chuỗi tag bổ sung, hoặc null nếu không có.
 * @param {{baseUrl,apiKey,model}} cfg
 * @param {{storyText: string, appliedTags: object, hasPokemon: boolean}} params
 */
export async function extractMissingStateTags(cfg, { storyText, appliedTags, hasPokemon }) {
  if (!storyText?.trim()) return null
  const applied = JSON.stringify(appliedTags)
  const user = [
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
