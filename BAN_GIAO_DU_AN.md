# BÀN GIAO DỰ ÁN — TRAINER ARENA (Pokémon Roleplay × Battle Engine)

> Tài liệu này để mang sang một cuộc trò chuyện mới. Đọc hết phần **1-4**
> trước khi sửa bất cứ thứ gì.

---

## 1. DỰ ÁN LÀ GÌ

Web game nhập vai Pokémon bằng AI, tiếng Việt. Người chơi tạo nhân vật rồi
chơi bằng cách gõ hành động; AI viết tiếp câu chuyện. Có hệ chiến đấu theo
lượt đúng công thức game gốc (IV/EV/nature/EXP), cửa hàng, túi đồ, bản đồ
vùng, nhạc nền theo ngữ cảnh, và 3 lớp trí nhớ dài hạn.

**Đang ở giai đoạn BETA CÔNG KHAI** — có người chơi thật, báo lỗi qua Discord.

- **Frontend thuần**, không có backend riêng. React 18 + Vite 5, JavaScript
  (không TypeScript).
- **Không có tài khoản, không có server lưu dữ liệu.** Mọi thứ nằm trong
  `localStorage` của trình duyệt người chơi.
- **API key do TỪNG NGƯỜI CHƠI tự nhập** trong app (OpenAI-compatible:
  OpenAI, OpenRouter, proxy Gemini…). Dự án không kèm key nào.

### Link đang chạy
- Bản chính: `https://pokemon-roleplay-arena.anhyeuem1f2.workers.dev`
  (Cloudflare Workers)
- Bản dự phòng: `https://pokemonroleplayarena.netlify.app` (Netlify)
- Repo: `github.com/anhyeuem1f2-glitch/pokemon-roleplay-arena`

---

## 2. QUY TẮC LÀM VIỆC (quan trọng — đọc kỹ)

Những quy tắc này rút ra từ các lỗi ĐÃ XẢY RA trong dự án. Vi phạm là lặp
lại đúng lỗi cũ.

1. **Luôn chạy `npm run lint` trước khi giao bản.** Rule `no-undef`. Từng có
   bug `animeApiConfig is not defined` làm **hỏng mọi lượt chơi** của toàn bộ
   người chơi, chỉ vì quên destructure một biến từ context — build vẫn xanh,
   chỉ lộ ra lúc chạy thật.
2. **Luôn `npm run build` trước khi giao.** Đã từng đặt sai chỗ một comment
   JSX làm vỡ build.
3. **Viết test cho mọi logic thuần** (công thức, parser, dò chuỗi). Chạy bằng
   `node --input-type=module`. File `.jsx` phải bundle qua esbuild trước khi
   test. Đã có ~100 test rải rác trong lịch sử; luôn chạy lại nhóm regression
   khi đụng vào `outputCleanup`, `storyStateProtocol`, `pokemonSpecies`.
4. **KHÔNG lấy kết quả ra từ trong hàm cập nhật state của React.** React chạy
   updater ở pha render, không đồng bộ. Đã dính 2 lần (EXP không chạy, shop
   clobber state). Tính trước → rồi mới `setState`.
5. **Không tin model tuân thủ chỉ dẫn.** Nếu model làm sai gây hỏng trải
   nghiệm (VD viết tiếp sau `[[BATTLE]]`), phải **chặn ở phía app** chứ đừng
   chỉ dặn kỹ hơn trong prompt.
6. **Tương thích ngược với save cũ.** Người chơi đang có ván dở. Thêm trường
   mới cho Pokémon/state phải có nhánh fallback (VD mon cũ không có `exp`,
   không có `uid`).
7. **Comment bằng tiếng Việt, giải thích TẠI SAO** (nhất là chỗ sửa bug: ghi
   rõ triệu chứng người chơi báo). Toàn bộ code hiện tại theo lối này.
8. **Ghi changelog vào `README.md`** theo từng "đợt" (đợt 1 → 69). Mỗi đợt
   ghi rõ bug gốc, nguyên nhân, cách sửa.

---

## 3. KIẾN TRÚC

```
src/
├── App.jsx                 điều hướng: title → wizard → màn chơi; cờ ẩn Dev
├── context/GameContext.jsx TOÀN BỘ state game + persist localStorage
├── components/             (35 file) UI
├── data/                   (21 file) dữ liệu + công thức game
├── utils/                  (19 file) prompt, trí nhớ, làm sạch output, save
└── services/               aiClient (gọi API), stateExtractor, wikiLookup
functions/api-bridge.js     cầu nối CORS (Cloudflare Pages)
worker/index.js             điểm vào Cloudflare Workers (+ route /api-bridge)
netlify/edge-functions/     cầu nối CORS bản Netlify
wrangler.jsonc              cấu hình deploy Workers
public/music/               20 file nhạc + README bảng đối chiếu
```

### Luồng một lượt chơi
```
Người chơi gõ → RoleplayChat.callAI()
  → buildMainApiMessages() gom: preset + worldbook + lorebook + tư liệu canon
     + tông truyện + tính cách/thiên phú + đội hình&tính cách Pokémon
     + trí nhớ (3 lớp) + quyền tự do sáng tạo
  → aiClient.chatCompletion()  [gọi thẳng, CORS chặn thì tự vòng qua /api-bridge]
  → outputCleanup: bóc <content>, gỡ scaffold preset, gộp jp/vn, CẮT sau [[BATTLE]]
  → storyStateProtocol.parseStoryStateTags(): bóc [[MONEY]] [[FACT]] [[TRAIN]]…
  → áp biến vào context → lưu message kèm meta (viewer 🧬)
  → chạy nền: tóm tắt cốt truyện + API cập nhật biến + ghi ký ức vector
```

### Ba lớp trí nhớ
1. **Ký ức vector** (`storyMemory.js`) — cần API embedding, truy hồi diễn
   biến cũ liên quan.
2. **Tóm tắt cốt truyện** (`storySummary.js`) — chạy mỗi lượt bằng API chính.
3. **Sổ tay keyword** (`storyNotebook.js`) — NPC + FACT kiểu World Info,
   nhiều từ khoá kích hoạt cho mỗi entry.

### Giao thức tag trạng thái (`storyStateProtocol.js`)
AI khai thay đổi bằng tag, app parse và áp:
`[[MONEY ±n]]` `[[POKEMON Tên | Lv.n]]` `[[REL Tên=±n | ghi chú]]`
`[[BODY bộ_phận=±n]]` `[[HUNGER người|pokemon ±n]]` `[[NPC Tên | mô tả]]`
`[[FACT từ khoá 1, từ khoá 2 | nội dung]]` `[[SHOP Tên | loại]]`
`[[DATE +n]]` `[[DATE buổi=sáng]]` `[[TRAIN 1-3]]` `[[MOVE nơi đến]]`
`[[BATTLE]]`

> Tag **match ở bất kỳ đâu trong bài** (không neo dòng) — model hay nhét tag
> giữa câu, neo dòng làm tag câm hoàn toàn (bug tiền không trừ ở đợt 47).

---

## 4. HỆ THỐNG GAME (công thức)

- **IV/EV/Nature**: đúng công thức Gen 3+. IV 0-31 random lúc sinh, EV
  0-252/chỉ số & ≤510 tổng, 25 nature ±10%. Test khớp 100% ví dụ chuẩn
  Bulbapedia (Garchomp Lv.78 Adamant → 289/278/193/135/171/171).
- **EXP**: nhóm Medium Fast (tổng EXP đạt cấp n = n³). Hạ đối thủ: `b×L/7`,
  base-yield suy từ BST, trainer ×1.5. Luyện tập `[[TRAIN]]` ≈ 8% quãng
  đường/buổi, ngày trôi ≈ 2%/ngày (chặn tối đa 30 ngày mỗi lần để không lách
  bằng "ngủ 999 ngày").
- **Nature ảnh hưởng HÀNH VI**, không chỉ chỉ số — `NATURE_BEHAVIOR` bơm vào
  prompt mỗi lượt.
- **Bắt Pokémon**: máu thấp + trạng thái ngủ/đóng băng + loại bóng, huyền
  thoại bị trừ nặng, luôn kẹp 3-95%.
- **Mỗi cá thể có `uid`** cố định trọn đời — đồng bộ `playerMon` ↔ `party`
  phải dùng `isSameMon`/`syncMonInParty`, **không khớp theo tên**.

---

## 5. HẠ TẦNG & CÁC BẪY ĐÃ GẶP

### Cầu nối CORS `/api-bridge`
Nhiều proxy AI (VD `gcli.*`) **không gửi header CORS** → trình duyệt chặn.
SillyTavern gọi được vì ST là server chạy trên máy người dùng. Giải pháp:
Worker/Edge Function chuyển tiếp phía máy chủ.

- App **gọi thẳng trước**, chỉ khi lỗi mạng/CORS mới vòng qua cầu nối, rồi
  **ghi nhớ vào localStorage** để phiên sau đi thẳng đường đúng.
- Khi đi qua cầu nối thì **bật `stream: true`** — nếu không, phản hồi chậm sẽ
  bị Cloudflare cắt (**lỗi 524**, ngưỡng 100 giây).
- Kiểm tra cầu nối sống: mở `<link>/api-bridge` → phải ra JSON
  `{"ok":true,"bridge":"online"}`.

### Bẫy khác đã gặp
| Triệu chứng | Nguyên nhân thật |
|---|---|
| "Kiểm tra kết nối OK nhưng vào chơi lỗi" | nút test gọi `GET /models`, còn lúc chơi gọi `POST /chat/completions` — hai đường khác nhau. Nay test đúng đường thật |
| "Failed to fetch / CORS" | thường là **thiếu `/v1`** trong Base URL → 404 không kèm header CORS. App tự thử thêm `/v1` |
| "Phản hồi rỗng (finish_reason: length)" | model *thinking* đốt hết token vào phần suy nghĩ. Mặc định maxTokens 8192, tự thử lại ×4 một lần |
| Lỗi 524 | Cloudflare cắt sau 100s — giảm max tokens / đổi model nhanh hơn |
| Nút Dev vẫn hiện trên bản deploy | app có **2 nút Dev** (header + màn hình chính), đợt 48 chỉ ẩn 1. Bài học: `grep -rn` toàn bộ điểm vào |

### Deploy
Cloudflare Workers (chính): build `npm run build`, deploy `npx wrangler deploy`.
Dashboard 2026 đã bỏ luồng tạo Pages mới cho tài khoản mới.
Netlify Free chỉ có 300 credit/tháng (mỗi deploy 15) — hết là **site tạm dừng**.

---

## 6. VIỆC CÒN TỒN (ưu tiên từ trên xuống)

1. **Combat Anime chưa mở** — `AnimeBattleTester.jsx` đã có nhưng nằm trong
   Dev mode, chưa nối vào luồng chơi chính. Slot API của nó đã bị đổi vai
   thành "API chau chuốt văn phong".
2. **Bấm Ẩn giữa trận reset bậc chỉ số** (buff/debuff) — đã biết, chấp nhận
   tạm trong beta.
3. **Item `revive`** chưa dùng được trong trận (chưa có luồng chọn Pokémon đã
   gục để hồi sinh).
4. **Túi đồ trên HUD** vẫn là `InventoryPanel` cũ (đã phân nhóm, hoạt động
   tốt) — có thể thống nhất sang `BagPanel` mới cho đồng bộ giao diện.
5. ~~**Thiên phú mới chỉ ảnh hưởng lời kể**~~ — ĐÃ XỬ LÝ MỘT PHẦN ở đợt 70:
   có lớp `playerPerks.js` (thiên phú CƠ CHẾ) áp thẳng vào số liệu — Max
   IV/EV khi sở hữu, EXP luyện tập ×2, tỉ lệ bắt +15%; sửa được giữa truyện
   qua `TraitsModal` mở từ HUD. CÒN LẠI: các SUPERPOWERS kể chuyện (Psychic,
   Aura...) vẫn chưa có hiệu ứng thật trong trận.
6. **Chưa có gym/huy hiệu như tuyến chính** — dữ liệu canon đã có
   (`canonTrainers.js`) nhưng chưa thành hệ thống tiến trình.

---

## 7. CÁCH CHẠY

```bash
npm install
npm run dev      # localhost:5173 (KHÔNG có /api-bridge — cần proxy hỗ trợ CORS)
npm run build    # ra dist/
npm run lint     # no-undef — BẮT BUỘC chạy trước khi giao bản
```

Chế độ Dev: mặc định **ẩn ở mọi môi trường**, mở bằng `?dev=1` trên URL.

---

## 8. QUY TRÌNH CẬP NHẬT LÊN WEB

1. Sửa code → `npm run lint` → `npm run build` → chạy test.
2. Ghi changelog vào `README.md` (đợt tiếp theo).
3. Upload thư mục `src` lên GitHub (kéo-thả, ghi đè) → Commit.
   - Đụng nhạc thì upload cả `public`; đụng cấu hình deploy thì upload
     `wrangler.jsonc` / `worker/` / `functions/`.
4. Cloudflare tự build (~1-2 phút) → mở link, **Ctrl+Shift+R**.

---

## 9. NGƯỜI DÙNG LÀ AI

Chủ dự án làm card nhân vật cho SillyTavern, **không phải lập trình viên** —
thao tác qua giao diện web (GitHub upload, dashboard Cloudflare), không dùng
dòng lệnh git. Khi hướng dẫn:
- Nói rõ **bấm vào đâu**, tránh thuật ngữ không cần thiết.
- Khi lỗi do phía mình thì **nhận thẳng**, đừng đổ cho người dùng.
- Người chơi beta báo lỗi bằng tiếng Việt đời thường, thường mô tả **triệu
  chứng** chứ không phải nguyên nhân ("lỗi underfiend" hoá ra là chữ
  `undefined`; "đánh con nào cũng ra Charmander" hoá ra là hàm dò tên sắp xếp
  theo độ dài). **Luôn đọc code để tìm nguyên nhân thật, đừng đoán.**
