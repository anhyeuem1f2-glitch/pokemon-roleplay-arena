import React, { useEffect, useState } from 'react'
import {
  getWikiSettings, setWikiEnabled, subscribeWiki, getWikiCacheCount, clearWikiCache, fetchWikiSummary,
} from '../services/wikiLookup.js'

// ============ CÀI ĐẶT TƯ LIỆU CANON (đợt 33) ============
// Bật/tắt tự tra Bulbapedia khi truyện nhắc nhân vật gốc + xoá cache +
// nút kiểm tra kết nối (tra thử trang "Misty").

export default function WikiSection() {
  const [cfg, setCfg] = useState(() => getWikiSettings())
  const [count, setCount] = useState(() => getWikiCacheCount())
  const [test, setTest] = useState(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    const unsub = subscribeWiki(() => setCfg(getWikiSettings()))
    return unsub
  }, [])

  async function handleTest() {
    setTesting(true)
    setTest(null)
    try {
      const text = await fetchWikiSummary('Misty')
      setCount(getWikiCacheCount())
      setTest(text ? { ok: true, msg: `OK — lấy được ${text.length} ký tự tóm tắt trang Misty.` } : { ok: false, msg: 'Kết nối được nhưng trang trả về rỗng.' })
    } catch (err) {
      setTest({ ok: false, msg: `Lỗi: ${err.message} (mạng/CORS — tính năng sẽ tự bỏ qua khi chơi, không chặn truyện).` })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="field">
      <label>Tư liệu canon (Bulbapedia)</label>
      <small>
        Khi truyện nhắc tên nhân vật GỐC của Pokémon (Misty, Cynthia, Giovanni…), app tự tra
        Bulbapedia lấy tóm tắt chính xác và đưa vào prompt để AI không bịa sai nhân vật canon.
        Tư liệu tiếng Anh, AI vẫn kể tiếng Việt. Cần mạng; lỗi mạng tự bỏ qua.
      </small>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, marginTop: 8 }}>
        <input type="checkbox" checked={cfg.enabled} onChange={(e) => setWikiEnabled(e.target.checked)} />
        Bật tra cứu tự động
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
        <button className="btn" onClick={handleTest} disabled={testing}>
          {testing ? 'Đang tra thử…' : 'Kiểm tra kết nối'}
        </button>
        <small style={{ color: 'var(--text-mid)' }}>Cache: {count} trang (TTL 7 ngày)</small>
        <button className="btn" style={{ fontSize: 11 }} onClick={() => { clearWikiCache(); setCount(0) }}>
          Xoá cache
        </button>
      </div>
      {test && <small style={{ display: 'block', marginTop: 6, color: test.ok ? 'var(--mint)' : '#d94f4f' }}>{test.msg}</small>}
    </div>
  )
}
