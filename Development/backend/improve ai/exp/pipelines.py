"""
============================================================
PIPELINES — các version sinh quiz để so sánh (Section 16.4)
------------------------------------------------------------
Mỗi version là 1 hàm:  pipeline(jd_text, num_questions) -> list[Question]
Tất cả chạy trên CÙNG bộ JD (jd_test_set.json) + CÙNG rubric để pass-rate
so sánh được. Quy tắc vàng: mỗi version chỉ đổi ĐÚNG 1 yếu tố so với version
trước (16.4) — đừng đổi nhiều thứ cùng lúc, không thì không biết cải tiến từ đâu.

  v1_baseline       : gửi JD -> gen N câu (1 phát). MỐC GỐC.
  v2_skill_extraction: trích skill từ JD -> gen theo từng skill        (Bước 3)
  v3_fewshot        : v2 + thêm 1-2 câu mẫu (few-shot)                 (Bước 3)
  v4_situational    : v3 + ép câu tình huống + ràng buộc distractor    (Bước 3)
  v5_self_critique  : v4 + lượt AI tự soát rồi sửa                     (Bước 3)

Phần này là "máy tính toán" thuần (giống ai-service): KHÔNG đụng DB, KHÔNG
biết company_id/tenant. Chỉ JD text vào -> câu hỏi ra.
============================================================
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from ollama import chat
from pydantic import BaseModel, Field

# ---- Cấu hình chung (giữ giống PoC ai-service để so sánh công bằng) ----
MODEL = "qwen2.5"
NUM_OPTIONS = 4
MAX_RETRIES = 3
TEMPERATURE = 0


# ---- Kết quả 1 câu (skill optional: v1 không biết skill, v2+ có) ----
@dataclass
class Question:
    question: str
    options: list[str]
    correct_index: int
    skill: str = ""


@dataclass
class JdResult:
    jd_id: str
    questions: list[Question] = field(default_factory=list)
    json_ok: bool = True          # pipeline có parse được JSON hợp lệ không
    error: str = ""               # lý do nếu json_ok = False


# ---- Schema ép Ollama trả JSON đúng khuôn ----
class _QSchema(BaseModel):
    question: str = Field(description="Nội dung câu hỏi, tiếng Việt")
    options: list[str] = Field(min_length=NUM_OPTIONS, max_length=NUM_OPTIONS)
    correct_index: int = Field(ge=0, le=NUM_OPTIONS - 1)


class _QuizSchema(BaseModel):
    questions: list[_QSchema]


# ---- Dọn tiền tố "A)" "1." "-" model đôi khi tự thêm ----
_PREFIX_RE = re.compile(r"^\s*(?:[\(\[]?[A-Da-d1-9][\)\.\:\]]|[-*•])\s*")


def _clean(text: str) -> str:
    return _PREFIX_RE.sub("", text).strip()


def _call_ollama(prompt: str) -> str:
    resp = chat(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        format=_QuizSchema.model_json_schema(),
        options={"temperature": TEMPERATURE},
    )
    return resp.message.content


def _gen_block(prompt: str, expected: int, skill: str = "") -> tuple[list[Question], bool, str]:
    """Gọi model + retry tới khi JSON parse được. Trả (questions, json_ok, error)."""
    last_err = ""
    for attempt in range(1, MAX_RETRIES + 1):
        raw = _call_ollama(prompt if not last_err else
                           prompt + f"\n\nLần trước lỗi: {last_err}. Hãy sửa cho đúng schema.")
        try:
            quiz = _QuizSchema.model_validate_json(raw)
        except Exception as e:  # noqa: BLE001
            last_err = f"JSON không khớp schema: {e}"
            continue
        out = [
            Question(
                question=q.question.strip(),
                options=[_clean(o) for o in q.options],
                correct_index=q.correct_index,
                skill=skill,
            )
            for q in quiz.questions
        ]
        return out, True, ""
    return [], False, last_err


# ============================================================
# v1_baseline — MỐC GỐC: gửi cả JD -> xin N câu trong 1 phát.
# Cố tình ĐƠN GIẢN (không trích skill, không few-shot, không ép tình huống,
# không tự soát). Đây là baseline trung thực để v2-v5 cho thấy mức cải thiện.
# ============================================================
def v1_baseline(jd_text: str, num_questions: int = 10) -> JdResult:
    prompt = f"""Bạn là người ra đề tuyển dụng. Đọc Bản mô tả công việc (JD) dưới đây và soạn {num_questions} câu hỏi trắc nghiệm (MCQ) để kiểm tra ứng viên cho vị trí này.

Yêu cầu:
- Mỗi câu có đúng {NUM_OPTIONS} phương án, chỉ MỘT phương án đúng.
- Viết bằng tiếng Việt.
- Trả về JSON đúng schema được yêu cầu.

JD:
\"\"\"
{jd_text.strip()}
\"\"\"
"""
    qs, ok, err = _gen_block(prompt, num_questions)
    return JdResult(jd_id="", questions=qs, json_ok=ok, error=err)


# ---- v2..v5: để khung cho Bước 3 ----
def _not_yet(name: str):
    def _f(jd_text: str, num_questions: int = 10) -> JdResult:
        raise NotImplementedError(f"{name} sẽ dựng ở Bước 3.")
    return _f


VERSIONS = {
    "v1_baseline": v1_baseline,
    "v2_skill_extraction": _not_yet("v2_skill_extraction"),
    "v3_fewshot": _not_yet("v3_fewshot"),
    "v4_situational": _not_yet("v4_situational"),
    "v5_self_critique": _not_yet("v5_self_critique"),
}
