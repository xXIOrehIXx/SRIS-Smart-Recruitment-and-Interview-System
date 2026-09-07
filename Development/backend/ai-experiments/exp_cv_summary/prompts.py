"""
============================================================================
 BỐN BẬC PROMPT DÙNG ĐỂ ĐO ĐÓNG GÓP CỦA TỪNG THÀNH PHẦN — PHẦN TÓM TẮT CV

 ĐÂY LÀ THÍ NGHIỆM BÓC LỚP (ablation), KHÔNG PHẢI NHẬT KÝ CẢI TIẾN.
 Cùng một nguyên tắc đã dùng ở exp_criteria_extract, nhắc lại vì đây là chỗ
 dễ bị hiểu sai nhất khi lên slide:

   - V4 là prompt ĐANG CHẠY THẬT. Nó KHÔNG được chép vào file này — nó được
     import thẳng từ ai-service/cv_screening.py, để không bao giờ có chuyện
     thí nghiệm đo một bản sao đã lỗi thời.
   - V1/V2/V3 là bản RÚT GỌN của chính V4, dựng ra để trả lời "bỏ lớp này đi
     thì tệ hơn bao nhiêu?". Chúng CHƯA TỪNG chạy trong sản phẩm.

 Báo cáo phải gọi đúng tên: "đóng góp của từng thành phần trong prompt",
 KHÔNG phải "quá trình cải tiến prompt qua thời gian".

 Mỗi bậc thêm ĐÚNG MỘT lớp:

   V1  bảo tóm tắt, hết. Không luật, không ép định dạng.
   V2  + ràng buộc JSON schema (Pydantic) & temperature=0
   V3  + luật CHỐNG BỊA (chỉ dùng chữ có trong CV, không suy diễn)
   V4  + luật RIÊNG CỦA BẢN TÓM TẮT (3-5 câu · dựng chân dung nghề nghiệp ·
          cấm tự cộng số năm · cấm viết chung chung) = prompt production

 VÌ SAO TÁCH V3 VÀ V4 Ở ĐÚNG CHỖ ĐÓ: V3 là luật "đừng bịa" — thứ ai cũng nghĩ
 ra. V4 thêm những luật chỉ rút ra được sau khi ĐỌC đầu ra hỏng thật (model tự
 cộng mốc thời gian thành "6 năm kinh nghiệm", model viết "ứng viên tiềm năng"
 khi CV rỗng). Chênh lệch V3→V4 chính là giá trị của việc ngồi đọc đầu ra.
============================================================================
"""

import sys
from pathlib import Path

# V4 phải là prompt THẬT. Nạp module của ai-service thay vì chép nội dung.
_AI_SERVICE = Path(__file__).resolve().parents[2] / "ai-service"
if str(_AI_SERVICE) not in sys.path:
    sys.path.insert(0, str(_AI_SERVICE))

from cv_screening import _PROMPT as PROMPT_PRODUCTION  # noqa: E402
from cv_screening import (  # noqa: E402  (tái xuất cho script 1)
    CONSIDER_MIN,
    MAX_CV_CHARS,
    MAX_JD_CHARS,
    MODEL,
    NUM_CTX,
    PROCEED_MIN,
    _LlmDraft,
)


# ---------------------------------------------------------------------------
# V1 — bảo tóm tắt, hết
# ---------------------------------------------------------------------------
# Vẫn phải nói "trả JSON" — không nói thì model viết văn xuôi và phép đo thành ra
# đo khả năng đọc văn xuôi của script chứ không đo model. Nói mà KHÔNG ÉP, đúng
# cái V2 sẽ ép bằng schema.
V1_TRAN = """Đọc CV của ứng viên và tin tuyển dụng dưới đây, rồi tóm tắt CV này.

Trả về JSON dạng {{"summary": "..."}}.

========== TIN TUYỂN DỤNG ==========
{jd_text}

========== CV ỨNG VIÊN ==========
{cv_text}
"""


# ---------------------------------------------------------------------------
# V2 — y hệt V1 về câu chữ, chỉ khác ở chỗ BẬT ràng buộc JSON schema
# ---------------------------------------------------------------------------
# Giữ nguyên văn V1 để chênh lệch V1→V2 quy đúng cho ràng buộc định dạng, không
# lẫn với "tại sửa lời prompt". Schema ép min_length=10 / max_length=1500 lên
# "summary" — tự nó đã là một cái trần độ dài.
V2_CO_SCHEMA = V1_TRAN


# ---------------------------------------------------------------------------
# V3 — thêm luật chống bịa, CHƯA có luật riêng của bản tóm tắt
# ---------------------------------------------------------------------------
# Đây là khối "QUY TẮC BẮT BUỘC" của prompt production, giữ nguyên câu chữ, nhưng
# CHƯA có đoạn 'VIẾT "summary"'. Nó trả lời: dặn model đừng bịa là đủ chưa?
V3_CHONG_BIA = """Bạn là chuyên viên tuyển dụng đang sàng lọc hồ sơ. Đọc CV của ứng viên và tin
tuyển dụng dưới đây, rồi tóm tắt CV này.

QUY TẮC BẮT BUỘC:
- CHỈ dùng thông tin có trong CV. TUYỆT ĐỐI KHÔNG suy diễn, KHÔNG bịa thêm kinh nghiệm.
  Ứng viên học ngành CNTT KHÔNG có nghĩa là biết Java; làm ở công ty phần mềm KHÔNG có
  nghĩa là biết mọi công nghệ công ty đó dùng.
- Văn bản CV được bóc từ file PDF nên có thể lộn xộn, dính chữ, thiếu dấu câu. Cứ đọc
  hiểu theo nội dung, đừng nhận xét gì về định dạng.

========== TIN TUYỂN DỤNG ==========
{jd_text}

========== CV ỨNG VIÊN ==========
{cv_text}
"""


# ---------------------------------------------------------------------------
# V4 — prompt production, nạp từ ai-service
# ---------------------------------------------------------------------------
V4_PRODUCTION = PROMPT_PRODUCTION


VERSIONS = {
    "v1": {
        "prompt": V1_TRAN,
        "schema": False,
        "ten": "V1 — bảo tóm tắt, không luật, không ép định dạng",
        "them": "(gốc)",
    },
    "v2": {
        "prompt": V2_CO_SCHEMA,
        "schema": True,
        "ten": "V2 — V1 + ràng buộc JSON schema",
        "them": "ràng buộc JSON schema (Pydantic) & temperature=0",
    },
    "v3": {
        "prompt": V3_CHONG_BIA,
        "schema": True,
        "ten": "V3 — V2 + luật chống bịa",
        "them": "chỉ dùng chữ có trong CV · không suy diễn · bỏ qua lỗi định dạng PDF",
    },
    "v4": {
        "prompt": V4_PRODUCTION,
        "schema": True,
        "ten": "V4 — V3 + luật riêng của bản tóm tắt  (PRODUCTION)",
        "them": "3-5 câu · dựng chân dung nghề nghiệp · cấm tự cộng số năm · cấm viết chung chung",
    },
}


def dung_prompt(ver: str, jd_text: str, cv_text: str) -> str:
    """
    Dựng prompt cho một bậc. V4 có thêm các tham số của thang điểm (proceed_min...)
    vì nó là prompt production đầy đủ — ba bậc dưới không có chỗ nào dùng tới.
    """
    mau = VERSIONS[ver]["prompt"]
    tham_so = dict(jd_text=jd_text[:MAX_JD_CHARS], cv_text=cv_text[:MAX_CV_CHARS])
    if ver == "v4":
        tham_so.update(
            proceed_min=PROCEED_MIN,
            consider_min=CONSIDER_MIN,
            proceed_max=PROCEED_MIN - 1,
        )
    return mau.format(**tham_so)
