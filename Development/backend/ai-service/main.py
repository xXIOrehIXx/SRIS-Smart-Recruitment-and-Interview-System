"""
============================================================
SRIS — PYTHON AI SERVICE (embedding)
------------------------------------------------------------
Vai trò trong kiến trúc: "máy tính toán" thuần.
- KHÔNG đụng database.
- KHÔNG biết company_id / tenant / nghiệp vụ là gì.
- Chỉ nhận text -> trả về vector. Hết.

Toàn bộ điều phối, ghi DB, lọc tenant do .NET API (GP35.SRIS) lo.
Model: paraphrase-multilingual-MiniLM-L12-v2 -> vector 384 chiều,
hỗ trợ tiếng Việt. Khớp với cột VECTOR(384) trong SQL Server.
============================================================
"""

from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI(title="SRIS AI Service")

# Tải model 1 lần lúc service khởi động (lần đầu sẽ tự tải model về máy).
# normalize_embeddings=True -> vector đã chuẩn hóa, đo cosine ổn định.
print(">> Dang tai model paraphrase-multilingual-MiniLM-L12-v2 ...")
model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
DIM = model.get_sentence_embedding_dimension()
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
    Lưu ý: model có giới hạn độ dài đầu vào (~256 word-pieces),
    text dài hơn sẽ bị cắt bớt (chunking là hướng mở rộng sau).
    """
    vec = model.encode(req.text or "", normalize_embeddings=True)
    return EmbedResponse(vector=vec.tolist(), dim=len(vec))


# Chạy:   uvicorn main:app --port 8000
