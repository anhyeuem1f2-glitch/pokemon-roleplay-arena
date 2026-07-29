import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { getEffectivenessMulti } from '../data/pokemonTypes.js'
import { applyEnvToDamage } from '../data/battleEnvironments.js'
import { isSameMon } from '../data/pokemonSpecies.js'
import { computeDamage, STAGE_ZERO } from './BattleModal.jsx'
import HealthBar from './HealthBar.jsx'
import MonAvatar from './MonAvatar.jsx'
import TypeBadge from './TypeBadge.jsx'

const STATUS_INFO = {
  brn: { label: 'Bỏng', short: 'BRN' },
  par: { label: 'Tê liệt', short: 'PAR' },
  slp: { label: 'Ngủ', short: 'SLP' },
}
const HEAL_AMOUNT = { potion: 20, superpotion: 60, hyperpotion: 120, freshwater: 30, fullrestore: 9999 }
const STATUS_CURE = {
  antidote: ['psn'], paralyzeheal: ['par'], awakening: ['slp'], burnheal: ['brn'],
  fullrestore: ['psn', 'par', 'slp', 'brn', 'frz'],
}

function monKey(mon, fallback = '') {
  return mon?.uid ?? `${mon?.name ?? 'mon'}-${mon?.level ?? 0}-${fallback}`
}

function cloneMon(mon) {
  return mon ? { ...mon, moves: [...(mon.moves ?? [])], stats: mon.stats ? { ...mon.stats } : mon.stats } : null
}

function buildInitialTeam(party, playerMon) {
  const out = (party ?? []).map(cloneMon)
  if (playerMon) {
    const at = out.findIndex((mon) => isSameMon(mon, playerMon))
    if (at >= 0) out[at] = cloneMon(playerMon)
    else out.unshift(cloneMon(playerMon))
  }
  // Save rất cũ có thể chưa có uid. Đấu đôi cần phân biệt hai ô nên nâng
  // chúng lên uid ổn định theo vị trí đội trước khi ghi ngược vào context.
  return out.map((mon, index) => mon.uid ? mon : {
    ...mon,
    uid: `legacy-${String(mon.species ?? mon.name ?? 'mon').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`,
  })
}

function zeroStagesFor(mons) {
  const result = {}
  for (const mon of mons ?? []) result[monKey(mon)] = { ...STAGE_ZERO }
  return result
}

function stageLabel(delta) {
  if (delta >= 2) return 'tăng mạnh'
  if (delta === 1) return 'tăng'
  if (delta === -1) return 'giảm'
  return 'giảm mạnh'
}

function applyStageBoost(stageMap, key, boosts, logs, name) {
  if (!boosts || !key) return
  const current = stageMap[key] ?? { ...STAGE_ZERO }
  const next = { ...current }
  const labels = { atk: 'Tấn công', def: 'Phòng thủ', spa: 'TC đặc biệt', spd: 'PT đặc biệt', spe: 'Tốc độ' }
  for (const [stat, delta] of Object.entries(boosts)) {
    if (!(stat in next) || !delta) continue
    const before = next[stat]
    next[stat] = Math.max(-6, Math.min(6, before + delta))
    if (next[stat] !== before) logs.push(`${labels[stat] ?? stat} của ${name} ${stageLabel(delta)}! (${next[stat] > 0 ? '+' : ''}${next[stat]})`)
  }
  stageMap[key] = next
}

function canAct(mon, logs) {
  if (mon.status === 'slp') {
    const left = (mon.sleepTurns ?? 1) - 1
    if (left > 0) {
      mon.sleepTurns = left
      logs.push(`${mon.name} đang ngủ, không thể hành động.`)
      return false
    }
    mon.status = null
    delete mon.sleepTurns
    logs.push(`${mon.name} đã tỉnh giấc!`)
  }
  if (mon.status === 'par' && Math.random() < 0.25) {
    logs.push(`${mon.name} bị tê liệt, không thể cử động!`)
    return false
  }
  return true
}

function rollStatus(move, defender) {
  const status = move.secondary?.status
  if (!status || !STATUS_INFO[status] || defender.status) return null
  if (status === 'brn' && defender.types?.includes('fire')) return null
  if (status === 'par' && defender.types?.includes('electric')) return null
  return Math.random() * 100 < (move.secondary.chance ?? 100) ? status : null
}

function isSpreadMove(move) {
  return ['allAdjacentFoes', 'allAdjacent', 'all'].includes(move?.target)
}

function moveHits(move) {
  if (move?.accuracy === true || move?.accuracy === undefined || move?.accuracy === null) return true
  const accuracy = Math.max(1, Math.min(100, Number(move.accuracy) || 100))
  return Math.random() * 100 < accuracy
}

function BattleCard({ mon, label, active, onClick, stages }) {
  if (!mon) return (
    <div className="panel" style={{ padding: 9, opacity: 0.45, minHeight: 112, display: 'grid', placeItems: 'center' }}>Trống</div>
  )
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: '72px minmax(0,1fr)', gap: 8, alignItems: 'center',
        width: '100%', textAlign: 'left', padding: 8, borderRadius: 10,
        border: `1px solid ${active ? 'var(--mint)' : 'var(--line)'}`,
        background: active ? 'rgba(120,200,170,.075)' : 'var(--bg-panel)', color: 'inherit',
        cursor: onClick ? 'pointer' : 'default', opacity: mon.hp <= 0 ? 0.52 : 1,
      }}
    >
      <div style={{ display: 'grid', placeItems: 'center', transform: 'scale(.82)' }}><MonAvatar mon={mon} side={label === 'PHE ĐỊCH' ? 'enemy' : 'player'} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 8.5, color: label === 'PHE ĐỊCH' ? 'var(--coral)' : 'var(--mint)', fontWeight: 800, letterSpacing: '.1em' }}>{label}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, margin: '2px 0 4px' }}>
          <strong style={{ fontSize: 12 }}>{mon.name}</strong>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontSize: 10 }}>Lv.{mon.level}</span>
        </div>
        <div style={{ display: 'flex', gap: 3, marginBottom: 5, flexWrap: 'wrap' }}>
          {(mon.types ?? []).map((type) => <TypeBadge key={type} type={type} />)}
          {mon.status && <span style={{ fontSize: 9, color: 'var(--amber)' }}>{STATUS_INFO[mon.status]?.short ?? mon.status}</span>}
        </div>
        <HealthBar hp={mon.hp} maxHp={mon.maxHp} bars={mon.bossBars ?? 1} />
        {Object.entries(stages ?? {}).some(([, value]) => value) && (
          <div style={{ fontSize: 8.5, color: 'var(--text-dim)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
            {Object.entries(stages).filter(([, value]) => value).map(([key, value]) => `${key.toUpperCase()}${value > 0 ? '+' : ''}${value}`).join(' · ')}
          </div>
        )}
      </div>
    </button>
  )
}

function actionText(action, team, enemies) {
  if (!action) return 'Chưa chọn'
  if (action.type === 'switch') return `Đổi → ${team.find((mon) => monKey(mon) === action.targetUid)?.name ?? '?'}`
  if (action.type === 'item') return `${action.item.name} → ${action.targetSlot + 1}`
  const target = action.move.target === 'self' ? 'bản thân' : isSpreadMove(action.move) ? 'cả phe địch' : enemies[action.targetIndex]?.name ?? '?'
  return `${action.move.name} → ${target}`
}

export default function DoubleBattleModal({ initialEnemies, environment = null, onClose, onSnapshot, onBattleEnd }) {
  const { playerMon, setPlayerMon, party, setParty, inventory, setInventory } = useGame()
  const [team, setTeam] = useState(() => buildInitialTeam(party, playerMon))
  const [enemies, setEnemies] = useState(() => (initialEnemies ?? []).slice(0, 2).map(cloneMon))
  const [activeIds, setActiveIds] = useState(() => {
    const initial = buildInitialTeam(party, playerMon)
    const lead = initial.find((mon) => playerMon && isSameMon(mon, playerMon)) ?? initial.find((mon) => mon.hp > 0)
    const second = initial.find((mon) => mon.hp > 0 && !isSameMon(mon, lead))
    return [monKey(lead, 'lead'), monKey(second, 'second')]
  })
  const [stages, setStages] = useState(() => zeroStagesFor([...buildInitialTeam(party, playerMon), ...(initialEnemies ?? [])]))
  const [actions, setActions] = useState({})
  const [selectedSlot, setSelectedSlot] = useState(0)
  const [targeting, setTargeting] = useState(null)
  const [panel, setPanel] = useState('fight')
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(false)
  const [outcome, setOutcome] = useState(null)
  const [log, setLog] = useState(() => [
    `Đấu đôi 2v2 bắt đầu: ${initialEnemies?.map((mon) => mon.name).join(' + ') || 'hai đối thủ'} xuất trận!`,
  ])
  const participantsRef = useRef(new Set(activeIds.filter(Boolean)))
  const continuingRef = useRef(false)
  const snapshotRef = useRef(onSnapshot)

  const activeMons = activeIds.map((id) => team.find((mon) => monKey(mon) === id) ?? null)
  const healthyReserve = team.filter((mon) => mon.hp > 0 && !activeIds.includes(monKey(mon)))
  const requiredSlots = activeMons.map((mon, index) => ({ mon, index })).filter(({ mon }) => mon?.hp > 0).map(({ index }) => index)
  const missingReplacementSlots = activeMons.map((mon, index) => ({ mon, index })).filter(({ mon }) => (!mon || mon.hp <= 0) && healthyReserve.length > 0).map(({ index }) => index)
  const ready = requiredSlots.length > 0 && requiredSlots.every((slot) => actions[slot]) && missingReplacementSlots.length === 0

  useEffect(() => {
    setParty(team)
    const lead = activeMons.find((mon) => mon?.hp > 0) ?? team.find((mon) => mon.hp > 0) ?? activeMons[0]
    if (lead) setPlayerMon(lead)
  }, [team, activeIds]) // eslint-disable-line react-hooks/exhaustive-deps

  // Callback cha thường được tạo inline. Giữ nó trong ref để việc lưu snapshot
  // chỉ chạy khi đối thủ thực sự đổi, tránh vòng lặp render vô hạn.
  useEffect(() => { snapshotRef.current = onSnapshot }, [onSnapshot])
  useEffect(() => { snapshotRef.current?.(enemies) }, [enemies])

  useEffect(() => {
    if (finished) return
    if (enemies.length > 0 && enemies.every((mon) => mon.hp <= 0)) {
      setOutcome('win')
      setFinished(true)
      setLog((cur) => [...cur, 'Cả hai Pokémon đối thủ đã gục — bạn thắng trận đấu đôi!'])
    } else if (team.length > 0 && team.every((mon) => mon.hp <= 0)) {
      setOutcome('lose')
      setFinished(true)
      setLog((cur) => [...cur, 'Toàn bộ đội hình đã gục — bạn thua trận đấu đôi.'])
    }
  }, [team, enemies, finished])

  function chooseMove(slot, move) {
    if (move.target === 'self') {
      setActions((cur) => ({ ...cur, [slot]: { type: 'move', move, targetIndex: null } }))
      setTargeting(null)
      return
    }
    if (isSpreadMove(move)) {
      setActions((cur) => ({ ...cur, [slot]: { type: 'move', move, targetIndex: null } }))
      setTargeting(null)
      return
    }
    setTargeting({ slot, move })
  }

  function chooseTarget(targetIndex) {
    if (!targeting || enemies[targetIndex]?.hp <= 0) return
    setActions((cur) => ({ ...cur, [targeting.slot]: { type: 'move', move: targeting.move, targetIndex } }))
    setTargeting(null)
  }

  function chooseSwitch(slot, mon, forced = false) {
    if (!mon || mon.hp <= 0 || activeIds.includes(monKey(mon))) return
    if (forced) {
      const nextIds = [...activeIds]
      nextIds[slot] = monKey(mon)
      participantsRef.current.add(monKey(mon))
      setActiveIds(nextIds)
      setActions((cur) => { const next = { ...cur }; delete next[slot]; return next })
      setLog((cur) => [...cur, `${mon.name} vào sân thay vị trí ${slot + 1}!`])
      return
    }
    setActions((cur) => ({ ...cur, [slot]: { type: 'switch', targetUid: monKey(mon) } }))
    setPanel('fight')
  }

  function chooseItem(slot, item) {
    if (HEAL_AMOUNT[item.id] === undefined && !STATUS_CURE[item.id]) return
    setActions((cur) => ({ ...cur, [slot]: { type: 'item', item, targetSlot: slot } }))
    setPanel('fight')
  }

  function consumeItem(itemId) {
    setInventory((cur) => (cur ?? []).map((item) => item.id === itemId && !item.infinite ? { ...item, qty: (item.qty ?? 1) - 1 } : item).filter((item) => item.infinite || (item.qty ?? 0) > 0))
  }

  async function resolveRound() {
    if (!ready || busy || finished) return
    setBusy(true)
    const nextTeam = team.map(cloneMon)
    const nextEnemies = enemies.map(cloneMon)
    const nextIds = [...activeIds]
    const nextStages = Object.fromEntries(Object.entries(stages).map(([key, value]) => [key, { ...value }]))
    const roundLog = []

    const enemyActions = nextEnemies.map((enemy, enemyIndex) => {
      if (!enemy || enemy.hp <= 0) return null
      const livingSlots = nextIds.map((id, slot) => ({ slot, mon: nextTeam.find((entry) => monKey(entry) === id) })).filter(({ mon }) => mon?.hp > 0)
      if (!livingSlots.length) return null
      const targetSlot = livingSlots[Math.floor(Math.random() * livingSlots.length)].slot
      const usableMoves = (enemy.moves ?? []).filter(Boolean)
      if (!usableMoves.length) return null
      const move = usableMoves[Math.floor(Math.random() * usableMoves.length)]
      return { side: 'enemy', actorIndex: enemyIndex, targetSlot, move, priority: Number(move.priority ?? 0), speed: enemy.stats?.spe ?? enemy.level }
    }).filter(Boolean)

    const playerActions = requiredSlots.map((slot) => {
      const action = actions[slot]
      const actor = nextTeam.find((mon) => monKey(mon) === nextIds[slot])
      if (!action || !actor) return null
      const priority = action.type === 'switch' ? 7 : action.type === 'item' ? 6 : Number(action.move?.priority ?? 0)
      return { ...action, side: 'player', actorSlot: slot, actorUid: monKey(actor), priority, speed: actor.stats?.spe ?? actor.level }
    }).filter(Boolean)

    const queue = [...playerActions, ...enemyActions].sort((a, b) => b.priority - a.priority || b.speed - a.speed || Math.random() - 0.5)

    for (const action of queue) {
      if (action.side === 'player') {
        let actor = nextTeam.find((mon) => monKey(mon) === nextIds[action.actorSlot])
        if (!actor || actor.hp <= 0) continue
        if (action.type === 'switch') {
          const target = nextTeam.find((mon) => monKey(mon) === action.targetUid)
          if (!target || target.hp <= 0 || nextIds.includes(monKey(target))) continue
          roundLog.push(`Bạn thu ${actor.name} về và tung ${target.name} vào vị trí ${action.actorSlot + 1}!`)
          nextIds[action.actorSlot] = monKey(target)
          participantsRef.current.add(monKey(target))
          continue
        }
        if (action.type === 'item') {
          const target = nextTeam.find((mon) => monKey(mon) === nextIds[action.targetSlot])
          if (!target || target.hp <= 0) continue
          const heal = HEAL_AMOUNT[action.item.id]
          if (heal !== undefined) {
            const before = target.hp
            target.hp = Math.min(target.maxHp, target.hp + heal)
            roundLog.push(`Dùng ${action.item.name} cho ${target.name}: hồi ${target.hp - before} HP.`)
          }
          const cures = STATUS_CURE[action.item.id]
          if (cures?.includes(target.status)) {
            target.status = null
            delete target.sleepTurns
            roundLog.push(`${target.name} đã khỏi trạng thái xấu.`)
          }
          consumeItem(action.item.id)
          continue
        }
        if (!canAct(actor, roundLog)) continue
        const move = action.move
        if (!moveHits(move)) {
          roundLog.push(`${actor.name} dùng ${move.name}, nhưng đòn đánh trượt!`)
          continue
        }
        if (move.target === 'self') {
          roundLog.push(`${actor.name} dùng ${move.name}.`)
          applyStageBoost(nextStages, monKey(actor), move.boosts ?? move.self?.boosts, roundLog, actor.name)
          continue
        }
        let targetIndexes = isSpreadMove(move)
          ? nextEnemies.map((enemy, index) => enemy.hp > 0 ? index : -1).filter((index) => index >= 0)
          : [nextEnemies[action.targetIndex]?.hp > 0 ? action.targetIndex : nextEnemies.findIndex((enemy) => enemy.hp > 0)].filter((index) => index >= 0)
        const spreadPenalty = targetIndexes.length > 1 ? 0.75 : 1
        for (const targetIndex of targetIndexes) {
          const target = nextEnemies[targetIndex]
          if (!target || target.hp <= 0) continue
          const damage = move.power > 0 ? Math.max(1, Math.round(applyEnvToDamage(computeDamage(move, actor, target, nextStages[monKey(actor)], nextStages[monKey(target)]), move, environment) * spreadPenalty)) : 0
          target.hp = Math.max(0, target.hp - damage)
          roundLog.push(damage > 0 ? `${actor.name} dùng ${move.name} lên ${target.name}, gây ${damage} sát thương.` : `${actor.name} dùng ${move.name} lên ${target.name}.`)
          const eff = getEffectivenessMulti(move.type, target.types)
          if (damage > 0 && eff > 1) roundLog.push('Hiệu quả tốt!')
          else if (damage > 0 && eff > 0 && eff < 1) roundLog.push('Hiệu quả không tốt...')
          else if (damage > 0 && eff === 0) roundLog.push('Không có tác dụng.')
          if (target.hp > 0) {
            if (move.boosts && move.target !== 'self') applyStageBoost(nextStages, monKey(target), move.boosts, roundLog, target.name)
            if (move.secondary?.boosts && Math.random() * 100 < (move.secondary.chance ?? 100)) applyStageBoost(nextStages, monKey(target), move.secondary.boosts, roundLog, target.name)
            const status = rollStatus(move, target)
            if (status) {
              target.status = status
              if (status === 'slp') target.sleepTurns = 1 + Math.floor(Math.random() * 3)
              roundLog.push(`${target.name} bị ${STATUS_INFO[status].label.toLowerCase()}!`)
            }
          } else roundLog.push(`${target.name} đã gục!`)
        }
        if (move.self?.boosts) applyStageBoost(nextStages, monKey(actor), move.self.boosts, roundLog, actor.name)
      } else {
        const actor = nextEnemies[action.actorIndex]
        if (!actor || actor.hp <= 0 || !canAct(actor, roundLog)) continue
        const move = action.move
        if (!moveHits(move)) {
          roundLog.push(`${actor.name} dùng ${move.name}, nhưng đòn đánh trượt!`)
          continue
        }
        if (move.target === 'self') {
          roundLog.push(`${actor.name} dùng ${move.name}.`)
          applyStageBoost(nextStages, monKey(actor), move.boosts ?? move.self?.boosts, roundLog, actor.name)
          continue
        }
        const target = nextTeam.find((mon) => monKey(mon) === nextIds[action.targetSlot])
        if (!target || target.hp <= 0) continue
        const targets = isSpreadMove(move)
          ? nextIds.map((id) => nextTeam.find((mon) => monKey(mon) === id)).filter((mon) => mon?.hp > 0)
          : [target]
        const spreadPenalty = targets.length > 1 ? 0.75 : 1
        for (const playerTarget of targets) {
          const damage = move.power > 0 ? Math.max(1, Math.round(applyEnvToDamage(computeDamage(move, actor, playerTarget, nextStages[monKey(actor)], nextStages[monKey(playerTarget)]), move, environment) * spreadPenalty)) : 0
          playerTarget.hp = Math.max(0, playerTarget.hp - damage)
          roundLog.push(damage > 0 ? `${actor.name} dùng ${move.name} lên ${playerTarget.name}, gây ${damage} sát thương.` : `${actor.name} dùng ${move.name}.`)
          if (playerTarget.hp > 0) {
            const status = rollStatus(move, playerTarget)
            if (status) {
              playerTarget.status = status
              if (status === 'slp') playerTarget.sleepTurns = 1 + Math.floor(Math.random() * 3)
              roundLog.push(`${playerTarget.name} bị ${STATUS_INFO[status].label.toLowerCase()}!`)
            }
          } else roundLog.push(`${playerTarget.name} đã gục!`)
        }
      }
    }

    for (const mon of [...nextTeam.filter((entry) => nextIds.includes(monKey(entry))), ...nextEnemies]) {
      if (mon?.status !== 'brn' || mon.hp <= 0) continue
      const tick = Math.max(1, Math.round(mon.maxHp / 16))
      mon.hp = Math.max(0, mon.hp - tick)
      roundLog.push(`${mon.name} bị bỏng, mất ${tick} HP.`)
    }

    setTeam(nextTeam)
    setEnemies(nextEnemies)
    setActiveIds(nextIds)
    setStages(nextStages)
    setActions({})
    setTargeting(null)
    setLog((cur) => [...cur, ...roundLog])
    await new Promise((resolve) => setTimeout(resolve, 250))
    setBusy(false)
  }

  function finishAndContinue() {
    if (continuingRef.current) return
    continuingRef.current = true
    const lead = activeIds.find((id) => team.find((mon) => monKey(mon) === id)?.hp > 0) ?? activeIds[0]
    onBattleEnd(outcome ?? 'lose', {
      mode: 'double', enemies, team, participantUids: [...participantsRef.current], leadUid: lead,
    })
  }

  const selectedMon = activeMons[selectedSlot]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 110, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="panel" style={{ width: 'min(900px, 100%)', maxHeight: '94vh', overflowY: 'auto', background: 'var(--bg-panel-raised)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div>
            <h2 className="page-title" style={{ margin: 0 }}>Đấu đôi 2v2 <span style={{ color: 'var(--amber)', fontSize: 11 }}>BETA</span></h2>
            <div style={{ color: 'var(--text-dim)', fontSize: 10.5, marginTop: 3 }}>Battle Club / yêu cầu Chủ Gym · cơ chế đặc biệt tạm khoá trong giai đoạn thử nghiệm</div>
          </div>
          {!finished && <button className="btn" onClick={() => onClose?.(enemies)}>✕ Ẩn (trận vẫn tiếp diễn)</button>}
        </div>

        {environment && environment.key !== 'none' && <div style={{ fontSize: 10.5, color: 'var(--text-mid)', border: '1px dashed var(--line)', borderRadius: 8, padding: '5px 9px', marginBottom: 9 }}>{environment.label} — {environment.desc}</div>}

        <div style={{ padding: 10, borderRadius: 12, border: '1px solid var(--line)', background: 'linear-gradient(180deg,#182532 0 49%,#24372b 49% 100%)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginBottom: 14 }}>
            {enemies.map((mon, index) => <BattleCard key={monKey(mon, index)} mon={mon} label="PHE ĐỊCH" stages={stages[monKey(mon)]} active={targeting && mon.hp > 0} onClick={targeting && mon.hp > 0 ? () => chooseTarget(index) : undefined} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
            {[0, 1].map((slot) => <BattleCard key={slot} mon={activeMons[slot]} label={`PHE BẠN · Ô ${slot + 1}`} stages={stages[monKey(activeMons[slot])]} active={selectedSlot === slot} onClick={() => { setSelectedSlot(slot); setTargeting(null) }} />)}
          </div>
        </div>

        <div style={{ maxHeight: 128, overflowY: 'auto', margin: '10px 0', padding: '8px 10px', borderRadius: 8, background: 'var(--bg-deep)', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-mid)' }}>
          {log.map((line, index) => <div key={index}>› {line}</div>)}
        </div>

        {finished ? (
          <button className="btn btn--primary" style={{ width: '100%' }} onClick={finishAndContinue}>Tiếp tục câu chuyện</button>
        ) : missingReplacementSlots.length > 0 ? (
          <div className="panel" style={{ padding: 10 }}>
            <div style={{ color: 'var(--coral)', fontWeight: 750, marginBottom: 8 }}>Cần đưa Pokémon thay thế vào sân</div>
            {missingReplacementSlots.map((slot) => (
              <div key={slot} style={{ marginBottom: 9 }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginBottom: 5 }}>Ô {slot + 1}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {healthyReserve.map((mon) => <button key={monKey(mon)} className="btn" onClick={() => chooseSwitch(slot, mon, true)}>{mon.name} · Lv.{mon.level} · {mon.hp}/{mon.maxHp}</button>)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginBottom: 8 }}>
              {[0, 1].map((slot) => (
                <button key={slot} className="btn" onClick={() => { setSelectedSlot(slot); setTargeting(null) }} disabled={!activeMons[slot] || activeMons[slot].hp <= 0} style={{ borderColor: selectedSlot === slot ? 'var(--mint)' : undefined }}>
                  Ô {slot + 1}: {activeMons[slot]?.name ?? 'trống'} · <span style={{ color: actions[slot] ? 'var(--mint)' : 'var(--text-dim)' }}>{actionText(actions[slot], team, enemies)}</span>
                </button>
              ))}
            </div>

            {targeting ? (
              <div className="panel" style={{ padding: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 11.5, marginBottom: 7 }}>Chọn mục tiêu cho <strong>{targeting.move.name}</strong></div>
                <div style={{ display: 'flex', gap: 7 }}>
                  {enemies.map((mon, index) => <button key={monKey(mon, index)} className="btn" disabled={mon.hp <= 0} onClick={() => chooseTarget(index)} style={{ flex: 1 }}>{mon.name} · {mon.hp}/{mon.maxHp}</button>)}
                  <button className="btn" onClick={() => setTargeting(null)}>Huỷ</button>
                </div>
              </div>
            ) : panel === 'switch' ? (
              <div className="panel" style={{ padding: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 11.5, marginBottom: 7 }}>Đổi Pokémon ở ô {selectedSlot + 1} — tốn lượt của ô này</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {healthyReserve.length ? healthyReserve.map((mon) => <button key={monKey(mon)} className="btn" onClick={() => chooseSwitch(selectedSlot, mon)}>{mon.name} · Lv.{mon.level} · {mon.hp}/{mon.maxHp}</button>) : <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>Không có Pokémon dự bị khoẻ.</span>}
                </div>
                <button className="btn" onClick={() => setPanel('fight')} style={{ marginTop: 8 }}>← Quay lại</button>
              </div>
            ) : panel === 'bag' ? (
              <div className="panel" style={{ padding: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 11.5, marginBottom: 7 }}>Vật phẩm cho {selectedMon?.name} — tốn lượt của ô {selectedSlot + 1}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(inventory ?? []).filter((item) => HEAL_AMOUNT[item.id] !== undefined || STATUS_CURE[item.id]).map((item) => <button key={item.id} className="btn" onClick={() => chooseItem(selectedSlot, item)}>{item.name} ×{item.infinite ? '∞' : item.qty}</button>)}
                </div>
                <button className="btn" onClick={() => setPanel('fight')} style={{ marginTop: 8 }}>← Quay lại</button>
              </div>
            ) : (
              <div className="panel" style={{ padding: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 11.5, marginBottom: 7 }}>Chọn hành động cho <strong>{selectedMon?.name}</strong></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 7 }}>
                  {(selectedMon?.moves ?? []).map((move) => (
                    <button key={move.name} className="btn" disabled={busy || selectedMon.hp <= 0} onClick={() => chooseMove(selectedSlot, move)} style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span>{move.name}</span><TypeBadge type={move.type} />
                    </button>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 8 }}>
                  <button className="btn" onClick={() => setPanel('switch')}>POKÉMON · đổi ô {selectedSlot + 1}</button>
                  <button className="btn" onClick={() => setPanel('bag')}>BAG · dùng vật phẩm</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => { setActions({}); setTargeting(null) }} disabled={busy}>Xoá lựa chọn</button>
              <button className="btn btn--primary" style={{ flex: 2 }} onClick={resolveRound} disabled={!ready || busy}>{busy ? 'Đang xử lý lượt...' : 'BẮT ĐẦU LƯỢT 2v2'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
