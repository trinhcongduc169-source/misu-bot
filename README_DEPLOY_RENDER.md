# Hướng dẫn Deploy misu-bot lên Render

## Bước 1 — Push code lên GitHub

Mở PowerShell, chạy từng lệnh:

```powershell
cd C:\MISU\misu-bot
git init
git add .
git commit -m "Deploy MISU AI bot"
```

Tạo repo mới trên GitHub tên `misu-bot` (không tích "Add README"), sau đó:

```powershell
git remote add origin https://github.com/<YOUR_USERNAME>/misu-bot.git
git branch -M main
git push -u origin main
```

> **Lưu ý:** File `.env` đã có trong `.gitignore` — sẽ không bị push lên GitHub.
> File `data/bang_gia_de_xuat_misu.xlsx` **được push lên** cùng code để Render đọc được bảng giá.

---

## Bước 2 — Tạo Web Service trên Render

1. Vào [https://render.com](https://render.com) → **New** → **Web Service**
2. Chọn repository `misu-bot` vừa tạo
3. Điền cấu hình:

| Trường | Giá trị |
|---|---|
| **Name** | `misu-bot` |
| **Environment** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

> Không cần nhập `PORT` — Render tự cấp PORT qua biến môi trường.

---

## Bước 3 — Thêm Environment Variables

Tab **Environment** → **Add Environment Variable**:

| Key | Value |
|---|---|
| `OPENAI_API_KEY` | `sk-proj-xxxxxxxx` (key thật của bạn) |
| `OPENAI_MODEL` | `gpt-4o-mini` |
| `ORDER_FORM_URL` | `https://misu-order-api.onrender.com/` |

---

## Bước 4 — Kiểm tra sau khi deploy (~2 phút)

Mở trình duyệt:
```
https://misu-bot.onrender.com/health
```

Kết quả đúng:
```json
{
  "status": "ok",
  "mode": "openai",
  "priceTableLoaded": true,
  "priceEntries": 180
}
```

Nếu `mode` là `"fallback"` → kiểm tra lại `OPENAI_API_KEY` trong Environment Variables của Render.

---

## Cập nhật bảng giá sau này

1. Thay file `data/bang_gia_de_xuat_misu.xlsx` trên máy
2. Commit và push:
   ```powershell
   git add data/bang_gia_de_xuat_misu.xlsx
   git commit -m "Update bang gia"
   git push
   ```
3. Render tự redeploy → bot load bảng giá mới

---

## Giữ bot luôn sống (Render Free)

Render Free tắt sau 15 phút không có request. Dùng [UptimeRobot](https://uptimerobot.com) ping `/health` mỗi 10 phút.
