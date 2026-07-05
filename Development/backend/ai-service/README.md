# SRIS AI Service

Microservice Python phục vụ AI cho .NET API (`GP35.SRIS`). Stateless —
không đụng database, không biết tenant. Toàn bộ điều phối + ghi DB do .NET lo.

1. **Embedding** (`/embed`) — sinh **vector embedding** cho text (CV / JD / tiêu chí).
   - Model: `BAAI/bge-m3` (đa ngôn ngữ, hỗ trợ tiếng Việt, **1024 chiều**, đọc tới **8192 token**
     nên embed trọn cả CV 2 trang mà không bị cắt cụt).
   - Khớp với cột `embedding VECTOR(1024)` trong các bảng `Job`, `CvDocument`, `CvChunk`, `EvaluationCriteria`.
2. **Bóc tiêu chí** (`/extract-criteria`) — bóc danh sách tiêu chí có cấu trúc từ JD/Yêu cầu
   tuyển dụng qua Local LLM (docs 5.18, Việc B4; tái dùng pattern JSON schema + validate + retry của Việc 4).
   - Cần [Ollama](https://ollama.com) chạy sẵn + `ollama pull qwen2.5` (đổi model qua env `SRIS_LLM_MODEL`).
   - Output luôn là DRAFT — người duyệt chốt bên .NET. AI không quyết tiêu chí.

## Chạy

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate      # macOS / Linux
pip install -r requirements.txt
uvicorn main:app --port 8000
```

Lần chạy đầu sẽ tự tải model embedding (~2.2GB). Khi thấy `Model san sang. So chieu vector = 1024`
là sẵn sàng. Để cửa sổ này chạy nền.

## Endpoints

| Method | Path             | Mô tả                                            |
|--------|------------------|--------------------------------------------------|
| GET    | `/health`        | Kiểm tra service sống, trả về số chiều vector.   |
| POST   | `/embed`         | Body `{ "text": "..." }` -> `{ "vector": [...], "dim": 1024 }` |
| POST   | `/extract-criteria` | Body `{ "jd_text": "..." }` -> `{ "criteria": [{ "name", "type": "HARD\|SOFT", "cv_matchable", "keywords", "weight" }] }`. Lỗi → HTTP 502 (để .NET fallback nhập tay). |

`/embed` hoạt động độc lập, không cần Ollama.

## Liên kết với .NET API

`appsettings.json` của host:

```json
"AiService": { "BaseUrl": "http://127.0.0.1:8000" }
```

`EmbeddingClient` gọi `POST {BaseUrl}/embed`; `CriteriaExtractionClient` gọi
`POST {BaseUrl}/extract-criteria` (cả hai trong `GP35.SRIS.Lib`).
