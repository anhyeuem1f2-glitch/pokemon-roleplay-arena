import React, { useRef, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { getWorldbookBooks, normalizeWorldbookCollection, parseWorldbook } from '../utils/worldbook.js'
import { translateUiText } from '../i18n/uiLanguage.js'

function importedBookId(fileName, index) {
  const safe = String(fileName ?? 'worldbook').toLowerCase().replace(/[^a-z0-9\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')
  return `wb-${Date.now()}-${index}-${safe || 'worldbook'}`
}

// Dot146: nhiều World Info/Lorebook cùng lúc. Mỗi file là một book độc lập;
// tất cả book đang bật cùng tham gia keyword scan của prompt chính.
export default function WorldbookSection() {
  const { worldbook, setWorldbook, uiLanguage } = useGame()
  const fileRef = useRef(null)
  const [error, setError] = useState(null)
  const [ok, setOk] = useState(null)
  const books = getWorldbookBooks(worldbook)
  const totalEntries = books.reduce((sum, book) => sum + book.entries.length, 0)
  const totalConstants = books.reduce((sum, book) => sum + book.entries.filter((entry) => entry.constant && !entry.disable).length, 0)

  const tr = (text) => translateUiText(text, uiLanguage)

  async function handleFiles(event) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    setError(null)
    setOk(null)
    try {
      const imported = []
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        const text = await file.text()
        const json = JSON.parse(text)
        const parsed = parseWorldbook(json)
        if (!parsed.entries.length) {
          throw new Error(`${file.name}: ${tr('File không có entry hợp lệ (cần định dạng World Info của SillyTavern: { entries: {...} }).')}`)
        }
        imported.push({
          ...parsed,
          id: importedBookId(file.name, index),
          sourceFileName: file.name,
          disabled: false,
        })
      }

      setWorldbook((current) => {
        const currentBooks = getWorldbookBooks(current)
        const nextBooks = [...currentBooks]
        for (const incoming of imported) {
          // Re-import đúng cùng file = cập nhật book đó thay vì nhân đôi canon.
          const at = nextBooks.findIndex((book) => book.sourceFileName && book.sourceFileName === incoming.sourceFileName)
          if (at >= 0) nextBooks[at] = { ...incoming, id: nextBooks[at].id, disabled: nextBooks[at].disabled }
          else nextBooks.push(incoming)
        }
        return normalizeWorldbookCollection({ books: nextBooks })
      })
      const entries = imported.reduce((sum, book) => sum + book.entries.length, 0)
      setOk(uiLanguage === 'zh'
        ? `已添加 ${imported.length} 个 worldbook · ${entries} 个条目。所有启用的 book 都会在条目触发时一起提供给 AI。`
        : uiLanguage === 'en'
          ? `Added ${imported.length} worldbook(s) · ${entries} entries. Every enabled book will be available to the AI when its entries trigger.`
          : `Đã thêm ${imported.length} worldbook · ${entries} entry. Tất cả book đang bật sẽ cùng được AI đọc khi entry được kích hoạt.`)
    } catch (err) {
      setError(`${tr('Không đọc được file')}: ${err.message}`)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function updateBook(bookId, updater) {
    setWorldbook((current) => ({
      books: getWorldbookBooks(current).map((book) => book.id === bookId ? updater(book) : book),
    }))
  }

  function removeBook(bookId) {
    setWorldbook((current) => ({ books: getWorldbookBooks(current).filter((book) => book.id !== bookId) }))
    setOk(tr('Đã xoá worldbook.'))
  }

  return (
    <div className="field">
      <label>{tr('Worldbook (World Info / Lorebook)')}</label>
      <small>
        {tr('Có thể nhập nhiều file .json xuất từ SillyTavern. Mọi worldbook đang bật đều được quét cùng lúc; entry “luôn bật” của tất cả book luôn vào prompt, còn entry từ khoá sẽ kích hoạt theo chính văn gần đây. Khi worldbook khác wiki Bulbapedia, AI ưu tiên WORLDBOOK.')}
      </small>
      <div className="btn-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <button className="btn btn--primary" onClick={() => fileRef.current?.click()}>
          {tr('Thêm worldbook (.json)')}
        </button>
        <input ref={fileRef} type="file" accept=".json" multiple onChange={handleFiles} style={{ display: 'none' }} />
        {books.length > 0 && (
          <button className="btn" onClick={() => { setWorldbook({ books: [] }); setOk(tr('Đã xoá toàn bộ worldbook.')) }}>
            {tr('Xoá tất cả worldbook')}
          </button>
        )}
      </div>

      {books.length > 0 && (
        <small style={{ display: 'block', marginTop: 5 }}>
          {tr('Đang nạp')}: <b>{books.length}</b> worldbook · <b>{totalEntries}</b> entry · <b>{totalConstants}</b> {tr('luôn bật')}
        </small>
      )}
      {error && <small style={{ display: 'block', marginTop: 6, color: '#d94f4f' }}>{error}</small>}
      {ok && <small style={{ display: 'block', marginTop: 6, color: 'var(--mint)' }}>{ok}</small>}

      {books.length > 0 && (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {books.map((book) => {
            const enabledEntries = book.entries.filter((entry) => !entry.disable).length
            const constants = book.entries.filter((entry) => entry.constant && !entry.disable).length
            return (
              <details
                key={book.id}
                style={{ border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-deep)', opacity: book.disabled ? 0.58 : 1 }}
              >
                <summary style={{ cursor: 'pointer', padding: '9px 10px', display: 'flex', gap: 8, alignItems: 'center', listStyle: 'none' }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <b translate="no" data-ui-no-translate="true">{book.name || 'Worldbook'}</b>
                    <span style={{ color: 'var(--text-dim)', fontSize: 11.5 }}> · {enabledEntries}/{book.entries.length} entry · ★ {constants}</span>
                  </span>
                  <span className="status-pill">{book.disabled ? tr('Đã tắt') : tr('Đang bật')}</span>
                </summary>
                <div style={{ borderTop: '1px solid var(--line)', padding: 9 }}>
                  <div className="btn-row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <button
                      className="btn"
                      style={{ padding: '4px 9px', fontSize: 11 }}
                      onClick={() => updateBook(book.id, (current) => ({ ...current, disabled: !current.disabled }))}
                    >
                      {book.disabled ? tr('Bật worldbook') : tr('Tắt worldbook')}
                    </button>
                    <button className="btn" style={{ padding: '4px 9px', fontSize: 11 }} onClick={() => removeBook(book.id)}>
                      {tr('Xoá worldbook này')}
                    </button>
                  </div>
                  <div style={{ maxHeight: 230, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 7 }}>
                    {book.entries.slice(0, 200).map((entry, entryIndex) => (
                      <div key={`${book.id}-${entry.uid}-${entryIndex}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 9px', fontSize: 11.5, borderBottom: '1px solid var(--line)', opacity: entry.disable ? 0.45 : 1 }}>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.constant && <span style={{ color: 'var(--amber)' }}>★ </span>}
                          {entry.comment || (entry.keys[0] ?? tr('(không tên)'))}
                          {entry.keys.length > 0 && <span style={{ color: 'var(--text-dim)' }}> · {entry.keys.slice(0, 4).join(', ')}</span>}
                        </span>
                        <button
                          className="btn"
                          style={{ padding: '1px 8px', fontSize: 10.5 }}
                          onClick={() => updateBook(book.id, (current) => ({
                            ...current,
                            entries: current.entries.map((item, index) => index === entryIndex ? { ...item, disable: !item.disable } : item),
                          }))}
                        >
                          {entry.disable ? tr('Bật') : tr('Tắt')}
                        </button>
                      </div>
                    ))}
                    {book.entries.length > 200 && (
                      <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text-dim)' }}>
                        … +{book.entries.length - 200} {tr('entry nữa (vẫn hoạt động).')}
                      </div>
                    )}
                  </div>
                </div>
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}
