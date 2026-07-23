import { parseRegexLiteral } from './presetImport.js'

// Làm sạch nội dung AI trả về TRƯỚC khi hiển thị/lưu.
//
// Cấu trúc output của các preset đồng nhân (Tawa/AvarsiSkull...):
//   <thinking>...CoT...</thinking>
//   {tiêu đề}
//   <content> ...CHÍNH VĂN... </content>
//   <Thúc đẩy đồng nhân>...</...>  <schedule>  <theater>  <danmu> ... (hậu kỳ)
//
// NGUYÊN TẮC (đợt 43): nếu có <content>, CHÍNH VĂN = CHỈ phần trong
// <content>, vứt sạch mọi thứ ngoài nó (thinking, tiêu đề, và MỌI block
// hậu kỳ dù tên gì). Đây là cách chống triệt để việc lộ khối "Thúc đẩy
// đồng nhân"/CoT ra màn hình.

/** Bóc phần trong <content>...</content>. */
function extractContent(text) {
  const re = /<content>\s*([\s\S]*?)\s*<\/content>/gi
  const parts = []
  let m
  while ((m = re.exec(text)) !== null) parts.push(m[1])
  if (parts.length) return parts.join('\n\n')
  // <content> mở mà chưa đóng (bị cắt stream) → lấy từ sau nó, rồi cắt ở
  // block hậu kỳ đầu tiên nếu có.
  const openMatch = text.match(/<content>/i)
  if (openMatch) {
    let rest = text.slice(text.search(/<content>/i) + openMatch[0].length)
    // cắt ở thẻ mở của bất kỳ block hậu kỳ nào (chữ cái/ gạch dưới/ khoảng trắng).
    rest = rest.split(/<(?:\/?\s*)?(?:Thúc đẩy|thinking|Technical_Footer|danmu|disclaimer|schedule|theater|recap|parallel|choice|status|Hậu Trường|Bảng)/i)[0]
    return rest
  }
  return null // KHÔNG có content
}

// Khi KHÔNG có <content> (preset thường / không preset): chỉ gỡ các block CoT
// + hậu kỳ đã biết, giữ phần còn lại.
const STRIP_BLOCKS = [
  /<thinking>[\s\S]*?<\/thinking>/gi,
  /<Thúc đẩy đồng nhân>[\s\S]*?<\/Thúc đẩy đồng nhân>/gi,
  /<Technical_Footer>[\s\S]*?<\/Technical_Footer>/gi,
  /<danmu>[\s\S]*?<\/danmu>/gi,
  /<disclaimer>[\s\S]*?<\/disclaimer>/gi,
  /<parallel_world>[\s\S]*?<\/parallel_world>/gi,
  /<recap>[\s\S]*?<\/recap>/gi,
  /<theater>[\s\S]*?<\/theater>/gi,
  /<schedule[^>]*>[\s\S]*?<\/schedule[^>]*>/gi,
]

const DEFAULT_SCRIPTS = [
  {
    findRegexRaw:
      '/(?:<thinking>\\s*\\[(?:metacognition|love_qkll)\\]|<thinking>|\\[(?:metacognition|love_qkll)\\])\\s*([\\s\\S]*?)<\\/thinking>/gi',
    replaceString: '',
  },
]

// ===== Pipeline dịch song ngữ (đợt 45) =====
// Một số preset (bản mod dịch) bắt model viết nháp tiếng Nhật trong <jp>,
// rồi dịch sang tiếng Việt trong <vn>, kèm comment HTML điều khiển vòng lặp
// (<!-- Vòng lặp thứ: 2/∞ ... (Tiếp tục dịch) -->). TẤT CẢ scaffold đó là
// hậu trường — người chơi chỉ được thấy phần <vn>.
function resolveDualLanguage(text) {
  // 1) Vứt sạch comment HTML (kể cả comment mở mà chưa đóng do bị cắt stream).
  let out = text.replace(/<!--[\s\S]*?-->/g, '').replace(/<!--[\s\S]*$/g, '')
  if (!/<vn>/i.test(out) && !/<jp>/i.test(out)) return out

  // 2) Có <vn>: chính văn = CHỈ các block <vn>. Block cuối chưa đóng (stream
  //    bị cắt) → lấy tới trước <jp> kế tiếp hoặc hết chuỗi.
  if (/<vn>/i.test(out)) {
    const parts = []
    const re = /<vn>([\s\S]*?)(?:<\/vn>|(?=<jp>)|$)/gi
    let m
    while ((m = re.exec(out)) !== null) {
      const seg = m[1].trim()
      if (seg) parts.push(seg)
    }
    if (parts.length) return parts.join('\n\n')
  }

  // 3) Chỉ có <jp> (chưa kịp dịch): vứt block Nhật, giữ phần còn lại — thà
  //    thiếu còn hơn hiện tiếng Nhật lẫn scaffold ra màn hình.
  out = out.replace(/<jp>[\s\S]*?<\/jp>/gi, '').replace(/<jp>[\s\S]*$/gi, '')
  return out
}

// ===== Scaffold hậu trường của preset lộ ra chính văn (đợt 47) =====
// Khi model KHÔNG bọc (hoặc bọc hỏng) <thinking>/<content>, các khối giai
// đoạn CoT kiểu "[7.X — Đóng Gói Tư Duy / Editor Pass]" + dòng
// "[ChapterInfo| |Tiêu đề|Địa danh]" tuôn thẳng ra đầu chương. Cấu trúc
// preset: mọi thứ TRƯỚC dòng ChapterInfo là hậu trường → cắt sạch tới hết
// dòng ChapterInfo; nhưng model hay nhét tag trạng thái ([[MONEY]]...)
// lẫn trong phần đó nên phải VỚT tag ra nối xuống cuối trước khi cắt,
// không thì tiền/fact… mất theo scaffold.
const CHAPTERINFO_LINE_RE = /^[ \t]*\[ChapterInfo[^\]\n]*\][ \t]*$/im
const STATE_TAG_RE = /\[\[\s*(?:MONEY|REL|BODY|SHOP|NPC|FACT|POKEMON|HUNGER|DATE|MOVE|BATTLE)[^\]]*\]\]/gi

function stripPresetScaffold(text) {
  let out = text
  const m = out.match(CHAPTERINFO_LINE_RE)
  if (m) {
    const cutEnd = out.indexOf(m[0]) + m[0].length
    const head = out.slice(0, cutEnd)
    const salvaged = head.match(STATE_TAG_RE) ?? []
    out = out.slice(cutEnd)
    if (salvaged.length) out = `${out}\n\n${salvaged.join('\n')}`
  }
  return out
    // Dòng metadata/tiêu đề còn sót (kể cả nằm giữa bài): [ChapterInfo|...],
    // [Metadata|...] — dò vị trí từ metadata đọc trên reply GỐC nên gỡ ở
    // đây (chỉ ảnh hưởng hiển thị) là an toàn.
    .replace(/^[ \t]*\[(?:ChapterInfo|Metadata)[^\]\n]*\][ \t]*$/gim, '')
    .replace(/\[(?:ChapterInfo|Metadata)\|[^\]\n]*\]/gi, '')
    // Header giai đoạn CoT đánh số: "[7.X — ...]", "[3.2 — ...]" đứng 1 mình
    // trên dòng — vứt (chính văn thật không mở đầu đoạn bằng dạng này).
    .replace(/^[ \t]*\[\d+(?:\.[\wXx]+)?\s*—[^\]\n]*\][ \t]*$/gim, '')
}

export function cleanAiOutput(text, customScripts) {
  if (!text) return text

  const extracted = extractContent(text)
  let cleaned
  if (extracted !== null) {
    // CÓ <content>: chính văn là phần trong đó. Vẫn gỡ nốt vài thẻ lồng
    // (VD danmu bị AI nhét nhầm vào trong content).
    cleaned = extracted
    // FIX đợt 45: regex script của preset trước đây CHỈ chạy ở nhánh không
    // có <content> → scaffold nằm TRONG content (jp/vn, comment vòng lặp...)
    // không bao giờ được gỡ. Giờ chạy ở CẢ 2 nhánh.
    const customInContent = customScripts?.filter((s) => s.enabled) ?? []
    for (const s of customInContent) {
      const regex = parseRegexLiteral(s.findRegexRaw)
      if (!regex) continue
      try { cleaned = cleaned.replace(regex, s.replaceString ?? '') } catch { /* bỏ qua */ }
    }
    for (const re of STRIP_BLOCKS) cleaned = cleaned.replace(re, '')
  } else {
    // KHÔNG có <content>: gỡ block CoT/hậu kỳ, giữ phần còn lại.
    cleaned = text
    const custom = customScripts?.filter((s) => s.enabled) ?? []
    const scripts = custom.length ? custom : DEFAULT_SCRIPTS
    for (const s of scripts) {
      const regex = parseRegexLiteral(s.findRegexRaw)
      if (!regex) continue
      try { cleaned = cleaned.replace(regex, s.replaceString ?? '') } catch { /* bỏ qua */ }
    }
    for (const re of STRIP_BLOCKS) cleaned = cleaned.replace(re, '')
  }

  // Pipeline song ngữ jp/vn + comment HTML điều khiển (đợt 45).
  cleaned = resolveDualLanguage(cleaned)
  // Scaffold CoT/ChapterInfo/Metadata lộ ra chính văn (đợt 47).
  cleaned = stripPresetScaffold(cleaned)

  // Gỡ <safe> theo kiểu NỐI CHỮ (preset chèn giữa từ né lọc).
  cleaned = cleaned.replace(/<\/?safe>/gi, '')
  // Gỡ mọi thẻ lẻ còn sót của các block đã biết (phòng lệch cặp / thẻ mở đơn).
  cleaned = cleaned
    .replace(/<\/?(?:content|thinking|Technical_Footer|danmu|disclaimer|parallel_world|recap|theater|jp|vn)>/gi, '')
    .replace(/<\/?\s*Thúc đẩy đồng nhân\s*>/gi, '')

  return cleaned.replace(/\n{3,}/g, '\n\n').trim()
}


// ===== Bóc phần SUY NGHĨ (CoT) từ reply gốc (đợt 48) =====
// Dùng cho viewer "Biến cập nhật" trên từng tin — người chơi xem AI đã nghĩ
// gì trước khi viết chính văn (học theo card Phàm Nhân Tu Tiên).
export function extractThinking(raw) {
  if (!raw) return ''
  const parts = []
  for (const re of [/<thinking>([\s\S]*?)<\/thinking>/gi, /<suy_ngh[ĩi]>([\s\S]*?)<\/suy_ngh[ĩi]>/gi]) {
    let m
    while ((m = re.exec(raw)) !== null) {
      const seg = m[1].trim()
      if (seg) parts.push(seg)
    }
  }
  if (parts.length) return parts.join('\n\n---\n\n')
  // Không có thẻ thinking nhưng có <content>: phần trước <content> chính là
  // hậu trường (CoT tuôn trần — đã gặp thực tế vụ Editor Pass).
  const ci = raw.search(/<content>/i)
  if (ci > 0) return raw.slice(0, ci).trim()
  return ''
}
