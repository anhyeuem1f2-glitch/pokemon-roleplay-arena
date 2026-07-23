import React, { useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { listModels } from '../services/aiClient.js'
import { extractMissingStateTags } from '../services/stateExtractor.js'

// ============ API CẬP NHẬT BIẾN (đợt 36) ============
// Model phụ đọc lại chính văn mỗi lượt và BỔ SUNG các tag trạng thái model
// chính quên khai ([[MONEY]]/[[POKEMON]]/[[HUNGER]]/[[DATE]]/[[NPC]]/
// [[FACT]]/[[REL]]) — chống bệnh "truyện chạy mà biến đứng yên". Có nút
// Tải model + Kiểm tra như mọi API phụ khác.

export default function StateApiSection() {
  const { stateApiConfig, setStateApiConfig } = useGame()
  const enabled = Boolean(stateApiConfig)
  const cfg = stateApiConfig ?? { baseUrl: '', apiKey: '', model: '' }
  const [models, setModels] = useState(null)
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState(null)
  const [test, setTest] = useState(null)
  const [testing, setTesting] = useState(false)

  function update(patch) {
    setStateApiConfig({ ...cfg, ...patch })
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
      setModelsError(`${err.message} (vẫn gõ tay được tên model)`)
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
      const tags = await extractMissingStateTags(cfg, {
        storyText:
          'Bạn trả 300 Pokédollar cho bà chủ quán rồi ngồi xuống ăn bát mì nóng hổi. No bụng, bạn đưa phần thừa cho con Growlithe — nó chén sạch trong nháy mắt.',
        appliedTags: {},
        hasPokemon: true,
      })
      setTest(
        tags
          ? { ok: true, msg: `OK — model bổ sung được tag: ${tags.replace(/\n/g, ' · ')}` }
          : { ok: false, msg: 'Model trả lời nhưng không xuất tag nào (thử model thông minh hơn?).' },
      )
    } catch (err) {
      setTest({ ok: false, msg: err.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="field">
      <label>API cập nhật biến (chống "truyện chạy mà biến đứng yên")</label>
      <small>
        Sau mỗi lượt, model phụ này đọc lại chính văn và bổ sung tag trạng thái mà model chính quên
        khai (tiền, Pokémon nhận được, độ no, ngày giờ, NPC, fact, quan hệ). Chạy nền, lỗi tự bỏ
        qua. Khuyên dùng model nhỏ + rẻ, temperature 0 tự đặt sẵn.
      </small>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, marginTop: 8 }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setStateApiConfig(e.target.checked ? { baseUrl: '', apiKey: '', model: '' } : null)}
        />
        Bật API cập nhật biến
      </label>
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
          {models && models.length > 0 && (
            <select value={cfg.model} onChange={(e) => update({ model: e.target.value })}>
              <option value="">— Chọn từ {models.length} model —</option>
              {models.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
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
