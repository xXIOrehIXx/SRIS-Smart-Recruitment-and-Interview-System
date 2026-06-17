# SRIS AI Service (embedding)

Microservice Python sinh **vector embedding** cho text (CV / JD). Stateless —
không đụng database, không biết tenant. Toàn bộ điều phối + ghi DB do .NET API
(`GP35.SRIS`) đảm nhiệm.

- Model: `paraphrase-multilingual-MiniLM-L12-v2` (hỗ trợ tiếng Việt, **384 chiều**).
- Khớp với cột `embedding VECTOR(384)` trong các bảng `Job`, `CvDocument`.

## Chạy

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate      # macOS / Linux
pip install -r requirements.txt
uvicorn main:app --port 8000
```

Lần chạy đầu sẽ tự tải model (~120MB). Khi thấy `Model san sang. So chieu vector = 384`
là sẵn sàng. Để cửa sổ này chạy nền.

## Endpoints

| Method | Path      | Mô tả                                            |
|--------|-----------|--------------------------------------------------|
| GET    | `/health` | Kiểm tra service sống, trả về số chiều vector.   |
| POST   | `/embed`  | Body `{ "text": "..." }` -> `{ "vector": [...], "dim": 384 }` |

## Liên kết với .NET API

`appsettings.json` của host:

```json
"AiService": { "BaseUrl": "http://127.0.0.1:8000" }
```

`EmbeddingClient` (trong `GP35.SRIS.Lib`) gọi `POST {BaseUrl}/embed` để lấy vector.
