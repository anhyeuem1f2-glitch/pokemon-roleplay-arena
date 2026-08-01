import React, { useMemo, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { listPokedexRecords, pokedexProgress } from '../data/pokedexProgress.js'
import { getArea, getRegion } from '../data/regions.js'
import MonAvatar from './MonAvatar.jsx'
import TypeBadge from './TypeBadge.jsx'

const PAGE_SIZE = 24

function firstSeenLabel(record) {
  const location = record?.firstSeen?.location
  const date = record?.firstSeen?.date
  const region = location ? getRegion(location.regionKey) : null
  const area = location ? getArea(location.regionKey, location.areaKey) : null
  const where = area?.name ?? region?.name ?? ''
  const when = date ? `${date.part ? `${date.part} · ` : ''}${date.day}/${date.month}/${date.year}` : ''
  return [where, when].filter(Boolean).join(' · ') || 'Dữ liệu từ save cũ'
}

export default function PokedexModal({ onClose }) {
  const { pokedexRecords, pokedexSpecies, pokedexStatus, pokedexError } = useGame()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const progress = useMemo(
    () => pokedexProgress(pokedexRecords, pokedexSpecies),
    [pokedexRecords, pokedexSpecies],
  )
  const records = useMemo(() => {
    const query = search.trim().toLowerCase()
    return listPokedexRecords(pokedexRecords).filter((record) => {
      if (filter === 'caught' && !record.caught) return false
      if (filter === 'seen' && record.caught) return false
      if (!query) return true
      return `${record.name} ${record.species} ${record.num ?? ''}`.toLowerCase().includes(query)
    })
  }, [filter, pokedexRecords, search])
  const pageCount = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const visible = records.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  function chooseFilter(next) {
    setFilter(next)
    setPage(0)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 95, padding: 16,
        display: 'grid', placeItems: 'center', background: 'rgba(2,7,11,.82)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="panel"
        onClick={(event) => event.stopPropagation()}
        style={{ width: 'min(920px, 97vw)', maxHeight: '94vh', overflowY: 'auto', padding: 0 }}
      >
        <div style={{ position: 'sticky', top: 0, zIndex: 3, padding: '14px 16px', borderBottom: '1px solid var(--line)', background: 'var(--bg-panel)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ color: 'var(--amber)', fontSize: 9.5, fontWeight: 800, letterSpacing: '.14em' }}>NHẬT KÝ KHÁM PHÁ</div>
              <span className="page-title" style={{ display: 'block', margin: '2px 0 0' }}>📘 Pokédex hành trình</span>
            </div>
            <button className="btn" onClick={onClose}>✕ Đóng</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginTop: 12 }}>
            {[
              ['ĐÃ THẤY', progress.seen, 'var(--amber)'],
              ['ĐÃ BẮT', progress.caught, 'var(--mint)'],
              ['TỔNG LOÀI', progress.total ?? '…', 'var(--text-hi)'],
            ].map(([label, value, color]) => (
              <div key={label} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '7px 9px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '.08em' }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(0) }}
              placeholder="Tìm tên hoặc số Pokédex…"
              style={{ flex: '1 1 210px' }}
            />
            {[
              ['all', 'Tất cả'], ['caught', 'Đã bắt'], ['seen', 'Chỉ đã thấy'],
            ].map(([key, label]) => (
              <button key={key} className={`btn${filter === key ? ' btn--primary' : ''}`} onClick={() => chooseFilter(key)}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {pokedexStatus === 'loading' && (
            <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 10 }}>Đang tải dữ liệu National Pokédex; tiến độ đã ghi vẫn được giữ nguyên.</div>
          )}
          {pokedexStatus === 'error' && (
            <div style={{ color: 'var(--coral)', fontSize: 11, marginBottom: 10 }}>
              Không tải được National Pokédex ({pokedexError || 'lỗi mạng'}). Game đang dùng dữ liệu Gen 1 dự phòng; Pokémon/vùng đời sau sẽ hoạt động đầy đủ khi tải lại thành công.
            </div>
          )}
          {!visible.length ? (
            <div style={{ padding: '34px 10px', textAlign: 'center', color: 'var(--text-dim)', lineHeight: 1.7 }}>
              Chưa có bản ghi phù hợp.<br />Hãy gặp Pokémon trong chính văn, Safari hoặc chiến đấu để Pokédex tự cập nhật.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 9 }}>
              {visible.map((record) => (
                <div key={record.key} style={{ display: 'flex', gap: 10, border: '1px solid var(--line)', borderRadius: 10, padding: 9, background: 'var(--bg-deep)' }}>
                  <div style={{ width: 70, minWidth: 70, height: 70, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                    <MonAvatar mon={record} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 7 }}>
                      <strong style={{ color: record.caught ? 'var(--mint)' : 'var(--text-hi)' }}>{record.name}</strong>
                      <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{record.num ? `#${String(record.num).padStart(4, '0')}` : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4 }}>
                      {(record.types ?? []).map((type) => <TypeBadge key={type} type={type} />)}
                    </div>
                    <div style={{ fontSize: 10.5, marginTop: 6, color: record.caught ? 'var(--mint)' : 'var(--amber)' }}>
                      {record.caught ? '● Đã bắt' : '◐ Đã thấy'}
                    </div>
                    <div style={{ fontSize: 9.5, marginTop: 3, color: 'var(--text-dim)', lineHeight: 1.4 }}>{firstSeenLabel(record)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pageCount > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 9, marginTop: 14 }}>
              <button className="btn" disabled={safePage <= 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>← Trước</button>
              <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{safePage + 1}/{pageCount}</span>
              <button className="btn" disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>Sau →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
