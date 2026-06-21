# SRIS — Cách chạy & test (cho team)

Backend gọi AI qua HTTP, nên **không chỉ chạy C# là xong**. Bật dịch vụ phụ trước, rồi mới chạy API.

## Bật theo thứ tự

### 1. AI service (embedding + gen quiz) — cần cho chấm CV & gen quiz
```powershell
cd "D:\final_project\SRIS-Smart-Recruitment-and-Interview-System\Development\backend\ai-service"
.\run_ai.ps1
```
Lần đầu tải model (~120MB), đợi đến khi thấy `Model san sang. So chieu vector = 384`. Để nguyên cửa sổ.

Cờ hay dùng: `-Force` (port 8000 bận → kill cái cũ) · `-Setup` (chỉ cài) · `-Reinstall` (dựng lại venv) · `-Port 8001`.

### 2. MinIO (lưu file CV gốc) — cần cho upload/chấm CV
```powershell
cd "D:\final_project\SRIS-Smart-Recruitment-and-Interview-System\Development\backend\tools"
.\run_minio.ps1
```
Lần đầu tải `minio.exe` (~100MB). Console: http://127.0.0.1:9001 (minioadmin / minioadmin). Bucket `sris-cv` tự tạo. Để nguyên cửa sổ.

### 3. Ollama — **chỉ cần khi test gen quiz AI**
Cài Ollama rồi tải model 1 lần:
```powershell
ollama pull qwen2.5
```
Ollama tự chạy nền ở port 11434. Thiếu nó → API gen quiz trả lỗi 502 rõ ràng (không crash).

### 4. Chạy API
Mở `GP35.SRIS.sln` trong Visual Studio → **F5**. Swagger tự mở.

## Đăng nhập (Swagger)
`POST /api/auth/login`:
```json
{ "Email": "recruiter@test.com", "Password": "123456" }
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

## Test nhanh gen quiz AI (cần AI service + Ollama)
Trên Swagger, sau khi Authorize:
1. `POST /api/quizzes/jobs/{jobId}/generate?numQuestions=10` → tạo quiz **DRAFT**.
2. Nút AI: `.../questions/generate?count=N` (gen thêm) · `.../questions/{id}/regenerate` (gen lại 1 câu) · `.../questions/by-topic` (thêm theo chủ đề).
3. Sửa tay: `PUT .../questions/{id}`.
4. `POST /api/quizzes/{quizId}/approve` → DRAFT → **READY**.

## Tóm tắt cổng
| Dịch vụ | URL |
|---|---|
| AI service | http://127.0.0.1:8000 |
| MinIO API / Console | :9000 / :9001 |
| Ollama | :11434 |


note tạm sau khi code gần xong deploy ollama:
Đã note vào memory (demo-public-deploy-todo) — gồm cả bug presigned localhost:9000 cần sửa và hướng Cloudflare Tunnel. Bao giờ code gần xong nhắc "làm cái deploy demo" là tôi mở lại.