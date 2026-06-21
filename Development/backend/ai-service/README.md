# SRIS AI Service

Microservice Python phục vụ 2 mảng AI cho .NET API (`GP35.SRIS`). Stateless —
không đụng database, không biết tenant. Toàn bộ điều phối + ghi DB do .NET lo.

1. **Embedding** (`/embed`) — sinh **vector embedding** cho text (CV / JD).
   - Model: `paraphrase-multilingual-MiniLM-L12-v2` (hỗ trợ tiếng Việt, **384 chiều**).
   - Khớp với cột `embedding VECTOR(384)` trong các bảng `Job`, `CvDocument`.
2. **Gen quiz** (`/generate-quiz`) — sinh quiz trắc nghiệm **MCQ** từ JD qua Local LLM (Ollama).
   - Cần [Ollama](https://ollama.com) chạy sẵn + `ollama pull qwen2.5` (đổi model ở `quiz_gen.py`).
   - Quiz luôn về .NET ở trạng thái nháp; Recruiter duyệt DRAFT → READY (5.6).

## Chạy

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate      # macOS / Linux
pip install -r requirements.txt
uvicorn main:app --port 8000
```

Lần chạy đầu sẽ tự tải model embedding (~120MB). Khi thấy `Model san sang. So chieu vector = 384`
là sẵn sàng. Để cửa sổ này chạy nền. Gen quiz cần Ollama chạy riêng (mặc định cổng 11434).

## Endpoints

| Method | Path             | Mô tả                                            |
|--------|------------------|--------------------------------------------------|
| GET    | `/health`        | Kiểm tra service sống, trả về số chiều vector.   |
| POST   | `/embed`         | Body `{ "text": "..." }` -> `{ "vector": [...], "dim": 384 }` |
| POST   | `/generate-quiz` | Body `{ "jd_text": "...", "num_questions": 10, "topic": null, "avoid": [] }` -> `{ "questions": [{ "question", "options", "correct_index" }] }`. Lỗi → HTTP 502 (để .NET fallback HR nhập tay). |

## Liên kết với .NET API

`appsettings.json` của host:

```json
"AiService": { "BaseUrl": "http://127.0.0.1:8000" }
```

`EmbeddingClient` gọi `POST {BaseUrl}/embed`; `QuizGenClient` gọi `POST {BaseUrl}/generate-quiz`
(cả hai trong `GP35.SRIS.Lib`).
