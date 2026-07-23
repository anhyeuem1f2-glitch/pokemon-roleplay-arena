// ============ QUẢN LÝ NHẠC NỀN (đợt 28) ============
// Singleton độc lập với React (Dev tab / modal nào cũng gọi thẳng được).
//
// Kiến trúc:
// - "base": nhạc nền theo ngữ cảnh chính (title / khu vực bản đồ) — do
//   MusicController set.
// - "override stack": các ngữ cảnh đè lên tạm thời (trận theo lượt, combat
//   anime, shop). push/pop theo id → idempotent, an toàn với StrictMode
//   (effect chạy 2 lần trong dev) và với việc enemyMon đổi HP mỗi lượt.
// - Mỗi track key được thử phát theo chuỗi fallback: /music/<key>.mp3 →
//   /music/<key>.ogg → ứng viên kế tiếp → im lặng. File thiếu KHÔNG gây lỗi.
// - Autoplay policy: trình duyệt chặn play() trước cú click đầu tiên →
//   tự gắn listener pointerdown/keydown 1 lần để "mở khoá" rồi phát lại.
// - Crossfade ~700ms giữa 2 thẻ <audio> khi đổi track.
// - Jingle (victory/defeat): phát 1 lần, ambient fade nhỏ, xong tự quay lại.
//
// Cài đặt (bật/tắt + âm lượng) persist localStorage, có subscribe() cho
// widget React hiển thị trạng thái.

const SETTINGS_KEY = 'trainer-arena:music-settings'
const FADE_MS = 700
const FADE_STEP_MS = 50

function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        enabled: parsed.enabled !== false,
        volume: Math.min(1, Math.max(0, Number(parsed.volume ?? 0.5) || 0)),
      }
    }
  } catch { /* ignore */ }
  return { enabled: true, volume: 0.5 }
}

/** Đường dẫn file nhạc — tôn trọng base path của Vite khi deploy dưới subpath. */
function trackUrl(key, ext) {
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '')
  return `${base}/music/${key}.${ext}`
}

class MusicManager {
  constructor() {
    this.settings = loadSettings()
    this.baseKeys = null // string[] | null — nhạc nền chính
    this.overrides = [] // [{id, keys: string[]}] — phần tử CUỐI thắng
    this.current = null // {key, audio} — track ambient đang phát
    this.jingle = null // {audio} — jingle đang phát (đè ambient)
    this.probeCache = new Map() // key → url phát được | null (đã thử hết, fail)
    this.playSeq = 0 // chống race: chỉ lượt playList mới nhất được áp dụng
    this.unlockAttached = false
    this.unlocked = false
    this.listeners = new Set()
    this.fadeTimers = new Set()
  }

  // ---------- pub/sub cho widget React ----------
  subscribe(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  _notify() {
    for (const fn of this.listeners) {
      try { fn() } catch { /* ignore */ }
    }
  }
  /** Trạng thái cho UI: {enabled, volume, currentKey, locked}. */
  getState() {
    return {
      enabled: this.settings.enabled,
      volume: this.settings.volume,
      currentKey: this.jingle ? this.jingle.key : this.current?.key ?? null,
      locked: !this.unlocked && this.settings.enabled && Boolean(this._activeKeys()),
    }
  }

  // ---------- cài đặt ----------
  _persist() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)) } catch { /* ignore */ }
  }
  setEnabled(enabled) {
    this.settings = { ...this.settings, enabled: Boolean(enabled) }
    this._persist()
    if (!enabled) {
      this._stopJingle()
      this._stopCurrent(true)
    } else {
      // Bật lại: xoá cache probe để nhặt được file người dùng vừa thêm vào.
      this.probeCache.clear()
      this.refresh()
    }
    this._notify()
  }
  setVolume(volume) {
    const v = Math.min(1, Math.max(0, Number(volume) || 0))
    this.settings = { ...this.settings, volume: v }
    this._persist()
    if (this.current?.audio) this.current.audio.volume = v
    if (this.jingle?.audio) this.jingle.audio.volume = v
    this._notify()
  }

  // ---------- ngữ cảnh ----------
  setBase(keys) {
    if (sameKeys(this.baseKeys, keys)) return
    this.baseKeys = keys ? [...keys] : null
    this.refresh()
  }
  pushOverride(id, keys) {
    const existing = this.overrides.find((o) => o.id === id)
    if (existing && sameKeys(existing.keys, keys)) return // idempotent
    this.overrides = [...this.overrides.filter((o) => o.id !== id), { id, keys: [...keys] }]
    this.refresh()
  }
  popOverride(id) {
    if (!this.overrides.some((o) => o.id === id)) return
    this.overrides = this.overrides.filter((o) => o.id !== id)
    this.refresh()
  }
  _activeKeys() {
    if (this.overrides.length) return this.overrides[this.overrides.length - 1].keys
    return this.baseKeys
  }

  /** Đồng bộ nhạc đang phát với ngữ cảnh hiện tại. */
  refresh() {
    if (!this.settings.enabled) return
    if (this.jingle) return // jingle xong (onended) sẽ tự gọi refresh lại
    const keys = this._activeKeys()
    if (!keys?.length) {
      this._stopCurrent(true)
      this._notify()
      return
    }
    // Nếu track đang phát vẫn là ứng viên ĐẦU TIÊN phát được của danh sách
    // mới thì giữ nguyên (VD đổi khu cùng chất nhạc → không cắt nhạc).
    const seq = ++this.playSeq
    this._resolveFirstPlayable(keys).then((resolved) => {
      if (seq !== this.playSeq) return // đã có yêu cầu mới hơn
      if (!this.settings.enabled || this.jingle) return
      if (!resolved) {
        this._stopCurrent(true)
        this._notify()
        return
      }
      if (this.current?.key === resolved.key) return // đang phát đúng bài
      this._crossfadeTo(resolved.key, resolved.url, true)
    })
  }

  /** Phát jingle 1 lần (victory/defeat...) rồi tự quay lại nhạc nền. */
  playJingle(keys) {
    if (!this.settings.enabled) return
    const seq = ++this.playSeq
    this._resolveFirstPlayable(keys).then((resolved) => {
      if (seq !== this.playSeq) return
      if (!resolved || !this.settings.enabled) return
      this._stopJingle()
      this._stopCurrent(false) // fade ambient ra nhanh
      const audio = new Audio(resolved.url)
      audio.loop = false
      audio.volume = this.settings.volume
      this.jingle = { key: resolved.key, audio }
      const done = () => {
        if (this.jingle?.audio === audio) {
          this.jingle = null
          this.refresh()
          this._notify()
        }
      }
      audio.addEventListener('ended', done)
      audio.addEventListener('error', done)
      this._tryPlay(audio)
      this._notify()
    })
  }

  /** Tắt hết (VD khi rời app) — hiện chưa cần gọi ở đâu, để sẵn. */
  stopAll() {
    this._stopJingle()
    this._stopCurrent(true)
    this._notify()
  }

  // ---------- nội bộ: dò file phát được ----------
  /** Thử lần lượt keys, trả {key, url} đầu tiên tồn tại, hoặc null. */
  async _resolveFirstPlayable(keys) {
    for (const key of keys) {
      if (this.probeCache.has(key)) {
        const cached = this.probeCache.get(key)
        if (cached) return { key, url: cached }
        continue // đã biết là không có file → thử key sau
      }
      for (const ext of ['mp3', 'ogg']) {
        const url = trackUrl(key, ext)
        // eslint-disable-next-line no-await-in-loop
        const ok = await probeAudio(url)
        if (ok) {
          this.probeCache.set(key, url)
          return { key, url }
        }
      }
      this.probeCache.set(key, null)
    }
    return null
  }

  // ---------- nội bộ: phát / fade ----------
  _crossfadeTo(key, url, loop) {
    const old = this.current
    const audio = new Audio(url)
    audio.loop = loop
    audio.volume = 0
    this.current = { key, audio }
    this._tryPlay(audio)
    this._fade(audio, 0, this.settings.volume)
    if (old?.audio) this._fadeOutAndStop(old.audio)
    this._notify()
  }
  _stopCurrent(immediate) {
    const old = this.current
    this.current = null
    if (!old?.audio) return
    if (immediate) {
      old.audio.pause()
      old.audio.src = ''
    } else {
      this._fadeOutAndStop(old.audio)
    }
  }
  _stopJingle() {
    const j = this.jingle
    this.jingle = null
    if (j?.audio) {
      j.audio.pause()
      j.audio.src = ''
    }
  }
  _fadeOutAndStop(audio) {
    this._fade(audio, audio.volume, 0, () => {
      audio.pause()
      audio.src = ''
    })
  }
  _fade(audio, from, to, onDone) {
    const steps = Math.max(1, Math.round(FADE_MS / FADE_STEP_MS))
    let i = 0
    audio.volume = clamp01(from)
    const timer = setInterval(() => {
      i += 1
      const t = i / steps
      audio.volume = clamp01(from + (to - from) * t)
      if (i >= steps) {
        clearInterval(timer)
        this.fadeTimers.delete(timer)
        if (onDone) onDone()
      }
    }, FADE_STEP_MS)
    this.fadeTimers.add(timer)
  }

  // ---------- nội bộ: autoplay unlock ----------
  _tryPlay(audio) {
    const p = audio.play()
    if (p?.catch) {
      p.then(() => {
        this.unlocked = true
        this._notify()
      }).catch(() => {
        // Trình duyệt chặn autoplay — chờ tương tác đầu tiên rồi phát lại.
        this._attachUnlock()
        this._notify()
      })
    }
  }
  _attachUnlock() {
    if (this.unlockAttached) return
    this.unlockAttached = true
    const unlock = () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
      this.unlockAttached = false
      this.unlocked = true
      // Phát lại thứ đang chờ (jingle ưu tiên, không thì ambient).
      const target = this.jingle?.audio ?? this.current?.audio
      if (target && this.settings.enabled) {
        const p = target.play()
        if (p?.catch) p.catch(() => { /* vẫn chặn — thôi */ })
      }
      this._notify()
    }
    document.addEventListener('pointerdown', unlock)
    document.addEventListener('keydown', unlock)
  }
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

function sameKeys(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  return a.length === b.length && a.every((k, i) => k === b[i])
}

/**
 * Kiểm tra url audio có tồn tại + decode được không, KHÔNG phát tiếng.
 * Dùng thẻ Audio preload=metadata: 404 / file hỏng / SPA rewrite trả về HTML
 * đều bắn 'error'. Timeout 8s coi như fail để không treo chuỗi fallback.
 */
function probeAudio(url) {
  return new Promise((resolve) => {
    const a = new Audio()
    a.preload = 'metadata'
    let settled = false
    const finish = (ok) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      a.src = ''
      resolve(ok)
    }
    const timer = setTimeout(() => finish(false), 8000)
    a.addEventListener('loadedmetadata', () => finish(true))
    a.addEventListener('canplay', () => finish(true))
    a.addEventListener('error', () => finish(false))
    a.src = url
  })
}

/** Singleton dùng chung toàn app. */
export const musicManager = new MusicManager()
