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

# Cửa sổ ngữ cảnh — PHẢI đặt tường minh, đừng để mặc định của Ollama (4096).
# Cộng thử một lượt bóc thật: prompt cố định ~1700 token + schema ~600 + JD tiếng Việt
# cỡ vừa ~1500-3000 + đầu ra 10 tiêu chí ~800-1500 => 4600-6800 token. Tràn 4096.
# Ollama tràn thì CẮT BỚT VÀ CHẠY TIẾP, không báo lỗi: hoặc mất phần đầu prompt (các quy
# tắc), hoặc mất phần cuối JD -> AI bỏ sót tiêu chí mà không có dấu hiệu gì. Đây là kiểu
# hỏng tệ nhất vì JD ngắn lúc thử vẫn chạy tốt.
# 8192 đủ rộng cho JD dài mà vẫn nằm trong 16GB RAM với qwen2.5 7B lượng tử hóa 4-bit.
NUM_CTX = int(os.environ.get("SRIS_LLM_NUM_CTX", "8192"))


class Criterion(BaseModel):
    """1 tiêu chí tuyển dụng có cấu trúc (docs 5.18)."""
    name: str = Field(min_length=2, max_length=150)
    # HARD = yêu cầu cứng (chứng chỉ, số năm tối thiểu, địa điểm); SOFT = kỹ năng/năng lực.
    # Chỉ là NHÃN mô tả cho người duyệt đọc phiếu chấm — không có code nào lọc hay so khớp
    # theo nó (sàng lọc CV bằng AI đã loại khỏi scope 08/08/2026, hạ tầng vector xoá ở V036).
    type: str = Field(pattern="^(HARD|SOFT)$")
    # True = thấy được trong CV (kỹ năng, kinh nghiệm); False = chỉ đánh giá khi phỏng vấn
    # (giao tiếp, văn hóa). Cũng chỉ là nhãn mô tả — hệ thống KHÔNG chấm CV.
    cv_matchable: bool = True
    # Từ khóa nhận diện trong CV cho tiêu chí HARD (tiếng Việt + tiếng Anh nếu có).
    keywords: list[str] = []
    # Trọng số gợi ý 1-5 (người duyệt chỉnh lại).
    weight: float = Field(default=1, ge=0.1, le=5)


class CriteriaList(BaseModel):
    # KHÔNG đặt min_length: danh sách RỖNG là kết quả hợp lệ. JD của công ty nhỏ rất hay
    # chỉ liệt kê đầu việc mà không nêu yêu cầu nào với ứng viên — ép model phải trả về ít
    # nhất 1 tiêu chí thì nó buộc phải biến đầu việc thành tiêu chí, ra phiếu chấm vô nghĩa
    # kiểu "Báo cáo doanh số hàng tuần cho quản lý trực tiếp". Rỗng để .NET bảo người dùng
    # bổ sung phần yêu cầu, đúng hơn là đẻ tiêu chí rác.
    #
    # Trần 10: đây là PHIẾU CHẤM người phỏng vấn cầm trong buổi phỏng vấn, không phải danh
    # sách kiểm kê. Quá 10 dòng thì người chấm không chấm nổi trong một buổi, điểm về sau
    # thành cho lấy lệ. Prompt cũng dặn model giữ lại tiêu chí quan trọng nhất khi phải cắt.
    criteria: list[Criterion] = Field(max_length=10)


_PROMPT = """Bạn là chuyên viên tuyển dụng. Đọc yêu cầu tuyển dụng / mô tả công việc dưới đây
và bóc thành danh sách tiêu chí đánh giá ứng viên có cấu trúc.

Tiêu chí này sẽ thành PHIẾU CHẤM PHỎNG VẤN — người phỏng vấn ngồi cho điểm ứng viên theo
từng dòng bạn viết ra. Nên mỗi dòng phải là thứ CHẤM ĐIỂM ĐƯỢC cho một ứng viên chưa vào làm.

QUY TẮC:
- CHỈ bóc tiêu chí có thật trong văn bản. TUYỆT ĐỐI KHÔNG bịa thêm.
- Bỏ qua phần giới thiệu công ty, phúc lợi, lương thưởng — đó không phải tiêu chí đánh giá.

- PHÂN BIỆT *YÊU CẦU VỚI ỨNG VIÊN* VÀ *ĐẦU VIỆC SẼ LÀM*. Đây là lỗi hay gặp nhất:
  * YÊU CẦU = thứ ứng viên phải CÓ SẴN từ trước: bằng cấp, chứng chỉ, số năm kinh nghiệm,
    kỹ năng, công cụ thành thạo, ngoại ngữ. -> BÓC THÀNH TIÊU CHÍ.
  * ĐẦU VIỆC = thứ họ sẽ LÀM SAU KHI VÀO công ty, thường viết ở thể động từ mô tả công
    việc hằng ngày. -> KHÔNG PHẢI TIÊU CHÍ, BỎ QUA.
  Ví dụ ĐẦU VIỆC phải bỏ (không được biến thành tiêu chí):
    "Báo cáo doanh số hàng tuần cho quản lý trực tiếp"
    "Cập nhật thông tin khách hàng lên hệ thống"
    "Trực tổng đài, giải đáp thắc mắc về sản phẩm"
    "Phối hợp với bộ phận kỹ thuật"
  Không ai chấm điểm một ứng viên chưa đi làm theo những dòng đó.

- VĂN BẢN CHỈ TOÀN ĐẦU VIỆC, KHÔNG NÊU YÊU CẦU NÀO -> TRẢ VỀ DANH SÁCH RỖNG {{"criteria": []}}.
  Đây là kết quả ĐÚNG và được chấp nhận. Thà trả rỗng để người tuyển dụng bổ sung phần yêu
  cầu, còn hơn nặn ra tiêu chí không chấm được.
  Nhưng ĐỪNG lười: văn bản CÓ nêu yêu cầu thì phải bóc cho đủ, không được trả rỗng cho xong.

- MỖI TIÊU CHÍ CHỈ MỘT KỸ NĂNG. Một dòng phiếu chấm chỉ được cho MỘT điểm, nên gộp nhiều
  thứ vào một dòng là người phỏng vấn không chấm nổi. Một gạch đầu dòng trong JD liệt kê
  nhiều kỹ năng thì TÁCH RA thành nhiều tiêu chí.
  Ví dụ: "Kinh nghiệm với Entity Framework, REST API, kiến trúc microservices"
  -> TÁCH thành 3 tiêu chí: "Kinh nghiệm Entity Framework" / "Kinh nghiệm REST API" /
     "Kinh nghiệm kiến trúc microservices".
- type = "HARD" cho yêu cầu cứng loại-trừ (bằng cấp, chứng chỉ, số năm kinh nghiệm tối thiểu,
  địa điểm làm việc, giấy phép, công nghệ/ngôn ngữ bắt buộc). type = "SOFT" cho kỹ năng, kinh nghiệm, năng lực.
- cv_matchable = false cho thứ CV không thể hiện được (giao tiếp, thái độ, văn hóa) —
  nhóm này chỉ đánh giá khi phỏng vấn.
- keywords: BẮT BUỘC điền cho MỌI tiêu chí type="HARD". Đây là các CỤM TỪ CỤ THỂ sẽ dò
  literal trong CV. Quy tắc:
  * Điền cả BIẾN THỂ SONG NGỮ và cách viết khác nhau (vd "tiếng Anh" + "English" + "IELTS"/"TOEIC";
    "kế toán" + "accounting"; "REST API" + "RESTful"). CV người ta viết lẫn Việt–Anh.
  * Phải là cụm ĐẶC TRƯNG, đủ dài để không khớp bừa. KHÔNG dùng từ đơn chung chung
    (vd đừng để mỗi "API", "rest", "quản lý"). KHÔNG chép nguyên câu tiêu chí.
  * keywords CHỈ suy ra từ CHÍNH tiêu chí đang xét. TUYỆT ĐỐI không sao chép keyword từ
    các VÍ DỤ bên dưới hay từ tiêu chí khác (vd tiêu chí về "kế toán" thì KHÔNG có "bán hàng").
- weight: 1-5, yêu cầu càng quan trọng với vị trí thì càng cao.
- Mỗi tiêu chí một dòng ngắn gọn, không gộp nhiều kỹ năng vào một tiêu chí.

- TỐI ĐA 10 TIÊU CHÍ. Đây là phiếu chấm người phỏng vấn cầm trong MỘT buổi phỏng vấn, không
  phải bảng kiểm kê — quá 10 dòng thì không ai chấm nổi cho tử tế. Văn bản nêu nhiều hơn 10
  yêu cầu thì GIỮ LẠI 10 CÁI QUAN TRỌNG NHẤT với vị trí này (yêu cầu bắt buộc và kỹ năng lõi
  trước; thứ "ưu tiên/là một lợi thế" bỏ trước), đừng cắt bừa 10 cái đầu danh sách.

VÍ DỤ (nhiều ngành — chú ý keywords song ngữ, cụ thể của tiêu chí HARD):
- name "Tốt nghiệp Cao đẳng/Đại học" -> type "HARD", keywords ["cao đẳng","đại học","cử nhân","bachelor"]
- name "Thành thạo Excel" -> type "HARD", keywords ["Excel","Microsoft Excel","MS Excel"]
- name "Có chứng chỉ hành nghề kế toán" -> type "HARD", keywords ["chứng chỉ kế toán","CPA","ACCA","chứng chỉ hành nghề"]
- name "Sử dụng phần mềm kế toán MISA/Fast" -> type "HARD", keywords ["MISA","Fast","phần mềm kế toán"]
- name "Có bằng lái xe B2" -> type "HARD", keywords ["bằng lái xe B2","GPLX B2","bằng B2"]
- name "Tiếng Anh giao tiếp" -> type "HARD", keywords ["tiếng Anh","English","IELTS","TOEIC"]
- name "Thành thạo SQL Server" -> type "HARD", keywords ["SQL Server","MS SQL","T-SQL"]
- name "Kỹ năng giao tiếp, làm việc nhóm" -> type "SOFT", cv_matchable false, keywords []

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
                options={"temperature": 0, "num_ctx": NUM_CTX},
            )
            return CriteriaList.model_validate_json(resp["message"]["content"])
        except (ValidationError, json.JSONDecodeError, KeyError) as e:
            # Output sai schema -> thử lại (LLM không tất định tuyệt đối kể cả temperature=0).
            last_error = e
        # Lỗi hạ tầng (Ollama chưa chạy, model chưa pull) thì ném thẳng, retry vô ích.

    raise RuntimeError(f"LLM khong ra JSON hop le sau {MAX_RETRY} luot: {last_error}")
