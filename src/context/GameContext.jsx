import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { SAMPLE_CHARACTER, SAMPLE_PLAYER_MON, SAMPLE_ENEMY_MON } from '../data/sampleData.js'
import { POKEMON_SPECIES, guardMonRegression, guardPartyRegression, isSameMon, repairEncounterMonMoves, repairOwnedMonMoves, recomputeMonStats, setMoveStar } from '../data/pokemonSpecies.js'
import { applyPerksToMon, normalizeLegacyPerkBoost, resolveMechanicEffects, syncTraitGrantedItems } from '../data/playerPerks.js'
import { loadFullPokedex } from '../utils/pokedexFetch.js'
import { loadMovesData, loadLearnsets } from '../utils/movesFetch.js'
import { normalizeMapLocation } from '../data/mapPins.js'
import { abilityId, ensureMonAbility } from '../data/pokemonAbilities.js'
import { normalizeHeldItem, isCanonicalMegaStoneId, isCanonicalZCrystalId } from '../data/pokemonHeldItems.js'
import { normalizeFriendship } from '../data/pokemonFriendship.js'
import { loadStoredMessages, persistMessagesSafely } from '../utils/storageOptimizer.js'
import { repairSaveSlots } from '../utils/saveManager.js'
import { normalizePokedexRecords, recordPokedexEncounter } from '../data/pokedexProgress.js'
import { normalizeGameMode, sanitizeTraitsForMode } from '../data/gameModes.js'
import { createStableId, ensurePokemonIdentity, publicTrainerCode } from '../data/persistentIdentity.js'
import { DEFAULT_WORLD_PROGRESS, normalizeWorldProgress } from '../data/worldProgress.js'
import { DEFAULT_POKEMON_LIFE, normalizePokemonLife } from '../data/pokemonLife.js'
import { DEFAULT_TRADE_STATE, normalizeTradeState } from '../data/trading.js'
import { verifyAdminCode } from '../data/adminMode.js'
import { normalizeStoryTone } from '../data/storyTones.js'
import { ensurePokemonGender, inferPokemonGenderForMonFromStory } from '../data/pokemonGender.js'
import { startingMoneyForIdentity } from '../data/identities.js'
import { normalizeDynamicState } from '../data/dynamicState.js'
import { createCustomItemDescriptor, resolveInventoryItemByName } from '../data/shopItems.js'

const STORAGE_KEY = 'trainer-arena:api-config'

const GameContext = createContext(null)

function storedGameMode() {
  try { return normalizeGameMode(JSON.parse(localStorage.getItem('trainer-arena:story-tone') || '{}')) } catch { return 'anime' }
}

function dedupePokemonRecords(list) {
  const seenUids = new Set()
  const seenSources = new Set()
  return (Array.isArray(list) ? list : []).filter((mon) => {
    const uid = mon?.uid || null
    const source = mon?.acquisitionSourceId || null
    if ((uid && seenUids.has(uid)) || (source && seenSources.has(source))) return false
    if (uid) seenUids.add(uid)
    if (source) seenSources.add(source)
    return true
  })
}

function assistantSourceMessageId(mon) {
  const source = String(mon?.acquisitionSourceId ?? '')
  if (!source.startsWith('assistant-')) return null
  const marker = ':pokemon:'
  const at = source.indexOf(marker)
  return at > 0 ? source.slice(0, at) : null
}

const DEFAULT_CHAT_PREFERENCES = Object.freeze({ autoScroll: true, enterBehavior: 'send' })
function normalizeChatPreferences(value) {
  const raw = value && typeof value === 'object' ? value : {}
  return {
    autoScroll: raw.autoScroll !== false,
    enterBehavior: raw.enterBehavior === 'newline' ? 'newline' : 'send',
  }
}

export function GameProvider({ children }) {
  // Admin Mode chỉ sống trong SESSION hiện tại: không chèn vào save, không
  // theo người chơi sang máy khác và không có URL/query công khai để bật.
  const [adminMode, setAdminModeState] = useState(() => {
    try { return sessionStorage.getItem('trainer-arena:admin-session') === '1' } catch { return false }
  })
  const unlockAdmin = useCallback((code) => {
    const allowed = verifyAdminCode(code)
    if (allowed) {
      setAdminModeState(true)
      try { sessionStorage.setItem('trainer-arena:admin-session', '1') } catch { /* ignore */ }
    }
    return allowed
  }, [])
  const lockAdmin = useCallback(() => {
    setAdminModeState(false)
    try { sessionStorage.removeItem('trainer-arena:admin-session') } catch { /* ignore */ }
  }, [])

  // --- Cấu hình API (OpenAI-compatible) ---
  const [apiConfig, setApiConfigState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch {
      /* ignore corrupted storage */
    }
    return {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-4o-mini',
      temperature: 0.9,
      maxTokens: 8192, // đợt 55 (trước 1024): tránh model thinking trả rỗng
    }
  })

  const setApiConfig = useCallback((next) => {
    setApiConfigState(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* localStorage có thể bị chặn (chế độ ẩn danh...) — bỏ qua an toàn */
    }
  }, [])


  // --- Trải nghiệm chat (đợt 108) ---
  const [chatPreferences, setChatPreferencesState] = useState(() => {
    try { return normalizeChatPreferences(JSON.parse(localStorage.getItem('trainer-arena:chat-preferences') || 'null')) } catch { return { ...DEFAULT_CHAT_PREFERENCES } }
  })
  const setChatPreferences = useCallback((next) => {
    setChatPreferencesState((cur) => {
      const resolved = normalizeChatPreferences(typeof next === 'function' ? next(cur) : next)
      try { localStorage.setItem('trainer-arena:chat-preferences', JSON.stringify(resolved)) } catch { /* ignore */ }
      return resolved
    })
  }, [])

  // --- Character card (roleplay) ---
  // Character card GIỮ LẠI nhưng KHÔNG dùng Elara nữa — mặc định rỗng, chỉ
  // còn để tương thích preset/luồng cũ. Worldbook là thứ chính người dùng
  // nhập (đợt 41).
  const [character, setCharacter] = useState({ name: '', description: '', personality: '', scenario: '', first_mes: '', lorebook: [] })

  // WORLDBOOK (World Info độc lập) — persist. {name, entries:[...]}.
  const [worldbook, setWorldbookState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:worldbook')
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return { name: '', entries: [] }
  })
  const setWorldbook = useCallback((next) => {
    setWorldbookState(next)
    try { localStorage.setItem('trainer-arena:worldbook', JSON.stringify(next)) } catch { /* ignore */ }
  }, [])

  // --- Tính cách + thiên phú (đợt 69) ---
  // BUG người chơi báo: "Thiên Phú không xài được, chỉ có miêu tả trên văn
  // bản chứ không áp vào biến". Đúng: đợt 61 chỉ gửi note này ở LƯỢT MỞ ĐẦU
  // (IntroScreen), các lượt sau AI không hề biết → tính cách/thiên phú bay
  // mất sau vài tin. Nay lưu vào context, chèn MỌI LƯỢT và hiện trên HUD.
  const [playerTraits, setPlayerTraitsState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:player-traits')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Đợt 74: thiên phú cơ chế dựng sẵn bị gỡ. Mọi cheat chỉ có hiệu lực
        // khi người chơi chọn "Tự mô tả…" và viết trong customPower.
        return sanitizeTraitsForMode({ ...parsed, perks: [] }, storedGameMode())
      }
    } catch { /* ignore */ }
    return { personality: [], superpower: 'none', customPower: '', perks: [] }
  })
  const setPlayerTraits = useCallback((next) => {
    setPlayerTraitsState((cur) => {
      const raw = typeof next === 'function' ? next(cur) : next
      const resolved = sanitizeTraitsForMode({ ...(raw ?? {}), perks: [] }, storedGameMode())
      try { localStorage.setItem('trainer-arena:player-traits', JSON.stringify(resolved)) } catch { /* ignore */ }
      return resolved
    })
  }, [])

  // --- Tông truyện (đợt 50): độ khó + thể loại, chọn ở màn tạo nhân vật ---
  const [storyTone, setStoryToneState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:story-tone')
      if (saved) return normalizeStoryTone(JSON.parse(saved))
    } catch { /* ignore */ }
    return normalizeStoryTone(null)
  })
  const setStoryTone = useCallback((next) => {
    setStoryToneState((cur) => {
      const resolved = normalizeStoryTone(typeof next === 'function' ? next(cur) : next)
      try { localStorage.setItem('trainer-arena:story-tone', JSON.stringify(resolved)) } catch { /* ignore */ }
      return resolved
    })
  }, [])

  // Đổi/nạp chế độ Thực tế phải dọn cheat ngay cả khi traits tới từ preset
  // hay save cũ. Đây là chốt tầng state, không phụ thuộc giao diện.
  useEffect(() => {
    setPlayerTraitsState((cur) => {
      const resolved = sanitizeTraitsForMode(cur, storyTone)
      try { localStorage.setItem('trainer-arena:player-traits', JSON.stringify(resolved)) } catch { /* ignore */ }
      return JSON.stringify(resolved) === JSON.stringify(cur) ? cur : resolved
    })
  }, [storyTone?.difficulty])

  // --- Lịch sử chat roleplay (đợt 46: PERSIST — F5 không mất truyện) ---
  // Trước đây messages chỉ sống trong phiên: reload giữa chừng là mất sạch
  // chính văn trong khi tiền/túi đồ/vị trí vẫn còn → lệch nhau rất khó chịu.
  const [messages, setMessagesState] = useState(() => loadStoredMessages())
  // Đợt 78: cache Pokédex/moves lớn đã chuyển sang IndexedDB; khi lưu lịch sử
  // chỉ lược raw/thinking của lượt cũ, còn CHÍNH VĂN + biến DNA vẫn giữ trọn.
  // Nếu quota vừa đầy, persistMessagesSafely tự xoá cache localStorage đời cũ
  // rồi thử lại một lần trước khi báo người chơi.
  const [storageFull, setStorageFull] = useState(false)
  const setMessages = useCallback((next) => {
    setMessagesState((cur) => {
      const resolved = typeof next === 'function' ? next(cur) : next
      const result = persistMessagesSafely(resolved)
      // Không gọi setState khác ngay bên trong React updater — đẩy sang microtask
      // để tránh đúng bẫy updater/pha render từng gây lỗi state trong dự án.
      const updateFlag = () => setStorageFull(!result.ok)
      if (typeof queueMicrotask === 'function') queueMicrotask(updateFlag)
      else setTimeout(updateFlag, 0)
      return resolved
    })
  }, [])
  const resetChat = useCallback(() => setMessages([]), [setMessages])

  // Migration ngay khi mở bản mới: giải phóng cache cũ + rút debug lịch sử,
  // kể cả người chơi chưa gửi thêm lượt nào sau khi cập nhật.
  useEffect(() => {
    void repairSaveSlots()
    const result = persistMessagesSafely(messages)
    setStorageFull(!result.ok)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Màn hình mở đầu (title screen → tạo nhân vật → vào truyện) ---
  // Đợt 46: persist để F5 giữa truyện quay lại ĐÚNG màn chơi thay vì title.
  const [gameStarted, setGameStartedState] = useState(() => {
    try { return localStorage.getItem('trainer-arena:game-started') === '1' } catch { return false }
  })
  const setGameStarted = useCallback((next) => {
    setGameStartedState((cur) => {
      const resolved = typeof next === 'function' ? next(cur) : next
      try { localStorage.setItem('trainer-arena:game-started', resolved ? '1' : '0') } catch { /* ignore */ }
      return resolved
    })
  }, [])
  const [playerName, setPlayerNameState] = useState(() => {
    try { return localStorage.getItem('trainer-arena:player-name') ?? '' } catch { return '' }
  })
  const setPlayerName = useCallback((val) => {
    setPlayerNameState(val)
    try { localStorage.setItem('trainer-arena:player-name', val ?? '') } catch { /* ignore */ }
  }, [])

  // Mã trainer thuộc về hành trình/save và không đổi giữa các lần reload.
  const [trainerId, setTrainerIdState] = useState(() => {
    try { return localStorage.getItem('trainer-arena:trainer-id') || createStableId('trainer') } catch { return createStableId('trainer') }
  })
  useEffect(() => {
    try { localStorage.setItem('trainer-arena:trainer-id', trainerId) } catch { /* ignore */ }
  }, [trainerId])
  const resetTrainerIdentity = useCallback(() => {
    const next = createStableId('trainer')
    setTrainerIdState(next)
    return next
  }, [])
  const trainerCode = publicTrainerCode(trainerId)

  // --- State chiến đấu ---
  // playerMon persist (đợt 46): party đã persist mà con đang ra trận thì
  // không → F5 xong HUD hiện nhầm mon mẫu dù đội hình thật vẫn còn.
  const [playerMon, setPlayerMonState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:player-mon')
      if (saved !== null) return ensurePokemonIdentity(JSON.parse(saved), trainerId) // có thể là null hợp lệ (tay trắng)
    } catch { /* ignore */ }
    return ensurePokemonIdentity(SAMPLE_PLAYER_MON, trainerId)
  })
  const setPlayerMon = useCallback((next) => {
    setPlayerMonState((cur) => {
      const raw = typeof next === 'function' ? next(cur) : next
      // Đợt 70: chốt chặn TỤT CẤP. Xem guardMonRegression trong
      // pokemonSpecies.js — bất kỳ luồng nào ghi đè con đang ra trận bằng một
      // bản chụp CŨ HƠN (API phụ chạy nền, callback giữ closure cũ...) đều bị
      // giữ lại mốc level/exp cao hơn thay vì để người chơi mất công sức.
      const guarded = guardMonRegression(cur, raw)
      const resolved = ensurePokemonIdentity(guarded, guarded?.currentTrainerId ?? trainerId)
      try { localStorage.setItem('trainer-arena:player-mon', JSON.stringify(resolved ?? null)) } catch { /* ignore */ }
      return resolved
    })
  }, [trainerId])
  const [enemyMon, setEnemyMon] = useState(SAMPLE_ENEMY_MON)

  const resetBattle = useCallback(() => {
    // ĐỢT 71 — BỎ TỰ HỒI MÁU SAU TRẬN (yêu cầu của chủ dự án).
    // Trước đây kết thúc trận là Pokémon của người chơi tự đầy máu và sạch
    // trạng thái, nên thương tích chẳng có sức nặng gì. Nay CHỈ reset đối
    // thủ (con này bị vứt đi ngay sau trận); máu và trạng thái của người
    // chơi được GIỮ NGUYÊN, muốn hồi thì phải vào Trung tâm Pokémon hoặc
    // dùng vật phẩm — đúng như game gốc.
    // Null-guard (đợt 32): chế độ khởi đầu "tay trắng" có thể chưa có mon.
    setEnemyMon((m) => (m ? { ...m, hp: m.maxHp, status: null, sleepTurns: undefined } : m))
  }, [])


  // --- Preset / hướng dẫn văn phong (thay cho câu hướng dẫn mặc định) ---
  const [stylePreset, setStylePresetState] = useState(() => {
    try {
      return localStorage.getItem('trainer-arena:style-preset') ?? ''
    } catch {
      return ''
    }
  })
  const setStylePreset = useCallback((val) => {
    setStylePresetState(val)
    try {
      localStorage.setItem('trainer-arena:style-preset', val)
    } catch {
      /* bỏ qua nếu bị chặn */
    }
  }, [])

  // --- Preset chính văn (JSON kiểu SillyTavern Chat Completion Preset) ---
  // null = chưa nạp, dùng buildSystemPrompt mặc định như cũ.
  const [mainPreset, setMainPresetState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:main-preset')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const setMainPreset = useCallback((val) => {
    setMainPresetState(val)
    try {
      if (val) localStorage.setItem('trainer-arena:main-preset', JSON.stringify(val))
      else localStorage.removeItem('trainer-arena:main-preset')
    } catch {
      /* preset quá lớn cho localStorage — vẫn dùng được trong phiên hiện tại */
    }
  }, [])

  // --- Assistant Prefill: mồi trước 1 đoạn để AI "tiếp nối" thay vì tự quyết
  // định mở đầu — giúp giảm việc model tự chối ngay từ đầu câu trả lời.
  // Tự nạp từ preset.meta.assistantPrefill khi import, nhưng người dùng vẫn
  // sửa tay được sau đó.
  const [assistantPrefill, setAssistantPrefill] = useState(() => {
    try {
      return localStorage.getItem('trainer-arena:assistant-prefill') ?? ''
    } catch {
      return ''
    }
  })
  const updateAssistantPrefill = useCallback((val) => {
    setAssistantPrefill(val)
    try {
      localStorage.setItem('trainer-arena:assistant-prefill', val)
    } catch {
      /* ignore */
    }
  }, [])

  // --- Cấu hình API phụ cho các tuyến kết quả trận đấu (theo kế hoạch nhiều API) ---
  // Để trống = dùng apiConfig chính. Điền vào để route tuyến "thua"/"chạy thoát"
  // sang 1 model/endpoint khác (VD model rẻ hơn, hoặc prompt chuyên biệt hơn).
  const [outcomeApiConfig, setOutcomeApiConfigState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:outcome-api-config')
      if (saved) return JSON.parse(saved)
    } catch {
      /* ignore */
    }
    return { escaped: null, lose: null }
  })
  const setOutcomeApiConfig = useCallback((next) => {
    setOutcomeApiConfigState(next)
    try {
      localStorage.setItem('trainer-arena:outcome-api-config', JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }, [])
  const [battleOpen, setBattleOpen] = useState(false)

  // --- API riêng cho Combat Anime (trọng tài) — null = dùng API chính ---
  const [animeApiConfig, setAnimeApiConfigState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:anime-api')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const setAnimeApiConfig = useCallback((cfg) => {
    setAnimeApiConfigState(cfg)
    try {
      if (cfg) localStorage.setItem('trainer-arena:anime-api', JSON.stringify(cfg))
      else localStorage.removeItem('trainer-arena:anime-api')
    } catch { /* ignore */ }
  }, [])

  // --- Độ no (đợt 36): 0-100 cho NGƯỜI và POKÉMON (cả đội, 1 thanh chung).
  // Cập nhật theo 2 điều kiện: (a) app TỰ TRỪ khi ngày trôi (advanceStoryDate
  // trừ 18/ngày mỗi bên), (b) AI tag [[HUNGER người+25]] khi có sự kiện ăn
  // uống/lao lực rõ. Persist để giữ qua reload.
  const [hunger, setHungerState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:hunger')
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return { player: 100, mon: 100 }
  })
  const setHunger = useCallback((next) => {
    setHungerState((cur) => {
      const resolved = typeof next === 'function' ? next(cur) : next
      const normalized = {
        player: Math.max(0, Math.min(100, Number(resolved?.player) || 0)),
        mon: Math.max(0, Math.min(100, Number(resolved?.mon) || 0)),
      }
      try { localStorage.setItem('trainer-arena:hunger', JSON.stringify(normalized)) } catch { /* ignore */ }
      return normalized
    })
  }, [])
  const adjustHunger = useCallback((deltas) => {
    setHungerState((cur) => {
      const next = {
        player: Math.max(0, Math.min(100, cur.player + (deltas.player ?? 0))),
        mon: Math.max(0, Math.min(100, cur.mon + (deltas.mon ?? 0))),
      }
      try { localStorage.setItem('trainer-arena:hunger', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  // --- Hồ sơ nhân vật (đợt 32): giới tính/tuổi/ngoại hình/xuất thân/thân
  // phận tự tạo — dựng ở màn tạo nhân vật, khai báo cố định trong prompt.
  const [playerCharacter, setPlayerCharacterState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:player-character')
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return { gender: '', age: '', appearance: '', originRegionKey: '', originAreaKey: '', customIdentity: null }
  })
  const setPlayerCharacter = useCallback((next) => {
    setPlayerCharacterState(next)
    try { localStorage.setItem('trainer-arena:player-character', JSON.stringify(next)) } catch { /* ignore */ }
  }, [])

  // --- Ngày tháng in-game (đợt 32): người chơi đặt ngày bắt đầu; AI đẩy
  // thời gian qua tag [[DATE +N]] / [[DATE buổi=...]]. Dùng cho lời kể nhất
  // quán + gắn mốc ngày vào FACT của sổ tay để trí nhớ chi tiết hơn.
  const [storyDate, setStoryDateState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:story-date')
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return { day: 1, month: 4, year: 2000, part: 'sáng' }
  })
  const setStoryDate = useCallback((next) => {
    setStoryDateState(next)
    try { localStorage.setItem('trainer-arena:story-date', JSON.stringify(next)) } catch { /* ignore */ }
  }, [])
  // Cộng ngày bằng Date thật (setFullYear để năm nhỏ như 40 không bị JS map
  // thành 1940) — qua ngày mới tự về buổi sáng.
  const advanceStoryDate = useCallback((days, part) => {
    setStoryDateState((cur) => {
      let next = { ...cur }
      if (days > 0) {
        const dt = new Date(2000, 0, 1)
        dt.setFullYear(cur.year, cur.month - 1, cur.day)
        dt.setDate(dt.getDate() + days)
        next = { day: dt.getDate(), month: dt.getMonth() + 1, year: dt.getFullYear(), part: 'sáng' }
      }
      if (part) next.part = part
      try { localStorage.setItem('trainer-arena:story-date', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    // Điều kiện cập nhật độ no theo THỜI GIAN (đợt 36): mỗi ngày trôi làm
    // người + Pokémon đói thêm 18 điểm mỗi bên.
    if (days > 0) adjustHunger({ player: -18 * days, mon: -18 * days })
  }, [adjustHunger])

  // --- API cập nhật biến riêng (đợt 36): model phụ đọc chính văn và bổ sung
  // các tag trạng thái mà model chính quên khai — null = tắt. {baseUrl,
  // apiKey, model}, có nút Tải model trong Cài đặt như mọi API phụ.
  const [stateApiConfig, setStateApiConfigState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:state-api')
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return null
  })
  const setStateApiConfig = useCallback((cfg) => {
    setStateApiConfigState(cfg)
    try {
      if (cfg) localStorage.setItem('trainer-arena:state-api', JSON.stringify(cfg))
      else localStorage.removeItem('trainer-arena:state-api')
    } catch { /* ignore */ }
  }, [])
  const [stateApiConfig2, setStateApiConfig2State] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:state-api-2')
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return null
  })
  const setStateApiConfig2 = useCallback((cfg) => {
    setStateApiConfig2State(cfg)
    try {
      if (cfg) localStorage.setItem('trainer-arena:state-api-2', JSON.stringify(cfg))
      else localStorage.removeItem('trainer-arena:state-api-2')
    } catch { /* ignore */ }
  }, [])

  // --- Thân phận người chơi (đợt 31) — quyết định pool tình huống của Đạo
  // diễn + được khai báo trong system prompt. Key hợp lệ: xem IDENTITIES
  // trong data/storyDirector.js. Persist để giữ qua reload.
  const [playerIdentity, setPlayerIdentityState] = useState(() => {
    try { return localStorage.getItem('trainer-arena:player-identity') || 'wanderer' } catch { return 'wanderer' }
  })
  const setPlayerIdentity = useCallback((key) => {
    setPlayerIdentityState(key)
    try { localStorage.setItem('trainer-arena:player-identity', key) } catch { /* ignore */ }
  }, [])

  // --- API trí nhớ dài hạn (đợt 29): embedding (bắt buộc để bật trí nhớ)
  // + rerank (tuỳ chọn, chấm lại độ liên quan). Đây là các endpoint RIÊNG
  // (không phải chat completions) nên tách khỏi apiConfig chính:
  // embedding = {baseUrl, apiKey, model} gọi POST /embeddings;
  // rerank = {baseUrl, apiKey, model} gọi POST /rerank (kiểu Jina/Cohere/vLLM).
  // null = tắt tính năng tương ứng.
  const [memoryApiConfig, setMemoryApiConfigState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:memory-api')
      if (saved) {
        const parsed = JSON.parse(saved)
        return { embedding: parsed.embedding ?? null, rerank: parsed.rerank ?? null }
      }
    } catch { /* ignore */ }
    return { embedding: null, rerank: null }
  })
  const setMemoryApiConfig = useCallback((next) => {
    setMemoryApiConfigState(next)
    try { localStorage.setItem('trainer-arena:memory-api', JSON.stringify(next)) } catch { /* ignore */ }
  }, [])

  // --- Hồ sơ người chơi cho HUD (tuổi, tiền, avatar) ---
  const [playerProfile, setPlayerProfileState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:player-profile')
      return saved ? JSON.parse(saved) : { age: 16, money: 3000, avatarUrl: '' }
    } catch {
      return { age: 16, money: 3000, avatarUrl: '' }
    }
  })
  const setPlayerProfile = useCallback((next) => {
    setPlayerProfileState((cur) => {
      const resolved = typeof next === 'function' ? next(cur) : next
      try { localStorage.setItem('trainer-arena:player-profile', JSON.stringify(resolved)) } catch { /* ignore */ }
      return resolved
    })
  }, [])

  // Migration một lần cho save cũ: bản trước ép mọi thân phận về ₽3.000.
  // Chỉ nâng tới mức khởi đầu của thân phận giàu, không liên tục bơm lại tiền
  // sau khi người chơi đã chi tiêu.
  useEffect(() => {
    if (!gameStarted || Number(playerProfile?.identityEconomyVersion) >= 1) return
    const identityStart = startingMoneyForIdentity(playerIdentity, playerCharacter)
    setPlayerProfile((cur) => ({
      ...(cur ?? {}),
      money: identityStart > 3000 ? Math.max(Number(cur?.money) || 0, identityStart) : Number(cur?.money) || 0,
      identityEconomyVersion: 1,
    }))
  }, [gameStarted, playerCharacter, playerIdentity, playerProfile?.identityEconomyVersion, setPlayerProfile])

  // --- Sinh lực theo BỘ PHẬN CƠ THỂ (chế độ chân thực — Pokémon tấn công
  // người là bình thường). 0 = lành lặn, tăng dần theo mức thương tổn,
  // 100 = mất/hỏng hẳn bộ phận đó (hiển thị đen trên hình người). ---
  const DEFAULT_BODY = { head: 0, torso: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 }
  const [bodyStatus, setBodyStatusState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:body-status')
      return saved ? { ...DEFAULT_BODY, ...JSON.parse(saved) } : { ...DEFAULT_BODY }
    } catch {
      return { ...DEFAULT_BODY }
    }
  })
  // Đợt 45: nhận CẢ functional updater (quy tắc chung mọi setter persist).
  const setBodyStatus = useCallback((next) => {
    setBodyStatusState((cur) => {
      const resolved = typeof next === 'function' ? next(cur) : next
      try { localStorage.setItem('trainer-arena:body-status', JSON.stringify(resolved)) } catch { /* ignore */ }
      return resolved
    })
  }, [])

  // --- Đội hình 6 Pokémon (HUD). playerMon vẫn là con đang ra trận. ---
  const [party, setPartyState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:party')
      return saved ? dedupePokemonRecords(JSON.parse(saved)).map((mon) => ensurePokemonIdentity(mon, trainerId)) : []
    } catch {
      return []
    }
  })
  // Đợt 36: nhận CẢ functional updater (bài học vụ setPlayerMon crash — mọi
  // setter persist đều phải an toàn với cả 2 dạng gọi).
  const setParty = useCallback((next) => {
    setPartyState((cur) => {
      const raw = dedupePokemonRecords(typeof next === 'function' ? next(cur) : next).slice(0, 6)
      // Đợt 70: cùng chốt chặn tụt cấp như setPlayerMon, áp cho từng cá thể
      // trong đội (khớp theo uid). Người chơi báo HUD tụt về Lv5 — đội hình
      // cũng nằm trên đường ghi đè đó.
      const resolved = guardPartyRegression(cur, raw).map((mon) => ensurePokemonIdentity(mon, mon?.currentTrainerId ?? trainerId))
      try { localStorage.setItem('trainer-arena:party', JSON.stringify(resolved)) } catch { /* ignore */ }
      return resolved
    })
  }, [trainerId])

  // --- HÒM PC (đợt 71): Pokémon gửi vào máy tính, không giới hạn 6 như đội.
  // Trước đây bắt được con thứ 7 là app chỉ ghi log "được gửi về nhà" rồi
  // VỨT LUÔN — người chơi mất trắng. Nay nó vào hòm PC và lấy ra được qua
  // giao diện máy tính ở Trung tâm Pokémon.
  const [pcBox, setPcBoxState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:pc-box')
      return saved ? dedupePokemonRecords(JSON.parse(saved)).map((mon) => ensurePokemonIdentity(mon, trainerId)) : []
    } catch {
      return []
    }
  })
  const setPcBox = useCallback((next) => {
    setPcBoxState((cur) => {
      const resolved = dedupePokemonRecords(typeof next === 'function' ? next(cur) : next)
        .map((mon) => ensurePokemonIdentity(mon, mon?.currentTrainerId ?? trainerId))
      try { localStorage.setItem('trainer-arena:pc-box', JSON.stringify(resolved)) } catch { /* ignore */ }
      return resolved
    })
  }, [trainerId])

  // Ghim chiêu là thuộc tính của đúng cá thể Pokémon và phải đồng bộ ở cả
  // active slot, party lẫn PC để không mất sau khi đổi đội hình hoặc tải lại.
  const setPokemonMoveStar = useCallback((target, targetMoveId, starred) => {
    const update = (mon) => isSameMon(mon, target) ? setMoveStar(mon, targetMoveId, starred) : mon
    setPlayerMon((cur) => update(cur))
    setParty((cur) => (cur ?? []).map(update))
    setPcBox((cur) => (cur ?? []).map(update))
  }, [setParty, setPcBox, setPlayerMon])

  // Nickname là thuộc tính cá thể, khả dụng ở MỌI chế độ. Để trống = dùng tên loài.
  const setPokemonNickname = useCallback((target, nickname) => {
    const clean = String(nickname ?? '').trim().slice(0, 40)
    const update = (mon) => isSameMon(mon, target) ? { ...mon, nickname: clean || undefined } : mon
    setPlayerMon((cur) => update(cur))
    setParty((cur) => (cur ?? []).map(update))
    setPcBox((cur) => (cur ?? []).map(update))
  }, [setParty, setPcBox, setPlayerMon])

  // Party và PC là hai kho sở hữu khác nhau. Save lỗi cũ hoặc hai callback
  // gần nhau có thể từng ghi cùng một cá thể vào cả hai khóa localStorage;
  // dedupe riêng từng mảng không bắt được trường hợp chéo này. Party là nguồn
  // ưu tiên, PC tự bỏ bản sao theo uid hoặc sourceMessage ổn định.
  useEffect(() => {
    const partyUids = new Set((party ?? []).map((mon) => mon?.uid).filter(Boolean))
    const partySources = new Set((party ?? []).map((mon) => mon?.acquisitionSourceId).filter(Boolean))
    setPcBox((cur) => {
      const filtered = (cur ?? []).filter((mon) =>
        !(mon?.uid && partyUids.has(mon.uid))
        && !(mon?.acquisitionSourceId && partySources.has(mon.acquisitionSourceId)),
      )
      return filtered.length === (cur ?? []).length ? cur : filtered
    })
  }, [party, setPcBox])


  // Đợt 108: tự dọn Pokémon "ma" từ timeline đã bị xóa ở các bản cũ.
  // Source starter/intro/trade không có prefix assistant- nên không bị đụng.
  // Effect chỉ chạy theo transcript để tránh xóa nhầm cá thể trong vài ms giữa
  // lúc semantic state commit và message assistant được gắn vào mảng chat.
  useEffect(() => {
    if (!gameStarted) return
    const liveMessageIds = new Set((messages ?? []).map((message) => message?.id).filter(Boolean))
    const isOrphan = (mon) => {
      const sourceMessageId = assistantSourceMessageId(mon)
      return Boolean(sourceMessageId && !liveMessageIds.has(sourceMessageId))
    }
    const currentParty = party ?? []
    const currentPc = pcBox ?? []
    if (!currentParty.some(isOrphan) && !currentPc.some(isOrphan) && !isOrphan(playerMon)) return
    const nextParty = currentParty.filter((mon) => !isOrphan(mon))
    const nextPc = currentPc.filter((mon) => !isOrphan(mon))
    setParty(nextParty)
    setPcBox(nextPc)
    if (isOrphan(playerMon)) setPlayerMon(nextParty[0] ?? null)
    console.warn('[branch-repair] đã loại Pokémon mồ côi không còn source message canon')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, gameStarted])

  // --- Tiến trình thế giới có cấu trúc (đợt 87): huy hiệu, nhiệm vụ, phe
  // phái/danh tiếng, luật pháp và truy nã. ---
  const [worldProgress, setWorldProgressState] = useState(() => {
    try { return normalizeWorldProgress(JSON.parse(localStorage.getItem('trainer-arena:world-progress') || 'null')) } catch { return { ...DEFAULT_WORLD_PROGRESS } }
  })
  const setWorldProgress = useCallback((next) => {
    setWorldProgressState((cur) => {
      const resolved = normalizeWorldProgress(typeof next === 'function' ? next(cur) : next)
      try { localStorage.setItem('trainer-arena:world-progress', JSON.stringify(resolved)) } catch { /* ignore */ }
      return resolved
    })
  }, [])

  // --- Biến động tự do từ Semantic State Engine (đợt 105) ---
  // Core schema không thể biết trước mọi quyền, tài sản, thiết bị hay luật do
  // người chơi tự sáng tạo. Kho này giữ các biến mở theo key ổn định thay vì
  // buộc dev phải tạo thêm một [[TAG]] cho từng ý tưởng mới.
  const [dynamicState, setDynamicStateState] = useState(() => {
    try { return normalizeDynamicState(JSON.parse(localStorage.getItem('trainer-arena:dynamic-state') || 'null')) } catch { return normalizeDynamicState(null) }
  })
  const setDynamicState = useCallback((next) => {
    setDynamicStateState((cur) => {
      const resolved = normalizeDynamicState(typeof next === 'function' ? next(cur) : next)
      try { localStorage.setItem('trainer-arena:dynamic-state', JSON.stringify(resolved)) } catch { /* ignore */ }
      return resolved
    })
  }, [])


  useEffect(() => {
    if (!gameStarted) return
    const liveMessageIds = new Set((messages ?? []).map((message) => message?.id).filter(Boolean))
    setDynamicState((cur) => {
      const values = cur?.values ?? {}
      let changed = false
      const nextValues = {}
      for (const [key, entry] of Object.entries(values)) {
        const source = entry?.sourceMessageId
        if (source && String(source).startsWith('assistant-') && !liveMessageIds.has(source)) { changed = true; continue }
        nextValues[key] = entry
      }
      return changed ? { ...cur, values: nextValues } : cur
    })
  }, [messages, gameStarted, setDynamicState])

  // Trứng/cắm trại/Contest là state riêng để không nhồi dữ liệu cá thể vào
  // nhật ký nhiệm vụ. Ribbon/Mark vẫn nằm trên chính Pokémon.
  const [pokemonLife, setPokemonLifeState] = useState(() => {
    try { return normalizePokemonLife(JSON.parse(localStorage.getItem('trainer-arena:pokemon-life') || 'null')) } catch { return { ...DEFAULT_POKEMON_LIFE } }
  })
  const setPokemonLife = useCallback((next) => {
    setPokemonLifeState((cur) => {
      const resolved = normalizePokemonLife(typeof next === 'function' ? next(cur) : next)
      try { localStorage.setItem('trainer-arena:pokemon-life', JSON.stringify(resolved)) } catch { /* ignore */ }
      return resolved
    })
  }, [])

  const [tradeState, setTradeStateState] = useState(() => {
    try { return normalizeTradeState(JSON.parse(localStorage.getItem('trainer-arena:trade-state') || 'null')) } catch { return { ...DEFAULT_TRADE_STATE } }
  })
  const setTradeState = useCallback((next) => {
    setTradeStateState((cur) => {
      const resolved = normalizeTradeState(typeof next === 'function' ? next(cur) : next)
      try { localStorage.setItem('trainer-arena:trade-state', JSON.stringify(resolved)) } catch { /* ignore */ }
      return resolved
    })
  }, [])


  /** Hồi phục TOÀN ĐỘI về đầy máu + sạch trạng thái (Trung tâm Pokémon). */
  const healAll = useCallback(() => {
    const heal = (m) => (m ? {
      ...m,
      hp: m.maxHp,
      status: null,
      sleepTurns: undefined,
      toxicCounter: undefined,
      moves: (m.moves ?? []).map((move) => ({ ...move, currentPp: Math.max(1, Number(move.maxPp ?? move.pp) || 35) })),
    } : m)
    setPlayerMon((m) => heal(m))
    setParty((cur) => (cur ?? []).map(heal))
  }, [setPlayerMon, setParty])

  // --- Túi đồ (mua từ shop, dùng dần trong trận/truyện) ---
  const [inventory, setInventoryState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:inventory')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const setInventory = useCallback((next) => {
    setInventoryState((cur) => {
      const resolved = typeof next === 'function' ? next(cur) : next
      try { localStorage.setItem('trainer-arena:inventory', JSON.stringify(resolved)) } catch { /* ignore */ }
      return resolved
    })
  }, [])

  // Đợt 114: sửa save từng dính heuristic "tên kết thúc -ite => Mega Stone".
  // Item như "... hạng Elite" có thể đã bị gắn megaStone/holdable rồi tự đeo
  // lên Pokémon. Tách nó khỏi held slot, trả đúng một bản về túi và để Item
  // Description Protocol enrich lại metadata. Dedupe theo UID để active + party
  // không hoàn trả cùng một món hai lần.
  useEffect(() => {
    const fakeHeld = (held) => {
      if (!held || typeof held !== 'object') return false
      if (held.megaStone && !isCanonicalMegaStoneId(held.id ?? held.name)) return true
      if ((held.zCrystal || held.zType) && !isCanonicalZCrystalId(held.id ?? held.name)) return true
      return false
    }
    const seenMon = new Set()
    const recovered = []
    for (const mon of [playerMon, ...(party ?? []), ...(pcBox ?? [])]) {
      if (!mon || !fakeHeld(mon.heldItem)) continue
      const monKey = mon.uid || mon.pokemonId || `${mon.species ?? mon.name}:${mon.level ?? 0}`
      if (seenMon.has(monKey)) continue
      seenMon.add(monKey)
      recovered.push(mon.heldItem)
    }
    if (!recovered.length) return
    const repair = (mon) => (mon && fakeHeld(mon.heldItem) ? { ...mon, heldItem: null } : mon)
    setPlayerMon((cur) => repair(cur))
    setParty((cur) => (cur ?? []).map(repair))
    setPcBox((cur) => (cur ?? []).map(repair))
    setInventory((cur) => {
      const next = [...(cur ?? [])]
      for (const held of recovered) {
        const name = held.name ?? held.id ?? 'Vật phẩm cốt truyện'
        const existing = resolveInventoryItemByName(name, next)
        const descriptor = existing ?? createCustomItemDescriptor(name, { category: 'misc' })
        if (!descriptor) continue
        const at = next.findIndex((item) => item.id === descriptor.id)
        if (at >= 0) next[at] = { ...next[at], qty: (Number(next[at].qty) || 0) + 1, descriptionStatus: 'needs-enrichment' }
        else next.push({ ...descriptor, qty: 1, descriptionStatus: 'needs-enrichment' })
      }
      return next
    })
  }, [playerMon, party, pcBox, setInventory, setParty, setPcBox, setPlayerMon])

  // Đợt 73-74: đồng bộ save NGAY theo năng lực TỰ MÔ TẢ. Nếu save cũ
  // từng bật perk Max IV/EV dựng sẵn, gỡ đúng boost mang cờ `perkMark` để cheat
  // không tồn tại mãi sau khi lựa chọn đó đã bị xoá. Pokémon không mang cờ cũ
  // không bị chạm vào; customPower có ghi Max IV/EV thì vẫn áp như người chơi muốn.
  useEffect(() => {
    const effects = resolveMechanicEffects(playerTraits)
    const syncMon = (mon) => {
      if (!mon) return mon
      return effects.maxIvEv
        ? applyPerksToMon(mon, playerTraits)
        : normalizeLegacyPerkBoost(mon, playerTraits)
    }

    setInventory((cur) => syncTraitGrantedItems(cur, playerTraits))
    setPlayerMon((cur) => syncMon(cur))
    setParty((cur) => (cur ?? []).map(syncMon))
    setPcBox((cur) => (cur ?? []).map(syncMon))
  }, [playerTraits, setInventory, setParty, setPcBox, setPlayerMon])

  // --- Quan hệ với NPC (điểm hảo cảm -100..100) ---
  const [relationships, setRelationshipsState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:relationships')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  // Đợt 45: nhận CẢ functional updater (quy tắc chung mọi setter persist).
  const setRelationships = useCallback((next) => {
    setRelationshipsState((cur) => {
      const resolved = typeof next === 'function' ? next(cur) : next
      try { localStorage.setItem('trainer-arena:relationships', JSON.stringify(resolved)) } catch { /* ignore */ }
      return resolved
    })
  }, [])

  // --- Vị trí người chơi trên bản đồ 9 vùng (xem src/data/regions.js) ---
  // null = chưa xác định (wild encounter dùng dải level fallback 8-15).
  // Tự cập nhật khi chính văn AI nhắc tới địa danh (detectMentionedArea trong
  // RoleplayChat), hoặc người chơi tự chọn trên panel Bản đồ.
  const [playerLocation, setPlayerLocationState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:player-location')
      return saved ? normalizeMapLocation(JSON.parse(saved)) : null
    } catch {
      return null
    }
  })
  const setPlayerLocation = useCallback((next) => {
    setPlayerLocationState((cur) => {
      const raw = typeof next === 'function' ? next(cur) : next
      const loc = normalizeMapLocation(raw)
      try {
        if (loc) localStorage.setItem('trainer-arena:player-location', JSON.stringify(loc))
        else localStorage.removeItem('trainer-arena:player-location')
      } catch {
        /* ignore */
      }
      return loc
    })
  }, [])

  // --- Pokedex đầy đủ (mọi Gen + Mega + Gigantamax), tự tải từ Showdown lúc
  // khởi động. Mặc định dùng 151 loài Gen 1 tĩnh (POKEMON_SPECIES) cho tới
  // khi tải xong hoặc nếu tải lỗi (mạng chặn, CORS...) thì giữ nguyên fallback.
  const [pokedexSpecies, setPokedexSpecies] = useState(POKEMON_SPECIES)
  const [pokedexStatus, setPokedexStatus] = useState('idle') // idle|loading|ready|error
  const [pokedexError, setPokedexError] = useState(null)

  // --- Pokédex HÀNH TRÌNH (đợt 86): khác với database loài ở trên, đây là
  // tiến độ seen/caught của đúng save hiện tại. Khoá trainer-arena:* nên tự
  // đi cùng ba ô save và file export mà không phải sửa saveManager.
  const [pokedexRecords, setPokedexRecordsState] = useState(() => {
    try {
      return normalizePokedexRecords(JSON.parse(localStorage.getItem('trainer-arena:pokedex-records') || '{}'))
    } catch {
      return {}
    }
  })
  const setPokedexRecords = useCallback((next) => {
    setPokedexRecordsState((cur) => {
      const resolved = normalizePokedexRecords(typeof next === 'function' ? next(cur) : next)
      try { localStorage.setItem('trainer-arena:pokedex-records', JSON.stringify(resolved)) } catch { /* ignore */ }
      return resolved
    })
  }, [])
  const markPokedexSeen = useCallback((subject, meta = {}) => {
    setPokedexRecordsState((cur) => {
      const next = recordPokedexEncounter(cur, subject, { ...meta, caught: false }, pokedexSpecies)
      if (next === cur) return cur
      try { localStorage.setItem('trainer-arena:pokedex-records', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [pokedexSpecies])
  const markPokedexCaught = useCallback((subject, meta = {}) => {
    setPokedexRecordsState((cur) => {
      const next = recordPokedexEncounter(cur, subject, { ...meta, caught: true }, pokedexSpecies)
      if (next === cur) return cur
      try { localStorage.setItem('trainer-arena:pokedex-records', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [pokedexSpecies])

  useEffect(() => {
    let cancelled = false
    setPokedexStatus('loading')
    loadFullPokedex()
      .then((list) => {
        if (cancelled) return
        if (list?.length) {
          setPokedexSpecies(list)
          setPokedexStatus('ready')
        }
      })
      .catch((err) => {
        if (cancelled) return
        setPokedexStatus('error')
        setPokedexError(err.message)
        // Giữ nguyên fallback 151 loài Gen 1 tĩnh — app vẫn dùng được bình thường.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Save cũ đã sở hữu Pokémon trước đợt 86 phải tự hiện là "đã bắt". Effect
  // cũng là lưới an toàn cho mọi đường nhận Pokémon hiện tại (battle, Safari,
  // [[POKEMON]], PC); không cần tin model khai thêm tag Pokédex.
  useEffect(() => {
    const owned = [...(party ?? []), ...(pcBox ?? []), playerMon].filter(Boolean)
    if (!owned.length) return
    setPokedexRecordsState((cur) => {
      let next = cur
      for (const mon of owned) {
        next = recordPokedexEncounter(next, mon, { caught: true, source: 'owned' }, pokedexSpecies)
      }
      if (next === cur) return cur
      try { localStorage.setItem('trainer-arena:pokedex-records', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [party, pcBox, playerMon, pokedexSpecies])

  // Đợt 81: nâng save cũ lên Ability + thân mật + metadata trang bị.
  // Eviolite cần biết cá thể còn tiến hóa được hay không; held item cũ có thể
  // chỉ là chuỗi tự do. Chuẩn hóa một lần sau khi Pokédex Showdown tải xong,
  // giữ nguyên uid nên F5 không làm đổi Ability hoặc vật phẩm.
  useEffect(() => {
    if (pokedexStatus !== 'ready') return
    // Đợt 100: không chỉ đọc tin NHẬN Pokémon. Nếu các lượt sau (đặc biệt
    // tiến hoá/form) chính văn xác nhận lại giới tính thì evidence mới nhất
    // phải thắng roll/save cũ. Chỉ quét assistant canon, từ mới → cũ.
    const genderFromNarrativeHistory = (mon, entry) => {
      const candidates = (messages ?? []).filter((message) => message?.role === 'assistant').slice().reverse()
      const aliases = [entry?.name, entry?.species, mon?.evolvedFrom]
      for (const message of candidates) {
        const story = message.meta?.evidenceText || message.content || ''
        const inferred = inferPokemonGenderForMonFromStory(story, mon, aliases)
        if (inferred) return { gender: inferred, messageId: message.id ?? null }
      }
      return null
    }
    const upgrade = (mon, useNarrativeHistory = true) => {
      if (!mon) return mon
      const key = abilityId(mon.species ?? mon.name)
      const entry = (pokedexSpecies ?? []).find((item) =>
        abilityId(item.species) === key || abilityId(item.name) === key,
      )
      const narrativeGender = useNarrativeHistory ? genderFromNarrativeHistory(mon, entry) : null
      const withGender = ensurePokemonGender(narrativeGender
        ? {
          ...mon,
          gender: narrativeGender.gender,
          genderSource: 'story',
          ...(narrativeGender.messageId ? { genderEvidenceMessageId: narrativeGender.messageId } : {}),
        }
        : mon, entry)
      const normalized = ensureMonAbility(normalizeFriendship(withGender, entry?.baseFriendship), pokedexSpecies)
      // Đợt 111: save rất cũ có thể chỉ có HP mà thiếu stats/baseStats/IV/EV.
      // Hydrate deterministic từ Pokédex, không random lại cá thể khi F5.
      const hydrated = {
        ...normalized,
        species: normalized.species ?? entry?.species ?? normalized.name,
        spriteId: normalized.spriteId ?? entry?.spriteId ?? entry?.species ?? normalized.species,
        types: normalized.types?.length ? normalized.types : (entry?.types ?? []),
        baseStats: normalized.baseStats ?? entry?.baseStats ?? null,
        ivs: normalized.ivs ?? { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
        evs: normalized.evs ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        nature: normalized.nature ?? 'Hardy',
        heldItem: normalizeHeldItem(normalized.heldItem),
        hasEvo: entry?.hasEvo ?? normalized.hasEvo ?? false,
        hasPrevo: entry?.hasPrevo ?? normalized.hasPrevo ?? false,
        baseSpeciesId: normalized.baseSpeciesId ?? entry?.baseSpeciesId ?? null,
      }
      const missingStats = !hydrated.stats || ['hp','atk','def','spa','spd','spe'].some((key) => !Number.isFinite(Number(hydrated.stats?.[key])))
      return missingStats && hydrated.baseStats ? recomputeMonStats(hydrated) : hydrated
    }
    setPlayerMon((cur) => upgrade(cur))
    setParty((cur) => (cur ?? []).map(upgrade))
    setPcBox((cur) => (cur ?? []).map(upgrade))
    setEnemyMon((cur) => upgrade(cur, false))
    // Snapshot đối thủ trong lịch sử cũng được vá để mở lại trận/lượt cũ vẫn
    // có đúng giới tính và sprite, không chỉ Pokémon đang đứng trên HUD.
    setMessages((cur) => (cur ?? []).map((message) => {
      let changed = false
      const next = { ...message }
      const upgradeOne = (mon) => {
        const upgraded = upgrade(mon, false)
        if (upgraded !== mon) changed = true
        return upgraded
      }
      if (message.enemySnapshot) next.enemySnapshot = upgradeOne(message.enemySnapshot)
      if (Array.isArray(message.enemySnapshots)) next.enemySnapshots = message.enemySnapshots.map(upgradeOne)
      if (message.battleRuntime?.enemy) next.battleRuntime = { ...message.battleRuntime, enemy: upgradeOne(message.battleRuntime.enemy) }
      if (Array.isArray(message.doubleBattleRuntime?.enemies)) {
        next.doubleBattleRuntime = { ...message.doubleBattleRuntime, enemies: message.doubleBattleRuntime.enemies.map(upgradeOne) }
      }
      return changed ? next : message
    }))
  }, [pokedexStatus, pokedexSpecies, setMessages, setParty, setPcBox, setPlayerMon])

  // --- Dữ liệu chiêu thức thật + learnset theo level, tự tải cùng lúc với
  // pokedex. movesDb = null cho tới khi tải xong — pickMoves() trong
  // pokemonSpecies.js tự fallback về hệ STAB cố định khi movesDb chưa có.
  const [movesDb, setMovesDb] = useState(null)
  const [movesDbStatus, setMovesDbStatus] = useState('idle') // idle|loading|ready|error
  const [movesDbError, setMovesDbError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setMovesDbStatus('loading')
    Promise.all([loadMovesData(), loadLearnsets()])
      .then(([movesData, learnsets]) => {
        if (cancelled) return
        // movesData.damaging: move có sát thương (hệ theo lượt dùng — giữ tên
        // field "moves" cũ để không đụng code hiện có). movesData.all: MỌI
        // move kể cả Status — bể chiêu combat anime + autocomplete.
        setMovesDb({ moves: movesData.damaging, allMoves: movesData.all, learnsets })
        setMovesDbStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setMovesDbStatus('error')
        setMovesDbError(err.message)
        // movesDb giữ nguyên null — mọi nơi build mon tự fallback về hệ chiêu cũ.
      })
    return () => {
      cancelled = true
    }
  }, [])


  // Đợt 98: chữa save cũ và tự mở rộng sang toàn bộ level-up move hợp lệ ngay
  // khi learnset sẵn sàng; giữ PP/dấu sao và không còn cắt còn bốn chiêu.
  useEffect(() => {
    if (movesDbStatus !== 'ready' || !movesDb?.allMoves) return
    const repair = (mon) => repairOwnedMonMoves(mon, movesDb)
    setPlayerMon((cur) => repair(cur))
    setParty((cur) => (cur ?? []).map(repair))
    setPcBox((cur) => (cur ?? []).map(repair))
  }, [movesDb, movesDbStatus, setParty, setPcBox, setPlayerMon])


  // Đợt 83: Pokémon hoang/NPC có thể được dựng trước khi learnset tải xong,
  // khiến snapshot giữ vĩnh viễn bộ fallback hoặc trainer cấp thấp cầm TM
  // quá mạnh. Khi dữ liệu sẵn sàng, sửa cả enemy hiện tại lẫn snapshot đã lưu
  // trong message; chỉ thay moveset, không reset HP/status/runtime trận.
  useEffect(() => {
    if (movesDbStatus !== 'ready' || !movesDb?.allMoves || !pokedexSpecies?.length) return
    const findEntry = (mon) => {
      const key = abilityId(mon?.species ?? mon?.name)
      return (pokedexSpecies ?? []).find((entry) =>
        abilityId(entry.species) === key || abilityId(entry.name) === key,
      ) ?? null
    }
    const repairEncounter = (mon) => {
      if (!mon) return mon
      const entry = findEntry(mon)
      return entry ? repairEncounterMonMoves(mon, entry, movesDb, playerMon?.types ?? null) : mon
    }
    setEnemyMon((cur) => repairEncounter(cur))
    setMessages((cur) => (cur ?? []).map((message) => {
      let changed = false
      const next = { ...message }
      if (message.enemySnapshot) {
        const repaired = repairEncounter(message.enemySnapshot)
        if (repaired !== message.enemySnapshot) {
          next.enemySnapshot = repaired
          changed = true
        }
      }
      if (Array.isArray(message.enemySnapshots)) {
        const repaired = message.enemySnapshots.map(repairEncounter)
        if (repaired.some((mon, index) => mon !== message.enemySnapshots[index])) {
          next.enemySnapshots = repaired
          if (repaired[0]) next.enemySnapshot = repaired[0]
          changed = true
        }
      }
      if (message.battleRuntime?.enemy) {
        const repaired = repairEncounter(message.battleRuntime.enemy)
        if (repaired !== message.battleRuntime.enemy) {
          next.battleRuntime = { ...message.battleRuntime, enemy: repaired }
          changed = true
        }
      }
      if (Array.isArray(message.doubleBattleRuntime?.enemies)) {
        const repaired = message.doubleBattleRuntime.enemies.map(repairEncounter)
        if (repaired.some((mon, index) => mon !== message.doubleBattleRuntime.enemies[index])) {
          next.doubleBattleRuntime = { ...message.doubleBattleRuntime, enemies: repaired }
          changed = true
        }
      }
      return changed ? next : message
    }))
  }, [movesDb, movesDbStatus, playerMon?.types, pokedexSpecies, setEnemyMon, setMessages])

  const value = {
    adminMode,
    unlockAdmin,
    lockAdmin,
    apiConfig,
    setApiConfig,
    chatPreferences,
    setChatPreferences,
    character,
    setCharacter,
    worldbook,
    setWorldbook,
    messages,
    setMessages,
    resetChat,
    storyTone, setStoryTone,
    playerTraits, setPlayerTraits,
    storageFull,
    gameStarted,
    setGameStarted,
    playerName,
    setPlayerName,
    trainerId,
    trainerCode,
    resetTrainerIdentity,
    playerMon,
    setPlayerMon,
    enemyMon,
    setEnemyMon,
    resetBattle,
    battleOpen,
    setBattleOpen,
    playerLocation,
    setPlayerLocation,
    animeApiConfig,
    setAnimeApiConfig,
    memoryApiConfig,
    setMemoryApiConfig,
    playerIdentity,
    setPlayerIdentity,
    hunger,
    setHunger,
    adjustHunger,
    stateApiConfig,
    setStateApiConfig,
    stateApiConfig2,
    setStateApiConfig2,
    playerCharacter,
    setPlayerCharacter,
    storyDate,
    setStoryDate,
    advanceStoryDate,
    playerProfile,
    setPlayerProfile,
    bodyStatus,
    setBodyStatus,
    party,
    setParty,
    pcBox,
    setPcBox,
    setPokemonMoveStar,
    setPokemonNickname,
    worldProgress,
    setWorldProgress,
    dynamicState,
    setDynamicState,
    pokemonLife,
    setPokemonLife,
    tradeState,
    setTradeState,
    healAll,
    relationships,
    setRelationships,
    inventory,
    setInventory,
    pokedexSpecies,
    pokedexStatus,
    pokedexError,
    pokedexRecords,
    setPokedexRecords,
    markPokedexSeen,
    markPokedexCaught,
    movesDb,
    movesDbStatus,
    movesDbError,
    stylePreset,
    setStylePreset,
    mainPreset,
    setMainPreset,
    assistantPrefill,
    updateAssistantPrefill,
    outcomeApiConfig,
    setOutcomeApiConfig,
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame phải được dùng bên trong <GameProvider>')
  return ctx
}
