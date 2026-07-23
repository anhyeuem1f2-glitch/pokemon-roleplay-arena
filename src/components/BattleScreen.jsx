import React, { useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { getEffectivenessMulti } from '../data/pokemonTypes.js'
import HealthBar from './HealthBar.jsx'
import TypeBadge from './TypeBadge.jsx'

// Sprite placeholder đơn giản: vòng tròn màu + chữ cái đầu tên.
// Thay bằng <img src="..."> khi bạn có sprite thật.
function MonAvatar({ mon, side }) {
  const bg = side === 'player' ? 'var(--mint-dim)' : 'var(--violet)'
  return (
    <div
      style={{
        width: 84,
        height: 84,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontSize: 28,
        color: '#0d1a16',
        border: '2px solid var(--line)',
        flexShrink: 0,
      }}
    >
      {mon.name.charAt(0)}
    </div>
  )
}

function MonPanel({ mon, side }) {
  return (
    <div
      className="panel"
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        background: 'var(--bg-panel-raised)',
      }}
    >
      <MonAvatar mon={mon} side={side} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <strong style={{ fontSize: 15 }}>{mon.name}</strong>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-mid)' }}>
            Lv.{mon.level}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, margin: '6px 0 8px' }}>
          {mon.types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </div>
        <HealthBar hp={mon.hp} maxHp={mon.maxHp} />
      </div>
    </div>
  )
}

// Công thức sát thương RÚT GỌN cho bản demo giao diện.
// TODO (mở rộng sau): thêm stat Atk/Def, STAB, crit, ngẫu nhiên 85-100%,
// trạng thái (burn/paralysis...), item, ability... theo đúng công thức PokeRogue/Pokémon gốc.
function computeDamage(move, attacker, defender) {
  if (move.power <= 0) return 0
  const eff = getEffectivenessMulti(move.type, defender.types)
  const stab = attacker.types.includes(move.type) ? 1.5 : 1
  const base = move.power * stab * eff
  return Math.max(1, Math.round(base))
}

function effLabel(mult) {
  if (mult > 1) return { text: 'Hiệu quả tốt!', tone: 'ok' }
  if (mult < 1 && mult > 0) return { text: 'Hiệu quả không tốt...', tone: 'mid' }
  if (mult === 0) return { text: 'Không có tác dụng.', tone: 'mid' }
  return null
}

export default function BattleScreen() {
  const { playerMon, setPlayerMon, enemyMon, setEnemyMon, battleLog, setBattleLog, resetBattle } =
    useGame()
  const [busy, setBusy] = useState(false)

  const battleOver = playerMon.hp <= 0 || enemyMon.hp <= 0

  function pushLog(line) {
    setBattleLog((log) => [...log, line])
  }

  async function handleMove(move) {
    if (busy || battleOver) return
    setBusy(true)

    // --- Đòn của người chơi ---
    const dmgToEnemy = computeDamage(move, playerMon, enemyMon)
    const effMult = getEffectivenessMulti(move.type, enemyMon.types)
    const newEnemyHp = Math.max(0, enemyMon.hp - dmgToEnemy)
    setEnemyMon((m) => ({ ...m, hp: newEnemyHp }))

    if (move.power <= 0) {
      pushLog(`${playerMon.name} dùng ${move.name}.`)
    } else {
      pushLog(`${playerMon.name} dùng ${move.name}! Gây ${dmgToEnemy} sát thương.`)
      const label = effLabel(effMult)
      if (label) pushLog(label.text)
    }

    if (newEnemyHp <= 0) {
      pushLog(`${enemyMon.name} đã gục ngã! Bạn thắng!`)
      setBusy(false)
      return
    }

    // --- Đòn phản công đơn giản của đối thủ (chọn ngẫu nhiên 1 chiêu) ---
    await new Promise((r) => setTimeout(r, 500))
    const enemyMove = enemyMon.moves[Math.floor(Math.random() * enemyMon.moves.length)]
    const dmgToPlayer = computeDamage(enemyMove, enemyMon, playerMon)
    const newPlayerHp = Math.max(0, playerMon.hp - dmgToPlayer)
    setPlayerMon((m) => ({ ...m, hp: newPlayerHp }))
    pushLog(`${enemyMon.name} dùng ${enemyMove.name}! Gây ${dmgToPlayer} sát thương.`)

    if (newPlayerHp <= 0) {
      pushLog(`${playerMon.name} đã gục ngã! Bạn thua...`)
    }

    setBusy(false)
  }

  return (
    <div>
      <div className="panel" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="page-title">Chiến đấu (demo giao diện)</h2>
            <p className="page-subtitle" style={{ margin: 0 }}>
              Giao diện đơn giản để test trước — công thức sát thương, ability, item, trạng thái
              sẽ bổ sung sau.
            </p>
          </div>
          <button className="btn" onClick={resetBattle}>
            Trận mới
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          marginTop: 16,
        }}
      >
        <MonPanel mon={enemyMon} side="enemy" />
        <MonPanel mon={playerMon} side="player" />
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12.5,
            color: 'var(--text-mid)',
            minHeight: 60,
            maxHeight: 120,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            marginBottom: 16,
            paddingRight: 4,
          }}
        >
          {battleLog.map((line, i) => (
            <div key={i}>› {line}</div>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          {playerMon.moves.map((move) => (
            <button
              key={move.name}
              className="btn"
              disabled={busy || battleOver}
              onClick={() => handleMove(move)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
              }}
            >
              <span>{move.name}</span>
              <TypeBadge type={move.type} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
