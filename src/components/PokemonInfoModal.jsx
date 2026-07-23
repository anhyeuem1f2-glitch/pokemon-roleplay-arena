import React from 'react'
import MonAvatar from './MonAvatar.jsx'
import TypeBadge from './TypeBadge.jsx'
import HealthBar from './HealthBar.jsx'
import { describeNature } from '../data/pokemonSpecies.js'

const STAT_LABELS = { atk: 'Tấn công', def: 'Phòng thủ', spa: 'TC đặc biệt', spd: 'PT đặc biệt', spe: 'Tốc độ' }

// Modal xem chi tiết 1 Pokémon trong đội hình (bấm vào ô trong HUD).
export default function PokemonInfoModal({ mon, onClose, hungerMon = null }) {
  if (!mon) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel"
        style={{ width: 'min(440px, 92vw)', maxHeight: '86vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17 }}>
              {mon.name}{' '}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-mid)' }}>
                Lv.{mon.level}
              </span>
            </h3>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {mon.types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
          </div>
          <button className="btn" style={{ fontSize: 11, padding: '3px 10px' }} onClick={onClose}>
            Đóng
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
          <MonAvatar mon={mon} side="player" />
        </div>

        <HealthBar hp={mon.hp} maxHp={mon.maxHp} bars={mon.bossBars ?? 1} />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mid)', marginTop: 4 }}>
          HP {mon.hp}/{mon.maxHp}
          {mon.status ? ` · trạng thái: ${mon.status}` : ''}
          {mon.nature ? ` · ${describeNature(mon.nature)}` : ''}
        </div>

        {/* Độ no (đợt 48): chuyển từ HUD chính vào đây — chỉ hiện với con
            ĐANG RA TRẬN (độ no theo dõi theo con active). */}
        {hungerMon !== null && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-mid)' }}>
              <span>Độ no</span>
              <span style={{ color: hungerMon < 30 ? '#d94f4f' : 'var(--text-dim)' }}>
                {hungerMon}/100{hungerMon < 30 ? ' — đói!' : ''}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-deep)', border: '1px solid var(--line)', overflow: 'hidden' }}>
              <div style={{ width: `${hungerMon}%`, height: '100%', background: hungerMon < 30 ? '#d94f4f' : hungerMon < 60 ? '#e8b84a' : 'var(--mint)' }} />
            </div>
          </div>
        )}

        {mon.stats && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-mid)', marginBottom: 6 }}>
              CHỈ SỐ (đã scale theo level, công thức game gốc)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {Object.entries(STAT_LABELS).map(([k, label]) => (
                <div key={k} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '6px 4px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9.5, color: 'var(--text-dim)' }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{mon.stats[k] ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* IV / EV thật (đợt 48) — giống game gốc: IV 0-31 cố định lúc sinh,
            EV 0-252/chỉ số (tổng ≤510) nhận khi hạ đối thủ. */}
        {mon.ivs && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-mid)', marginBottom: 6 }}>
              IV / EV (cá thể){mon.evGainNote ? ` · vừa nhận ${mon.evGainNote}` : ''}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, fontFamily: 'var(--font-mono)' }}>
              {['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map((k) => (
                <div key={k} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '4px 2px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase' }}>{k}</div>
                  <div style={{ fontSize: 11 }}>{mon.ivs?.[k] ?? '—'}</div>
                  <div style={{ fontSize: 9.5, color: (mon.evs?.[k] ?? 0) > 0 ? 'var(--amber)' : 'var(--text-dim)' }}>
                    +{mon.evs?.[k] ?? 0}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--text-dim)', marginTop: 4 }}>
              hàng trên: IV (bẩm sinh) · hàng dưới: EV (rèn luyện, nhận khi hạ đối thủ)
            </div>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-mid)', marginBottom: 6 }}>CHIÊU THỨC</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {mon.moves.map((mv) => (
              <div
                key={mv.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 12.5 }}>{mv.name}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {mv.secondary?.status && (
                    <span style={{ fontSize: 9.5, color: 'var(--amber)' }}>
                      {mv.secondary.chance ?? 100}% {mv.secondary.status}
                    </span>
                  )}
                  <TypeBadge type={mv.type} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mid)', width: 30, textAlign: 'right' }}>
                    {mv.power > 0 ? mv.power : '—'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
