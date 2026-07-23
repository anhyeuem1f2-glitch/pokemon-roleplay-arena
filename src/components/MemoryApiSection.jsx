import React, { useEffect, useState } from 'react'
import { listModels, embedTexts, rerankDocs } from '../services/aiClient.js'
import { getMemoryCount, clearMemory, subscribeMemory } from '../utils/storyMemory.js'

// ============ CẤU HÌNH TRÍ NHỚ DÀI HẠN (đợt 29) ============
// 2 API riêng cho hệ RAG của chính văn:
// - EMBEDDING (bắt buộc để bật trí nhớ): endpoint OpenAI-compatible
//   POST /embeddings — mỗi lượt truyện được vector hoá và lưu làm "ký ức".
// - RERANK (tuỳ chọn): endpoint POST /rerank kiểu Jina/Cohere/vLLM — chấm
//   lại độ liên quan của các ký ức truy hồi được, chính xác hơn cosine thuần.
// Mỗi khối có nút "Tải model" (GET /models) như mọi API phụ khác + nút
// "Kiểm tra" gọi thử endpoint thật để xác nhận hoạt động.

function MemoryApiField({ label, hint, value, onChange, onTest, testLabel }) {
  const enabled = Boolean(value)
  const [models, setModels] = useState(null)
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState(null)
  const [testState, setTestState] = useState(null) // {ok, msg}
  const [testing, setTesting] = useState(false)

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
      // Nhiều provider rerank (VD Jina) không có GET /models — vẫn gõ tay được.
      setModelsError(`${err.message} (không sao — vẫn có thể gõ tay tên model)`)
      setModels(null)
    } finally {
      setLoadingModels(false)
    }
  }

  async function handleTest() {
    if (!value?.baseUrl || !value?.model) {
      setTestState({ ok: false, msg: 'Điền đủ Base URL + Model trước đã.' })
      return
    }
    setTesting(true)
    setTestState(null)
    try {
      const msg = await onTest(value)
      setTestState({ ok: true, msg })
    } catch (err) {
      setTestState({ ok: false, msg: err.message })
    } finally {
      setTesting(false)
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
        {label}
      </label>
      <small style={{ display: 'block', color: 'var(--text-dim)', marginTop: 2 }}>{hint}</small>
      {enabled && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            value={value.baseUrl}
            onChange={(e) => onChange({ ...value, baseUrl: e.target.value })}
            placeholder="Base URL (VD https://api.openai.com/v1)"
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn" onClick={handleTest} disabled={testing} style={{ whiteSpace: 'nowrap' }}>
              {testing ? 'Đang thử...' : testLabel}
            </button>
            {testState && (
              <small style={{ color: testState.ok ? 'var(--mint)' : '#d94f4f' }}>{testState.msg}</small>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MemoryApiSection({ memoryApiConfig, setMemoryApiConfig }) {
  const [count, setCount] = useState(() => getMemoryCount())
  useEffect(() => {
    const unsub = subscribeMemory(() => setCount(getMemoryCount()))
    setCount(getMemoryCount())
    return unsub
  }, [])

  return (
    <div className="field">
      <label>Trí nhớ dài hạn cho chính văn (Embedding + Rerank)</label>
      <small>
        Bật EMBEDDING là bật trí nhớ: mỗi lượt truyện được lưu thành "ký ức"; khi truyện dài,
        app chỉ gửi các tin gần nhất + tự truy hồi những diễn biến cũ LIÊN QUAN để AI không quên
        mạch truyện. RERANK (tuỳ chọn) giúp chọn ký ức chính xác hơn.
      </small>
      <MemoryApiField
        label="API EMBEDDING — bật trí nhớ dài hạn"
        hint="Endpoint OpenAI-compatible POST /embeddings (OpenAI text-embedding-3-small, vLLM, Ollama /v1, LM Studio, Infinity...)."
        value={memoryApiConfig.embedding}
        onChange={(v) => setMemoryApiConfig({ ...memoryApiConfig, embedding: v })}
        testLabel="Kiểm tra embedding"
        onTest={async (cfg) => {
          const [vec] = await embedTexts(cfg, ['Xin chào, đây là câu kiểm tra trí nhớ.'])
          return `OK — vector ${vec.length} chiều.`
        }}
      />
      <MemoryApiField
        label="API RERANK — chấm lại độ liên quan (tuỳ chọn)"
        hint="Endpoint POST /rerank kiểu Jina / Cohere / vLLM / Infinity. Không có cũng chạy được (dùng cosine thuần)."
        value={memoryApiConfig.rerank}
        onChange={(v) => setMemoryApiConfig({ ...memoryApiConfig, rerank: v })}
        testLabel="Kiểm tra rerank"
        onTest={async (cfg) => {
          const ranked = await rerankDocs(cfg, 'Pikachu dùng chiêu gì?', [
            'Pikachu phóng Thunderbolt về phía đối thủ.',
            'Hôm nay trời đẹp, thích hợp đi dạo.',
          ], 2)
          const top = ranked[0]
          return `OK — xếp hạng được ${ranked.length} đoạn (top score ${top.score.toFixed(3)}).`
        }}
      />
      <div
        style={{
          border: '1px solid var(--line)', borderRadius: 8, padding: 10, marginTop: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}
      >
        <small style={{ color: 'var(--text-mid)' }}>
          Ký ức đã lưu: <b style={{ color: 'var(--mint)' }}>{count}</b>
          {' '}(tự xoá khi bắt đầu truyện MỚI; trần 400, đầy thì bỏ ký ức cũ nhất)
        </small>
        <button
          className="btn"
          style={{ whiteSpace: 'nowrap' }}
          onClick={() => {
            if (window.confirm('Xoá toàn bộ ký ức dài hạn đã lưu? (Không ảnh hưởng nội dung truyện đang hiển thị.)')) {
              clearMemory()
            }
          }}
        >
          🗑 Xoá trí nhớ
        </button>
      </div>
    </div>
  )
}
