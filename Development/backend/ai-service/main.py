"""
============================================================
SRIS — PYTHON AI SERVICE
------------------------------------------------------------
Vai trò trong kiến trúc: "máy tính toán" thuần.
- KHÔNG đụng database.
- KHÔNG biết company_id / tenant / nghiệp vụ là gì.
- Chỉ nhận text -> trả về kết quả tính toán. Hết.

Toàn bộ điều phối, ghi DB, lọc tenant do .NET API (GP35.SRIS) lo.

Endpoint duy nhất:
  - /extract-criteria : bóc tiêu chí từ Yêu cầu tuyển dụng/JD qua Local LLM
                        (Ollama — docs 5.18, Việc B4; DRAFT cho người duyệt)

Vì sao chạy Local LLM (không gọi OpenAI)?
  - Dữ liệu tuyển dụng không rời hạ tầng của khách hàng.
  - Không phụ thuộc nhà cung cấp, không phát sinh chi phí theo lượt gọi.
  - Bài toán biến đổi văn bản có schema cố định, không cần mô hình mạnh nhất.

Đổi model bằng biến môi trường SRIS_LLM_MODEL (mặc định 'qwen2.5').
============================================================
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from criteria_extract import MODEL, CriteriaList, extract_criteria

app = FastAPI(title="SRIS AI Service")


@app.get("/health")
def health():
    """Kiểm tra service sống + cho biết đang chạy model nào."""
    return {"status": "ok", "llm_model": MODEL}


# ============================================================
#  EXTRACT-CRITERIA — bóc tiêu chí từ JD (Local LLM qua Ollama, docs 5.18)
#  AI chỉ bóc thành danh sách DRAFT; người duyệt chốt bên .NET.
# ============================================================
class ExtractCriteriaRequest(BaseModel):
    jd_text: str


@app.post("/extract-criteria", response_model=CriteriaList)
def extract_criteria_endpoint(req: ExtractCriteriaRequest):
    """
    Nhận JD/Yêu cầu tuyển dụng -> danh sách tiêu chí có cấu trúc.
    Lỗi (Ollama chưa chạy / LLM không ra JSON hợp lệ) -> HTTP 502
    để .NET đánh dấu lượt bóc là FAILED và người dùng nhập tay.
    """
    try:
        return extract_criteria(req.jd_text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Boc tieu chi that bai: {e}")


# Chạy:   uvicorn main:app --port 8000
# Cần Ollama chạy (mặc định cổng 11434) + `ollama pull qwen2.5`.
