# AI Web Game Tester — MVP 0.3

Ứng dụng local-first cho phép một model AI **tự trải nghiệm web game bằng Chrome thật**, thực hiện hành động từng bước, thu ảnh chụp và tín hiệu kỹ thuật, sau đó xuất báo cáo lỗi có bằng chứng.

## Tính năng đã có

- Mở URL thật bằng Chrome, Edge hoặc Chromium trong một profile tạm sạch.
- AI quan sát đồng thời:
  - ảnh chụp màn hình;
  - văn bản và phần tử tương tác trong DOM;
  - canvas, SVG và iframe hiển thị;
  - lỗi JavaScript/console;
  - request mạng thất bại hoặc trả HTTP 4xx/5xx;
  - các kiểm tra giao diện xác định như tràn ngang, nội dung bị cắt, nút thiếu tên truy cập và vùng bấm quá nhỏ.
- AI có thể:
  - bấm phần tử DOM;
  - bấm hoặc kéo theo tọa độ trên canvas/WebGL;
  - điền ô, chọn option, nhấn phím;
  - cuộn, chờ, tải lại, quay lại và điều hướng trong cùng origin.
- Mỗi bước được lưu ảnh, hành động, kết quả và lý do ngắn.
- Xuất:
  - `report.md` dễ đọc;
  - `report.json` để đưa vào CI hoặc hệ thống quản lý lỗi;
  - `browser-trace.json` chứa network, console, exception và hành động AI;
  - `step-*.jpg` làm bằng chứng.
- Khoá API không được ghi vào file báo cáo và bị xoá khỏi bộ nhớ của lượt chạy sau khi hoàn tất.
- Có thể thêm tối đa 8 cấu hình API/model, chọn nhiều môi trường giả lập và chạy ma trận tối đa 32 tổ hợp.
- Các tổ hợp chạy đồng thời theo giới hạn 1–8 trình duyệt để cân bằng tốc độ, RAM/CPU và rate limit của API.
- Hỗ trợ profile Desktop Chrome, Desktop Edge, Laptop, Tablet, Android và iOS (viewport, DPR, touch và user agent riêng).
- Lỗi từ mọi tổ hợp được gộp thành `matrix-report.md` và `matrix-report.json`, đồng thời vẫn giữ báo cáo/bằng chứng riêng của từng lượt.
- Có profile chuyên dụng cho **Trainer Arena** và **Sân Khấu Quỷ Bí**, kèm nhiệm vụ, số bước và timeout roleplay phù hợp.
- `fill_secret` cho phép điền API key của game đích bằng tên tham chiếu; giá trị được redact khỏi DOM snapshot, screenshot, trace và báo cáo.
- `wait_until_idle` chờ response streaming tối đa 300 giây, dựa trên DOM thay đổi, busy indicator và network activity.
- Có thể nhập nhiều URL instance. Profile Quỷ Bí tự khóa một browser trên mỗi origin để tránh nhiều lượt ghi chung save; các instance khác cổng vẫn chạy song song.

## Nhà cung cấp model

| Nhà cung cấp | Tải danh sách model | Giao thức gọi |
|---|---|---|
| OpenAI | `GET /v1/models` | Responses API + Structured Outputs |
| OpenRouter | `GET /api/v1/models` | Chat Completions tương thích OpenAI |
| Ollama | `GET /v1/models` | OpenAI-compatible local API |
| LM Studio | `GET /v1/models` | OpenAI-compatible local API |
| API tương thích OpenAI khác | `GET {baseUrl}/models` | `{baseUrl}/chat/completions` |
| Demo nội bộ | danh sách giả lập | không tốn API |

Model **không được nhập tay**. Với mỗi API, người dùng bấm **Tải model hiện có**, chọn model rồi bấm **Thêm API/model vào matrix**. Có thể lặp lại thao tác này cho nhiều API key, provider hoặc model khác nhau.

## Chạy nhiều API × nhiều môi trường

Ví dụ cấu hình 3 model và chọn 4 môi trường sẽ tạo 12 lượt kiểm thử độc lập. Nếu concurrency là 4, hệ thống luôn chạy tối đa 4 Chromium/Edge cùng lúc cho đến khi hết hàng đợi.

```text
API/model A ─┬─ Desktop Chrome
             ├─ Desktop Edge
             ├─ Tablet
             └─ Mobile Android
API/model B ─┼─ ...
API/model C ─┴─ ...
```

Mỗi trình duyệt dùng profile tạm riêng nên cookie, local storage và trạng thái của các tổ hợp không lẫn nhau. Kết quả được gom dưới một thư mục duy nhất:

```text
runs/matrix-<timestamp>-<id>/
  matrix-report.md
  matrix-report.json
  01-<api-model-moi-truong>/
    report.md
    report.json
    browser-trace.json
    step-*.jpg
  02-<api-model-moi-truong>/
    ...
```

Đối với app lưu state phía server như Quỷ Bí, xem hướng dẫn cách ly instance trong `ROLEPLAY_GUIDE.md`.

## Chạy trên Windows

Yêu cầu:

- Node.js 20 trở lên.
- Chrome hoặc Microsoft Edge đã được cài.

Cách nhanh nhất:

1. Giải nén thư mục.
2. Chạy `START_WINDOWS.bat`.
3. Mở `http://127.0.0.1:5190` nếu trình duyệt chưa tự mở.
4. Giữ nhà cung cấp **Demo nội bộ**, bấm **Tải model hiện có**.
5. Chọn `Mock QA Agent`, bấm **Thêm API/model vào matrix**.
6. Chọn các môi trường, đặt số trình duyệt đồng thời rồi bấm **Chạy toàn bộ matrix song song**.

Hoặc dùng terminal:

```bash
node server.mjs
```

Ứng dụng không cần `npm install`, bundler hay database.

## Gắn model thật

### OpenAI hoặc OpenRouter

1. Chọn nhà cung cấp.
2. Dán API key.
3. Giữ base URL mặc định.
4. Bấm **Tải model hiện có**.
5. Chọn model có khả năng nhìn ảnh để đạt kết quả tốt nhất.

Nếu model không nhận ảnh, app tự thử lại bằng DOM và tín hiệu kỹ thuật, nhưng khả năng phát hiện lỗi thị giác sẽ giảm.

### Ollama

Khởi động Ollama trước, bảo đảm API đang chạy ở:

```text
http://127.0.0.1:11434/v1
```

Sau đó bấm **Tải model hiện có**. Không cần API key cho cấu hình local mặc định.

### LM Studio

Bật Local Server trong LM Studio, mặc định:

```text
http://127.0.0.1:1234/v1
```

## Kiểm tra web game Quỷ Bí

1. Chạy game bằng `node server.mjs` ở cổng của dự án game, ví dụ `http://127.0.0.1:5180`.
2. Chạy AI Web Game Tester ở cổng 5190.
3. Nhập URL game vào ô **URL sản phẩm**.
4. Nhiệm vụ gợi ý:

```text
Đóng vai người chơi mới. Tạo nhân vật, chơi ít nhất một lượt, tải lại trang để kiểm tra trạng thái có được giữ, quay lại các màn chính, thử một tình huống lỗi API nếu có thể và ghi rõ mọi lỗi giao diện, console, network hoặc sai lệch trạng thái. Không xoá ván hoặc thực hiện hành động phá huỷ trừ khi nhiệm vụ yêu cầu.
```

5. Đặt số bước 20–30 cho một luồng dài hơn.

## Biến môi trường

```text
PORT=5190                 Cổng web app
HOST=127.0.0.1            Mặc định chỉ cho máy local truy cập
AIQA_CHROMIUM_PATH=...    Đường dẫn Chrome/Edge/Chromium nếu app không tự tìm thấy
```

Ví dụ Windows PowerShell:

```powershell
$env:AIQA_CHROMIUM_PATH="C:\Program Files\Microsoft\Edge\Application\msedge.exe"
node server.mjs
```

## Kiểm thử mã nguồn

```bash
npm test
node tests/smoke.mjs
node tests/matrix-smoke.mjs
node tests/ui-smoke.mjs
node tests/secret-smoke.mjs
node tests/roleplay-smoke.mjs
```

`smoke.mjs` chạy toàn bộ luồng đơn với demo nội bộ. `matrix-smoke.mjs` tạo 2 cấu hình model × Chrome và Edge, xác nhận 4 trình duyệt chạy đồng thời và kiểm tra cấu trúc thư mục/báo cáo gộp. `ui-smoke.mjs` mở giao diện bằng Chromium thật, tải model mock, thêm cấu hình và xác nhận nút chạy matrix được bật mà không có console error.

`secret-smoke.mjs` xác minh secret thật được điền nhưng không lọt vào artifact. `roleplay-smoke.mjs` mô phỏng nội dung streaming và xác nhận agent chỉ đánh giá sau khi chính văn hoàn tất.

## Giới hạn của MVP

- Chưa có lịch sử lượt chạy trong giao diện sau khi server khởi động lại; file vẫn còn trên đĩa.
- Chưa có baseline ảnh để so pixel với thiết kế Figma hoặc screenshot chuẩn.
- Chưa có kho thông tin đăng nhập an toàn cho luồng cần tài khoản.
- Canvas/WebGL được điều khiển theo tọa độ và phụ thuộc mạnh vào model vision.
- Kết luận thị giác của AI vẫn có thể báo sai; nên ưu tiên lỗi có console, network, DOM đo được hoặc cách tái hiện rõ.
- OpenAI/OpenRouter/Ollama/LM Studio cần được xác minh bằng khoá và model thật của người dùng; bản build chỉ có thể tự kiểm chứng đầy đủ bằng provider demo trong môi trường phát triển.
- Một matrix bị giới hạn 32 tổ hợp và concurrency tối đa 8 để tránh vô tình làm cạn RAM hoặc vượt rate limit; máy yếu nên bắt đầu với 2–4.

## Bảo mật

- Server mặc định chỉ bind `127.0.0.1`.
- Trang đang kiểm thử không nhận API key.
- Nội dung trang được đánh dấu là dữ liệu không tin cậy trong prompt để giảm prompt injection.
- Model chỉ được trả về một action thuộc schema cho phép; app xác thực action trước khi thực thi.
- Điều hướng trực tiếp bằng action `goto` bị giới hạn trong origin ban đầu.
- Chrome chạy bằng profile tạm, được xoá khi lượt chạy kết thúc.

Xem báo cáo mẫu ở `sample-output/report.md`, trạng thái kiểm chứng ở `VERIFICATION.md`, thiết kế ở `ARCHITECTURE.md` và cơ sở nghiên cứu ở `RESEARCH.md`.
