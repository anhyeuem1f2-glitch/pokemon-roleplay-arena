import { useEffect } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { musicManager } from '../utils/musicManager.js'
import {
  resolveAreaTrackKeys,
  resolveBattleTrackKeys,
  resolveSceneTrackKeys,
  resolveTimeOfDayTrackKeys,
  TITLE_TRACK_KEYS,
} from '../data/musicTracks.js'

// ============ ĐIỀU PHỐI NHẠC NỀN (đợt 28) — component "vô hình" ============
// Mount 1 lần trong App, theo dõi state trung tâm và dịch sang lệnh cho
// musicManager:
// - Chưa vào truyện (title screen / Dev / Settings) → nhạc title.
// - Đang chơi → nhạc theo VỊ TRÍ bản đồ (đổi khu là đổi nhạc, cùng "chất"
//   nhạc thì giữ nguyên không cắt).
// - BattleModal mở → override nhạc trận theo độ hoành tráng của đối thủ
//   (huyền thoại bậc cao / boss / hoang dã). enemyMon đổi HP mỗi lượt nhưng
//   pushOverride idempotent theo danh sách key nên nhạc KHÔNG bị restart.
// Shop + combat anime tự push/pop override riêng trong component của chúng.

export default function MusicController() {
  const { gameStarted, battleOpen, enemyMon, playerLocation, messages, storyDate } = useGame()

  // Nhạc nền chính: title ↔ khu vực bản đồ.
  useEffect(() => {
    musicManager.setBase(gameStarted ? resolveAreaTrackKeys(playerLocation) : TITLE_TRACK_KEYS)
  }, [gameStarted, playerLocation])

  // NHẠC THEO NGỮ CẢNH CHÍNH VĂN (đợt 67): quét lượt AI mới nhất — vào
  // Trung tâm Pokémon, cắm trại nghỉ đêm, đấu Gym/Champion... đều đổi nhạc
  // cho khớp. Không nhận ra cảnh gì thì lùi về nhạc theo BUỔI (đêm dịu hơn),
  // rồi mới tới nhạc theo vị trí bản đồ.
  const lastAiText = (() => {
    for (let i = (messages?.length ?? 0) - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].content ?? ''
    }
    return ''
  })()

  useEffect(() => {
    if (!gameStarted || battleOpen) {
      musicManager.popOverride('scene')
      return
    }
    const scene = resolveSceneTrackKeys(lastAiText) ?? resolveTimeOfDayTrackKeys(storyDate?.part)
    if (scene) musicManager.pushOverride('scene', scene)
    else musicManager.popOverride('scene')
  }, [gameStarted, battleOpen, lastAiText, storyDate?.part])

  // Trận theo lượt (BattleModal): override khi mở, pop khi đóng.
  useEffect(() => {
    if (battleOpen && enemyMon) {
      // Truyền chính văn để trận Gym/Champion dùng đúng nhạc thay vì nhạc hoang dã.
      musicManager.pushOverride('turn-battle', resolveBattleTrackKeys(enemyMon, lastAiText))
    } else {
      musicManager.popOverride('turn-battle')
    }
  }, [battleOpen, enemyMon, lastAiText])

  // Unmount toàn app (hot reload...) — dọn override trận cho sạch.
  useEffect(() => () => { musicManager.popOverride('turn-battle'); musicManager.popOverride('scene') }, [])

  return null
}
