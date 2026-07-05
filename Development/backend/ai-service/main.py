"""
============================================================
SRIS — PYTHON AI SERVICE
------------------------------------------------------------
Vai trò trong kiến trúc: "máy tính toán" thuần.
- KHÔNG đụng database.
- KHÔNG biết company_id / tenant / nghiệp vụ là gì.
- Chỉ nhận text -> trả về kết quả tính toán (vector). Hết.

Toàn bộ điều phối, ghi DB, lọc tenant do .NET API (GP35.SRIS) lo.

Endpoint hiện có:
  - /embed            : sinh vector embedding cho CV/JD/tiêu chí
                        (model BAAI/bge-m3 -> VECTOR(1024), đọc tới 8192 token)
  - /extract-criteria : bóc tiêu chí từ Yêu cầu tuyển dụng/JD qua Local LLM
                        (Ollama — docs 5.18, Việc B4; DRAFT cho người duyệt)
============================================================
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

from criteria_extract import CriteriaList, extract_criteria

app = FastAPI(title="SRIS AI Service")

# Tải model 1 lần lúc service khởi động (lần đầu sẽ tự tải model ~2.2GB về máy).
# normalize_embeddings=True -> vector đã chuẩn hóa, đo cosine ổn định.
# DIM lấy động từ model (bge-m3 -> 1024), không hard-code.
print(">> Dang tai model BAAI/bge-m3 ...")
model = SentenceTransformer("BAAI/bge-m3")
# Tên mới `get_embedding_dimension` (ST >=3.x); fallback tên cũ cho bản thấp hơn.
DIM = (
    model.get_embedding_dimension()
    if hasattr(model, "get_embedding_dimension")
    else model.get_sentence_embedding_dimension()
)
print(f">> Model san sang. So chieu vector = {DIM}")


class EmbedRequest(BaseModel):
    text: str


class EmbedResponse(BaseModel):
    vector: list[float]
    dim: int


@app.get("/health")
def health():
    """Kiểm tra service sống và lấy số chiều vector."""
    return {"status": "ok", "dim": DIM}


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    """
    Nhận 1 đoạn text (CV hoặc JD) -> trả về vector embedding.
    bge-m3 đọc tới 8192 token -> embed trọn cả CV 2 trang / CV tiếng Việt
    mà không bị cắt cụt; text vượt 8192 token mới bị cắt bớt.
    """
    vec = model.encode(req.text or "", normalize_embeddings=True)
    return EmbedResponse(vector=vec.tolist(), dim=len(vec))


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
    để .NET kích hoạt fallback người nhập tay.
    """
    try:
        return extract_criteria(req.jd_text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Boc tieu chi that bai: {e}")


# Chạy:   uvicorn main:app --port 8000
# Bóc tiêu chí cần Ollama chạy riêng (mặc định cổng 11434) + `ollama pull qwen2.5`;
# /embed hoạt động độc lập, không cần Ollama.
