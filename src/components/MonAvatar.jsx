import React, { useState, useEffect } from 'react'

// Sprite lấy từ kho sprite công khai của Pokémon Showdown (dự án fan/cộng đồng,
// dùng cho mục đích cá nhân/phi thương mại). "back" = nhìn từ sau lưng (phe mình),
// "front" = nhìn trực diện (phe địch) — đúng quy ước hiển thị của game Pokémon gốc.
//
// Nhiều form đặc biệt (Arceus 18 hệ, Silvally, Genesect...) KHÔNG có trong bộ
// sprite động "ani/ani-back" (bộ này vốn dừng lại ở phong cách Đen/Trắng, chưa
// bao giờ được vẽ thêm cho hết mọi form sau này) — nên cần thử tiếp bộ sprite
// tĩnh "home" (render chính thức từ Pokémon HOME, bao phủ gần như mọi form
// hiện tại) trước khi mới chịu rơi về icon chữ cái đầu.
//
// Lưu ý: đây là hotlink tới server ngoài, có thể chậm hoặc đứt tuỳ thời điểm.
export function buildSpriteCandidates(mon, side) {
  const slug = mon.spriteId ?? mon.species
  if (!slug) return []
  const s = slug.toLowerCase()
  // Showdown dùng hậu tố "-f" cho sprite cái có ngoại hình khác. Form vốn đã
  // mang hậu tố -f (VD Meowstic-F) không được nối thành -f-f. Thử toàn bộ ảnh
  // cái trước; nếu loài không có khác biệt giới tính mới lùi về ảnh cơ bản.
  const slugs = mon.gender === 'female' && !s.endsWith('-f') ? [`${s}-f`, s] : [s]
  const animatedDir = side === 'player' ? 'ani-back' : 'ani'
  const urls = []
  for (const candidate of slugs) {
    urls.push(`https://play.pokemonshowdown.com/sprites/${animatedDir}/${candidate}.gif`)
    // "home" chỉ có góc nhìn trực diện (không có bản "quay lưng" riêng).
    urls.push(`https://play.pokemonshowdown.com/sprites/home/${candidate}.png`)
    // "dex" là catalog icon Pokédex, đôi khi còn ảnh form cũ.
    urls.push(`https://play.pokemonshowdown.com/sprites/dex/${candidate}.png`)
  }
  return [...new Set(urls)]
}

export default function MonAvatar({ mon, side = 'enemy', size = null }) {
  const candidates = buildSpriteCandidates(mon, side)
  const [attempt, setAttempt] = useState(0)
  const resolvedSize = size ?? (side === 'player' ? 96 : 80)

  // Đổi loài/phe thì thử lại từ đầu chuỗi fallback.
  useEffect(() => {
    setAttempt(0)
  }, [mon.spriteId, mon.species, mon.gender, side])

  if (attempt < candidates.length) {
    return (
      <img
        loading="lazy"
        src={candidates[attempt]}
        alt={mon.name}
        onError={() => setAttempt((a) => a + 1)}
        style={{
          width: resolvedSize,
          height: resolvedSize,
          objectFit: 'contain',
          imageRendering: 'pixelated',
          flexShrink: 0,
        }}
      />
    )
  }

  // Fallback cuối: vòng tròn chữ cái đầu, dùng khi mọi sprite đều lỗi.
  const bg = side === 'player' ? 'var(--mint-dim)' : 'var(--violet)'
  return (
    <div
      style={{
        width: resolvedSize,
        height: resolvedSize,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontSize: Math.max(12, Math.round(resolvedSize * 0.33)),
        color: '#0d1a16',
        border: '2px solid var(--line)',
        flexShrink: 0,
      }}
    >
      {mon.name.charAt(0)}
    </div>
  )
}
