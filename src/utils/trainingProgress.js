import { recomputeMonStats, zeroEVs } from '../data/pokemonSpecies.js'
import { getBuiltInZhPokemonSpeciesNames, normalizeLocalizedPokemonName } from './pokemonNameTranslations.js'

// Dot151: training only grants mechanical progress when it has actually
// happened in the assistant's visible canon. Never infer from the USER's wish.
const TRAINING_CUE = /(?:luyện\s*tập|tập\s*luyện|huấn\s*luyện(?!\s*viên)|tập\s*chiêu|đối\s*luyện|tập\s*thể\s*lực|训练(?!家|师|员|者)|特训|锻炼|练习|对练|trained|training\s+session|practice\s+session|practic(?:ed|ing)|worked\s*out|buổi\s*tập)/iu
const NOT_COMPLETED = /(?:sẽ\s+(?:luyện\s*tập|tập\s*luyện|huấn\s*luyện)|(?:nghĩ\s+(?:tới|đến|về)|dự\s+định)\s+(?:một\s+)?(?:buổi\s+)?(?:luyện\s*tập|tập\s*luyện|huấn\s*luyện)|định\s+(?:luyện\s*tập|tập\s*luyện)|chưa\s+(?:luyện\s*tập|tập\s*luyện)|muốn\s+(?:luyện\s*tập|tập\s*luyện)|nếu\s+(?:luyện\s*tập|tập\s*luyện)|(?:准备|打算|将要|尚未|还没|如果|计划|想到|想着).{0,8}(?:训练|锻炼|练习)|(?:will|would|might|could|plans?\s+to|hasn['’]t|not\s+yet).{0,22}(?:train|practice))/iu
const TEAM_TRAINING = /(?:cả\s+đội|toàn\s+đội|tất\s+cả\s+pok[eé]mon|đội\s+pok[eé]mon|全队|整支队伍|所有宝可梦|whole\s+team|entire\s+team|all\s+(?:of\s+the\s+)?pokemon)/iu

const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
function preferredStat(segment) {
  if (/(?:tốc\s*độ|nhanh\s+hơn|nhanh\s+nhẹn|bứt\s*tốc|加速|速度|敏捷|更快|speed|agility|sprint)/iu.test(segment)) return 'spe'
  if (/(?:đặc\s*công|tấn\s*công\s*đặc\s*biệt|特攻|特殊攻击|sp\.?\s*attack|special\s*attack|spell\s*power)/iu.test(segment)) return 'spa'
  if (/(?:đặc\s*thủ|phòng\s*thủ\s*đặc\s*biệt|特防|特殊防御|special\s*defen[sc]e|sp\.?\s*def)/iu.test(segment)) return 'spd'
  if (/(?:phòng\s*thủ|chống\s*đỡ|耐打|防御|defen[sc]e|toughness)/iu.test(segment)) return 'def'
  if (/(?:thể\s*lực|sức\s*bền|máu\s*tối\s*đa|体力|耐力|生命值|stamina|endurance|\bhp\b)/iu.test(segment)) return 'hp'
  if (/(?:sức\s*mạnh|lực\s*đánh|đòn\s*đánh|cú\s*đấm|攻击力|物攻|力量|attack\s*power|physical\s*attack)/iu.test(segment)) return 'atk'
  return null
}
function chooseFallbackStat(mon) {
  const base = mon?.baseStats ?? {}
  return STATS.filter((stat) => stat !== 'hp').sort((a, b) => (base[b] ?? 0) - (base[a] ?? 0))[0] ?? 'atk'
}
function uniqueMons(mons) {
  const list = []
  for (const mon of mons ?? []) {
    if (!mon) continue
    if (list.some((known) => (known.uid && mon.uid && known.uid === mon.uid) || (!known.uid && !mon.uid && known.name === mon.name))) continue
    list.push(mon)
  }
  return list
}
function aliases(mon, zh) {
  const names = [mon.uid, mon.nickname, mon.name, mon.species, mon.displayName].filter(Boolean)
  for (const candidate of [mon.name, mon.species]) {
    const localized = zh.byCanonical?.[normalizeLocalizedPokemonName(candidate)]
    if (localized) names.push(localized)
  }
  return [...new Set(names.map((name) => String(name).toLowerCase()).filter((name) => name.length >= 2))]
}

export function inferCompletedTraining(text, mons = []) {
  const roster = uniqueMons(mons)
  if (!roster.length) return []
  const zh = getBuiltInZhPokemonSpeciesNames()
  // Work sentence-by-sentence, but keep one nearby sentence for constructions
  // such as "After training, Pikachu was faster".
  const sentences = String(text ?? '').split(/(?<=[。！？!?\n])|(?<=\.)\s+/u).map((x) => x.trim()).filter(Boolean)
  const found = new Map()
  for (let index = 0; index < sentences.length; index += 1) {
    const line = sentences[index]
    const before = sentences[index - 1] ?? ''
    const after = sentences[index + 1] ?? ''
    if (!TRAINING_CUE.test(line) || NOT_COMPLETED.test(line)) continue
    // Need an actual Pokémon subject. If only a human trained, there is no EV.
    const window = [before, line, after].join(' ').toLowerCase()
    const lower = line.toLowerCase()
    const cueIndex = lower.search(TRAINING_CUE)
    const hits = roster.map((mon) => {
      let best = null
      for (const name of aliases(mon, zh)) {
        const at = lower.indexOf(name)
        if (at < 0) continue
        const distance = at <= cueIndex ? cueIndex - (at + name.length) : at - cueIndex
        if (!best || Math.abs(distance) < Math.abs(best.distance)) best = { mon, at, distance }
      }
      return best
    }).filter(Boolean)
    // Mentioning a bystander does not train it. In "Pikachu watched
    // Bulbasaur train", only Bulbasaur is the participant. A named group
    // actively training together is the exception.
    const sharedWorkout = /(?:cùng|đều|together|both|共同|一起|一同|同时)/iu.test(lower)
    const participants = TEAM_TRAINING.test(line) ? roster
      : sharedWorkout && hits.length > 1 ? hits.map((hit) => hit.mon)
      : hits.length ? [hits.sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))[0].mon]
      : []
    if (!participants.length) continue
    const intensity = /(?:cường\s*độ\s*(?:cao|mạnh)|khổ\s*luyện|rất\s*căng|高强度|魔鬼训练|intense|hard\s+training)/iu.test(line) ? 2 : 1
    for (const mon of participants) {
      const target = mon.uid || mon.name
      if (!target || found.has(String(target))) continue
      found.set(String(target), {
        target: String(target), stat: preferredStat(window), intensity,
        evidence: line.slice(0, 220), source: 'narrative-training',
      })
    }
  }
  return [...found.values()]
}

export function applyTrainingEvGain(mon, { stat = null, intensity = 1 } = {}) {
  if (!mon?.baseStats) return { mon, added: 0, stat: null }
  const evs = { ...zeroEVs(), ...(mon.evs ?? {}) }
  const total = STATS.reduce((sum, key) => sum + Math.max(0, Math.min(252, Number(evs[key]) || 0)), 0)
  const targetStat = STATS.includes(stat) ? stat : chooseFallbackStat(mon)
  const amount = Math.max(1, Math.min(3, Math.trunc(Number(intensity) || 1)))
  const added = Math.max(0, Math.min(amount, 252 - (evs[targetStat] || 0), 510 - total))
  if (!added) return { mon, added: 0, stat: targetStat }
  const next = recomputeMonStats({ ...mon, evs: { ...evs, [targetStat]: (evs[targetStat] || 0) + added } })
  return { mon: { ...next, evGainNote: `+${added} EV ${targetStat} (training)` }, added, stat: targetStat }
}

// Convert the single legacy whole-team TRAIN counter to concrete Pokémon
// targets when narration names its participants; infer a completed workout
// even when the remote semantic model accidentally returns events:[].
export function reconcileTrainingManifest(parsed, storyText, roster) {
  const inferred = inferCompletedTraining(storyText, roster)
  if (!inferred.length) {
    // No deterministic evidence: do not give XP to the entire party just
    // because an unreliable model proposed a bare TRAIN event.
    return { ...parsed, training: 0, trainingEvents: [] }
  }
  return { ...parsed, training: 0, trainingEvents: inferred }
}
