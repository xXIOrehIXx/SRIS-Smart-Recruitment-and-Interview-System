"""
============================================================
SRIS — PYTHON AI SERVICE
------------------------------------------------------------
Vai trò trong kiến trúc: "máy tính toán" thuần.
- KHÔNG đụng database.
- KHÔNG biết company_id / tenant / nghiệp vụ là gì.
- Chỉ nhận text -> trả về kết quả tính toán (vector hoặc quiz). Hết.

Toàn bộ điều phối, ghi DB, lọc tenant do .NET API (GP35.SRIS) lo.

Service này phục vụ 2 mảng AI:
  - /embed         : sinh vector embedding cho CV/JD
                     (model paraphrase-multilingual-MiniLM-L12-v2 -> VECTOR(384))
  - /generate-quiz : sinh quiz trắc nghiệm MCQ từ JD qua Local LLM (Ollama)
============================================================
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

from quiz_gen import generate_quiz   # sinh quiz MCQ qua Ollama

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


# ============================================================
#  GENERATE-QUIZ — sinh quiz trắc nghiệm MCQ từ JD (Local LLM qua Ollama)
#  Nhận JD text -> trả danh sách câu hỏi. Vẫn "máy tính toán" thuần:
#  không đụng DB, không biết tenant. .NET lo việc lưu DRAFT + duyệt.
# ============================================================
class GenerateQuizRequest(BaseModel):
    jd_text: str
    num_questions: int = 10
    topic: str | None = None          # nút "Thêm câu theo chủ đề"
    avoid: list[str] | None = None    # câu đã có -> tránh trùng (gen thêm / gen lại)


class QuizQuestionOut(BaseModel):
    question: str
    options: list[str]
    correct_index: int


class GenerateQuizResponse(BaseModel):
    questions: list[QuizQuestionOut]


@app.post("/generate-quiz", response_model=GenerateQuizResponse)
def generate_quiz_endpoint(req: GenerateQuizRequest):
    """
    Nhận JD text -> sinh quiz qua Ollama.
    Nếu không sinh được quiz hợp lệ (hoặc Ollama lỗi) -> trả HTTP 502
    kèm lý do; .NET nhận lỗi này để kích hoạt fallback HR nhập tay.
    """
    try:
        quiz = generate_quiz(
            req.jd_text, req.num_questions, topic=req.topic, avoid=req.avoid
        )
    except Exception as e:
        # Gói mọi lỗi (Ollama chưa chạy, model lỗi, retry hết lượt...) thành 502
        raise HTTPException(status_code=502, detail=f"Gen quiz that bai: {e}")

    return GenerateQuizResponse(
        questions=[
            QuizQuestionOut(
                question=q.question,
                options=q.options,
                correct_index=q.correct_index,
            )
            for q in quiz.questions
        ]
    )


# Chạy:   uvicorn main:app --port 8000
