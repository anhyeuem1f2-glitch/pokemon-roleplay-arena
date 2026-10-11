import React, { useEffect, useState } from 'react'
import { genderSymbol } from '../data/pokemonGender.js'

const labels = {
  vi: {
    title: 'Hiệu chỉnh trạng thái', choose: 'Chọn Pokémon', question: 'Điều gì đang sai?', placeholder: 'Ví dụ: Pikachu đã được xác nhận là đực ở lượt trước, nhưng save lại là cái.',
    examine: 'AI đối chiếu chính văn', wait: 'Đang kiểm tra bằng chứng…', candidate: 'Đề xuất sửa', proof: 'Bằng chứng chính văn', approve: 'Xác nhận sửa',
    close: 'Đóng', undo: 'Hoàn tác sửa gần nhất', none: 'Chưa có bằng chứng đủ rõ để sửa. Không thay đổi save.', history: 'Lịch sử', note: 'Không sinh thêm lượt truyện. Chỉ sửa thuộc tính Pokémon khi AI trích nguyên văn được bằng chứng; bạn phải xác nhận. Hiện hỗ trợ giới tính, biệt danh, Shiny.',
  },
  en: {
    title: 'State correction', choose: 'Select Pokémon', question: 'What is incorrect?', placeholder: 'Example: Pikachu was explicitly male in the story but saved as female.',
    examine: 'AI review canon', wait: 'Checking evidence…', candidate: 'Proposed change', proof: 'Verbatim story evidence', approve: 'Apply correction',
    close: 'Close', undo: 'Undo last correction', none: 'No safe evidence found. Save was not changed.', history: 'History', note: 'No story turn is generated. The AI must cite exact prose and you must approve. Currently supports gender, nickname, and Shiny.',
  },
  zh: {
    title: '状态纠错', choose: '选择宝可梦', question: '哪里有错误？', placeholder: '例如：剧情中皮卡丘明确是雄性，但队伍里显示雌性。',
    examine: 'AI 核对正文', wait: '正在核对原文证据…', candidate: '建议修正', proof: '原文证据', approve: '确认修正',
    close: '关闭', undo: '撤销上次修正', none: '未找到足够可靠的原文证据，存档未修改。', history: '修正记录', note: '不会推进剧情。AI 必须引用真实原文，并经你确认。现支持性别、昵称和闪光属性。',
  },
}

export default function StateCorrectionModal({ language = 'vi', roster = [], busy = false, initialHistory = [], onReview, onApply, onUndo, onClose }) {
  const t = labels[language] ?? labels.vi
  const [uid, setUid] = useState(roster[0]?.uid ?? '')
  const [request, setRequest] = useState('')
  const [proposal, setProposal] = useState(null)
  const [result, setResult] = useState('')
  const [checking, setChecking] = useState(false)
  const [history, setHistory] = useState(initialHistory)
  const selected = roster.find((mon) => mon.uid === uid)
  useEffect(() => { if (!roster.some((mon) => mon.uid === uid)) setUid(roster[0]?.uid ?? '') }, [roster, uid])
  const review = async () => {
    if (!selected || !request.trim() || checking || busy) return
    setChecking(true); setProposal(null); setResult('')
    try {
      const response = await onReview(selected, request.trim())
      if (!response?.ok) setResult(response?.error || t.none)
      else setProposal(response.patch)
    } catch (err) { setResult(err.message || String(err)) }
    finally { setChecking(false) }
  }
  const apply = () => {
    if (!proposal || busy || checking) return
    try {
      const next = onApply(proposal)
      setHistory(next ?? [])
      setProposal(null)
      setResult(language === 'zh' ? '已修正。' : language === 'en' ? 'Correction saved.' : 'Đã lưu hiệu chỉnh.')
    } catch (err) { setResult(err.message) }
  }
  const undo = () => {
    if (busy || checking) return
    try { setHistory(onUndo() ?? []); setProposal(null); setResult('') }
    catch (err) { setResult(err.message) }
  }
  return <div role="dialog" aria-modal="true" aria-label={t.title} style={{ position:'fixed', inset:0, zIndex:3200, background:'rgba(0,0,0,.77)', display:'grid', placeItems:'center', padding:12 }}>
    <div style={{ width:'min(100%,620px)', maxHeight:'90vh', overflowY:'auto', padding:22, borderRadius:14, border:'1px solid var(--line)', background:'var(--bg-card, #172431)', color:'var(--text-hi)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
        <h3 style={{ margin:0 }}>{t.title}</h3>
        <button className="btn" onClick={onClose} disabled={checking}>{t.close}</button>
      </div>
      <p style={{ color:'var(--text-mid)', fontSize:12, lineHeight:1.65 }}>{t.note}</p>
      <label style={{ display:'block', margin:'12px 0 6px' }}>{t.choose}</label>
      <select style={{ width:'100%', padding:10, borderRadius:8, background:'var(--bg-deep)', color:'var(--text-hi)' }} value={uid} onChange={(e)=>{setUid(e.target.value); setProposal(null)}}>
        {roster.map((mon) => <option key={mon.uid} value={mon.uid}>{mon.nickname || mon.name || mon.species} · {mon.name} · Lv.{mon.level} · {genderSymbol(mon.gender)} · {mon.uid?.slice(-8)}</option>)}
      </select>
      <label style={{ display:'block', margin:'14px 0 6px' }}>{t.question}</label>
      <textarea rows={3} style={{width:'100%',boxSizing:'border-box',padding:10,borderRadius:8,background:'var(--bg-deep)',color:'var(--text-hi)'}} value={request} placeholder={t.placeholder} onChange={(e) => {setRequest(e.target.value);setProposal(null)}} />
      <button className="btn btn--primary" style={{marginTop:10}} disabled={!selected || !request.trim() || checking || busy} onClick={review}>{checking ? t.wait : t.examine}</button>
      {result && <p role="status" style={{fontSize:13, whiteSpace:'pre-wrap', color:'var(--amber)'}}>{result}</p>}
      {proposal && <div style={{border:'1px solid var(--line)',borderRadius:10,padding:12,marginTop:12}}>
        <strong>{t.candidate}</strong>
        <p>{proposal.field}: {String(proposal.before ?? '—')} → <b>{String(proposal.value)}</b></p>
        <div style={{fontSize:12,color:'var(--text-mid)'}}>{t.proof}</div><blockquote style={{margin:'6px 0',fontSize:13,whiteSpace:'pre-wrap'}}>{proposal.evidenceQuote}</blockquote>
        <button className="btn btn--primary" disabled={busy || checking} onClick={apply}>{t.approve}</button>
      </div>}
      <div style={{marginTop:18,borderTop:'1px solid var(--line)',paddingTop:12}}>
        <strong>{t.history}</strong>
        {history.slice(-5).reverse().map((item,index) => <p key={`${item.date}-${index}`} style={{fontSize:12,margin:'6px 0'}}>{item.field}: {String(item.before ?? '—')} → {String(item.value)} · {item.date?.slice(0,16)}</p>)}
        <button className="btn" style={{marginTop:8}} disabled={!history.length || busy || checking} onClick={undo}>{t.undo}</button>
      </div>
    </div>
  </div>
}
