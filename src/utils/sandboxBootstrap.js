const KEY = 'trainer-arena:sandbox-bootstrap-v1'

export function saveSandboxBootstrap({ trainerId, party = [], pc = [] } = {}) {
  if (!trainerId) return
  const payload = {
    version: 1,
    trainerId,
    status: 'pending',
    createdAt: Date.now(),
    party,
    pc,
  }
  try { localStorage.setItem(KEY, JSON.stringify(payload)) } catch { /* ignore */ }
}

export function loadSandboxBootstrap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null')
    return parsed && parsed.version === 1 ? parsed : null
  } catch { return null }
}

export function completeSandboxBootstrap(trainerId) {
  const current = loadSandboxBootstrap()
  if (!current || current.trainerId !== trainerId) return
  try { localStorage.setItem(KEY, JSON.stringify({ ...current, status: 'complete', completedAt: Date.now() })) } catch { /* ignore */ }
}

export function clearSandboxBootstrap() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
