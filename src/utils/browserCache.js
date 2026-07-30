// ============ CACHE DỮ LIỆU LỚN BẰNG INDEXEDDB (đợt 78) ============
// Pokédex/moves/learnsets có thể chiếm vài MB. Nhét chúng vào localStorage
// làm quota 5-10MB bị đầy, trong khi đây chỉ là dữ liệu tải lại được — không
// phải save người chơi. IndexedDB có quota lớn hơn nhiều và phù hợp với cache.

const DB_NAME = 'trainer-arena-cache'
const DB_VERSION = 1
const STORE_NAME = 'entries'

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined'
}

function openDb() {
  if (!hasIndexedDb()) return Promise.reject(new Error('IndexedDB không khả dụng'))
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Không mở được IndexedDB'))
  })
}

async function withStore(mode, fn) {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode)
      const store = tx.objectStore(STORE_NAME)
      let request
      let result = null
      try {
        request = fn(store)
      } catch (error) {
        reject(error)
        return
      }
      request.onsuccess = () => { result = request.result ?? null }
      request.onerror = () => reject(request.error ?? new Error('Lỗi IndexedDB'))
      // Với thao tác ghi, request thành công chưa có nghĩa transaction đã
      // commit. Chỉ resolve khi oncomplete để nút Save không báo thành công
      // rồi dữ liệu lại biến mất nếu giao dịch bị abort ở bước cuối.
      tx.oncomplete = () => resolve(result)
      tx.onabort = () => reject(tx.error ?? new Error('Giao dịch IndexedDB bị huỷ'))
      tx.onerror = () => reject(tx.error ?? new Error('Lỗi giao dịch IndexedDB'))
    })
  } finally {
    db.close()
  }
}

export async function readLargeCache(key) {
  try {
    return await withStore('readonly', (store) => store.get(key))
  } catch {
    return null
  }
}

export async function writeLargeCache(key, value) {
  try {
    await withStore('readwrite', (store) => store.put(value, key))
    return true
  } catch {
    return false
  }
}

export async function deleteLargeCache(key) {
  try {
    await withStore('readwrite', (store) => store.delete(key))
    return true
  } catch {
    return false
  }
}

/** Xoá cache localStorage đời cũ sau khi đã chuyển sang IndexedDB. */
export function removeLegacyLocalCache(key) {
  try {
    const base = String(key).replace(/-v\d+$/i, '')
    const remove = []
    for (let i = 0; i < localStorage.length; i++) {
      const current = localStorage.key(i)
      if (current && (current === key || current === base || current.startsWith(`${base}-v`))) remove.push(current)
    }
    for (const current of remove) localStorage.removeItem(current)
  } catch { /* ignore */ }
}
