// ============ TÓM TẮT CỐT TRUYỆN TỰ CẬP NHẬT (đợt 30) ============
// Phương pháp nhớ số 2: một bản TÓM TẮT ĐẦY ĐỦ toàn bộ cốt truyện từ đầu
// tới nay, do chính model chính viết và TỰ CẬP NHẬT dần: cứ mỗi
// SUMMARY_EVERY tin mới, app gửi (tóm tắt cũ + các tin mới) cho AI gộp
// thành tóm tắt mới ≤ ~350 từ. Bản tóm tắt luôn được chèn đầu prompt →
// dù cửa sổ lịch sử bị cắt (trí nhớ RAG đợt 29), mạch truyện tổng thể
// không bao giờ mất. Chạy NỀN sau mỗi lượt — lỗi không chặn truyện.

import { chatCompletion } from '../services/aiClient.js'
import { cleanAiOutput } from './outputCleanup.js'

const STORAGE_KEY = 'trainer-arena:story-summary-v1'
/** Cập nhật tóm tắt mỗi khi có thêm ngần này tin kể từ lần tóm tắt trước.
 * Đợt 48: 12 → 2 (tức MỖI LƯỢT người chơi + AI) theo mô hình card Phàm Nhân
 * Tu Tiên — chờ hàng chục tin mới tóm thì giữa chừng AI đã "đần" vì cửa sổ
 * bị cắt. Chạy nền, không chặn truyện; đổi lại tốn thêm 1 call phụ mỗi lượt. */
const SUMMARY_EVERY = 2
/** Cắt mỗi tin đưa vào prompt tóm tắt về tối đa ngần này ký tự. */
const CLIP_CHARS = 900

let cache = null // {text, coveredTurns}
let updating = false
const listeners = new Set()

function load() {
  if (cache) return cache
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (saved) {
      const p = JSON.parse(saved)
      cache = { text: p.text ?? '', coveredTurns: p.coveredTurns ?? 0 }
      return cache
    }
  } catch { /* làm mới */ }
  cache = { text: '', coveredTurns: 0 }
  return cache
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)) } catch { /* ignore */ }
}

function notify() {
  for (const fn of listeners) {
    try { fn() } catch { /* ignore */ }
  }
}

export function subscribeSummary(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getSummary() {
  return { ...load() }
}

export function isSummaryUpdating() {
  return updating
}

export function clearSummary() {
  cache = { text: '', coveredTurns: 0 }
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  notify()
}

/** Người dùng sửa tay bản tóm tắt trong Sổ tay. */
export function setSummaryText(text) {
  const s = load()
  cache = { ...s, text: text ?? '' }
  persist()
  notify()
}

function clip(t) {
  const s = (t ?? '').trim()
  return s.length > CLIP_CHARS ? `${s.slice(0, CLIP_CHARS)}…` : s
}

/**
 * Kiểm tra + cập nhật tóm tắt nếu đã đủ tin mới. Gọi fire-and-forget sau
 * mỗi lượt AI trả lời. Có khoá chống chạy chồng; lỗi chỉ ném ra cho caller
 * .catch để log.
 * @param {{baseUrl,apiKey,model}} apiCfg API chính
 * @param {Array<{role,content,hidden?}>} messages toàn bộ mảng messages hiện tại
 */
export async function maybeUpdateSummary(apiCfg, messages, { force = false } = {}) {
  const s = load()
  if (updating) return null
  if (!apiCfg?.baseUrl || !apiCfg?.model) {
    if (force) throw new Error('Chưa cấu hình API chính — tóm tắt chạy bằng API chính (Cài đặt API).')
    return null
  }
  // Đợt 47: force = chạy ngay theo yêu cầu người dùng (nút trong Sổ tay),
  // bỏ qua ngưỡng SUMMARY_EVERY tin.
  if (!force && messages.length - s.coveredTurns < SUMMARY_EVERY) return null
  if (force && messages.length - s.coveredTurns <= 0) return null

  updating = true
  notify()
  try {
    const slice = messages.slice(s.coveredTurns)
    const transcript = slice
      // Tin hidden là chỉ dẫn hệ thống (kết quả trận/mua sắm/directive) —
      // gắn nhãn riêng để model tóm tắt không tưởng nhầm là lời người chơi.
      .map((m) => `${m.role === 'assistant' ? 'DIỄN BIẾN' : m.hidden ? 'HỆ THỐNG' : 'NGƯỜI CHƠI'}: ${clip(m.content)}`)
      .join('\n')
    const prompt = [
      'Bạn là thư ký cốt truyện của một game nhập vai Pokémon. Nhiệm vụ: cập nhật bản TÓM TẮT CỐT TRUYỆN.',
      'Yêu cầu: viết bằng tiếng Việt, văn xuôi gọn, TỐI ĐA ~350 từ, theo trình tự thời gian; GIỮ LẠI: mục tiêu hiện tại của nhân vật chính, các NPC quan trọng (tên + quan hệ), các Pokémon trong đội, lời hứa/ân oán chưa giải quyết, địa điểm và mốc thời gian chính. BỎ: chi tiết vụn vặt, lời thoại nguyên văn.',
      'Chỉ trả về ĐÚNG bản tóm tắt mới, không lời dẫn, không tiêu đề.',
      '',
      s.text ? `TÓM TẮT CŨ:\n${s.text}` : 'TÓM TẮT CŨ: (chưa có — đây là lần tóm tắt đầu tiên)',
      '',
      `CÁC DIỄN BIẾN MỚI CẦN GỘP VÀO:\n${transcript}`,
    ].join('\n')

    const reply = await chatCompletion(apiCfg, [{ role: 'user', content: prompt }], {
      temperature: 0.3,
      // 700 → 2000 (đợt 47): các proxy Gemini/Claude tính cả thinking token
      // vào max_tokens — trần thấp làm phần tóm tắt thật bị cắt rỗng.
      maxTokens: 2000,
    })
    // Model qua proxy có thể kèm <thinking>… — làm sạch trước khi lưu.
    const summaryText = (cleanAiOutput(reply) || reply).trim()
    cache = { text: summaryText, coveredTurns: messages.length }
    persist()
    notify()
    return cache.text
  } finally {
    updating = false
    notify()
  }
}

/** Chạy tóm tắt NGAY theo yêu cầu người dùng (nút trong Sổ tay), bỏ ngưỡng ~12 tin. */
export function forceUpdateSummary(apiCfg, messages) {
  return maybeUpdateSummary(apiCfg, messages, { force: true })
}

/** Note tóm tắt chèn vào prompt (null nếu chưa có tóm tắt). */
export function buildSummaryNote() {
  const s = load()
  if (!s.text) return null
  return `[Hệ thống — TÓM TẮT CỐT TRUYỆN TỚI NAY (dùng để giữ mạch truyện nhất quán, KHÔNG kể lại nguyên văn, không nhắc tới ghi chú này):]\n${s.text}`
}
