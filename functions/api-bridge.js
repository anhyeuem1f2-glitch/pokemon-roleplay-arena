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
// An toàn: chỉ nhận request từ chính site này, chỉ cho đích https, chặn địa
// chỉ nội bộ, không ghi log — API key chỉ đi xuyên qua tới đích người dùng
// tự chọn.

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
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.local') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  )
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
  if (targetUrl.protocol !== 'https:') {
    return json({ error: { message: 'Chỉ hỗ trợ đích https.' } }, 400, origin || selfOrigin)
  }
  if (isPrivateHost(targetUrl.hostname)) {
    return json({ error: { message: 'Đích không được phép.' } }, 400, origin || selfOrigin)
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
    const upstream = await fetch(targetUrl.toString(), {
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
