import React from 'react'
import { useGame } from '../context/GameContext.jsx'
import { isSameMon, resolvePendingMoveLearn } from '../data/pokemonSpecies.js'
import MonAvatar from './MonAvatar.jsx'
import TypeBadge from './TypeBadge.jsx'

function accuracyLabel(value) {
  if (value === true || value === undefined || value === null) return '—'
  return `${value}%`
}

function categoryLabel(value) {
  if (value === 'Physical') return 'Vật lý'
  if (value === 'Special') return 'Đặc biệt'
  return 'Trạng thái'
}

function MoveFacts({ move, compact = false }) {
  return (
    <div className={`move-learn__facts ${compact ? 'move-learn__facts--compact' : ''}`}>
      <TypeBadge type={move.type ?? 'normal'} />
      <span>{categoryLabel(move.category)}</span>
      <span>Lực {move.power > 0 ? move.power : '—'}</span>
      <span>C.Xác {accuracyLabel(move.accuracy)}</span>
      <span>PP {move.pp ?? '—'}</span>
    </div>
  )
}

export default function MoveLearnModal() {
  const { party, setParty, playerMon, setPlayerMon } = useGame()
  const partyTarget = (party ?? []).find((mon) => mon?.pendingMoveLearns?.length)
  const target = partyTarget ?? (playerMon?.pendingMoveLearns?.length ? playerMon : null)
  if (!target) return null

  const candidate = target.pendingMoveLearns[0]
  const queueCount = target.pendingMoveLearns.length

  function commit(options) {
    const updated = resolvePendingMoveLearn(target, options)
    setParty((cur) => (cur ?? []).map((mon) => (isSameMon(mon, target) ? updated : mon)))
    if (playerMon && isSameMon(playerMon, target)) setPlayerMon(updated)
  }

  return (
    <div className="move-learn" role="dialog" aria-modal="true" aria-labelledby="move-learn-title">
      <div className="move-learn__window">
        <header className="move-learn__header">
          <div>
            <div className="move-learn__eyebrow">HỌC CHIÊU MỚI</div>
            <h2 id="move-learn-title">{target.name} muốn học {candidate.name}!</h2>
          </div>
          <div className="move-learn__queue">Còn {queueCount} chiêu</div>
        </header>

        <div className="move-learn__body">
          <section className="move-learn__mon-card">
            <div className="move-learn__sprite"><MonAvatar mon={target} side="enemy" /></div>
            <div className="move-learn__mon-name">{target.name}</div>
            <div className="move-learn__level">Lv.{target.level}</div>
            <div className="move-learn__hp-label">HP {target.hp}/{target.maxHp}</div>
            <div className="move-learn__hp-track">
              <div style={{ width: `${Math.max(0, Math.min(100, ((target.hp ?? 0) / Math.max(1, target.maxHp ?? 1)) * 100))}%` }} />
            </div>
            <p>Pokémon có thể giữ nhiều chiêu; học chiêu mới không làm mất chiêu cũ.</p>
          </section>

          <section className="move-learn__moves-panel">
            <div className="move-learn__new-move">
              <div className="move-learn__new-label">CHIÊU MỚI · Lv.{candidate.learnedAtLevel ?? target.level}</div>
              <div className="move-learn__new-name">{candidate.name}</div>
              <MoveFacts move={candidate} />
              <p>{candidate.description || 'Chiêu thức mới được học khi Pokémon đạt cấp độ này.'}</p>
            </div>

            <div className="move-learn__list-title">CHIÊU ĐANG BIẾT</div>
            <div className="move-learn__move-list">
              {(target.moves ?? []).map((move, index) => (
                <button
                  key={`${move.name}-${index}`}
                  type="button"
                  className="move-learn__move-row"
                  disabled
                  title={`${target.name} vẫn giữ ${move.name}`}
                >
                  <span className="move-learn__slot">{index + 1}</span>
                  <span className="move-learn__move-copy">
                    <strong>{move.name}</strong>
                    <MoveFacts move={move} compact />
                  </span>
                  <span className="move-learn__forget">GIỮ</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <footer className="move-learn__actions">
          <button className="move-learn__primary" type="button" onClick={() => commit({})}>
            Học {candidate.name}
          </button>
          <button className="move-learn__skip" type="button" onClick={() => commit({ skip: true })}>
            Không học chiêu này
          </button>
        </footer>
      </div>
    </div>
  )
}
