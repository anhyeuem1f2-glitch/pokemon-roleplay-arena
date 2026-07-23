import { getActiveLoreEntries } from './lorebook.js'
import { getActiveWorldbook } from './worldbook.js'
import { buildCanonTrainerNote } from '../data/canonTrainers.js'
import { buildPresetPrompt } from './presetImport.js'
import { buildSystemPrompt, applyPlaceholders, BATTLE_INSTRUCTION } from './promptBuilder.js'
import { STORY_STATE_INSTRUCTION } from './storyStateProtocol.js'
import { DIRECTOR_WORLD_INSTRUCTION } from '../data/storyDirector.js'

/**
 * Build apiMessages + callOptions cho 1 lượt gọi API CHÍNH — dùng chung giữa
 * RoleplayChat (chat thật), IntroScreen (đoạn mở đầu) và DevPage (test).
 * Nếu có mainPreset thì dùng preset JSON, không thì dùng buildSystemPrompt
 * mặc định (có stylePreset). LUÔN chèn BATTLE_INSTRUCTION khi dùng preset để
 * tránh preset đè mất câu hướng dẫn [[BATTLE]].
 *
 * @param {{character, playerName, stylePreset, mainPreset, history: Array<{role,content}>, scanText: string, identityContext?: string}} params
 * @returns {{apiMessages: Array, callOptions: object, regexScripts: Array|undefined}}
 */
const PROSE_QUALITY_NOTE = 'ĐỘ DÀI & CHẤT LƯỢNG CHÍNH VĂN: mỗi lượt kể viết ĐẦY ĐỦ, nhiều đoạn văn (thường 300-600 từ trừ khi cảnh cực ngắn tự nhiên), giàu chi tiết giác quan, hành động và thoại — KHÔNG viết cụt lủn 1-2 câu. Luôn kết ở nhịp mở để người chơi hành động tiếp.'

// Ghi chú ưu tiên nguồn (đợt 41): worldbook người dùng > wiki Bulbapedia.
// Khi 2 nguồn mâu thuẫn, LUÔN theo worldbook.
function buildLoreWikiNote(wbActive, canonNote) {
  const parts = []
  if (canonNote) parts.push(canonNote)
  // (đợt 48) canonNote giờ có thể gồm cả note ĐỘI HÌNH CANON tĩnh — ghép sẵn
  // ở buildMainApiMessages trước khi truyền vào đây.
  if (wbActive.length && canonNote) {
    parts.push('LƯU Ý NGUỒN: Nếu WORLDBOOK (thiết lập của người dùng) mâu thuẫn với tư liệu wiki/canon ở trên, PHẢI ưu tiên WORLDBOOK. Dùng wiki để bổ sung chi tiết chính xác cho những gì worldbook không nói.')
  }
  return parts.join('\n\n')
}

export function buildMainApiMessages({ character, playerName, stylePreset, mainPreset, history, scanText, identityContext = '', worldbook = null, canonNote = '', toneNote = '' }) {
  // WORLDBOOK (đợt 41) — nguồn thông tin CHÍNH của người dùng; gộp với
  // lorebook cũ của character (nếu có). Đưa vào worldInfoBefore + system.
  const wbActive = getActiveWorldbook(worldbook?.entries ?? [], scanText)
  // ĐỘI HÌNH CANON tĩnh (đợt 48): nhắc tên gym leader/E4/Champion gốc →
  // chèn đội hình đúng game nguồn (chạy cả offline, bổ trợ lớp Bulbapedia).
  const canonTrainerNote = buildCanonTrainerNote(scanText)
  canonNote = [canonNote, canonTrainerNote].filter(Boolean).join('\n\n')
  // TÔNG TRUYỆN (đợt 50): độ khó + thể loại người chơi chọn — ghép vào cùng
  // kênh note hệ thống để vào prompt ở CẢ nhánh preset lẫn nhánh mặc định.
  if (toneNote) canonNote = [toneNote, canonNote].filter(Boolean).join('\n\n')
  if (mainPreset) {
    const activeLore = [...wbActive, ...getActiveLoreEntries(character.lorebook ?? [], scanText)]
    const { beforeHistory, afterHistory } = buildPresetPrompt(mainPreset.blocks, {
      charDescription: applyPlaceholders(character.description, character.name, playerName),
      charPersonality: applyPlaceholders(character.personality, character.name, playerName),
      scenario: applyPlaceholders(character.scenario, character.name, playerName),
      worldInfoBefore: activeLore.join('\n'),
      dialogueExamples: character.mes_example || '',
    })
    const apiMessages = [
      { role: 'system', content: beforeHistory },
      ...history,
      ...(afterHistory ? [{ role: 'system', content: afterHistory }] : []),
      { role: 'system', content: BATTLE_INSTRUCTION },
      { role: 'system', content: STORY_STATE_INSTRUCTION },
      // Đạo diễn tình huống (đợt 31): nguyên tắc thế giới sống + thân phận
      // người chơi — chèn cả khi dùng preset để preset không đè mất.
      { role: 'system', content: DIRECTOR_WORLD_INSTRUCTION },
      { role: 'system', content: PROSE_QUALITY_NOTE },
      ...(identityContext ? [{ role: 'system', content: identityContext }] : []),
      ...(wbActive.length
        ? [{ role: 'system', content: `THÔNG TIN WORLDBOOK (ưu tiên TUYỆT ĐỐI — canon người dùng; TÍNH CÁCH & vai trò nhân vật trong đây phải được tôn trọng kể cả khi văn phong preset khác đi):\n${wbActive.join('\n\n')}` }]
        : []),
      ...(wbActive.length || canonNote
        ? [{ role: 'system', content: buildLoreWikiNote(wbActive, canonNote) }]
        : []),
    ]
    const callOptions = {
      temperature: mainPreset.meta?.temperature,
      maxTokens: mainPreset.meta?.maxTokens,
    }
    return { apiMessages, callOptions, regexScripts: mainPreset.regexScripts }
  }

  const apiMessages = [
    { role: 'system', content: buildSystemPrompt(character, playerName, scanText, stylePreset) },
    // Đạo diễn tình huống (đợt 31) — nhánh mặc định.
    { role: 'system', content: DIRECTOR_WORLD_INSTRUCTION },
    { role: 'system', content: PROSE_QUALITY_NOTE },
    ...(identityContext ? [{ role: 'system', content: identityContext }] : []),
    ...(wbActive.length
      ? [{ role: 'system', content: `THÔNG TIN WORLDBOOK (ưu tiên TUYỆT ĐỐI — đây là canon người dùng thiết lập; TÍNH CÁCH, ngoại hình, vai trò của nhân vật trong đây PHẢI được tôn trọng kể cả khi văn phong preset có xu hướng khác):\n${wbActive.join('\n\n')}` }]
      : []),
    ...(wbActive.length || canonNote
      ? [{ role: 'system', content: buildLoreWikiNote(wbActive, canonNote) }]
      : []),
    ...history,
  ]
  return { apiMessages, callOptions: {}, regexScripts: undefined }
}
