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
