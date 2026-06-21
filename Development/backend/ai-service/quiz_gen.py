"""
============================================================
QUIZ GENERATOR — sinh quiz trắc nghiệm từ JD bằng Local LLM (Ollama)
------------------------------------------------------------
Vai trò: "máy tính toán" thuần — nhận JD text, trả về JSON quiz.
KHÔNG đụng database, KHÔNG biết company_id / tenant. Giống hệt phần embed.

Hỗ trợ các "nút hành động AI" của Recruiter (5.6) qua 2 tham số tùy chọn:
  - topic : ép sinh câu theo MỘT chủ đề cụ thể (nút "Thêm câu theo chủ đề").
  - avoid : danh sách câu đã có -> nhắc model TRÁNH trùng (nút "Gen thêm" / "Gen lại").

Yêu cầu: Ollama đã chạy + đã `ollama pull` model (xem MODEL bên dưới).
============================================================
"""

import re

from ollama import chat
from pydantic import BaseModel, Field


# ---- Cấu hình ----
MODEL = "qwen2.5"        # Đổi 1 dòng này để dùng model khác (qwen3:8b, gemma3:4b ...)
NUM_OPTIONS = 4          # Số phương án mỗi câu (cố định 4)
MAX_RETRIES = 3          # Số lần thử lại nếu JSON trả về không hợp lệ
TEMPERATURE = 0          # 0 = output ổn định nhất


# ---- Schema: khuôn JSON model BẮT BUỘC trả về ----
class QuizQuestion(BaseModel):
    question: str = Field(description="Nội dung câu hỏi, viết bằng tiếng Việt")
    options: list[str] = Field(
        min_length=NUM_OPTIONS, max_length=NUM_OPTIONS,
        description=f"Đúng {NUM_OPTIONS} phương án trả lời",
    )
    correct_index: int = Field(
        ge=0, le=NUM_OPTIONS - 1,
        description="Chỉ số (bắt đầu từ 0) của phương án đúng trong mảng options",
    )


class Quiz(BaseModel):
    questions: list[QuizQuestion]


# ---- Prompt: phần "ra đề" cho model (đa ngành, không chỉ IT) ----
def build_prompt(
    jd_text: str,
    num_questions: int,
    topic: str | None = None,
    avoid: list[str] | None = None,
) -> str:
    prompt = f"""Bạn là một chuyên gia tuyển dụng kiêm người ra đề thi. Hãy soạn {num_questions} câu hỏi trắc nghiệm để KIỂM TRA NĂNG LỰC CHUYÊN MÔN của ứng viên ứng tuyển vị trí trong Bản mô tả công việc (JD) bên dưới.

Vị trí tuyển dụng có thể thuộc BẤT KỲ ngành nghề nào (công nghệ, kế toán, nhân sự, kinh doanh, marketing, hành chính, ...). Hãy đọc JD để tự xác định đây là ngành gì và cần kiểm tra kiến thức, kỹ năng gì, rồi ra đề ĐÚNG ngành đó. Không mặc định mọi vị trí đều là vị trí kỹ thuật.

CÁCH DÙNG JD CHO ĐÚNG (rất quan trọng):
- JD chỉ dùng để BIẾT cần kiểm tra những kỹ năng, kiến thức gì — sau đó ra đề kiểm tra chính các kỹ năng, kiến thức đó.
- TUYỆT ĐỐI KHÔNG hỏi về nội dung của chính JD. Ví dụ SAI: "Vị trí này có yêu cầu kỹ năng X không?", "Ứng viên có cần biết Y không?". Những câu này chỉ cần đọc JD là trả lời được, không đánh giá được năng lực.
- Câu hỏi ĐÚNG phải kiểm tra kiến thức chuyên môn thật của ứng viên. Ví dụ về câu ĐÚNG ở vài ngành khác nhau:
  * Kế toán: "Bút toán nào ghi nhận khi doanh nghiệp mua hàng hóa chưa trả tiền người bán?"
  * Nhân sự: "Theo Bộ luật Lao động, thời gian thử việc tối đa cho công việc cần trình độ cao đẳng là bao lâu?"
  * Marketing: "Chỉ số nào đo lường tỷ lệ người xem quảng cáo có nhấp vào liên kết?"
  * Kinh doanh: "Trong quy trình bán hàng, bước nào diễn ra ngay sau khi tiếp cận khách hàng tiềm năng?"
  (Đây chỉ là ví dụ minh hoạ cách đặt câu hỏi — hãy ra đề theo đúng ngành của JD bên dưới, không bắt buộc dùng các ngành này.)

YÊU CẦU VỀ ĐỀ:
- Soạn đúng {num_questions} câu hỏi, mỗi câu kiểm tra một chủ đề/kiến thức khác nhau — KHÔNG ra hai câu trùng ý hoặc na ná nhau.
- Câu hỏi ở mức cơ bản tới trung bình, phù hợp vòng sàng lọc đầu vào.
- Chỉ ra những câu hỏi có đáp án rõ ràng, chính xác. KHÔNG bịa thuật ngữ, KHÔNG ra câu mơ hồ nhiều đáp án cùng đúng. Nếu không chắc chắn về một chủ đề, hãy chọn chủ đề khác trong JD mà bạn chắc chắn.
- Mỗi câu có đúng {NUM_OPTIONS} phương án, trong đó CHỈ một phương án đúng. Ba phương án còn lại phải sai một cách hợp lý (không hiển nhiên).

YÊU CẦU VỀ ĐỊNH DẠNG:
- Trường "options" chỉ chứa NỘI DUNG phương án. KHÔNG tự thêm tiền tố "A)", "B)", "1.", "-" vào đầu phương án.
- "correct_index" là chỉ số (bắt đầu từ 0) của phương án đúng trong mảng "options".
- Thay đổi vị trí phương án đúng giữa các câu, đừng để đáp án đúng luôn nằm một chỗ.
- Toàn bộ câu hỏi và phương án viết bằng tiếng Việt.
- Trả kết quả dưới dạng JSON đúng schema được yêu cầu.
"""

    # Nút "Thêm câu theo chủ đề": ép model bám đúng chủ đề Recruiter gõ.
    if topic and topic.strip():
        prompt += (
            f"\nRÀNG BUỘC CHỦ ĐỀ: Tất cả câu hỏi PHẢI xoay quanh chủ đề \"{topic.strip()}\" "
            "(vẫn nằm trong phạm vi chuyên môn của JD).\n"
        )

    # Nút "Gen thêm" / "Gen lại": nhắc model tránh lặp các câu đã có.
    if avoid:
        joined = "\n- ".join(a.strip() for a in avoid if a and a.strip())
        if joined:
            prompt += (
                "\nTRÁNH TRÙNG LẶP: KHÔNG được ra lại (kể cả diễn đạt khác) các câu hỏi đã có sau đây:\n- "
                + joined
                + "\n"
            )

    prompt += (
        "\nBẢN MÔ TẢ CÔNG VIỆC (JD) — chỉ để xác định ngành nghề và chủ đề cần kiểm tra:\n"
        '"""\n'
        f"{jd_text.strip()}\n"
        '"""\n'
    )
    return prompt


# ---- Dọn dẹp: cắt tiền tố "A)" "B." "1." "-" model đôi khi tự thêm ----
_PREFIX_RE = re.compile(r"^\s*(?:[\(\[]?[A-Da-d1-9][\)\.\:\]]|[-*•])\s*")


def clean_option(text: str) -> str:
    return _PREFIX_RE.sub("", text).strip()


def clean_quiz(quiz: Quiz) -> None:
    for q in quiz.questions:
        q.options = [clean_option(opt) for opt in q.options]


# ---- Validate: kiểm tra logic nghiệp vụ. Trả về danh sách lỗi ----
def validate_quiz(quiz: Quiz, num_questions: int) -> list[str]:
    errors: list[str] = []
    qs = quiz.questions

    if len(qs) != num_questions:
        errors.append(f"Cần {num_questions} câu hỏi, model trả về {len(qs)} câu.")

    seen: set[str] = set()
    for i, q in enumerate(qs, start=1):
        if not q.question.strip():
            errors.append(f"Câu {i}: nội dung câu hỏi rỗng.")
        if len(q.options) != NUM_OPTIONS:
            errors.append(f"Câu {i}: cần {NUM_OPTIONS} phương án, có {len(q.options)}.")
        if any(not opt.strip() for opt in q.options):
            errors.append(f"Câu {i}: có phương án bị bỏ trống.")
        if not (0 <= q.correct_index < len(q.options)):
            errors.append(f"Câu {i}: correct_index = {q.correct_index} ngoài khoảng hợp lệ.")
        key = q.question.strip().lower()
        if key and key in seen:
            errors.append(f"Câu {i}: trùng nội dung với một câu trước đó.")
        seen.add(key)

    return errors


# ---- Gọi Ollama: ép trả JSON theo schema ----
def _call_ollama(prompt: str) -> str:
    response = chat(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        format=Quiz.model_json_schema(),   # <-- ép cấu trúc đầu ra
        options={"temperature": TEMPERATURE},
    )
    return response.message.content


# ---- Sinh quiz: có vòng lặp thử lại nếu kết quả không hợp lệ ----
def generate_quiz(
    jd_text: str,
    num_questions: int = 10,
    topic: str | None = None,
    avoid: list[str] | None = None,
) -> Quiz:
    """
    Sinh quiz từ JD. Trả về đối tượng Quiz đã hợp lệ.
    Ném RuntimeError nếu sau MAX_RETRIES lần vẫn không sinh được quiz hợp lệ
    -> .NET nhận lỗi này và kích hoạt fallback (HR nhập câu hỏi thủ công).
    """
    if not jd_text or not jd_text.strip():
        raise ValueError("JD rỗng — không có nội dung để sinh câu hỏi.")
    if num_questions < 1:
        raise ValueError("num_questions phải >= 1.")

    base_prompt = build_prompt(jd_text, num_questions, topic=topic, avoid=avoid)
    last_errors: list[str] = []

    for attempt in range(1, MAX_RETRIES + 1):
        print(f">> Gen quiz — lần thử {attempt}/{MAX_RETRIES} (model '{MODEL}') ...")

        prompt = base_prompt
        if last_errors:
            prompt += (
                "\n\nLần trước kết quả gặp các lỗi sau, hãy sửa lại cho đúng:\n- "
                + "\n- ".join(last_errors)
            )

        raw = _call_ollama(prompt)

        try:
            quiz = Quiz.model_validate_json(raw)
        except Exception as e:
            last_errors = [f"JSON trả về không khớp schema: {e}"]
            print("   -> Lỗi đọc JSON, thử lại ...")
            continue

        clean_quiz(quiz)   # cắt tiền tố "A)" "B)" model có thể tự thêm

        errors = validate_quiz(quiz, num_questions)
        if not errors:
            print(f"   -> Hợp lệ ở lần thử {attempt}.")
            return quiz

        last_errors = errors
        print(f"   -> Chưa hợp lệ ({len(errors)} lỗi), thử lại ...")

    raise RuntimeError(
        f"Không sinh được quiz hợp lệ sau {MAX_RETRIES} lần thử. "
        "Lỗi gần nhất: " + "; ".join(last_errors)
    )
