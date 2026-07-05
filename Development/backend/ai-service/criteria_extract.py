"""
============================================================
BÓC TIÊU CHÍ TỪ YÊU CẦU TUYỂN DỤNG / JD — Local LLM qua Ollama (docs 5.18, Việc B4).

Tái dùng nguyên pattern đã PoC ở Việc 4: LLM ra JSON có schema (Pydantic,
format=json_schema, temperature=0) + validate + retry, hỏng hết lượt -> ném lỗi
để .NET fallback cho người nhập tay.

AI KHÔNG quyết tiêu chí — output luôn là DRAFT cho người duyệt (.NET lo).
Vẫn "máy tính toán" thuần: không DB, không tenant.
============================================================
"""

import json
import os

import ollama
from pydantic import BaseModel, Field, ValidationError

MODEL = os.environ.get("SRIS_LLM_MODEL", "qwen2.5")
MAX_RETRY = 3


class Criterion(BaseModel):
    """1 tiêu chí tuyển dụng có cấu trúc (docs 5.18)."""
    name: str = Field(min_length=2, max_length=150)
    # HARD = yêu cầu cứng (chứng chỉ, số năm tối thiểu, địa điểm) -> .NET lọc bằng rule/keyword.
    # SOFT = kỹ năng/năng lực -> .NET so vector.
    type: str = Field(pattern="^(HARD|SOFT)$")
    # True = thấy được trong CV (kỹ năng, kinh nghiệm); False = chỉ đánh giá khi phỏng vấn
    # (giao tiếp, văn hóa) — chấm CV bỏ qua nhóm này để không loại oan.
    cv_matchable: bool = True
    # Từ khóa nhận diện trong CV cho tiêu chí HARD (tiếng Việt + tiếng Anh nếu có).
    keywords: list[str] = []
    # Trọng số gợi ý 1-5 (người duyệt chỉnh lại).
    weight: float = Field(default=1, ge=0.1, le=5)


class CriteriaList(BaseModel):
    criteria: list[Criterion] = Field(min_length=1, max_length=20)


_PROMPT = """Bạn là chuyên viên tuyển dụng. Đọc yêu cầu tuyển dụng / mô tả công việc dưới đây
và bóc thành danh sách tiêu chí đánh giá ứng viên có cấu trúc.

QUY TẮC:
- CHỈ bóc tiêu chí có thật trong văn bản. TUYỆT ĐỐI KHÔNG bịa thêm.
- Bỏ qua phần giới thiệu công ty, phúc lợi, lương thưởng — đó không phải tiêu chí đánh giá.
- type = "HARD" cho yêu cầu cứng loại-trừ (bằng cấp, chứng chỉ, số năm kinh nghiệm tối thiểu,
  địa điểm làm việc, giấy phép). type = "SOFT" cho kỹ năng, kinh nghiệm, năng lực.
- cv_matchable = false cho thứ CV không thể hiện được (giao tiếp, thái độ, văn hóa) —
  nhóm này chỉ đánh giá khi phỏng vấn.
- keywords: các từ/cụm từ nhận diện tiêu chí đó trong CV (cả tiếng Việt lẫn tiếng Anh nếu phù hợp).
- weight: 1-5, yêu cầu càng quan trọng với vị trí thì càng cao.
- Mỗi tiêu chí một dòng ngắn gọn, không gộp nhiều kỹ năng vào một tiêu chí.

VĂN BẢN:
{jd_text}
"""


def extract_criteria(jd_text: str) -> CriteriaList:
    """JD text -> danh sách tiêu chí. Ném exception nếu hết lượt retry (caller trả 502)."""
    if not jd_text or len(jd_text.strip()) < 30:
        raise ValueError("JD qua ngan de boc tieu chi (< 30 ky tu).")

    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRY + 1):
        try:
            resp = ollama.chat(
                model=MODEL,
                messages=[{"role": "user", "content": _PROMPT.format(jd_text=jd_text.strip())}],
                format=CriteriaList.model_json_schema(),
                options={"temperature": 0},
            )
            return CriteriaList.model_validate_json(resp["message"]["content"])
        except (ValidationError, json.JSONDecodeError, KeyError) as e:
            # Output sai schema -> thử lại (LLM không tất định tuyệt đối kể cả temperature=0).
            last_error = e
        # Lỗi hạ tầng (Ollama chưa chạy, model chưa pull) thì ném thẳng, retry vô ích.

    raise RuntimeError(f"LLM khong ra JSON hop le sau {MAX_RETRY} luot: {last_error}")
