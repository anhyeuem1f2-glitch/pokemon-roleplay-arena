# 🚀 Đưa Trainer Arena lên web công khai (ai có link là chơi được)

App là **SPA tĩnh** (Vite + React), KHÔNG cần server riêng: build ra thư mục
`dist/` rồi ném lên bất kỳ dịch vụ hosting tĩnh nào. API key do TỪNG NGƯỜI
CHƠI tự nhập trong "Cài đặt API" và chỉ lưu trong localStorage trình duyệt
của họ — bạn KHÔNG phải (và không nên) nhúng key của mình vào bản deploy.

Bản build production (`npm run build`) TỰ ĐỘNG ẨN "Chế độ Dev" (kéo theo ẩn
Combat Anime nằm trong đó). Bạn muốn tự debug trên bản deploy: thêm `?dev=1`
vào URL (VD `https://ten-game.vercel.app/?dev=1`) — người chơi thường không
biết nên không thấy.

## Cách 1 — Vercel (khuyên dùng, miễn phí, 5 phút)

1. Tạo tài khoản https://vercel.com (đăng nhập bằng GitHub).
2. Đẩy thư mục dự án lên một repo GitHub (public hoặc private đều được):
   ```bash
   cd pokemon-roleplay-arena
   git init && git add -A && git commit -m "beta"
   # tạo repo trên github.com rồi:
   git remote add origin https://github.com/<tên-bạn>/pokemon-roleplay-arena.git
   git push -u origin main
   ```
3. Vào Vercel → **Add New → Project** → chọn repo vừa đẩy.
4. Vercel tự nhận diện Vite: Framework = Vite, Build Command = `npm run build`,
   Output = `dist`. Bấm **Deploy**.
5. Xong — bạn có link dạng `https://pokemon-roleplay-arena.vercel.app`, gửi
   cho ai cũng chơi được. Mỗi lần `git push` là tự deploy bản mới.

## Cách 2 — Netlify (tương đương)

1. https://app.netlify.com → **Add new site → Import an existing project** →
   chọn repo GitHub.
2. Build command `npm run build`, publish directory `dist` → Deploy.
3. (Không dùng GitHub cũng được: chạy `npm run build` local rồi kéo-thả
   nguyên thư mục `dist/` vào trang **Deploys** của Netlify.)

## Cách 3 — GitHub Pages (không cần dịch vụ ngoài)

1. Trong `vite.config.js` thêm `base: '/pokemon-roleplay-arena/'` (đúng tên repo).
2. ```bash
   npm run build
   npx gh-pages -d dist
   ```
3. Bật Pages trong Settings repo → link dạng
   `https://<tên-bạn>.github.io/pokemon-roleplay-arena/`.

## Lưu ý quan trọng cho bản beta công khai

- **CORS**: người chơi nhập API bên thứ ba (proxy Gemini/Claude/OpenAI...)
  — đa số proxy cho phép gọi từ trình duyệt; nếu proxy nào chặn CORS thì đó
  là giới hạn phía proxy, người chơi cần chọn endpoint hỗ trợ CORS.
- **Dữ liệu người chơi** (truyện, đội hình, tiền, sổ tay...) nằm HOÀN TOÀN
  trong localStorage máy họ — không có server, không ai đọc được của ai,
  nhưng cũng đồng nghĩa xoá cache trình duyệt là mất save.
- **Nhạc nền**: file nhạc trong `public/music/` sẽ được deploy kèm — kiểm
  tra bản quyền trước khi đưa nhạc thương mại lên trang công khai.
- Muốn đổi link đẹp: cả Vercel/Netlify đều cho gắn domain riêng miễn phí
  trong Settings → Domains.


---

# ☁️ Cách 4 — Cloudflare Pages (KHUYÊN DÙNG — xem lý do kỹ thuật bên dưới)

## Vì sao nên chuyển từ Netlify sang Cloudflare cho dự án này

Netlify Edge Functions có giới hạn **"Response header timeout: 40 giây"**
(tài liệu chính thức: docs.netlify.com/build/edge-functions/limits). Cầu nối
của chúng ta phải CHỜ model sinh xong toàn bộ đoạn truyện rồi mới trả về —
với model thinking như Gemini 3.x Pro, một lượt truyện dài thường vượt 40
giây → Netlify cắt kết nối → người chơi thấy đúng lỗi "Failed to fetch".
Đây là lý do tester vẫn lỗi DÙ cầu nối đã deploy đúng.

Cloudflare Workers (nền của Pages Functions) tính **CPU time**, còn thời gian
NGỒI CHỜ phản hồi từ API bên ngoài thì không giới hạn — đúng kiểu tải của
cầu nối (gần như không tốn CPU, chỉ chờ mạng). Vì vậy cầu nối chạy trên
Cloudflare không bị cắt giữa chừng dù model sinh 2-3 phút.



Ưu điểm so với Netlify cho dự án này: băng thông không giới hạn, mạng lưới
lớn nên vào từ VN nhanh hơn, và **cầu nối CORS** (`/api-bridge`) chạy trên
Workers với hạn mức 100.000 request/ngày (Netlify chỉ 125.000/tháng).

**Quan trọng:** đổi host KHÔNG tự sửa lỗi CORS. Thứ sửa lỗi đó là cầu nối
`/api-bridge` — dự án đã có sẵn bản cho cả hai nền tảng:
- Cloudflare Pages → thư mục `functions/api-bridge.js`
- Netlify → `netlify/edge-functions/api-bridge.ts` + `netlify.toml`

Deploy ở đâu thì phải upload đủ file của nền tảng đó, nếu không cầu nối
không tồn tại và người chơi dùng proxy thiếu CORS sẽ không chơi được.

## Các bước

1. Vào https://dash.cloudflare.com → đăng ký/đăng nhập (miễn phí).
2. Menu trái: **Workers & Pages** → **Create** → tab **Pages** →
   **Connect to Git** → cho phép truy cập GitHub → chọn repo
   `pokemon-roleplay-arena`.
3. Cấu hình build:
   - Framework preset: **Vite** (hoặc None)
   - Build command: `npm run build`
   - Build output directory: `dist`
4. **Save and Deploy** → đợi 1-3 phút → được link dạng
   `https://pokemon-roleplay-arena.pages.dev`.
5. Cloudflare tự nhận thư mục `functions/` ở gốc repo và tạo route
   `/api-bridge` — không cần cấu hình gì thêm.

## Kiểm tra cầu nối đã sống chưa (làm ngay sau khi deploy)

Mở thẳng đường dẫn này trên trình duyệt:

```
https://<tên-site>.pages.dev/api-bridge
```

- Hiện JSON `{"ok":true,"bridge":"online",...}` → cầu nối CHẠY, người chơi
  dùng proxy thiếu CORS vẫn chơi được.
- Hiện trang 404 → cầu nối CHƯA có: kiểm tra lại thư mục `functions/` đã
  được đẩy lên GitHub chưa, rồi deploy lại.

(Trên Netlify kiểm tra y hệt: `https://<tên-site>.netlify.app/api-bridge`.)

## Đổi tên miền / link cho đẹp

Workers & Pages → chọn project → **Custom domains**, hoặc đổi tên project để
đổi phần đầu của `*.pages.dev`.


---

# ⚡ Cách 5 — Cloudflare WORKERS (dashboard 2026 chỉ còn luồng này cho dự án mới)

Từ 2026 Cloudflare gộp Pages vào Workers: dashboard đẩy toàn bộ dự án mới
sang luồng "Create a Worker", nhiều tài khoản không còn thấy nút tạo Pages.
Dự án đã có sẵn file cho luồng này:

- `wrangler.jsonc` — khai báo tên app, thư mục tĩnh `dist`, chế độ SPA
- `worker/index.js` — điểm vào: `/api-bridge` dùng cầu nối CORS, còn lại trả
  file tĩnh qua binding `ASSETS`. Cầu nối import THẲNG từ
  `functions/api-bridge.js` nên bản Workers và bản Pages không bao giờ lệch.

## Các bước

1. Đẩy code mới lên GitHub (phải có `wrangler.jsonc`, thư mục `worker/` và
   `functions/`).
2. dash.cloudflare.com → **Workers & Pages** → **Create application** →
   **Continue with GitHub** → chọn repo `pokemon-roleplay-arena`.
3. Điền:
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
4. **Deploy** → được link dạng `https://pokemon-roleplay-arena.<tên>.workers.dev`.

## Kiểm tra ngay sau khi deploy

Mở `https://<link-của-bạn>/api-bridge`:
- Ra JSON `{"ok":true,"bridge":"online",...}` → cầu nối CHẠY, người chơi dùng
  proxy thiếu CORS (gcli...) vẫn chơi được.
- Ra 404 → thiếu `worker/` hoặc `wrangler.jsonc` trên GitHub.

## Vì sao vẫn nên rời Netlify

- Netlify Edge Functions cắt kết nối nếu 40s chưa có header (đợt 58 đã bù
  bằng streaming, nhưng Cloudflare thì không có giới hạn này ngay từ đầu).
- Netlify Free chỉ có 300 credit/tháng: mỗi lần deploy 15 credit, băng thông
  20 credit/GB, hết credit là site BỊ TẠM DỪNG tới đầu chu kỳ sau.
- Workers free: 100.000 request/ngày, thời gian chờ API bên ngoài không tính
  vào giới hạn CPU.
