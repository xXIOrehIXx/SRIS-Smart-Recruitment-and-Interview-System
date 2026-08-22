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
import re
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


class _LlmDraft(BaseModel):
    """
    ĐÚNG những trường LLM được phép tự viết — schema này là thứ đưa vào Ollama qua `format`.

    "decision_reason" cố ý KHÔNG có ở đây: xem CvScreeningResult bên dưới.
    """

    summary: str = Field(min_length=10, max_length=1500)
    matched: list[MatchedItem] = Field(default_factory=list, max_length=12)
    missing: list[str] = Field(default_factory=list, max_length=12)
    fit_score: int = Field(ge=0, le=100)
    decision: Literal["PROCEED", "CONSIDER", "REJECT"]


class CvScreeningResult(_LlmDraft):
    """
    Toàn bộ đầu ra một lượt sàng lọc. Đúng những trường hiện lên màn hình, không hơn.

    Khác _LlmDraft đúng một trường: "decision_reason" do CODE sinh (xem _reason), không
    phải model viết. Lý do y hệt lý do đã ép "decision" theo fit_score ở _band — nhưng
    ở đây hỏng nặng hơn vì nó là câu chữ người dùng đọc:

      - Model tự viết lý do thì rất hay mâu thuẫn với chính danh sách nó vừa liệt kê.
        Đo thật trên qwen3:8b: missing = ["giao tiep tot"] nhưng decision_reason viết
        "Ứng viên đáp ứng... giao tiếp tốt". Hai câu chửi nhau trên cùng một màn hình.
      - Kể cả model tự nhất quán thì _verify vẫn ĐẨY bớt mục từ matched xuống missing sau
        đó (trích dẫn bịa), và _band vẫn có thể đổi decision. Câu lý do viết TRƯỚC hai
        bước ấy nên nó nói về một kết quả KHÁC với kết quả cuối cùng.

    Sinh bằng code thì mâu thuẫn không xảy ra được, chứ không phải "ít xảy ra". Phần nhận
    xét định tính (thành tích, mốc thời gian) vẫn còn nguyên ở "summary" — chỗ đó model
    được tự do vì nó KỂ LẠI CV chứ không phán xét đạt/thiếu.
    """

    decision_reason: str = Field(default="", max_length=600)


_PROMPT = """Bạn là chuyên viên tuyển dụng đang sàng lọc hồ sơ. Đọc CV của ứng viên và tin
tuyển dụng dưới đây, rồi đối chiếu xem ứng viên có hợp với vị trí này không.

QUY TẮC BẮT BUỘC:
- CHỈ dùng thông tin có trong CV. TUYỆT ĐỐI KHÔNG suy diễn, KHÔNG bịa thêm kinh nghiệm.
  Ứng viên học ngành CNTT KHÔNG có nghĩa là biết Java; làm ở công ty phần mềm KHÔNG có
  nghĩa là biết mọi công nghệ công ty đó dùng.
- Mỗi mục trong "matched" phải kèm "evidence" là CÂU/CỤM TỪ TRÍCH NGUYÊN VĂN từ CV — chép
  y hệt, không diễn đạt lại, không dịch.
  Không trích được nguyên văn thì KHÔNG được đưa vào matched — đưa xuống missing.
  TUYỆT ĐỐI KHÔNG viết "missing", "không có", "không tìm thấy" hay bất cứ ghi chú nào vào
  ô "evidence". Ô đó CHỈ chứa chữ có sẵn trong CV. Một yêu cầu chỉ được nằm ở MỘT trong hai
  danh sách: hoặc matched (có trích dẫn), hoặc missing. Không được nằm ở cả hai.

- YÊU CẦU CÓ NGƯỠNG SỐ (số năm kinh nghiệm, số người quản lý, cấp độ chứng chỉ) chỉ tính là
  ĐẠT khi CV nêu con số BẰNG HOẶC LỚN HƠN ngưỡng đó. Không đủ ngưỡng -> missing, dù có làm
  việc gần giống. Ví dụ: yêu cầu "quản lý đội nhóm từ 2 người" mà CV viết "hướng dẫn 1 thực
  tập sinh" thì KHÔNG đạt.

- KỸ NĂNG GẦN GIỐNG KHÔNG PHẢI LÀ ĐẠT. Docker không phải Kubernetes, Excel không phải
  Power BI, tiếng Anh không phải tiếng Nhật, viết unit test không phải triển khai CI/CD.
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
KHÔNG viết câu giải thích cho quyết định — phần đó hệ thống tự sinh từ hai danh sách trên.

========== TIN TUYỂN DỤNG ==========
{jd_text}

========== CV ỨNG VIÊN ==========
{cv_text}
"""


def _norm(s: str) -> str:
    """Gom khoảng trắng + hạ chữ thường — so khớp bỏ qua khác biệt vụn vặt về trình bày."""
    return re.sub(r"\s+", " ", s).strip().lower()


def _norm_loose(s: str) -> str:
    """Như trên, bỏ luôn dấu câu: model hay chép lại thiếu/thừa dấu phẩy, gạch, ngoặc."""
    return re.sub(r"[^0-9a-zÀ-ỹ]+", " ", _norm(s)).strip()


def _verify(result: "_LlmDraft", cv_text: str) -> None:
    """
    Bỏ khỏi "matched" mọi mục có evidence KHÔNG thật sự nằm trong CV, và dồn yêu cầu đó
    xuống "missing". Sửa tại chỗ.

    Vì sao cần dù prompt đã dặn: đo trên model 8B thấy nó lách schema — nhét cả yêu cầu
    KHÔNG đạt vào matched rồi ghi "evidence": "missing" như một cái nhãn. JSON vẫn hợp lệ,
    Pydantic vẫn cho qua, và màn hình hiện ra "Đáp ứng: Thành thạo Power BI — 'missing'".
    Prompt không bao giờ chặn được hết mấy trò kiểu này, nhưng đây là ràng buộc KIỂM ĐƯỢC
    BẰNG MÁY: evidence phải là chữ có sẵn trong CV, đúng nghĩa đen. Chặn luôn cả trích dẫn
    bịa nguyên câu — thứ nguy hiểm hơn nhiều vì đọc rất thuyết phục.

    Cố ý chỉ đẩy XUỐNG missing chứ không bao giờ kéo ngược lên: nhầm theo hướng "báo thiếu
    trong khi thật ra có" thì người tuyển dụng mở CV ra là thấy; nhầm theo hướng ngược lại
    thì họ tin luôn và không kiểm tra.
    """
    hay = _norm(cv_text)
    hay_loose = _norm_loose(cv_text)

    ket, bo = [], []
    for m in result.matched:
        ev = m.evidence.strip()
        if _norm(ev) in hay or _norm_loose(ev) in hay_loose:
            ket.append(m)
        else:
            bo.append(m.requirement.strip())

    result.matched = ket

    # Dồn xuống missing, không nhân bản dòng đã có sẵn ở đó.
    da_co = {_norm(x) for x in result.missing}
    for req in bo:
        if req and _norm(req) not in da_co:
            result.missing.append(req)
            da_co.add(_norm(req))

    # Cùng một yêu cầu nằm ở CẢ HAI danh sách -> giữ bên matched (đã có trích dẫn thật),
    # bỏ bên missing. Hai bên mâu thuẫn nhau trên màn hình là lỗi người dùng thấy ngay.
    ten_dat = {_norm(m.requirement) for m in result.matched}
    result.missing = [x for x in result.missing if _norm(x) not in ten_dat]


# Số mục nêu tên trong câu lý do. Liệt kê hết 12 yêu cầu thì câu đó dài hơn cả ô hiển
# thị và không ai đọc — danh sách đầy đủ đã nằm ngay bên trên màn hình rồi, câu này chỉ
# cần tóm lại cân đối đạt/thiếu.
REASON_MAX_ITEMS = 3
REASON_ITEM_CHARS = 80
REASON_MAX_CHARS = 600


def _ngan(s: str, n: int) -> str:
    """
    Cắt cho vừa ô hiển thị, cắt ở ranh giới từ để không đứt giữa chữ.

    Chừa sẵn 1 ký tự cho dấu "…": kết quả LUÔN <= n. Nếu không chừa thì chuỗi 600 ký tự
    liền không dấu cách sẽ ra 601 ký tự và Pydantic ném ValidationError ngay lúc dựng
    CvScreeningResult — hỏng cả lượt sàng lọc chỉ vì một cái tên yêu cầu dài bất thường.
    """
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) <= n:
        return s
    return s[: n - 1].rsplit(" ", 1)[0].rstrip(" ,.;:-") + "…"


def _liet_ke(items: list[str]) -> str:
    """'a, b, c và 2 mục khác' — nêu tên vài mục đầu, phần còn lại đếm số."""
    ten = [_ngan(x, REASON_ITEM_CHARS) for x in items[:REASON_MAX_ITEMS]]
    con = len(items) - len(ten)
    ke = ", ".join(ten)
    return f"{ke} và {con} mục khác" if con > 0 else ke


def _reason(result: "_LlmDraft") -> str:
    """
    Sinh câu lý do TỪ kết quả cuối cùng, thay vì để model tự viết (xem CvScreeningResult).

    Gọi SAU _verify và _band thì câu chữ và danh sách hiển thị chắc chắn là của cùng một
    kết quả — mâu thuẫn kiểu "đáp ứng giao tiếp tốt" trong khi "giao tiếp tốt" nằm ở cột
    THIẾU không còn đường xảy ra.

    Cố ý KHÔNG nhắc lại chữ "nên mời / cân nhắc / ít phù hợp": nhãn đó đã hiện ngay cạnh
    điểm trên UI (quy tắc hiển thị của V046). Nhắc lại ở đây là vừa thừa, vừa tạo thêm một
    chỗ nữa phải sửa mỗi lần đổi nhãn — mà đổi sót một chỗ là quay về đúng cái lỗi đang sửa.
    """
    dat = [m.requirement.strip() for m in result.matched if m.requirement.strip()]
    thieu = [x.strip() for x in result.missing if x.strip()]
    tong = len(dat) + len(thieu)

    if tong == 0:
        # Model không nêu được yêu cầu nào (JD chỉ liệt kê đầu việc, hoặc CV lạc đề hẳn).
        # Nói thẳng là chưa đối chiếu được, đừng bịa ra một câu nhận xét nghe như đã xét.
        return "Chưa đối chiếu được yêu cầu cụ thể nào giữa CV và tin tuyển dụng."

    ve = []
    if dat:
        ve.append(f"CV trích dẫn chứng minh được {len(dat)}/{tong} yêu cầu: {_liet_ke(dat)}.")
    else:
        ve.append(f"Không yêu cầu nào trong {tong} yêu cầu đối chiếu có trích dẫn từ CV.")
    if thieu:
        ve.append(f"Chưa thấy trong CV: {_liet_ke(thieu)}.")

    # "…" + "." của câu đứng cạnh nhau thành "…." — dấu ba chấm đã thay cho phần bị cắt,
    # không cần thêm dấu chấm nữa.
    return _ngan(" ".join(ve).replace("….", "…"), REASON_MAX_CHARS)


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
            draft = _LlmDraft.model_validate_json(_chat(prompt))
        except (ValidationError, json.JSONDecodeError, KeyError) as e:
            # Sai schema -> thử lại (LLM không tất định tuyệt đối kể cả temperature=0).
            last_error = e
            continue

        # Dọn dòng trắng: Pydantic đếm ký tự trước khi trim nên "  " lọt min_length.
        draft.missing = [m.strip() for m in draft.missing if m and m.strip()]
        draft.matched = [
            m for m in draft.matched if m.requirement.strip() and m.evidence.strip()
        ]

        # Đối chiếu từng trích dẫn với CV thật (xem _verify).
        _verify(draft, cv)

        # Ép decision khớp fit_score (xem PROCEED_MIN ở đầu file). Chạy SAU _verify để
        # điểm và danh sách đạt/thiếu là của cùng một kết quả đã lọc.
        draft.decision = _band(draft.fit_score)

        # Câu lý do sinh CUỐI CÙNG, từ chính draft đã lọc ở hai bước trên — đây là chỗ
        # bảo đảm câu chữ không mâu thuẫn với danh sách hiển thị (xem CvScreeningResult).
        return CvScreeningResult(**draft.model_dump(), decision_reason=_reason(draft))

    raise RuntimeError(f"LLM khong ra JSON hop le sau {MAX_RETRY} luot: {last_error}")
