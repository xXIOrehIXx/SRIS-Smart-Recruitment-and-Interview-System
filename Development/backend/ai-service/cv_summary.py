"""
============================================================
TÓM TẮT CV — Local LLM qua Ollama.

Cùng khuôn với criteria_extract.py: LLM ra JSON có schema (Pydantic,
format=json_schema, temperature=0) + validate + retry, hỏng hết lượt -> ném lỗi
để .NET nuốt êm (tab CV vẫn mở được, chỉ là không có tóm tắt).

RANH GIỚI QUAN TRỌNG — chỉ TRÍCH XUẤT, KHÔNG ĐÁNH GIÁ:
Hệ thống đã bỏ hoàn toàn việc máy chấm/xếp hạng CV (chốt 08/08/2026). Endpoint này
KHÔNG nhận JD, KHÔNG biết ứng viên đang ứng vào vị trí nào, nên về mặt kỹ thuật
không thể so khớp hay kết luận "hợp/không hợp". Nó chỉ rút gọn CV cho người đọc
nhanh — người tuyển dụng tự đối chiếu với JD và tự quyết.
Vẫn "máy tính toán" thuần: không DB, không tenant.
============================================================
"""

import json
import os

import ollama
from pydantic import BaseModel, Field, ValidationError

MODEL = os.environ.get("SRIS_LLM_MODEL", "qwen2.5")
MAX_RETRY = 3

# Ngắn hơn thì gần như chắc chắn là CV rỗng / parse hỏng, tóm tắt vô nghĩa.
MIN_CV_CHARS = 100

# Cắt bớt CV quá dài trước khi đưa vào prompt. qwen2.5 mặc định 32k token context;
# CV dài nhất thực tế cũng chỉ vài trang, phần đuôi thường là sở thích/tham chiếu.
MAX_CV_CHARS = 12000


class CvSummary(BaseModel):
    """Tóm tắt CV dạng gạch đầu dòng — thuần mô tả, không nhận xét."""
    highlights: list[str] = Field(min_length=2, max_length=8)


_PROMPT = """Bạn đọc CV dưới đây và tóm tắt lại cho người tuyển dụng đọc lướt.

QUY TẮC:
- CHỈ ghi lại thông tin CÓ THẬT trong CV. TUYỆT ĐỐI KHÔNG bịa, không suy đoán.
- Viết 3-6 gạch đầu dòng, mỗi dòng một câu ngắn, tiếng Việt.
- Ưu tiên theo thứ tự: các vị trí đã làm gần đây (kèm tên công ty và khoảng thời gian
  nếu CV có ghi), kỹ năng/công cụ chính, học vấn, chứng chỉ và ngoại ngữ.
- CV không nói gì về mục nào thì BỎ QUA mục đó, đừng viết "không đề cập".
- KHÔNG tự cộng trừ để ra "N năm kinh nghiệm". Chỉ ghi con số đó nếu CHÍNH CV viết ra;
  còn lại thì chép khoảng thời gian như CV ghi (vd "06/2019 - nay").
- TUYỆT ĐỐI KHÔNG bịa ngày tháng. CV không ghi thời gian cho một công việc thì viết câu
  đó KHÔNG có phần trong ngoặc — thà thiếu mốc thời gian còn hơn ghi một mốc không có thật.
- PHÂN BIỆT CÔNG VIỆC VỚI DỰ ÁN. Chỉ mục nằm ở phần kinh nghiệm làm việc (Kinh nghiệm /
  Experience / Work History) mới được viết là "làm tại <công ty>". Mục ở phần dự án
  (Dự án / PROJECT / Portfolio, thường kèm link GitHub hoặc là bài tập trường) thì phải
  ghi rõ là DỰ ÁN, vd "Dự án cá nhân: <tên dự án> - <làm gì>". TUYỆT ĐỐI KHÔNG viết
  "làm việc tại <tên dự án>" — như thế là biến bài tập thành nơi làm việc, sai sự thật.
- LUÔN có một dòng học vấn nếu CV ghi trường/bằng cấp. Đừng bỏ qua mục này.
- Chức danh, tên công ty, tên trường, tên chứng chỉ phải chép ĐÚNG NGUYÊN VĂN như trong CV.
  KHÔNG đổi "Kế toán tổng hợp" thành "Kế toán trưởng", không nâng cấp hay rút gọn chức danh.
- Giữ nguyên LOẠI văn bằng: "chứng chỉ" phải ghi là chứng chỉ, "cử nhân" ghi là cử nhân.
  KHÔNG biến chứng chỉ thành bằng đại học hay ngược lại.
- Các VÍ DỤ dưới đây chỉ minh họa VĂN PHONG. TUYỆT ĐỐI KHÔNG lấy chức danh, tên công ty,
  tên trường, con số hay kỹ năng nào từ ví dụ đưa vào kết quả — mọi chi tiết phải lấy từ CV.
- TUYỆT ĐỐI KHÔNG nhận xét, không đánh giá, không cho điểm, không kết luận ứng viên
  mạnh hay yếu, không nói ứng viên phù hợp hay không phù hợp với bất kỳ vị trí nào.
  Bạn chỉ thuật lại nội dung CV.

VÍ DỤ về VĂN PHONG dòng ĐÚNG (chi tiết bên trong chỉ là minh họa, đừng chép):
- "Gần nhất: <chức danh đúng như CV ghi> tại <tên công ty> (<thời gian nếu CV có ghi>)."
- "Trước đó: <chức danh> tại <tên công ty>."   <- CV không ghi thời gian thì bỏ luôn ngoặc
- "Sử dụng <các công cụ CV liệt kê>."
- "<bằng cấp> - <tên trường>."

VÍ DỤ dòng SAI (tuyệt đối tránh):
- "Ứng viên phù hợp với vị trí kế toán trưởng."   <- đánh giá
- "Kinh nghiệm khá mỏng so với yêu cầu."          <- so sánh và nhận xét
- "Điểm mạnh: chăm chỉ, ham học hỏi."             <- suy đoán không có trong CV

CV:
{cv_text}
"""


def summarize_cv(cv_text: str) -> CvSummary:
    """Text CV -> tóm tắt gạch đầu dòng. Ném exception nếu hết lượt retry (caller trả 502)."""
    text = (cv_text or "").strip()
    if len(text) < MIN_CV_CHARS:
        raise ValueError(f"CV qua ngan de tom tat (< {MIN_CV_CHARS} ky tu).")

    if len(text) > MAX_CV_CHARS:
        text = text[:MAX_CV_CHARS]

    last_error: Exception | None = None
    for _ in range(MAX_RETRY):
        try:
            resp = ollama.chat(
                model=MODEL,
                messages=[{"role": "user", "content": _PROMPT.format(cv_text=text)}],
                format=CvSummary.model_json_schema(),
                options={"temperature": 0},
            )
            summary = CvSummary.model_validate_json(resp["message"]["content"])
            cleaned = [h.strip() for h in summary.highlights if h and h.strip()]
            if len(cleaned) >= 2:
                return CvSummary(highlights=cleaned)
            last_error = ValueError("LLM tra ve toan dong rong.")
        except (ValidationError, json.JSONDecodeError, KeyError) as e:
            # Output sai schema -> thử lại (LLM không tất định tuyệt đối kể cả temperature=0).
            last_error = e
        # Lỗi hạ tầng (Ollama chưa chạy, model chưa pull) thì ném thẳng, retry vô ích.

    raise RuntimeError(f"LLM khong ra JSON hop le sau {MAX_RETRY} luot: {last_error}")
