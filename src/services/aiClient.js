// Client gọi bất kỳ API nào tương thích chuẩn OpenAI /chat/completions
// (OpenAI, OpenRouter, Groq, local server như LM Studio / text-generation-webui,
// hoặc các proxy Gemini/Claude giả lập format OpenAI như trong ảnh bạn gửi).
//
// Lưu ý CORS: OpenAI và OpenRouter cho phép gọi thẳng từ trình duyệt.
// Nếu bạn dùng server local hoặc proxy riêng, có thể cần bật CORS phía server đó.

/**
 * @param {{baseUrl: string, apiKey: string, model: string, temperature?: number, maxTokens?: number}} config
 * @param {Array<{role: 'system'|'user'|'assistant', content: string}>} messages
 * @param {{temperature?: number, maxTokens?: number, signal?: AbortSignal, assistantPrefill?: string}} options
 */

// ============ GIẢI QUYẾT ENDPOINT (đợt 53) ============
// Thực chiến beta: người chơi dán Base URL thiếu "/v1" (VD
// https://gcli.ggchan.dev/) → app gọi /chat/completions → route không tồn
// tại → server trả 404 KHÔNG kèm header CORS → trình duyệt báo "CORS
// policy / Failed to fetch", rất dễ hiểu nhầm là bị chặn.
// Cách xử lý: thử lần lượt các biến thể đường dẫn, CHỈ thử tiếp khi lỗi
// thuộc loại không tốn token (lỗi mạng/CORS hoặc 404), rồi NHỚ biến thể
// chạy được cho các lần sau.

// ============ CẦU NỐI CORS PHÍA MÁY CHỦ (đợt 56) ============
// Khi proxy AI không gửi header CORS, trình duyệt chặn thẳng — client không
// làm gì được. Bản deploy trên Netlify có sẵn Edge Function /api-bridge
// chuyển tiếp request phía máy chủ (không dính CORS).
// Chiến lược: gọi TRỰC TIẾP trước (nhanh nhất, không qua trung gian); chỉ khi
// dính lỗi mạng/CORS mới tự chuyển sang cầu nối, rồi GHI NHỚ để các lượt sau
// đi thẳng đường đã chạy được.
const BRIDGE_PATH = '/api-bridge'
const bridgeNeeded = new Set() // các baseUrl đã xác định phải đi qua cầu nối

function bridgeAvailable() {
  // Chỉ có trên bản deploy (localhost `npm run dev` không chạy edge function).
  return typeof window !== 'undefined' && /^https?:/.test(window.location.origin)
}

async function fetchViaBridge(targetUrl, init) {
  const headers = new Headers(init.headers || {})
  headers.set('x-target-url', targetUrl)
  return fetch(BRIDGE_PATH, { ...init, headers })
}

const endpointMemo = new Map()

function endpointCandidates(baseUrl, path) {
  const base = baseUrl.replace(/\/+$/, '')
  const list = [`${base}/${path}`]
  // Chưa có /v1 (hoặc /v1beta...) trong base → thử thêm bản có /v1.
  if (!/\/v\d[\w.]*$/i.test(base)) list.push(`${base}/v1/${path}`)
  return list
}

/** fetch qua các ứng viên endpoint; trả { res, url }. */
async function fetchWithEndpointFallback(baseUrl, path, init) {
  const memoKey = `${baseUrl}|${path}`
  const memo = endpointMemo.get(memoKey)
  const candidates = memo ? [memo] : endpointCandidates(baseUrl, path)
  let lastErr = null
  for (let i = 0; i < candidates.length; i++) {
    const url = candidates[i]
    const isLast = i === candidates.length - 1
    try {
      // baseUrl này đã biết là bị CORS chặn → đi thẳng cầu nối, khỏi thử lại.
      const useBridge = bridgeNeeded.has(baseUrl) && bridgeAvailable()
      const res = useBridge ? await fetchViaBridge(url, init) : await fetch(url, init)
      // 404 = sai route → thử biến thể kế tiếp (không tốn token).
      if (res.status === 404 && !isLast) continue
      endpointMemo.set(memoKey, url)
      return { res, url }
    } catch (netErr) {
      // Lỗi mạng/CORS ở lần gọi TRỰC TIẾP → thử lại qua cầu nối máy chủ.
      if (bridgeAvailable() && !bridgeNeeded.has(baseUrl)) {
        try {
          const res = await fetchViaBridge(url, init)
          if (res.status !== 404 || isLast) {
            // Cầu nối chạy được → nhớ lại, mọi lượt sau đi luôn đường này.
            bridgeNeeded.add(baseUrl)
            endpointMemo.set(memoKey, url)
            return { res, url }
          }
        } catch { /* cầu nối cũng hỏng → rơi xuống xử lý lỗi bên dưới */ }
      }
      // Lỗi mạng/CORS: có thể do route sai → thử tiếp; hết ứng viên thì ném.
      lastErr = netErr
      if (!isLast) continue
      const origin = typeof window !== 'undefined' ? window.location.origin : 'trang web này'
      throw new Error(
        `Không gọi được tới API (lỗi mạng/CORS): ${netErr.message}. ` +
        `Kiểm tra: (1) Base URL có đúng dạng https://.../v1 không; ` +
        `(2) proxy có cho phép gọi từ trình duyệt (CORS) tại ${origin} không — ` +
        `nhiều proxy chạy được trong SillyTavern vì ST gọi từ máy chủ, còn web thì bị trình duyệt chặn nếu proxy thiếu header Access-Control-Allow-Origin. ` +
        `(Trang đã tự thử chuyển tiếp qua máy chủ nhưng vẫn không được — hãy kiểm tra lại Base URL/API key, hoặc dùng proxy khác.)`,
      )
    }
  }
  throw lastErr ?? new Error('Không gọi được tới API.')
}

// Số token thử lại khi model đốt hết hạn mức vào phần "suy nghĩ" (đợt 55).
const RETRY_MIN_TOKENS = 16384

export async function chatCompletion(config, messages, options = {}) {
  const { baseUrl, apiKey, model } = config
  if (!baseUrl || !model) {
    throw new Error('Thiếu Base URL hoặc Model. Hãy vào mục Cài đặt API trước.')
  }

  // URL thật do fetchWithEndpointFallback quyết định (tự thử thêm /v1).
  const temperature = options.temperature ?? config.temperature ?? 0.9
  // max_tokens mặc định nâng lên 1024: một số proxy (VD Gemini chạy qua lớp
  // tương thích OpenAI) tính cả phần "suy nghĩ" (reasoning/thinking tokens)
  // vào max_tokens — để quá thấp (như 400) dễ khiến phần nội dung hiển thị
  // bị rỗng dù request vẫn "thành công".
  // Mặc định 8192 (đợt 55, trước là 1024): các model "thinking" hiện nay
  // (Gemini 2.5/3.x Pro, o-series, Claude thinking...) tính CẢ token suy nghĩ
  // nội bộ vào max_tokens — 1024 bị đốt sạch cho phần suy nghĩ, trả về rỗng
  // kèm finish_reason "length". Đây đúng là lỗi người chơi beta gặp.
  const maxTokens = options.maxTokens ?? config.maxTokens ?? 8192

  // Assistant prefill: mồi trước 1 đoạn text coi như AI đã bắt đầu trả lời,
  // model chỉ cần viết TIẾP thay vì tự quyết định có mở đầu thế nào/có nên
  // trả lời hay không. Cách làm: thêm 1 message role "assistant" vào CUỐI
  // mảng messages. Lưu ý: đây không phải chuẩn chính thức của OpenAI chat
  // completions (OpenAI sẽ bỏ qua hoặc báo lỗi nếu bắt buộc kết thúc bằng
  // user) — nhưng nhiều proxy Gemini/Claude-compatible (kể cả API Anthropic
  // thật) hỗ trợ tốt kỹ thuật này. Tuỳ provider mà có hiệu quả hay không.
  const prefill = options.assistantPrefill?.trim()
  const finalMessages = prefill ? [...messages, { role: 'assistant', content: prefill }] : messages

  const { res } = await fetchWithEndpointFallback(baseUrl, 'chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: finalMessages,
      temperature,
      max_tokens: maxTokens,
    }),
    signal: options.signal,
  })

  if (!res.ok) {
    let detail = ''
    try {
      const errJson = await res.json()
      detail = errJson?.error?.message || JSON.stringify(errJson)
    } catch {
      detail = await res.text()
    }
    throw new Error(`Lỗi API (${res.status}): ${detail || res.statusText}`)
  }

  const data = await res.json()
  const choice = data?.choices?.[0]

  // Chuẩn hoá nội dung trả về: đa số API trả string ở message.content, nhưng
  // vài proxy trả mảng "parts" (kiểu Gemini) hoặc dùng field "text" (completion
  // API cũ). Thử lần lượt các dạng phổ biến trước khi báo lỗi.
  let text = choice?.message?.content
  if (Array.isArray(text)) {
    text = text.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('')
  }
  if (!text && typeof choice?.text === 'string') {
    text = choice.text
  }
  // Một số proxy tách phần suy nghĩ ra reasoning_content và để content rỗng.
  // KHÔNG dùng reasoning_content làm chính văn (đó là CoT), nhưng ghi nhận
  // để biết model có chạy hay không — việc thử lại bên dưới sẽ xử lý.
  const hadReasoningOnly = !text && Boolean(choice?.message?.reasoning_content || choice?.message?.reasoning)

  if (!text || !text.trim()) {
    const finish = choice?.finish_reason
    // TỰ THỬ LẠI 1 LẦN (đợt 55): rỗng + finish_reason "length" = model đã
    // tiêu hết hạn mức cho phần suy nghĩ nội bộ, chưa kịp viết chữ nào ra.
    // Lượt hỏng này không sinh nội dung nên thử lại với hạn mức cao hơn là
    // đáng; chỉ thử MỘT lần để không đốt token vô hạn.
    const canRetry = !options._retried && (finish === 'length' || finish === 'MAX_TOKENS' || hadReasoningOnly)
    if (canRetry) {
      const bumped = Math.max(RETRY_MIN_TOKENS, maxTokens * 4)
      return chatCompletion(config, messages, { ...options, maxTokens: bumped, _retried: true })
    }
    const reason = finish ? ` (finish_reason: ${finish})` : ''
    const modelHint = /search/i.test(model)
      ? ' Lưu ý: bản model có đuôi "-search" thường trả về kết quả tìm kiếm kèm metadata thay vì văn bản thuần — hãy thử bản KHÔNG có "-search".'
      : ''
    throw new Error(
      `API trả về phản hồi rỗng${reason}. Model này nhiều khả năng là loại "thinking" (tính cả token suy nghĩ ` +
        `vào giới hạn) — hãy vào Cài đặt API → Nâng cao và đặt "Max tokens" khoảng 30000-60000, ` +
        `hoặc đổi sang model khác.${modelHint}`,
    )
  }

  // Khi có prefill, nhiều provider trả về CHỈ phần tiếp nối (không lặp lại
  // đoạn mồi) — nhưng 1 số proxy lại trả về gồm cả đoạn mồi. Nếu output bắt
  // đầu đúng bằng đoạn mồi, cắt bớt để không bị lặp khi hiển thị.
  let finalText = text.trim()
  if (prefill && finalText.startsWith(prefill)) {
    finalText = finalText.slice(prefill.length)
  }
  return prefill ? `${prefill}${finalText}` : finalText
}

/**
 * Kiểm tra kết nối nhanh bằng cách gọi endpoint /models (GET).
 * Không phải mọi provider hỗ trợ endpoint này, nên lỗi ở đây không
 * chắc chắn nghĩa là key sai — chỉ mang tính tham khảo nhanh.
 */
export async function testConnection(config) {
  // Đợt 53: test ĐÚNG ĐƯỜNG THẬT mà truyện dùng (POST chat/completions),
  // thay vì GET /models như trước. Lý do: /models có thể chạy ngon trong khi
  // POST bị CORS/404 → nút báo "Kết nối thành công" nhưng vào chơi là lỗi
  // (đúng ca người chơi beta báo). Gửi 1 request cực nhỏ để không tốn token.
  if (!config?.model) {
    throw new Error('Chưa chọn Model — hãy điền/chọn model rồi thử lại.')
  }
  await chatCompletion(config, [{ role: 'user', content: 'ping' }], { maxTokens: 1, temperature: 0 })
  return true
}

/**
 * Lấy danh sách model khả dụng từ endpoint GET /models (chuẩn OpenAI-compatible).
 * Trả về mảng string id model, đã sắp xếp. Ném lỗi nếu provider không hỗ trợ
 * endpoint này hoặc trả sai định dạng.
 */
export async function listModels(config) {
  const { baseUrl, apiKey } = config
  const { res } = await fetchWithEndpointFallback(baseUrl, 'models', {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  })
  if (!res.ok) {
    throw new Error(`Không tải được danh sách model (${res.status} ${res.statusText})`)
  }
  const data = await res.json()
  const list = data?.data ?? data?.models ?? data
  if (!Array.isArray(list)) {
    throw new Error('Provider này không trả danh sách model đúng định dạng OpenAI-compatible.')
  }
  const ids = list.map((m) => m.id || m.name || m).filter(Boolean)
  return [...new Set(ids)].sort()
}

/**
 * Gọi endpoint /embeddings (chuẩn OpenAI-compatible) — đợt 29, phục vụ trí
 * nhớ dài hạn. Trả về mảng vector (mỗi vector = mảng số) theo đúng thứ tự
 * texts truyền vào. Hoạt động với OpenAI, các proxy tương thích, vLLM,
 * LM Studio, Ollama (/v1), Infinity, TEI (chế độ openai)...
 * @param {{baseUrl: string, apiKey?: string, model: string}} config
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embedTexts(config, texts) {
  const { baseUrl, apiKey, model } = config ?? {}
  if (!baseUrl || !model) throw new Error('Thiếu Base URL hoặc Model của API embedding.')
  if (!texts?.length) return []
  const url = `${baseUrl.replace(/\/+$/, '')}/embeddings`
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ model, input: texts }),
    })
  } catch (networkErr) {
    throw new Error(`Không gọi được API embedding (lỗi mạng/CORS): ${networkErr.message}`)
  }
  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = j?.error?.message || JSON.stringify(j)
    } catch {
      detail = await res.text()
    }
    throw new Error(`Lỗi API embedding (${res.status}): ${detail || res.statusText}`)
  }
  const data = await res.json()
  const rows = data?.data
  if (!Array.isArray(rows)) throw new Error('API embedding trả về sai định dạng (thiếu mảng "data").')
  // Chuẩn OpenAI có field "index" — sắp lại cho chắc thứ tự khớp input.
  const sorted = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  const vectors = sorted.map((r) => r.embedding)
  if (vectors.some((v) => !Array.isArray(v) || !v.length)) {
    throw new Error('API embedding trả về vector rỗng/sai định dạng.')
  }
  return vectors
}

/**
 * Gọi endpoint /rerank — đợt 29. KHÔNG có chuẩn OpenAI chính thức cho rerank,
 * nhưng Jina / Cohere / vLLM / Infinity / TEI đều dùng chung một format rất
 * giống nhau: POST {model, query, documents: string[], top_n} → 
 * {results: [{index, relevance_score}]}. Hàm này chuẩn hoá các biến thể
 * thường gặp (results/data, relevance_score/score).
 * @param {{baseUrl: string, apiKey?: string, model: string}} config
 * @param {string} query
 * @param {string[]} documents
 * @param {number} topN
 * @returns {Promise<Array<{index: number, score: number}>>} sắp giảm dần theo score
 */
export async function rerankDocs(config, query, documents, topN) {
  const { baseUrl, apiKey, model } = config ?? {}
  if (!baseUrl || !model) throw new Error('Thiếu Base URL hoặc Model của API rerank.')
  if (!documents?.length) return []
  const url = `${baseUrl.replace(/\/+$/, '')}/rerank`
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        query,
        documents,
        top_n: Math.min(topN ?? documents.length, documents.length),
      }),
    })
  } catch (networkErr) {
    throw new Error(`Không gọi được API rerank (lỗi mạng/CORS): ${networkErr.message}`)
  }
  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = j?.error?.message || j?.detail || JSON.stringify(j)
    } catch {
      detail = await res.text()
    }
    throw new Error(
      `Lỗi API rerank (${res.status}): ${detail || res.statusText}. ` +
        `Lưu ý: endpoint phải là dạng {baseUrl}/rerank kiểu Jina/Cohere/vLLM.`,
    )
  }
  const data = await res.json()
  const rows = data?.results ?? data?.data
  if (!Array.isArray(rows)) {
    throw new Error('API rerank trả về sai định dạng (thiếu mảng "results").')
  }
  return rows
    .map((r) => ({
      index: r.index ?? r.document_index ?? 0,
      score: Number(r.relevance_score ?? r.score ?? 0),
    }))
    .sort((a, b) => b.score - a.score)
}


// ============ CHAU CHUỐT VĂN PHONG (đợt 50) ============
// API phụ (tái sử dụng slot "Combat Anime" cũ — tính năng anime chưa mở cho
// beta nên slot này đổi vai): sau khi có chính văn sạch, model phụ ĐÁNH BÓNG
// câu chữ theo tông truyện — KHÔNG được đổi nội dung/sự kiện/thoại/thứ tự.
// Lỗi bất kỳ → trả nguyên văn cũ, truyện không bao giờ bị chặn.
export async function polishProse(cfg, text, toneNote) {
  if (!cfg?.baseUrl || !cfg?.model || !text?.trim()) return text
  const reply = await chatCompletion(cfg, [
    {
      role: 'system',
      content: [
        'Bạn là biên tập viên văn xuôi tiếng Việt cho một game nhập vai Pokémon. Nhiệm vụ DUY NHẤT: chau chuốt câu chữ của đoạn chính văn được đưa — mượt hơn, tự nhiên hơn, đúng tông truyện — rồi trả về TOÀN BỘ đoạn văn đã sửa.',
        'LUẬT SẮT: (1) KHÔNG thay đổi nội dung, sự kiện, thông tin, tên riêng, con số; (2) KHÔNG thêm/bớt tình tiết hay lời thoại (chỉ được sửa cách diễn đạt của thoại, giữ nguyên ý); (3) giữ nguyên bố cục đoạn; (4) sửa các cấu trúc dịch-máy lủng củng (động từ chồng chất, tính từ xâu chuỗi vô nghĩa) thành câu tiếng Việt tự nhiên; (5) trả về CHỈ đoạn văn, không lời dẫn, không markdown rào.',
        toneNote ? `TÔNG TRUYỆN cần bám: ${toneNote}` : '',
      ].filter(Boolean).join('\n'),
    },
    { role: 'user', content: text },
  ], { temperature: 0.4, maxTokens: 4000 })
  const out = (reply ?? '').trim()
  // Sanity: kết quả rỗng hoặc ngắn bất thường (<50% gốc) → coi như hỏng, giữ bản gốc.
  if (!out || out.length < text.length * 0.5) return text
  return out
}
