import React, { useState, useRef, useEffect } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { chatCompletion, polishProse } from '../services/aiClient.js'
import { extractMissingStateTags } from '../services/stateExtractor.js'
import { importCharacterCard } from '../utils/characterCardImport.js'
import { BATTLE_MARKER } from '../utils/promptBuilder.js'
import { buildScanText } from '../utils/lorebook.js'
import { buildMainApiMessages } from '../utils/buildMainMessages.js'
import { buildToneNote } from '../data/storyTones.js'
import { cleanAiOutput, extractThinking } from '../utils/outputCleanup.js'
import { buildMonSmart, detectMentionedSpecies , applyEvGain } from '../data/pokemonSpecies.js'
import { detectMentionedArea, detectLocationFromMetadata, randomWildLevel } from '../data/regions.js'
import { wildLevel, receivedMonLevel } from '../data/levelLogic.js'
import ShopModal from './ShopModal.jsx'
import { parseStoryStateTags, applyStoryState } from '../utils/storyStateProtocol.js'
import BattleModal from './BattleModal.jsx'
import TurnInfoModal from './TurnInfoModal.jsx'
import SafariModal from './SafariModal.jsx'
import { isSafariArea } from '../data/regions.js'
import { musicManager } from '../utils/musicManager.js'
import { VICTORY_TRACK_KEYS, DEFEAT_TRACK_KEYS } from '../data/musicTracks.js'
import { rememberExchange, recallRelevant, buildMemoryNote } from '../utils/storyMemory.js'
import { upsertNpc, addFact, findRelevantNotes, buildNotebookNote } from '../utils/storyNotebook.js'
import { maybeUpdateSummary, buildSummaryNote } from '../utils/storySummary.js'
import { maybeMakeNudge, getIdentity } from '../data/storyDirector.js'
import { getRegion, getArea } from '../data/regions.js'
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
  if (!content.includes(BATTLE_MARKER)) {
    return <p className="story-text">{content}</p>
  }
  const parts = content.split(BATTLE_MARKER)
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part.trim() && <p className="story-text">{part}</p>}
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


// ===== Mô tả thay đổi biến của 1 lượt (đợt 48 — học card PNTT) =====
// Dịch stateParsed thành các dòng người đọc hiểu ngay, lưu vào message.meta
// để viewer "Biến cập nhật" hiển thị. Cắt raw/thinking để không phình
// localStorage (messages đã persist từ đợt 46).
const META_CLIP = 14000
function describeParsedChanges(parsed, movedTo, suffix = '') {
  const out = []
  const tag = suffix ? ` ${suffix}` : ''
  if (parsed.money) out.push(`💰 Tiền ${parsed.money > 0 ? '+' : ''}${parsed.money}${tag}`)
  for (const r of parsed.rel ?? []) out.push(`💞 Hảo cảm ${r.name} ${r.delta > 0 ? '+' : ''}${r.delta}${r.note ? ` (${r.note})` : ''}${tag}`)
  for (const b of parsed.body ?? []) out.push(`🩹 Thương tích ${b.part} ${b.delta > 0 ? '+' : ''}${b.delta}${tag}`)
  for (const h of parsed.hunger ?? []) out.push(`🍙 Độ no ${h.target} ${h.delta > 0 ? '+' : ''}${h.delta}${tag}`)
  for (const pk of parsed.pokemons ?? []) out.push(`🔴 Nhận Pokémon: ${pk.name} Lv.${pk.level}${tag}`)
  for (const n of parsed.npcs ?? []) out.push(`👤 Sổ tay NPC: ${n.name}${tag}`)
  for (const f of parsed.facts ?? []) out.push(`📌 Fact [${f.key}]: ${f.text.length > 90 ? f.text.slice(0, 90) + '…' : f.text}${tag}`)
  for (const sh of parsed.shops ?? []) out.push(`🛒 Mở cửa hàng: ${sh.name}${tag}`)
  if (parsed.dateAdvance) out.push(`📅 Thời gian +${parsed.dateAdvance} ngày${tag}`)
  if (parsed.datePart) out.push(`🕐 Chuyển buổi: ${parsed.datePart}${tag}`)
  if (movedTo) out.push(`🗺 Di chuyển tới: ${movedTo.areaKey} (${movedTo.regionKey})${tag}`)
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
    memoryApiConfig,
    playerIdentity,
    playerCharacter,
    storyDate,
    advanceStoryDate,
    party,
    setParty, storyTone,
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

  function handleDeleteMessage(i) {
    if (!window.confirm('Xoá tin nhắn này khỏi truyện? (Không hoàn tác được — biến đã áp từ tin này KHÔNG bị hoàn lại.)')) return
    setMessages((msgs) => msgs.filter((_, idx) => idx !== i))
    setEditingIndex(null)
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
  // dưới từ trước; hàm này lo các tag đợt 30-36: POKEMON / DATE / HUNGER /
  // NPC / FACT.
  function applyParsedState(parsed, turnNow) {
    try {
      for (const pk of parsed.pokemons ?? []) {
        const entry = pokedexSpecies.find((e) => e.name.toLowerCase() === pk.species.toLowerCase())
        if (!entry) {
          console.warn('[pokemon-tag] Không tìm thấy loài trong pokedex:', pk.species)
          continue
        }
        const saneLv = receivedMonLevel({ entry, requestedLevel: pk.level, location: playerLocation })
        const newMon = buildMonSmart(entry, saneLv, movesDb)
        setPlayerMon((cur) => cur ?? newMon)
        setParty((cur) => (cur.length < 6 && !cur.some((m2) => m2.name === newMon.name) ? [...cur, newMon] : cur))
      }
    } catch (e2) { console.warn('[state] POKEMON lỗi:', e2.message) }
    try {
      if ((parsed.dateAdvance ?? 0) > 0 || parsed.datePart) {
        advanceStoryDate(parsed.dateAdvance ?? 0, parsed.datePart)
      }
    } catch (e2) { console.warn('[state] DATE lỗi:', e2.message) }
    try {
      const dp = (parsed.hunger ?? []).reduce((acc, h) => { acc[h.who === 'mon' ? 'mon' : 'player'] += h.delta; return acc }, { player: 0, mon: 0 })
      if (dp.player || dp.mon) adjustHunger(dp)
    } catch (e2) { console.warn('[state] HUNGER lỗi:', e2.message) }
    try {
      for (const n of parsed.npcs ?? []) upsertNpc(n.name, n.fields, turnNow)
      for (const f of parsed.facts ?? []) addFact(f.key, f.text, turnNow)
    } catch (e2) { console.warn('[state] NPC/FACT lỗi:', e2.message) }
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

      // --- ĐẠO DIỄN TÌNH HUỐNG (đợt 31) ---
      // Thi thoảng (theo nhịp cooldown + xác suất) chèn 1 hạt giống tình
      // huống làm GỢI Ý một-lần ở cuối history — KHÔNG lưu vào messages nên
      // lượt sau tự biến mất, AI không bị gợi ý cũ ám mãi. Đa số lượt trả
      // null — đó mới là tự nhiên.
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
      const stateParsed = parseStoryStateTags(cleaned)
      applyStoryState(stateParsed, {
        playerProfile, setPlayerProfile,
        relationships, setRelationships,
        bodyStatus, setBodyStatus,
      })
      // Vị trí tính TRƯỚC khi lưu tin (đợt 48) để đưa vào meta viewer.
      let movedTo = null
      if ((stateParsed.moves ?? []).length) {
        movedTo = detectMentionedArea(stateParsed.moves[stateParsed.moves.length - 1], playerLocation)
      }
      if (!movedTo) movedTo = detectLocationFromMetadata(reply, playerLocation)
      if (!movedTo) movedTo = detectMentionedArea(stateParsed.cleaned, playerLocation)
      // CHAU CHUỐT VĂN PHONG (đợt 50): nếu cấu hình API phụ (slot Combat
      // Anime cũ), model phụ đánh bóng câu chữ theo tông truyện — chạy SAU
      // khi đã bóc tag (tag không bị model phụ nuốt), lỗi thì giữ nguyên văn.
      let displayText = stateParsed.cleaned
      if (animeApiConfig?.baseUrl && animeApiConfig?.model) {
        try {
          displayText = await polishProse({ ...apiConfig, ...animeApiConfig }, stateParsed.cleaned, buildToneNote(storyTone))
        } catch (polErr) {
          console.warn('[polish] bỏ qua chau chuốt:', polErr.message)
        }
      }
      // Meta từng lượt (đợt 48 — học card PNTT): biến đã áp + suy nghĩ +
      // văn gốc, xem lại bằng nút 🧬 / chuột phải → "Biến cập nhật".
      const turnMeta = {
        raw: (reply ?? '').slice(0, META_CLIP),
        thinking: extractThinking(reply).slice(0, META_CLIP),
        changes: [
          ...describeParsedChanges(stateParsed, movedTo),
          ...(displayText !== stateParsed.cleaned ? ['✍ Văn đã qua API chau chuốt văn phong'] : []),
        ],
      }
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: displayText,
          meta: turnMeta,
          ...(stateParsed.shops.length > 0
            ? { shop: stateParsed.shops[0], shopName: stateParsed.shops[0].name }
            : {}),
        },
      ])
      // Tracking vị trí: chính văn nhắc địa danh nào trong bản đồ 9 vùng thì
      // tự dời người chơi tới đó (ưu tiên khu cùng vùng hiện tại để tránh
      // nhầm các tên trùng như "Victory Road"). Dò sai → chỉnh tay ở Bản đồ.
      // VỊ TRÍ (đợt 38) — ưu tiên: (1) tag [[MOVE]] tường minh, (2) dòng
      // [Metadata|..|Vùng|Khu|..] của preset (đáng tin hơn quét cả bài),
      // (3) fallback quét địa danh trong chính văn. Dò metadata trên reply
      // GỐC vì dòng đó bị cleanAiOutput bóc mất khi lấy <content>.
      if (movedTo) setPlayerLocation(movedTo)
      // ===== ÁP BIẾN TRẠNG THÁI (refactor đợt 36) =====
      // Gom toàn bộ việc áp tag vào 1 hàm — dùng cho CẢ tag của model chính
      // lẫn tag bổ sung từ API cập nhật biến. Từng phần bọc try/catch riêng
      // để 1 tag lỗi KHÔNG giết cả pipeline (bài học vụ setPlayerMon crash
      // làm mọi cập nhật phía sau chết theo).
      const turnNow = nextMessages.length
      applyParsedState(stateParsed, turnNow)
      // API CẬP NHẬT BIẾN (đợt 36, tuỳ chọn): model phụ đọc lại chính văn và
      // BỔ SUNG các tag model chính quên khai (kèm danh sách tag đã áp để
      // không áp trùng). Chạy nền — lỗi chỉ warn.
      // Đợt 52 (yêu cầu beta): lớp cập nhật biến LUÔN BẬT — sổ tay keyword
      // không được phụ thuộc việc model chính có "nhớ" khai tag hay không.
      // Có API phụ riêng (model rẻ) thì dùng, không thì fallback API CHÍNH.
      const stateCfg = stateApiConfig?.baseUrl && stateApiConfig?.model ? stateApiConfig : apiConfig
      if (stateCfg?.baseUrl && stateCfg?.model) {
        extractMissingStateTags(stateCfg, {
          storyText: stateParsed.cleaned,
          // Đợt 50: đưa cả INPUT người chơi cho model phụ đối chiếu — người
          // chơi hay viết sai tên Pokémon ("chamnder"), model phụ phải hiểu
          // theo ngữ cảnh và khai tag bằng TÊN CHUẨN.
          userText: [...nextMessages].reverse().find((m2) => m2.role === 'user' && !m2.hidden)?.content ?? '',
          appliedTags: {
            money: stateParsed.money, rel: stateParsed.rel, pokemons: stateParsed.pokemons,
            hunger: stateParsed.hunger, dateAdvance: stateParsed.dateAdvance, datePart: stateParsed.datePart,
            npcs: (stateParsed.npcs ?? []).map((n) => n.name), facts: (stateParsed.facts ?? []).map((f) => f.key),
          },
          hasPokemon: Boolean(playerMon) || (stateParsed.pokemons ?? []).length > 0,
        })
          .then((extraTagsText) => {
            if (!extraTagsText) return
            const extra = parseStoryStateTags(extraTagsText)
            applyParsedState(extra, turnNow)
            // Tiền/quan hệ bổ sung từ API phụ: áp qua applyStoryState như luồng chính.
            if (extra.money || extra.rel.length || extra.body.length) {
              applyStoryState(extra, { setPlayerProfile, setRelationships, setBodyStatus })
            }
            // Ghi các biến bổ sung vào viewer của đúng tin AI cuối (đợt 48).
            const extraLines = describeParsedChanges(extra, null, '(API phụ)')
            if (extraLines.length) {
              setMessages((msgs) => {
                for (let k = msgs.length - 1; k >= 0; k--) {
                  if (msgs[k].role === 'assistant') {
                    const upd = { ...msgs[k], meta: { ...(msgs[k].meta ?? {}), changes: [...(msgs[k].meta?.changes ?? []), ...extraLines] } }
                    return msgs.map((mm, ii) => (ii === k ? upd : mm))
                  }
                }
                return msgs
              })
            }
          })
          .catch((e2) => console.warn('[state-api] bỏ qua:', e2.message))
      }
      // Tóm tắt cốt truyện (đợt 30): tự cập nhật nền khi đủ tin mới.
      maybeUpdateSummary(apiConfig, [...nextMessages, { role: 'assistant', content: stateParsed.cleaned }]).catch(
        (sumErr) => console.warn('[summary] cập nhật tóm tắt lỗi (bỏ qua):', sumErr.message),
      )
      // Ghi nhớ lượt vừa rồi vào trí nhớ dài hạn (chạy NỀN — embedding chậm
      // hay lỗi cũng không ảnh hưởng truyện). turn = độ dài mảng messages
      // tại thời điểm lượt này, dùng để loại ký ức còn trong cửa sổ gần.
      const embCfgAfter = memoryApiConfig?.embedding
      if (embCfgAfter?.baseUrl && embCfgAfter?.model) {
        const lastUser = [...nextMessages].reverse().find((m) => m.role === 'user')
        rememberExchange(embCfgAfter, lastUser?.content ?? '', stateParsed.cleaned, nextMessages.length).catch(
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
    setMessages((msgs) => msgs.map((m2, i) => (i === index ? { ...m2, content: newContent } : m2)))
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

    const withUsed = messages.map((mm, i) => (i === idx ? { ...mm, shopUsed: true } : mm))
    const note = {
      role: 'user',
      hidden: true,
      resultLabel: bought.length > 0 ? `Đã mua sắm tại ${shopName}` : `Rời ${shopName}`,
      content: noteContent,
    }
    const nextMessages = [...withUsed, note]
    setMessages(nextMessages)
    await callAI(nextMessages)
  }

  async function handleBattleEnd(outcome) {
    setBattleOpen(false)
    // Jingle kết quả (đợt 28): thắng/dụ được/hoà giải/bắt được → victory,
    // thua → defeat, chạy thoát / đối phương bỏ chạy → không jingle, nhạc
    // khu vực tự quay lại (battleOpen=false → MusicController pop override).
    if (['win', 'join', 'calm', 'caught'].includes(outcome)) {
      musicManager.playJingle(VICTORY_TRACK_KEYS)
      // EV thật khi HẠ đối thủ (đợt 48): cộng vào chỉ số base cao nhất của
      // loài bị hạ, cap 252/chỉ số & 510 tổng, tính lại stats ngay.
      if (outcome === 'win' && enemyMon) {
        setPlayerMon((cur) => (cur ? applyEvGain(cur, enemyMon) : cur))
        setParty((cur) => cur.map((pm) => (playerMon && pm.name === playerMon.name && pm.level === playerMon.level ? applyEvGain(pm, enemyMon) : pm)))
      }
    } else if (outcome === 'lose') {
      musicManager.playJingle(DEFEAT_TRACK_KEYS)
    }
    // QUAN TRỌNG: đánh dấu battleUsed và thêm note kết quả trong CÙNG 1 mảng.
    // Bug cũ: gọi setMessages 2 lần — lần 2 dùng mảng build từ closure CŨ
    // (chưa có cờ battleUsed) nên ghi đè mất cờ → pokeball vẫn bấm lại được
    // sau khi trận đã kết thúc (kết hợp resetBattle hồi máu = đánh lại vô hạn).
    const idx = activeBattleMsgIndex
    const withUsed =
      idx !== null
        ? messages.map((mm, i) =>
            i === idx ? { ...mm, battleUsed: true, enemySnapshot: undefined } : mm,
          )
        : messages
    if (idx !== null) setActiveBattleMsgIndex(null)
    const note = {
      role: 'user',
      hidden: true,
      resultLabel: OUTCOME_LABEL[outcome] ?? outcome,
      content: `[Hệ thống: trận đấu Pokémon vừa kết thúc, kết quả là ${
        OUTCOME_TEXT[outcome] ?? outcome
      }.] Hãy tiếp tục kể câu chuyện dựa trên kết quả này, không nhắc lại diễn biến trận đấu chi tiết.`,
    }
    const nextMessages = [...withUsed, note]
    setMessages(nextMessages)
    // API phụ 1 (chạy thoát) / API phụ 2 (thua) — nếu đã cấu hình, ưu tiên dùng
    // thay vì API chính, đúng theo kiến trúc nhiều API đã bàn.
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
              if (window.confirm('Xoá toàn bộ lịch sử truyện? Hành động này không hoàn tác được.')) resetChat()
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
                  // Tay trắng (đợt 32): chưa có Pokémon thì chưa thể vào trận.
                  if (!playerMon) {
                    window.alert('Bạn chưa có Pokémon nào — hãy để câu chuyện dẫn tới việc nhận Pokémon đầu tiên đã (né trận này bằng lời nói/bỏ chạy trong truyện).')
                    return
                  }
                  setActiveBattleMsgIndex(i)
                  // Chỉ chọn đối thủ 1 LẦN cho quả pokeball này — mở lại (sau
                  // khi bấm "Ẩn") phải là ĐÚNG con cũ, tiếp tục đúng HP hiện
                  // tại, không random lại (tránh trick ẩn đi rồi mở lại để né
                  // đối thủ khó / thoát lúc sắp thua).
                  // Snapshot lưu TRÊN TỪNG message (enemySnapshot) chứ không
                  // chỉ dựa vào enemyMon toàn cục — nếu có 2 quả pokeball, mở
                  // quả B sẽ ghi đè enemyMon của quả A; quay lại A phải khôi
                  // phục đúng con của A (kèm HP/trạng thái tại thời điểm ẩn).
                  if (!m.battleStarted) {
                    const mentioned = detectMentionedSpecies(m.content, pokedexSpecies)
                    const speciesEntry =
                      mentioned || pokedexSpecies[Math.floor(Math.random() * pokedexSpecies.length)]
                    // Level ĐA YẾU TỐ (đợt 40): khu an toàn/hiểm + có champion
                    // canh không + con non/đầu đàn + giai đoạn tiến hoá loài.
                    // KHÔNG kẹp theo đội người chơi — thế giới có logic riêng.
                    const { level } = wildLevel({ location: playerLocation, entry: speciesEntry })
                    const mon = buildMonSmart(speciesEntry, level, movesDb, playerMon?.types)
                    setEnemyMon(mon)
                    setMessages((msgs) =>
                      msgs.map((mm, idx) =>
                        idx === i ? { ...mm, battleStarted: true, enemySnapshot: mon } : mm,
                      ),
                    )
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
              {m.shopName && (
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

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Bạn làm gì / nói gì tiếp theo? (Enter để gửi, Shift+Enter xuống dòng)"
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

      {battleOpen && enemyMon && isSafariArea(playerLocation) && (
        <SafariModal
          onClose={() => setBattleOpen(false)}
          onSafariEnd={handleBattleEnd}
        />
      )}

      {battleOpen && !isSafariArea(playerLocation) && (
        <BattleModal
          environment={envFromWeather(getWeather(storyDate, playerLocation).label)}
          onClose={() => {
            // Bấm "Ẩn": lưu lại đúng trạng thái đối thủ hiện tại (HP, trạng
            // thái bỏng/tê liệt/ngủ...) vào snapshot của message đang mở, để
            // lần mở lại — kể cả sau khi đã mở 1 quả pokeball khác — vẫn tiếp
            // tục ĐÚNG con cũ với đúng máu/trạng thái.
            const idx = activeBattleMsgIndex
            if (idx !== null) {
              const snap = enemyMon
              setMessages((msgs) =>
                msgs.map((mm, i) => (i === idx ? { ...mm, enemySnapshot: snap } : mm)),
              )
            }
            setBattleOpen(false)
          }}
          onBattleEnd={handleBattleEnd}
        />
      )}
    </div>
  )
}
