import React, { useState, useRef, useEffect } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { chatCompletion, polishProse } from '../services/aiClient.js'
import { extractMissingStateTags } from '../services/stateExtractor.js'
import { generateActionChoices } from '../services/actionChoiceGenerator.js'
import { importCharacterCard } from '../utils/characterCardImport.js'
import { BATTLE_MARKER } from '../utils/promptBuilder.js'
import { buildScanText } from '../utils/lorebook.js'
import { buildMainApiMessages } from '../utils/buildMainMessages.js'
import { buildToneNote } from '../data/storyTones.js'
import { buildCharacterTraitsNote } from '../data/characterTraits.js'
import {
  applyPerksToMon, trainingExpMultiplier, battleExpMultiplier,
  sharesBattleExpWithParty, syncTraitGrantedItems,
} from '../data/playerPerks.js'
import { cleanAiOutput, extractThinking, truncateAfterInteractiveMarker } from '../utils/outputCleanup.js'
import { extractActionChoices } from '../utils/actionChoices.js'
import { normalizeMonTarget, monIdentityMatches, resolveOwnedMonTarget, resolveOwnedSpeciesTarget } from '../utils/ownedMonTarget.js'
import { storyClaimsEvolution, inferEvolutionDirectives, findEvolutionSpeciesEntry } from '../utils/evolutionProtocol.js'
import { buildMonSmart, detectMentionedSpecies, detectMentionedSpeciesList, applyEvGain, applyExpGain, expGainFrom, expFromDays, expFromTraining, buildPartyBehaviorNote, isSameMon, raiseMonToLevel, applyLevelDirective, evolveOwnedMon, isDirectEvolution } from '../data/pokemonSpecies.js'
import { detectMentionedArea, randomWildLevel } from '../data/regions.js'
import { wildLevel, receivedMonLevel, trainerBattleLevel } from '../data/levelLogic.js'
import { detectTrainerBattle, detectDoubleBattle, detectPokecenter, detectInteractiveShop, inferInteractiveShop } from '../data/storyScenes.js'
import { resolveItemByName } from '../data/shopItems.js'
import { isHoldableItem, normalizeHeldItem, resolveHeldItemByName } from '../data/pokemonHeldItems.js'
import ShopModal from './ShopModal.jsx'
import PokecenterModal from './PokecenterModal.jsx'
import { parseStoryStateTags, applyStoryState } from '../utils/storyStateProtocol.js'
import { validateStateAgainstProse, describeRejectedState, proseSupportsMove } from '../utils/stateEvidence.js'
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
import { upsertNpc, addFact, findRelevantNotes, buildNotebookNote } from '../utils/storyNotebook.js'
import { maybeUpdateSummary, buildSummaryNote, trimSummaryCoverage, clearSummary } from '../utils/storySummary.js'
import { maybeMakeNudge, getIdentity } from '../data/storyDirector.js'
import { getRegion, getArea } from '../data/regions.js'
import { normalizeMapLocation } from '../data/mapPins.js'
import { getWeather } from '../data/weather.js'
import { envFromWeather } from '../data/battleEnvironments.js'
import { buildFestivalLine } from '../data/festivals.js'
import { buildCanonNote } from '../services/wikiLookup.js'

// Cửa sổ tin gần nhất gửi cho model khi TRÍ NHỚ DÀI HẠN đang bật (đợt 29):
// phần cũ hơn không gửi nguyên văn nữa mà được thay bằng các "ký ức" truy
// hồi qua embedding (+rerank). Chưa cấu hình embedding → gửi full như cũ.
const MEMORY_RECENT_WINDOW = 24

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
function filterSupplementalDuplicates(extra, applied) {
  const monKey = (value) => normalizeMonTarget(value)
  const itemKey = (value) => resolveItemByName(value)?.id ?? monKey(value)
  const appliedLevelTargets = new Set((applied?.levels ?? []).map((entry) => monKey(entry.target)))
  const appliedEvolutionTargets = new Set((applied?.evolutions ?? []).flatMap((entry) => [monKey(entry.from), monKey(entry.to)]))
  const appliedItems = new Set((applied?.items ?? []).map((entry) => itemKey(entry.name)))
  const appliedFriends = new Set((applied?.friendships ?? []).map((entry) => monKey(entry.target)))
  const appliedEquipment = new Set((applied?.equipment ?? []).map((entry) => `${monKey(entry.target)}|${itemKey(entry.item ?? 'none')}|${entry.mode}`))
  const appliedPokemon = new Set((applied?.pokemons ?? []).map((entry) => monKey(entry.species)))
  const appliedRel = new Set((applied?.rel ?? []).map((entry) => monKey(entry.name)))
  const appliedBody = new Set((applied?.body ?? []).map((entry) => entry.part))
  const appliedHunger = new Set((applied?.hunger ?? []).map((entry) => entry.who))
  const appliedNpc = new Set((applied?.npcs ?? []).map((entry) => monKey(entry.name)))
  const appliedFact = new Set((applied?.facts ?? []).map((entry) => monKey(entry.key)))
  const appliedMoneyEntries = applied?.moneyEntries?.length
    ? applied.moneyEntries.map(Number)
    : applied?.money ? [Number(applied.money)] : []
  const extraMoneyEntries = extra?.moneyEntries?.length
    ? extra.moneyEntries.map(Number)
    : extra?.money ? [Number(extra.money)] : []
  const filteredMoneyEntries = extraMoneyEntries.filter((value) =>
    !appliedMoneyEntries.includes(value)
    && !(extraMoneyEntries.length === 1 && Number(applied?.money) === value),
  )
  return {
    ...extra,
    moneyEntries: filteredMoneyEntries,
    money: filteredMoneyEntries.reduce((sum, value) => sum + value, 0),
    levels: (extra?.levels ?? []).filter((entry) => !appliedLevelTargets.has(monKey(entry.target))),
    evolutions: (extra?.evolutions ?? []).filter((entry) =>
      !appliedEvolutionTargets.has(monKey(entry.from)) && !appliedEvolutionTargets.has(monKey(entry.to)),
    ),
    items: (extra?.items ?? []).filter((entry) => !appliedItems.has(itemKey(entry.name))),
    friendships: (extra?.friendships ?? []).filter((entry) => !appliedFriends.has(monKey(entry.target))),
    equipment: (extra?.equipment ?? []).filter((entry) => !appliedEquipment.has(`${monKey(entry.target)}|${itemKey(entry.item ?? 'none')}|${entry.mode}`)),
    pokemons: (extra?.pokemons ?? []).filter((entry) => !appliedPokemon.has(monKey(entry.species))),
    rel: (extra?.rel ?? []).filter((entry) => !appliedRel.has(monKey(entry.name))),
    body: (extra?.body ?? []).filter((entry) => !appliedBody.has(entry.part)),
    hunger: (extra?.hunger ?? []).filter((entry) => !appliedHunger.has(entry.who)),
    moveDirectives: (applied?.moveDirectives ?? []).length ? [] : (extra?.moveDirectives ?? []),
    moves: (applied?.moveDirectives ?? []).length ? [] : (extra?.moves ?? []),
    dateAdvance: applied?.dateAdvance ? 0 : (extra?.dateAdvance ?? 0),
    datePart: applied?.datePart ? null : (extra?.datePart ?? null),
    training: applied?.training ? 0 : (extra?.training ?? 0),
    npcs: (extra?.npcs ?? []).filter((entry) => !appliedNpc.has(monKey(entry.name))),
    facts: (extra?.facts ?? []).filter((entry) => !appliedFact.has(monKey(entry.key))),
    shops: (applied?.shops ?? []).length ? [] : (extra?.shops ?? []),
    pokecenter: applied?.pokecenter ? null : (extra?.pokecenter ?? null),
  }
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
  if (parsed.money) out.push(`💰 Tiền ${parsed.money > 0 ? '+' : ''}${parsed.money}${tag}`)
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
    for (const ev of parsed.evolutions ?? []) out.push(`✨ Yêu cầu tiến hoá: ${ev.from} → ${ev.to}${tag}`)
    for (const lv of parsed.levels ?? []) {
      const value = lv.mode === 'delta' ? `${lv.value > 0 ? '+' : ''}${lv.value}` : `Lv.${lv.value}`
      out.push(`⬆ Yêu cầu đổi cấp ${lv.target}: ${value}${tag}`)
    }
    for (const it of parsed.items ?? []) {
      const known = resolveItemByName(it.name)
      out.push(known
        ? `🎒 ${it.qty > 0 ? 'Yêu cầu nhận' : 'Yêu cầu mất'}: ${known.name} x${Math.abs(it.qty)}${tag}`
        : `⚠ Không có món "${it.name}" trong danh mục${tag}`)
    }
    for (const friend of parsed.friendships ?? []) {
      out.push(`💗 Yêu cầu đổi thân mật ${friend.target}: ${friend.delta > 0 ? '+' : ''}${friend.delta}${friend.note ? ` (${friend.note})` : ''}${tag}`)
    }
  }
  for (const n of parsed.npcs ?? []) out.push(`👤 Sổ tay NPC: ${n.name}${tag}`)
  for (const f of parsed.facts ?? []) out.push(`📌 Fact [${f.key}]: ${f.text.length > 90 ? f.text.slice(0, 90) + '…' : f.text}${tag}`)
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
    party,
    setParty, setPcBox, storyTone, storageFull, playerTraits,
    hunger,
    adjustHunger,
    stateApiConfig,
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
  } = useGame()
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
  const latestInventoryRef = useRef(inventory)
  const latestPlayerLocationRef = useRef(playerLocation)
  // API phụ chạy trễ phải kiểm tra tin gốc vẫn còn và chưa bị sửa/reroll.
  // Nếu không, nó có thể áp biến từ một nhánh truyện người chơi đã xoá.
  const latestMessagesRef = useRef(messages)
  // Đợt 77: khi không có slot API cập nhật biến riêng, luân phiên API phụ 1/2
  // đang rảnh thay vì dồn mọi lượt vào API chính. Mỗi lượt chỉ gọi MỘT API.
  const stateApiRoundRobinRef = useRef(0)
  const actionChoiceApiRoundRobinRef = useRef(0)
  useEffect(() => { latestPlayerMonRef.current = playerMon }, [playerMon])
  useEffect(() => { latestPartyRef.current = party }, [party])
  useEffect(() => { latestInventoryRef.current = inventory }, [inventory])
  useEffect(() => { latestPlayerLocationRef.current = playerLocation }, [playerLocation])
  useEffect(() => { latestMessagesRef.current = messages }, [messages])

  // Dọn ký ức + tóm tắt cho các tin bị xoá (đợt 61). idxs = mảng index bị xoá.
  // Xoá sạch mọi lớp trí nhớ (đợt 61) — dùng cho "Xoá toàn bộ lịch sử".
  function wipeAllMemory() {
    resetChat()
    closeIndexBoundUi()
    try { clearMemory() } catch { /* ignore */ }
    try { clearSummary() } catch { /* ignore */ }
  }

  function cleanupMemoryFor(idxs, newCount) {
    if (idxs.length) {
      const lo = Math.min(...idxs)
      const hi = Math.max(...idxs)
      // Ký ức được gắn theo turn = index tin AI lúc ghi (rememberExchange).
      forgetMemoriesInTurnRange(lo, hi)
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

  function handleDeleteMessage(i) {
    const m = messages[i]
    if (!m) return
    // Xoá INPUT người chơi → xoá LUÔN tin AI trả lời ngay sau (đợt 61: theo
    // yêu cầu "xóa input thì tự động xóa luôn output của input đó").
    const idxs = [i]
    if (m.role === 'user' && messages[i + 1]?.role === 'assistant') idxs.push(i + 1)
    const isPair = idxs.length > 1
    if (!window.confirm(
      isPair
        ? 'Xoá lượt này (tin của bạn + phần AI trả lời)? Ký ức và phần tóm tắt liên quan cũng được dọn theo. Không hoàn tác được — biến đã áp KHÔNG bị hoàn lại.'
        : 'Xoá tin nhắn này khỏi truyện? Ký ức/tóm tắt liên quan cũng được dọn. Không hoàn tác được — biến đã áp KHÔNG bị hoàn lại.',
    )) return
    setMessages((msgs) => {
      const next = msgs.filter((_, idx) => !idxs.includes(idx))
      cleanupMemoryFor(idxs, next.length)
      return next
    })
    closeIndexBoundUi()
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

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
  function applyParsedState(parsed, turnNow, storyText = '') {
    const report = { lines: [] }
    let previewActive = latestPlayerMonRef.current
    let previewParty = [...(latestPartyRef.current ?? [])]

    function replacePreviewMon(identity, transform) {
      if (previewActive && monIdentityMatches(previewActive, identity)) previewActive = transform(previewActive)
      previewParty = previewParty.map((mon) => (monIdentityMatches(mon, identity) ? transform(mon) : mon))
    }

    try {
      const findSpeciesEntry = (value) => findEvolutionSpeciesEntry(pokedexSpecies, value)
      const evolvedTargets = new Set()

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
        replacePreviewMon(identity, transform)
        evolvedTargets.add(normalizeMonTarget(targetEntry.name))
        report.lines.push(`✅ Tiến hoá: ${fromName} → ${targetEntry.name} · Lv.${targetMon.level ?? 1}${source === 'inferred' ? ' (app xác nhận từ chính văn)' : ''}`)
      }

      // LEVEL chạy TRƯỚC EVOLVE. Một lượt tiến hoá do lên cấp thường có cả
      // [[LEVEL Fletchling | +1]] và [[EVOLVE Fletchling | Fletchinder]];
      // nếu đổi tên trước thì tag LEVEL tên cũ sẽ mất target.
      for (const directive of parsed.levels ?? []) {
        let targetMon = resolveOwnedMonTarget(directive.target, previewActive, previewParty)
        // Model đôi khi gọi luôn TÊN SAU TIẾN HOÁ trong LEVEL dù cá thể trong
        // state vẫn đang mang tên cũ ở thời điểm áp. Nếu cùng lượt có EVOLVE
        // A→B, chuyển target B về đúng cá thể A rồi mới nâng cấp.
        if (!targetMon) {
          const linkedEvolution = (parsed.evolutions ?? []).find((ev) =>
            normalizeMonTarget(ev.to) === normalizeMonTarget(directive.target),
          )
          if (linkedEvolution) {
            targetMon = resolveOwnedMonTarget(linkedEvolution.from, previewActive, previewParty)
          }
        }
        if (!targetMon) {
          report.lines.push(`⚠ Không áp cấp “${directive.target}”: không tìm thấy Pokémon tương ứng trong đội`)
          continue
        }
        const before = targetMon.level ?? 1
        const previewAfter = applyLevelDirective(targetMon, directive, movesDb)
        const after = previewAfter?.level ?? before
        if (after <= before) {
          report.lines.push(`ℹ ${targetMon.name} đang Lv.${before} — chỉ dẫn này không làm thay đổi biến`)
          continue
        }
        const identity = { uid: targetMon.uid, name: targetMon.name }
        const apply = (mon) => applyLevelDirective(mon, directive, movesDb)
        setPlayerMon((cur) => (monIdentityMatches(cur, identity) ? apply(cur) : cur))
        setParty((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? apply(mon) : mon)))
        replacePreviewMon(identity, apply)
        report.lines.push(`✅ ${targetMon.name}: Lv.${before} → Lv.${after}`)
      }

      for (const evolution of parsed.evolutions ?? []) {
        const targetMon = resolveOwnedMonTarget(evolution.from, previewActive, previewParty)
        if (!targetMon) {
          report.lines.push(`⚠ Không tiến hoá “${evolution.from}”: không tìm thấy cá thể tương ứng trong đội`)
          continue
        }
        const fromEntry = findSpeciesEntry(targetMon.species ?? targetMon.name)
        const targetEntry = findSpeciesEntry(evolution.to)
        if (!targetEntry) {
          report.lines.push(`⚠ Không tiến hoá ${targetMon.name}: không tìm thấy loài “${evolution.to}” trong Pokédex`)
          continue
        }
        const relationKnown = Boolean(targetEntry.prevo || (fromEntry?.evos ?? []).length)
        if (relationKnown && !isDirectEvolution(fromEntry, targetEntry)) {
          report.lines.push(`⚠ Không tiến hoá ${targetMon.name} → ${targetEntry.name}: không phải nhánh tiến hoá trực tiếp`)
          continue
        }
        if (normalizeMonTarget(targetMon.species ?? targetMon.name) === normalizeMonTarget(targetEntry.species ?? targetEntry.name)) {
          report.lines.push(`ℹ ${targetMon.name} đã ở đúng dạng ${targetEntry.name} — không đổi biến`)
          continue
        }
        evolveOne(targetMon, targetEntry, evolution.inferred ? 'inferred' : 'tag')
      }

      for (const pk of parsed.pokemons ?? []) {
        const entry = findSpeciesEntry(pk.species)
        if (!entry) {
          console.warn('[pokemon-tag] Không tìm thấy loài trong pokedex:', pk.species)
          report.lines.push(`⚠ Không áp Pokémon “${pk.species}”: không tìm thấy loài trong Pokédex`)
          continue
        }

        // Tương thích model cũ 1: POKEMON trùng loài đang có = yêu cầu nâng
        // cấp. Nếu vừa EVOLVE sang đúng loài này trong cùng lượt thì bỏ tag
        // POKEMON dư, không tạo thêm dòng DNA gây hiểu nhầm.
        const existing = resolveOwnedSpeciesTarget(pk.species, previewActive, previewParty)
        if (existing) {
          const before = existing.level ?? 1
          const after = Math.max(before, Math.min(100, Number(pk.level) || before))
          if (after <= before) {
            if (!evolvedTargets.has(normalizeMonTarget(entry.name))) {
              report.lines.push(`ℹ ${existing.name} đang Lv.${before} — tag Lv.${pk.level} không làm thay đổi biến`)
            }
            continue
          }
          const identity = { uid: existing.uid, name: existing.name }
          const raise = (mon) => raiseMonToLevel(mon, after, movesDb)
          setPlayerMon((cur) => (monIdentityMatches(cur, identity) ? raise(cur) : cur))
          setParty((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? raise(mon) : mon)))
          replacePreviewMon(identity, raise)
          report.lines.push(`✅ ${existing.name}: Lv.${before} → Lv.${after}`)
          continue
        }

        // Tương thích model cũ 2: model kể Fletchling tiến hoá nhưng vẫn dùng
        // [[POKEMON Fletchinder | Lv19]]. Nếu Pokédex xác nhận quan hệ trực
        // tiếp VÀ chính văn khẳng định tiến hoá đã xảy ra, thay đúng cá thể
        // cũ thay vì thêm “con chim cấp 2” thứ hai.
        const owned = []
        for (const mon of [previewActive, ...previewParty]) {
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
            const identity = { uid: prevo.uid, name: prevo.name }
            const raise = (mon) => raiseMonToLevel(mon, requestedLevel, movesDb)
            setPlayerMon((cur) => (monIdentityMatches(cur, identity) ? raise(cur) : cur))
            setParty((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? raise(mon) : mon)))
            replacePreviewMon(identity, raise)
            current = raise(prevo)
            report.lines.push(`✅ ${prevo.name}: Lv.${beforeLevel} → Lv.${requestedLevel}`)
          }
          evolveOne(current, entry, 'inferred')
          continue
        }

        const saneLv = receivedMonLevel({ entry, requestedLevel: pk.level, location: playerLocation })
        const newMon = applyPerksToMon(buildMonSmart(entry, saneLv, movesDb), playerTraits)
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
          report.lines.push(`✅ Nhận Pokémon: ${newMon.name} Lv.${newMon.level} · đội đầy, đã gửi vào PC`)
        }
      }

      for (const directive of parsed.friendships ?? []) {
        const targetMon = resolveOwnedMonTarget(directive.target, previewActive, previewParty)
        if (!targetMon) {
          report.lines.push(`⚠ Không áp thân mật “${directive.target}”: không tìm thấy Pokémon tương ứng trong đội`)
          continue
        }
        const before = Number.isFinite(targetMon.friendship) ? targetMon.friendship : 70
        const identity = { uid: targetMon.uid, name: targetMon.name }
        const apply = (mon) => adjustFriendship(mon, directive.delta)
        const after = apply(targetMon).friendship
        setPlayerMon((cur) => (monIdentityMatches(cur, identity) ? apply(cur) : cur))
        setParty((cur) => (cur ?? []).map((mon) => (monIdentityMatches(mon, identity) ? apply(mon) : mon)))
        replacePreviewMon(identity, apply)
        report.lines.push(`✅ Thân mật ${targetMon.name}: ${before} → ${after}${directive.note ? ` (${directive.note})` : ''}`)
      }

      // Cập nhật ref lạc quan để API phụ chạy ngay sau đó nhìn thấy đúng bản
      // vừa áp, không dùng lại snapshot cũ rồi báo DNA lệch lần nữa.
      latestPlayerMonRef.current = previewActive
      latestPartyRef.current = previewParty
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
        const entry = resolveHeldItemByName(directive.item) ?? resolveItemByName(directive.item)
        if (entry && isHoldableItem(entry)) equipDebits.set(entry.id, (equipDebits.get(entry.id) ?? 0) + 1)
      }
      const itemChanges = (parsed.items ?? []).map((raw) => {
        const entry = resolveItemByName(raw.name)
        let qty = raw.qty
        let absorbedByEquip = 0
        if (entry && qty < 0) {
          const pending = equipDebits.get(entry.id) ?? 0
          absorbedByEquip = Math.min(Math.abs(qty), pending)
          if (absorbedByEquip > 0) {
            qty += absorbedByEquip
            equipDebits.set(entry.id, pending - absorbedByEquip)
          }
        }
        return { entry, qty, raw, absorbedByEquip }
      })
      let previewInventory = [...(latestInventoryRef.current ?? [])]

      for (const { entry, qty, raw, absorbedByEquip } of itemChanges) {
        if (!entry) {
          report.lines.push(`⚠ Không áp vật phẩm “${raw.name}”: không có trong danh mục`)
          continue
        }
        if (absorbedByEquip > 0) {
          report.lines.push(`ℹ ${entry.name} x${absorbedByEquip} sẽ được trừ bởi lệnh trang bị, không trừ lặp bằng ITEM`)
        }
        if (qty === 0) continue
        const at = previewInventory.findIndex((it) => it.id === entry.id)
        if (qty > 0) {
          if (at === -1) previewInventory.push({ id: entry.id, name: entry.name, qty })
          else previewInventory[at] = { ...previewInventory[at], qty: (previewInventory[at].qty ?? 0) + qty }
          report.lines.push(`✅ Nhận vật phẩm: ${entry.name} x${qty}`)
        } else if (at === -1) {
          report.lines.push(`⚠ Không thể trừ ${entry.name}: trong túi không có vật phẩm này`)
        } else if (previewInventory[at].infinite) {
          report.lines.push(`ℹ ${entry.name} là vật phẩm vô hạn — không bị trừ`)
        } else {
          const have = Math.max(0, Number(previewInventory[at].qty) || 0)
          const removed = Math.min(have, Math.abs(qty))
          const left = have - removed
          if (left > 0) previewInventory[at] = { ...previewInventory[at], qty: left }
          else previewInventory.splice(at, 1)
          report.lines.push(`✅ Mất vật phẩm: ${entry.name} x${removed}`)
        }
      }

      const validItemChanges = itemChanges.filter((x) => x.entry && (x.qty !== 0 || x.absorbedByEquip > 0))
      let equipmentChanged = false

      const addPreviewItem = (entry) => {
        const at = previewInventory.findIndex((it) => it.id === entry.id)
        if (at >= 0) previewInventory[at] = { ...previewInventory[at], qty: (previewInventory[at].qty ?? 1) + 1 }
        else previewInventory.push({ id: entry.id, name: entry.name, qty: 1 })
      }

      // Trang bị được áp SAU [[ITEM]] để một lượt “nhận rồi đeo” hoạt động
      // đúng. Toàn bộ túi + đội được tính trước rồi set một lần, tránh updater
      // bất đồng bộ làm nhân đôi vật phẩm hoặc đeo xong nhưng túi không trừ.
      for (const directive of parsed.equipment ?? []) {
        const targetMon = resolveOwnedMonTarget(directive.target, previewActive, previewParty)
        if (!targetMon) {
          report.lines.push(`⚠ Không áp trang bị “${directive.target}”: không tìm thấy Pokémon tương ứng trong đội`)
          continue
        }
        const identity = { uid: targetMon.uid, name: targetMon.name }
        const oldItem = resolveHeldItemByName(targetMon.heldItem)

        if (directive.mode === 'unequip') {
          if (!oldItem) {
            report.lines.push(`ℹ ${targetMon.name} hiện không cầm trang bị nào`)
            continue
          }
          if (!targetMon.heldItem?.fromInfinite) addPreviewItem(oldItem)
          replacePreviewMon(identity, (mon) => ({ ...mon, heldItem: null }))
          equipmentChanged = true
          report.lines.push(targetMon.heldItem?.fromInfinite
            ? `✅ Tháo trang bị: ${targetMon.name} bỏ ${oldItem.name}; bản vô hạn vẫn ở trong túi`
            : `✅ Tháo trang bị: ${targetMon.name} → ${oldItem.name} được cất lại vào túi`)
          continue
        }

        const entry = resolveHeldItemByName(directive.item) ?? resolveItemByName(directive.item)
        if (!entry || !isHoldableItem(entry)) {
          report.lines.push(`⚠ Không áp trang bị “${directive.item}”: đây không phải held item hợp lệ của Pokémon`)
          continue
        }
        if (oldItem?.id === entry.id) {
          report.lines.push(`ℹ ${targetMon.name} đã cầm ${entry.name}`)
          continue
        }
        const at = previewInventory.findIndex((it) => it.id === entry.id)
        if (at < 0 || (!previewInventory[at].infinite && (previewInventory[at].qty ?? 0) <= 0)) {
          report.lines.push(`⚠ Không thể cho ${targetMon.name} cầm ${entry.name}: vật phẩm không có trong túi`)
          continue
        }
        const fromInfinite = Boolean(previewInventory[at].infinite)
        if (!fromInfinite) {
          const left = (previewInventory[at].qty ?? 1) - 1
          if (left > 0) previewInventory[at] = { ...previewInventory[at], qty: left }
          else previewInventory.splice(at, 1)
        }
        if (oldItem && !targetMon.heldItem?.fromInfinite) addPreviewItem(oldItem)
        const heldItem = normalizeHeldItem({ ...entry, fromInfinite })
        replacePreviewMon(identity, (mon) => ({ ...mon, heldItem }))
        equipmentChanged = true
        report.lines.push(`✅ Trang bị: ${targetMon.name} cầm ${entry.name}${oldItem && !targetMon.heldItem?.fromInfinite ? ` · ${oldItem.name} được cất lại` : ''}`)
      }

      if (validItemChanges.length > 0 || equipmentChanged) {
        const finalInventory = syncTraitGrantedItems(previewInventory, playerTraits)
        setInventory(finalInventory)
        setParty(previewParty)
        setPlayerMon(previewActive)
        latestInventoryRef.current = finalInventory
        latestPartyRef.current = previewParty
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
        previewActive = previewActive ? grow(previewActive) : previewActive
        previewParty = previewParty.map((pm) => grow(pm))
        latestPlayerMonRef.current = previewActive
        latestPartyRef.current = previewParty
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

    return report
  }

  async function callAI(nextMessages, scanExtra = '', configOverride = null) {
    setError(null)
    setLoading(true)
    try {
      const scanText = buildScanText(nextMessages, scanExtra)
      const usingMainApi = !configOverride
      let history = nextMessages.map((m) => ({ role: m.role, content: m.content }))

      // --- TRÍ NHỚ DÀI HẠN (đợt 29) ---
      // Embedding đã cấu hình + truyện đã dài hơn cửa sổ → cắt lịch sử về
      // MEMORY_RECENT_WINDOW tin gần nhất, truy hồi ký ức CŨ liên quan tới
      // lời người chơi vừa nói và chèn vào đầu cửa sổ dưới dạng note hệ
      // thống. Mọi lỗi ở bước này chỉ log — degrade về cắt cửa sổ (hoặc nếu
      // truy vấn được thì có note), KHÔNG được chặn truyện.
      const embCfg = memoryApiConfig?.embedding
      const memoryActive = Boolean(embCfg?.baseUrl && embCfg?.model)
      if (memoryActive && nextMessages.length > MEMORY_RECENT_WINDOW + 4) {
        const cutoff = nextMessages.length - MEMORY_RECENT_WINDOW
        const lastUserMsg = [...nextMessages].reverse().find((m) => m.role === 'user')
        let memoryNote = null
        try {
          const memories = await recallRelevant({
            embeddingConfig: embCfg,
            rerankConfig: memoryApiConfig?.rerank,
            queryText: lastUserMsg?.content ?? '',
            maxTurn: cutoff,
          })
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
      if (currentMapLocation?.regionKey) {
        const regionInfo = getRegion(currentMapLocation.regionKey)
        const areaInfo = getArea(currentMapLocation.regionKey, currentMapLocation.areaKey)
        const coordText = Number.isFinite(currentMapLocation.x) && Number.isFinite(currentMapLocation.y)
          ? `; toạ độ bản đồ X=${currentMapLocation.x}, Y=${currentMapLocation.y} (thang 0-100)`
          : ''
        history = [...history, {
          role: 'user',
          content: `[Hệ thống — VỊ TRÍ HIỆN TẠI: ${areaInfo?.name ?? currentMapLocation.areaKey ?? 'chưa rõ'}, vùng ${regionInfo?.name ?? currentMapLocation.regionKey}${coordText}. Không tự coi nhân vật đã sang nơi khác nếu chính văn chưa có di chuyển. Khi thực sự đổi vị trí, dùng [[MOVE Tên nơi | x=N | y=N]] nếu biết toạ độ; không nhắc tới ghi chú này.]`,
        }]
      }

      // --- ĐẠO DIỄN TÌNH HUỐNG (đợt 31) ---
      // Thi thoảng (theo nhịp cooldown + xác suất) chèn 1 hạt giống tình
      // huống làm GỢI Ý một-lần ở cuối history — KHÔNG lưu vào messages nên
      // lượt sau tự biến mất, AI không bị gợi ý cũ ám mãi. Đa số lượt trả
      // null — đó mới là tự nhiên.
      // ĐỘI HÌNH + HÀNH VI THEO TÍNH CÁCH (đợt 63): Pokémon phải cư xử đúng
      // cá tính (nature) chứ không con nào cũng ngoan như nhau.
      // TÍNH CÁCH + THIÊN PHÚ (đợt 69): gửi MỌI LƯỢT, không chỉ lượt mở đầu.
      const traitsNote = buildCharacterTraitsNote(playerTraits ?? {})
      if (traitsNote) history = [...history, { role: 'user', content: `[Hệ thống — ${traitsNote} Không nhắc tới ghi chú này.]` }]

      const partyNote = buildPartyBehaviorNote(party, playerMon)
      if (partyNote) history = [...history, { role: 'user', content: partyNote }]

      // QUYỀN TỰ DO SÁNG TẠO (đợt 63): người chơi phản ánh AI bị gò bó bởi
      // input — chỉ thuật lại đúng câu lệnh, thế giới đứng im. Nhắc mỗi lượt
      // để AI chủ động dựng cảnh sống động quanh hành động của người chơi.
      history = [...history, {
        role: 'user',
        content: '[Hệ thống — QUYỀN TỰ DO SÁNG TẠO: input của người chơi là HÀNH ĐỘNG của nhân vật chính, KHÔNG phải kịch bản giới hạn. Hãy chủ động thêm chi tiết đời sống quanh hành động đó: NPC đang bận việc riêng, Pokémon xung quanh làm gì đó theo bản tính, âm thanh/mùi/thời tiết, sự cố nhỏ chen ngang, câu chuyện nghe lỏm. Thế giới TIẾP DIỄN dù người chơi làm gì. Không hỏi lại người chơi; không viết danh sách lựa chọn lẫn trong chính văn. Khối <actions> dành cho giao diện vẫn phải tạo riêng theo chỉ dẫn hệ thống. Không nhắc tới ghi chú này.]',
      }]

      const nudge = maybeMakeNudge({
        identityKey: playerIdentity,
        location: playerLocation,
        turn: nextMessages.length,
      })
      if (nudge) history = [...history, { role: 'user', content: nudge }]

      const { apiMessages, callOptions, regexScripts } = buildMainApiMessages({
        character,
        playerName,
        stylePreset,
        mainPreset: usingMainApi ? mainPreset : null,
        history,
        scanText,
        worldbook,
        canonNote,
        toneNote: buildToneNote(storyTone),
      })
      callOptions.assistantPrefill = assistantPrefill

      setLastPromptDebug({
        systemMessages: apiMessages.filter((m) => m.role === 'system'),
        assistantPrefill: assistantPrefill?.trim() || null,
      })

      const reply = await chatCompletion(configOverride || apiConfig, apiMessages, callOptions)
      // Đợt 79: preset có thể dùng <choice>, <selection> hoặc <details>. Bóc
      // từ reply GỐC trước khi outputCleanup vứt scaffold hậu kỳ.
      const replyActionChoices = extractActionChoices(reply)
      const cleaned = cleanAiOutput(reply, regexScripts)
      if (!cleaned) {
        throw new Error(
          'AI chỉ trả về phần suy nghĩ (CoT), chưa kịp viết chính văn. Thử tăng "Max tokens" của preset (mục Preset chính văn) hoặc kiểm tra lại preset ở nút Debug.',
        )
      }
      // Giao thức trạng thái: parse tag [[MONEY]]/[[REL]]/[[BODY]]/[[SHOP]]
      // do AI khai báo ở cuối tin — áp vào state thật (tiền, hảo cảm, thương
      // tích trên HUD cập nhật ngay), gỡ tag khỏi văn bản hiển thị. Tag
      // [[SHOP Tên]] gắn shopName lên message để hiện nút mở giỏ hàng.
      let stateParsed = parseStoryStateTags(cleaned)
      // Chỉ phần chính văn người chơi THỰC SỰ nhìn thấy mới được làm bằng
      // chứng. Model viết lén kết quả sau [[BATTLE]] sẽ bị cắt trước khi xét
      // tag, tránh cộng tiền/cấp/vật phẩm của một trận chưa hề diễn ra.
      const stateEvidenceText = truncateAfterInteractiveMarker(stateParsed.cleaned)
      const stateUserText = [...nextMessages].reverse().find((m2) => m2.role === 'user' && !m2.hidden)?.content ?? ''
      // Đợt 76: model có thể kể rõ “Froakie tiến hoá thành Frogadier” nhưng
      // quên EVOLVE hoặc vẫn dùng nhầm POKEMON. Chỉ suy ra khi phần văn nhìn
      // thấy xác nhận sự kiện đã xảy ra.
      stateParsed = inferEvolutionDirectives(
        stateParsed,
        stateEvidenceText,
        pokedexSpecies,
        latestPlayerMonRef.current,
        latestPartyRef.current,
      )
      const evidenceCheck = validateStateAgainstProse(stateParsed, stateEvidenceText, {
        playerName: playerName || playerProfile?.name,
        party: latestPartyRef.current,
      })
      stateParsed = evidenceCheck.parsed

      // SHOP là nút tương tác, nên tag sai không được phép tạo UI. Chỉ giữ
      // cửa hàng mà chính văn chứng minh nhân vật đã bước vào bên trong.
      const rejectedShops = []
      let validShops = (stateParsed.shops ?? []).filter((shop) => {
        const check = detectInteractiveShop(stateEvidenceText, shop.name, stateUserText)
        if (!check.inside) rejectedShops.push(shop)
        return check.inside
      })
      // Model/API phụ có thể quên SHOP dù người chơi đã gõ “đi vào siêu thị”
      // và chính văn đang mô tả quầy/kệ bên trong. App tự suy cửa hàng trong
      // đúng cảnh đã xác nhận; không bắt người chơi thử sang địa điểm khác.
      if (!validShops.length) {
        const inferredShop = inferInteractiveShop(stateEvidenceText, stateUserText)
        if (inferredShop) validShops = [inferredShop]
      }
      stateParsed = { ...stateParsed, shops: validShops }

      applyStoryState(stateParsed, {
        playerProfile, setPlayerProfile,
        relationships, setRelationships,
        bodyStatus, setBodyStatus,
      })
      // Đợt 74: áp POKEMON/LEVEL/ITEM trước khi dựng DNA và lấy báo cáo
      // thực tế. DNA không còn chỉ lặp lại tag rồi tuyên bố nhầm là đã áp.
      const turnNow = nextMessages.length
      const mainApplyReport = applyParsedState(stateParsed, turnNow, stateEvidenceText)
      for (const shop of rejectedShops) {
        mainApplyReport.lines.push(`⚠ Bỏ qua cửa hàng “${shop.name}”: chính văn chưa cho nhân vật bước vào bên trong`)
      }
      mainApplyReport.lines.push(...describeRejectedState(evidenceCheck.rejected))
      // Vị trí tính TRƯỚC khi lưu tin (đợt 48) để đưa vào meta viewer.
      // Chỉ MOVE đã qua đối chiếu chính văn mới đổi biến vị trí. Trước đây
      // metadata hoặc chỉ cần nhắc tên thành phố cũng kéo pin bản đồ đi, kể cả
      // câu “sẽ tới/định tới/chưa tới”. API phụ sẽ bổ sung MOVE khi model chính quên.
      let movedTo = resolveMoveLocation(stateParsed, latestPlayerLocationRef.current)
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
            await polishProse({ ...apiConfig, ...animeApiConfig }, displayText, buildToneNote(storyTone)),
          )
        } catch (polErr) {
          console.warn('[polish] bỏ qua chau chuốt:', polErr.message)
        }
      }
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
        changes: [
          ...describeParsedChanges(stateParsed, movedTo, '', mainApplyReport),
          ...(displayText !== stateEvidenceText ? ['✍ Văn đã qua API chau chuốt văn phong'] : []),
        ],
      }
      // API cập nhật biến chạy nền có thể trả lời sau khi người chơi đã sang
      // lượt kế tiếp. Gắn id cố định để DNA bổ sung quay đúng tin đã sinh ra nó,
      // không đính nhầm vào "tin AI cuối cùng" rồi khiến viewer khó kiểm chứng.
      const turnMessageId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setMessages((m) => [
        ...m,
        {
          id: turnMessageId,
          role: 'assistant',
          content: displayText,
          meta: turnMeta,
          actionChoices,
          actionChoicesPending,
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
        const actionPool = [outcomeApiConfig?.escaped, outcomeApiConfig?.lose, stateApiConfig]
          .filter((cfg) => cfg?.baseUrl && cfg?.model)
          .map((cfg) => ({ ...apiConfig, ...cfg }))
        const actionCfg = actionPool.length
          ? actionPool[actionChoiceApiRoundRobinRef.current % actionPool.length]
          : apiConfig
        actionChoiceApiRoundRobinRef.current += 1
        const recentContext = nextMessages
          .filter((message) => !message.hidden)
          .slice(-6)
          .map((message) => `${message.role === 'user' ? 'Người chơi' : 'AI'}: ${message.content}`)
          .join('\n\n')

        scheduleIdleStateTask(() => {
          generateActionChoices(actionCfg, {
            recentContext,
            storyText: displayText,
            userText: stateUserText,
            playerName: playerName || playerProfile?.name || '',
          })
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

      // API CẬP NHẬT BIẾN (đợt 36, tuỳ chọn): model phụ đọc lại chính văn và
      // BỔ SUNG các tag model chính quên khai (kèm danh sách tag đã áp để
      // không áp trùng). Chạy nền — lỗi chỉ warn.
      // Đợt 52 (yêu cầu beta): lớp cập nhật biến LUÔN BẬT — sổ tay keyword
      // không được phụ thuộc việc model chính có "nhớ" khai tag hay không.
      // Có API phụ riêng (model rẻ) thì dùng, không thì fallback API CHÍNH.
      const dedicatedStateCfg = stateApiConfig?.baseUrl && stateApiConfig?.model
        ? { ...apiConfig, ...stateApiConfig }
        : null
      const spareStateApis = [outcomeApiConfig?.escaped, outcomeApiConfig?.lose]
        .filter((cfg) => cfg?.baseUrl && cfg?.model)
        .map((cfg) => ({ ...apiConfig, ...cfg }))
      let stateCfg = dedicatedStateCfg
      if (!stateCfg) {
        // Có API phụ 1/2 thì chỉ luân phiên hai slot đó khi trình duyệt rảnh;
        // API chính không bị chen thêm một lượt gọi nền ngoài việc kể chuyện.
        const pool = spareStateApis.length ? spareStateApis : [apiConfig]
        stateCfg = pool[stateApiRoundRobinRef.current % pool.length]
        stateApiRoundRobinRef.current += 1
      }
      if (stateCfg?.baseUrl && stateCfg?.model) {
        scheduleIdleStateTask(() => {
          extractMissingStateTags(stateCfg, {
            storyText: stateEvidenceText,
            userText: stateUserText,
            appliedTags: {
              money: stateParsed.money, moneyEntries: stateParsed.moneyEntries, rel: stateParsed.rel, body: stateParsed.body,
              pokemons: stateParsed.pokemons, levels: stateParsed.levels,
              evolutions: stateParsed.evolutions, items: stateParsed.items, equipment: stateParsed.equipment,
              friendships: stateParsed.friendships, hunger: stateParsed.hunger,
              dateAdvance: stateParsed.dateAdvance, datePart: stateParsed.datePart,
              training: stateParsed.training, moves: stateParsed.moveDirectives,
              npcs: (stateParsed.npcs ?? []).map((n) => n.name),
              facts: (stateParsed.facts ?? []).map((f) => f.key),
            },
            hasPokemon: Boolean(latestPlayerMonRef.current) || (stateParsed.pokemons ?? []).length > 0,
          })
            .then((extraTagsText) => {
              if (!extraTagsText) return
              const sourceMessage = latestMessagesRef.current.find((message) => message.id === turnMessageId)
              // Người chơi có thể reroll/xoá/sửa tin trong lúc API phụ đang
              // chạy. Tuyệt đối không áp tag của nhánh cũ vào state hiện tại.
              if (!sourceMessage || sourceMessage.content !== displayText) {
                console.warn('[state-api] bỏ kết quả vì tin nguồn đã bị xoá hoặc sửa')
                return
              }
              let parsedExtra = filterSupplementalDuplicates(parseStoryStateTags(extraTagsText), stateParsed)
              // SHOP phải được chặn riêng giống luồng chính; chỉ “đã vào trong”.
              parsedExtra = {
                ...parsedExtra,
                shops: (parsedExtra.shops ?? []).filter((shop) => detectInteractiveShop(stateEvidenceText, shop.name, stateUserText).inside),
              }
              if (!parsedExtra.shops.length && !(stateParsed.shops ?? []).length) {
                const inferredShop = inferInteractiveShop(stateEvidenceText, stateUserText)
                if (inferredShop) parsedExtra.shops = [inferredShop]
              }
              const extraEvidence = validateStateAgainstProse(parsedExtra, stateEvidenceText, { playerName: playerName || playerProfile?.name, party: latestPartyRef.current })
              const extra = extraEvidence.parsed
              const extraApplyReport = applyParsedState(extra, turnNow, stateEvidenceText)
              extraApplyReport.lines.push(...describeRejectedState(extraEvidence.rejected))
              if (extra.money || extra.rel.length || extra.body.length) {
                applyStoryState(extra, { setPlayerProfile, setRelationships, setBodyStatus })
              }
              const extraMovedTo = resolveMoveLocation(extra, latestPlayerLocationRef.current)
              if (extraMovedTo && proseSupportsMove(stateEvidenceText, extra.moveDirectives?.at(-1)?.place)) {
                latestPlayerLocationRef.current = extraMovedTo
                setPlayerLocation(extraMovedTo)
              }
              const extraLines = describeParsedChanges(extra, extraMovedTo, '(API phụ)', extraApplyReport)
              if (extraLines.length || extra.shops?.length || extra.pokecenter) {
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
                    },
                  }
                  return msgs.map((m2, index) => (index === at ? updated : m2))
                })
              }
            })
            .catch((e2) => console.warn('[state-api] bỏ qua:', e2.message))
        })
      }
      // Tóm tắt cốt truyện (đợt 30): tự cập nhật nền khi đủ tin mới.
      maybeUpdateSummary(apiConfig, [...nextMessages, { role: 'assistant', content: stateEvidenceText }]).catch(
        (sumErr) => console.warn('[summary] cập nhật tóm tắt lỗi (bỏ qua):', sumErr.message),
      )
      // Ghi nhớ lượt vừa rồi vào trí nhớ dài hạn (chạy NỀN — embedding chậm
      // hay lỗi cũng không ảnh hưởng truyện). turn = độ dài mảng messages
      // tại thời điểm lượt này, dùng để loại ký ức còn trong cửa sổ gần.
      const embCfgAfter = memoryApiConfig?.embedding
      if (embCfgAfter?.baseUrl && embCfgAfter?.model) {
        const lastUser = [...nextMessages].reverse().find((m) => m.role === 'user')
        rememberExchange(embCfgAfter, lastUser?.content ?? '', stripInlineTags(stateEvidenceText), nextMessages.length).catch(
          (memErr) => console.warn('[memory] ghi ký ức lỗi (bỏ qua):', memErr.message),
        )
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // index tin AI cuối cùng (để chỉ hiện Reroll ở đó).
  const lastAiIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'assistant') return i
    return -1
  })()

  async function handleSend() {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
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
    const trimmed = messages.slice(0, lastAiIdx) // cắt bỏ tin AI cuối
    setMessages(trimmed)
    // scanExtra = nội dung tin user gần nhất (để dò battle/area như lần đầu).
    const lastUser = [...trimmed].reverse().find((m2) => m2.role === 'user')
    await callAI(trimmed, lastUser?.content ?? '')
  }

  // GỬI LẠI TỪ TIN NGƯỜI CHƠI (đợt 50): người chơi chuột phải vào TIN CỦA
  // MÌNH cũng phải reroll được (phản hồi beta: "nút reroll đâu?" — trước đó
  // reroll chỉ nằm trên tin AI). Cắt mọi tin phía sau tin người chơi này
  // (thường là 1 tin AI trả lời) rồi gọi AI viết lại từ đúng chỗ đó.
  async function handleResendFromUser(idx) {
    if (loading) return
    const m = messages[idx]
    if (!m || m.role !== 'user') return
    const trimmed = messages.slice(0, idx + 1)
    setMessages(trimmed)
    await callAI(trimmed, m.content ?? '')
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
    if (e.key === 'Enter' && !e.shiftKey) {
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
      let inv = [...inventory]
      for (const b of bought) {
        const i = inv.findIndex((x) => x.id === b.id)
        if (i >= 0) inv[i] = { ...inv[i], qty: inv[i].qty + b.qty }
        else inv.push({ id: b.id, name: b.name, qty: b.qty })
      }
      setInventory(inv)
      const list = bought.map((b) => `${b.name} x${b.qty}`).join(', ')
      const freebies = bought.filter((b) => b.price === 0).map((b) => b.name)
      noteContent = `[Hệ thống — viết tiếp CHÍNH VĂN] Tại ${shopName}, người chơi đã chọn mua: ${list}. Tổng thanh toán ₽${total.toLocaleString('vi-VN')}, tiền còn lại ₽${newMoney.toLocaleString('vi-VN')}.${freebies.length ? ` Chủ quán tặng kèm: ${freebies.join(', ')}.` : ''} Hãy kể lại cảnh MUA HÀNG bằng văn xuôi tự nhiên: nhân vật nói muốn mua gì, tương tác với người bán, trả tiền (nêu rõ nếu có giảm giá/tặng kèm), rồi tiếp diễn câu chuyện. KHÔNG liệt kê kiểu hoá đơn.`
    } else {
      noteContent = `[Hệ thống] Người chơi rời ${shopName} mà không mua gì. Hãy viết tiếp câu chuyện.`
    }

    const note = {
      role: 'user',
      hidden: true,
      resultLabel: bought.length > 0 ? `Đã mua sắm tại ${shopName}` : `Rời ${shopName}`,
      content: noteContent,
    }
    // Functional update (đợt 64): STATE phải dựng từ bản MỚI NHẤT, tránh
    // closure cũ xoá mất cập nhật chạy nền (meta biến của API phụ...).
    // LƯU Ý: React chạy hàm cập nhật ở pha render, KHÔNG đồng bộ tại đây —
    // nên không được lấy kết quả từ trong đó ra để dùng ngay. Payload gửi
    // AI dựng riêng từ closure là đủ đúng (meta không đi vào prompt).
    setMessages((cur) => [
      ...cur.map((mm, i) => (i === idx ? { ...mm, shopUsed: true } : mm)),
      note,
    ])
    const nextMessages = [
      ...messages.map((mm, i) => (i === idx ? { ...mm, shopUsed: true } : mm)),
      note,
    ]
    await callAI(nextMessages)
  }

  // Rời Trung tâm Pokémon (đợt 71) — gửi note ẩn để AI kể tiếp cảnh rời đi.
  async function handlePokecenterFinish(what) {
    const idx = pokecenterMsg?.index ?? null
    setPokecenterMsg(null)
    const note = {
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
    setMessages((cur) => [...markUsed(cur), note])
    await callAI([...markUsed(messages), note])
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
    setMessages((cur) => [...markUsed(cur), note])
    const nextMessages = [...markUsed(messages), note]
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
              if (window.confirm('Xoá toàn bộ lịch sử truyện + ký ức + tóm tắt? Không hoàn tác được.')) wipeAllMemory()
            }}
          >
            Xoá lịch sử chat
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div
          ref={scrollRef}
          style={{
            maxHeight: '62vh',
            overflowY: 'auto',
            paddingRight: 6,
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
                    const mentioned = detectMentionedSpecies(m.content, pokedexSpecies, { excludeNames: ownNames })
                    const speciesEntry = mentioned || pokedexSpecies[Math.floor(Math.random() * pokedexSpecies.length)]
                    const levelFor = (entry, offset = 0) => {
                      const base = battleCtx.isTrainer
                        ? trainerBattleLevel({ tier: battleCtx.tier, location: playerLocation, realTeam: battleCtx.realTeam })
                        : wildLevel({ location: playerLocation, entry }).level
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
                      const picked = mentionedList.slice(-2)
                      if (!picked.length) picked.push(speciesEntry)
                      while (picked.length < 2) {
                        const pool = pokedexSpecies.filter((entry) =>
                          !ownNames.some((name) => name?.toLowerCase() === entry.name.toLowerCase())
                          && !picked.some((chosen) => chosen.name === entry.name))
                        picked.push(pool[Math.floor(Math.random() * pool.length)] ?? speciesEntry)
                      }
                      const duo = picked.slice(0, 2).map((entry, index) => decorateTrainer(buildMonSmart(
                        entry, levelFor(entry, index === 1 ? 1 : 0), movesDb, playerMon?.types, true,
                      )))
                      setEnemyMon(duo[0])
                      setMessages((msgs) => msgs.map((mm, idx) => idx === i ? {
                        ...mm, battleStarted: true, battleMode: 'double', doubleReason: doubleCtx.reason,
                        enemySnapshot: duo[0], enemySnapshots: duo,
                      } : mm))
                    } else {
                      const mon = decorateTrainer(buildMonSmart(
                        speciesEntry, levelFor(speciesEntry), movesDb, playerMon?.types, battleCtx.isTrainer,
                      ))
                      setEnemyMon(mon)
                      setMessages((msgs) => msgs.map((mm, idx) => idx === i ? {
                        ...mm, battleStarted: true, battleMode: 'single', enemySnapshot: mon,
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
          <TurnInfoModal message={messages[turnInfoIndex]} onClose={() => setTurnInfoIndex(null)} />
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
                    // Xoá cặp cuối: tin người chơi mới nhất + AI trả lời.
                    const ai = lastAiIndex
                    if (ai < 0) return
                    const idxs = [ai]
                    if (messages[ai - 1]?.role === 'user') idxs.push(ai - 1)
                    if (!window.confirm('Xoá lượt gần nhất (bạn + AI)? Ký ức/tóm tắt liên quan cũng được dọn.')) return
                    setMessages((msgs) => {
                      const next = msgs.filter((_, idx) => !idxs.includes(idx))
                      cleanupMemoryFor(idxs, next.length)
                      return next
                    })
                    closeIndexBoundUi()
                  },
                },
                {
                  label: '🗑 Xoá toàn bộ lịch sử truyện',
                  danger: true,
                  disabled: loading || messages.length === 0,
                  onClick: () => {
                    if (window.confirm('Xoá TOÀN BỘ lịch sử truyện + ký ức + tóm tắt? Không hoàn tác được.')) {
                      wipeAllMemory()
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
            placeholder="Bạn làm gì / nói gì tiếp theo? (Enter để gửi, Shift+Enter xuống dòng — chuột phải để xoá nhanh)"
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
          // Đợt 71: Pokémon của huấn luyện viên khác thì KHÔNG bắt được,
          // KHÔNG chạy trốn được, KHÔNG dụ đi theo được.
          isWild={!enemyMon?.isTrainerMon}
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
              setMessages((msgs) =>
                msgs.map((mm, i) => (i === idx ? { ...mm, enemySnapshot: snap, battleRuntime: runtime } : mm)),
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
