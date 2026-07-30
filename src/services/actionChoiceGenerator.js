import { chatCompletion } from './aiClient.js'
import { extractActionChoices } from '../utils/actionChoices.js'

const SYSTEM = `Bạn tạo lựa chọn hành động cho một web game nhập vai Pokémon bằng tiếng Việt.
Dựa CHỈ trên ngữ cảnh được cung cấp, tạo 4 hành động mà nhân vật người chơi có thể làm tiếp.
- A: thận trọng/quan sát; B: chủ động thúc đẩy cốt truyện; C: tương tác NPC hoặc Pokémon; D: sáng tạo, mạo hiểm hoặc tấu hài nhưng hợp logic.
- Mỗi lựa chọn 1-2 câu, cụ thể, có thể gửi nguyên văn như input tiếp theo.
- Không quyết định phản ứng hay kết quả thay NPC; không dùng kiến thức nhân vật chưa biết; không bịa vật phẩm/Pokémon/năng lực người chơi chưa có.
- Không giải thích, không markdown, chỉ xuất đúng:
<actions>
[A|Thận trọng] ...
[B|Chủ động] ...
[C|Kết nối] ...
[D|Sáng tạo] ...
</actions>`

export async function generateActionChoices(cfg, { recentContext = '', storyText = '', userText = '', playerName = '' }) {
  if (!storyText?.trim()) return []
  const prompt = [
    playerName ? `NHÂN VẬT NGƯỜI CHƠI: ${playerName}` : '',
    recentContext ? `NGỮ CẢNH GẦN ĐÂY:\n${recentContext.slice(-5000)}` : '',
    userText ? `HÀNH ĐỘNG VỪA GỬI:\n${userText.slice(0, 1200)}` : '',
    `CHÍNH VĂN MỚI NHẤT:\n${storyText.slice(-4000)}`,
    'Tạo lựa chọn hành động tiếp theo:',
  ].filter(Boolean).join('\n\n')

  const reply = await chatCompletion(cfg, [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: prompt },
  ], { temperature: 0.75, maxTokens: 550 })
  return extractActionChoices(reply)
}
