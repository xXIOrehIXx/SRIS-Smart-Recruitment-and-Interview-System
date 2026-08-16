"""
============================================================
SÀNG LỌC CV THEO JD — Local LLM qua Ollama.

Nhận (text CV đã bóc từ PDF, text JD/yêu cầu tuyển dụng) -> trả JSON có cấu trúc:
tóm tắt CV, tiêu chí ĐẠT (kèm bằng chứng trích từ CV), tiêu chí THIẾU, điểm phù hợp
và đề xuất nên/không nên mời phỏng vấn.

Vẫn là "máy tính toán" thuần: không DB, không tenant, không biết công ty nào.
Điều phối + lưu kết quả là việc của .NET.

VÌ SAO DÙNG MODEL RIÊNG, KHÔNG DÙNG CHUNG VỚI BÓC TIÊU CHÍ:
bóc tiêu chí là bài "chép lại có cấu trúc" — model nhỏ làm được. Còn ở đây model phải
ĐỐI CHIẾU hai văn bản dài rồi kết luận, sai một bước là ra bằng chứng bịa. Nên tách hẳn
biến môi trường SRIS_CV_MODEL (mặc định 'qwen3:8b') để nâng model cho riêng việc này mà
không đụng vào lượt bóc tiêu chí đang chạy ổn.

ĐỀ XUẤT CỦA AI CHỈ LÀ THAM KHẢO: hệ thống không tự loại và không tự đẩy hồ sơ đi đâu.
Người tuyển dụng đọc rồi tự quyết (xem CvScreeningService bên .NET).
============================================================
"""

import json
import os
from typing import Literal

import ollama
from pydantic import BaseModel, Field, ValidationError

MODEL = os.environ.get("SRIS_CV_MODEL", "qwen3:8b")
MAX_RETRY = 3

# Cửa sổ ngữ cảnh — rộng hơn hẳn lượt bóc tiêu chí vì prompt ở đây chứa CẢ HAI văn bản
# (CV 2-3 trang + JD) chứ không phải một. Ollama tràn ngữ cảnh thì cắt bớt lặng lẽ chứ
# không báo lỗi: phần bị cắt là phần ĐẦU prompt (các quy tắc) hoặc phần cuối CV, và kết
# quả vẫn ra JSON hợp lệ trông như bình thường — hỏng kiểu không nhìn thấy được.
NUM_CTX = int(os.environ.get("SRIS_CV_NUM_CTX", "12288"))

# Trần ký tự trước khi nhét vào prompt. Cắt ở đây để num_ctx ở trên luôn đủ, bất kể
# người dùng nộp CV dài bao nhiêu trang.
MAX_CV_CHARS = 12000
MAX_JD_CHARS = 6000

# Ngưỡng quy đổi điểm -> đề xuất. Đặt Ở ĐÂY và ép lại sau khi model trả lời, thay vì tin
# trường 'decision' model tự viết: LLM rất hay trả fit_score=35 kèm decision='PROCEED'.
# Hai con số mâu thuẫn nhau nằm cạnh nhau trên màn hình là thứ người dùng thấy ngay và
# mất niềm tin vào cả tính năng, nên chỉ giữ MỘT nguồn sự thật là điểm.
PROCEED_MIN = 70
CONSIDER_MIN = 45


class MatchedItem(BaseModel):
    """1 yêu cầu của JD mà CV chứng minh được — kèm chỗ trong CV nói điều đó."""

    requirement: str = Field(min_length=2, max_length=200)
    # Bắt buộc trích dẫn: đây là dây neo chống bịa. Model phải chỉ ra được câu trong CV
    # thì mới được tính là ĐẠT, và người đọc kiểm chứng được ngay mà không mở lại file PDF.
    evidence: str = Field(min_length=2, max_length=400)


class CvScreeningResult(BaseModel):
    """Toàn bộ đầu ra một lượt sàng lọc. Đúng những trường hiện lên màn hình, không hơn."""

    summary: str = Field(min_length=10, max_length=1500)
    matched: list[MatchedItem] = Field(default_factory=list, max_length=12)
    missing: list[str] = Field(default_factory=list, max_length=12)
    fit_score: int = Field(ge=0, le=100)
    decision: Literal["PROCEED", "CONSIDER", "REJECT"]
    decision_reason: str = Field(min_length=5, max_length=600)


_PROMPT = """Bạn là chuyên viên tuyển dụng đang sàng lọc hồ sơ. Đọc CV của ứng viên và tin
tuyển dụng dưới đây, rồi đối chiếu xem ứng viên có hợp với vị trí này không.

QUY TẮC BẮT BUỘC:
- CHỈ dùng thông tin có trong CV. TUYỆT ĐỐI KHÔNG suy diễn, KHÔNG bịa thêm kinh nghiệm.
  Ứng viên học ngành CNTT KHÔNG có nghĩa là biết Java; làm ở công ty phần mềm KHÔNG có
  nghĩa là biết mọi công nghệ công ty đó dùng.
- Mỗi mục trong "matched" phải kèm "evidence" là CÂU/CỤM TỪ TRÍCH NGUYÊN VĂN từ CV.
  Không trích được nguyên văn thì KHÔNG được đưa vào matched — đưa xuống missing.
- "missing" là những yêu cầu của tin tuyển dụng mà CV KHÔNG hề nhắc tới hoặc nhắc quá
  mờ nhạt để kết luận. Viết đúng tên yêu cầu, mỗi mục một dòng ngắn.
- Văn bản CV được bóc từ file PDF nên có thể lộn xộn, dính chữ, thiếu dấu câu. Cứ đọc
  hiểu theo nội dung, đừng nhận xét gì về định dạng.

VIẾT "summary": 3-5 câu tiếng Việt, dựng lại chân dung nghề nghiệp của ứng viên — làm gì,
làm ở đâu trong khoảng thời gian nào, mạnh nhất ở đâu, học gì. Đây là thứ người tuyển dụng
đọc THAY CHO việc mở file CV, nên phải là thông tin thật của CV này, không viết chung chung
kiểu "ứng viên có nhiều kinh nghiệm và tiềm năng".
KHÔNG TỰ TÍNH SỐ NĂM KINH NGHIỆM. CV không ghi thẳng "x năm kinh nghiệm" thì viết lại mốc
thời gian y như CV ("làm backend từ 2019 đến nay"), đừng tự cộng ra một con số — cộng sai là
người đọc mất niềm tin vào toàn bộ phần còn lại.

CHẤM "fit_score" (0-100) theo mức độ đáp ứng yêu cầu, tính cả độ quan trọng của từng yêu
cầu chứ không đếm đầu mục:
- 85-100: đáp ứng gần như toàn bộ, gồm mọi yêu cầu cốt lõi.
- 70-84 : đáp ứng các yêu cầu cốt lõi, chỉ thiếu vài thứ phụ hoặc "là một lợi thế".
- 45-69 : có nền tảng liên quan nhưng thiếu một phần yêu cầu cốt lõi.
- 20-44 : lệch ngành hoặc thiếu phần lớn yêu cầu cốt lõi.
- 0-19  : không liên quan gì tới vị trí.

"decision" đặt theo đúng fit_score: >= {proceed_min} -> "PROCEED" (nên mời phỏng vấn),
{consider_min}-{proceed_max} -> "CONSIDER" (cần người xem thêm), dưới {consider_min} -> "REJECT" (chưa phù hợp).
"decision_reason": 1-2 câu, nêu LÝ DO CỤ THỂ dựa trên chỗ đạt/thiếu vừa liệt kê.

========== TIN TUYỂN DỤNG ==========
{jd_text}

========== CV ỨNG VIÊN ==========
{cv_text}
"""


def _band(score: int) -> str:
    """Điểm -> đề xuất. Một nguồn sự thật duy nhất cho cả prompt lẫn hậu kiểm."""
    if score >= PROCEED_MIN:
        return "PROCEED"
    if score >= CONSIDER_MIN:
        return "CONSIDER"
    return "REJECT"


def _chat(prompt: str) -> str:
    """
    Gọi Ollama, tắt chế độ suy luận nếu model có (qwen3 và họ hàng).

    Vì sao tắt: qwen3 mặc định sinh một khối <think> dài trước khi trả lời. Trên CPU khối
    đó tốn nhiều thời gian hơn cả câu trả lời thật, mà đầu ra của ta bị ràng buộc bằng JSON
    schema nên phần suy luận không giúp được gì. Model KHÔNG hỗ trợ think thì Ollama trả
    lỗi — bắt lại và gọi lại bản không có tham số, để đổi model qua biến môi trường không
    bao giờ làm hỏng service.
    """
    kwargs = dict(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        format=CvScreeningResult.model_json_schema(),
        options={"temperature": 0, "num_ctx": NUM_CTX},
    )
    try:
        return ollama.chat(think=False, **kwargs)["message"]["content"]
    except (ollama.ResponseError, TypeError):
        return ollama.chat(**kwargs)["message"]["content"]


def screen_cv(cv_text: str, jd_text: str) -> CvScreeningResult:
    """
    Đối chiếu CV với JD. Ném exception nếu hết lượt retry (caller trả 502).

    Đầu vào quá ngắn thì chặn NGAY: CV rỗng vẫn ra được JSON hợp lệ — model bịa ra một
    ứng viên không tồn tại rồi chấm điểm cho nó. Thà báo lỗi còn hơn.
    """
    cv = (cv_text or "").strip()
    jd = (jd_text or "").strip()
    if len(cv) < 100:
        raise ValueError("Text CV qua ngan de sang loc (< 100 ky tu).")
    if len(jd) < 30:
        raise ValueError("Tin tuyen dung qua ngan de doi chieu (< 30 ky tu).")

    prompt = _PROMPT.format(
        jd_text=jd[:MAX_JD_CHARS],
        cv_text=cv[:MAX_CV_CHARS],
        proceed_min=PROCEED_MIN,
        consider_min=CONSIDER_MIN,
        proceed_max=PROCEED_MIN - 1,
    )

    last_error: Exception | None = None
    for _ in range(MAX_RETRY):
        try:
            result = CvScreeningResult.model_validate_json(_chat(prompt))
        except (ValidationError, json.JSONDecodeError, KeyError) as e:
            # Sai schema -> thử lại (LLM không tất định tuyệt đối kể cả temperature=0).
            last_error = e
            continue

        # Hậu kiểm: ép decision khớp fit_score (xem PROCEED_MIN ở đầu file).
        result.decision = _band(result.fit_score)
        # Dọn dòng trắng: Pydantic đếm ký tự trước khi trim nên "  " lọt min_length.
        result.missing = [m.strip() for m in result.missing if m and m.strip()]
        result.matched = [
            m for m in result.matched if m.requirement.strip() and m.evidence.strip()
        ]
        return result

    raise RuntimeError(f"LLM khong ra JSON hop le sau {MAX_RETRY} luot: {last_error}")
