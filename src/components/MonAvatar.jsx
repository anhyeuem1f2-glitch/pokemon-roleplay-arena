import React, { useState, useEffect } from 'react'
import { buildSpriteCandidates } from '../utils/pokemonSprite.js'

export { buildSpriteCandidates } from '../utils/pokemonSprite.js'

export default function MonAvatar({ mon, side = 'enemy', size = null, style = null, className = undefined, title = undefined }) {
  const candidates = buildSpriteCandidates(mon, side)
  const [attempt, setAttempt] = useState(0)
  const resolvedSize = size ?? (side === 'player' ? 96 : 80)

  // Đổi loài/form/giới tính/SHINY/phe thì phải thử lại từ đầu chuỗi fallback.
  useEffect(() => {
    setAttempt(0)
  }, [mon?.spriteId, mon?.species, mon?.gender, mon?.shiny, side])

  if (attempt < candidates.length) {
    return (
      <img
        loading="lazy"
        src={candidates[attempt]}
        alt={mon?.name ?? 'Pokémon'}
        title={title}
        className={className}
        onError={() => setAttempt((a) => a + 1)}
        style={{
          width: resolvedSize,
          height: resolvedSize,
          objectFit: 'contain',
          imageRendering: 'pixelated',
          flexShrink: 0,
          ...(style ?? {}),
        }}
      />
    )
  }

  // Fallback cuối: vòng tròn chữ cái đầu, dùng khi mọi sprite đều lỗi.
  const bg = side === 'player' ? 'var(--mint-dim)' : 'var(--violet)'
  return (
    <div
      title={title}
      className={className}
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
        ...(style ?? {}),
      }}
    >
      {(mon?.name ?? '?').charAt(0)}
    </div>
  )
}
