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
# Cửa sổ này tính CẢ prompt lẫn phần sinh ra: prompt cố định + schema + JD tiếng Việt cỡ
# vừa + đầu ra 10 tiêu chí là đã sát 4096, JD dài thì vượt.
# Ollama tràn thì CẮT BỚT VÀ CHẠY TIẾP, không báo lỗi: hoặc mất phần đầu prompt (các quy
# tắc), hoặc mất phần cuối JD -> AI bỏ sót tiêu chí mà không có dấu hiệu gì. Đây là kiểu
# hỏng tệ nhất vì JD ngắn lúc thử vẫn chạy tốt.
# 8192 đủ rộng cho JD dài mà vẫn nằm trong 16GB RAM với qwen2.5 7B lượng tử hóa 4-bit.
# (V038 bỏ 3 trường khỏi schema nên cả prompt lẫn đầu ra đã ngắn đi đáng kể — vẫn giữ 8192
# cho JD dài, phần dư không tốn thêm thời gian sinh.)
NUM_CTX = int(os.environ.get("SRIS_LLM_NUM_CTX", "8192"))


class Criterion(BaseModel):
    """
    1 dòng phiếu chấm phỏng vấn (docs 5.18) — đúng hai trường, và chỉ cần hai trường.

    Từng có thêm type (HARD/SOFT), cv_matchable, keywords. Cả ba sinh ra cho tính năng máy
    chấm CV: HARD dò keyword, SOFT so vector, cv_matchable để khỏi loại oan người không viết
    kỹ năng mềm vào CV. Chấm CV cắt khỏi scope 08/08/2026, vector xoá ở V036 — từ đó không
    còn dòng code nào đọc chúng, nhưng nhãn vẫn hiện lên màn hình và vẫn phải giải thích cho
    người dùng. Xoá hẳn (V038): cắt tính năng thì cắt cả mô hình dữ liệu của nó.

    Bỏ được ba trường còn kéo theo hai cái lợi: prompt ngắn đi đáng kể, và mỗi tiêu chí sinh
    ra ít token hơn nhiều — trên CPU thì đó là thời gian chờ thật của người bấm nút.
    """
    name: str = Field(min_length=2, max_length=150)
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
  * YÊU CẦU = thứ ứng viên phải CÓ SẴN từ trước: kỹ năng, mức thành thạo công cụ, kinh
    nghiệm đã làm, ngoại ngữ, năng lực làm việc. -> BÓC THÀNH TIÊU CHÍ.
  * ĐẦU VIỆC = thứ họ sẽ LÀM SAU KHI VÀO công ty, thường viết ở thể động từ mô tả công
    việc hằng ngày. -> KHÔNG PHẢI TIÊU CHÍ, BỎ QUA.
  Ví dụ ĐẦU VIỆC phải bỏ (không được biến thành tiêu chí):
    "Báo cáo doanh số hàng tuần cho quản lý trực tiếp"
    "Cập nhật thông tin khách hàng lên hệ thống"
    "Trực tổng đài, giải đáp thắc mắc về sản phẩm"
    "Phối hợp với bộ phận kỹ thuật"
  Không ai chấm điểm một ứng viên chưa đi làm theo những dòng đó.

- KHÔNG CÒN GÌ ĐỂ BÓC SAU KHI LỌC -> TRẢ VỀ DANH SÁCH RỖNG {{"criteria": []}}.
  Xảy ra khi văn bản chỉ toàn đầu việc, hoặc chỉ nêu những thứ đọc hồ sơ là biết (bằng cấp,
  chứng chỉ, nơi ở). Đây là kết quả ĐÚNG và được chấp nhận. Thà trả rỗng để người tuyển dụng
  bổ sung phần yêu cầu, còn hơn nặn ra tiêu chí không chấm được.
  Nhưng ĐỪNG lười: văn bản CÓ nêu yêu cầu thì phải bóc cho đủ, không được trả rỗng cho xong.

- MỖI TIÊU CHÍ CHỈ MỘT KỸ NĂNG. Một dòng phiếu chấm chỉ được cho MỘT điểm, nên gộp nhiều
  thứ vào một dòng là người phỏng vấn không chấm nổi. Một gạch đầu dòng trong JD liệt kê
  nhiều kỹ năng thì TÁCH RA thành nhiều tiêu chí.
  Ví dụ: "Kinh nghiệm với Entity Framework, REST API, kiến trúc microservices"
  -> TÁCH thành 3 tiêu chí: "Kinh nghiệm Entity Framework" / "Kinh nghiệm REST API" /
     "Kinh nghiệm kiến trúc microservices".
- BỎ THỨ CHỈ CẦN ĐỌC HỒ SƠ LÀ BIẾT. Đây là bộ lọc thứ hai, áp SAU khi đã loại đầu việc.
  PHÉP THỬ: cầm hồ sơ và bằng cấp của ứng viên lên đọc, kết luận được NGAY hay chưa?
  * KẾT LUẬN ĐƯỢC NGAY (bằng cấp, chứng chỉ, giấy phép, bằng lái, nơi ở, độ tuổi, giới tính)
    -> BỎ, KHÔNG bóc thành tiêu chí. Người tuyển dụng đã đối chiếu ở bước sàng lọc hồ sơ rồi.
    Không ai ngồi trong buổi phỏng vấn cho điểm 0-10 dòng "có bằng lái xe B2" — có là có,
    không là không, chấm điểm nó chỉ làm loãng phiếu.
  * PHẢI HỎI, PHẢI NGHE, PHẢI QUAN SÁT MỚI BIẾT (mức thành thạo, chiều sâu kinh nghiệm,
    ngoại ngữ thực tế, cách xử lý tình huống, thái độ) -> GIỮ.
  Ứng viên nào cũng viết "thành thạo Excel" trong CV; chỉ khi hỏi hàm và PivotTable mới biết
  thật hay không. Đúng những dòng như thế mới đáng nằm trên phiếu chấm.
- weight: 1-5, yêu cầu càng quan trọng với vị trí thì càng cao.
- Mỗi tiêu chí một dòng ngắn gọn, không gộp nhiều kỹ năng vào một tiêu chí.

- TỐI ĐA 10 TIÊU CHÍ. Đây là phiếu chấm người phỏng vấn cầm trong MỘT buổi phỏng vấn, không
  phải bảng kiểm kê — quá 10 dòng thì không ai chấm nổi cho tử tế. Văn bản nêu nhiều hơn 10
  yêu cầu thì GIỮ LẠI 10 CÁI QUAN TRỌNG NHẤT với vị trí này (kỹ năng lõi của vị trí trước;
  thứ "ưu tiên/là một lợi thế" bỏ trước), đừng cắt bừa 10 cái đầu danh sách.

VÍ DỤ (nhiều ngành):
GIỮ — phải hỏi/nghe mới biết:
- "Thành thạo Excel"
- "Tiếng Anh giao tiếp"
- "Thành thạo SQL Server"
- "Kinh nghiệm sử dụng phần mềm kế toán MISA/Fast"
- "Kinh nghiệm làm kế toán tổng hợp"
- "Kỹ năng giao tiếp"
- "Kỹ năng làm việc nhóm"
BỎ — đọc hồ sơ là kết luận được:
- "Tốt nghiệp Cao đẳng/Đại học"
- "Có chứng chỉ hành nghề kế toán (CPA/ACCA)"
- "Có bằng lái xe B2"
- "Làm việc tại Hà Nội"
- "Độ tuổi 22-30"

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
