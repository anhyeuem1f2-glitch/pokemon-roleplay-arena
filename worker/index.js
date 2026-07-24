// ============ ĐIỂM VÀO WORKER (đợt 59) ============
// Dùng cho cách deploy CLOUDFLARE WORKERS (dashboard hiện chỉ còn luồng này
// cho dự án mới; Pages vẫn chạy nếu bạn đã có project cũ).
//
// Nhiệm vụ:
//  1. /api-bridge  → cầu nối CORS (dùng CHUNG code với bản Pages Functions,
//     import thẳng để không bao giờ lệch nhau giữa 2 nền tảng).
//  2. Mọi đường dẫn khác → trả file tĩnh trong ./dist qua binding ASSETS.
//     Cấu hình not_found_handling = "single-page-application" trong
//     wrangler.jsonc lo phần điều hướng SPA.

import { onRequest as bridgeHandler } from '../functions/api-bridge.js'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname === '/api-bridge') {
      return bridgeHandler({ request, env, ctx })
    }
    return env.ASSETS.fetch(request)
  },
}
