import { useEffect } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { musicManager } from '../utils/musicManager.js'
import {
  resolveAreaTrackKeys,
  resolveBattleTrackKeys,
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
  const { gameStarted, battleOpen, enemyMon, playerLocation } = useGame()

  // Nhạc nền chính: title ↔ khu vực bản đồ.
  useEffect(() => {
    musicManager.setBase(gameStarted ? resolveAreaTrackKeys(playerLocation) : TITLE_TRACK_KEYS)
  }, [gameStarted, playerLocation])

  // Trận theo lượt (BattleModal): override khi mở, pop khi đóng.
  useEffect(() => {
    if (battleOpen && enemyMon) {
      musicManager.pushOverride('turn-battle', resolveBattleTrackKeys(enemyMon))
    } else {
      musicManager.popOverride('turn-battle')
    }
  }, [battleOpen, enemyMon])

  // Unmount toàn app (hot reload...) — dọn override trận cho sạch.
  useEffect(() => () => musicManager.popOverride('turn-battle'), [])

  return null
}
