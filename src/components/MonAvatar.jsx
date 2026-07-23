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
function buildCandidates(mon, side) {
  const slug = mon.spriteId ?? mon.species
  if (!slug) return []
  const s = slug.toLowerCase()
  const animated = side === 'player' ? `sprites/ani-back/${s}.gif` : `sprites/ani/${s}.gif`
  // "home" chỉ có góc nhìn trực diện (không có bản "quay lưng" riêng) — thà
  // hiện tạm hình trực diện còn hơn rơi hẳn về icon chữ cái đầu.
  const homeStatic = `sprites/home/${s}.png`
  // "dex" là bộ catalog icon Pokédex của Showdown — đôi khi giữ được vài
  // costume/form cũ (VD Pikachu contest cũ) mà 2 bộ trên không có.
  const dexStatic = `sprites/dex/${s}.png`
  return [
    `https://play.pokemonshowdown.com/${animated}`,
    `https://play.pokemonshowdown.com/${homeStatic}`,
    `https://play.pokemonshowdown.com/${dexStatic}`,
  ]
}

export default function MonAvatar({ mon, side }) {
  const candidates = buildCandidates(mon, side)
  const [attempt, setAttempt] = useState(0)

  // Đổi loài/phe thì thử lại từ đầu chuỗi fallback.
  useEffect(() => {
    setAttempt(0)
  }, [mon.spriteId, mon.species, side])

  if (attempt < candidates.length) {
    return (
      <img
        loading="lazy"
        src={candidates[attempt]}
        alt={mon.name}
        onError={() => setAttempt((a) => a + 1)}
        style={{
          width: side === 'player' ? 96 : 80,
          height: side === 'player' ? 96 : 80,
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
        width: 84,
        height: 84,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontSize: 28,
        color: '#0d1a16',
        border: '2px solid var(--line)',
        flexShrink: 0,
      }}
    >
      {mon.name.charAt(0)}
    </div>
  )
}
