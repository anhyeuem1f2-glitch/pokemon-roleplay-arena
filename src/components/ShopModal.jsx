import React, { useEffect, useMemo, useState, useRef } from 'react'
import { SHOP_CATEGORY_LABELS } from '../data/shopItems.js'
import { musicManager } from '../utils/musicManager.js'
import { SHOP_TRACK_KEYS } from '../data/musicTracks.js'
import { useGame } from '../context/GameContext.jsx'
import { chatCompletion } from '../services/aiClient.js'
import { buildStoryLanguageInstruction, resolveStoryLanguage } from '../i18n/storyLanguage.js'
import { localizeShopItem, shopCategoryLabel, shopNumberLocale, shopSizeLabel, shopUi } from '../i18n/shopLocalization.js'
import {
  generateShopItems, detectShopType, pickShopkeeperPersonality, GENERATED_CATEGORY_LABELS,
} from '../data/shopGenerator.js'

// Nhãn category gộp (tĩnh + sinh tự động).
const ALL_CATEGORY_LABELS = { ...SHOP_CATEGORY_LABELS, ...GENERATED_CATEGORY_LABELS }

// ============ GIAO DIỆN GIỎ HÀNG (đợt 24) ============
// Hoạt động cùng cơ chế với quả pokeball: AI chèn tag [[SHOP Tên]] khi người
// chơi bước vào cửa hàng → app hiện nút 🛒 → mở modal này. Chọn số lượng,
// xem tổng tiền so với ví; bấm "Mua & tiếp tục" → trừ tiền, cộng túi đồ,
// gửi note kết quả cho AI kể tiếp. "Rời không mua" cũng báo AI để truyện
// không bị treo ở cửa hàng. Mỗi tag shop chỉ dùng 1 lần (khoá như pokeball).
export default function ShopModal({ shop, shopName, money, onFinish, onClose }) {
  const [qty, setQty] = useState({}) // {itemId: n}
  const { apiConfig, uiLanguage, mainPreset, stylePreset } = useGame()
  // ===== Cửa hàng động (đợt 37) =====
  // shop = {name, type, size} từ tag [[SHOP ... | loại=... | quy mô=...]].
  // Hàng sinh deterministic theo TÊN — mở lại đúng cửa hàng là đúng hàng.
  const shopInfo = shop ?? { name: shopName ?? shopUi('shop', uiLanguage, 'Cửa hàng'), type: '', size: '' }
  const items = useMemo(() => generateShopItems(shopInfo), [shopInfo.name, shopInfo.type, shopInfo.size])
  const personality = useMemo(() => pickShopkeeperPersonality(shopInfo.name), [shopInfo.name])
  const storyLanguage = resolveStoryLanguage(uiLanguage, mainPreset, stylePreset)
  const numberLocale = shopNumberLocale(uiLanguage)
  const displayItems = useMemo(() => new Map(items.map((item) => [item.id, localizeShopItem(item, uiLanguage)])), [items, uiLanguage])
  const displayOf = (item) => displayItems.get(item.id) ?? { name: item.name, desc: item.desc }
  const tx = (key, vi) => shopUi(key, uiLanguage, vi)
  const [chatLog, setChatLog] = useState([]) // {who:'user'|'npc', text}
  const [talkInput, setTalkInput] = useState('')
  const [talkBusy, setTalkBusy] = useState(false)
  const [discount, setDiscount] = useState(0) // % giảm giá đã mặc cả được (trần 25)
  const [highlighted, setHighlighted] = useState([]) // id các món chủ quán vừa nhắc (đợt 39)
  const [onlyHighlighted, setOnlyHighlighted] = useState(false) // lọc chỉ hiện món được gợi ý
  const itemRefs = useRef({})
  const [freebies, setFreebies] = useState([]) // món được tặng
  const refusedRef = useRef(0) // số lần chủ quán đã từ chối giảm — càng kỳ kèo càng khó

  // Hỏi chủ quán: có hàng không / mặc cả / tán gẫu. Giao thức SUY NGHĨ NPC:
  // model được lệnh nghĩ thầm theo 4 bước (khách hỏi gì → tra kho → soi lời
  // mặc cả theo TÍNH CÁCH → quyết định) rồi CHỈ xuất thoại + đúng 1 dòng tag
  // [[KETQUA giảm=10]] / [[KETQUA không]] / [[KETQUA tặng=Tên món]].
  // App tra kho THẬT trước và đưa kết quả vào prompt để NPC không bịa hàng.
  async function handleAsk() {
    const q = talkInput.trim()
    if (!q || talkBusy) return
    setTalkBusy(true)
    setTalkInput('')
    setChatLog((l) => [...l, { who: 'user', text: q }])
    try {
      // Tra kho theo từ khoá câu hỏi (bỏ từ ngắn <3 ký tự).
      const words = q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3)
      const matches = items.filter((it) => {
        const shown = displayOf(it)
        const haystack = `${it.name} ${shown.name}`.toLowerCase()
        return words.some((w) => haystack.includes(w))
      })
      const sample = items.map((it) => `${displayOf(it).name} ₽${it.price}`).join('; ')
      const cfg = apiConfig
      const raw = await chatCompletion(cfg, [
        {
          role: 'system',
          content: [
            `Bạn đóng vai CHỦ QUÁN "${shopInfo.name}" (loại: ${detectShopType(shopInfo.type, shopInfo.name)}). TÍNH CÁCH: ${personality.desc}.`,
            `KHO HÀNG: tổng ${items.length} món. Mẫu: ${sample}.`,
            matches.length
              ? `TRA KHO theo câu khách hỏi — CÁC MÓN KHỚP: ${matches.map((it) => `${displayOf(it).name} ₽${it.price}`).join('; ')}. Trả lời dựa trên đúng danh sách này.`
              : `TRA KHO theo câu khách hỏi — KHÔNG có món nào khớp. Nói thật là không có, có thể gợi ý món gần giống trong mẫu kho.`,
            `Giảm giá đã cho phiên này: ${discount}% (TRẦN tuyệt đối 25%). Số lần đã từ chối giảm: ${refusedRef.current} (khách kỳ kèo dai thì cứng rắn dần).`,
            `QUY TRÌNH SUY NGHĨ (nghĩ thầm, TUYỆT ĐỐI không viết ra): (1) khách đang hỏi hàng, mặc cả, hay tán gẫu? (2) đối chiếu kết quả tra kho; (3) lời mặc cả có lý do chính đáng không (mua nhiều, chỉ đúng khuyết điểm, dễ mến) — cân với TÍNH CÁCH của mình; (4) chốt hành động.`,
            buildStoryLanguageInstruction(storyLanguage),
            `Trả lời bằng 1-3 câu thoại ĐÚNG TÍNH CÁCH theo ngôn ngữ đầu ra ở trên, rồi KẾT THÚC bằng đúng 1 dòng tag:`,
            `[[KETQUA giảm=X]] (X = TỔNG % giảm mới cho phiên, chỉ khi quyết định giảm, ≤25) | [[KETQUA tặng=Tên món đúng như đang hiển thị trong kho]] (hiếm) | [[KETQUA không]] (mọi trường hợp còn lại, kể cả chỉ hỏi hàng/tán gẫu).`,
          ].join('\n'),
        },
        { role: 'user', content: q },
      ], { temperature: 0.7, maxTokens: 300 })

      const tagMatch = raw.match(/\[\[\s*KETQUA\s+([^\]]+?)\s*\]\]/i)
      const speech = raw.replace(/\[\[\s*KETQUA[^\]]*\]\]/gi, '').trim()
      setChatLog((l) => [...l, { who: 'npc', text: speech || '…' }])
      // HIỂN THỊ MÓN ĐƯỢC GỢI Ý (đợt 39): chủ quán nhắc/giới thiệu món nào
      // (khớp tên trong lời thoại) hoặc các món tra-kho-khớp → highlight +
      // cuộn tới, khỏi phải tự tìm giữa hàng trăm món.
      const named = items.filter((it) => {
        if (!speech) return false
        const lowerSpeech = speech.toLowerCase()
        const internal = it.name.toLowerCase().split(' (')[0]
        const shown = displayOf(it).name.toLowerCase().split(/[（(]/)[0].trim()
        return lowerSpeech.includes(internal) || (shown && lowerSpeech.includes(shown))
      })
      const rec = [...new Set([...named, ...matches].map((it) => it.id))]
      if (rec.length) {
        setHighlighted(rec)
        setOnlyHighlighted(true)
        // Cuộn tới món đầu tiên sau khi render.
        setTimeout(() => {
          const el = itemRefs.current[rec[0]]
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 60)
      } else {
        setHighlighted([])
      }
      if (tagMatch) {
        const body = tagMatch[1].trim()
        const giam = body.match(/giảm\s*=\s*(\d+)/i) ?? body.match(/giam\s*=\s*(\d+)/i)
        const tang = body.match(/tặng\s*=\s*(.+)$/i) ?? body.match(/tang\s*=\s*(.+)$/i)
        if (giam) {
          const pct = Math.min(25, parseInt(giam[1], 10) || 0)
          if (pct > discount) setDiscount(pct)
          else refusedRef.current += 1
        } else if (tang) {
          const giftName = tang[1].trim().toLowerCase()
          const target = items.find((it) => it.name.toLowerCase().includes(giftName) || displayOf(it).name.toLowerCase().includes(giftName))
          if (target && !freebies.some((f) => f.id === target.id)) {
            setFreebies((f) => [...f, target])
          }
        } else {
          refusedRef.current += 1
        }
      }
    } catch (err) {
      setChatLog((l) => [...l, { who: 'npc', text: `(${tx('aiError', 'Lỗi gọi AI')}: ${err.message})` }])
    } finally {
      setTalkBusy(false)
    }
  }

  // Nhạc cửa hàng (đợt 28): đè lên nhạc khu vực khi modal mở, đóng thì trả lại.
  useEffect(() => {
    musicManager.pushOverride('shop', SHOP_TRACK_KEYS)
    return () => musicManager.popOverride('shop')
  }, [])

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + (qty[it.id] ?? 0) * it.price, 0),
    [qty, items],
  )
  const total = Math.round(subtotal * (1 - discount / 100))
  const anyPicked = total > 0
  const overBudget = total > money

  function bump(id, delta) {
    setQty((q) => {
      const n = Math.max(0, (q[id] ?? 0) + delta)
      return { ...q, [id]: n }
    })
  }

  function buy() {
    if (!anyPicked || overBudget) return
    const bought = items.filter((it) => (qty[it.id] ?? 0) > 0).map((it) => ({ ...it, qty: qty[it.id] }))
    // Quà chủ quán tặng qua mặc cả: vào túi với giá 0 (không tính tổng).
    for (const f of freebies) bought.push({ ...f, qty: 1, price: 0, gift: true })
    onFinish(bought, total)
  }

  const grouped = useMemo(() => {
    const g = {}
    for (const it of items) (g[it.category] ??= []).push(it)
    return g
  }, [items])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
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
          width: 'min(520px, 100%)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-panel-raised)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span className="page-title" style={{ margin: 0 }}>
            🛒 {shopInfo.name}
          </span>
          {/* Đợt 64: ghi rõ hệ quả — người chơi hay nhầm "Ẩn" với "không mua".
              ẨN = cất bảng đi, truyện KHÔNG chạy tiếp, mở lại bất cứ lúc nào. */}
          <button
            className="btn"
            style={{ padding: '4px 10px' }}
            onClick={onClose}
            title={tx('hideTitle', 'Cất bảng giá đi, chưa quyết định gì — truyện không chạy tiếp, bấm lại nút cửa hàng để mở ra')}
          >
            {tx('hide', '✕ Ẩn (chưa quyết)')}
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 6 }}>
          {tx('wallet', 'Ví của bạn')}: <strong style={{ color: 'var(--amber)' }}>₽{money.toLocaleString(numberLocale)}</strong>
          {' · '}<span style={{ color: 'var(--text-dim)' }}>{items.length} {tx('items', 'mặt hàng')}{shopInfo.size ? ` · ${tx('size', 'quy mô')} ${shopInfo.size}` : ''}</span>
          {discount > 0 && <span style={{ color: 'var(--mint)' }}> · {tx('bargained', 'đã mặc cả')} −{discount}%</span>}
        </div>

        {/* Nói chuyện với chủ quán (đợt 37): hỏi hàng / mặc cả */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8, marginBottom: 10, background: 'var(--bg-deep)' }}>
          {chatLog.length > 0 && (
            <div style={{ maxHeight: 120, overflowY: 'auto', marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {chatLog.map((m, i) => (
                <div key={i} style={{ fontSize: 11.5, color: m.who === 'user' ? 'var(--text-hi)' : 'var(--mint)' }}>
                  <b>{m.who === 'user' ? tx('you', 'Bạn') : tx('shopkeeper', 'Chủ quán')}:</b> {m.text}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={talkInput}
              onChange={(e) => setTalkInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAsk() }}
              placeholder={tx('askPlaceholder', 'Hỏi có hàng gì / xin giảm giá / tán gẫu với chủ quán...')}
              disabled={talkBusy}
              style={{ flex: 1, fontSize: 12 }}
            />
            <button className="btn" onClick={handleAsk} disabled={talkBusy || !talkInput.trim()} style={{ whiteSpace: 'nowrap' }}>
              {talkBusy ? '...' : tx('ask', 'Hỏi')}
            </button>
          </div>
          {freebies.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--mint)', marginTop: 6 }}>
              {tx('gift', '🎁 Chủ quán tặng kèm:')} {freebies.map((f) => displayOf(f).name).join(', ')}
            </div>
          )}
        </div>

        {highlighted.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 11.5 }}>
            <span style={{ color: 'var(--mint)' }}>{tx('introducedPrefix', '✨ Chủ quán vừa giới thiệu')} {highlighted.length} {tx('introducedSuffix', 'món.')}</span>
            <button
              className="btn"
              style={{ padding: '2px 10px', fontSize: 11, ...(onlyHighlighted ? { borderColor: 'var(--mint)', color: 'var(--mint)' } : {}) }}
              onClick={() => setOnlyHighlighted((v) => !v)}
            >
              {onlyHighlighted ? tx('showAll', 'Đang lọc — hiện tất cả') : tx('onlyRecommended', 'Chỉ hiện món được giới thiệu')}
            </button>
          </div>
        )}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {Object.entries(grouped)
            .map(([cat, grpItems]) => [cat, onlyHighlighted ? grpItems.filter((it) => highlighted.includes(it.id)) : grpItems])
            .filter(([, grpItems]) => grpItems.length > 0)
            .map(([cat, grpItems]) => (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--amber)', marginBottom: 6 }}>
                ◆ {shopCategoryLabel(cat, uiLanguage, ALL_CATEGORY_LABELS[cat] ?? cat)} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>({grpItems.length})</span>
              </div>
              {grpItems.map((it) => {
                const isRec = highlighted.includes(it.id)
                return (
                <div
                  key={it.id}
                  ref={(el) => { if (el) itemRefs.current[it.id] = el }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    border: `1px solid ${isRec ? 'var(--mint)' : 'var(--line)'}`,
                    background: isRec ? 'rgba(95,215,232,0.08)' : 'transparent',
                    borderRadius: 8,
                    padding: '7px 10px',
                    marginBottom: 6,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5 }}>
                      {displayOf(it).name}{' '}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--amber)' }}>
                        ₽{it.price.toLocaleString(numberLocale)}
                      </span>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{displayOf(it).desc}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button className="btn" style={{ padding: '2px 9px' }} onClick={() => bump(it.id, -1)} disabled={!(qty[it.id] > 0)}>
                      −
                    </button>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, width: 20, textAlign: 'center' }}>
                      {qty[it.id] ?? 0}
                    </span>
                    <button className="btn" style={{ padding: '2px 9px' }} onClick={() => bump(it.id, 1)}>
                      +
                    </button>
                  </div>
                </div>
                )
              })}
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 4 }}>
          {discount > 0 && subtotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 2 }}>
              <span>{tx('subtotal', 'Tạm tính')}</span>
              <span style={{ fontFamily: 'var(--font-mono)', textDecoration: 'line-through' }}>₽{subtotal.toLocaleString(numberLocale)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
            <span>{tx('total', 'Tổng cộng')}{discount > 0 ? ` (−${discount}%)` : ''}</span>
            <strong style={{ color: overBudget ? '#d94f4f' : 'var(--mint)', fontFamily: 'var(--font-mono)' }}>
              ₽{total.toLocaleString(numberLocale)}
              {overBudget && ` ${tx('insufficient', '(không đủ tiền!)')}`}
            </strong>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--primary" style={{ flex: 1 }} onClick={buy} disabled={!anyPicked || overBudget}>
              {tx('buyContinue', 'Mua & tiếp tục câu chuyện')}
            </button>
            <button
              className="btn"
              onClick={() => onFinish([], 0)}
              title={tx('noBuyTitle', 'Xác nhận KHÔNG mua gì — truyện viết tiếp cảnh bạn rời cửa hàng')}
            >
              {tx('noBuyContinue', 'Không mua & đi tiếp')}
            </button>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>
            {tx('footer', '"Ẩn" = tạm cất bảng giá, truyện đứng yên, mở lại được. "Không mua & đi tiếp" = chốt là không mua, truyện viết tiếp.')}
          </div>
        </div>
      </div>
    </div>
  )
}
