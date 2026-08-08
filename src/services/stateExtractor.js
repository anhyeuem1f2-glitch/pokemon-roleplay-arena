// ============ API CẬP NHẬT BIẾN (đợt 36) ============
// Model chính đôi khi QUÊN khai tag trạng thái ([[MONEY]], [[POKEMON]],
// [[HUNGER]], [[DATE]], [[NPC]], [[FACT]], [[REL]]...) dù chính văn mô tả rõ
// sự việc — biến "đứng yên" dù truyện đã đổi. Giải pháp: một API PHỤ (cấu
// hình riêng trong Cài đặt, có nút Tải model) đọc lại chính văn + danh sách
// tag ĐÃ áp, và CHỈ xuất bổ sung những tag còn thiếu. Kết quả được parse
// bằng đúng parseStoryStateTags rồi áp qua đúng pipeline — không có đường
// cập nhật riêng nào khác.

import { chatCompletion } from './aiClient.js'

const BASE_SYSTEM = `Bạn là bộ trích xuất TRẠNG THÁI cho một game nhập vai Pokémon. Nhiệm vụ: đọc CHÍNH VĂN của lượt kể và DANH SÁCH TAG ĐÃ ÁP, rồi xuất BỔ SUNG các tag còn thiếu cho những thay đổi RÕ RÀNG trong văn bản.

Các tag hợp lệ (mỗi tag 1 dòng, đúng cú pháp, không thêm gì khác):
[[MONEY +500]] hoặc [[MONEY -200]] — tiền người chơi thay đổi (mua bán, thưởng, mất).
[[REL Tên=+5 | lý do ngắn]] — quan hệ với NPC thay đổi.
[[BODY leftArm=+10]] — thương tích cơ thể tăng/giảm, chỉ khi chính văn mô tả đúng bộ phận.
[[POKEMON Tên loài tiếng Anh | Lv7 | giới tính=cái]] — người chơi THẬT SỰ nhận/bắt/mua được Pokémon MỚI trong lượt này. Nếu chính văn nói đực/cái/vô giới tính thì BẮT BUỘC giữ đúng ở field giới tính; không rõ mới được bỏ field để app roll theo loài. Gồm cả giao dịch chuyển Pokémon qua PC/Box khi hệ thống đã xác nhận giao hàng và nhân vật đã lấy Poké Ball. Không dùng khi mới hẹn “sẽ gửi”, chưa nhận hàng, hoặc để báo Pokémon cũ lên cấp/tiến hoá. Nếu chỉ lấy được Poké Ball chưa biết nội dung/tình trạng, chưa xuất POKEMON: xuất [[ITEM Poké Ball chưa xác định | 1]] và FACT về nguồn gốc. Chỉ sau khi mở/kiểm tra xác định loài mới xuất POKEMON; app tự tiêu thụ bóng chưa xác định. Nếu xác nhận bóng trống còn dùng được, xuất ITEM bóng chưa xác định -1 và ITEM Poké Ball +1; nếu hỏng/bị trả/bị tịch thu thì chỉ trừ bóng chưa xác định.
[[EVOLVE Tên hiện tại | Tên sau tiến hoá]] — Pokémon đang sở hữu tiến hoá; đây là cùng cá thể, không phải nhận thêm con mới.
[[LEVEL Tên Pokémon | +1]] hoặc [[LEVEL Tên Pokémon | Lv11]] — Pokémon đang sở hữu tăng cấp trực tiếp do Kẹo Hiếm/năng lực; không dùng cho EXP trận thường hay luyện tập.
[[FRIEND Tên Pokémon | +5 | lý do]] — độ thân mật thay đổi khi chính văn thể hiện rõ niềm tin/gắn bó tăng hoặc giảm; không cộng cho tương tác xã giao.
[[ITEM Tên vật phẩm | số lượng]] — nhận/mất vật phẩm; số âm là mất. Gồm cả vật đã nhặt/trộm/cuỗm thành công. Giữ đúng số lượng chính văn xác nhận. Poké Ball đang chứa Pokémon chưa rõ loài phải ghi đúng [[ITEM Poké Ball chưa xác định | 1]], không coi là bóng rỗng. Khi chính văn liệt kê chính xác các món đã mua rồi xác nhận thanh toán/đóng gói, xuất một ITEM đúng tên + đúng số lượng cho từng món; KHÔNG gom giao dịch mua sắm thành LOOT vì LOOT sinh đồ ngẫu nhiên. Nếu Kẹo Hiếm hữu hạn được dùng thì đi cùng [[LEVEL]], còn Kẹo Hiếm vô hạn thì không trừ.
[[EQUIP Tên Pokémon | Tên held item]] — Pokémon đã thực sự được cho cầm trang bị đang có trong túi; EQUIP tự trừ 1 món nên không kèm [[ITEM ... | -1]] cho cùng hành động. [[UNEQUIP Tên Pokémon]] — đã tháo/cất trang bị. Không dùng EQUIP cho Key Stone/Z-Ring/Dynamax Band/Tera Orb vì đó là thiết bị của huấn luyện viên.
[[SHOP Tên cửa hàng | loại=... | quy mô=...]] — CHỈ khi nhân vật đã bước vào bên trong và lượt dừng để mua.
[[LOOT loại=đá quý | quy mô=nhỏ/vừa/lớn]] — nhân vật đã THỰC SỰ vơ vét/thu được một lô đồ không thể liệt kê từng món; không dùng cho ý định, đồ chưa lấy được hoặc hàng mua tại cửa hàng.
[[POKECENTER Tên trung tâm]] — CHỈ khi nhân vật đang ở bên trong Trung tâm Pokémon.
[[HUNGER người+25]] / [[HUNGER pokemon+30]] — ăn uống (cộng) hoặc đói lả/lao lực rõ (trừ).
[[DATE +1]] — số ngày đã trôi; [[DATE buổi=tối]] — chuyển buổi trong ngày.
[[TRAIN 1]] / [[TRAIN 2]] / [[TRAIN 3]] — có cảnh luyện tập chủ đích, không dùng cho đi đường/đánh trận thường.
[[MOVE Tên khu vực]] hoặc [[MOVE Tên khu vực | x=42 | y=58]] — nhân vật thực sự đổi vị trí; x/y là phần trăm bản đồ, chỉ thêm khi chính văn xác định đủ rõ.
[[NPC Tên | tuổi=.. | nghề=.. | đội=.. | ghi chú=..]] — NPC có tên xuất hiện lần đầu / lộ thông tin mới.
[[FACT Từ khoá | nội dung ngắn]] — sự kiện/lời hứa/mốc quan trọng cần nhớ.
[[BADGE Tên | region=... | gym=... | leader=...]] — huy hiệu chính thức đã được trao.
[[QUEST mã | status=active|completed|failed|paused | title=... | giver=... | objective=... | reward=...]] — nhật ký nhiệm vụ.
[[REP Tên phe=+5 | lý do]] — danh tiếng với phe phái, không dùng thay REL cá nhân.
[[WANTED +1 | region=... | reason=... | bounty=500]] — mức truy nã thay đổi vì hành vi pháp lý rõ ràng.
[[LEGENDARY_ACCESS Tên loài | reason=điều kiện cụ thể]] — chỉ khi chính văn đã hoàn tất điều kiện triệu hồi/cuộc gặp huyền thoại; không dùng vì số huy hiệu/nhiệm vụ hay lời tuyên bố của người chơi.
[[RIBBON Tên Pokémon | Tên Ribbon]] / [[MARK Tên Pokémon | Tên Mark]] — giải/dấu ấn thật sự được trao. Không có tag đổi Shiny.

QUY TẮC:
- Xuất tag cho MỌI thay đổi đã xuất hiện/hoàn tất trong chính văn, kể cả được diễn đạt gián tiếp, dùng đại từ, tên gọi rút gọn, nằm cách nhau nhiều câu hoặc nhiều đoạn. Không đòi một câu máy móc chứa đồng thời tên + động từ + kết quả. Chỉ không áp ý định/lời hứa chưa xảy ra, phủ định, suy nghĩ, hoặc chi tiết chỉ nằm trong input người chơi mà chính văn chưa tiếp nhận.
- KHÔNG có trần số tag hay số mặt hàng: mua/nhận 5, 10 hoặc nhiều món thì xuất đủ một ITEM cho từng món; nhiều sự kiện khác cũng phải xuất đủ, không dừng giữa danh sách.
- KHÔNG lặp lại thay đổi đã nằm trong danh sách tag đã áp. Với các biến chấm điểm/đơn trạng thái FRIEND, REL, BODY, HUNGER, LEVEL và REP: nếu ledger đã có cùng TARGET trong lượt này thì coi sự kiện đó ĐÃ XỬ LÝ, không đề xuất lại chỉ vì bạn muốn chọn một delta khác. Với MONEY/ITEM có thể có nhiều giao dịch vật lý độc lập, chỉ bổ sung khi evidence chứng minh đó là sự kiện khác thật.
- MONEY phải phân biệt GIÁ/Ý ĐỊNH với GIAO DỊCH ĐÃ XONG. Chỉ xuất MONEY khi canon cho thấy tiền thực sự vào/ra: đã trả/thanh toán/quẹt thẻ/chuyển khoản/nhận thưởng/ghi có/bị trừ, hoặc có số dư trước→sau đủ để tính delta. Một câu chỉ báo giá/niêm yết/“sẽ mua” không được đổi tiền. Nếu chính văn có “tổng cộng/thành tiền/hóa đơn” ở câu trước và “thanh toán thành công” ở câu sau, phải nối chúng thành cùng một giao dịch. Nếu có số dư trước và sau, delta = số dư sau - số dư trước. KHÔNG lấy nhầm số dư còn lại, level, số lượng món hay số Route làm số tiền.
- Với MONEY, ưu tiên đúng TỔNG giao dịch thay vì đơn giá. Không nhân số lượng bằng phỏng đoán nếu chính văn không xác nhận tổng hoặc số dư; app có validator riêng và sẽ bác số không chứng minh được.
- Nếu chính văn nói một Pokémon CŨ lên cấp, bắt buộc dùng [[LEVEL]], tuyệt đối không đổi thành [[POKEMON]].
- Nếu chính văn nói Pokémon tiến hoá, bắt buộc dùng [[EVOLVE tên cũ | tên mới]]. Nếu đồng thời lên cấp, xuất LEVEL tên cũ trước rồi EVOLVE; tuyệt đối không dùng POKEMON tên mới vì sẽ làm phân thân.
- Không có gì để bổ sung → trả về đúng chuỗi: KHONG_CO.`

const STRUCTURED_OUTPUT = `
ĐỊNH DẠNG KIỂM CHỨNG BẮT BUỘC:
- Nếu có thay đổi, KHÔNG trả tag trần. Trả đúng một khối <STATE_PATCH> chứa JSON hợp lệ:
<STATE_PATCH>
{"proposals":[{"tag":"[[MONEY -200]]","evidence":"trích nguyên văn liên tục từ CHÍNH VĂN chứng minh giao dịch đã hoàn tất"}]}
</STATE_PATCH>
- Mỗi proposal phải có đúng 1 tag và 1 evidence. evidence phải là đoạn TRÍCH NGUYÊN VĂN LIÊN TỤC từ CHÍNH VĂN lượt này, đủ để chứng minh sự kiện đã xảy ra; không được chép từ INPUT người chơi hay tự diễn giải. Có thể trích nhiều câu liên tiếp nếu sự kiện trải qua nhiều câu.
- Nếu cùng một tag/delta xảy ra hai lần thật, xuất hai proposal với hai evidence khác nhau.
- evidence nên là đoạn ngắn nhất đủ chứng minh, ưu tiên 1-2 câu liên tục và không dài quá khoảng 260 ký tự để lượt nhiều biến không phình JSON.
- App kiểm tra anchor nguyên văn trước, rồi vẫn bắt buộc chạy semantic validator theo chính văn; đừng dựa vào việc quote sai để lách validator.
- Không markdown, không giải thích ngoài KHONG_CO hoặc khối <STATE_PATCH>.`

function buildSystem(scanMode = 'extractor', focus = null) {
  const role = scanMode === 'auditor'
    ? `VAI TRÒ LƯỢT NÀY — AUDITOR: coi TAG ĐÃ ÁP là ledger đã commit. Rà lại TỪ ĐẦU ĐẾN CUỐI chính văn theo checklist MONEY, REL, BODY, POKEMON, EVOLVE, LEVEL, FRIEND, ITEM, EQUIP/UNEQUIP, SHOP, LOOT, POKECENTER, HUNGER, DATE, TRAIN, MOVE, NPC, FACT, BADGE, QUEST, REP, WANTED, LEGENDARY_ACCESS, RIBBON/MARK. Chỉ đề xuất phần CÒN THIẾU; đặc biệt tìm các sự kiện diễn đạt gián tiếp/nhiều câu mà extractor trước có thể bỏ sót.`
    : `VAI TRÒ LƯỢT NÀY — EXTRACTOR: rà toàn bộ chính văn một lượt theo mọi loại state, ưu tiên độ bao phủ nhưng tuyệt đối không suy diễn ngoài điều đã hoàn tất trong văn.`
  const focusNote = focus?.types?.length
    ? `\n\nTRỌNG TÂM PASS NÀY — ${focus.label ?? focus.id ?? 'nhóm biến'}: chỉ rà kỹ các loại ${focus.types.join(', ')}. Bỏ qua loại ngoài nhóm, vì pass khác chịu trách nhiệm. Trong nhóm này phải xuất ĐỦ mọi thay đổi còn thiếu, không dừng ở 1-2 proposal.`
    : ''
  return `${BASE_SYSTEM}\n\n${role}${focusNote}\n${STRUCTURED_OUTPUT}`
}

function normalizeEvidenceAnchor(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('vi-VN')
    .replace(/[“”„‟«»‹›"'`*_~>#|()[\]{}]/g, ' ')
    .replace(/[—–−-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isValidStateTag(tag) {
  return /^\[\[[\s\S]+\]\]$/.test(String(tag ?? '').trim())
}

// JSON do model sinh có thể hỏng ở dấu phẩy/ngoặc cuối khi response dài.
// Cứu từng object proposal HOÀN CHỈNH thay vì vứt cả batch. Prompt cố định
// thứ tự tag -> evidence, nên regex string-literal này đủ an toàn và vẫn giữ
// escape JSON; candidate cứu được còn phải qua semantic validator của app.
function salvageProposalObjects(raw) {
  const source = String(raw ?? '')
  const out = []
  const re = /\{\s*"tag"\s*:\s*("(?:\\.|[^"\\])*")\s*,\s*"evidence"\s*:\s*("(?:\\.|[^"\\])*")\s*\}/g
  let match
  while ((match = re.exec(source)) !== null) {
    try {
      const tag = JSON.parse(match[1])
      const evidence = JSON.parse(match[2])
      out.push({ tag, evidence })
    } catch {
      // Một object lỗi không được kéo chết các object còn lại.
    }
  }
  return out
}

function extractLooseTags(raw) {
  return [...String(raw ?? '').matchAll(/\[\[[\s\S]*?\]\]/g)]
    .map((match) => match[0].replace(/\s+/g, ' ').trim())
    .filter(isValidStateTag)
}

function validatePatchProposals(proposals, storyText, { structured = true, malformed = false, salvaged = false } = {}) {
  const haystack = normalizeEvidenceAnchor(storyText)
  const accepted = []
  let evidenceRejected = 0
  let hardRejected = 0
  let anchoredCount = 0

  const allowSemanticFallback = malformed || (proposals ?? []).length >= 4
  for (const proposal of proposals ?? []) {
    const tag = String(proposal?.tag ?? '').replace(/\s+/g, ' ').trim()
    const evidence = String(proposal?.evidence ?? '').trim()
    if (!isValidStateTag(tag)) {
      hardRejected += 1
      continue
    }
    const needle = normalizeEvidenceAnchor(evidence)
    const tokenCount = needle.split(/\s+/).filter(Boolean).length
    const anchored = needle.length >= 8 && tokenCount >= 2 && haystack.includes(needle)
    if (anchored) {
      anchoredCount += 1
      accepted.push({ tag, evidence, evidenceAnchored: true })
      continue
    }

    evidenceRejected += 1
    // Với batch nhỏ, giữ chốt fail-closed đợt 99: một proposal hallucination
    // đơn lẻ không có quote thật bị loại ngay. Với batch >=4 hoặc JSON đã
    // hỏng/truncated, quote lệch rất thường do model quá tải; lúc đó chỉ cứu
    // TAG hoàn chỉnh và bắt buộc giao cho semantic validator kiểm tra tiếp.
    if (allowSemanticFallback) accepted.push({ tag, evidence, evidenceAnchored: false })
  }

  return {
    tagsText: accepted.length ? accepted.map((proposal) => proposal.tag).join('\n') : null,
    proposals: accepted,
    structured,
    malformed,
    salvaged,
    proposedCount: (proposals ?? []).length,
    evidenceRejected,
    evidenceAnchoredCount: anchoredCount,
    evidenceFallbackCount: Math.max(0, accepted.length - anchoredCount),
    hardRejected,
  }
}

export function parseStatePatchResponse(reply, storyText = '') {
  const text = (reply ?? '').trim()
  if (!text || text === 'KHONG_CO') {
    return {
      tagsText: null, proposals: [], structured: false, proposedCount: 0,
      evidenceRejected: 0, evidenceAnchoredCount: 0, evidenceFallbackCount: 0, hardRejected: 0,
    }
  }

  const open = text.match(/<STATE_PATCH>\s*/i)
  if (open) {
    const bodyStart = (open.index ?? 0) + open[0].length
    const tail = text.slice(bodyStart)
    const closeAt = tail.search(/\s*<\/STATE_PATCH>/i)
    const body = (closeAt >= 0 ? tail.slice(0, closeAt) : tail).trim()
    try {
      const payload = JSON.parse(body)
      const proposals = Array.isArray(payload?.proposals) ? payload.proposals : []
      return validatePatchProposals(proposals, storyText, { structured: true })
    } catch (error) {
      const salvaged = salvageProposalObjects(body)
      if (salvaged.length) {
        console.warn(`[state-api] STATE_PATCH JSON lỗi, đã cứu ${salvaged.length} proposal hoàn chỉnh:`, error.message)
        return validatePatchProposals(salvaged, storyText, { structured: true, malformed: true, salvaged: true })
      }

      // Cuối cùng vẫn giữ các tag hoàn chỉnh đã sinh trước điểm JSON gãy.
      // Không có evidence anchor nên semantic validator trở thành cổng bắt buộc.
      const tags = extractLooseTags(body)
      console.warn(`[state-api] STATE_PATCH JSON lỗi, fallback ${tags.length} tag hoàn chỉnh:`, error.message)
      return {
        tagsText: tags.length ? tags.join('\n') : null,
        proposals: tags.map((tag) => ({ tag, evidence: '', evidenceAnchored: false })),
        structured: true,
        malformed: true,
        salvaged: tags.length > 0,
        proposedCount: tags.length,
        evidenceRejected: tags.length,
        evidenceAnchoredCount: 0,
        evidenceFallbackCount: tags.length,
        hardRejected: 0,
      }
    }
  }

  // Tương thích provider/model cũ chưa theo format mới: nhận mọi tag hoàn
  // chỉnh rồi để semantic validator app quyết định. Không có giới hạn số tag.
  const tagLines = extractLooseTags(text)
  return {
    tagsText: tagLines.length ? tagLines.join('\n') : null,
    proposals: tagLines.map((tag) => ({ tag, evidence: '', evidenceAnchored: false })),
    structured: false,
    proposedCount: tagLines.length,
    evidenceRejected: 0,
    evidenceAnchoredCount: 0,
    evidenceFallbackCount: tagLines.length,
    hardRejected: 0,
  }
}

/**
 * Gọi API cập nhật biến. Mặc định trả về chuỗi tag bổ sung để tương thích
 * code cũ; `returnDetails=true` trả thêm metadata evidence-anchor cho audit.
 * @param {{baseUrl,apiKey,model}} cfg
 * @param {{storyText: string, appliedTags: object, hasPokemon: boolean}} params
 */
export async function extractMissingStateTags(cfg, { storyText, appliedTags, hasPokemon, userText = '', contextNote = '', stateSnapshot = null, scanMode = 'extractor', focus = null, returnDetails = false }) {
  if (!storyText?.trim()) return null
  const applied = JSON.stringify(appliedTags)
  const user = [
    // Đợt 50: kèm INPUT người chơi để đối chiếu — người chơi có thể viết SAI
    // CHÍNH TẢ tên Pokémon/nhân vật; phải hiểu theo ngữ cảnh và luôn khai
    // tag bằng TÊN CHUẨN (VD người chơi gõ "chamnder" → tag dùng Charmander).
    contextNote.trim() ? `${contextNote.trim()}\n` : '',
    stateSnapshot ? `STATE HIỆN TẠI TRƯỚC KHI BỔ SUNG (chỉ dùng để phân biệt tài sản/Pokémon cũ với thứ mới trong chính văn; không tự sửa state vì snapshot):\n${JSON.stringify(stateSnapshot)}\n` : '',
    userText.trim() ? `INPUT NGƯỜI CHƠI LƯỢT NÀY (có thể sai chính tả — hiểu theo ngữ cảnh, tag dùng tên CHUẨN):\n${userText}\n` : '',
    `CHÍNH VĂN LƯỢT NÀY:\n${storyText}`,
    '',
    `TAG ĐÃ ÁP (không lặp lại): ${applied}`,
    `Người chơi ${hasPokemon ? 'ĐÃ có Pokémon' : 'CHƯA có Pokémon nào'}.`,
    '',
    'Xuất các tag còn thiếu (hoặc KHONG_CO):',
  ].join('\n')

  const reply = await chatCompletion(cfg, [
    { role: 'system', content: buildSystem(scanMode, focus) },
    { role: 'user', content: user },
  ], { temperature: 0, maxTokens: 8192 })

  const result = parseStatePatchResponse(reply, storyText)
  return returnDetails ? result : result.tagsText
}
