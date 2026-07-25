import React from 'react'

// ============ RENDER ĐỊNH DẠNG INLINE CỦA PRESET (đợt 63) ============
// Nhiều preset (bản mod dịch, preset màu mè) xuất chính văn kèm thẻ HTML
// inline để tô màu độc thoại nội tâm, VD:
//   <span style="color: #6188A7; font-style: italic">Đúng giờ lắm…</span>
// Trước đây app render chính văn dưới dạng TEXT THUẦN nên thẻ hiện nguyên
// xi ra màn hình (người chơi beta báo "còn thừa mấy cái span").
//
// KHÔNG dùng dangerouslySetInnerHTML: nội dung do model sinh, có thể chứa
// mã độc hoặc bị prompt-injection. Thay vào đó tự parse một TẬP NHỎ thẻ
// inline an toàn và chỉ giữ vài thuộc tính style vô hại (màu, nghiêng, đậm,
// gạch chân). Thẻ lạ → bỏ thẻ, GIỮ chữ bên trong (không bao giờ mất nội
// dung của người chơi).

// Chỉ chấp nhận màu dạng #abc / #aabbcc / tên màu chữ cái — chặn url(), expression()…
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|[a-z]+)$/i

function parseStyleAttr(styleStr) {
  const out = {}
  if (!styleStr) return out
  for (const decl of styleStr.split(';')) {
    const [rawProp, ...rest] = decl.split(':')
    if (!rawProp || !rest.length) continue
    const prop = rawProp.trim().toLowerCase()
    const val = rest.join(':').trim()
    if (prop === 'color' && SAFE_COLOR.test(val)) out.color = val
    else if (prop === 'font-style' && /^(italic|normal|oblique)$/i.test(val)) out.fontStyle = val
    else if (prop === 'font-weight' && /^(bold|bolder|normal|[1-9]00)$/i.test(val)) out.fontWeight = val
    else if (prop === 'text-decoration' && /^(underline|line-through|none)$/i.test(val)) out.textDecoration = val
  }
  return out
}

// Bắt: <span style="...">…</span>, <i>/<em>, <b>/<strong>, <u>, <br>
const INLINE_RE = /<(span)(\s[^>]*)?>([\s\S]*?)<\/span>|<(i|em|b|strong|u)>([\s\S]*?)<\/\4>|<br\s*\/?>/gi

/**
 * Chuyển chuỗi có thẻ inline thành mảng React node an toàn.
 * Trả về mảng (dùng trực tiếp trong JSX).
 */
export function renderInlineFormatting(text) {
  if (!text || !/[<]/.test(text)) return text
  const nodes = []
  let last = 0
  let m
  INLINE_RE.lastIndex = 0
  let key = 0
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[0].toLowerCase().startsWith('<br')) {
      nodes.push(<br key={`b${key++}`} />)
    } else if (m[1]) {
      // <span style="...">
      const styleMatch = /style\s*=\s*"([^"]*)"|style\s*=\s*'([^']*)'/i.exec(m[2] ?? '')
      const style = parseStyleAttr(styleMatch ? (styleMatch[1] ?? styleMatch[2]) : '')
      nodes.push(
        <span key={`s${key++}`} style={style}>
          {renderInlineFormatting(m[3])}
        </span>,
      )
    } else if (m[4]) {
      const tag = m[4].toLowerCase()
      const style =
        tag === 'i' || tag === 'em' ? { fontStyle: 'italic' }
          : tag === 'u' ? { textDecoration: 'underline' }
            : { fontWeight: 700 }
      nodes.push(
        <span key={`t${key++}`} style={style}>
          {renderInlineFormatting(m[5])}
        </span>,
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes.length ? nodes : text
}

/** Gỡ thẻ inline khỏi chuỗi (dùng cho tóm tắt/ký ức — nơi cần text thuần). */
export function stripInlineTags(text) {
  if (!text) return text
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:span|i|em|b|strong|u)(?:\s[^>]*)?>/gi, '')
}
