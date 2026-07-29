import React, { useEffect, useRef, useState } from 'react'
import { REGIONS, getArea } from '../data/regions.js'
import {
  findNearestMapArea,
  getLocationCoords,
  getMapPin,
  normalizeMapLocation,
} from '../data/mapPins.js'

// ============ BẢN ĐỒ TƯƠNG TÁC (đợt 74-75) ============
// Đợt 75 bổ sung hệ toạ độ x/y 0..100. Người chơi có thể bấm trực tiếp lên
// bản đồ để đặt pin chính xác; app tự gắn pin đó với khu gần nhất để những
// hệ thống đang dùng areaKey (wild level, Safari, nhạc...) vẫn hoạt động.

const MAP_EXTS = ['png', 'jpg', 'webp']
const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.25
const GRID_STEPS = [0, 20, 40, 60, 80, 100]

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

function CoordinateGrid() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {GRID_STEPS.map((v) => (
        <React.Fragment key={v}>
          <span style={{ position: 'absolute', left: `${v}%`, top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,.075)' }} />
          <span style={{ position: 'absolute', top: `${v}%`, left: 0, right: 0, borderTop: '1px solid rgba(255,255,255,.075)' }} />
          <span style={{ position: 'absolute', left: `${v}%`, top: 4, transform: v === 0 ? 'none' : v === 100 ? 'translateX(-100%)' : 'translateX(-50%)', fontSize: 8, color: 'rgba(255,255,255,.48)', fontFamily: 'var(--font-mono)' }}>X{v}</span>
          <span style={{ position: 'absolute', left: 4, top: `${v}%`, transform: v === 0 ? 'none' : v === 100 ? 'translateY(-100%)' : 'translateY(-50%)', fontSize: 8, color: 'rgba(255,255,255,.48)', fontFamily: 'var(--font-mono)' }}>Y{v}</span>
        </React.Fragment>
      ))}
    </div>
  )
}

function MapCanvas({ regionKey, location, onSetLocation }) {
  const [extIdx, setExtIdx] = useState(0)
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef(null)
  const pressRef = useRef(null)

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
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pressRef.current = { x: e.clientX, y: e.clientY, moved: false }
    if (zoom > 1) {
      dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    }
  }

  function onPointerMove(e) {
    const press = pressRef.current
    if (press && (Math.abs(e.clientX - press.x) > 5 || Math.abs(e.clientY - press.y) > 5)) press.moved = true
    const drag = dragRef.current
    if (!drag) return
    setPan({ x: drag.panX + e.clientX - drag.x, y: drag.panY + e.clientY - drag.y })
  }

  function pointerToCoords(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rawX = ((e.clientX - rect.left - centerX - pan.x) / zoom) + centerX
    const rawY = ((e.clientY - rect.top - centerY - pan.y) / zoom) + centerY
    const x = Math.max(0, Math.min(100, Math.round((rawX / rect.width) * 1000) / 10))
    const y = Math.max(0, Math.min(100, Math.round((rawY / rect.height) * 1000) / 10))
    return { x, y }
  }

  function stopDrag(e) {
    const wasClick = pressRef.current && !pressRef.current.moved
    dragRef.current = null
    pressRef.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    if (!wasClick || !onSetLocation) return
    const coords = pointerToCoords(e)
    const nearest = findNearestMapArea(regionKey, coords.x, coords.y)
    onSetLocation(normalizeMapLocation({
      regionKey,
      areaKey: nearest?.areaKey ?? location?.areaKey ?? null,
      x: coords.x,
      y: coords.y,
      source: 'map-click',
    }))
  }

  const pin = location && location.regionKey === regionKey ? getLocationCoords(location) : null

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 9.5, color: 'var(--amber)', fontWeight: 800, letterSpacing: '.13em' }}>GÓC NHÌN + TRỤC X/Y</div>
          <div style={{ color: 'var(--text-dim)', fontSize: 10.5, marginTop: 2 }}>
            Bấm để đặt pin · lăn chuột để zoom · kéo ảnh khi đã phóng to
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconButton title="Thu nhỏ" disabled={zoom <= MIN_ZOOM} onClick={() => updateZoom(zoom - ZOOM_STEP)}>−</IconButton>
          <button type="button" className="btn" onClick={resetView} title="Đặt lại góc nhìn" style={{ minWidth: 66, height: 32, padding: '0 9px', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
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
        onPointerCancel={() => { dragRef.current = null; pressRef.current = null }}
        onDoubleClick={() => updateZoom(zoom >= 2 ? 1 : 2)}
        style={{
          position: 'relative', overflow: 'hidden', height: 'clamp(300px, 54vh, 560px)',
          border: '1px solid var(--line)', borderRadius: 13,
          background: 'radial-gradient(circle at 30% 20%, rgba(120,200,170,.10), transparent 34%), radial-gradient(circle at 75% 70%, rgba(232,184,74,.08), transparent 36%), var(--bg-deep)',
          cursor: zoom > 1 ? (dragRef.current ? 'grabbing' : 'grab') : 'crosshair',
          touchAction: 'none', userSelect: 'none',
        }}
      >
        {!failed ? (
          <div style={{ position: 'absolute', inset: 0, transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`, transformOrigin: 'center center', transition: dragRef.current ? 'none' : 'transform .18s ease', willChange: 'transform' }}>
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
            <CoordinateGrid />
            {pin && (
              <>
                <span style={{ position: 'absolute', left: `${pin[0]}%`, top: 0, bottom: 0, borderLeft: '1px dashed rgba(233,91,85,.7)', pointerEvents: 'none' }} />
                <span style={{ position: 'absolute', top: `${pin[1]}%`, left: 0, right: 0, borderTop: '1px dashed rgba(233,91,85,.7)', pointerEvents: 'none' }} />
                <div
                  title={`Vị trí của bạn — X ${pin[0]}, Y ${pin[1]}`}
                  style={{
                    position: 'absolute', left: `${pin[0]}%`, top: `${pin[1]}%`, width: 16, height: 16, borderRadius: '50%',
                    background: '#e95b55', border: '3px solid #fff', transform: 'translate(-50%, -50%)',
                    boxShadow: '0 0 0 7px rgba(233,91,85,.20), 0 3px 12px rgba(0,0,0,.45)', pointerEvents: 'none',
                  }}
                >
                  <span style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '1px solid rgba(233,91,85,.65)', animation: 'map-pin-ring 1.6s ease-out infinite' }} />
                  <span style={{ position: 'absolute', left: 14, top: -18, whiteSpace: 'nowrap', padding: '3px 6px', borderRadius: 6, background: 'rgba(4,10,14,.84)', color: '#fff', fontSize: 8.5, fontFamily: 'var(--font-mono)', border: '1px solid rgba(255,255,255,.12)' }}>
                    X {pin[0]} · Y {pin[1]}
                  </span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 28, textAlign: 'center' }}>
            <div style={{ maxWidth: 420 }}>
              <div style={{ fontSize: 34, marginBottom: 9 }}>🗺</div>
              <div style={{ color: 'var(--text-hi)', fontWeight: 750, fontSize: 14 }}>Chưa có ảnh bản đồ vùng này</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.7, marginTop: 6 }}>
                Bỏ file <code>{regionKey}.png</code>, <code>.jpg</code> hoặc <code>.webp</code> vào <code>public/maps/</code>.
                Danh sách địa điểm và toạ độ vẫn hoạt động bình thường.
              </div>
            </div>
          </div>
        )}
        <div style={{ position: 'absolute', left: 10, bottom: 10, padding: '6px 9px', borderRadius: 8, background: 'rgba(4,10,14,.76)', backdropFilter: 'blur(7px)', border: '1px solid rgba(255,255,255,.08)', color: 'var(--text-dim)', fontSize: 9.5, pointerEvents: 'none' }}>
          Trục: X trái→phải · Y trên→dưới · nhấp đúp 100%/200%
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
        <div style={{ color: 'var(--text-dim)', fontSize: 10.5, marginTop: 2 }}>Chọn khu để đưa pin về toạ độ đại diện</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 'clamp(300px, 54vh, 560px)', overflowY: 'auto', paddingRight: 4 }}>
        {region.areas.map((area, index) => {
          const isHere = location?.regionKey === region.key && location?.areaKey === area.key
          const coords = getMapPin(region.key, area.key)
          return (
            <button
              key={area.key}
              type="button"
              onClick={() => onSetLocation(normalizeMapLocation({ regionKey: region.key, areaKey: area.key, x: coords?.[0], y: coords?.[1], source: 'area-list' }))}
              title={`Wild Lv${area.level[0]}-${area.level[1]}${coords ? ` · X${coords[0]} Y${coords[1]}` : ''}`}
              style={{
                display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) auto', alignItems: 'center', gap: 9,
                width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${isHere ? 'var(--mint)' : 'var(--line)'}`,
                background: isHere ? 'rgba(120,200,170,.08)' : 'var(--bg-deep)', color: 'inherit',
              }}
            >
              <span style={{ width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center', background: isHere ? 'var(--mint)' : 'rgba(255,255,255,.035)', color: isHere ? '#07110e' : 'var(--text-dim)', fontSize: 10, fontWeight: 800 }}>
                {isHere ? '●' : String(index + 1).padStart(2, '0')}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', color: isHere ? 'var(--mint)' : 'var(--text-hi)', fontSize: 11.5, fontWeight: isHere ? 750 : 600 }}>{area.name}</span>
                <span style={{ display: 'block', color: 'var(--text-dim)', fontSize: 9.5, marginTop: 2 }}>
                  Wild Lv{area.level[0]}–{area.level[1]}{coords ? ` · X${coords[0]} Y${coords[1]}` : ''}
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

function CoordinateEditor({ location, regionKey, onSetLocation }) {
  const coords = location?.regionKey === regionKey ? getLocationCoords(location) : null
  const [x, setX] = useState(coords?.[0] ?? 50)
  const [y, setY] = useState(coords?.[1] ?? 50)

  useEffect(() => {
    const next = location?.regionKey === regionKey ? getLocationCoords(location) : null
    if (next) { setX(next[0]); setY(next[1]) }
  }, [location?.regionKey, location?.areaKey, location?.x, location?.y, regionKey])

  function apply() {
    const nearest = findNearestMapArea(regionKey, x, y)
    onSetLocation(normalizeMapLocation({ regionKey, areaKey: nearest?.areaKey ?? null, x, y, source: 'xy-editor' }))
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>X</label>
      <input type="number" min="0" max="100" step="0.1" value={x} onChange={(e) => setX(e.target.value)} style={{ width: 70, height: 32, fontFamily: 'var(--font-mono)', fontSize: 11 }} />
      <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Y</label>
      <input type="number" min="0" max="100" step="0.1" value={y} onChange={(e) => setY(e.target.value)} style={{ width: 70, height: 32, fontFamily: 'var(--font-mono)', fontSize: 11 }} />
      <button type="button" className="btn" onClick={apply} style={{ height: 32, padding: '0 10px', fontSize: 10.5 }}>Đặt toạ độ</button>
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
  const currentCoords = getLocationCoords(location)

  return (
    <div style={{ minWidth: 0 }}>
      <style>{`
        @keyframes map-pin-ring { 0% { opacity: .9; transform: scale(.65); } 75%,100% { opacity: 0; transform: scale(1.75); } }
        .region-map-layout { display:grid; grid-template-columns:minmax(0,1fr) 250px; gap:14px; }
        @media (max-width: 760px) { .region-map-layout { grid-template-columns:1fr; } }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 12px', marginBottom: 12, borderRadius: 11, border: '1px solid var(--line)', background: 'linear-gradient(135deg, rgba(120,200,170,.065), rgba(232,184,74,.035))' }}>
        <div>
          <div style={{ fontSize: 9.5, color: 'var(--text-dim)', letterSpacing: '.11em', fontWeight: 750 }}>VỊ TRÍ HIỆN TẠI</div>
          {currentArea ? (
            <div style={{ marginTop: 3 }}>
              <strong style={{ color: 'var(--mint)', fontSize: 13 }}>{currentArea.name}</strong>
              <span style={{ color: 'var(--text-mid)', fontSize: 11 }}> · {currentRegion?.name} · wild Lv{currentArea.level[0]}–{currentArea.level[1]}</span>
              {currentCoords && <span style={{ color: 'var(--amber)', fontSize: 10.5, fontFamily: 'var(--font-mono)' }}> · X{currentCoords[0]} Y{currentCoords[1]}</span>}
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
        <CoordinateEditor location={location} regionKey={region.key} onSetLocation={onSetLocation} />
      </div>

      <div className="region-map-layout">
        <MapCanvas regionKey={region.key} location={location} onSetLocation={onSetLocation} />
        <AreaList region={region} location={location} onSetLocation={onSetLocation} />
      </div>

      <div style={{ marginTop: 11, color: 'var(--text-dim)', fontSize: 10.5, lineHeight: 1.65 }}>
        App vẫn tự dò địa danh trong chính văn. Toạ độ X/Y giúp giữ vị trí cụ thể bên trong cùng một khu; bấm bản đồ hoặc nhập số để sửa khi AI khai thiếu.
      </div>
    </div>
  )
}
