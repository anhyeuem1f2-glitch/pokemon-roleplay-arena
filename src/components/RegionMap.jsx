import React, { useEffect, useRef, useState } from 'react'
import { REGIONS, getArea } from '../data/regions.js'
import { getMapPin } from '../data/mapPins.js'

// ============ BẢN ĐỒ TƯƠNG TÁC (đợt 74) ============
// Ảnh vẫn do chủ dự án tự bỏ vào public/maps/. Giao diện mới tách bản đồ và
// danh sách địa điểm thành hai vùng rõ ràng; không rải nút chọn địa điểm giữa
// khung ảnh. Có zoom bằng nút, con lăn, kéo để pan và nút đặt lại góc nhìn.

const MAP_EXTS = ['png', 'jpg', 'webp']
const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.25

function mapUrl(regionKey, ext) {
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '')
  return `${base}/maps/${regionKey}.${ext}`
}

function clampZoom(value) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value) || MIN_ZOOM))
}

function IconButton({ title, children, onClick, disabled }) {
  return (
    <button
      type="button"
      className="btn"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 34, height: 32, padding: 0, display: 'grid', placeItems: 'center',
        borderRadius: 8, fontSize: 16, fontWeight: 800,
      }}
    >
      {children}
    </button>
  )
}

function MapCanvas({ regionKey, location }) {
  const [extIdx, setExtIdx] = useState(0)
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef(null)

  function resetView() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  useEffect(() => {
    setExtIdx(0)
    setFailed(false)
    resetView()
  }, [regionKey])

  function updateZoom(next) {
    const value = clampZoom(next)
    setZoom(value)
    if (value === 1) setPan({ x: 0, y: 0 })
  }

  function onWheel(e) {
    e.preventDefault()
    updateZoom(zoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP))
  }

  function onPointerDown(e) {
    if (zoom <= 1) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
  }

  function onPointerMove(e) {
    const drag = dragRef.current
    if (!drag) return
    setPan({ x: drag.panX + e.clientX - drag.x, y: drag.panY + e.clientY - drag.y })
  }

  function stopDrag(e) {
    dragRef.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  const pin = location && location.regionKey === regionKey
    ? getMapPin(regionKey, location.areaKey)
    : null

  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          marginBottom: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 9.5, color: 'var(--amber)', fontWeight: 800, letterSpacing: '.13em' }}>GÓC NHÌN</div>
          <div style={{ color: 'var(--text-dim)', fontSize: 10.5, marginTop: 2 }}>
            Lăn chuột để zoom · kéo ảnh khi đã phóng to
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconButton title="Thu nhỏ" disabled={zoom <= MIN_ZOOM} onClick={() => updateZoom(zoom - ZOOM_STEP)}>−</IconButton>
          <button
            type="button"
            className="btn"
            onClick={resetView}
            title="Đặt lại góc nhìn"
            style={{ minWidth: 66, height: 32, padding: '0 9px', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <IconButton title="Phóng to" disabled={zoom >= MAX_ZOOM} onClick={() => updateZoom(zoom + ZOOM_STEP)}>+</IconButton>
          <IconButton title="Đặt lại góc nhìn" onClick={resetView}>⌂</IconButton>
        </div>
      </div>

      <div
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onDoubleClick={() => updateZoom(zoom >= 2 ? 1 : 2)}
        style={{
          position: 'relative', overflow: 'hidden', height: 'clamp(300px, 54vh, 560px)',
          border: '1px solid var(--line)', borderRadius: 13,
          background:
            'radial-gradient(circle at 30% 20%, rgba(120,200,170,.10), transparent 34%), radial-gradient(circle at 75% 70%, rgba(232,184,74,.08), transparent 36%), var(--bg-deep)',
          cursor: zoom > 1 ? (dragRef.current ? 'grabbing' : 'grab') : 'zoom-in',
          touchAction: 'none', userSelect: 'none',
        }}
      >
        {!failed ? (
          <div
            style={{
              position: 'absolute', inset: 0,
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              transformOrigin: 'center center', transition: dragRef.current ? 'none' : 'transform .18s ease',
              willChange: 'transform',
            }}
          >
            <img
              src={mapUrl(regionKey, MAP_EXTS[extIdx])}
              alt={`Bản đồ vùng ${regionKey}`}
              draggable={false}
              onError={() => {
                if (extIdx < MAP_EXTS.length - 1) setExtIdx((i) => i + 1)
                else setFailed(true)
              }}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
            />
            {pin && (
              <div
                title="Vị trí của bạn"
                style={{
                  position: 'absolute', left: `${pin[0]}%`, top: `${pin[1]}%`,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#e95b55', border: '3px solid #fff',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 0 7px rgba(233,91,85,.20), 0 3px 12px rgba(0,0,0,.45)',
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    position: 'absolute', inset: -8, borderRadius: '50%', border: '1px solid rgba(233,91,85,.65)',
                    animation: 'map-pin-ring 1.6s ease-out infinite',
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 28, textAlign: 'center' }}>
            <div style={{ maxWidth: 420 }}>
              <div style={{ fontSize: 34, marginBottom: 9 }}>🗺</div>
              <div style={{ color: 'var(--text-hi)', fontWeight: 750, fontSize: 14 }}>Chưa có ảnh bản đồ vùng này</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.7, marginTop: 6 }}>
                Bỏ file <code>{regionKey}.png</code>, <code>.jpg</code> hoặc <code>.webp</code> vào <code>public/maps/</code>.
                Danh sách địa điểm bên cạnh vẫn hoạt động bình thường.
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            position: 'absolute', left: 10, bottom: 10, padding: '6px 9px', borderRadius: 8,
            background: 'rgba(4,10,14,.76)', backdropFilter: 'blur(7px)', border: '1px solid rgba(255,255,255,.08)',
            color: 'var(--text-dim)', fontSize: 9.5, pointerEvents: 'none',
          }}
        >
          Nhấp đúp: 100% / 200%
        </div>
      </div>
    </div>
  )
}

function AreaList({ region, location, onSetLocation }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 9.5, color: 'var(--amber)', fontWeight: 800, letterSpacing: '.13em' }}>ĐỊA ĐIỂM</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 10.5, marginTop: 2 }}>Chọn điểm đến để sửa vị trí thủ công</div>
      </div>
      <div
        style={{
          display: 'flex', flexDirection: 'column', gap: 7,
          maxHeight: 'clamp(300px, 54vh, 560px)', overflowY: 'auto', paddingRight: 4,
        }}
      >
        {region.areas.map((area, index) => {
          const isHere = location?.regionKey === region.key && location?.areaKey === area.key
          return (
            <button
              key={area.key}
              type="button"
              onClick={() => onSetLocation({ regionKey: region.key, areaKey: area.key })}
              title={`Wild Lv${area.level[0]}-${area.level[1]}`}
              style={{
                display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) auto', alignItems: 'center', gap: 9,
                width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${isHere ? 'var(--mint)' : 'var(--line)'}`,
                background: isHere ? 'rgba(120,200,170,.08)' : 'var(--bg-deep)', color: 'inherit',
              }}
            >
              <span
                style={{
                  width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center',
                  background: isHere ? 'var(--mint)' : 'rgba(255,255,255,.035)',
                  color: isHere ? '#07110e' : 'var(--text-dim)', fontSize: 10, fontWeight: 800,
                }}
              >
                {isHere ? '●' : String(index + 1).padStart(2, '0')}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', color: isHere ? 'var(--mint)' : 'var(--text-hi)', fontSize: 11.5, fontWeight: isHere ? 750 : 600 }}>
                  {area.name}
                </span>
                <span style={{ display: 'block', color: 'var(--text-dim)', fontSize: 9.5, marginTop: 2 }}>
                  Pokémon hoang dã Lv{area.level[0]}–{area.level[1]}
                </span>
              </span>
              <span style={{ color: isHere ? 'var(--mint)' : 'var(--text-dim)', fontSize: 13 }}>{isHere ? 'Đang ở' : '›'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function RegionMap({ location, onSetLocation, fixedRegion = false }) {
  const [regionKey, setRegionKey] = useState(location?.regionKey ?? 'kanto')

  useEffect(() => {
    if (fixedRegion && location?.regionKey) setRegionKey(location.regionKey)
  }, [fixedRegion, location?.regionKey])

  const region = REGIONS.find((r) => r.key === regionKey) ?? REGIONS[0]
  const currentArea = location ? getArea(location.regionKey, location.areaKey) : null
  const currentRegion = location ? REGIONS.find((r) => r.key === location.regionKey) : null

  return (
    <div style={{ minWidth: 0 }}>
      <style>{`
        @keyframes map-pin-ring { 0% { opacity: .9; transform: scale(.65); } 75%,100% { opacity: 0; transform: scale(1.75); } }
        .region-map-layout { display:grid; grid-template-columns:minmax(0,1fr) 250px; gap:14px; }
        @media (max-width: 760px) { .region-map-layout { grid-template-columns:1fr; } }
      `}</style>

      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          padding: '10px 12px', marginBottom: 12, borderRadius: 11,
          border: '1px solid var(--line)', background: 'linear-gradient(135deg, rgba(120,200,170,.065), rgba(232,184,74,.035))',
        }}
      >
        <div>
          <div style={{ fontSize: 9.5, color: 'var(--text-dim)', letterSpacing: '.11em', fontWeight: 750 }}>VỊ TRÍ HIỆN TẠI</div>
          {currentArea ? (
            <div style={{ marginTop: 3 }}>
              <strong style={{ color: 'var(--mint)', fontSize: 13 }}>{currentArea.name}</strong>
              <span style={{ color: 'var(--text-mid)', fontSize: 11 }}> · {currentRegion?.name} · wild Lv{currentArea.level[0]}–{currentArea.level[1]}</span>
            </div>
          ) : (
            <div style={{ color: 'var(--text-dim)', fontSize: 11.5, marginTop: 3 }}>Chưa xác định · mặc định wild Lv8–15</div>
          )}
        </div>

        {fixedRegion ? (
          <div style={{ padding: '7px 10px', borderRadius: 9, background: 'var(--bg-deep)', border: '1px solid var(--line)', color: 'var(--text-hi)', fontSize: 11.5, fontWeight: 700 }}>
            {region.name} <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>(Gen {region.gen})</span>
          </div>
        ) : (
          <select value={regionKey} onChange={(e) => setRegionKey(e.target.value)} style={{ minWidth: 170, fontSize: 12 }}>
            {REGIONS.map((r) => <option key={r.key} value={r.key}>{r.name} (Gen {r.gen})</option>)}
          </select>
        )}
      </div>

      <div className="region-map-layout">
        <MapCanvas regionKey={region.key} location={location} />
        <AreaList region={region} location={location} onSetLocation={onSetLocation} />
      </div>

      <div style={{ marginTop: 11, color: 'var(--text-dim)', fontSize: 10.5, lineHeight: 1.65 }}>
        App vẫn tự dò địa danh trong chính văn. Danh sách bên phải chỉ dùng để sửa khi AI khai thiếu hoặc dò nhầm vị trí.
      </div>
    </div>
  )
}
