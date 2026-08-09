const ENABLED_KEY = 'trainer-arena:llm-debug-enabled'
const MAX_RECORDS = 80

let records = []
let listeners = new Set()

function nowIso() {
  return new Date().toISOString()
}

function notify() {
  for (const fn of listeners) {
    try { fn() } catch { /* ignore debug UI listener */ }
  }
}

export function isLlmDebugEnabled() {
  try { return localStorage.getItem(ENABLED_KEY) === '1' } catch { return false }
}

export function setLlmDebugEnabled(enabled) {
  try { localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0') } catch { /* ignore */ }
  if (!enabled) records = []
  notify()
}

export function subscribeLlmDebug(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getLlmDebugRecords() {
  return records
}

export function clearLlmDebugRecords() {
  records = []
  notify()
}

function safeConfig(config = {}) {
  return {
    baseUrl: String(config.baseUrl ?? ''),
    model: String(config.model ?? ''),
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  }
}

export function startLlmDebugRecord({ config, label = 'LLM', request = null, meta = null } = {}) {
  if (!isLlmDebugEnabled()) return null
  const id = `llm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const record = {
    id,
    label: String(label || 'LLM'),
    status: 'running',
    startedAt: nowIso(),
    endedAt: null,
    durationMs: null,
    config: safeConfig(config),
    request,
    response: null,
    rawResponse: null,
    error: null,
    meta: meta ?? null,
  }
  records = [record, ...records].slice(0, MAX_RECORDS)
  notify()
  return id
}

export function finishLlmDebugRecord(id, patch = {}) {
  if (!id) return
  const endedAtMs = Date.now()
  records = records.map((record) => {
    if (record.id !== id) return record
    const startedMs = Date.parse(record.startedAt) || endedAtMs
    return {
      ...record,
      ...patch,
      status: patch.status ?? 'success',
      endedAt: nowIso(),
      durationMs: Math.max(0, endedAtMs - startedMs),
    }
  })
  notify()
}

export function failLlmDebugRecord(id, error, patch = {}) {
  if (!id) return
  finishLlmDebugRecord(id, {
    ...patch,
    status: 'error',
    error: error instanceof Error ? error.message : String(error ?? 'Unknown error'),
  })
}
