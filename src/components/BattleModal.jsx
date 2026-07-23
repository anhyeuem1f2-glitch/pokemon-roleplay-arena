import React, { useState, useRef, useMemo } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { chatCompletion } from '../services/aiClient.js'
import { cleanAiOutput } from '../utils/outputCleanup.js'
import { getEffectivenessMulti } from '../data/pokemonTypes.js'
import { getLegendLore, GENERIC_LEGEND_PERSUASION } from '../data/legendLore.js'
import { buildWildMon } from '../data/pokemonSpecies.js'
import { TYPE_COLORS } from '../data/pokemonTypes.js'
import { applyEnvToDamage } from '../data/battleEnvironments.js'
import HealthBar from './HealthBar.jsx'
import TypeBadge from './TypeBadge.jsx'
import MonAvatar from './MonAvatar.jsx'

// Hiệu ứng trạng thái — đợt đầu tiên (bỏng/tê liệt/ngủ), sẽ bổ sung dần theo
// yêu cầu (VD độc, đóng băng, giảm/tăng chỉ số theo giai đoạn...).
const STATUS_INFO = {
  brn: { label: 'Bỏng', short: 'BRN', color: 'var(--coral)' },
  par: { label: 'Tê liệt', short: 'PAR', color: 'var(--amber)' },
  slp: { label: 'Ngủ', short: 'SLP', color: 'var(--text-dim)' },
}

// Công thức sát thương RÚT GỌN cho bản demo giao diện.
// TODO (mở rộng sau): crit, item, ability, thứ tự hành động theo Speed...
// theo đúng công thức Pokémon gốc.
// Công thức sát thương — ưu tiên dùng ĐÚNG Atk/Def hoặc SpAtk/SpDef thật của
// từng loài (khi đã có baseStats thật từ Showdown) theo tinh thần công thức
// gốc của game Pokémon: dame phụ thuộc đúng loại chiêu (Physical dùng
// Atk/Def, Special dùng SpAtk/SpDef) — không còn kiểu "chiêu power cao nhất
// là tối ưu" bất kể stat có hợp hay không. Có random 0.85-1.00 giống game gốc.
// ===== BẬC CHỈ SỐ (stat stages, đợt 27) =====
// Đúng game gốc: mỗi chỉ số có bậc -6..+6, hệ số = (2+bậc)/2 khi dương,
// 2/(2-bậc) khi âm (VD +2 = x2, -1 = x0.67). Bậc tăng/giảm từ hiệu ứng phụ
// của chiêu (secondary.boosts lên đối thủ, self.boosts lên chính mình).
export const STAGE_ZERO = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
const STAGE_STAT_LABELS = { atk: 'Tấn công', def: 'Phòng thủ', spa: 'TC đặc biệt', spd: 'PT đặc biệt', spe: 'Tốc độ' }

export function stageMult(stage) {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage)
}

function computeDamage(move, attacker, defender, atkStages = STAGE_ZERO, defStages = STAGE_ZERO) {
  if (move.power <= 0) return 0
  const eff = getEffectivenessMulti(move.type, defender.types)
  // STAB có xét TERASTAL (đợt 30, đúng cơ chế Gen 9): tera trùng hệ GỐC →
  // x2.0 cho hệ đó; hệ gốc còn lại vẫn giữ STAB 1.5 dù types hiện tại đã đổi.
  let stab = 1
  if (attacker.tera) {
    if (move.type === attacker.tera) {
      stab = (attacker.origTypes ?? []).includes(move.type) ? 2 : 1.5
    } else if ((attacker.origTypes ?? []).includes(move.type)) {
      stab = 1.5
    }
  } else if (attacker.types.includes(move.type)) {
    stab = 1.5
  }
  const randomFactor = (85 + Math.floor(Math.random() * 16)) / 100
  const levelFactor = (2 * attacker.level) / 5 + 2
  // Bỏng giảm 1 nửa sát thương chiêu Vật Lý gây ra — đúng cơ chế game gốc.
  const burnPenalty = attacker.status === 'brn' && move.category !== 'Special' ? 0.5 : 1
  const isSpecial = move.category === 'Special'
  const atkStageMult = stageMult(atkStages[isSpecial ? 'spa' : 'atk'] ?? 0)
  const defStageMult = stageMult(defStages[isSpecial ? 'spd' : 'def'] ?? 0)

  if (attacker.stats && defender.stats) {
    const atkStat = (isSpecial ? attacker.stats.spa : attacker.stats.atk) * burnPenalty * atkStageMult
    const defStat = (isSpecial ? defender.stats.spd : defender.stats.def) * defStageMult
    const base = (levelFactor * move.power * (atkStat / defStat)) / 50 + 2
    return Math.max(1, Math.round(base * stab * eff * randomFactor))
  }

  // Fallback khi 1 trong 2 bên không có baseStats thật (VD loài dự phòng
  // trong danh sách 151 tĩnh) — dùng tỉ lệ chênh lệch level thay cho Atk/Def.
  const base = (levelFactor * move.power * burnPenalty) / 50 + 2
  const levelRatio = (attacker.level / defender.level) * (atkStageMult / defStageMult)
  return Math.max(1, Math.round(base * levelRatio * stab * eff * randomFactor))
}

function effLabel(mult) {
  if (mult > 1) return 'Hiệu quả tốt!'
  if (mult < 1 && mult > 0) return 'Hiệu quả không tốt...'
  if (mult === 0) return 'Không có tác dụng.'
  return null
}

// Bảng thông tin (tên/level/type/HP) của 1 bên, KHÔNG kèm sprite —
// dùng trong layout sân đấu để đặt lệch nhau kiểu game gốc.
// Chip bậc chỉ số: chỉ hiện bậc khác 0, xanh khi dương, đỏ khi âm — trả lời
// đúng câu "sao biết tấn công đã tăng giảm bao nhiêu bậc".
function StageChips({ stages }) {
  const entries = Object.entries(stages ?? {}).filter(([, v]) => v !== 0)
  if (entries.length === 0) return null
  const short = { atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' }
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
      {entries.map(([k, v]) => (
        <span
          key={k}
          style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', padding: '1px 6px', borderRadius: 999,
            border: `1px solid ${v > 0 ? 'var(--mint)' : '#d94f4f'}`,
            color: v > 0 ? 'var(--mint)' : '#d94f4f',
          }}
        >
          {short[k]} {v > 0 ? '+' : ''}{v}
        </span>
      ))}
    </div>
  )
}

function StatusCard({ mon, align, stages }) {
  return (
    <div
      className="panel"
      style={{
        padding: '8px 12px',
        minWidth: 150,
        background: 'var(--bg-panel)',
        textAlign: align,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <strong style={{ fontSize: 13 }}>{mon.name}</strong>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-mid)' }}>
          Lv.{mon.level}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4, margin: '4px 0 6px', justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
        {mon.types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
        {mon.tera && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 999, color: '#0d1a16', background: TYPE_COLORS[mon.tera] ?? '#5fd7e8' }}>
            💎 TERA {mon.tera.toUpperCase()}
          </span>
        )}
        {mon.dyna && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 999, color: '#fff', background: '#d93a3a' }}>
            DMAX
          </span>
        )}
        {mon.status && STATUS_INFO[mon.status] && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9.5,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 999,
              color: '#0d1a16',
              background: STATUS_INFO[mon.status].color,
            }}
          >
            {STATUS_INFO[mon.status].short}
          </span>
        )}
      </div>
      <HealthBar hp={mon.hp} maxHp={mon.maxHp} bars={mon.bossBars ?? 1} />
      <StageChips stages={stages} />
    </div>
  )
}

// Sân đấu kiểu Pokémon cổ điển: địch ở góc trên-phải (bảng info trên-trái,
// sprite trên-phải), mình ở góc dưới-trái (sprite dưới-trái, bảng info dưới-phải).
function Battlefield({ playerMon, enemyMon, pStages, eStages }) {
  return (
    <div
      style={{
        position: 'relative',
        height: 210,
        borderRadius: 8,
        marginBottom: 12,
        background: 'linear-gradient(to bottom, #1b2734 0%, #1b2734 58%, #26362a 58%, #26362a 100%)',
        border: '1px solid var(--line)',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: 10, left: 10 }}>
        <StatusCard mon={enemyMon} align="left" stages={eStages} />
      </div>
      <div style={{ position: 'absolute', top: 14, right: 18 }}>
        <MonAvatar mon={enemyMon} side="enemy" />
      </div>
      <div
        style={{
          position: 'absolute', bottom: 14, left: 18,
          transform: playerMon.dyna ? 'scale(1.55)' : 'none',
          transformOrigin: 'bottom left',
          transition: 'transform 0.5s ease',
          filter: playerMon.dyna ? 'drop-shadow(0 0 10px rgba(255,60,60,0.75))' : 'none',
        }}
      >
        <MonAvatar mon={playerMon} side="player" />
      </div>
      <div style={{ position: 'absolute', bottom: 10, right: 10 }}>
        <StatusCard mon={playerMon} align="right" stages={pStages} />
      </div>
    </div>
  )
}

// ============ QUẠT CƠ CHẾ ĐẶC BIỆT (đợt 30) ============
// Nút TRÒN ở góc trên-trái ô 4 chiêu. Bấm → 4 nút tròn nhỏ XOÈ RA theo hình
// cái quạt, lần lượt TRÁI → PHẢI: MEGA, Z-MOVE, DYNAMAX, TERASTAL. Đúng luật
// game thật: mỗi trận chỉ dùng được 1 cơ chế (chọn 1 là các nút còn lại khoá).
// Đợt 34: chữ M/Z/D/T → BIỂU TƯỢNG; nút Tera đổi màu theo HỆ tera của
// Pokémon (options.tera.color truyền vào), nhãn Z-move trên nút chiêu đổi
// màu theo hệ chiêu. Cung quạt thu hẹp + wrapper thêm padding trái để nút
// Mega không bị cắt ngoài mép panel (bug phát hiện qua ảnh chụp của người
// dùng: góc 170° đẩy nút ra ngoài vùng nhìn).
const GIMMICK_META = {
  mega:    { icon: '🧬', label: 'Mega Evolution', color: '#c96ee8' },
  zmove:   { icon: '⚡', label: 'Z-Move',         color: '#e8b84a' },
  dynamax: { icon: '🌀', label: 'Dynamax',        color: '#e05252' },
  tera:    { icon: '💎', label: 'Terastal',       color: '#5fd7e8' },
}
const GIMMICK_ORDER = ['mega', 'zmove', 'dynamax', 'tera']

function GimmickFan({ open, onToggle, options, used, busy }) {
  // Cung quạt phía trên nút gốc: 150° (trái) → 15° (phải), bán kính 48px —
  // thu hẹp so với bản đầu để cả 4 nút nằm gọn trong panel.
  const R = 48
  const angles = [150, 105, 60, 15]
  return (
    <div style={{ position: 'relative', width: 36, height: 36 }}>
      {GIMMICK_ORDER.map((key, i) => {
        const meta = GIMMICK_META[key]
        const opt = options[key]
        const rad = (angles[i] * Math.PI) / 180
        const x = Math.cos(rad) * R
        const y = -Math.sin(rad) * R
        const isUsed = used === key
        const color = opt.color ?? meta.color
        const disabled = busy || Boolean(used) || !opt.available
        return (
          <button
            key={key}
            onClick={() => !disabled && opt.onPick()}
            title={isUsed ? `${meta.label} — đã dùng trong trận này` : opt.available ? meta.label : `${meta.label} — ${opt.reason}`}
            disabled={disabled}
            style={{
              position: 'absolute',
              left: '50%', top: '50%',
              width: 32, height: 32, borderRadius: '50%',
              border: `2px solid ${color}`,
              background: isUsed ? color : 'var(--bg-deep)',
              boxShadow: disabled ? 'none' : `0 0 6px ${color}66`,
              fontSize: 14, lineHeight: 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: open ? (disabled && !isUsed ? 0.35 : 1) : 0,
              transform: open
                ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1)`
                : 'translate(-50%, -50%) scale(0.2)',
              transition: `all 0.25s ease ${i * 0.04}s`,
              pointerEvents: open ? 'auto' : 'none',
              zIndex: 3,
            }}
          >
            {meta.icon}
          </button>
        )
      })}
      {/* Nút gốc hình tròn */}
      <button
        onClick={onToggle}
        title="Cơ chế đặc biệt: Mega / Z-Move / Dynamax / Terastal (1 lần mỗi trận)"
        style={{
          position: 'relative', zIndex: 4,
          width: 36, height: 36, borderRadius: '50%',
          border: '2px solid transparent',
          background:
            'linear-gradient(var(--bg-deep), var(--bg-deep)) padding-box, ' +
            'conic-gradient(#c96ee8, #e8b84a, #e05252, #5fd7e8, #c96ee8) border-box',
          color: 'var(--text-hi)', fontSize: 15, cursor: 'pointer',
          transform: open ? 'rotate(45deg)' : 'none',
          transition: 'transform 0.25s ease',
        }}
      >
        {used ? '✦' : '＋'}
      </button>
    </div>
  )
}

// Nút vuông kiểu menu chiến đấu Pokémon cổ điển (FIGHT / BAG / POKÉMON / RUN).
function MenuButton({ label, sub, color, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 2,
        padding: '12px 16px',
        borderRadius: 8,
        border: `1px solid ${color}`,
        background: 'var(--bg-deep)',
        color: disabled ? 'var(--text-dim)' : 'var(--text-hi)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color }}>{label}</span>
      {sub && <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{sub}</span>}
    </button>
  )
}

/**
 * Modal chiến đấu hình vuông, bật lên khi người chơi bấm quả pokeball
 * ngay trong dòng truyện. Menu chính kiểu Pokémon cổ điển: FIGHT / BAG /
 * POKÉMON / RUN. Khi trận kết thúc (thắng/thua/chạy trốn), gọi
 * onBattleEnd(outcome) với outcome ∈ {'win','lose','escaped'} để component
 * cha (RoleplayChat) tự động gửi kết quả cho AI viết tiếp truyện.
 *
 * isWild: hiện tại luôn coi là trận hoang dã (cho phép RUN). Khi hệ thống
 * phân biệt được trận với NPC/trainer (không được chạy), truyền isWild=false.
 */
// ID vật phẩm mở khoá từng gimmick (đợt 42) — người chơi phải CÓ trong túi
// mới dùng được, không tự có từ đầu. Khớp theo id hoặc tên (không phân biệt
// hoa thường) để linh hoạt với hàng mua/nhận qua truyện.
const GIMMICK_ITEMS = {
  mega: ['key-stone', 'mega-ring', 'mega-bracelet', 'key stone', 'mega'],
  zmove: ['z-ring', 'z-power-ring', 'z-crystal', 'z ring', 'z-power'],
  dynamax: ['dynamax-band', 'dynamax band'],
  tera: ['tera-orb', 'tera orb'],
}
function hasGimmickItem(inventory, kind) {
  const keys = GIMMICK_ITEMS[kind] ?? []
  return (inventory ?? []).some((it) => {
    const id = (it.id ?? '').toLowerCase()
    const name = (it.name ?? '').toLowerCase()
    return keys.some((k) => id.includes(k) || name.includes(k))
  })
}

export default function BattleModal({ onClose, onBattleEnd, isWild = true, environment = null, devUnlockGimmicks = false }) {
  const { playerMon, setPlayerMon, enemyMon, setEnemyMon, resetBattle, apiConfig, animeApiConfig, party, setParty, inventory, pokedexSpecies, movesDb } = useGame()
  const [log, setLog] = useState([`Một ${enemyMon.name} hoang dã xuất hiện!`])
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(false)
  // 'main' | 'fight' | 'bag' | 'party' | 'talk'
  const [menu, setMenu] = useState('main')
  // Lý do kết thúc đặc biệt do THUYẾT PHỤC: 'calm' (đối phương nguôi giận,
  // hoà), 'join' (Pokémon hoang dã bị dụ theo mình), 'flee' (đối phương bỏ
  // chạy). null = kết thúc thường (thắng/thua/tự chạy).
  const [endReason, setEndReason] = useState(null)
  const [talkInput, setTalkInput] = useState('')
  // Bậc chỉ số 2 bên (-6..+6). LƯU Ý: reset khi đóng/mở lại modal (Ẩn) —
  // chấp nhận trong bản này, ghi rõ ở README.
  const [pStages, setPStages] = useState({ ...STAGE_ZERO })
  const [eStages, setEStages] = useState({ ...STAGE_ZERO })

  // ============ CƠ CHẾ ĐẶC BIỆT (đợt 30): Mega / Z / Dynamax / Tera ============
  const [gimmickOpen, setGimmickOpen] = useState(false)
  const [gimmickUsed, setGimmickUsed] = useState(null) // 'mega'|'zmove'|'dynamax'|'tera' — 1 cơ chế/trận
  const [zArmed, setZArmed] = useState(false) // đã bấm Z → chọn 1 trong 4 chiêu để phóng bản Z
  const [dynaTurnsLeft, setDynaTurnsLeft] = useState(0)
  const [megaPickOpen, setMegaPickOpen] = useState(false) // loài có 2 mega (X/Y) → hỏi chọn
  const preGimmickRef = useRef(null) // bản gốc playerMon trước khi biến hình — để trả về khi hết trận

  // Các forme Mega của loài đang ra trận (dò từ pokedex thật: baseSpeciesId
  // trỏ về loài gốc + tên chứa "-Mega"). Charizard/Mewtwo có 2 bản X/Y.
  const megaFormes = useMemo(() => {
    if (!pokedexSpecies || playerMon.name.includes('-Mega')) return []
    return pokedexSpecies.filter(
      (e) => e.baseSpeciesId === playerMon.species && /-Mega/.test(e.name),
    )
  }, [pokedexSpecies, playerMon.species, playerMon.name])
  // Forme Gigantamax (nếu có) — dùng làm sprite khi Dynamax cho đẹp.
  const gmaxForme = useMemo(() => {
    if (!pokedexSpecies) return null
    return pokedexSpecies.find((e) => e.baseSpeciesId === playerMon.species && /-Gmax/.test(e.name)) ?? null
  }, [pokedexSpecies, playerMon.species])

  function backupOnce() {
    if (!preGimmickRef.current) preGimmickRef.current = { ...playerMon }
  }

  // MEGA: biến hình THẬT — stats/hệ/sprite của forme Mega ở cùng level, GIỮ
  // nguyên HP hiện tại (đúng game: base HP của Mega không đổi), giữ nguyên
  // 4 chiêu + trạng thái. Kéo dài hết trận.
  function doMega(megaEntry) {
    backupOnce()
    const built = buildWildMon(megaEntry, playerMon.level, movesDb)
    setPlayerMon({
      ...built,
      hp: Math.min(playerMon.hp, built.maxHp),
      moves: playerMon.moves,
      status: playerMon.status,
      sleepTurns: playerMon.sleepTurns,
    })
    setGimmickUsed('mega')
    setGimmickOpen(false)
    setMegaPickOpen(false)
    pushLog(`✦ ${playerMon.name} MEGA TIẾN HOÁ thành ${megaEntry.name}!`)
  }

  // Z-MOVE: bấm Z → chọn 1 chiêu SÁT THƯƠNG để phóng bản Z (power theo bảng
  // xấp xỉ game gốc: <60→100 … ≥140→200). Dùng đúng 1 lần.
  function zPower(p) {
    if (p >= 140) return 200
    if (p >= 130) return 195
    if (p >= 120) return 190
    if (p >= 110) return 185
    if (p >= 100) return 180
    if (p >= 90) return 175
    if (p >= 80) return 160
    if (p >= 70) return 140
    if (p >= 60) return 120
    return 100
  }

  // DYNAMAX: HP hiện tại + tối đa x2 trong 3 lượt, sprite phóng to (dùng forme
  // Gigantamax nếu loài có). Hết 3 lượt tự trở về, HP chia đôi theo tỉ lệ.
  function doDynamax() {
    backupOnce()
    setPlayerMon((m) => ({
      ...m,
      dyna: true,
      ...(gmaxForme ? { name: gmaxForme.name, spriteId: gmaxForme.spriteId } : {}),
      maxHp: m.maxHp * 2,
      hp: m.hp * 2,
    }))
    setDynaTurnsLeft(3)
    setGimmickUsed('dynamax')
    setGimmickOpen(false)
    pushLog(`✦ ${playerMon.name} DYNAMAX — khổng lồ hoá trong 3 lượt${gmaxForme ? ` (dạng ${gmaxForme.name})` : ''}!`)
  }

  function endDynamax() {
    setPlayerMon((m) => ({
      ...m,
      dyna: false,
      name: preGimmickRef.current?.name ?? m.name,
      spriteId: preGimmickRef.current?.spriteId ?? m.spriteId,
      maxHp: Math.max(1, Math.round(m.maxHp / 2)),
      hp: Math.max(m.hp > 0 ? 1 : 0, Math.round(m.hp / 2)),
    }))
    pushLog(`${preGimmickRef.current?.name ?? playerMon.name} trở về kích thước bình thường.`)
  }

  // TERASTAL: kết tinh về HỆ CHÍNH của loài (đúng cơ chế: STAB hệ tera trùng
  // hệ gốc = x2.0, hệ gốc còn lại vẫn 1.5) — cả phòng thủ cũng đổi theo hệ mới.
  function doTera() {
    backupOnce()
    const teraType = playerMon.types[0]
    setPlayerMon((m) => ({ ...m, tera: teraType, origTypes: m.types, types: [teraType] }))
    setGimmickUsed('tera')
    setGimmickOpen(false)
    pushLog(`✦ ${playerMon.name} TERASTAL — kết tinh hệ ${teraType.toUpperCase()}! (STAB hệ này x2)`)
  }

  // Trả mọi biến hình về bản gốc khi rời trận (Mega/Dyna/Tera đều chỉ tồn tại
  // trong trận — đúng game). Giữ HP hiện tại theo trần của bản gốc.
  function revertGimmicks() {
    const base = preGimmickRef.current
    if (!base) return
    setPlayerMon((cur) => ({
      ...base,
      hp: Math.min(cur.dyna ? Math.round(cur.hp / 2) : cur.hp, base.maxHp),
      status: cur.status,
      sleepTurns: cur.sleepTurns,
    }))
    preGimmickRef.current = null
  }

  // Áp boosts của chiêu lên 1 bên: dương = tăng bậc, âm = giảm; kẹp ±6; log
  // theo đúng văn game gốc (tăng/tăng mạnh/giảm/giảm mạnh; kịch bậc thì báo).
  function applyBoosts(boosts, side, targetName) {
    if (!boosts) return
    const setter = side === 'player' ? setPStages : setEStages
    setter((prev) => {
      const next = { ...prev }
      for (const [stat, delta] of Object.entries(boosts)) {
        if (!(stat in next) || !delta) continue
        const before = next[stat]
        next[stat] = Math.max(-6, Math.min(6, before + delta))
        const label = STAGE_STAT_LABELS[stat] ?? stat
        if (next[stat] === before) {
          pushLog(`${label} của ${targetName} không thể ${delta > 0 ? 'tăng' : 'giảm'} thêm nữa!`)
        } else {
          const word = delta >= 2 ? 'tăng mạnh' : delta === 1 ? 'tăng' : delta === -1 ? 'giảm' : 'giảm mạnh'
          pushLog(`${label} của ${targetName} ${word}! (bậc ${next[stat] > 0 ? '+' : ''}${next[stat]})`)
        }
      }
      return next
    })
  }
  // Chặn bấm "Tiếp tục câu chuyện" nhiều lần liên tiếp (tránh gửi trùng kết quả).
  const continuingRef = useRef(false)

  const battleOver = playerMon.hp <= 0 || enemyMon.hp <= 0

  function pushLog(line) {
    setLog((l) => [...l, line])
  }

  // Random xem chiêu có gây trạng thái phụ không (dựa theo % thật của move.secondary).
  // Có xét miễn nhiễm theo hệ đúng game gốc: hệ Lửa không bị bỏng, hệ Điện
  // không bị tê liệt (quy tắc Gen 6+).
  function rollStatus(move, defender) {
    const status = move.secondary?.status
    if (!status || !STATUS_INFO[status]) return null
    if (status === 'brn' && defender.types.includes('fire')) return null
    if (status === 'par' && defender.types.includes('electric')) return null
    const chance = move.secondary.chance ?? 100
    return Math.random() * 100 < chance ? status : null
  }

  // Kiểm tra 1 bên có hành động được lượt này không (ngủ/tê liệt) — trả về
  // false nếu bị chặn hành động, đồng thời tự cập nhật state (đếm ngược ngủ,
  // random tê liệt) và ghi log.
  function checkCanAct(mon, setMon, label) {
    if (mon.status === 'slp') {
      const turnsLeft = (mon.sleepTurns ?? 1) - 1
      if (turnsLeft > 0) {
        setMon((m) => ({ ...m, sleepTurns: turnsLeft }))
        pushLog(`${label} đang ngủ say, không thể hành động.`)
        return false
      }
      setMon((m) => ({ ...m, status: null, sleepTurns: undefined }))
      pushLog(`${label} đã tỉnh giấc!`)
      return true
    }
    if (mon.status === 'par' && Math.random() < 0.25) {
      pushLog(`${label} bị tê liệt, không thể cử động!`)
      return false
    }
    return true
  }

  async function handleMove(move) {
    if (busy || battleOver || finished) return
    setBusy(true)
    setMenu('main')

    // Dynamax kéo dài 3 LƯỢT HÀNH ĐỘNG của phe mình (đợt 30) — trừ bộ đếm
    // ngay đầu lượt, hết đếm thì trở về kích thước thường ở CUỐI lượt này.
    let dynaEnds = false
    if (playerMon.dyna && gimmickUsed === 'dynamax') {
      const left = dynaTurnsLeft - 1
      setDynaTurnsLeft(left)
      if (left <= 0) dynaEnds = true
    }

    let enemyHpNow = enemyMon.hp
    let playerHpNow = playerMon.hp
    // Theo dõi trạng thái địch CỤC BỘ trong lượt này — state React (enemyMon)
    // là closure cũ, trạng thái vừa gây ra trong cùng lượt sẽ KHÔNG kịp phản
    // ánh vào enemyMon.status nếu chỉ đọc từ state (bug cũ: địch vừa bị ru
    // ngủ vẫn hành động ngay lượt đó).
    let enemyStatusNow = enemyMon.status
    let enemyJustStatused = null

    const playerCanAct = checkCanAct(playerMon, setPlayerMon, playerMon.name)
    if (playerCanAct) {
      const dmgToEnemy = applyEnvToDamage(computeDamage(move, playerMon, enemyMon, pStages, eStages), move, environment)
      const effMult = getEffectivenessMulti(move.type, enemyMon.types)
      enemyHpNow = Math.max(0, enemyMon.hp - dmgToEnemy)
      setEnemyMon((m) => ({ ...m, hp: enemyHpNow }))

      if (move.power <= 0) {
        pushLog(`${playerMon.name} dùng ${move.name}.`)
      } else {
        pushLog(`${playerMon.name} dùng ${move.name}! Gây ${dmgToEnemy} sát thương.`)
        const label = effLabel(effMult)
        if (label) pushLog(label)
      }

      // Hiệu ứng bậc chỉ số của chiêu (đợt 27): self.boosts áp lên CHÍNH MÌNH
      // (VD chiêu tự tăng công), secondary.boosts áp lên ĐỐI THỦ theo % chance
      // (VD chiêu giảm phòng thủ địch).
      if (move.self?.boosts && Math.random() * 100 < (move.self.chance ?? 100)) {
        applyBoosts(move.self.boosts, 'player', playerMon.name)
      }
      // Boosts TOP-LEVEL (đợt 35 — Growl/String Shot/Swords Dance...): áp
      // 100%, đích theo move.target ('self' → chính mình, còn lại → đối thủ).
      if (move.boosts) {
        if (move.target === 'self') applyBoosts(move.boosts, 'player', playerMon.name)
        else if (enemyHpNow > 0) applyBoosts(move.boosts, 'enemy', enemyMon.name)
      }
      if (enemyHpNow > 0 && move.secondary?.boosts && Math.random() * 100 < (move.secondary.chance ?? 100)) {
        applyBoosts(move.secondary.boosts, 'enemy', enemyMon.name)
      }
      if (enemyHpNow > 0 && !enemyStatusNow) {
        const newStatus = rollStatus(move, enemyMon)
        if (newStatus) {
          const sleepTurns = newStatus === 'slp' ? 1 + Math.floor(Math.random() * 3) : undefined
          setEnemyMon((m) => ({ ...m, status: newStatus, sleepTurns }))
          enemyStatusNow = newStatus
          enemyJustStatused = newStatus
          pushLog(`${enemyMon.name} bị ${STATUS_INFO[newStatus].label.toLowerCase()}!`)
        }
      }
    }

    if (enemyHpNow <= 0) {
      pushLog(`${enemyMon.name} đã gục ngã! Bạn thắng!`)
      setBusy(false)
      setFinished(true)
      return
    }

    await new Promise((r) => setTimeout(r, 500))

    // Nếu địch VỪA bị gây trạng thái trong chính lượt này, xử lý bằng biến cục
    // bộ (không qua checkCanAct vì state chưa cập nhật): vừa ngủ = mất lượt
    // ngay (đúng game gốc), vừa tê liệt = vẫn có 25% mất lượt.
    let enemyCanAct
    if (enemyJustStatused === 'slp') {
      pushLog(`${enemyMon.name} đang ngủ say, không thể hành động.`)
      enemyCanAct = false
    } else if (enemyJustStatused === 'par' && Math.random() < 0.25) {
      pushLog(`${enemyMon.name} bị tê liệt, không thể cử động!`)
      enemyCanAct = false
    } else if (enemyJustStatused) {
      enemyCanAct = true
    } else {
      enemyCanAct = checkCanAct(enemyMon, setEnemyMon, enemyMon.name)
    }

    if (enemyCanAct) {
      const enemyMove = enemyMon.moves[Math.floor(Math.random() * enemyMon.moves.length)]
      const dmgToPlayer = applyEnvToDamage(computeDamage(enemyMove, enemyMon, playerMon, eStages, pStages), enemyMove, environment)
      playerHpNow = Math.max(0, playerMon.hp - dmgToPlayer)
      setPlayerMon((m) => ({ ...m, hp: playerHpNow }))
      pushLog(`${enemyMon.name} dùng ${enemyMove.name}! Gây ${dmgToPlayer} sát thương.`)
      if (enemyMove.self?.boosts && Math.random() * 100 < (enemyMove.self.chance ?? 100)) {
        applyBoosts(enemyMove.self.boosts, 'enemy', enemyMon.name)
      }
      if (enemyMove.boosts) {
        if (enemyMove.target === 'self') applyBoosts(enemyMove.boosts, 'enemy', enemyMon.name)
        else if (playerHpNow > 0) applyBoosts(enemyMove.boosts, 'player', playerMon.name)
      }
      if (playerHpNow > 0 && enemyMove.secondary?.boosts && Math.random() * 100 < (enemyMove.secondary.chance ?? 100)) {
        applyBoosts(enemyMove.secondary.boosts, 'player', playerMon.name)
      }

      if (playerHpNow > 0 && !playerMon.status) {
        const newStatus = rollStatus(enemyMove, playerMon)
        if (newStatus) {
          const sleepTurns = newStatus === 'slp' ? 1 + Math.floor(Math.random() * 3) : undefined
          setPlayerMon((m) => ({ ...m, status: newStatus, sleepTurns }))
          pushLog(`${playerMon.name} bị ${STATUS_INFO[newStatus].label.toLowerCase()}!`)
        }
      }
    }

    if (playerHpNow <= 0) {
      pushLog(`${playerMon.name} đã gục ngã! Bạn thua...`)
      setFinished(true)
      setBusy(false)
      return
    }

    // Cuối lượt: bỏng trừ 1/16 máu tối đa của bên bị bỏng. Tính bằng biến HP
    // cục bộ (không đọc state cũ) và PHẢI kiểm tra gục ngã sau khi trừ — bug
    // cũ: bỏng đưa HP về 0 nhưng không set finished → mọi nút bị khoá mà nút
    // "Tiếp tục câu chuyện" không hiện (soft-lock).
    if (playerMon.status === 'brn' && playerHpNow > 0) {
      const tick = Math.max(1, Math.round(playerMon.maxHp / 16))
      playerHpNow = Math.max(0, playerHpNow - tick)
      setPlayerMon((m) => ({ ...m, hp: Math.max(0, m.hp - tick) }))
      pushLog(`${playerMon.name} bị bỏng, mất ${tick} HP.`)
    }
    if (enemyStatusNow === 'brn' && enemyHpNow > 0) {
      const tick = Math.max(1, Math.round(enemyMon.maxHp / 16))
      enemyHpNow = Math.max(0, enemyHpNow - tick)
      setEnemyMon((m) => ({ ...m, hp: Math.max(0, m.hp - tick) }))
      pushLog(`${enemyMon.name} bị bỏng, mất ${tick} HP.`)
    }

    if (enemyHpNow <= 0) {
      pushLog(`${enemyMon.name} đã gục ngã vì vết bỏng! Bạn thắng!`)
      setFinished(true)
    } else if (playerHpNow <= 0) {
      pushLog(`${playerMon.name} đã gục ngã vì vết bỏng! Bạn thua...`)
      setFinished(true)
    }

    // Hết hạn Dynamax: chỉ trở về nếu trận còn tiếp diễn (gục/thắng thì
    // revertGimmicks lúc "Tiếp tục câu chuyện" tự xử lý cả tỉ lệ máu).
    if (dynaEnds && playerHpNow > 0 && enemyHpNow > 0) {
      endDynamax()
    }

    setBusy(false)
  }

  // ============ NÓI CHUYỆN / THUYẾT PHỤC / DỤ DỖ (đợt 24) ============
  // Ô chat trong trận: nói với đối phương để thuyết phục nó dừng lại, dụ dỗ
  // Pokémon hoang dã đi theo mình, doạ cho nó bỏ chạy... AI đóng vai đối
  // phương + trọng tài, phản hồi ngắn rồi PHÂN XỬ bằng tag:
  //   [[TALK result=continue|calm|join|flee]]
  // continue = chưa lay chuyển được (nói chuyện tốn 1 lượt → đối phương được
  // tấn công tự do); calm = nguôi giận, trận kết thúc trong hoà bình; join =
  // Pokémon hoang dã đi theo bạn (vào đội nếu còn chỗ); flee = nó bỏ chạy.
  // Dùng API Combat Anime nếu đã cấu hình, không thì API chính.
  async function handleTalk() {
    const text = talkInput.trim()
    if (!text || busy || battleOver || finished) return
    setBusy(true)
    setTalkInput('')
    pushLog(`Bạn: "${text}"`)

    const isBoss = (enemyMon.bossBars ?? 1) > 1
    const hpPct = Math.round((enemyMon.hp / enemyMon.maxHp) * 100)
    const talkApi = animeApiConfig?.baseUrl && animeApiConfig?.model ? { ...apiConfig, ...animeApiConfig } : apiConfig

    try {
      const raw = await chatCompletion(talkApi, [
        {
          role: 'system',
          content: [
            `Bạn nhập vai một Pokémon ${isBoss ? 'HUYỀN THOẠI (boss)' : 'hoang dã'} đang giao chiến với người chơi, kiêm trọng tài. Trả lời hoàn toàn bằng tiếng Việt.`,
            `Đối phương (bạn đóng vai): ${enemyMon.name} Lv${enemyMon.level}, hệ ${enemyMon.types.join('/')}, HP còn ${hpPct}%${isBoss ? ', là boss huyền thoại kiêu hãnh' : ''}.`,
            `Pokémon phe người chơi: ${playerMon.name} Lv${playerMon.level}, HP còn ${Math.round((playerMon.hp / playerMon.maxHp) * 100)}%.`,
            `Người chơi vừa NÓI với bạn (thuyết phục dừng đánh / dụ dỗ đi theo / doạ nạt / trò chuyện). Phản hồi NGẮN 1-3 câu đúng bản chất Pokémon: phản ứng bằng hành vi, tiếng kêu, ánh mắt, cử chỉ — KHÔNG nói tiếng người.`,
            `Sau đó KẾT THÚC bằng đúng 1 dòng: [[TALK result=continue|calm|join|flee]] theo quy tắc:`,
            `- continue: chưa lay chuyển được (mặc định khi lời nói thiếu thuyết phục).`,
            `- calm: lời nói chân thành/hợp lý khiến bạn nguôi, không muốn đánh nữa.`,
            `- join: bị dụ dỗ/cảm hoá, quyết định đi theo người chơi — HIẾM, đừng dễ dãi. Hoang dã thường: dễ xuôi hơn khi HP đã yếu (<50%).`,
            `- flee: bị doạ/đuối sức nên bỏ chạy.`,
            // Huyền thoại: CÓ THỂ bị dụ nhưng theo đúng lore từng loài (đợt
            // 25) — kiêu ngạo đòi bị đánh suy yếu trước; bộ ba thần thú thà
            // chết chứ không phản ý chí Ho-Oh; Arceus phán xét chứ không
            // nghe dụ... AI tự quyết dựa trên lore + tình trạng trận.
            isBoss ? `LƯU Ý VỀ BẠN (huyền thoại): ${getLegendLore(enemyMon)?.persuasion ?? GENERIC_LEGEND_PERSUASION}` : '',
          ].filter(Boolean).join('\n'),
        },
        { role: 'user', content: text },
      ])

      const tagMatch = raw.match(/\[\[\s*TALK\s+result\s*=\s*(continue|calm|join|flee)\s*\]\]/i)
      const result = tagMatch ? tagMatch[1].toLowerCase() : 'continue'
      const reaction = cleanAiOutput(raw.replace(/\[\[\s*TALK[^\]]*\]\]/gi, '')).trim()
      if (reaction) pushLog(`${enemyMon.name}: ${reaction}`)

      if (result === 'calm') {
        pushLog(`${enemyMon.name} đã nguôi — trận đấu kết thúc trong hoà bình.`)
        setEndReason('calm')
        setFinished(true)
      } else if (result === 'join') {
        if (party.length < 6) {
          setParty([...party, { ...enemyMon }])
          pushLog(`${enemyMon.name} quyết định ĐI THEO BẠN! Đã vào đội hình.`)
        } else {
          pushLog(`${enemyMon.name} muốn đi theo bạn, nhưng đội hình đã đầy 6 — nó lưu luyến rời đi.`)
        }
        setEndReason('join')
        setFinished(true)
      } else if (result === 'flee') {
        pushLog(`${enemyMon.name} hoảng sợ bỏ chạy mất!`)
        setEndReason('flee')
        setFinished(true)
      } else {
        // Nói chuyện tốn 1 lượt — đối phương được tấn công tự do.
        const enemyCanAct = checkCanAct(enemyMon, setEnemyMon, enemyMon.name)
        if (enemyCanAct) {
          const enemyMove = enemyMon.moves[Math.floor(Math.random() * enemyMon.moves.length)]
          const dmg = applyEnvToDamage(computeDamage(enemyMove, enemyMon, playerMon, eStages, pStages), enemyMove, environment)
          const hpAfter = Math.max(0, playerMon.hp - dmg)
          setPlayerMon((m) => ({ ...m, hp: hpAfter }))
          pushLog(`${enemyMon.name} không đợi bạn nói xong — dùng ${enemyMove.name}! Gây ${dmg} sát thương.`)
          if (hpAfter <= 0) {
            pushLog(`${playerMon.name} đã gục ngã! Bạn thua...`)
            setFinished(true)
          }
        }
      }
    } catch (err) {
      pushLog(`(Lỗi gọi AI khi nói chuyện: ${err.message} — không mất lượt.)`)
    } finally {
      setBusy(false)
    }
  }

  function handleRun() {
    if (busy || finished) return
    pushLog(`Bạn đã chạy thoát khỏi trận đấu.`)
    setFinished(true)
    setMenu('main')
  }

  function handleContinue() {
    if (continuingRef.current) return
    continuingRef.current = true
    const outcome = endReason ?? (enemyMon.hp <= 0 ? 'win' : playerMon.hp <= 0 ? 'lose' : 'escaped')
    // Biến hình (Mega/Dynamax/Tera) chỉ tồn tại TRONG trận — trả về bản gốc
    // TRƯỚC khi resetBattle hồi máu, để ngoài truyện vẫn là con thường.
    revertGimmicks()
    resetBattle()
    onBattleEnd(outcome)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        className="panel"
        style={{
          width: 'min(480px, 100%)',
          maxHeight: '92vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-panel-raised)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span className="page-title" style={{ margin: 0 }}>
            Trận đấu
          </span>
          {!finished && (
            <button className="btn" onClick={onClose} style={{ padding: '4px 10px' }}>
              Ẩn
            </button>
          )}
        </div>

        {/* Môi trường trận (đợt 35): banner + hiệu ứng sát thương theo hệ */}
        {environment && environment.key !== 'none' && (
          <div
            style={{
              fontSize: 11, color: 'var(--text-mid)', border: '1px dashed var(--line)',
              borderRadius: 8, padding: '5px 10px', marginBottom: 8,
            }}
            title={environment.desc}
          >
            {environment.label} — {environment.desc}
          </div>
        )}
        <Battlefield playerMon={playerMon} enemyMon={enemyMon} pStages={pStages} eStages={eStages} />

        <div
          style={{
            maxHeight: 130,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text-mid)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            marginBottom: 12,
            paddingRight: 4,
          }}
        >
          {log.map((line, i) => (
            <div key={i}>› {line}</div>
          ))}
        </div>

        {finished ? (
          <button className="btn btn--primary" onClick={handleContinue}>
            Tiếp tục câu chuyện
          </button>
        ) : menu === 'fight' ? (
          <div style={{ position: 'relative' }}>
            {/* Nút tròn cơ chế đặc biệt — góc TRÊN-TRÁI của ô chiêu thức,
                bấm xoè quạt trái→phải: Mega / Z-Move / Dynamax / Terastal. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, minHeight: 38, paddingLeft: 46 }}>
              <GimmickFan
                open={gimmickOpen}
                onToggle={() => { setGimmickOpen((o) => !o); setMegaPickOpen(false) }}
                used={gimmickUsed}
                busy={busy || battleOver}
                options={{
                  mega: {
                    available: megaFormes.length > 0 && (devUnlockGimmicks || hasGimmickItem(inventory, 'mega')),
                    reason: megaFormes.length === 0 ? 'loài này không có forme Mega' : 'cần Key Stone + Mega Stone (chưa có trong túi)',
                    onPick: () => (megaFormes.length === 1 ? doMega(megaFormes[0]) : setMegaPickOpen(true)),
                  },
                  zmove: {
                    available: playerMon.moves.some((m) => m.power > 0) && (devUnlockGimmicks || hasGimmickItem(inventory, 'zmove')),
                    reason: playerMon.moves.some((m) => m.power > 0) ? 'cần Z-Ring + Z-Crystal (chưa có trong túi)' : 'không có chiêu sát thương để phóng Z',
                    onPick: () => {
                      setZArmed(true)
                      setGimmickOpen(false)
                      pushLog('✦ Năng lượng Z tụ lại — hãy chọn 1 chiêu sát thương để phóng Z-Move!')
                    },
                  },
                  dynamax: {
                    available: devUnlockGimmicks || hasGimmickItem(inventory, 'dynamax'),
                    reason: 'cần Dynamax Band (chỉ có ở Galar) — chưa có trong túi',
                    onPick: doDynamax,
                  },
                  tera: {
                    available: devUnlockGimmicks || hasGimmickItem(inventory, 'tera'),
                    reason: 'cần Tera Orb (chỉ có ở Paldea) — chưa có trong túi',
                    color: TYPE_COLORS[playerMon.types[0]] ?? '#5fd7e8',
                    onPick: doTera,
                  },
                }}
              />
              {zArmed && (
                <span style={{ fontSize: 11, color: '#e8b84a' }}>
                  Đang chọn chiêu cho Z-MOVE…{' '}
                  <button className="btn" style={{ padding: '1px 8px', fontSize: 10 }} onClick={() => setZArmed(false)}>
                    Huỷ
                  </button>
                </span>
              )}
              {gimmickUsed === 'dynamax' && playerMon.dyna && (
                <span style={{ fontSize: 11, color: '#e05252' }}>DMAX còn {dynaTurnsLeft} lượt</span>
              )}
            </div>
            {/* Popup chọn Mega X/Y cho loài có 2 forme */}
            {megaPickOpen && (
              <div className="panel" style={{ position: 'absolute', top: 40, left: 0, zIndex: 5, padding: 8, display: 'flex', gap: 6 }}>
                {megaFormes.map((f) => (
                  <button key={f.name} className="btn" style={{ fontSize: 11 }} onClick={() => doMega(f)}>
                    {f.name}
                  </button>
                ))}
                <button className="btn" style={{ fontSize: 11 }} onClick={() => setMegaPickOpen(false)}>✕</button>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              {playerMon.moves.map((move) => {
                const zTarget = zArmed && move.power > 0
                const zDisabled = zArmed && move.power <= 0
                return (
                  <button
                    key={move.name}
                    className="btn"
                    disabled={busy || battleOver || zDisabled}
                    onClick={() => {
                      if (zTarget) {
                        // Phóng Z-Move: bản Z của chiêu này, power theo bảng, dùng 1 lần.
                        setZArmed(false)
                        setGimmickUsed('zmove')
                        pushLog(`✦ ${playerMon.name} phóng Z-MOVE: Z-${move.name}!!`)
                        handleMove({ ...move, name: `Z-${move.name}`, power: zPower(move.power) })
                      } else {
                        handleMove(move)
                      }
                    }}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px',
                      // Đợt 34: khi ngắm Z-Move, viền + chữ nhuộm MÀU HỆ của chiêu.
                      ...(zTarget
                        ? {
                            borderColor: TYPE_COLORS[move.type] ?? '#e8b84a',
                            boxShadow: `0 0 8px ${TYPE_COLORS[move.type] ?? '#e8b84a'}88`,
                          }
                        : {}),
                    }}
                  >
                    <span style={zTarget ? { color: TYPE_COLORS[move.type] ?? '#e8b84a', fontWeight: 700 } : undefined}>
                      {zTarget ? `⚡Z-${move.name}` : move.name}
                      {move.category && (
                        <span style={{ fontSize: 9, color: 'var(--text-dim)', marginLeft: 6 }}>
                          {move.category === 'Special' ? 'SPEC' : move.category === 'Status' ? 'STT' : 'PHYS'}
                        </span>
                      )}
                    </span>
                    <TypeBadge type={move.type} />
                  </button>
                )
              })}
            </div>
            <button className="btn" style={{ width: '100%' }} onClick={() => setMenu('main')} disabled={busy}>
              ← Quay lại
            </button>
          </div>
        ) : menu === 'talk' ? (
          <div>
            <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: '0 0 8px' }}>
              Nói gì đó với {enemyMon.name}: thuyết phục nó dừng lại, dụ nó đi theo bạn, doạ cho nó
              chạy... Nói chuyện tốn 1 lượt — không lay chuyển được thì nó sẽ tấn công.
            </p>
            <textarea
              value={talkInput}
              onChange={(e) => setTalkInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleTalk()
                }
              }}
              placeholder={`VD: "Bình tĩnh nào... bọn tôi không định làm hại cậu. Đi cùng chúng tôi không?"`}
              style={{ width: '100%', minHeight: 56, marginBottom: 8 }}
              disabled={busy}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn--primary" style={{ flex: 1 }} onClick={handleTalk} disabled={busy || !talkInput.trim()}>
                {busy ? 'Đang chờ phản ứng...' : 'Nói'}
              </button>
              <button className="btn" onClick={() => setMenu('main')} disabled={busy}>
                ← Quay lại
              </button>
            </div>
          </div>
        ) : menu === 'bag' ? (
          <div>
            {inventory.length === 0 ? (
              <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '4px 0 12px' }}>
                Túi đồ trống — mua vật phẩm tại các cửa hàng trong truyện.
              </p>
            ) : (
              <div style={{ margin: '4px 0 12px' }}>
                {inventory.map((it) => (
                  <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                    <span>{it.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-mid)' }}>x{it.qty}</span>
                  </div>
                ))}
                <p style={{ fontSize: 10.5, color: 'var(--text-dim)', margin: '6px 0 0' }}>
                  (Sử dụng item trong trận sẽ được nối ở đợt sau — hiện mới xem được.)
                </p>
              </div>
            )}
            <button className="btn" style={{ width: '100%' }} onClick={() => setMenu('main')}>
              ← Quay lại
            </button>
          </div>
        ) : menu === 'party' ? (
          <div>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '4px 0 12px' }}>
              {playerMon.name} hiện là Pokémon duy nhất trong đội. (Đổi Pokémon đang phát triển.)
            </p>
            <button className="btn" style={{ width: '100%' }} onClick={() => setMenu('main')}>
              ← Quay lại
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <MenuButton label="FIGHT" sub="Chọn chiêu thức" color="var(--coral)" onClick={() => setMenu('fight')} disabled={busy || battleOver} />
            <MenuButton label="BAG" sub="Vật phẩm" color="var(--amber)" onClick={() => setMenu('bag')} disabled={busy || battleOver} />
            <MenuButton label="POKÉMON" sub="Đổi Pokémon" color="var(--mint)" onClick={() => setMenu('party')} disabled={busy || battleOver} />
            <MenuButton
              label="RUN"
              sub={isWild ? 'Chạy trốn' : 'Không thể chạy'}
              color="var(--violet)"
              onClick={handleRun}
              disabled={busy || battleOver || !isWild}
            />
            <div style={{ gridColumn: '1 / -1' }}>
              <MenuButton
                label="TALK"
                sub="Nói chuyện / thuyết phục / dụ dỗ"
                color="var(--text-hi)"
                onClick={() => setMenu('talk')}
                disabled={busy || battleOver}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
