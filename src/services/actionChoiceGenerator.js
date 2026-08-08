import { chatCompletion } from './aiClient.js'
import { extractActionChoices } from '../utils/actionChoices.js'

const SYSTEM = `Bạn tạo lựa chọn hành động cho một web game nhập vai Pokémon bằng tiếng Việt.
Dựa CHỈ trên ngữ cảnh được cung cấp, tạo đúng 4 hành động mà nhân vật người chơi có thể làm tiếp.
- A: thận trọng/quan sát; B: chủ động thúc đẩy cốt truyện; C: tương tác NPC hoặc Pokémon; D: sáng tạo, mạo hiểm hoặc tấu hài nhưng hợp logic.
- Mỗi lựa chọn 1-2 câu, cụ thể, có thể gửi nguyên văn như input tiếp theo.
- Không quyết định phản ứng hay kết quả thay NPC; không dùng kiến thức nhân vật chưa biết; không bịa vật phẩm/Pokémon/năng lực người chơi chưa có.
- Đây là INPUT nhập vai của người chơi, KHÔNG phải hướng dẫn cho người viết. Cấm đưa vào lựa chọn các mục như góc nhìn, văn phong, phân đoạn, tag trạng thái, định hướng câu chuyện, prompt, quy tắc hoặc metadata.
- Không giải thích, không markdown, chỉ xuất đúng:
<actions>
[A|Thận trọng] ...
[B|Chủ động] ...
[C|Kết nối] ...
[D|Sáng tạo] ...
</actions>`

function buildPrompt({ recentContext = '', storyText = '', userText = '', playerName = '', retry = false }) {
  return [
    playerName ? `NHÂN VẬT NGƯỜI CHƠI: ${playerName}` : '',
    recentContext ? `NGỮ CẢNH GẦN ĐÂY:\n${recentContext.slice(-5000)}` : '',
    userText ? `HÀNH ĐỘNG VỪA GỬI:\n${userText.slice(0, 1200)}` : '',
    `CHÍNH VĂN MỚI NHẤT:\n${storyText.slice(-4000)}`,
    retry ? 'Lần trước không tạo được 4 input hành động hợp lệ. Hãy làm lại, tuyệt đối không chép quy tắc/prompt/scaffold.' : '',
    'Tạo đúng 4 lựa chọn hành động tiếp theo:',
  ].filter(Boolean).join('\n\n')
}

async function generateOnce(cfg, args, retry = false) {
  const reply = await chatCompletion(cfg, [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: buildPrompt({ ...args, retry }) },
  ], { temperature: retry ? 0.55 : 0.75, maxTokens: 550 })
  return extractActionChoices(reply)
}

export async function generateActionChoices(cfg, args) {
  if (!args?.storyText?.trim()) return []
  const first = await generateOnce(cfg, args, false)
  if (first.length === 4) return first

  // Fail closed ở parser có thể khiến model/preset cũ trả 0 lựa chọn. Retry
  // đúng một lần bằng prompt chặt hơn thay vì đưa scaffold rác lên giao diện.
  return generateOnce(cfg, args, true)
}
