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
    jd_id: str = ""
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


# ---- Schema cho bước trích skill (v2+) ----
class _SkillItem(BaseModel):
    skill: str = Field(description="Tên kỹ năng/kiến thức cần kiểm tra")
    num_questions: int = Field(ge=1, le=20)


class _SkillPlan(BaseModel):
    skills: list[_SkillItem]


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
def v1_baseline(jd_text: str, num_questions: int = 10, **_ignored) -> JdResult:
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


# ============================================================
# v2_skill_extraction — ĐỔI ĐÚNG 1 YẾU TỐ so v1:
# thay vì 1 phát N câu, tách 2 bước: (1) trích skill cốt lõi từ JD,
# (2) gen TỪNG skill riêng. Prompt gen mỗi skill giữ tối giản như v1
# (KHÔNG few-shot, KHÔNG ép tình huống, KHÔNG self-critique — để dành v3-v5).
# Lợi ích kỳ vọng: câu bám đúng skill chuyên môn thay vì hỏi lại nội dung JD;
# JD rác -> trích ít/không skill -> ra ít câu (xử lý edge tốt hơn).
# ============================================================
MAX_SKILLS = 10


def _extract_skills(jd_text: str, num_questions: int) -> tuple[list[_SkillItem], bool, str]:
    prompt = f"""Bạn là chuyên gia phân tích Bản mô tả công việc (JD). Đọc JD dưới đây và liệt kê các KỸ NĂNG/KIẾN THỨC CỐT LÕI cần kiểm tra ứng viên bằng bài trắc nghiệm chuyên môn.

Yêu cầu:
- Chỉ liệt kê kỹ năng/kiến thức KIỂM TRA ĐƯỢC bằng câu hỏi chuyên môn (ví dụ "SQL JOIN", "Hạch toán thuế GTGT", "Tối ưu render React"). KHÔNG liệt kê phẩm chất chung chung ("nhiệt huyết", "chịu áp lực", "trung thực").
- Nếu JD quá sơ sài / thiếu chi tiết chuyên môn thì chỉ trả về số ít kỹ năng (hoặc danh sách rỗng) — TUYỆT ĐỐI KHÔNG bịa.
- Phân bổ "num_questions" cho mỗi kỹ năng sao cho TỔNG xấp xỉ {num_questions} câu.
- Trả JSON đúng schema, không giải thích thêm.

JD:
\"\"\"
{jd_text.strip()}
\"\"\"
"""
    last_err = ""
    for _ in range(MAX_RETRIES):
        resp = chat(
            model=MODEL,
            messages=[{"role": "user",
                       "content": prompt if not last_err
                       else prompt + f"\n\nLần trước lỗi: {last_err}. Sửa cho đúng schema."}],
            format=_SkillPlan.model_json_schema(),
            options={"temperature": TEMPERATURE},
        )
        try:
            plan = _SkillPlan.model_validate_json(resp.message.content)
        except Exception as e:  # noqa: BLE001
            last_err = f"JSON skill không khớp schema: {e}"
            continue
        return plan.skills[:MAX_SKILLS], True, ""
    return [], False, last_err


def _gen_for_skill(skill: str, k: int, title: str, level: str) -> tuple[list[Question], bool, str]:
    # Prompt tối giản — cùng tinh thần v1, chỉ khác: bó vào 1 skill cụ thể.
    prompt = f"""Bạn là người ra đề tuyển dụng. Soạn {k} câu hỏi trắc nghiệm (MCQ) để kiểm tra kỹ năng/kiến thức "{skill}" của ứng viên cho vị trí "{title}" (cấp {level}).

Yêu cầu:
- Mỗi câu có đúng {NUM_OPTIONS} phương án, chỉ MỘT phương án đúng.
- Viết bằng tiếng Việt.
- Trả về JSON đúng schema được yêu cầu.
"""
    return _gen_block(prompt, k, skill=skill)


# Vòng lặp dùng chung cho mọi version "trích skill -> gen từng skill" (v2+).
# Khác nhau giữa các version chỉ ở GEN_FN (cách gen 1 skill).
def _skill_pipeline(jd_text, num_questions, title, level, gen_fn) -> JdResult:
    skills, ok, err = _extract_skills(jd_text, num_questions)
    if not ok:
        return JdResult(questions=[], json_ok=False, error=err)
    out: list[Question] = []
    remaining = num_questions
    any_fail = ""
    for item in skills:
        if remaining <= 0:
            break
        k = max(1, min(item.num_questions, remaining))
        qs, gok, gerr = gen_fn(item.skill, k, title, level)
        if not gok:
            any_fail = gerr
            continue
        out.extend(qs)
        remaining -= len(qs)
    # JD rác -> skills rỗng -> out rỗng: KHÔNG coi là lỗi, đó là hành vi đúng.
    return JdResult(questions=out, json_ok=True, error=any_fail)


def v2_skill_extraction(jd_text: str, num_questions: int = 10,
                        title: str = "", level: str = "") -> JdResult:
    return _skill_pipeline(jd_text, num_questions, title, level, _gen_for_skill)


# ============================================================
# v3_fewshot — ĐỔI ĐÚNG 1 YẾU TỐ so v2: thêm 1-2 CÂU MẪU (few-shot) vào
# prompt gen mỗi skill để model học PHONG CÁCH câu tốt qua ví dụ.
# KHÔNG thêm chỉ thị "phải là tình huống" (đó là v4) — chỉ làm mẫu, không ra lệnh.
# ============================================================
_FEWSHOT = """Dưới đây là 2 VÍ DỤ về câu hỏi tốt (chỉ tham khảo PHONG CÁCH ra đề, TUYỆT ĐỐI không chép lại nội dung):

Ví dụ 1:
{"question": "Bảng Orders có 1 triệu dòng, truy vấn lọc theo cột CustomerId đang quét toàn bảng và chạy chậm. Cách hiệu quả nhất để cải thiện là gì?", "options": ["Tạo index trên cột CustomerId", "Thêm RAM cho máy chủ", "Đổi SELECT * thành SELECT cột cụ thể", "Chạy truy vấn vào ban đêm"], "correct_index": 0}

Ví dụ 2:
{"question": "Doanh nghiệp mua hàng hóa trị giá 100 triệu nhưng chưa thanh toán cho người bán. Bút toán ghi nhận đúng là gì?", "options": ["Nợ Hàng hóa / Có Phải trả người bán", "Nợ Phải trả người bán / Có Hàng hóa", "Nợ Hàng hóa / Có Tiền mặt", "Nợ Chi phí / Có Phải trả người bán"], "correct_index": 0}
"""


def _gen_for_skill_fewshot(skill: str, k: int, title: str, level: str):
    prompt = f"""Bạn là người ra đề tuyển dụng. Soạn {k} câu hỏi trắc nghiệm (MCQ) để kiểm tra kỹ năng/kiến thức "{skill}" của ứng viên cho vị trí "{title}" (cấp {level}).

{_FEWSHOT}
Yêu cầu:
- Mỗi câu có đúng {NUM_OPTIONS} phương án, chỉ MỘT phương án đúng.
- Viết bằng tiếng Việt.
- Trả về JSON đúng schema được yêu cầu.
"""
    return _gen_block(prompt, k, skill=skill)


def v3_fewshot(jd_text: str, num_questions: int = 10,
               title: str = "", level: str = "") -> JdResult:
    return _skill_pipeline(jd_text, num_questions, title, level, _gen_for_skill_fewshot)


# ============================================================
# v4_situational — ĐỔI ĐÚNG 1 YẾU TỐ so v3: giữ nguyên few-shot, thêm CHỈ THỊ
# TƯỜNG MINH ép dạng câu tình huống + ràng buộc cách tạo distractor.
# Khác v3 ở chỗ RA LỆNH (v3 chỉ làm mẫu, không yêu cầu). Kỳ vọng: đẩy mạnh tỉ lệ
# câu tình huống (đo ở 16.2) và distractor "bẫy" thay vì sai hiển nhiên.
# ============================================================
_SITUATIONAL_RULES = """Ràng buộc BẮT BUỘC về chất lượng câu:
- Mỗi câu phải là TÌNH HUỐNG/BÀI TOÁN thực tế ứng viên gặp khi làm việc (mô tả một bối cảnh/sự cố/quyết định rồi hỏi cách xử lý đúng), KHÔNG hỏi định nghĩa thuộc lòng ("X là gì?", "X viết tắt của?").
- 3 phương án sai (distractor) phải dựa trên LỖI HIỂU SAI PHỔ BIẾN của người mới — tức nghe có vẻ hợp lý, dễ chọn nhầm — KHÔNG phải đáp án sai hiển nhiên hay lạc đề.
- Phương án đúng và các phương án sai phải cùng độ dài/văn phong, tránh để lộ đáp án qua hình thức."""


def _gen_for_skill_situational(skill: str, k: int, title: str, level: str):
    prompt = f"""Bạn là người ra đề tuyển dụng. Soạn {k} câu hỏi trắc nghiệm (MCQ) để kiểm tra kỹ năng/kiến thức "{skill}" của ứng viên cho vị trí "{title}" (cấp {level}).

{_FEWSHOT}
{_SITUATIONAL_RULES}

Yêu cầu định dạng:
- Mỗi câu có đúng {NUM_OPTIONS} phương án, chỉ MỘT phương án đúng.
- Viết bằng tiếng Việt.
- Trả về JSON đúng schema được yêu cầu.
"""
    return _gen_block(prompt, k, skill=skill)


def v4_situational(jd_text: str, num_questions: int = 10,
                   title: str = "", level: str = "") -> JdResult:
    return _skill_pipeline(jd_text, num_questions, title, level, _gen_for_skill_situational)


# ============================================================
# v5_self_critique — ĐỔI ĐÚNG 1 YẾU TỐ so v4: sau khi gen (y hệt v4) thêm 1 LƯỢT
# AI TỰ SOÁT từng câu rồi SỬA/LOẠI. Đây là "after" để chấm rubric đầy đủ với v1.
# Lượt soát bắt: (a) câu định nghĩa thuộc lòng -> viết lại thành tình huống;
# (b) distractor sai hiển nhiên -> thay bằng lỗi hiểu sai phổ biến;
# (c) đáp án lộ qua độ dài/văn phong -> cân lại; (d) câu BỊA không kiểm tra được
# kỹ năng thật (nhất là JD rỗng) -> LOẠI hẳn (được phép trả ít câu hơn).
# ============================================================
def _critique_questions(skill: str, questions: list[Question]) -> tuple[list[Question], bool, str]:
    if not questions:
        return [], True, ""
    payload = [
        {"question": q.question, "options": q.options, "correct_index": q.correct_index}
        for q in questions
    ]
    import json as _json
    prompt = f"""Bạn là chuyên gia soát đề trắc nghiệm (MCQ) khó tính, đang rà lại các câu kiểm tra kỹ năng "{skill}".

Dưới đây là danh sách câu hỏi nháp (JSON). Hãy SOÁT và SỬA từng câu theo tiêu chí:
- Nếu câu chỉ hỏi định nghĩa thuộc lòng ("X là gì?") -> viết lại thành TÌNH HUỐNG/bài toán thực tế.
- 3 phương án sai phải dựa trên LỖI HIỂU SAI PHỔ BIẾN (nghe hợp lý, dễ nhầm), KHÔNG sai hiển nhiên/lạc đề.
- Đáp án đúng và sai phải cùng độ dài/văn phong để không lộ đáp án.
- Nếu câu BỊA, không thật sự kiểm tra được kỹ năng "{skill}" (vd JD không đủ căn cứ) thì LOẠI BỎ câu đó — KHÔNG cố giữ.

Trả về JSON đúng schema (danh sách câu đã sửa; có thể ít hơn đầu vào nếu phải loại). Giữ nguyên ngôn ngữ tiếng Việt.

Câu hỏi nháp:
{_json.dumps(payload, ensure_ascii=False)}
"""
    return _gen_block(prompt, len(questions), skill=skill)


def _gen_for_skill_v5(skill: str, k: int, title: str, level: str):
    qs, ok, err = _gen_for_skill_situational(skill, k, title, level)
    if not ok:
        return qs, ok, err
    revised, rok, rerr = _critique_questions(skill, qs)
    # Nếu lượt soát hỏng JSON -> giữ bản gen gốc (đừng mất câu vì soát lỗi).
    if not rok:
        return qs, True, f"critique_failed: {rerr}"
    return revised, True, ""


def v5_self_critique(jd_text: str, num_questions: int = 10,
                     title: str = "", level: str = "") -> JdResult:
    return _skill_pipeline(jd_text, num_questions, title, level, _gen_for_skill_v5)


VERSIONS = {
    "v1_baseline": v1_baseline,
    "v2_skill_extraction": v2_skill_extraction,
    "v3_fewshot": v3_fewshot,
    "v4_situational": v4_situational,
    "v5_self_critique": v5_self_critique,
}
