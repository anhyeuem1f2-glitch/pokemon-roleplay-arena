// ============ CẦU NỐI CORS — BẢN CLOUDFLARE PAGES (đợt 57) ============
// Cloudflare Pages Functions: file này tự động phục vụ đường dẫn /api-bridge
// (theo tên file trong thư mục /functions). Cùng nhiệm vụ với bản Netlify
// (netlify/edge-functions/api-bridge.ts) — dự án chạy được trên CẢ HAI nền
// tảng, deploy ở đâu thì bản của nền tảng đó hoạt động.
//
// Vì sao cần: nhiều proxy AI (VD gcli.*) KHÔNG gửi header
// Access-Control-Allow-Origin nên trình duyệt chặn thẳng. SillyTavern gọi
// được vì ST chạy như một server trên máy người dùng. Cầu nối này gọi hộ ở
// phía máy chủ rồi trả về kèm header CORS hợp lệ.
//
// An toàn: chỉ nhận request từ chính site này, chỉ cho đích HTTP/HTTPS công khai,
// chặn địa chỉ nội bộ, không ghi log — API key chỉ đi xuyên qua tới đích người
// dùng tự chọn. HTTP được hỗ trợ để tương thích các proxy cũ, nhưng người dùng
// nên ưu tiên HTTPS vì đoạn bridge → provider sẽ không được mã hoá khi dùng HTTP.

const ALLOWED_METHODS = 'POST, GET, OPTIONS'

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-target-url, x-api-key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

function isPrivateHost(host) {
  const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '')
  return (
    h === 'localhost' ||
    h === 'localhost.' ||
    h === '0.0.0.0' ||
    /^0\./.test(h) ||
    /^127\./.test(h) ||
    h === '::1' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    /^10\./.test(h) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^(?:fc|fd)[0-9a-f]{2}:/i.test(h) ||
    /^fe[89ab][0-9a-f]:/i.test(h) ||
    /^::ffff:(?:0\.|127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(h)
  )
}

function targetError(targetUrl) {
  if (!['http:', 'https:'].includes(targetUrl.protocol)) return 'Chỉ hỗ trợ đích http hoặc https.'
  if (targetUrl.username || targetUrl.password) return 'Không cho phép thông tin đăng nhập nằm trực tiếp trong URL.'
  if (isPrivateHost(targetUrl.hostname)) return 'Đích nội bộ/local không được phép đi qua cầu nối.'
  return ''
}

async function fetchPublicTarget(startUrl, init, maxRedirects = 4) {
  let current = startUrl
  let requestInit = { ...init }
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const problem = targetError(current)
    if (problem) throw new Error(problem)

    const upstream = await fetch(current.toString(), { ...requestInit, redirect: 'manual' })
    if (![301, 302, 303, 307, 308].includes(upstream.status)) return upstream

    const location = upstream.headers.get('location')
    if (!location) return upstream
    if (hop === maxRedirects) throw new Error('Đích chuyển hướng quá nhiều lần.')

    const next = new URL(location, current)
    const redirectProblem = targetError(next)
    if (redirectProblem) throw new Error(`Chuyển hướng bị chặn: ${redirectProblem}`)

    // Không chuyển API key sang host khác khi redirect để tránh rò credential.
    if (next.origin !== current.origin) {
      const headers = new Headers(requestInit.headers || {})
      headers.delete('authorization')
      headers.delete('x-api-key')
      requestInit = { ...requestInit, headers }
    }

    // Theo semantics phổ biến của fetch/browser: 303 luôn đổi sang GET;
    // 301/302 của POST cũng đổi sang GET. 307/308 giữ nguyên method/body.
    const method = String(requestInit.method || 'GET').toUpperCase()
    if (upstream.status === 303 || ((upstream.status === 301 || upstream.status === 302) && method === 'POST')) {
      const headers = new Headers(requestInit.headers || {})
      headers.delete('content-type')
      requestInit = { ...requestInit, method: 'GET', body: undefined, headers }
    }
    current = next
  }
  throw new Error('Đích chuyển hướng quá nhiều lần.')
}

export async function onRequest(context) {
  const { request } = context
  const selfOrigin = new URL(request.url).origin
  const origin = request.headers.get('origin') || ''

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin || selfOrigin) })
  }

  // Chỉ phục vụ chính trang này (không thành proxy mở cho người ngoài).
  if (origin && origin !== selfOrigin) {
    return json({ error: { message: 'Origin không được phép dùng cầu nối này.' } }, 403, origin)
  }

  const target = request.headers.get('x-target-url')
  // GET không kèm target = người dùng tự mở /api-bridge trên trình duyệt để
  // kiểm tra cầu nối đã deploy chưa → trả lời rõ ràng.
  if (!target) {
    return json(
      { ok: true, bridge: 'online', message: 'Cầu nối CORS đang hoạt động. Thiếu header x-target-url (bình thường khi mở trực tiếp).' },
      200,
      origin || selfOrigin,
    )
  }

  let targetUrl
  try {
    targetUrl = new URL(target)
  } catch {
    return json({ error: { message: 'x-target-url không phải URL hợp lệ.' } }, 400, origin || selfOrigin)
  }
  const problem = targetError(targetUrl)
  if (problem) {
    return json({ error: { message: problem } }, 400, origin || selfOrigin)
  }

  const forwardHeaders = new Headers()
  const auth = request.headers.get('authorization')
  if (auth) forwardHeaders.set('authorization', auth)
  const apiKey = request.headers.get('x-api-key')
  if (apiKey) forwardHeaders.set('x-api-key', apiKey)
  const ct = request.headers.get('content-type')
  if (ct) forwardHeaders.set('content-type', ct)
  forwardHeaders.set('accept', 'application/json')

  try {
    const upstream = await fetchPublicTarget(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    })
    const outHeaders = new Headers(corsHeaders(origin || selfOrigin))
    outHeaders.set('content-type', upstream.headers.get('content-type') || 'application/json')
    return new Response(upstream.body, { status: upstream.status, headers: outHeaders })
  } catch (err) {
    return json(
      { error: { message: `Cầu nối không gọi được tới đích: ${err.message}` } },
      502,
      origin || selfOrigin,
    )
  }
}
