import React, { useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import ApiSetup from './ApiSetup.jsx'
import OutcomeApiSection from './OutcomeApiSection.jsx'
import { testConnection } from '../services/aiClient.js'
import { importMainPreset } from '../utils/presetImport.js'
import MusicWidget from './MusicWidget.jsx'
import MemoryApiSection from './MemoryApiSection.jsx'
import DirectorSection from './DirectorSection.jsx'
import WikiSection from './WikiSection.jsx'
import StateApiSection from './StateApiSection.jsx'
import WorldbookSection from './WorldbookSection.jsx'

const PRESET_PAGE_SIZE = 8

function MainPresetManager({ mainPreset, setMainPreset, onPresetPrefill }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState(() => new Set())
  const [importError, setImportError] = useState(null)
  const [importing, setImporting] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportError(null)
    setImporting(true)
    try {
      const preset = await importMainPreset(file)
      setMainPreset(preset)
      if (preset.meta?.assistantPrefill) {
        onPresetPrefill(preset.meta.assistantPrefill)
      }
      setPage(0)
      setSearch('')
    } catch (err) {
      setImportError(err.message)
    } finally {
      setImporting(false)
    }
  }

  function toggleBlock(identifier) {
    setMainPreset({
      ...mainPreset,
      blocks: mainPreset.blocks.map((b) => (b.identifier === identifier ? { ...b, enabled: !b.enabled } : b)),
    })
  }

  function toggleExpanded(identifier) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(identifier)) next.delete(identifier)
      else next.add(identifier)
      return next
    })
  }

  if (!mainPreset) {
    return (
      <div className="panel">
        <h2 className="page-title">Preset chính văn (JSON)</h2>
        <p className="page-subtitle">
          Nạp file "Chat Completion Preset" xuất từ SillyTavern (.json) để dùng làm system prompt
          cho API chính, thay cho câu hướng dẫn mặc định của app. Chỉ áp dụng cho API chính —
          API phụ (tuyến thua/chạy thoát) vẫn dùng preset văn phong dạng text ở dưới.
        </p>
        <label className="btn" style={{ display: 'inline-block', cursor: 'pointer' }}>
          {importing ? 'Đang nạp...' : 'Nhập preset chính văn (.json)'}
          <input type="file" accept=".json" onChange={handleFile} style={{ display: 'none' }} />
        </label>
        {importError && (
          <div className="status-pill status-pill--error" style={{ marginTop: 10 }}>
            {importError}
          </div>
        )}
        <p style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 14 }}>
          Lưu ý: engine hiện chỉ xử lý macro <code>{'{{setvar}}'}</code>/<code>{'{{getvar}}'}</code>/
          <code>{'{{trim}}'}</code> — các lệnh STscript khác (if, random, pick...) nếu preset có dùng
          sẽ giữ nguyên dạng thô, có thể khiến 1 vài đoạn không hoạt động như trên SillyTavern gốc.
        </p>
      </div>
    )
  }

  const q = search.trim().toLowerCase()
  const filtered = mainPreset.blocks
    .map((block, i) => ({ block, i }))
    .filter(({ block }) => {
      if (!q) return true
      return block.name.toLowerCase().includes(q) || block.content.toLowerCase().includes(q)
    })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PRESET_PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = filtered.slice(safePage * PRESET_PAGE_SIZE, safePage * PRESET_PAGE_SIZE + PRESET_PAGE_SIZE)
  const enabledCount = mainPreset.blocks.filter((b) => b.enabled).length

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 className="page-title">Preset chính văn (JSON)</h2>
          <p className="page-subtitle" style={{ marginBottom: 4 }}>
            {mainPreset.fileName} — {enabledCount}/{mainPreset.blocks.length} block đang bật
          </p>
        </div>
        <button className="btn" onClick={() => setMainPreset(null)}>
          Gỡ preset
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(0)
        }}
        placeholder="Tìm theo tên hoặc nội dung block..."
        style={{ margin: '10px 0' }}
      />

      {pageItems.map(({ block }) => {
        const isOpen = expanded.has(block.identifier)
        return (
          <div
            key={block.identifier}
            style={{
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: '8px 10px',
              marginTop: 6,
              opacity: block.enabled ? 1 : 0.5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={block.enabled} onChange={() => toggleBlock(block.identifier)} />
              <span style={{ fontSize: 13, flex: 1 }}>{block.name}</span>
              {block.marker && <span className="status-pill">marker</span>}
              {!block.marker && (
                <button className="btn" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => toggleExpanded(block.identifier)}>
                  {isOpen ? 'Ẩn' : 'Xem'}
                </button>
              )}
            </div>
            {isOpen && !block.marker && (
              <pre
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: 'var(--text-mid)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: 200,
                  overflowY: 'auto',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {block.content || '(rỗng)'}
              </pre>
            )}
          </div>
        )
      })}

      {filtered.length > PRESET_PAGE_SIZE && (
        <div className="btn-row" style={{ marginTop: 10, justifyContent: 'center' }}>
          <button className="btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            ← Trước
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Trang {safePage + 1} / {totalPages}
          </span>
          <button className="btn" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>
            Sau →
          </button>
        </div>
      )}

      <label className="btn" style={{ display: 'inline-block', cursor: 'pointer', marginTop: 12 }}>
        Nạp preset khác (thay preset hiện tại)
        <input type="file" accept=".json" onChange={handleFile} style={{ display: 'none' }} />
      </label>

      {mainPreset.regexScripts?.length > 0 && (
        <RegexScriptsManager mainPreset={mainPreset} setMainPreset={setMainPreset} />
      )}
    </div>
  )
}

function RegexScriptsManager({ mainPreset, setMainPreset }) {
  function toggle(id) {
    setMainPreset({
      ...mainPreset,
      regexScripts: mainPreset.regexScripts.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    })
  }

  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
      <label>
        Regex xử lý output ({mainPreset.regexScripts.filter((s) => s.enabled).length}/
        {mainPreset.regexScripts.length} đang bật)
      </label>
      <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: '4px 0 10px' }}>
        Đây là bộ regex nhúng sẵn trong preset của bạn (VD ẩn chuỗi suy nghĩ, ẩn/hiện thanh trạng
        thái đồng nhân...). Script gắn nhãn "HTML" tạo ra định dạng đẹp trong SillyTavern nhưng app
        này chưa render HTML nên mặc định tắt — tự bật nếu bạn vẫn muốn thử.
      </p>
      <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {mainPreset.regexScripts.map((s) => (
          <label
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12.5,
              padding: '6px 8px',
              border: '1px solid var(--line)',
              borderRadius: 6,
              opacity: s.enabled ? 1 : 0.55,
            }}
          >
            <input type="checkbox" checked={s.enabled} onChange={() => toggle(s.id)} />
            <span style={{ flex: 1 }}>{s.scriptName}</span>
            {s.isDecorative && <span className="status-pill">HTML</span>}
          </label>
        ))}
      </div>
    </div>
  )
}

function CheckAllApis({ apiConfig, outcomeApiConfig, animeApiConfig }) {
  const [results, setResults] = useState(null)
  const [checking, setChecking] = useState(false)

  async function handleCheckAll() {
    setChecking(true)
    const targets = [
      { label: 'API chính', config: apiConfig },
      { label: 'API phụ 1 — chạy thoát', config: outcomeApiConfig.escaped },
      { label: 'API phụ 2 — thua cuộc', config: outcomeApiConfig.lose },
      { label: 'API chau chuốt văn phong', config: animeApiConfig },
    ].filter((t) => t.config && t.config.baseUrl)

    const out = []
    for (const t of targets) {
      try {
        await testConnection(t.config)
        out.push({ label: t.label, ok: true, msg: 'Kết nối thành công' })
      } catch (err) {
        out.push({ label: t.label, ok: false, msg: err.message })
      }
    }
    setResults(out)
    setChecking(false)
  }

  return (
    <div className="panel">
      <h2 className="page-title">Kiểm tra tất cả API</h2>
      <p className="page-subtitle">Gọi thử từng API đã cấu hình (chính + phụ nếu có) trong 1 lần bấm.</p>
      <button className="btn btn--primary" onClick={handleCheckAll} disabled={checking}>
        {checking ? 'Đang kiểm tra...' : 'Kiểm tra tất cả API'}
      </button>
      {results && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map((r) => (
            <div key={r.label} className={`status-pill ${r.ok ? 'status-pill--ok' : 'status-pill--error'}`}>
              {r.label}: {r.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SettingsPage({ onBack }) {
  const {
    apiConfig,
    stylePreset,
    setStylePreset,
    mainPreset,
    setMainPreset,
    assistantPrefill,
    updateAssistantPrefill,
    outcomeApiConfig,
    animeApiConfig,
    setAnimeApiConfig,
    setOutcomeApiConfig,
    memoryApiConfig,
    setMemoryApiConfig,
  } = useGame()

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px' }}>
      <button className="btn" style={{ marginBottom: 16 }} onClick={onBack}>
        ← Quay lại
      </button>

      <ApiSetup />

      <div className="panel" style={{ marginTop: 16 }}>
        <OutcomeApiSection outcomeApiConfig={outcomeApiConfig} setOutcomeApiConfig={setOutcomeApiConfig} animeApiConfig={animeApiConfig} setAnimeApiConfig={setAnimeApiConfig} />
      </div>

      {/* ===== Trí nhớ dài hạn (đợt 29) ===== */}
      <div className="panel" style={{ marginTop: 16 }}>
        <MemoryApiSection memoryApiConfig={memoryApiConfig} setMemoryApiConfig={setMemoryApiConfig} />
      </div>

      {/* ===== Worldbook (đợt 41) ===== */}
      <div className="panel" style={{ marginTop: 16 }}>
        <WorldbookSection />
      </div>

      {/* ===== Đạo diễn tình huống (đợt 31) ===== */}
      <div className="panel" style={{ marginTop: 16 }}>
        <DirectorSection />
      </div>

      {/* ===== API cập nhật biến (đợt 36) ===== */}
      <div className="panel" style={{ marginTop: 16 }}>
        <StateApiSection />
      </div>

      {/* ===== Tư liệu canon Bulbapedia (đợt 33) ===== */}
      <div className="panel" style={{ marginTop: 16 }}>
        <WikiSection />
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <label>Preset / hướng dẫn văn phong (dùng cho API phụ, và API chính khi CHƯA nạp preset JSON)</label>
        <textarea
          value={stylePreset}
          onChange={(e) => setStylePreset(e.target.value)}
          placeholder="Để trống = dùng câu hướng dẫn mặc định của hệ thống."
          style={{ minHeight: 90, marginTop: 8 }}
        />
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <label>Assistant Prefill (mồi câu trả lời)</label>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '4px 0 8px' }}>
          Đoạn text này được gửi như thể AI đã bắt đầu trả lời, model chỉ viết tiếp thay vì tự
          quyết định mở đầu — giúp giảm việc model tự chối ngay từ đầu. Tự động điền khi bạn nhập
          preset có sẵn field <code>assistant_prefill</code>, vẫn sửa tay được. Hiệu quả tuỳ
          provider (không phải model nào cũng tôn trọng đúng cách này).
        </p>
        <textarea
          value={assistantPrefill}
          onChange={(e) => updateAssistantPrefill(e.target.value)}
          placeholder="Để trống = không mồi câu trả lời."
          style={{ minHeight: 70 }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <MainPresetManager mainPreset={mainPreset} setMainPreset={setMainPreset} onPresetPrefill={updateAssistantPrefill} />
      </div>

      <div style={{ marginTop: 16 }}>
        <CheckAllApis apiConfig={apiConfig} outcomeApiConfig={outcomeApiConfig} animeApiConfig={animeApiConfig} />
      </div>

      {/* ===== Nhạc nền (đợt 28) ===== */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h2 className="page-title">Nhạc nền</h2>
        <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6 }}>
          App tự phát nhạc theo ngữ cảnh: bỏ file <b>.mp3</b> (hoặc .ogg) của bạn vào thư mục{' '}
          <code>public/music/</code> theo đúng tên bên dưới — thiếu file nào app tự
          fallback về track chung hơn, không bao giờ báo lỗi. Chi tiết đầy đủ trong{' '}
          <code>public/music/README.txt</code>.
        </p>
        <ul style={{ fontSize: 12.5, color: 'var(--text-mid)', lineHeight: 1.7, paddingLeft: 18 }}>
          <li><code>title.mp3</code> — màn hình mở đầu · <code>exploration.mp3</code> — nhạc khám phá chung (fallback cuối)</li>
          <li><code>region-kanto.mp3</code> … <code>region-paldea.mp3</code> — theme riêng từng vùng (9 vùng)</li>
          <li><code>area-town / area-city / area-forest / area-cave / area-sea / area-volcano / area-ice / area-tower / area-victory-road / area-endgame</code> — đè theo "chất" của khu (hang động, rừng, biển...)</li>
          <li><code>battle.mp3</code> — nhạc trận chung · <code>battle-wild</code> / <code>battle-boss</code> / <code>battle-legendary</code> / <code>battle-legendary-high</code> — theo độ hoành tráng đối thủ</li>
          <li><code>victory.mp3</code> / <code>defeat.mp3</code> — jingle phát 1 lần khi thắng/thua · <code>shop.mp3</code> — trong cửa hàng</li>
        </ul>
        <MusicWidget />
        <p style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 8 }}>
          Lưu ý: trình duyệt chặn tự phát âm thanh trước cú click đầu tiên — vào trang cứ bấm
          bất kỳ đâu là nhạc chạy. Nhạc Pokémon gốc có bản quyền: bạn tự chuẩn bị file để
          dùng nội bộ, hoặc dùng nhạc fan-made/royalty-free khi public cho cộng đồng.
        </p>
      </div>
    </div>
  )
}
