import React, { useState, useRef, useMemo, useEffect } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { chatCompletion } from '../services/aiClient.js'
import { cleanAiOutput } from '../utils/outputCleanup.js'
import { getEffectivenessMulti } from '../data/pokemonTypes.js'
import { getLegendLore, GENERIC_LEGEND_PERSUASION } from '../data/legendLore.js'
import { buildWildMon, describeNatureBehavior, isSameMon, normalizeAcquiredMon, recomputeMonStats, syncMonInParty } from '../data/pokemonSpecies.js'
import { genderLabel, genderSymbol } from '../data/pokemonGender.js'
import { getBossTier } from '../data/bossTiers.js'
import { applyPerksToMon, catchRateBonus } from '../data/playerPerks.js'
import { musicManager } from '../utils/musicManager.js'
import { resolveBattleTrackKeys, resolveLowHpTrackKeys, LOW_HP_RATIO } from '../data/musicTracks.js'
import { TYPE_COLORS } from '../data/pokemonTypes.js'
import { applyEnvToDamage, getBattleEnv } from '../data/battleEnvironments.js'
import HealthBar from './HealthBar.jsx'
import TypeBadge from './TypeBadge.jsx'
import MonAvatar from './MonAvatar.jsx'
import BagPanel from './BagPanel.jsx'
import {
  abilityId, abilityLabel, clearBattleVolatile, contactAbilityEffect, effectiveSpeed, endTurnAbilityEffect,
  endTurnStatusEffect, hasAbility, knockoutAbilityEffect, modifyBoostsByAbility, modifyDamageByAbilities,
  moveHitsWithAbilities, movePriorityWithAbility, resolveAbilityForEntry, statusIsBlocked, switchOutAbility,
  moveStatusIsBlocked, weatherDefenseMultiplier, weatherFromAbility, weatherIsSuppressed,
} from '../data/pokemonAbilities.js'
import {
  afterDamageHeldItem, afterMoveHeldItem, afterStatusHeldItem, beforeDamageHeldItem, canUseMegaWithItems,
  canUseZMoveWithItems, clearHeldItemVolatile, endTurnHeldItemEffect, heldItemDamageMultiplier,
  heldItemLabel, heldItemMoveAllowed, heldItemPriorityPenalty, heldItemSpeedMultiplier,
  heldItemStatMultiplier, defenderTypesWithHeldItem, lockChoiceMove, restoreTransientHeldItem, trainerHasGear,
  weatherTurnsFromHeldItem, zCrystalMatchesMove,
} from '../data/pokemonHeldItems.js'
import { ensurePokemonIdentity } from '../data/persistentIdentity.js'

// Trạng thái chính: bỏng, tê liệt, ngủ, độc/độc nặng và đóng băng.
const STATUS_INFO = {
  brn: { label: 'Bỏng', short: 'BRN', color: 'var(--coral)' },
  par: { label: 'Tê liệt', short: 'PAR', color: 'var(--amber)' },
  slp: { label: 'Ngủ', short: 'SLP', color: 'var(--text-dim)' },
  psn: { label: 'Nhiễm độc', short: 'PSN', color: '#a86de0' },
  tox: { label: 'Nhiễm độc nặng', short: 'TOX', color: '#8f45ca' },
  frz: { label: 'Đóng băng', short: 'FRZ', color: '#79d8ef' },
}

function moveWeatherKey(move) {
  const key = String(move?.weather ?? '').toLowerCase().replace(/[^a-z]/g, '')
  if (key.includes('rain')) return 'rain'
  if (key.includes('sun')) return 'sun'
  if (key.includes('sand')) return 'sandstorm'
  if (key.includes('snow') || key.includes('hail')) return 'snow'
  return null
}

// Công thức sát thương RÚT GỌN cho bản demo giao diện.
// Đợt 77 đã bổ sung thứ tự theo Speed/priority, accuracy, Ability, thời tiết,
// drain/recoil/multihit và trạng thái. Crit/PP/item cầm vẫn là phần mở rộng sau.
// Công thức sát thương — ưu tiên dùng ĐÚNG Atk/Def hoặc SpAtk/SpDef thật của
// từng loài (khi đã có baseStats thật từ Showdown) theo tinh thần công thức
// gốc của game Pokémon: dame phụ thuộc đúng loại chiêu (Physical dùng
// Atk/Def, Special dùng SpAtk/SpDef) — không còn kiểu "chiêu power cao nhất
// là tối ưu" bất kể stat có hợp hay không. Có random 0.85-1.00 giống game gốc.
// ===== BẬC CHỈ SỐ (stat stages, đợt 27) =====
// Đúng game gốc: mỗi chỉ số có bậc -6..+6, hệ số = (2+bậc)/2 khi dương,
// 2/(2-bậc) khi âm (VD +2 = x2, -1 = x0.67). Bậc tăng/giảm từ hiệu ứng phụ
// của chiêu (secondary.boosts lên đối thủ, self.boosts lên chính mình).
export const STAGE_ZERO = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 }
const STAGE_STAT_LABELS = { atk: 'Tấn công', def: 'Phòng thủ', spa: 'TC đặc biệt', spd: 'PT đặc biệt', spe: 'Tốc độ', acc: 'Chính xác', eva: 'Né tránh' }

export function stageMult(stage) {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage)
}

export function computeDamage(move, attacker, defender, atkStages = STAGE_ZERO, defStages = STAGE_ZERO, weatherKey = null, options = {}) {
  const defenderTypes = defenderTypesWithHeldItem(defender, move.type)
  const eff = getEffectivenessMulti(move.type, defenderTypes?.length ? defenderTypes : ['normal'])
  // Miễn nhiễm hệ phải gây đúng 0 sát thương. Bản cũ Math.max(1, ...) làm
  // chiêu hệ Đất vẫn rút 1 HP của Flying/Ghost miễn nhiễm.
  if (eff === 0) return 0
  // Dragon Rage/Sonic Boom/Night Shade/Seismic Toss dùng sát thương cố định,
  // không chạy qua công thức chỉ số, STAB hay chí mạng nhưng vẫn tôn trọng
  // miễn nhiễm hệ. Showdown biểu diễn chúng bằng `damage: số | 'level'`.
  if (Number.isFinite(move.damage)) return Math.max(0, Number(move.damage))
  if (String(move.damage).toLowerCase() === 'level') return Math.max(1, Number(attacker.level) || 1)
  if (move.power <= 0) return 0
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
  const burnPenalty = attacker.status === 'brn' && move.category !== 'Special' && !hasAbility(attacker, 'Guts') ? 0.5 : 1
  const isSpecial = move.category === 'Special'
  // Unaware bỏ qua bậc tấn công của đối thủ khi phòng thủ, hoặc bỏ qua bậc
  // phòng thủ của đối thủ khi chính Pokémon Unaware tấn công.
  const rawAtkStage = hasAbility(defender, 'Unaware') ? 0 : (atkStages[isSpecial ? 'spa' : 'atk'] ?? 0)
  const rawDefStage = hasAbility(attacker, 'Unaware') ? 0 : (defStages[isSpecial ? 'spd' : 'def'] ?? 0)
  const atkStage = options.critical ? Math.max(0, rawAtkStage) : rawAtkStage
  const defStage = options.critical ? Math.min(0, rawDefStage) : rawDefStage
  const atkStageMult = stageMult(atkStage)
  const defStageMult = stageMult(defStage)

  if (attacker.stats && defender.stats) {
    const atkKey = isSpecial ? 'spa' : 'atk'
    const defKey = isSpecial ? 'spd' : 'def'
    const atkStat = (isSpecial ? attacker.stats.spa : attacker.stats.atk) * burnPenalty * atkStageMult * heldItemStatMultiplier(attacker, atkKey)
    const defStat = (isSpecial ? defender.stats.spd : defender.stats.def) * defStageMult * heldItemStatMultiplier(defender, defKey) * weatherDefenseMultiplier(defender, move, weatherKey)
    const base = (levelFactor * move.power * (atkStat / defStat)) / 50 + 2
    return Math.max(1, Math.round(base * stab * eff * randomFactor * (options.critical ? 1.5 : 1) * heldItemDamageMultiplier(attacker, move, eff, defender)))
  }

  // Fallback khi 1 trong 2 bên không có baseStats thật (VD loài dự phòng
  // trong danh sách 151 tĩnh) — dùng tỉ lệ chênh lệch level thay cho Atk/Def.
  const base = (levelFactor * move.power * burnPenalty) / 50 + 2
  const levelRatio = (attacker.level / defender.level) * (atkStageMult / (defStageMult * weatherDefenseMultiplier(defender, move, weatherKey)))
  return Math.max(1, Math.round(base * levelRatio * stab * eff * randomFactor * (options.critical ? 1.5 : 1) * heldItemDamageMultiplier(attacker, move, eff, defender)))
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
  const short = { atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe', acc: 'Acc', eva: 'Eva' }
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
        <span title="Ability" style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--text-dim)' }}>
          ◇ {abilityLabel(mon)}
        </span>
        <span title="Trang bị Pokémon" style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: mon.heldItem ? 'var(--amber)' : 'var(--text-dim)' }}>
          ◆ {heldItemLabel(mon)}
        </span>
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
// Đợt 81: điều kiện gimmick được kiểm tra tập trung trong pokemonHeldItems.js.


export default function BattleModal({ onClose, onBattleEnd, isWild = true, environment = null, devUnlockGimmicks = false, initialBattleState = null, initialEnemyTeam = null }) {
  const { playerMon, setPlayerMon, enemyMon, setEnemyMon, resetBattle, apiConfig, animeApiConfig, party, setParty, inventory, setInventory, pokedexSpecies, movesDb, playerTraits, pcBox, setPcBox, markPokedexSeen, markPokedexCaught, playerLocation, storyDate, trainerId } = useGame()
  const restoredEnv = initialBattleState?.battleEnvKey
    ? getBattleEnv(initialBattleState.battleEnvKey)
    : (environment ?? getBattleEnv('none'))
  const [log, setLog] = useState(() => Array.isArray(initialBattleState?.log) && initialBattleState.log.length
    ? [...initialBattleState.log]
    : [isWild ? `Một ${enemyMon.name} hoang dã xuất hiện!` : `${enemyMon.name} của huấn luyện viên đối thủ xuất trận!`])
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(false)
  // Đợt 87: trainer có đội bền vững được đánh liên tiếp trong CÙNG một
  // trận. `enemyMon` vẫn là cá thể trên sân; reserves giữ các slot chưa ra.
  const [enemyReserves, setEnemyReserves] = useState(() => Array.isArray(initialBattleState?.enemyReserves)
    ? initialBattleState.enemyReserves.map((mon) => ({ ...mon }))
    : (Array.isArray(initialEnemyTeam) ? initialEnemyTeam.slice(1).map((mon) => ({ ...mon })) : []))
  const defeatedEnemiesRef = useRef(Array.isArray(initialBattleState?.defeatedEnemies)
    ? initialBattleState.defeatedEnemies.map((mon) => ({ ...mon }))
    : [])
  // 'main' | 'fight' | 'bag' | 'revive' | 'party' | 'talk'
  const [menu, setMenu] = useState('main')
  const [pendingReviveItem, setPendingReviveItem] = useState(null)
  // Lý do kết thúc đặc biệt do THUYẾT PHỤC: 'calm' (đối phương nguôi giận,
  // hoà), 'join' (Pokémon hoang dã bị dụ theo mình), 'flee' (đối phương bỏ
  // chạy). null = kết thúc thường (thắng/thua/tự chạy).
  const [endReason, setEndReason] = useState(null)
  // Ghi "đã thấy" bằng sự kiện gameplay thật, không cần AI nhớ khai tag.
  useEffect(() => {
    if (!enemyMon) return
    markPokedexSeen(enemyMon, { source: isWild ? 'wild-battle' : 'trainer-battle', location: playerLocation, date: storyDate })
  }, [enemyMon, isWild, markPokedexSeen, playerLocation, storyDate])
  const [talkInput, setTalkInput] = useState('')
  // Bậc chỉ số và thời tiết là state của TRẬN, không phải của modal. Vì modal
  // có thể bị Ẩn rồi mở lại, phải khôi phục chúng từ message thay vì reset.
  const [pStages, setPStages] = useState(() => ({ ...STAGE_ZERO, ...(initialBattleState?.pStages ?? {}) }))
  const [eStages, setEStages] = useState(() => ({ ...STAGE_ZERO, ...(initialBattleState?.eStages ?? {}) }))
  const [battleEnv, setBattleEnv] = useState(restoredEnv)
  // null = thời tiết của chính văn kéo dài hết trận; số = thời tiết do Ability.
  const [weatherTurns, setWeatherTurns] = useState(initialBattleState?.weatherTurns ?? null)
  const battleEnvRef = useRef(restoredEnv)
  const entryAbilitiesAppliedRef = useRef(Boolean(initialBattleState?.entryAbilitiesApplied))
  const participantKey = (mon) => mon?.uid ?? `${mon?.name ?? ''}-${mon?.level ?? ''}`
  const participantsRef = useRef(new Set(
    initialBattleState?.participantUids?.length
      ? initialBattleState.participantUids
      : (playerMon ? [participantKey(playerMon)] : []),
  ))
  useEffect(() => { battleEnvRef.current = battleEnv }, [battleEnv])

  // ============ CƠ CHẾ ĐẶC BIỆT (đợt 30): Mega / Z / Dynamax / Tera ============
  const [gimmickOpen, setGimmickOpen] = useState(false)
  const [gimmickUsed, setGimmickUsed] = useState(initialBattleState?.gimmickUsed ?? null) // 'mega'|'zmove'|'dynamax'|'tera' — 1 cơ chế/trận
  const [zArmed, setZArmed] = useState(false) // đã bấm Z → chọn 1 trong 4 chiêu để phóng bản Z
  const [dynaTurnsLeft, setDynaTurnsLeft] = useState(initialBattleState?.dynaTurnsLeft ?? 0)
  const [megaPickOpen, setMegaPickOpen] = useState(false) // loài có 2 mega (X/Y) → hỏi chọn
  const preGimmickRef = useRef(initialBattleState?.preGimmick ? { ...initialBattleState.preGimmick } : null) // bản gốc playerMon trước khi biến hình — để trả về khi hết trận

  // Khi Ẩn giữa Mega/Dynamax/Tera, context đã được trả về dạng gốc để HUD
  // không bị kẹt. Mở lại trận thì phục hồi đúng dạng đang chiến đấu trước đó.
  useEffect(() => {
    if (initialBattleState?.playerBattleMon) setPlayerMon({ ...initialBattleState.playerBattleMon })
    if (initialBattleState?.enemy) setEnemyMon({ ...initialBattleState.enemy })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ===== NHẠC "SẮP GỤC" (đợt 71) =====
  // Chủ dự án thêm file low hp.mp3: chỉ bật khi Pokémon đang ra trận tụt
  // dưới 20% máu, tắt ngay khi hồi lên hoặc trận kết thúc. Đây là override
  // ĐÈ LÊN nhạc trận (đẩy vào sau nên thắng), và mang theo danh sách nhạc
  // trận làm dự phòng để nếu thiếu file thì nhạc trận vẫn chạy chứ không câm.
  const hpRatio = (playerMon?.hp ?? 0) / Math.max(1, playerMon?.maxHp ?? 1)
  const lowHp = Boolean(playerMon) && playerMon.hp > 0 && hpRatio <= LOW_HP_RATIO
  useEffect(() => {
    if (lowHp && !finished) {
      musicManager.pushOverride('low-hp', resolveLowHpTrackKeys(resolveBattleTrackKeys(enemyMon)))
    } else {
      musicManager.popOverride('low-hp')
    }
  }, [lowHp, finished, enemyMon])
  // Rời bảng chiến đấu thì dọn override (bấm Ẩn / unmount).
  useEffect(() => () => musicManager.popOverride('low-hp'), [])
  // Đợt 71: bấm "Ẩn" GIỮA TRẬN khi đang Mega/Dynamax/Tera thì trước đây
  // Pokémon kẹt luôn ở dạng biến hình ngoài truyện (chỉ "Tiếp tục câu
  // chuyện" mới trả về bản gốc). Từ đợt này máu được GIỮ LẠI sau trận nên
  // kẹt dạng biến hình còn làm sai cả maxHp — trả về bản gốc khi unmount.
  // revertGimmicks dùng functional updater nên an toàn, và tự no-op nếu
  // handleContinue đã xử lý xong (preGimmickRef đã null).
  useEffect(() => () => revertGimmicks(), [])

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

  function restoreGimmickMon(mon, base = preGimmickRef.current) {
    if (!mon || !base || !isSameMon(mon, base)) return mon
    const hpScale = mon.dynaHpMultiplier || 1
    return {
      ...base,
      hp: Math.min(base.maxHp, Math.max(mon.hp > 0 ? 1 : 0, Math.round(mon.hp / hpScale))),
      status: mon.status,
      sleepTurns: mon.status === 'slp' ? mon.sleepTurns : undefined,
      heldItem: mon.heldItem ?? null,
      consumedHeldItem: mon.consumedHeldItem,
      knockedOffHeldItem: mon.knockedOffHeldItem,
      moves: mon.moves ?? base.moves,
    }
  }

  // MEGA: biến hình THẬT — stats/hệ/sprite của forme Mega ở cùng level, GIỮ
  // nguyên HP hiện tại (đúng game: base HP của Mega không đổi), giữ nguyên
  // 4 chiêu + trạng thái. Kéo dài hết trận.
  function doMega(megaEntry) {
    const permission = canUseMegaWithItems(playerMon, megaEntry, inventory, devUnlockGimmicks)
    if (!permission.ok) {
      pushLog(`Không thể Mega Evolution: ${permission.reason}`)
      return
    }
    backupOnce()
    // Mega là CÙNG CÁ THỂ: giữ uid/IV/EV/Nature/EXP/thân mật và tính lại
    // stats bằng baseStats của forme Mega. Bản cũ gọi buildWildMon trực tiếp
    // nên random lại cả cá thể, làm Ability/IV/uid trong trận bị lệch.
    const megaAbility = resolveAbilityForEntry(megaEntry, playerMon.abilitySlot, playerMon.uid)
    const transformed = recomputeMonStats({
      ...playerMon,
      name: megaEntry.name,
      species: megaEntry.species,
      spriteId: megaEntry.spriteId ?? megaEntry.species,
      types: [...(megaEntry.types ?? playerMon.types)],
      baseStats: megaEntry.baseStats ?? playerMon.baseStats,
      ability: megaAbility.name,
      abilitySlot: megaAbility.slot,
      abilityHidden: megaAbility.hidden,
      maxHp: playerMon.maxHp,
      hp: playerMon.hp,
    })
    setPlayerMon(transformed)
    applyEntryAbility(transformed, 'player')
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

  function maxPower(p) {
    if (p >= 150) return 150
    if (p >= 110) return 140
    if (p >= 75) return 130
    if (p >= 65) return 120
    if (p >= 55) return 110
    if (p >= 45) return 100
    return 90
  }

  function asMaxMove(move) {
    if (!move || move.isMaxMove) return move
    if (move.power <= 0) return {
      ...move, baseMoveName: move.name, name: 'Max Guard', type: 'normal', power: 0,
      target: 'self', volatileStatus: 'protect', boosts: null, self: null, secondary: null,
      secondaries: [], status: null, heal: null, drain: null, recoil: null, multihit: null,
      weather: null, isMaxMove: true,
    }
    const typeNames = { fire: 'Max Flare', water: 'Max Geyser', ice: 'Max Hailstorm', rock: 'Max Rockfall', fighting: 'Max Knuckle', poison: 'Max Ooze', flying: 'Max Airstream', ghost: 'Max Phantasm', dark: 'Max Darkness', grass: 'Max Overgrowth', electric: 'Max Lightning', psychic: 'Max Mindstorm', fairy: 'Max Starfall', steel: 'Max Steelspike', ground: 'Max Quake', bug: 'Max Flutterby', dragon: 'Max Wyrmwind', normal: 'Max Strike' }
    const weather = { fire: 'sunnyday', water: 'raindance', ice: 'snow', rock: 'sandstorm' }[move.type] ?? null
    const selfBoost = { fighting: { atk: 1 }, poison: { spa: 1 }, flying: { spe: 1 }, steel: { def: 1 }, ground: { spd: 1 } }[move.type] ?? null
    const foeBoost = { ghost: { def: -1 }, dark: { spd: -1 }, bug: { spa: -1 }, dragon: { atk: -1 }, normal: { spe: -1 } }[move.type] ?? null
    return {
      ...move, baseMoveName: move.name, name: typeNames[move.type] ?? `Max ${move.name}`,
      power: maxPower(move.power), isMaxMove: true, multihit: null, drain: null, recoil: null,
      status: null, secondary: foeBoost ? { chance: 100, boosts: foeBoost } : null,
      secondaries: [], boosts: null, self: selfBoost ? { chance: 100, boosts: selfBoost } : null,
      volatileStatus: null, sideCondition: null, forceSwitch: false, selfSwitch: null,
      weather, flags: {},
    }
  }

  // DYNAMAX: HP hiện tại + tối đa x2 trong 3 lượt, sprite phóng to (dùng forme
  // Gigantamax nếu loài có). Hết 3 lượt tự trở về, HP chia đôi theo tỉ lệ.
  function doDynamax() {
    backupOnce()
    const dynaLevel = Math.max(0, Math.min(10, Number(playerMon.dynamaxLevel) || 0))
    const hpMultiplier = 1.5 + dynaLevel * 0.05
    const canGmax = Boolean(gmaxForme && playerMon.gmaxFactor)
    setPlayerMon((m) => ({
      ...m,
      dyna: true,
      dynaHpMultiplier: hpMultiplier,
      ...(canGmax ? { name: gmaxForme.name, spriteId: gmaxForme.spriteId } : {}),
      maxHp: Math.round(m.maxHp * hpMultiplier),
      hp: Math.round(m.hp * hpMultiplier),
    }))
    setDynaTurnsLeft(3)
    setGimmickUsed('dynamax')
    setGimmickOpen(false)
    pushLog(`✦ ${playerMon.name} DYNAMAX — khổng lồ hoá trong 3 lượt${canGmax ? ` (dạng ${gmaxForme.name})` : ''}!`)
  }

  function endDynamax() {
    setPlayerMon((m) => ({
      ...m,
      dyna: false,
      name: preGimmickRef.current?.name ?? m.name,
      spriteId: preGimmickRef.current?.spriteId ?? m.spriteId,
      maxHp: Math.max(1, Math.round(m.maxHp / (m.dynaHpMultiplier || 1))),
      hp: Math.max(m.hp > 0 ? 1 : 0, Math.round(m.hp / (m.dynaHpMultiplier || 1))),
      dynaHpMultiplier: undefined,
    }))
    pushLog(`${preGimmickRef.current?.name ?? playerMon.name} trở về kích thước bình thường.`)
  }

  // Ba lượt Dynamax là ba HÀNH ĐỘNG của Pokémon, không chỉ riêng lúc bấm FIGHT.
  // Dùng đồ hoặc nói chuyện thất bại cũng tiêu một lượt; đổi Pokémon đã kết thúc
  // Dynamax ngay trong handleSwitchMon.
  function consumeDynamaxAction() {
    if (!playerMon.dyna || gimmickUsed !== 'dynamax') return
    const left = dynaTurnsLeft - 1
    setDynaTurnsLeft(Math.max(0, left))
    if (left <= 0) endDynamax()
  }

  // TERASTAL: kết tinh về HỆ CHÍNH của loài (đúng cơ chế: STAB hệ tera trùng
  // hệ gốc = x2.0, hệ gốc còn lại vẫn 1.5) — cả phòng thủ cũng đổi theo hệ mới.
  function doTera() {
    backupOnce()
    const teraType = playerMon.teraType || playerMon.types[0]
    setPlayerMon((m) => ({ ...m, tera: teraType, origTypes: m.types, types: teraType === 'stellar' ? m.types : [teraType] }))
    setGimmickUsed('tera')
    setGimmickOpen(false)
    pushLog(`✦ ${playerMon.name} TERASTAL — kết tinh hệ ${teraType.toUpperCase()}! (STAB hệ này x2)`)
  }

  // Trả mọi biến hình về bản gốc khi rời trận (Mega/Dyna/Tera đều chỉ tồn tại
  // trong trận — đúng game). Giữ HP hiện tại theo trần của bản gốc.
  function revertGimmicks() {
    const base = preGimmickRef.current
    if (!base) return
    setPlayerMon((cur) => restoreGimmickMon(cur, base))
    setParty((cur) => (cur ?? []).map((mon) => restoreGimmickMon(mon, base)))
    preGimmickRef.current = null
  }

  // Chặn bấm "Tiếp tục câu chuyện" nhiều lần liên tiếp (tránh gửi trùng kết quả).
  const continuingRef = useRef(false)

  // FIX đợt 69 (người chơi báo: "đội có 3 Pokémon mà 1 con chết là thua luôn,
  // chưa kịp xuất con thứ 2"): trước đây con ĐANG RA TRẬN gục là battleOver
  // ngay → khoá hết menu, ép bấm Tiếp tục và tính THUA dù còn Pokémon khoẻ.
  // Nay chỉ thua khi TOÀN ĐỘI gục.
  const healthyBackups = (party ?? []).filter(
    (pm) => pm && !isSameMon(pm, playerMon) && (pm.hp ?? 0) > 0,
  )
  const mustSwitch = playerMon.hp <= 0 && healthyBackups.length > 0
  const battleOver = (enemyMon.hp <= 0 && enemyReserves.length === 0) || (playerMon.hp <= 0 && healthyBackups.length === 0)

  // Con ra trận vừa gục nhưng còn dự bị → tự mở bảng đội hình cho người chơi
  // chọn con thay thế (đợt 69).
  useEffect(() => {
    if (mustSwitch && !finished) setMenu('party')
  }, [mustSwitch, finished])

  function pushLog(line) {
    setLog((l) => [...l, line])
  }

  /** Đưa slot trainer kế tiếp ra sân. true = trận còn tiếp diễn. */
  function sendNextEnemy(faintedMon) {
    if (isWild || enemyReserves.length === 0) return false
    const [nextEnemy, ...remaining] = enemyReserves
    defeatedEnemiesRef.current = [...defeatedEnemiesRef.current, restoreTransientHeldItem(clearHeldItemVolatile(clearBattleVolatile(faintedMon)))]
    setEnemyReserves(remaining)
    setEnemyMon({ ...nextEnemy })
    setEStages({ ...STAGE_ZERO })
    pushLog(`Huấn luyện viên đối thủ thu ${faintedMon.name} về và cho ${nextEnemy.name} ra sân! Còn ${remaining.length} Pokémon dự bị.`)
    applyEntryAbility(nextEnemy, 'enemy')
    return true
  }

  // ===== ĐỢT 72 — "1 POKÉMON CHẾT LÀ THUA DÙ CÒN 2 CON" (tester báo lại) =====
  // Đợt 69 tưởng đã sửa, nhưng chỉ sửa CỜ SUY RA `battleOver`. Bốn chỗ trong
  // file này vẫn gọi thẳng `setFinished(true)` ngay khi con ra trận gục, mà
  // `finished` mới là thứ ĐIỀU KHIỂN GIAO DIỆN: nó khoá `handleSwitchMon`
  // (`if (busy || finished) return`), chặn bảng đội hình tự mở
  // (`mustSwitch && !finished`), và bật thẳng màn "Tiếp tục câu chuyện" —
  // nơi kết quả được tính là THUA. Đúng bài học "2 nút Dev" trong file bàn
  // giao: sửa xong phải grep HẾT các điểm vào, đừng sửa mỗi chỗ dễ thấy.
  //
  // Nay mọi chỗ con ra trận gục đều đi qua đúng hàm này.
  /** @returns {boolean} true nếu TOÀN ĐỘI đã gục (thua thật). */
  function reportActiveFainted(monName, faintedMon = playerMon) {
    // Khi đổi Pokémon rồi bị đánh trả ngay, `playerMon` trong closure vẫn có
    // thể là con vừa rút về. Phải loại đúng cá thể vừa gục theo uid, nếu không
    // bản party cũ của nó bị đếm nhầm là một dự bị còn khoẻ.
    const backups = (party ?? []).filter(
      (pm) => pm && !isSameMon(pm, faintedMon) && (pm.hp ?? 0) > 0,
    )
    if (backups.length === 0) {
      pushLog(`${monName} đã gục ngã! Toàn đội đã gục — bạn thua...`)
      setFinished(true)
      return true
    }
    pushLog(`${monName} đã gục ngã! Còn ${backups.length} Pokémon khoẻ — hãy chọn con ra trận thay thế.`)
    return false
  }

  function boostLocal(stageMap, boosts, targetName, lines, targetMon = null, options = {}) {
    const effectiveBoosts = targetMon ? modifyBoostsByAbility(targetMon, boosts, options) : boosts
    if (!effectiveBoosts) return
    for (const [stat, delta] of Object.entries(effectiveBoosts)) {
      if (!(stat in stageMap) || !delta) continue
      const before = stageMap[stat]
      stageMap[stat] = Math.max(-6, Math.min(6, before + delta))
      const label = STAGE_STAT_LABELS[stat] ?? stat
      if (stageMap[stat] === before) {
        lines.push(`${label} của ${targetName} không thể ${delta > 0 ? 'tăng' : 'giảm'} thêm nữa!`)
      } else {
        const word = delta >= 2 ? 'tăng mạnh' : delta === 1 ? 'tăng' : delta === -1 ? 'giảm' : 'giảm mạnh'
        lines.push(`${label} của ${targetName} ${word}! (bậc ${stageMap[stat] > 0 ? '+' : ''}${stageMap[stat]})`)
      }
    }
  }

  function statusBlocked(mon, status, weatherKey, move = null) {
    return move ? moveStatusIsBlocked(move, mon, status, weatherKey) : statusIsBlocked(mon, status, weatherKey)
  }

  function applyStatusLocal(mon, status, weatherKey, lines, move = null) {
    if (!STATUS_INFO[status] || statusBlocked(mon, status, weatherKey, move)) return false
    mon.status = status
    if (status === 'slp') mon.sleepTurns = 1 + Math.floor(Math.random() * 3)
    lines.push(`${mon.name} bị ${STATUS_INFO[status].label.toLowerCase()}!`)
    return true
  }

  function canActLocal(mon, lines) {
    if (mon.rechargeTurn) {
      delete mon.rechargeTurn
      lines.push(`${mon.name} phải nghỉ để hồi sức!`)
      return false
    }
    if (mon.flinched) {
      delete mon.flinched
      lines.push(`${mon.name} chùn bước và không thể hành động!`)
      return false
    }
    if ((mon.confusedTurns ?? 0) > 0) {
      mon.confusedTurns -= 1
      if (mon.confusedTurns <= 0) {
        delete mon.confusedTurns
        lines.push(`${mon.name} đã hết rối loạn!`)
      } else if (Math.random() < 1 / 3) {
        const selfHit = Math.max(1, Math.round(((2 * (mon.level ?? 1) / 5 + 2) * 40 * ((mon.stats?.atk ?? 30) / Math.max(1, mon.stats?.def ?? 30))) / 50 + 2))
        mon.hp = Math.max(0, mon.hp - selfHit)
        lines.push(`${mon.name} rối loạn và tự làm mình mất ${selfHit} HP!`)
        return false
      } else lines.push(`${mon.name} đang rối loạn nhưng vẫn hành động được.`)
    }
    if (mon.status === 'slp') {
      const turnsLeft = (mon.sleepTurns ?? 1) - 1
      if (turnsLeft > 0) {
        mon.sleepTurns = turnsLeft
        lines.push(`${mon.name} đang ngủ say, không thể hành động.`)
        return false
      }
      mon.status = null
      delete mon.sleepTurns
      lines.push(`${mon.name} đã tỉnh giấc!`)
    }
    if (mon.status === 'frz') {
      if (Math.random() < 0.2) {
        mon.status = null
        lines.push(`${mon.name} đã tan băng!`)
      } else {
        lines.push(`${mon.name} bị đóng băng, không thể hành động!`)
        return false
      }
    }
    if (mon.status === 'par' && Math.random() < 0.25) {
      lines.push(`${mon.name} bị tê liệt, không thể cử động!`)
      return false
    }
    return true
  }

  function ratioValue(pair, base) {
    if (!Array.isArray(pair) || pair.length < 2 || !pair[1]) return 0
    return Math.max(1, Math.round(base * Number(pair[0]) / Number(pair[1])))
  }

  function applyEntryAbility(mon, side) {
    if (!mon) return
    const weather = weatherFromAbility(mon)
    if (weather) {
      const weatherEnv = getBattleEnv(weather)
      battleEnvRef.current = weatherEnv
      setBattleEnv(weatherEnv)
      setWeatherTurns(weatherTurnsFromHeldItem(mon, weather, 5))
      pushLog(`${abilityLabel(mon)} của ${mon.name} làm thay đổi thời tiết!`)
    }
    if (hasAbility(mon, 'Intimidate')) {
      const setter = side === 'player' ? setEStages : setPStages
      const target = side === 'player' ? enemyMon : playerMon
      const boosts = modifyBoostsByAbility(target, { atk: -1 }, { fromOpponent: true, intimidate: true })
      if (boosts?.atk) {
        setter((cur) => ({ ...cur, atk: Math.max(-6, Math.min(6, (cur.atk ?? 0) + boosts.atk)) }))
        pushLog(`Intimidate của ${mon.name} làm giảm Tấn công của ${target.name}!`)
      } else pushLog(`${abilityLabel(target)} giúp ${target.name} không bị Intimidate ảnh hưởng.`)
    }
    if (hasAbility(mon, 'Download')) {
      const target = side === 'player' ? enemyMon : playerMon
      const setter = side === 'player' ? setPStages : setEStages
      // Download: nếu Def < SpDef thì tăng Atk; hoà hoặc Def cao hơn thì tăng SpA.
      const stat = (target.stats?.def ?? 0) < (target.stats?.spd ?? 0) ? 'atk' : 'spa'
      const boosts = modifyBoostsByAbility(mon, { [stat]: 1 })
      setter((cur) => ({ ...cur, [stat]: Math.max(-6, Math.min(6, (cur[stat] ?? 0) + (boosts?.[stat] ?? 0))) }))
      pushLog(`Download của ${mon.name} thay đổi ${stat === 'atk' ? 'Tấn công' : 'TC đặc biệt'}!`)
    }
  }

  // Ability vào sân kích hoạt đúng một lần khi mở trận. Nếu cả hai cùng gọi
  // thời tiết, bên nhanh hơn kích hoạt trước và bên chậm hơn quyết định thời
  // tiết cuối cùng, giống thứ tự Ability khi cùng vào sân trong game gốc.
  useEffect(() => {
    if (entryAbilitiesAppliedRef.current || !playerMon || !enemyMon) return
    entryAbilitiesAppliedRef.current = true
    const entrants = [
      { mon: playerMon, side: 'player' },
      { mon: enemyMon, side: 'enemy' },
    ].sort((a, b) => (effectiveSpeed(b.mon) * heldItemSpeedMultiplier(b.mon)) - (effectiveSpeed(a.mon) * heldItemSpeedMultiplier(a.mon)))
    for (const entrant of entrants) applyEntryAbility(entrant.mon, entrant.side)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleMove(move) {
    if (busy || battleOver || finished) return
    if (playerMon.dyna) move = asMaxMove(move)
    const ppMoveName = move.baseMoveName ?? move.name
    const storedMove = (playerMon.moves ?? []).find((candidate) => candidate.name === ppMoveName || candidate.id === move.id)
    if (!move.isStruggle && storedMove && Number(storedMove.currentPp ?? storedMove.pp ?? 35) <= 0) {
      pushLog(`${storedMove.name} đã hết PP!`)
      return
    }
    setBusy(true)
    setMenu('main')

    let dynaEnds = false
    if (playerMon.dyna && gimmickUsed === 'dynamax') {
      const left = dynaTurnsLeft - 1
      setDynaTurnsLeft(left)
      if (left <= 0) dynaEnds = true
    }

    const p = { ...playerMon, stats: playerMon.stats ? { ...playerMon.stats } : playerMon.stats }
    const e = { ...enemyMon, stats: enemyMon.stats ? { ...enemyMon.stats } : enemyMon.stats }
    const pStageNow = { ...pStages }
    const eStageNow = { ...eStages }
    const lines = []
    let turnEnv = battleEnv
    let turnWeatherTurns = weatherTurns
    const enemyMovePool = (e.moves ?? []).filter((candidate) => heldItemMoveAllowed(e, candidate).allowed && Number(candidate.currentPp ?? candidate.pp ?? 35) > 0)
    const enemyMove = enemyMovePool.length
      ? enemyMovePool[Math.floor(Math.random() * enemyMovePool.length)]
      : { id: 'struggle', name: 'Struggle', type: 'normal', category: 'Physical', power: 50, recoil: [1, 4], isStruggle: true }
    const weatherKey = () => weatherIsSuppressed([p, e]) ? null : turnEnv?.key

    function executeMove(actor, defender, chosenMove, actorStages, defenderStages, actorSide) {
      if (!chosenMove || actor.hp <= 0 || defender.hp <= 0) return
      if (actor.tera && /^(?:terablast|tera blast)$/i.test(String(chosenMove.id ?? chosenMove.name).replace(/\s+/g, ''))) {
        chosenMove = { ...chosenMove, type: actor.tera === 'stellar' ? 'stellar' : actor.tera, power: 80, category: (actor.stats?.atk ?? 0) > (actor.stats?.spa ?? 0) ? 'Physical' : 'Special' }
      }
      const itemPermission = heldItemMoveAllowed(actor, chosenMove)
      if (!itemPermission.allowed) {
        lines.push(`${actor.name} không thể dùng ${chosenMove.name}: ${itemPermission.reason}`)
        return
      }
      if (!canActLocal(actor, lines)) return
      const ppName = chosenMove.baseMoveName ?? chosenMove.name
      if (!chosenMove.isStruggle) actor.moves = (actor.moves ?? []).map((known) => {
        if (known.name !== ppName && known.id !== chosenMove.id) return known
        const maxPp = Math.max(1, Number(known.maxPp ?? known.pp) || 35)
        return { ...known, maxPp, currentPp: Math.max(0, Number(known.currentPp ?? maxPp) - 1) }
      })
      Object.assign(actor, lockChoiceMove(actor, chosenMove))
      const currentWeather = weatherKey()
      if (!moveHitsWithAbilities(chosenMove, actor, defender, currentWeather, actorStages, defenderStages)) {
        lines.push(`${actor.name} dùng ${chosenMove.name}, nhưng đòn đánh trượt!`)
        return
      }

      const moveWeather = moveWeatherKey(chosenMove)
      if (moveWeather) {
        turnEnv = getBattleEnv(moveWeather)
        turnWeatherTurns = weatherTurnsFromHeldItem(actor, moveWeather, 5)
        lines.push(`${actor.name} dùng ${chosenMove.name} và làm thay đổi thời tiết!`)
      }

      const selfTarget = chosenMove.target === 'self'
      if (selfTarget) {
        lines.push(`${actor.name} dùng ${chosenMove.name}.`)
        if (chosenMove.volatileStatus === 'protect') {
          actor.protected = true
          lines.push(`${actor.name} dựng lá chắn bảo vệ!`)
        }
        if (chosenMove.heal) {
          const healed = ratioValue(chosenMove.heal, actor.maxHp)
          const before = actor.hp
          actor.hp = Math.min(actor.maxHp, actor.hp + healed)
          if (actor.hp > before) lines.push(`${actor.name} hồi ${actor.hp - before} HP.`)
        }
        boostLocal(actorStages, chosenMove.boosts, actor.name, lines, actor)
        if (chosenMove.self?.boosts && Math.random() * 100 < (chosenMove.self.chance ?? 100)) {
          boostLocal(actorStages, chosenMove.self.boosts, actor.name, lines, actor)
        }
        if (chosenMove.status ?? chosenMove.self?.status) {
          applyStatusLocal(actor, chosenMove.status ?? chosenMove.self?.status, currentWeather, lines, chosenMove)
          const itemCure = afterStatusHeldItem(actor, hasAbility(defender, 'Unnerve'))
          Object.assign(actor, itemCure.mon)
          lines.push(...itemCure.logs)
        }
        return
      }

      const hits = Array.isArray(chosenMove.multihit)
        ? chosenMove.multihit[0] + Math.floor(Math.random() * (chosenMove.multihit[1] - chosenMove.multihit[0] + 1))
        : Number.isFinite(chosenMove.multihit) ? chosenMove.multihit : 1
      let totalDamage = 0
      let suppressSecondary = false
      let moveImmune = false
      let actualHits = 0
      const effectiveness = getEffectivenessMulti(chosenMove.type, defenderTypesWithHeldItem(defender, chosenMove.type))

      for (let hit = 0; hit < hits && defender.hp > 0; hit++) {
        if (defender.protected) {
          lines.push(`${defender.name} đã bảo vệ bản thân khỏi ${chosenMove.name}!`)
          break
        }
        const critStage = Math.max(0, Number(chosenMove.critRatio) || 0)
        const critical = Boolean(chosenMove.willCrit) || Math.random() < ([1 / 24, 1 / 8, 1 / 2, 1][Math.min(3, critStage)] ?? 1 / 24)
        let damage = computeDamage(chosenMove, actor, defender, actorStages, defenderStages, currentWeather, { critical })
        if (critical && damage > 0) lines.push('Một đòn chí mạng!')
        if (currentWeather) damage = applyEnvToDamage(damage, chosenMove, turnEnv)
        const abilityResult = modifyDamageByAbilities({
          damage, move: chosenMove, attacker: actor, defender,
          weatherKey: currentWeather, effectiveness,
        })
        lines.push(...abilityResult.logs)
        suppressSecondary ||= abilityResult.suppressSecondary
        moveImmune ||= abilityResult.immune
        if (abilityResult.healDefender) {
          const before = defender.hp
          defender.hp = Math.min(defender.maxHp, defender.hp + abilityResult.healDefender)
          if (defender.hp > before) lines.push(`${defender.name} hồi ${defender.hp - before} HP nhờ ${abilityLabel(defender)}.`)
        }
        if (abilityResult.defenderBoost) {
          if (abilityResult.defenderBoost.flashFire) defender.flashFireBoost = true
          else boostLocal(defenderStages, abilityResult.defenderBoost, defender.name, lines, defender, { fromOpponent: false })
        }
        if (abilityResult.attackerBoost) boostLocal(actorStages, abilityResult.attackerBoost, actor.name, lines, actor)
        const itemBefore = beforeDamageHeldItem({
          attacker: actor, defender, move: chosenMove, damage: abilityResult.damage, effectiveness, berryBlocked: hasAbility(actor, 'Unnerve'),
        })
        Object.assign(defender, itemBefore.defender)
        lines.push(...itemBefore.logs)
        moveImmune ||= Boolean(itemBefore.immune)
        const finalDamage = itemBefore.damage
        const dealt = Math.min(defender.hp, finalDamage)
        defender.hp = Math.max(0, defender.hp - finalDamage)
        totalDamage += dealt
        if (!abilityResult.immune && !itemBefore.immune) actualHits += 1
        const itemAfter = afterDamageHeldItem({ attacker: actor, defender, move: chosenMove, damage: dealt, effectiveness, berryBlocked: hasAbility(actor, 'Unnerve') })
        Object.assign(actor, itemAfter.attacker)
        Object.assign(defender, itemAfter.defender)
        if (itemAfter.attackerBoosts?.target === 'defender') {
          boostLocal(defenderStages, { atk: 2, spa: 2 }, defender.name, lines, defender)
        }
        lines.push(...itemAfter.logs)
        // Rough Skin/Iron Barbs/Static... kích hoạt theo TỪNG lần tiếp xúc.
        // Bản cũ chỉ gọi một lần sau cả chuỗi multihit nên chiêu 5 hit bị
        // giảm phản lực sai và có thể tiếp tục đánh dù chính kẻ tấn công đã gục.
        const contact = contactAbilityEffect(actor, defender, chosenMove, dealt)
        if (contact) {
          if (contact.recoil && !hasAbility(actor, 'Magic Guard')) actor.hp = Math.max(0, actor.hp - contact.recoil)
          if (contact.status && !statusBlocked(actor, contact.status, currentWeather)) {
            actor.status = contact.status
            const itemCure = afterStatusHeldItem(actor, hasAbility(defender, 'Unnerve'))
            Object.assign(actor, itemCure.mon)
            lines.push(...itemCure.logs)
          }
          lines.push(contact.log)
        }
        if (abilityResult.immune || actor.hp <= 0) break
      }

      const attackerItemAfter = afterMoveHeldItem({ attacker: actor, move: chosenMove, totalDamage })
      Object.assign(actor, attackerItemAfter.attacker)
      lines.push(...attackerItemAfter.logs)

      if (chosenMove.power > 0 || chosenMove.damage != null) {
        lines.push(`${actor.name} dùng ${chosenMove.name}! Gây ${totalDamage} sát thương.${actualHits > 1 ? ` Trúng ${actualHits} lần.` : ''}`)
        const label = effLabel(effectiveness)
        if (label) lines.push(label)
      } else {
        lines.push(`${actor.name} dùng ${chosenMove.name}.`)
      }

      if (chosenMove.boosts && !moveImmune) boostLocal(chosenMove.target === 'self' ? actorStages : defenderStages, chosenMove.boosts, chosenMove.target === 'self' ? actor.name : defender.name, lines, chosenMove.target === 'self' ? actor : defender, { fromOpponent: chosenMove.target !== 'self' })
      if (actor.hp > 0 && chosenMove.self?.boosts && Math.random() * 100 < (chosenMove.self.chance ?? 100)) {
        boostLocal(actorStages, chosenMove.self.boosts, actor.name, lines, actor)
      }
      const secondaryTriggered = defender.hp > 0 && !moveImmune && !suppressSecondary && chosenMove.secondary
        && Math.random() * 100 < (chosenMove.secondary.chance ?? 100)
      if (secondaryTriggered && chosenMove.secondary?.boosts) {
        boostLocal(defenderStages, chosenMove.secondary.boosts, defender.name, lines, defender, { fromOpponent: true })
      }

      if (defender.hp > 0 && !moveImmune) {
        applyStatusLocal(defender, chosenMove.status ?? (secondaryTriggered ? chosenMove.secondary?.status : null), currentWeather, lines, chosenMove)
        const volatile = chosenMove.volatileStatus ?? (secondaryTriggered ? chosenMove.secondary?.volatileStatus : null)
        if (volatile === 'confusion' && !(defender.confusedTurns > 0)) {
          defender.confusedTurns = 2 + Math.floor(Math.random() * 4)
          lines.push(`${defender.name} trở nên rối loạn!`)
        } else if (volatile === 'flinch') defender.flinched = true
        const itemCure = afterStatusHeldItem(defender, hasAbility(actor, 'Unnerve'))
        Object.assign(defender, itemCure.mon)
        lines.push(...itemCure.logs)
      }

      if (totalDamage > 0 && chosenMove.drain) {
        const healed = ratioValue(chosenMove.drain, totalDamage)
        const before = actor.hp
        actor.hp = Math.min(actor.maxHp, actor.hp + healed)
        if (actor.hp > before) lines.push(`${actor.name} hút lại ${actor.hp - before} HP.`)
      }
      if (totalDamage > 0 && chosenMove.recoil && !hasAbility(actor, 'Rock Head', 'Magic Guard')) {
        const recoil = ratioValue(chosenMove.recoil, totalDamage)
        actor.hp = Math.max(0, actor.hp - recoil)
        lines.push(`${actor.name} chịu ${recoil} sát thương phản lực.`)
      }
      if (chosenMove.flags?.recharge && actor.hp > 0) actor.rechargeTurn = true
      if (defender.hp <= 0) {
        lines.push(`${defender.name} đã gục ngã!`)
        const knockout = knockoutAbilityEffect(actor)
        if (knockout && actor.hp > 0) {
          boostLocal(actorStages, knockout.boosts, actor.name, lines, actor)
          lines.push(knockout.log)
        }
      }
      if (actor.hp <= 0) lines.push(`${actor.name} đã gục vì phản lực!`)
      void actorSide
    }

    const pAction = { side: 'player', move, priority: movePriorityWithAbility(move, p) + heldItemPriorityPenalty(p), speed: effectiveSpeed(p, pStageNow, weatherKey()) * heldItemSpeedMultiplier(p) }
    const eAction = { side: 'enemy', move: enemyMove, priority: movePriorityWithAbility(enemyMove, e) + heldItemPriorityPenalty(e), speed: effectiveSpeed(e, eStageNow, weatherKey()) * heldItemSpeedMultiplier(e) }
    const queue = [pAction, eAction].sort((a, b) => b.priority - a.priority || b.speed - a.speed || Math.random() - 0.5)

    for (const action of queue) {
      if (action.side === 'player') executeMove(p, e, action.move, pStageNow, eStageNow, 'player')
      else executeMove(e, p, action.move, eStageNow, pStageNow, 'enemy')
      if (p.hp <= 0 || e.hp <= 0) break
    }

    // Cuối lượt: Poison Heal phải thay thế sát thương độc, không được bị trừ
    // máu trước rồi mới hồi. Cloud Nine/Air Lock chỉ vô hiệu THỜI TIẾT, không
    // được làm câm Speed Boost/Shed Skin/Poison Heal.
    for (const mon of [p, e]) {
      const statusEnd = endTurnStatusEffect(mon)
      Object.assign(mon, statusEnd.mon)
      lines.push(...statusEnd.logs)
    }
    delete p.protected
    delete e.protected
    const effectiveEndWeather = weatherIsSuppressed([p, e]) ? null : turnEnv?.key
    for (const [mon, stages] of [[p, pStageNow], [e, eStageNow]]) {
      const result = endTurnAbilityEffect(mon, effectiveEndWeather)
      Object.assign(mon, result.mon)
      if (result.boosts) boostLocal(stages, result.boosts, mon.name, lines, mon)
      lines.push(...result.logs)
    }
    for (const mon of [p, e]) {
      const result = endTurnHeldItemEffect(mon, hasAbility(mon === p ? e : p, 'Unnerve'))
      Object.assign(mon, result.mon)
      lines.push(...result.logs)
    }

    if (dynaEnds && p.hp > 0) {
      const factor = p.dynaHpMultiplier || 1
      p.dyna = false
      p.name = preGimmickRef.current?.name ?? p.name
      p.spriteId = preGimmickRef.current?.spriteId ?? p.spriteId
      p.maxHp = Math.max(1, Math.round(p.maxHp / factor))
      p.hp = Math.max(1, Math.min(p.maxHp, Math.round(p.hp / factor)))
      delete p.dynaHpMultiplier
      lines.push(`${p.name} trở về kích thước bình thường sau lượt Dynamax thứ ba.`)
      setDynaTurnsLeft(0)
    }
    setPlayerMon(p)
    setEnemyMon(e)
    setPStages(pStageNow)
    setEStages(eStageNow)
    for (const line of lines) pushLog(line)

    if (turnWeatherTurns !== null) {
      turnWeatherTurns -= 1
      if (turnWeatherTurns <= 0) {
        turnWeatherTurns = null
        turnEnv = environment ?? getBattleEnv('none')
        pushLog('Thời tiết tạm thời đã tan.')
      }
    }
    battleEnvRef.current = turnEnv
    setBattleEnv(turnEnv)
    setWeatherTurns(turnWeatherTurns)

    if (e.hp <= 0) {
      if (!sendNextEnemy(e)) {
        pushLog(`${enemyMon.name} không thể chiến đấu nữa — đội đối thủ đã hết Pokémon!`)
        setFinished(true)
      }
    } else if (p.hp <= 0) {
      reportActiveFainted(playerMon.name, p)
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
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
            `Bạn nhập vai một Pokémon ${isBoss ? 'HUYỀN THOẠI (boss)' : isWild ? 'hoang dã' : 'CỦA MỘT HUẤN LUYỆN VIÊN KHÁC'} đang giao chiến với người chơi, kiêm trọng tài. Trả lời hoàn toàn bằng tiếng Việt.`,
            // Đợt 71: dặn model biết đây là Pokémon có chủ (app vẫn chặn
            // cứng ở dưới, đây chỉ là lớp cho lời kể hợp lý hơn).
            isWild ? '' : 'QUAN TRỌNG: bạn ĐÃ CÓ CHỦ và trung thành với huấn luyện viên của mình. TUYỆT ĐỐI không dùng kết quả "join" — bạn không bao giờ bỏ chủ để theo người lạ. Cùng lắm là "calm" (nguôi giận, ngừng đánh).',
            `Đối phương (bạn đóng vai): ${enemyMon.name} ${genderSymbol(enemyMon.gender)} ${genderLabel(enemyMon.gender)}, Lv${enemyMon.level}, hệ ${enemyMon.types.join('/')}, HP còn ${hpPct}%${isBoss ? ', là boss huyền thoại kiêu hãnh' : ''}. Nature và khí chất: ${describeNatureBehavior(enemyMon)}.`,
            `Pokémon phe người chơi: ${playerMon.name} ${genderSymbol(playerMon.gender)} ${genderLabel(playerMon.gender)}, Lv${playerMon.level}, HP còn ${Math.round((playerMon.hp / playerMon.maxHp) * 100)}%. Nature và khí chất: ${describeNatureBehavior(playerMon)}.`,
            `Người chơi vừa NÓI với bạn (thuyết phục dừng đánh / dụ dỗ đi theo / doạ nạt / trò chuyện). Phản hồi NGẮN 1-3 câu đúng bản chất loài VÀ Nature hiện tại: phản ứng bằng hành vi, tiếng kêu, ánh mắt, cử chỉ — KHÔNG nói tiếng người. Nature là khí chất nền, phải biến đổi tự nhiên theo tình trạng HP và hoàn cảnh thay vì lặp máy móc một cử chỉ.`,
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
        // ĐỢT 71: Pokémon CỦA TRAINER KHÁC không thể bỏ chủ mà theo mình —
        // chặn ở phía app (quy tắc số 5), không tin model tự tuân thủ. Model
        // vẫn được dặn trong prompt, nhưng nếu nó trả [[TALK result=join]]
        // thì ở đây hạ xuống thành "hoà giải".
        if (!isWild) {
          pushLog(`${enemyMon.name} đã dịu đi, nhưng nó có chủ rồi — nó quay về bên huấn luyện viên của mình.`)
          setEndReason('calm')
          setFinished(true)
          return
        }
        const lured = ensurePokemonIdentity(applyPerksToMon(normalizeAcquiredMon(enemyMon), playerTraits), trainerId)
        markPokedexCaught(lured, { source: 'befriended-in-battle', location: playerLocation, date: storyDate })
        if ((party ?? []).length < 6) {
          setParty((cur) => [...(cur ?? []), lured])
          pushLog(`${enemyMon.name} quyết định ĐI THEO BẠN! Đã vào đội hình.`)
        } else {
          // Đợt 71: đội đầy thì vào HÒM PC thay vì biến mất như trước.
          setPcBox((cur) => [...(cur ?? []), lured])
          pushLog(`${enemyMon.name} đi theo bạn! Đội đã đầy 6 nên nó được gửi vào hòm PC.`)
        }
        setEndReason('join')
        setFinished(true)
      } else if (result === 'flee') {
        pushLog(`${enemyMon.name} hoảng sợ bỏ chạy mất!`)
        setEndReason('flee')
        setFinished(true)
      } else {
        // Nói chuyện tốn 1 lượt — đối phương được tấn công tự do.
        enemyFreeHit(playerMon, setPlayerMon, 'không đợi bạn nói xong — ')
        consumeDynamaxAction()
      }
    } catch (err) {
      pushLog(`(Lỗi gọi AI khi nói chuyện: ${err.message} — không mất lượt.)`)
    } finally {
      setBusy(false)
    }
  }

  // ============ LƯỢT PHẢN ĐÒN CỦA ĐỐI PHƯƠNG (đợt 68) ============
  // Dùng vật phẩm và ĐỔI POKÉMON đều TỐN 1 LƯỢT — đối phương được đánh tự
  // do, đúng luật game gốc. Tách riêng để 2 tính năng mới dùng chung.
  function enemyFreeHit(targetMon, setTarget, prefix = '') {
    const attacker = { ...enemyMon, stats: enemyMon.stats ? { ...enemyMon.stats } : enemyMon.stats }
    const defender = { ...targetMon, stats: targetMon.stats ? { ...targetMon.stats } : targetMon.stats }
    const lines = []
    const eStageNow = { ...eStages }
    const pStageNow = { ...pStages }
    let activeEnv = battleEnvRef.current ?? battleEnv
    let nextWeatherTurns = weatherTurns
    const effectiveWeather = () => weatherIsSuppressed([attacker, defender]) ? null : activeEnv?.key

    const finishFreeTurn = () => {
      // Dùng đồ/đổi Pokémon/nói chuyện vẫn là một lượt thật: bỏng, độc, bão
      // cát, Rain Dish, Speed Boost... đều phải chạy cuối lượt như khi FIGHT.
      for (const mon of [defender, attacker]) {
        const statusEnd = endTurnStatusEffect(mon)
        Object.assign(mon, statusEnd.mon)
        lines.push(...statusEnd.logs)
      }
      const weatherKey = effectiveWeather()
      for (const [mon, stageMap] of [[defender, pStageNow], [attacker, eStageNow]]) {
        const result = endTurnAbilityEffect(mon, weatherKey)
        Object.assign(mon, result.mon)
        if (result.boosts) boostLocal(stageMap, result.boosts, mon.name, lines, mon)
        lines.push(...result.logs)
      }
      for (const mon of [defender, attacker]) {
        const opponent = mon === defender ? attacker : defender
        const result = endTurnHeldItemEffect(mon, hasAbility(opponent, 'Unnerve'))
        Object.assign(mon, result.mon)
        lines.push(...result.logs)
      }
      if (nextWeatherTurns !== null) {
        nextWeatherTurns -= 1
        if (nextWeatherTurns <= 0) {
          nextWeatherTurns = null
          activeEnv = environment ?? getBattleEnv('none')
          lines.push('Hiệu ứng thời tiết đã tan.')
        }
      }
      battleEnvRef.current = activeEnv
      setBattleEnv(activeEnv)
      setWeatherTurns(nextWeatherTurns)
      setEnemyMon(attacker)
      setTarget(defender)
      setEStages(eStageNow)
      setPStages(pStageNow)
      for (const line of lines) pushLog(line)
      if (attacker.hp <= 0) {
        if (!sendNextEnemy(attacker)) {
          pushLog(`${attacker.name} không thể chiến đấu nữa — đội đối thủ đã hết Pokémon!`)
          setFinished(true)
        }
      } else if (defender.hp <= 0) {
        reportActiveFainted(targetMon.name, defender)
      }
      return defender.hp
    }

    if (!canActLocal(attacker, lines)) return finishFreeTurn()
    const enemyMovePool = (attacker.moves ?? []).filter((candidate) => heldItemMoveAllowed(attacker, candidate).allowed && Number(candidate.currentPp ?? candidate.pp ?? 35) > 0)
    const enemyMove = enemyMovePool.length
      ? enemyMovePool[Math.floor(Math.random() * enemyMovePool.length)]
      : { id: 'struggle', name: 'Struggle', type: 'normal', category: 'Physical', power: 50, recoil: [1, 4], isStruggle: true }
    if (!enemyMove.isStruggle) attacker.moves = (attacker.moves ?? []).map((known) => {
      if (known.id !== enemyMove.id && known.name !== enemyMove.name) return known
      const maxPp = Math.max(1, Number(known.maxPp ?? known.pp) || 35)
      return { ...known, maxPp, currentPp: Math.max(0, Number(known.currentPp ?? maxPp) - 1) }
    })
    Object.assign(attacker, lockChoiceMove(attacker, enemyMove))

    const moveWeather = moveWeatherKey(enemyMove)
    if (moveWeather) {
      activeEnv = getBattleEnv(moveWeather)
      nextWeatherTurns = weatherTurnsFromHeldItem(attacker, moveWeather, 5)
      lines.push(`${attacker.name} dùng ${enemyMove.name} và làm thay đổi thời tiết!`)
    }
    const weatherKey = effectiveWeather()

    if (enemyMove.target === 'self') {
      lines.push(`${attacker.name} ${prefix}dùng ${enemyMove.name}.`)
      if (enemyMove.heal) {
        const before = attacker.hp
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + ratioValue(enemyMove.heal, attacker.maxHp))
        if (attacker.hp > before) lines.push(`${attacker.name} hồi ${attacker.hp - before} HP.`)
      }
      boostLocal(eStageNow, enemyMove.boosts, attacker.name, lines, attacker)
      if (enemyMove.self?.boosts && Math.random() * 100 < (enemyMove.self.chance ?? 100)) {
        boostLocal(eStageNow, enemyMove.self.boosts, attacker.name, lines, attacker)
      }
      applyStatusLocal(attacker, enemyMove.status ?? enemyMove.self?.status, weatherKey, lines)
      const itemCure = afterStatusHeldItem(attacker, hasAbility(defender, 'Unnerve'))
      Object.assign(attacker, itemCure.mon)
      lines.push(...itemCure.logs)
      return finishFreeTurn()
    }

    if (!moveHitsWithAbilities(enemyMove, attacker, defender, weatherKey, eStageNow, pStageNow)) {
      lines.push(`${attacker.name} ${prefix}dùng ${enemyMove.name}, nhưng đòn đánh trượt!`)
      return finishFreeTurn()
    }

    const hits = Array.isArray(enemyMove.multihit)
      ? enemyMove.multihit[0] + Math.floor(Math.random() * (enemyMove.multihit[1] - enemyMove.multihit[0] + 1))
      : Number.isFinite(enemyMove.multihit) ? enemyMove.multihit : 1
    const effectiveness = getEffectivenessMulti(enemyMove.type, defenderTypesWithHeldItem(defender, enemyMove.type))
    let totalDealt = 0
    let actualHits = 0
    let suppressSecondary = false
    let moveImmune = false

    for (let hit = 0; hit < hits && defender.hp > 0 && attacker.hp > 0; hit++) {
      const critStage = Math.max(0, Number(enemyMove.critRatio) || 0)
      const critical = !enemyMove.damage && (Boolean(enemyMove.willCrit) || Math.random() < ([1 / 24, 1 / 8, 1 / 2, 1][Math.min(3, critStage)] ?? 1 / 24))
      let dmg = computeDamage(enemyMove, attacker, defender, eStageNow, pStageNow, weatherKey, { critical })
      if (critical && dmg > 0) lines.push('Một đòn chí mạng!')
      if (weatherKey) dmg = applyEnvToDamage(dmg, enemyMove, activeEnv)
      const abilityResult = modifyDamageByAbilities({
        damage: dmg, move: enemyMove, attacker, defender, weatherKey, effectiveness,
      })
      lines.push(...abilityResult.logs)
      suppressSecondary ||= abilityResult.suppressSecondary
      moveImmune ||= abilityResult.immune
      if (abilityResult.healDefender) {
        const before = defender.hp
        defender.hp = Math.min(defender.maxHp, defender.hp + abilityResult.healDefender)
        if (defender.hp > before) lines.push(`${defender.name} hồi ${defender.hp - before} HP nhờ ${abilityLabel(defender)}.`)
      }
      if (abilityResult.defenderBoost) {
        if (abilityResult.defenderBoost.flashFire) defender.flashFireBoost = true
        else boostLocal(pStageNow, abilityResult.defenderBoost, defender.name, lines, defender)
      }
      if (abilityResult.attackerBoost) boostLocal(eStageNow, abilityResult.attackerBoost, attacker.name, lines, attacker)
      if (abilityResult.immune) break
      const itemBefore = beforeDamageHeldItem({ attacker, defender, move: enemyMove, damage: abilityResult.damage, effectiveness, berryBlocked: hasAbility(attacker, 'Unnerve') })
      Object.assign(defender, itemBefore.defender)
      lines.push(...itemBefore.logs)
      if (itemBefore.immune) { moveImmune = true; break }
      const dealt = Math.min(defender.hp, itemBefore.damage)
      defender.hp = Math.max(0, defender.hp - itemBefore.damage)
      totalDealt += dealt
      actualHits += 1
      const itemAfter = afterDamageHeldItem({ attacker, defender, move: enemyMove, damage: dealt, effectiveness, berryBlocked: hasAbility(attacker, 'Unnerve') })
      Object.assign(attacker, itemAfter.attacker)
      Object.assign(defender, itemAfter.defender)
      if (itemAfter.attackerBoosts?.target === 'defender') boostLocal(pStageNow, { atk: 2, spa: 2 }, defender.name, lines, defender)
      lines.push(...itemAfter.logs)
      const contact = contactAbilityEffect(attacker, defender, enemyMove, dealt)
      if (contact) {
        if (contact.recoil && !hasAbility(attacker, 'Magic Guard')) attacker.hp = Math.max(0, attacker.hp - contact.recoil)
        if (contact.status && !statusIsBlocked(attacker, contact.status, weatherKey)) {
          attacker.status = contact.status
          const itemCure = afterStatusHeldItem(attacker, hasAbility(defender, 'Unnerve'))
          Object.assign(attacker, itemCure.mon)
          lines.push(...itemCure.logs)
        }
        lines.push(contact.log)
      }
    }

    const attackerItemAfter = afterMoveHeldItem({ attacker, move: enemyMove, totalDamage: totalDealt })
    Object.assign(attacker, attackerItemAfter.attacker)
    lines.push(...attackerItemAfter.logs)

    lines.push(`${attacker.name} ${prefix}dùng ${enemyMove.name}! Gây ${totalDealt} sát thương.${actualHits > 1 ? ` Trúng ${actualHits} lần.` : ''}`)
    if (defender.hp > 0 && !moveImmune) {
      if (enemyMove.boosts) boostLocal(pStageNow, enemyMove.boosts, defender.name, lines, defender, { fromOpponent: true })
      const secondaryTriggered = !suppressSecondary && enemyMove.secondary
        && Math.random() * 100 < (enemyMove.secondary.chance ?? 100)
      if (secondaryTriggered && enemyMove.secondary?.boosts) {
        boostLocal(pStageNow, enemyMove.secondary.boosts, defender.name, lines, defender, { fromOpponent: true })
      }
        applyStatusLocal(defender, enemyMove.status ?? (secondaryTriggered ? enemyMove.secondary?.status : null), weatherKey, lines, enemyMove)
        const volatile = enemyMove.volatileStatus ?? (secondaryTriggered ? enemyMove.secondary?.volatileStatus : null)
        if (volatile === 'confusion' && !(defender.confusedTurns > 0)) defender.confusedTurns = 2 + Math.floor(Math.random() * 4)
        else if (volatile === 'flinch') defender.flinched = true
        const itemCure = afterStatusHeldItem(defender, hasAbility(attacker, 'Unnerve'))
        Object.assign(defender, itemCure.mon)
        lines.push(...itemCure.logs)
    } else if (defender.hp <= 0) {
      const knockout = knockoutAbilityEffect(attacker)
      if (knockout && attacker.hp > 0) {
        boostLocal(eStageNow, knockout.boosts, attacker.name, lines, attacker)
        lines.push(knockout.log)
      }
    }
    if (attacker.hp > 0 && enemyMove.self?.boosts && Math.random() * 100 < (enemyMove.self.chance ?? 100)) {
      boostLocal(eStageNow, enemyMove.self.boosts, attacker.name, lines, attacker)
    }
    if (attacker.hp > 0 && (enemyMove.flags?.recharge || enemyMove.self?.volatileStatus === 'mustrecharge')) attacker.rechargeTurn = true
    if (totalDealt > 0 && enemyMove.drain && attacker.hp > 0) {
      const before = attacker.hp
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + ratioValue(enemyMove.drain, totalDealt))
      if (attacker.hp > before) lines.push(`${attacker.name} hút lại ${attacker.hp - before} HP.`)
    }
    if (totalDealt > 0 && enemyMove.recoil && attacker.hp > 0 && !hasAbility(attacker, 'Rock Head', 'Magic Guard')) {
      const recoil = ratioValue(enemyMove.recoil, totalDealt)
      attacker.hp = Math.max(0, attacker.hp - recoil)
      lines.push(`${attacker.name} chịu ${recoil} sát thương phản lực.`)
    }
    return finishFreeTurn()
  }


  /** Trừ 1 vật phẩm khỏi túi (đợt 68 — "biến không cập nhật trong trận"). */
  function consumeItem(itemId) {
    setInventory((cur) =>
      (cur ?? [])
        .map((it) => (it.id === itemId && !it.infinite ? { ...it, qty: (it.qty ?? 1) - 1 } : it))
        .filter((it) => it.infinite || (it.qty ?? 0) > 0),
    )
  }

  const HEAL_AMOUNT = {
    potion: 20, superpotion: 60, hyperpotion: 120, freshwater: 30, fullrestore: 9999,
  }
  const STATUS_CURE = {
    antidote: ['psn', 'tox'], paralyzeheal: ['par'], awakening: ['slp'], burnheal: ['brn'],
    iceheal: ['frz'], fullheal: ['psn', 'tox', 'par', 'slp', 'brn', 'frz'],
    fullrestore: ['psn', 'tox', 'par', 'slp', 'brn', 'frz'],
  }
  const BALL_BONUS = { pokeball: 1, greatball: 1.5, ultraball: 2, masterball: Infinity }

  /** Dùng 1 vật phẩm trong trận. */
  function handleUseItem(item) {
    if (busy || battleOver || finished) return
    const id = item.id
    // --- Poké Ball: bắt Pokémon ---
    if (BALL_BONUS[id] !== undefined) {
      if (!isWild) {
        pushLog('Không thể bắt Pokémon của huấn luyện viên khác!')
        return
      }
      setBusy(true)
      setMenu('main')
      consumeItem(id)
      // Tỉ lệ bắt: máu càng thấp càng dễ, có trạng thái thì dễ hơn, bóng xịn
      // cộng thêm. Công thức đơn giản hoá nhưng giữ đúng "cảm giác" game gốc.
      const statusMultiplier = enemyMon.status ? (enemyMon.status === 'slp' || enemyMon.status === 'frz' ? 2.5 : 1.5) : 1
      const tier = getBossTier(enemyMon.name)
      const speciesCatchRate = Number.isFinite(enemyMon.catchRate) ? enemyMon.catchRate : (tier ? 3 : 120)
      // Đợt 70: thiên phú "Bàn Tay Thuần Phục" cộng thẳng 15% (vẫn kẹp 3-95%).
      const perkBonus = catchRateBonus(playerTraits)
      const catchValue = ((3 * enemyMon.maxHp - 2 * enemyMon.hp) * speciesCatchRate * (BALL_BONUS[id] ?? 1) * statusMultiplier)
        / Math.max(1, 3 * enemyMon.maxHp)
      const isMasterBall = id === 'masterball'
      const chance = isMasterBall ? 100 : Math.max(1, Math.min(95, Math.round(100 * Math.pow(Math.min(1, catchValue / 255), 0.75) + perkBonus)))
      const roll = Math.random() * 100
      pushLog(`Bạn ném ${item.name}! (khả năng ~${chance}%)`)
      if (isMasterBall || roll < chance) {
        const caught = ensurePokemonIdentity(applyPerksToMon(normalizeAcquiredMon(enemyMon), playerTraits), trainerId)
        markPokedexCaught(caught, { source: 'wild-battle', location: playerLocation, date: storyDate })
        if ((party ?? []).length < 6) {
          setParty((cur) => [...(cur ?? []), caught])
          pushLog(`Tuyệt vời! ${enemyMon.name} đã được bắt và vào đội hình!`)
        } else {
          // Đợt 71: trước đây con thứ 7 bị VỨT LUÔN (chỉ ghi log "gửi về
          // nhà" cho có). Nay vào hòm PC thật, lấy ra được ở Trung tâm.
          setPcBox((cur) => [...(cur ?? []), caught])
          pushLog(`Bắt được ${enemyMon.name}! Đội đã đầy 6 nên nó được gửi vào hòm PC (${(pcBox ?? []).length + 1} con trong hòm).`)
        }
        setEndReason('caught')
        setFinished(true)
        setBusy(false)
        return
      }
      pushLog(`${enemyMon.name} thoát ra khỏi bóng!`)
      enemyFreeHit(playerMon, setPlayerMon)
      consumeDynamaxAction()
      setBusy(false)
      return
    }

    // --- Hồi máu / chữa trạng thái ---
    const heal = HEAL_AMOUNT[id]
    const cures = STATUS_CURE[id]
    const isRevive = id === 'revive'
    if (heal === undefined && !cures && !isRevive) {
      pushLog(`${item.name} không dùng được trong trận đấu.`)
      return
    }
    if (isRevive) {
      const fainted = (party ?? []).filter((mon) => mon && !isSameMon(mon, playerMon) && (mon.hp ?? 0) <= 0)
      if (fainted.length === 0) {
        pushLog('Không có Pokémon dự bị nào gục ngã để hồi sinh.')
        return
      }
      setPendingReviveItem(item)
      setMenu('revive')
      return
    }
    const canHeal = heal !== undefined && playerMon.hp < playerMon.maxHp
    const canCure = Boolean(cures && playerMon.status && cures.includes(playerMon.status))
    if (!canHeal && !canCure) {
      const reason = playerMon.status && cures
        ? `${item.name} không chữa được trạng thái hiện tại của ${playerMon.name}.`
        : `${playerMon.name} đang khoẻ mạnh — chưa cần dùng ${item.name}.`
      pushLog(reason)
      return
    }
    setBusy(true)
    setMenu('main')
    consumeItem(id)
    // Tính snapshot SAU KHI dùng đồ trước rồi mới cho địch đánh trả. Trước
    // đây hai setState chữa HP/trạng thái chạy riêng, sau đó enemyFreeHit lại
    // nhận snapshot cũ nên thuốc chữa trạng thái có thể bị ghi đè và bệnh quay lại.
    const itemTarget = { ...playerMon }
    if (canHeal) {
      const before = itemTarget.hp
      itemTarget.hp = Math.min(itemTarget.maxHp, itemTarget.hp + heal)
      pushLog(`Bạn dùng ${item.name} — ${playerMon.name} hồi ${itemTarget.hp - before} HP.`)
    }
    if (canCure) {
      const oldStatus = itemTarget.status
      itemTarget.status = null
      delete itemTarget.sleepTurns
      delete itemTarget.toxicCounter
      pushLog(`${playerMon.name} đã khỏi ${STATUS_INFO[oldStatus]?.label?.toLowerCase() ?? 'trạng thái xấu'}!`)
    }
    setPlayerMon(itemTarget)
    // Dùng đồ tốn 1 lượt.
    enemyFreeHit(itemTarget, setPlayerMon)
    consumeDynamaxAction()
    setBusy(false)
  }

  function handleReviveTarget(target) {
    if (!pendingReviveItem || busy || finished || battleOver || !target || (target.hp ?? 0) > 0) return
    setBusy(true)
    const revived = { ...target, hp: Math.max(1, Math.floor((target.maxHp ?? 1) / 2)) }
    consumeItem(pendingReviveItem.id)
    setParty((cur) => (cur ?? []).map((mon) => (isSameMon(mon, target) ? revived : mon)))
    pushLog(`Bạn dùng ${pendingReviveItem.name} — ${target.name} hồi sinh với ${revived.hp} HP.`)
    setPendingReviveItem(null)
    setMenu('main')
    enemyFreeHit(playerMon, setPlayerMon)
    consumeDynamaxAction()
    setBusy(false)
  }

  /** Đổi sang Pokémon khác trong đội. Tốn 1 lượt, TRỪ khi con cũ vừa gục
   * (đổi thay thế sau khi gục là miễn phí — đúng luật game gốc). */
  function handleSwitchMon(target) {
    // Đợt 72: KHÔNG chặn theo `finished` một cách mù quáng nữa. `finished`
    // giờ chỉ bật khi trận thực sự xong (toàn đội gục / thắng / chạy / bắt
    // được), nên chặn ở đây là đủ và không còn khoá nhầm lúc chỉ có con ra
    // trận gục mà đội vẫn còn người.
    if (busy || finished || battleOver) return
    if (!target || isSameMon(target, playerMon)) return
    if ((target.hp ?? 0) <= 0) {
      pushLog(`${target.name} đã gục ngã, không thể ra trận.`)
      return
    }
    const wasFainted = (playerMon.hp ?? 0) <= 0
    setBusy(true)
    setMenu('main')
    pushLog(wasFainted
      ? `${playerMon.name} không thể chiến đấu nữa! Bạn tung ${target.name} ra trận!`
      : `Bạn thu ${playerMon.name} về và tung ${target.name} ra trận!`)
    // Regenerator/Natural Cure kích hoạt khi rút về; lưu snapshot đó vào đội.
    let withdrawn = clearHeldItemVolatile(switchOutAbility(playerMon))
    // Dynamax kết thúc ngay khi rút Pokémon. Mega/Tera vẫn được giữ trong runtime
    // của đúng cá thể để nếu quay lại sân nó còn đúng dạng, nhưng cuối trận sẽ trả
    // toàn bộ party về dạng gốc bằng uid — không lấy HP của Pokémon khác gắn nhầm.
    if (withdrawn.dyna && preGimmickRef.current && isSameMon(withdrawn, preGimmickRef.current)) {
      withdrawn = restoreGimmickMon(withdrawn)
      preGimmickRef.current = null
      setDynaTurnsLeft(0)
      pushLog(`${withdrawn.name} trở về kích thước bình thường khi được thu hồi.`)
    }
    setParty((cur) => syncMonInParty(cur, withdrawn))
    participantsRef.current.add(participantKey(target))
    setPlayerMon(clearHeldItemVolatile({ ...target }))
    // Bậc chỉ số reset khi đổi Pokémon (đúng luật game gốc).
    setPStages({ ...STAGE_ZERO })
    applyEntryAbility(target, 'player')
    // Đổi sau khi con cũ GỤC = thay thế bắt buộc → không bị đánh trả.
    if (!wasFainted) enemyFreeHit(target, setPlayerMon)
    setBusy(false)
  }

  function handleRun() {
    if (busy || finished) return
    if (!isWild) {
      pushLog('Không thể bỏ chạy khỏi trận đấu với huấn luyện viên!')
      return
    }
    pushLog(`Bạn đã chạy thoát khỏi trận đấu.`)
    setEndReason('escaped')
    setFinished(true)
    setMenu('main')
  }

  function buildBattleRuntime() {
    return {
      log: [...log],
      pStages: { ...pStages },
      eStages: { ...eStages },
      battleEnvKey: battleEnv?.key ?? 'none',
      weatherTurns,
      entryAbilitiesApplied: entryAbilitiesAppliedRef.current,
      participantUids: [...participantsRef.current],
      gimmickUsed,
      dynaTurnsLeft,
      preGimmick: preGimmickRef.current ? { ...preGimmickRef.current } : null,
      // Luôn giữ cả hai cá thể đang ở trên sân. Bản cũ chỉ lưu player khi
      // đang biến hình và RoleplayChat lấy enemy từ closure cũ, nên bấm Ẩn
      // có thể làm đối thủ hồi máu/trạng thái hoặc reset sai trận.
      playerBattleMon: { ...playerMon },
      enemy: { ...enemyMon },
      enemyReserves: enemyReserves.map((mon) => ({ ...mon })),
      defeatedEnemies: defeatedEnemiesRef.current.map((mon) => ({ ...mon })),
    }
  }

  function handleContinue() {
    if (continuingRef.current) return
    continuingRef.current = true
    const outcome = endReason ?? (enemyMon.hp <= 0 ? 'win' : playerMon.hp <= 0 ? 'lose' : 'escaped')
    // ĐỢT 71: máu KHÔNG còn tự hồi khi hết trận. Vì vậy phải tính bản CUỐI
    // CÙNG của con ra trận ngay tại đây rồi ghi MỘT lần, thay vì gọi
    // revertGimmicks() (setState) rồi resetBattle() (setState nữa) — hai
    // lần ghi liên tiếp dễ đè nhau và làm máu thật bị mất.
    // Biến hình Mega/Dynamax/Tera chỉ tồn tại TRONG trận nên trả về bản gốc,
    // nhưng GIỮ nguyên lượng máu và trạng thái đang có.
    const base = preGimmickRef.current
    const finalMon = restoreGimmickMon({
      ...playerMon,
      ...(playerMon.status === 'slp' ? { sleepTurns: playerMon.sleepTurns } : { sleepTurns: undefined }),
    }, base)
    const persistedMon = restoreTransientHeldItem(clearHeldItemVolatile(clearBattleVolatile(finalMon)))
    const restoredParty = (party ?? []).map((mon) => restoreTransientHeldItem(clearHeldItemVolatile(clearBattleVolatile(restoreGimmickMon(mon, base)))))
    const finalParty = syncMonInParty(restoredParty, persistedMon)
    const finalEnemy = restoreTransientHeldItem(clearHeldItemVolatile(clearBattleVolatile(enemyMon)))
    const allEnemies = [...defeatedEnemiesRef.current, finalEnemy]
    preGimmickRef.current = null
    setPlayerMon(persistedMon)
    // Đồng bộ máu/trạng thái về ĐỘI HÌNH — nếu không, HUD vẫn hiện máu đầy
    // trong khi con đang ra trận thoi thóp.
    setParty(finalParty)
    resetBattle() // giờ chỉ reset đối thủ
    onBattleEnd(outcome, {
      mode: 'single', team: finalParty, enemies: allEnemies,
      participantUids: [...participantsRef.current],
      leadUid: participantKey(persistedMon),
    })
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
          {/* Đợt 64: ghi rõ hệ quả như bên ShopModal — ẨN chỉ cất bảng đi,
              trận VẪN đang diễn ra (máu/trạng thái đối thủ được giữ). */}
          {!finished && (
            <button
              className="btn"
              onClick={() => onClose?.(buildBattleRuntime())}
              style={{ padding: '4px 10px' }}
              title="Cất bảng trận đi — trận VẪN tiếp diễn, máu và trạng thái đối thủ được giữ nguyên; bấm lại quả bóng để quay vào"
            >
              ✕ Ẩn (trận vẫn tiếp diễn)
            </button>
          )}
        </div>

        {/* Môi trường trận (đợt 35): banner + hiệu ứng sát thương theo hệ */}
        {battleEnv && battleEnv.key !== 'none' && (
          <div
            style={{
              fontSize: 11, color: 'var(--text-mid)', border: '1px dashed var(--line)',
              borderRadius: 8, padding: '5px 10px', marginBottom: 8,
            }}
            title={battleEnv.desc}
          >
            {battleEnv.label} — {battleEnv.desc}{weatherTurns !== null ? ` · còn ${weatherTurns} lượt` : ''}
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
                    available: megaFormes.some((form) => canUseMegaWithItems(playerMon, form, inventory, devUnlockGimmicks).ok),
                    reason: megaFormes.length === 0
                      ? 'loài này không có forme Mega'
                      : (canUseMegaWithItems(playerMon, megaFormes[0], inventory, devUnlockGimmicks).reason || 'không cầm đúng Mega Stone'),
                    onPick: () => {
                      const usable = megaFormes.filter((form) => canUseMegaWithItems(playerMon, form, inventory, devUnlockGimmicks).ok)
                      if (usable.length === 1) doMega(usable[0])
                      else setMegaPickOpen(true)
                    },
                  },
                  zmove: {
                    available: canUseZMoveWithItems(playerMon, inventory, devUnlockGimmicks).ok,
                    reason: canUseZMoveWithItems(playerMon, inventory, devUnlockGimmicks).reason,
                    onPick: () => {
                      setZArmed(true)
                      setGimmickOpen(false)
                      pushLog('✦ Năng lượng Z tụ lại — hãy chọn 1 chiêu sát thương để phóng Z-Move!')
                    },
                  },
                  dynamax: {
                    available: devUnlockGimmicks || (trainerHasGear(inventory, 'dynamax') && playerLocation?.regionKey === 'galar'),
                    reason: !trainerHasGear(inventory, 'dynamax') ? 'cần Dynamax Band' : 'Dynamax chỉ hoạt động tại Power Spot ở Galar',
                    onPick: doDynamax,
                  },
                  tera: {
                    available: devUnlockGimmicks || trainerHasGear(inventory, 'tera'),
                    reason: 'cần Tera Orb (chỉ có ở Paldea) — chưa có trong túi',
                    color: TYPE_COLORS[playerMon.teraType ?? playerMon.types[0]] ?? '#5fd7e8',
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
                {megaFormes.map((f) => {
                  const permission = canUseMegaWithItems(playerMon, f, inventory, devUnlockGimmicks)
                  return (
                    <button key={f.name} className="btn" disabled={!permission.ok} title={permission.reason} style={{ fontSize: 11 }} onClick={() => doMega(f)}>
                      {f.name} · {f.requiredItem ?? 'Mega Stone'}
                    </button>
                  )
                })}
                <button className="btn" style={{ fontSize: 11 }} onClick={() => setMegaPickOpen(false)}>✕</button>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              {playerMon.moves.map((move) => {
                const zTarget = zArmed && (devUnlockGimmicks ? move.power > 0 : zCrystalMatchesMove(playerMon, move))
                const ppLeft = Number(move.currentPp ?? move.pp ?? 35)
                const zDisabled = ppLeft <= 0 || (zArmed && !zTarget) || !heldItemMoveAllowed(playerMon, move).allowed
                return (
                  <button
                    key={move.name}
                    className="btn"
                    disabled={busy || battleOver || zDisabled}
                    title={!heldItemMoveAllowed(playerMon, move).allowed ? heldItemMoveAllowed(playerMon, move).reason : (zArmed && !zTarget ? 'Chiêu không cùng hệ với Z-Crystal đang cầm.' : '')}
                    onClick={() => {
                      if (zTarget) {
                        // Phóng Z-Move: bản Z của chiêu này, power theo bảng, dùng 1 lần.
                        setZArmed(false)
                        setGimmickUsed('zmove')
                        pushLog(`✦ ${playerMon.name} phóng Z-MOVE: Z-${move.name}!!`)
                        handleMove({
                          ...move, baseMoveName: move.name, isZMove: true, name: `Z-${move.name}`, power: zPower(move.power),
                          multihit: null, drain: null, recoil: null, status: null, boosts: null,
                          self: null, secondary: null, secondaries: [], volatileStatus: null,
                          sideCondition: null, weather: null, forceSwitch: false, selfSwitch: null, flags: {},
                        })
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
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <small style={{ color: ppLeft <= 0 ? 'var(--coral)' : 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>PP {ppLeft}/{move.maxPp ?? move.pp ?? 35}</small>
                      <TypeBadge type={move.type} />
                    </span>
                  </button>
                )
              })}
              {(playerMon.moves ?? []).every((move) => Number(move.currentPp ?? move.pp ?? 35) <= 0) && (
                <button className="btn" disabled={busy || battleOver} onClick={() => handleMove({ id: 'struggle', name: 'Struggle', type: 'normal', category: 'Physical', power: 50, recoil: [1, 4], isStruggle: true })} style={{ gridColumn: '1 / -1', color: 'var(--coral)' }}>
                  Struggle · không còn chiêu có PP
                </button>
              )}
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
          <BagPanel
            inventory={inventory}
            busy={busy}
            onBack={() => setMenu('main')}
            canUse={(it) =>
              BALL_BONUS[it.id] !== undefined
              || HEAL_AMOUNT[it.id] !== undefined
              || Boolean(STATUS_CURE[it.id])
              || it.id === 'revive'}
            onUse={handleUseItem}
          />
        ) : menu === 'revive' ? (
          <div>
            <p style={{ fontSize: 12.5, color: 'var(--text-mid)', margin: '4px 0 10px' }}>
              Chọn một Pokémon dự bị đã gục để dùng {pendingReviveItem?.name ?? 'Revive'}:
            </p>
            {(party ?? []).filter((mon) => mon && !isSameMon(mon, playerMon) && (mon.hp ?? 0) <= 0).map((mon) => (
              <button
                key={mon.uid ?? `${mon.name}-${mon.level}`}
                className="btn"
                style={{ width: '100%', marginBottom: 6, textAlign: 'left' }}
                onClick={() => handleReviveTarget(mon)}
                disabled={busy}
              >
                {mon.name} · Lv.{mon.level} · đã gục
              </button>
            ))}
            <button className="btn" style={{ width: '100%' }} onClick={() => { setPendingReviveItem(null); setMenu('bag') }} disabled={busy}>
              ← Quay lại túi
            </button>
          </div>
        ) : menu === 'party' ? (
          <div>
            {mustSwitch && (
              <div className="status-pill status-pill--error" style={{ display: 'block', marginBottom: 8 }}>
                {playerMon.name} đã gục — hãy chọn Pokémon khác ra trận (không tốn lượt).
              </div>
            )}
            {/* Đợt 68: đổi Pokémon THẬT (trước đây chỉ báo "đang phát triển"). */}
            {(party ?? []).filter((pm) => !isSameMon(pm, playerMon)).length === 0 ? (
              <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '4px 0 12px' }}>
                {playerMon.name} là Pokémon duy nhất trong đội — chưa có ai để đổi.
              </p>
            ) : (
              <div style={{ margin: '4px 0 12px' }}>
                {(party ?? []).map((pm) => {
                  const isActive = isSameMon(pm, playerMon)
                  const fainted = (pm?.hp ?? 0) <= 0
                  return (
                    <button
                      key={pm?.uid ?? `${pm?.name}-${pm?.level}`}
                      onClick={() => handleSwitchMon(pm)}
                      disabled={busy || isActive || fainted}
                      style={{
                        display: 'flex', justifyContent: 'space-between', width: '100%',
                        alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 4,
                        border: `1px solid ${isActive ? 'var(--mint)' : 'var(--line)'}`,
                        borderRadius: 8, background: 'transparent',
                        color: fainted ? 'var(--text-dim)' : 'var(--text-main)',
                        opacity: fainted ? 0.45 : 1,
                        cursor: busy || isActive || fainted ? 'default' : 'pointer',
                        fontSize: 12.5, textAlign: 'left',
                      }}
                    >
                      <span>
                        {pm?.name} <span style={{ color: 'var(--text-dim)' }}>Lv.{pm?.level}</span>
                        {isActive && <span style={{ color: 'var(--mint)' }}> · đang ra trận</span>}
                        {fainted && <span style={{ color: '#d94f4f' }}> · đã gục</span>}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-mid)' }}>
                        {pm?.hp}/{pm?.maxHp}
                      </span>
                    </button>
                  )
                })}
                <p style={{ fontSize: 10.5, color: 'var(--text-dim)', margin: '6px 0 0' }}>
                  Đổi Pokémon tốn 1 lượt — đối phương sẽ được đánh trả.
                </p>
              </div>
            )}
            {!mustSwitch && (
              <button className="btn" style={{ width: '100%' }} onClick={() => setMenu('main')}>
                ← Quay lại
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {/* Đợt 69: con đang ra trận gục mà còn dự bị → CHỈ cho đổi Pokémon. */}
            <MenuButton label="FIGHT" sub="Chọn chiêu thức" color="var(--coral)" onClick={() => setMenu('fight')} disabled={busy || battleOver || mustSwitch} />
            <MenuButton label="BAG" sub="Vật phẩm" color="var(--amber)" onClick={() => setMenu('bag')} disabled={busy || battleOver || mustSwitch} />
            <MenuButton
              label="POKÉMON"
              sub={mustSwitch ? 'BẮT BUỘC đổi!' : 'Đổi Pokémon'}
              color="var(--mint)"
              onClick={() => setMenu('party')}
              disabled={busy || battleOver}
            />
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
