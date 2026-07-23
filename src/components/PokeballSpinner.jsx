import React from 'react'

// ============ LOADER QUẢ POKÉBALL XOAY (đợt 38) ============
// SVG thuần, tự xoay bằng CSS keyframes — dùng làm biểu tượng "đang tải" khi
// tạo nhân vật (và tái dùng được ở bất kỳ chỗ nào chờ AI).

export default function PokeballSpinner({ size = 48, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <style>{`@keyframes pokeball-spin { to { transform: rotate(360deg); } }
        @keyframes pokeball-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }`}</style>
      <div style={{ animation: 'pokeball-bob 1.2s ease-in-out infinite' }}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ animation: 'pokeball-spin 0.9s linear infinite', display: 'block' }}
        >
          <defs>
            <clipPath id="pb-clip"><circle cx="50" cy="50" r="46" /></clipPath>
          </defs>
          <g clipPath="url(#pb-clip)">
            <rect x="0" y="0" width="100" height="50" fill="#e63939" />
            <rect x="0" y="50" width="100" height="50" fill="#f4f4f4" />
            <rect x="0" y="46" width="100" height="8" fill="#1a1a1a" />
          </g>
          <circle cx="50" cy="50" r="46" fill="none" stroke="#1a1a1a" strokeWidth="5" />
          <circle cx="50" cy="50" r="15" fill="#f4f4f4" stroke="#1a1a1a" strokeWidth="5" />
          <circle cx="50" cy="50" r="6" fill="#f4f4f4" stroke="#1a1a1a" strokeWidth="3" />
        </svg>
      </div>
      {label && <div style={{ fontSize: 12.5, color: 'var(--text-mid)' }}>{label}</div>}
    </div>
  )
}
