# 🪵 MISU Bot – AI Tư Vấn Bán Hàng

Bot AI tư vấn bán hàng cho thương hiệu **kệ module MISU**, xây dựng với Node.js + Express + OpenAI.

---

## Cấu trúc project

```
misu-bot/
├── server.js          # Express server, routes /health và /chat
├── systemPrompt.js    # Prompt tư vấn bán hàng của MISU
├── pricingService.js  # Đọc bảng giá Excel, tra giá theo kích thước
├── data/
│   └── bang_gia_de_xuat_misu.xlsx   # Bảng giá bán đề xuất
├── test-chat.html     # Giao diện test chat trên trình duyệt
├── .env.example       # Mẫu file biến môi trường
├── .gitignore
├── package.json
└── README.md
```

---

## Chạy Local

### Bước 1 – Vào thư mục project

```powershell
cd C:\project\misu-bot
```

### Bước 2 – Cài dependencies

```powershell
npm install
```

### Bước 3 – Tạo file .env

```powershell
copy .env.example .env
```

Mở file `.env` và điền API key:

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
PORT=3000
```

> **Chưa có API key?** Bot vẫn chạy được ở chế độ **Fallback** – trả lời mẫu để test giao diện trước.

### Bước 4 – Khởi động server

```powershell
npm start
```

Output mong đợi:
```
🚀 MISU Bot đang chạy tại http://localhost:3000
   GET  http://localhost:3000/health
   POST http://localhost:3000/chat
```

### Bước 5 – Test

**Health check** – mở trình duyệt vào:
```
http://localhost:3000/health
```

**Chat UI** – mở file `test-chat.html` trong Chrome/Edge (kéo thả file vào trình duyệt).

**Curl test:**
```powershell
Invoke-RestMethod -Uri http://localhost:3000/chat -Method POST -ContentType "application/json" -Body '{"message":"Cho mình xem kệ phòng khách"}'
```

---

## Deploy lên Render

### Bước 1 – Đẩy code lên GitHub

```powershell
cd C:\project\misu-bot
git init
git add .
git commit -m "init misu-bot"
git remote add origin https://github.com/YOUR_USERNAME/misu-bot.git
git push -u origin main
```

> File `.env` đã có trong `.gitignore` – sẽ không bị commit.

### Bước 2 – Tạo Web Service trên Render

1. Vào [https://render.com](https://render.com) → **New** → **Web Service**
2. Kết nối repository GitHub
3. Cấu hình:

| Trường | Giá trị |
|---|---|
| **Name** | `misu-bot` |
| **Environment** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

### Bước 3 – Thêm biến môi trường

Tab **Environment** → **Add Environment Variable**:

| Key | Value |
|---|---|
| `OPENAI_API_KEY` | `sk-proj-xxxxxxxx` |
| `OPENAI_MODEL` | `gpt-4o-mini` |

### Bước 4 – Deploy & kiểm tra

Sau ~2 phút deploy xong, kiểm tra:
```
https://misu-bot.onrender.com/health
```

Mở `test-chat.html`, đổi ô **Server** thành URL Render của bạn để test.

---

## API Reference

### GET /health
```json
{ "status": "ok", "service": "MISU Sales Bot", "mode": "openai | fallback", "timestamp": "..." }
```

### POST /chat

**Request:**
```json
{
  "message": "Nội dung tin nhắn",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response:**
```json
{ "reply": "Nội dung trả lời", "mode": "openai | fallback" }
```

---

## Bảng giá

### File bảng giá nằm ở đâu

```
C:\MISU\misu-bot\data\bang_gia_de_xuat_misu.xlsx
```

### Cấu trúc file Excel

- Sheet: `3 - Giá Bán Đề Xuất`
- Các block chiều cao (`CAO 50 CM`, `CAO 70 CM`, ..., `CAO 210 CM`) xếp 3 block trên mỗi hàng
- Trong mỗi block: cột `Dài` = chiều rộng kệ; cột `Sâu 30/35/40/45/50` = giá theo chiều sâu

### Cách cập nhật bảng giá

1. Mở file `data/bang_gia_de_xuat_misu.xlsx` và chỉnh giá
2. Lưu file Excel
3. **Restart bot** để load lại bảng giá mới:
   ```powershell
   npm start
   ```

> Bot đọc file Excel **một lần lúc khởi động**. Thay file xong phải restart mới có hiệu lực.

### Cách bot tra giá

- Khách nhắn kích thước → bot nhớ trong lịch sử hội thoại
- Khách hỏi giá + đủ 3 kích thước → tra bảng Excel, trả giá ngay (không gọi OpenAI)
- Thiếu kích thước → hỏi đúng thông tin còn thiếu
- Kích thước không có trong bảng → thông báo rõ, không bịa giá

---

## Lưu ý

- Render Free tier tắt sau **15 phút không có request**. Dùng [UptimeRobot](https://uptimerobot.com) ping `/health` mỗi 10 phút để giữ bot luôn sống.
- Đổi model sang `gpt-4o` nếu cần chất lượng tư vấn cao hơn.
- Sau khi cập nhật `bang_gia_de_xuat_misu.xlsx` trên Render, phải **redeploy** (hoặc trigger manual deploy) để server đọc file mới.
