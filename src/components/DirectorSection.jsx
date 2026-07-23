import React, { useEffect, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import {
  IDENTITIES, getIdentity, getDirectorSettings, setDirectorSettings, subscribeDirector,
} from '../data/storyDirector.js'

// ============ CÀI ĐẶT ĐẠO DIỄN TÌNH HUỐNG (đợt 31) ============
// Chỉnh nhịp độ hạt giống tình huống + bật/tắt nhánh romance + đổi thân phận
// giữa chừng (đổi thân phận giữa truyện là hợp lệ — AI sẽ coi như bí mật
// thân phận dần lộ ra, nhưng khuyến nghị chọn từ đầu truyện).

export default function DirectorSection() {
  const { playerIdentity, setPlayerIdentity } = useGame()
  const [cfg, setCfg] = useState(() => getDirectorSettings())

  useEffect(() => {
    const unsub = subscribeDirector(() => setCfg(getDirectorSettings()))
    return unsub
  }, [])

  return (
    <div className="field">
      <label>Đạo diễn tình huống (thúc đẩy cốt truyện)</label>
      <small>
        Thi thoảng "ném" cho AI một hạt giống tình huống — đời thường, xã giao, romance, cơ hội,
        rắc rối nhỏ, tín hiệu mờ của tổ chức phản diện vùng, và các biến cố riêng theo thân phận.
        Luôn kèm quy tắc công bằng: không dồn ép ngõ cụt, không nịnh người chơi.
      </small>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <div>
          <label style={{ fontSize: 11.5 }}>Nhịp độ</label>
          <select value={cfg.intensity} onChange={(e) => setDirectorSettings({ intensity: e.target.value })}>
            <option value="off">Tắt hẳn</option>
            <option value="sparse">Thưa (yên bình)</option>
            <option value="normal">Vừa (khuyên dùng)</option>
            <option value="dense">Dày (nhiều biến cố)</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11.5 }}>Thân phận hiện tại</label>
          <select value={playerIdentity} onChange={(e) => setPlayerIdentity(e.target.value)}>
            {IDENTITIES.map((i) => (
              <option key={i.key} value={i.key}>{i.name}</option>
            ))}
          </select>
        </div>
      </div>
      <small style={{ display: 'block', color: 'var(--text-dim)', marginTop: 4 }}>
        {getIdentity(playerIdentity).desc}
      </small>

      {/* Đợt 50: bỏ checkbox romance — romance giờ là 1 THỂ LOẠI chọn ở
            màn tạo nhân vật (trang Tông truyện); đạo diễn luôn được phép
            dùng chất liệu romance ở mức phù hợp tông. */}
    </div>
  )
}
