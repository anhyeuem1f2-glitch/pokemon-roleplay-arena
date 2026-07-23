import React, { useState, useEffect, useRef } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { chatCompletion } from '../services/aiClient.js'
import { cleanAiOutput } from '../utils/outputCleanup.js'
import MonAvatar from './MonAvatar.jsx'
import TypeBadge from './TypeBadge.jsx'
import { musicManager } from '../utils/musicManager.js'

// ============ CHẾ ĐỘ SAFARI (đợt 37) ============
// Kích hoạt khi người chơi Ở TRONG khu Safari (area.safari) và mở "pokeball"
// gặp Pokémon. KHÔNG đánh nhau: mỗi lượt chọn NÉM BÓNG / NÉM MỒI / NÓI
// CHUYỆN (dụ dỗ) — Pokémon phản ứng bằng 2 chỉ số ẩn: catchScore (khả năng
// bị bắt) và fleeChance (khả năng bỏ chạy). Mồi tăng cả hai (dụ tới gần
// nhưng dễ hoảng), nói chuyện dụ dỗ tăng catchScore + GIẢM fleeChance nếu
// lời hay (AI chấm), ném bóng thử bắt. Hết số bóng Safari (30) hoặc Pokémon
// chạy → kết thúc. Bắt được → vào đội (outcome 'caught').

const SAFARI_BALLS = 30

export default function SafariModal({ onClose, onSafariEnd }) {
  const { enemyMon, party, setParty, playerMon, setPlayerMon, apiConfig, playerLocation } = useGame()
  const [balls, setBalls] = useState(SAFARI_BALLS)
  const [catchScore, setCatchScore] = useState(20) // 0-100, ≥ ngưỡng random thì bắt được
  const [fleeChance, setFleeChance] = useState(15) // % bỏ chạy mỗi lượt sau hành động
  const [log, setLog] = useState([])
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(null) // null | 'caught' | 'fled' | 'out'
  const [talkInput, setTalkInput] = useState('')
  const [showTalk, setShowTalk] = useState(false)
  const continuingRef = useRef(false)

  useEffect(() => {
    musicManager.pushOverride('safari', ['exploration'])
    return () => musicManager.popOverride('safari')
  }, [])

  function push(text) {
    setLog((l) => [...l, text])
  }

  // Sau mỗi hành động: quyết định Pokémon có bỏ chạy không.
  function rollFlee() {
    if (Math.random() * 100 < fleeChance) {
      push(`${enemyMon.name} cảnh giác rồi phóng mình biến mất vào lùm cây!`)
      setFinished('fled')
      return true
    }
    return false
  }

  function throwBall() {
    if (busy || finished) return
    const left = balls - 1
    setBalls(left)
    // Xác suất bắt = catchScore, cộng chút may rủi.
    const roll = Math.random() * 100
    if (roll < catchScore) {
      push(`Bạn ném bóng Safari... 1... 2... 3... ✦ Bắt được ${enemyMon.name}!`)
      setFinished('caught')
      return
    }
    push(`Bóng rung ${Math.floor(roll / 34) + 1} cái rồi ${enemyMon.name} thoát ra! (khả năng bắt ~${catchScore}%)`)
    if (left <= 0) {
      push('Bạn đã hết bóng Safari — đành để nó lại.')
      setFinished('out')
      return
    }
    rollFlee()
  }

  function throwBait() {
    if (busy || finished) return
    // Mồi: catchScore +12, nhưng fleeChance +10 (ăn no dễ cảnh giác/no nê bỏ đi).
    setCatchScore((s) => Math.min(95, s + 12))
    setFleeChance((f) => Math.min(80, f + 10))
    push(`Bạn ném mồi. ${enemyMon.name} sà xuống ăn — có vẻ bị thu hút hơn, nhưng cũng cảnh giác hơn.`)
    rollFlee()
  }

  async function doTalk() {
    const q = talkInput.trim()
    if (!q || busy || finished) return
    setBusy(true)
    setTalkInput('')
    setShowTalk(false)
    push(`Bạn: "${q}"`)
    try {
      const cfg = apiConfig
      const raw = await chatCompletion(cfg, [
        {
          role: 'system',
          content: [
            `Bạn là trọng tài cho một cảnh DỤ DỖ Pokémon hoang trong khu Safari (KHÔNG đánh nhau).`,
            `Pokémon: ${enemyMon.name}, hệ ${enemyMon.types.join('/')}. Người chơi đang tìm cách nói/hành động để nó tin tưởng và chịu theo về.`,
            `Đọc lời/hành động của người chơi và chấm mức độ THUYẾT PHỤC (có hợp tập tính loài, có chân thành, có khôn khéo không).`,
            `Viết 1-2 câu MÔ TẢ phản ứng của Pokémon (tiếng Việt), rồi kết thúc bằng đúng 1 dòng tag: [[DUDO catch=+N flee=-M]] với N (0-20) là mức tăng khả năng bắt, M (0-15) là mức giảm khả năng bỏ chạy. Lời dở/khiến nó sợ thì N nhỏ hoặc 0 và có thể flee=+.`,
          ].join('\n'),
        },
        { role: 'user', content: q },
      ], { temperature: 0.7, maxTokens: 220 })
      const tag = raw.match(/\[\[\s*DUDO\s+catch\s*=\s*([+-]?\d+)\s+flee\s*=\s*([+-]?\d+)\s*\]\]/i)
      const speech = cleanAiOutput(raw.replace(/\[\[\s*DUDO[^\]]*\]\]/gi, '')).trim()
      push(speech || `${enemyMon.name} nghiêng đầu quan sát bạn.`)
      if (tag) {
        const dc = Math.max(-20, Math.min(20, parseInt(tag[1], 10) || 0))
        const df = parseInt(tag[2], 10) || 0
        setCatchScore((s) => Math.max(0, Math.min(95, s + dc)))
        setFleeChance((f) => Math.max(0, Math.min(80, f + df)))
        push(`(khả năng bắt ${dc >= 0 ? '+' : ''}${dc}%, cảnh giác ${df >= 0 ? '+' : ''}${df}%)`)
      }
      rollFlee()
    } catch (err) {
      push(`(Lỗi gọi AI: ${err.message} — không mất lượt.)`)
    } finally {
      setBusy(false)
    }
  }

  function handleContinue() {
    if (continuingRef.current) return
    continuingRef.current = true
    if (finished === 'caught') {
      if (party.length < 6) {
        setParty([...party, { ...enemyMon }])
        if (!playerMon) setPlayerMon({ ...enemyMon })
      }
    }
    onSafariEnd(finished === 'caught' ? 'caught' : finished === 'fled' ? 'flee' : 'escaped')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div className="panel" style={{ width: 'min(480px, 100%)', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span className="page-title" style={{ margin: 0 }}>🌿 SAFARI</span>
          <button className="btn" style={{ padding: '4px 10px' }} onClick={onClose}>Ẩn</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--line)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <MonAvatar mon={enemyMon} side="enemy" />
          <div>
            <div style={{ fontWeight: 700 }}>{enemyMon.name} <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Lv{enemyMon.level}</span></div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {enemyMon.types.map((t) => <TypeBadge key={t} type={t} />)}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 11, color: 'var(--text-mid)' }}>
            <div>Bóng Safari: <b>{balls}</b></div>
            <div style={{ color: 'var(--mint)' }}>Khả năng bắt ~{catchScore}%</div>
            <div style={{ color: fleeChance > 40 ? '#d94f4f' : 'var(--text-dim)' }}>Cảnh giác {fleeChance}%</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 12.5, lineHeight: 1.6, minHeight: 120 }}>
          {log.length === 0 && (
            <div style={{ color: 'var(--text-dim)' }}>
              Một {enemyMon.name} hoang dã đang cảnh giác quan sát bạn. Đây là khu Safari — không đánh nhau,
              chỉ có thể ném bóng, dụ mồi, hoặc nói chuyện để lấy lòng nó.
            </div>
          )}
          {log.map((line, i) => (
            <div key={i} style={{ marginBottom: 4, color: line.startsWith('(') ? 'var(--text-dim)' : 'inherit' }}>{line}</div>
          ))}
        </div>

        {!finished ? (
          showTalk ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={talkInput}
                onChange={(e) => setTalkInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') doTalk() }}
                placeholder="Nói / làm gì để dụ dỗ nó theo bạn..."
                disabled={busy}
                autoFocus
                style={{ flex: 1 }}
              />
              <button className="btn btn--primary" onClick={doTalk} disabled={busy || !talkInput.trim()}>Nói</button>
              <button className="btn" onClick={() => setShowTalk(false)} disabled={busy}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn btn--primary" onClick={throwBall} disabled={busy}>
                Ném bóng Safari <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>({balls})</span>
              </button>
              <button className="btn" onClick={throwBait} disabled={busy}>Ném mồi</button>
              <button className="btn" onClick={() => setShowTalk(true)} disabled={busy}>Nói chuyện / dụ dỗ</button>
              <button className="btn" onClick={() => { setFinished('out'); push('Bạn lặng lẽ lùi lại, để nó yên.') }} disabled={busy}>Bỏ đi</button>
            </div>
          )
        ) : (
          <button className="btn btn--primary" style={{ width: '100%' }} onClick={handleContinue}>
            Tiếp tục câu chuyện
          </button>
        )}
      </div>
    </div>
  )
}
