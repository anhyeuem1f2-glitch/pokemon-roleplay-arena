import React from 'react'

// Hình người sinh lực kiểu "chân thực" (Pokémon tấn công người là bình
// thường): cơ thể chia 6 bộ phận — đầu, thân, 2 tay, 2 chân. Mỗi bộ phận có
// mức thương tổn 0-100, tô màu theo độ nặng:
//   0-19  xám sáng  — lành lặn / trầy xước không đáng kể
//   20-39 vàng      — bị thương nhẹ
//   40-59 cam       — bị thương vừa
//   60-84 đỏ        — bị thương nặng
//   85-99 đỏ sậm    — nguy kịch
//   100   đen       — mất / hỏng hẳn bộ phận
export function bodyPartColor(dmg) {
  if (dmg >= 100) return '#0d0d0f'
  if (dmg >= 85) return '#7a1414'
  if (dmg >= 60) return '#d94f4f'
  if (dmg >= 40) return '#d98032'
  if (dmg >= 20) return '#d4b106'
  return '#7d8590'
}

export function bodyPartLabel(dmg) {
  if (dmg >= 100) return 'MẤT'
  if (dmg >= 85) return 'nguy kịch'
  if (dmg >= 60) return 'nặng'
  if (dmg >= 40) return 'vừa'
  if (dmg >= 20) return 'nhẹ'
  return 'lành lặn'
}

export const BODY_PARTS = [
  { key: 'head', label: 'Đầu' },
  { key: 'torso', label: 'Thân' },
  { key: 'leftArm', label: 'Tay trái' },
  { key: 'rightArm', label: 'Tay phải' },
  { key: 'leftLeg', label: 'Chân trái' },
  { key: 'rightLeg', label: 'Chân phải' },
]

// LƯU Ý hướng nhìn: hình vẽ đối diện người xem nên "tay trái" của NHÂN VẬT
// nằm bên PHẢI màn hình (như soi gương). onPartClick (tuỳ chọn) để tab test
// giao diện bấm trực tiếp vào bộ phận.
export default function BodyFigure({ bodyStatus, size = 120, onPartClick }) {
  const c = (k) => bodyPartColor(bodyStatus[k] ?? 0)
  const t = (k) =>
    `${BODY_PARTS.find((p) => p.key === k)?.label}: ${bodyStatus[k] ?? 0}/100 (${bodyPartLabel(bodyStatus[k] ?? 0)})`
  const clickable = Boolean(onPartClick)
  const common = (k) => ({
    fill: c(k),
    stroke: 'var(--line)',
    strokeWidth: 1.5,
    style: { cursor: clickable ? 'pointer' : 'default', transition: 'fill .25s' },
    onClick: clickable ? () => onPartClick(k) : undefined,
  })

  return (
    <svg
      viewBox="0 0 100 150"
      width={size}
      height={size * 1.5}
      role="img"
      aria-label="Sinh lực theo bộ phận cơ thể"
    >
      {/* Đầu */}
      <circle cx="50" cy="16" r="12" {...common('head')}>
        <title>{t('head')}</title>
      </circle>
      {/* Thân */}
      <rect x="36" y="31" width="28" height="46" rx="7" {...common('torso')}>
        <title>{t('torso')}</title>
      </rect>
      {/* Tay phải nhân vật (bên trái màn hình) */}
      <rect x="21" y="33" width="11" height="42" rx="5.5" {...common('rightArm')}>
        <title>{t('rightArm')}</title>
      </rect>
      {/* Tay trái nhân vật (bên phải màn hình) */}
      <rect x="68" y="33" width="11" height="42" rx="5.5" {...common('leftArm')}>
        <title>{t('leftArm')}</title>
      </rect>
      {/* Chân phải nhân vật (bên trái màn hình) */}
      <rect x="37" y="80" width="11" height="52" rx="5.5" {...common('rightLeg')}>
        <title>{t('rightLeg')}</title>
      </rect>
      {/* Chân trái nhân vật (bên phải màn hình) */}
      <rect x="52" y="80" width="11" height="52" rx="5.5" {...common('leftLeg')}>
        <title>{t('leftLeg')}</title>
      </rect>
    </svg>
  )
}
