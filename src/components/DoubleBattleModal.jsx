import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { getEffectivenessMulti } from '../data/pokemonTypes.js'
import { applyEnvToDamage, getBattleEnv } from '../data/battleEnvironments.js'
import { isSameMon, repairEncounterMonMoves } from '../data/pokemonSpecies.js'
import { computeDamage, STAGE_ZERO } from './BattleModal.jsx'
import HealthBar from './HealthBar.jsx'
import MonAvatar from './MonAvatar.jsx'
import TypeBadge from './TypeBadge.jsx'
import {
  abilityLabel, allyGuardMultiplier, clearBattleVolatile, contactAbilityEffect, effectiveSpeed,
  endTurnAbilityEffect, endTurnStatusEffect, hasAbility, knockoutAbilityEffect, modifyBoostsByAbility,
  modifyDamageByAbilities, moveHitsWithAbilities, movePriorityWithAbility, redirectTargetByAbility,
  moveStatusIsBlocked, statusIsBlocked, switchOutAbility, weatherFromAbility, weatherIsSuppressed,
} from '../data/pokemonAbilities.js'
import {
  afterDamageHeldItem, afterMoveHeldItem, afterStatusHeldItem, beforeDamageHeldItem, clearHeldItemVolatile,
  endTurnHeldItemEffect, heldItemLabel, heldItemMoveAllowed, heldItemPriorityPenalty, defenderTypesWithHeldItem,
  heldItemSpeedMultiplier, lockChoiceMove, restoreTransientHeldItem, weatherTurnsFromHeldItem,
} from '../data/pokemonHeldItems.js'

const STATUS_INFO = {
  brn: { label: 'Bỏng', short: 'BRN' },
  par: { label: 'Tê liệt', short: 'PAR' },
  slp: { label: 'Ngủ', short: 'SLP' },
  psn: { label: 'Nhiễm độc', short: 'PSN' },
  frz: { label: 'Đóng băng', short: 'FRZ' },
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
  return mon ? { ...mon, heldItem: mon.heldItem ? { ...mon.heldItem } : null, moves: [...(mon.moves ?? [])], stats: mon.stats ? { ...mon.stats } : mon.stats } : null
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

function applyStageBoost(stageMap, key, boosts, logs, name, mon = null, options = {}) {
  const effectiveBoosts = mon ? modifyBoostsByAbility(mon, boosts, options) : boosts
  if (!effectiveBoosts || !key) return
  const current = stageMap[key] ?? { ...STAGE_ZERO }
  const next = { ...current }
  const labels = { atk: 'Tấn công', def: 'Phòng thủ', spa: 'TC đặc biệt', spd: 'PT đặc biệt', spe: 'Tốc độ', acc: 'Chính xác', eva: 'Né tránh' }
  for (const [stat, delta] of Object.entries(effectiveBoosts)) {
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
  if (mon.status === 'frz') {
    if (Math.random() < 0.2) {
      mon.status = null
      logs.push(`${mon.name} đã tan băng!`)
    } else {
      logs.push(`${mon.name} bị đóng băng, không thể hành động!`)
      return false
    }
  }
  if (mon.status === 'par' && Math.random() < 0.25) {
    logs.push(`${mon.name} bị tê liệt, không thể cử động!`)
    return false
  }
  return true
}

function isSpreadMove(move) {
  return ['allAdjacentFoes', 'allAdjacent', 'all'].includes(move?.target)
}

function moveWeatherKey(move) {
  const key = String(move?.weather ?? '').toLowerCase().replace(/[^a-z]/g, '')
  if (key.includes('rain')) return 'rain'
  if (key.includes('sun')) return 'sun'
  if (key.includes('sand')) return 'sandstorm'
  if (key.includes('snow') || key.includes('hail')) return 'snow'
  return null
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
        <div style={{ fontSize: 8.5, color: 'var(--text-dim)', marginBottom: 4 }}>◇ {abilityLabel(mon)} · ◆ {heldItemLabel(mon)}</div>
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

export default function DoubleBattleModal({ initialEnemies, environment = null, onClose, onSnapshot, onBattleEnd, initialBattleState = null }) {
  const { playerMon, setPlayerMon, party, setParty, inventory, setInventory, movesDb, pokedexSpecies, markPokedexSeen, playerLocation, storyDate } = useGame()
  const fallbackTeam = buildInitialTeam(party, playerMon)
  const restoredTeam = initialBattleState?.team?.length
    ? initialBattleState.team.map(cloneMon)
    : fallbackTeam
  const restoredEnemies = initialBattleState?.enemies?.length
    ? initialBattleState.enemies.slice(0, 2).map(cloneMon)
    : (initialEnemies ?? []).slice(0, 2).map(cloneMon)
  const restoredEnv = initialBattleState?.battleEnvKey
    ? getBattleEnv(initialBattleState.battleEnvKey)
    : (environment ?? getBattleEnv('none'))
  const [team, setTeam] = useState(() => restoredTeam)
  const [enemies, setEnemies] = useState(() => restoredEnemies)
  const [activeIds, setActiveIds] = useState(() => {
    if (initialBattleState?.activeIds?.length) return [...initialBattleState.activeIds]
    const initial = restoredTeam
    const lead = initial.find((mon) => playerMon && isSameMon(mon, playerMon)) ?? initial.find((mon) => mon.hp > 0)
    const second = initial.find((mon) => mon.hp > 0 && !isSameMon(mon, lead))
    return [monKey(lead, 'lead'), monKey(second, 'second')]
  })
  const [stages, setStages] = useState(() => initialBattleState?.stages
    ? Object.fromEntries(Object.entries(initialBattleState.stages).map(([key, value]) => [key, { ...STAGE_ZERO, ...value }]))
    : zeroStagesFor([...restoredTeam, ...restoredEnemies]))
  const [actions, setActions] = useState({})
  const [selectedSlot, setSelectedSlot] = useState(0)
  const [targeting, setTargeting] = useState(null)
  const [panel, setPanel] = useState('fight')
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(false)
  const [outcome, setOutcome] = useState(null)
  const [battleEnv, setBattleEnv] = useState(restoredEnv)
  const [weatherTurns, setWeatherTurns] = useState(initialBattleState?.weatherTurns ?? null)
  useEffect(() => {
    for (const enemy of enemies ?? []) {
      markPokedexSeen(enemy, { source: 'double-trainer-battle', location: playerLocation, date: storyDate })
    }
  }, [enemies, markPokedexSeen, playerLocation, storyDate])
  const entryAbilitiesAppliedRef = useRef(Boolean(initialBattleState?.entryAbilitiesApplied))
  const [log, setLog] = useState(() => Array.isArray(initialBattleState?.log) && initialBattleState.log.length
    ? [...initialBattleState.log]
    : [`Đấu đôi 2v2 bắt đầu: ${restoredEnemies.map((mon) => mon.name).join(' + ') || 'hai đối thủ'} xuất trận!`])
  const participantsRef = useRef(new Set(
    initialBattleState?.participantUids?.length
      ? initialBattleState.participantUids
      : activeIds.filter(Boolean),
  ))
  const continuingRef = useRef(false)
  const snapshotRef = useRef(onSnapshot)

  const activeMons = activeIds.map((id) => team.find((mon) => monKey(mon) === id) ?? null)
  const healthyReserve = team.filter((mon) => mon.hp > 0 && !activeIds.includes(monKey(mon)))
  const requiredSlots = activeMons.map((mon, index) => ({ mon, index })).filter(({ mon }) => mon?.hp > 0).map(({ index }) => index)
  const missingReplacementSlots = activeMons.map((mon, index) => ({ mon, index })).filter(({ mon }) => (!mon || mon.hp <= 0) && healthyReserve.length > 0).map(({ index }) => index)
  const ready = requiredSlots.length > 0 && requiredSlots.every((slot) => actions[slot]) && missingReplacementSlots.length === 0

  useEffect(() => {
    setParty(team.map((mon) => clearHeldItemVolatile(clearBattleVolatile(mon))))
    const lead = activeMons.find((mon) => mon?.hp > 0) ?? team.find((mon) => mon.hp > 0) ?? activeMons[0]
    if (lead) setPlayerMon(clearHeldItemVolatile(clearBattleVolatile(lead)))
  }, [team, activeIds]) // eslint-disable-line react-hooks/exhaustive-deps

  // Callback cha thường được tạo inline. Giữ nó trong ref để việc lưu snapshot
  // chỉ chạy khi đối thủ thực sự đổi, tránh vòng lặp render vô hạn.
  useEffect(() => { snapshotRef.current = onSnapshot }, [onSnapshot])
  useEffect(() => { snapshotRef.current?.(enemies) }, [enemies])

  // Nếu trận 2v2 được mở trước khi learnset tải xong, local state của modal
  // không tự nhận enemyMon đã sửa trong context. Sửa trực tiếp hai đối thủ,
  // giữ nguyên HP/status/stages và gửi snapshot đã chuẩn hoá ngược về message.
  useEffect(() => {
    if (!movesDb?.allMoves || !movesDb?.learnsets || !pokedexSpecies?.length) return
    const id = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
    setEnemies((cur) => {
      let changed = false
      const next = cur.map((mon) => {
        const key = id(mon?.species ?? mon?.name)
        const entry = pokedexSpecies.find((species) => id(species.species) === key || id(species.name) === key)
        const repaired = entry ? repairEncounterMonMoves(mon, entry, movesDb, playerMon?.types ?? null) : mon
        if (repaired !== mon) changed = true
        return repaired
      })
      return changed ? next : cur
    })
  }, [movesDb, playerMon?.types, pokedexSpecies])

  // Ability vào sân cho cả bốn ô. Weather chạy theo Speed; Intimidate tác
  // động cả hai đối thủ trong đấu đôi. Chỉ chạy một lần khi mở trận.
  useEffect(() => {
    if (entryAbilitiesAppliedRef.current) return
    entryAbilitiesAppliedRef.current = true
    const playerEntries = activeMons.filter(Boolean)
    const entrants = [
      ...playerEntries.map((mon) => ({ mon, side: 'player' })),
      ...enemies.filter(Boolean).map((mon) => ({ mon, side: 'enemy' })),
    ].sort((a, b) => (effectiveSpeed(b.mon) * heldItemSpeedMultiplier(b.mon)) - (effectiveSpeed(a.mon) * heldItemSpeedMultiplier(a.mon)))
    const lines = []
    for (const { mon } of entrants) {
      const weather = weatherFromAbility(mon)
      if (weather) {
        setBattleEnv(getBattleEnv(weather))
        setWeatherTurns(weatherTurnsFromHeldItem(mon, weather, 5))
        lines.push(`${abilityLabel(mon)} của ${mon.name} làm thay đổi thời tiết!`)
      }
    }
    setStages((cur) => {
      const next = Object.fromEntries(Object.entries(cur).map(([key, value]) => [key, { ...value }]))
      for (const { mon, side } of entrants) {
        const targets = (side === 'player' ? enemies : playerEntries).filter((target) => target?.hp > 0)
        if (hasAbility(mon, 'Intimidate')) {
          for (const target of targets) {
            applyStageBoost(next, monKey(target), { atk: -1 }, lines, target.name, target, { fromOpponent: true, intimidate: true })
          }
        }
        if (hasAbility(mon, 'Download') && targets.length) {
          const def = targets.reduce((sum, target) => sum + (target.stats?.def ?? 0), 0)
          const spd = targets.reduce((sum, target) => sum + (target.stats?.spd ?? 0), 0)
          applyStageBoost(next, monKey(mon), def < spd ? { atk: 1 } : { spa: 1 }, lines, mon.name, mon)
        }
      }
      return next
    })
    if (lines.length) setLog((cur) => [...cur, ...lines])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      const entryLines = [`${mon.name} vào sân thay vị trí ${slot + 1}!`]
      const weather = weatherFromAbility(mon)
      if (weather) {
        setBattleEnv(getBattleEnv(weather))
        setWeatherTurns(weatherTurnsFromHeldItem(mon, weather, 5))
        entryLines.push(`${abilityLabel(mon)} của ${mon.name} làm thay đổi thời tiết!`)
      }
      setStages((cur) => {
        const next = Object.fromEntries(Object.entries(cur).map(([key, value]) => [key, { ...value }]))
        if (hasAbility(mon, 'Intimidate')) {
          for (const target of enemies.filter((entry) => entry?.hp > 0)) {
            applyStageBoost(next, monKey(target), { atk: -1 }, entryLines, target.name, target, { fromOpponent: true, intimidate: true })
          }
        }
        if (hasAbility(mon, 'Download')) {
          const targets = enemies.filter((entry) => entry?.hp > 0)
          const def = targets.reduce((sum, target) => sum + (target.stats?.def ?? 0), 0)
          const spd = targets.reduce((sum, target) => sum + (target.stats?.spd ?? 0), 0)
          if (targets.length) applyStageBoost(next, monKey(mon), def < spd ? { atk: 1 } : { spa: 1 }, entryLines, mon.name, mon)
        }
        return next
      })
      setLog((cur) => [...cur, ...entryLines])
      return
    }
    setActions((cur) => {
      const next = { ...cur }
      for (const [otherSlot, action] of Object.entries(next)) {
        if (Number(otherSlot) !== slot && action?.type === 'switch' && action.targetUid === monKey(mon)) delete next[otherSlot]
      }
      next[slot] = { type: 'switch', targetUid: monKey(mon) }
      return next
    })
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
    let roundEnv = battleEnv
    let roundWeatherTurns = weatherTurns

    const activePlayers = () => nextIds.map((id) => nextTeam.find((entry) => monKey(entry) === id)).filter(Boolean)
    const weatherKey = () => weatherIsSuppressed([...activePlayers(), ...nextEnemies]) ? null : roundEnv?.key

    function applyEntryLocal(mon, side) {
      const weather = weatherFromAbility(mon)
      if (weather) {
        roundEnv = getBattleEnv(weather)
        roundWeatherTurns = weatherTurnsFromHeldItem(mon, weather, 5)
        roundLog.push(`${abilityLabel(mon)} của ${mon.name} làm thay đổi thời tiết!`)
      }
      if (hasAbility(mon, 'Intimidate')) {
        const targets = side === 'player' ? nextEnemies : activePlayers()
        for (const target of targets.filter((entry) => entry?.hp > 0)) {
          applyStageBoost(nextStages, monKey(target), { atk: -1 }, roundLog, target.name, target, { fromOpponent: true, intimidate: true })
        }
      }
      if (hasAbility(mon, 'Download')) {
        const targets = (side === 'player' ? nextEnemies : activePlayers()).filter((entry) => entry?.hp > 0)
        if (targets.length) {
          const def = targets.reduce((sum, target) => sum + (target.stats?.def ?? 0), 0)
          const spd = targets.reduce((sum, target) => sum + (target.stats?.spd ?? 0), 0)
          applyStageBoost(nextStages, monKey(mon), def < spd ? { atk: 1 } : { spa: 1 }, roundLog, mon.name, mon)
        }
      }
    }

    function ratioValue(pair, base) {
      if (!Array.isArray(pair) || pair.length < 2 || !pair[1]) return 0
      return Math.max(1, Math.round(base * Number(pair[0]) / Number(pair[1])))
    }

    function damageTarget(actor, target, move, spreadPenalty) {
      const currentWeather = weatherKey()
      const actorStage = nextStages[monKey(actor)] ?? STAGE_ZERO
      const targetStage = nextStages[monKey(target)] ?? STAGE_ZERO
      if (!moveHitsWithAbilities(move, actor, target, currentWeather, actorStage, targetStage)) {
        roundLog.push(`${actor.name} dùng ${move.name} lên ${target.name}, nhưng đòn đánh trượt!`)
        return 0
      }
      const effectiveness = getEffectivenessMulti(move.type, defenderTypesWithHeldItem(target, move.type))
      const targetIsEnemy = nextEnemies.some((mon) => monKey(mon) === monKey(target))
      const berryBlocked = (targetIsEnemy ? activePlayers() : nextEnemies).some((mon) => mon?.hp > 0 && hasAbility(mon, 'Unnerve'))
      const allies = targetIsEnemy ? nextEnemies : activePlayers()
      const hits = Array.isArray(move.multihit)
        ? move.multihit[0] + Math.floor(Math.random() * (move.multihit[1] - move.multihit[0] + 1))
        : Number.isFinite(move.multihit) ? move.multihit : 1
      let totalDealt = 0
      let actualHits = 0
      let suppressSecondary = false
      let moveImmune = false

      for (let hit = 0; hit < hits && target.hp > 0 && actor.hp > 0; hit++) {
        let damage = move.power > 0
          ? computeDamage(move, actor, target, nextStages[monKey(actor)], nextStages[monKey(target)], currentWeather)
          : 0
        if (currentWeather && damage > 0) damage = applyEnvToDamage(damage, move, roundEnv)
        damage = Math.max(0, Math.round(damage * spreadPenalty * allyGuardMultiplier(target, allies)))
        const ability = modifyDamageByAbilities({ damage, move, attacker: actor, defender: target, weatherKey: currentWeather, effectiveness })
        roundLog.push(...ability.logs)
        suppressSecondary ||= ability.suppressSecondary
        moveImmune ||= ability.immune
        if (ability.healDefender) {
          const before = target.hp
          target.hp = Math.min(target.maxHp, target.hp + ability.healDefender)
          if (target.hp > before) roundLog.push(`${target.name} hồi ${target.hp - before} HP nhờ ${abilityLabel(target)}.`)
        }
        if (ability.defenderBoost) {
          if (ability.defenderBoost.flashFire) target.flashFireBoost = true
          else applyStageBoost(nextStages, monKey(target), ability.defenderBoost, roundLog, target.name, target)
        }
        if (ability.attackerBoost) applyStageBoost(nextStages, monKey(actor), ability.attackerBoost, roundLog, actor.name, actor)
        if (ability.immune) break

        const itemBefore = beforeDamageHeldItem({ attacker: actor, defender: target, move, damage: ability.damage, effectiveness, berryBlocked })
        Object.assign(target, itemBefore.defender)
        roundLog.push(...itemBefore.logs)
        if (itemBefore.immune) { moveImmune = true; break }
        const dealt = Math.min(target.hp, itemBefore.damage)
        target.hp = Math.max(0, target.hp - itemBefore.damage)
        totalDealt += dealt
        actualHits += 1
        const itemAfter = afterDamageHeldItem({ attacker: actor, defender: target, move, damage: dealt, effectiveness, berryBlocked })
        Object.assign(actor, itemAfter.attacker)
        Object.assign(target, itemAfter.defender)
        if (itemAfter.attackerBoosts?.target === 'defender') applyStageBoost(nextStages, monKey(target), { atk: 2, spa: 2 }, roundLog, target.name, target)
        roundLog.push(...itemAfter.logs)

        // Rough Skin/Static/Flame Body... kích hoạt trên TỪNG lần tiếp xúc.
        // Bản cũ cộng toàn bộ multihit rồi chỉ gọi một lần nên sai cơ chế và
        // còn cho kẻ tấn công tiếp tục đánh dù đã gục vì phản thương.
        const contact = contactAbilityEffect(actor, target, move, dealt)
        if (contact) {
          if (contact.recoil && !hasAbility(actor, 'Magic Guard')) actor.hp = Math.max(0, actor.hp - contact.recoil)
          if (contact.status && !statusIsBlocked(actor, contact.status, currentWeather)) {
            actor.status = contact.status
            const itemCure = afterStatusHeldItem(actor, (targetIsEnemy ? nextEnemies : activePlayers()).some((mon) => mon?.hp > 0 && hasAbility(mon, 'Unnerve')))
            Object.assign(actor, itemCure.mon)
            roundLog.push(...itemCure.logs)
          }
          roundLog.push(contact.log)
        }
      }

      roundLog.push(totalDealt > 0
        ? `${actor.name} dùng ${move.name} lên ${target.name}, gây ${totalDealt} sát thương.${actualHits > 1 ? ` Trúng ${actualHits} lần.` : ''}`
        : `${actor.name} dùng ${move.name} lên ${target.name}.`)
      if (totalDealt > 0 && effectiveness > 1) roundLog.push('Hiệu quả tốt!')
      else if (totalDealt > 0 && effectiveness > 0 && effectiveness < 1) roundLog.push('Hiệu quả không tốt...')
      else if (effectiveness === 0) roundLog.push('Không có tác dụng.')

      if (target.hp > 0) {
        if (!moveImmune) {
          if (move.boosts && move.target !== 'self') applyStageBoost(nextStages, monKey(target), move.boosts, roundLog, target.name, target, { fromOpponent: true })
          const secondaryTriggered = !suppressSecondary && move.secondary
            && Math.random() * 100 < (move.secondary.chance ?? 100)
          if (secondaryTriggered && move.secondary?.boosts) {
            applyStageBoost(nextStages, monKey(target), move.secondary.boosts, roundLog, target.name, target, { fromOpponent: true })
          }
          const status = move.status ?? (secondaryTriggered ? move.secondary?.status : null)
          if (status && STATUS_INFO[status] && !moveStatusIsBlocked(move, target, status, currentWeather)) {
            target.status = status
            if (status === 'slp') target.sleepTurns = 1 + Math.floor(Math.random() * 3)
            roundLog.push(`${target.name} bị ${STATUS_INFO[status].label.toLowerCase()}!`)
            const itemCure = afterStatusHeldItem(target, berryBlocked)
            Object.assign(target, itemCure.mon)
            roundLog.push(...itemCure.logs)
          }
        }
      } else {
        roundLog.push(`${target.name} đã gục!`)
        const knockout = knockoutAbilityEffect(actor)
        if (knockout && actor.hp > 0) {
          applyStageBoost(nextStages, monKey(actor), knockout.boosts, roundLog, actor.name, actor)
          roundLog.push(knockout.log)
        }
      }

      if (totalDealt > 0 && move.drain && actor.hp > 0) {
        const heal = ratioValue(move.drain, totalDealt)
        const before = actor.hp
        actor.hp = Math.min(actor.maxHp, actor.hp + heal)
        if (actor.hp > before) roundLog.push(`${actor.name} hút lại ${actor.hp - before} HP.`)
      }
      if (totalDealt > 0 && move.recoil && actor.hp > 0 && !hasAbility(actor, 'Rock Head', 'Magic Guard')) {
        const recoil = ratioValue(move.recoil, totalDealt)
        actor.hp = Math.max(0, actor.hp - recoil)
        roundLog.push(`${actor.name} chịu ${recoil} sát thương phản lực.`)
      }
      return totalDealt
    }

    const enemyActions = nextEnemies.map((enemy, enemyIndex) => {
      if (!enemy || enemy.hp <= 0) return null
      const livingSlots = nextIds.map((id, slot) => ({ slot, mon: nextTeam.find((entry) => monKey(entry) === id) })).filter(({ mon }) => mon?.hp > 0)
      if (!livingSlots.length) return null
      const targetSlot = livingSlots[Math.floor(Math.random() * livingSlots.length)].slot
      const usableMoves = (enemy.moves ?? []).filter((move) => move && heldItemMoveAllowed(enemy, move).allowed)
      if (!usableMoves.length) return null
      const move = usableMoves[Math.floor(Math.random() * usableMoves.length)]
      return {
        side: 'enemy', actorIndex: enemyIndex, targetSlot, move,
        priority: movePriorityWithAbility(move, enemy) + heldItemPriorityPenalty(enemy),
        speed: effectiveSpeed(enemy, nextStages[monKey(enemy)], weatherKey()) * heldItemSpeedMultiplier(enemy),
      }
    }).filter(Boolean)

    const playerActions = requiredSlots.map((slot) => {
      const action = actions[slot]
      const actor = nextTeam.find((mon) => monKey(mon) === nextIds[slot])
      if (!action || !actor) return null
      const priority = action.type === 'switch' ? 7 : action.type === 'item' ? 6 : movePriorityWithAbility(action.move, actor) + heldItemPriorityPenalty(actor)
      return {
        ...action, side: 'player', actorSlot: slot, actorUid: monKey(actor), priority,
        speed: effectiveSpeed(actor, nextStages[monKey(actor)], weatherKey()) * heldItemSpeedMultiplier(actor),
      }
    }).filter(Boolean)

    const queue = [...playerActions, ...enemyActions].sort((a, b) => b.priority - a.priority || b.speed - a.speed || Math.random() - 0.5)
    const consumedThisRound = new Map()

    for (const action of queue) {
      if (action.side === 'player') {
        let actor = nextTeam.find((mon) => monKey(mon) === nextIds[action.actorSlot])
        if (!actor || actor.hp <= 0) continue
        if (action.type === 'switch') {
          const target = nextTeam.find((mon) => monKey(mon) === action.targetUid)
          if (!target || target.hp <= 0 || nextIds.includes(monKey(target))) continue
          const withdrawn = clearHeldItemVolatile(switchOutAbility(actor))
          const at = nextTeam.findIndex((mon) => monKey(mon) === monKey(actor))
          if (at >= 0) nextTeam[at] = withdrawn
          roundLog.push(`Bạn thu ${actor.name} về và tung ${target.name} vào vị trí ${action.actorSlot + 1}!`)
          nextIds[action.actorSlot] = monKey(target)
          participantsRef.current.add(monKey(target))
          applyEntryLocal(target, 'player')
          continue
        }
        if (action.type === 'item') {
          const target = nextTeam.find((mon) => monKey(mon) === nextIds[action.targetSlot])
          if (!target || target.hp <= 0) continue
          const heal = HEAL_AMOUNT[action.item.id]
          const cures = STATUS_CURE[action.item.id]
          const canHeal = heal !== undefined && target.hp < target.maxHp
          const canCure = Boolean(cures?.includes(target.status))
          // Không tiêu hao vật phẩm và không mất lượt nếu món đó hoàn toàn
          // không có tác dụng lên mục tiêu hiện tại.
          if (!canHeal && !canCure) {
            roundLog.push(`${action.item.name} không có tác dụng lên ${target.name}; vật phẩm không bị trừ.`)
            continue
          }
          const reserved = consumedThisRound.get(action.item.id) ?? 0
          const available = action.item.infinite ? Infinity : Number(action.item.qty ?? 1)
          if (reserved >= available) {
            roundLog.push(`${action.item.name} không còn đủ để dùng lần thứ ${reserved + 1} trong cùng lượt.`)
            continue
          }
          consumedThisRound.set(action.item.id, reserved + 1)
          if (canHeal) {
            const before = target.hp
            target.hp = Math.min(target.maxHp, target.hp + heal)
            roundLog.push(`Dùng ${action.item.name} cho ${target.name}: hồi ${target.hp - before} HP.`)
          }
          if (canCure) {
            target.status = null
            delete target.sleepTurns
            roundLog.push(`${target.name} đã khỏi trạng thái xấu.`)
          }
          consumeItem(action.item.id)
          continue
        }
        const movePermission = heldItemMoveAllowed(actor, action.move)
        if (!movePermission.allowed) { roundLog.push(`${actor.name} không thể hành động: ${movePermission.reason}`); continue }
        Object.assign(actor, lockChoiceMove(actor, action.move))
        if (!canAct(actor, roundLog)) continue
        const move = action.move
        const playerWeather = moveWeatherKey(move)
        if (playerWeather) {
          roundEnv = getBattleEnv(playerWeather)
          roundWeatherTurns = weatherTurnsFromHeldItem(actor, playerWeather, 5)
          roundLog.push(`${actor.name} dùng ${move.name} và làm thay đổi thời tiết!`)
        }
        if (move.target === 'self') {
          roundLog.push(`${actor.name} dùng ${move.name}.`)
          if (move.heal) {
            const before = actor.hp
            actor.hp = Math.min(actor.maxHp, actor.hp + ratioValue(move.heal, actor.maxHp))
            if (actor.hp > before) roundLog.push(`${actor.name} hồi ${actor.hp - before} HP.`)
          }
          applyStageBoost(nextStages, monKey(actor), move.boosts, roundLog, actor.name, actor)
          if (move.self?.boosts && Math.random() * 100 < (move.self.chance ?? 100)) {
            applyStageBoost(nextStages, monKey(actor), move.self.boosts, roundLog, actor.name, actor)
          }
          const selfStatus = move.status ?? move.self?.status
          if (selfStatus && !moveStatusIsBlocked(move, actor, selfStatus, weatherKey())) {
            actor.status = selfStatus
            if (selfStatus === 'slp') actor.sleepTurns = 1 + Math.floor(Math.random() * 3)
            roundLog.push(`${actor.name} bị ${STATUS_INFO[selfStatus]?.label?.toLowerCase() ?? selfStatus}.`)
            const itemCure = afterStatusHeldItem(actor, nextEnemies.some((mon) => mon?.hp > 0 && hasAbility(mon, 'Unnerve')))
            Object.assign(actor, itemCure.mon)
            roundLog.push(...itemCure.logs)
          }
          continue
        }
        const originalTarget = nextEnemies[action.targetIndex]?.hp > 0
          ? nextEnemies[action.targetIndex] : nextEnemies.find((enemy) => enemy.hp > 0)
        const redirectedTarget = redirectTargetByAbility(move, nextEnemies, originalTarget)
        const targetIndexes = isSpreadMove(move)
          ? nextEnemies.map((enemy, index) => enemy.hp > 0 ? index : -1).filter((index) => index >= 0)
          : [nextEnemies.findIndex((enemy) => enemy === redirectedTarget)].filter((index) => index >= 0)
        const spreadPenalty = targetIndexes.length > 1 ? 0.75 : 1
        let moveTotalDamage = 0
        for (const targetIndex of targetIndexes) {
          const target = nextEnemies[targetIndex]
          if (target?.hp > 0) moveTotalDamage += damageTarget(actor, target, move, spreadPenalty)
        }
        const attackerItemAfter = afterMoveHeldItem({ attacker: actor, move, totalDamage: moveTotalDamage })
        Object.assign(actor, attackerItemAfter.attacker)
        roundLog.push(...attackerItemAfter.logs)
        if (actor.hp > 0 && move.self?.boosts && Math.random() * 100 < (move.self.chance ?? 100)) {
          applyStageBoost(nextStages, monKey(actor), move.self.boosts, roundLog, actor.name, actor)
        }
      } else {
        const actor = nextEnemies[action.actorIndex]
        if (!actor || actor.hp <= 0) continue
        const movePermission = heldItemMoveAllowed(actor, action.move)
        if (!movePermission.allowed) { roundLog.push(`${actor.name} không thể hành động: ${movePermission.reason}`); continue }
        Object.assign(actor, lockChoiceMove(actor, action.move))
        if (!canAct(actor, roundLog)) continue
        const move = action.move
        const enemyWeather = moveWeatherKey(move)
        if (enemyWeather) {
          roundEnv = getBattleEnv(enemyWeather)
          roundWeatherTurns = weatherTurnsFromHeldItem(actor, enemyWeather, 5)
          roundLog.push(`${actor.name} dùng ${move.name} và làm thay đổi thời tiết!`)
        }
        if (move.target === 'self') {
          roundLog.push(`${actor.name} dùng ${move.name}.`)
          if (move.heal) {
            const before = actor.hp
            actor.hp = Math.min(actor.maxHp, actor.hp + ratioValue(move.heal, actor.maxHp))
            if (actor.hp > before) roundLog.push(`${actor.name} hồi ${actor.hp - before} HP.`)
          }
          applyStageBoost(nextStages, monKey(actor), move.boosts, roundLog, actor.name, actor)
          if (move.self?.boosts && Math.random() * 100 < (move.self.chance ?? 100)) {
            applyStageBoost(nextStages, monKey(actor), move.self.boosts, roundLog, actor.name, actor)
          }
          const selfStatus = move.status ?? move.self?.status
          if (selfStatus && !moveStatusIsBlocked(move, actor, selfStatus, weatherKey())) {
            actor.status = selfStatus
            if (selfStatus === 'slp') actor.sleepTurns = 1 + Math.floor(Math.random() * 3)
            roundLog.push(`${actor.name} bị ${STATUS_INFO[selfStatus]?.label?.toLowerCase() ?? selfStatus}.`)
            const itemCure = afterStatusHeldItem(actor, activePlayers().some((mon) => mon?.hp > 0 && hasAbility(mon, 'Unnerve')))
            Object.assign(actor, itemCure.mon)
            roundLog.push(...itemCure.logs)
          }
          continue
        }
        const originalTarget = nextTeam.find((mon) => monKey(mon) === nextIds[action.targetSlot])
        if (!originalTarget || originalTarget.hp <= 0) continue
        const activeTargets = nextIds.map((id) => nextTeam.find((mon) => monKey(mon) === id)).filter((mon) => mon?.hp > 0)
        const target = redirectTargetByAbility(move, activeTargets, originalTarget)
        const targets = isSpreadMove(move) ? activeTargets : [target]
        const spreadPenalty = targets.length > 1 ? 0.75 : 1
        let moveTotalDamage = 0
        for (const playerTarget of targets) moveTotalDamage += damageTarget(actor, playerTarget, move, spreadPenalty)
        const attackerItemAfter = afterMoveHeldItem({ attacker: actor, move, totalDamage: moveTotalDamage })
        Object.assign(actor, attackerItemAfter.attacker)
        roundLog.push(...attackerItemAfter.logs)
        if (actor.hp > 0 && move.self?.boosts && Math.random() * 100 < (move.self.chance ?? 100)) {
          applyStageBoost(nextStages, monKey(actor), move.self.boosts, roundLog, actor.name, actor)
        }
      }
    }

    const activeEndMons = [...activePlayers(), ...nextEnemies]
    for (const mon of activeEndMons) {
      const statusEnd = endTurnStatusEffect(mon)
      Object.assign(mon, statusEnd.mon)
      roundLog.push(...statusEnd.logs)
    }
    const effectiveEndWeather = weatherIsSuppressed(activeEndMons) ? null : roundEnv?.key
    for (const mon of activeEndMons) {
      const result = endTurnAbilityEffect(mon, effectiveEndWeather)
      Object.assign(mon, result.mon)
      if (result.boosts) applyStageBoost(nextStages, monKey(mon), result.boosts, roundLog, mon.name, mon)
      roundLog.push(...result.logs)
    }
    for (const mon of activeEndMons) {
      const isEnemyMon = nextEnemies.some((entry) => monKey(entry) === monKey(mon))
      const opponents = isEnemyMon ? activePlayers() : nextEnemies
      const result = endTurnHeldItemEffect(mon, opponents.some((entry) => entry?.hp > 0 && hasAbility(entry, 'Unnerve')))
      Object.assign(mon, result.mon)
      roundLog.push(...result.logs)
    }

    if (roundWeatherTurns !== null) {
      roundWeatherTurns -= 1
      if (roundWeatherTurns <= 0) {
        roundEnv = environment ?? getBattleEnv('none')
        roundWeatherTurns = null
        roundLog.push('Hiệu ứng thời tiết đã tan.')
      }
    }

    setTeam(nextTeam)
    setEnemies(nextEnemies)
    setActiveIds(nextIds)
    setStages(nextStages)
    setBattleEnv(roundEnv)
    setWeatherTurns(roundWeatherTurns)
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
      mode: 'double',
      enemies: enemies.map((mon) => restoreTransientHeldItem(clearHeldItemVolatile(clearBattleVolatile(mon)))),
      team: team.map((mon) => restoreTransientHeldItem(clearHeldItemVolatile(clearBattleVolatile(mon)))),
      participantUids: [...participantsRef.current], leadUid: lead,
    })
  }

  function buildBattleRuntime() {
    return {
      enemies: enemies.map(cloneMon),
      team: team.map(cloneMon),
      activeIds: [...activeIds],
      stages: Object.fromEntries(Object.entries(stages).map(([key, value]) => [key, { ...value }])),
      log: [...log],
      battleEnvKey: battleEnv?.key ?? 'none',
      weatherTurns,
      entryAbilitiesApplied: entryAbilitiesAppliedRef.current,
      participantUids: [...participantsRef.current],
    }
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
          {!finished && <button className="btn" onClick={() => onClose?.(buildBattleRuntime())}>✕ Ẩn (trận vẫn tiếp diễn)</button>}
        </div>

        {battleEnv && battleEnv.key !== 'none' && <div style={{ fontSize: 10.5, color: 'var(--text-mid)', border: '1px dashed var(--line)', borderRadius: 8, padding: '5px 9px', marginBottom: 9 }}>{battleEnv.label} — {battleEnv.desc}{weatherTurns !== null ? ` · còn ${weatherTurns} lượt` : ''}</div>}

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
                    <button key={move.name} className="btn" disabled={busy || selectedMon.hp <= 0 || !heldItemMoveAllowed(selectedMon, move).allowed} title={heldItemMoveAllowed(selectedMon, move).reason} onClick={() => chooseMove(selectedSlot, move)} style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
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
