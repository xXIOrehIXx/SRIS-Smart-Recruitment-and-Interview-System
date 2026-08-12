# SRIS AI Service

Microservice Python phục vụ AI cho .NET API (`GP35.SRIS`). Stateless —
không đụng database, không biết tenant. Toàn bộ điều phối + ghi DB do .NET lo.

**Bóc tiêu chí** (`/extract-criteria`) — bóc danh sách tiêu chí có cấu trúc từ JD/Yêu cầu
tuyển dụng qua Local LLM. Đây là **endpoint duy nhất**: hạ tầng embedding/vector đã bỏ
hẳn ở V036 (không còn `/embed`, không còn `bge-m3`).

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

Không tải model nào lúc khởi động — model nằm trong Ollama. Kiểm tra sẵn sàng bằng
`curl http://127.0.0.1:8000/health`.

> **Làm nóng trước khi demo.** Lần gọi đầu sau khi khởi động Ollama phải nạp ~4,7GB model
> vào RAM nên chậm hơn hẳn các lần sau. Bắn một lần `/extract-criteria` bỏ đi trước khi trình bày.

## Endpoints

| Method | Path             | Mô tả                                            |
|--------|------------------|--------------------------------------------------|
| GET    | `/health`        | Kiểm tra service sống + tên model đang chạy.     |
| POST   | `/extract-criteria` | Body `{ "jd_text": "..." }` -> `{ "criteria": [{ "name", "type": "HARD\|SOFT", "cv_matchable", "keywords", "weight" }] }`. Lỗi → HTTP 502. |

Danh sách `criteria` **rỗng là kết quả hợp lệ** (JD chỉ liệt kê đầu việc, không nêu yêu cầu
nào với ứng viên), không phải lỗi — .NET phân biệt hai ca này.

## Cách đầu ra được giữ đúng cấu trúc

1. **Ràng buộc lúc sinh:** schema Pydantic được đưa thẳng vào Ollama qua
   `format=CriteriaList.model_json_schema()` — model bị chặn ở tầng giải mã, không phải
   được "dặn" trả JSON trong prompt. `temperature=0` để cùng đầu vào cho cùng đầu ra.
   `num_ctx=8192` đặt tường minh (env `SRIS_LLM_NUM_CTX`): mặc định 4096 của Ollama KHÔNG
   đủ — prompt + schema đã ~2300 token, cộng JD và đầu ra là tràn, mà tràn thì Ollama cắt
   bớt rồi chạy tiếp **không báo lỗi**. Kiểm bằng `curl .../health` xem `num_ctx` đã ăn chưa.
2. **Validate:** `CriteriaList.model_validate_json()` — sai cú pháp JSON, thiếu trường,
   `type` ngoài HARD/SOFT, `weight` ngoài 0.1–5, quá 10 tiêu chí đều bị coi là hỏng.
3. **Retry:** tối đa `MAX_RETRY = 3` lượt. Hết lượt -> ném lỗi -> HTTP 502.
   Lỗi hạ tầng (Ollama chưa chạy) ném thẳng, không phí lượt retry.
4. **.NET kẹp lại lần nữa:** clamp `weight`, ép `type` lạ về SOFT, bỏ tiêu chí tên < 2 ký tự.

## Liên kết với .NET API

`appsettings.json` của host:

```json
"AiService": {
  "BaseUrl": "http://127.0.0.1:8000",
  "ExtractTimeoutSeconds": 300
}
```

`CriteriaExtractionClient` (trong `GP35.SRIS.Lib`) gọi `POST {BaseUrl}/extract-criteria`.

**Lượt bóc chạy nền (V037):** .NET không gọi endpoint này trong request của người dùng.
`POST /api/jobs/{id}/criteria/extract` chỉ xếp một dòng `CriteriaExtraction` trạng thái
`PENDING` rồi trả `202`; `CriteriaExtractionWorker` mới là chỗ gọi sang đây. Lý do: Local LLM
chạy CPU mất hàng chục giây, gọi đồng bộ thì trình duyệt bỏ cuộc (axios timeout 30s) trong khi
backend vẫn đang chạy — người dùng thấy "lỗi mạng" dù AI vẫn làm việc bình thường.
