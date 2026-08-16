# SRIS AI Service

Microservice Python phục vụ AI cho .NET API (`GP35.SRIS`). Stateless —
không đụng database, không biết tenant. Toàn bộ điều phối + ghi DB do .NET lo.

Hai việc, hai endpoint:

**Bóc tiêu chí** (`/extract-criteria`) — bóc danh sách tiêu chí có cấu trúc từ JD/Yêu cầu
tuyển dụng qua Local LLM. Output luôn là DRAFT — người duyệt chốt bên .NET.

**Sàng lọc CV** (`/screen-cv`) — đối chiếu text CV với JD: tóm tắt CV, liệt kê yêu cầu
**đạt** (kèm câu trích nguyên văn từ CV làm bằng chứng) / **thiếu**, điểm phù hợp 0-100 và
đề xuất `PROCEED` / `CONSIDER` / `REJECT`. Đề xuất là **tham khảo**: .NET không tự đổi trạng
thái hồ sơ theo nó, người tuyển dụng đọc rồi tự quyết.

Hạ tầng embedding/vector đã bỏ hẳn ở V036 — không còn `/embed`, không còn `bge-m3`.
Việc đối chiếu ở `/screen-cv` là do LLM đọc hiểu, không phải so vector.

- Cần [Ollama](https://ollama.com) chạy sẵn + **hai** model:

  ```bash
  ollama pull qwen2.5     # bóc tiêu chí  (đổi qua env SRIS_LLM_MODEL)
  ollama pull qwen3:8b    # sàng lọc CV   (đổi qua env SRIS_CV_MODEL)
  ```

  Tách hai biến môi trường có chủ đích: bóc tiêu chí là bài "chép lại có cấu trúc", model
  nhỏ làm tốt rồi; sàng lọc CV bắt model đối chiếu hai văn bản dài rồi kết luận nên cần
  model khá hơn. Nâng model cho việc này không được làm chậm/đổi kết quả việc kia.

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

> **Làm nóng trước khi demo.** Lần gọi đầu sau khi khởi động Ollama phải nạp ~5GB model
> vào RAM nên chậm hơn hẳn các lần sau. Hai endpoint dùng **hai model khác nhau** nên phải
> làm nóng riêng từng cái: bắn một lần `/extract-criteria` và một lần `/screen-cv` bỏ đi
> trước khi trình bày.

## Endpoints

| Method | Path             | Mô tả                                            |
|--------|------------------|--------------------------------------------------|
| GET    | `/health`        | Kiểm tra service sống + tên model đang chạy.     |
| POST   | `/extract-criteria` | Body `{ "jd_text": "..." }` -> `{ "criteria": [{ "name", "weight" }] }`. Lỗi → HTTP 502. |
| POST   | `/screen-cv`     | Body `{ "cv_text": "...", "jd_text": "..." }` -> xem bên dưới. Lỗi → HTTP 502. |

Đầu ra `/screen-cv`:

```json
{
  "summary": "3-5 câu chân dung nghề nghiệp của ứng viên",
  "matched": [{ "requirement": "Thành thạo SQL Server", "evidence": "câu trích nguyên văn từ CV" }],
  "missing": ["Tiếng Anh giao tiếp"],
  "fit_score": 72,
  "decision": "PROCEED",
  "decision_reason": "1-2 câu nêu lý do cụ thể"
}
```

Danh sách `criteria` **rỗng là kết quả hợp lệ** (văn bản chỉ liệt kê đầu việc, hoặc chỉ nêu
những thứ đọc hồ sơ là biết), không phải lỗi — .NET phân biệt hai ca này.

Mỗi tiêu chí chỉ có `name` + `weight`. Bản trước còn `type` (HARD/SOFT), `cv_matchable`,
`keywords`; cả ba phục vụ tính năng máy chấm CV đã cắt khỏi scope 08/08/2026 nên xoá hẳn ở
V038. Kèm theo đó, prompt chỉ bóc thứ **phải hỏi mới biết** — bằng cấp, chứng chỉ, bằng lái
không lên phiếu chấm nữa vì người tuyển dụng đã đối chiếu ở bước sàng lọc hồ sơ.

### Chống bịa ở `/screen-cv`

Rủi ro lớn nhất của việc này không phải sai chính tả mà là **bằng chứng bịa**: model đọc
"tốt nghiệp ngành CNTT" rồi kết luận ứng viên biết Java. Ba lớp chặn:

1. **Bắt buộc trích dẫn.** Mỗi mục `matched` phải kèm `evidence` là câu/cụm **trích nguyên
   văn** từ CV. Không trích được thì phải xếp xuống `missing`. Người đọc kiểm chứng được
   ngay trên màn hình mà không phải mở lại file PDF.
2. **Chặn đầu vào rỗng.** CV < 100 ký tự -> ném lỗi luôn. CV rỗng vẫn ra được JSON hợp lệ:
   model bịa ra một ứng viên không tồn tại rồi chấm điểm cho người đó.
3. **Ép `decision` khớp `fit_score`.** Ngưỡng nằm trong `cv_screening.py` (≥70 `PROCEED`,
   45-69 `CONSIDER`, <45 `REJECT`) và được áp lại **sau khi** model trả lời. LLM rất hay
   trả `fit_score: 35` kèm `decision: "PROCEED"` — hai con số mâu thuẫn nằm cạnh nhau trên
   màn hình là thứ người dùng thấy ngay và mất niềm tin vào cả tính năng.

Chất lượng đầu ra còn phụ thuộc một mắt xích **ngoài** service này: `PdfTextExtractor` bên
.NET phải bóc text theo đúng thứ tự đọc. Bản cũ cố ý vứt thứ tự (khi đó text chỉ dùng cho
embedding, vốn không nhạy thứ tự) nên CV 2 cột ra text cài răng lược và LLM đọc tiêu đề mục
thành tên công ty — đó chính là lý do tính năng tóm tắt CV ở V033 bị bỏ ngay tại V034.

## Cách đầu ra được giữ đúng cấu trúc

1. **Ràng buộc lúc sinh:** schema Pydantic được đưa thẳng vào Ollama qua
   `format=CriteriaList.model_json_schema()` — model bị chặn ở tầng giải mã, không phải
   được "dặn" trả JSON trong prompt. `temperature=0` để cùng đầu vào cho cùng đầu ra.
   `num_ctx=8192` đặt tường minh (env `SRIS_LLM_NUM_CTX`): mặc định 4096 của Ollama không đủ
   cho JD tiếng Việt dài — cửa sổ tính cả prompt lẫn đầu ra, mà tràn thì Ollama cắt bớt rồi
   chạy tiếp **không báo lỗi**. Kiểm bằng `curl .../health` xem `num_ctx` đã ăn chưa.
2. **Validate:** `CriteriaList.model_validate_json()` — sai cú pháp JSON, thiếu trường,
   `weight` ngoài 0.1–5, quá 10 tiêu chí đều bị coi là hỏng.
3. **Retry:** tối đa `MAX_RETRY = 3` lượt. Hết lượt -> ném lỗi -> HTTP 502.
   Lỗi hạ tầng (Ollama chưa chạy) ném thẳng, không phí lượt retry.
4. **.NET kẹp lại lần nữa:** clamp `weight`, bỏ tiêu chí tên < 2 ký tự sau khi trim (tên toàn
   dấu cách lọt `min_length=2` của Pydantic vì đúng là 2 ký tự).

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
