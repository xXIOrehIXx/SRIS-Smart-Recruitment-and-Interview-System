"""
============================================================================
 BỐN PHIÊN BẢN PROMPT DÙNG ĐỂ ĐO ĐÓNG GÓP CỦA TỪNG THÀNH PHẦN

 ĐÂY LÀ THÍ NGHIỆM BÓC LỚP (ablation), KHÔNG PHẢI NHẬT KÝ CẢI TIẾN.
 Nói cho rõ vì chỗ này dễ bị hiểu sai khi trình bày:

   - V4 là prompt ĐANG CHẠY THẬT trong sản phẩm. Nó không được định nghĩa ở
     file này — nó được IMPORT thẳng từ ai-service/criteria_extract.py, để
     không bao giờ có chuyện thí nghiệm đo một bản sao đã lỗi thời.
   - V1, V2, V3 là các bản RÚT GỌN của chính V4, dựng ra để trả lời câu
     "nếu bỏ lớp này đi thì tệ hơn bao nhiêu?". Chúng CHƯA TỪNG chạy trong
     sản phẩm và không phải "bản đầu tay của nhóm".

 Vì vậy khi báo cáo phải gọi đúng tên: "đóng góp của từng thành phần trong
 prompt", KHÔNG phải "quá trình cải tiến prompt qua thời gian". Kết luận rút
 ra vẫn y hệt (lớp nào đáng giá bao nhiêu), nhưng phát biểu thì đúng sự thật.

 Mỗi bậc chỉ thêm ĐÚNG MỘT lớp so với bậc dưới — có vậy chênh lệch số đo mới
 quy được cho một nguyên nhân:

   V1  câu lệnh trần, KHÔNG ràng buộc định dạng đầu ra
   V2  + ràng buộc JSON schema (Pydantic) & temperature=0
   V3  + luật nghiệp vụ (yêu cầu vs đầu việc · bỏ giấy tờ · tách kỹ năng · trần 10)
   V4  + khối ví dụ mẫu (few-shot)  = prompt production
============================================================================
"""

import sys
from pathlib import Path

# V4 phải là prompt THẬT. Nạp thẳng module của ai-service thay vì chép lại nội dung:
# chép là sớm muộn cũng lệch, và một thí nghiệm đo nhầm bản cũ thì tệ hơn không đo.
_AI_SERVICE = Path(__file__).resolve().parents[2] / "ai-service"
if str(_AI_SERVICE) not in sys.path:
    sys.path.insert(0, str(_AI_SERVICE))

from criteria_extract import _PROMPT as PROMPT_PRODUCTION  # noqa: E402
from criteria_extract import MODEL, NUM_CTX  # noqa: E402  (tái xuất cho run.py)


# ---------------------------------------------------------------------------
# V1 — câu lệnh trần
# ---------------------------------------------------------------------------
# Không luật, không ví dụ, KHÔNG ép định dạng. Vẫn phải nói "trả JSON" chứ nếu
# không thì model viết văn xuôi và phép đo thành ra đo khả năng đọc văn xuôi của
# script, chứ không đo model. Nói mà không ép — đúng cái V2 sẽ ép.
V1_TRAN = """Đọc tin tuyển dụng dưới đây và bóc thành danh sách tiêu chí đánh giá ứng viên.

Trả về JSON dạng {{"criteria": [{{"name": "...", "weight": 1}}]}}.

VĂN BẢN:
{jd_text}
"""


# ---------------------------------------------------------------------------
# V2 — y hệt V1 về câu chữ, chỉ khác ở chỗ BẬT ràng buộc JSON schema
# ---------------------------------------------------------------------------
# Cố ý giữ nguyên văn V1: có vậy chênh lệch giữa V1 và V2 mới quy được đúng cho
# ràng buộc định dạng, không lẫn với "tại sửa lời prompt".
V2_CO_SCHEMA = V1_TRAN


# ---------------------------------------------------------------------------
# V3 — thêm luật nghiệp vụ, CHƯA có khối ví dụ
# ---------------------------------------------------------------------------
# Chính là V4 bỏ đi phần "VÍ DỤ (nhiều ngành)". Các luật giữ nguyên câu chữ của
# prompt production để chênh lệch V3→V4 đo đúng tác dụng của few-shot.
V3_CO_LUAT = """Bạn là chuyên viên tuyển dụng. Đọc yêu cầu tuyển dụng / mô tả công việc dưới đây
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

- KHÔNG CÒN GÌ ĐỂ BÓC SAU KHI LỌC -> TRẢ VỀ DANH SÁCH RỖNG {{"criteria": []}}.
  Đây là kết quả ĐÚNG và được chấp nhận. Thà trả rỗng để người tuyển dụng bổ sung phần
  yêu cầu, còn hơn nặn ra tiêu chí không chấm được.
  Nhưng ĐỪNG lười: văn bản CÓ nêu yêu cầu thì phải bóc cho đủ, không được trả rỗng cho xong.

- MỖI TIÊU CHÍ CHỈ MỘT KỸ NĂNG. Một dòng phiếu chấm chỉ được cho MỘT điểm, nên gộp nhiều
  thứ vào một dòng là người phỏng vấn không chấm nổi. Một gạch đầu dòng trong JD liệt kê
  nhiều kỹ năng thì TÁCH RA thành nhiều tiêu chí.

- BỎ THỨ CHỈ CẦN ĐỌC HỒ SƠ LÀ BIẾT. Đây là bộ lọc thứ hai, áp SAU khi đã loại đầu việc.
  PHÉP THỬ: cầm hồ sơ và bằng cấp của ứng viên lên đọc, kết luận được NGAY hay chưa?
  * KẾT LUẬN ĐƯỢC NGAY (bằng cấp, chứng chỉ, giấy phép, bằng lái, nơi ở, độ tuổi, giới tính)
    -> BỎ, KHÔNG bóc thành tiêu chí. Người tuyển dụng đã đối chiếu ở bước sàng lọc hồ sơ rồi.
  * PHẢI HỎI, PHẢI NGHE, PHẢI QUAN SÁT MỚI BIẾT (mức thành thạo, chiều sâu kinh nghiệm,
    ngoại ngữ thực tế, cách xử lý tình huống, thái độ) -> GIỮ.

- weight: 1-5, yêu cầu càng quan trọng với vị trí thì càng cao.
- Mỗi tiêu chí một dòng ngắn gọn, không gộp nhiều kỹ năng vào một tiêu chí.

- TỐI ĐA 10 TIÊU CHÍ. Đây là phiếu chấm người phỏng vấn cầm trong MỘT buổi phỏng vấn, không
  phải bảng kiểm kê. Văn bản nêu nhiều hơn 10 yêu cầu thì GIỮ LẠI 10 CÁI QUAN TRỌNG NHẤT với
  vị trí này (kỹ năng lõi của vị trí trước; thứ "ưu tiên/là một lợi thế" bỏ trước), đừng cắt
  bừa 10 cái đầu danh sách.

VĂN BẢN:
{jd_text}
"""


# ---------------------------------------------------------------------------
# Bảng tra: version -> (prompt, có ép JSON schema không, mô tả cho báo cáo)
# ---------------------------------------------------------------------------
VERSIONS = {
    "v1": (V1_TRAN,           False, "Câu lệnh trần, không luật, không ép định dạng"),
    "v2": (V2_CO_SCHEMA,      True,  "+ Ràng buộc JSON schema (Pydantic) & temperature=0"),
    "v3": (V3_CO_LUAT,        True,  "+ Luật nghiệp vụ (yêu cầu vs đầu việc, bỏ giấy tờ, tách, trần 10)"),
    "v4": (PROMPT_PRODUCTION, True,  "+ Khối ví dụ mẫu (few-shot) = prompt production"),
}

THANG_DO = ["v1", "v2", "v3", "v4"]

