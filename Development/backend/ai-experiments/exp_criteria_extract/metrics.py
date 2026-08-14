"""
============================================================================
 TẦNG 1 — CÁC PHÉP ĐO MÁY TỰ TÍNH ĐƯỢC (không cần người gán nhãn)

 Mấy chỉ số ở đây KHÔNG nói được tiêu chí có "đúng" hay không — chuyện đó phải
 người đọc mới biết (tầng 2, xem RUBRIC.md). Chúng chỉ bắt được những lỗi có
 hình dạng cố định, mà bắt được thì rẻ và chạy lại được bao nhiêu lần cũng được:

   - giay_to_rate  : tỉ lệ tiêu chí là thứ ĐỌC HỒ SƠ LÀ BIẾT (bằng cấp, chứng
                     chỉ, bằng lái, tuổi, hộ khẩu). Đây là chỉ số quan trọng
                     nhất của bộ này: nó đo thẳng hiệu lực của luật mới trong
                     prompt. Trước V038 con số này cao là đúng thiết kế cũ;
                     sau V038 mà vẫn cao thì luật mới không ăn.
   - gop_rate      : tỉ lệ tiêu chí nhồi nhiều kỹ năng vào một dòng. Một dòng
                     phiếu chấm chỉ cho được MỘT điểm nên gộp là lỗi thật.
   - trung_lap     : số cặp tiêu chí gần trùng nhau trong cùng một tin.
   - qua_tran      : số tiêu chí vượt trần 10 (phải luôn bằng 0 — schema chặn).
   - on_dinh       : chạy lại cùng một tin thì ra bộ tiêu chí giống nhau tới đâu
                     (Jaccard trung bình giữa các lượt). Đây là bằng chứng cho
                     tuyên bố "temperature=0 nên kết quả ổn định".

 Heuristic thì có sai số, và sai số đó phải được nói ra chứ không giấu:
 giay_to_rate dò theo từ khóa nên "có chứng chỉ" bị tính là giấy tờ kể cả khi
 người viết tin ngụ ý khác. Vì vậy tầng 2 (người chấm) mới là số để trích dẫn;
 tầng 1 dùng để so SÁNH GIỮA CÁC PHIÊN BẢN prompt, nơi cùng một sai số xuất
 hiện ở cả hai bên nên không làm lệch kết luận.
============================================================================
"""

import re
import unicodedata

# Cụm từ báo hiệu "đọc hồ sơ/giấy tờ là kết luận được" — không cần hỏi ứng viên.
# Cố ý gồm cả nhân khẩu học (tuổi, giới tính, nơi ở) vì cùng tính chất: có/không,
# nhìn hồ sơ là biết, đưa lên phiếu chấm phỏng vấn thì không ai cho điểm được.
GIAY_TO_PATTERNS = [
    r"\bbang cap\b", r"\bbang dai hoc\b", r"\bbang cu nhan\b", r"\btot nghiep\b",
    r"\bcu nhan\b", r"\bthac si\b", r"\bky su\b", r"\bcao dang\b", r"\bdai hoc\b",
    r"\btrung cap\b", r"\bthpt\b", r"\bchung chi\b", r"\bchung nhan\b",
    r"\bbang lai\b", r"\bgplx\b", r"\bgiay phep\b",
    r"\bdo tuoi\b", r"\btuoi tu\b", r"\bgioi tinh\b", r"\bnam, nu\b",
    r"\bho khau\b", r"\bthuong tru\b", r"\btam tru\b",
    r"\bchieu cao\b", r"\bngoai hinh\b",
]

# Dấu hiệu một dòng nhồi nhiều kỹ năng. Dấu phẩy và "và" là hai cách gộp phổ biến
# nhất trong JD tiếng Việt; dấu "/" thì KHÔNG tính vì thường là biến thể cùng một
# thứ ("MISA/Fast", "Cao đẳng/Đại học") chứ không phải hai kỹ năng khác nhau.
GOP_PATTERN = re.compile(r",|\bva\b")

# Dòng mang NGƯỠNG ĐỐI CHIẾU: "tối thiểu 2 năm kinh nghiệm", "từ 1 năm trở lên",
# "khách sạn 3 sao trở lên". Cùng bản chất với giấy tờ — cầm CV lên là đối chiếu
# được, cho điểm 0-10 thì vô nghĩa (ứng viên 5 năm cho 10 điểm, 1 năm cho 3 điểm?
# con số đó đã nằm sẵn trên hồ sơ, ngồi trong buổi phỏng vấn đọc lại là phí giờ).
#
# Tách riêng khỏi GIAY_TO_PATTERNS vì hướng xử lý KHÁC: giấy tờ thì BỎ hẳn, còn
# ngưỡng kinh nghiệm thì nên VIẾT LẠI thành chiều sâu năng lực — thứ nằm sau con
# số ấy vẫn đáng hỏi.
NGUONG_PATTERNS = [
    r"\btoi thieu\b", r"\bit nhat\b", r"\btro len\b",
    r"\btu \d", r"\b\d+\s*nam\b", r"\bkinh nghiem \d",
]


def _khong_dau(s: str) -> str:
    """Bỏ dấu tiếng Việt + hạ chữ thường, để dò từ khóa không phụ thuộc cách gõ dấu."""
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.replace("đ", "d")


def la_giay_to(name: str) -> bool:
    """Tiêu chí này có phải thứ đọc hồ sơ là biết không?"""
    plain = _khong_dau(name)
    return any(re.search(p, plain) for p in GIAY_TO_PATTERNS)


def la_gop(name: str) -> bool:
    """Tiêu chí này có nhồi nhiều kỹ năng vào một dòng không?"""
    return bool(GOP_PATTERN.search(_khong_dau(name)))


def la_nguong(name: str) -> bool:
    """Tiêu chí này có viết dưới dạng ngưỡng đối chiếu (số năm, "trở lên") không?"""
    plain = _khong_dau(name)
    return any(re.search(p, plain) for p in NGUONG_PATTERNS)


def _tokens(name: str) -> set:
    return set(_khong_dau(name).split())


def jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 1.0
    return len(a & b) / len(a | b) if (a | b) else 0.0


def dem_trung_lap(names: list, nguong: float = 0.8) -> int:
    """Đếm số CẶP tiêu chí gần trùng nhau (Jaccard token >= ngưỡng)."""
    toks = [_tokens(n) for n in names]
    return sum(
        1
        for i in range(len(toks))
        for j in range(i + 1, len(toks))
        if jaccard(toks[i], toks[j]) >= nguong
    )


def do_on_dinh(cac_luot: list) -> float:
    """
    Chạy lại cùng một tin nhiều lượt thì bộ tiêu chí giống nhau tới đâu.
    So theo TẬP TỪ của cả bộ, không so từng dòng: đổi thứ tự hay diễn đạt lại
    một chữ không phải là "kết quả khác", nhưng bóc thiếu/thừa hẳn một tiêu chí
    thì có. Trả 1.0 nếu chỉ chạy 1 lượt (không có gì để so).
    """
    if len(cac_luot) < 2:
        return 1.0
    taps = [set().union(*(_tokens(n) for n in luot)) if luot else set() for luot in cac_luot]
    cap = [
        jaccard(taps[i], taps[j])
        for i in range(len(taps))
        for j in range(i + 1, len(taps))
    ]
    return sum(cap) / len(cap) if cap else 1.0


def do_mot_tin(names: list) -> dict:
    """Bộ chỉ số tầng 1 cho MỘT tin tuyển dụng (một lượt chạy)."""
    n = len(names)
    giay_to = [x for x in names if la_giay_to(x)]
    gop = [x for x in names if la_gop(x)]
    nguong = [x for x in names if la_nguong(x)]
    return {
        "so_tieu_chi": n,
        "so_giay_to": len(giay_to),
        "giay_to_rate": round(len(giay_to) / n, 4) if n else 0.0,
        "so_gop": len(gop),
        "gop_rate": round(len(gop) / n, 4) if n else 0.0,
        "so_nguong": len(nguong),
        "nguong_rate": round(len(nguong) / n, 4) if n else 0.0,
        "trung_lap": dem_trung_lap(names),
        "qua_tran": max(0, n - 10),
        "_giay_to_names": giay_to,
        "_gop_names": gop,
        "_nguong_names": nguong,
    }
