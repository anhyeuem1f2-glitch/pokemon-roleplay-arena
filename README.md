# Trainer Arena — Roleplay × Battle Engine

Web app roleplay dạng đọc truyện liên tục (không chia tab), người chơi tự nhập
API key (chuẩn OpenAI-compatible). Khi AI kể tới đoạn nhân vật chính bị thách
đấu, một quả pokeball hiện ngay dưới dòng chữ đó — bấm vào mới mở modal hình
vuông chứa màn hình chiến đấu (sprite lấy từ Pokémon Showdown). Chiến đấu xong,
kết quả (thắng/thua) được gửi ngược lại cho AI để viết tiếp câu chuyện.

Đây là bản khung (scaffold) tập trung vào phần **API + luồng dữ liệu + cơ chế
trigger chiến đấu trong dòng truyện**. Công thức chiến đấu đang ở mức đơn giản
để bạn test luồng tổng thể trước, sau đó nâng cấp dần theo hướng dẫn bên dưới.

## Cách hoạt động của cơ chế "quả pokeball trong truyện"

1. System prompt yêu cầu AI chèn chính xác chuỗi `[[BATTLE]]` vào cuối tin nhắn
   ngay khi nhân vật chính chuẩn bị vào trận, thay vì tự viết diễn biến trận đấu.
2. `RoleplayChat.jsx` tách nội dung tin nhắn tại vị trí `[[BATTLE]]`, chèn nút
   pokeball (component `PokeballTrigger`) vào đúng chỗ đó.
3. Bấm vào pokeball → mở `BattleModal.jsx` (overlay hình vuông, giữa màn hình).
4. Chiến đấu xong, `BattleModal` gọi `onBattleEnd(didWin)` → `RoleplayChat` gửi
   một tin nhắn ẩn (`hidden: true`, không hiện bong bóng chat, chỉ hiện dải nhỏ
   "⚔ Kết quả trận đấu: Thắng/Thua") cho AI, AI viết tiếp câu chuyện dựa theo đó.

**Giới hạn hiện tại (đã ghi trong roadmap để nâng cấp sau):** AI chỉ viết tiếp
*sau khi* biết kết quả, nghĩa là người chơi phải đợi 1 lượt gọi API sau khi
chiến đấu xong. Muốn tối ưu độ trễ như đã bàn (2 API viết trước song song 2
tuyến thắng/thua ngay khi mở trận, chỉ chọn tuyến theo kết quả) thì cần thêm
một bước: gọi `chatCompletion` 2 lần song song ngay khi `battleOpen` chuyển
`true`, lưu cả 2 kết quả vào state, và ở `handleBattleEnd` chỉ cần lấy tuyến
tương ứng ra dùng luôn (không gọi API nữa).

## Về sprite Pokémon Showdown

`MonAvatar.jsx` hotlink ảnh động từ `play.pokemonshowdown.com/sprites/...`
(species slug viết thường, VD `charmander`, `bulbasaur`). Đây là kho sprite
fan-made công khai, dùng tốt cho personal project, nhưng:
- Nếu server đó chậm/đổi cấu trúc, sprite sẽ không hiện — component đã có
  fallback về hình tròn chữ cái đầu khi ảnh lỗi (`onError`).
- Muốn ổn định lâu dài, nên tải sprite cần dùng về, để trong `public/sprites/`
  và đổi `spriteUrl()` trong `MonAvatar.jsx` trỏ về file local.

## Cài đặt & chạy thử

```bash
npm install
npm run dev
```

Mở trình duyệt tại địa chỉ Vite in ra (mặc định `http://localhost:5173`).

## Cấu trúc thư mục

```
src/
  components/
    ApiSetup.jsx        # Form nhập baseUrl / apiKey / model
    RoleplayChat.jsx     # Character card + khung chat + parse marker [[BATTLE]]
    BattleModal.jsx       # Overlay hình vuông chứa màn hình chiến đấu
    MonAvatar.jsx          # Sprite Pokémon (Showdown) + fallback
    HealthBar.jsx        # Thanh HP
    TypeBadge.jsx        # Nhãn hệ (type) Pokémon
  context/
    GameContext.jsx      # State toàn cục: apiConfig, character, messages, battle
  services/
    aiClient.js          # Gọi API OpenAI-compatible (chat/completions, test connection)
  data/
    pokemonTypes.js       # 18 hệ + bảng tương khắc đầy đủ (effectiveness chart)
    sampleData.js         # Character card mẫu + 2 Pokémon mẫu để test battle
```

## Về việc dùng API key của người chơi

- Hỗ trợ **bất kỳ provider nào tương thích chuẩn OpenAI** `/v1/chat/completions`:
  OpenAI, OpenRouter, Groq, hoặc server local (LM Studio, text-generation-webui,
  Ollama qua proxy OpenAI-compatible...).
- Key được lưu trong `localStorage` của trình duyệt người chơi, **không** đi qua
  server trung gian nào của bạn — gọi thẳng từ browser tới provider.
- Với server local, có thể cần bật CORS ở phía server đó để trình duyệt gọi được.
- Muốn hỗ trợ thêm Anthropic (Claude) trực tiếp từ browser: API của Anthropic cần
  header `anthropic-dangerous-direct-browser-access: true` và có giới hạn CORS
  tuỳ theo trình duyệt/triển khai — nên cân nhắc test kỹ hoặc đi qua một backend
  nhỏ (proxy) nếu muốn ổn định.

## Roadmap gợi ý để phát triển tiếp

**Chiến đấu (đang đơn giản, cần nâng lên "đầy đủ" như bạn muốn):**
- Thêm stat đầy đủ: HP/Atk/Def/SpAtk/SpDef/Speed, IV/EV nếu muốn đúng chuẩn.
- Công thức sát thương chuẩn Pokémon (STAB, crit, random 85–100%, weather...).
- Trạng thái (burn, poison, paralysis, sleep, freeze...) và hiệu ứng theo lượt.
- Item cầm tay, ability, thứ tự hành động theo Speed thay vì luôn "người chơi
  trước".
- Animation tấn công/né đòn, hiệu ứng particle khi trúng đòn (có thể dùng
  CSS keyframes hoặc thư viện như Framer Motion).
- Sprite thật thay cho `MonAvatar` placeholder hiện tại (thư mục `public/sprites/`).

**Roleplay:**
- Streaming response (dùng `stream: true` trong request + đọc SSE) để chữ hiện
  dần như ChatGPT/SillyTavern, thay vì đợi cả câu trả lời.
- Nhiều character card, import/export JSON (hoặc PNG embed metadata như
  SillyTavern V2 card spec) để tái sử dụng card bạn đã làm.
- Lorebook / World Info: chèn thêm ngữ cảnh vào system prompt dựa theo từ khoá
  xuất hiện trong hội thoại.
- Regex script, quick reply, group chat nếu muốn bám sát tính năng SillyTavern.

**Kết nối roleplay ↔ chiến đấu:**
- Cho AI roleplay mô tả trận đấu bằng lời (narrate), rồi khi "vào trận" thật thì
  chuyển sang `BattleModal` — cơ chế này **đã làm** qua marker `[[BATTLE]]`,
  xem mục "Cách hoạt động của cơ chế quả pokeball trong truyện" phía trên.
  Bước tiếp theo hợp lý: cho marker mang theo dữ liệu (VD `[[BATTLE:enemy_id]]`)
  để chọn đúng Pokémon đối thủ thay vì luôn dùng dữ liệu mẫu cố định.

## Lưu ý bảo mật

Vì đây là ứng dụng chạy hoàn toàn phía client (không backend), API key nằm
trong `localStorage` của máy người chơi. Nếu triển khai public, nên nhắc người
dùng không dùng chung máy/tài khoản để tránh lộ key.

## Cập nhật mới (đợt 2)

**Tải danh sách model:** nút "Tải danh sách model" trong Cài đặt API gọi
`GET /models` (chuẩn OpenAI-compatible), hiện dropdown để chọn thay vì phải
gõ tay tên model.

**Cài đặt nâng cao (temperature / max tokens):** nếu API báo "phản hồi rỗng"
liên tục, khả năng cao proxy bạn dùng (VD proxy Gemini) tính cả phần suy nghĩ
nội bộ vào `max_tokens` — thử tăng giá trị này lên (1500–2048) trong mục Cài
đặt API → Cài đặt nâng cao.

**Menu chiến đấu kiểu Pokémon cổ điển:** `BattleModal.jsx` giờ có menu chính
FIGHT / BAG / POKÉMON / RUN thay vì chỉ hiện 4 chiêu thức thẳng. BAG và
POKÉMON hiện là placeholder (chưa có hệ thống item/đội hình thật). RUN hiện
luôn khả dụng vì hệ thống chưa phân biệt được trận hoang dã và trận đấu với
NPC/trainer — khi nào phân biệt được, truyền `isWild={false}` cho `BattleModal`
ở các trận không được phép chạy.

**Sửa lỗi trùng kết quả trận đấu:** trước đây bấm "Tiếp tục câu chuyện" có thể
gọi `onBattleEnd` 2 lần (do double-click hoặc React re-render), gây trùng dòng
"⚔ Kết quả trận đấu" và đôi khi khiến API bị gọi 2 lần cùng lúc dẫn tới lỗi
"phản hồi rỗng". Đã thêm `continuingRef` để chặn gọi lại lần 2.

**Import character card (.json / .png):** nút "Nhập character card" trong
phần character card, hỗ trợ:
- `.json`: đọc cả dạng phẳng (V1) lẫn dạng bọc `{spec, data}` (V2).
- `.png`: tự đọc chunk PNG để tìm chunk `tEXt` với keyword `chara` (chuẩn card
  V2 nhúng trong ảnh), giải base64 rồi parse JSON. Chưa hỗ trợ chunk nén
  `zTXt`/`iTXt` — nếu gặp file dùng chunk này, sẽ báo lỗi rõ ràng và gợi ý
  dùng bản `.json` thay thế.

## Đã biết nhưng CHƯA sửa — cần làm ở đợt sau

Bạn có nhắc "cái này vẫn chưa đúng kiểu roleplay mà tôi muốn" — đây vẫn là bản
test luồng kỹ thuật (chat + marker + battle + tiếp truyện), CHƯA có các tầng
AI phụ (bộ nhớ, lorebook, tóm tắt, vector hoá...) đã bàn trước đó. Khi bạn sẵn
sàng, báo mình để bổ sung tiếp theo đúng kiến trúc đã thống nhất.

## Cập nhật mới (đợt 3)

**Lorebook (World Info):** import `.json`/`.png` giờ đọc luôn field
`character_book` (chuẩn card V2) thành `character.lorebook`. Trong phần "Sửa
character card" có mục "Lorebook" để xem/sửa/thêm entry thủ công (mỗi entry:
từ khoá kích hoạt + nội dung). Cơ chế kích hoạt (`src/utils/lorebook.js`):
quét 6 tin nhắn gần nhất + tin người chơi vừa gõ, entry nào có từ khoá xuất
hiện trong đó sẽ được chèn vào system prompt. Đây là bản quét substring đơn
giản — chưa có AND/OR nhiều điều kiện, "constant entry" (luôn bật), hay giới
hạn token budget như World Info đầy đủ của SillyTavern.

**{{char}} / {{user}} placeholder:** `src/utils/promptBuilder.js` tự thay
`{{char}}`/`<char>` bằng tên nhân vật và `{{user}}`/`<user>` bằng tên người
chơi trước khi đưa vào system prompt — nhiều card cộng đồng (như card tiếng
Trung bạn import thử) dùng placeholder này.

**Sân đấu kiểu game gốc:** `BattleModal.jsx` đổi từ 2 panel xếp chồng sang
layout chéo góc (địch: bảng info trên-trái + sprite trên-phải; mình: sprite
dưới-trái + bảng info dưới-phải), có nền chia 2 tông màu trời/đất. Đã bỏ ép
tỉ lệ vuông cứng cho modal (dùng `maxHeight` + scroll) để vừa nội dung hơn.

**Menu FIGHT / BAG / POKÉMON / RUN:** RUN hiện luôn bật vì hệ thống chưa phân
biệt trận hoang dã vs trận có NPC/trainer — khi nào phân biệt được, truyền
`isWild={false}` cho `BattleModal` ở trận không được chạy.

**Màn hình mở đầu (title screen):** `IntroScreen.jsx` — bấm "Bắt đầu một hành
trình mới" → điền tên nhân vật, chọn 1 trong 4 Pokémon khởi đầu, và (tuỳ chọn)
mô tả khởi đầu mong muốn. Bấm "Bắt đầu" sẽ gọi AI viết đoạn mở đầu dựa theo
thông tin đó (nếu để trống mô tả, AI tự sáng tạo). Sau khi có đoạn mở đầu mới
chuyển sang màn đọc truyện.

**Bỏ giao diện bong bóng chat:** `RoleplayChat.jsx` giờ hiển thị theo kiểu
đọc tiểu thuyết liền mạch (`.story-text` trong `index.css`) — không còn khung
chat 2 bên trái/phải kiểu character.ai. Lời của người chơi hiện dạng in
nghiêng màu mint, có dấu `»` phía trước để phân biệt với lời kể của AI, nhưng
vẫn nằm trong cùng luồng văn bản, không phải bong bóng riêng.

### Còn thiếu / cần làm tiếp

- Lorebook chưa hỗ trợ chunk PNG nén (zTXt/iTXt) — nếu card của bạn dùng
  dạng này, xuất ra `.json` từ SillyTavern rồi import sẽ chắc ăn hơn.
- RUN luôn khả dụng (chưa phân biệt hoang dã/trainer).
- BAG và POKÉMON trong trận đấu vẫn là placeholder, chưa có hệ thống item/đội
  hình thật.

## Cập nhật mới (đợt 4)

**Lorebook: tìm kiếm + phân trang.** Ô "Lorebook" giờ có ô tìm kiếm (khớp theo
tên entry / từ khoá / nội dung cùng lúc, giống World Info của SillyTavern) và
chỉ hiện tối đa 5 entry/trang, có nút Trước/Sau. Entry giờ có thêm field
`name` (chỉ để nhận diện/tìm kiếm, không ảnh hưởng việc kích hoạt — kích hoạt
vẫn dựa vào `keys`), tự đọc từ `name`/`comment` khi import card.

**Pokeball dùng 1 lần.** Sau khi bấm vào 1 quả pokeball trong truyện, nó
chuyển thành icon mờ, không bấm lại được nữa (tránh việc mở lại đúng trận đã
xong). Trạng thái này lưu theo từng tin nhắn (`message.battleUsed`).

**Preset / hướng dẫn văn phong.** Ô textarea mới trong phần sửa character
card — dán vào đây preset văn phong riêng của bạn, nó sẽ THAY (không phải
cộng thêm) câu hướng dẫn hành văn mặc định trong system prompt. Để trống thì
dùng câu mặc định như cũ. Lưu ở `localStorage` riêng, áp dụng cho mọi card
(không gắn với 1 card cụ thể).

**API phụ 1 (chạy thoát) / API phụ 2 (thua cuộc).** Bước đầu hiện thực hoá
kiến trúc nhiều API bạn mô tả: trong phần sửa character card có mục "API phụ
cho tuyến kết quả trận đấu" — bật checkbox và điền baseUrl/key/model riêng cho
tuyến "chạy thoát" và/hoặc "thua cuộc". Để trống thì vẫn dùng API chính như
bình thường. Route được xử lý ở `handleBattleEnd` trong `RoleplayChat.jsx`.

### Về kế hoạch 9 API bạn gửi — đã ghi nhận, map vào code hiện tại thế nào

| API bạn mô tả | Vai trò | Trạng thái |
|---|---|---|
| API chính | Viết chính văn | ✅ đã có (`apiConfig`) |
| API phụ 1 (chạy thoát) | Viết tuyến chạy trốn | ✅ đã có (`outcomeApiConfig.escaped`) |
| API phụ 2 (thua) | Viết tuyến thua cuộc | ✅ đã có (`outcomeApiConfig.lose`) |
| API embedding + rerank | Vector hoá/tìm lại ký ức liên quan | ⏳ chưa làm — cần thêm kho vector (xem mục "Roadmap" phía trên) |
| API kiểm tra | Đối chiếu chính văn với lorebook + kiểm tra AI nhớ đúng không | ⏳ chưa làm |
| API trí nhớ | Tự tóm tắt 1 chương thành entry lorebook mới (kèm keyword nhân vật/thời gian/địa điểm/Pokémon) | ⏳ chưa làm — về bản chất là 1 lệnh gọi AI sau mỗi X tin nhắn, output ép JSON rồi `push` vào `character.lorebook` |
| API suy nghĩ biến | Cập nhật chỉ số/HP/túi đồ theo diễn biến | ⏳ chưa làm — cần thiết kế schema biến trước (đúng như bạn nói "sẽ có preset riêng") |
| API thúc đẩy | Tự động đẩy truyện tiếp mà không cần đợi người chơi gõ | ⏳ chưa làm — về kỹ thuật là 1 `setTimeout`/nút "tiếp tục" gọi `callAI` với 1 note hệ thống, không phức tạp, có thể làm sớm nếu bạn muốn |

Khi nào bạn muốn làm tiếp phần nào trong bảng trên, báo mình bắt đầu từ đó.

## Cập nhật mới (đợt 5)

**Preset chính văn (.json kiểu SillyTavern Chat Completion Preset).** Trang
Cài đặt API (giờ là trang riêng, không còn modal) có mục "Preset chính văn" —
nạp file preset dạng bạn gửi (mảng `prompts` + `prompt_order`), app sẽ:
- Ghép các block đang bật theo đúng thứ tự trong `prompt_order`.
- Thay marker cố định (`charDescription`, `charPersonality`, `scenario`,
  `worldInfoBefore`, `dialogueExamples`, `chatHistory`...) bằng dữ liệu động
  tương ứng của card/lorebook hiện tại.
- Xử lý macro `{{setvar::x::y}}` / `{{getvar::x}}` / `{{trim}}` — hỗ trợ đúng
  kiểu preset của bạn (khai báo biến ở 1 block, dùng lại ở block khác).
- Cắt tại marker `chatHistory` thành 2 phần: phần trước làm system prompt mở
  đầu, phần sau (thường là block "post-history"/reinforcement) được chèn làm
  1 system message riêng ngay trước khi gọi AI.
- Áp dụng `temperature`/`openai_max_tokens` của preset (giới hạn tối đa 8192
  token để tránh preset để số quá lớn — VD file bạn gửi để 100000).

**Giới hạn engine macro:** chỉ hỗ trợ `setvar`/`setglobalvar`/`getvar`/`trim`.
Các lệnh STscript khác (`{{if}}`, `{{random}}`, `{{pick}}`...) nếu preset có
dùng sẽ KHÔNG được xử lý, giữ nguyên dạng thô trong prompt — có thể khiến 1
vài đoạn không hoạt động y hệt trên SillyTavern gốc. Trang Preset có ô tìm
kiếm + phân trang (8 block/trang) để bạn xem/tắt từng block, và xem nội dung
thô để kiểm tra.

**Chỉ áp dụng cho API chính.** API phụ 1 (chạy thoát)/API phụ 2 (thua) vẫn
dùng preset văn phong dạng text đơn giản (ô "Preset / hướng dẫn văn phong"),
đúng như bạn mô tả — preset JSON nặng chỉ dành cho việc viết chính văn.

**Trang Cài đặt API giờ là trang riêng** (không phải popup), gồm: cấu hình
API chính, API phụ 1/2, preset văn phong, preset chính văn, và nút **"Kiểm
tra tất cả API"** — gọi thử lần lượt mọi API đã cấu hình (chính + phụ nếu có)
trong 1 lần bấm, hiện kết quả từng cái.

**Giao diện màn hình mở đầu nâng cấp** — nền gradient khí quyển (không cần
ảnh thật), tiêu đề lớn kiểu pixel, nút CTA màu vàng gold nổi bật giống ảnh
tham khảo, có nút "Cài đặt API" ngay trên màn hình mở đầu thay vì phải vào
truyện mới cấu hình được.

## Cập nhật mới (đợt 6) — sửa bug + minh bạch về NSFW

**Sửa bug: quả pokeball biến mất khi dùng preset chính văn.** Trước đây khi
nạp preset JSON, hệ thống thay hẳn system prompt bằng nội dung preset, làm
mất câu hướng dẫn chèn `[[BATTLE]]` (vốn chỉ nằm trong `buildSystemPrompt`
mặc định). Giờ `BATTLE_INSTRUCTION` được tách thành hằng số riêng
(`src/utils/promptBuilder.js`) và LUÔN được gửi kèm như 1 system message
cuối cùng, dù có preset hay không.

**Thêm "Debug: xem prompt vừa gửi"** — nút nhỏ dưới khung chat, bấm vào sẽ
hiện đúng nội dung từng system message thực sự vừa gửi tới API (kể cả khi
dùng preset). Dùng để tự kiểm tra xem preset có ghép đúng như mong muốn
không, tách bạch giữa lỗi do app ghép sai vs. do model/provider tự chặn.

**Về NSFW:** app này (code trong repo) không có bất kỳ bộ lọc/kiểm duyệt nội
dung nào — chỉ gộp system prompt rồi gửi thẳng tới `baseUrl` bạn cấu hình,
dùng đúng key của bạn. Nếu output vẫn bị "sạch" bất thường dù preset đã đúng
(kiểm tra bằng nút Debug ở trên), khả năng là do bộ lọc an toàn của chính
model/provider (Gemini có safety filter riêng) — nằm ngoài phạm vi code của
app, không thể tắt từ phía client.

## Cập nhật mới (đợt 7) — Assistant Prefill

Thêm hỗ trợ **Assistant Prefill** (mồi câu trả lời) — kỹ thuật chuẩn: gửi kèm
1 message role `assistant` ở cuối request, coi như model đã bắt đầu trả lời
và chỉ cần viết tiếp, thay vì tự quyết định có nên mở đầu/trả lời hay không.

- Tự động đọc từ field `assistant_prefill` trong preset JSON khi import (field
  này có sẵn trong file preset bạn gửi, đang để trống — bạn có thể điền tay).
- Ô "Assistant Prefill" riêng trong trang Cài đặt API, sửa tay được sau khi
  preset tự điền.
- Áp dụng cho cả API chính (có/không preset) lẫn khi viết đoạn mở đầu ở màn
  tạo nhân vật.
- `aiClient.js`: nếu output trả về có lặp lại đúng đoạn mồi ở đầu, tự cắt bớt
  để không hiển thị trùng.

**Lưu ý:** đây không phải chuẩn chính thức của OpenAI chat completions (OpenAI
thật sẽ bỏ qua/báo lỗi nếu message cuối là `assistant` thay vì `user`) —
nhưng nhiều proxy Gemini/Claude-compatible hỗ trợ tốt. Dùng nút Debug đã có
sẵn để kiểm tra xem provider bạn dùng có tôn trọng đúng phần mồi này không.

## Cập nhật mới (đợt 8) — tối ưu theo preset thật

**Nâng trần max_tokens từ 8192 lên 200000.** Trước đó app tự ý giới hạn
`openai_max_tokens` của preset xuống 8192 để "phòng thân" — nhưng preset kiểu
CoT nhiều giai đoạn (như của bạn) cần trần cao vì phần suy nghĩ tốn phần lớn
token trước khi ra tới chính văn. Giờ chỉ chặn số thật sự vô lý, còn 100000
như file preset gốc thì đi qua nguyên vẹn — đúng cách SillyTavern vẫn dùng.

**Tự động ẩn chuỗi suy nghĩ + thẻ phụ trợ** (`src/utils/outputCleanup.js`) —
lấy ĐÚNG 2 regex đang bật sẵn trong preset của bạn:
- Script "01-Ẩn chuỗi suy nghĩ": xoá toàn bộ `<thinking>...</thinking>`
  (kể cả biến thể `[metacognition]`/`[love_qkll]`).
- Script "05-Ẩn thẻ phụ trợ": xoá `<safe>...</safe>` (cả nội dung bên trong),
  và xoá riêng cặp thẻ `<recap>`/`</recap>`, `<theater>`/`</theater>`,
  `<parallel_world>`/`</parallel_world>` (giữ nguyên nội dung bên trong).

Áp dụng cho MỌI phản hồi (cả khi không dùng preset — lúc đó các thẻ này
không xuất hiện nên regex không match gì, vô hại).

**Báo lỗi rõ khi AI chỉ trả về phần suy nghĩ.** Nếu sau khi lọc mà nội dung
rỗng (nghĩa là response bị cắt giữa chừng lúc đang suy nghĩ, chưa kịp ra
`<content>`), app báo lỗi rõ ràng thay vì hiện tin nhắn trống, gợi ý tăng Max
tokens hoặc kiểm tra bằng nút Debug.

### Còn lại cần lưu ý khi bạn test tiếp

- Các regex khác trong preset (calendar, emo pill, choices...) tạo ra HTML
  đẹp trong SillyTavern — app này CHƯA áp dụng (chỉ áp 2 regex "ẩn", chưa làm
  regex "trang trí"), vì `.story-text` hiện chỉ render text thuần, chưa
  render HTML. Nếu preset xuất `<choices>`, `<calendar_widget>`... sẽ hiện
  dạng thẻ thô trong truyện — báo mình nếu cần hỗ trợ thêm phần này.

## Cập nhật mới (đợt 9)

**Tìm ra nguyên nhân "rác" còn dư (thanh trạng thái đồng nhân).** Không phải
app thiếu lọc — preset của bạn nhúng sẵn 27 script regex xử lý output (đọc từ
`SPresetSettings.RegexBinding.regexes`), trong đó script "09-Giao diện Đồng
Nhân" (hiện thanh trạng thái, dạng HTML) đang BẬT sẵn theo preset gốc, còn
script "09- Ẩn Giao diện Đồng Nhân" (bản ẩn sạch) lại đang TẮT. App giờ đọc
toàn bộ 27 script này (`presetImport.js: extractRegexScripts`), cho bạn tự
bật/tắt ở trang Cài đặt API → Preset chính văn → mục "Regex xử lý output".

- Script nào tạo HTML (`<div>`, `<style>`, `class="..."`) sẽ tự động mặc định
  TẮT (dù preset gốc bật) vì `.story-text` hiện chỉ render text thuần — bạn
  vẫn thấy trong danh sách (gắn nhãn "HTML") và tự bật lại nếu muốn.
- Script thuần "ẩn/xoá" (replaceString rỗng) thì giữ đúng theo trạng thái gốc
  của preset — **bạn cần tự bật "09- Ẩn Giao diện Đồng Nhân"** nếu muốn ẩn
  sạch thanh trạng thái đồng nhân, vì bản thân preset để nó tắt sẵn.
- `cleanAiOutput` giờ ưu tiên dùng đúng bộ 27 script này (nếu preset có nhúng)
  thay vì chỉ 2 quy tắc hard-code cũ; vẫn giữ 2 quy tắc cũ làm fallback cho
  preset không nhúng `SPresetSettings`.

**Thêm Chế độ Dev** — nút "Chế độ Dev" ở màn hình mở đầu và trên thanh trên
cùng lúc đang đọc truyện. Có 3 tab:
- **Test chính văn** / **Test NSFW**: cùng 1 công cụ (gõ 1 tin nhắn bất kỳ,
  bấm Gửi test) — chạy đúng pipeline API chính + preset hiện tại, không đụng
  gì tới lịch sử truyện thật. Có nút "Xem raw output + prompt đã gửi" để so
  sánh trước/sau khi lọc.
- **Test Battle**: mở thẳng màn hình chiến đấu với Pokémon hiện tại, không
  cần đi qua truyện để tới được đoạn có quả pokeball.

Logic build prompt cho API chính được gom về 1 chỗ dùng chung
(`src/utils/buildMainMessages.js`) — dùng bởi cả chat thật, màn mở đầu, và
Dev Mode, tránh 3 nơi tự viết 3 kiểu dễ lệch nhau như trước.

## Cập nhật mới (đợt 10)

**Tìm ra nguyên nhân sai số chữ.** Preset có 2 block "Yêu cầu số chữ (bật 1
trong 2)" — bản tiếng Việt (2600-4200 chữ) và bản tiếng Nhật (50-150
chữ/đoạn). Preset gốc mặc định BẬT bản tiếng Nhật, TẮT bản tiếng Việt — dù
bạn roleplay tiếng Việt. **Cần tự vào Settings → Preset chính văn → tìm "chữ"
→ tắt bản tiếng Nhật, bật bản còn lại.** Không phải lỗi app.

**Sửa lỗi "Ẩn" khoá luôn quả pokeball.** Trước đây bấm pokeball là đánh dấu
"đã dùng" ngay lập tức, nên bấm "Ẩn" (đóng tạm modal) cũng không đánh lại
được nữa. Giờ chỉ đánh dấu "đã dùng" khi trận THỰC SỰ kết thúc (thắng/thua/
chạy thoát) — bấm "Ẩn" vẫn mở lại đánh tiếp bình thường, HP 2 bên vẫn giữ
nguyên vì nằm ở context, chỉ có log trận là reset lại.

**Thêm 151 loài Pokémon Gen 1** (`src/data/pokemonSpecies.js`) — đối thủ
hoang dã giờ random trong 151 loài mỗi lần bấm pokeball (`randomWildMon()`),
không còn luôn luôn là Bulbasaur. Moveset tự sinh theo hệ của từng loài (1-2
chiêu STAB theo hệ + Growl + Quick Attack), tránh phải gõ tay moveset cho
từng loài. Sprite dùng chung cơ chế cũ (Pokémon Showdown), tự áp dụng cho mọi
loài mới thêm mà không cần sửa `MonAvatar.jsx`.

**Dev Mode thêm tab "Test model Pokémon"** — lưới xem trước sprite (cả 2
hướng) + hệ của toàn bộ 151 loài, có ô tìm kiếm theo tên, để bạn tự kiểm tra
sprite nào bị lỗi (rơi về fallback hình tròn) trước khi dùng thật.

**Tab "Test Battle" giờ cũng random đối thủ** mỗi lần bấm "Mở trận".

## Cập nhật mới (đợt 11) — pokedex đầy đủ, tải trực tiếp từ Showdown

Thay vì gõ tay hàng nghìn loài (rất dễ sai, đặc biệt các Gen sau này mình
không chắc chắn 100%), app giờ **tự tải toàn bộ pokedex thật lúc khởi động**
trực tiếp từ `https://play.pokemonshowdown.com/data/pokedex.json` — chính là
dữ liệu gốc mà trang sprite dùng, nên species slug khớp 100%, không lệch.

- Bao gồm **mọi Gen, mọi form vùng miền (Alola/Galar/Hisui/Paldea), Mega
  Evolution, và Gigantamax** — vì đây là dữ liệu thật của game, không phải
  danh sách tự soạn.
- Loại trừ "CAP" (Create-A-Pokémon — Pokémon fan-made của Smogon để cân bằng
  metagame, không phải Pokémon thật trong game).
- Cache vào `localStorage` 30 ngày, không tải lại mỗi lần mở app.
- Nếu tải lỗi (mạng chặn, CORS...), app tự fallback về 151 loài Gen 1 tĩnh
  đã có sẵn từ trước — không bị vỡ, chỉ là danh sách ít hơn.

**Về "Dynamax":** dữ liệu game không có species/sprite riêng cho Dynamax — bất
kỳ Pokémon nào cũng Dynamax được mà không đổi hình dạng, nên không có "loài"
tên "-dynamax" nào cả. Chỉ **Gigantamax** (hậu tố "-Gmax", chỉ 1 số loài nhất
định) mới có sprite riêng — và các loài đó đã nằm sẵn trong dữ liệu tải về.

**Test model Pokémon** giờ hiện trạng thái tải (đang tải / tải xong bao nhiêu
loài / lỗi + đang dùng fallback) ngay đầu trang, và sprite dùng
`loading="lazy"` để tránh tải cùng lúc hàng nghìn ảnh khi bạn mở lưới xem.

### Rủi ro cần bạn tự kiểm chứng

- Mình **chưa thể tự test được endpoint `pokedex.json` có cho phép gọi
  cross-origin (CORS) từ app chạy ở domain khác không** — tài liệu Showdown
  nói các API .json của họ cho phép CORS rộng, nhưng chưa chắc chắn 100% với
  riêng file này. Nếu bạn mở "Test model Pokémon" mà thấy dòng "Tải pokedex
  đầy đủ thất bại" màu đỏ, nghĩa là bị chặn CORS thật — báo mình để tính
  phương án khác (VD tự host file JSON này trong app thay vì fetch trực tiếp).
- Vì lấy nguyên dữ liệu thật, danh sách sẽ có cả các form mang tính sưu tầm/
  cosmetic (VD Pikachu đội mũ theo sự kiện, Unown từng chữ cái, Vivillon各
  hoa văn...) — không lọc bớt, vì bạn nói muốn tự rà từng con để kiểm tra.

## Cập nhật mới (đợt 12) — sửa 3 lỗi bạn báo

**"Voodoll" là gì:** đây là **Create-A-Pokémon (CAP)** — Pokémon fan-made của
cộng đồng Smogon, tạo ra để cân bằng thử nghiệm metagame, KHÔNG phải Pokémon
thật của Nintendo/Game Freak (Voodoll là tiền tiến hoá của "Voodoom", hệ
Ghost/Dark, lấy cảm hứng búp bê voodoo). Bug thật: bộ lọc loại CAP trước đó
kiểm tra sai field (`tier` thay vì `isNonstandard`), nên vài CAP mon lọt qua.
Đã sửa đúng field + thêm chặn phụ (dexnum ≤ 0), và tăng version cache để buộc
tải lại danh sách sạch.

**Sprite lỗi ở các form đặc biệt (Arceus 18 hệ, Silvally...):** bộ sprite
động "ani/ani-back" vốn dừng lại ở phong cách Đen/Trắng, chưa từng được vẽ bổ
sung cho hết mọi form sau này — nên các form kiểu Arceus-Electric,
Arceus-Fairy... không có trong bộ đó. `MonAvatar.jsx` giờ thử thêm 1 tầng nữa
trước khi rơi về icon chữ cái: sprite tĩnh từ **Pokémon HOME** (`/sprites/home/`),
bộ này bao phủ gần như mọi form hiện có. Chuỗi thử: ani(-back) → home → icon
chữ cái đầu.

**UI ô tìm kiếm không hợp theme:** nguyên nhân là `input`/`textarea`/`select`
trước đây chỉ được style tối khi nằm trong `.field` — những ô nằm ngoài
`.field` (như ô tìm kiếm trong Dev Mode) bị trình duyệt tự vẽ mặc định (nền
trắng). Đã thêm rule CSS áp dụng theme tối cho MỌI input/textarea/select bất
kể có nằm trong `.field` hay không. Cũng sửa luôn lỗi thanh trạng thái và ô
tìm kiếm bị nằm chung 1 dòng (do class `status-pill` dùng `display:
inline-flex`, ép về `display: block` khi cần đứng riêng 1 dòng).

## Cập nhật mới (đợt 13) — sửa gốc lỗi sprite form đặc biệt

**Nguyên nhân thật:** key phẳng trong `pokedex.json` (VD `raichualola`,
`pikachulibre`) dùng để tra cứu dữ liệu chiến đấu, nhưng KHÔNG phải lúc nào
cũng khớp tên file sprite thật trên server — sprite thật đặt tên dạng
`{baseSpecies}-{forme}` CÓ gạch nối (VD file thật là `raichu-alola.png`,
không phải `raichualola.png`). Đây là lý do mọi form không phải mặc định
(Pikachu costume, Raichu-Alola, Raichu-Mega-X/Y, Arceus theo hệ...) bị lỗi
sprite hàng loạt dù dữ liệu tên/hệ vẫn đúng.

**Đã sửa:** `pokedexFetch.js` giờ đọc thêm field `baseSpecies`/`forme` (có
sẵn trong pokedex.json cho mọi form không mặc định), tự ghép lại đúng
`spriteId` dạng có gạch nối (`toID(baseSpecies) + '-' + toID(forme)`) —
`MonAvatar.jsx` ưu tiên dùng `spriteId` này thay vì key phẳng khi build URL
sprite. Đã tăng version cache (`v3`) để buộc tải lại với dữ liệu đã sửa.

Ghi chú: 1 số form ghép nhiều tầng (VD Raticate-Alola-Totem) có thể vẫn lệch
đôi chút vì các bộ sprite khác nhau trên Showdown (ani/gen5/home/dex) không
hoàn toàn đồng nhất cách đặt tên các form dạng này — số lượng ảnh hưởng nhỏ
hơn nhiều so với lỗi gốc vừa sửa. Cũng đã xác nhận qua tìm kiếm: "Raichu-Mega-X/Y"
là nội dung THẬT vừa được công bố cho DLC Pokémon Legends: Z-A, không phải
lỗi dữ liệu — pokedex tải trực tiếp từ Showdown nên tự động có luôn.

## Cập nhật mới (đợt 14) — sửa bug đối thủ random lại + Dev Battle chọn tay

**Bug thật: mỗi lần bấm pokeball là 1 đối thủ khác.** Trước đây `onOpenBattle`
gọi `randomWildMon()` MỖI LẦN bấm, kể cả khi mở lại đúng quả pokeball vừa
"Ẩn" — nên truyện nói "Pidgey" nhưng vào trận lại ra Rotom-Fan, Dudunsparce...
tuỳ lần bấm. Đã sửa: mỗi tin nhắn (mỗi quả pokeball) giờ chỉ chọn đối thủ
**1 LẦN DUY NHẤT** (đánh dấu bằng field `message.battleStarted`), lưu lại
đúng con đó; mở lại sau khi "Ẩn" sẽ tiếp tục ĐÚNG con cũ với HP hiện tại,
không random lại — chặn luôn trick "ẩn đi lúc sắp thua rồi mở lại né đối thủ
khó/đổi đối thủ khác".

**Ưu tiên đúng tên AI đã kể.** Thêm `detectMentionedSpecies()` — quét nội
dung đoạn truyện ngay trước `[[BATTLE]]`, nếu AI có nhắc tên 1 loài cụ thể
(VD "Pidgey") thì bắt ĐÚNG loài đó thay vì random hoàn toàn; chỉ random khi
không dò được tên nào khớp.

**Dev Mode → Test Battle: chọn tay 2 Pokémon.** Không còn "random 1 phát"
nữa — giờ có 2 ô chọn loài (dropdown gõ-để-tìm, đủ dùng cho hơn 1000 loài)
+ thanh trượt chỉnh level riêng cho mỗi bên (phe mình / phe địch), bấm "Bắt
đầu trận" mới mở màn hình chiến đấu — đúng như bạn muốn để tự test cân bằng.

## Cập nhật mới (đợt 15) — sửa bug sát thương + hệ thống Boss

**Bug thật: sát thương không hề tính cấp độ.** Công thức cũ chỉ dựa vào
power/STAB/hệ — nên Lv100 đấu Lv12 vẫn ngang ngửa, đúng như bạn phát hiện.
Đã sửa `computeDamage` trong `BattleModal.jsx`: giờ có `levelFactor` (dựa
theo tinh thần công thức sát thương gốc của Pokémon) nhân thêm tỉ lệ chênh
lệch cấp độ giữa 2 bên (`attacker.level / defender.level`) — chênh lệch càng
lớn, sát thương càng bị khuếch đại rõ rệt. Vẫn là công thức rút gọn (không có
Atk/Def stat riêng từng loài) nhưng cấp độ giờ có ý nghĩa thật.

**Thêm 1 tầng fallback sprite nữa** (`/sprites/dex/`) cho vài costume cũ.
Một số con vẫn lỗi (Raichu-Mega-X/Y, Garchomp-Mega-Z, Lucario-Mega-Z...) —
đây là nội dung DLC "Mega Dimension" của *Pokémon Legends: Z-A* MỚI ĐƯỢC
CÔNG BỐ, dữ liệu chiến đấu đã có trên Showdown nhưng ảnh CHƯA TỒN TẠI ở bất
kỳ đâu vì game chưa phát hành — không phải bug, không có ảnh nào để tải cả,
sẽ tự hết khi Nintendo phát hành chính thức. Vài costume Pikachu cũ
(ORAS 2014) vẫn có thể thiếu ảnh vì cả 3 bộ sprite (ani/home/dex) đều không
lưu — cũng là giới hạn dữ liệu nguồn, không phải lỗi code.

**Hệ thống Boss** (`src/data/bossTiers.js` + `buildBossMon()`) — phân 3 bậc
theo đúng mô tả:
- **Bậc thấp** (bộ ba/tứ: chim, thú, kiếm sĩ trừ Keldeo, titan Rego, hồ,
  thần đảo, tam trụ tai ương/trung thành...): Lv tối đa 150, 2 thanh máu.
- **Huyền ảo & huyền thoại mạnh** (Mew, Celebi, Jirachi, Darkrai, Latios,
  Latias, Cresselia...): Lv tối đa 200, 3 thanh máu.
- **Đại diện bản game** (Mewtwo, Lugia, Ho-Oh, Rayquaza, Arceus...): Lv tối
  đa 300, 5 thanh máu.

HP boss nhân thêm theo số thanh (2 thanh = x1.5, 3 thanh = x2, 5 thanh = x3)
để thật sự trâu hơn hẳn Pokémon thường, không chỉ do level cao. `HealthBar`
giờ hỗ trợ chia nhiều đoạn (`bars` prop) — đánh bại = tổng HP toàn bộ về 0,
không có cơ chế khiên/đổi pha riêng từng đoạn (để giữ đơn giản, có thể nâng
cấp sau nếu cần).

**Dev Mode thêm tab "Test Boss"** — chọn bậc → chọn loài trong đúng bậc đó →
chỉnh level (giới hạn theo trần bậc) → chọn Pokémon phe mình + level → triệu
hồi. Danh sách boss là phân loại thủ công theo thiết kế game gốc, không lấy
tự động từ Showdown (vì Showdown không phân loại theo đúng tinh thần "độ
hoành tráng" này).

## Cập nhật mới (đợt 16) — cân bằng lại Boss + công thức sát thương chuẩn hơn

**Điều chỉnh phân bậc theo yêu cầu** (`src/data/bossTiers.js`):
- Shaymin dạng thường (Land Forme) + Phione → chuyển XUỐNG bậc thấp (2 thanh).
  Shaymin-Sky vẫn ở bậc huyền ảo (form thật sự mạnh của Shaymin).
- Hoopa-Unbound → chuyển LÊN bậc đại diện game (5 thanh) — form giải phóng
  sức mạnh thật, mạnh vượt xa Hoopa (Confined) nên tách riêng khỏi bậc huyền
  ảo thường. Hoopa (Confined) vẫn ở bậc huyền ảo.

**Boss giờ đánh đau hơn hẳn.** Chiêu thức của boss được nhân power x3 so với
Pokémon thường — trước đó dù chênh level rất lớn, sát thương vẫn "hiền" vì
power gốc của chiêu quá thấp (8-12) chi phối công thức, chênh level không đủ
bù lại. `buildBossMon()` giờ tự tăng sức mạnh chiêu khi tạo boss.

**Pokémon huyền thoại bên phe mình không còn bị "nerf".** Thêm hàm
`buildMonSmart()` — tự nhận diện nếu loài được chọn (kể cả ở phe MÌNH) nằm
trong danh sách boss tier, sẽ tự áp đúng HP nhân hệ số + chiêu mạnh x3 của
bậc đó (chỉ giới hạn level không vượt trần bậc, không giảm sức mạnh gì cả).
Áp dụng cho: ô "Pokémon phe mình" ở cả Test Battle lẫn Test Boss, VÀ cho
Pokémon hoang dã xuất hiện trong truyện thật — nếu AI kể gặp 1 huyền thoại,
trận đấu sẽ tự động là trận boss đúng bậc của loài đó, không cần bạn tự chọn.

**Thêm yếu tố ngẫu nhiên đúng công thức gốc của game.** Game Pokémon thật
nhân sát thương với hệ số ngẫu nhiên 217-255/255 (~0.85-1.00) — đây là lý do
cùng 1 chiêu đánh nhiều lần ra số hơi khác nhau mỗi lần, không phải bug. Đã
thêm đúng cơ chế này vào `computeDamage()`.

## Cập nhật mới (đợt 17) — bỏ x3 boss, sửa cap level, chiêu thức thật theo level

**Bỏ nhân x3 power của boss** theo đúng yêu cầu (quá mạnh, gần như không thể
thắng). `buildBossMon()` giờ chỉ còn nhân HP theo số thanh, không đụng gì vào
chiêu thức nữa.

**Sửa lỗi cap level 100 cứng ở "Pokémon phe mình".** Trước đây thanh trượt
level trong `SidePicker` (Test Battle/Test Boss) luôn giới hạn 1-100 dù bạn
chọn 1 loài huyền thoại bậc cao (trần thật là 300) — đó là lý do Mewtwo-Mega-Y
không lên nổi Lv300. Giờ `SidePicker` tự dò xem loài chọn có phải boss tier
không, nếu có thì thanh trượt tự nới trần theo đúng bậc của nó (150/200/300).
Dropdown chọn loài cũng ghi chú luôn "(Boss, Lv≤N)" cho loài nào thuộc boss
tier để dễ nhận biết.

**Chiêu thức thật theo level (data lấy từ chính Showdown, đúng như bạn đoán
là có sẵn công khai)** — thêm `src/utils/movesFetch.js`, tải song song 2 file:
- `moves.json`: bảng toàn bộ chiêu thức thật (tên, power, hệ, category).
- `learnsets.json`: lịch sử chiêu học được qua từng thế hệ — đã lọc sẵn chỉ
  giữ chiêu học qua **level-up ở Gen 9** (bỏ TM/tutor/egg/event move và các
  gen cũ để nhẹ hơn nhiều so với file gốc).

Khi tạo 1 Pokémon ở level X, hệ thống lọc ra các chiêu nó ĐÃ học được tính
đến level X, sắp theo power giảm dần, lấy 4 chiêu mạnh nhất — đúng tinh thần
"lên level cao hơn thì có chiêu tối ưu hơn" bạn muốn. Nếu dữ liệu chưa tải
xong (hoặc loài không khớp learnset, VD vài form đặc biệt) thì tự fallback về
hệ chiêu STAB cố định cũ, không bị vỡ.

Áp dụng cho MỌI nơi tạo Pokémon: chat thật (Pokémon hoang dã/huyền thoại
trong truyện), Test Battle, Test Boss.

Dev Mode giờ hiện 2 dòng trạng thái tải ngay đầu trang: Pokedex và "Chiêu
thức thật" — để bạn biết đã tải xong dữ liệu thật hay đang dùng fallback.

## Cập nhật mới (đợt 18) — base stats thật, sửa tận gốc 2 lỗi bạn phát hiện

Cả 2 điều bạn chỉ ra đều đúng là lỗ hổng thật của hệ thống rút gọn trước đó.
Sửa tận gốc bằng cách lấy luôn **base stats thật** (HP/Atk/Def/SpAtk/SpDef/Speed)
từ chính `pokedex.json` (field `baseStats` có sẵn, cùng file đã dùng từ đầu,
không cần tải thêm gì mới) — tăng version cache lên `v4` để buộc tải lại.

**HP giờ đúng theo từng loài.** Trước đó `maxHp = 30 + level*2` — bất kể loài
nào cũng ra số y hệt ở cùng level (đúng như ảnh Zekrom vs Ho-Oh bạn chụp).
Giờ dùng công thức HP chuẩn của game (giả định IV hoàn hảo 31, không
EV/nature vì hệ thống không quản lý 2 thứ đó): loài máu trâu (base HP cao)
sẽ thật sự trâu hơn loài máu giấy, đúng bản chất.

**Chọn chiêu không còn "cứ power cao là tối ưu" nữa.** Trước đó sort chiêu
theo power thô — dẫn tới 1 con thiên Atk (VD Ho-Oh: Atk 130 > SpAtk 110) vẫn
có thể bị gán toàn chiêu Special chỉ vì power danh nghĩa cao hơn, dù đánh ra
thực tế sẽ yếu hơn hẳn 1 chiêu Physical power thấp hơn nhưng đi qua Atk cao.
Giờ tính **"sức mạnh thực tế" = power × đúng chỉ số tấn công tương ứng**
(Atk cho Physical, SpAtk cho Special) rồi mới xếp hạng — chiêu được chọn giờ
thật sự tối ưu theo đúng thiên hướng tấn công của loài đó.

**Công thức sát thương giờ dùng đúng Atk/Def hay SpAtk/SpDef thật** thay vì
tỉ lệ chênh level ước lượng — đúng tinh thần công thức gốc: Physical đi qua
Atk người đánh / Def người đỡ, Special đi qua SpAtk / SpDef. Khi 1 trong 2
bên thiếu baseStats thật (VD dùng danh sách 151 loài tĩnh dự phòng) thì tự
lùi về công thức chênh-level cũ, không bị vỡ.

Nút chọn chiêu trong trận đấu giờ có nhãn nhỏ **PHYS/SPEC** cạnh mỗi chiêu để
bạn tự kiểm chứng trực quan.

## Cập nhật mới (đợt 19) — fallback learnset cho form không có dữ liệu riêng

**Làm rõ 1 điều quan trọng:** dữ liệu chiêu thức/learnset app dùng lấy thẳng
từ Showdown (`moves.json`/`learnsets.json`) — đây là dữ liệu THẬT được đối
chiếu với game gốc qua cộng đồng datamine, KHÔNG phải dữ liệu tự chế của
PokeRogue. App này không dùng bất kỳ dữ liệu nào từ PokeRogue cả.

**Bug thật đã sửa:** nhiều form/mega/regional (VD Necrozma-Ultra, các Mega
mới của DLC...) không có entry learnset RIÊNG trong dữ liệu — khiến hệ thống
rơi về bộ chiêu STAB dự phòng cũ (Growl + Quick Attack...), như bạn thấy
Necrozma-Ultra Lv300 vẫn dùng Growl. Trong game thật, các form này thường học
ĐÚNG bộ chiêu của loài GỐC (VD Necrozma-Ultra học như Necrozma). Đã thêm
`baseSpeciesId` vào dữ liệu loài, `pickMoves()` giờ tự fallback sang learnset
của loài gốc khi form không có learnset riêng — tăng version cache lên `v5`
để tải lại với dữ liệu đã sửa.

Vẫn còn 1 số ít trường hợp thật sự không có learnset ở bất kỳ đâu (loài quá
hiếm/CAP/1 số form cosmetic không tham chiến) — những con đó sẽ tiếp tục dùng
bộ chiêu STAB dự phòng, không có gì để lấy thêm.

## Cập nhật mới (đợt 20) — giao thức chọn chiêu nâng cao + hiệu ứng trạng thái

**Giao thức chọn chiêu mới** (`pickMoves` trong `pokemonSpecies.js`), theo
đúng thứ tự ưu tiên bạn mô tả:
1. Lấy chiêu học được qua level-up tới level hiện tại; nếu là Pokémon CỦA
   TRAINER (`isTrainerMon=true`) thì lấy thêm cả chiêu học qua TM.
2. Nếu loài nằm trong bảng "chiêu đặc trưng" (`SIGNATURE_MOVE_OVERRIDES` —
   VD Aggron ưu tiên Heavy Slam/Body Press) và học được, ưu tiên chọn trước.
3. Chia 2 nhóm theo chỉ số tấn công cao hơn (Atk vs SpAtk) — ưu tiên học HẾT
   chiêu thuộc nhóm đó trước, mới xét sang nhóm còn lại.
4. Trong mỗi nhóm, chấm điểm = power × chỉ số tương ứng × hệ số khắc chế đối
   thủ (nếu biết hệ đội hình đối thủ) × hệ số hiệu ứng phụ:
   - Chiêu có "khựng lượt" (recharge, VD Hyper Beam) → giảm điểm mạnh (×0.3).
   - Chiêu hồi lực nặng (recoil ≥25%) → giảm điểm (×0.75).
   - Chiêu có hiệu ứng phụ gây trạng thái (bỏng/tê liệt/ngủ...) → tăng điểm
     (×1.25).
   - Chiêu có hiệu ứng phụ giảm chỉ số đối thủ → tăng điểm (×1.15).

Bảng `SIGNATURE_MOVE_OVERRIDES` mới có vài loài phổ biến (Aggron, Conkeldurr,
Ferrothorn, Dragonite, Snorlax, Gyarados, Metagross, Garchomp, Tyranitar,
Excadrill) — đây chỉ là điểm khởi đầu nhỏ, không phủ hết hàng nghìn loài, báo
thêm loài nào cần bổ sung.

Đối thủ trong truyện thật giờ tự biết hệ của Pokémon người chơi (để ưu tiên
khắc chế) — Test Battle/Test Boss trong Dev Mode chưa truyền hệ đối thủ (2
bên đều do bạn tự chọn nên không cần đoán).

**Hiệu ứng trạng thái — đợt đầu tiên: Bỏng / Tê liệt / Ngủ** (`BattleModal.jsx`):
- **Bỏng (brn):** giảm 1 nửa sát thương chiêu Vật Lý gây ra, mất 1/16 máu tối
  đa vào cuối mỗi lượt.
- **Tê liệt (par):** 25% khả năng không thể hành động mỗi lượt.
- **Ngủ (slp):** không thể hành động trong 1-3 lượt (ngẫu nhiên), tự tỉnh sau
  đó.
- Trạng thái được gây ra dựa đúng % thật của từng chiêu (field `secondary`
  trong dữ liệu Showdown) — không phải tự chế tỉ lệ.
- Có badge nhỏ (BRN/PAR/SLP) hiện ngay trên thẻ thông tin mỗi bên trong trận.
- Trạng thái giữ nguyên khi bấm "Ẩn" rồi mở lại (nhất quán với HP), chỉ mất
  khi trận kết thúc/reset.

Sẽ bổ sung dần các trạng thái khác (độc, đóng băng, tăng/giảm chỉ số theo
giai đoạn...) ở các đợt sau theo đúng tinh thần "cập nhật dần dần".

## Cập nhật mới (đợt 21) — rà soát toàn bộ, sửa 4 bug + 3 tối ưu

Đợt này không thêm tính năng mới — rà lại toàn bộ source theo yêu cầu "kiểm
tra còn lỗi gì không, chưa tối ưu gì thì fix".

**Bug 1 (nghiêm trọng) — cờ `battleUsed` bị mất sau khi trận kết thúc**
(`RoleplayChat.jsx`): `handleBattleEnd` gọi `setMessages` 2 lần — lần 1 đánh
dấu `battleUsed`, lần 2 ghi đè bằng mảng build từ closure cũ (chưa có cờ).
Hậu quả: pokeball vẫn bấm lại được sau khi thắng/thua, kết hợp `resetBattle`
hồi đầy máu → đánh lại 1 trận vô hạn lần. Đã gộp thành 1 lần cập nhật duy
nhất (đánh dấu cờ + thêm note kết quả trong cùng 1 mảng).

**Bug 2 (nghiêm trọng) — bỏng hạ gục nhưng trận không kết thúc = soft-lock**
(`BattleModal.jsx`): tick bỏng cuối lượt có thể đưa HP về 0 nhưng không set
`finished` → mọi nút menu bị khoá (vì `battleOver`) mà nút "Tiếp tục câu
chuyện" không hiện. Đã chuyển tick bỏng sang tính bằng biến HP cục bộ và
kiểm tra gục ngã (thắng/thua vì vết bỏng) ngay sau khi trừ.

**Bug 3 — địch vẫn hành động ngay lượt vừa bị ru ngủ/tê liệt**
(`BattleModal.jsx`): `checkCanAct(enemyMon...)` đọc state React là closure
cũ, trạng thái vừa gây trong cùng lượt chưa kịp vào state. Đã theo dõi trạng
thái địch bằng biến cục bộ trong lượt: vừa ngủ = mất lượt ngay (đúng game
gốc), vừa tê liệt = vẫn chịu 25% mất lượt.

**Bug 4 — import card .png vỡ font tiếng Việt + crash card lớn**
(`characterCardImport.js`): (a) `JSON.parse(atob(...))` decode sai UTF-8 —
mọi ký tự có dấu/emoji trong card .png bị mojibake sau import; đã sửa thành
base64 → mảng byte → `TextDecoder('utf-8')`. (b) `String.fromCharCode(...bytes)`
spread mảng lớn (card nhúng lorebook hàng trăm KB) ném RangeError vượt giới
hạn đối số; đã thay bằng `TextDecoder('latin1')` (đúng spec chunk tEXt PNG,
an toàn mọi kích thước).

**Tối ưu 1 — chiêu dùng `secondaries` (mảng) giờ proc được trạng thái**
(`movesFetch.js`): Fire Fang / Ice Fang / Thunder Fang... trong dữ liệu
Showdown dùng field `secondaries` (mảng nhiều hiệu ứng) thay vì `secondary`
— trước đây các chiêu này không bao giờ gây bỏng/tê liệt. Đã chuẩn hoá về 1
field, ưu tiên entry có gây trạng thái. Cache key tăng lên
`trainer-arena:moves-cache-v3` (đổi schema → buộc tải lại theo đúng quy tắc).

**Tối ưu 2 — starter dùng baseStats + learnset thật** (`IntroScreen.jsx`):
starter cũ tạo từ dữ liệu tĩnh không có `baseStats`, mà công thức sát thương
thật yêu cầu CẢ 2 bên có stats → mọi trận của người chơi đều rơi về công
thức xấp xỉ. Giờ khi pokedex đã tải xong, starter được dựng bằng
`buildMonSmart` (đúng nguyên tắc "dùng hàm này ở mọi nơi tạo Pokémon") ở
Lv10 — nằm giữa dải wild Lv8-15 (Lv5 với HP thật ~20 sẽ bị wild Lv15 đè bẹp
trận đầu). Pokedex chưa tải/lỗi mạng → fallback starter tĩnh cũ, không chặn
người chơi.

**Tối ưu 3 — mỗi quả pokeball nhớ đúng con của nó** (`RoleplayChat.jsx`):
trước đây 2 quả pokeball dùng chung 1 `enemyMon` toàn cục — mở quả B sẽ ghi
đè đối thủ của quả A, quay lại A sẽ gặp nhầm con của B. Giờ mỗi message lưu
`enemySnapshot` riêng: tạo khi mở lần đầu, cập nhật (kèm HP/trạng thái hiện
tại) mỗi lần bấm "Ẩn", khôi phục khi mở lại, xoá khi trận kết thúc.

**Kèm theo**: miễn nhiễm trạng thái theo hệ đúng game gốc (hệ Lửa không bị
bỏng, hệ Điện không bị tê liệt — quy tắc Gen 6+) trong `rollStatus`.

## Cập nhật mới (đợt 22) — nerf huyền thoại, bản đồ 9 vùng + tracking vị trí, Combat Anime

**1. Scale chỉ số theo level** — xác nhận: ĐÃ có từ đợt 18, đúng công thức
game gốc (IV=31, không EV/nature): HP = ⌊(2×base+31)×lv/100⌋+lv+10, stat
khác = ⌊(2×base+31)×lv/100⌋+5. Không đổi gì thêm.

**2. Nerf huyền thoại** (`bossTiers.js`): trần level 3 bậc hạ từ 150/200/300
xuống **120/150/200** — với công thức stat thật, level 300 khiến bậc cao gần
như bất khả chiến bại. Slider trong Test Boss/SidePicker tự theo trần mới,
`buildMonSmart` tự ép level khi vượt trần (kể cả huyền thoại phe mình).

**3. Bản đồ 9 vùng + tracking vị trí + level wild theo khu vực**
(`data/regions.js`, `components/RegionMap.jsx`):
- 9 vùng (Kanto→Paldea), mỗi vùng ~10 "chặng" tiêu biểu theo tiến trình game
  gốc, mỗi chặng có dải level wild riêng (VD Pallet Lv2-5, Mt. Silver
  Lv55-70). Đây là dữ liệu địa lý curated thủ công (khác species/stat —
  những thứ đó vẫn fetch từ Showdown), chỉ các chặng lớn chứ không đủ mọi
  route — báo thiếu khu nào thì bổ sung thêm.
- Vị trí người chơi tự cập nhật khi CHÍNH VĂN nhắc địa danh
  (`detectMentionedArea` — ưu tiên khu cùng vùng hiện tại để xử lý tên trùng
  như "Victory Road", ưu tiên key dài hơn như "Cerulean Cave" > "Cerulean").
  Đoạn mở đầu cũng được dò để đặt vị trí xuất phát. Lưu localStorage.
- Nút **"Bản đồ"** trong màn truyện: xem lộ trình từng vùng dạng chuỗi khu
  nối nhau (không dùng ảnh map thật của game — không có nguồn hotlink ổn
  định + dính bản quyền artwork), marker ● tại vị trí hiện tại, bấm khu bất
  kỳ để dời tay khi auto-detect dò sai.
- Bấm pokeball: level wild random theo dải của khu hiện tại (fallback 8-15
  khi chưa xác định vị trí).

**4. Test Combat Anime** (tab mới trong Dev Mode,
`components/AnimeBattleTester.jsx`) — chế độ chiến đấu THỜI GIAN THỰC kiểu
anime, song song với chế độ theo lượt cũ (cả 2 đều test được):
- Người chơi GÕ CHỮ mô tả bước di chuyển/chiêu thức của Pokémon phe mình;
  AI làm trọng tài kiêm người tường thuật (2-4 câu/pha, địch phản đòn thông
  minh trong cùng pha).
- Sát thương do AI phân xử qua giao thức máy đọc được ở cuối mỗi pha:
  `[[DMG player=X, enemy=Y]]` (định mức 4-18% maxHp/đòn ghi trong system
  prompt, app chặn trần 40% maxHp/pha chống số ảo; parser chấp nhận đảo thứ
  tự/hoa thường). Tag bị ẩn khỏi phần tường thuật hiển thị; thiếu tag → pha
  không tính sát thương + cảnh báo (model chưa theo giao thức).
- Tường thuật hiện kiểu TYPEWRITER, tốc độ chỉnh được (10-120 ký tự/giây).
- ĐỒNG HỒ ÉP NHỊP: tường thuật xong mà chần chừ quá N giây (chỉnh 10-60s)
  → địch tự chủ động tấn công. Không có "lượt" — đứng im là ăn đòn. Đồng hồ
  tạm dừng khi đang gọi API/đang tường thuật; lỗi API không bị phạt.
- State trận nằm cục bộ trong tab (không đụng playerMon/enemyMon toàn cục,
  chưa nối vào truyện thật — đúng tinh thần "test thôi"). Trọng tài dùng API
  chính hiện tại, mỗi pha đều được kèm HP hiện tại 2 bên.

**5. Test API Showdown**: KHÔNG kiểm tra được từ môi trường của Claude —
proxy sandbox chặn domain play.pokemonshowdown.com (host_not_allowed), là
giới hạn mạng phía Claude chứ không phải API chết. App chạy client-side nên
trình duyệt của bạn fetch trực tiếp; xác nhận qua 2 status pill trong Dev
Mode (Pokedex/Chiêu thức thật hiện "đã tải xong ~1300 loài" = cả 3 endpoint
data OK, tab Test model Pokémon xác nhận endpoint sprite).

## Cập nhật mới (đợt 23) — API riêng Combat Anime, HUD dọc trái, Test giao diện

**1. API riêng cho Combat Anime** (`GameContext`, `OutcomeApiSection`,
`SettingsPage`, `AnimeBattleTester`): mục mới "API Combat Anime: trọng tài
trận thời gian thực" trong Cài đặt, cùng pattern với 2 API phụ (để trống =
dùng API chính; điền = tách riêng endpoint/model cho trọng tài). Nút "Kiểm
tra tất cả API" test luôn API này. Tab Combat Anime hiện pill cho biết trọng
tài đang chạy bằng API nào. Trường thiếu (temperature, maxTokens) thừa hưởng
từ API chính.

**2. Trả lời "combat anime có hình ảnh không?"**: hiện tại là SPRITE ĐỘNG
(gif Showdown) của 2 Pokémon + thanh máu cập nhật thật + chữ tường thuật
chạy typewriter — KHÔNG phải ảnh render trận đấu hay cutscene. Đợt này thêm
hiệu ứng RUNG sprite bên trúng đòn (~0.5s, CSS keyframes `hitShake`) cho có
cảm giác va chạm. Muốn ảnh minh hoạ từng pha thật sự thì cần nối API tạo ảnh
riêng (chưa làm — nói thì tính tiếp).

**3. HUD dọc bên trái** (`PlayerHUD.jsx`, chỉ hiện trong màn chơi, bố cục
tham khảo giao diện Phàm Nhân Tu Tiên), trên xuống dưới:
- Ô avatar (URL ảnh, chưa có thì hiện chữ cái đầu tên).
- Tên / Tuổi / Tiền (₽, lưu localStorage trong `playerProfile`).
- **Sinh lực theo BỘ PHẬN CƠ THỂ** (`BodyFigure.jsx`) — chế độ chân thực,
  Pokémon tấn công người là bình thường: hình người SVG 6 bộ phận (đầu,
  thân, 2 tay, 2 chân), mỗi bộ phận 0-100 thương tổn, tô màu theo độ nặng:
  xám lành lặn → vàng nhẹ → cam vừa → đỏ nặng → đỏ sậm nguy kịch → ĐEN là
  mất/hỏng hẳn. Hover từng bộ phận có tooltip số + nhãn.
- **Đội hình 6 ô**: sprite + level, ô trống viền đứt. BẤM vào 1 con → modal
  chi tiết (`PokemonInfoModal.jsx`): sprite lớn, hệ, HP, bảng 5 chỉ số đã
  scale theo level, danh sách chiêu (hệ/power/% gây trạng thái). Starter tự
  vào ô 1 khi bắt đầu game.
- **Quan hệ NPC**: điểm hảo cảm -100..100, thanh 2 chiều (đỏ trái = ghét,
  xanh phải = quý) + ghi chú. Hiện quản lý tay/qua Dev — tự trích từ truyện
  bằng AI là việc của đợt sau.
- **Khu vực hiện tại**: tên khu + vùng + dải level wild (đồng bộ hệ thống
  bản đồ đợt 22).
- 2 nút: **⚙ Cài đặt** (mở trang cài đặt API/preset đầy đủ) và **⌂ Màn hình
  chính** (có confirm trước khi thoát).
- App.jsx chuyển màn chơi sang layout 2 cột: HUD trái sticky + khung truyện.

**4. Tab "Test giao diện"** (Dev Mode, `UiTester.jsx`) — vì HUD chỉ xuất
hiện trong màn chơi nên tab này dựng PREVIEW SỐNG của đúng component HUD
(cùng state context — chỉnh gì thấy ngay, vào màn chơi thật cũng y hệt) cạnh
bảng điều khiển chỉnh-nhanh:
- Hồ sơ: tên, tuổi, tiền, avatar URL.
- Sinh lực: 6 slider theo bộ phận + BẤM TRỰC TIẾP vào bộ phận trên hình để
  cộng nhanh +25 (tới 100 thì quay về 0) + nút "Hồi phục hết"/"Random
  thương tích" — test đủ dải màu xám→vàng→cam→đỏ→đen.
- Đội hình: picker loài + level (dùng chung SidePicker), thêm/bỏ từng con,
  xoá cả đội; bấm ô trong HUD preview để test modal chi tiết Pokémon.
- Quan hệ: thêm NPC + kéo hảo cảm + ghi chú, bỏ từng người.
- **Test dò vị trí bản đồ**: dán 1 đoạn chính văn bất kỳ → "Dò vị trí" →
  báo app nhận ra đúng vùng/khu nào (kèm dải level) hay không nhận ra, áp
  luôn vào vị trí thật; bên dưới có bản đồ đầy đủ để đối chiếu/chỉnh tay.

## Cập nhật mới (đợt 24) — AI cập nhật trạng thái từ truyện, Shop, thuyết phục trong trận, sân khấu combat

**1. Giao thức trạng thái trong chính văn** (`utils/storyStateProtocol.js`):
cùng triết lý [[BATTLE]]/[[DMG]] — AI kể bằng lời, thay đổi trạng thái game
khai báo qua tag ở cuối tin (app parse → áp vào state thật → ẨN tag):
- `[[MONEY +500]]` tiền thay đổi (thưởng, bị cướp...) — kẹp >= 0.
- `[[REL Misty=+12 | ghi chú]]` hảo cảm NPC (upsert theo tên, kẹp -100..100,
  mỗi tin đổi tối đa ±30 chống AI lật ngược cả mối quan hệ 1 phát).
- `[[BODY leftArm=+20]]` thương tích cơ thể (dương = thương thêm, âm = hồi
  phục, kẹp 0..100) — hình người trên HUD đổi màu ngay theo diễn biến.
- `[[SHOP Tên cửa hàng]]` — xem mục 2.
Hướng dẫn giao thức nối vào CẢ 2 đường prompt (mặc định + preset). Regex neo
theo dòng nên [[BATTLE]] và [[DMG]] không bị đụng (đã unit test). Đoạn mở
đầu cũng được strip tag phòng AI lỡ chèn.

**2. Hệ thống Shop** (`data/shopItems.js`, `components/ShopModal.jsx`):
hoạt động y hệt cơ chế pokeball — AI chèn `[[SHOP Tên]]` khi nhân vật bước
vào cửa hàng → nút 🛒 "Vào cửa hàng" hiện dưới đoạn văn → mở giao diện giỏ
hàng: danh mục 18 vật phẩm chia 5 nhóm (Poké Ball, hồi phục Pokémon, chữa
trạng thái, ĐỒ CHO NGƯỜI — băng gạc/túi cứu thương vì chế độ chân thực, tiện
ích) giá theo game gốc, bấm +/- chọn số lượng, tổng tiền so với ví (thiếu
tiền = không mua được). "Mua & tiếp tục" → trừ tiền thật, cộng túi đồ thật,
gửi note kết quả cho AI kể tiếp; "Rời không mua" cũng báo AI để truyện không
treo. Mỗi tag shop khoá 1 lần dùng (như pokeball, cùng pattern chống mất cờ).
Túi đồ hiện trong HUD + menu BAG trong trận (dùng item trong trận = đợt sau).

**3. Ô chat thuyết phục/dụ dỗ TRONG TRẬN** — cả 2 chế độ:
- Theo lượt (`BattleModal`): nút TALK mới trong menu chính → gõ lời nói →
  AI nhập vai đối phương (phản ứng bằng hành vi/tiếng kêu, không nói tiếng
  người) + phân xử qua tag `[[TALK result=continue|calm|join|flee]]`:
  continue = chưa lay chuyển, nói chuyện TỐN 1 LƯỢT nên đối phương được đánh
  tự do; calm = hoà giải, trận kết thúc; **join = Pokémon hoang dã bị dụ ĐI
  THEO — vào thẳng đội hình 6 ô nếu còn chỗ** (boss không bao giờ join, HP
  đối phương <50% mới dễ xuôi); flee = bỏ chạy. 3 outcome mới (calm/join/
  flee) có label + văn bản kết quả riêng gửi cho AI kể tiếp. Dùng API Combat
  Anime nếu đã cấu hình, không thì API chính.
- Combat anime: ô nhập vốn tự do nên chỉ cần dạy trọng tài — luật 6 mới cho
  phép thuyết phục, kết thúc trận qua tag `[[END result=calm|join|flee]]`
  đặt sau dòng DMG.

**4. Sân khấu combat anime** (đúng yêu cầu "model pixel Showdown di chuyển
và tấn công theo lời người chơi"): khung sân 2 tầng — hàng thông tin
tên/hệ/HP phía trên, SÂN KHẤU phía dưới với sprite ĐỘNG Showdown đứng 2 góc
chéo như game gốc (phe mình quay lưng góc dưới trái, địch góc trên phải).
Mỗi pha theo kết quả phân xử: sprite bên tấn công LAO về phía đối thủ
(keyframe lunge), bên trúng đòn LOÉ TRẮNG + vòng nổ va chạm + SỐ SÁT THƯƠNG
bay lên; 2 bên cùng gây damage thì chạy tuần tự (mình đánh trước, địch phản
đòn sau ~0.8s). Toàn bộ bằng CSS animation điều khiển theo tag [[DMG]] —
không cần API tạo ảnh, mượt và nhẹ.

**5. Dev Mode — Test Shop**: panel mới trong tab Test giao diện mở đúng
ShopModal dùng trong truyện, mua TRỪ TIỀN THẬT + cộng túi đồ thật (test
end-to-end), kèm nút xoá túi đồ.

## Cập nhật mới (đợt 25) — huyền thoại có lore riêng: năng lực đặc biệt + luật thuyết phục

**1. Kho lore huyền thoại** (`data/legendLore.js`): ~25 huyền thoại lớn, mỗi
con 2 phần — `ability` (năng lực đặc biệt cho combat anime) và `persuasion`
(luật thuyết phục theo nguyên tác). Match theo slug species bằng startsWith
nên tự bao mọi forme (Mewtwo-Mega, Giratina-Origin, Kyurem-Black, Arceus-
Fire...), đã unit test cả ca hiểm Mew vs Mewtwo. Huyền thoại không có lore
riêng dùng luật kiêu ngạo generic.

**2. Luật thuyết phục mới (cả 2 chế độ)**: huyền thoại KHÔNG còn "tuyệt đối
không join" — chúng CÓ THỂ bị dụ nhưng cực kỳ kiêu ngạo: phải bị đánh suy
yếu rõ rệt/chứng minh phẩm chất trước, và AI TỰ QUYẾT dựa trên lore từng
loài: bộ ba thần thú trung thành tuyệt đối với Ho-Oh — đi ngược ý chí Ho-Oh
thì THÀ CHẾT không khuất phục; Ho-Oh không bị dụ mà CHỌN người thuần khiết;
Reshiram cắt cầu ngay khi nghe 1 lời nói dối; Zekrom đòi thấy lý tưởng;
Arceus chỉ phán xét; Miraidon bóc trần hứa suông bằng logic... BattleModal
đã bỏ chặn join cho boss (huyền thoại dụ được sẽ VÀO ĐỘI thật).

**3. Năng lực huyền thoại trong combat anime** — nhét vào system prompt
trọng tài (bắt buộc thể hiện trong tường thuật + phân xử), áp cho CẢ 2 phe
nếu phe nào cầm huyền thoại. Đúng đề bài: Mewtwo áp lực tâm linh khiến đối
thủ khựng/chậm; Lugia bão táp quật Pokémon bay chao đảo; Rayquaza chúa tể
tầng khí quyển (Delta Stream vô hiệu mọi thời tiết kể cả của Kyogre/Groudon,
thống trị không chiến); Kyogre nhấn chìm sân trong mưa (đòn Lửa tắt ngấm);
Groudon đại hạn phun magma (đòn Nước bốc hơi); Palkia mở rift nuốt đòn đánh
xa vào hư không; Kyurem đóng băng sân + giảm tốc, kẻ yếu/người không bảo hộ
bị đóng băng luôn; Zekrom (tự nghĩ): trường điện từ tê dại + Teravolt xuyên
phòng ngự, chỉ bung toàn lực trước lý tưởng lớn; Reshiram (tự nghĩ): lửa
xanh thiêu rụi ảo ảnh/hư chiêu, nhìn thấu đòn lừa; gen sau: Xerneas tự chữa
lành, Yveltal hút sinh lực qua Oblivion Wing, Zygarde dồn ép thì hoá
Complete Forme hồi máu, Necrozma chớp mù mắt, Eternatus khiến Pokémon đối
phương cuồng loạn nhưng khựng 1 nhịp sau Eternabeam (điểm yếu cài sẵn),
Zacian chém xuyên khiên, Zamazenta chặn đòn mở màn + phản thương, Koraidon
càng đánh càng hăng, Miraidon tính trước quỹ đạo đòn.

**4. CƠ CHẾ CỨNG do app cưỡng chế** (phe địch — model phân xử ẩu tới đâu
cũng không phá được lore):
- **Ho-Oh**: bị hạ gục lần đầu → TÁI SINH 100% HP (1 lần/trận, có log lửa
  cầu vồng).
- **Dialga**: sống sót qua pha là TUA NGƯỢC THỜI GIAN hồi full HP — đúng đề
  bài "không oneshot được nó là coi như thua".
- **Giratina**: giáp phản vật chất — nhận tối đa ~3% maxHp/pha.
- **Arceus**: gần miễn nhiễm — nhận tối đa ~5% maxHp/pha.
Các cơ chế đều có dòng log riêng để người chơi hiểu vì sao số sát thương bị
bóp. Phe người chơi cầm các con này thì trọng tài tự phân xử (chưa cưỡng chế
app-side — tránh trận test bất tử 2 chiều).

**Cách test nhanh**: Dev Mode → Test Combat Anime → phe địch chọn Ho-Oh/
Dialga/Giratina/Arceus level cao (trần mới 120/150/200) → đánh vài pha xem
cơ chế cứng + thử thuyết phục bộ ba thần thú ("hãy phản bội Ho-Oh đi") xem
nó có thà chết không.

## Cập nhật mới (đợt 26) — combat anime "vẽ được": toạ độ + môi trường + bể chiêu; UI 3 cột; túi đồ tương tác

**1. API phụ có nút "Tải model"**: cả 3 API phụ (chạy thoát / thua / Combat
Anime) giờ có nút tải danh sách model từ endpoint /models của chính API đó
(cùng logic API chính) → dropdown chọn, không phải gõ tay model id.

**2. Tìm kiếm Pokémon trong picker** (`SidePicker`): ô 🔎 lọc hơn 1000 loài
theo tên, gõ tới khi còn đúng 1 kết quả thì TỰ CHỌN luôn; select hiển thị số
kết quả. Dùng chung cho Test Battle / Test Boss / Combat Anime / Test giao
diện.

**3. Combat anime ĐẠI TU** (`AnimeBattleTester` viết lại toàn bộ):
- **Hệ toạ độ sân đấu**: sân là lưới (x,y) 0..100, mỗi Pokémon có vị trí
  thật gửi cho trọng tài mỗi lượt. Luật hình học là LUẬT: đứng lệch hàng thì
  phun thẳng là hụt, xa thì cận chiến phải lao tới trước, được tạt sườn/vòng
  ra sau/kéo giãn. Trọng tài khai báo di chuyển qua tag `[[MOVE player=x,y
  enemy=x,y]]` — sprite TRƯỢT tới toạ độ mới (CSS transition), kẻ tấn công
  DASH 55% quãng đường về phía đối thủ rồi quay về, số sát thương + vòng nổ
  hiện đúng chỗ đối thủ đang đứng. Pokémon di chuyển khắp sân theo lệnh —
  đúng yêu cầu.
- **Bể chiêu đầy đủ, không giới hạn 4**: mọi chiêu trong learnset gen hiện
  tại (level-up + TM, KỂ CẢ chiêu Status như Recover/Thunder Wave — movesFetch
  nâng cache v4, thêm map `allMoves`). Số chiêu trong bể hiện ngay lúc bắt
  đầu trận.
- **Autocomplete + chip xanh/đỏ**: gõ dở tên chiêu là gợi ý từ bể chiêu
  (Tab chọn gợi ý đầu); chiêu được nhắc trong lệnh hiện chip ✓ XANH (con
  mình học được) / ✗ ĐỎ (không học được). App tự gửi PHÁN QUYẾT cho trọng
  tài ("X ✗ KHÔNG có trong bể — pha dùng chiêu này thất bại/yếu hẳn") — model
  không cần nhớ 900+ chiêu, người chơi cũng vậy.
- **Sát thương theo combo**: hết cảnh "phun liên tục vẫn trừ như 1 phát" —
  luật mới: đòn đơn 4-8%, liên hoàn/bắn liên tục CỘNG DỒN 12-25%, tuyệt
  chiêu toàn lực 20-35% (trần 40%), thưởng thêm cho combo sáng tạo tận dụng
  địa hình; đổi lại combo dài = hở sườn, phản đòn của địch mạnh hơn.
- **Môi trường**: sân khởi tạo theo VỊ TRÍ HIỆN TẠI trên bản đồ 9 vùng
  (đứng ở Mt. Silver thì đánh nhau ở Mt. Silver); luật buộc chiêu thức tàn
  phá môi trường thật (Hydro Pump khoét đá, Earthquake xẻ rãnh...) và tận
  dụng nó; trọng tài cập nhật qua tag `[[ENV ...]]` — caption hiện trên sân
  + nền sân ĐỔI TÔNG MÀU theo môi trường (mưa xanh / lửa đỏ / băng lam / bão
  xám / đảo ngược tím).

**4. UI 3 cột**: Cài đặt + Màn hình chính + Bản đồ chuyển sang CỘT PHẢI mới
(`RightHUD.jsx`): trên cùng là MINI MAP góc phải — tên khu + lộ trình vùng
thu nhỏ dạng chấm (khu hiện tại sáng xanh, khu đã qua xám) — bấm vào mở
modal bản đồ thật với vị trí hiện tại; dưới là 2 nút hệ thống. Cột trái gọn
lại (avatar/hồ sơ/sinh lực/đội hình/túi đồ/quan hệ), nút "Bản đồ" cũ trong
khung truyện bỏ đi.

**5. Túi đồ TƯƠNG TÁC** (trong PlayerHUD): tabs phân mục ĐẦY ĐỦ theo danh
mục shop (Poké Ball / hồi phục Pokémon / chữa trạng thái / đồ cho người /
tiện ích — mục trống vẫn hiện, mờ đi). Bấm item mở chi tiết + DÙNG THẬT:
thuốc hồi HP chọn con trong đội để hồi (Full Restore chữa cả trạng thái,
Revive chỉ cho con đã gục, tự đồng bộ con đang ra trận); băng gạc/túi cứu
thương chọn bộ phận cơ thể để giảm thương tích (hình người đổi màu ngay).
Bóng/chữa trạng thái/tiện ích ghi rõ "nối vào trận ở đợt sau".

**6. Bỏ nhiều thanh máu huyền thoại**: cả 3 bậc về 1 thanh máu, trần level
120/150/200 giữ nguyên — HP giờ đúng công thức thật không nhân thanh.

## Cập nhật mới (đợt 27) — level là sức mạnh tuyệt đối, tự định hướng, pause/đổi/bắt, địa hình Dev, bậc chỉ số

**1. Chênh lệch level được CƯỠNG CHẾ app-side** (combat anime): sát thương
nhân theo (levelTấnCông/levelPhòngThủ)^1.25, kẹp 0.35..2.5 — Lv200 đánh
Lv100 tự động x2.38, chiều ngược lại x0.42, model cào bằng tới đâu cũng
không thoát. Có dòng báo hệ số ngay đầu trận khi chênh lệch đáng kể + luật
3b trong prompt buộc lời kể khớp với số ("voi với kiến").

**2. Tự định hướng như anime** (luật 2 viết lại): người chơi chỉ cần HÔ
CHIÊU — Pokémon tự di chuyển/căn góc để đánh TRÚNG (tự khai báo qua MOVE
tag). Đòn chỉ hụt khi đối thủ CHỦ ĐỘNG né (phải tường thuật rõ), địa hình
cản, hoặc lệnh phi lý. Ra lệnh vị trí cụ thể thì vẫn ưu tiên theo lệnh.

**3. Thanh hành động combat anime**: ⏸ Tạm dừng (đóng băng đồng hồ ép nhịp
để suy nghĩ, bấm Tiếp tục hoặc gửi lệnh là chạy lại) · 🔄 Đổi Pokémon (tối
đa 4 con/trận, ghế dự bị giữ nguyên HP, đổi người là hành động thật — địch
có thể thừa cơ đánh; con mới dùng đúng bể chiêu của nó) · 🎯 Ném bóng bắt
(dùng bóng THẬT trong túi đồ — mua ở Test Shop; trọng tài phân xử theo HP
còn lại/loại bóng/độ hiếm qua tag `[[CATCH result=caught|escaped]]`, huyền
thoại cực khó; kết quả mới "Bắt thành công") · Bỏ trận. Nói chuyện thuyết
phục vẫn gõ thẳng vào ô lệnh như cũ.

**4. Chọn địa hình trong Dev** (setup combat anime): dropdown 3 chế độ —
"Theo vị trí bản đồ" (mặc định, như khi chơi thật) / 10 preset (đồng cỏ,
rừng rậm, hang động, bờ biển, núi lửa, sân băng, đường phố, sa mạc, giông
bão, khe nứt không gian) / "✍ Tự nhập theo prompt" (dán mô tả bất kỳ — chính
là để test trước luồng AI tạo địa hình từ chính văn khi nối vào truyện thật).

**5. Hệ BẬC CHỈ SỐ ±6 cho trận theo lượt** (BattleModal, đúng game gốc):
hệ số (2+bậc)/2 khi dương, 2/(2-bậc) khi âm (+2 = x2, -6 = x0.25);
`self.boosts` của chiêu áp lên chính mình, `secondary.boosts` áp lên đối
thủ theo % chance; log đúng văn game gốc ("Tấn công của X tăng mạnh! (bậc
+2)", kịch bậc thì báo "không thể tăng thêm"); computeDamage nhân bậc vào
cả công thức thật lẫn fallback. HIỂN THỊ: chip bậc ngay dưới thanh máu trên
StatusCard (xanh dương bậc +, đỏ bậc −) — trả lời đúng câu "sao biết tấn
công đã tăng giảm bao nhiêu bậc". LƯU Ý: bậc reset khi bấm Ẩn rồi mở lại
modal (chưa persist — việc của đợt sau).

## Cập nhật mới (đợt 28) — Hệ thống NHẠC NỀN theo ngữ cảnh (khu vực / trận đấu / shop / jingle)

**Vì sao thiết kế kiểu "tự dò file"**: nhạc Pokémon gốc có bản quyền nên
app KHÔNG đóng gói sẵn file nhạc nào — thay vào đó bạn tự bỏ file .mp3
(hoặc .ogg) vào `public/music/` theo tên chuẩn, app tự dò và phát. Mỗi ngữ
cảnh có CHUỖI FALLBACK: thiếu file cụ thể thì lùi dần về file chung hơn,
hết chuỗi thì im lặng — thiếu bao nhiêu file cũng không bao giờ lỗi. Danh
sách tên file đầy đủ + tối thiểu 3 file để cả game có nhạc: xem
`public/music/README.txt` (đã tạo sẵn trong thư mục đó).

**1. `src/data/musicTracks.js` (MỚI)** — bản đồ ngữ cảnh → danh sách track:
- `classifyAreaType(area)`: phân "chất nhạc" 91 khu của bản đồ 9 vùng theo
  từ khoá trong tên khu (town / city / forest / cave / sea / volcano / ice /
  tower / victory-road / endgame — thứ tự rule quan trọng: "Spear Pillar" ăn
  endgame trước khi rơi vào cave, "Mt. Chimney" ăn volcano...). Đã unit test
  node: 91/91 khu phân loại hợp lệ + 11 spot-check khu tiêu biểu đều đúng.
- `resolveAreaTrackKeys(location)`: `area-<type>` → `region-<vùng>` →
  `exploration`.
- `resolveBattleTrackKeys(enemyMon)`: theo `getBossTier` — huyền thoại bậc
  cao → `battle-legendary-high` → ... → `battle`; boss thấp/huyền ảo →
  `battle-legendary` → ...; thường → `battle-wild` → `battle`.

**2. `src/utils/musicManager.js` (MỚI)** — singleton độc lập React:
- base (nhạc ngữ cảnh chính) + override stack push/pop theo id (idempotent
  → an toàn StrictMode double-effect và enemyMon đổi HP mỗi lượt không làm
  restart nhạc).
- Probe file bằng thẻ Audio preload=metadata (404 / SPA rewrite trả HTML
  đều bắn error → nhảy ứng viên kế tiếp), cache kết quả trong phiên; bật
  lại nhạc sẽ xoá cache để nhặt file mới thêm (vẫn khuyên F5).
- Crossfade ~700ms giữa 2 thẻ audio; jingle (victory/defeat) phát 1 lần,
  onended tự refresh về nhạc nền; chống race bằng playSeq.
- Autoplay policy: play() bị chặn → gắn listener pointerdown/keydown 1 lần
  để mở khoá rồi phát lại (widget hiện chữ "bấm vào trang để phát").
- Cài đặt {enabled, volume} persist `trainer-arena:music-settings` +
  subscribe() cho widget React.
- Dùng `import.meta.env.BASE_URL` để deploy dưới subpath vẫn đúng đường dẫn.

**3. `src/components/MusicController.jsx` (MỚI, vô hình)** — mount trong
main.jsx (để chạy trên MỌI màn hình kể cả Dev/Settings dù App return sớm):
title screen ↔ nhạc khu vực theo `playerLocation` (đổi khu cùng "chất"
nhạc thì KHÔNG cắt nhạc); `battleOpen` → override nhạc trận theo enemyMon.

**4. Điểm nối vào code cũ**:
- RoleplayChat.handleBattleEnd: win/join/calm/caught → jingle `victory`,
  lose → `defeat`, escaped/flee → về thẳng nhạc khu vực.
- AnimeBattleTester: 2 effect mới — override `anime-battle` khi trận chạy
  (theo tier của địch, dep `eMon?.name` nên đổi HP không restart) + jingle
  khi `finished` chuyển null→giá trị (Trận mới reset null nên trận sau vẫn
  có jingle); cleanup pop khi rời tab.
- ShopModal: mount → override `shop`, unmount → pop.
- RightHUD: thêm `MusicWidget` compact (🔊/🔇 + slider + tên track đang
  phát) ngay dưới mini map. SettingsPage: panel "Nhạc nền" = widget + bảng
  tên file rút gọn + lưu ý autoplay/bản quyền.

**Cách test nhanh**: bỏ tạm 2-3 file mp3 bất kỳ vào `public/music/` đặt tên
`exploration.mp3`, `battle.mp3`, `victory.mp3` → `npm run dev` → bấm 1 cái
vào trang là nhạc exploration chạy; vào truyện, đến khi có pokeball mở trận
→ nhạc đổi sang battle, thắng trận → jingle victory rồi quay lại exploration.
Đổi khu vực trên bản đồ (RightHUD) thử thêm `area-cave.mp3`/`region-*.mp3`.
Tab Test Combat Anime + Test Shop trong Dev cũng đã có nhạc.

**Chưa làm (đợt sau nếu cần)**: nhạc riêng theo TỪNG khu cụ thể (hiện theo
"chất" khu + vùng — muốn per-area thì thêm map areaKey→file); volume riêng
cho jingle; nút nhạc trên màn hình title (hiện chỉnh ở RightHUD/Settings).

## Cập nhật mới (đợt 29) — TRÍ NHỚ DÀI HẠN cho chính văn (Embedding + Rerank, kiểu vector storage SillyTavern)

**Vấn đề giải quyết**: truyện dài → gửi full lịch sử vừa tốn token vừa tràn
context, model quên diễn biến cũ. Giải pháp RAG: mỗi lượt truyện được vector
hoá thành "ký ức"; khi truyện đã dài, app chỉ gửi CỬA SỔ 24 tin gần nhất +
tự truy hồi các diễn biến cũ LIÊN QUAN tới lời người chơi vừa nói và chèn
vào prompt dưới dạng note hệ thống. Chưa cấu hình embedding → gửi full lịch
sử y như cũ (không đổi hành vi hiện tại).

**1. 2 API mới trong Cài đặt** (panel "Trí nhớ dài hạn", cùng pattern các
API phụ, MỖI khối đều có nút **Tải model** từ GET /models + nút **Kiểm tra**
gọi endpoint thật):
- **API EMBEDDING** (bật = bật trí nhớ): endpoint OpenAI-compatible
  `POST /embeddings` — OpenAI, vLLM, Ollama (/v1), LM Studio, Infinity...
  Nút kiểm tra embed thử 1 câu, báo số chiều vector.
- **API RERANK** (tuỳ chọn): endpoint `POST /rerank` kiểu Jina/Cohere/vLLM/
  Infinity (`{model, query, documents, top_n}` → `results[{index,
  relevance_score}]`, đã chuẩn hoá các biến thể field). Nhiều provider
  rerank không có GET /models → nút Tải model báo lỗi kèm ghi chú "vẫn gõ
  tay được", không chặn gì. Rerank LỖI giữa chừng → degrade về xếp hạng
  cosine thuần (đã test), có trí nhớ vẫn hơn không.
- Lưu localStorage `trainer-arena:memory-api`; GameContext expose
  memoryApiConfig/setMemoryApiConfig.

**2. `src/services/aiClient.js`**: thêm `embedTexts(cfg, texts)` (sắp lại
theo field index cho chắc thứ tự) và `rerankDocs(cfg, query, docs, topN)`.

**3. `src/utils/storyMemory.js` (MỚI)** — kho ký ức:
- Lưu `trainer-arena:story-memory-v1`; vector nén Float32 → base64 (encode
  theo CHUNK 8192 byte — né đúng bẫy RangeError spread mảng lớn của vụ PNG
  card đợt 21). Trần 400 ký ức, đầy hoặc QuotaExceeded → tự cắt ký ức cũ
  nhất. Mỗi ký ức = "Người chơi: … / Diễn biến: …" cắt 700 ký tự/vế, kèm
  `turn` (vị trí lượt) để loại ký ức còn nằm trong cửa sổ gần khi truy hồi.
- Pipeline `recallRelevant`: embed câu truy vấn → cosine top 24 ứng viên
  (chỉ ký ức turn < cutoff) → rerank chấm lại (nếu có) → top 6 → 
  `buildMemoryNote` dựng note "[Hệ thống — KÝ ỨC DÀI HẠN: …]".
- Đã unit test node: roundtrip encode/decode vector 1536 chiều (sai số
  ~2e-7), cosine các case biên, cắt độ dài, và test TÍCH HỢP mock fetch:
  cosine xếp đúng chủ đề, lọc maxTurn đúng, rerank thắng cosine khi điểm
  khác nhau, endpoint rerank chết 404 → degrade cosine không ném lỗi.

**4. Điểm nối**:
- RoleplayChat.callAI: trước khi gọi AI — memory bật + messages > 28 →
  cắt history về 24 tin cuối, recallRelevant theo tin user gần nhất, chèn
  note ký ức lên ĐẦU cửa sổ (role user, đúng kiểu note hệ thống app đang
  dùng — tránh system message giữa hội thoại làm vài proxy khó chịu). Sau
  khi AI trả lời — rememberExchange chạy NỀN (lỗi chỉ console.warn, tuyệt
  đối không chặn truyện).
- IntroScreen: bấm bắt đầu truyện MỚI → clearMemory() (ký ức truyện cũ
  không lẫn sang truyện mới) + ghi đoạn mở đầu làm ký ức đầu tiên.
- Panel Cài đặt hiện SỐ KÝ ỨC đang lưu (live qua subscribeMemory) + nút
  "🗑 Xoá trí nhớ" (có confirm).

**Cách test nhanh**: Cài đặt → panel Trí nhớ dài hạn → tick API EMBEDDING,
điền Base URL/Key → bấm **Tải model** chọn model embedding (VD
text-embedding-3-small) → bấm **Kiểm tra embedding** phải báo "OK — vector
N chiều". (Tuỳ chọn) làm tương tự với RERANK. Chơi truyện: mỗi lượt xong
số "Ký ức đã lưu" trong Cài đặt tăng 1. Truyện qua ~28 tin thì mở DevTools
Network sẽ thấy request /embeddings (+/rerank) trước mỗi lượt gọi model
chính; muốn soi note ký ức thực tế được chèn thì xem request body của
/chat/completions — tin đầu cửa sổ là "[Hệ thống — KÝ ỨC DÀI HẠN…]".

**Ghi chú giới hạn**: messages của truyện vốn không persist qua reload
(kiến trúc hiện tại) nhưng ký ức THÌ persist — reload xong chơi tiếp truyện
mới sẽ tự sạch nhờ clearMemory ở IntroScreen; nếu muốn xoá tay lúc nào cũng
có nút trong Cài đặt. Cửa sổ 24 tin + top 6 ký ức là hằng số đầu file
storyMemory.js/RoleplayChat.jsx — muốn chỉnh thành cài đặt UI thì làm đợt sau.

## Cập nhật mới (đợt 30) — Quạt cơ chế Mega/Z/Dynamax/Tera, 3 lớp trí nhớ cốt truyện, giao thức NPC, ảnh bản đồ thật

**QUYẾT ĐỊNH THIẾT KẾ (chốt với người dùng)**: khi vào game sẽ có **2 chế độ
chơi tách biệt — chế độ GAME (trận theo lượt) và chế độ ANIME** — KHÔNG gộp
2 hệ vào 1 trận để tránh nham nhở/khó tối ưu. Chế độ anime sẽ được tối ưu
riêng ở đợt sau; đợt này tập trung chế độ game. (Cập nhật mục 9 roadmap.)

**0. SỬA BUG CŨ (đợt 27 để lại)**: `Battlefield` ở module scope tham chiếu
`eStages`/`pStages` là state bên trong component → mở BattleModal là crash
ReferenceError. Đã truyền qua props đàng hoàng.

**1. QUẠT CƠ CHẾ ĐẶC BIỆT trong menu FIGHT (BattleModal)** — đúng mô tả:
nút TRÒN ở góc trên-trái ô 4 chiêu (viền conic-gradient 4 màu), bấm xoè 4
nút tròn nhỏ theo hình quạt TRÁI → PHẢI: **MEGA (M) → Z-MOVE (Z) →
DYNAMAX (D) → TERASTAL (T)**, có transition xoè/cụp. Đúng luật game thật:
**mỗi trận chỉ dùng được 1 cơ chế** (chọn 1 là 3 nút kia khoá, tooltip ghi
lý do khi bị mờ).
- **MEGA**: dò forme Mega THẬT từ pokedex (baseSpeciesId + tên chứa
  "-Mega") — loài không có Mega thì nút mờ; loài có 2 bản (Charizard,
  Mewtwo) hiện popup chọn X/Y. Biến hình thật: stats/hệ/sprite của forme
  Mega cùng level, GIỮ HP hiện tại + 4 chiêu + trạng thái. Hết trận (nút
  Tiếp tục câu chuyện) tự trở về bản gốc — ngoài truyện vẫn là con thường.
- **Z-MOVE**: bấm Z → chọn 1 trong 4 chiêu SÁT THƯƠNG (viền vàng phát
  sáng, chiêu Status bị khoá, có nút Huỷ) → phóng bản "Z-{tên chiêu}" với
  power theo bảng xấp xỉ game gốc (<60→100 … ≥140→200). Dùng đúng 1 lần.
- **DYNAMAX**: HP hiện tại + tối đa x2 trong 3 LƯỢT (đếm hiển thị cạnh
  quạt), sprite phe mình phóng to 1.55x + hào quang đỏ; loài có forme
  Gigantamax thì dùng luôn sprite/tên G-Max. Hết 3 lượt tự trở về, máu
  chia đôi theo tỉ lệ; gục/thắng giữa chừng thì revert lúc kết thúc trận.
- **TERASTAL**: kết tinh về HỆ CHÍNH — đổi types (cả phòng thủ), STAB
  đúng cơ chế Gen 9: hệ tera trùng hệ gốc x2.0, hệ gốc còn lại vẫn 1.5
  (computeDamage viết lại phần STAB). Chip TERA/DMAX hiện trên StatusCard.

**2. HOÀN THIỆN "3 PHƯƠNG PHÁP TRÍ NHỚ"** (theo yêu cầu tối thiểu 3):
- (1) *đợt 29*: RAG vector (embedding + rerank) — ký ức từng lượt.
- (2) **TÓM TẮT CỐT TRUYỆN tự cập nhật** (`utils/storySummary.js`): mỗi ~12
  tin mới, model chính gộp (tóm tắt cũ + tin mới) thành bản ≤350 từ giữ
  đúng: mục tiêu, NPC + quan hệ, đội Pokémon, lời hứa/ân oán, địa điểm,
  mốc thời gian. Luôn chèn đầu prompt → cửa sổ bị cắt vẫn không mất mạch.
  Chạy nền sau mỗi lượt, khoá chống chạy chồng, lỗi chỉ warn.
- (3) **SỔ TAY THẾ GIỚI theo KEYWORD** (`utils/storyNotebook.js`) — chống
  AI bịa quá khứ: AI khai báo thông tin cứng qua tag mới, app lưu theo key
  (tên nhân vật/Pokémon/địa danh/thời gian). Trước mỗi lượt, dò 4 tin gần
  nhất + input: nhắc key nào → chèn đúng mục đó (NPC trước fact, key dài
  trước — đúng bài học match; tối đa 8 mục). Trần 80 NPC / 250 fact /
  6 fact mỗi key, dedupe trùng hệt, chống quota.

**3. GIAO THỨC NPC + FACT** (mở rộng storyStateProtocol, tương thích ngược
— parse cũ vẫn nguyên):
- `[[NPC Tên | tuổi=31 | nghề=Kiểm lâm | đội=Luxray Lv28, Arcanine Lv30 |
  ghi chú=...]]` — mọi trường tuỳ chọn, cập nhật NPC cũ chỉ cần ghi trường
  đổi (upsert ghi đè field trùng, giữ field cũ — đã test).
- `[[FACT Từ khoá | nội dung]]` — sự kiện/lời hứa/mốc thời gian cần nhớ.
- Prompt instruction kèm **QUY TẮC TẠO NPC**: tên ĐA DẠNG đúng chất thế
  giới Pokémon (ghi thẳng "đừng lặp mãi vài tên quen tay như Elara"), tuổi
  + nghề hợp bối cảnh, dân thường đa số không phải trainer, level đội theo
  khu vực/trình độ người chơi, không lạm phát level.

**4. UI SỔ TAY**: nút "📓 Sổ tay cốt truyện" ở RightHUD → modal 3 tab:
Tóm tắt (SỬA TAY được + lưu/xoá — bạn toàn quyền nắn lại nếu AI tóm sai),
NPC (xoá từng mục), Fact (xoá từng mục). Truyện MỚI ở IntroScreen xoá cả
3 lớp trí nhớ.

**5. ẢNH BẢN ĐỒ THẬT** (RegionMap): cùng kiến trúc tự-dò-file của nhạc nền
— bỏ ảnh vào `public/maps/` tên theo key vùng (kanto.png … paldea.png, thử
.png→.jpg→.webp) là modal Bản đồ hiện ảnh thật phía trên lộ trình khu;
thiếu ảnh chỉ hiện chữ như cũ + dòng hướng dẫn. `public/maps/README.txt`
đã tạo (kèm lưu ý bản quyền artwork). Chấm toạ độ khu trên ảnh = đợt sau.

**Cách test nhanh**: (a) Dev → Test Battle, chọn loài có Mega (Charizard/
Gengar/Lucario...) → FIGHT → bấm nút tròn góc trên-trái → quạt xoè → M →
xem tên/hệ/stats/sprite đổi sang Mega, đánh vài đòn, kết thúc trận xem về
lại bản gốc; thử D xem to gấp rưỡi + đếm 3 lượt; thử Z rồi chọn chiêu; thử
T xem chip TERA + STAB x2. (b) Chơi truyện: gặp NPC mới → mở 📓 Sổ tay xem
hồ sơ tự hiện; ~12 tin thì tab Tóm tắt có nội dung; nhắc lại tên NPC/địa
danh cũ trong tin nhắn → xem request /chat/completions có note "SỔ TAY THẾ
GIỚI". (c) Bỏ kanto.png vào public/maps/ → mở Bản đồ.

**Chưa làm/đợt sau**: tách UI 2 chế độ game/anime khi mở pokeball + tối ưu
chế độ anime theo hình dung của bạn (chờ bạn mô tả cụ thể muốn nó khác gì);
gimmick cho phe địch; item Mega Stone/Z-Crystal làm điều kiện mở gimmick;
chấm toạ độ khu trên ảnh bản đồ; dùng item trong trận theo lượt.

## Cập nhật mới (đợt 31) — ĐẠO DIỄN TÌNH HUỐNG: giao thức thúc đẩy cốt truyện tự nhiên theo thân phận + vùng đất

**Kiến trúc** (`src/data/storyDirector.js`): "đạo diễn ngầm" phía app —
thỉnh thoảng (KHÔNG phải mỗi lượt) chọn 1 HẠT GIỐNG TÌNH HUỐNG từ các pool
có trọng số rồi chèn cho AI dạng note một-lần ở cuối history (không lưu vào
messages → lượt sau tự biến mất, AI không bị gợi ý cũ ám). Mọi hạt giống
đều là GỢI Ý: AI được dặn "chỉ lồng vào nếu hợp mạch, trong 1-2 tin tới,
đang cao trào khác thì BỎ QUA hẳn" — đây là chốt chống gượng ép.

**1. Nhịp độ (pacing engine)**: cooldown giữa 2 lần gợi ý + xác suất tăng
dần theo số lượt im ắng (normal: cách ≥4 lượt, 35% +12%/lượt, trần 85%),
nhớ 2 THỂ LOẠI vừa dùng để không lặp. 4 mức trong Cài đặt: Tắt / Thưa /
Vừa / Dày. Đa số lượt engine trả null — đó mới là tự nhiên.

**2. Pool tình huống chung (9 thể loại, ~40 hạt giống)** với trọng số:
đời thường slice-of-life (cao nhất — quán ăn, Pokémon nghịch, lễ hội, giờ
cơm...), phiêu lưu (tin đồn địa danh, dấu vết Pokémon hiếm THOÁNG QUA),
xã giao (so tài thân thiện ĐƯỢC PHÉP TỪ CHỐI, gặp lại NPC cũ), romance
(tín hiệu nhẹ, có checkbox tắt riêng), rắc rối nhỏ CÓ LỐI RA, cơ hội
(việc làm thêm, thương nhân), sự kiện NỀN (thế giới sống kể cả khi không
ai nhìn), tia lửa trận đấu (trọng số THẤP — không phải lúc nào cũng đánh
nhau), và tin phản diện vùng.

**3. Tình huống theo THÂN PHẬN** — chọn ở màn tạo nhân vật (persist, đổi
được giữa chừng trong Cài đặt), khai báo cố định trong system prompt + thấm
vào đoạn mở đầu:
- **Con cháu đại gia tộc**: tin trưởng bối bàn HỨA HÔN/LIÊN HÔN (chỉ là
  tin bay tới — người chơi toàn quyền phản ứng, KHÔNG bị ép cưới trong
  cảnh), gia tộc đối địch quan sát, kỳ vọng gia tộc, người nhận ra gia
  huy, chi thứ nhờ vả, cả twist "đối tượng hứa hôn cũng không muốn cưới".
- **Giang hồ đường phố**: investigator ĐỂ MẮT (chưa hành động, chưa chắc
  nhắm mình), người quen giới ngầm nhắn nhờ/vay, ân oán cũ nghe tin, đàn
  em gặp chuyện, lời mời phi vụ mập mờ TỪ CHỐI ĐƯỢC, cửa hàng có cửa sau.
- Thêm 3 thân phận tự bổ sung (được người dùng cho phép thêm thắt): Tân
  binh tự do (mặc định), Trợ lý nghiên cứu trẻ, Kiểm lâm tập sự.

**4. Tin tổ chức phản diện theo vùng — MỜ đúng yêu cầu**: map 9 vùng →
tổ chức (Kanto Rocket, Johto tàn dư Rocket, Hoenn Magma&Aqua, Sinnoh
Galactic, Unova Plasma, Kalos Flare, Alola Skull/Aether, Galar
Yell/Macro Cosmos, Paldea Star). Seed toàn tín hiệu GIÁN TIẾP: mẩu báo,
lời xì xào, đồng phục thoáng qua, Pokémon sợ người bất thường — kèm lệnh
"KHÔNG đối đầu, không ai chú ý tới người chơi". Chỉ hoạt động khi có vị
trí trên bản đồ; trọng số thấp.

**5. Hai lớp chống lệch** (yêu cầu cốt lõi):
- Mỗi hạt giống bọc QUY TẮC CÔNG BẰNG: có nhiều lối ra / được từ chối và
  thế giới vẫn tiếp diễn / KHÔNG nịnh, không "ngầu miễn phí", NPC hành xử
  theo lợi ích riêng.
- `DIRECTOR_WORLD_INSTRUCTION` cố định trong system prompt (cả nhánh
  preset lẫn mặc định của buildMainMessages): thế giới không xoay quanh
  người chơi, nhịp đa dạng, cân bằng không dồn ép ↔ không tâng bốc, phản
  diện mờ, tôn trọng quyền chủ động.

**6. Nối hệ thống**: GameContext thêm `playerIdentity` (persist);
IntroScreen thêm ô chọn Thân phận + đưa vào directive mở đầu +
resetDirectorState() khi truyện mới; RoleplayChat chèn nudge sau các note
trí nhớ; SettingsPage panel "Đạo diễn tình huống" (nhịp độ + thân phận +
checkbox romance).

**Đã test (node, rng inject)**: cooldown chặn đúng, xác suất chặn khi rng
cao, off tắt hẳn, không lặp thể loại liên tiếp, villain đúng vùng
(Sinnoh→Galactic) + placeholder điền sạch, pool clan ra "hứa hôn", pool
street ra "investigator", tắt romance quét 4000 lần không lọt seed romance,
không location không crash, mọi nudge kèm quy tắc công bằng.

**Cách test nhanh trong game**: tạo truyện mới, chọn thân phận "Con cháu
đại gia tộc" → chơi bình thường, để ý vài lượt một lần thế giới sẽ "cựa
mình" (đa dạng thể loại, thi thoảng dính chuyện gia tộc); mở DevTools xem
request /chat/completions — lượt nào có nudge sẽ thấy note "[Hệ thống —
ĐẠO DIỄN TÌNH HUỐNG…]" ở cuối, lượt sau note biến mất. Muốn yên bình chỉnh
nhịp "Thưa", muốn drama chỉnh "Dày".

**Đợt sau nếu cần**: hạt giống ĐA HỒI (tình huống nối tiếp có trạng thái —
VD vụ hứa hôn tiến triển qua nhiều chương theo phản ứng người chơi); pool
tuỳ chỉnh cho người dùng tự viết seed; trọng số theo thời gian trong ngày.

## Cập nhật mới (đợt 32) — ĐẠI TU TẠO NHÂN VẬT: 30 thân phận realistic, xuất thân, tay trắng nhận Pokémon trong truyện, 10 mở đầu, lịch in-game

**Tông thế giới chốt lại theo yêu cầu**: realistic kiểu Pokémon Special —
xã hội thật có sinh kế/giấy phép/cảnh sát, tổ chức tội phạm là TỘI PHẠM
THẬT (buôn lậu Pokémon, săn trộm, đường dây) chứ không tấu hài. Câu này
được ghi thẳng vào directive mở đầu.

**1. Màn tạo nhân vật MỚI (IntroScreen viết lại toàn bộ — bản cũ đã đối
chiếu từng tính năng)**: tên + GIỚI TÍNH (Nam/Nữ/Khác) + TUỔI + NGOẠI HÌNH
(textarea tự tả) + THÂN PHẬN + XUẤT THÂN (vùng → thành phố/khu từ bản đồ
9 vùng, 91 khu; bỏ trống = AI tự chọn trong vùng) + Pokémon khởi đầu +
NGÀY BẮT ĐẦU (d/m/y) + TÌNH HUỐNG MỞ ĐẦU. Hồ sơ persist
('trainer-arena:player-character') và được khai báo CỐ ĐỊNH trong system
prompt mỗi lượt (thân phận, giới tính/tuổi/ngoại hình, xuất thân).

**2. 30 THÂN PHẬN (data/identities.js)** chia 14 nhóm pool: dân lao động
(nông trại/dân chài/thợ mỏ/mồ côi), gia tộc (đại gia tộc/gia tộc sa sút/
con trainer nổi tiếng), giới xám NGHIÊM TÚC (giang hồ phố, chân chạy cho
tổ chức, cựu grunt rửa tay, con nhà buôn lậu Pokémon, chỉ điểm hai mang,
cựu phụ việc săn trộm), cảnh sát (học viên/con nhà cảnh sát/trợ lý Cảnh
sát Quốc tế), kiểm lâm, học thuật (nghiên cứu/khảo cổ), y tế (thực tập
trung tâm Pokémon/cứu hộ dã chiến), thi đấu (đệ tử gym/thí sinh bỏ dở),
truyền thông (phóng viên/nhiếp ảnh hoang dã), biểu diễn, thương lái,
nhân giống. Đạo diễn thêm 9 POOL NGHỀ mới (criminal/police/medic/breeder/
league/media/performer/merchant/laborer, ~30 seed mới cùng tông realistic)
— 30 thân phận map về pool qua poolKey. **THÂN PHẬN TỰ TẠO**: chọn "Tự
tạo…" → nhập tên + mô tả; dùng pool trung tính, mô tả tự viết vào thẳng
prompt; persist trong playerCharacter.customIdentity.

**3. POKÉMON KHỞI ĐẦU TỰ NHẬN (bỏ 4 nút starter cứng)**: ô gõ TÊN LOÀI
bất kỳ (datalist gợi ý từ pokedex thật, validate + preview "✓ sẽ bắt đầu
Lv8") — hoặc ĐỂ TRỐNG = **khởi đầu tay trắng**: AI được dặn việc nhận
Pokémon đầu tiên phải là khoảnh khắc có ý nghĩa từ diễn biến, cấp qua tag
mới **[[POKEMON Tên loài | Lv7]]** (app dựng chỉ số thật, vào đội ≤6,
thành mon ra trận nếu đang trắng tay; loài sai tên → bỏ qua + warn). Guard
tay trắng: resetBattle null-safe, quả pokeball bấm khi chưa có Pokémon →
alert hướng dẫn né trận trong truyện thay vì crash.

**4. 10 TÌNH HUỐNG MỞ ĐẦU (data/openings.js)** tông thực tế: buổi sáng
bình thường, ngày làm giấy phép trainer, rời nhà sau mâu thuẫn, ngày đầu
công việc theo thân phận, tai nạn nhỏ đảo lộn kế hoạch, chứng kiến chuyện
không nên thấy (không bị truy đuổi), món đồ người thân để lại, kẹt nơi
trú bão, ngày đầu tới thành phố lớn, món nợ buộc lên đường — kèm lựa
"🎲 AI tự nghĩ" và "✎ Tự viết".

**5. LỊCH IN-GAME (đợt 32)**: người chơi đặt ngày bắt đầu; GameContext
storyDate {day,month,year,part} persist; AI đẩy thời gian qua tag
**[[DATE +N]]** (qua ngày, tự về buổi sáng — cộng bằng Date thật, đã test
28/2 năm nhuận, giao thừa, năm nhỏ không bị JS map thành 19xx) và
**[[DATE buổi=sáng|trưa|chiều|tối|đêm]]**. Ngày giờ hiện tại được bơm vào
system prompt MỖI lượt + hiện ở RightHUD (📅). Instruction FACT được sửa:
sự kiện quan trọng NÊN kèm mốc ngày in-game trong nội dung — trí nhớ
keyword giờ có trục thời gian, đúng mục đích "nhớ chi tiết hơn để không
bị quên/không lẫn trình tự".

**Đã test**: parse [[POKEMON]]/[[DATE]] (kẹp Lv 1-100, cleaned sạch, tag
cũ không hỏng), 30 thân phận key unique + đủ poolKey, 10 mở đầu,
crime-runner ra pool criminal / nurse-trainee ra pool medic, custom
identity không crash, date math 3 case biên, esbuild + ngoặc sạch.

**Lưu ý tương thích**: STARTERS/sampleData không dùng ở IntroScreen nữa
(Dev tester vẫn dùng bình thường). **Đợt sau nếu cần**: mùa/thời tiết
theo lịch; sinh nhật nhân vật; thả Pokémon khỏi đội qua tag; điều kiện
thân phận mở khoá tình huống mở đầu riêng.

## Cập nhật mới (đợt 33) — Thời tiết theo lịch, lễ hội theo vùng, tư liệu canon Bulbapedia

**1. THỜI TIẾT THEO LỊCH (data/weather.js)**: mùa từ tháng in-game (3-5
xuân / 6-8 hạ / 9-11 thu / 12-2 đông), mỗi mùa 6 kiểu trời có trọng số;
DETERMINISTIC theo hash(ngày+khu) — reload không "đổi trời", sang ngày
([[DATE +1]]) là trời mới. Tiểu khí hậu theo chất khu (tái dùng
classifyAreaType): hang → ổn định không thấy trời, núi lửa → nóng + lưu
huỳnh (đông vẫn ấm), băng → lạnh quanh năm, biển → gió mạnh đổi nhanh,
nơi huyền thoại → "không khí nặng và tĩnh, tách khỏi thời tiết ngoài".
Bơm vào system prompt mỗi lượt kèm lệnh "kể khớp, không tự đổi trời vô
cớ"; hiện ở RightHUD dưới ngày (icon + mùa).

**2. LỄ HỘI THEO VÙNG (data/festivals.js)**: 18 lễ hội / 9 vùng (mỗi vùng
2, curated hợp khí chất vùng — Đêm đèn lồng Lavender trang nghiêm, Lễ rước
lông vũ Ecruteak, Tuần thời trang Lumiose, Đêm lửa đồng hoang Galar...).
Đang ở vùng nào + tới ngày (hoặc còn ≤6 ngày, có xử lý vòng năm 28/12→10/1)
→ bơm dòng ngữ cảnh "HÔM NAY đang trong lễ X…" / "N ngày nữa tới lễ Y, dân
đã lục tục chuẩn bị". Pool slice-of-life của Đạo diễn cộng hưởng tự nhiên.

**3. TƯ LIỆU CANON BULBAPEDIA (services/wikiLookup.js +
data/canonCharacters.js)** — trả lời câu "có cần lorebook không": lorebook
thủ công của card VẪN GIỮ cho thiết lập riêng; còn thông tin nhân vật GỐC
giờ tự động: ~85 tên canon (gym leader, nhà vô địch, giáo sư, trùm phản
diện, nhân vật anime — map tên → đúng tiêu đề trang, tránh tên ngắn dễ
nhầm) — truyện nhắc tên nào là app tra MediaWiki API của Bulbapedia
(CORS origin=*, timeout 5s) lấy tóm tắt mở đầu, cắt 900 ký tự, bơm vào
prompt như "TƯ LIỆU CANON phải nhất quán" (AI vẫn kể tiếng Việt). Cache
localStorage TTL 7 ngày trần 60 trang (cache cả trang-không-tồn-tại),
mỗi lượt tối đa 2 tên (ưu tiên tên dài: "Ash Ketchum" thắng "Ash"),
mỗi tên 10 lượt mới bơm lại, lỗi mạng chỉ warn không chặn truyện.
Panel Cài đặt: bật/tắt + nút "Kiểm tra kết nối" (tra thử trang Misty) +
xoá cache.

**Đã test**: mùa 4 mốc, deterministic, override hang/băng-giữa-hè/endgame,
18 lễ hội đủ 9 vùng, đang-lễ/sắp-lễ/vòng-năm/không-lây-vùng-khác, parse
extract MediaWiki (trang rỗng → null, cắt 900), dò canon ưu tiên tên dài
tối đa 2. Lưu ý: fetch Bulbapedia thật chỉ test được khi chạy app có mạng
— đã có nút Kiểm tra kết nối trong Cài đặt để bạn xác nhận.

## Cập nhật mới (đợt 34) — Wizard tạo nhân vật 4 trang, LUÔN tay trắng, quạt gimmick icon + màu hệ

**1. MÀN TẠO NHÂN VẬT v3 — WIZARD 4 TRANG (IntroScreen viết lại lần 2,
bản v32 đã backup đối chiếu)**: thanh tiến trình 4 bước (bấm quay lại bước
đã qua được) — (1) Hồ sơ: tên/giới tính/tuổi/ngoại hình + hộp giải thích
"vì sao không chọn Pokémon"; (2) Thân phận: 30 thân phận thành CARD có mô
tả đầy đủ, gom 13 NHÓM có tiêu đề (Dân lao động / Gia tộc / Giới xám /
Thực thi pháp luật...), card "Tự tạo" cuối danh sách; (3) Xuất thân: 9
vùng thành card kèm BLURB khí chất từng vùng (viết mới, tông realistic)
+ chọn khu + ngày bắt đầu (hiện luôn "→ mùa X" theo tháng đang gõ);
(4) Mở đầu: 12 card (AI tự nghĩ / 10 tình huống hiện NGUYÊN VĂN mô tả /
tự viết) + Ô TỔNG KẾT NHÂN VẬT trước khi bấm "✦ Bắt đầu hành trình".

**2. BỎ HẲN MỤC POKÉMON KHỞI ĐẦU**: người chơi LUÔN bắt đầu tay trắng —
directive cấm phát Pokémon trong đoạn mở đầu, việc nhận Pokémon đầu tiên
là cột mốc chương đầu (nhân vật <10 tuổi: cho phép muộn hơn nữa, vài
chương sau, tuỳ hoàn cảnh — đúng yêu cầu), cấp qua [[POKEMON]]. Guard
tay trắng của đợt 32 (pokeball alert, resetBattle null-safe) phát huy.

**3. QUẠT GIMMICK v2 (fix theo ảnh chụp người dùng)**: chữ M/Z/D/T →
BIỂU TƯỢNG 🧬 Mega / ⚡ Z / 🌀 Dynamax / 💎 Tera; nút TERA nhuộm MÀU HỆ
tera (hệ chính của Pokémon, TYPE_COLORS — key lowercase khớp move/mon
data, đã kiểm); khi ngắm Z-Move, nút chiêu sát thương nhuộm viền + chữ
"⚡Z-{tên}" theo MÀU HỆ CHIÊU; chip TERA trên StatusCard cũng theo màu hệ.
FIX BUG CẮT MÉP: cung quạt 170°→20° cũ đẩy nút Mega ra ngoài mép panel
(ảnh người dùng cho thấy chỉ còn Z/D/T) — thu cung về 150°→15°, R=48,
wrapper thêm paddingLeft 46 → cả 4 nút nằm gọn trong panel.

**Đã test**: esbuild + ngoặc sạch toàn bộ; IntroScreen không còn tham
chiếu starter; TYPE_COLORS casing khớp. **Cách test nhanh**: tạo truyện
mới đi đủ 4 trang wizard (thử card thân phận nhóm Giới xám đọc mô tả);
Dev → Test Battle chọn Charizard → FIGHT → quạt: đủ 4 icon không bị cắt,
bấm ⚡ rồi nhìn 2 chiêu sát thương đổi màu theo hệ, 💎 mang màu hệ lửa.

**Đợt sau nếu cần**: ảnh minh hoạ/icon cho card thân phận; lưu nhiều
nhân vật (slot); nút Mega dùng hình biểu tượng Mega chính thức (cần bạn
bỏ file ảnh vào public/ vì icon gốc có bản quyền).

## Cập nhật mới (đợt 35) — Fix bug bậc chỉ số 3 tầng (Rapid Spin/Growl câm), môi trường trận đấu, Dev thêm Test nhạc/map

**1. BUG 3 TẦNG khiến hiệu ứng bậc chỉ số không chạy (báo cáo từ ảnh
người dùng — Rapid Spin không cộng tốc)**: hệ applyBoosts đợt 27 CÓ sẵn
nhưng dữ liệu không bao giờ tới được nó:
- Tầng 1 (thủ phạm chính, pokemonSpecies): dòng pick chiêu chỉ giữ
  name/type/power/category/secondary — CẮT MẤT self/boosts/target/flags/
  recoil → Rapid Spin (self.boosts spe+1), recoil, recharge đều chết từ
  nguồn. Fix: `picked.push({ ...mv })`.
- Tầng 2 (movesFetch): bảng `all` (chiêu Status) không giữ boosts/target/
  self/secondary → Growl/String Shot "Gây 0 sát thương" xong thôi. Fix +
  BUMP cache key moves-cache-v4 → v5 (cache lưu output đã xử lý, không
  bump thì người dùng cũ vẫn thiếu field).
- Tầng 3 (BattleModal): chưa xử lý `boosts` TOP-LEVEL của chiêu Status —
  thêm cho cả 2 phe, đích theo move.target ('self' → chính mình).
StageChips hiển thị sẵn → giờ tăng/giảm bậc hiện chip ▲▼ như đợt 27 định.

**2. MÔI TRƯỜNG TRẬN ĐẤU (data/battleEnvironments.js)**: 8 môi trường
(mưa/nắng gắt/giông/tuyết/bão cát/núi lửa/hang/không) nhân hệ số sát
thương theo HỆ chiêu cho CẢ 2 phe (mưa: nước +25% lửa −25%...), banner
hiện trong BattleModal. Trận TRONG TRUYỆN tự lấy môi trường từ thời tiết
theo lịch (envFromWeather — giông ưu tiên trước mưa, đã test); Dev Test
Battle có select chọn tay để thử.

**3. DEV thêm 3 tab**: **Test nhạc** (bấm phát thử từng track key +
jingle + widget, khỏi tạo nhân vật), **Test map** (duyệt 9 vùng + ảnh +
thời tiết hôm nay + phản diện vùng, nút "Đặt làm vị trí người chơi"),
và select môi trường trong Test Battle.

## Cập nhật mới (đợt 36) — FIX CRASH cập nhật biến, API cập nhật biến, map vùng hiện tại + chấm đỏ, shop dân sự, độ đói

**1. FIX BUG NGHIÊM TRỌNG (ảnh người dùng: "setPlayerMon is not
defined")**: tag [[POKEMON]] đợt 32 gọi setPlayerMon nhưng destructure
useGame() THIẾU nó → crash giữa pipeline, mọi cập nhật biến phía sau
(date/hunger/npc/fact) chết theo, người chơi "có Pokémon rồi mà app bảo
chưa". Fix + REFACTOR: gom toàn bộ áp tag vào applyParsedState(), TỪNG
PHẦN bọc try/catch riêng — 1 tag lỗi không giết cả pipeline nữa. Đồng
thời phát hiện + vá cùng họ bug: setParty/setPlayerProfile/setInventory
là wrapper persist KHÔNG nhận functional updater (gọi dạng hàm sẽ crash/
ghi rác localStorage) → nâng cấp cả 3 nhận được cả 2 dạng.

**2. API CẬP NHẬT BIẾN (services/stateExtractor.js + StateApiSection
trong Cài đặt, có nút Tải model + Kiểm tra)**: model phụ đọc lại chính
văn + danh sách tag ĐÃ áp, chỉ xuất BỔ SUNG tag còn thiếu (MONEY/REL/
POKEMON/HUNGER/DATE/NPC/FACT), trả 'KHONG_CO' nếu đủ; app lọc đúng dòng
dạng [[...]] (model lỡ nói thêm bị bỏ), parse bằng đúng
parseStoryStateTags và áp qua đúng pipeline. Chạy nền, temperature 0.

**3. MAP**: tích hợp 9 ảnh bản đồ NGƯỜI DÙNG TỰ VẼ (kanto/hoenn .jpg,
còn lại .png — đã copy vào public/maps/). Modal bản đồ TRONG TRUYỆN giờ
chỉ hiện VÙNG ĐANG Ở (fixedRegion — tự đổi theo vị trí, ẩn dropdown);
Dev Test map vẫn duyệt cả 9. **CHẤM ĐỎ vị trí người chơi**: nhấp nháy
(keyframes pulse) tại toạ độ % của khu — data/mapPins.js phủ ĐỦ 91/91
khu (đã cross-check key khớp regions.js 100%), toạ độ theo địa lý
canonical (đã đối chiếu ảnh Kanto người dùng vẽ bám layout gốc), lệch
thì CHỈNH TAY % ngay trong file, chú thích rõ.

**4. SHOP**: tab Test Shop trong Dev (mở đúng modal [[SHOP]], mua thử
trừ tiền + cộng túi đồ THẬT); thêm 15 mặt hàng DÂN SỰ + trainer thường
ngày (suất cơm/sandwich/mì gói/lương khô, thức ăn Pokémon 3 loại, áo
mưa/đèn pin/túi ngủ/thẻ điện thoại/túi sơ cứu người/bản đồ giấy/xịt côn
trùng) chia 3 category mới: Đồ ăn thức uống / Thức ăn Pokémon / Đồ dùng
sinh hoạt.

**5. ĐỘ ĐÓI (độ no 0-100, người + Pokémon)**: 2 thanh trong PlayerHUD
dưới Sinh lực (đỏ khi <30 kèm "— đói!"). ĐIỀU KIỆN CẬP NHẬT đúng yêu
cầu: (a) app TỰ TRỪ 18/ngày mỗi bên khi [[DATE +N]] đẩy lịch (decay đặt
trong advanceStoryDate — chú ý thứ tự khai báo adjustHunger TRƯỚC để
tránh TDZ, đã tự bắt lỗi này khi code); (b) AI tag [[HUNGER người+25]] /
[[HUNGER pokemon-10]] khi ăn uống/lao lực rõ (instruction đã thêm);
(c) độ no hiện tại bơm vào prompt mỗi lượt, <30 kèm lệnh "thể hiện cơn
đói tự nhiên trong lời kể". API cập nhật biến cũng bắt được HUNGER.

**Đã test (node)**: HUNGER parse + cleaned, envFromWeather 5 case (giông
ưu tiên trước mưa), applyEnvToDamage 5 case, pin 91/91 khớp key, kiểm
tĩnh pick-spread + cache v5, extractor lọc dòng tag + KHONG_CO → null,
thứ tự khai báo hunger/date đúng, esbuild + ngoặc sạch toàn bộ.

**Cách test nhanh**: (a) Trận: Dev → Test Battle, cho Blastoise dùng
Rapid Spin → log "Tốc độ tăng" + chip ▲SPE; chọn môi trường "Trời mưa"
xem chiêu nước gây đau hơn hẳn. (b) Biến: bật API cập nhật biến trong
Cài đặt → Kiểm tra trích xuất phải ra tag MONEY/HUNGER từ câu mẫu.
(c) Map: mở Bản đồ trong truyện — chỉ vùng đang ở + chấm đỏ nhấp nháy
đúng khu. (d) Đói: Sổ tay xem 2 thanh độ no; để AI ngủ qua đêm
([[DATE +1]]) thấy tụt 18. (e) Shop: Dev → Test Shop mua suất cơm.

## Cập nhật mới (đợt 37) — Cửa hàng động (30-300 món, thương hiệu), mặc cả + suy nghĩ NPC, chế độ Safari

**1. GIAO THỨC CỬA HÀNG ĐỘNG**: tag mở rộng `[[SHOP Tên | loại=... | quy
mô=nhỏ/vừa/lớn]]` (tương thích ngược tag cũ không field). loại ∈ {trainer,
tạp hoá, quần áo, dã ngoại, leo núi, bách hoá}.
- **trainer** → danh sách tĩnh như game (bóng/thuốc/status từ shopItems.js).
- **dân dụng** → `generateShopItems` TỰ SINH 30-300 món theo quy mô (nhỏ
  30-60 / vừa 90-150 / lớn 200-300), tổ hợp THƯƠNG HIỆU × dòng sản phẩm ×
  biến thể (màu/size). Thương hiệu: Silph Co./Devon Corp./Macro Cosmos +
  hãng nhỏ tự chế (Old Cedar Workshop, Route 9 Surplus...) mỗi hãng có tier
  giá riêng; giá = giá gốc × tier × dao động ±15% (làm tròn bội số 5).
  DETERMINISTIC seed theo TÊN cửa hàng (mulberry32) — mở lại đúng quán là
  đúng từng món từng giá. AI được dặn KHÔNG tự liệt kê hàng trong chính văn.

**2. NÓI CHUYỆN + MẶC CẢ trong ShopModal (giao thức suy nghĩ NPC)**: ô hỏi
chủ quán ngay trong giỏ hàng — hỏi có hàng gì (app TRA KHO THẬT theo từ
khoá rồi đưa vào prompt để NPC không bịa), xin giảm giá, tán gẫu. Chủ quán
có TÍNH CÁCH deterministic theo tên (6 loại: xởi lởi/kèo kẹt/mệt mỏi/con
buôn lão luyện/thẳng thắn/mê Pokémon). Model được lệnh SUY NGHĨ THẦM 4 bước
(khách hỏi gì → tra kho → soi lời mặc cả theo tính cách → chốt) rồi chỉ
xuất thoại + 1 dòng tag `[[KETQUA giảm=X]]`/`[[KETQUA tặng=Món]]`/`[[KETQUA
không]]`. Giảm giá TRẦN 25%, cộng dồn; kỳ kèo dai thì chủ quán cứng dần
(refusedRef). Quà tặng vào túi giá 0. UI hiện tạm tính gạch ngang + giá sau
giảm + dòng quà.

**3. CHẾ ĐỘ SAFARI (SafariModal)**: khu có `safari:true` (Fuchsia/Safari
Zone, Veilstone/Great Marsh — đã đánh dấu; helper isSafariArea +
textMentionsSafari). Ở trong khu Safari mà mở pokeball → RoleplayChat render
SafariModal THAY BattleModal: KHÔNG đánh nhau, mỗi lượt Ném bóng Safari
(30 bóng)/Ném mồi/Nói chuyện dụ dỗ/Bỏ đi. 2 chỉ số ẩn: catchScore (khả
năng bắt) + fleeChance (cảnh giác). Mồi +catch +flee; nói chuyện do AI chấm
qua tag `[[DUDO catch=+N flee=-M]]` (lời hay tăng bắt/giảm cảnh giác); ném
bóng roll theo catchScore. Bắt được → vào đội (outcome 'caught', đã có nhãn
+ jingle victory từ đợt 30). Dev: Test Battle thêm nút "🌿 Thử Safari".

**Đã test (node)**: SHOP object parse + tương thích ngược; generator số
món đúng quy mô + deterministic + có Silph/Devon/hãng nhỏ + giá bội 5 +
category hợp lệ + leo núi ưu tiên đồ leo núi + ID không trùng; tính cách
chủ quán deterministic; parse [[KETQUA]] (giảm/trần 25/không) + [[DUDO]];
isSafariArea/textMentionsSafari; esbuild toàn bộ sạch.

**Cách test nhanh**: (a) Dev → Test Shop: đổi loại "leo núi" quy mô "lớn"
→ mở xem ~250 món có thương hiệu; gõ "có dây leo núi không" hoặc "giảm giá
cho mình với" vào ô hỏi chủ quán. (b) Dev → Test Battle: chọn Pokémon phe
địch → "🌿 Thử Safari" → ném mồi/nói chuyện/ném bóng. (c) Trong truyện:
đi vào Fuchsia/Safari Zone rồi mở pokeball → tự vào chế độ Safari.

## Cập nhật mới (đợt 38) — FIX preset ngoài mất chính văn, FIX lỗi API test, pin bản đồ theo chính văn, loader Pokéball

**1. FIX BUG NGHIÊM TRỌNG — "dùng preset ngoài thì mất chính văn" (ảnh
người dùng: chỉ hiện `<content></content>` rỗng + metadata)**: preset Tawa/
AvarsiSkull bắt AI bọc chính văn trong `<content>...</content>`, kèm
`<thinking>` trước và `<Technical_Footer>/<danmu>/<disclaimer>` sau. App
trước đây KHÔNG bóc `<content>` → hiển thị nguyên cụm tag. Viết lại
`cleanAiOutput` (outputCleanup.js): (0) BÓC phần trong `<content>` trước
tiên — hỗ trợ nhiều khối, hỗ trợ `<content>` bị cắt stream chưa đóng;
(1) áp regexScripts preset; (2) luôn gỡ khối hậu kỳ; (3) gỡ `<safe>` kiểu
NỐI CHỮ ("âm<safe>đạo"→"âmđạo", vì preset chèn vào GIỮA từ để né lọc, xoá
cả cụm là mất chữ); (4) gỡ thẻ lẻ sót. Đã test 5 case.

**2. FIX LỖI GỌI API KHI TEST (ảnh: "Thiếu Base URL hoặc Model" dù đã kết
nối)**: ShopModal + SafariModal lỡ dùng `outcomeApiConfig ?? apiConfig` làm
config chat — nhưng `outcomeApiConfig` là `{escaped, lose}` (config theo
TUYẾN kết quả, không có baseUrl/model), object truthy nên `??` không lùi
về apiConfig → luôn báo thiếu URL. Sửa: dùng thẳng `apiConfig`.

**3. PIN BẢN ĐỒ — canh lại + NỐI VỚI CHÍNH VĂN**:
- Toạ độ Kanto canh lại theo ĐÚNG ảnh bạn vẽ (kanto.jpg 1200x1125, đọc
  từng nhãn): Pallet giữa-dưới [25,61], Pewter góc trên [26,16],
  Cerulean [66,24]... (trước đây theo layout canonical nên lệch — Pallet
  rơi xuống biển như ảnh báo).
- Vị trí giờ NỐI VỚI CHÍNH VĂN theo 3 mức ưu tiên: (1) tag tường minh
  `[[MOVE Tên khu]]` (mới thêm vào protocol + instruction), (2) dòng
  `[Metadata|..|Vùng|Khu|..]` của preset — `detectLocationFromMetadata`
  đọc trên reply GỐC (vì cleanAiOutput đã bóc mất dòng đó), (3) fallback
  quét địa danh trong chính văn như cũ. Chấm đỏ nhấp nháy hiện đúng khu
  người chơi đang ở, tự đổi khi truyện đổi chỗ.

**4. LOADER QUẢ POKÉBALL XOAY (PokeballSpinner.jsx)**: khi tạo nhân vật
bấm "Bắt đầu hành trình", cả màn chuyển sang quả Pokéball SVG xoay + nhún
kèm chữ "Đang viết khởi đầu..." thay cho chữ tĩnh. Tái dùng được ở mọi
chỗ chờ AI.

**Về preset của bạn (Tawa δέλτα Kaiz Shirona)**: cấu trúc output 3 lớp
`<thinking>` → `<content>` → `<Technical_Footer>` giờ được app hiểu đúng —
chỉ chính văn trong `<content>` hiển thị, phần còn lại (CoT, danmu,
disclaimer) tự ẩn. Mật mã `<safe>` chèn giữa từ được nối lại đúng.

**Đã test (node)**: bóc content 5 case (đầy đủ/safe nối chữ/cắt stream/
không content/text trơn); metadata→location (Kanto Pallet, đổi Cerulean);
pin Pallet khớp toạ độ ảnh; MOVE tag parse; esbuild + parse toàn bộ sạch.
Ảnh bản đồ 9 vùng của bạn đã tích hợp từ đợt 36.

## Cập nhật (đợt 39) — Xác nhận: lối chơi chính dùng combat GAME GỐC; Anime để BETA

Kiểm tra luồng chơi thật: khi bắt đầu game qua màn tạo nhân vật →
RoleplayChat → mở pokeball, trận đấu LUÔN dùng `BattleModal` (combat game
gốc theo lượt) hoặc `SafariModal` (khu Safari). RoleplayChat KHÔNG hề
import/gọi `AnimeBattleTester` — chế độ anime chỉ tồn tại trong Dev tab.
Vậy mặc định đã đúng yêu cầu. Chỉ đổi nhãn Dev tab thành "Test Combat
Anime (BETA)" + thêm banner cảnh báo beta phía trên để rõ ràng; không đụng
gì tới lối chơi chính.

## Cập nhật (đợt 39) — FIX màn hình đen, level Charmander Lv35, reroll/sửa tin, highlight món shop, map Sinnoh

**1. FIX "Test Battle mất hết màn hình" (ảnh: đen thui)**: chưa có
ErrorBoundary nên bất kỳ lỗi runtime nào cũng gỡ toàn bộ cây React → đen
màn. Thêm `ErrorBoundary.jsx` bọc cả app (main.jsx): lỗi giờ hiện thông
báo + chi tiết + nút "Thử lại"/"Tải lại", truyện không mất (vẫn trong
localStorage). Đây là lưới an toàn cho MỌI lỗi tương lai.

**2. FIX HỆ THỐNG RANDOM LEVEL (ảnh: ngày đầu gặp/nhận Charmander Lv35 dù
chưa tiến hoá)**: tạo `levelLogic.js` với `evolutionLevelCap` (loài cơ
bản còn tiến hoá được như Charmander bị ép trần ~18, loài cuối/huyền
thoại thả trần), `smartWildLevel` (giao của dải-khu ∩ trần-tiến-hoá ∩
tầm-đội-hình), `sanitizeReceivedLevel` (ép level starter/quà nhận qua
[[POKEMON]] về mức hợp lý nếu AI ghi bừa). Pokedex thêm hasPrevo/hasEvo/
bst (cache bump v6). randomWildLevel cũng nhận partyLevel để kẹp. Test:
500 lần wild Charmander Pallet ngày đầu → max Lv5, không bao giờ Lv35;
starter Lv35 → sanitize còn ≤8.

**3. REROLL + SỬA TIN (ảnh: chuột phải không có mục sửa/gửi lại)**: mỗi
tin có nút ✎ Sửa (sửa cả tin người chơi lẫn chính văn AI, lưu tại chỗ);
tin AI CUỐI có thêm nút ↻ Reroll (bỏ lượt vừa rồi, viết lại từ đúng ngữ
cảnh — cứu khi bị cắt/lỗi/không ưng).

**4. HIGHLIGHT MÓN SHOP ĐƯỢC GIỚI THIỆU (ảnh: chủ quán gợi ý Trà hoa cúc
nhưng phải tự tìm giữa 114 món)**: khi chủ quán nhắc/giới thiệu món nào
trong lời thoại (hoặc tra-kho khớp), món đó được VIỀN XANH + tự cuộn tới,
kèm nút "Chỉ hiện món được giới thiệu" để lọc nhanh.

**5. MAP**: canh lại pin Sinnoh theo ảnh bạn vẽ (Twinleaf góc dưới-trái,
Snowpoint đỉnh, Veilstone phải-giữa...) + nhích pin Pallet (Kanto) khỏi
mép nước. Vị trí vẫn tự bám chính văn (MOVE tag > metadata > prose) như
đợt 38. Các vùng còn lại nếu lệch, chỉnh % trong mapPins.js.

**Về preset tùy chỉnh "3 lần không được"**: cấu trúc preset của bạn import
ĐÚNG (152/210 prompt bật, prompt_order đọc chuẩn) — lỗi trong ảnh là
"Failed to fetch (CORS/mạng)" từ endpoint gcli.ggchan.dev lúc tạo nhân
vật, KHÔNG phải lỗi app. Preset Gemini để openai_max_tokens=100000 nên
phần "thinking" ăn nhiều token; nếu chính văn thi thoảng bị cắt, dùng nút
↻ Reroll mới thêm để viết lại. Bản dựng sẵn "chạy luôn" vì nhẹ hơn.

**Đã test (node)**: level 500 lần không vượt trần, sanitize starter, kẹp
theo đội, content-extract không hồi quy, pin Sinnoh khớp 10/10; esbuild +
parse toàn bộ 47 file sạch.

## Cập nhật (đợt 40) — GIAO THỨC LEVEL ĐA YẾU TỐ (thế giới có logic riêng, không xoay quanh người chơi)

Thay "trần cứng theo đội hình" (đợt 39) bằng ENGINE LEVEL NGỮ CẢNH
(levelLogic.js viết lại) — level của mỗi Pokémon là kết quả của hoàn cảnh
thế giới của NÓ, không phải sức người chơi:

**Pokémon HOANG (`wildLevel`)** gộp nhiều lực kéo:
- NỀN KHU: dải level của khu (Pallet [2,5] … Victory Road [40,50]).
- ĐỊA HÌNH/CHIỀU SÂU: khu an toàn (town/village) kéo xuống; hang/hầm/đỉnh/
  endgame kéo lên mạnh.
- KHU ĐƯỢC CANH GIỮ: nơi có champion/giáo sư đời trước (Pallet có Giáo sư
  Oak — cựu champion) kéo xuống → Pokémon mạnh gần như không mò tới, đúng
  như bạn nói.
- VAI TRÒ CÁ THỂ: con non / cá thể thường / ĐẦU ĐÀN / lão làng lãnh thổ —
  cùng khu nhưng đầu đàn mạnh hơn hẳn con non.
- GIAI ĐOẠN TIẾN HOÁ: loài đã tiến hoá hết (Charizard) xu hướng level cao;
  loài cơ bản còn non thì thấp — là lực kéo NHẸ, không chặn.

**Pokémon của NPC TRAINER (`trainerMonLevel`)**: theo THÂN PHẬN + TUỔI +
KINH NGHIỆM + nền vùng, và dàn đội (quân đầu yếu hơn quân chủ lực). 11
đẳng cấp: child/youth/rookie/veteran/ace/gym/elite/champion + grunt/admin/
boss (tổ chức tội phạm). VD champion ~Lv71, lính quèn ~Lv24-29, trẻ con
mới tập ~Lv7-17.

**Pokémon người chơi NHẬN (`receivedMonLevel`)**: tôn trọng level AI đề
xuất, chỉ NẮN MỀM về vùng hợp lý nếu lệch xa hoàn cảnh (starter Charmander
Lv35 ngày đầu ở Pallet → kéo về ~Lv11, không phải chặn cứng Lv8).

Instruction cho AI cũng cập nhật triết lý này để nó tự ghi level đúng tinh
thần. Dev thêm tab "Test Level" — thử mọi tổ hợp khu × vai trò × thân phận
trainer, xem dải min–median–max, khỏi vào truyện.

**Bằng chứng (node)**: Charmander hoang Pallet Lv2 / route thường Lv13 /
Victory Road Lv48; cùng Cerulean con non Lv9 vs đầu đàn Lv16; Charizard
cao hơn Charmander cùng khu; trainer child→champion Lv17→71. Engine không
tham chiếu level đội người chơi ở bất kỳ đâu.

## Cập nhật (đợt 41) — Worldbook trong Cài đặt, bỏ character card Elara, worldbook > wiki, mở đầu bám lựa chọn, chính văn dài hơn

**1. WORLDBOOK (utils/worldbook.js + WorldbookSection)**: nhập file World
Info/Lorebook .json xuất từ SillyTavern ngay trong Cài đặt chung. Parse
đúng format ST ({entries:{...}}): key/keysecondary (AND/OR qua
selectiveLogic), constant (luôn bật), disable, order (ưu tiên), comment,
matchWholeWords/caseSensitive. Kích hoạt theo từ khoá trong ngữ cảnh gần;
constant luôn vào (ưu tiên tuyệt đối, không bị cắt budget); trần 16000 ký
tự. UI: nhập/xoá + danh sách entry (★ = constant) + bật/tắt từng cái. Test
với file của bạn: 219 entry, 3 constant luôn bật.

**2. BỎ CHARACTER CARD ELARA**: character mặc định giờ RỖNG (không còn
Elira/Elara). Gỡ hẳn khối "Sửa character card" trong màn chơi — thay bằng
header gọn "TRAINER ARENA + tên người chơi + Xoá lịch sử". Worldbook là
thứ chính người dùng nhập, không lệ thuộc character card nữa.

**3. AI ĐỌC CẢ WORLDBOOK LẪN WIKI, ƯU TIÊN WORLDBOOK**: mỗi lượt, entry
worldbook kích hoạt + tư liệu wiki Bulbapedia (nếu nhắc nhân vật canon)
đều được bơm vào prompt. Thêm ghi chú nguồn: khi 2 nguồn MÂU THUẪN, AI
phải theo WORLDBOOK; wiki chỉ bổ sung chi tiết worldbook không nói. Áp cả
nhánh preset lẫn mặc định.

**4. MỞ ĐẦU BÁM LỰA CHỌN LÚC TẠO NHÂN VẬT**: tình huống mở đầu (chọn sẵn
hoặc tự viết) giờ được đánh dấu "BẮT BUỘC BÁM THEO — là hạt nhân đoạn mở
màn, không thay bằng cảnh khác". Worldbook cũng được nạp ngay từ đoạn mở
đầu.

**5. CHÍNH VĂN DÀI HƠN**: thêm chỉ thị PROSE_QUALITY (300-600 từ/lượt,
nhiều đoạn, giàu giác quan, không cụt lủn) vào cả 2 nhánh prompt; đoạn mở
đầu yêu cầu 400-700 từ. Về vụ token: app KHÔNG cap dưới mức preset —
maxTokens của preset (kể cả 100k) được truyền nguyên. Chính văn ngắn là do
model chưa được yêu cầu viết dài (giờ đã có chỉ thị) chứ không phải bị
chặn token; nếu vẫn ngắn, dùng nút ↻ Reroll (đợt 39).

**Đã test (node)**: parse worldbook thật 219 entry, constant luôn bật (3/3
sau khi ưu tiên), matchWholeWords, disable loại đúng; esbuild + parse toàn
bộ file sạch. LƯU Ý: worldbook của bạn có nội dung NSFW — app chỉ lưu +
chuyển tiếp vào prompt của bạn, không đọc/lọc nội dung.

## Cập nhật (đợt 42) — FIX Test Battle crash, gimmick cần vật phẩm, FIX worldbook bị nuốt, kiểm tra prose/summary

**1. FIX "Test Battle: envKey is not defined" (ảnh đen màn)**: state
`envKey` của BattleTester bị mất qua các đợt refactor → crash mỗi lần mở
Test Battle. Khôi phục khai báo state. (ErrorBoundary đợt 39 đã bắt được
nên hiện thông báo thay vì đen hẳn — giờ hết lỗi luôn.)

**2. GIMMICK CẦN VẬT PHẨM (ảnh: tự có Z-Move/Dynamax từ đầu)**: Mega/Z/
Dynamax/Terastal giờ CHỈ dùng được khi có "chìa khoá" trong túi đồ:
Mega→Key Stone+Mega Stone, Z→Z-Ring+Z-Crystal, Dynamax→Dynamax Band (chỉ
Galar), Tera→Tera Orb (chỉ Paldea). Chưa có thì nút hiện mờ + lý do ("cần
… chưa có trong túi"). Không còn tự nhiên có gimmick từ lượt đầu.

**3. FIX WORLDBOOK BỊ NUỐT (gốc rễ vụ "Oak nói năng kỳ, không nhận
worldbook")**: bug budget — 3 entry `constant` to (thế giới quan, ~15700
ký tự) ăn hết ngân sách 16000 khiến entry khớp từ khoá như "Giáo sư Oak"
(mô tả Oak ấm áp) BỊ LOẠI OAN. Sửa: constant luôn vào và KHÔNG tính vào
budget của nhóm keyword → giờ nhắc "Giáo sư Oak" là entry Oak vào prompt.
Cũng tăng sức mạnh chỉ thị: tính cách/vai trò nhân vật trong worldbook
phải được tôn trọng KỂ CẢ khi văn phong preset có xu hướng khác (preset
Tawa vốn có giọng u ám — đó là lý do Oak bị viết cộc cằn/hút xì gà; giờ
worldbook sẽ kéo lại).

**4. TÓM TẮT & SỔ TAY KHÔNG CẦN EMBEDDING (giải đáp)**: đã kiểm — tóm tắt
cốt truyện dùng API CHÍNH (không cần embedding), tự chạy mỗi ~12 tin; sổ
tay NPC/Fact dùng tag [[NPC]]/[[FACT]] (không cần embedding). Ảnh cho thấy
0/0 và "chưa có tóm tắt" là vì truyện mới bắt đầu (chưa đủ 12 tin, chưa có
tag nào fire) — KHÔNG phải lỗi. Chỉ lớp "ký ức vector" mới cần embedding.

**Về văn phong "kỳ cục"**: không phải lỗi worldbook/wiki — đó là GIỌNG của
preset Tawa bạn đang dùng (u ám, gai góc). Worldbook giờ nhận đúng và sẽ
kéo tính cách nhân vật canon về đúng mô tả của bạn ở các lượt có nhắc tên
họ. Lượt mở đầu chưa nhắc "Oak" nên entry Oak chưa kịp vào — từ lượt Oak
xuất hiện trở đi thì có (cơ chế quét từ khoá giống hệt SillyTavern).

**Đã test (node)**: entry Oak vào prompt khi nhắc tên (sau fix budget);
gimmick gated đúng; envKey khôi phục; esbuild + parse toàn bộ sạch.

## Cập nhật (đợt 43) — FIX lộ khối "Thúc đẩy đồng nhân", budget worldbook 2M, mua hàng ra chính văn

**1. FIX LỘ KHỐI CoT/"Thúc đẩy đồng nhân" thay vì chính văn (ảnh mới)**:
đọc kỹ preset Tawa — cấu trúc chuẩn là `<thinking>` → tiêu đề → `<content>
CHÍNH VĂN </content>` → rồi các block hậu kỳ (`<Thúc đẩy đồng nhân>`,
schedule, theater, danmu...). Viết lại cleanAiOutput: nếu có `<content>`
thì CHÍNH VĂN = CHỈ phần trong đó, VỨT SẠCH mọi thứ ngoài (kể cả block
"Thúc đẩy đồng nhân" trước đây bị lộ nguyên si). Xử lý cả trường hợp
content chưa đóng (cắt trước block hậu kỳ đầu tiên) và trường hợp AI quên
content (trả rỗng → app báo để reroll thay vì hiện rác). Test 5 case.

**2. BUDGET WORLDBOOK 16K → 2 TRIỆU KÝ TỰ (≈ không giới hạn như ST)**:
bạn đúng — SillyTavern nuốt được worldbook cực lớn nên 16k là quá nhỏ.
Nâng trần để MỌI entry khớp đều vào, không lo chi phí. Cùng với fix
constant-tách-budget (đợt 42), giờ worldbook được nạp ĐẦY ĐỦ.

**3. WORLDBOOK NHẬN TỪ CHƯƠNG 1**: đã kiểm — ngay LƯỢT MỞ ĐẦU, worldbook
vào prompt 25.000 ký tự gồm cả danh sách nhân vật quan trọng (các entry
constant luôn bật). Nên AI nhận diện nhân vật + đúng canon từ chương 1,
không phải chờ. (Lý do trước đây Oak bị tả sai: budget 16k cắt mất entry
Oak — nay hết.)

**4. MUA HÀNG RA CHÍNH VĂN**: sau khi mua, hệ thống yêu cầu AI KỂ LẠI cảnh
mua bằng văn xuôi — nhân vật nói muốn mua gì, tương tác người bán, trả
tiền (nêu rõ nếu có giảm giá/tặng kèm) — không liệt kê kiểu hoá đơn. Nút
xe đẩy chỉ xuất hiện khi chính văn thật sự có tag [[SHOP]] (giờ tag trong
khối CoT không còn lọt ra vì đã bóc content trước khi parse tag).

**Đã test (node)**: cleanup 5 case (bóc content/cắt-chưa-đóng/không-content
/text thường/safe nối); worldbook 25k ký tự vào ngay lượt mở đầu gồm danh
sách nhân vật; esbuild + parse toàn bộ sạch.

## Cập nhật (đợt 44) — Dev mở khoá gimmick + tab "Giả lập chơi"

**1. DEV TEST BATTLE MỞ KHOÁ GIMMICK**: BattleModal thêm prop
`devUnlockGimmicks`. Trong chơi chính, gimmick vẫn cần vật phẩm (đợt 42);
nhưng Dev → Test Battle giờ mở sẵn cả Mega/Z/Dynamax/Terastal để test
thoải mái (Dev là để test, không nên khoá).

**2. TAB "🎮 GIẢ LẬP CHƠI" (SimulationTester.jsx)**: bỏ qua bước tạo nhân
vật. Nhập 1 prompt tình huống → AI gen chương truyện qua ĐÚNG pipeline
chính (worldbook, wiki, đạo diễn, tag biến, prose length…) → set state tối
thiểu (tên/thân phận/vùng-khu/ngày/tiền + tuỳ chọn Pokémon sẵn + trang bị
nhanh gimmick items) → nhảy THẲNG vào màn chơi thật (`setGameStarted`).
Từ đó chơi tiếp liên tục y hệt bình thường để test cập nhật biến, battle,
shop, tóm tắt, ký ức — nhanh hơn nhiều so với tạo nhân vật rồi đi kiếm đồ.
Có nút "trang bị nhanh" (Key Stone/Z-Ring/Dynamax Band/Tera Orb/Potion/
Poké Ball) để test gimmick ngay. Xoá ký ức phiên cũ trước khi giả lập.

**Đã test**: esbuild + parse toàn bộ sạch; mọi context setter + import
SimulationTester dùng đều tồn tại; message hidden/resultLabel khớp
RoleplayChat.

## Cập nhật (đợt 45) — FIX giả lập không vào màn chơi, FIX lộ scaffold dịch jp/vn + comment vòng lặp, FIX API cập nhật biến rớt tiền/quan hệ

**1. FIX: "Giả lập & vào chơi" xong vẫn kẹt ở màn Dev.** Nguyên nhân: `App.jsx` xét thứ tự `showSettings → showDev → gameStarted`, mà SimulationTester nằm TRONG DevPage nên `setGameStarted(true)` xong `showDev` vẫn true → App tiếp tục render DevPage; phải bấm "← Quay lại" mới thấy màn chơi (đúng triệu chứng người dùng báo). Fix: App truyền `onEnterGame` xuống DevPage → SimulationTester; sau `setGameStarted(true)` gọi `onEnterGame()` để đóng Dev, nhảy thẳng vào màn chơi.

**2. FIX: chính văn hiện nguyên `<jp>`/`<vn>` + comment `<!-- Vòng lặp thứ… (Tiếp tục dịch) -->`.** Hai lỗi cộng hưởng trong `outputCleanup.js`:
- Regex script của preset trước đây CHỈ chạy ở nhánh *không có* `<content>` — trong khi scaffold dịch nằm BÊN TRONG `<content>` nên không bao giờ được gỡ. Giờ regex script chạy ở CẢ 2 nhánh.
- Thêm `resolveDualLanguage()`: gỡ sạch comment HTML (kể cả comment mở chưa đóng do cắt stream); nếu có `<vn>` thì chính văn = CHỈ các block `<vn>` (block cuối chưa đóng vẫn lấy được); nếu chỉ có `<jp>` (chưa kịp dịch) thì vứt block Nhật thay vì hiện ra màn hình. Text thường không jp/vn không bị đụng. 8 unit test node đều pass.

**3. FIX: API cập nhật biến (state-api) rớt tiền/quan hệ/thương tích trong im lặng.** `applyStoryState` cũ đọc state từ closure (`playerProfile.money`…); callback nền của stateExtractor gọi hàm này KHÔNG truyền state hiện tại → TypeError bị `.catch` nuốt → tag bổ sung từ model phụ không bao giờ áp. Viết lại `applyStoryState` dùng functional updater thuần (không cần state hiện tại), đồng thời hết luôn race closure-cũ-đè-mới giữa luồng chính và luồng phụ. `setRelationships`/`setBodyStatus` trong GameContext nâng lên nhận functional updater theo đúng quy tắc chung; `handleShopFinish` trừ tiền cũng chuyển sang functional.

**Kiểm tra:** esbuild parse toàn bộ src OK; unit test cleanup + applyStoryState pass.

## Cập nhật (đợt 46) — PERSIST TRUYỆN (F5 không mất), "Tiếp tục hành trình", reset sạch khi run mới, qty QUICK_ITEMS khớp tên

**1. Truyện được lưu bền qua reload.** `messages`, `gameStarted`, `playerName`, `playerMon` giờ persist localStorage như mọi state khác (trước đây chỉ tiền/túi đồ/vị trí persist còn CHÍNH VĂN thì mất sạch khi F5 → lệch nhau). F5 giữa truyện quay lại đúng màn chơi, đúng đoạn đang đọc, đúng con Pokémon đang ra trận (hết cảnh HUD hiện mon mẫu dù đội hình thật vẫn còn). Truyện quá dài vượt quota localStorage thì chỉ mất khả năng khôi phục sau F5, phiên hiện tại vẫn chạy bình thường (try/catch nuốt lỗi ghi).

**2. Màn hình chính có "▶ Tiếp tục hành trình"** khi còn truyện dở — trước đây bấm "⌂ Màn hình chính" xong là… hết đường quay lại truyện, chỉ có nước tạo mới. Lời confirm của nút ⌂ và nút "Xoá lịch sử chat" cập nhật theo (xoá giờ là xoá VĨNH VIỄN nên có hỏi lại).

**3. Hành trình mới = sạch sẽ thật sự.** `handleBegin` (IntroScreen) và giả lập (SimulationTester) giờ reset cả inventory / relationships / bodyStatus / hunger / tiền (về 3000) — trước đây các state này persist nên thương tích, hảo cảm NPC và túi đồ của run cũ dính nguyên sang run mới.

**4. QUICK_ITEMS khai qty theo từng món** — "Poké Ball x10" trong túi đúng 10, "Potion x5" đúng 5, trang bị gimmick (Key Stone/Z-Ring/Band/Orb) mỗi thứ 1 cái thay vì đồng loạt 5.

**Kiểm tra:** esbuild parse toàn bộ src OK; regression test cleanup jp/vn pass.

## Cập nhật (đợt 47) — Tag inline (FIX tiền không trừ), FIX scaffold Editor Pass/ChapterInfo lộ đầu chương, FACT đa keyword kiểu World Info, nút "Tóm tắt ngay", FIX dò vị trí sai

**1. FIX tag trạng thái NẰM GIỮA CÂU bị câm hoàn toàn** (gốc của vụ "mua hàng rồi mà tiền vẫn y nguyên" + sổ tay 0 NPC/0 fact). Regex tag cũ neo theo dòng (`^…$`) — thực chiến model nhét `[[MONEY -1000]], [[SHOP …]], [[FACT …]]` vào giữa đoạn văn → không parse được gì: tiền không trừ, fact không vào sổ tay, tag lộ nguyên văn ra màn hình. Giờ tag match ở bất kỳ đâu (cặp `[[..]]` bao nên vẫn an toàn với văn thường), kèm dọn vụn dấu câu sau khi gỡ tag giữa câu. `[[BATTLE]]` không bị đụng. Instruction bổ sung câu chốt "mọi tag đặt cuối tin, mỗi tag 1 dòng".

**2. FIX scaffold hậu trường lộ đầu chương** (`[7.X — Đóng Gói Tư Duy / Editor Pass]`, bullet chỉnh sửa, `[ChapterInfo|…]`). Khi model bọc hỏng `<thinking>`/`<content>`, mọi thứ trước dòng `[ChapterInfo|…]` là hậu trường → cắt sạch tới hết dòng đó, nhưng VỚT các tag trạng thái lẫn trong phần bị cắt nối xuống cuối (không thì tiền/fact mất theo scaffold). Dòng `[ChapterInfo|…]`/`[Metadata|…]` và header giai đoạn CoT đánh số còn sót ở bất kỳ đâu cũng bị gỡ khỏi hiển thị (dò vị trí vẫn đọc metadata trên reply GỐC nên không ảnh hưởng).

**3. FACT giờ là entry World Info đúng nghĩa**: `[[FACT từ khoá 1, từ khoá 2 | nội dung CHI TIẾT]]` — nhiều từ khoá kích hoạt cách nhau dấu phẩy, khớp BẤT KỲ từ khoá nào là chèn cả nội dung đầy đủ vào prompt (ai/cái gì/ở đâu/điều kiện). Instruction yêu cầu model viết nội dung chi tiết thay vì vài chữ cụt. Fact cũ 1 keyword tương thích ngược.

**4. Tóm tắt cốt truyện**: chạy bằng **API CHÍNH** (ghi rõ trong Sổ tay), tự động mỗi ~12 tin — thêm nút **"⟳ Tóm tắt ngay"** chạy tức thì không cần chờ đủ tin (báo lỗi rõ nếu thiếu API). maxTokens 700→2000 (proxy tính cả thinking token làm bản tóm bị cắt rỗng), reply được làm sạch CoT trước khi lưu, tin hidden gắn nhãn HỆ THỐNG trong bản ghi tóm tắt.

**5. FIX dò vị trí "chọn Cerulean lại nhảy sang Pewter/Mt. Moon"**: `detectMentionedArea` giờ ĐẾM SỐ LẦN nhắc (Cerulean 3 lần thắng Mt. Moon 1 lần) + "dính" khu hiện tại (nhắc thoáng qua địa danh khác không phải là di chuyển — di chuyển tường minh đã có `[[MOVE]]`). Riêng đoạn mở đầu Giả lập: vùng+khu người dùng CHỌN TAY là chân lý, chỉ `[[MOVE]]` hoặc dòng `[Metadata|…]` mới được đè, bỏ hẳn quét mờ.

**Kiểm tra:** 19 unit test node pass (tag inline, scaffold+vớt tag, đa keyword, dò vị trí), regression jp/vn đợt 45 pass, esbuild toàn bộ src OK.

## Cập nhật (đợt 48 — chuẩn bị BETA, học theo card Phàm Nhân Tu Tiên)

**1. Menu CHUỘT PHẢI trên từng tin nhắn** (thay hàng nút Sửa/Reroll dưới tin): ✎ Sửa · ↻ Gửi lại (tin AI mới nhất) · ⧉ Sao chép · 🧬 Biến cập nhật · 🗑 Xoá tin. Menu kẹp vị trí không tràn mép màn hình, áp cho cả tin người chơi lẫn tin AI.

**2. Viewer 🧬 "Biến cập nhật" từng lượt** (TurnInfoModal — mô hình tab của card PNTT): mỗi tin AI lưu meta {biến đã áp, suy nghĩ CoT, văn gốc}. Tab BIẾN liệt kê mọi thay đổi thật (💰 tiền, 💞 hảo cảm, 🩹 thương tích, 📌 fact, 🛒 shop, 🗺 di chuyển, 📅 ngày giờ...) kể cả phần (API phụ) bổ sung sau — "giấy trắng mực đen" chứng minh hệ [[MONEY]]… chạy thật. Nút pill "🧬 N biến" dưới mỗi tin AI. Meta cắt 14k ký tự/trường để không phình localStorage.

**3. Tóm tắt cốt truyện chạy MỖI LƯỢT** (SUMMARY_EVERY 12→2, chạy nền bằng API chính) — đúng mô hình PNTT, hết cảnh "chờ chục tin AI đần dần".

**4. Hệ IV / EV / NATURE đúng công thức game gốc (Gen 3+):** IV 0-31 random lúc sinh; EV 0-252/chỉ số tổng ≤510, nhận khi HẠ đối thủ (cộng vào chỉ số base cao nhất của loài bị hạ, 1-3 điểm theo BST); 25 nature ±10%. Unit test KHỚP 100% cả 6 chỉ số ví dụ chuẩn Bulbapedia (Garchomp Lv.78 Adamant → 289/278/193/135/171/171). Modal chi tiết Pokémon hiển thị nature + bảng IV/EV. Mon cũ (không có build) tự fallback IV31/EV0/trung tính — không vỡ save.

**5. Độ no Pokémon rời HUD** — HUD chỉ còn thanh Người; độ no của con đang ra trận hiện trong modal chi tiết khi bấm ô đội hình.

**6. ĐỘI HÌNH CANON tĩnh (src/data/canonTrainers.js):** ~40 trainer gốc (8 gym Kanto, E4+Champion, gym Johto/Hoenn/Sinnoh chính, Red, phản diện) với đội hình + level đúng game nguồn, bơm vào prompt kiểu World Info khi tên được nhắc — chạy cả offline, bổ trợ lớp tra Bulbapedia; worldbook người dùng vẫn được ưu tiên khi mâu thuẫn.

**7. Cờ PUBLIC BETA:** bản build production ẨN "Chế độ Dev" (kéo theo ẩn Combat Anime bên trong) — mở lại bằng `?dev=1`. `npm run build` chạy sạch (dist ~500KB). Hướng dẫn deploy đầy đủ trong **DEPLOY.md** (Vercel/Netlify/GitHub Pages; key API do từng người chơi tự nhập, lưu localStorage máy họ).

**Audit:** worldbook ăn đúng chuẩn ST (key/secondary/logic/constant/order/budget — kiểm lại OK); preset pipeline qua buildPresetPrompt + regex script chạy cả 2 nhánh (đợt 47). Kiểm tra: 8 test đợt này + regression đợt 45/47 pass, esbuild toàn bộ src OK, build production OK.
