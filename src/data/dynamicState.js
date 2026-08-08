// ============ DYNAMIC / SEMANTIC STATE (đợt 105) ============
// Kho biến mở cho những thứ thế giới roleplay tự sáng tạo mà core schema
// không biết trước: quyền VIP, chìa khóa đặc biệt, trạng thái thiết bị, lời
// hứa, quyền truy cập, tài sản hư cấu... Core state (money/inventory/Pokémon)
// vẫn có handler riêng; kho này là phần mở rộng chứ không thay thế chúng.

const VERSION = 1

function slug(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function normalizeDynamicState(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const values = source.values && typeof source.values === 'object' && !Array.isArray(source.values)
    ? source.values
    : {}
  return { version: VERSION, values: { ...values } }
}

export function dynamicStateKey(update = {}) {
  const namespace = slug(update.namespace ?? update.scope ?? 'world') || 'world'
  const target = slug(update.target ?? update.key ?? update.name)
  return target ? `${namespace}:${target}` : ''
}

function numeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const cleaned = String(value ?? '').trim().replace(/[^\d+\-.,]/g, '')
  if (!cleaned) return null
  let normalized = cleaned
  const dots = (normalized.match(/\./g) ?? []).length
  const commas = (normalized.match(/,/g) ?? []).length
  if (dots && commas) {
    const lastDot = normalized.lastIndexOf('.')
    const lastComma = normalized.lastIndexOf(',')
    const decimal = lastDot > lastComma ? '.' : ','
    const thousand = decimal === '.' ? ',' : '.'
    normalized = normalized.split(thousand).join('').replace(decimal, '.')
  } else if (dots > 1 || commas > 1) {
    normalized = normalized.replace(/[.,]/g, '')
  } else if (/^[+\-]?\d{1,3}[.,]\d{3}$/.test(normalized)) {
    normalized = normalized.replace(/[.,]/g, '')
  } else {
    normalized = normalized.replace(',', '.')
  }
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

export function applyDynamicStateUpdates(current, updates, { turn = null, sourceMessageId = '' } = {}) {
  const state = normalizeDynamicState(current)
  const values = { ...state.values }
  const applied = []
  const rejected = []

  for (const raw of updates ?? []) {
    const update = raw && typeof raw === 'object' ? raw : {}
    const key = dynamicStateKey(update)
    if (!key) {
      rejected.push({ update, reason: 'thiếu target/key' })
      continue
    }
    const operation = String(update.operation ?? update.op ?? 'set').toLowerCase()
    const previous = values[key]
    const previousValue = previous?.value
    let nextValue = update.value

    if (operation === 'remove' || operation === 'delete' || operation === 'clear') {
      if (key in values) delete values[key]
      applied.push({ ...update, storageKey: key, removed: true })
      continue
    }
    if (operation === 'delta' || operation === 'increment' || operation === 'decrement') {
      const before = numeric(previousValue) ?? 0
      const delta = numeric(update.amount ?? update.delta ?? update.value)
      if (delta == null) {
        rejected.push({ update, reason: 'delta không phải số' })
        continue
      }
      nextValue = before + (operation === 'decrement' ? -Math.abs(delta) : delta)
    } else if (operation === 'append') {
      const before = Array.isArray(previousValue) ? previousValue : (previousValue == null ? [] : [previousValue])
      nextValue = [...before, update.value]
    } else if (operation === 'merge') {
      const before = previousValue && typeof previousValue === 'object' && !Array.isArray(previousValue) ? previousValue : {}
      const incoming = update.value && typeof update.value === 'object' && !Array.isArray(update.value)
        ? update.value
        : (update.details && typeof update.details === 'object' ? update.details : {})
      nextValue = { ...before, ...incoming }
    } else if (nextValue === undefined) {
      // Nếu model chỉ trả details, details chính là giá trị động cần giữ.
      nextValue = update.details && Object.keys(update.details).length ? { ...update.details } : true
    }

    values[key] = {
      key: String(update.target ?? update.key ?? update.name ?? key),
      namespace: String(update.namespace ?? update.scope ?? 'world'),
      value: nextValue,
      details: update.details && typeof update.details === 'object' ? { ...update.details } : {},
      note: String(update.note ?? update.evidence ?? ''),
      updatedAtTurn: Number.isFinite(Number(turn)) ? Number(turn) : previous?.updatedAtTurn ?? null,
      sourceMessageId: sourceMessageId || previous?.sourceMessageId || '',
    }
    applied.push({ ...update, storageKey: key, value: nextValue })
  }

  return { state: { version: VERSION, values }, applied, rejected }
}

export function dynamicStateForPrompt(raw) {
  const state = normalizeDynamicState(raw)
  return Object.fromEntries(Object.entries(state.values).map(([key, entry]) => [key, {
    label: entry?.key ?? key,
    value: entry?.value,
    details: entry?.details ?? {},
  }]))
}
