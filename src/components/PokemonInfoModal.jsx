import React, { useMemo, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import MonAvatar from './MonAvatar.jsx'
import TypeBadge from './TypeBadge.jsx'
import { describeNature, expProgress, isSameMon, MAX_LEVEL, sortMovesForDisplay } from '../data/pokemonSpecies.js'
import { abilityLabel } from '../data/pokemonAbilities.js'
import { describeFriendship, friendshipTier, normalizeFriendship } from '../data/pokemonFriendship.js'
import { heldItemDescription, heldItemLabel } from '../data/pokemonHeldItems.js'
import { genderLabel, genderRatioLabel, genderSymbol } from '../data/pokemonGender.js'

const STAT_LABELS = {
  hp: 'HP', atk: 'Tấn công', def: 'Phòng thủ', spa: 'TC đặc biệt', spd: 'PT đặc biệt', spe: 'Tốc độ',
}

const STAT_SHORT = { hp: 'HP', atk: 'ATK', def: 'DEF', spa: 'SPA', spd: 'SPD', spe: 'SPE' }

function pct(value, max) {
  return Math.max(0, Math.min(100, (Number(value) / Math.max(1, Number(max))) * 100))
}

function moveCategory(value) {
  if (value === 'Physical') return 'Vật lý'
  if (value === 'Special') return 'Đặc biệt'
  return 'Trạng thái'
}

function moveAccuracy(value) {
  if (value === true || value === undefined || value === null) return '—'
  return `${value}%`
}

function PartyEntry({ mon, selected, onClick }) {
  return (
    <button className={`summary-party__entry ${selected ? 'is-selected' : ''}`} onClick={onClick} type="button">
      <span className="summary-party__sprite"><MonAvatar mon={mon} side="enemy" /></span>
      <span className="summary-party__copy">
        <strong>{mon.name} {mon.shiny && <span title="Shiny" aria-label="Shiny">✨</span>} <span aria-label={genderLabel(mon.gender)}>{genderSymbol(mon.gender)}</span></strong>
        <span>Lv.{mon.level}{mon.status ? ` · ${mon.status}` : ''}</span>
        <span className="summary-party__hp"><i style={{ width: `${pct(mon.hp, mon.maxHp)}%` }} /></span>
        <small>{mon.hp}/{mon.maxHp}</small>
      </span>
    </button>
  )
}

function MoveRow({ move, index, onToggleStar }) {
  return (
    <div className="summary-move">
      <button
        className="summary-move__number"
        type="button"
        aria-label={move.starred ? `Bỏ ghim ${move.name}` : `Ghim ${move.name}`}
        title={move.starred ? 'Bỏ dấu sao' : 'Đánh dấu sao để đưa chiêu lên đầu'}
        onClick={() => onToggleStar?.(!move.starred)}
        style={{ cursor: 'pointer', color: move.starred ? '#e5a91a' : undefined, border: 0, background: 'transparent', padding: 0 }}
      >{move.starred ? '★' : '☆'}</button>
      <div className="summary-move__main">
        <div className="summary-move__name">{move.name}</div>
        <div className="summary-move__meta">
          <TypeBadge type={move.type ?? 'normal'} />
          <span>{moveCategory(move.category)}</span>
          <span>Lực {move.power > 0 ? move.power : '—'}</span>
          <span>C.Xác {moveAccuracy(move.accuracy)}</span>
          <span>PP {move.pp ?? '—'}</span>
        </div>
        {move.description && <p>{move.description}</p>}
      </div>
    </div>
  )
}

export default function PokemonInfoModal({ mon, party = [], activeMon = null, hunger = null, onSelect, onClose }) {
  const { setPokemonMoveStar } = useGame()
  const [tab, setTab] = useState('summary')
  const current = useMemo(() => {
    if (!mon) return null
    return party.find((candidate) => isSameMon(candidate, mon)) ?? mon
  }, [mon, party])
  if (!current) return null

  const bonded = normalizeFriendship(current)
  const friendship = friendshipTier(bonded.friendship)
  const exp = expProgress(current)
  const maxed = (current.level ?? 1) >= MAX_LEVEL
  const currentHunger = activeMon && isSameMon(activeMon, current) ? hunger : null
  const maxStat = Math.max(1, ...Object.values(current.stats ?? {}).map(Number))

  return (
    <div className="pokemon-summary" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="pokemon-summary-title">
      <div className="pokemon-summary__window" onClick={(event) => event.stopPropagation()}>
        <aside className="summary-party">
          <div className="summary-party__title">ĐỘI HÌNH</div>
          {(party.length ? party : [current]).map((entry) => (
            <PartyEntry
              key={entry.uid ?? `${entry.name}-${entry.level}`}
              mon={entry}
              selected={isSameMon(entry, current)}
              onClick={() => {
                onSelect?.(entry)
                setTab('summary')
              }}
            />
          ))}
        </aside>

        <section className="pokemon-summary__content">
          <header className="pokemon-summary__header">
            <div>
              <div className="pokemon-summary__eyebrow">POKÉMON SUMMARY</div>
              <h2 id="pokemon-summary-title">{current.name} {current.shiny && <em className="summary-shiny-badge" title="Pokémon Shiny">✨ SHINY</em>} <b title={genderLabel(current.gender)}>{genderSymbol(current.gender)}</b> <span>Lv.{current.level}</span></h2>
              <div className="pokemon-summary__types">{(current.types ?? []).map((type) => <TypeBadge key={type} type={type} />)}</div>
            </div>
            <button className="pokemon-summary__close" onClick={onClose} type="button">Đóng</button>
          </header>

          <nav className="pokemon-summary__tabs" aria-label="Trang thông tin Pokémon">
            {[['summary', 'Thông tin'], ['stats', 'Chỉ số'], ['moves', `Chiêu thức (${current.moves?.length ?? 0})`]].map(([key, label]) => (
              <button key={key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)} type="button">{label}</button>
            ))}
          </nav>

          {tab === 'summary' && (
            <div className="summary-page summary-page--overview">
              <div className="summary-hero">
                <div className="summary-hero__sprite"><MonAvatar mon={current} side="enemy" /></div>
                <div className="summary-hero__bars">
                  <div className="summary-bar__label"><span>HP</span><strong>{current.hp}/{current.maxHp}</strong></div>
                  <div className="summary-bar summary-bar--hp"><i style={{ width: `${pct(current.hp, current.maxHp)}%` }} /></div>
                  <div className="summary-bar__label"><span>Kinh nghiệm</span><strong>{maxed ? 'MAX' : `${exp.current}/${exp.need}`}</strong></div>
                  <div className="summary-bar summary-bar--exp"><i style={{ width: `${exp.ratio * 100}%` }} /></div>
                  {currentHunger !== null && currentHunger !== undefined && (
                    <>
                      <div className="summary-bar__label"><span>Độ no</span><strong>{currentHunger}/100</strong></div>
                      <div className="summary-bar summary-bar--hunger"><i style={{ width: `${currentHunger}%` }} /></div>
                    </>
                  )}
                </div>
              </div>

              <div className="summary-info-grid">
                <div className="summary-info-card">
                  <span>MÃ CÁ THỂ</span><strong>{current.pokemonId ?? current.uid ?? '—'}</strong><small>{current.shiny ? '✨ Shiny' : 'Màu thường'} · {current.sizeClass ?? 'average'}</small>
                </div>
                <div className="summary-info-card">
                  <span>GIỚI TÍNH</span><strong>{genderSymbol(current.gender)} {genderLabel(current.gender)}</strong><small>{genderRatioLabel(current)}</small>
                </div>
                <div className="summary-info-card">
                  <span>TÍNH CÁCH</span><strong>{describeNature(current.nature)}</strong>
                </div>
                <div className="summary-info-card">
                  <span>ABILITY</span><strong>{abilityLabel(current)}</strong><small>{current.abilityHidden ? 'Ability ẩn' : 'Ability cá thể'}</small>
                </div>
                <div className="summary-info-card">
                  <span>THÂN MẬT</span><strong>{describeFriendship(bonded)}</strong><small>{friendship.note}</small>
                </div>
                <div className="summary-info-card" title={heldItemDescription(current.heldItem)}>
                  <span>TRANG BỊ</span><strong>{heldItemLabel(current)}</strong><small>{current.heldItem ? heldItemDescription(current.heldItem) : 'Không cầm vật phẩm'}</small>
                </div>
                <div className="summary-info-card">
                  <span>TRẠNG THÁI</span><strong>{current.status || 'Bình thường'}</strong><small>{current.hp <= 0 ? 'Đã gục' : 'Có thể chiến đấu'}</small>
                </div>
                <div className="summary-info-card">
                  <span>EXP TỚI CẤP SAU</span><strong>{maxed ? 'Đã đạt Lv.100' : `${Math.max(0, exp.need - exp.current)} EXP`}</strong><small>{maxed ? 'Không thể tăng cấp thêm' : `Mục tiêu Lv.${current.level + 1}`}</small>
                </div>
                <div className="summary-info-card">
                  <span>RIBBON / MARK</span><strong>{(current.ribbons?.length ?? 0)} / {(current.marks?.length ?? 0)}</strong><small>{[...(current.ribbons ?? []), ...(current.marks ?? [])].join(', ') || 'Chưa có danh hiệu cá thể'}</small>
                </div>
              </div>
            </div>
          )}

          {tab === 'stats' && (
            <div className="summary-page summary-page--stats">
              <div className="summary-stat-list">
                {Object.entries(STAT_LABELS).map(([key, label]) => {
                  const value = key === 'hp' ? current.maxHp : current.stats?.[key]
                  return (
                    <div className="summary-stat" key={key}>
                      <span>{label}</span>
                      <strong>{value ?? '—'}</strong>
                      <div><i style={{ width: `${pct(value ?? 0, maxStat)}%` }} /></div>
                    </div>
                  )
                })}
              </div>

              <div className="summary-build">
                <div className="summary-build__title">IV / EV CÁ THỂ</div>
                <div className="summary-build__grid">
                  {['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map((key) => (
                    <div key={key}>
                      <span>{STAT_SHORT[key]}</span>
                      <strong>{current.ivs?.[key] ?? '—'}</strong>
                      <small>EV +{current.evs?.[key] ?? 0}</small>
                    </div>
                  ))}
                </div>
                <p>IV là chỉ số bẩm sinh 0–31. EV nhận qua rèn luyện, tối đa 252 mỗi chỉ số và 510 tổng.</p>
              </div>
            </div>
          )}

          {tab === 'moves' && (
            <div className="summary-page summary-page--moves">
              <div className="summary-moves__head">
                <div><strong>Bộ chiêu hiện tại</strong><span>Không giới hạn số chiêu. Bấm ☆ để ghim chiêu thường dùng lên đầu.</span></div>
                {current.pendingMoveLearns?.length > 0 && <b>{current.pendingMoveLearns.length} chiêu đang chờ học</b>}
              </div>
              <div className="summary-moves__list">
                {sortMovesForDisplay(current.moves).map((move, index) => (
                  <MoveRow
                    key={`${move.id ?? move.name}-${index}`}
                    move={move}
                    index={index}
                    onToggleStar={(starred) => setPokemonMoveStar(current, move.id ?? move.name, starred)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
