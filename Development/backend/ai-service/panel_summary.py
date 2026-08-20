"""
============================================================
TỔNG HỢP Ý KIẾN HỘI ĐỒNG PHỎNG VẤN — Local LLM qua Ollama.

Nhận các phiếu chấm ĐÃ NỘP của một ứng viên (mỗi phiếu: người phỏng vấn, đề xuất,
nhận xét tổng, note theo tiêu chí) -> trả JSON có cấu trúc: một đoạn tổng hợp,
các điểm cả hội đồng ĐỒNG Ý, các điểm MÂU THUẪN, và những chỗ chưa ai làm rõ.

VÌ SAO KHÔNG CÓ TRƯỜNG "NÊN TUYỂN HAY KHÔNG":
đây là ranh giới nghiệp vụ, không phải thiếu sót. Quyền quyết tuyển thuộc về Giám đốc
(V043) và người đề xuất là Trưởng bộ phận. Nếu AI trả về một kết luận tuyển/không tuyển,
nó sẽ trở thành con số người ta bấm theo — đúng thứ hệ thống này cố tránh, giống hệt lý do
đề xuất sàng lọc CV không bao giờ tự đổi trạng thái hồ sơ. Ở đây AI chỉ làm MỘT việc: đọc
hộ 3-5 phiếu dài rồi chỉ ra hội đồng đồng ý ở đâu, lệch nhau ở đâu.

Dùng chung model với bóc tiêu chí (SRIS_LLM_MODEL): đầu vào là vài đoạn văn ngắn tiếng
Việt, không phải bài đối chiếu hai văn bản dài như sàng lọc CV. Vẫn tách biến môi trường
riêng (SRIS_PANEL_MODEL) để nâng model cho riêng việc này khi cần.

Vẫn là "máy tính toán" thuần: không DB, không tenant.
============================================================
"""

import json
import os
from typing import Optional

import ollama
from pydantic import BaseModel, Field, ValidationError

MODEL = os.environ.get("SRIS_PANEL_MODEL", os.environ.get("SRIS_LLM_MODEL", "qwen2.5"))
MAX_RETRY = 3

# Nhỏ hơn hẳn sàng lọc CV: đầu vào là các nhận xét ngắn, không có văn bản dài nào.
NUM_CTX = int(os.environ.get("SRIS_PANEL_NUM_CTX", "8192"))

# Trần ký tự cho toàn bộ phần phiếu chấm nhét vào prompt.
MAX_VERDICTS_CHARS = 9000


class CriterionNote(BaseModel):
    criteria_name: str
    note: str


class Verdict(BaseModel):
    """1 phiếu chấm đã nộp. Tên người phỏng vấn để AI gọi đúng ai nói gì."""

    interviewer: str
    round_number: Optional[int] = None
    recommendation: Optional[str] = None  # STRONG_HIRE | HIRE | CONSIDER | NO_HIRE
    summary: Optional[str] = None
    notes: list[CriterionNote] = Field(default_factory=list)


class PanelSummaryResult(BaseModel):
    """Đúng những gì hiện lên màn quyết định, không hơn — và KHÔNG có kết luận tuyển."""

    consensus: str = Field(min_length=10, max_length=1500)
    agreements: list[str] = Field(default_factory=list, max_length=8)
    disagreements: list[str] = Field(default_factory=list, max_length=8)
    open_questions: list[str] = Field(default_factory=list, max_length=6)


_PROMPT = """Bạn đang giúp Trưởng bộ phận và Giám đốc đọc nhanh các phiếu chấm phỏng vấn của
MỘT ứng viên. Nhiều người phỏng vấn đã chấm, mỗi người viết một kiểu; việc của bạn là gom lại.

QUY TẮC BẮT BUỘC:
- CHỈ dùng những gì người phỏng vấn đã viết. KHÔNG suy diễn thêm về ứng viên, KHÔNG bịa
  chi tiết không có trong phiếu.
- TUYỆT ĐỐI KHÔNG kết luận nên tuyển hay không tuyển, không khuyên "nên mời offer", không
  chấm điểm ứng viên. Quyết định là việc của con người; bạn chỉ tóm tắt ý kiến của họ.
- Gọi tên người phỏng vấn khi nêu ý kiến riêng của ai đó ("Minh thấy...", "Lan lo ngại...").
- Viết tiếng Việt, ngắn gọn, không sáo rỗng.

"consensus": 3-5 câu tóm tắt CẢ HỘI ĐỒNG nhìn nhận ứng viên thế nào — mạnh ở đâu, băn khoăn
ở đâu, và mức độ thống nhất giữa những người chấm. Chỉ có MỘT phiếu thì nói rõ đây là ý kiến
của một người.

"agreements": những nhận định mà TỪ HAI người phỏng vấn trở lên cùng nêu (kể cả khi diễn đạt
khác nhau). Mỗi mục một dòng ngắn. Không có thì để mảng rỗng.

"disagreements": những chỗ các phiếu NÓI NGƯỢC NHAU hoặc lệch mức đánh giá rõ rệt — nêu rõ ai
nói gì. Không có thì để mảng rỗng. ĐỪNG bịa mâu thuẫn khi mọi người cùng ý.

"open_questions": những điều còn bỏ ngỏ mà người quyết nên hỏi thêm trước khi chốt (kỹ năng
chưa ai kiểm, thông tin phiếu nào cũng nhắc mà không ai xác nhận). Không có thì để mảng rỗng.

========== ỨNG VIÊN ==========
{candidate}

========== CÁC PHIẾU CHẤM ĐÃ NỘP ==========
{verdicts}
"""

_REC_LABEL = {
    "STRONG_HIRE": "rất nên tuyển",
    "HIRE": "nên tuyển",
    "CONSIDER": "cân nhắc",
    "NO_HIRE": "không nên tuyển",
}


def _format_verdicts(verdicts: list[Verdict]) -> str:
    """Dàn các phiếu thành văn bản có nhãn — model đọc theo người, không lẫn ai với ai."""
    khoi = []
    for i, v in enumerate(verdicts, start=1):
        dong = [f"--- Phiếu {i}: {v.interviewer}" + (f" (vòng {v.round_number})" if v.round_number else "")]
        if v.recommendation:
            dong.append(f"Đề xuất: {_REC_LABEL.get(v.recommendation, v.recommendation)}")
        if v.summary and v.summary.strip():
            dong.append(f"Nhận xét chung: {v.summary.strip()}")
        for n in v.notes:
            if n.note and n.note.strip():
                dong.append(f"- {n.criteria_name}: {n.note.strip()}")
        khoi.append("\n".join(dong))
    return "\n\n".join(khoi)[:MAX_VERDICTS_CHARS]


def _chat(prompt: str) -> str:
    """Gọi Ollama, tắt chế độ suy luận nếu model có (xem cv_screening._chat)."""
    kwargs = dict(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        format=PanelSummaryResult.model_json_schema(),
        options={"temperature": 0, "num_ctx": NUM_CTX},
    )
    try:
        return ollama.chat(think=False, **kwargs)["message"]["content"]
    except (ollama.ResponseError, TypeError):
        return ollama.chat(**kwargs)["message"]["content"]


def summarize_panel(candidate: str, verdicts: list[Verdict]) -> PanelSummaryResult:
    """
    Tổng hợp các phiếu chấm. Ném exception nếu hết lượt retry (caller trả 502).

    Không có phiếu nào thì chặn ngay: model sẽ vui vẻ bịa ra một buổi phỏng vấn không tồn tại.
    """
    thuc = [v for v in verdicts if (v.summary and v.summary.strip()) or v.notes or v.recommendation]
    if not thuc:
        raise ValueError("Khong co phieu cham nao co noi dung de tong hop.")

    prompt = _PROMPT.format(
        candidate=(candidate or "(không rõ)").strip()[:300],
        verdicts=_format_verdicts(thuc),
    )

    last_error: Exception | None = None
    for _ in range(MAX_RETRY):
        try:
            result = PanelSummaryResult.model_validate_json(_chat(prompt))
        except (ValidationError, json.JSONDecodeError, KeyError) as e:
            last_error = e
            continue

        # Dọn dòng trắng — Pydantic đếm ký tự trước khi trim.
        result.agreements = [x.strip() for x in result.agreements if x and x.strip()]
        result.disagreements = [x.strip() for x in result.disagreements if x and x.strip()]
        result.open_questions = [x.strip() for x in result.open_questions if x and x.strip()]

        # Một phiếu thì KHÔNG thể có "đồng thuận" hay "mâu thuẫn" giữa các phiếu — model vẫn
        # hay điền cho đủ ô. Bỏ đi để màn hình không dựng lên một hội đồng không tồn tại.
        if len(thuc) < 2:
            result.agreements = []
            result.disagreements = []

        return result

    raise RuntimeError(f"LLM khong ra JSON hop le sau {MAX_RETRY} luot: {last_error}")
