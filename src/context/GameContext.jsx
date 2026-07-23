import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { SAMPLE_CHARACTER, SAMPLE_PLAYER_MON, SAMPLE_ENEMY_MON } from '../data/sampleData.js'
import { POKEMON_SPECIES } from '../data/pokemonSpecies.js'
import { loadFullPokedex } from '../utils/pokedexFetch.js'
import { loadMovesData, loadLearnsets } from '../utils/movesFetch.js'

const STORAGE_KEY = 'trainer-arena:api-config'

const GameContext = createContext(null)

export function GameProvider({ children }) {
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
      maxTokens: 1024,
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

  // --- Tông truyện (đợt 50): độ khó + thể loại, chọn ở màn tạo nhân vật ---
  const [storyTone, setStoryToneState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:story-tone')
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return { difficulty: 'anime', genres: [] }
  })
  const setStoryTone = useCallback((next) => {
    setStoryToneState((cur) => {
      const resolved = typeof next === 'function' ? next(cur) : next
      try { localStorage.setItem('trainer-arena:story-tone', JSON.stringify(resolved)) } catch { /* ignore */ }
      return resolved
    })
  }, [])

  // --- Lịch sử chat roleplay (đợt 46: PERSIST — F5 không mất truyện) ---
  // Trước đây messages chỉ sống trong phiên: reload giữa chừng là mất sạch
  // chính văn trong khi tiền/túi đồ/vị trí vẫn còn → lệch nhau rất khó chịu.
  const [messages, setMessagesState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:messages')
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return []
  })
  const setMessages = useCallback((next) => {
    setMessagesState((cur) => {
      const resolved = typeof next === 'function' ? next(cur) : next
      // Truyện dài có thể vượt quota localStorage — lỗi chỉ bỏ qua, phiên
      // hiện tại vẫn chạy bình thường (chỉ mất khả năng khôi phục sau F5).
      try { localStorage.setItem('trainer-arena:messages', JSON.stringify(resolved)) } catch { /* ignore */ }
      return resolved
    })
  }, [])
  const resetChat = useCallback(() => setMessages([]), [setMessages])

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

  // --- State chiến đấu ---
  // playerMon persist (đợt 46): party đã persist mà con đang ra trận thì
  // không → F5 xong HUD hiện nhầm mon mẫu dù đội hình thật vẫn còn.
  const [playerMon, setPlayerMonState] = useState(() => {
    try {
      const saved = localStorage.getItem('trainer-arena:player-mon')
      if (saved !== null) return JSON.parse(saved) // có thể là null hợp lệ (tay trắng)
    } catch { /* ignore */ }
    return SAMPLE_PLAYER_MON
  })
  const setPlayerMon = useCallback((next) => {
    setPlayerMonState((cur) => {
      const resolved = typeof next === 'function' ? next(cur) : next
      try { localStorage.setItem('trainer-arena:player-mon', JSON.stringify(resolved ?? null)) } catch { /* ignore */ }
      return resolved
    })
  }, [])
  const [enemyMon, setEnemyMon] = useState(SAMPLE_ENEMY_MON)

  const resetBattle = useCallback(() => {
    // Null-guard (đợt 32): chế độ khởi đầu "tay trắng" có thể chưa có
    // playerMon — đừng crash.
    setPlayerMon((m) => (m ? { ...m, hp: m.maxHp, status: null, sleepTurns: undefined } : m))
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
    setHungerState(next)
    try { localStorage.setItem('trainer-arena:hunger', JSON.stringify(next)) } catch { /* ignore */ }
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
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  // Đợt 36: nhận CẢ functional updater (bài học vụ setPlayerMon crash — mọi
  // setter persist đều phải an toàn với cả 2 dạng gọi).
  const setParty = useCallback((next) => {
    setPartyState((cur) => {
      const resolved = (typeof next === 'function' ? next(cur) : next).slice(0, 6)
      try { localStorage.setItem('trainer-arena:party', JSON.stringify(resolved)) } catch { /* ignore */ }
      return resolved
    })
  }, [])

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
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const setPlayerLocation = useCallback((loc) => {
    setPlayerLocationState(loc)
    try {
      if (loc) localStorage.setItem('trainer-arena:player-location', JSON.stringify(loc))
      else localStorage.removeItem('trainer-arena:player-location')
    } catch {
      /* ignore */
    }
  }, [])

  // --- Pokedex đầy đủ (mọi Gen + Mega + Gigantamax), tự tải từ Showdown lúc
  // khởi động. Mặc định dùng 151 loài Gen 1 tĩnh (POKEMON_SPECIES) cho tới
  // khi tải xong hoặc nếu tải lỗi (mạng chặn, CORS...) thì giữ nguyên fallback.
  const [pokedexSpecies, setPokedexSpecies] = useState(POKEMON_SPECIES)
  const [pokedexStatus, setPokedexStatus] = useState('idle') // idle|loading|ready|error
  const [pokedexError, setPokedexError] = useState(null)

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

  const value = {
    apiConfig,
    setApiConfig,
    character,
    setCharacter,
    worldbook,
    setWorldbook,
    messages,
    setMessages,
    resetChat,
    storyTone, setStoryTone,
    gameStarted,
    setGameStarted,
    playerName,
    setPlayerName,
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
    relationships,
    setRelationships,
    inventory,
    setInventory,
    pokedexSpecies,
    pokedexStatus,
    pokedexError,
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
