// ============ ABILITY POKÉMON — CƠ CHẾ THẬT (đợt 77) ============
// Showdown cung cấp tên Ability trong pokedex.json nhưng trước đây app bỏ
// field này khi chuẩn hoá loài, nên mọi Pokémon vào trận đều không có Ability.
// File này giữ phần logic THUẦN để cả BattleModal và DoubleBattleModal dùng
// cùng một nguồn, tránh mỗi hệ trận tự diễn giải khác nhau.

export function abilityId(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function abilityName(mon) {
  if (!mon) return ''
  if (typeof mon.ability === 'string') return mon.ability
  return mon.ability?.name ?? ''
}

export function hasAbility(mon, ...names) {
  const current = abilityId(abilityName(mon))
  return names.some((name) => current === abilityId(name))
}

export function normalizeAbilityOptions(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw
      .map((entry, index) => typeof entry === 'string'
        ? { slot: String(index), name: entry, hidden: false, special: false }
        : { slot: String(entry.slot ?? index), name: entry.name, hidden: Boolean(entry.hidden), special: Boolean(entry.special) || String(entry.slot) === 'S' })
      .filter((entry) => entry.name)
  }
  if (typeof raw === 'object') {
    return Object.entries(raw)
      .filter(([, name]) => typeof name === 'string' && name.trim())
      .map(([slot, name]) => ({ slot, name, hidden: slot === 'H', special: slot === 'S' }))
  }
  return []
}

function hashSeed(value) {
  const text = String(value ?? '')
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Chọn Ability ổn định cho save cũ. Ability ẩn chỉ xuất hiện khoảng 10%. */
export function pickAbility(options, seed = '') {
  const list = normalizeAbilityOptions(options)
  if (!list.length) return { name: 'Không rõ', slot: null, hidden: false }
  const normal = list.filter((entry) => !entry.hidden && !entry.special && String(entry.slot) !== 'S')
  const hidden = list.filter((entry) => entry.hidden && !entry.special)
  const roll = hashSeed(seed || list.map((entry) => entry.name).join('|'))
  if (hidden.length && roll % 10 === 0) {
    const chosen = hidden[roll % hidden.length]
    return { name: chosen.name, slot: chosen.slot, hidden: true }
  }
  const pool = normal.length ? normal : list.filter((entry) => !entry.special && String(entry.slot) !== 'S').length
    ? list.filter((entry) => !entry.special && String(entry.slot) !== 'S')
    : list
  const chosen = pool[roll % pool.length]
  return { name: chosen.name, slot: chosen.slot, hidden: Boolean(chosen.hidden) }
}

export function resolveAbilityForEntry(entry, preferredSlot = null, seed = '') {
  const options = normalizeAbilityOptions(entry?.abilities)
  if (!options.length) return { name: 'Không rõ', slot: null, hidden: false }
  if (preferredSlot !== null && preferredSlot !== undefined) {
    const exact = options.find((item) => String(item.slot) === String(preferredSlot))
    if (exact) return { name: exact.name, slot: exact.slot, hidden: Boolean(exact.hidden) }
  }
  return pickAbility(options, seed)
}

export function ensureMonAbility(mon, pokedex = []) {
  if (!mon) return mon
  if (abilityName(mon) && abilityName(mon) !== 'Không rõ') return mon
  const key = abilityId(mon.species ?? mon.name)
  const entry = (pokedex ?? []).find((item) =>
    abilityId(item.species) === key || abilityId(item.name) === key,
  )
  const picked = resolveAbilityForEntry(entry, mon.abilitySlot, mon.uid ?? `${mon.species}-${mon.level}`)
  return { ...mon, ability: picked.name, abilitySlot: picked.slot, abilityHidden: picked.hidden }
}

export const ABILITY_WEATHER = {
  drizzle: 'rain',
  primordialsea: 'rain',
  drought: 'sun',
  desolateland: 'sun',
  orichalcumpulse: 'sun',
  sandstream: 'sandstorm',
  snowwarning: 'snow',
}

export function weatherFromAbility(mon) {
  return ABILITY_WEATHER[abilityId(abilityName(mon))] ?? null
}

export function weatherIsSuppressed(mons = []) {
  return mons.some((mon) => mon?.hp > 0 && hasAbility(mon, 'Cloud Nine', 'Air Lock'))
}

export function abilityLabel(mon) {
  const name = abilityName(mon)
  return name && name !== 'Không rõ' ? name : 'Chưa xác định'
}

export function blocksStatus(mon, status, weatherKey = null) {
  if (!mon || !status) return false
  if (status === 'brn' && hasAbility(mon, 'Water Veil', 'Water Bubble')) return true
  if (status === 'par' && hasAbility(mon, 'Limber')) return true
  if (status === 'slp' && hasAbility(mon, 'Insomnia', 'Vital Spirit', 'Sweet Veil')) return true
  if ((status === 'psn' || status === 'tox') && hasAbility(mon, 'Immunity', 'Pastel Veil')) return true
  if (status === 'frz' && hasAbility(mon, 'Magma Armor')) return true
  if (weatherKey === 'sun' && hasAbility(mon, 'Leaf Guard')) return true
  return false
}

/** Miễn nhiễm trạng thái dùng chung cho đánh đơn/đôi. */
export function statusIsBlocked(mon, status, weatherKey = null) {
  if (!mon || !status || mon.status) return true
  const types = mon.types ?? []
  if (status === 'brn' && types.includes('fire')) return true
  if (status === 'par' && types.includes('electric')) return true
  if ((status === 'psn' || status === 'tox') && (types.includes('poison') || types.includes('steel'))) return true
  if (status === 'frz' && types.includes('ice')) return true
  return blocksStatus(mon, status, weatherKey)
}

/**
 * Miễn nhiễm riêng của CHIÊU gây trạng thái. Không thể dùng bảng khắc hệ cho
 * mọi Status move (Growl vẫn phải tác dụng lên Ghost), nên chỉ chặn những
 * trường hợp luật game quy định rõ: Thunder Wave không tác dụng lên Ground;
 * chiêu bột không tác dụng lên Grass hoặc Pokémon có Overcoat.
 */
export function moveStatusIsBlocked(move, mon, status, weatherKey = null) {
  if (statusIsBlocked(mon, status, weatherKey)) return true
  const moveKey = abilityId(move?.name)
  if (moveKey === 'thunderwave' && mon?.types?.includes('ground')) return true
  if (move?.flags?.powder && (mon?.types?.includes('grass') || hasAbility(mon, 'Overcoat'))) return true
  return false
}

/** Phòng thủ đặc biệt theo thời tiết thật: Rock dưới cát, Ice dưới tuyết. */
export function weatherDefenseMultiplier(defender, move, weatherKey = null) {
  if (!defender || !move) return 1
  if (weatherKey === 'sandstorm' && move.category === 'Special' && defender.types?.includes('rock')) return 1.5
  if (weatherKey === 'snow' && move.category !== 'Special' && defender.types?.includes('ice')) return 1.5
  return 1
}

export function effectiveSpeed(mon, stages = {}, weatherKey = null) {
  if (!mon) return 0
  let speed = (mon.stats?.spe ?? mon.level ?? 1)
  const stage = stages?.spe ?? 0
  speed *= stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage)
  // Quick Feet vừa tăng Speed vừa bỏ hình phạt giảm tốc do tê liệt.
  if (mon.status === 'par' && !hasAbility(mon, 'Quick Feet')) speed *= 0.5
  if (weatherKey === 'rain' && hasAbility(mon, 'Swift Swim')) speed *= 2
  if (weatherKey === 'sun' && hasAbility(mon, 'Chlorophyll')) speed *= 2
  if (weatherKey === 'sandstorm' && hasAbility(mon, 'Sand Rush')) speed *= 2
  if (weatherKey === 'snow' && hasAbility(mon, 'Slush Rush')) speed *= 2
  if (hasAbility(mon, 'Quick Feet') && mon.status) speed *= 1.5
  return speed
}

export function accuracyMultiplier(attacker, defender, weatherKey = null, move = null) {
  if (hasAbility(attacker, 'No Guard') || hasAbility(defender, 'No Guard')) return Infinity
  const moveKey = abilityId(move?.name)
  // Thunder/Hurricane luôn trúng dưới mưa và giảm còn 50% dưới nắng.
  if (weatherKey === 'rain' && ['thunder', 'hurricane'].includes(moveKey)) return Infinity
  let mult = 1
  if (weatherKey === 'sun' && ['thunder', 'hurricane'].includes(moveKey)) mult *= 0.5
  if (hasAbility(attacker, 'Compound Eyes')) mult *= 1.3
  if (hasAbility(attacker, 'Victory Star')) mult *= 1.1
  // Hustle chỉ giảm độ chính xác của chiêu Vật Lý, không làm Status/Special trượt oan.
  if (hasAbility(attacker, 'Hustle') && move?.category === 'Physical') mult *= 0.8
  if (weatherKey === 'sandstorm' && hasAbility(defender, 'Sand Veil')) mult *= 0.8
  if (weatherKey === 'snow' && hasAbility(defender, 'Snow Cloak')) mult *= 0.8
  if (hasAbility(defender, 'Tangled Feet') && defender?.confused) mult *= 0.8
  return mult
}

function accuracyStageMultiplier(stage = 0) {
  const value = Math.max(-6, Math.min(6, Number(stage) || 0))
  return value >= 0 ? (3 + value) / 3 : 3 / (3 - value)
}

export function moveHitsWithAbilities(move, attacker, defender, weatherKey = null, attackerStages = {}, defenderStages = {}) {
  const mult = accuracyMultiplier(attacker, defender, weatherKey, move)
  if (mult === Infinity || move?.accuracy === true || move?.accuracy === undefined || move?.accuracy === null) return true
  const accuracy = Math.max(1, Math.min(100, Number(move.accuracy) || 100))
  const stageMult = accuracyStageMultiplier((attackerStages?.acc ?? 0) - (defenderStages?.eva ?? 0))
  return Math.random() * 100 < Math.min(100, accuracy * mult * stageMult)
}

function moveFlag(move, ...flags) {
  return flags.some((flag) => Boolean(move?.flags?.[flag]))
}

/**
 * Áp Ability lên sát thương đã qua công thức + thời tiết.
 * Trả thêm heal/boost để component cập nhật state thật, không giấu thay đổi
 * trong một con số damage khó kiểm chứng.
 */
export function modifyDamageByAbilities({ damage, move, attacker, defender, weatherKey = null, effectiveness = 1 }) {
  let next = Math.max(0, Number(damage) || 0)
  const logs = []
  let healDefender = 0
  let attackerBoost = null
  let defenderBoost = null
  let suppressSecondary = false
  let sturdy = false

  const bypass = hasAbility(attacker, 'Mold Breaker', 'Teravolt', 'Turboblaze')
  const moveType = move?.type
  const physical = move?.category !== 'Special'
  const special = move?.category === 'Special'

  // Miễn nhiễm hệ của CHIÊU GÂY SÁT THƯƠNG phải chặn luôn hiệu ứng phụ.
  // Trước đây computeDamage trả 0 nhưng component vẫn có thể gây bỏng/tê
  // liệt hoặc giảm chỉ số sau một đòn vốn không có tác dụng.
  if (Number(move?.power ?? 0) > 0 && effectiveness === 0) {
    return { damage: 0, immune: true, healDefender, attackerBoost, defenderBoost, logs, suppressSecondary, sturdy }
  }

  if (!bypass) {
    const defenderHeldId = String(defender?.heldItem?.id ?? defender?.heldItem?.name ?? defender?.heldItem ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const groundedByIronBall = defenderHeldId === 'ironball' && !hasAbility(defender, 'Klutz')
    if (moveType === 'ground' && hasAbility(defender, 'Levitate') && !groundedByIronBall) {
      logs.push(`${defender.name} miễn nhiễm chiêu hệ Đất nhờ Levitate!`)
      return { damage: 0, immune: true, healDefender, attackerBoost, defenderBoost, logs, suppressSecondary, sturdy }
    }
    if (hasAbility(defender, 'Wonder Guard') && effectiveness <= 1 && next > 0) {
      logs.push(`Wonder Guard của ${defender.name} chặn đòn không siêu hiệu quả!`)
      return { damage: 0, immune: true, healDefender, attackerBoost, defenderBoost, logs, suppressSecondary, sturdy }
    }
    const absorb =
      (moveType === 'water' && hasAbility(defender, 'Water Absorb', 'Dry Skin', 'Storm Drain'))
      || (moveType === 'electric' && hasAbility(defender, 'Volt Absorb', 'Lightning Rod', 'Motor Drive'))
      || (moveType === 'grass' && hasAbility(defender, 'Sap Sipper'))
      || (moveType === 'fire' && hasAbility(defender, 'Flash Fire'))
    if (absorb) {
      if (hasAbility(defender, 'Water Absorb', 'Volt Absorb', 'Dry Skin')) healDefender = Math.max(1, Math.round(defender.maxHp / 4))
      if (hasAbility(defender, 'Storm Drain', 'Lightning Rod')) defenderBoost = { spa: 1 }
      if (hasAbility(defender, 'Motor Drive')) defenderBoost = { spe: 1 }
      if (hasAbility(defender, 'Sap Sipper')) defenderBoost = { atk: 1 }
      if (hasAbility(defender, 'Flash Fire')) defenderBoost = { flashFire: 1 }
      logs.push(`${abilityLabel(defender)} của ${defender.name} vô hiệu hoá chiêu hệ ${String(moveType).toUpperCase()}!`)
      return { damage: 0, immune: true, healDefender, attackerBoost, defenderBoost, logs, suppressSecondary, sturdy }
    }
    if (hasAbility(defender, 'Soundproof') && moveFlag(move, 'sound')) {
      logs.push(`Soundproof của ${defender.name} chặn chiêu âm thanh!`)
      return { damage: 0, immune: true, healDefender, attackerBoost, defenderBoost, logs, suppressSecondary, sturdy }
    }
    if (hasAbility(defender, 'Bulletproof') && moveFlag(move, 'bullet')) {
      logs.push(`Bulletproof của ${defender.name} chặn chiêu dạng đạn!`)
      return { damage: 0, immune: true, healDefender, attackerBoost, defenderBoost, logs, suppressSecondary, sturdy }
    }
    if (hasAbility(defender, 'Thick Fat') && ['fire', 'ice'].includes(moveType)) next *= 0.5
    // Water Bubble vừa chặn bỏng, vừa giảm nửa sát thương hệ Lửa nhận vào.
    if (hasAbility(defender, 'Water Bubble') && moveType === 'fire') next *= 0.5
    if (hasAbility(defender, 'Heatproof') && moveType === 'fire') next *= 0.5
    if (hasAbility(defender, 'Dry Skin') && moveType === 'fire') next *= 1.25
    if (hasAbility(defender, 'Filter', 'Solid Rock', 'Prism Armor') && effectiveness > 1) next *= 0.75
    if (hasAbility(defender, 'Multiscale', 'Shadow Shield') && defender.hp >= defender.maxHp) next *= 0.5
    if (hasAbility(defender, 'Fur Coat') && physical) next *= 0.5
    if (hasAbility(defender, 'Ice Scales') && special) next *= 0.5
    if (hasAbility(defender, 'Marvel Scale') && physical && defender.status) next /= 1.5
    if (hasAbility(defender, 'Fluffy')) {
      if (moveFlag(move, 'contact')) next *= 0.5
      if (moveType === 'fire') next *= 2
    }
  }

  if (hasAbility(attacker, 'Huge Power', 'Pure Power') && physical) next *= 2
  // Water Bubble nhân đôi sức mạnh chiêu Nước của chính Pokémon sở hữu.
  if (hasAbility(attacker, 'Water Bubble') && moveType === 'water') next *= 2
  if (hasAbility(attacker, 'Guts') && physical && attacker.status) next *= 1.5
  if (hasAbility(attacker, 'Hustle') && physical) next *= 1.5
  if (hasAbility(attacker, 'Technician') && Number(move?.power) > 0 && Number(move.power) <= 60) next *= 1.5
  if (hasAbility(attacker, 'Adaptability') && attacker.types?.includes(moveType)) next *= 4 / 3
  if (hasAbility(attacker, 'Tinted Lens') && effectiveness > 0 && effectiveness < 1) next *= 2
  if (hasAbility(attacker, 'Strong Jaw') && moveFlag(move, 'bite')) next *= 1.5
  if (hasAbility(attacker, 'Iron Fist') && moveFlag(move, 'punch')) next *= 1.2
  if (hasAbility(attacker, 'Tough Claws') && moveFlag(move, 'contact')) next *= 1.3
  if (hasAbility(attacker, 'Sharpness') && moveFlag(move, 'slicing')) next *= 1.5
  if (hasAbility(attacker, 'Mega Launcher') && moveFlag(move, 'pulse')) next *= 1.5
  if (hasAbility(attacker, 'Punk Rock') && moveFlag(move, 'sound')) next *= 1.3
  if (hasAbility(defender, 'Punk Rock') && moveFlag(move, 'sound') && !bypass) next *= 0.5
  if (hasAbility(attacker, 'Sheer Force') && move?.secondary) {
    next *= 1.3
    suppressSecondary = true
  }
  if (attacker.hp <= attacker.maxHp / 3) {
    if (moveType === 'fire' && hasAbility(attacker, 'Blaze')) next *= 1.5
    if (moveType === 'water' && hasAbility(attacker, 'Torrent')) next *= 1.5
    if (moveType === 'grass' && hasAbility(attacker, 'Overgrow')) next *= 1.5
    if (moveType === 'bug' && hasAbility(attacker, 'Swarm')) next *= 1.5
  }
  if (weatherKey === 'sun' && special && hasAbility(attacker, 'Solar Power')) next *= 1.5
  if (weatherKey === 'sandstorm' && ['rock', 'ground', 'steel'].includes(moveType) && hasAbility(attacker, 'Sand Force')) next *= 1.3
  if (moveType === 'fire' && attacker.flashFireBoost) next *= 1.5

  // Ability phản ứng khi bị trúng đòn. Boost được trả về để component áp vào
  // đúng bậc chỉ số, không sửa state âm thầm trong hàm tính damage.
  if (!bypass && next > 0) {
    if (hasAbility(defender, 'Stamina')) defenderBoost = { ...(defenderBoost ?? {}), def: 1 }
    if (physical && hasAbility(defender, 'Weak Armor')) defenderBoost = { ...(defenderBoost ?? {}), def: -1, spe: 2 }
    if (moveType === 'dark' && hasAbility(defender, 'Justified')) defenderBoost = { ...(defenderBoost ?? {}), atk: 1 }
    if (['bug', 'dark', 'ghost'].includes(moveType) && hasAbility(defender, 'Rattled')) defenderBoost = { ...(defenderBoost ?? {}), spe: 1 }
    if (moveType === 'water' && hasAbility(defender, 'Water Compaction')) defenderBoost = { ...(defenderBoost ?? {}), def: 2 }
    if (['fire', 'water'].includes(moveType) && hasAbility(defender, 'Steam Engine')) defenderBoost = { ...(defenderBoost ?? {}), spe: 6 }
  }

  if (!bypass && hasAbility(defender, 'Sturdy') && defender.hp === defender.maxHp && next >= defender.hp) {
    next = Math.max(0, defender.hp - 1)
    sturdy = true
    logs.push(`Sturdy giúp ${defender.name} trụ lại với 1 HP!`)
  }

  return {
    damage: next > 0 ? Math.max(1, Math.round(next)) : 0,
    immune: false,
    healDefender,
    attackerBoost,
    defenderBoost,
    logs,
    suppressSecondary,
    sturdy,
  }
}

/** Phản ứng Ability sau chiêu tiếp xúc. */
export function contactAbilityEffect(attacker, defender, move, damageDone) {
  if (!moveFlag(move, 'contact') || damageDone <= 0) return null
  if (hasAbility(defender, 'Rough Skin', 'Iron Barbs')) {
    return { recoil: Math.max(1, Math.round(attacker.maxHp / 8)), log: `${attacker.name} bị ${abilityLabel(defender)} làm tổn thương!` }
  }
  // Kiểm tra miễn nhiễm NGAY TẠI ĐÂY trước khi tạo log. Component từng
  // chặn status sau đó nhưng dòng log đã được trả về, khiến UI tuyên bố một
  // Pokémon hệ Điện bị Static làm tê hoặc hệ Lửa bị Flame Body làm bỏng.
  if (hasAbility(defender, 'Static') && !statusIsBlocked(attacker, 'par') && Math.random() < 0.3) {
    return { status: 'par', log: `${attacker.name} bị tê liệt vì Static!` }
  }
  if (hasAbility(defender, 'Flame Body') && !statusIsBlocked(attacker, 'brn') && Math.random() < 0.3) {
    return { status: 'brn', log: `${attacker.name} bị bỏng vì Flame Body!` }
  }
  if (hasAbility(defender, 'Poison Point') && !statusIsBlocked(attacker, 'psn') && Math.random() < 0.3) {
    return { status: 'psn', log: `${attacker.name} bị nhiễm độc vì Poison Point!` }
  }
  return null
}

export function switchOutAbility(mon) {
  if (!mon) return mon
  let next = { ...mon }
  // Flash Fire chỉ tồn tại khi cá thể còn ở trên sân.
  delete next.flashFireBoost
  if (hasAbility(mon, 'Regenerator') && mon.hp > 0) {
    next.hp = Math.min(mon.maxHp, mon.hp + Math.max(1, Math.round(mon.maxHp / 3)))
  }
  if (hasAbility(mon, 'Natural Cure')) {
    next.status = null
    delete next.sleepTurns
  }
  return next
}

/** Sát thương trạng thái cuối lượt, dùng chung để Poison Heal không bị trừ máu trước khi hồi. */
export function endTurnStatusEffect(mon) {
  if (!mon || mon.hp <= 0) return { mon, logs: [] }
  const next = { ...mon }
  const logs = []
  if (hasAbility(next, 'Magic Guard')) return { mon: next, logs }
  if (next.status === 'brn') {
    const tick = Math.max(1, Math.round(next.maxHp / 16))
    next.hp = Math.max(0, next.hp - tick)
    logs.push(`${next.name} bị bỏng, mất ${tick} HP.`)
  } else if ((next.status === 'psn' || next.status === 'tox') && !hasAbility(next, 'Poison Heal')) {
    if (next.status === 'tox') next.toxicCounter = Math.max(1, (next.toxicCounter ?? 0) + 1)
    const tick = next.status === 'tox'
      ? Math.max(1, Math.floor(next.maxHp * next.toxicCounter / 16))
      : Math.max(1, Math.round(next.maxHp / 8))
    next.hp = Math.max(0, next.hp - tick)
    logs.push(`${next.name} bị nhiễm độc, mất ${tick} HP.`)
  }
  return { mon: next, logs }
}

/** Xoá cờ chỉ hợp lệ trong một lần đứng sân trước khi ghi save lâu dài. */
export function clearBattleVolatile(mon) {
  if (!mon) return mon
  const next = { ...mon }
  delete next.flashFireBoost
  delete next.confused
  return next
}

/** Lightning Rod / Storm Drain hút chiêu đơn mục tiêu về đúng ô trong đấu đôi. */
export function redirectTargetByAbility(move, possibleTargets = [], originalTarget = null) {
  if (!move || !originalTarget || !possibleTargets.length) return originalTarget
  if (['allAdjacentFoes', 'allAdjacent', 'all'].includes(move.target)) return originalTarget
  const type = move.type
  const redirectors = possibleTargets.filter((mon) => mon?.hp > 0 && (
    (type === 'electric' && hasAbility(mon, 'Lightning Rod'))
    || (type === 'water' && hasAbility(mon, 'Storm Drain'))
  ))
  return redirectors[0] ?? originalTarget
}

/** Friend Guard giảm 25% sát thương cho đồng đội, không tự bảo vệ chính nó. */
export function allyGuardMultiplier(defender, allies = []) {
  return allies.some((ally) => ally?.hp > 0 && ally !== defender && hasAbility(ally, 'Friend Guard')) ? 0.75 : 1
}

/** Hiệu ứng cuối lượt của Ability + bão cát. */
export function endTurnAbilityEffect(mon, weatherKey = null) {
  if (!mon || mon.hp <= 0) return { mon, logs: [], boosts: null }
  let next = { ...mon }
  const logs = []
  let boosts = null
  const magicGuard = hasAbility(mon, 'Magic Guard')
  const heal = (amount, label) => {
    const before = next.hp
    next.hp = Math.min(next.maxHp, next.hp + amount)
    if (next.hp > before) logs.push(`${next.name} hồi ${next.hp - before} HP nhờ ${label}.`)
  }
  const hurt = (amount, label) => {
    if (magicGuard) return
    next.hp = Math.max(0, next.hp - amount)
    logs.push(`${next.name} mất ${amount} HP vì ${label}.`)
  }

  if (weatherKey === 'rain' && hasAbility(mon, 'Hydration') && next.status) {
    next.status = null
    delete next.sleepTurns
    logs.push(`${next.name} khỏi trạng thái xấu nhờ Hydration.`)
  }
  if (hasAbility(mon, 'Shed Skin') && next.status && Math.random() < 1 / 3) {
    next.status = null
    delete next.sleepTurns
    logs.push(`${next.name} lột bỏ trạng thái xấu nhờ Shed Skin.`)
  }
  if ((next.status === 'psn' || next.status === 'tox') && hasAbility(mon, 'Poison Heal')) heal(Math.max(1, Math.round(next.maxHp / 8)), 'Poison Heal')
  if (hasAbility(mon, 'Speed Boost')) boosts = { spe: 1 }
  if (weatherKey === 'rain' && hasAbility(mon, 'Rain Dish')) heal(Math.max(1, Math.round(next.maxHp / 16)), 'Rain Dish')
  if (weatherKey === 'rain' && hasAbility(mon, 'Dry Skin')) heal(Math.max(1, Math.round(next.maxHp / 8)), 'Dry Skin')
  if (weatherKey === 'snow' && hasAbility(mon, 'Ice Body')) heal(Math.max(1, Math.round(next.maxHp / 16)), 'Ice Body')
  if (weatherKey === 'sun' && hasAbility(mon, 'Dry Skin')) hurt(Math.max(1, Math.round(next.maxHp / 8)), 'nắng gắt và Dry Skin')
  if (weatherKey === 'sun' && hasAbility(mon, 'Solar Power')) hurt(Math.max(1, Math.round(next.maxHp / 8)), 'Solar Power')
  if (weatherKey === 'sandstorm'
    && !['rock', 'ground', 'steel'].some((type) => next.types?.includes(type))
    && !hasAbility(mon, 'Sand Veil', 'Sand Rush', 'Sand Force', 'Overcoat')) {
    hurt(Math.max(1, Math.round(next.maxHp / 16)), 'bão cát')
  }
  return { mon: next, logs, boosts }
}

/** Priority thực sau Ability. */
export function movePriorityWithAbility(move, attacker) {
  let priority = Number(move?.priority ?? 0)
  if ((move?.category === 'Status' || Number(move?.power ?? 0) <= 0) && hasAbility(attacker, 'Prankster')) priority += 1
  if (move?.type === 'flying' && attacker?.hp >= attacker?.maxHp && hasAbility(attacker, 'Gale Wings')) priority += 1
  if (move?.heal && hasAbility(attacker, 'Triage')) priority += 3
  return priority
}

/**
 * Điều chỉnh boost trước khi áp. Dùng cho Contrary/Simple và các Ability
 * ngăn giảm chỉ số. `fromOpponent` chỉ bật khi boost âm do phe đối diện.
 */
export function modifyBoostsByAbility(mon, boosts, { fromOpponent = false, intimidate = false } = {}) {
  if (!boosts || !mon) return boosts
  const out = {}
  for (const [stat, raw] of Object.entries(boosts)) {
    let delta = Number(raw) || 0
    if (!delta) continue
    if (fromOpponent && delta < 0) {
      if (hasAbility(mon, 'Clear Body', 'White Smoke', 'Full Metal Body')) delta = 0
      if (stat === 'atk' && hasAbility(mon, 'Hyper Cutter')) delta = 0
      if (stat === 'def' && hasAbility(mon, 'Big Pecks')) delta = 0
      if (intimidate && hasAbility(mon, 'Inner Focus', 'Oblivious', 'Own Tempo', 'Scrappy')) delta = 0
    }
    if (hasAbility(mon, 'Contrary')) delta *= -1
    if (hasAbility(mon, 'Simple')) delta *= 2
    if (delta) out[stat] = delta
  }
  return out
}

/** Ability kích hoạt khi hạ một đối thủ. */
export function knockoutAbilityEffect(mon) {
  if (!mon) return null
  if (hasAbility(mon, 'Moxie', 'Chilling Neigh', 'As One')) {
    return { boosts: { atk: 1 }, log: `${abilityLabel(mon)} của ${mon.name} tăng Tấn công sau khi hạ đối thủ!` }
  }
  if (hasAbility(mon, 'Grim Neigh')) {
    return { boosts: { spa: 1 }, log: `Grim Neigh của ${mon.name} tăng TC đặc biệt!` }
  }
  if (hasAbility(mon, 'Beast Boost')) {
    const stats = mon.stats ?? {}
    const stat = ['atk', 'def', 'spa', 'spd', 'spe'].sort((a, b) => (stats[b] ?? 0) - (stats[a] ?? 0))[0]
    return { boosts: { [stat]: 1 }, log: `Beast Boost của ${mon.name} tăng chỉ số mạnh nhất!` }
  }
  return null
}
