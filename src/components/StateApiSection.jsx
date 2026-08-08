import React, { useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { listModels } from '../services/aiClient.js'
import { extractSemanticStateEvents } from '../services/semanticStateEngine.js'
import PokemonToggle from './PokemonToggle.jsx'

const EMPTY_CONFIG = { baseUrl: '', apiKey: '', model: '' }

function StateApiSlot({ number, config, setConfig }) {
  const enabled = Boolean(config)
  const cfg = config ?? EMPTY_CONFIG
  const [models, setModels] = useState(null)
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState(null)
  const [test, setTest] = useState(null)
  const [testing, setTesting] = useState(false)

  function update(patch) {
    setConfig({ ...cfg, ...patch })
  }

  async function handleLoadModels() {
    if (!cfg.baseUrl) {
      setModelsError('Điền Base URL trước đã.')
      return
    }
    setLoadingModels(true)
    setModelsError(null)
    try {
      const ids = await listModels({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey })
      setModels(ids)
      if (!ids.length) setModelsError('Provider trả về danh sách rỗng.')
    } catch (err) {
      setModelsError(`${err.message} (vẫn có thể gõ tay tên model)`)
      setModels(null)
    } finally {
      setLoadingModels(false)
    }
  }

  async function handleTest() {
    if (!cfg.baseUrl || !cfg.model) {
      setTest({ ok: false, msg: 'Điền đủ Base URL + Model trước đã.' })
      return
    }
    setTesting(true)
    setTest(null)
    try {
      const result = await extractSemanticStateEvents(cfg, {
        storyText: 'Bạn trả 300 Pokédollar cho bà chủ quán rồi nhận 2 Poké Ball và một Vé tàu VIP do chủ quán tự viết tay. Sau đó bạn ngồi ăn no và đưa phần thừa cho Growlithe.',
        userText: 'Tôi mua đồ rồi nghỉ chân.',
        appliedState: {},
        stateSnapshot: { money: 1000, inventory: [], party: [{ name: 'Growlithe', level: 10, friendship: 70 }] },
        mode: 'anime',
        scanMode: number === 1 ? 'extractor' : 'auditor',
      })
      setTest(result.acceptedCount > 0
        ? { ok: true, msg: `OK — Semantic Engine tìm ${result.acceptedCount}/${result.proposedCount} event (kể cả item tự tạo).` }
        : { ok: false, msg: 'Model trả lời nhưng không tìm thấy event state nào trong đoạn thử.' })
    } catch (err) {
      setTest({ ok: false, msg: err.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="panel" style={{ padding: 10, marginTop: 8 }}>
      <PokemonToggle
        checked={enabled}
        onChange={(next) => setConfig(next ? { ...EMPTY_CONFIG } : null)}
        label={`Bật AI soi biến ${number}`}
        hint={enabled
          ? `Semantic Engine ${number} đọc chính văn tự nhiên; không cần tag/exact quote và chấp nhận entity tự tạo.`
          : number === 1 ? 'Tắt: hệ thống dùng tuyến API dự phòng/mặc định.' : 'Tắt: chỉ dùng một AI soi biến.'}
      />
      {enabled && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input value={cfg.baseUrl} onChange={(e) => update({ baseUrl: e.target.value })} placeholder="Base URL (VD https://api.openai.com/v1)" />
          <input value={cfg.apiKey} onChange={(e) => update({ apiKey: e.target.value })} placeholder="API Key" type="password" />
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={cfg.model} onChange={(e) => update({ model: e.target.value })} placeholder="Model" style={{ flex: 1 }} />
            <button className="btn" onClick={handleLoadModels} disabled={loadingModels} style={{ whiteSpace: 'nowrap' }}>
              {loadingModels ? 'Đang tải...' : 'Tải model'}
            </button>
          </div>
          {models?.length > 0 && (
            <select value={cfg.model} onChange={(e) => update({ model: e.target.value })}>
              <option value="">— Chọn từ {models.length} model —</option>
              {models.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          )}
          {modelsError && <small style={{ color: '#d94f4f' }}>{modelsError}</small>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={handleTest} disabled={testing} style={{ whiteSpace: 'nowrap' }}>
              {testing ? 'Đang thử...' : 'Kiểm tra trích xuất'}
            </button>
            {test && <small style={{ color: test.ok ? 'var(--mint)' : '#d94f4f' }}>{test.msg}</small>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function StateApiSection() {
  const { stateApiConfig, setStateApiConfig, stateApiConfig2, setStateApiConfig2 } = useGame()
  return (
    <div className="field">
      <label>Semantic State Engine</label>
      <small>
        Đường cập nhật chính đọc trực tiếp chính văn hiển thị và trả event có nghĩa thay vì bắt model viết [[TAG]]. Engine hiểu nhiều câu, entity/vật phẩm tự tạo và commit từng event độc lập; slot thứ hai làm auditor trên ledger mới nhất để cứu phần bị bỏ sót.
      </small>
      <StateApiSlot number={1} config={stateApiConfig} setConfig={setStateApiConfig} />
      <StateApiSlot number={2} config={stateApiConfig2} setConfig={setStateApiConfig2} />
    </div>
  )
}
