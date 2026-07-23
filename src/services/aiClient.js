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
export async function chatCompletion(config, messages, options = {}) {
  const { baseUrl, apiKey, model } = config
  if (!baseUrl || !model) {
    throw new Error('Thiếu Base URL hoặc Model. Hãy vào mục Cài đặt API trước.')
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`
  const temperature = options.temperature ?? config.temperature ?? 0.9
  // max_tokens mặc định nâng lên 1024: một số proxy (VD Gemini chạy qua lớp
  // tương thích OpenAI) tính cả phần "suy nghĩ" (reasoning/thinking tokens)
  // vào max_tokens — để quá thấp (như 400) dễ khiến phần nội dung hiển thị
  // bị rỗng dù request vẫn "thành công".
  const maxTokens = options.maxTokens ?? config.maxTokens ?? 1024

  // Assistant prefill: mồi trước 1 đoạn text coi như AI đã bắt đầu trả lời,
  // model chỉ cần viết TIẾP thay vì tự quyết định có mở đầu thế nào/có nên
  // trả lời hay không. Cách làm: thêm 1 message role "assistant" vào CUỐI
  // mảng messages. Lưu ý: đây không phải chuẩn chính thức của OpenAI chat
  // completions (OpenAI sẽ bỏ qua hoặc báo lỗi nếu bắt buộc kết thúc bằng
  // user) — nhưng nhiều proxy Gemini/Claude-compatible (kể cả API Anthropic
  // thật) hỗ trợ tốt kỹ thuật này. Tuỳ provider mà có hiệu quả hay không.
  const prefill = options.assistantPrefill?.trim()
  const finalMessages = prefill ? [...messages, { role: 'assistant', content: prefill }] : messages

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
        messages: finalMessages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: options.signal,
    })
  } catch (networkErr) {
    throw new Error(`Không gọi được tới API (lỗi mạng/CORS): ${networkErr.message}`)
  }

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

  if (!text || !text.trim()) {
    const reason = choice?.finish_reason ? ` (finish_reason: ${choice.finish_reason})` : ''
    throw new Error(
      `API trả về phản hồi rỗng${reason}. Thử tăng "Max tokens" trong Cài đặt API (mục Nâng cao), ` +
        `hoặc đổi sang model khác — có thể model/proxy này chưa tương thích hoàn toàn chuẩn OpenAI.`,
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
  const { baseUrl, apiKey } = config
  const url = `${baseUrl.replace(/\/+$/, '')}/models`
  const res = await fetch(url, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  })
  if (!res.ok) {
    throw new Error(`Không kết nối được (${res.status} ${res.statusText})`)
  }
  return true
}

/**
 * Lấy danh sách model khả dụng từ endpoint GET /models (chuẩn OpenAI-compatible).
 * Trả về mảng string id model, đã sắp xếp. Ném lỗi nếu provider không hỗ trợ
 * endpoint này hoặc trả sai định dạng.
 */
export async function listModels(config) {
  const { baseUrl, apiKey } = config
  const url = `${baseUrl.replace(/\/+$/, '')}/models`
  const res = await fetch(url, {
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
