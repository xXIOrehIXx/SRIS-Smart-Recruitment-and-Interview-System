# SRIS — Cách chạy & test (cho team)

Backend gọi AI qua HTTP, nên **không chỉ chạy C# là xong**. Bật dịch vụ phụ trước, rồi mới chạy API.

## Bật theo thứ tự

### 1. AI service (embedding + bóc tiêu chí) — cần cho chấm CV theo tiêu chí
```powershell
cd "D:\final_project\SRIS-Smart-Recruitment-and-Interview-System\Development\backend\ai-service"
.\run_ai.ps1
```
Lần đầu tải model BAAI/bge-m3 (~2.2GB), đợi đến khi thấy `Model san sang. So chieu vector = 1024`. Để nguyên cửa sổ.

Cờ hay dùng: `-Force` (port 8000 bận → kill cái cũ) · `-Setup` (chỉ cài) · `-Reinstall` (dựng lại venv) · `-Port 8001`.

### 2. MinIO (lưu file CV gốc) — cần cho upload/chấm CV
```powershell
cd "D:\final_project\SRIS-Smart-Recruitment-and-Interview-System\Development\backend\tools"
.\run_minio.ps1
```
Lần đầu tải `minio.exe` (~100MB). Console: http://127.0.0.1:9001 (minioadmin / minioadmin). Bucket `sris-cv` tự tạo. Để nguyên cửa sổ.

### 3. Ollama — **cần khi test bóc tiêu chí bằng AI**
Cài Ollama rồi tải model 1 lần:
```powershell
ollama pull bge-m3      # embedding (chấm CV, Talent Pool)
ollama pull qwen2.5     # LLM bóc tiêu chí từ JD
```
Ollama tự chạy nền ở port 11434. Thiếu nó → API bóc tiêu chí trả lỗi 502 rõ ràng
(không crash) → vẫn nhập tiêu chí tay được.

### 4. Chạy API
Mở `GP35.SRIS.sln` trong Visual Studio → **F5**. Swagger tự mở.

## Đăng nhập (Swagger)
`POST /api/Account/Login`:
```json
{ "Email": "recruiter@test.com", "Password": "123456" }
interviewer@test.com 123456
manager@test.com 123456

```
Copy `token` trả về → nút **Authorize** (gõ `Bearer <token>` nếu Swagger không tự thêm).

## Database
- **Mặc định:** `appsettings.json` đã trỏ DB chung của team → không cần làm gì.
- **Muốn chạy SQL local:** tạo `Hosts/GP35.SRIS/appsettings.Development.json` (file này gitignored, mỗi người tự giữ):
  ```json
  {
    "ConnectionStrings": {
      "DefaultConnection": "Server=localhost;Database=SRIS;Trusted_Connection=True;TrustServerCertificate=True;"
    }
  }
  ```
  Rồi tạo schema bằng DbMigrator:
  ```powershell
  cd "D:\final_project\SRIS-Smart-Recruitment-and-Interview-System\Development\backend"
  dotnet run --project tools/GP35.SRIS.DbMigrator
  ```

## Email (SMTP) — bật để gửi magic link & email kết quả

Hệ thống tự gửi email cho ứng viên: mời chọn lịch phỏng vấn / tra trạng thái / trả lời offer
(3 loại magic link) và email kết quả khi HIRED/REJECTED. Sender đang dùng là
**SMTP trực tiếp (MailKit)**.

- **Mặc định: TẮT (no-op).** `appsettings.json` để `Smtp.Host` rỗng → hệ thống chỉ log
  "chưa cấu hình" rồi bỏ qua, **không lỗi**. Token gốc vẫn trả trong response API nên test
  luồng ứng viên không cần bật email.
- **Bật gửi thật:** điền config SMTP. Để mật khẩu trong `appsettings.Development.json`
  (file này gitignored — không bị push):

  ```json
  {
    "Smtp": {
      "Host": "smtp.gmail.com",
      "Port": 587,
      "User": "ban@gmail.com",
      "Password": "abcd efgh ijkl mnop",
      "FromEmail": "ban@gmail.com",
      "FromName": "SRIS Recruitment",
      "UseStartTls": true
    },
    "CandidatePortal": { "BaseUrl": "http://localhost:3000" }
  }
  ```

  Rồi **restart API**. (`CandidatePortal.BaseUrl` = gốc URL frontend để dựng link trong email.)

**Gmail — lấy App Password** (bắt buộc, không dùng mật khẩu thường):
1. Bật **2-Step Verification** ở Google Account.
2. *Security → App passwords* → tạo → copy chuỗi **16 ký tự** vào `Smtp.Password`.

**Nhà cung cấp khác:** Outlook `smtp.office365.com:587` (StartTls). Dùng SSL ngầm port 465
thì đặt `"Port": 465, "UseStartTls": false`. Để test không gửi ra ngoài thật, dùng
[Mailtrap](https://mailtrap.io) (sandbox) — chỉ đổi Host/User/Password.

> Muốn đổi sang gửi qua NotificationCenter (HTTP) thay vì SMTP: đổi 1 dòng DI trong
> `ServiceCollectionExtensions.cs` (`SmtpEmailService` → `EmailService`).

## Test nhanh trục tiêu chí + chấm CV (cần AI service + Ollama)
Trên Swagger, sau khi Authorize:
1. Tạo job có JD đầy đủ: `POST /api/jobs`.
2. Bóc tiêu chí từ JD: `POST /api/jobs/{jobId}/criteria/extract` → danh sách tiêu chí **DRAFT**.
3. Sửa/thêm/bớt tiêu chí rồi chốt: `POST /api/jobs/{jobId}/criteria/approve` → **APPROVED**.
4. Nộp CV qua career site công khai (hoặc `POST /api/public/{slug}/jobs/{jobId}/apply`).
5. Điểm chấm chạy ở worker nền → xem kết quả theo từng tiêu chí (khớp/thiếu + câu bằng chứng):
   `GET /api/applications/{applicationId}/cv-score`.
6. Talent Pool (quét ngược kho CV cũ): `GET /api/jobs/{jobId}/talent-pool`.

> Đường dẫn chính xác của từng endpoint xem `Development/backend/docs/API_ENDPOINTS.md`
> — file đó là nguồn tham chiếu duy nhất, được cập nhật cùng commit khi backend đổi API.

## Seed dữ liệu demo đầy đủ
Muốn có sẵn user 4 vai, job + bộ tiêu chí đã duyệt, ứng viên đủ mọi pha, pool phỏng vấn,
phiếu chấm đã nộp và offer:
```powershell
cd "D:\final_project\SRIS-Smart-Recruitment-and-Interview-System\Development\backend"
python tools/seed_demo.py <admin-email> <password>
```
Cần backend :5082 + MinIO :9000 (+ AI service :8000 nếu muốn có điểm chấm CV).

## Tóm tắt cổng
| Dịch vụ | URL |
|---|---|
| AI service | http://127.0.0.1:8000 |
| MinIO API / Console | :9000 / :9001 |
| Ollama | :11434 |


note tạm sau khi code gần xong deploy ollama:
Đã note vào memory (demo-public-deploy-todo) — gồm cả bug presigned localhost:9000 cần sửa và hướng Cloudflare Tunnel. Bao giờ code gần xong nhắc "làm cái deploy demo" là tôi mở lại.