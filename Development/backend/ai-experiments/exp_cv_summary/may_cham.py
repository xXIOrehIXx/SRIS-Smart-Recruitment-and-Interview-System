"""
============================================================================
 TẦNG MÁY — các phép đo script tự tính được trên một bản tóm tắt CV.

 RANH GIỚI PHẢI NHỚ: máy KHÔNG biết bản tóm tắt có ĐÚNG không. Nó chỉ đo được
 thứ có hình dạng cố định. Precision/Recall chỉ ra được từ tầng người
 (3_nguoi_cham_tinh_diem.py). Số ở đây dùng để SO GIỮA CÁC BẬC, vì cùng một
 sai số của phép đo xuất hiện ở cả bốn bậc nên không làm lệch kết luận.

 Sáu phép đo, mỗi phép trả lời một câu:

   1. json_hop_le      — model có trả đúng JSON ngay lượt đầu không?
   2. so_cau           — prompt production yêu cầu 3-5 câu. Có giữ khuôn không?
   3. so_la            — CÁI QUAN TRỌNG NHẤT: mọi con số trong tóm tắt có truy
                         được về CV không? Đây là cách bắt máy phát hiện lỗi
                         "tự cộng mốc thời gian thành 6 năm kinh nghiệm".
   4. ti_le_sao_rong   — bao nhiêu phần trăm câu là lời khen chung chung, gỡ
                         khỏi CV này gắn sang CV khác vẫn đúng?
   5. nhac_dinh_dang   — có than phiền CV khó đọc/lộn xộn không (ca C06)?
   6. on_dinh          — chạy hai lượt cùng đầu vào có ra giống nhau không?

 PHÉP ĐO 3 ĐO ĐƯỢC LÀ NHỜ ĐẶC ĐIỂM CỦA BÀI TOÁN: tóm tắt là KỂ LẠI, nên mọi
 con số trong bản tóm tắt bắt buộc phải có mặt trong CV gốc. Con số lạ = hoặc
 model tự tính, hoặc model bịa. Cả hai đều là lỗi. Đây là chỗ hiếm hoi máy bắt
 được lỗi nội dung mà không cần người đọc.
============================================================================
"""

import re
import unicodedata

# ---------------------------------------------------------------------------
# Chuẩn hoá
# ---------------------------------------------------------------------------


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip().lower()


def _bo_dau(s: str) -> str:
    """Bỏ dấu tiếng Việt — dò cụm sáo rỗng không nên chết vì thiếu một dấu hỏi."""
    nfd = unicodedata.normalize("NFD", _norm(s))
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn").replace("đ", "d")


# ---------------------------------------------------------------------------
# 2. Đếm câu
# ---------------------------------------------------------------------------

KHUON_CAU_MIN = 3
KHUON_CAU_MAX = 5


def tach_cau(summary: str) -> list[str]:
    """
    Tách câu thô: cắt ở . ! ? theo sau bởi khoảng trắng + chữ hoa, hoặc cuối chuỗi.

    Cố ý KHÔNG dùng thư viện tách câu: mốc thời gian kiểu "03/2019" và tên viết tắt
    làm mọi bộ tách câu tiếng Việt sẵn có cắt sai, mà ta chỉ cần con số xấp xỉ để so
    giữa các bậc. Sai số như nhau ở cả bốn bậc nên không làm lệch so sánh.
    """
    s = _norm(summary)
    if not s:
        return []
    tho = re.split(r"(?<=[.!?])\s+", s)
    return [c.strip() for c in tho if len(c.strip()) > 1]


# ---------------------------------------------------------------------------
# 3. Số lạ — con số trong tóm tắt KHÔNG có trong CV
# ---------------------------------------------------------------------------

# Bỏ qua số 1 và 2: chúng xuất hiện trong "một", "hai", "thứ 2", "2 ca"... quá nhiều
# ngữ cảnh vô hại, giữ lại chỉ làm nhiễu. Lỗi đáng bắt là "6 năm", "40 phút", "118%".
_BO_QUA = {"1", "2"}


def _so_trong(text: str) -> list[str]:
    """Mọi cụm chữ số trong văn bản (bỏ dấu phân cách nghìn)."""
    phang = (text or "").replace(".", " ").replace(",", " ")
    return [n for n in re.findall(r"\d+", phang) if n not in _BO_QUA]


def so_la(summary: str, cv_text: str) -> list[str]:
    """
    Con số xuất hiện trong tóm tắt mà KHÔNG có trong CV.

    Đây là dây neo chống bịa của tầng máy — cùng ý tưởng với _verify() bên
    ai-service (evidence phải là chữ có sẵn trong CV), nhưng áp cho con số vì
    con số là thứ duy nhất trong một đoạn văn xuôi mà máy đối chiếu được chính xác.

    Ví dụ bắt được thật: CV ghi "03/2019 đến nay" và không câu nào nói số năm;
    tóm tắt viết "hơn 6 năm kinh nghiệm" -> số "6" không có trong CV -> báo lỗi.
    """
    co_trong_cv = set(_so_trong(cv_text))
    return [n for n in dict.fromkeys(_so_trong(summary)) if n not in co_trong_cv]


# ---------------------------------------------------------------------------
# 4. Câu sáo rỗng
# ---------------------------------------------------------------------------

# Phép thử để một cụm được vào danh sách này: GỠ câu đó khỏi bản tóm tắt rồi gắn
# sang CV của một ứng viên khác — nếu vẫn đúng thì câu đó không mang thông tin của
# CV này, tức là sáo rỗng. Prompt production cấm đúng loại câu này.
CUM_SAO_RONG = [
    "co nhieu kinh nghiem",
    "giau kinh nghiem",
    "day kinh nghiem",
    "co tiem nang",
    "day tiem nang",
    "ung vien tiem nang",
    "nhiet tinh",
    "nang dong",
    "ham hoc hoi",
    "tinh than trach nhiem",
    "kha nang lam viec nhom tot",
    "chiu duoc ap luc",
    "phu hop voi vi tri",
    "rat phu hop",
    "la mot ung vien sang gia",
    "co the dam nhan tot",
    "hua hen",
    "trien vong",
]


def cau_sao_rong(summary: str) -> list[str]:
    """Các câu chứa ít nhất một cụm sáo rỗng."""
    ket = []
    for cau in tach_cau(summary):
        khong_dau = _bo_dau(cau)
        if any(cum in khong_dau for cum in CUM_SAO_RONG):
            ket.append(cau)
    return ket


# ---------------------------------------------------------------------------
# 5. Nhận xét về định dạng (ca C06 — text PDF lộn xộn)
# ---------------------------------------------------------------------------

CUM_DINH_DANG = [
    "kho doc", "lon xon", "dinh chu", "khong co dau cach", "sai chinh ta",
    "trinh bay kem", "dinh dang", "kho hieu do", "bi loi", "khong ro rang do",
    "thieu dau cau", "van ban bi",
]


def nhac_dinh_dang(summary: str) -> bool:
    """Prompt production dặn 'đừng nhận xét gì về định dạng'. True = có vi phạm."""
    khong_dau = _bo_dau(summary)
    return any(cum in khong_dau for cum in CUM_DINH_DANG)


# ---------------------------------------------------------------------------
# 6. Ổn định giữa hai lượt
# ---------------------------------------------------------------------------


def on_dinh(a: str, b: str) -> float:
    """
    Jaccard trên tập từ của hai bản tóm tắt cùng đầu vào. 1.0 = giống hệt.

    Dùng tập TỪ chứ không so chuỗi: temperature=0 vẫn cho model đổi trật tự câu
    hoặc thay một liên từ, mà đó không phải thứ ta muốn tính là "không ổn định".
    """
    ta, tb = set(_bo_dau(a).split()), set(_bo_dau(b).split())
    if not ta and not tb:
        return 1.0
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


# ---------------------------------------------------------------------------
# 7. Mốc bắt buộc (mẫu số thô của recall ở tầng máy)
# ---------------------------------------------------------------------------


def moc_thieu(summary: str, moc_phai_co: list[str]) -> list[str]:
    """
    Trong các dữ kiện dataset đánh dấu "một bản tóm tắt tốt phải nhắc tới", cái nào
    KHÔNG xuất hiện.

    Dò rất thô: khớp khi BẤT KỲ từ khoá nào (tách bởi "/") có mặt. Đây chỉ là tín
    hiệu sớm để so giữa các bậc — recall thật vẫn phải người chấm, vì máy không
    nhận ra "làm backend từ 2019" và "phát triển API từ năm 2019" là cùng một ý.
    """
    khong_dau = _bo_dau(summary)
    thieu = []
    for moc in moc_phai_co:
        bien_the = [_bo_dau(x) for x in moc.split("/") if x.strip()]
        if not any(bt and bt in khong_dau for bt in bien_the):
            thieu.append(moc)
    return thieu


# ---------------------------------------------------------------------------
# Gộp: đo một bản tóm tắt
# ---------------------------------------------------------------------------


def do_mot_ban(summary: str, cv_text: str, moc_phai_co: list[str]) -> dict:
    cau = tach_cau(summary)
    la = so_la(summary, cv_text)
    rong = cau_sao_rong(summary)
    thieu = moc_thieu(summary, moc_phai_co)
    return {
        "so_ky_tu": len(summary or ""),
        "so_cau": len(cau),
        "dung_khuon_3_5_cau": KHUON_CAU_MIN <= len(cau) <= KHUON_CAU_MAX,
        "so_la": la,
        "so_luong_so_la": len(la),
        "cau_sao_rong": rong,
        "ti_le_sao_rong": round(len(rong) / len(cau), 3) if cau else 0.0,
        "nhac_dinh_dang": nhac_dinh_dang(summary),
        "moc_thieu": thieu,
        "so_moc_thieu": len(thieu),
        "so_moc_phai_co": len(moc_phai_co),
    }
