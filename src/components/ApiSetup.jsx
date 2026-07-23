import React, { useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { testConnection, listModels } from '../services/aiClient.js'

const PRESETS = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { label: 'LM Studio (local)', baseUrl: 'http://localhost:1234/v1', model: 'local-model' },
]

export default function ApiSetup() {
  const { apiConfig, setApiConfig } = useGame()
  const [form, setForm] = useState({
    temperature: 0.9,
    maxTokens: 8192, // đợt 55: model thinking đốt token suy nghĩ vào hạn mức này
    ...apiConfig,
  })
  const [status, setStatus] = useState(null) // null | 'testing' | 'ok' | 'error'
  const [statusMsg, setStatusMsg] = useState('')
  const [modelList, setModelList] = useState([])
  const [modelListState, setModelListState] = useState(null) // null | 'loading' | 'ok' | 'error'
  const [modelListMsg, setModelListMsg] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  function updateField(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setStatus(null)
  }

  function applyPreset(preset) {
    setForm((f) => ({ ...f, baseUrl: preset.baseUrl, model: preset.model }))
    setStatus(null)
    setModelList([])
    setModelListState(null)
  }

  function handleSave() {
    setApiConfig(form)
    setStatusMsg('Đã lưu cấu hình.')
    setStatus('ok')
  }

  async function handleTest() {
    setStatus('testing')
    setStatusMsg('Đang kiểm tra kết nối...')
    try {
      await testConnection(form)
      setStatus('ok')
      setStatusMsg('Kết nối thành công!')
    } catch (err) {
      setStatus('error')
      setStatusMsg(err.message)
    }
  }

  async function handleLoadModels() {
    setModelListState('loading')
    setModelListMsg('Đang tải danh sách model...')
    try {
      const ids = await listModels(form)
      setModelList(ids)
      setModelListState('ok')
      setModelListMsg(`Tìm thấy ${ids.length} model.`)
    } catch (err) {
      setModelListState('error')
      setModelListMsg(err.message)
    }
  }

  return (
    <div className="panel">
      <h2 className="page-title">Cài đặt API</h2>
      <p className="page-subtitle">
        Nhập thông tin API tương thích OpenAI (OpenAI, OpenRouter, hoặc server/proxy local). Key
        được lưu trong trình duyệt của bạn, không gửi đi đâu khác ngoài provider bạn chọn.
      </p>

      <div className="btn-row" style={{ marginBottom: 18 }}>
        {PRESETS.map((p) => (
          <button key={p.label} className="btn" onClick={() => applyPreset(p)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="field">
        <label>Base URL</label>
        <input
          value={form.baseUrl}
          onChange={(e) => updateField('baseUrl', e.target.value)}
          placeholder="https://api.openai.com/v1"
        />
        <small>
          Endpoint gốc, không kèm /chat/completions ở cuối (thường có dạng https://.../v1). Nếu proxy
          của bạn không cho trình duyệt gọi thẳng (lỗi CORS), trang sẽ TỰ chuyển tiếp qua máy chủ —
          bạn không phải cấu hình gì thêm.
        </small>
      </div>

      <div className="field">
        <label>API Key</label>
        <input
          type="password"
          value={form.apiKey}
          onChange={(e) => updateField('apiKey', e.target.value)}
          placeholder="sk-..."
        />
      </div>

      <div className="field">
        <label>Model</label>
        <input
          value={form.model}
          onChange={(e) => updateField('model', e.target.value)}
          placeholder="gpt-4o-mini"
        />
      </div>

      <div className="btn-row" style={{ marginBottom: 8 }}>
        <button className="btn" onClick={handleLoadModels} disabled={modelListState === 'loading'}>
          Tải danh sách model
        </button>
        {modelListState && modelListState !== 'loading' && (
          <span className={`status-pill ${modelListState === 'ok' ? 'status-pill--ok' : 'status-pill--error'}`}>
            {modelListMsg}
          </span>
        )}
        {modelListState === 'loading' && <span className="status-pill">{modelListMsg}</span>}
      </div>

      {modelList.length > 0 && (
        <div className="field">
          <label>Chọn từ danh sách vừa tải</label>
          <select
            value={form.model}
            onChange={(e) => updateField('model', e.target.value)}
          >
            {modelList.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <small>Chọn xong nhớ bấm "Lưu cấu hình" bên dưới.</small>
        </div>
      )}

      <button
        className="btn"
        style={{ marginBottom: advancedOpen ? 14 : 18 }}
        onClick={() => setAdvancedOpen((v) => !v)}
      >
        {advancedOpen ? 'Ẩn cài đặt nâng cao' : 'Cài đặt nâng cao (temperature / max tokens)'}
      </button>

      {advancedOpen && (
        <>
          <div className="field">
            <label>Temperature ({form.temperature})</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={form.temperature}
              onChange={(e) => updateField('temperature', parseFloat(e.target.value))}
            />
            <small>Càng cao càng ngẫu nhiên/sáng tạo. Roleplay thường hợp 0.8–1.1.</small>
          </div>
          <div className="field">
            <label>Max tokens</label>
            <input
              type="number"
              min="100"
              step="100"
              value={form.maxTokens}
              onChange={(e) => updateField('maxTokens', parseInt(e.target.value, 10) || 8192)}
            />
            <small>
              Các model "thinking" (Gemini 2.5/3.x Pro, o-series, Claude thinking…) tính CẢ phần suy
              nghĩ nội bộ vào giới hạn này — để thấp là phần trả lời bị rỗng. Mặc định 8192; nếu vẫn
              báo "phản hồi rỗng (finish_reason: length)" thì đặt 30000-60000.
            </small>
          </div>
        </>
      )}

      <div className="btn-row">
        <button className="btn btn--primary" onClick={handleSave}>
          Lưu cấu hình
        </button>
        <button className="btn" onClick={handleTest} disabled={status === 'testing'}>
          Kiểm tra kết nối
        </button>
        {status && status !== 'testing' && (
          <span className={`status-pill status-pill--${status === 'ok' ? 'ok' : 'error'}`}>
            {statusMsg}
          </span>
        )}
        {status === 'testing' && <span className="status-pill">{statusMsg}</span>}
      </div>
    </div>
  )
}
