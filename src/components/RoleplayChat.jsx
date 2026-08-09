import React, { useState, useRef, useEffect } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { chatCompletion, polishProse } from '../services/aiClient.js'
import { extractSemanticStateEvents } from '../services/semanticStateEngine.js'
import { generateActionChoices } from '../services/actionChoiceGenerator.js'
import { enrichItemDescription, itemDescriptionNeedsEnrichment, applyEnrichedItemMetadata, prepareItemForDescriptionEnrichment } from '../services/itemDescriptionEnricher.js'
import { importCharacterCard } from '../utils/characterCardImport.js'
import { BATTLE_MARKER } from '../utils/promptBuilder.js'
import { buildScanText } from '../utils/lorebook.js'
import { buildMainApiMessages } from '../utils/buildMainMessages.js'
import { buildToneNote } from '../data/storyTones.js'
import { buildCharacterTraitsNote } from '../data/characterTraits.js'
import {
  applyPerksToMon, trainingExpMultiplier, battleExpMultiplier,
  sharesBattleExpWithParty, syncTraitGrantedItems, canRewritePokemonAbility,
} from '../data/playerPerks.js'
import { cleanAiOutput, extractPresetUiVariables, extractStateTags, extractThinking, truncateAfterInteractiveMarker } from '../utils/outputCleanup.js'
import { extractActionChoices } from '../utils/actionChoices.js'
import { normalizeMonTarget, monIdentityMatches, resolveOwnedMonTarget } from '../utils/ownedMonTarget.js'
import { storyClaimsEvolution, inferEvolutionDirectives, findEvolutionSpeciesEntry } from '../utils/evolutionProtocol.js'
import { buildMonSmart, buildWildMon, detectBattleOpponentSpecies, detectBattleOpponentSpeciesList, detectMentionedSpecies, detectMentionedSpeciesList, applyEvGain, applyExpGain, expGainFrom, expFromDays, expFromTraining, buildPartyBehaviorNote, isSameMon, normalizeAcquiredMon, raiseMonToLevel, applyLevelDirective, evolveOwnedMon, isDirectEvolution, validateEvolutionRequirements, recomputeMonStats } from '../data/pokemonSpecies.js'
import { buildCustomSpeciesEntry, resolveSpeciesEntryFlexible } from '../data/customPokemon.js'
import { detectMentionedArea, randomWildLevel } from '../data/regions.js'
import { wildLevel, receivedMonLevel, trainerBattleLevel } from '../data/levelLogic.js'
import { detectTrainerBattle, detectDoubleBattle, detectPokecenter, detectInteractiveShop, inferInteractiveShop } from '../data/storyScenes.js'
import { resolveItemByName, createCustomItemDescriptor, resolveInventoryItemByName, applyCustomItemStatePatch, isPokemonAccessoryItem, craftedPokemonAccessoryName } from '../data/shopItems.js'
import { generateLootItems } from '../data/shopGenerator.js'
import { isHoldableItem, normalizeHeldItem, resolveHeldItemByName } from '../data/pokemonHeldItems.js'
import ShopModal from './ShopModal.jsx'
import PokecenterModal from './PokecenterModal.jsx'
import { parseStoryStateTags, applyStoryState } from '../utils/storyStateProtocol.js'
import { validateStateAgainstProse, proseSupportsMove, proseSupportsMysteryBallReveal, proseSupportsPokemonAcquisition, reconcileMoneyDirectives } from '../utils/stateEvidence.js'
import { buildStateScanPlan } from '../utils/stateScanPlan.js'
import { adjustFriendship } from '../data/pokemonFriendship.js'
import BattleModal from './BattleModal.jsx'
import DoubleBattleModal from './DoubleBattleModal.jsx'
import TurnInfoModal from './TurnInfoModal.jsx'
import ActionChoices from './ActionChoices.jsx'
import { renderInlineFormatting, stripInlineTags } from '../utils/inlineFormat.jsx'
import SafariModal from './SafariModal.jsx'
import { isSafariArea } from '../data/regions.js'
import { musicManager } from '../utils/musicManager.js'
import { VICTORY_TRACK_KEYS, DEFEAT_TRACK_KEYS } from '../data/musicTracks.js'
import { rememberExchange, recallRelevant, buildMemoryNote, forgetMemoriesInTurnRange, clearMemory } from '../utils/storyMemory.js'
import { archiveExchange, recallArchive, recallFromTranscript, mergeMemoryResults, forgetArchiveRange, clearArchive, backfillArchiveFromMessages } from '../utils/storyArchive.js'
import { upsertNpc, addFact, findRelevantNotes, buildNotebookNote, findNpcProfileInText, recordNpcBattle } from '../utils/storyNotebook.js'
import { maybeUpdateSummary, buildSummaryNote, trimSummaryCoverage, clearSummary } from '../utils/storySummary.js'
import { maybeMakeNudge, getIdentity } from '../data/storyDirector.js'
import { getRegion, getArea } from '../data/regions.js'
import { normalizeMapLocation } from '../data/mapPins.js'
import { getWeather } from '../data/weather.js'
import { buildEcologyNote, pickEcologicalEncounter } from '../data/pokemonEcology.js'
import { envFromWeather } from '../data/battleEnvironments.js'
import { buildFestivalLine } from '../data/festivals.js'
import { buildCanonNote } from '../services/wikiLookup.js'
import { buildModeRulesNote, legendaryAccess, normalizeGameMode } from '../data/gameModes.js'
import { restoreBranchStateCheckpoint, restoreTurnCheckpoint, saveBranchStateCheckpoint, saveTurnCheckpoint } from '../utils/saveManager.js'
import { applyWorldDirectives, buildWorldProgressNote, directorPriority } from '../data/worldProgress.js'
import { addCollectionAward } from '../data/pokemonLife.js'
import { ensurePokemonIdentity } from '../data/persistentIdentity.js'
import { applyNarrativeGenderEvidence, normalizePokemonGender } from '../data/pokemonGender.js'
import { buildIdentityContext } from '../data/identities.js'
import { applyDynamicStateUpdates, dynamicStateForPrompt, dynamicStateKey } from '../data/dynamicState.js'
import {
  buildSearchGateCorrection, buildSearchGateFallback, classifyRealisticInput,
  responseViolatesSearchGate,
} from '../data/inputAdjudicator.js'

// Cửa sổ gần luôn có trần. Phần cũ được truy hồi từ biên niên sử chính xác;
// embedding/rerank là lớp tăng cường tùy chọn, không còn là điều kiện để nhớ.
const MEMORY_RECENT_WINDOW = 24


// Đợt 113: ba loại side-effect có chi phí cao (nhận Pokémon mới, mở PokéCenter,
// mở battle) không được phép chỉ dựa vào một semantic guess/marker lạc. State
// vẫn đọc ngữ nghĩa tự nhiên, nhưng ownership/interaction phải có căn cứ canon
// độc lập để reroll không tự sinh thêm Pokémon hay nút tương tác ngẫu nhiên.
function rerollContextMentionsTarget(priorText, target) {
  const targetKey = normalizeMonTarget(target)
  const priorKey = normalizeMonTarget(priorText)
  return Boolean(targetKey && priorKey && priorKey.includes(targetKey))
}

function gateSemanticOwnership(parsed, storyText, { reroll = false, priorText = '' } = {}) {
  if (!parsed) return parsed
  const kept = []
  const rejected = []
  const seenSemanticSpecies = new Set()
  for (const pk of parsed.pokemons ?? []) {
    const species = pk.species ?? pk.name
    const semantic = Boolean(pk?.semantic || pk?.canon)
    const hasCanonAcquisition = proseSupportsPokemonAcquisition(storyText, species)
    // Reroll chỉ được tái hiện Pokémon có liên hệ trực tiếp với nhánh trước đó.
    // Nếu model tự bịa một loài hoàn toàn mới trong biến thể reroll, dù chính
    // câu nó vừa viết có nói "nhận được", app vẫn không cho side-effect đó
    // trở thành state. Điều này chặn reroll tự sinh thêm Pokémon ngoài ý người chơi.
    const rerollHasPriorAnchor = !reroll || rerollContextMentionsTarget(priorText, species)
    if (semantic && (!hasCanonAcquisition || !rerollHasPriorAnchor)) {
      rejected.push({ ...pk, _reason: !hasCanonAcquisition ? 'no-canon-acquisition' : 'reroll-no-prior-anchor' })
      continue
    }
    const speciesKey = normalizeMonTarget(species)
    // Nhiều pass Semantic đôi khi mô tả cùng một acquisition hai lần với
    // level/nickname hơi khác. Trong một response chỉ giữ một acquisition cho
    // cùng loài; việc thật sự bắt thêm cá thể cùng loài ở lượt khác vẫn hợp lệ.
    if (semantic && speciesKey && seenSemanticSpecies.has(speciesKey)) {
      rejected.push({ ...pk, _reason: 'same-pass-duplicate' })
      continue
    }
    if (semantic && speciesKey) seenSemanticSpecies.add(speciesKey)
    kept.push(pk)
  }
  return {
    ...parsed,
    pokemons: kept,
    _rejectedPokemonAcquisitions: [
      ...(parsed._rejectedPokemonAcquisitions ?? []),
      ...rejected,
    ],
  }
}

function rerollPriorSupportsPokecenter(priorText) {
  const text = String(priorText ?? '').trim()
  if (!text) return false
  if (detectPokecenter(text).inside) return true
  // Cho phép câu lệnh ngắn khi bối cảnh ngay trước đã ở quầy, ví dụ
  // "chữa cho cả đội" / "mở máy PC".
  const centerMention = /(trung\s*tâm\s*pok[eé]mon|pokemon\s*center|pok[eé]mon\s*center|nurse\s*joy|y\s*tá\s*joy)/iu.test(text)
  const explicitUse = /(chữa\s*trị|hồi\s*phục|heal(?:ing)?|mở\s+(?:máy\s*)?pc|máy\s*pc|gửi\s+pok[eé]mon|rút\s+pok[eé]mon|đứng\s+trước\s+quầy|bước\s+vào|đi\s+vào|tiến\s+vào)/iu.test(text)
  return centerMention && explicitUse
}

function gatePokecenterInteraction(parsed, storyText, { reroll = false, priorText = '' } = {}) {
  if (!parsed?.pokecenter) return parsed
  const detected = detectPokecenter(storyText)
  const rerollAllowed = !reroll || rerollPriorSupportsPokecenter(priorText)
  return detected.inside && rerollAllowed
    ? parsed
    : { ...parsed, pokecenter: null, _rejectedPokecenter: parsed.pokecenter }
}

const STRONG_BATTLE_CUE_RE = /(xuất\s*trận|ra\s*sân|tung\s+ra|sent\s+out|thách\s*đấu|khiêu\s*chiến|giao\s*đấu|đấu\s+pokemon|đấu\s+pokémon|chiến\s*đấu|bắt\s*đầu\s+trận|trận\s+đấu\s+bắt\s*đầu|lao\s+(?:vào|tới)|tấn\s*công|đánh\s+(?:nó|hắn|cậu|cô|pok[eé]mon|trận)|attack(?:ed|s)?|battle\s+begins?|wild\s+pokemon|wild\s+pokémon|pok[eé]mon\s+hoang|hoang\s+dã)/iu
function rerollPriorSupportsBattle(priorText) {
  const text = String(priorText ?? '')
  if (!text.trim()) return false
  if (STRONG_BATTLE_CUE_RE.test(text)) return true
  const trainer = detectTrainerBattle(text)
  return Boolean(trainer.isTrainer && /(đối\s*thủ|trận|battle|gym|nhà\s*thi\s*đấu)/iu.test(text))
}

function battleMarkerHasCanonSetup(storyText, userText, pokedex, ownNames = [], { reroll = false, priorText = '' } = {}) {
  if (!String(storyText ?? '').includes(BATTLE_MARKER)) return true
  // Reroll không được tự tạo một hard side-effect mới chỉ vì model trong lần
  // viết lại bỗng nảy ra encounter. Nhánh trước/current input phải đã có mầm battle.
  if (reroll && !rerollPriorSupportsBattle(priorText)) return false
  const beforeMarker = String(storyText ?? '').split(BATTLE_MARKER)[0]
  const combined = `${String(userText ?? '')}\n${beforeMarker}`
  const activeOpponent = detectBattleOpponentSpecies(beforeMarker, pokedex ?? [], { excludeNames: ownNames })
  if (activeOpponent) return true
  const trainer = detectTrainerBattle(combined)
  return Boolean(trainer.isTrainer && STRONG_BATTLE_CUE_RE.test(combined))
    || STRONG_BATTLE_CUE_RE.test(beforeMarker)
}

function makeMessageId(prefix = 'msg') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const OUTCOME_LABEL = {
  win: 'Thắng',
  lose: 'Thua',
  escaped: 'Chạy thoát',
  calm: 'Hoà giải',
  join: 'Dụ dỗ thành công',
  flee: 'Đối phương bỏ chạy',
  caught: 'Bắt được (Safari)',
}
const OUTCOME_TEXT = {
  win: 'THẮNG',
  lose: 'THUA',
  escaped: 'NGƯỜI CHƠI ĐÃ CHẠY THOÁT KHỎI TRẬN (không phân thắng bại)',
  calm: 'NGƯỜI CHƠI THUYẾT PHỤC ĐƯỢC ĐỐI PHƯƠNG DỪNG LẠI — trận kết thúc trong hoà bình, hai bên không ai bị hạ',
  join: 'NGƯỜI CHƠI DỤ DỖ THÀNH CÔNG — Pokémon hoang dã cảm mến và quyết định ĐI THEO người chơi (đã vào đội hình)',
  flee: 'ĐỐI PHƯƠNG HOẢNG SỢ BỎ CHẠY sau lời nói của người chơi (không phân thắng bại)',
  caught: 'NGƯỜI CHƠI BẮT ĐƯỢC POKÉMON hoang dã trong khu Safari (đã vào đội hình)',
}

const LEAGUE_TEAM_SIZE = 6

// Tính vị trí kế tiếp trong đội 6 Pokémon của Tứ Thiên Vương/Champion.
// Mỗi [[BATTLE]] đơn tiêu thụ 1 ô; đấu đôi tiêu thụ 2 ô. Sau đủ 6 ô tự
// quay về 0, nên khi chuyển sang người tiếp theo trong chuỗi Elite Four,
// đội hình lại bắt đầu đúng từ cặp level thấp nhất.
function nextLeagueTeamSlot(messages, currentIndex, tier) {
  if (tier !== 'elite' && tier !== 'champion') return null
  let used = 0
  for (let index = 0; index < currentIndex; index++) {
    const message = messages[index]
    if (!message?.battleStarted || message.trainerTier !== tier) continue
    const count = Number(message.trainerTeamCount)
      || (message.battleMode === 'double' ? Math.max(2, message.enemySnapshots?.length ?? 0) : 1)
    used += count
  }
  return used % LEAGUE_TEAM_SIZE
}

function PokeballIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ display: 'block' }}>
      <circle cx="20" cy="20" r="18" fill="#eef3f6" stroke="#0d131a" strokeWidth="2" />
      <path d="M2 20a18 18 0 0136 0z" fill="#ea6a5c" stroke="#0d131a" strokeWidth="2" />
      <line x1="2" y1="20" x2="38" y2="20" stroke="#0d131a" strokeWidth="2" />
      <circle cx="20" cy="20" r="6" fill="#eef3f6" stroke="#0d131a" strokeWidth="2" />
      <circle cx="20" cy="20" r="2.4" fill="#0d131a" />
    </svg>
  )
}

function PokeballTrigger({ onClick, used }) {
  if (used) {
    return (
      <div
        title="Trận đấu này đã diễn ra"
        style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 0', margin: '6px 0', opacity: 0.35 }}
      >
        <PokeballIcon />
      </div>
    )
  }
  return (
    <button
      onClick={onClick}
      title="Bấm để vào trận đấu"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        padding: '6px 0',
        margin: '6px 0',
        cursor: 'pointer',
        animation: 'pokeball-bounce 1.4s ease-in-out infinite',
      }}
    >
      <style>{`@keyframes pokeball-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }`}</style>
      <PokeballIcon />
    </button>
  )
}

// Tách nội dung tại vị trí marker [[BATTLE]], chèn quả pokeball xuống dòng riêng.
// Quả pokeball chỉ dùng được 1 lần (used=true sau khi đã bấm vào trận).
function StoryParagraph({ content, onOpenBattle, used }) {
  // Đợt 63: render thẻ inline của preset (<span style="color…">, <i>, <b>…)
  // thành định dạng thật thay vì hiện nguyên thẻ ra màn hình.
  if (!content.includes(BATTLE_MARKER)) {
    return <p className="story-text">{renderInlineFormatting(content)}</p>
  }
  const parts = content.split(BATTLE_MARKER)
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part.trim() && <p className="story-text">{renderInlineFormatting(part)}</p>}
          {i < parts.length - 1 && (
            <div>
              <PokeballTrigger onClick={onOpenBattle} used={used} />
            </div>
          )}
        </React.Fragment>
      ))}
    </>
  )
}

const LOREBOOK_PAGE_SIZE = 5

function LorebookEditor({ lorebook, onChange }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  function updateEntry(originalIndex, field, value) {
    const next = [...lorebook]
    next[originalIndex] = { ...next[originalIndex], [field]: value }
    onChange(next)
  }
  function removeEntry(originalIndex) {
    onChange(lorebook.filter((_, idx) => idx !== originalIndex))
  }
  function addEntry() {
    onChange([...lorebook, { name: '', keys: [], content: '' }])
    setPage(0)
    setSearch('')
  }

  // Tìm theo tên / từ khoá / nội dung cùng lúc (giống ô search World Info của SillyTavern).
  const q = search.trim().toLowerCase()
  const filtered = lorebook
    .map((entry, originalIndex) => ({ entry, originalIndex }))
    .filter(({ entry }) => {
      if (!q) return true
      const inName = (entry.name ?? '').toLowerCase().includes(q)
      const inKeys = (entry.keys ?? []).some((k) => k.toLowerCase().includes(q))
      const inContent = (entry.content ?? '').toLowerCase().includes(q)
      return inName || inKeys || inContent
    })

  const totalPages = Math.max(1, Math.ceil(filtered.length / LOREBOOK_PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = filtered.slice(safePage * LOREBOOK_PAGE_SIZE, safePage * LOREBOOK_PAGE_SIZE + LOREBOOK_PAGE_SIZE)

  return (
    <div className="field">
      <label>Lorebook (kích hoạt theo từ khoá, giống World Info) — {lorebook.length} entry</label>

      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(0)
        }}
        placeholder="Tìm theo tên / từ khoá / nội dung entry..."
        style={{ marginBottom: 10 }}
      />

      {filtered.length === 0 && (
        <small>{lorebook.length === 0 ? 'Chưa có entry nào.' : 'Không tìm thấy entry khớp.'}</small>
      )}

      {pageItems.map(({ entry, originalIndex }) => (
        <div
          key={originalIndex}
          style={{
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: 10,
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <input
            value={entry.name ?? ''}
            onChange={(e) => updateEntry(originalIndex, 'name', e.target.value)}
            placeholder="Tên entry (chỉ để dễ nhận diện/tìm kiếm, không ảnh hưởng kích hoạt)"
            style={{ fontWeight: 600 }}
          />
          <input
            value={(entry.keys ?? []).join(', ')}
            onChange={(e) =>
              updateEntry(
                originalIndex,
                'keys',
                e.target.value.split(',').map((k) => k.trim()).filter(Boolean),
              )
            }
            placeholder="Từ khoá kích hoạt, cách nhau bởi dấu phẩy (VD: League, Aurelia)"
          />
          <textarea
            value={entry.content}
            onChange={(e) => updateEntry(originalIndex, 'content', e.target.value)}
            placeholder="Nội dung sẽ được chèn vào system prompt khi từ khoá xuất hiện"
            style={{ minHeight: 50 }}
          />
          <button className="btn" onClick={() => removeEntry(originalIndex)} style={{ alignSelf: 'flex-start' }}>
            Xoá entry
          </button>
        </div>
      ))}

      {filtered.length > LOREBOOK_PAGE_SIZE && (
        <div className="btn-row" style={{ marginTop: 10, justifyContent: 'center' }}>
          <button className="btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            ← Trước
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Trang {safePage + 1} / {totalPages}
          </span>
          <button className="btn" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>
            Sau →
          </button>
        </div>
      )}

      <button className="btn" style={{ marginTop: 10 }} onClick={addEntry}>
        + Thêm entry lorebook
      </button>
    </div>
  )
}


// ===== KHỚP TARGET POKÉMON CHO TAG STATE =====
// Logic thuần nằm ở utils/ownedMonTarget.js để regression test trực tiếp.

// API phụ chỉ được BỔ SUNG tag bị thiếu. Model vẫn có thể lặp lại tag chính
// dù đã được gửi danh sách đã áp; với LEVEL +1 thì lặp một lần = tăng sai hai
// cấp, ITEM cũng có thể cộng/trừ hai lần. Chặn exact duplicate ở phía app.
function filterSupplementalDuplicates(extra, applied, { consumeExactMoney = false } = {}) {
  const monKey = (value) => normalizeMonTarget(value)
  const itemKey = (value) => resolveItemByName(value)?.id ?? monKey(value)
  const appliedLevels = new Set((applied?.levels ?? []).map((entry) => `${monKey(entry.target)}|${entry.mode}|${entry.value}`))
  // Các biến tích luỹ chủ quan/đơn-trạng-thái chỉ nên có MỘT quyết định cho
  // cùng target trong một lượt canon. Nếu Extractor đã commit FRIEND +5 cho
  // Floragato, Auditor không được cộng thêm +10 chỉ vì chấm cùng cảnh khác số.
  const appliedLevelTargets = new Set((applied?.levels ?? []).map((entry) => monKey(entry.target)))
  const appliedFriendTargets = new Set((applied?.friendships ?? []).map((entry) => monKey(entry.target)))
  const appliedPokemonPatchTargets = new Set((applied?.pokemonPatches ?? []).map((entry) => monKey(entry.target)))
  const appliedRelTargets = new Set((applied?.rel ?? []).map((entry) => monKey(entry.name)))
  const appliedBodyParts = new Set((applied?.body ?? []).map((entry) => entry.part))
  const appliedHungerWho = new Set((applied?.hunger ?? []).map((entry) => entry.who))
  const appliedRepTargets = new Set((applied?.reputations ?? []).map((entry) => monKey(entry.name)))
  const appliedEvolutions = new Set((applied?.evolutions ?? []).map((entry) => `${monKey(entry.from)}|${monKey(entry.to)}`))
  const appliedItems = new Set((applied?.items ?? []).map((entry) => `${itemKey(entry.name)}|${Number(entry.qty)}`))
  const appliedItemPatchFields = new Map()
  for (const entry of applied?.itemPatches ?? []) {
    const key = itemKey(entry.target)
    const fields = appliedItemPatchFields.get(key) ?? new Set()
    for (const field of Object.keys(entry.fields ?? {})) fields.add(field)
    appliedItemPatchFields.set(key, fields)
  }
  const appliedSemanticItemTargets = new Set((applied?.items ?? []).filter((entry) => entry?.semantic || entry?.canon).map((entry) => itemKey(entry.name)))
  const appliedFriends = new Set((applied?.friendships ?? []).map((entry) => `${monKey(entry.target)}|${Number(entry.delta)}|${monKey(entry.note)}`))
  const appliedEquipment = new Set((applied?.equipment ?? []).map((entry) => `${monKey(entry.target)}|${itemKey(entry.item ?? 'none')}|${entry.mode}`))
  // Qua nhiều semantic pass, cùng một Pokémon có thể bị model chấm lệch
  // level đôi chút. Dedupe theo loài+nickname thay vì loài+level để không sinh
  // bản sao chỉ vì Auditor đoán Lv12 còn Extractor đoán Lv13.
  const appliedPokemon = new Set((applied?.pokemons ?? []).map((entry) => `${monKey(entry.species)}|${monKey(entry.nickname ?? '')}`))
  const appliedSemanticPokemonSpecies = new Set((applied?.pokemons ?? [])
    .filter((entry) => entry?.semantic || entry?.canon)
    .map((entry) => monKey(entry.species)))
  const appliedPokemonRemovalTargets = new Set((applied?.pokemonRemovals ?? []).map((entry) => monKey(entry.target)))
  const appliedRel = new Set((applied?.rel ?? []).map((entry) => `${monKey(entry.name)}|${Number(entry.delta)}|${monKey(entry.note)}`))
  const appliedBody = new Set((applied?.body ?? []).map((entry) => `${entry.part}|${Number(entry.delta)}`))
  const appliedHunger = new Set((applied?.hunger ?? []).map((entry) => `${entry.who}|${Number(entry.delta)}`))
  const appliedNpc = new Set((applied?.npcs ?? []).map((entry) => `${monKey(entry.name)}|${JSON.stringify(entry.fields ?? {})}`))
  const appliedFact = new Set((applied?.facts ?? []).map((entry) => `${monKey(entry.key)}|${monKey(entry.text)}`))
  const appliedBadges = new Set((applied?.badges ?? []).map((entry) => JSON.stringify(entry)))
  const appliedQuests = new Set((applied?.quests ?? []).map((entry) => JSON.stringify(entry)))
  const appliedReps = new Set((applied?.reputations ?? []).map((entry) => `${monKey(entry.name)}|${Number(entry.delta)}|${monKey(entry.note)}`))
  const appliedAwards = new Set((applied?.collectionAwards ?? []).map((entry) => `${entry.kind}|${monKey(entry.target)}|${monKey(entry.name)}`))
  const appliedLegendaryAccess = new Set((applied?.legendaryAccess ?? []).map((entry) => `${monKey(entry.species)}|${monKey(entry.reason)}`))
  const appliedLoots = new Set((applied?.loots ?? []).map((entry) => `${monKey(entry.type)}|${monKey(entry.size)}`))
  const appliedMoves = new Set((applied?.moveDirectives ?? []).map((entry) => `${monKey(entry.place)}|${entry.x ?? ''}|${entry.y ?? ''}`))
  const appliedWanted = new Set((applied?.wanted ?? []).map((entry) => JSON.stringify(entry)))
  const appliedShops = new Set((applied?.shops ?? []).map((entry) => JSON.stringify(entry)))
  const extraMoneyEntries = extra?.moneyEntries?.length
    ? extra.moneyEntries.map(Number)
    : extra?.money ? [Number(extra.money)] : []
  // Không xoá mù một delta chỉ vì bằng số đã áp: chính văn có thể chứa hai
  // lần trả 500 thật. Validator phía sau đếm số bằng chứng và nhận
  // `alreadyApplied` để chỉ cho dùng phần còn lại.
  const appliedMoneyCounts = new Map()
  if (consumeExactMoney) {
    const appliedMoney = applied?.moneyEntries?.length ? applied.moneyEntries : (applied?.money ? [applied.money] : [])
    for (const value of appliedMoney) appliedMoneyCounts.set(Number(value), (appliedMoneyCounts.get(Number(value)) ?? 0) + 1)
  }
  let filteredMoneyEntries = extraMoneyEntries.filter((value) => {
    if (!consumeExactMoney) return true
    const count = appliedMoneyCounts.get(Number(value)) ?? 0
    if (count <= 0) return true
    appliedMoneyCounts.set(Number(value), count - 1)
    return false
  })
  // Semantic model đôi khi gộp nhiều giao dịch thành một net delta trong khi
  // deterministic reconciler đã commit một phần. Nếu giữ nguyên aggregate sẽ
  // trừ/cộng lặp. Chỉ tách phần dư khi response semantic có đúng MỘT delta và
  // delta đó bao trùm net đã áp cùng chiều; các event riêng lẻ vẫn giữ nguyên.
  if (consumeExactMoney && extraMoneyEntries.length === 1 && filteredMoneyEntries.length === 1) {
    const appliedMoney = applied?.moneyEntries?.length ? applied.moneyEntries.map(Number) : (applied?.money ? [Number(applied.money)] : [])
    const appliedNet = appliedMoney.reduce((sum, value) => sum + (Number(value) || 0), 0)
    const candidate = Number(filteredMoneyEntries[0]) || 0
    if (appliedNet && candidate && Math.sign(appliedNet) === Math.sign(candidate)) {
      if (Math.abs(candidate) > Math.abs(appliedNet)) {
        const residual = candidate - appliedNet
        filteredMoneyEntries = residual ? [residual] : []
      } else {
        filteredMoneyEntries = []
      }
    }
  }
  return {
    ...extra,
    moneyEntries: filteredMoneyEntries,
    money: filteredMoneyEntries.reduce((sum, value) => sum + value, 0),
    levels: (extra?.levels ?? []).filter((entry) => !appliedLevelTargets.has(monKey(entry.target)) && !appliedLevels.has(`${monKey(entry.target)}|${entry.mode}|${entry.value}`)),
    evolutions: (extra?.evolutions ?? []).filter((entry) => !appliedEvolutions.has(`${monKey(entry.from)}|${monKey(entry.to)}`)),
    items: (extra?.items ?? []).filter((entry) => !appliedItems.has(`${itemKey(entry.name)}|${Number(entry.qty)}`) && !((entry?.semantic || entry?.canon) && appliedSemanticItemTargets.has(itemKey(entry.name)))),
    itemPatches: (extra?.itemPatches ?? []).map((entry) => {
      const used = appliedItemPatchFields.get(itemKey(entry.target)) ?? new Set()
      const fields = Object.fromEntries(Object.entries(entry.fields ?? {}).filter(([field]) => !used.has(field)))
      return { ...entry, fields }
    }).filter((entry) => Object.keys(entry.fields ?? {}).length > 0),
    loots: (extra?.loots ?? []).filter((entry) => !appliedLoots.has(`${monKey(entry.type)}|${monKey(entry.size)}`)),
    friendships: (extra?.friendships ?? []).filter((entry) => !appliedFriendTargets.has(monKey(entry.target)) && !appliedFriends.has(`${monKey(entry.target)}|${Number(entry.delta)}|${monKey(entry.note)}`)),
    pokemonPatches: (extra?.pokemonPatches ?? []).filter((entry) => !appliedPokemonPatchTargets.has(monKey(entry.target))),
    equipment: (extra?.equipment ?? []).filter((entry) => !appliedEquipment.has(`${monKey(entry.target)}|${itemKey(entry.item ?? 'none')}|${entry.mode}`)),
    pokemons: (extra?.pokemons ?? []).filter((entry) =>
      !appliedPokemon.has(`${monKey(entry.species)}|${monKey(entry.nickname ?? '')}`)
      && !((entry?.semantic || entry?.canon) && appliedSemanticPokemonSpecies.has(monKey(entry.species)))),
    pokemonRemovals: (extra?.pokemonRemovals ?? []).filter((entry) => !appliedPokemonRemovalTargets.has(monKey(entry.target))),
    rel: (extra?.rel ?? []).filter((entry) => !appliedRelTargets.has(monKey(entry.name)) && !appliedRel.has(`${monKey(entry.name)}|${Number(entry.delta)}|${monKey(entry.note)}`)),
    body: (extra?.body ?? []).filter((entry) => !appliedBodyParts.has(entry.part) && !appliedBody.has(`${entry.part}|${Number(entry.delta)}`)),
    hunger: (extra?.hunger ?? []).filter((entry) => !appliedHungerWho.has(entry.who) && !appliedHunger.has(`${entry.who}|${Number(entry.delta)}`)),
    moveDirectives: (extra?.moveDirectives ?? []).filter((entry) => !appliedMoves.has(`${monKey(entry.place)}|${entry.x ?? ''}|${entry.y ?? ''}`)),
    moves: (extra?.moveDirectives ?? []).filter((entry) => !appliedMoves.has(`${monKey(entry.place)}|${entry.x ?? ''}|${entry.y ?? ''}`)).map((entry) => entry.place),
    dateAdvance: applied?.dateAdvance ? 0 : (extra?.dateAdvance ?? 0),
    datePart: applied?.datePart === extra?.datePart ? null : (extra?.datePart ?? null),
    training: Number(applied?.training) === Number(extra?.training) ? 0 : (extra?.training ?? 0),
    npcs: (extra?.npcs ?? []).filter((entry) => !appliedNpc.has(`${monKey(entry.name)}|${JSON.stringify(entry.fields ?? {})}`)),
    facts: (extra?.facts ?? []).filter((entry) => !appliedFact.has(`${monKey(entry.key)}|${monKey(entry.text)}`)),
    badges: (extra?.badges ?? []).filter((entry) => !appliedBadges.has(JSON.stringify(entry))),
    quests: (extra?.quests ?? []).filter((entry) => !appliedQuests.has(JSON.stringify(entry))),
    reputations: (extra?.reputations ?? []).filter((entry) => !appliedRepTargets.has(monKey(entry.name)) && !appliedReps.has(`${monKey(entry.name)}|${Number(entry.delta)}|${monKey(entry.note)}`)),
    wanted: (extra?.wanted ?? []).filter((entry) => !appliedWanted.has(JSON.stringify(entry))),
    legendaryAccess: (extra?.legendaryAccess ?? []).filter((entry) => !appliedLegendaryAccess.has(`${monKey(entry.species)}|${monKey(entry.reason)}`)),
    collectionAwards: (extra?.collectionAwards ?? []).filter((entry) => !appliedAwards.has(`${entry.kind}|${monKey(entry.target)}|${monKey(entry.name)}`)),
    customEvents: extra?.customEvents ?? [],
    dynamicUpdates: (extra?.dynamicUpdates ?? []).filter((entry) => {
      const key = dynamicStateKey(entry)
      return !(applied?.dynamicUpdates ?? []).some((prev) => dynamicStateKey(prev) === key
        && String(prev.operation ?? prev.op ?? 'set') === String(entry.operation ?? entry.op ?? 'set')
        && JSON.stringify(prev.value ?? prev.details ?? null) === JSON.stringify(entry.value ?? entry.details ?? null))
    }),
    shops: (extra?.shops ?? []).filter((entry) => !appliedShops.has(JSON.stringify(entry))),
    pokecenter: JSON.stringify(applied?.pokecenter) === JSON.stringify(extra?.pokecenter) ? null : (extra?.pokecenter ?? null),
  }
}

// UI cửa hàng đã ghi giao dịch trước khi AI kể lại. Chặn mọi biến cùng chiều
// của đúng giao dịch kể cả model chia tổng tiền thành nhiều tag hoặc đổi x2
// thành hai tag x1; vẫn cho phép một khoản thưởng/hoàn tiền chiều ngược lại.
function filterUiPreAppliedState(extra, preApplied) {
  if (!preApplied) return extra
  const blockedItemNames = new Set((preApplied.items ?? []).map((entry) =>
    resolveItemByName(entry.name)?.id ?? normalizeMonTarget(entry.name),
  ))
  // Không chặn MONEY theo "cùng dấu" nữa. Một lượt kể sau Shop có thể
  // chứa thêm một khoản chi khác hoàn toàn hợp lệ. Exact duplicate của giao
  // dịch UI được consume ở filterSupplementalDuplicates/validator bằng số
  // lượng evidence canon, nên vẫn không thể trừ Shop lần hai.
  const moneyEntries = extra.moneyEntries?.length ? extra.moneyEntries : (extra.money ? [extra.money] : [])
  return {
    ...extra,
    moneyEntries,
    money: moneyEntries.reduce((sum, value) => sum + Number(value || 0), 0),
    items: (extra.items ?? []).filter((entry) => {
      const key = resolveItemByName(entry.name)?.id ?? normalizeMonTarget(entry.name)
      return !(Number(entry.qty) > 0 && blockedItemNames.has(key))
    }),
  }
}

const STATE_ARRAY_FIELDS = [
  'rel', 'body', 'shops', 'loots', 'npcs', 'facts', 'pokemons', 'pokemonRemovals', 'levels', 'evolutions',
  'friendships', 'pokemonPatches', 'equipment', 'hunger', 'moves', 'moveDirectives', 'items', 'itemPatches', 'badges',
  'quests', 'reputations', 'wanted', 'legendaryAccess', 'collectionAwards', 'customEvents', 'dynamicUpdates',
]

function compactStateManifest(parsed) {
  const manifest = {
    money: Number(parsed?.money) || 0,
    moneyEntries: [...(parsed?.moneyEntries ?? [])],
    dateAdvance: Number(parsed?.dateAdvance) || 0,
    training: Number(parsed?.training) || 0,
    datePart: parsed?.datePart ?? null,
    pokecenter: parsed?.pokecenter ?? null,
  }
  for (const field of STATE_ARRAY_FIELDS) manifest[field] = [...(parsed?.[field] ?? [])]
  return manifest
}

function mergeStateManifests(base, extra) {
  const merged = compactStateManifest(base)
  const next = compactStateManifest(extra)
  merged.money += next.money
  merged.moneyEntries.push(...next.moneyEntries)
  merged.dateAdvance += next.dateAdvance
  merged.training += next.training
  merged.datePart = next.datePart ?? merged.datePart
  merged.pokecenter = next.pokecenter ?? merged.pokecenter
  for (const field of STATE_ARRAY_FIELDS) merged[field].push(...next[field])
  return merged
}

// Một số directive đã qua evidence nhưng vẫn có thể không commit vì target
// không tồn tại, thiếu vật phẩm, cổng tiến hoá, v.v. Ledger chỉ được đánh dấu
// cho operation đã áp hoặc đã ở trạng thái đích; nếu không Auditor sẽ tưởng
// biến đã cập nhật và bỏ qua lỗi thật.
const APPLY_GATED_FIELDS = ['levels', 'evolutions', 'friendships', 'pokemonPatches', 'pokemons', 'pokemonRemovals', 'items', 'itemPatches', 'loots', 'equipment', 'collectionAwards', 'dynamicUpdates']
function ledgerManifestFromApplyReport(parsed, report) {
  const manifest = compactStateManifest(parsed)
  for (const field of APPLY_GATED_FIELDS) {
    if (report?.ledgerState?.[field]) manifest[field] = [...report.ledgerState[field]]
  }
  return manifest
}

function countParsedStateOperations(parsed) {
  if (!parsed) return 0
  let count = (parsed.moneyEntries?.length ?? (parsed.money ? 1 : 0))
  for (const field of STATE_ARRAY_FIELDS) {
    if (field === 'customEvents' && (parsed.dynamicUpdates?.length ?? 0) > 0) continue
    count += parsed[field]?.length ?? 0
  }
  if (parsed.dateAdvance) count += 1
  if (parsed.datePart) count += 1
  if (parsed.training) count += 1
  if (parsed.pokecenter) count += 1
  return count
}

function scheduleIdleStateTask(task) {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(() => task(), { timeout: 2500 })
  }
  return setTimeout(task, 350)
}

function resolveMoveLocation(parsed, baseLocation) {
  const directives = parsed?.moveDirectives ?? []
  if (!directives.length) return null
  const directive = directives[directives.length - 1]
  const named = detectMentionedArea(directive.place, baseLocation)
  const base = named ?? (baseLocation?.regionKey ? {
    regionKey: baseLocation.regionKey, areaKey: baseLocation.areaKey,
  } : null)
  if (!base || (!named && directive.x === null && directive.y === null)) return null
  const moved = normalizeMapLocation({
    ...base,
    x: directive.x ?? (named ? undefined : baseLocation?.x),
    y: directive.y ?? (named ? undefined : baseLocation?.y),
    source: 'story-move',
  })
  if (moved.regionKey === baseLocation?.regionKey && moved.areaKey === baseLocation?.areaKey
      && directive.x === null && directive.y === null) {
    return { ...moved, x: baseLocation?.x, y: baseLocation?.y }
  }
  return moved
}


// ===== Mô tả thay đổi biến của 1 lượt (đợt 48 — học card PNTT) =====
// Dịch stateParsed thành các dòng người đọc hiểu ngay, lưu vào message.meta
// để viewer "Biến cập nhật" hiển thị. Cắt raw/thinking để không phình
// localStorage (messages đã persist từ đợt 46).
const META_CLIP = 14000
function describeParsedChanges(parsed, movedTo, suffix = '', applicationReport = null) {
  const out = []
  const tag = suffix ? ` ${suffix}` : ''
  if (parsed.money) out.push(`✅ 💰 Tiền ${parsed.money > 0 ? '+' : ''}${parsed.money}${tag}`)
  for (const r of parsed.rel ?? []) out.push(`💞 Hảo cảm ${r.name} ${r.delta > 0 ? '+' : ''}${r.delta}${r.note ? ` (${r.note})` : ''}${tag}`)
  for (const b of parsed.body ?? []) out.push(`🩹 Thương tích ${b.part} ${b.delta > 0 ? '+' : ''}${b.delta}${tag}`)
  // FIX đợt 69: parser trả về {who, delta} nhưng chỗ này đọc h.target →
  // hiện "Độ no undefined +20" (người chơi báo "lỗi underfiend lúc + độ no").
  for (const h of parsed.hunger ?? []) {
    const label = h.who === 'mon' ? 'Pokémon' : 'người chơi'
    out.push(`🍙 Độ no ${label} ${h.delta > 0 ? '+' : ''}${h.delta}${tag}`)
  }
  // Đợt 74: không còn lấy nguyên tag để tuyên bố "đã áp". POKEMON /
  // LEVEL / ITEM phải đi qua báo cáo của applyParsedState; target không tồn
  // tại hoặc item không hợp lệ sẽ hiện cảnh báo thay vì DNA nói sai.
  if (applicationReport) {
    for (const line of applicationReport.lines ?? []) out.push(`${line}${tag}`)
  } else {
    // Fallback cho tin cũ/test cũ chưa có báo cáo áp biến.
    for (const pk of parsed.pokemons ?? []) out.push(`🔴 Yêu cầu nhận Pokémon: ${pk.species ?? pk.name ?? '???'} Lv.${pk.level}${tag}`)
    for (const rm of parsed.pokemonRemovals ?? []) out.push(`↗ Yêu cầu chuyển Pokémon khỏi sở hữu: ${rm.target}${tag}`)
    for (const ev of parsed.evolutions ?? []) out.push(`✨ Yêu cầu tiến hoá: ${ev.from} → ${ev.to}${tag}`)
    for (const lv of parsed.levels ?? []) {
      const value = lv.mode === 'delta' ? `${lv.value > 0 ? '+' : ''}${lv.value}` : `Lv.${lv.value}`
      out.push(`⬆ Yêu cầu đổi cấp ${lv.target}: ${value}${tag}`)
    }
    for (const it of parsed.items ?? []) {
      const known = resolveItemByName(it.name)
      const label = known?.name ?? it.name
      out.push(`🎒 ${it.qty > 0 ? 'Yêu cầu nhận' : 'Yêu cầu mất'}: ${label} x${Math.abs(it.qty)}${known ? '' : ' · vật phẩm động'}${tag}`)
    }
    for (const patch of parsed.itemPatches ?? []) {
      out.push(`🧰 Thuộc tính vật phẩm ${patch.target}: ${Object.keys(patch.fields ?? {}).join(', ') || 'cập nhật canon'}${tag}`)
    }
    for (const friend of parsed.friendships ?? []) {
      out.push(`💗 Yêu cầu đổi thân mật ${friend.target}: ${friend.delta > 0 ? '+' : ''}${friend.delta}${friend.note ? ` (${friend.note})` : ''}${tag}`)
    }
    for (const patch of parsed.pokemonPatches ?? []) {
      out.push(`🧬 Thuộc tính ${patch.target}: ${Object.entries(patch.fields ?? {}).map(([k, v]) => `${k}=${v}`).join(', ')}${tag}`)
    }
  }
  for (const n of parsed.npcs ?? []) out.push(`👤 Sổ tay NPC: ${n.name}${tag}`)
  for (const f of parsed.facts ?? []) out.push(`📌 Fact [${f.key}]: ${f.text.length > 90 ? f.text.slice(0, 90) + '…' : f.text}${tag}`)
  for (const e of parsed.customEvents ?? []) out.push(`🧩 State động: ${e.target ?? e.kind ?? 'sự kiện'}${tag}`)
  for (const badge of parsed.badges ?? []) out.push(`🏅 Huy hiệu: ${badge.name}${tag}`)
  for (const quest of parsed.quests ?? []) out.push(`📋 Nhiệm vụ: ${quest.title} · ${quest.status}${tag}`)
  for (const rep of parsed.reputations ?? []) out.push(`⚑ Danh tiếng ${rep.name} ${rep.delta > 0 ? '+' : ''}${rep.delta}${tag}`)
  for (const wanted of parsed.wanted ?? []) out.push(`⚖ Truy nã ${wanted.delta > 0 ? '+' : ''}${wanted.delta}${wanted.reason ? ` · ${wanted.reason}` : ''}${tag}`)
  for (const award of parsed.collectionAwards ?? []) out.push(`${award.kind === 'mark' ? '✦ Mark' : '🎗 Ribbon'} ${award.target}: ${award.name}${tag}`)
  for (const sh of parsed.shops ?? []) out.push(`🛒 Mở cửa hàng: ${sh.name}${tag}`)
  if (parsed.pokecenter) out.push(`✚ Trung tâm Pokémon: ${parsed.pokecenter.name}${tag}`)
  if (parsed.dateAdvance) out.push(`📅 Thời gian +${parsed.dateAdvance} ngày${tag}`)
  if (parsed.training) out.push(`🏋 Luyện tập cường độ ${parsed.training} — cả đội nhận EXP${tag}`)
  if (parsed.datePart) out.push(`🕐 Chuyển buổi: ${parsed.datePart}${tag}`)
  if (movedTo) out.push(`🗺 Di chuyển tới: ${movedTo.areaKey} (${movedTo.regionKey})${Number.isFinite(movedTo.x) && Number.isFinite(movedTo.y) ? ` · X${movedTo.x} Y${movedTo.y}` : ''}${tag}`)
  return out
}

export default function RoleplayChat() {
  const {
    adminMode,
    apiConfig,
    character,
    setCharacter,
    worldbook,
    playerName,
    messages,
    setMessages,
    resetChat,
    battleOpen,
    setBattleOpen,
    enemyMon,
    setEnemyMon,
    pokedexSpecies,
    movesDb,
    playerMon,
    setPlayerMon, // FIX đợt 36: tag [[POKEMON]] từng crash "setPlayerMon is not defined"
    stylePreset,
    mainPreset,
    assistantPrefill,
    outcomeApiConfig,
    // FIX đợt 62: đợt 50 dùng animeApiConfig cho "API chau chuốt văn phong"
    // nhưng QUÊN destructure ở đây → ReferenceError "animeApiConfig is not
    // defined" ném ra giữa callAI, làm HỎNG MỌI LƯỢT CHƠI (người chơi beta
    // báo "cứ lỗi api"). Bài học: thêm biến từ context phải kiểm tra cả nơi
    // khai báo lẫn nơi dùng.
    animeApiConfig,
    memoryApiConfig,
    playerIdentity,
    playerCharacter,
    storyDate,
    advanceStoryDate,
    party, pcBox,
    setParty, setPcBox, storyTone, storageFull, playerTraits,
    hunger,
    adjustHunger,
    stateApiConfig,
    stateApiConfig2,
    playerLocation,
    setPlayerLocation,
    playerProfile,
    setPlayerProfile,
    relationships,
    setRelationships,
    bodyStatus,
    setBodyStatus,
    inventory,
    setInventory,
    worldProgress,
    setWorldProgress,
    dynamicState,
    setDynamicState,
    chatPreferences,
    trainerId,
  } = useGame()
  const originRegion = getRegion(playerCharacter?.originRegionKey)
  const originArea = getArea(playerCharacter?.originRegionKey, playerCharacter?.originAreaKey)
  const identityContext = buildIdentityContext({
    identityKey: playerIdentity,
    playerCharacter,
    playerName,
    playerProfile,
    regionName: originRegion?.name,
    areaName: originArea?.name,
  })
  const [input, setInput] = useState('')
  const inputRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [cardOpen, setCardOpen] = useState(false)
  const [importError, setImportError] = useState(null)
  const [debugOpen, setDebugOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState(null) // đợt 39: sửa tin
  // Đợt 48 (học card PNTT): menu CHUỘT PHẢI trên từng tin thay cho hàng nút
  // Sửa/Reroll dưới tin; viewer 🧬 xem biến cập nhật của từng lượt.
  const [ctxMenu, setCtxMenu] = useState(null) // {x, y, index}
  const [turnInfoIndex, setTurnInfoIndex] = useState(null)
  // Đợt 61: menu chuột phải trên Ô NHẬP (xoá input / xoá lịch sử chat).
  const [inputMenu, setInputMenu] = useState(null) // {x, y}
  // Đợt 65: thông tin EXP/lên cấp của trận vừa xong, ghép vào note cho AI kể.
  const expNoteRef = useRef(null)
  // Đợt 73: callback API phụ có thể chạy muộn; ref luôn trỏ tới cá thể đang
  // ra trận mới nhất để [[LEVEL Pokémon đang ra trận | +1]] không áp nhầm bản
  // closure cũ. Không lấy kết quả ra khỏi state updater.
  const latestPlayerMonRef = useRef(playerMon)
  const latestPartyRef = useRef(party)
  const latestPcBoxRef = useRef(pcBox)
  const latestInventoryRef = useRef(inventory)
  const latestPlayerLocationRef = useRef(playerLocation)
  const latestDynamicStateRef = useRef(dynamicState)
  // API phụ chạy trễ phải kiểm tra tin gốc vẫn còn và chưa bị sửa/reroll.
  // Nếu không, nó có thể áp biến từ một nhánh truyện người chơi đã xoá.
  const latestMessagesRef = useRef(messages)
  // Đợt 77/102: khi không có slot API cập nhật biến riêng, luân phiên API
  // phụ đang rảnh. Lượt mật độ cao có thể chạy nhiều pass độc lập trên cùng
  // provider; ledger giữa các pass ngăn áp trùng.
  const stateApiRoundRobinRef = useRef(0)
  const actionChoiceApiRoundRobinRef = useRef(0)
  const stateScanLocksRef = useRef(new Set())
  // Đợt 114: các tác vụ AI phụ (state/action/item metadata) dùng chung một
  // scheduler theo provider. Item description chỉ lấy API đang rảnh; nếu tất
  // cả API phụ đều bận thì chờ slot được nhả rồi mới chạy, không chen ngang
  // gameplay và không bắn nhiều request cùng một provider.
  const apiLeaseRef = useRef({ busy: new Set(), waiters: new Set() })
  const itemDescriptionQueuedRef = useRef(new Set())
  const itemDescriptionFailureRef = useRef(new Map())

  const apiLeaseKey = (cfg) => `${String(cfg?.baseUrl ?? '').replace(/\/+$/, '')}|${String(cfg?.model ?? '')}`
  const uniqueApiConfigs = (configs) => {
    const seen = new Set()
    return (configs ?? []).filter((cfg) => {
      if (!cfg?.baseUrl || !cfg?.model) return false
      const key = apiLeaseKey(cfg)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  const waitForApiLeaseChange = () => new Promise((resolve) => {
    const wake = () => { apiLeaseRef.current.waiters.delete(wake); resolve() }
    apiLeaseRef.current.waiters.add(wake)
  })
  const wakeApiLeaseWaiters = () => {
    for (const wake of [...apiLeaseRef.current.waiters]) wake()
  }
  async function withApiLease(cfg, task) {
    if (!cfg?.baseUrl || !cfg?.model) return task()
    const key = apiLeaseKey(cfg)
    while (apiLeaseRef.current.busy.has(key)) await waitForApiLeaseChange()
    apiLeaseRef.current.busy.add(key)
    try { return await task() } finally {
      apiLeaseRef.current.busy.delete(key)
      wakeApiLeaseWaiters()
    }
  }
  async function runOnFirstFreeApi(configs, task) {
    const pool = uniqueApiConfigs(configs)
    if (!pool.length) throw new Error('Không có API rảnh/cấu hình hợp lệ cho tác vụ nền.')
    while (true) {
      const free = pool.find((cfg) => !apiLeaseRef.current.busy.has(apiLeaseKey(cfg)))
      if (free) return withApiLease(free, () => task(free))
      await waitForApiLeaseChange()
    }
  }
  useEffect(() => { latestPlayerMonRef.current = playerMon }, [playerMon])
  useEffect(() => { latestPartyRef.current = party }, [party])
  useEffect(() => { latestPcBoxRef.current = pcBox }, [pcBox])
  useEffect(() => { latestInventoryRef.current = inventory }, [inventory])
  useEffect(() => { latestPlayerLocationRef.current = playerLocation }, [playerLocation])
  useEffect(() => { latestDynamicStateRef.current = dynamicState }, [dynamicState])
  useEffect(() => { latestMessagesRef.current = messages }, [messages])

  function itemDescriptionApiPool() {
    const auxiliary = uniqueApiConfigs([
      stateApiConfig ? { ...apiConfig, ...stateApiConfig } : null,
      stateApiConfig2 ? { ...apiConfig, ...stateApiConfig2 } : null,
      outcomeApiConfig?.escaped ? { ...apiConfig, ...outcomeApiConfig.escaped } : null,
      outcomeApiConfig?.lose ? { ...apiConfig, ...outcomeApiConfig.lose } : null,
    ])
    // Có API phụ thì KHÔNG chiếm API kể chuyện chính. Chỉ khi người dùng
    // không cấu hình bất kỳ API phụ nào mới dùng API chính, và scheduler sẽ
    // chờ provider đó rảnh trước khi enrich.
    return auxiliary.length ? auxiliary : uniqueApiConfigs([apiConfig])
  }

  function findItemCanonContext(itemName) {
    const name = String(itemName ?? '').trim().toLowerCase()
    const assistantMessages = (latestMessagesRef.current ?? []).filter((message) => message?.role === 'assistant').slice().reverse()
    const exact = name ? assistantMessages.find((message) => String(message.meta?.evidenceText || message.content || '').toLowerCase().includes(name)) : null
    const source = exact ?? assistantMessages[0] ?? null
    if (!source) return ''
    const text = stripInlineTags(source.meta?.evidenceText || source.content || '')
    if (!name) return text.slice(-2400)
    const lower = text.toLowerCase()
    const at = lower.indexOf(name)
    if (at < 0) return text.slice(-2400)
    const start = Math.max(0, at - 900)
    const end = Math.min(text.length, at + name.length + 1400)
    return text.slice(start, end)
  }

  // Đợt 114: item động được commit NGAY để gameplay không chờ AI, còn mô
  // tả chạy nền qua API rảnh. Save cũ có mô tả sai từ heuristic -ite/-z cũng
  // tự đi qua queue này và được sửa tại chỗ, không cần reset game.
  useEffect(() => {
    const now = Date.now()
    const candidates = (inventory ?? []).filter((item) => itemDescriptionNeedsEnrichment(item))
    if (candidates.some((item) => item.descriptionStatus !== 'pending' || item.descriptionSource !== 'pending' || /mega stone|z-crystal/i.test(String(item.desc ?? '')))) {
      setInventory((cur) => (cur ?? []).map((item) => itemDescriptionNeedsEnrichment(item)
        ? prepareItemForDescriptionEnrichment(item)
        : item))
    }
    for (const item of candidates) {
      const key = String(item.id ?? item.name)
      if (!key || itemDescriptionQueuedRef.current.has(key)) continue
      const lastFailure = itemDescriptionFailureRef.current.get(key) ?? 0
      if (now - lastFailure < 60_000) continue
      itemDescriptionQueuedRef.current.add(key)
      Promise.resolve().then(async () => {
        try {
          const context = findItemCanonContext(item.name)
          const meta = await runOnFirstFreeApi(itemDescriptionApiPool(), (cfg) => enrichItemDescription(cfg, {
            item,
            canonContext: context,
            categoryHint: item.category,
          }))
          setInventory((cur) => (cur ?? []).map((owned) => (String(owned.id ?? owned.name) === key
            ? applyEnrichedItemMetadata(owned, meta)
            : owned)))
          itemDescriptionFailureRef.current.delete(key)
        } catch (descriptionError) {
          itemDescriptionFailureRef.current.set(key, Date.now())
          console.warn('[item-description] enrich lỗi, giữ mô tả bảo thủ:', descriptionError.message)
        } finally {
          itemDescriptionQueuedRef.current.delete(key)
        }
      })
    }
  }, [inventory, messages, stateApiConfig, stateApiConfig2, outcomeApiConfig, apiConfig, setInventory])

  // Đợt 102: pass chuyên môn không cần kéo theo toàn bộ snapshot không liên
  // quan. Tách snapshot theo focus giúp prompt ngắn và ổn định hơn khi save
  // đã có PC/túi đồ lớn; đây là tối ưu CONTEXT, tuyệt đối không cắt số biến
  // được phép cập nhật trong chính văn.
  function buildStateScanSnapshot(focus, moneyValue) {
    const focusId = focus?.id ?? null
    const snapshot = {
      player: {
        name: playerName || playerProfile?.name || 'Người chơi',
        trainerId,
        mode: normalizeGameMode(storyTone),
        abilityRewriteAllowed: canRewritePokemonAbility(playerTraits),
      },
    }
    if (!focusId || focusId === 'economy') {
      snapshot.money = Number(moneyValue) || 0
      snapshot.inventory = (latestInventoryRef.current ?? []).map((item) => ({
        id: item.id, name: item.name, qty: item.qty, infinite: Boolean(item.infinite),
        category: item.category, holdable: Boolean(item.holdable), wearable: Boolean(item.wearable), pokemonAccessory: Boolean(item.pokemonAccessory), keyItem: Boolean(item.keyItem),
        description: item.desc, custom: Boolean(item.custom), customAttributes: item.customAttributes ?? undefined,
      }))
    }
    if (!focusId || focusId === 'pokemon') {
      snapshot.party = (latestPartyRef.current ?? []).map((mon) => ({
        uid: mon.uid, pokemonId: mon.pokemonId, name: mon.name, nickname: mon.nickname,
        species: mon.species, forme: mon.forme, level: mon.level, gender: mon.gender,
        shiny: Boolean(mon.shiny), nature: mon.nature, ability: mon.ability,
        teraType: mon.teraType, friendship: mon.friendship,
        heldItem: mon.heldItem?.name ?? mon.heldItem ?? null,
        accessories: (mon.accessories ?? []).map((item) => ({ id: item.id, name: item.name, category: item.category })),
        status: mon.status ?? null,
        customAttributes: mon.customAttributes ?? undefined,
      }))
      snapshot.pc = (latestPcBoxRef.current ?? []).map((mon) => ({
        uid: mon.uid, pokemonId: mon.pokemonId, name: mon.name, nickname: mon.nickname,
        species: mon.species, forme: mon.forme, level: mon.level, gender: mon.gender,
        shiny: Boolean(mon.shiny), nature: mon.nature, ability: mon.ability,
        teraType: mon.teraType, friendship: mon.friendship,
        heldItem: mon.heldItem?.name ?? mon.heldItem ?? null,
        accessories: (mon.accessories ?? []).map((item) => ({ id: item.id, name: item.name, category: item.category })),
        status: mon.status ?? null,
        customAttributes: mon.customAttributes ?? undefined,
      }))
    }
    if (!focusId || focusId === 'world') {
      snapshot.location = latestPlayerLocationRef.current
      snapshot.relationships = relationships
      snapshot.bodyStatus = bodyStatus
      snapshot.hunger = hunger
    }
    if (!focusId || focusId === 'progress') {
      snapshot.worldProgress = worldProgress
      snapshot.dynamicState = dynamicStateForPrompt(latestDynamicStateRef.current)
    } else if (focusId === 'world') {
      snapshot.dynamicState = dynamicStateForPrompt(latestDynamicStateRef.current)
    }
    return Object.keys(snapshot).length ? snapshot : null
  }
  // Save từ các bản trước chưa có IndexedDB exact: chép nền một lần ngay khi
  // vào màn chơi. Không chờ embedding và không chặn giao diện.
  useEffect(() => {
    backfillArchiveFromMessages(messages, trainerId).catch((error) => console.warn('[archive] backfill bỏ qua:', error.message))
    // Chỉ backfill snapshot lúc mount; lượt mới được archiveExchange tự ghi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reroll phục hồi checkpoint rồi reload để mọi React state đọc lại đúng snapshot.
  // Cờ session chỉ sống qua đúng lần reload này và bị xoá trước khi gọi API.
  useEffect(() => {
    let pending = null
    try {
      pending = JSON.parse(sessionStorage.getItem('trainer-arena:pending-reroll') || 'null')
      if (pending) sessionStorage.removeItem('trainer-arena:pending-reroll')
    } catch { /* ignore */ }
    if (!pending || pending.trainerId !== trainerId || loading) return
    const restored = latestMessagesRef.current
    const timer = setTimeout(() => { void callAI(restored, pending.userText ?? '', null, { reroll: true }) }, 80)
    return () => clearTimeout(timer)
    // Chỉ kiểm tra một lần sau reload; callAI là function declaration ổn định trong lượt mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dọn ký ức + tóm tắt cho các tin bị xoá (đợt 61). idxs = mảng index bị xoá.
  // Xoá sạch mọi lớp trí nhớ (đợt 61) — dùng cho "Xoá toàn bộ lịch sử".
  async function wipeAllMemory() {
    // Bẻ mọi callback nền khỏi transcript cũ trước khi rollback toàn nhánh.
    latestMessagesRef.current = []
    const firstTurn = (messages ?? []).find((message) => message?.role === 'user' && message?.id)
    let restored = null
    if (firstTurn?.id) restored = await restoreBranchStateCheckpoint(trainerId, firstTurn.id, [])
    if (!restored && messages.length) rollbackLegacyBranch(messages)
    resetChat()
    closeIndexBoundUi()
    try { clearMemory() } catch { /* ignore */ }
    await clearArchive(trainerId)
    try { clearSummary() } catch { /* ignore */ }
    if (restored) window.location.reload()
  }

  async function cleanupMemoryFor(idxs, newCount) {
    if (idxs.length) {
      const lo = Math.min(...idxs)
      // Xoá từ nhánh bị cắt tới cuối. Giữ ký ức phía sau sẽ làm một timeline
      // đã reroll/xoá quay lại như canon dù index của nó đã thay đổi.
      forgetMemoriesInTurnRange(lo, Number.MAX_SAFE_INTEGER)
      await forgetArchiveRange(lo, Number.MAX_SAFE_INTEGER, trainerId)
    }
    // Kéo coverage tóm tắt về, để lần tóm tắt sau không nhắc nội dung đã xoá.
    trimSummaryCoverage(newCount)
  }

  // Đóng mọi UI đang trỏ theo INDEX của mảng messages (đợt 64). Sau khi xoá
  // tin, các index này lệch đi 1 → modal/ô sửa sẽ trỏ NHẦM sang tin khác
  // (VD đang sửa tin số 5, xoá tin số 2 ở chỗ khác → lưu đè lên tin số 6).
  function closeIndexBoundUi() {
    setShopMsgIndex(null)
    setTurnInfoIndex(null)
    setEditingIndex(null)
    setCtxMenu(null)
    // Trận đang mở cũng trỏ theo index (để ghi snapshot đối thủ khi bấm Ẩn)
    // → đóng luôn, tránh ghi snapshot nhầm sang tin khác.
    if (activeBattleMsgIndex !== null) {
      setActiveBattleMsgIndex(null)
      setBattleOpen(false)
    }
  }

  function findTurnTriggerIndex(messageIndex) {
    const message = messages[messageIndex]
    if (!message) return -1
    if (message.role === 'user') return messageIndex
    const checkpointId = message.meta?.branchCheckpointId
    if (checkpointId) {
      const exact = messages.findIndex((entry) => entry?.id === checkpointId)
      if (exact >= 0) return exact
    }
    for (let index = messageIndex - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === 'user') return index
    }
    return messageIndex
  }


  // Đợt 108: MỌI đường xóa transcript đều phải đi qua đây. Trước đó menu
  // trên ô nhập có một lối tắt chỉ filter() message, khiến state/Pokémon vẫn
  // sống sau khi chữ đã biến mất và reroll lần sau tạo bản sao.
  async function rollbackAndCutBranch(triggerIndex, { keepTrigger = false } = {}) {
    if (triggerIndex < 0 || triggerIndex >= messages.length) return false
    const trigger = messages[triggerIndex]
    const branchMessages = messages.slice(triggerIndex)
    const restoredMessages = keepTrigger ? messages.slice(0, triggerIndex + 1) : messages.slice(0, triggerIndex)
    latestMessagesRef.current = restoredMessages
    stateScanLocksRef.current.clear()

    let restored = null
    if (trigger?.id) restored = await restoreBranchStateCheckpoint(trainerId, trigger.id, restoredMessages)
    if (!restored) rollbackLegacyBranch(branchMessages)

    setMessages(restoredMessages)
    const removedStart = keepTrigger ? triggerIndex + 1 : triggerIndex
    const removedIndexes = [...Array(Math.max(0, messages.length - removedStart))].map((_, offset) => removedStart + offset)
    await cleanupMemoryFor(removedIndexes, restoredMessages.length)
    closeIndexBoundUi()
    if (restored) {
      // Reload bảo đảm mọi persisted React state đọc lại đúng snapshot, đồng
      // thời orphan-sweeper ở GameContext dọn những cá thể từ bug đời cũ.
      window.location.reload()
    }
    return true
  }

  // Fallback cho save/tin quá cũ chưa có branch checkpoint. Không thể phục
  // hồi chính xác evolution/level tuyệt đối của lịch sử đời cũ, nhưng ít nhất
  // mọi entity có source id + delta cộng dồn phải được gỡ để không sinh Pokémon
  // ma/bản sao khi người chơi reroll sau đó.
  function rollbackLegacyBranch(branchMessages) {
    const assistantMessages = (branchMessages ?? []).filter((message) => message?.role === 'assistant')
    const sourceIds = new Set(assistantMessages.map((message) => message?.id).filter(Boolean))
    const manifests = assistantMessages.map((message) => message?.meta?.appliedState).filter(Boolean)

    const acquiredByRemovedSource = (mon) => {
      const source = String(mon?.acquisitionSourceId ?? '')
      return source && [...sourceIds].some((id) => source.startsWith(`${id}:pokemon:`))
    }
    const nextParty = (latestPartyRef.current ?? []).filter((mon) => !acquiredByRemovedSource(mon))
    const nextPc = (latestPcBoxRef.current ?? []).filter((mon) => !acquiredByRemovedSource(mon))
    let nextActive = latestPlayerMonRef.current
    if (acquiredByRemovedSource(nextActive)) nextActive = nextParty[0] ?? null
    setParty(nextParty)
    setPcBox(nextPc)
    setPlayerMon(nextActive)
    latestPartyRef.current = nextParty
    latestPcBoxRef.current = nextPc
    latestPlayerMonRef.current = nextActive

    const moneyDelta = manifests.reduce((sum, manifest) => sum + (Number(manifest?.money) || 0), 0)
    if (moneyDelta) setPlayerProfile((cur) => ({ ...cur, money: Math.max(0, (Number(cur?.money) || 0) - moneyDelta) }))

    const relDeltas = new Map()
    const bodyDeltas = new Map()
    const hungerDelta = { player: 0, mon: 0 }
    const itemDeltas = new Map()
    for (const manifest of manifests) {
      for (const entry of manifest?.rel ?? []) relDeltas.set(normalizeMonTarget(entry.name), (relDeltas.get(normalizeMonTarget(entry.name)) ?? 0) + (Number(entry.delta) || 0))
      for (const entry of manifest?.body ?? []) bodyDeltas.set(entry.part, (bodyDeltas.get(entry.part) ?? 0) + (Number(entry.delta) || 0))
      for (const entry of manifest?.hunger ?? []) hungerDelta[entry.who === 'mon' ? 'mon' : 'player'] += Number(entry.delta) || 0
      for (const entry of manifest?.items ?? []) {
        const key = resolveItemByName(entry.name)?.id ?? normalizeMonTarget(entry.name)
        const row = itemDeltas.get(key) ?? { name: entry.name, qty: 0 }
        row.qty += Number(entry.qty) || 0
        itemDeltas.set(key, row)
      }
    }
    if (relDeltas.size) setRelationships((cur) => (cur ?? []).map((entry) => {
      const delta = relDeltas.get(normalizeMonTarget(entry.name)) ?? 0
      return delta ? { ...entry, affinity: Math.max(-100, Math.min(100, (Number(entry.affinity) || 0) - delta)) } : entry
    }))
    if (bodyDeltas.size) setBodyStatus((cur) => {
      const next = { ...(cur ?? {}) }
      for (const [part, delta] of bodyDeltas) next[part] = Math.max(0, Math.min(100, (Number(next[part]) || 0) - delta))
      return next
    })
    if (hungerDelta.player || hungerDelta.mon) adjustHunger({ player: -hungerDelta.player, mon: -hungerDelta.mon })
    if (itemDeltas.size) setInventory((cur) => {
      const next = [...(cur ?? [])]
      for (const row of itemDeltas.values()) {
        const known = resolveInventoryItemByName(row.name, next) ?? resolveItemByName(row.name) ?? createCustomItemDescriptor(row.name)
        if (!known || !row.qty) continue
        const at = next.findIndex((item) => item.id === known.id)
        const inverse = -row.qty
        if (inverse > 0) {
          if (at >= 0) next[at] = { ...next[at], qty: (Number(next[at].qty) || 0) + inverse }
          else next.push({ ...known, qty: inverse })
        } else if (at >= 0 && !next[at].infinite) {
          const left = Math.max(0, (Number(next[at].qty) || 0) + inverse)
          if (left > 0) next[at] = { ...next[at], qty: left }
          else next.splice(at, 1)
        }
      }
      latestInventoryRef.current = next
      return next
    })

    if (sourceIds.size) {
      const current = latestDynamicStateRef.current ?? { version: 1, values: {} }
      const values = Object.fromEntries(Object.entries(current.values ?? {}).filter(([, entry]) => !sourceIds.has(entry?.sourceMessageId)))
      const nextDynamic = { ...current, values }
      latestDynamicStateRef.current = nextDynamic
      setDynamicState(nextDynamic)
    }
  }

  async function handleDeleteMessage(i) {
    const target = messages[i]
    if (!target || loading) return
    const triggerIndex = findTurnTriggerIndex(i)
    if (triggerIndex < 0) return
    const trigger = messages[triggerIndex]
    const keepTrigger = target.role === 'assistant' && trigger?.role === 'user'
    const cutCount = messages.length - (keepTrigger ? triggerIndex + 1 : triggerIndex)
    const removedAssistantCount = messages.slice(triggerIndex).filter((message) => message?.role === 'assistant').length
    const ok = window.confirm(
      `Xoá ${target.role === 'assistant' ? 'phản hồi này' : 'lượt này'} và cắt ${Math.max(0, cutCount)} tin thuộc nhánh phía sau?\n\n` +
      `State của nhánh bị xoá (Pokémon, tiền, vật phẩm, level, vị trí, biến động...) sẽ được hoàn tác. ${removedAssistantCount ? `Có ${removedAssistantCount} phản hồi AI bị loại khỏi canon.` : ''}`,
    )
    if (!ok) return
    await rollbackAndCutBranch(triggerIndex, { keepTrigger })
  }

  function openCtxMenuAt(clientX, clientY, i) {
    // Kẹp vị trí để menu không tràn mép phải/dưới màn hình.
    const MENU_W = 230
    const MENU_H = 250
    setCtxMenu({
      x: Math.max(8, Math.min(clientX, window.innerWidth - MENU_W - 8)),
      y: Math.max(8, Math.min(clientY, window.innerHeight - MENU_H - 8)),
      index: i,
    })
  }

  function openCtxMenu(e, i) {
    e.preventDefault()
    openCtxMenuAt(e.clientX, e.clientY, i)
  }

  // CHẠM GIỮ trên mobile (đợt 53): điện thoại KHÔNG có chuột phải — giữ ngón
  // ~500ms trên tin nhắn để mở đúng menu đó. Vuốt/nhả sớm thì huỷ.
  const longPressRef = useRef({ timer: null, x: 0, y: 0 })
  function touchProps(i) {
    return {
      onTouchStart: (e) => {
        const t = e.touches[0]
        if (!t) return
        longPressRef.current.x = t.clientX
        longPressRef.current.y = t.clientY
        clearTimeout(longPressRef.current.timer)
        longPressRef.current.timer = setTimeout(() => {
          openCtxMenuAt(longPressRef.current.x, longPressRef.current.y, i)
        }, 500)
      },
      onTouchMove: (e) => {
        const t = e.touches[0]
        if (!t) return
        // Di chuyển >10px = đang cuộn, không phải giữ.
        if (Math.abs(t.clientX - longPressRef.current.x) > 10 || Math.abs(t.clientY - longPressRef.current.y) > 10) {
          clearTimeout(longPressRef.current.timer)
        }
      },
      onTouchEnd: () => clearTimeout(longPressRef.current.timer),
      onTouchCancel: () => clearTimeout(longPressRef.current.timer),
    }
  }
  const [editDraft, setEditDraft] = useState('')
  const [shopMsgIndex, setShopMsgIndex] = useState(null) // index message đang mở shop
  // Đợt 71: index message đang mở Trung tâm Pokémon + tab mở sẵn ('heal'|'pc').
  const [pokecenterMsg, setPokecenterMsg] = useState(null) // {index, tab} | null
  const [lastPromptDebug, setLastPromptDebug] = useState(null)
  // Ghi nhớ tin nhắn nào đang mở trận, để chỉ đánh dấu "đã dùng" khi trận
  // THỰC SỰ kết thúc (thắng/thua/chạy) — bấm "Ẩn" để tạm đóng modal thì vẫn
  // đánh lại được, không bị khoá quả pokeball ngay từ lúc mở.
  const [activeBattleMsgIndex, setActiveBattleMsgIndex] = useState(null)
  const scrollRef = useRef(null)
  const fileInputRef = useRef(null)
  const stickToBottomRef = useRef(true)
  // Đợt 110: một khi người chơi chủ động kéo LÊN đọc lịch sử, khóa auto-follow
  // cho tới khi họ tự trở lại sát đáy hoặc bấm nút ↓. Điều này chặn action
  // choices/state audit/background callbacks kéo màn hình xuống vài giây/lần.
  const manualScrollLockRef = useRef(false)
  const lastScrollTopRef = useRef(0)
  const initialScrollDoneRef = useRef(false)
  const scrollRafRef = useRef(null)
  const [showJumpToBottom, setShowJumpToBottom] = useState(false)
  const [hasNewBelow, setHasNewBelow] = useState(false)

  function chatDistanceFromBottom(el = scrollRef.current) {
    if (!el) return 0
    return Math.max(0, el.scrollHeight - el.scrollTop - el.clientHeight)
  }

  function jumpToChatBottom({ behavior = 'smooth', force = true } = {}) {
    const el = scrollRef.current
    if (!el) return
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)
    scrollRafRef.current = requestAnimationFrame(() => {
      if (!scrollRef.current) return
      if (force) {
        manualScrollLockRef.current = false
        stickToBottomRef.current = true
      }
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior })
      lastScrollTopRef.current = scrollRef.current.scrollTop
      setShowJumpToBottom(false)
      setHasNewBelow(false)
      scrollRafRef.current = null
    })
  }

  function detachChatAutoScroll() {
    manualScrollLockRef.current = true
    stickToBottomRef.current = false
    setShowJumpToBottom(true)
  }

  function handleChatScroll() {
    const el = scrollRef.current
    if (!el) return
    const currentTop = el.scrollTop
    const movedUp = currentTop < lastScrollTopRef.current - 2
    const nearBottom = chatDistanceFromBottom(el) <= 96
    const trulyAtBottom = chatDistanceFromBottom(el) <= 12

    // Bất kỳ chuyển động lên nào cũng được coi là ý định đọc lịch sử. Không
    // auto-unlock chỉ vì người dùng vẫn còn nằm trong vùng 96px gần đáy.
    if (movedUp) manualScrollLockRef.current = true
    if (trulyAtBottom && !movedUp) manualScrollLockRef.current = false

    stickToBottomRef.current = nearBottom && !manualScrollLockRef.current
    lastScrollTopRef.current = currentTop
    setShowJumpToBottom(!trulyAtBottom || manualScrollLockRef.current)
    if (trulyAtBottom && !manualScrollLockRef.current) setHasNewBelow(false)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return undefined
    // Mount/load: đặt xuống cuối đúng MỘT lần, không smooth để tránh hiệu ứng
    // nhảy 3-4 lần khi các callback nền lần lượt hydrate UI.
    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true
      if (chatPreferences?.autoScroll !== false) jumpToChatBottom({ behavior: 'auto' })
      return undefined
    }
    if (chatPreferences?.autoScroll !== false && stickToBottomRef.current && !manualScrollLockRef.current) {
      // Background callbacks (action choices/state audit) dùng auto thay vì smooth:
      // không tạo cảm giác thanh cuộn tự chạy nhiều lần. Nút ↓ vẫn smooth.
      if (chatDistanceFromBottom(el) > 6) jumpToChatBottom({ behavior: 'auto' })
      else { setShowJumpToBottom(false); setHasNewBelow(false) }
    } else if (chatDistanceFromBottom(el) > 24 || manualScrollLockRef.current) {
      setShowJumpToBottom(true)
      setHasNewBelow(true)
    }
    return undefined
  }, [messages, loading, chatPreferences?.autoScroll])

  useEffect(() => () => {
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)
  }, [])

  function updateCharField(key, val) {
    setCharacter((c) => ({ ...c, [key]: val }))
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportError(null)
    try {
      const card = await importCharacterCard(file)
      setCharacter((c) => ({ ...c, ...card }))
    } catch (err) {
      setImportError(err.message)
    }
  }

  // configOverride: dùng khi muốn route sang API phụ (VD tuyến thua/chạy thoát).
  // Preset chính văn (JSON, nếu đã nạp) CHỈ áp dụng khi gọi API chính (không
  // có configOverride) — API phụ vẫn dùng preset văn phong (text) đơn giản.
  // Áp mọi biến trạng thái từ 1 kết quả parseStoryStateTags (đợt 36).
  // KHÔNG áp money/rel/body/shop ở đây — các phần đó đã có luồng riêng phía
  // dưới từ trước; hàm này lo POKEMON / LEVEL / ITEM / DATE / TRAIN /
  // HUNGER / NPC / FACT. LEVEL là đường chính thức cho Kẹo Hiếm/năng lực;
  // POKEMON trùng loài chỉ còn là nhánh tương thích model cũ.
  function applyParsedState(parsed, turnNow, storyText = '', sourceMessageId = '') {
    const report = {
      lines: [],
      ledgerState: Object.fromEntries(APPLY_GATED_FIELDS.map((field) => [field, []])),
    }
    const markLedger = (field, entry) => {
      if (report.ledgerState[field]) report.ledgerState[field].push(entry)
    }
    const semanticFallbackUpdates = []
    const deferSemanticState = (entry, target, value, namespace = 'unresolved') => {
      if (!(entry?.semantic || entry?.canon) || !target) return
      semanticFallbackUpdates.push({
        kind: 'custom_state',
        target,
        namespace,
        operation: 'set',
        value,
        details: {
          sourceKind: entry.kind ?? null,
          evidence: entry.evidence ?? entry.note ?? '',
          semanticEventId: entry.semanticEventId ?? null,
        },
        semantic: true,
        canon: true,
      })
    }
    let previewActive = latestPlayerMonRef.current
    let previewParty = [...(latestPartyRef.current ?? [])]
    let previewPc = [...(latestPcBoxRef.current ?? [])]
    const resolveOwned = (target) => resolveOwnedMonTarget(target, previewActive, [...previewParty, ...previewPc])
    const evolutionDebits = new Map()
    const appliedFriendshipDirectives = new Set()
    let mysteryBallRevealsApplied = 0
    // Cho phép một lượt hợp lệ vừa hoàn tất nghi thức, vừa gặp/thuyết phục
    // huyền thoại. Dùng bản tiến trình dự kiến đã qua evidence thay vì closure
    // worldProgress cũ chưa kịp rerender.
    let prospectiveWorldProgress = worldProgress
    try {
      prospectiveWorldProgress = applyWorldDirectives(worldProgress, parsed, { mode: storyTone, turn: turnNow, date: storyDate })
    } catch (worldPreviewError) {
      // Đợt 102: preview chỉ phục vụ cổng encounter/legendary trong CÙNG lượt.
      // Một directive world lỗi tuyệt đối không được làm chết LEVEL/ITEM/POKEMON
      // và các biến độc lập khác của cả batch. Commit world thật vẫn có validator
      // riêng ở phía dưới; ở đây giữ snapshot trước lượt và cho pipeline tiếp tục.
      console.warn('[state] preview world-progress lỗi, giữ snapshot hiện tại:', worldPreviewError.message)
      report.lines.push(`⚠ Preview tiến trình thế giới lỗi; các biến độc lập vẫn tiếp tục: ${worldPreviewError.message}`)
    }

    function replacePreviewMon(identity, transform) {
      if (previewActive && monIdentityMatches(previewActive, identity)) previewActive = transform(previewActive)
      previewParty = previewParty.map((mon) => (monIdentityMatches(mon, identity) ? transform(mon) : mon))
      previewPc = previewPc.map((mon) => (monIdentityMatches(mon, identity) ? transform(mon) : mon))
    }

    try {
      const findSpeciesEntry = (value) => resolveSpeciesEntryFlexible(pokedexSpecies, value)
        ?? findEvolutionSpeciesEntry(pokedexSpecies, value)
      const isCanonDirective = (entry) => Boolean(entry?.semantic || entry?.canon)
      // Canon có thể tạo entity và chỉnh nó trong cùng một lượt. Không được
      // biến thứ tự mảng directive thành thứ tự phụ thuộc dữ liệu. Những patch
      // nhắm vào Pokémon chưa tồn tại sẽ được giữ trong transaction và retry
      // NGAY sau acquisition/evolution trước khi mới cân nhắc dynamic fallback.
      const pendingLevelDirectives = []
      const pendingEvolutionDirectives = []
      const evolveOne = (targetMon, targetEntry, source = 'tag') => {
        const fromName = targetMon.name
        const identity = { uid: targetMon.uid, name: targetMon.name }
        // Dựng đúng MỘT snapshot rồi dùng chung cho playerMon + party. Nếu
        // gọi evolveOwnedMon hai lần, save rất cũ chưa có moves có thể roll
        // hai moveset khác nhau và lại làm hai bản của cùng uid lệch nhau.
        const evolvedSnapshot = evolveOwnedMon(targetMon, targetEntry, movesDb)
        const transform = () => evolvedSnapshot
        setPlayerMon((cur) => (monIdentityMatches(cur, identity) ? transform() : cur))
        setParty((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? transform() : mon)))
        setPcBox((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? transform() : mon)))
        replacePreviewMon(identity, transform)
        report.lines.push(`✅ Tiến hoá: ${fromName} → ${targetEntry.name} · Lv.${targetMon.level ?? 1}${source === 'inferred' ? ' (app xác nhận từ chính văn)' : ''}`)
      }

      // LEVEL chạy TRƯỚC EVOLVE. Một lượt tiến hoá do lên cấp thường có cả
      // [[LEVEL Fletchling | +1]] và [[EVOLVE Fletchling | Fletchinder]];
      // nếu đổi tên trước thì tag LEVEL tên cũ sẽ mất target.
      const realisticMode = normalizeGameMode(storyTone) === 'realistic' && !adminMode
      const reserveEvolutionItem = (targetEntry) => {
        if (!realisticMode || !String(targetEntry?.evoType ?? '').toLowerCase().includes('useitem') || !targetEntry.evoItem) return { ok: true }
        const item = resolveItemByName(targetEntry.evoItem)
        if (!item) return { ok: false, reason: `vật phẩm tiến hoá ${targetEntry.evoItem} chưa có trong danh mục` }
        const stock = (latestInventoryRef.current ?? []).filter((entry) => entry.id === item.id)
          .reduce((sum, entry) => sum + (entry.infinite ? 999999 : Math.max(0, Number(entry.qty) || 0)), 0)
        const reserved = evolutionDebits.get(item.id) ?? 0
        if (stock <= reserved) return { ok: false, reason: `không còn ${item.name} để tiêu thụ cho lần tiến hoá này` }
        evolutionDebits.set(item.id, reserved + 1)
        return { ok: true, item }
      }
      const candyStock = (latestInventoryRef.current ?? []).filter((item) => /rare\s*candy|kẹo\s*hiếm/i.test(`${item.name} ${item.id}`))
        .reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0)
      const candyDebit = (parsed.items ?? []).filter((item) => item.qty < 0 && /rare\s*candy|kẹo\s*hiếm/i.test(item.name))
        .reduce((sum, item) => sum + Math.abs(item.qty), 0)
      let verifiedCandyBudget = Math.min(candyStock, candyDebit)
      for (const directive of parsed.levels ?? []) {
        let targetMon = resolveOwned(directive.target)
        // Model đôi khi gọi luôn TÊN SAU TIẾN HOÁ trong LEVEL dù cá thể trong
        // state vẫn đang mang tên cũ ở thời điểm áp. Nếu cùng lượt có EVOLVE
        // A→B, chuyển target B về đúng cá thể A rồi mới nâng cấp.
        if (!targetMon) {
          const linkedEvolution = (parsed.evolutions ?? []).find((ev) =>
            normalizeMonTarget(ev.to) === normalizeMonTarget(directive.target),
          )
          if (linkedEvolution) {
            targetMon = resolveOwned(linkedEvolution.from)
          }
        }
        if (!targetMon) {
          if (isCanonDirective(directive)) {
            pendingLevelDirectives.push(directive)
            report.lines.push(`ℹ Chờ tạo/resolve cá thể “${directive.target}” rồi mới áp cấp trong cùng transaction`)
          } else {
            report.lines.push(`⚠ Không áp cấp “${directive.target}”: không tìm thấy Pokémon tương ứng trong đội`)
          }
          continue
        }
        const requiredCandy = directive.mode === 'delta'
          ? Math.max(0, directive.value)
          : Math.max(0, directive.value - (targetMon.level ?? 1))
        if (realisticMode && !isCanonDirective(directive)
          && (requiredCandy <= 0 || verifiedCandyBudget < requiredCandy || !/rare\s*candy|kẹo\s*hiếm/i.test(storyText))) {
          report.lines.push(`⚠ Chế độ Thực tế chặn tăng cấp legacy cho ${directive.target}: cần ${requiredCandy || 1} Kẹo Hiếm hợp lệ`)
          continue
        }
        if (realisticMode && !isCanonDirective(directive)) verifiedCandyBudget -= requiredCandy
        const before = targetMon.level ?? 1
        const previewAfter = applyLevelDirective(targetMon, directive, movesDb)
        const after = previewAfter?.level ?? before
        if (after <= before) {
          report.lines.push(`ℹ ${targetMon.name} đang Lv.${before} — chỉ dẫn này không làm thay đổi biến`)
          markLedger('levels', directive)
          continue
        }
        const identity = { uid: targetMon.uid, name: targetMon.name }
        const apply = (mon) => applyLevelDirective(mon, directive, movesDb)
        setPlayerMon((cur) => (monIdentityMatches(cur, identity) ? apply(cur) : cur))
        setParty((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? apply(mon) : mon)))
        setPcBox((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? apply(mon) : mon)))
        replacePreviewMon(identity, apply)
        report.lines.push(`✅ ${targetMon.name}: Lv.${before} → Lv.${after}`)
        markLedger('levels', directive)
      }

      // FRIEND phải có hiệu lực trước EVOLVE trong cùng lượt. Nếu không, một
      // cảnh đạt ngưỡng thân mật rồi tiến hoá vẫn bị kiểm tra bằng friendship cũ.
      for (const [index, directive] of (parsed.friendships ?? []).entries()) {
        const targetMon = resolveOwned(directive.target)
        if (!targetMon) continue // Có thể là Pokémon mới nhận ở phần POKEMON bên dưới.
        const before = Number.isFinite(targetMon.friendship) ? targetMon.friendship : 70
        const identity = { uid: targetMon.uid, name: targetMon.name }
        const apply = (mon) => adjustFriendship(mon, directive.delta)
        const after = apply(targetMon).friendship
        setPlayerMon((cur) => (monIdentityMatches(cur, identity) ? apply(cur) : cur))
        setParty((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? apply(mon) : mon)))
        setPcBox((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? apply(mon) : mon)))
        replacePreviewMon(identity, apply)
        appliedFriendshipDirectives.add(index)
        markLedger('friendships', directive)
        report.lines.push(`✅ Thân mật ${targetMon.name}: ${before} → ${after}${directive.note ? ` (${directive.note})` : ''}`)
      }

      for (const evolution of parsed.evolutions ?? []) {
        const targetMon = resolveOwned(evolution.from)
        if (!targetMon) {
          if (isCanonDirective(evolution)) {
            pendingEvolutionDirectives.push(evolution)
            report.lines.push(`ℹ Chờ tạo/resolve cá thể “${evolution.from}” rồi mới áp tiến hoá trong cùng transaction`)
          } else {
            report.lines.push(`⚠ Không tiến hoá “${evolution.from}”: không tìm thấy cá thể tương ứng trong đội`)
          }
          continue
        }
        const fromEntry = findSpeciesEntry(targetMon.species ?? targetMon.name)
        let targetEntry = findSpeciesEntry(evolution.to)
        if (!targetEntry && isCanonDirective(evolution)) {
          targetEntry = buildCustomSpeciesEntry(evolution.to, {
            ...(evolution.details ?? {}),
            // Custom evolution không có dữ liệu canon thì giữ nền stat/type cũ
            // để cá thể không đột ngột yếu/khác hệ chỉ vì database chưa biết form.
            baseStats: evolution.details?.baseStats ?? targetMon.baseStats,
            types: evolution.details?.types ?? targetMon.types,
            ability: evolution.details?.ability ?? targetMon.ability,
          })
        }
        if (!targetEntry) {
          report.lines.push(`⚠ Không tiến hoá ${targetMon.name}: không resolve được dạng “${evolution.to}”`)
          continue
        }
        if (!isCanonDirective(evolution)) {
          const evolutionCheck = validateEvolutionRequirements(targetMon, fromEntry, targetEntry, {
            mode: normalizeGameMode(storyTone), adminMode, inventory: latestInventoryRef.current,
            storyText, storyDate, location: latestPlayerLocationRef.current,
          })
          if (!evolutionCheck.ok) {
            report.lines.push(`⛔ Không tiến hoá ${targetMon.name} → ${targetEntry.name}: ${evolutionCheck.reason}`)
            continue
          }
        }
        if (normalizeMonTarget(targetMon.species ?? targetMon.name) === normalizeMonTarget(targetEntry.species ?? targetEntry.name)) {
          report.lines.push(`ℹ ${targetMon.name} đã ở đúng dạng ${targetEntry.name} — không đổi biến`)
          markLedger('evolutions', evolution)
          continue
        }
        if (!isCanonDirective(evolution)) {
          const itemReservation = reserveEvolutionItem(targetEntry)
          if (!itemReservation.ok) {
            report.lines.push(`⛔ Không tiến hoá ${targetMon.name} → ${targetEntry.name}: ${itemReservation.reason}`)
            continue
          }
        }
        evolveOne(targetMon, targetEntry, isCanonDirective(evolution) ? 'semantic' : (evolution.inferred ? 'inferred' : 'tag'))
        markLedger('evolutions', evolution)
      }

      // Semantic ownership loss: trade/thả/trao một cá thể đi. Làm trước
      // acquisition để một lượt trade có thể giải phóng slot rồi nhận cá thể mới.
      for (const removal of parsed.pokemonRemovals ?? []) {
        const targetMon = resolveOwned(removal.target)
        if (!targetMon) {
          // State đích đã đúng (không còn cá thể đó); ghi ledger để auditor
          // không lặp vô tận nhưng không tạo cảnh báo lỗi cho canon.
          report.lines.push(`ℹ ${removal.target}: canon xác nhận đã rời quyền sở hữu; save hiện không còn cá thể này`)
          markLedger('pokemonRemovals', removal)
          continue
        }
        const identity = { uid: targetMon.uid, name: targetMon.name }
        const remainingParty = previewParty.filter((mon) => !monIdentityMatches(mon, identity))
        previewParty = remainingParty
        if (previewActive && monIdentityMatches(previewActive, identity)) previewActive = remainingParty[0] ?? null
        previewPc = previewPc.filter((mon) => !monIdentityMatches(mon, identity))
        setParty((cur) => (cur ?? []).filter((mon) => !monIdentityMatches(mon, identity)))
        setPcBox((cur) => (cur ?? []).filter((mon) => !monIdentityMatches(mon, identity)))
        setPlayerMon((cur) => (monIdentityMatches(cur, identity) ? (remainingParty[0] ?? null) : cur))
        latestPartyRef.current = previewParty
        latestPlayerMonRef.current = previewActive
        latestPcBoxRef.current = previewPc
        report.lines.push(`✅ ${targetMon.nickname || targetMon.name} đã rời quyền sở hữu${removal.reason ? ` · ${removal.reason}` : ''}`)
        markLedger('pokemonRemovals', removal)
      }

      for (const [pokemonIndex, pk] of (parsed.pokemons ?? []).entries()) {
        let entry = findSpeciesEntry(pk.species)
        if (!entry && isCanonDirective(pk)) {
          entry = buildCustomSpeciesEntry(pk.species, {
            ...(pk.details ?? {}),
            types: pk.types ?? pk.details?.types,
            baseStats: pk.baseStats ?? pk.details?.baseStats,
            ability: pk.ability ?? pk.details?.ability,
            friendship: pk.friendship,
            gender: pk.gender,
            description: pk.description ?? pk.details?.description,
          })
        }
        if (!entry) {
          console.warn('[pokemon-state] Không resolve được loài:', pk.species)
          report.lines.push(`⚠ Không đồng bộ Pokémon “${pk.species}”: không resolve được loài`)
          continue
        }

        // Luật mode/legendary đã phải tác động ở bước SINH CỐT TRUYỆN. Nếu
        // displayText cuối cùng đã canon hoá quyền sở hữu thì state phải theo
        // canon, không được để một cổng hậu kỳ làm UI mâu thuẫn với truyện.
        if (!isCanonDirective(pk)) {
          const access = legendaryAccess(entry, prospectiveWorldProgress, storyTone, adminMode)
          if (!access.allowed) {
            report.lines.push(`⛔ Không cấp ${entry.name}: cổng tiến trình ${access.tier?.label ?? 'huyền thoại'} chưa mở — ${access.reason}`)
            continue
          }
        }

        // Idempotency theo đúng tin AI + vị trí tag. Reload/callback nền có
        // chạy lại cùng response cũng không thể sinh thêm một uid mới.
        const acquisitionSourceId = sourceMessageId
          ? `${sourceMessageId}:pokemon:${normalizeMonTarget(pk.species)}:${pokemonIndex}`
          : ''
        const alreadyApplied = acquisitionSourceId && [previewActive, ...previewParty, ...previewPc]
          .some((mon) => mon?.acquisitionSourceId === acquisitionSourceId)
        if (alreadyApplied) {
          report.lines.push(`ℹ Bỏ qua ${entry.name}: thay đổi từ tin này đã được áp trước đó`)
          markLedger('pokemons', pk)
          continue
        }

        // Tương thích model cũ: model kể Fletchling tiến hoá nhưng vẫn dùng
        // [[POKEMON Fletchinder | Lv19]]. Nếu Pokédex xác nhận quan hệ trực
        // tiếp VÀ chính văn khẳng định tiến hoá đã xảy ra, thay đúng cá thể
        // cũ thay vì thêm “con chim cấp 2” thứ hai.
        const owned = []
        for (const mon of [previewActive, ...previewParty, ...previewPc]) {
          if (mon && !owned.some((x) => isSameMon(x, mon))) owned.push(mon)
        }
        const prevo = owned.find((mon) => {
          const fromEntry = findSpeciesEntry(mon.species ?? mon.name)
          return isDirectEvolution(fromEntry, entry) && storyClaimsEvolution(storyText, mon.name, entry.name)
        })
        if (prevo) {
          const beforeLevel = prevo.level ?? 1
          const requestedLevel = Math.max(beforeLevel, Math.min(100, Number(pk.level) || beforeLevel))
          let current = prevo
          if (requestedLevel > beforeLevel) {
            if (realisticMode && !isCanonDirective(pk)) {
              report.lines.push(`⛔ Chế độ Thực tế bỏ phần tăng cấp ngầm ${prevo.name} Lv.${beforeLevel} → Lv.${requestedLevel} trong tag POKEMON`)
              if (Number.isFinite(entry.evoLevel) && beforeLevel < entry.evoLevel) continue
            } else {
            const identity = { uid: prevo.uid, name: prevo.name }
            const raise = (mon) => raiseMonToLevel(mon, requestedLevel, movesDb)
            setPlayerMon((cur) => (monIdentityMatches(cur, identity) ? raise(cur) : cur))
            setParty((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? raise(mon) : mon)))
            setPcBox((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? raise(mon) : mon)))
            replacePreviewMon(identity, raise)
            current = raise(prevo)
            report.lines.push(`✅ ${prevo.name}: Lv.${beforeLevel} → Lv.${requestedLevel}`)
            }
          }
          const fromEntry = findSpeciesEntry(current.species ?? current.name)
          if (!isCanonDirective(pk)) {
            const inferredCheck = validateEvolutionRequirements(current, fromEntry, entry, {
              mode: normalizeGameMode(storyTone), adminMode, inventory: latestInventoryRef.current,
              storyText, storyDate, location: latestPlayerLocationRef.current,
            })
            if (!inferredCheck.ok) {
              report.lines.push(`⛔ Không tiến hoá ${current.name} → ${entry.name}: ${inferredCheck.reason}`)
              continue
            }
            const itemReservation = reserveEvolutionItem(entry)
            if (!itemReservation.ok) {
              report.lines.push(`⛔ Không tiến hoá ${current.name} → ${entry.name}: ${itemReservation.reason}`)
              continue
            }
          }
          evolveOne(current, entry, isCanonDirective(pk) ? 'semantic' : 'inferred')
          markLedger('pokemons', pk)
          continue
        }

        // Thực tế mới nắn level theo sinh thái. Anime/Sandbox phải giữ đúng
        // level người chơi/AI đã tuyên bố và không biến Pokémon sở hữu thành boss.
        const saneLv = realisticMode && !isCanonDirective(pk)
          ? receivedMonLevel({ entry, requestedLevel: pk.level, location: playerLocation })
          : Math.max(1, Math.min(100, Math.floor(Number(pk.level) || 1)))
        const builtMon = realisticMode && !isCanonDirective(pk)
          ? buildMonSmart(entry, saneLv, movesDb)
          : buildWildMon(entry, saneLv, movesDb)
        let acquiredSnapshot = normalizeAcquiredMon({
          ...builtMon,
          ...(pk.gender ? { gender: pk.gender, genderSource: pk.semantic ? 'semantic' : 'story' } : {}),
          ...(pk.shiny !== undefined ? { shiny: Boolean(pk.shiny) } : {}),
          ...(pk.nature ? { nature: pk.nature } : {}),
          ...(pk.ability ? { ability: String(pk.ability) } : {}),
          ...(pk.teraType ? { teraType: String(pk.teraType).toLowerCase() } : {}),
          ...(pk.nickname ? { nickname: String(pk.nickname) } : {}),
          ...(pk.form ? { forme: String(pk.form) } : {}),
          ...(Number.isFinite(Number(pk.friendship)) ? { friendship: Math.max(0, Math.min(255, Number(pk.friendship))) } : {}),
          ...((pk.details?.customAttributes && typeof pk.details.customAttributes === 'object') ? {
            customAttributes: { ...pk.details.customAttributes },
          } : {}),
        })
        acquiredSnapshot = recomputeMonStats(acquiredSnapshot)
        const newMon = ensurePokemonIdentity({
          ...applyPerksToMon(acquiredSnapshot, playerTraits),
          ...(acquisitionSourceId ? { acquisitionSourceId } : {}),
        }, trainerId)
        if (previewParty.length < 6) {
          setParty((cur) => {
            const next = [...(cur ?? [])]
            if (next.some((mon) => monIdentityMatches(mon, newMon))) return next
            return next.length < 6 ? [...next, newMon] : next
          })
          setPlayerMon((cur) => cur ?? newMon)
          previewParty.push(newMon)
          if (!previewActive) previewActive = newMon
          report.lines.push(`✅ Nhận Pokémon: ${newMon.name} Lv.${newMon.level}`)
        } else {
          // Đội đầy thì đưa vào PC thay vì để DNA báo nhận rồi dữ liệu biến mất.
          setPcBox((cur) => [...(cur ?? []), newMon])
          previewPc.push(newMon)
          latestPcBoxRef.current = previewPc
          report.lines.push(`✅ Nhận Pokémon: ${newMon.name} Lv.${newMon.level} · đội đầy, đã gửi vào PC`)
        }
        markLedger('pokemons', pk)
        if (proseSupportsMysteryBallReveal(storyText, pk.species, { inventory: latestInventoryRef.current })) {
          mysteryBallRevealsApplied += 1
        }
      }

      // Retry dependency-sensitive semantic operations sau khi acquisition đã
      // tạo cá thể. Đây là chốt cho lượt “nhận Ditto + tăng cấp/tiến hoá”:
      // state không còn phụ thuộc model xếp event nào trước trong JSON.
      const retryPendingLevel = (directive, finalAttempt = false) => {
        const targetMon = resolveOwned(directive.target)
        if (!targetMon) {
          if (finalAttempt) {
            deferSemanticState(directive, `Pokémon ${directive.target} · cấp`, { mode: directive.mode, value: directive.value }, 'pokemon')
            report.lines.push(`ℹ Không resolve được cá thể “${directive.target}” sau transaction; đã giữ thay đổi cấp trong state động`)
          }
          return false
        }
        const before = targetMon.level ?? 1
        const previewAfter = applyLevelDirective(targetMon, directive, movesDb)
        const after = previewAfter?.level ?? before
        if (after <= before) {
          report.lines.push(`ℹ ${targetMon.name} đang Lv.${before} — chỉ dẫn cấp đã ở trạng thái đích`)
          markLedger('levels', directive)
          return true
        }
        const identity = { uid: targetMon.uid, name: targetMon.name }
        const apply = (mon) => applyLevelDirective(mon, directive, movesDb)
        setPlayerMon((cur) => (monIdentityMatches(cur, identity) ? apply(cur) : cur))
        setParty((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? apply(mon) : mon)))
        setPcBox((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? apply(mon) : mon)))
        replacePreviewMon(identity, apply)
        report.lines.push(`✅ ${targetMon.name}: Lv.${before} → Lv.${after} (retry dependency)`)
        markLedger('levels', directive)
        return true
      }
      let unresolvedPendingLevels = pendingLevelDirectives.filter((directive) => !retryPendingLevel(directive, false))

      for (const evolution of pendingEvolutionDirectives) {
        const targetMon = resolveOwned(evolution.from)
        if (!targetMon) {
          deferSemanticState(evolution, `Pokémon ${evolution.from} · tiến hoá`, evolution.to, 'pokemon')
          report.lines.push(`ℹ Không resolve được cá thể “${evolution.from}” sau acquisition; đã giữ tiến hoá trong state động`)
          continue
        }
        let targetEntry = findSpeciesEntry(evolution.to)
        if (!targetEntry) {
          targetEntry = buildCustomSpeciesEntry(evolution.to, {
            ...(evolution.details ?? {}),
            baseStats: evolution.details?.baseStats ?? targetMon.baseStats,
            types: evolution.details?.types ?? targetMon.types,
            ability: evolution.details?.ability ?? targetMon.ability,
          })
        }
        evolveOne(targetMon, targetEntry, 'semantic')
        markLedger('evolutions', evolution)
      }
      // Một LEVEL có thể dùng tên SAU tiến hoá; thử lại lần cuối sau evolution.
      for (const directive of unresolvedPendingLevels) retryPendingLevel(directive, true)

      for (const [index, directive] of (parsed.friendships ?? []).entries()) {
        if (appliedFriendshipDirectives.has(index)) continue
        const targetMon = resolveOwned(directive.target)
        if (!targetMon) {
          deferSemanticState(directive, `Pokémon ${directive.target} · friendship`, directive.delta, 'pokemon')
          report.lines.push((directive.semantic || directive.canon)
            ? `ℹ Chưa resolve được ${directive.target}; đã giữ thay đổi friendship trong state động`
            : `⚠ Không áp thân mật “${directive.target}”: không tìm thấy Pokémon tương ứng trong đội`)
          continue
        }
        const before = Number.isFinite(targetMon.friendship) ? targetMon.friendship : 70
        const identity = { uid: targetMon.uid, name: targetMon.name }
        const apply = (mon) => adjustFriendship(mon, directive.delta)
        const after = apply(targetMon).friendship
        setPlayerMon((cur) => (monIdentityMatches(cur, identity) ? apply(cur) : cur))
        setParty((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? apply(mon) : mon)))
        setPcBox((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? apply(mon) : mon)))
        replacePreviewMon(identity, apply)
        markLedger('friendships', directive)
        report.lines.push(`✅ Thân mật ${targetMon.name}: ${before} → ${after}${directive.note ? ` (${directive.note})` : ''}`)
      }

      // Đợt 105 — patch thuộc tính cá thể từ Semantic State Engine. Đây là
      // đường cho các thay đổi không nên ép thành tag: Shiny được xác nhận,
      // đổi Nature/Ability/Tera/nickname/form theo cốt truyện, v.v. Mỗi patch
      // nhắm vào đúng uid/name và được đồng bộ active + party + PC.
      for (const patch of parsed.pokemonPatches ?? []) {
        const targetMon = resolveOwned(patch.target)
        if (!targetMon) {
          deferSemanticState(patch, `Pokémon ${patch.target} · thuộc tính`, patch.fields ?? {}, 'pokemon')
          report.lines.push((patch.semantic || patch.canon)
            ? `ℹ Chưa resolve được cá thể “${patch.target}”; đã giữ thuộc tính trong state động`
            : `⚠ Không áp thuộc tính Pokémon “${patch.target}”: không tìm thấy cá thể`)
          continue
        }
        const fields = { ...(patch.fields ?? {}) }
        const abilityChangeRequested = Boolean(fields.ability)
        const abilityChangeAllowed = canRewritePokemonAbility(playerTraits)
        if (abilityChangeRequested && !abilityChangeAllowed) {
          report.lines.push(`⚠ Không đổi Ability ${targetMon.name} → ${fields.ability}: người chơi không có thiên phú cho phép thay Ability`)
          delete fields.ability
        }
        if (Object.keys(fields).length === 0) continue
        const identity = { uid: targetMon.uid, name: targetMon.name }
        const transform = (mon) => {
          if (!mon) return mon
          let next = { ...mon }
          const gender = normalizePokemonGender(fields.gender)
          if (gender) next.gender = gender
          if (fields.shiny !== undefined) next.shiny = Boolean(fields.shiny)
          if (fields.nature) next.nature = String(fields.nature)
          if (fields.ability) {
            next.ability = String(fields.ability)
            next.abilitySlot = null
            next.abilityHidden = false
            next.abilityOverride = true
            next.abilitySource = 'custom-talent'
          }
          if (fields.teraType) next.teraType = String(fields.teraType).toLowerCase()
          if (fields.nickname !== undefined) next.nickname = String(fields.nickname ?? '').trim() || undefined
          if (Number.isFinite(Number(fields.friendship))) next.friendship = Math.max(0, Math.min(255, Number(fields.friendship)))
          if (fields.heldItem !== undefined) {
            if (!fields.heldItem) next.heldItem = null
            else {
              const rawHeld = typeof fields.heldItem === 'object' ? fields.heldItem : { name: String(fields.heldItem) }
              const knownHeld = resolveHeldItemByName(rawHeld) ?? resolveInventoryItemByName(rawHeld.name, latestInventoryRef.current)
              const descriptor = knownHeld ?? createCustomItemDescriptor(rawHeld.name, { ...rawHeld, holdable: true })
              next.heldItem = descriptor ? normalizeHeldItem({ ...descriptor, holdable: true, custom: Boolean(descriptor.custom) }) : next.heldItem
            }
          }
          if (Array.isArray(fields.accessories)) {
            next.accessories = fields.accessories
              .map((rawAccessory) => {
                const raw = typeof rawAccessory === 'object' && rawAccessory
                  ? rawAccessory
                  : { name: String(rawAccessory ?? '').trim() }
                if (!raw.name && !raw.id) return null
                const known = resolveInventoryItemByName(raw.name ?? raw.id, latestInventoryRef.current)
                  ?? resolveItemByName(raw.name ?? raw.id)
                const descriptor = known && isPokemonAccessoryItem(known)
                  ? known
                  : createCustomItemDescriptor(raw.name ?? raw.id, {
                      ...raw,
                      category: 'accessory',
                      wearable: true,
                      pokemonAccessory: true,
                      holdable: false,
                    })
                return descriptor ? {
                  ...descriptor,
                  ...raw,
                  category: 'accessory',
                  wearable: true,
                  pokemonAccessory: true,
                  holdable: false,
                } : null
              })
              .filter(Boolean)
          }
          const patchStats = (raw, max, previous) => {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return previous
            const out = { ...(previous ?? {}) }
            for (const stat of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) {
              if (!Number.isFinite(Number(raw[stat]))) continue
              out[stat] = Math.max(0, Math.min(max, Math.round(Number(raw[stat]))))
            }
            return out
          }
          if (fields.ivs) next.ivs = patchStats(fields.ivs, 31, next.ivs)
          if (fields.evs) next.evs = patchStats(fields.evs, 252, next.evs)
          if (fields.status !== undefined) next.status = fields.status ? String(fields.status) : null
          if (fields.customAttributes && typeof fields.customAttributes === 'object' && !Array.isArray(fields.customAttributes)) {
            next.customAttributes = { ...(next.customAttributes ?? {}), ...fields.customAttributes }
          }
          // Mọi thuộc tính fan-made không thuộc schema battle vẫn bám theo đúng
          // cá thể thay vì bị vứt. Chúng được gửi lại cho Semantic Engine ở các
          // lượt sau qua customAttributes.
          const knownPatchKeys = new Set(['gender','shiny','nature','ability','teraType','nickname','form','friendship','heldItem','accessories','ivs','evs','status'])
          const extraAttributes = Object.fromEntries(Object.entries(fields).filter(([key]) => !knownPatchKeys.has(key)))
          if (Object.keys(extraAttributes).length) next.customAttributes = { ...(next.customAttributes ?? {}), ...extraAttributes }
          if (fields.form) {
            const formEntry = findSpeciesEntry(fields.form)
            if (formEntry) {
              next = {
                ...next,
                name: formEntry.name,
                species: formEntry.species,
                spriteId: formEntry.spriteId ?? formEntry.species,
                forme: formEntry.forme ?? fields.form,
                baseSpeciesId: formEntry.baseSpeciesId ?? next.baseSpeciesId,
                types: formEntry.types ?? next.types,
                baseStats: formEntry.baseStats ?? next.baseStats,
              }
            } else next.forme = String(fields.form)
          }
          return recomputeMonStats(next)
        }
        setPlayerMon((cur) => (monIdentityMatches(cur, identity) ? transform(cur) : cur))
        setParty((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? transform(mon) : mon)))
        setPcBox((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? transform(mon) : mon)))
        replacePreviewMon(identity, transform)
        markLedger('pokemonPatches', patch)
        report.lines.push(`✅ Cập nhật thuộc tính ${targetMon.nickname || targetMon.name}: ${Object.keys(fields).join(', ')}`)
      }

      // Đợt 100 — đồng bộ giới tính trực tiếp từ CHÍNH VĂN CANON ở MỌI
      // lượt, không chỉ lúc nhận Pokémon. Đây là chốt cho ca: cá thể đã roll
      // male, sau đó tiến hoá/form và văn xác nhận female nhưng Summary vẫn
      // giữ male. Cả active/party/PC dùng cùng transform nên không còn ba bản
      // cùng uid mang ba giới tính khác nhau.
      const applyStoryGender = (mon) => {
        if (!mon) return mon
        const entry = findSpeciesEntry(mon.species ?? mon.name)
        return applyNarrativeGenderEvidence(
          mon,
          storyText,
          entry,
          [mon.evolvedFrom],
          sourceMessageId,
        )
      }
      const beforePreviewGender = previewActive?.gender
      previewActive = applyStoryGender(previewActive)
      previewParty = previewParty.map(applyStoryGender)
      previewPc = previewPc.map(applyStoryGender)
      setPlayerMon((cur) => applyStoryGender(cur))
      setParty((cur) => (cur ?? []).map(applyStoryGender))
      setPcBox((cur) => (cur ?? []).map(applyStoryGender))
      if (previewActive && beforePreviewGender && previewActive.gender !== beforePreviewGender) {
        report.lines.push(`✅ Giới tính ${previewActive.name}: ${previewActive.gender === 'female' ? '♀ Cái' : previewActive.gender === 'male' ? '♂ Đực' : '◇ Vô giới tính'} (theo chính văn)`)
      }

      // Cập nhật ref lạc quan để API phụ chạy ngay sau đó nhìn thấy đúng bản
      // vừa áp, không dùng lại snapshot cũ rồi báo DNA lệch lần nữa.
      latestPlayerMonRef.current = previewActive
      latestPartyRef.current = previewParty
      latestPcBoxRef.current = previewPc
    } catch (e2) {
      console.warn('[state] POKEMON/LEVEL/EVOLVE lỗi:', e2.message)
      report.lines.push(`⚠ Lỗi khi áp Pokémon/cấp/tiến hoá: ${e2.message}`)
    }

    try {
      // Một số model xuất cả [[ITEM Leftovers | -1]] lẫn
      // [[EQUIP Pikachu | Leftovers]] cho cùng hành động. EQUIP đã tự lấy một
      // món khỏi túi, nên nếu không gộp hai tag thì trang bị bị trừ hai lần và
      // thậm chí EQUIP thất bại dù người chơi có đúng một món.
      const equipDebits = new Map()
      for (const directive of parsed.equipment ?? []) {
        if (directive.mode !== 'equip') continue
        const entry = resolveHeldItemByName(directive.item) ?? resolveInventoryItemByName(directive.item, latestInventoryRef.current) ?? resolveItemByName(directive.item)
        if (entry && (isHoldableItem(entry) || (directive.semantic && entry.custom))) equipDebits.set(entry.id, (equipDebits.get(entry.id) ?? 0) + 1)
      }
      const declaredMysteryDebits = (parsed.items ?? []).filter((item) => (
        item.qty < 0 && resolveItemByName(item.name)?.id === 'unknown-pokemon-ball'
      )).reduce((sum, item) => sum + Math.abs(item.qty), 0)
      // POKEMON được xác minh từ bóng chưa rõ loài sẽ tự tiêu thụ đúng một
      // vật chứa. Không phụ thuộc model nhớ xuất thêm ITEM -1 hay không.
      const automaticMysteryDebits = Math.max(0, mysteryBallRevealsApplied - declaredMysteryDebits)
      const rawItemChanges = [
        ...(parsed.items ?? []),
        ...(automaticMysteryDebits > 0 ? [{ name: 'Poké Ball chưa xác định', qty: -automaticMysteryDebits, automaticMysteryReveal: true }] : []),
      ]
      const itemChanges = rawItemChanges.map((raw) => {
        // Inventory roleplay là open-world: item không có trong database vẫn
        // được tạo và persist nếu canon nói người chơi đã nhận nó. Khi mất
        // item tự tạo, resolve trực tiếp từ inventory hiện tại theo tên/id.
        const knownOrOwned = resolveInventoryItemByName(raw.name, latestInventoryRef.current)
        const entry = knownOrOwned ?? (Number(raw.qty) > 0
          ? createCustomItemDescriptor(raw.name, raw)
          : null)
        let qty = raw.qty
        let absorbedByEquip = 0
        let absorbedByEvolution = 0
        if (entry && qty < 0) {
          const pendingEvolution = evolutionDebits.get(entry.id) ?? 0
          absorbedByEvolution = Math.min(Math.abs(qty), pendingEvolution)
          if (absorbedByEvolution > 0) {
            qty += absorbedByEvolution
            evolutionDebits.set(entry.id, pendingEvolution - absorbedByEvolution)
          }
          const pending = equipDebits.get(entry.id) ?? 0
          absorbedByEquip = Math.min(Math.abs(qty), pending)
          if (absorbedByEquip > 0) {
            qty += absorbedByEquip
            equipDebits.set(entry.id, pending - absorbedByEquip)
          }
        }
        return { entry, qty, raw, absorbedByEquip, absorbedByEvolution }
      })
      let previewInventory = [...(latestInventoryRef.current ?? [])]
      let lootChanged = false

      for (const [lootIndex, loot] of (parsed.loots ?? []).entries()) {
        const lootSourceId = sourceMessageId
          ? `${sourceMessageId}:loot:${normalizeMonTarget(loot.type)}:${lootIndex}`
          : `turn-${turnNow}:loot:${normalizeMonTarget(loot.type)}:${lootIndex}`
        if (previewInventory.some((item) => (item.lootSourceIds ?? []).includes(lootSourceId))) {
          report.lines.push(`ℹ Bỏ qua chiến lợi phẩm ${loot.type}: sự kiện này đã được áp trước đó`)
          markLedger('loots', loot)
          continue
        }
        const generatedLoot = generateLootItems(loot, lootSourceId)
        for (const award of generatedLoot) {
          const at = previewInventory.findIndex((item) => item.id === award.id)
          if (at < 0) {
            previewInventory.push({ ...award, lootSourceIds: [lootSourceId] })
          } else {
            const current = previewInventory[at]
            previewInventory[at] = {
              ...award,
              ...current,
              qty: current.infinite ? current.qty : (Number(current.qty) || 0) + award.qty,
              lootSourceIds: [...new Set([...(current.lootSourceIds ?? []), lootSourceId])],
            }
          }
        }
        lootChanged = generatedLoot.length > 0 || lootChanged
        report.lines.push(`✅ Chiến lợi phẩm (${loot.type}, ${loot.size}): ${generatedLoot.map((item) => `${item.name} x${item.qty}`).join(', ')}`)
        markLedger('loots', loot)
      }

      // Tiến hoá bằng đá/vật phẩm luôn tiêu đúng một món, kể cả model quên
      // xuất ITEM -1. Nếu model có xuất, phần trên đã hấp thụ debit để không
      // bị trừ hai lần.
      for (const [itemId, remaining] of evolutionDebits) {
        const totalNeeded = remaining + itemChanges.reduce((sum, change) => sum + (change.entry?.id === itemId ? change.absorbedByEvolution : 0), 0)
        if (totalNeeded <= 0) continue
        const at = previewInventory.findIndex((item) => item.id === itemId)
        if (at < 0 || previewInventory[at].infinite) continue
        const left = Math.max(0, (Number(previewInventory[at].qty) || 0) - totalNeeded)
        const label = previewInventory[at].name
        if (left > 0) previewInventory[at] = { ...previewInventory[at], qty: left }
        else previewInventory.splice(at, 1)
        report.lines.push(`✅ Tiêu thụ vật phẩm tiến hoá: ${label} x${totalNeeded}`)
      }

      for (const { entry, qty, raw, absorbedByEquip, absorbedByEvolution } of itemChanges) {
        if (!entry) {
          if (raw.semantic || raw.canon) {
            // Canon nói món đã rời inventory nhưng save hiện không có món đó:
            // state đích vốn đã đúng. Đánh dấu đã xử lý để auditor không lặp.
            report.lines.push(`ℹ ${raw.name}: canon xác nhận đã rời túi; inventory hiện đã không có món này`)
            markLedger('items', raw)
            continue
          }
          report.lines.push(`⚠ Không áp vật phẩm “${raw.name}”: không resolve được vật phẩm`)
          continue
        }
        if (absorbedByEquip > 0) {
          report.lines.push(`ℹ ${entry.name} x${absorbedByEquip} sẽ được trừ bởi lệnh trang bị, không trừ lặp bằng ITEM`)
        }
        if (absorbedByEvolution > 0) {
          report.lines.push(`ℹ ${entry.name} x${absorbedByEvolution} đã được trừ bởi tiến hoá, không trừ lặp bằng ITEM`)
        }
        if (qty === 0) {
          markLedger('items', raw)
          continue
        }
        const at = previewInventory.findIndex((it) => it.id === entry.id)
        if (qty > 0) {
          const sourceIds = sourceMessageId ? [sourceMessageId] : []
          if (at === -1) {
            previewInventory.push({
              ...entry, qty, ...(raw.infinite ? { infinite: true } : {}),
              ...(sourceIds.length ? { acquisitionSourceIds: sourceIds } : {}),
              ...(raw.evidence ? { lastCanonEvidence: raw.evidence } : {}),
              ...(raw.semanticEventId ? { lastSemanticEventId: raw.semanticEventId } : {}),
            })
          } else {
            const current = previewInventory[at]
            const mergedAttrs = { ...(current.customAttributes ?? {}), ...(entry.customAttributes ?? {}) }
            previewInventory[at] = {
              ...entry, ...current, qty: (current.qty ?? 0) + qty,
              ...(Object.keys(mergedAttrs).length ? { customAttributes: mergedAttrs } : {}),
              acquisitionSourceIds: [...new Set([...(current.acquisitionSourceIds ?? []), ...sourceIds])],
              ...(raw.evidence ? { lastCanonEvidence: raw.evidence } : {}),
              ...(raw.semanticEventId ? { lastSemanticEventId: raw.semanticEventId } : {}),
            }
          }
          report.lines.push(`✅ Nhận vật phẩm: ${entry.name} x${qty}${entry.custom ? ' · entity động' : ''}`)
          markLedger('items', raw)
        } else if (at === -1) {
          report.lines.push(`⚠ Không thể trừ ${entry.name}: trong túi không có vật phẩm này`)
        } else if (previewInventory[at].infinite) {
          report.lines.push(`ℹ ${entry.name} là vật phẩm vô hạn — không bị trừ`)
          markLedger('items', raw)
        } else {
          const have = Math.max(0, Number(previewInventory[at].qty) || 0)
          const removed = Math.min(have, Math.abs(qty))
          const left = have - removed
          if (left > 0) previewInventory[at] = { ...previewInventory[at], qty: left }
          else previewInventory.splice(at, 1)
          report.lines.push(`✅ Mất vật phẩm: ${entry.name} x${removed}`)
          if (removed > 0) markLedger('items', raw)
        }
      }

      // Đợt 115: custom item là một entity state sống, không chỉ name+qty.
      // Canon có thể bổ sung công dụng/trạng thái/độ bền/quyền truy cập ở lượt
      // sau mà quantity không đổi. item_patch cập nhật trực tiếp entity trong
      // inventory; nếu item vừa được nhận trong cùng lượt thì patch vẫn thấy
      // nó vì chạy sau vòng item_change phía trên.
      let itemPatchChanged = false
      for (const patch of parsed.itemPatches ?? []) {
        const owned = resolveInventoryItemByName(patch.target, previewInventory)
        if (!owned) {
          if (patch.semantic || patch.canon) {
            deferSemanticState(patch, `Vật phẩm ${patch.target}`, patch.fields ?? {}, 'inventory-item')
            report.lines.push(`ℹ Chưa thấy “${patch.target}” trong túi; đã giữ patch vật phẩm trong state động để không mất canon`)
          } else {
            report.lines.push(`⚠ Không áp thuộc tính vật phẩm “${patch.target}”: vật phẩm chưa có trong túi`)
          }
          continue
        }
        const at = previewInventory.findIndex((it) => it.id === owned.id)
        if (at < 0) continue
        previewInventory[at] = applyCustomItemStatePatch(previewInventory[at], patch.fields ?? {}, {
          sourceMessageId, evidence: patch.evidence, semanticEventId: patch.semanticEventId,
        })
        itemPatchChanged = true
        report.lines.push(`✅ Cập nhật vật phẩm: ${previewInventory[at].name} · ${Object.keys(patch.fields ?? {}).join(', ') || 'thuộc tính canon'}`)
        markLedger('itemPatches', patch)
      }

      const validItemChanges = itemChanges.filter((x) => x.entry && (x.qty !== 0 || x.absorbedByEquip > 0 || x.absorbedByEvolution > 0))

      // Đợt 109: commit phần TÚI ngay sau khi tính xong item/loot/evolution.
      // Trước đây report đã ghi “✅ Nhận vật phẩm” nhưng setInventory nằm tận
      // sau vòng EQUIP/DATE. Chỉ cần một directive phía sau ném exception là
      // audit vẫn báo ĐÃ ÁP trong khi React/localStorage chưa nhận inventory.
      // Commit checkpoint này làm report và state thật không còn lệch nhau;
      // EQUIP nếu có sẽ tiếp tục từ chính snapshot vừa commit rồi commit lần 2.
      const baseInventoryChanged = validItemChanges.length > 0 || itemPatchChanged || evolutionDebits.size > 0 || lootChanged
      if (baseInventoryChanged) {
        const committedInventory = syncTraitGrantedItems(previewInventory, playerTraits)
        setInventory(committedInventory)
        latestInventoryRef.current = committedInventory
        previewInventory = [...committedInventory]
      }

      let equipmentChanged = false

      const addPreviewItem = (entry) => {
        const at = previewInventory.findIndex((it) => it.id === entry.id)
        if (at >= 0) previewInventory[at] = { ...previewInventory[at], qty: (previewInventory[at].qty ?? 1) + 1 }
        else previewInventory.push({ ...entry, id: entry.id, name: entry.name, qty: 1, fromInfinite: undefined })
      }

      // Trang bị được áp SAU ITEM để một lượt “nhận rồi đeo” hoạt động
      // đúng. Inventory nền đã commit ở checkpoint phía trên; EQUIP tiếp tục
      // trên snapshot đó và chỉ commit phần chênh lệch trang bị lần hai.
      for (const directive of parsed.equipment ?? []) {
        const targetMon = resolveOwned(directive.target)
        if (!targetMon) {
          deferSemanticState(directive, `Pokémon ${directive.target} · held item`, directive.mode === 'unequip' ? null : directive.item, 'pokemon')
          report.lines.push((directive.semantic || directive.canon)
            ? `ℹ Chưa resolve được ${directive.target}; đã giữ trạng thái trang bị trong state động`
            : `⚠ Không áp trang bị “${directive.target}”: không tìm thấy Pokémon tương ứng trong đội`)
          continue
        }
        const identity = { uid: targetMon.uid, name: targetMon.name }
        const oldItem = resolveHeldItemByName(targetMon.heldItem)
        const accessoryList = Array.isArray(targetMon.accessories) ? targetMon.accessories : []
        const accessoryTargetKey = normalizeMonTarget(directive.item ?? '')
        const accessoryIndex = accessoryList.findIndex((item) => {
          if (!directive.item) return directive.equipmentKind === 'accessory' && accessoryList.length === 1
          return [item?.id, item?.name].filter(Boolean).some((value) => normalizeMonTarget(value) === accessoryTargetKey)
        })

        if (directive.mode === 'unequip' && (directive.equipmentKind === 'accessory' || accessoryIndex >= 0)) {
          if (accessoryIndex < 0) {
            report.lines.push(`ℹ ${targetMon.name} không có phụ kiện phù hợp để tháo`)
            markLedger('equipment', directive)
            continue
          }
          const accessory = accessoryList[accessoryIndex]
          if (!accessory.fromInfinite) addPreviewItem({ ...accessory, fromInfinite: undefined })
          replacePreviewMon(identity, (mon) => ({ ...mon, accessories: (mon.accessories ?? []).filter((_, index) => index !== accessoryIndex) }))
          equipmentChanged = true
          report.lines.push(accessory.fromInfinite
            ? `✅ Tháo phụ kiện: ${targetMon.name} bỏ ${accessory.name}; bản vô hạn vẫn ở trong túi`
            : `✅ Tháo phụ kiện: ${targetMon.name} → ${accessory.name} được cất lại vào túi`)
          markLedger('equipment', directive)
          continue
        }

        if (directive.mode === 'unequip') {
          if (!oldItem) {
            report.lines.push(`ℹ ${targetMon.name} hiện không cầm trang bị nào`)
            markLedger('equipment', directive)
            continue
          }
          if (!targetMon.heldItem?.fromInfinite) addPreviewItem(oldItem)
          replacePreviewMon(identity, (mon) => ({ ...mon, heldItem: null }))
          equipmentChanged = true
          report.lines.push(targetMon.heldItem?.fromInfinite
            ? `✅ Tháo trang bị: ${targetMon.name} bỏ ${oldItem.name}; bản vô hạn vẫn ở trong túi`
            : `✅ Tháo trang bị: ${targetMon.name} → ${oldItem.name} được cất lại vào túi`)
          markLedger('equipment', directive)
          continue
        }

        let entry = resolveInventoryItemByName(directive.item, previewInventory) ?? resolveHeldItemByName(directive.item) ?? resolveItemByName(directive.item)
        const canonEquip = Boolean(directive.semantic || directive.canon)
        const wantsAccessory = directive.equipmentKind === 'accessory' || isPokemonAccessoryItem(entry)
        if (!entry && canonEquip) {
          entry = createCustomItemDescriptor(directive.item, wantsAccessory
            ? { category: 'accessory', wearable: true, pokemonAccessory: true, holdable: false }
            : { holdable: true, description: 'Trang bị do cốt truyện xác lập.' })
        }
        // Leaf Stone/Fire Stone/... vẫn là Evolution Item canon. Nếu canon
        // nói rõ nó đã được CHẾ thành phụ kiện nhưng model vẫn trỏ vào nguyên
        // liệu, tự dựng một tên THÀNH PHẨM khác và dùng slot accessory.
        if (entry && !entry.custom && !isHoldableItem(entry) && !isPokemonAccessoryItem(entry)) {
          const craftCue = /(?:chế|che|làm|lam|tạo|tao|gia\s*công|craft|made|make)[\s\S]{0,160}(?:phụ\s*kiện|phu\s*kien|trang\s*sức|trang\s*suc|bông\s*tai|vòng\s*cổ|mặt\s*dây|vòng\s*tay|earring|necklace|pendant|bracelet|accessor)/i.test(storyText)
            || /(?:phụ\s*kiện|phu\s*kien|trang\s*sức|trang\s*suc|bông\s*tai|vòng\s*cổ|mặt\s*dây|vòng\s*tay|earring|necklace|pendant|bracelet|accessor)[\s\S]{0,160}(?:chế|che|làm|lam|tạo|tao|gia\s*công|craft|made|make)/i.test(storyText)
          if (craftCue) {
            const productName = craftedPokemonAccessoryName(entry, storyText)
            let product = resolveInventoryItemByName(productName, previewInventory)
            if (!product) {
              product = createCustomItemDescriptor(productName, {
                category: 'accessory', wearable: true, pokemonAccessory: true, holdable: false, sourceMaterial: entry.name,
              })
              addPreviewItem(product)
            }
            entry = product
            directive.equipmentKind = 'accessory'
          } else {
            report.lines.push(`⚠ Không thể đeo trực tiếp ${entry.name}: đây là vật phẩm canon; phụ kiện chế từ nó phải có tên thành phẩm riêng`)
            continue
          }
        }
        if (!entry || (!canonEquip && !isHoldableItem(entry) && !isPokemonAccessoryItem(entry))) {
          report.lines.push(`⚠ Không áp trang bị “${directive.item}”: không resolve được held item/phụ kiện`)
          continue
        }
        // Một held item fan-made đã được chính văn xác lập vẫn có thể là đồ cầm
        // hợp lệ, nhưng KHÔNG được dùng ngoại lệ này cho vật phẩm canon như
        // Leaf Stone. Canon material phải được chế thành một accessory có tên
        // thành phẩm riêng ở nhánh phía trên.
        if (canonEquip && entry.custom && !isPokemonAccessoryItem(entry) && !isHoldableItem(entry)) {
          entry = { ...entry, category: 'held', holdable: true }
        }
        if (isPokemonAccessoryItem(entry) || directive.equipmentKind === 'accessory') {
          const accessories = Array.isArray(targetMon.accessories) ? targetMon.accessories : []
          if (accessories.some((item) => item?.id === entry.id)) {
            report.lines.push(`ℹ ${targetMon.name} đã đeo ${entry.name}`)
            markLedger('equipment', directive)
            continue
          }
          const at = previewInventory.findIndex((it) => it.id === entry.id)
          if (at < 0 || (!previewInventory[at].infinite && (previewInventory[at].qty ?? 0) <= 0)) {
            report.lines.push(`⚠ Không thể cho ${targetMon.name} đeo ${entry.name}: phụ kiện không có trong túi`)
            continue
          }
          const fromInfinite = Boolean(previewInventory[at]?.infinite)
          if (!fromInfinite) {
            const left = (previewInventory[at].qty ?? 1) - 1
            if (left > 0) previewInventory[at] = { ...previewInventory[at], qty: left }
            else previewInventory.splice(at, 1)
          }
          const accessory = { ...entry, category: 'accessory', wearable: true, pokemonAccessory: true, fromInfinite }
          replacePreviewMon(identity, (mon) => ({ ...mon, accessories: [...(mon.accessories ?? []), accessory] }))
          equipmentChanged = true
          report.lines.push(`✅ Phụ kiện: ${targetMon.name} đeo ${entry.name} · không chiếm held item`)
          markLedger('equipment', directive)
          continue
        }

        if (oldItem?.id === entry.id) {
          report.lines.push(`ℹ ${targetMon.name} đã cầm ${entry.name}`)
          markLedger('equipment', directive)
          continue
        }
        const at = previewInventory.findIndex((it) => it.id === entry.id)
        if (!canonEquip && (at < 0 || (!previewInventory[at].infinite && (previewInventory[at].qty ?? 0) <= 0))) {
          report.lines.push(`⚠ Không thể cho ${targetMon.name} cầm ${entry.name}: vật phẩm không có trong túi`)
          continue
        }
        const fromInfinite = at >= 0 && Boolean(previewInventory[at].infinite)
        if (at >= 0 && !fromInfinite) {
          const left = (previewInventory[at].qty ?? 1) - 1
          if (left > 0) previewInventory[at] = { ...previewInventory[at], qty: left }
          else previewInventory.splice(at, 1)
        }
        if (oldItem && !targetMon.heldItem?.fromInfinite) addPreviewItem(oldItem)
        const heldItem = normalizeHeldItem({ ...entry, fromInfinite })
        replacePreviewMon(identity, (mon) => ({ ...mon, heldItem }))
        equipmentChanged = true
        report.lines.push(`✅ Trang bị: ${targetMon.name} cầm ${entry.name}${oldItem && !targetMon.heldItem?.fromInfinite ? ` · ${oldItem.name} được cất lại` : ''}`)
        markLedger('equipment', directive)
      }

      if (equipmentChanged) {
        const finalInventory = syncTraitGrantedItems(previewInventory, playerTraits)
        setInventory(finalInventory)
        setParty(previewParty)
        setPcBox(previewPc)
        setPlayerMon(previewActive)
        latestInventoryRef.current = finalInventory
        latestPartyRef.current = previewParty
        latestPcBoxRef.current = previewPc
        latestPlayerMonRef.current = previewActive
      }

      const trainLv = parsed.training ?? 0
      const daysPassed = parsed.dateAdvance ?? 0
      if (trainLv > 0 || daysPassed > 0) {
        // Từ đợt 74 hệ số >1 chỉ đến từ năng lực TỰ MÔ TẢ.
        const expMul = trainingExpMultiplier(playerTraits)
        const grow = (mon) => {
          if (!mon) return mon
          const amount = Math.round(
            ((trainLv > 0 ? expFromTraining(mon, trainLv) : 0)
              + (daysPassed > 0 ? expFromDays(mon, daysPassed) : 0)) * expMul,
          )
          // Độ thân mật chỉ đổi khi chính văn có [[FRIEND]] đã qua đối
          // chiếu. Không tự cộng chỉ vì thời gian trôi/luyện tập, vì đó là
          // biến truyện chứ không phải phần thưởng máy móc ngầm.
          return amount > 0 ? applyExpGain(mon, amount, movesDb).mon : mon
        }
        setPlayerMon((cur) => (cur ? grow(cur) : cur))
        setParty((cur) => (cur ?? []).map((pm) => grow(pm)))
        setPcBox((cur) => (cur ?? []).map((pm) => grow(pm)))
        previewActive = previewActive ? grow(previewActive) : previewActive
        previewParty = previewParty.map((pm) => grow(pm))
        previewPc = previewPc.map((pm) => grow(pm))
        latestPlayerMonRef.current = previewActive
        latestPartyRef.current = previewParty
        latestPcBoxRef.current = previewPc
      }

      if ((parsed.dateAdvance ?? 0) > 0 || parsed.datePart) {
        advanceStoryDate(parsed.dateAdvance ?? 0, parsed.datePart)
      }
    } catch (e2) {
      console.warn('[state] ITEM/DATE lỗi:', e2.message)
      report.lines.push(`⚠ Lỗi khi áp vật phẩm/thời gian: ${e2.message}`)
    }

    try {
      const dp = (parsed.hunger ?? []).reduce((acc, h) => {
        acc[h.who === 'mon' ? 'mon' : 'player'] += h.delta
        return acc
      }, { player: 0, mon: 0 })
      if (dp.player || dp.mon) adjustHunger(dp)
    } catch (e2) { console.warn('[state] HUNGER lỗi:', e2.message) }

    try {
      for (const n of parsed.npcs ?? []) upsertNpc(n.name, n.fields, turnNow)
      for (const f of parsed.facts ?? []) addFact(f.key, f.text, turnNow)
    } catch (e2) { console.warn('[state] NPC/FACT lỗi:', e2.message) }

    try {
      if ((parsed.badges?.length ?? 0) || (parsed.quests?.length ?? 0) || (parsed.reputations?.length ?? 0) || (parsed.wanted?.length ?? 0) || (parsed.legendaryAccess?.length ?? 0)) {
        setWorldProgress((cur) => applyWorldDirectives(cur, parsed, { mode: storyTone, turn: turnNow, date: storyDate }))
        for (const badge of parsed.badges ?? []) report.lines.push(worldProgress.badgeTracking
          ? `🏅 Lưu huy hiệu: ${badge.name}`
          : `ℹ Bỏ qua huy hiệu ${badge.name}: người chơi đã tắt theo dõi Badge Case`)
        for (const quest of parsed.quests ?? []) report.lines.push(`📋 Nhiệm vụ “${quest.title}”: ${quest.status}`)
        for (const access of parsed.legendaryAccess ?? []) report.lines.push(`🌠 Điều kiện gặp ${access.species} đã được xác lập${access.reason ? ` · ${access.reason}` : ''}`)
        for (const rep of parsed.reputations ?? []) report.lines.push(`⚑ Danh tiếng ${rep.name}: ${rep.delta > 0 ? '+' : ''}${rep.delta}`)
        for (const wanted of parsed.wanted ?? []) report.lines.push(`⚖ Truy nã: ${wanted.delta > 0 ? '+' : ''}${wanted.delta}${wanted.reason ? ` · ${wanted.reason}` : ''}`)
      }
      for (const award of parsed.collectionAwards ?? []) {
        const targetMon = resolveOwned(award.target)
        if (!targetMon) {
          deferSemanticState(award, `Pokémon ${award.target} · ${award.kind}`, award.name, 'pokemon')
          report.lines.push((award.semantic || award.canon)
            ? `ℹ Chưa resolve được ${award.target}; đã giữ ${award.name} trong state động`
            : `⚠ Không trao ${award.name}: không tìm thấy ${award.target}`)
          continue
        }
        const identity = { uid: targetMon.uid, name: targetMon.name }
        const apply = (mon) => addCollectionAward(mon, award.kind, award.name)
        setPlayerMon((cur) => (monIdentityMatches(cur, identity) ? apply(cur) : cur))
        setParty((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? apply(mon) : mon)))
        setPcBox((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? apply(mon) : mon)))
        replacePreviewMon(identity, apply)
        report.lines.push(`${award.kind === 'mark' ? '✦ Mark' : '🎗 Ribbon'}: ${targetMon.name} nhận ${award.name}`)
        markLedger('collectionAwards', award)
      }
    } catch (e2) {
      console.warn('[state] WORLD/COLLECTION lỗi:', e2.message)
      report.lines.push(`⚠ Lỗi khi áp tiến trình thế giới: ${e2.message}`)
    }

    // Đợt 105 — biến mở: bất kỳ state tự sáng tạo nào không khớp core
    // schema vẫn có nơi persist thật. Không còn tình trạng “không có TAG nên
    // không cập nhật được”. Mỗi update áp riêng và update hỏng không kéo theo
    // các update khác.
    try {
      const updates = [...(parsed.dynamicUpdates ?? []), ...semanticFallbackUpdates]
      if (updates.length) {
        const result = applyDynamicStateUpdates(latestDynamicStateRef.current, updates, { turn: turnNow, sourceMessageId })
        latestDynamicStateRef.current = result.state
        setDynamicState(result.state)
        for (const appliedUpdate of result.applied) {
          markLedger('dynamicUpdates', appliedUpdate)
          report.lines.push(`✅ Biến động ${appliedUpdate.target ?? appliedUpdate.key ?? appliedUpdate.kind}: ${JSON.stringify(appliedUpdate.value ?? appliedUpdate.details ?? true).slice(0, 180)}`)
        }
        for (const rejectedUpdate of result.rejected) {
          report.lines.push(`⚠ Biến động không áp: ${rejectedUpdate.reason}`)
        }
      }
    } catch (e2) {
      console.warn('[state] DYNAMIC lỗi:', e2.message)
      report.lines.push(`⚠ Lỗi khi áp biến động tự do: ${e2.message}`)
    }

    return report
  }

  async function callAI(nextMessages, scanExtra = '', configOverride = null, runOptions = null) {
    setError(null)
    setLoading(true)
    try {
      const scanText = buildScanText(nextMessages, scanExtra)
      // Khi reroll, đây là nguồn sự thật về những hard side-effect ĐÃ được
      // người chơi/nhánh trước gieo. Chính response mới không được tự dùng
      // nội dung nó vừa bịa để hợp thức hóa battle/PokéCenter/Pokémon mới.
      const rerollPriorContext = runOptions?.reroll
        ? nextMessages.slice(-6).filter((message) => !message?.hidden).map((message) => message?.content ?? '').join('\n')
        : ''
      const usingMainApi = !configOverride
      let history = nextMessages.map((m) => ({ role: m.role, content: m.content }))

      // --- TRÍ NHỚ DÀI HẠN LAI (đợt 88) ---
      // Exact/lexical từ toàn lịch sử + IndexedDB luôn hoạt động. Embedding
      // chỉ bổ sung liên tưởng ngữ nghĩa, không còn là điều kiện để cắt cửa sổ.
      const embCfg = memoryApiConfig?.embedding
      const memoryActive = Boolean(embCfg?.baseUrl && embCfg?.model)
      if (nextMessages.length > MEMORY_RECENT_WINDOW + 4) {
        const cutoff = nextMessages.length - MEMORY_RECENT_WINDOW
        const lastUserMsg = [...nextMessages].reverse().find((m) => m.role === 'user')
        let memoryNote = null
        try {
          const queryText = lastUserMsg?.content ?? ''
          const transcriptMemories = recallFromTranscript(nextMessages, queryText, { maxTurn: cutoff, topK: 6 })
          const archivedMemories = await recallArchive({ queryText, maxTurn: cutoff, topK: 6, namespace: trainerId })
          let semanticMemories = []
          if (memoryActive) {
            semanticMemories = await recallRelevant({
              embeddingConfig: embCfg,
              rerankConfig: memoryApiConfig?.rerank,
              queryText,
              maxTurn: cutoff,
              topK: 5,
            })
          }
          const memories = mergeMemoryResults(transcriptMemories, archivedMemories, semanticMemories)
          memoryNote = buildMemoryNote(memories)
        } catch (memErr) {
          console.warn('[memory] truy hồi ký ức lỗi (bỏ qua):', memErr.message)
        }
        history = history.slice(cutoff)
        if (memoryNote) history = [{ role: 'user', content: memoryNote }, ...history]
      }

      // --- Phương pháp nhớ 2 + 3 (đợt 30) ---
      // (2) TÓM TẮT CỐT TRUYỆN: chèn bản tóm tắt đầy đủ (nếu đã có) lên ĐẦU
      //     lịch sử — dù cửa sổ có bị cắt, mạch truyện tổng thể luôn còn.
      // (3) SỔ TAY THẾ GIỚI: dò 4 tin gần nhất + input xem nhắc key nào
      //     (tên NPC, Pokémon, địa danh, thời gian...) → chèn đúng các mục đó.
      const notebookScan = [
        ...nextMessages.slice(-4).map((m) => m.content),
        scanExtra,
      ].join('\n')
      const notebookNote = buildNotebookNote(findRelevantNotes(notebookScan))
      if (notebookNote) history = [{ role: 'user', content: notebookNote }, ...history]
      // Tư liệu canon Bulbapedia (đợt 33): truyện nhắc tên nhân vật GỐC →
      // tra wiki (cache, timeout 5s) và bơm tóm tắt chuẩn — chống bịa sai
      // nhân vật canon. Lỗi mạng chỉ warn, không chặn truyện.
      let canonNote = ''
      try {
        canonNote = await buildCanonNote(
          nextMessages.slice(-2).map((m2) => m2.content).join('\n'),
          nextMessages.length,
        ) || ''
      } catch (wikiErr) {
        console.warn('[wiki] bỏ qua tư liệu canon:', wikiErr.message)
      }
      const summaryNote = buildSummaryNote()
      if (summaryNote) history = [{ role: 'user', content: summaryNote }, ...history]

      // TOẠ ĐỘ BẢN ĐỒ (đợt 75): gửi vị trí thật cho model mỗi lượt.
      // x/y là phần trăm trên ảnh vùng, không phải km; areaKey vẫn là mốc
      // gameplay để hệ level/nhạc/Safari tương thích với save cũ.
      const currentMapLocation = normalizeMapLocation(playerLocation)
      const currentMode = normalizeGameMode(storyTone)
      if (currentMapLocation?.regionKey) {
        const regionInfo = getRegion(currentMapLocation.regionKey)
        const areaInfo = getArea(currentMapLocation.regionKey, currentMapLocation.areaKey)
        const coordText = Number.isFinite(currentMapLocation.x) && Number.isFinite(currentMapLocation.y)
          ? `; toạ độ bản đồ X=${currentMapLocation.x}, Y=${currentMapLocation.y} (thang 0-100)`
          : ''
        history = [...history, {
          role: 'user',
          content: `[Hệ thống — VỊ TRÍ HIỆN TẠI: ${areaInfo?.name ?? currentMapLocation.areaKey ?? 'chưa rõ'}, vùng ${regionInfo?.name ?? currentMapLocation.regionKey}${coordText}. Không tự coi nhân vật đã sang nơi khác nếu chính văn chưa có di chuyển. Khi thực sự đổi vị trí, chỉ cần viết rõ hành trình/đích đến trong chính văn; Semantic State Engine sẽ đồng bộ. Không nhắc tới ghi chú này.]`,
        }]

        // Đợt 86: vị trí không chỉ quyết định level. Sinh cảnh, buổi và thời
        // tiết là luật thế giới thật để model không thả Pokémon ngẫu nhiên từ
        // toàn National Dex vào mọi bụi cỏ.
        if (currentMode === 'realistic') {
          const ecologyNote = buildEcologyNote({
            location: currentMapLocation,
            storyDate,
            weather: getWeather(storyDate, currentMapLocation),
          })
          if (ecologyNote) history = [...history, { role: 'system', content: ecologyNote }]
        } else if (currentMode === 'anime') {
          history = [...history, { role: 'system', content: '[Hệ thống — SINH CẢNH ANIME: dùng vùng/thời tiết làm mặc định khi tự chọn Pokémon nền, nhưng không dùng sinh cảnh để bác một cuộc gặp, kỳ tích hay huyền thoại mà người chơi chủ động muốn đưa vào truyện. Không nhắc ghi chú này.]' }]
        }
      }

      // Đợt 87: luật chế độ và tiến trình là system state, không phải gợi ý
      // mềm. Nhờ vậy model không thể “viết cheat thành canon” ở Thực tế.
      history = [...history,
        { role: 'system', content: buildModeRulesNote(storyTone, worldProgress) },
        { role: 'system', content: buildWorldProgressNote(worldProgress, storyTone) },
      ]
      const dynamicPromptState = dynamicStateForPrompt(dynamicState)
      if (Object.keys(dynamicPromptState).length) {
        history = [...history, {
          role: 'system',
          content: `[Hệ thống — BIẾN THẾ GIỚI TỰ DO ĐÃ PERSIST: ${JSON.stringify(dynamicPromptState)}. Đây là canon state từ các lượt trước; dùng tự nhiên khi viết truyện và chỉ thay đổi khi chính văn lượt này thực sự tạo ra thay đổi mới. Không nhắc tới ghi chú này.]`,
        }]
      }
      const currentVisibleInput = nextMessages.at(-1)?.role === 'user' && !nextMessages.at(-1)?.hidden
        ? nextMessages.at(-1).content
        : ''
      const inputAdjudication = classifyRealisticInput({
        text: currentVisibleInput,
        mode: storyTone,
        adminMode,
        pokedex: pokedexSpecies,
        worldProgress,
        money: playerProfile.money,
        inventory,
        location: playerLocation,
        // Không cho chính input đang xét tự làm "bằng chứng" cho danh hiệu/cuộc
        // gặp mà nó vừa tự tuyên bố. Chỉ lịch sử trước input này mới được tính.
        recentText: nextMessages.slice(0, -1).slice(-4).map((message) => message.content).join('\n'),
        ownedPokemon: [playerMon, ...(party ?? [])].filter(Boolean),
        searchHistory: nextMessages.slice(0, -1).map((message) => message.realisticSearch).filter(Boolean),
      })
      if (inputAdjudication.note) history = [...history, { role: 'system', content: inputAdjudication.note }]
      if (adminMode) {
        history = [...history, { role: 'system', content: '[Hệ thống — PHIÊN ADMIN ĐÃ XÁC THỰC: cho phép lệnh kiểm thử từ input hiện tại bỏ qua giới hạn chế độ và cổng tiến trình. Semantic State Engine sẽ tự đồng bộ từ chính văn; không cần viết tag trạng thái. Không nhắc mã mở khoá hoặc ghi chú này.]' }]
      }
      const priority = directorPriority(worldProgress)
      if (priority) history = [...history, { role: 'system', content: `[Hệ thống — ƯU TIÊN ĐẠO DIỄN: ${priority} Không nhắc tới ghi chú này.]` }]

      // --- ĐẠO DIỄN TÌNH HUỐNG (đợt 31) ---
      // Thi thoảng (theo nhịp cooldown + xác suất) chèn 1 hạt giống tình
      // huống làm GỢI Ý một-lần ở cuối history — KHÔNG lưu vào messages nên
      // lượt sau tự biến mất, AI không bị gợi ý cũ ám mãi. Đa số lượt trả
      // null — đó mới là tự nhiên.
      // ĐỘI HÌNH + HÀNH VI THEO TÍNH CÁCH (đợt 63): Pokémon phải cư xử đúng
      // cá tính (nature) chứ không con nào cũng ngoan như nhau.
      // TÍNH CÁCH + THIÊN PHÚ (đợt 69): gửi MỌI LƯỢT, không chỉ lượt mở đầu.
      const traitsNote = buildCharacterTraitsNote(playerTraits ?? {}, normalizeGameMode(storyTone))
      if (traitsNote) history = [...history, { role: 'user', content: `[Hệ thống — ${traitsNote} Không nhắc tới ghi chú này.]` }]

      const partyNote = buildPartyBehaviorNote(party, playerMon)
      // Đợt 85: đây là luật nhập vai thật, không phải lời người chơi. Gửi bằng
      // system role để preset/provider không xem nhẹ Nature như một ghi chú
      // hội thoại có thể bỏ qua.
      if (partyNote) history = [...history, { role: 'system', content: partyNote }]

      // QUYỀN TỰ DO SÁNG TẠO (đợt 63): người chơi phản ánh AI bị gò bó bởi
      // input — chỉ thuật lại đúng câu lệnh, thế giới đứng im. Nhắc mỗi lượt
      // để AI chủ động dựng cảnh sống động quanh hành động của người chơi.
      const creativeFreedomNote = currentMode === 'realistic'
        ? '[Hệ thống — QUYỀN TỰ DO SÁNG TẠO CÓ NHỊP: input của người chơi là HÀNH ĐỘNG/Ý ĐỊNH của nhân vật chính, không phải kịch bản giới hạn và cũng không tự xác lập kết quả ngoài quyền nhân vật. Hãy làm cảnh sống bằng phản ứng hợp logic của NPC/Pokémon, giác quan và hệ quả đã gieo. KHÔNG bắt buộc nhét sự cố, người lạ, tin nghe lỏm hay hook mới vào mỗi lượt; đối thoại, chăm sóc, cắm trại và im lặng có ý nghĩa phải được thở. Ưu tiên nối sợi dây cũ trước khi mở sợi dây mới. Không hỏi lại người chơi; không viết danh sách lựa chọn lẫn trong chính văn. Khối <actions> dành cho giao diện vẫn tạo riêng. Không nhắc tới ghi chú này.]'
        : '[Hệ thống — QUYỀN TÁC GIẢ ANIME: người chơi được chủ động đặt tiền đề, kỳ tích, cuộc gặp, kết quả cao trào và cả việc huyền thoại xuất hiện/đồng hành như trong anime. Hãy biến điều họ vẽ thành chính văn sống động, vẫn cho NPC/Pokémon có cảm xúc và tính cách riêng nhưng không dùng luật Thực tế, sinh cảnh, huy hiệu, nhiệm vụ hay nghi thức để bác ý muốn đó. Nếu mode là Sandbox, các tài nguyên/Pokémon/sức mạnh tự do đã được chốt lúc tạo nhân vật; trong lúc chơi không tự cộng thêm state chỉ vì nhãn Sandbox. Giữ nhịp cảnh tự nhiên; không bắt buộc nhét hook mới. Viết kết quả đã xảy ra thật rõ ràng; Semantic State Engine tự đồng bộ app, không cần tag. Không nhắc ghi chú này.]'
      history = [...history, {
        role: 'user',
        content: creativeFreedomNote,
      }]
      if (runOptions?.reroll) {
        history = [...history, {
          role: 'system',
          content: '[Hệ thống — ĐÂY LÀ REROLL của cùng input. Viết một biến thể khác của cùng tình huống nhưng KHÔNG tự chèn side-effect cứng mới (trận đấu, vào PokéCenter/cửa hàng, nhận thêm Pokémon/vật phẩm/quyền) nếu input hiện tại hoặc diễn biến ngay trước đó không trực tiếp dẫn tới nó. Reroll không phải lý do để thế giới tự phát sinh phần thưởng hay tương tác mới. Không nhắc ghi chú này.]',
        }]
      }

      const nudge = maybeMakeNudge({
        identityKey: playerIdentity,
        location: playerLocation,
        turn: nextMessages.length,
        mode: currentMode,
        worldProgress,
        recentText: [...nextMessages].reverse().find((message) => message.role === 'assistant')?.content ?? '',
        userText: currentVisibleInput,
      })
      if (nudge) history = [...history, { role: 'user', content: nudge }]

      const { apiMessages, callOptions, regexScripts } = buildMainApiMessages({
        character,
        playerName,
        stylePreset,
        mainPreset: usingMainApi ? mainPreset : null,
        history,
        scanText,
        identityContext,
        worldbook,
        canonNote,
        toneNote: buildToneNote(storyTone),
        lastUserMessage: currentVisibleInput,
      })
      callOptions.assistantPrefill = assistantPrefill

      setLastPromptDebug({
        systemMessages: apiMessages.filter((m) => m.role === 'system'),
        assistantPrefill: assistantPrefill?.trim() || null,
      })

      let reply = await withApiLease(configOverride || apiConfig, () => chatCompletion(configOverride || apiConfig, apiMessages, { ...callOptions, debugLabel: 'Main Story', debugRole: 'main-story' }))
      let cleaned = cleanAiOutput(reply, regexScripts)
      // Prompt không phải chốt an toàn đủ mạnh: một số model vẫn biến “đi
      // tìm Ditto” thành gặp Ditto ngay. Nếu bản nháp phá cổng tìm kiếm của
      // Thực tế, yêu cầu viết lại đúng một lần. Provider vẫn không tuân thủ
      // (hoặc lần sửa lỗi thất bại) thì dùng kết quả thất bại cục bộ, bảo đảm
      // không có BATTLE/POKEMON hay cuộc gặp được canon hoá.
      if (responseViolatesSearchGate(cleaned, inputAdjudication)) {
        try {
          const revised = await withApiLease(configOverride || apiConfig, () => chatCompletion(configOverride || apiConfig, [
            ...apiMessages,
            { role: 'assistant', content: reply },
            { role: 'user', content: buildSearchGateCorrection(inputAdjudication) },
          ], { ...callOptions, assistantPrefill: '', debugLabel: 'Main Story · search-gate repair', debugRole: 'main-repair' }))
          const revisedCleaned = cleanAiOutput(revised, regexScripts)
          if (revisedCleaned && !responseViolatesSearchGate(revisedCleaned, inputAdjudication)) {
            reply = revised
            cleaned = revisedCleaned
          } else {
            reply = buildSearchGateFallback(inputAdjudication, getArea(playerLocation?.regionKey, playerLocation?.areaKey)?.name)
            cleaned = reply
          }
        } catch (searchGateError) {
          console.warn('[realistic-search-gate] dùng fallback:', searchGateError.message)
          reply = buildSearchGateFallback(inputAdjudication, getArea(playerLocation?.regionKey, playerLocation?.areaKey)?.name)
          cleaned = reply
        }
      }
      // Đợt 79: preset có thể dùng <choice>, <selection> hoặc <details>. Bóc
      // từ reply GỐC trước khi outputCleanup vứt scaffold hậu kỳ.
      const replyActionChoices = extractActionChoices(reply)
      if (!cleaned) {
        throw new Error(
          'AI chỉ trả về phần suy nghĩ (CoT), chưa kịp viết chính văn. Thử tăng "Max tokens" của preset (mục Preset chính văn) hoặc kiểm tra lại preset ở nút Debug.',
        )
      }
      // ID của lượt phải được chốt TRƯỚC khi áp state để mọi Pokémon/vật phẩm
      // sinh động có thể mang khoá nguồn idempotent của chính response này.
      const turnMessageId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      // Giao thức trạng thái: parse tag [[MONEY]]/[[REL]]/[[BODY]]/[[SHOP]]
      // do AI khai báo ở cuối tin — áp vào state thật (tiền, hảo cảm, thương
      // tích trên HUD cập nhật ngay), gỡ tag khỏi văn bản hiển thị. Tag
      // [[SHOP Tên]] gắn shopName lên message để hiện nút mở giỏ hàng.
      // <content> chỉ chứa chính văn, còn nhiều preset đặt tag state ở ngoài.
      // Vớt tag từ reply gốc cho parser nhưng không trả chúng lại UI.
      const rawStateTags = extractStateTags(reply).filter((tag) => !cleaned.includes(tag))
      // Đợt 106: tag chỉ còn là DI SẢN TƯƠNG THÍCH. Ta vẫn parse để gỡ khỏi
      // chính văn và làm fallback khi Semantic API thật sự lỗi, nhưng tuyệt đối
      // không để tag/validator legacy ngồi trước Semantic Engine rồi phủ quyết
      // một sự kiện canon chỉ vì thiếu đúng từ khóa hay thiếu catalog.
      let legacyParsed = parseStoryStateTags(`${cleaned}${rawStateTags.length ? `\n${rawStateTags.join('\n')}` : ''}`)
      const preAppliedState = nextMessages.at(-1)?.preAppliedState ?? null
      if (preAppliedState) {
        legacyParsed = filterUiPreAppliedState(legacyParsed, preAppliedState)
        legacyParsed = filterSupplementalDuplicates(legacyParsed, preAppliedState, { consumeExactMoney: true })
      }
      const stateEvidenceText = truncateAfterInteractiveMarker(legacyParsed.cleaned)
      const stateUserText = [...nextMessages].reverse().find((m2) => m2.role === 'user' && !m2.hidden)?.content ?? ''
      legacyParsed = inferEvolutionDirectives(
        legacyParsed,
        stateEvidenceText,
        pokedexSpecies,
        latestPlayerMonRef.current,
        latestPartyRef.current,
      )
      const evidencedMoveDirectives = (legacyParsed.moveDirectives ?? []).filter((directive) =>
        proseSupportsMove(stateEvidenceText, directive.place),
      )
      const prospectiveLocation = resolveMoveLocation(
        { ...legacyParsed, moveDirectives: evidencedMoveDirectives },
        latestPlayerLocationRef.current,
      ) ?? latestPlayerLocationRef.current
      const rejectedShops = []
      let validShops = []

      // CHAU CHUỐT VĂN PHONG (đợt 50): nếu cấu hình API phụ (slot Combat
      // Anime cũ), model phụ đánh bóng câu chữ theo tông truyện — chạy SAU
      // khi đã bóc tag (tag không bị model phụ nuốt), lỗi thì giữ nguyên văn.
      // Đợt 66: CẮT phần model tự kể sau [[BATTLE]] — người chơi chưa đánh
      // thì truyện không được phép có kết quả trận. Cắt SAU khi đã bóc tag
      // trạng thái để các tag cuối tin ([[MONEY]], [[FACT]]...) vẫn áp đủ.
      let displayText = stateEvidenceText
      if (animeApiConfig?.baseUrl && animeApiConfig?.model) {
        try {
          displayText = truncateAfterInteractiveMarker(
            await polishProse(
              { ...apiConfig, ...animeApiConfig },
              displayText,
              buildToneNote(storyTone),
              partyNote,
            ),
          )
        } catch (polErr) {
          console.warn('[polish] bỏ qua chau chuốt:', polErr.message)
        }
      }
      // Đợt 113: marker battle là một lệnh UI có side-effect lớn. Model/preset
      // đôi khi nhả [[BATTLE]] trong reroll dù chính văn không hề có đối thủ
      // đang ra sân/thách đấu. Khi marker không có setup canon độc lập, bỏ marker
      // trước khi hiển thị để không xuất hiện Poké Ball ngẫu nhiên.
      if (displayText.includes(BATTLE_MARKER)) {
        const ownNames = [...(latestPartyRef.current ?? []).map((mon) => mon?.name), latestPlayerMonRef.current?.name]
          .filter(Boolean)
        if (!battleMarkerHasCanonSetup(displayText, stateUserText, pokedexSpecies, ownNames, { reroll: Boolean(runOptions?.reroll), priorText: rerollPriorContext })) {
          displayText = displayText.split(BATTLE_MARKER).join('').trim()
          console.warn('[battle-marker] bỏ marker không có setup canon độc lập')
        }
      }

      // Bản được hiển thị mới là canon. Nếu API chau chuốt lỡ bỏ hoặc đổi một
      // sự kiện, tuyệt đối không dùng bản nháp ẩn để ghi save. Đối chiếu lần
      // cuối với đúng displayText rồi mới chạm vào bất kỳ biến thật nào.
      // Legacy chỉ được kiểm tra để có FALLBACK/AUDIT. Nó không còn là state
      // đầu vào mặc định. Chính văn hiển thị được parse thành một manifest rỗng
      // rồi chỉ cộng các reconciler deterministic + semantic events.
      const finalMoveDirectives = (legacyParsed.moveDirectives ?? []).filter((directive) =>
        proseSupportsMove(displayText, directive.place),
      )
      const finalProspectiveLocation = resolveMoveLocation(
        { ...legacyParsed, moveDirectives: finalMoveDirectives },
        latestPlayerLocationRef.current,
      ) ?? latestPlayerLocationRef.current
      const legacyMoneyReconcile = reconcileMoneyDirectives(legacyParsed, displayText, { alreadyApplied: preAppliedState })
      const finalEvidenceCheck = validateStateAgainstProse(legacyMoneyReconcile.parsed, displayText, {
        playerName: playerName || playerProfile?.name,
        party: latestPartyRef.current,
        mode: normalizeGameMode(storyTone), adminMode,
        inventory: latestInventoryRef.current,
        location: finalProspectiveLocation,
        // Cổng input chỉ dùng TRƯỚC khi sinh văn. Nếu canon cuối cùng vẫn nói
        // người chơi đã nhận Pokémon thì state phải bám canon, không được để
        // một quyết định từ input cũ phủ định chính văn đã hiển thị.
        blockPokemonAcquisition: false,
        alreadyApplied: preAppliedState,
      })

      let stateParsed = parseStoryStateTags('')
      const moneyReconcile = reconcileMoneyDirectives(stateParsed, displayText, { alreadyApplied: preAppliedState })
      stateParsed = moneyReconcile.parsed
      let semanticPrimarySucceeded = false

      let primarySemanticAudit = null
      let immediateAuditorAudit = null
      const semanticPrimaryCfg = [stateApiConfig, stateApiConfig2, outcomeApiConfig?.escaped, outcomeApiConfig?.lose]
        .find((cfg) => cfg?.baseUrl && cfg?.model)
      const resolvedSemanticCfg = semanticPrimaryCfg ? { ...apiConfig, ...semanticPrimaryCfg } : apiConfig
      if (resolvedSemanticCfg?.baseUrl && resolvedSemanticCfg?.model) {
        try {
          const semantic = await withApiLease(resolvedSemanticCfg, () => extractSemanticStateEvents(resolvedSemanticCfg, {
            storyText: displayText,
            userText: stateUserText,
            stateSnapshot: buildStateScanSnapshot(null, Number(playerProfile?.money) || 0),
            appliedState: preAppliedState,
            mode: normalizeGameMode(storyTone),
            scanMode: 'extractor',
          }))
          semanticPrimarySucceeded = true
          let semanticParsed = filterUiPreAppliedState(semantic.parsed, preAppliedState)
          semanticParsed = gateSemanticOwnership(semanticParsed, displayText, { reroll: Boolean(runOptions?.reroll), priorText: rerollPriorContext })
          semanticParsed = gatePokecenterInteraction(semanticParsed, displayText, { reroll: Boolean(runOptions?.reroll), priorText: rerollPriorContext })
          // Semantic engine là nguồn chính; deterministic money/UI transaction
          // chỉ được ưu tiên để tránh trừ/cộng đôi. KHÔNG dùng input gate hay
          // validator legacy để phủ quyết event đã được đọc từ canon.
          semanticParsed = filterSupplementalDuplicates(semanticParsed, stateParsed, { consumeExactMoney: true })
          stateParsed = mergeStateManifests(stateParsed, semanticParsed)

          // Đợt 106: nếu có State API 2, dùng nó như AUDITOR đồng bộ NGAY trong
          // lượt thay vì chờ idle. Một extractor có thể bỏ sót cách diễn đạt lạ;
          // auditor chỉ nhìn ledger đã có và bổ sung phần thiếu. Với lượt phức
          // tạp/malformed mà không có API 2, cho chính extractor tự audit lần 2.
          const dedicatedAuditorRaw = stateApiConfig2?.baseUrl && stateApiConfig2?.model
            ? stateApiConfig2
            : null
          // Đợt 106: luôn audit đồng bộ. Nếu extractor bỏ sót toàn bộ một
          // sự kiện thì proposedCount/rejectedCount đều có thể bằng 0, vì vậy
          // dùng chính các con số đó để quyết định audit là một vòng lặp logic.
          // Ưu tiên độ đúng state hơn tiết kiệm một call phụ.
          const shouldImmediateAudit = true
          if (shouldImmediateAudit) {
            try {
              const auditorCfg = dedicatedAuditorRaw
                ? { ...apiConfig, ...dedicatedAuditorRaw }
                : resolvedSemanticCfg
              const auditor = await withApiLease(auditorCfg, () => extractSemanticStateEvents(auditorCfg, {
                storyText: displayText,
                userText: stateUserText,
                stateSnapshot: buildStateScanSnapshot(null, Number(playerProfile?.money) || 0),
                appliedState: mergeStateManifests(preAppliedState ?? {}, stateParsed),
                mode: normalizeGameMode(storyTone),
                scanMode: 'auditor',
              }))
              let auditorParsed = filterUiPreAppliedState(auditor.parsed, preAppliedState)
              auditorParsed = gateSemanticOwnership(auditorParsed, displayText, { reroll: Boolean(runOptions?.reroll), priorText: rerollPriorContext })
              auditorParsed = gatePokecenterInteraction(auditorParsed, displayText, { reroll: Boolean(runOptions?.reroll), priorText: rerollPriorContext })
              auditorParsed = filterSupplementalDuplicates(auditorParsed, stateParsed, { consumeExactMoney: true })
              stateParsed = mergeStateManifests(stateParsed, auditorParsed)
              immediateAuditorAudit = {
                proposed: auditor.proposedCount,
                accepted: countParsedStateOperations(auditorParsed),
                semanticRejected: auditor.rejectedCount,
                malformed: Boolean(auditor.malformed),
                salvaged: Boolean(auditor.salvaged),
                repaired: Boolean(auditor.repaired),
              }
            } catch (auditorError) {
              immediateAuditorAudit = { proposed: 0, accepted: 0, error: auditorError.message }
            }
          }

          // Lượt dày state: chạy 4 focus shard SONG SONG trước commit. Đây
          // không phải giới hạn biến; mỗi shard vẫn được trả vô hạn event. Mục
          // tiêu là không bắt một response JSON duy nhất phải giữ chú ý cho tiền,
          // Pokémon, NPC và quest cùng lúc.
          const focusSpecs = buildStateScanPlan({
            storyText: displayText,
            explicitOperationCount: Math.max(countParsedStateOperations(stateParsed), semantic.proposedCount),
            broadPasses: 1,
          }).filter((spec) => spec.focus)
          const focusedAudit = []
          if (focusSpecs.length) {
            const focusCfgPoolRaw = [stateApiConfig, stateApiConfig2, outcomeApiConfig?.escaped, outcomeApiConfig?.lose]
              .filter((cfg) => cfg?.baseUrl && cfg?.model)
            const focusCfgPool = focusCfgPoolRaw.length
              ? focusCfgPoolRaw.map((cfg) => ({ ...apiConfig, ...cfg }))
              : [resolvedSemanticCfg]
            const focusedResults = await Promise.all(focusSpecs.map(async (spec, index) => {
              const focusCfg = focusCfgPool[index % focusCfgPool.length]
              try {
                const result = await withApiLease(focusCfg, () => extractSemanticStateEvents(focusCfg, {
                  storyText: displayText,
                  userText: stateUserText,
                  stateSnapshot: buildStateScanSnapshot(spec.focus, Number(playerProfile?.money) || 0),
                  appliedState: mergeStateManifests(preAppliedState ?? {}, stateParsed),
                  mode: normalizeGameMode(storyTone),
                  scanMode: 'auditor',
                  focus: spec.focus,
                }))
                return { spec, result }
              } catch (error) {
                return { spec, error }
              }
            }))
            for (const row of focusedResults) {
              if (row.error) {
                focusedAudit.push({ focus: row.spec.focus?.label, proposed: 0, accepted: 0, error: row.error.message })
                continue
              }
              let focusParsed = filterUiPreAppliedState(row.result.parsed, preAppliedState)
              focusParsed = gateSemanticOwnership(focusParsed, displayText, { reroll: Boolean(runOptions?.reroll), priorText: rerollPriorContext })
              focusParsed = gatePokecenterInteraction(focusParsed, displayText, { reroll: Boolean(runOptions?.reroll), priorText: rerollPriorContext })
              focusParsed = filterSupplementalDuplicates(focusParsed, stateParsed, { consumeExactMoney: true })
              const accepted = countParsedStateOperations(focusParsed)
              stateParsed = mergeStateManifests(stateParsed, focusParsed)
              focusedAudit.push({
                focus: row.spec.focus?.label,
                proposed: row.result.proposedCount,
                accepted,
                semanticRejected: row.result.rejectedCount,
                malformed: Boolean(row.result.malformed),
                salvaged: Boolean(row.result.salvaged),
                repaired: Boolean(row.result.repaired),
              })
            }
          }

          primarySemanticAudit = {
            proposed: semantic.proposedCount,
            accepted: semantic.acceptedCount,
            rejected: semantic.rejectedCount,
            malformed: semantic.malformed,
            salvaged: semantic.salvaged,
            repaired: Boolean(semantic.repaired),
            repairAttempted: Boolean(semantic.repairAttempted),
            auditor: immediateAuditorAudit,
            focused: focusedAudit,
            events: semantic.acceptedEvents.slice(0, 40).map((event) => ({
              kind: event.kind,
              target: event.target ?? event.name ?? event.species ?? null,
              amount: event.amount ?? event.quantity ?? event.value ?? null,
              confidence: event.confidence,
              evidence: String(event.evidence ?? '').slice(0, 220),
            })),
          }
        } catch (semanticError) {
          console.warn('[semantic-state] primary pass lỗi, dùng fallback legacy đã xác minh:', semanticError.message)
          primarySemanticAudit = { proposed: 0, accepted: 0, rejected: 0, error: semanticError.message, fallbackLegacy: true }
        }
      }
      if (!semanticPrimarySucceeded) {
        let legacyFallback = filterUiPreAppliedState(finalEvidenceCheck.parsed, preAppliedState)
        legacyFallback = filterSupplementalDuplicates(legacyFallback, stateParsed, { consumeExactMoney: true })
        stateParsed = mergeStateManifests(stateParsed, legacyFallback)
      }

      validShops = (stateParsed.shops ?? []).filter((shop) => {
        if (shop.semantic) return true
        const check = detectInteractiveShop(displayText, shop.name, stateUserText)
        if (!check.inside) rejectedShops.push(shop)
        return check.inside
      })
      if (!validShops.length) {
        const inferredShop = inferInteractiveShop(displayText, stateUserText)
        if (inferredShop) validShops = [inferredShop]
      }
      stateParsed = { ...stateParsed, shops: validShops }
      applyStoryState(stateParsed, {
        playerProfile, setPlayerProfile,
        relationships, setRelationships,
        bodyStatus, setBodyStatus,
      })
      const turnNow = nextMessages.length
      const mainApplyReport = applyParsedState(stateParsed, turnNow, displayText, turnMessageId)
      const committedMainManifest = ledgerManifestFromApplyReport(stateParsed, mainApplyReport)
      const turnAppliedManifest = preAppliedState
        ? mergeStateManifests(preAppliedState, committedMainManifest)
        : committedMainManifest
      for (const shop of rejectedShops) {
        mainApplyReport.lines.push(`⚠ Bỏ qua cửa hàng “${shop.name}”: chính văn hiển thị chưa cho nhân vật bước vào bên trong`)
      }
      // Legacy tag bị bác chỉ giữ trong audit debug. Từ Semantic Engine trở
      // đi không hiện thẻ KHÔNG ÁP màu cam cho người chơi nữa, vì nó khiến
      // một tag compatibility hỏng trông như state thật thất bại dù semantic
      // event tương ứng đã commit thành công.
      let movedTo = resolveMoveLocation(stateParsed, latestPlayerLocationRef.current)
      // Lựa chọn chỉ hiện ở nhịp truyện bình thường. Khi app đang chờ
      // Battle/Shop/Pokécenter thì các nút tương tác thật phải là nguồn hành
      // động duy nhất, tránh gợi ý kể vượt qua một kết quả chưa xảy ra.
      const resolvedPokecenter = stateParsed.pokecenter ?? (detectPokecenter(displayText).inside
        ? { name: 'Trung tâm Pokémon' }
        : null)
      const actionChoicesBlocked = displayText.includes(BATTLE_MARKER)
        || stateParsed.shops.length > 0
        || Boolean(resolvedPokecenter)
      const actionChoices = actionChoicesBlocked ? [] : replyActionChoices
      const actionChoicesPending = !actionChoicesBlocked && actionChoices.length === 0

      // Meta từng lượt (đợt 48 — học card PNTT): biến đã áp + suy nghĩ +
      // văn gốc, xem lại bằng nút 🧬 / chuột phải → "Biến cập nhật".
      const turnMeta = {
        raw: (reply ?? '').slice(0, META_CLIP),
        thinking: extractThinking(reply).slice(0, META_CLIP),
        // Giữ toàn bộ chính văn để nút “Quét lại biến” không mất nửa sau của
        // lượt dài/preset dài. raw/thinking mới cần clip vì chỉ là debug.
        evidenceText: displayText,
        branchCheckpointId: nextMessages[nextMessages.length - 1]?.id ?? null,
        appliedState: turnAppliedManifest,
        preAppliedState,
        presetUiVariables: extractPresetUiVariables(reply),
        blockPokemonAcquisition: Boolean(inputAdjudication.blockPokemonAcquisitionThisTurn),
        stateAudit: {
          version: 7,
          engine: 'semantic-events',
          canon: 'displayText',
          semantic: primarySemanticAudit,
          deterministicMoney: {
            detected: moneyReconcile.transactions.length,
            added: moneyReconcile.inferredAdded.length,
            deltas: moneyReconcile.inferredAdded,
            transactions: moneyReconcile.transactions.map((entry) => ({
              delta: entry.delta,
              kind: entry.kind,
              evidence: String(entry.evidence ?? '').slice(0, 260),
            })),
          },
          main: {
            accepted: countParsedStateOperations(committedMainManifest),
            rejected: rejectedShops.length + Math.max(0, countParsedStateOperations(stateParsed) - countParsedStateOperations(committedMainManifest)),
            legacyRejected: semanticPrimarySucceeded ? 0 : finalEvidenceCheck.rejected.length,
            legacyIgnored: semanticPrimarySucceeded ? finalEvidenceCheck.rejected.length : 0,
            legacyFallbackUsed: !semanticPrimarySucceeded,
          },
          passes: [],
        },
        changes: [
          ...describeParsedChanges(stateParsed, movedTo, '', mainApplyReport),
          ...(displayText !== stateEvidenceText ? ['✍ Văn đã qua API chau chuốt văn phong'] : []),
        ],
      }
      // API cập nhật biến chạy nền có thể trả lời sau khi người chơi đã sang
      // lượt kế tiếp. Gắn id cố định để DNA bổ sung quay đúng tin đã sinh ra nó,
      // không đính nhầm vào "tin AI cuối cùng" rồi khiến viewer khó kiểm chứng.
      setMessages((m) => [
        ...m,
        {
          id: turnMessageId,
          role: 'assistant',
          content: displayText,
          meta: turnMeta,
          actionChoices,
          actionChoicesPending,
          ...(inputAdjudication.searchTargets?.length ? {
            realisticSearch: {
              targets: [...inputAdjudication.searchTargets],
              stage: inputAdjudication.searchStage ?? 1,
              encounterEligible: Boolean(inputAdjudication.encounterEligible),
            },
          } : {}),
          ...(stateParsed.shops.length > 0
            ? { shop: stateParsed.shops[0], shopName: stateParsed.shops[0].name, shopValidated: true }
            : {}),
          // ĐỢT 71 — TRUNG TÂM POKÉMON. Ưu tiên tag [[POKECENTER]] AI khai;
          // model quên khai thì DÒ TỪ CHÍNH VĂN (quy tắc số 5: không tin
          // model tuân thủ, phải có đường bắt ở phía app).
          ...(resolvedPokecenter ? { pokecenter: resolvedPokecenter.name } : {}),
        },
      ])
      // Tracking vị trí: chính văn nhắc địa danh nào trong bản đồ 9 vùng thì
      // tự dời người chơi tới đó (ưu tiên khu cùng vùng hiện tại để tránh
      // nhầm các tên trùng như "Victory Road"). Dò sai → chỉnh tay ở Bản đồ.
      // VỊ TRÍ (đợt 38) — ưu tiên: (1) tag [[MOVE]] tường minh, (2) dòng
      // [Metadata|..|Vùng|Khu|..] của preset (đáng tin hơn quét cả bài),
      // (3) fallback quét địa danh trong chính văn. Dò metadata trên reply
      // GỐC vì dòng đó bị cleanAiOutput bóc mất khi lấy <content>.
      if (movedTo) {
        latestPlayerLocationRef.current = movedTo
        setPlayerLocation(movedTo)
      }

      // Preset/model nào không chịu xuất khối lựa chọn thì dùng một API phụ
      // lúc trình duyệt rảnh. Ưu tiên hai slot phụ 1/2, sau đó State API, cuối
      // cùng mới dùng API chính. Kết quả gắn bằng id tin và bị bỏ nếu người
      // chơi đã sửa/xoá/reroll, cùng nguyên tắc chống closure cũ của state API.
      if (actionChoicesPending) {
        const actionCfg = nextActionChoiceConfig()
        const recentContext = nextMessages
          .filter((message) => !message.hidden)
          .slice(-6)
          .map((message) => `${message.role === 'user' ? 'Người chơi' : 'AI'}: ${message.content}`)
          .join('\n\n')

        scheduleIdleStateTask(() => {
          withApiLease(actionCfg, () => generateActionChoices(actionCfg, {
            recentContext,
            storyText: displayText,
            userText: stateUserText,
            playerName: playerName || playerProfile?.name || '',
          }))
            .then((generated) => {
              setMessages((msgs) => {
                const at = msgs.findIndex((message) => message.id === turnMessageId)
                if (at < 0 || msgs[at].content !== displayText) return msgs
                const current = msgs[at]
                return msgs.map((message, index) => index === at ? {
                  ...current,
                  actionChoices: generated.length ? generated : [],
                  actionChoicesPending: false,
                } : message)
              })
            })
            .catch((choiceErr) => {
              console.warn('[action-choices] bỏ qua:', choiceErr.message)
              setMessages((msgs) => msgs.map((message) => message.id === turnMessageId
                ? { ...message, actionChoicesPending: false }
                : message))
            })
        })
      }

      // SEMANTIC RECOVERY nền: đọc lại chính văn canon và bổ sung SỰ KIỆN còn
      // thiếu theo ledger. Không tạo/đòi tag; mỗi pass độc lập nên một lỗi không
      // làm mất các nhóm state khác. Có API phụ riêng thì dùng, không thì fallback.
      // Có API phụ riêng (model rẻ) thì dùng, không thì fallback API CHÍNH.
      const dedicatedStateCfgs = [stateApiConfig, stateApiConfig2]
        .filter((cfg) => cfg?.baseUrl && cfg?.model)
        .map((cfg) => ({ ...apiConfig, ...cfg }))
      const spareStateApis = [outcomeApiConfig?.escaped, outcomeApiConfig?.lose]
        .filter((cfg) => cfg?.baseUrl && cfg?.model)
        .map((cfg) => ({ ...apiConfig, ...cfg }))
      let stateCfgs = dedicatedStateCfgs
      if (!stateCfgs.length) {
        // Có API phụ 1/2 thì chỉ luân phiên hai slot đó khi trình duyệt rảnh;
        // API chính không bị chen thêm một lượt gọi nền ngoài việc kể chuyện.
        const pool = spareStateApis.length ? spareStateApis : [apiConfig]
        stateCfgs = [pool[stateApiRoundRobinRef.current % pool.length]]
        stateApiRoundRobinRef.current += 1
      }
      if (stateCfgs.some((cfg) => cfg?.baseUrl && cfg?.model)) {
        // Đợt 102: lượt ít biến giữ 1-2 pass rộng như cũ. Lượt có mật độ
        // state cao tự mở thêm các shard chuyên môn. Mỗi shard KHÔNG có giới
        // hạn số proposal; mục đích chỉ là giảm tải chú ý/JSON cho model.
        const scanPlan = buildStateScanPlan({
          storyText: displayText,
          explicitOperationCount: countParsedStateOperations(stateParsed) + Number(primarySemanticAudit?.rejected ?? 0),
          broadPasses: stateCfgs.length > 1 ? 2 : 1,
        })
        stateScanLocksRef.current.add(turnMessageId)
        scheduleIdleStateTask(async () => {
          let scanLedger = turnAppliedManifest
          try {
            for (let scanIndex = 0; scanIndex < scanPlan.length; scanIndex += 1) {
              const passSpec = scanPlan[scanIndex]
              const stateCfg = stateCfgs[scanIndex % stateCfgs.length]
              if (!stateCfg?.baseUrl || !stateCfg?.model) continue
              let scanResult = null
              let parsedExtra = null
              let passAuditBase = null
              try {
                scanResult = await withApiLease(stateCfg, () => extractSemanticStateEvents(stateCfg, {
                  storyText: displayText,
                  userText: stateUserText,
                  appliedState: scanLedger,
                  stateSnapshot: buildStateScanSnapshot(
                    passSpec.focus,
                    (Number(playerProfile?.money) || 0) + (Number(scanLedger?.money) || 0),
                  ),
                  mode: normalizeGameMode(storyTone),
                  scanMode: passSpec.role,
                  focus: passSpec.focus,
                }))
                parsedExtra = filterUiPreAppliedState(scanResult.parsed, preAppliedState)
                parsedExtra = gateSemanticOwnership(parsedExtra, displayText, { reroll: Boolean(runOptions?.reroll), priorText: rerollPriorContext })
                parsedExtra = gatePokecenterInteraction(parsedExtra, displayText, { reroll: Boolean(runOptions?.reroll), priorText: rerollPriorContext })
                parsedExtra = filterSupplementalDuplicates(parsedExtra, scanLedger, { consumeExactMoney: true })
                passAuditBase = {
                  pass: scanIndex + 1,
                  role: passSpec.role,
                  focus: passSpec.focus?.label ?? null,
                  engine: 'semantic-events',
                  malformed: Boolean(scanResult?.malformed),
                  salvaged: Boolean(scanResult?.salvaged),
                  repaired: Boolean(scanResult?.repaired),
                  repairAttempted: Boolean(scanResult?.repairAttempted),
                  proposed: scanResult?.proposedCount ?? 0,
                  semanticRejected: scanResult?.rejectedCount ?? 0,
                }
                if (!countParsedStateOperations(parsedExtra)) {
                  setMessages((msgs) => msgs.map((message) => message.id === turnMessageId ? {
                    ...message,
                    meta: {
                      ...(message.meta ?? {}),
                      stateAudit: {
                        ...(message.meta?.stateAudit ?? turnMeta.stateAudit),
                        passes: [...(message.meta?.stateAudit?.passes ?? []), {
                          ...passAuditBase,
                          accepted: 0,
                          rejected: scanResult?.rejectedCount ?? 0,
                        }],
                      },
                    },
                  } : message))
                  continue
                }
              } catch (scanError) {
                console.warn(`[semantic-state-${scanIndex + 1}] bỏ qua:`, scanError.message)
                setMessages((msgs) => msgs.map((message) => message.id === turnMessageId ? {
                  ...message,
                  meta: {
                    ...(message.meta ?? {}),
                    stateAudit: {
                      ...(message.meta?.stateAudit ?? turnMeta.stateAudit),
                      passes: [...(message.meta?.stateAudit?.passes ?? []), {
                        pass: scanIndex + 1,
                        role: passSpec.role,
                        focus: passSpec.focus?.label ?? null,
                        engine: 'semantic-events',
                        proposed: 0,
                        accepted: 0,
                        rejected: 0,
                        error: scanError.message,
                      }],
                    },
                  },
                } : message))
                continue
              }
              const sourceMessage = latestMessagesRef.current.find((message) => message.id === turnMessageId)
              // Người chơi có thể reroll/xoá/sửa tin trong lúc engine nền chạy.
              if (!sourceMessage || sourceMessage.content !== displayText) {
                console.warn('[semantic-state] bỏ kết quả vì tin nguồn đã bị xoá hoặc sửa')
                return
              }
              const extra = parsedExtra
              const extraApplyReport = applyParsedState(extra, turnNow, displayText, turnMessageId)
              const extraLedger = ledgerManifestFromApplyReport(extra, extraApplyReport)
              if (extra.money || extra.rel.length || extra.body.length) {
                applyStoryState(extra, { setPlayerProfile, setRelationships, setBodyStatus })
              }
              const extraMovedTo = resolveMoveLocation(extra, latestPlayerLocationRef.current)
              if (extraMovedTo) {
                latestPlayerLocationRef.current = extraMovedTo
                setPlayerLocation(extraMovedTo)
              }
              const extraLines = describeParsedChanges(extra, extraMovedTo, `(Semantic audit ${scanIndex + 1}${passSpec.focus ? ` · ${passSpec.focus.label}` : ''})`, extraApplyReport)
              scanLedger = mergeStateManifests(scanLedger, extraLedger)
              if (extraLines.length || extra.shops?.length || extra.pokecenter || countParsedStateOperations(extra) > 0) {
                setMessages((msgs) => {
                  const at = msgs.findIndex((m2) => m2.id === turnMessageId)
                  if (at < 0) return msgs
                  const current = msgs[at]
                  const shop = extra.shops?.[0]
                  const updated = {
                    ...current,
                    ...(shop ? { shop, shopName: shop.name, shopValidated: true } : {}),
                    ...(extra.pokecenter ? { pokecenter: extra.pokecenter.name } : {}),
                    meta: {
                      ...(current.meta ?? {}),
                      changes: [...(current.meta?.changes ?? []), ...extraLines],
                      appliedState: mergeStateManifests(current.meta?.appliedState ?? turnAppliedManifest, extraLedger),
                      stateAudit: {
                        ...(current.meta?.stateAudit ?? turnMeta.stateAudit),
                        passes: [...(current.meta?.stateAudit?.passes ?? []), {
                          ...passAuditBase,
                          accepted: countParsedStateOperations(extraLedger),
                          rejected: (scanResult?.rejectedCount ?? 0)
                            + Math.max(0, countParsedStateOperations(extra) - countParsedStateOperations(extraLedger)),
                        }],
                      },
                    },
                  }
                  return msgs.map((m2, index) => (index === at ? updated : m2))
                })
              }
            }
          } finally {
            stateScanLocksRef.current.delete(turnMessageId)
          }
        })
      }
      // Tóm tắt cốt truyện (đợt 30): tự cập nhật nền khi đủ tin mới.
      maybeUpdateSummary(apiConfig, [...nextMessages, { role: 'assistant', content: displayText }]).catch(
        (sumErr) => console.warn('[summary] cập nhật tóm tắt lỗi (bỏ qua):', sumErr.message),
      )
      // Biên niên sử exact luôn ghi, kể cả không cấu hình embedding.
      const lastUser = [...nextMessages].reverse().find((m) => m.role === 'user' && !m.hidden)
      const storyTurnNumber = nextMessages.filter((message) => message.role === 'assistant').length + 1
      archiveExchange(lastUser?.content ?? '', stripInlineTags(displayText), nextMessages.length, storyTurnNumber, trainerId).catch(
        (archiveErr) => console.warn('[archive] ghi biên niên sử lỗi (bỏ qua):', archiveErr.message),
      )
      // Vector memory chỉ là lớp bổ sung ngữ nghĩa tùy chọn.
      const embCfgAfter = memoryApiConfig?.embedding
      if (embCfgAfter?.baseUrl && embCfgAfter?.model) {
        rememberExchange(embCfgAfter, lastUser?.content ?? '', stripInlineTags(displayText), nextMessages.length).catch(
          (memErr) => console.warn('[memory] ghi ký ức lỗi (bỏ qua):', memErr.message),
        )
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Quét lại BIẾN THẬT từ chính văn đã lưu. Đây là luồng có validator và
  // ledger chống áp trùng; khác hoàn toàn bảng biến preset chỉ để trình bày.
  async function rerollStateForMessage(messageIndex) {
    const source = latestMessagesRef.current[messageIndex]
    if (!source || source.role !== 'assistant') throw new Error('Không tìm thấy lượt AI cần quét.')
    const sourceKey = source.id || `assistant-legacy-${messageIndex}`
    if (stateScanLocksRef.current.has(sourceKey)) {
      return { ok: true, message: 'Lượt này đang được hệ thống tự quét nền; hãy đợi vài giây rồi mở lại để xem kết quả.' }
    }
    const storyText = source.meta?.evidenceText || source.content || ''
    if (!storyText.trim()) throw new Error('Lượt này không có chính văn để quét.')
    const userText = latestMessagesRef.current.slice(0, messageIndex).reverse()
      .find((message) => message.role === 'user' && !message.hidden)?.content ?? ''
    // Tin mới có ledger chính xác. Tin cũ lấy tag từ văn gốc làm mốc bảo thủ.
    const rawBaseline = compactStateManifest(parseStoryStateTags(source.meta?.raw ?? ''))
    let applied = source.meta?.appliedState ?? rawBaseline

    const dedicated = [stateApiConfig, stateApiConfig2]
      .filter((config) => config?.baseUrl && config?.model)
      .map((config) => ({ ...apiConfig, ...config }))
    const spare = [outcomeApiConfig?.escaped, outcomeApiConfig?.lose]
      .find((cfg) => cfg?.baseUrl && cfg?.model)
    const cfgs = dedicated.length ? dedicated : [spare ? { ...apiConfig, ...spare } : apiConfig]
    stateScanLocksRef.current.add(sourceKey)
    try {
      const lines = []
      // Đợt 101: MONEY deterministic chạy ngay cả khi không có State API.
      // Nếu nó sửa được tiền, ledger được ghi cùng message trước khi mở khóa.
      const rerollMoney = reconcileMoneyDirectives(parseStoryStateTags(''), storyText, { alreadyApplied: applied })
      if (rerollMoney.inferredAdded.length) {
        const moneyEvidence = validateStateAgainstProse(rerollMoney.parsed, storyText, { alreadyApplied: applied })
        if (moneyEvidence.parsed.money) {
          applyStoryState(moneyEvidence.parsed, { setPlayerProfile, setRelationships, setBodyStatus })
          applied = mergeStateManifests(applied, moneyEvidence.parsed)
          lines.push(`✅ 💰 Tiền ${moneyEvidence.parsed.money > 0 ? '+' : ''}${moneyEvidence.parsed.money} (app tự đối chiếu từ canon)`)
        }
      }

      const rerollAuditPasses = []
      let messagePatch = {}
      const rerollPlan = buildStateScanPlan({
        storyText,
        explicitOperationCount: countParsedStateOperations(applied),
        broadPasses: cfgs.length > 1 ? 2 : 1,
      })
      for (let scanIndex = 0; scanIndex < rerollPlan.length; scanIndex += 1) {
        const passSpec = rerollPlan[scanIndex]
        const cfg = cfgs[scanIndex % cfgs.length]
        if (!cfg?.baseUrl || !cfg?.model) continue
        let scanResult = null
        let parsed = null
        try {
          scanResult = await withApiLease(cfg, () => extractSemanticStateEvents(cfg, {
            storyText,
            userText,
            appliedState: applied,
            stateSnapshot: buildStateScanSnapshot(passSpec.focus, Number(playerProfile?.money) || 0),
            mode: normalizeGameMode(storyTone),
            scanMode: passSpec.role,
            focus: passSpec.focus,
          }))
          parsed = filterUiPreAppliedState(scanResult.parsed, source.meta?.preAppliedState)
          parsed = gateSemanticOwnership(parsed, storyText)
          parsed = gatePokecenterInteraction(parsed, storyText)
          parsed = filterSupplementalDuplicates(parsed, applied, { consumeExactMoney: true })
        } catch (scanError) {
          lines.push(`⚠ Semantic scan ${scanIndex + 1}${passSpec.focus ? ` (${passSpec.focus.label})` : ''} lỗi: ${scanError.message}`)
          rerollAuditPasses.push({
            pass: scanIndex + 1,
            role: passSpec.role,
            focus: passSpec.focus?.label ?? null,
            engine: 'semantic-events',
            proposed: 0,
            accepted: 0,
            rejected: 0,
            error: scanError.message,
            reroll: true,
          })
          continue
        }
        const auditBase = {
          pass: scanIndex + 1,
          role: passSpec.role,
          focus: passSpec.focus?.label ?? null,
          engine: 'semantic-events',
          malformed: Boolean(scanResult?.malformed),
          salvaged: Boolean(scanResult?.salvaged),
          repaired: Boolean(scanResult?.repaired),
          repairAttempted: Boolean(scanResult?.repairAttempted),
          proposed: scanResult?.proposedCount ?? 0,
          semanticRejected: scanResult?.rejectedCount ?? 0,
          reroll: true,
        }
        if (!countParsedStateOperations(parsed)) {
          rerollAuditPasses.push({ ...auditBase, accepted: 0, rejected: scanResult?.rejectedCount ?? 0 })
          continue
        }

        const extra = parsed
        if (extra.money || extra.rel.length || extra.body.length) {
          applyStoryState(extra, { setPlayerProfile, setRelationships, setBodyStatus })
        }
        const report = applyParsedState(extra, messageIndex, storyText, sourceKey)
        const extraLedger = ledgerManifestFromApplyReport(extra, report)
        const movedTo = resolveMoveLocation(extra, latestPlayerLocationRef.current)
        if (movedTo) {
          latestPlayerLocationRef.current = movedTo
          setPlayerLocation(movedTo)
        }
        lines.push(...describeParsedChanges(extra, movedTo, `(quét lại Semantic ${scanIndex + 1}${passSpec.focus ? ` · ${passSpec.focus.label}` : ''})`, report))
        rerollAuditPasses.push({
          ...auditBase,
          accepted: countParsedStateOperations(extraLedger),
          rejected: (scanResult?.rejectedCount ?? 0)
            + Math.max(0, countParsedStateOperations(extra) - countParsedStateOperations(extraLedger)),
        })
        if (extra.shops?.[0]) messagePatch = { ...messagePatch, shop: extra.shops[0], shopName: extra.shops[0].name, shopValidated: true }
        if (extra.pokecenter) messagePatch = { ...messagePatch, pokecenter: extra.pokecenter.name }
        applied = mergeStateManifests(applied, extraLedger)
      }
      setMessages((currentMessages) => currentMessages.map((message, index) => index === messageIndex ? {
        ...message,
        ...messagePatch,
        meta: {
          ...(message.meta ?? {}),
          evidenceText: storyText,
          appliedState: applied,
          changes: [...(message.meta?.changes ?? []), ...lines],
          stateAudit: {
            ...(message.meta?.stateAudit ?? {}),
            version: 7,
            engine: 'semantic-events',
            canon: 'displayText',
            deterministicMoney: {
              detected: rerollMoney.transactions.length,
              added: rerollMoney.inferredAdded.length,
              deltas: rerollMoney.inferredAdded,
              transactions: rerollMoney.transactions.map((entry) => ({
                delta: entry.delta,
                kind: entry.kind,
                evidence: String(entry.evidence ?? '').slice(0, 260),
              })),
            },
            passes: [...(message.meta?.stateAudit?.passes ?? []), ...rerollAuditPasses],
          },
        },
      } : message))
      return {
        ok: true,
        message: lines.length
          ? `Đã quét và xử lý ${lines.length} thay đổi. Xem danh sách bên dưới.`
          : 'Đã quét xong: không có thay đổi hợp lệ nào còn thiếu.',
      }
    } finally {
      stateScanLocksRef.current.delete(sourceKey)
    }
  }

  function savePresetUiVariables(messageIndex, variables) {
    setMessages((currentMessages) => currentMessages.map((message, index) => index === messageIndex ? {
      ...message,
      meta: { ...(message.meta ?? {}), presetUiVariables: variables },
    } : message))
  }

  // index tin AI cuối cùng (để chỉ hiện Reroll ở đó).
  const lastAiIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'assistant') return i
    return -1
  })()

  async function handleSend() {
    if (!input.trim() || loading) return
    const userMsg = { id: makeMessageId('user'), role: 'user', content: input.trim() }
    try {
      await saveTurnCheckpoint(trainerId, messages, userMsg.content, userMsg.id)
      if (!await saveBranchStateCheckpoint(trainerId, userMsg.id)) {
        throw new Error('Không tạo được checkpoint nhánh an toàn; hãy giải phóng bộ nhớ trình duyệt rồi thử lại.')
      }
    } catch (checkpointError) {
      setError(checkpointError.message)
      return
    }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    await callAI(nextMessages, userMsg.content)
  }

  // REROLL (đợt 39): bỏ tin AI cuối cùng, gọi lại từ đúng ngữ cảnh trước đó.
  // Dùng khi lượt vừa rồi bị cắt/lỗi/không ưng.
  async function handleRegenerate() {
    if (loading) return
    // Tìm tin assistant cuối cùng (không tính hidden).
    let lastAiIdx = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') { lastAiIdx = i; break }
    }
    if (lastAiIdx < 0) return
    const lastUserIndexForReroll = (() => {
      for (let index = lastAiIdx - 1; index >= 0; index -= 1) if (messages[index]?.role === 'user') return index
      return -1
    })()
    const lastUser = lastUserIndexForReroll >= 0 ? messages[lastUserIndexForReroll] : null
    let restored = await restoreTurnCheckpoint(trainerId, lastUser?.content ?? '', lastAiIdx - 1)
    if (!restored) {
      const checkpointId = messages[lastAiIdx]?.meta?.branchCheckpointId ?? lastUser?.id
      const restoredMessages = lastUserIndexForReroll >= 0 ? messages.slice(0, lastUserIndexForReroll + 1) : []
      const historical = checkpointId
        ? await restoreBranchStateCheckpoint(trainerId, checkpointId, restoredMessages)
        : null
      if (historical) restored = { ...historical, userText: lastUser?.content ?? '', restoredMessages }
    }
    if (!restored) {
      window.alert('Lượt này quá cũ và chưa có checkpoint nhánh an toàn. App không reroll mù để tránh nhân đôi Pokémon/state; hãy tạo một lượt mới rồi thử lại.')
      return
    }
    latestMessagesRef.current = restored.restoredMessages
    setMessages(restored.restoredMessages)
    await cleanupMemoryFor([lastAiIdx], restored.restoredMessages.length)
    sessionStorage.setItem('trainer-arena:pending-reroll', JSON.stringify({ trainerId, userText: restored.userText }))
    window.location.reload()
  }

  // GỬI LẠI TỪ TIN NGƯỜI CHƠI (đợt 50): người chơi chuột phải vào TIN CỦA
  // MÌNH cũng phải reroll được (phản hồi beta: "nút reroll đâu?" — trước đó
  // reroll chỉ nằm trên tin AI). Cắt mọi tin phía sau tin người chơi này
  // (thường là 1 tin AI trả lời) rồi gọi AI viết lại từ đúng chỗ đó.
  async function handleResendFromUser(idx) {
    if (loading) return
    const m = messages[idx]
    if (!m || m.role !== 'user') return
    let restored = await restoreTurnCheckpoint(trainerId, m.content ?? '', idx)
    if (!restored && m.id) {
      const restoredMessages = messages.slice(0, idx + 1)
      const historical = await restoreBranchStateCheckpoint(trainerId, m.id, restoredMessages)
      if (historical) restored = { ...historical, userText: m.content ?? '', restoredMessages }
    }
    if (!restored) {
      window.alert('Không có checkpoint nhánh an toàn cho lượt này. App không gửi lại mù vì có thể làm state/Pokémon bị nhân đôi.')
      return
    }
    latestMessagesRef.current = restored.restoredMessages
    setMessages(restored.restoredMessages)
    await cleanupMemoryFor(messages.slice(idx + 1).map((_, offset) => idx + 1 + offset), restored.restoredMessages.length)
    sessionStorage.setItem('trainer-arena:pending-reroll', JSON.stringify({ trainerId, userText: restored.userText }))
    window.location.reload()
  }

  // index tin NGƯỜI CHƠI cuối cùng (không tính hidden) — chỉ tin này được
  // "Gửi lại" (gửi lại tin giữa truyện sẽ cắt mất cả khúc sau, quá nguy hiểm).
  const lastUserIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && !messages[i].hidden) return i
    }
    return -1
  })()

  // SỬA 1 tin (đợt 39): cho phép sửa cả tin người chơi lẫn chính văn AI.
  function handleEditMessage(index, newContent) {
    const target = messages[index]
    if (!target) return
    if (target.role === 'assistant' && (target.meta?.changes?.length ?? 0) > 0) {
      window.alert('Tin này đã thay đổi state game. Hãy dùng Reroll để app hoàn tác checkpoint trước; sửa riêng câu chữ sẽ làm chính văn lệch dữ liệu.')
      return
    }
    if (index < messages.length - 1 && target.role === 'user') {
      window.alert('Không sửa trực tiếp input đã có câu trả lời. Hãy dùng “Gửi lại” ở lượt cuối để state và ký ức được hoàn tác cùng nhau.')
      return
    }
    setMessages((msgs) => msgs.map((m2, i) => {
      if (i === index) {
        return m2.role === 'assistant'
          ? { ...m2, content: newContent, actionChoices: [], actionChoicesPending: false }
          : { ...m2, content: newContent }
      }
      // Sửa input làm các gợi ý của câu trả lời kế tiếp mất căn cứ.
      if (i === index + 1 && msgs[index]?.role === 'user' && m2.role === 'assistant') {
        return { ...m2, actionChoices: [], actionChoicesPending: false }
      }
      return m2
    }))
  }

  function nextActionChoiceConfig() {
    const actionPool = [outcomeApiConfig?.escaped, outcomeApiConfig?.lose, stateApiConfig, stateApiConfig2]
      .filter((cfg) => cfg?.baseUrl && cfg?.model)
      .map((cfg) => ({ ...apiConfig, ...cfg }))
    if (!actionPool.length) return apiConfig
    const cfg = actionPool[actionChoiceApiRoundRobinRef.current % actionPool.length]
    actionChoiceApiRoundRobinRef.current += 1
    return cfg
  }

  async function handleRefreshActionChoices(messageId) {
    const at = messages.findIndex((message) => message.id === messageId)
    const target = at >= 0 ? messages[at] : null
    if (!target || target.role !== 'assistant' || loading) return
    const storyText = target.content || ''
    setMessages((current) => current.map((message) => message.id === messageId
      ? { ...message, actionChoicesPending: true }
      : message))
    try {
      const previous = messages.slice(0, at).filter((message) => !message.hidden)
      const recentContext = previous.slice(-6)
        .map((message) => `${message.role === 'user' ? 'Người chơi' : 'AI'}: ${message.content}`)
        .join('\n\n')
      const userText = [...previous].reverse().find((message) => message.role === 'user')?.content ?? ''
      const actionCfg = nextActionChoiceConfig()
      const generated = await withApiLease(actionCfg, () => generateActionChoices(actionCfg, {
        recentContext,
        storyText,
        userText,
        playerName: playerName || playerProfile?.name || '',
      }))
      setMessages((current) => current.map((message) => (
        message.id === messageId && message.content === storyText
          ? { ...message, actionChoices: generated, actionChoicesPending: false }
          : message
      )))
    } catch (error) {
      console.warn('[action-choices] sinh lại thất bại:', error.message)
      setMessages((current) => current.map((message) => message.id === messageId
        ? { ...message, actionChoicesPending: false }
        : message))
    }
  }

  function handleChooseAction(choice) {
    if (!choice?.text) return
    setInput(choice.text)
    // Chờ React commit value vào textarea rồi mới đặt con trỏ ở cuối.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const textarea = inputRef.current
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      textarea.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }))
  }

  function handleKeyDown(e) {
    if (e.key !== 'Enter' || e.isComposing) return
    const newlineMode = chatPreferences?.enterBehavior === 'newline'
    if (newlineMode) {
      // Mobile-friendly: Enter thực sự xuống dòng. Ctrl/⌘+Enter vẫn gửi nhanh.
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        handleSend()
      }
      return
    }
    // Desktop mặc định: Enter gửi, Shift+Enter xuống dòng.
    if (!e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Kết thúc phiên mua sắm (mua xong hoặc rời không mua) — cùng pattern với
  // handleBattleEnd: khoá shop (shopUsed) + thêm note kết quả trong CÙNG 1
  // mảng messages, rồi gọi AI kể tiếp dựa trên kết quả.
  async function handleShopFinish(bought, total) {
    // Đợt 64: chặn khi lượt truyện đang chạy — trước đây kết thúc mua sắm
    // giữa lúc AI đang viết sẽ chạy 2 callAI song song, tranh nhau ghi
    // messages (lượt sau đè lượt trước).
    if (loading) return
    const idx = shopMsgIndex
    setShopMsgIndex(null)
    if (idx === null) return
    const shopName = messages[idx]?.shopName ?? 'cửa hàng'

    let noteContent
    if (bought.length > 0) {
      // Trừ tiền + cộng túi đồ (merge theo id).
      // Functional update (đợt 45): tránh closure cũ đè mất thay đổi tiền
      // từ luồng khác (VD API cập nhật biến chạy nền). newMoney chỉ dùng
      // cho câu chữ trong note nên đọc từ closure là đủ chính xác.
      const newMoney = Math.max(0, Number(playerProfile.money) - total)
      setPlayerProfile((cur) => ({ ...cur, money: Math.max(0, Number(cur.money) - total) }))
      setInventory((cur) => {
        const inv = [...(cur ?? [])]
        for (const b of bought) {
          const i = inv.findIndex((x) => x.id === b.id)
          const { price: _price, gift: _gift, qty, ...itemData } = b
          if (i >= 0) inv[i] = { ...inv[i], ...itemData, qty: (inv[i].qty ?? 0) + qty }
          else inv.push({ ...itemData, qty })
        }
        return inv
      })
      const list = bought.map((b) => `${b.name} x${b.qty}`).join(', ')
      const freebies = bought.filter((b) => b.price === 0).map((b) => b.name)
      noteContent = `[Hệ thống — viết tiếp CHÍNH VĂN] Tại ${shopName}, người chơi đã chọn mua: ${list}. Tổng thanh toán ₽${total.toLocaleString('vi-VN')}, tiền còn lại ₽${newMoney.toLocaleString('vi-VN')}.${freebies.length ? ` Chủ quán tặng kèm: ${freebies.join(', ')}.` : ''} Hãy kể lại cảnh MUA HÀNG bằng văn xuôi tự nhiên: nhân vật nói muốn mua gì, tương tác với người bán, trả tiền (nêu rõ nếu có giảm giá/tặng kèm), rồi tiếp diễn câu chuyện. KHÔNG liệt kê kiểu hoá đơn. MONEY và ITEM của giao dịch này đã được app cập nhật trực tiếp; KHÔNG khai lại các tag đó.`
    } else {
      noteContent = `[Hệ thống] Người chơi rời ${shopName} mà không mua gì. Hãy viết tiếp câu chuyện.`
    }

    const note = {
      id: makeMessageId('system-user'),
      role: 'user',
      hidden: true,
      resultLabel: bought.length > 0 ? `Đã mua sắm tại ${shopName}` : `Rời ${shopName}`,
      content: noteContent,
      ...(bought.length > 0 ? {
        // Transaction đã ghi save ở trên. Ledger này theo sang lượt kể để cả
        // model chính lẫn API quét biến biết không được áp lại MONEY/ITEM.
        preAppliedState: compactStateManifest({
          money: -total,
          moneyEntries: total ? [-total] : [],
          items: bought.map((item) => ({ name: item.name, qty: item.qty })),
        }),
      } : {}),
    }
    const baseMessages = messages.map((mm, i) => (i === idx ? { ...mm, shopUsed: true } : mm))
    // Mua sắm đã đổi tiền/túi trước khi AI kể tiếp. Chờ updater persist rồi
    // chụp checkpoint ở đúng trạng thái SAU giao dịch, TRƯỚC các tag mới.
    await new Promise((resolve) => setTimeout(resolve, 0))
    try {
      await saveTurnCheckpoint(trainerId, baseMessages, note.content, note.id)
      await saveBranchStateCheckpoint(trainerId, note.id)
    } catch (checkpointError) { setError(checkpointError.message) }
    // Functional update (đợt 64): STATE phải dựng từ bản MỚI NHẤT, tránh
    // closure cũ xoá mất cập nhật chạy nền (meta biến của API phụ...).
    // LƯU Ý: React chạy hàm cập nhật ở pha render, KHÔNG đồng bộ tại đây —
    // nên không được lấy kết quả từ trong đó ra để dùng ngay. Payload gửi
    // AI dựng riêng từ closure là đủ đúng (meta không đi vào prompt).
    setMessages((cur) => [
      ...cur.map((mm, i) => (i === idx ? { ...mm, shopUsed: true } : mm)),
      note,
    ])
    const nextMessages = [...baseMessages, note]
    await callAI(nextMessages)
  }

  // Rời Trung tâm Pokémon (đợt 71) — gửi note ẩn để AI kể tiếp cảnh rời đi.
  async function handlePokecenterFinish(what) {
    const idx = pokecenterMsg?.index ?? null
    setPokecenterMsg(null)
    const note = {
      id: makeMessageId('system-user'),
      role: 'user',
      hidden: true,
      resultLabel: what === 'heal' ? 'Đã chữa trị tại Trung tâm Pokémon' : 'Đã dùng máy PC',
      content:
        what === 'heal'
          ? '[Hệ thống — viết tiếp CHÍNH VĂN] Người chơi đã đưa Pokémon cho y tá Joy chữa trị; máy hồi phục chạy xong, TOÀN ĐỘI đã khoẻ mạnh hoàn toàn. Hãy kể lại khoảnh khắc nhận Pokémon về (phản ứng của chúng khi khoẻ lại, lời chào của y tá) rồi để nhân vật RỜI KHỎI trung tâm và tiếp diễn câu chuyện.'
          : '[Hệ thống — viết tiếp CHÍNH VĂN] Người chơi vừa dùng máy PC ở Trung tâm Pokémon để sắp xếp lại đội hình. Hãy kể ngắn gọn cảnh đó rồi để nhân vật RỜI KHỎI trung tâm và tiếp diễn câu chuyện.',
    }
    // Khoá nút của tin đó lại để không bấm đi bấm lại vô hạn.
    const markUsed = (arr) =>
      idx !== null ? arr.map((mm, i) => (i === idx ? { ...mm, pokecenter: undefined } : mm)) : arr
    const baseMessages = markUsed(messages)
    await new Promise((resolve) => setTimeout(resolve, 0))
    try {
      await saveTurnCheckpoint(trainerId, baseMessages, note.content, note.id)
      await saveBranchStateCheckpoint(trainerId, note.id)
    } catch (checkpointError) { setError(checkpointError.message) }
    setMessages((cur) => [...markUsed(cur), note])
    await callAI([...baseMessages, note])
  }

  async function handleBattleEnd(outcome, details = null) {
    setBattleOpen(false)
    expNoteRef.current = null
    const doubleMode = details?.mode === 'double'
    const battleEnemies = details?.enemies?.length
      ? details.enemies.filter(Boolean)
      : (enemyMon ? [enemyMon] : [])

    if (['win', 'join', 'calm', 'caught'].includes(outcome)) {
      musicManager.playJingle(VICTORY_TRACK_KEYS)
      if (['win', 'caught'].includes(outcome) && battleEnemies.length) {
        const expMul = battleExpMultiplier(playerTraits)
        const baseGain = battleEnemies.reduce(
          (sum, mon) => sum + expGainFrom(mon, { isTrainerMon: Boolean(mon.isTrainerMon) }),
          0,
        )
        const gain = Math.max(1, Math.round(baseGain * expMul))
        const shareExp = sharesBattleExpWithParty(playerTraits)
        const sourceParty = (details?.team?.length ? details.team : latestPartyRef.current) ?? []
        const keyOf = (mon) => mon?.uid ?? `${mon?.name ?? ''}-${mon?.level ?? ''}`
        // Dùng snapshot CHÍNH XÁC mà battle engine vừa kết thúc trả về. React
        // state setter là bất đồng bộ; đọc latest ref ngay sau setState từng
        // làm HP/trạng thái cuối trận bị bản cũ ghi đè khi cộng EXP.
        const activeMon = sourceParty.find((mon) => keyOf(mon) === details?.leadUid)
          ?? latestPlayerMonRef.current
          ?? playerMon
        const participants = new Set(
          details?.participantUids?.length
            ? details.participantUids
            : [activeMon?.uid ?? `${activeMon?.name ?? ''}-${activeMon?.level ?? ''}`],
        )
        // BattleModal cập nhật con đang ra trận và party qua hai setter riêng.
        // Luôn ưu tiên bản activeMon mới nhất khi cùng uid để không lấy lại HP/
        // trạng thái cũ từ party rồi ghi đè lúc cộng EXP.
        let roster = sourceParty.map((mon) => activeMon && isSameMon(mon, activeMon) ? { ...activeMon } : { ...mon })
        if (activeMon && !roster.some((mon) => isSameMon(mon, activeMon))) roster.unshift({ ...activeMon })
        const levelUps = []
        const updated = roster.map((mon) => {
          const participates = participants.has(keyOf(mon))
          if (!participates && !shareExp) return mon
          let next = mon
          if (participates) {
            for (const foe of battleEnemies) next = applyEvGain(next, foe)
          }
          const result = applyExpGain(next, gain, movesDb)
          if (result.levelsGained > 0) {
            levelUps.push({ name: result.mon.name, newLevel: result.newLevel, levels: result.levelsGained })
          }
          return result.mon
        })
        setParty(updated)
        const lead = updated.find((mon) => keyOf(mon) === details?.leadUid)
          ?? updated.find((mon) => activeMon && isSameMon(mon, activeMon))
          ?? updated.find((mon) => mon.hp > 0)
        if (lead) setPlayerMon(lead)
        expNoteRef.current = {
          gain, baseGain, multiplier: expMul, shared: shareExp,
          enemyName: battleEnemies.map((mon) => mon.name).join(' + '),
          levelUps,
          doubleMode,
        }
      }
    } else if (outcome === 'lose') {
      musicManager.playJingle(DEFEAT_TRACK_KEYS)
    }

    // Độ thân mật không tự đổi theo kết quả battle; chỉ [[FRIEND]] có
    // bằng chứng trong chính văn mới được áp.


    const idx = activeBattleMsgIndex
    if (idx !== null) setActiveBattleMsgIndex(null)
    const note = {
      id: makeMessageId('system-user'),
      role: 'user',
      hidden: true,
      resultLabel: (() => {
        const base = OUTCOME_LABEL[outcome] ?? outcome
        const info = expNoteRef.current
        if (!info) return doubleMode ? `${base} · Đấu đôi 2v2` : base
        const mul = info.multiplier > 1 ? ` (×${info.multiplier})` : ''
        const shared = info.shared ? ' · cả đội nhận EXP' : ''
        const lv = info.levelUps?.length
          ? ` · ${info.levelUps.map((entry) => `${entry.name} Lv.${entry.newLevel}!`).join(', ')}`
          : ''
        return `${base}${info.doubleMode ? ' · 2v2' : ''} · +${info.gain} EXP${mul}${shared}${lv}`
      })(),
      content: `[Hệ thống: ${doubleMode ? 'trận đấu đôi Pokémon 2v2' : 'trận đấu Pokémon'} vừa kết thúc, kết quả là ${
        OUTCOME_TEXT[outcome] ?? outcome
      }.]${(() => {
        const info = expNoteRef.current
        expNoteRef.current = null
        if (!info) return ''
        const multiplier = info.multiplier > 1
          ? ` (đã áp thiên phú ×${info.multiplier} từ mức gốc ${info.baseGain})`
          : ''
        const shared = info.shared ? ' Toàn bộ Pokémon trong đội cũng nhận cùng lượng EXP.' : ''
        const base = ` Pokémon tham chiến nhận được ${info.gain} điểm kinh nghiệm${multiplier} sau khi hạ ${info.enemyName}.${shared}`
        if (!info.levelUps?.length) return base
        const levels = info.levelUps.map((entry) => `${entry.name} đạt Lv.${entry.newLevel}`).join('; ')
        return `${base} ĐẶC BIỆT: ${levels} — hãy kể khoảnh khắc trưởng thành này tự nhiên trong chính văn.`
      })()} Hãy tiếp tục kể câu chuyện dựa trên kết quả thật này, không bịa lại diễn biến chi tiết của trận.`,
    }
    const markUsed = (arr) => idx !== null
      ? arr.map((message, i) => i === idx ? {
          ...message, battleUsed: true, enemySnapshot: undefined, enemySnapshots: undefined,
          battleRuntime: undefined, doubleBattleRuntime: undefined,
        } : message)
      : arr
    const baseMessages = markUsed(messages)
    await new Promise((resolve) => setTimeout(resolve, 0))
    try {
      await saveTurnCheckpoint(trainerId, baseMessages, note.content, note.id)
      await saveBranchStateCheckpoint(trainerId, note.id)
    } catch (checkpointError) { setError(checkpointError.message) }
    setMessages((cur) => [...markUsed(cur), note])
    const nextMessages = [...baseMessages, note]
    const override = outcome === 'escaped' ? outcomeApiConfig.escaped : outcome === 'lose' ? outcomeApiConfig.lose : null
    await callAI(nextMessages, '', override)
  }

  return (
    <div>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="page-title">TRAINER ARENA</h2>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>
              Người chơi: {playerName || '(chưa đặt tên)'}
            </p>
          </div>
          <button
            className="btn"
            onClick={() => {
              // Đợt 46: messages đã persist — xoá là mất hẳn, phải hỏi lại.
              if (window.confirm('Xoá toàn bộ lịch sử truyện và HOÀN TÁC state phát sinh từ nhánh này? Pokémon/tiền/vật phẩm/biến truyện do các lượt đã xoá cũng sẽ được trả về mốc trước truyện.')) void wipeAllMemory()
            }}
          >
            Xoá lịch sử chat
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div style={{ position: 'relative' }}>
        <div
          ref={scrollRef}
          onScroll={handleChatScroll}
          onWheel={(e) => { if (e.deltaY < 0) detachChatAutoScroll() }}
          onTouchMove={() => {
            // Scroll event phía sau sẽ xác định hướng; đánh dấu sớm để callback
            // nền cùng frame không giật màn hình trên mobile.
            if (chatDistanceFromBottom() > 12) detachChatAutoScroll()
          }}
          style={{
            maxHeight: '62vh',
            overflowY: 'auto',
            paddingRight: 6,
            // Không dùng CSS smooth toàn cục: các state callback trước đây khiến
            // browser nối nhiều animation và nhìn như thanh trượt tự chạy.
            overflowAnchor: 'none',
          }}
        >
          {messages.length === 0 && (
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Câu chuyện chưa bắt đầu.</p>
          )}
          {messages.map((m, i) => {
            if (m.hidden) {
              return (
                <div
                  key={i}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--text-dim)',
                    border: '1px solid var(--line)',
                    borderRadius: 999,
                    padding: '3px 12px',
                    display: 'inline-block',
                    margin: '10px 0',
                  }}
                >
                  ⚔ {m.resultLabel}
                </div>
              )
            }
            if (m.role === 'user') {
              return (
                <p
                  key={i}
                  className="story-text story-text--player"
                  onContextMenu={(e) => openCtxMenu(e, i)}
                  {...touchProps(i)}
                  title="Chuột phải (hoặc chạm giữ trên điện thoại) để sửa / gửi lại / xoá"
                >
                  » {m.content}
                </p>
              )
            }
            const isLastAi = i === lastAiIndex
            return (
              <React.Fragment key={i}>
              {editingIndex === i ? (
                <div style={{ margin: '8px 0' }}>
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    style={{ width: '100%', minHeight: 120, fontSize: 13 }}
                  />
                  <div className="btn-row" style={{ gap: 8, marginTop: 6 }}>
                    <button className="btn btn--primary" onClick={() => { handleEditMessage(i, editDraft); setEditingIndex(null) }}>Lưu</button>
                    <button className="btn" onClick={() => setEditingIndex(null)}>Huỷ</button>
                  </div>
                </div>
              ) : (
              <div onContextMenu={(e) => openCtxMenu(e, i)} {...touchProps(i)} title="Chuột phải hoặc chạm giữ: sửa / reroll / sao chép / biến / xoá">
              <StoryParagraph
                content={m.content}
                used={Boolean(m.battleUsed)}
                onOpenBattle={() => {
                  if (!playerMon) {
                    window.alert('Bạn chưa có Pokémon nào — hãy để câu chuyện dẫn tới việc nhận Pokémon đầu tiên đã.')
                    return
                  }
                  const roster = (party ?? []).length ? party : [playerMon]
                  const healthy = roster.filter((pm) => pm && (pm.hp ?? 0) > 0)
                  if (healthy.length === 0) {
                    window.alert('Toàn đội Pokémon của bạn đã gục — không thể vào trận. Hãy tới TRUNG TÂM POKÉMON để chữa trị.')
                    return
                  }

                  // Đợt 75: ghép cả INPUT ngay trước đó với chính văn. Nhờ vậy
                  // yêu cầu "xin Chủ Gym đấu đôi" vẫn được nhận ra ngay cả khi
                  // model chỉ trả lời ngắn "được" trước marker [[BATTLE]].
                  const previousUserText = messages[i - 1]?.role === 'user' ? messages[i - 1].content : ''
                  const battleSource = `${previousUserText}
${m.content}`
                  const battleCtx = detectTrainerBattle(battleSource)
                  const doubleCtx = detectDoubleBattle(battleSource, battleCtx)
                  if (doubleCtx.isDouble && healthy.length < 2) {
                    window.alert('Đấu đôi 2v2 cần ít nhất 2 Pokémon còn khả năng chiến đấu trong đội.')
                    return
                  }
                  if ((playerMon.hp ?? 0) <= 0) setPlayerMon(healthy[0])
                  setActiveBattleMsgIndex(i)

                  if (!m.battleStarted) {
                    const ownNames = [...(party ?? []).map((pm) => pm?.name), playerMon?.name].filter(Boolean)
                    const mentionedList = detectMentionedSpeciesList(battleSource, pokedexSpecies, { excludeNames: ownNames })
                    const activeMentionedList = detectBattleOpponentSpeciesList(m.content, pokedexSpecies, { excludeNames: ownNames })
                      .concat(detectBattleOpponentSpeciesList(previousUserText, pokedexSpecies, { excludeNames: ownNames }))
                      .filter((entry, index, list) => list.findIndex((other) => other.name === entry.name) === index)
                    // Đợt 111: ưu tiên Pokémon có cue “xuất trận/ra sân/đối thủ”;
                    // Pokémon đứng xem/khán đài không được biến thành combatant chỉ
                    // vì tên của nó xuất hiện muộn hơn trong chính văn.
                    const battleOpponent = detectBattleOpponentSpecies(m.content, pokedexSpecies, { excludeNames: ownNames })
                      || detectBattleOpponentSpecies(battleSource, pokedexSpecies, { excludeNames: ownNames })
                    const mentioned = battleOpponent || detectMentionedSpecies(m.content, pokedexSpecies, { excludeNames: ownNames })
                    const ecologyOptions = {
                      pokedex: pokedexSpecies,
                      location: playerLocation,
                      storyDate,
                      weather: getWeather(storyDate, playerLocation),
                      kind: battleCtx.isTrainer ? 'trainer' : 'wild',
                      excludeNames: ownNames,
                    }
                    const npcProfile = battleCtx.isTrainer ? findNpcProfileInText(battleSource) : null
                    const persistentRoster = (npcProfile?.team ?? []).map((slot) => ({
                      ...slot,
                      entry: pokedexSpecies.find((entry) => normalizeMonTarget(entry.name) === normalizeMonTarget(slot.species)
                        || normalizeMonTarget(entry.species) === normalizeMonTarget(slot.species)),
                    })).filter((slot) => slot.entry)
                    const persistentStart = persistentRoster.length ? (npcProfile.battles ?? 0) % persistentRoster.length : 0
                    const persistentPick = persistentRoster[persistentStart]?.entry
                    const requestedSpecial = persistentPick || mentioned
                    const encounterAccess = legendaryAccess(requestedSpecial, worldProgress, storyTone, adminMode)
                    if (requestedSpecial && !encounterAccess.allowed) {
                      setActiveBattleMsgIndex(null)
                      window.alert(`Cổng tiến trình chặn cuộc gặp ${requestedSpecial.name}: ${encounterAccess.reason}. Chính văn không thể bỏ qua luật này.`)
                      return
                    }
                    const speciesEntry = persistentPick
                      || mentioned
                      || pickEcologicalEncounter(ecologyOptions)
                      || pokedexSpecies.find((entry) => !legendaryAccess(entry, {}, storyTone).tier)
                    const leagueSlotBase = nextLeagueTeamSlot(messages, i, battleCtx.tier)
                    const levelFor = (entry, offset = 0) => {
                      if (battleCtx.isTrainer) {
                        const savedSlot = persistentRoster.find((slot) => slot.entry === entry)
                        if (savedSlot) return Math.max(1, Math.min(100, savedSlot.level))
                        // League dùng đúng bảng 6 ô: Elite 85/85/90/90/95/95,
                        // Champion 98/98/99/99/100/100. Trainer thường giữ
                        // logic cũ; Pokémon thứ hai trong đấu đôi chỉ nhỉnh +1.
                        if (leagueSlotBase != null) {
                          return trainerBattleLevel({
                            tier: battleCtx.tier,
                            location: playerLocation,
                            realTeam: battleCtx.realTeam,
                            slot: leagueSlotBase + offset,
                          })
                        }
                        const base = trainerBattleLevel({
                          tier: battleCtx.tier,
                          location: playerLocation,
                          realTeam: battleCtx.realTeam,
                        })
                        return Math.max(1, Math.min(100, base + offset))
                      }
                      const base = wildLevel({ location: playerLocation, entry }).level
                      return Math.max(1, Math.min(100, base + offset))
                    }
                    const decorateTrainer = (mon) => {
                      if (!battleCtx.isTrainer) return mon
                      mon.trainerLabel = battleCtx.realTeam ? `${battleCtx.label} (ĐỘI HÌNH THẬT)` : battleCtx.label
                      mon.realTeam = battleCtx.realTeam
                      return mon
                    }

                    if (doubleCtx.isDouble) {
                      // Lấy hai loài được nhắc MUỘN NHẤT. Thiếu một loài thì
                      // sinh thêm đối thủ khác, nhưng không dùng Pokémon phe mình.
                      const picked = persistentRoster.length
                        ? [0, 1].map((offset) => persistentRoster[(persistentStart + offset) % persistentRoster.length]?.entry).filter(Boolean)
                        : (activeMentionedList.length ? activeMentionedList.slice(0, 2) : mentionedList.slice(-2))
                      const lockedEntry = picked.find((entry) => !legendaryAccess(entry, worldProgress, storyTone, adminMode).allowed)
                      if (lockedEntry) {
                        const locked = legendaryAccess(lockedEntry, worldProgress, storyTone, adminMode)
                        setActiveBattleMsgIndex(null)
                        window.alert(`Cổng tiến trình chặn cuộc gặp ${lockedEntry.name}: ${locked.reason}.`)
                        return
                      }
                      if (!picked.length) picked.push(speciesEntry)
                      while (picked.length < 2) {
                        const ecologicalPick = pickEcologicalEncounter({
                          ...ecologyOptions,
                          excludeSpecies: picked.map((chosen) => chosen.species),
                        })
                        const pool = pokedexSpecies.filter((entry) =>
                          !ownNames.some((name) => name?.toLowerCase() === entry.name.toLowerCase())
                          && !picked.some((chosen) => chosen.name === entry.name))
                        picked.push(ecologicalPick ?? pool[Math.floor(Math.random() * pool.length)] ?? speciesEntry)
                      }
                      const duo = picked.slice(0, 2).map((entry, index) => decorateTrainer(buildMonSmart(
                        entry, levelFor(entry, index === 1 ? 1 : 0), movesDb, playerMon?.types, true,
                      )))
                      setEnemyMon(duo[0])
                      if (npcProfile) recordNpcBattle(npcProfile.id, duo)
                      setMessages((msgs) => msgs.map((mm, idx) => idx === i ? {
                        ...mm, battleStarted: true, battleMode: 'double', doubleReason: doubleCtx.reason,
                        trainerTier: battleCtx.tier, trainerTeamSlot: leagueSlotBase,
                        trainerTeamCount: doubleCtx.isDouble ? 2 : 1,
                        enemySnapshot: duo[0], enemySnapshots: duo,
                      } : mm))
                    } else {
                      const orderedPersistentTeam = persistentRoster.length
                        ? persistentRoster.map((_, offset) => persistentRoster[(persistentStart + offset) % persistentRoster.length])
                        : []
                      const fullEnemyTeam = orderedPersistentTeam.map((slot) => decorateTrainer(buildMonSmart(
                        slot.entry, Math.max(1, Math.min(100, slot.level)), movesDb, playerMon?.types, true,
                      )))
                      const mon = fullEnemyTeam[0] ?? decorateTrainer(buildMonSmart(
                        speciesEntry, levelFor(speciesEntry), movesDb, playerMon?.types, battleCtx.isTrainer,
                      ))
                      const enemyTeam = fullEnemyTeam.length ? fullEnemyTeam : [mon]
                      setEnemyMon(mon)
                      if (npcProfile) recordNpcBattle(npcProfile.id, enemyTeam)
                      setMessages((msgs) => msgs.map((mm, idx) => idx === i ? {
                        ...mm, battleStarted: true, battleMode: 'single',
                        trainerTier: battleCtx.tier, trainerTeamSlot: leagueSlotBase, trainerTeamCount: enemyTeam.length,
                        enemySnapshot: mon, enemySnapshots: enemyTeam,
                      } : mm))
                    }
                  } else if (m.battleMode === 'double' && m.enemySnapshots?.length) {
                    setEnemyMon(m.enemySnapshots[0])
                  } else if (m.enemySnapshot) {
                    setEnemyMon(m.enemySnapshot)
                  }
                  setBattleOpen(true)
                }}
              />
              </div>
              )}
              {editingIndex !== i && m.meta && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <button
                    onClick={() => setTurnInfoIndex(i)}
                    title="Xem biến cập nhật / suy nghĩ / văn gốc của lượt này"
                    style={{
                      border: '1px solid var(--line)', background: 'transparent',
                      color: 'var(--text-dim)', borderRadius: 999, padding: '1px 10px',
                      fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)',
                    }}
                  >
                    🧬 {m.meta.changes?.length ? `${m.meta.changes.length} biến` : 'chi tiết'}
                  </button>
                </div>
              )}
              {editingIndex !== i
                && isLastAi
                && i > lastUserIndex
                && !m.content.includes(BATTLE_MARKER)
                && !m.shopName
                && !m.pokecenter && (
                <ActionChoices
                  choices={m.actionChoices ?? []}
                  pending={Boolean(m.actionChoicesPending)}
                  disabled={loading}
                  onChoose={handleChooseAction}
                  onRefresh={() => handleRefreshActionChoices(m.id)}
                />
              )}
              {m.shopName && (m.shopValidated || detectInteractiveShop(
                m.content,
                m.shopName,
                messages[i - 1]?.role === 'user' ? messages[i - 1].content : '',
              ).inside) && (
                <div>
                  <button
                    onClick={() => setShopMsgIndex(i)}
                    disabled={Boolean(m.shopUsed)}
                    title={m.shopUsed ? 'Đã mua sắm xong tại đây' : 'Bấm để vào cửa hàng'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      border: '1px solid var(--amber)',
                      background: m.shopUsed ? 'transparent' : 'var(--bg-deep)',
                      color: 'var(--amber)',
                      opacity: m.shopUsed ? 0.4 : 1,
                      borderRadius: 999,
                      padding: '6px 16px',
                      margin: '6px 0',
                      cursor: m.shopUsed ? 'default' : 'pointer',
                      fontSize: 13,
                    }}
                  >
                    🛒 {m.shopUsed ? `Đã mua sắm — ${m.shopName}` : `Vào cửa hàng: ${m.shopName}`}
                  </button>
                </div>
              )}
              {/* Đợt 71: TRUNG TÂM POKÉMON — 2 nút như quầy trong game gốc. */}
              {m.pokecenter && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '6px 0' }}>
                  <button
                    onClick={() => setPokecenterMsg({ index: i, tab: 'menu' })}
                    title="Chữa trị cho Pokémon"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      border: '1px solid #e05a5a', background: 'var(--bg-deep)',
                      color: '#e05a5a', borderRadius: 999, padding: '6px 16px',
                      cursor: 'pointer', fontSize: 13,
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 40 40">
                      <rect x="15" y="4" width="10" height="32" rx="2.5" fill="#e05a5a" />
                      <rect x="4" y="15" width="32" height="10" rx="2.5" fill="#e05a5a" />
                    </svg>
                    Chữa trị
                  </button>
                  <button
                    onClick={() => setPokecenterMsg({ index: i, tab: 'pc' })}
                    title="Mở máy PC — sắp xếp đội hình"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      border: '1px solid var(--mint)', background: 'var(--bg-deep)',
                      color: 'var(--mint)', borderRadius: 999, padding: '6px 16px',
                      cursor: 'pointer', fontSize: 13,
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 40 40">
                      <rect x="4" y="6" width="32" height="22" rx="3" fill="none" stroke="var(--mint)" strokeWidth="3" />
                      <rect x="15" y="30" width="10" height="3" fill="var(--mint)" />
                      <rect x="10" y="33" width="20" height="3" rx="1.5" fill="var(--mint)" />
                    </svg>
                    Máy PC
                  </button>
                </div>
              )}
              </React.Fragment>
            )
          })}
          {loading && <p style={{ color: 'var(--text-dim)', fontSize: 12.5 }}>Đang viết tiếp câu chuyện...</p>}
        </div>
        {showJumpToBottom && (
          <div style={{ position: 'absolute', left: 0, right: 6, bottom: 8, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 12 }}>
            <button
              className="btn"
              onClick={() => jumpToChatBottom({ behavior: 'smooth' })}
              style={{ pointerEvents: 'auto', boxShadow: '0 4px 18px rgba(0,0,0,.35)', borderRadius: 999, padding: '6px 14px' }}
              title="Quay về tin mới nhất"
            >
              ↓ {hasNewBelow ? 'Tin mới' : 'Xuống cuối'}
            </button>
          </div>
        )}
        </div>

        {/* Menu chuột phải trên tin nhắn (đợt 48 — học card PNTT). */}
        {ctxMenu && (() => {
          const m = messages[ctxMenu.index]
          if (!m) return null
          const isAi = m.role === 'assistant'
          const item = (label, onClick, { disabled = false, danger = false, titleTip = '' } = {}) => (
            <button
              key={label}
              disabled={disabled}
              title={titleTip}
              onClick={() => { setCtxMenu(null); onClick?.() }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', border: 'none',
                background: 'transparent', color: danger ? 'var(--red, #e05a5a)' : 'var(--text-main)',
                opacity: disabled ? 0.4 : 1, padding: '8px 14px', fontSize: 13,
                cursor: disabled ? 'default' : 'pointer',
              }}
              onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--bg-deep)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {label}
            </button>
          )
          return (
            <>
              <div onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null) }} style={{ position: 'fixed', inset: 0, zIndex: 95 }} />
              <div
                className="panel"
                style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 96, padding: '6px 0', minWidth: 210, boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}
              >
                {item('✎ Sửa tin nhắn', () => { setEditingIndex(ctxMenu.index); setEditDraft(m.content) })}
                {!isAi && item('↻ Gửi lại (viết lại lượt trả lời)', () => handleResendFromUser(ctxMenu.index), {
                  disabled: loading || ctxMenu.index !== lastUserIndex,
                  titleTip: ctxMenu.index !== lastUserIndex ? 'Chỉ gửi lại được tin người chơi MỚI NHẤT' : 'Xoá lượt AI trả lời và viết lại',
                })}
                {isAi && item('↻ Gửi lại (reroll)', handleRegenerate, {
                  disabled: loading || ctxMenu.index !== lastAiIndex,
                  titleTip: ctxMenu.index !== lastAiIndex ? 'Chỉ reroll được tin AI mới nhất' : 'Viết lại lượt này',
                })}
                {item('⧉ Sao chép tin nhắn', () => {
                  try { navigator.clipboard.writeText(m.content) } catch { /* http cũ không có clipboard API */ }
                })}
                {isAi && item('🧬 Biến cập nhật', () => setTurnInfoIndex(ctxMenu.index), {
                  disabled: !m.meta,
                  titleTip: m.meta ? 'Xem biến / suy nghĩ / văn gốc của lượt này' : 'Tin cũ (trước đợt 48) không lưu meta',
                })}
                {item('🗑 Xoá tin nhắn', () => handleDeleteMessage(ctxMenu.index), { danger: true })}
              </div>
            </>
          )
        })()}

        {turnInfoIndex !== null && messages[turnInfoIndex] && (
          <TurnInfoModal
            message={messages[turnInfoIndex]}
            onClose={() => setTurnInfoIndex(null)}
            onRerollState={() => rerollStateForMessage(turnInfoIndex)}
            onSavePresetVariables={(variables) => savePresetUiVariables(turnInfoIndex, variables)}
          />
        )}

        {/* Menu chuột phải trên Ô NHẬP (đợt 61). */}
        {inputMenu && (
          <>
            <div onClick={() => setInputMenu(null)} onContextMenu={(e) => { e.preventDefault(); setInputMenu(null) }} style={{ position: 'fixed', inset: 0, zIndex: 95 }} />
            <div className="panel" style={{ position: 'fixed', left: inputMenu.x, top: inputMenu.y, zIndex: 96, padding: '6px 0', minWidth: 200, boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
              {[
                {
                  label: '⌫ Xoá nội dung đang gõ',
                  disabled: !input,
                  onClick: () => setInput(''),
                },
                {
                  label: '↩ Xoá lượt trả lời gần nhất',
                  disabled: loading || lastAiIndex < 0,
                  onClick: () => {
                    const ai = lastAiIndex
                    if (ai < 0) return
                    const triggerIndex = findTurnTriggerIndex(ai)
                    if (triggerIndex < 0) return
                    if (!window.confirm('Xoá lượt gần nhất (bạn + AI) và hoàn tác toàn bộ state của lượt đó?')) return
                    void rollbackAndCutBranch(triggerIndex, { keepTrigger: false })
                  },
                },
                {
                  label: '🗑 Xoá toàn bộ lịch sử truyện',
                  danger: true,
                  disabled: loading || messages.length === 0,
                  onClick: () => {
                    if (window.confirm('Xoá TOÀN BỘ lịch sử truyện và HOÀN TÁC state phát sinh từ nhánh này? Pokémon/tiền/vật phẩm/biến truyện do các lượt đã xoá cũng sẽ được trả về mốc trước truyện.')) {
                      void wipeAllMemory()
                    }
                  },
                },
              ].map((it) => (
                <button
                  key={it.label}
                  disabled={it.disabled}
                  onClick={() => { setInputMenu(null); it.onClick?.() }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', border: 'none',
                    background: 'transparent', color: it.danger ? 'var(--red, #e05a5a)' : 'var(--text-main)',
                    opacity: it.disabled ? 0.4 : 1, padding: '8px 14px', fontSize: 13,
                    cursor: it.disabled ? 'default' : 'pointer',
                  }}
                  onMouseEnter={(e) => { if (!it.disabled) e.currentTarget.style.background = 'var(--bg-deep)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  {it.label}
                </button>
              ))}
            </div>
          </>
        )}

        {error && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className="status-pill status-pill--error">{error}</div>
            {/* Đợt 51: nút THỬ LẠI ngay trên banner lỗi — trước đây lượt lỗi
                (VD proxy 502) người chơi phải gõ lại tin → tin bị NHÂN ĐÔI
                trong truyện. Giờ bấm 1 nút, gọi lại đúng từ tin cuối. */}
            {lastUserIndex >= 0 && lastUserIndex === messages.length - 1 && (
              <button
                className="btn"
                disabled={loading}
                onClick={() => {
                  setError(null)
                  callAI(messages, messages[lastUserIndex]?.content ?? '')
                }}
              >
                ↻ Thử lại lượt này
              </button>
            )}
          </div>
        )}

        {lastPromptDebug && (
          <div style={{ marginTop: 10 }}>
            <button className="btn" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setDebugOpen((v) => !v)}>
              {debugOpen ? 'Ẩn' : 'Debug: xem prompt vừa gửi'}
            </button>
            {debugOpen && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lastPromptDebug.systemMessages.map((m, i) => (
                  <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
                      system message #{i + 1} ({m.content.length} ký tự)
                    </div>
                    <pre
                      style={{
                        fontSize: 11,
                        color: 'var(--text-mid)',
                        whiteSpace: 'pre-wrap',
                        maxHeight: 220,
                        overflowY: 'auto',
                        fontFamily: 'var(--font-mono)',
                        margin: 0,
                      }}
                    >
                      {m.content || '(rỗng)'}
                    </pre>
                  </div>
                ))}
                {lastPromptDebug.assistantPrefill && (
                  <div style={{ border: '1px solid var(--mint-dim)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--mint)', marginBottom: 6 }}>
                      assistant prefill (mồi câu trả lời)
                    </div>
                    <pre
                      style={{
                        fontSize: 11,
                        color: 'var(--text-mid)',
                        whiteSpace: 'pre-wrap',
                        maxHeight: 150,
                        overflowY: 'auto',
                        fontFamily: 'var(--font-mono)',
                        margin: 0,
                      }}
                    >
                      {lastPromptDebug.assistantPrefill}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Đợt 64: cảnh báo khi bộ nhớ trình duyệt đã đầy — truyện KHÔNG còn
            được lưu, F5 là mất. Trước đây lỗi bị nuốt im lặng. */}
        {storageFull && (
          <div className="status-pill status-pill--error" style={{ marginTop: 12, display: 'block', lineHeight: 1.6 }}>
            ⚠ Bộ nhớ trình duyệt vẫn đầy sau khi app đã tự dọn cache và rút gọn dữ liệu debug — phần mới hiện chưa được lưu.
            Hãy xuất một ô save ra file rồi xoá ô save cũ, hoặc bỏ ảnh đại diện dung lượng lớn để lấy thêm chỗ.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onContextMenu={(e) => {
              // Nếu đang bôi đen chữ trong ô, để trình duyệt lo (copy/paste).
              const ta = e.currentTarget
              if (ta.selectionStart !== ta.selectionEnd) return
              e.preventDefault()
              const MENU_W = 220, MENU_H = 140
              setInputMenu({
                x: Math.max(8, Math.min(e.clientX, window.innerWidth - MENU_W - 8)),
                y: Math.max(8, Math.min(e.clientY, window.innerHeight - MENU_H - 8)),
              })
            }}
            placeholder={chatPreferences?.enterBehavior === 'newline'
              ? 'Bạn làm gì / nói gì tiếp theo? (Enter xuống dòng · Ctrl/⌘+Enter gửi)'
              : 'Bạn làm gì / nói gì tiếp theo? (Enter gửi · Shift+Enter xuống dòng)'}
            style={{
              flex: 1,
              minHeight: 44,
              maxHeight: 120,
              background: 'var(--bg-deep)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              color: 'var(--text-hi)',
              padding: '10px 12px',
              fontFamily: 'var(--font-body)',
              fontSize: 13.5,
            }}
          />
          <button className="btn btn--primary" onClick={handleSend} disabled={loading}>
            Gửi
          </button>
        </div>
      </div>

      {shopMsgIndex !== null && messages[shopMsgIndex] && (
        <ShopModal
          shop={messages[shopMsgIndex].shop ?? { name: messages[shopMsgIndex].shopName, type: '', size: '' }}
          shopName={messages[shopMsgIndex].shopName}
          money={Number(playerProfile.money)}
          onFinish={handleShopFinish}
          onClose={() => setShopMsgIndex(null)}
        />
      )}

      {pokecenterMsg !== null && (
        <PokecenterModal
          centerName={messages[pokecenterMsg.index]?.pokecenter}
          initialTab={pokecenterMsg.tab}
          onClose={() => setPokecenterMsg(null)}
          onFinish={handlePokecenterFinish}
        />
      )}

      {battleOpen
        && messages[activeBattleMsgIndex]?.battleMode !== 'double'
        && enemyMon
        && isSafariArea(playerLocation) && (
        <SafariModal
          onClose={() => setBattleOpen(false)}
          onSafariEnd={handleBattleEnd}
        />
      )}

      {battleOpen && messages[activeBattleMsgIndex]?.battleMode === 'double' && (
        <DoubleBattleModal
          initialEnemies={messages[activeBattleMsgIndex]?.enemySnapshots
            ?? [messages[activeBattleMsgIndex]?.enemySnapshot ?? enemyMon].filter(Boolean)}
          initialBattleState={messages[activeBattleMsgIndex]?.doubleBattleRuntime ?? null}
          environment={envFromWeather(getWeather(storyDate, playerLocation).label)}
          onSnapshot={(snapshots) => {
            const idx = activeBattleMsgIndex
            if (idx === null) return
            setMessages((msgs) => msgs.map((mm, i) => i === idx ? {
              ...mm, enemySnapshots: snapshots, enemySnapshot: snapshots[0],
            } : mm))
            if (snapshots[0]) setEnemyMon(snapshots[0])
          }}
          onClose={(runtime) => {
            // Đấu đôi phải giữ toàn bộ runtime: hai đội, ô đang đứng, bậc chỉ
            // số, log và thời tiết; không chỉ HP của hai đối thủ.
            const idx = activeBattleMsgIndex
            if (idx !== null) {
              const snapshots = runtime?.enemies ?? []
              setMessages((msgs) => msgs.map((mm, i) => i === idx ? {
                ...mm, enemySnapshots: snapshots, enemySnapshot: snapshots[0],
                doubleBattleRuntime: runtime,
              } : mm))
              if (snapshots[0]) setEnemyMon(snapshots[0])
            }
            setBattleOpen(false)
          }}
          onBattleEnd={handleBattleEnd}
        />
      )}

      {battleOpen
        && messages[activeBattleMsgIndex]?.battleMode !== 'double'
        && !isSafariArea(playerLocation) && (
        <BattleModal
          devUnlockGimmicks={adminMode}
          // Đợt 71: Pokémon của huấn luyện viên khác thì KHÔNG bắt được,
          // KHÔNG chạy trốn được, KHÔNG dụ đi theo được.
          isWild={!enemyMon?.isTrainerMon}
          initialEnemyTeam={messages[activeBattleMsgIndex]?.enemySnapshots
            ?? [messages[activeBattleMsgIndex]?.enemySnapshot ?? enemyMon].filter(Boolean)}
          initialBattleState={messages[activeBattleMsgIndex]?.battleRuntime ?? null}
          environment={envFromWeather(getWeather(storyDate, playerLocation).label)}
          onClose={(runtime) => {
            // Bấm "Ẩn": lưu lại đúng trạng thái đối thủ hiện tại (HP, trạng
            // thái bỏng/tê liệt/ngủ...) vào snapshot của message đang mở, để
            // lần mở lại — kể cả sau khi đã mở 1 quả pokeball khác — vẫn tiếp
            // tục ĐÚNG con cũ với đúng máu/trạng thái.
            const idx = activeBattleMsgIndex
            if (idx !== null) {
              const snap = runtime?.enemy ?? enemyMon
              const remainingTeam = runtime
                ? [runtime.enemy, ...(runtime.enemyReserves ?? [])].filter(Boolean)
                : [snap].filter(Boolean)
              setMessages((msgs) =>
                msgs.map((mm, i) => (i === idx ? { ...mm, enemySnapshot: snap, enemySnapshots: remainingTeam, battleRuntime: runtime } : mm)),
              )
              if (snap) setEnemyMon(snap)
            }
            setBattleOpen(false)
          }}
          onBattleEnd={handleBattleEnd}
        />
      )}
    </div>
  )
}
