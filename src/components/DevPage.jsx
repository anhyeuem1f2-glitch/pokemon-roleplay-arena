import React, { useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { chatCompletion } from '../services/aiClient.js'
import { buildMainApiMessages } from '../utils/buildMainMessages.js'
import { cleanAiOutput } from '../utils/outputCleanup.js'
import { buildWildMon, buildBossMon, buildMonSmart } from '../data/pokemonSpecies.js'
import { BOSS_TIERS, getBossTier } from '../data/bossTiers.js'
import MonAvatar from './MonAvatar.jsx'
import SidePicker from './SidePicker.jsx'
import AnimeBattleTester from './AnimeBattleTester.jsx'
import UiTester from './UiTester.jsx'
import TypeBadge from './TypeBadge.jsx'
import BattleModal from './BattleModal.jsx'
import ShopModal from './ShopModal.jsx'
import SafariModal from './SafariModal.jsx'
import SimulationTester from './SimulationTester.jsx'
import RegionMap from './RegionMap.jsx'
import MusicWidget from './MusicWidget.jsx'
import { musicManager } from '../utils/musicManager.js'
import { BATTLE_ENVS, getBattleEnv } from '../data/battleEnvironments.js'
import { wildLevel, trainerMonLevel, WILD_ROLES, TRAINER_TIERS } from '../data/levelLogic.js'
import { REGIONS, getArea } from '../data/regions.js'
import { getWeather } from '../data/weather.js'
import { REGION_VILLAINS } from '../data/storyDirector.js'

// Tool test 1 lượt gọi API CHÍNH độc lập, không đụng tới lịch sử/tiến trình
// truyện thật — dùng để test nhanh mà không phải tạo lại nhân vật mỗi lần.
// Dùng chung cho cả tab "Test chính văn" lẫn "Test NSFW" vì về kỹ thuật đây
// là cùng 1 pipeline (API chính + preset nếu có) — khác nhau chỉ ở nội dung
// bạn gõ vào để test.
function SinglePromptTester({ placeholder }) {
  const { apiConfig, character, playerName, stylePreset, mainPreset, assistantPrefill } = useGame()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [showRaw, setShowRaw] = useState(false)

  async function handleTest() {
    if (!input.trim() || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const { apiMessages, callOptions, regexScripts } = buildMainApiMessages({
        character,
        playerName,
        stylePreset,
        mainPreset,
        history: [{ role: 'user', content: input.trim() }],
        scanText: input.trim(),
      })
      callOptions.assistantPrefill = assistantPrefill

      const raw = await chatCompletion(apiConfig, apiMessages, callOptions)
      const cleaned = cleanAiOutput(raw, regexScripts)
      setResult({
        systemMessages: apiMessages.filter((m) => m.role === 'system'),
        raw,
        cleaned,
        charCount: cleaned.length,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel">
      <div className="field">
        <label>Tin nhắn test</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          style={{ minHeight: 90 }}
        />
      </div>
      <button className="btn btn--primary" onClick={handleTest} disabled={loading}>
        {loading ? 'Đang gọi API...' : 'Gửi test'}
      </button>

      {error && (
        <div className="status-pill status-pill--error" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16 }}>
          <label>Kết quả (đã lọc <code>{'<thinking>'}</code>/thẻ phụ trợ) — {result.charCount} ký tự</label>
          <div
            style={{
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: 12,
              marginTop: 6,
              fontSize: 13.5,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              maxHeight: 320,
              overflowY: 'auto',
            }}
          >
            {result.cleaned || '(rỗng sau khi lọc)'}
          </div>

          <button className="btn" style={{ marginTop: 10, fontSize: 11, padding: '4px 10px' }} onClick={() => setShowRaw((v) => !v)}>
            {showRaw ? 'Ẩn' : 'Xem raw output + prompt đã gửi'}
          </button>

          {showRaw && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
                  raw output (trước khi lọc) — {result.raw.length} ký tự
                </div>
                <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--text-mid)' }}>
                  {result.raw}
                </pre>
              </div>
              {result.systemMessages.map((m, i) => (
                <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
                    system message #{i + 1} ({m.content.length} ký tự)
                  </div>
                  <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--text-mid)' }}>
                    {m.content || '(rỗng)'}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BattleTester() {
  const { setPlayerMon, setEnemyMon, pokedexSpecies, movesDb } = useGame()
  const [open, setOpen] = useState(false)
  const [safariOpen, setSafariOpen] = useState(false) // đợt 37
  const [lastOutcome, setLastOutcome] = useState(null)
  const [playerSpecies, setPlayerSpecies] = useState(null)
  const [enemySpecies, setEnemySpecies] = useState(null)
  const [playerLevel, setPlayerLevel] = useState(12)
  const [enemyLevel, setEnemyLevel] = useState(12)
  const [envKey, setEnvKey] = useState('none') // môi trường trận (đợt 35, khôi phục đợt 42)

  const ready = playerSpecies && enemySpecies

  function startBattle() {
    if (!ready) return
    setPlayerMon(buildMonSmart(playerSpecies, playerLevel, movesDb))
    setEnemyMon(buildMonSmart(enemySpecies, enemyLevel, movesDb))
    setLastOutcome(null)
    setOpen(true)
  }
  function startSafari() {
    // Safari chỉ cần Pokémon PHE ĐỊCH (con để bắt); phe mình tuỳ chọn.
    if (!enemySpecies) return
    setEnemyMon(buildMonSmart(enemySpecies, enemyLevel, movesDb))
    setLastOutcome(null)
    setSafariOpen(true)
  }

  return (
    <div className="panel">
      <h2 className="page-title">Test Battle</h2>
      <p className="page-subtitle">
        Tự chọn 2 Pokémon (từ danh sách pokedex đầy đủ) + level cho mỗi bên, không cần đi qua
        truyện thật.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <SidePicker
          label="Phe mình"
          species={playerSpecies}
          onChangeSpecies={setPlayerSpecies}
          level={playerLevel}
          onChangeLevel={setPlayerLevel}
          pokedexSpecies={pokedexSpecies}
        />
        <SidePicker
          label="Phe địch"
          species={enemySpecies}
          onChangeSpecies={setEnemySpecies}
          level={enemyLevel}
          onChangeLevel={setEnemyLevel}
          pokedexSpecies={pokedexSpecies}
        />
      </div>

      {/* Môi trường trận (đợt 35): thử hiệu ứng thời tiết/địa hình lên sát
          thương — trận trong truyện tự lấy từ thời tiết theo lịch. */}
      <div className="field">
        <label>Môi trường trận đấu</label>
        <select value={envKey} onChange={(e) => setEnvKey(e.target.value)}>
          {BATTLE_ENVS.map((en) => (
            <option key={en.key} value={en.key}>{en.label}</option>
          ))}
        </select>
        <small style={{ color: 'var(--text-dim)' }}>{getBattleEnv(envKey).desc}</small>
      </div>

      <div className="btn-row" style={{ gap: 8 }}>
        <button className="btn btn--primary" onClick={startBattle} disabled={!ready}>
          Bắt đầu trận
        </button>
        <button className="btn" onClick={startSafari} disabled={!enemySpecies} title="Thử chế độ Safari với Pokémon phe địch">
          🌿 Thử Safari (bắt Pokémon phe địch)
        </button>
      </div>

      {lastOutcome && (
        <div className="status-pill status-pill--ok" style={{ marginTop: 12 }}>
          Kết quả trận vừa rồi: {lastOutcome}
        </div>
      )}
      {open && (
        <BattleModal
          environment={envKey !== 'none' ? getBattleEnv(envKey) : null}
          devUnlockGimmicks
          onClose={() => setOpen(false)}
          onBattleEnd={(outcome) => {
            setLastOutcome(outcome)
            setOpen(false)
          }}
        />
      )}
      {safariOpen && (
        <SafariModal
          onClose={() => setSafariOpen(false)}
          onSafariEnd={(outcome) => {
            setLastOutcome('safari: ' + outcome)
            setSafariOpen(false)
          }}
        />
      )}
    </div>
  )
}

// ============ TEST NHẠC NỀN (đợt 35) ============
// Nghe thử từng track key ngay trong Dev — khỏi phải tạo nhân vật/vào truyện.
// Bấm track = đè override 'dev-music'; jingle phát 1 lần; Dừng = pop override.
const DEV_TRACK_KEYS = [
  'title', 'exploration', 'shop', 'battle', 'battle-wild', 'battle-boss', 'battle-legendary', 'battle-legendary-high',
  'region-kanto', 'region-johto', 'region-hoenn', 'region-sinnoh', 'region-unova', 'region-kalos', 'region-alola', 'region-galar', 'region-paldea',
  'area-town', 'area-city', 'area-forest', 'area-cave', 'area-sea', 'area-volcano', 'area-ice', 'area-tower', 'area-victory-road', 'area-endgame',
]
function MusicTester() {
  const [current, setCurrent] = useState(null)
  function play(key) {
    musicManager.pushOverride('dev-music', [key])
    setCurrent(key)
  }
  function stop() {
    musicManager.popOverride('dev-music')
    setCurrent(null)
  }
  return (
    <div className="panel">
      <h2 className="page-title">Test nhạc nền</h2>
      <p className="page-subtitle">
        Bấm 1 track để phát thử file trong <code>public/music/</code> (thiếu file → im lặng, xem tên
        đang phát trong widget). Jingle phát 1 lần rồi trả lại track đang thử.
      </p>
      <MusicWidget />
      <div className="btn-row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        {DEV_TRACK_KEYS.map((k) => (
          <button
            key={k}
            className="btn"
            style={{ fontSize: 11, ...(current === k ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : {}) }}
            onClick={() => play(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="btn-row" style={{ marginTop: 12, gap: 8 }}>
        <button className="btn" onClick={() => musicManager.playJingle(['victory'])}>▶ Jingle victory</button>
        <button className="btn" onClick={() => musicManager.playJingle(['defeat'])}>▶ Jingle defeat</button>
        <button className="btn" onClick={stop}>■ Dừng test</button>
      </div>
      <small style={{ display: 'block', marginTop: 10, color: 'var(--text-dim)' }}>
        Danh sách tên file chuẩn + fallback: public/music/README.txt. Nhớ click vào trang 1 lần nếu
        trình duyệt chặn autoplay.
      </small>
    </div>
  )
}

// ============ TEST GIAO THỨC LEVEL (đợt 40) ============
// Xem engine level đa yếu tố cho ra gì theo khu / vai trò cá thể / thân phận
// trainer — khỏi phải vào truyện thử.
function LevelTester() {
  const { pokedexSpecies } = useGame()
  const [regionKey, setRegionKey] = useState('kanto')
  const [areaKey, setAreaKey] = useState('pallet')
  const [role, setRole] = useState('normal')
  const [speciesName, setSpeciesName] = useState('Charmander')
  const [tier, setTier] = useState('rookie')
  const [age, setAge] = useState(16)
  const region = REGIONS.find((r) => r.key === regionKey) ?? REGIONS[0]
  const entry = pokedexSpecies.find((e) => e.name.toLowerCase() === speciesName.trim().toLowerCase()) ?? null
  const loc = { regionKey, areaKey }
  function sample(fn, n = 400) {
    const a = []
    for (let i = 0; i < n; i++) a.push(fn())
    a.sort((x, y) => x - y)
    return `${a[0]}–${a[n >> 1]}–${a[n - 1]} (min–median–max)`
  }
  return (
    <div className="panel">
      <h2 className="page-title">Test giao thức Level</h2>
      <p className="page-subtitle">
        Level không theo sức người chơi mà theo hoàn cảnh thế giới: khu an toàn/hiểm, có champion canh
        không, con non/đầu đàn, giai đoạn tiến hoá; NPC trainer thì theo thân phận + tuổi + kinh nghiệm.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="field">
          <label>Vùng</label>
          <select value={regionKey} onChange={(e) => { setRegionKey(e.target.value); setAreaKey(REGIONS.find((r) => r.key === e.target.value).areas[0].key) }}>
            {REGIONS.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Khu</label>
          <select value={areaKey} onChange={(e) => setAreaKey(e.target.value)}>
            {region.areas.map((a) => <option key={a.key} value={a.key}>{a.name} (nền {a.level?.[0]}-{a.level?.[1]})</option>)}
          </select>
        </div>
        <div className="field">
          <label>Loài (hoang dã)</label>
          <input value={speciesName} onChange={(e) => setSpeciesName(e.target.value)} placeholder="VD Charmander" />
        </div>
        <div className="field">
          <label>Vai trò cá thể</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {Object.entries(WILD_ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>
      <div className="status-pill status-pill--ok" style={{ marginTop: 8 }}>
        Hoang dã {speciesName} @ {getArea(regionKey, areaKey)?.name} ({WILD_ROLES[role].label}):{' '}
        {entry ? sample(() => wildLevel({ location: loc, entry, role }).level) : '⚠ chưa khớp loài trong pokedex'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <div className="field">
          <label>Thân phận trainer NPC</label>
          <select value={tier} onChange={(e) => setTier(e.target.value)}>
            {Object.entries(TRAINER_TIERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Tuổi trainer</label>
          <input type="number" value={age} onChange={(e) => setAge(Number(e.target.value))} />
        </div>
      </div>
      <div className="status-pill status-pill--ok">
        Đội NPC {TRAINER_TIERS[tier].label} ({age}t) @ {region.name}: quân đầu Lv
        {trainerMonLevel({ tier, age, slot: 0, teamSize: 6, location: loc })} → quân chủ lực Lv
        {trainerMonLevel({ tier, age, slot: 5, teamSize: 6, location: loc })}
      </div>
    </div>
  )
}

// ============ TEST SHOP (đợt 36) ============
// Mở thẳng giỏ hàng như khi truyện chạm tag [[SHOP]] — đủ hàng trainer lẫn
// dân sự (đồ ăn, sinh hoạt, thức ăn Pokémon). Mua thử trừ tiền/cộng túi đồ
// THẬT của người chơi hiện tại.
function ShopTester() {
  const { playerProfile, setPlayerProfile, setInventory } = useGame()
  const [open, setOpen] = useState(false)
  const [lastBuy, setLastBuy] = useState(null)
  const [shopName, setShopName] = useState('Cửa hàng bách hoá Ánh Dương')
  const [shopType, setShopType] = useState('bách hoá')
  const [shopSize, setShopSize] = useState('vừa')
  return (
    <div className="panel">
      <h2 className="page-title">Test Shop</h2>
      <p className="page-subtitle">
        Giỏ hàng động: đổi loại/quy mô để xem hàng tự sinh (trainer = bóng/thuốc như game; dân dụng
        sinh 30-300 món có thương hiệu). Hỏi/mặc cả với chủ quán ngay trong modal. Tiền hiện tại:
        ₽{playerProfile.money.toLocaleString('vi-VN')} (mua thử trừ thật).
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        <input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Tên cửa hàng" />
        <select value={shopType} onChange={(e) => setShopType(e.target.value)}>
          {['trainer', 'tạp hoá', 'quần áo', 'dã ngoại', 'leo núi', 'bách hoá'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={shopSize} onChange={(e) => setShopSize(e.target.value)}>
          {['nhỏ', 'vừa', 'lớn'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <button className="btn btn--primary" onClick={() => setOpen(true)}>🛒 Mở cửa hàng test</button>
      {lastBuy && (
        <div className="status-pill status-pill--ok" style={{ marginTop: 12 }}>{lastBuy}</div>
      )}
      {open && (
        <ShopModal
          shop={{ name: shopName, type: shopType, size: shopSize }}
          shopName={shopName}
          money={playerProfile.money}
          onClose={() => setOpen(false)}
          onFinish={(bought, total) => {
            setOpen(false)
            if (!bought.length) return
            setPlayerProfile((prof) => ({ ...prof, money: prof.money - total }))
            setInventory((inv) => {
              const next = [...inv]
              for (const b of bought) {
                const i = next.findIndex((it) => it.id === b.id)
                if (i >= 0) next[i] = { ...next[i], qty: next[i].qty + b.qty }
                else next.push({ id: b.id, name: b.name, qty: b.qty })
              }
              return next
            })
            setLastBuy(`Đã mua ${bought.map((b) => b.name + ' x' + b.qty).join(', ')} — tổng ₽${total.toLocaleString('vi-VN')}`)
          }}
        />
      )}
    </div>
  )
}

// ============ TEST MAP (đợt 35) ============
// Xem bản đồ 9 vùng + ảnh public/maps/ + thời tiết hôm nay của từng khu —
// khỏi phải tạo nhân vật. Vị trí chọn ở đây KHÔNG ảnh hưởng truyện đang chơi
// (state cục bộ), trừ khi bấm nút "Đặt làm vị trí người chơi".
function MapTester() {
  const { playerLocation, setPlayerLocation, storyDate } = useGame()
  const [loc, setLoc] = useState(playerLocation ?? { regionKey: 'kanto', areaKey: 'pallet' })
  const w = getWeather(storyDate, loc)
  return (
    <div className="panel">
      <h2 className="page-title">Test map</h2>
      <p className="page-subtitle">
        Duyệt 9 vùng, xem ảnh bản đồ (nếu đã bỏ file vào <code>public/maps/</code>), thời tiết hôm
        nay ({storyDate.day}/{storyDate.month}/{storyDate.year}) và tổ chức phản diện của vùng.
      </p>
      <RegionMap location={loc} onSetLocation={setLoc} />
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-mid)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>{w.icon} Thời tiết hôm nay tại khu đang chọn (mùa {w.season}): {w.label}</span>
        <span>🕵️ Phản diện vùng: {REGION_VILLAINS[loc.regionKey] ?? '—'}</span>
      </div>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={() => setPlayerLocation(loc)}>
          Đặt làm vị trí người chơi (ảnh hưởng truyện + nhạc khu vực)
        </button>
      </div>
    </div>
  )
}

// Test nhanh xem sprite Pokémon Showdown có load được cho từng loài không —
// lọc theo tên, xem cả 2 hướng (trước/sau lưng) cùng lúc.
function SpeciesTester() {
  const { pokedexSpecies, pokedexStatus, pokedexError } = useGame()
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const filtered = q
    ? pokedexSpecies.filter((s) => s.name.toLowerCase().includes(q) || s.species.includes(q))
    : pokedexSpecies

  return (
    <div className="panel">
      <h2 className="page-title">Test model Pokémon</h2>
      <p className="page-subtitle">
        Kiểm tra sprite Showdown cho từng loài trong danh sách {pokedexSpecies.length} loài hiện
        có (mọi Gen + Mega + Gigantamax). Sprite lỗi sẽ tự rơi về icon tròn chữ cái đầu (fallback).
      </p>
      {pokedexStatus === 'loading' && (
        <div className="status-pill" style={{ display: 'block', width: 'fit-content', marginBottom: 12 }}>
          Đang tải pokedex đầy đủ từ Showdown...
        </div>
      )}
      {pokedexStatus === 'error' && (
        <div className="status-pill status-pill--error" style={{ display: 'block', width: 'fit-content', marginBottom: 12 }}>
          Tải pokedex đầy đủ thất bại ({pokedexError}) — đang dùng danh sách dự phòng 151 loài Gen 1.
        </div>
      )}
      {pokedexStatus === 'ready' && (
        <div className="status-pill status-pill--ok" style={{ display: 'block', width: 'fit-content', marginBottom: 12 }}>
          Đã tải xong {pokedexSpecies.length} loài từ Showdown.
        </div>
      )}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Tìm theo tên (VD: char, pika, dragon...)"
        style={{ display: 'block', marginBottom: 14 }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 12,
          maxHeight: 480,
          overflowY: 'auto',
        }}
      >
        {filtered.map((s) => {
          const mon = buildWildMon(s, 10)
          return (
            <div
              key={s.species}
              style={{
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', gap: 4 }}>
                <MonAvatar mon={mon} side="player" />
                <MonAvatar mon={mon} side="enemy" />
              </div>
              <span style={{ fontSize: 11.5, textAlign: 'center' }}>{s.name}</span>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
                {s.types.map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {filtered.length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Không tìm thấy loài nào khớp.</p>}
    </div>
  )
}

// Test đấu Boss: chọn 1 bậc (thấp/huyền ảo/đại diện game) → chọn 1 loài
// trong đúng bậc đó → chọn level (giới hạn theo trần của bậc) → chọn Pokémon
// phe mình + level → vào trận, boss có nhiều thanh máu theo đúng bậc.
function BossTester() {
  const { setPlayerMon, setEnemyMon, pokedexSpecies, movesDb } = useGame()
  const [tierKey, setTierKey] = useState('low')
  const [bossSpeciesName, setBossSpeciesName] = useState('')
  const [bossLevel, setBossLevel] = useState(BOSS_TIERS.low.maxLevel)
  const [playerSpecies, setPlayerSpecies] = useState(null)
  const [playerLevel, setPlayerLevel] = useState(50)
  const [open, setOpen] = useState(false)
  const [lastOutcome, setLastOutcome] = useState(null)
  const [notFoundWarning, setNotFoundWarning] = useState(null)

  const tier = BOSS_TIERS[tierKey]

  function handleTierChange(key) {
    setTierKey(key)
    setBossSpeciesName('')
    setBossLevel(BOSS_TIERS[key].maxLevel)
  }

  function startBoss() {
    if (!bossSpeciesName || !playerSpecies) return
    const entry = pokedexSpecies.find((s) => s.name === bossSpeciesName)
    if (!entry) {
      setNotFoundWarning(
        `Không tìm thấy "${bossSpeciesName}" trong pokedex đã tải — có thể tên chưa khớp đúng dữ liệu Showdown.`,
      )
      return
    }
    setNotFoundWarning(null)
    setPlayerMon(buildMonSmart(playerSpecies, playerLevel, movesDb))
    setEnemyMon(buildBossMon(entry, bossLevel, tier, movesDb))
    setLastOutcome(null)
    setOpen(true)
  }

  return (
    <div className="panel">
      <h2 className="page-title">Test Boss</h2>
      <p className="page-subtitle">
        Chọn 1 bậc, 1 loài huyền thoại/huyền ảo trong đúng bậc đó, boss sẽ có nhiều thanh máu +
        trần level cao hơn Pokémon thường.
      </p>

      <div className="field">
        <label>Bậc Boss</label>
        <div className="btn-row">
          {Object.values(BOSS_TIERS).map((t) => (
            <button
              key={t.key}
              className="btn"
              style={tierKey === t.key ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}
              onClick={() => handleTierChange(t.key)}
            >
              {t.label} (Lv≤{t.maxLevel}, {t.hpBars} thanh)
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Chọn loài (trong bậc "{tier.label}")</label>
        <select value={bossSpeciesName} onChange={(e) => setBossSpeciesName(e.target.value)}>
          <option value="">— Chọn loài —</option>
          {tier.species.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 11.5 }}>
            Level Boss: {bossLevel} (tối đa {tier.maxLevel})
          </label>
          <input
            type="range"
            min="1"
            max={tier.maxLevel}
            value={bossLevel}
            onChange={(e) => setBossLevel(Number(e.target.value))}
          />
        </div>
      </div>

      <SidePicker
        label="Pokémon phe mình"
        species={playerSpecies}
        onChangeSpecies={setPlayerSpecies}
        level={playerLevel}
        onChangeLevel={setPlayerLevel}
        pokedexSpecies={pokedexSpecies}
      />

      {notFoundWarning && (
        <div className="status-pill status-pill--error" style={{ marginBottom: 12, display: 'block', width: 'fit-content' }}>
          {notFoundWarning}
        </div>
      )}

      <button className="btn btn--primary" onClick={startBoss} disabled={!bossSpeciesName || !playerSpecies}>
        Triệu hồi Boss
      </button>

      {lastOutcome && (
        <div className="status-pill status-pill--ok" style={{ marginTop: 12 }}>
          Kết quả trận vừa rồi: {lastOutcome}
        </div>
      )}
      {open && (
        <BattleModal
          onClose={() => setOpen(false)}
          onBattleEnd={(outcome) => {
            setLastOutcome(outcome)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

const TABS = [
  { id: 'text', label: 'Test chính văn' },
  { id: 'nsfw', label: 'Test NSFW' },
  { id: 'battle', label: 'Test Battle' },
  { id: 'boss', label: 'Test Boss' },
  { id: 'anime', label: 'Test Combat Anime (BETA)' },
  { id: 'ui', label: 'Test giao diện' },
  { id: 'species', label: 'Test model Pokémon' },
  { id: 'music', label: 'Test nhạc' },
  { id: 'map', label: 'Test map' },
  { id: 'shop', label: 'Test Shop' },
  { id: 'level', label: 'Test Level' },
  { id: 'sim', label: '🎮 Giả lập chơi' },
]

export default function DevPage({ onBack, onEnterGame }) {
  const [tab, setTab] = useState('text')
  const { pokedexStatus, movesDbStatus, movesDbError } = useGame()

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
      <button className="btn" style={{ marginBottom: 16 }} onClick={onBack}>
        ← Quay lại
      </button>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 className="page-title">Chế độ Dev</h2>
        <p className="page-subtitle" style={{ marginBottom: 14 }}>
          Test nhanh từng phần riêng lẻ, không cần tạo lại nhân vật mỗi lần. Dùng chung cấu hình
          API/preset/character card hiện tại của bạn.
        </p>
        <div className="btn-row" style={{ marginBottom: 14 }}>
          <span className={`status-pill ${pokedexStatus === 'ready' ? 'status-pill--ok' : ''}`}>
            Pokedex: {pokedexStatus === 'ready' ? 'đã tải xong' : pokedexStatus === 'loading' ? 'đang tải...' : pokedexStatus === 'error' ? 'lỗi, dùng fallback' : 'chưa tải'}
          </span>
          <span className={`status-pill ${movesDbStatus === 'ready' ? 'status-pill--ok' : movesDbStatus === 'error' ? 'status-pill--error' : ''}`}>
            Chiêu thức thật:{' '}
            {movesDbStatus === 'ready'
              ? 'đã tải xong'
              : movesDbStatus === 'loading'
                ? 'đang tải...'
                : movesDbStatus === 'error'
                  ? `lỗi (${movesDbError}) — dùng chiêu STAB mặc định`
                  : 'chưa tải'}
          </span>
        </div>
        <div className="btn-row">
          {TABS.map((t) => (
            <button
              key={t.id}
              className="btn"
              style={tab === t.id ? { borderColor: 'var(--mint)', color: 'var(--mint)' } : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'text' && (
        <SinglePromptTester placeholder="Gõ 1 tin nhắn bất kỳ để test API chính viết chính văn, VD: 'Elira dẫn tôi đi dạo quanh trạm dừng chân.'" />
      )}
      {tab === 'nsfw' && (
        <SinglePromptTester placeholder="Gõ nội dung test NSFW của riêng bạn ở đây — dùng cùng pipeline với Test chính văn." />
      )}
      {tab === 'battle' && <BattleTester />}
      {tab === 'boss' && <BossTester />}
      {tab === 'anime' && (
        <>
          <div className="status-pill" style={{ marginBottom: 12, background: 'rgba(232,184,74,0.12)', border: '1px solid var(--amber)', color: 'var(--amber)' }}>
            ⚠ Chế độ combat Anime đang BETA — chỉ thử nghiệm trong Dev, CHƯA đưa vào lối chơi chính (khi chơi thật, trận đấu dùng chế độ game gốc theo lượt).
          </div>
          <AnimeBattleTester />
        </>
      )}
      {tab === 'ui' && <UiTester />}
      {tab === 'species' && <SpeciesTester />}
      {tab === 'music' && <MusicTester />}
      {tab === 'map' && <MapTester />}
      {tab === 'shop' && <ShopTester />}
      {tab === 'level' && <LevelTester />}
      {tab === 'sim' && <SimulationTester onEnterGame={onEnterGame} />}
    </div>
  )
}
