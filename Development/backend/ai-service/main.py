"""
============================================================
SRIS — PYTHON AI SERVICE
------------------------------------------------------------
Vai trò trong kiến trúc: "máy tính toán" thuần.
- KHÔNG đụng database.
- KHÔNG biết company_id / tenant / nghiệp vụ là gì.
- Chỉ nhận text -> trả về kết quả tính toán (vector / tiêu chí). Hết.

Toàn bộ điều phối, ghi DB, lọc tenant do .NET API (GP35.SRIS) lo.

Endpoint hiện có:
  - /embed            : sinh vector embedding cho CV/JD/tiêu chí
                        (model BAAI/bge-m3 chạy QUA OLLAMA -> VECTOR(1024))
  - /extract-criteria : bóc tiêu chí từ Yêu cầu tuyển dụng/JD qua Local LLM
                        (Ollama — docs 5.18, Việc B4; DRAFT cho người duyệt)

Vì sao embed qua Ollama (không phải sentence-transformers + torch)?
  - Ollama đã chạy sẵn cho /extract-criteria -> 1 runtime AI duy nhất, không thêm torch.
  - Cùng model bge-m3, cùng 1024 chiều -> không đổi cột VECTOR / code .NET.
  - Tránh phụ thuộc torch (nặng, kén phiên bản Python).
Đổi model bằng biến môi trường SRIS_EMBED_MODEL (mặc định 'bge-m3').
============================================================
"""

import os

import ollama
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from criteria_extract import CriteriaList, extract_criteria

app = FastAPI(title="SRIS AI Service")

EMBED_MODEL = os.environ.get("SRIS_EMBED_MODEL", "bge-m3")

# Probe số chiều 1 lần lúc khởi động (cũng làm nóng model trong Ollama).
print(f">> Dang do so chieu embedding model '{EMBED_MODEL}' qua Ollama ...")
try:
    _probe = ollama.embeddings(model=EMBED_MODEL, prompt="warmup")["embedding"]
    DIM = len(_probe)
    print(f">> Model san sang. So chieu vector = {DIM}")
except Exception as _e:
    DIM = 1024
    print(f">> CANH BAO: khong do duoc dim luc khoi dong ({_e}); mac dinh DIM={DIM}. "
          f"Kiem tra Ollama chay + `ollama pull {EMBED_MODEL}`.")


class EmbedRequest(BaseModel):
    text: str


class EmbedResponse(BaseModel):
    vector: list[float]
    dim: int


@app.get("/health")
def health():
    """Kiểm tra service sống và lấy số chiều vector."""
    return {"status": "ok", "dim": DIM, "embed_model": EMBED_MODEL}


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    """
    Nhận 1 đoạn text (CV / JD / tiêu chí) -> vector embedding qua Ollama (bge-m3).
    Cosine là bất biến theo độ dài vector nên không cần chuẩn hóa L2 ở đây
    (VECTOR_DISTANCE('cosine', ...) tự chuẩn hóa khi tính).
    """
    try:
        vec = ollama.embeddings(model=EMBED_MODEL, prompt=req.text or "")["embedding"]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Embed that bai (Ollama): {e}")
    return EmbedResponse(vector=vec, dim=len(vec))


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
# Cần Ollama chạy (mặc định cổng 11434) + `ollama pull bge-m3` (embed) + `ollama pull qwen2.5` (tiêu chí).
