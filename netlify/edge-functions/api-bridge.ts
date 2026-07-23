// ============ CẦU NỐI CORS (đợt 56) ============
// Vấn đề: nhiều proxy AI (VD gcli.ggchan.dev) KHÔNG gửi header
// Access-Control-Allow-Origin. SillyTavern gọi được vì ST là server chạy
// trên máy người dùng; còn web thì trình duyệt CHẶN — không có cách nào
// vượt qua từ phía client.
// Giải pháp: request đi vòng qua Edge Function này (chạy phía máy chủ
// Netlify, không bị CORS), rồi trả kết quả về kèm header CORS hợp lệ.
//
// Chọn Edge Function thay vì Netlify Function thường vì bản thường timeout
// 10s — quá ngắn cho một lượt sinh truyện dài.
//
// AN TOÀN:
// - Chỉ nhận request có Origin đúng bằng chính site này (chặn người ngoài
//   mượn làm proxy mở).
// - Chỉ cho phép đích https.
// - KHÔNG ghi log, KHÔNG lưu API key: key chỉ đi xuyên qua trong bộ nhớ và
//   được chuyển thẳng tới đích người dùng tự chọn.

const ALLOWED_METHODS = 'POST, GET, OPTIONS'

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-target-url, x-api-key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export default async (request: Request): Promise<Response> => {
  const selfOrigin = new URL(request.url).origin
  const origin = request.headers.get('origin') ?? ''

  // Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin || selfOrigin) })
  }

  // Chỉ phục vụ chính trang này (không thành proxy mở cho thiên hạ).
  if (origin && origin !== selfOrigin) {
    return new Response(JSON.stringify({ error: { message: 'Origin không được phép dùng cầu nối này.' } }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    })
  }

  const target = request.headers.get('x-target-url')
  // Mở /api-bridge trực tiếp trên trình duyệt = cách kiểm tra cầu nối đã
  // deploy hay chưa → trả lời rõ ràng thay vì báo lỗi khó hiểu.
  if (!target) {
    return new Response(
      JSON.stringify({ ok: true, bridge: 'online', message: 'Cầu nối CORS đang hoạt động.' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin || selfOrigin) } },
    )
  }

  let targetUrl: URL
  try {
    targetUrl = new URL(target)
  } catch {
    return new Response(JSON.stringify({ error: { message: 'x-target-url không phải URL hợp lệ.' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(selfOrigin) },
    })
  }
  if (targetUrl.protocol !== 'https:') {
    return new Response(JSON.stringify({ error: { message: 'Chỉ hỗ trợ đích https.' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(selfOrigin) },
    })
  }
  // Chặn địa chỉ nội bộ (SSRF cơ bản).
  const host = targetUrl.hostname
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.local') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return new Response(JSON.stringify({ error: { message: 'Đích không được phép.' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(selfOrigin) },
    })
  }

  // Chuyển tiếp: giữ nguyên method, body và thông tin xác thực của người dùng.
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
    outHeaders.set('content-type', upstream.headers.get('content-type') ?? 'application/json')
    return new Response(upstream.body, { status: upstream.status, headers: outHeaders })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: { message: `Cầu nối không gọi được tới đích: ${(err as Error).message}` } }),
      { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin || selfOrigin) } },
    )
  }
}

export const config = { path: '/api-bridge' }
