import React, { useEffect, useState } from 'react'
import { genderSymbol } from '../data/pokemonGender.js'

const labels = {
  vi: {
    title: 'Hiệu chỉnh trạng thái', manualNote: 'Chỉ sửa theo bằng chứng có thật trong chính văn. Cấm đổi loài Pokémon, UID, level, IV/EV. Phải kiểm chứng và xác nhận; có hoàn tác.', gender: 'Giới tính', nickname: 'Biệt danh', current: 'hiện có', manual: 'Tự sửa theo chính văn', ai: 'AI kiểm tra Pokémon', fact: 'Biến truyện đã xác lập', factKey: 'Tên biến/canon', factValue: 'Giá trị nguyên văn', source: 'Lượt chính văn làm bằng chứng', quote: 'Trích nguyên văn (sao chép từ đoạn đã chọn)', kind: 'Loại biến cần sửa', pokemon: 'Thuộc tính Pokémon', item: 'Vật phẩm nhận/tiêu', money: 'Số dư ví', field: 'Thuộc tính', value: 'Giá trị đúng', itemName: 'Tên vật phẩm như trong chính văn', delta: 'Số lượng thay đổi (+ nhận, − tiêu)', check: 'Kiểm chứng đoạn dẫn', choose: 'Chọn Pokémon', question: 'Điều gì đang sai?', placeholder: 'Ví dụ: Pikachu đã được xác nhận là đực ở lượt trước, nhưng save lại là cái.',
    examine: 'AI đối chiếu chính văn', wait: 'Đang kiểm tra bằng chứng…', candidate: 'Đề xuất sửa', proof: 'Bằng chứng chính văn', approve: 'Xác nhận sửa',
    close: 'Đóng', undo: 'Hoàn tác sửa gần nhất', none: 'Chưa có bằng chứng đủ rõ để sửa. Không thay đổi save.', history: 'Lịch sử', note: 'Không sinh thêm lượt truyện. Chỉ sửa thuộc tính Pokémon khi AI trích nguyên văn được bằng chứng; bạn phải xác nhận. Hiện hỗ trợ giới tính, biệt danh, Shiny.',
  },
  en: {
    title: 'State correction', manualNote: 'Only corrections supported by saved story prose are allowed. Species, UID, level and IV/EV cannot be edited. Verify evidence, confirm, or undo.', gender: 'Gender', nickname: 'Nickname', current: 'current', manual: 'Manual canon repair', ai: 'AI Pokémon review', fact: 'Established story fact', factKey: 'Fact key', factValue: 'Verbatim fact value', source: 'Source story turn', quote: 'Exact quotation from this turn', kind: 'State change', pokemon: 'Pokémon attribute', item: 'Item received/used', money: 'Wallet balance', field: 'Attribute', value: 'Correct value', itemName: 'Item name as shown in story', delta: 'Quantity change (+ gain, − use)', check: 'Check evidence', choose: 'Select Pokémon', question: 'What is incorrect?', placeholder: 'Example: Pikachu was explicitly male in the story but saved as female.',
    examine: 'AI review canon', wait: 'Checking evidence…', candidate: 'Proposed change', proof: 'Verbatim story evidence', approve: 'Apply correction',
    close: 'Close', undo: 'Undo last correction', none: 'No safe evidence found. Save was not changed.', history: 'History', note: 'No story turn is generated. The AI must cite exact prose and you must approve. Currently supports gender, nickname, and Shiny.',
  },
  zh: {
    title: '状态纠错', manualNote: '只能根据已保存的正文修正变量，不能更改宝可梦种类、UID、等级或 IV/EV。先验证证据，再确认修改；可撤销最近一次。', gender: '性别', nickname: '昵称', current: '当前', manual: '依据正文手动修正', ai: 'AI 核对宝可梦', fact: '既有剧情事实', factKey: '事实名称', factValue: '原文中的事实值', source: '证据所在正文回合', quote: '精确复制正文引用', kind: '修正变量类型', pokemon: '宝可梦属性', item: '物品增减', money: '钱包余额', field: '属性', value: '正确数值', itemName: '正文中的物品名称', delta: '数量变化（+获得，−消耗）', check: '验证证据', choose: '选择宝可梦', question: '哪里有错误？', placeholder: '例如：剧情中皮卡丘明确是雄性，但队伍里显示雌性。',
    examine: 'AI 核对正文', wait: '正在核对原文证据…', candidate: '建议修正', proof: '原文证据', approve: '确认修正',
    close: '关闭', undo: '撤销上次修正', none: '未找到足够可靠的原文证据，存档未修改。', history: '修正记录', note: '不会推进剧情。AI 必须引用真实原文，并经你确认。现支持性别、昵称和闪光属性。',
  },
}

export default function StateCorrectionModal({ language = 'vi', roster = [], inventory = [], money = 0, facts = {}, evidenceMessages = [], busy = false, initialHistory = [], onReview, onReviewManual, onApply, onUndo, onClose }) {
  const t = labels[language] ?? labels.vi
  const [tab, setTab] = useState('manual')
  const [manualKind, setManualKind] = useState('pokemon_attribute')
  const [manualField, setManualField] = useState('gender')
  const [manualValue, setManualValue] = useState('male')
  const [itemName, setItemName] = useState('')
  const [factKey, setFactKey] = useState('')
  const [factValue, setFactValue] = useState('')
  const [delta, setDelta] = useState('1')
  const [sourceId, setSourceId] = useState(evidenceMessages[evidenceMessages.length - 1]?.id ?? '')
  const [evidenceQuote, setEvidenceQuote] = useState('')
  const [uid, setUid] = useState(roster[0]?.uid ?? '')
  const [request, setRequest] = useState('')
  const [proposal, setProposal] = useState(null)
  const [result, setResult] = useState('')
  const [checking, setChecking] = useState(false)
  const [history, setHistory] = useState(initialHistory)
  const selected = roster.find((mon) => mon.uid === uid)
  useEffect(() => { if (!roster.some((mon) => mon.uid === uid)) setUid(roster[0]?.uid ?? '') }, [roster, uid])
  const manualReview = () => {
    if (checking || busy || !sourceId || !evidenceQuote.trim()) return
    setProposal(null); setResult('')
    try {
      const response = onReviewManual({
        kind: manualKind, targetUid: uid, field: manualField,
        value: manualKind === 'money_balance' ? Number(manualValue) : manualKind === 'pokemon_attribute' && manualField === 'shiny' ? manualValue === 'true' : manualValue,
        itemName, delta: Number(delta), factKey, factValue, previous:facts?.[`story:${factKey.toLowerCase()}`]?.value, sourceMessageId: sourceId, evidenceQuote,
      })
      if (!response?.ok) setResult(response?.error || t.none)
      else setProposal(response.patch)
    } catch (err) { setResult(err.message || String(err)) }
  }
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
      <p style={{ color:'var(--text-mid)', fontSize:12, lineHeight:1.65 }}>{t.manualNote}</p>
      <div style={{display:'flex',gap:8,margin:'12px 0',flexWrap:'wrap'}}>
        <button className={'btn'+(tab==='manual'?' btn--primary':'')} onClick={()=>{setTab('manual');setProposal(null);setResult('')}}>{t.manual}</button>
        <button className={'btn'+(tab==='ai'?' btn--primary':'')} onClick={()=>{setTab('ai');setProposal(null);setResult('')}}>{t.ai}</button>
      </div>
      {tab === 'manual' ? <>
        <label style={{display:'block',margin:'12px 0 6px'}}>{t.kind}</label>
        <select style={{width:'100%',padding:10,borderRadius:8,background:'var(--bg-deep)',color:'var(--text-hi)'}} value={manualKind} onChange={(e)=>{setManualKind(e.target.value);setProposal(null)}}>
          <option value="pokemon_attribute">{t.pokemon}</option>
          <option value="item_delta">{t.item}</option>
          <option value="money_balance">{t.money}</option>
          <option value="canon_fact">{t.fact}</option>
        </select>
        {manualKind === 'pokemon_attribute' && <>
          <label style={{display:'block',margin:'12px 0 6px'}}>{t.choose}</label>
          <select style={{width:'100%',padding:10,borderRadius:8,background:'var(--bg-deep)',color:'var(--text-hi)'}} value={uid} onChange={(e)=>{setUid(e.target.value);setProposal(null)}}>
            {roster.map(mon=><option key={mon.uid} value={mon.uid}>{mon.nickname || mon.name || mon.species} · Lv.{mon.level} · {genderSymbol(mon.gender)} · {mon.uid?.slice(-8)}</option>)}
          </select>
          <label style={{display:'block',margin:'12px 0 6px'}}>{t.field}</label>
          <select style={{width:'100%',padding:10,borderRadius:8,background:'var(--bg-deep)',color:'var(--text-hi)'}} value={manualField} onChange={(e)=>{setManualField(e.target.value);setManualValue(e.target.value==='shiny'?'true':e.target.value==='nickname'?'':'male');setProposal(null)}}>
            <option value="gender">{t.gender}</option>
            <option value="nickname">{t.nickname}</option>
            <option value="shiny">Shiny</option>
          </select>
        </>}
        {manualKind === 'canon_fact' && <>
          <label style={{display:'block',margin:'12px 0 6px'}}>{t.factKey}</label>
          <input value={factKey} onChange={(e)=>{setFactKey(e.target.value);setProposal(null)}} style={{width:'100%',boxSizing:'border-box',padding:10,borderRadius:8,background:'var(--bg-deep)',color:'var(--text-hi)'}} />
          <label style={{display:'block',margin:'12px 0 6px'}}>{t.factValue}</label>
          <textarea rows={2} value={factValue} onChange={(e)=>{setFactValue(e.target.value);setProposal(null)}} style={{width:'100%',boxSizing:'border-box',padding:10,borderRadius:8,background:'var(--bg-deep)',color:'var(--text-hi)'}} />
        </>}
        {manualKind === 'item_delta' && <>
          <label style={{display:'block',margin:'12px 0 6px'}}>{t.itemName}</label>
          <input list="state-repair-items" value={itemName} onChange={(e)=>{setItemName(e.target.value);setProposal(null)}} style={{width:'100%',boxSizing:'border-box',padding:10,borderRadius:8,background:'var(--bg-deep)',color:'var(--text-hi)'}} />
          <datalist id="state-repair-items">{inventory.map(i=><option key={i.id} value={i.name}/>)}</datalist>
          <label style={{display:'block',margin:'12px 0 6px'}}>{t.delta}</label>
          <input type="number" min="-99" max="99" step="1" value={delta} onChange={(e)=>{setDelta(e.target.value);setProposal(null)}} style={{width:'100%',boxSizing:'border-box',padding:10,borderRadius:8,background:'var(--bg-deep)',color:'var(--text-hi)'}} />
        </>}
        {(manualKind === 'money_balance' || manualKind === 'pokemon_attribute') && <>
          <label style={{display:'block',margin:'12px 0 6px'}}>{t.value}{manualKind==='money_balance'?` (${t.current}: ₽${money})`:''}</label>
          {manualKind === 'pokemon_attribute' && manualField !== 'nickname' ? <select style={{width:'100%',padding:10,borderRadius:8,background:'var(--bg-deep)',color:'var(--text-hi)'}} value={manualValue} onChange={(e)=>{setManualValue(e.target.value);setProposal(null)}}>
            {(manualField === 'gender' ? [['male','♂ Male'],['female','♀ Female'],['unknown','Genderless']] : [['true','Shiny'],['false','Not shiny']]).map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select> : <input type={manualKind==='money_balance'?'number':'text'} value={manualValue} onChange={(e)=>{setManualValue(e.target.value);setProposal(null)}} style={{width:'100%',boxSizing:'border-box',padding:10,borderRadius:8,background:'var(--bg-deep)',color:'var(--text-hi)'}} />}
        </>}
        <label style={{display:'block',margin:'12px 0 6px'}}>{t.source}</label>
        <select style={{width:'100%',padding:10,borderRadius:8,background:'var(--bg-deep)',color:'var(--text-hi)'}} value={sourceId} onChange={(e)=>{setSourceId(e.target.value);setEvidenceQuote('');setProposal(null)}}>
          <option value="">—</option>
          {evidenceMessages.slice().reverse().map((m,i)=><option key={m.id} value={m.id}>{`#${evidenceMessages.length-i} · ${String(m.meta?.evidenceText || m.content || '').replace(/\s+/g,' ').slice(0,90)}`}</option>)}
        </select>
        {sourceId && <div style={{maxHeight:130,overflowY:'auto',whiteSpace:'pre-wrap',fontSize:12,marginTop:8,padding:10,border:'1px solid var(--line)',borderRadius:8,color:'var(--text-mid)'}}>{String(evidenceMessages.find(m=>m.id===sourceId)?.meta?.evidenceText || evidenceMessages.find(m=>m.id===sourceId)?.content || '').slice(0,8000)}</div>}
        <label style={{display:'block',margin:'12px 0 6px'}}>{t.quote}</label>
        <textarea rows={3} value={evidenceQuote} onChange={(e)=>{setEvidenceQuote(e.target.value);setProposal(null)}} style={{width:'100%',boxSizing:'border-box',padding:10,borderRadius:8,background:'var(--bg-deep)',color:'var(--text-hi)'}} />
        <button className="btn btn--primary" style={{marginTop:10}} onClick={manualReview} disabled={busy || !sourceId || !evidenceQuote.trim()}>{t.check}</button>
      </> : <>
      <label style={{ display:'block', margin:'12px 0 6px' }}>{t.choose}</label>
      <select style={{ width:'100%', padding:10, borderRadius:8, background:'var(--bg-deep)', color:'var(--text-hi)' }} value={uid} onChange={(e)=>{setUid(e.target.value); setProposal(null)}}>
        {roster.map((mon) => <option key={mon.uid} value={mon.uid}>{mon.nickname || mon.name || mon.species} · {mon.name} · Lv.{mon.level} · {genderSymbol(mon.gender)} · {mon.uid?.slice(-8)}</option>)}
      </select>
      <label style={{ display:'block', margin:'14px 0 6px' }}>{t.question}</label>
      <textarea rows={3} style={{width:'100%',boxSizing:'border-box',padding:10,borderRadius:8,background:'var(--bg-deep)',color:'var(--text-hi)'}} value={request} placeholder={t.placeholder} onChange={(e) => {setRequest(e.target.value);setProposal(null)}} />
      <button className="btn btn--primary" style={{marginTop:10}} disabled={!selected || !request.trim() || checking || busy} onClick={review}>{checking ? t.wait : t.examine}</button>
      </>}
      {result && <p role="status" style={{fontSize:13, whiteSpace:'pre-wrap', color:'var(--amber)'}}>{result}</p>}
      {proposal && <div style={{border:'1px solid var(--line)',borderRadius:10,padding:12,marginTop:12}}>
        <strong>{t.candidate}</strong>
        <p>{proposal.kind === 'item_delta' ? proposal.itemName : proposal.kind === 'money_balance' ? t.money : proposal.kind === 'canon_fact' ? proposal.factKey : proposal.field}: {String(proposal.before ?? '—')} → <b>{String(proposal.value)}</b></p>
        <div style={{fontSize:12,color:'var(--text-mid)'}}>{t.proof}</div><blockquote style={{margin:'6px 0',fontSize:13,whiteSpace:'pre-wrap'}}>{proposal.evidenceQuote}</blockquote>
        <button className="btn btn--primary" disabled={busy || checking} onClick={apply}>{t.approve}</button>
      </div>}
      <div style={{marginTop:18,borderTop:'1px solid var(--line)',paddingTop:12}}>
        <strong>{t.history}</strong>
        {history.slice(-5).reverse().map((item,index) => <p key={`${item.date}-${index}`} style={{fontSize:12,margin:'6px 0'}}>{item.itemName || (item.kind === 'money_balance' ? t.money : item.kind === 'canon_fact' ? item.factKey : item.field)}: {String(item.before ?? '—')} → {String(item.value)} · {item.date?.slice(0,16)}</p>)}
        <button className="btn" style={{marginTop:8}} disabled={!history.length || busy || checking} onClick={undo}>{t.undo}</button>
      </div>
    </div>
  </div>
}
