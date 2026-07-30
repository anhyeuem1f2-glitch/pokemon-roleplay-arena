import React, { useMemo, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { acceptTradePacket, decodeTradePacket, encodeTradePacket, makeTradeOffer, verifyReceipt } from '../data/trading.js'
import { modeAllowsTrading } from '../data/gameModes.js'

export default function TradeModal({ onClose }) {
  const { storyTone, trainerId, trainerCode, party, setParty, pcBox, setPcBox, playerMon, setPlayerMon, tradeState, setTradeState } = useGame()
  const owned = useMemo(() => [...party, ...pcBox].filter((mon, index, all) => all.findIndex((x) => x.uid === mon.uid) === index), [party, pcBox])
  const [selectedId, setSelectedId] = useState(owned[0]?.uid ?? '')
  const [recipientCode, setRecipientCode] = useState('')
  const [packetText, setPacketText] = useState('')
  const [receiptText, setReceiptText] = useState('')
  const [notice, setNotice] = useState('')
  const allowed = modeAllowsTrading(storyTone)

  function createOffer() {
    try {
      const mon = owned.find((item) => item.uid === selectedId)
      if (!mon) throw new Error('Hãy chọn Pokémon cần gửi.')
      const offer = makeTradeOffer(mon, trainerId, recipientCode, storyTone)
      setTradeState((cur) => ({ ...cur, escrow: [...cur.escrow, offer] }))
      setParty((cur) => cur.filter((item) => item.uid !== mon.uid))
      setPcBox((cur) => cur.filter((item) => item.uid !== mon.uid))
      setPlayerMon((cur) => cur?.uid === mon.uid ? (party.find((item) => item.uid !== mon.uid) ?? null) : cur)
      setPacketText(encodeTradePacket(offer))
      setNotice(`${mon.name} đã vào escrow. Gửi gói JSON bên dưới cho người nhận.`)
    } catch (error) { setNotice(error.message) }
  }

  function receive() {
    try {
      const packet = decodeTradePacket(packetText)
      const result = acceptTradePacket(packet, trainerId, trainerCode, tradeState, owned, storyTone)
      if (party.length < 6) {
        setParty((cur) => [...cur, result.pokemon])
        setPlayerMon((cur) => cur ?? result.pokemon)
      } else setPcBox((cur) => [...cur, result.pokemon])
      setTradeState(result.tradeState)
      setReceiptText(JSON.stringify(result.receipt))
      setNotice(`Đã nhận ${result.pokemon.name} · ${result.pokemon.pokemonId}. Gửi biên nhận lại cho người gửi.`)
    } catch (error) { setNotice(error.message) }
  }

  function finalize(offer) {
    try {
      verifyReceipt(receiptText, offer)
      setTradeState((cur) => ({ ...cur, escrow: cur.escrow.filter((item) => item.transferId !== offer.transferId) }))
      setNotice('Biên nhận hợp lệ; đề nghị đã được hoàn tất khỏi escrow.')
    } catch (error) { setNotice(error.message) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 98, padding: 16, display: 'grid', placeItems: 'center', background: 'rgba(2,7,11,.85)', backdropFilter: 'blur(8px)' }}>
      <div onClick={(event) => event.stopPropagation()} className="panel" style={{ width: 'min(860px,97vw)', maxHeight: '93vh', overflowY: 'auto', borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><div style={{ color: 'var(--amber)', fontSize: 10, fontWeight: 800 }}>MULTIPLAYER THỬ NGHIỆM</div><h2 className="page-title" style={{ margin: 0 }}>Trao đổi Pokémon</h2></div><button className="btn" onClick={onClose}>✕ Đóng</button></div>
        {!allowed ? <div style={{ marginTop: 16, padding: 14, border: '1px solid var(--amber)', borderRadius: 10 }}>Tính năng bị khoá: chỉ chế độ Thực tế mới được chuyển quyền sở hữu Pokémon.</div> : <>
          <div style={{ marginTop: 12, padding: 10, border: '1px solid var(--line)', borderRadius: 9, color: 'var(--text-mid)', fontSize: 11.5 }}>Mã trainer công khai: <b style={{ color: 'var(--mint)', fontFamily: 'var(--font-mono)' }}>{trainerCode}</b>. Đây là thử nghiệm ngang hàng bằng gói JSON; muốn chống sao chép tuyệt đối cần máy chủ trung tâm.</div>
          {notice && <div style={{ marginTop: 10, color: 'var(--amber)' }}>{notice}</div>}
          <Panel title="1. Tạo đề nghị gửi">
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">— Pokémon —</option>{owned.map((mon) => <option key={mon.uid} value={mon.uid}>{mon.name} · {mon.pokemonId}</option>)}</select>
            <input value={recipientCode} onChange={(event) => setRecipientCode(event.target.value.toUpperCase())} placeholder="Mã người nhận TR-… (để trống = ai cũng nhận)" style={{ marginLeft: 8, minWidth: 270 }} />
            <button className="btn" onClick={createOffer} style={{ marginLeft: 8 }}>Đưa vào escrow</button>
          </Panel>
          <Panel title="2. Gửi / nhận gói JSON">
            <textarea value={packetText} onChange={(event) => setPacketText(event.target.value)} placeholder="Dán gói trao đổi từ người gửi, hoặc sao chép gói vừa tạo…" style={{ width: '100%', minHeight: 120 }} />
            <button className="btn" onClick={receive}>Nhận gói này</button>
          </Panel>
          <Panel title="3. Biên nhận">
            <textarea value={receiptText} onChange={(event) => setReceiptText(event.target.value)} placeholder="Người nhận gửi chuỗi biên nhận này lại cho người gửi…" style={{ width: '100%', minHeight: 90 }} />
            {tradeState.escrow.map((offer) => <div key={offer.transferId} style={{ marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 8 }}><span>{offer.pokemon.name} · {offer.pokemon.pokemonId}</span><button className="btn" onClick={() => finalize(offer)} style={{ marginLeft: 8 }}>Xác nhận biên nhận</button><button className="btn" onClick={() => setPacketText(encodeTradePacket(offer))} style={{ marginLeft: 6 }}>Hiện lại gói</button></div>)}
          </Panel>
        </>}
      </div>
    </div>
  )
}

function Panel({ title, children }) { return <section style={{ marginTop: 12, border: '1px solid var(--line)', borderRadius: 11, padding: 12, color: 'var(--text-mid)', fontSize: 12 }}><b style={{ display: 'block', color: 'var(--text-hi)', marginBottom: 8 }}>{title}</b>{children}</section> }
