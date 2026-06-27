"""
============================================================
METRICS — TẦNG ĐO TỰ ĐỘNG (Section 16.2, tầng "máy check")
------------------------------------------------------------
Khách quan tuyệt đối, tính cho MỌI version miễn phí công sức. Đây là trục số
chính bổ trợ cho pass-rate rubric (do người chấm). 4 chỉ số:

  pct_structural_ok : % câu đúng cấu trúc (4 đáp án phân biệt, index hợp lệ,
                      không phương án rỗng) — proxy máy-check cho "đúng 1 đáp án".
  pct_unique        : % câu KHÔNG trùng nội dung (chuẩn hoá text) trong cùng JD.
  pct_situational   : % câu DẠNG TÌNH HUỐNG (heuristic) — phạt câu "hỏi định nghĩa
                      thuộc lòng" (Google 10s ra). LÀ HEURISTIC, ghi rõ trong báo cáo.
  json_success_rate : % JD pipeline sinh được JSON hợp lệ (parse OK).

Lưu ý trung thực: pct_situational là heuristic từ khoá, KHÔNG phải chân lý —
chỉ là tín hiệu SO SÁNH giữa các version. Correctness/Tình huống "thật" vẫn do
rubric người chấm quyết (quiz_eval_rubric.xlsx).
============================================================
"""
from __future__ import annotations

import re
import unicodedata

# Dấu hiệu câu "hỏi định nghĩa thuộc lòng" (xấu — Google ra ngay)
_DEFINITIONAL = [
    "là gì", "định nghĩa", "nghĩa là gì", "viết tắt của", "được gọi là",
    "thuật ngữ nào", "khái niệm", "được định nghĩa", "là viết tắt",
    "đâu là định nghĩa", "ý nghĩa của",
]
# Dấu hiệu câu tình huống (tốt — phải hiểu mới làm được)
_SITUATIONAL = [
    "tình huống", "trong trường hợp", "khi nào", "nên làm gì", "cần làm gì",
    "xử lý", "giả sử", "bạn sẽ", "nếu", "để tối ưu", "cách tốt nhất",
    "kết quả của", "điều gì xảy ra", "phương án nào phù hợp", "nên chọn",
    "gặp lỗi", "khắc phục", "đoạn code", "câu lệnh nào", "bút toán nào",
]


def _norm(text: str) -> str:
    t = unicodedata.normalize("NFC", text).lower().strip()
    return re.sub(r"\s+", " ", t)


def _is_situational(q: str) -> bool:
    low = _norm(q)
    if any(k in low for k in _DEFINITIONAL):
        # vẫn cho qua nếu có dấu hiệu tình huống mạnh
        return any(k in low for k in _SITUATIONAL)
    return any(k in low for k in _SITUATIONAL)


def _structural_ok(opts: list[str], idx: int) -> bool:
    if len(opts) != 4:
        return False
    if any(not o.strip() for o in opts):
        return False
    if len({_norm(o) for o in opts}) != 4:   # 4 đáp án phải phân biệt
        return False
    return 0 <= idx < 4


def metrics_for_jd(questions) -> dict:
    """questions: list[Question]. Trả dict chỉ số cho 1 JD."""
    n = len(questions)
    if n == 0:
        return dict(n=0, structural_ok=0, unique=0, situational=0)
    struct = sum(1 for q in questions if _structural_ok(q.options, q.correct_index))
    seen, uniq = set(), 0
    for q in questions:
        k = _norm(q.question)
        if k and k not in seen:
            uniq += 1
        seen.add(k)
    situ = sum(1 for q in questions if _is_situational(q.question))
    return dict(n=n, structural_ok=struct, unique=uniq, situational=situ)


def aggregate(jd_results) -> dict:
    """jd_results: list[JdResult]. Trả bảng % tổng hợp cho 1 version."""
    total_q = 0
    s_ok = s_uniq = s_situ = 0
    json_ok = 0
    for r in jd_results:
        m = metrics_for_jd(r.questions)
        total_q += m["n"]
        s_ok += m["structural_ok"]
        s_uniq += m["unique"]
        s_situ += m["situational"]
        json_ok += 1 if r.json_ok else 0

    def pct(x):
        return round(100 * x / total_q, 1) if total_q else 0.0

    return {
        "total_questions": total_q,
        "n_jd": len(jd_results),
        "json_success_rate": round(100 * json_ok / len(jd_results), 1) if jd_results else 0.0,
        "pct_structural_ok": pct(s_ok),
        "pct_unique": pct(s_uniq),
        "pct_situational": pct(s_situ),
    }
