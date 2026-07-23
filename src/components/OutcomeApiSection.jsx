import React, { useState } from 'react'
import { listModels } from '../services/aiClient.js'

function OutcomeApiField({ label, value, onChange }) {
  const enabled = Boolean(value)
  // Tải danh sách model từ endpoint /models của chính API phụ này (đợt 26) —
  // cùng logic với nút tải model của API chính, không phải gõ tay model id.
  const [models, setModels] = useState(null)
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState(null)

  async function handleLoadModels() {
    if (!value?.baseUrl) {
      setModelsError('Điền Base URL trước đã.')
      return
    }
    setLoadingModels(true)
    setModelsError(null)
    try {
      const ids = await listModels({ baseUrl: value.baseUrl, apiKey: value.apiKey })
      setModels(ids)
      if (ids.length === 0) setModelsError('Provider trả về danh sách rỗng.')
    } catch (err) {
      setModelsError(err.message)
      setModels(null)
    } finally {
      setLoadingModels(false)
    }
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10, marginTop: 8 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-mid)' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) =>
            onChange(e.target.checked ? { baseUrl: '', apiKey: '', model: '' } : null)
          }
        />
        {label} — dùng API riêng
      </label>
      {enabled && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            value={value.baseUrl}
            onChange={(e) => onChange({ ...value, baseUrl: e.target.value })}
            placeholder="Base URL"
          />
          <input
            value={value.apiKey}
            onChange={(e) => onChange({ ...value, apiKey: e.target.value })}
            placeholder="API Key"
            type="password"
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={value.model}
              onChange={(e) => onChange({ ...value, model: e.target.value })}
              placeholder="Model"
              style={{ flex: 1 }}
            />
            <button className="btn" onClick={handleLoadModels} disabled={loadingModels} style={{ whiteSpace: 'nowrap' }}>
              {loadingModels ? 'Đang tải...' : 'Tải model'}
            </button>
          </div>
          {models && models.length > 0 && (
            <select value={value.model} onChange={(e) => onChange({ ...value, model: e.target.value })}>
              <option value="">— Chọn từ {models.length} model —</option>
              {models.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          )}
          {modelsError && <small style={{ color: '#d94f4f' }}>{modelsError}</small>}
        </div>
      )}
    </div>
  )
}

// Cấu hình API phụ 1 (tuyến chạy thoát) và API phụ 2 (tuyến thua cuộc) theo
// kiến trúc nhiều API đã bàn — để trống thì tự dùng API chính như bình thường.
export default function OutcomeApiSection({ outcomeApiConfig, setOutcomeApiConfig, animeApiConfig, setAnimeApiConfig }) {
  return (
    <div className="field">
      <label>API phụ cho tuyến kết quả trận đấu (tuỳ chọn)</label>
      <small>Để trống = dùng API chính cho mọi tuyến. Điền vào nếu muốn tách riêng model/endpoint.</small>
      <OutcomeApiField
        label="API phụ 1: tuyến chạy thoát"
        value={outcomeApiConfig.escaped}
        onChange={(v) => setOutcomeApiConfig({ ...outcomeApiConfig, escaped: v })}
      />
      <OutcomeApiField
        label="API phụ 2: tuyến thua cuộc"
        value={outcomeApiConfig.lose}
        onChange={(v) => setOutcomeApiConfig({ ...outcomeApiConfig, lose: v })}
      />
      <OutcomeApiField
        label="API chau chuốt văn phong — đánh bóng câu chữ theo tông truyện (tuỳ chọn)"
        value={animeApiConfig}
        onChange={setAnimeApiConfig}
      />
    </div>
  )
}
