import React, { useEffect, useMemo, useState } from 'react'
import {
  clearLlmDebugRecords,
  getLlmDebugRecords,
  subscribeLlmDebug,
} from '../services/llmDebug.js'

function formatJson(value) {
  if (typeof value === 'string') return value
  try { return JSON.stringify(value, null, 2) } catch { return String(value ?? '') }
}

function timeLabel(iso) {
  try { return new Date(iso).toLocaleTimeString() } catch { return iso ?? '' }
}

export default function LlmDebugModal({ onClose }) {
  const [, force] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [tab, setTab] = useState('request')

  useEffect(() => subscribeLlmDebug(() => force((n) => n + 1)), [])
  const records = getLlmDebugRecords()
  const selected = useMemo(() => records.find((entry) => entry.id === selectedId) ?? records[0] ?? null, [records, selectedId])

  async function copy(value) {
    const text = formatJson(value)
    try { await navigator.clipboard.writeText(text) } catch { /* clipboard may be blocked */ }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(1,6,10,.86)', backdropFilter: 'blur(7px)', padding: 14, display: 'grid', placeItems: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} className="panel" style={{ width: 'min(1180px, 98vw)', height: 'min(820px, 94vh)', padding: 0, overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto minmax(0,1fr)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
          <div>
            <div style={{ fontSize: 9.5, color: 'var(--amber)', fontWeight: 800, letterSpacing: '.14em' }}>DEVELOPER · LLM TRACE</div>
            <div className="page-title" style={{ marginTop: 2 }}>🐞 Debug Model · payload gửi / nhận</div>
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            <button className="btn" onClick={() => clearLlmDebugRecords()}>Xoá log</button>
            <button className="btn" onClick={onClose}>✕ Đóng</button>
          </div>
        </div>

        <div className="grid-resp" style={{ minHeight: 0, display: 'grid', gridTemplateColumns: '330px minmax(0,1fr)' }}>
          <div style={{ minHeight: 0, overflowY: 'auto', borderRight: '1px solid var(--line)', padding: 9 }}>
            {!records.length && <div style={{ color: 'var(--text-dim)', padding: 12, lineHeight: 1.55 }}>Chưa có request nào trong phiên này. Đóng modal, tái hiện bug rồi mở lại. Debug không lưu API key.</div>}
            {records.map((record) => (
              <button key={record.id} onClick={() => setSelectedId(record.id)} style={{ width: '100%', textAlign: 'left', marginBottom: 7, padding: '9px 10px', borderRadius: 8, border: `1px solid ${selected?.id === record.id ? 'var(--mint)' : 'var(--line)'}`, background: 'var(--bg-deep)', color: 'inherit', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 7, alignItems: 'center' }}>
                  <strong style={{ fontSize: 11.5, color: 'var(--text-hi)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.label}</strong>
                  <span style={{ fontSize: 9.5, color: record.status === 'error' ? '#f08a72' : record.status === 'running' ? 'var(--amber)' : 'var(--mint)' }}>{record.status}</span>
                </div>
                <div style={{ fontSize: 9.5, color: 'var(--text-dim)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.config?.model || 'model?'} · {timeLabel(record.startedAt)}{Number.isFinite(record.durationMs) ? ` · ${record.durationMs}ms` : ''}</div>
              </button>
            ))}
          </div>

          <div style={{ minWidth: 0, minHeight: 0, display: 'grid', gridTemplateRows: 'auto auto minmax(0,1fr)' }}>
            {selected ? <>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', color: 'var(--text-mid)', fontSize: 11.5 }}>
                <b style={{ color: 'var(--text-hi)' }}>{selected.label}</b> · {selected.config?.model || 'model?'} · {selected.config?.baseUrl || 'baseUrl?'}
                {selected.error && <div style={{ color: '#f08a72', marginTop: 5 }}>ERROR: {selected.error}</div>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, borderBottom: '1px solid var(--line)' }}>
                {['request','response','raw','meta'].map((key) => <button key={key} className="btn" onClick={() => setTab(key)} style={{ borderColor: tab === key ? 'var(--mint)' : undefined }}>{key === 'request' ? 'Payload gửi' : key === 'response' ? 'Output dùng' : key === 'raw' ? 'Raw response' : 'Metadata'}</button>)}
                <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => copy(tab === 'request' ? selected.request : tab === 'response' ? selected.response : tab === 'raw' ? selected.rawResponse : selected.meta)}>Copy</button>
              </div>
              <pre style={{ margin: 0, padding: 12, minHeight: 0, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 10.5, lineHeight: 1.5, color: 'var(--text-mid)', background: '#02080d' }}>{formatJson(tab === 'request' ? selected.request : tab === 'response' ? selected.response : tab === 'raw' ? selected.rawResponse : selected.meta)}</pre>
            </> : <div style={{ padding: 20, color: 'var(--text-dim)' }}>Chọn một request để xem.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
