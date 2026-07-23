import React, { useRef, useState } from 'react'
import { fileToAvatarDataUrl, dataUrlSizeKb, AVATAR_ACCEPT } from '../utils/imageUpload.js'

// ============ CHỌN ẢNH ĐẠI DIỆN (đợt 54) ============
// Dùng ở 2 nơi: bước "Hồ sơ" khi tạo nhân vật và khung avatar trên HUD.
// Hỗ trợ tải ảnh từ máy (nén trước khi lưu) HOẶC dán link ảnh.

export default function AvatarPicker({ value, onChange, fallbackLetter = '?', size = 120, compact = false }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [urlMode, setUrlMode] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')

  async function handleFile(file) {
    setError(null)
    setBusy(true)
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      onChange(dataUrl)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: compact ? 'column' : 'row', gap: 12, alignItems: compact ? 'stretch' : 'flex-start' }}>
      {/* Khung ảnh — bấm vào là mở hộp chọn file; kéo-thả ảnh vào cũng được. */}
      <div
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files?.[0]
          if (f) handleFile(f)
        }}
        title="Bấm để tải ảnh lên (hoặc kéo-thả ảnh vào đây)"
        style={{
          width: compact ? '100%' : size,
          aspectRatio: '1',
          flexShrink: 0,
          border: '1px dashed var(--line)',
          borderRadius: 10,
          background: 'var(--bg-deep)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          cursor: busy ? 'wait' : 'pointer',
          position: 'relative',
        }}
      >
        {value ? (
          <img src={value} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: Math.round(size / 3), color: 'var(--text-dim)' }}>{fallbackLetter}</span>
        )}
        {busy && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-hi)' }}>
            Đang xử lý…
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="btn-row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button className="btn" style={{ fontSize: 12 }} disabled={busy} onClick={() => inputRef.current?.click()}>
            🖼 Tải ảnh lên
          </button>
          <button className="btn" style={{ fontSize: 12 }} onClick={() => { setUrlMode((v) => !v); setUrlDraft('') }}>
            🔗 Dán link
          </button>
          {value && (
            <button className="btn" style={{ fontSize: 12 }} onClick={() => { onChange(''); setError(null) }}>
              ✕ Xoá ảnh
            </button>
          )}
        </div>

        {urlMode && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input
              className="input"
              style={{ flex: 1, minWidth: 0 }}
              placeholder="https://... (link ảnh trực tiếp)"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
            />
            <button
              className="btn"
              style={{ fontSize: 12 }}
              onClick={() => {
                const u = urlDraft.trim()
                if (!u) return
                onChange(u)
                setUrlMode(false)
              }}
            >
              Dùng
            </button>
          </div>
        )}

        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.6 }}>
          Ảnh tải lên được cắt vuông và nén còn ~320px trước khi lưu vào trình duyệt của bạn
          {value?.startsWith('data:') ? ` (hiện ~${dataUrlSizeKb(value)}KB)` : ''}. Không có ảnh nào được
          gửi lên máy chủ.
        </div>

        {error && (
          <div className="status-pill status-pill--error" style={{ marginTop: 8 }}>{error}</div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_ACCEPT}
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = '' // cho phép chọn lại đúng file vừa rồi
        }}
      />
    </div>
  )
}
