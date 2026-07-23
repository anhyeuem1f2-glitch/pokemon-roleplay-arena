import React, { useState, useEffect } from 'react'
import { REGIONS, getArea } from '../data/regions.js'
import { getMapPin } from '../data/mapPins.js'

// ============ ẢNH BẢN ĐỒ VÙNG THẬT (đợt 30) ============
// Cùng kiến trúc "tự dò file" của hệ nhạc nền (bản quyền artwork Pokémon nên
// app KHÔNG đóng gói sẵn ảnh): bạn bỏ ảnh vào public/maps/ đặt tên theo key
// vùng — kanto.png, johto.png, ... paldea.png (thử lần lượt .png → .jpg →
// .webp). Có ảnh thì hiện bản đồ thật phía trên, thiếu thì chỉ hiện lộ trình
// chữ như cũ, không bao giờ lỗi. Chi tiết: public/maps/README.txt.
const MAP_EXTS = ['png', 'jpg', 'webp']

function mapUrl(regionKey, ext) {
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '')
  return `${base}/maps/${regionKey}.${ext}`
}

function RegionMapImage({ regionKey, location }) {
  const [extIdx, setExtIdx] = useState(0)
  const [failed, setFailed] = useState(false)
  // Đổi vùng → thử lại từ .png.
  useEffect(() => {
    setExtIdx(0)
    setFailed(false)
  }, [regionKey])
  if (failed) {
    return (
      <p style={{ fontSize: 10.5, color: 'var(--text-dim)', margin: '10px 0 0' }}>
        (Chưa có ảnh bản đồ cho vùng này — bỏ file <code>{regionKey}.png</code> vào{' '}
        <code>public/maps/</code> để hiện bản đồ thật. Xem public/maps/README.txt.)
      </p>
    )
  }
  // Chấm đỏ vị trí người chơi (đợt 36): chỉ vẽ khi vùng đang xem đúng là
  // vùng người chơi đứng + khu có toạ độ pin (data/mapPins.js — chỉnh tay
  // % ngay trong file đó nếu lệch so với ảnh bạn vẽ).
  const pin = location && location.regionKey === regionKey ? getMapPin(regionKey, location.areaKey) : null
  return (
    <div style={{ position: 'relative', marginTop: 12 }}>
      <img
        src={mapUrl(regionKey, MAP_EXTS[extIdx])}
        alt={`Bản đồ vùng ${regionKey}`}
        onError={() => {
          // Hết đuôi để thử → coi như vùng này chưa có ảnh.
          if (extIdx < MAP_EXTS.length - 1) setExtIdx(extIdx + 1)
          else setFailed(true)
        }}
        style={{ width: '100%', borderRadius: 8, border: '1px solid var(--line)', display: 'block' }}
      />
      {pin && (
        <>
          <style>{`@keyframes map-pin-pulse { 0% { box-shadow: 0 0 0 0 rgba(230,57,57,0.6); } 70% { box-shadow: 0 0 0 12px rgba(230,57,57,0); } 100% { box-shadow: 0 0 0 0 rgba(230,57,57,0); } }`}</style>
          <div
            title="Vị trí của bạn"
            style={{
              position: 'absolute', left: `${pin[0]}%`, top: `${pin[1]}%`,
              width: 13, height: 13, borderRadius: '50%',
              background: '#e63939', border: '2.5px solid #fff',
              transform: 'translate(-50%, -50%)',
              animation: 'map-pin-pulse 1.6s ease-out infinite',
              pointerEvents: 'none',
            }}
          />
        </>
      )}
    </div>
  )
}

// Bản đồ dạng LỘ TRÌNH cách điệu (không dùng ảnh map thật của game — vừa
// không có nguồn ảnh ổn định để hotlink, vừa dính bản quyền artwork): mỗi vùng
// là 1 chuỗi khu vực nối nhau theo đúng tiến trình game gốc, khu đứng sau =
// level cao hơn. Vị trí người chơi hiện marker ●, bấm vào khu bất kỳ để dời
// tới đó (chỉnh tay khi auto-detect từ chính văn dò sai/thiếu).
export default function RegionMap({ location, onSetLocation, fixedRegion = false }) {
  const [regionKey, setRegionKey] = useState(location?.regionKey ?? 'kanto')
  // fixedRegion (đợt 36): trong truyện chỉ hiện VÙNG ĐANG Ở — đổi vùng theo
  // vị trí người chơi, ẩn dropdown chọn vùng (Dev tester vẫn duyệt cả 9).
  useEffect(() => {
    if (fixedRegion && location?.regionKey) setRegionKey(location.regionKey)
  }, [fixedRegion, location?.regionKey])
  const region = REGIONS.find((r) => r.key === regionKey) ?? REGIONS[0]
  const currentArea = location ? getArea(location.regionKey, location.areaKey) : null

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12.5 }}>
          Vị trí hiện tại:{' '}
          {currentArea ? (
            <strong style={{ color: 'var(--mint)' }}>
              {currentArea.name} ({REGIONS.find((r) => r.key === location.regionKey)?.name}) · wild Lv
              {currentArea.level[0]}-{currentArea.level[1]}
            </strong>
          ) : (
            <span style={{ color: 'var(--text-dim)' }}>chưa xác định (wild Lv8-15 mặc định)</span>
          )}
        </div>
        {fixedRegion ? (
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mint)', padding: '4px 0' }}>
            {region.name} (Gen {region.gen}) — vùng bạn đang ở
          </div>
        ) : (
          <select value={regionKey} onChange={(e) => setRegionKey(e.target.value)} style={{ fontSize: 12 }}>
            {REGIONS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name} (Gen {r.gen})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Ảnh bản đồ thật của vùng (nếu người dùng đã bỏ file vào public/maps/) */}
      <RegionMapImage regionKey={region.key} location={location} />

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 12 }}>
        {region.areas.map((area, i) => {
          const isHere = location?.regionKey === region.key && location?.areaKey === area.key
          return (
            <React.Fragment key={area.key}>
              {i > 0 && <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>→</span>}
              <button
                onClick={() => onSetLocation({ regionKey: region.key, areaKey: area.key })}
                title={`Wild Lv${area.level[0]}-${area.level[1]} — bấm để dời tới đây`}
                style={{
                  fontSize: 11,
                  padding: '4px 9px',
                  borderRadius: 999,
                  border: `1px solid ${isHere ? 'var(--mint)' : 'var(--line)'}`,
                  background: isHere ? 'var(--mint-dim)' : 'var(--bg-deep)',
                  color: isHere ? '#0d1a16' : 'var(--text-mid)',
                  cursor: 'pointer',
                  fontWeight: isHere ? 700 : 400,
                }}
              >
                {isHere ? '● ' : ''}
                {area.name}
                <span style={{ opacity: 0.65, marginLeft: 4 }}>
                  Lv{area.level[0]}-{area.level[1]}
                </span>
              </button>
            </React.Fragment>
          )
        })}
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '10px 0 0' }}>
        Vị trí tự cập nhật khi chính văn nhắc địa danh (VD "cả nhóm tới Cerulean City") — dò sai
        thì bấm chỉnh tay ở trên. Level Pokémon hoang dã khi bấm pokeball sẽ random theo dải của
        khu vực hiện tại.
      </p>
    </div>
  )
}
