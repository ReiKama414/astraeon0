/** IndexedDB response cache for remote catalogue queries (Adapter → Normalization → Local Cache). */
const DB = 'astralis-cache'
const STORE = 'responses'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export async function cacheGet<T>(key: string, maxAgeMs: number): Promise<T | null> {
  try {
    const db = await open()
    const v = await new Promise<{ ts: number; data: T } | undefined>((resolve, reject) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
    if (!v || Date.now() - v.ts > maxAgeMs) return null
    return v.data
  } catch {
    return null
  }
}

export async function cachePut<T>(key: string, data: T) {
  try {
    const db = await open()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ ts: Date.now(), data }, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* cache is best-effort */
  }
}

export async function fetchJsonCached<T>(url: string, maxAgeMs = 7 * 86400000, timeoutMs = 15000): Promise<{ data: T; cached: boolean }> {
  const hit = await cacheGet<T>(url, maxAgeMs)
  if (hit) return { data: hit, cached: true }
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const data = JSON.parse(text) as T
    cachePut(url, data)
    return { data, cached: false }
  } finally {
    clearTimeout(t)
  }
}
