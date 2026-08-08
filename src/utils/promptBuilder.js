import { getActiveLoreEntries } from './lorebook.js'

import { STORY_STATE_INSTRUCTION } from './storyStateProtocol.js'

export const BATTLE_MARKER = '[[BATTLE]]'

// Thay {{char}}/{{user}} (và biến thể <char>/<user>) bằng tên thật — quy ước
// chuẩn của SillyTavern, nhiều card cộng đồng dùng để card tổng quát hoá được.
export function applyPlaceholders(text, charName, userName) {
  if (!text) return text
  return text
    .replace(/\{\{char\}\}|<char>/gi, charName || 'nhân vật')
    .replace(/\{\{user\}\}|<user>/gi, userName || 'người chơi')
}

export const BATTLE_INSTRUCTION = `QUAN TRỌNG — ĐIỂM DỪNG CHỜ NGƯỜI CHƠI:
1) TRẬN ĐẤU: nếu nhân vật chính bị thách đấu hoặc sắp bước vào một trận chiến Pokémon, hãy DỪNG BÚT ngay trước khi trận đấu diễn ra, chèn chính xác dòng ${BATTLE_MARKER} rồi KẾT THÚC TIN NHẮN TẠI ĐÓ. TUYỆT ĐỐI KHÔNG viết thêm BẤT KỲ CHỮ NÀO sau dòng ${BATTLE_MARKER} — không kể diễn biến trận, không kể ai thắng ai thua, không kể ai bỏ chạy, không kể cảnh sau trận. Người chơi sẽ tự đánh; hệ thống báo lại kết quả THẬT (thắng / thua / NGƯỜI CHƠI chạy thoát / đối phương bỏ chạy) rồi bạn mới viết tiếp. Nếu bạn tự bịa kết quả, nó sẽ MÂU THUẪN với kết quả thật và làm hỏng câu chuyện.
1b) ĐẤU ĐÔI 2v2 ĐANG THỬ NGHIỆM: chỉ được mở đấu đôi khi (a) trận diễn ra tại Battle Club/Câu lạc bộ chiến đấu, hoặc (b) người chơi CHỦ ĐỘNG xin Chủ Gym đấu đôi và Chủ Gym đồng ý. Trong chính văn ngay trước ${BATTLE_MARKER}, phải nói rõ "đấu đôi 2v2" và nêu/cho xuất hiện hai Pokémon đối thủ. Mọi nơi khác vẫn là đánh đơn; không tự biến trận thường thành đấu đôi.
2) KẾT QUẢ TRẬN: khi hệ thống báo kết quả, hãy đọc KỸ ai là người chạy. "NGƯỜI CHƠI ĐÃ CHẠY THOÁT" nghĩa là nhân vật chính bỏ chạy (không phải đối phương). Kể đúng như vậy, không đảo ngược.
3) MUA SẮM: CHỈ khi chính văn nói rõ nhân vật đã BƯỚC VÀO BÊN TRONG cửa hàng và đang đứng trước quầy/nhìn kệ hàng thì DỪNG ở nhịp để người chơi tự chọn mua. Chỉ đi tới thành phố, đi ngang/nhìn thấy shop hoặc dự định mua sau thì không mở giao diện. KHÔNG cần viết SHOP/MONEY tag; Semantic State Engine sẽ đọc chính văn và đồng bộ giao dịch đã hoàn tất.`

/**
 * @param {object} character { name, description, personality, scenario, lorebook }
 * @param {string} playerName tên người chơi tự đặt (dùng thay {{user}})
 * @param {string} scanText văn bản gần đây để quét kích hoạt lorebook (World Info)
 * @param {string} stylePreset hướng dẫn văn phong tuỳ chỉnh, thay cho câu mặc định nếu có
 */
export function buildSystemPrompt(character, playerName, scanText = '', stylePreset = '') {
  const name = character.name
  const desc = applyPlaceholders(character.description, name, playerName)
  const personality = applyPlaceholders(character.personality, name, playerName)
  const scenario = applyPlaceholders(character.scenario, name, playerName)

  const activeLore = getActiveLoreEntries(character.lorebook ?? [], scanText)

  const styleLine = stylePreset?.trim()
    ? stylePreset.trim()
    : `Trả lời bằng tiếng Việt, giọng văn tự nhiên như tiểu thuyết, có thể dùng *hành động* xen kẽ lời thoại. Viết thành đoạn văn liền mạch, không dùng định dạng chat/tin nhắn.`

  return [
    `Bạn sẽ dẫn dắt một câu chuyện roleplay dạng tiểu thuyết tương tác (interactive fiction), viết bằng ngôi thứ 2 hoặc ngôi thứ 3 tuỳ bối cảnh, không thoát vai, không nhắc mình là AI.`,
    `Tên nhân vật/bối cảnh chính: ${name}`,
    desc && `Mô tả: ${desc}`,
    personality && `Tính cách: ${personality}`,
    scenario && `Bối cảnh: ${scenario}`,
    playerName && `Tên người chơi (nhân vật chính): ${playerName}`,
    activeLore.length > 0 &&
      `Thông tin thế giới liên quan (lorebook, PHẢI tuân theo, không tự bịa khác đi):\n${activeLore
        .map((c) => `- ${c}`)
        .join('\n')}`,
    styleLine,
    BATTLE_INSTRUCTION,
    STORY_STATE_INSTRUCTION,
  ]
    .filter(Boolean)
    .join('\n')
}
