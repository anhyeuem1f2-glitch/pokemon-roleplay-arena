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

export const BATTLE_INSTRUCTION = `QUAN TRỌNG: Nếu trong đoạn bạn viết, nhân vật chính bị thách đấu hoặc chuẩn bị bước vào một trận chiến Pokémon, hãy DỪNG LẠI ngay trước khi trận đấu diễn ra và chèn chính xác dòng ${BATTLE_MARKER} ở cuối tin nhắn (không viết diễn biến trận đấu bằng lời, hệ thống sẽ tự xử lý phần chiến đấu). Sau đó chờ hệ thống báo lại kết quả trận đấu (thắng/thua/chạy thoát) rồi mới viết tiếp diễn biến câu chuyện dựa theo kết quả đó.`

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
