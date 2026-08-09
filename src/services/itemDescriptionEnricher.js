import { chatCompletion } from './aiClient.js'
import { isCanonicalMegaStoneId, isCanonicalZCrystalId } from '../data/pokemonHeldItems.js'

const CATEGORY_SET = new Set(['ball','heal','status','human','misc','special','food','pokefood','daily','held','accessory'])

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function parseMeta(raw) {
  const text = String(raw ?? '')
  const block = text.match(/<ITEM_META>\s*([\s\S]*?)(?:<\/ITEM_META>|$)/i)?.[1]
    ?? text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
    ?? text
  let obj = null
  try { obj = JSON.parse(block.trim()) } catch { /* below */ }
  if (!obj || typeof obj !== 'object') {
    const match = block.match(/\{[\s\S]*\}/)
    if (match) {
      try { obj = JSON.parse(match[0]) } catch { /* ignore */ }
    }
  }
  if (!obj || typeof obj !== 'object') throw new Error('Item Description API trả metadata không hợp lệ.')
  const description = cleanText(obj.description ?? obj.desc)
  if (!description) throw new Error('Item Description API không trả mô tả.')
  const categoryRaw = cleanText(obj.category).toLowerCase()
  return {
    description: description.slice(0, 280),
    category: CATEGORY_SET.has(categoryRaw) ? categoryRaw : null,
  }
}

export function safePendingItemDescription(name) {
  const label = cleanText(name) || 'Vật phẩm'
  return `${label} đã được xác lập trong chính văn. Đang hoàn thiện mô tả từ ngữ cảnh canon…`
}

export function itemDescriptionNeedsEnrichment(item) {
  if (!item || !item.name) return false
  if (item.descriptionSource === 'ai-canon-v1' && item.descriptionStatus === 'ready') return false
  if (item.custom || item.descriptionStatus === 'pending' || item.descriptionStatus === 'needs-enrichment') return true
  // Sửa save đợt cũ bị heuristic -ite/-z gắn nhầm mô tả Mega/Z cho item lạ.
  const desc = cleanText(item.desc)
  const fakeMega = Boolean(item.megaStone) && !isCanonicalMegaStoneId(item.id ?? item.name)
  const fakeZ = Boolean(item.zCrystal || item.zType) && !isCanonicalZCrystalId(item.id ?? item.name)
  if (fakeMega || fakeZ || (/mega stone|z-crystal/i.test(desc) && !isCanonicalMegaStoneId(item.id ?? item.name) && !isCanonicalZCrystalId(item.id ?? item.name))) return true
  return false
}

export async function enrichItemDescription(config, {
  item,
  canonContext = '',
  categoryHint = '',
} = {}) {
  if (!config?.baseUrl || !config?.model) throw new Error('Không có API/model để tạo mô tả vật phẩm.')
  const name = cleanText(item?.name)
  if (!name) throw new Error('Vật phẩm không có tên.')
  const system = `Bạn là ITEM METADATA CURATOR của game nhập vai Pokémon.\n\nNhiệm vụ: viết mô tả đúng cho MỘT vật phẩm dựa trên TÊN + NGỮ CẢNH CANON được cung cấp.\n\nQUY TẮC BẮT BUỘC:\n1. Không được mượn/copy mô tả của vật phẩm khác. Không suy vật phẩm là Mega Stone/Z-Crystal/chìa khóa/thuốc chỉ vì tên có hậu tố giống.\n2. Chỉ nêu công dụng/cơ chế mà tên hoặc ngữ cảnh canon thực sự hỗ trợ. Nếu chưa biết hiệu ứng số, KHÔNG tự bịa số HP/PP/EV, hệ, loài tương thích hay cơ chế battle.\n3. Với item fan-made, mô tả tự nhiên 1-2 câu, đủ để người chơi hiểu nó là gì/được dùng vào việc gì trong truyện.\n4. Không thêm lore mới, không đổi tên item.\n5. Chọn category gần nhất trong: ball, heal, status, human, misc, special, food, pokefood, daily, held, accessory. accessory dành cho trang sức/phụ kiện Pokémon đeo ngoài battle slot; KHÔNG dùng held cho Leaf Stone hay nguyên liệu tiến hóa đã được chế thành đồ trang sức. Nếu không chắc chọn misc.\n6. Trả đúng JSON trong <ITEM_META>, không markdown/giải thích.\n\nVí dụ:\n<ITEM_META>{"description":"Hộp thức ăn Pokémon cao cấp được bán tại Poké Mart, dành làm khẩu phần dinh dưỡng cho Pokémon.","category":"pokefood"}</ITEM_META>`
  const itemState = item?.customAttributes && typeof item.customAttributes === 'object' ? JSON.stringify(item.customAttributes, null, 2) : '(chưa có thuộc tính riêng)'
  const user = `TÊN VẬT PHẨM: ${name}\nCATEGORY GỢI Ý HIỆN TẠI: ${cleanText(categoryHint || item?.category || 'misc')}\n\nSTATE VẬT PHẨM ĐÃ ĐƯỢC CANON HÓA:\n${itemState.slice(0, 1800)}\n\nNGỮ CẢNH CANON LIÊN QUAN:\n${cleanText(canonContext).slice(0, 2400) || '(không còn đoạn canon đầy đủ; hãy mô tả bảo thủ chỉ từ tên và state vật phẩm, không bịa cơ chế)'}`
  const raw = await chatCompletion(config, [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ], { temperature: 0.15, maxTokens: 500, debugLabel: `Item Description · ${name}`, debugRole: 'item-description' })
  return parseMeta(raw)
}

export function applyEnrichedItemMetadata(item, meta = {}) {
  if (!item) return item
  const next = {
    ...item,
    desc: cleanText(meta.description) || item.desc,
    category: CATEGORY_SET.has(String(meta.category ?? '').toLowerCase()) ? String(meta.category).toLowerCase() : (item.category || 'misc'),
    descriptionStatus: 'ready',
    descriptionSource: 'ai-canon-v1',
  }
  const fakeMega = Boolean(next.megaStone) && !isCanonicalMegaStoneId(next.id ?? next.name)
  const fakeZ = Boolean(next.zCrystal || next.zType) && !isCanonicalZCrystalId(next.id ?? next.name)
  if (fakeMega || fakeZ) {
    next.custom = true
    delete next.megaStone
    delete next.zCrystal
    delete next.zType
    delete next.ignoreKlutz
    if (next.category !== 'held') delete next.holdable
  }
  // Nếu item do bug -ite cũ bị nhét vào pocket held, metadata mới được phép
  // đưa nó về đúng pocket; chỉ giữ holdable khi curator thực sự chọn held.
  if (next.category !== 'held' && next.custom) delete next.holdable
  if (next.category === 'accessory') { next.wearable = true; next.pokemonAccessory = true; delete next.holdable }
  return next
}

export function prepareItemForDescriptionEnrichment(item) {
  if (!item) return item
  const next = { ...item }
  const fakeMega = Boolean(next.megaStone) && !isCanonicalMegaStoneId(next.id ?? next.name)
  const fakeZ = Boolean(next.zCrystal || next.zType) && !isCanonicalZCrystalId(next.id ?? next.name)
  if (fakeMega || fakeZ) {
    next.custom = true
    next.category = next.category === 'held' ? 'misc' : (next.category || 'misc')
    delete next.megaStone
    delete next.zCrystal
    delete next.zType
    delete next.ignoreKlutz
    delete next.holdable
  }
  if (itemDescriptionNeedsEnrichment(next)) {
    // Item từng enrich xong nhưng vừa nhận item_patch phải được xếp lại queue.
    // Giữ mô tả AI cũ trong lúc chờ để UI không nhấp nháy; item mới/fake
    // metadata thì dùng mô tả pending bảo thủ. Luôn chuyển status/source về
    // pending để useEffect không setInventory lặp vô hạn.
    if (next.descriptionSource !== 'ai-canon-v1' || !cleanText(next.desc) || /mega stone|z-crystal/i.test(cleanText(next.desc))) {
      next.desc = safePendingItemDescription(next.name)
    }
    next.descriptionStatus = 'pending'
    next.descriptionSource = 'pending'
  }
  return next
}
