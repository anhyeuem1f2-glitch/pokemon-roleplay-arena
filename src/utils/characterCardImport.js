// Đọc character card từ file .json hoặc .png (chuẩn SillyTavern/TavernAI V1/V2).
//
// - .json: đọc thẳng, hỗ trợ cả dạng "phẳng" (V1: {name, description, ...})
//   lẫn dạng bọc (V2: {spec: "chara_card_v2", data: {name, description, ...}}).
// - .png: theo chuẩn card V2, dữ liệu JSON (base64) được nhúng trong chunk
//   tEXt với keyword "chara". Hàm bên dưới tự đọc byte PNG để tìm chunk đó,
//   không cần thư viện ngoài.
//
// Giới hạn hiện tại: chỉ đọc chunk tEXt (không nén). Nếu card dùng chunk zTXt
// (nén zlib) sẽ báo lỗi rõ ràng thay vì im lặng thất bại.

function normalizeLorebook(raw) {
  const data = raw?.data && typeof raw.data === 'object' ? raw.data : raw
  const book = data.character_book ?? data.world_info ?? null
  const rawEntries = book?.entries
  if (!rawEntries) return []

  // character_book.entries có thể là mảng hoặc object {id: entry} tuỳ bản export.
  const list = Array.isArray(rawEntries) ? rawEntries : Object.values(rawEntries)

  return list
    .map((e) => ({
      name: e.name ?? e.comment ?? '',
      keys: e.keys ?? e.key ?? [],
      content: e.content ?? e.value ?? '',
      enabled: e.enabled !== false && e.disable !== true,
    }))
    .filter((e) => e.enabled && e.content)
    .map(({ name, keys, content }) => ({
      name: String(name).trim(),
      keys: (Array.isArray(keys) ? keys : String(keys).split(',')).map((k) => String(k).trim()).filter(Boolean),
      content: String(content).trim(),
    }))
}

function normalizeCardData(raw) {
  const data = raw?.data && typeof raw.data === 'object' ? raw.data : raw
  return {
    name: data.name ?? '',
    description: data.description ?? '',
    personality: data.personality ?? '',
    scenario: data.scenario ?? '',
    first_mes: data.first_mes ?? data.first_message ?? '',
    mes_example: data.mes_example ?? '',
    lorebook: normalizeLorebook(raw),
  }
}

async function parseJsonFile(file) {
  const text = await file.text()
  let raw
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('File JSON không hợp lệ (parse thất bại).')
  }
  return normalizeCardData(raw)
}

// Đọc các chunk của 1 file PNG, trả về mảng {type, data(Uint8Array)}.
function readPngChunks(buffer) {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== signature[i]) {
      throw new Error('File không phải PNG hợp lệ.')
    }
  }
  const chunks = []
  let offset = 8
  while (offset < bytes.length) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8))
    const dataStart = offset + 8
    const data = bytes.slice(dataStart, dataStart + length)
    chunks.push({ type, data })
    offset = dataStart + length + 4 // +4 bỏ qua CRC
    if (type === 'IEND') break
  }
  return chunks
}

// Chunk tEXt: "keyword\0text" (Latin-1). Card V2 lưu keyword "chara", value là base64(JSON).
// QUAN TRỌNG: không dùng String.fromCharCode(...bytes) với spread — card có
// lorebook lớn (chunk hàng trăm KB) sẽ vượt giới hạn số đối số của hàm và ném
// RangeError (Maximum call stack size exceeded). Dùng TextDecoder latin1
// (giải mã 1-byte-1-ký-tự, đúng spec tEXt của PNG) an toàn với mọi kích thước.
const latin1 = new TextDecoder('latin1')
function decodeTextChunk(data) {
  let nullIndex = data.indexOf(0)
  if (nullIndex === -1) nullIndex = data.length
  const keyword = latin1.decode(data.slice(0, nullIndex))
  const value = latin1.decode(data.slice(nullIndex + 1))
  return { keyword, value }
}

async function parsePngFile(file) {
  const buffer = await file.arrayBuffer()
  const chunks = readPngChunks(buffer)

  const textChunk = chunks.find((c) => {
    if (c.type !== 'tEXt') return false
    const { keyword } = decodeTextChunk(c.data)
    return keyword.toLowerCase() === 'chara'
  })

  if (!textChunk) {
    const hasCompressed = chunks.some((c) => c.type === 'zTXt' || c.type === 'iTXt')
    if (hasCompressed) {
      throw new Error(
        'Ảnh này nhúng dữ liệu ở dạng nén (zTXt/iTXt), phiên bản hiện tại chưa hỗ trợ giải nén. Hãy thử xuất card ra .json thay vì .png.',
      )
    }
    throw new Error('Không tìm thấy dữ liệu character card ("chara") trong file PNG này.')
  }

  const { value } = decodeTextChunk(textChunk.data)
  // atob() trả về "binary string" (mỗi ký tự = 1 byte thô). JSON trong card
  // được mã hoá UTF-8, nên PHẢI chuyển binary string → mảng byte → giải mã
  // UTF-8 thật. Bug cũ: JSON.parse(atob(...)) trực tiếp khiến mọi ký tự
  // ngoài ASCII (tiếng Việt có dấu, emoji, tiếng Nhật...) trong card .png bị
  // vỡ font (mojibake) sau khi import.
  let json
  try {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    json = new TextDecoder('utf-8').decode(bytes)
  } catch {
    throw new Error('Không giải mã được base64 trong chunk "chara".')
  }
  let raw
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('Dữ liệu giải mã được không phải JSON hợp lệ.')
  }
  return normalizeCardData(raw)
}

/**
 * Đọc 1 File (từ <input type="file">) và trả về object character card
 * chuẩn hoá: { name, description, personality, scenario, first_mes, mes_example }.
 */
export async function importCharacterCard(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'json') return parseJsonFile(file)
  if (ext === 'png') return parsePngFile(file)
  throw new Error('Chỉ hỗ trợ file .json hoặc .png.')
}
