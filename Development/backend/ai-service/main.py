"""
============================================================
SRIS — PYTHON AI SERVICE
------------------------------------------------------------
Vai trò trong kiến trúc: "máy tính toán" thuần.
- KHÔNG đụng database.
- KHÔNG biết company_id / tenant / nghiệp vụ là gì.
- Chỉ nhận text -> trả về kết quả tính toán. Hết.

Toàn bộ điều phối, ghi DB, lọc tenant do .NET API (GP35.SRIS) lo.

Endpoint:
  - /extract-criteria : bóc tiêu chí từ Yêu cầu tuyển dụng/JD qua Local LLM
                        (Ollama — docs 5.18, Việc B4; DRAFT cho người duyệt)
  - /screen-cv        : đối chiếu CV với JD -> tóm tắt + đạt/thiếu + đề xuất
                        (tham khảo cho người sàng lọc, không tự quyết thay ai)

Vì sao chạy Local LLM (không gọi OpenAI)?
  - Dữ liệu tuyển dụng không rời hạ tầng của khách hàng.
  - Không phụ thuộc nhà cung cấp, không phát sinh chi phí theo lượt gọi.
  - Bài toán biến đổi văn bản có schema cố định, không cần mô hình mạnh nhất.

Hai việc dùng HAI model riêng, đổi độc lập bằng biến môi trường:
  - SRIS_LLM_MODEL (mặc định 'qwen2.5') — bóc tiêu chí, bài chép lại có cấu trúc.
  - SRIS_CV_MODEL  (mặc định 'qwen3:8b') — sàng lọc CV, bài đối chiếu hai văn bản dài,
    cần model khá hơn; nâng model cho việc này không đụng tới việc kia.
============================================================
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from criteria_extract import MODEL, NUM_CTX, CriteriaList, extract_criteria
from cv_screening import MODEL as CV_MODEL
from cv_screening import NUM_CTX as CV_NUM_CTX
from cv_screening import CvScreeningResult, screen_cv

app = FastAPI(title="SRIS AI Service")


@app.get("/health")
def health():
    """
    Kiểm tra service sống + cho biết đang chạy model nào với cửa sổ ngữ cảnh bao nhiêu.
    Phơi num_ctx ra đây để kiểm được bằng mắt — tràn ngữ cảnh không báo lỗi, nên cách
    duy nhất biết cấu hình đã ăn hay chưa là nhìn nó.
    """
    return {
        "status": "ok",
        "llm_model": MODEL,
        "num_ctx": NUM_CTX,
        "cv_model": CV_MODEL,
        "cv_num_ctx": CV_NUM_CTX,
    }


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


# ============================================================
#  SCREEN-CV — đối chiếu CV với JD (Local LLM qua Ollama)
#  Kết quả là ĐỀ XUẤT THAM KHẢO. Người tuyển dụng vẫn là người quyết.
# ============================================================
class ScreenCvRequest(BaseModel):
    cv_text: str
    jd_text: str


@app.post("/screen-cv", response_model=CvScreeningResult)
def screen_cv_endpoint(req: ScreenCvRequest):
    """
    Nhận (text CV, text JD) -> tóm tắt CV + yêu cầu đạt/thiếu + điểm phù hợp + đề xuất.
    Lỗi (Ollama chưa chạy / model chưa pull / LLM không ra JSON hợp lệ) -> HTTP 502
    để .NET đánh dấu lượt sàng lọc là FAILED.
    """
    try:
        return screen_cv(req.cv_text, req.jd_text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Sang loc CV that bai: {e}")


# Chạy:   uvicorn main:app --port 8000
# Cần Ollama chạy (mặc định cổng 11434) + `ollama pull qwen2.5` + `ollama pull qwen3:8b`.
