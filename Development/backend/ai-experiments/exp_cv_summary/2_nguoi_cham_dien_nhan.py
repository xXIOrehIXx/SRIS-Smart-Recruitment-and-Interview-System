"""
============================================================================
 BƯỚC 2 — BẢNG NHÃN CHẤM TAY

 ĐÂY LÀ NƠI DUY NHẤT ĐỂ SỬA NHÃN. Đừng gõ thẳng vào out/<ver>/nguoi_cham_tung_cau.csv:
 chạy lại 1_chay_model_va_may_cham.py là mất sạch (script đó ghi đè phiếu trống).

 Nhãn khoá theo (mã CV + nguyên văn câu) chứ không theo số dòng: một câu giống hệt xuất
 hiện ở nhiều bậc prompt sẽ luôn nhận cùng một nhãn, không có chuyện cùng một câu bị chấm
 DUNG ở V3 và SAISO ở V4 chỉ vì hai lần chấm cách nhau vài hôm.

 Chạy:
   ..\\..\\ai-service\\.venv\\Scripts\\python.exe 2_nguoi_cham_dien_nhan.py

 -> điền nhãn vào cả 4 thư mục out/v1..v4, rồi báo còn bao nhiêu câu chưa gán.

 ---------------------------------------------------------------------------
 AI KHÔNG ĐƯỢC TỰ CHẤM BÀI CỦA AI

 Nhãn trong bảng dưới đây phải do NGƯỜI làm đề tài gán. Nhờ chính một mô hình ngôn
 ngữ chấm đầu ra của mô hình ngôn ngữ là lập luận vòng tròn: cùng một điểm mù (đọc
 "03/2019 đến nay" thành "5 năm") sẽ vừa gây ra lỗi vừa bỏ qua lỗi đó lúc chấm, và
 con số đẹp lên mà không ai biết vì sao. Hội đồng hỏi "ai gán nhãn" là câu trả lời
 phải là một cái tên người.

 Tầng máy (1_chay_model_va_may_cham.py) thì ngược lại — nó chỉ đếm và đối chiếu chuỗi,
 không phán xét nội dung, nên chạy tự động được và số của nó dùng ngay được.
 ---------------------------------------------------------------------------

 CÁCH GÁN NHÃN
 1. Đọc LUAT_NGUOI_CHAM.md (5 mã + ranh giới khi phân vân + ngưỡng).
 2. Mở out/v1/nguoi_cham_tung_cau.csv để xem các câu cần chấm, đối chiếu với CV gốc
    trong dataset.json.
 3. Thêm dòng vào NHAN dưới đây theo mẫu:
        ("C01_khong_ghi_so_nam", "trần quốc hưng là một ứng viên có kinh nghiệm 5 năm..."): ("SAISO", "CV không ghi số năm, model tự cộng"),
    Chuỗi câu lấy NGUYÊN VĂN từ cột `cau` của CSV (đã hạ chữ thường, gom khoảng trắng).
    Không cần chép hết câu — dùng KHOÁ RÚT GỌN ở mục 4.
 4. Khoá rút gọn: chỉ cần chép ~40 ký tự ĐẦU của câu là đủ để khớp; script so theo
    tiền tố. Trùng tiền tố giữa hai câu khác nhau thì nó báo lỗi để bạn kéo dài khoá.
 5. Chạy lại script này rồi chạy 3_nguoi_cham_tinh_diem.py --all.
============================================================================
"""

import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import csv  # noqa: E402
from pathlib import Path  # noqa: E402

HERE = Path(__file__).parent
OUT = HERE / "out"
VERS = ["v1", "v2", "v3", "v4"]

HOP_LE = {"DUNG", "BIA", "SUYDIEN", "SAISO", "SAORONG"}


# ===========================================================================
#  BẢNG NHÃN — (mã CV, tiền tố câu) -> (nhãn, ghi chú)
#
#  CHƯA GÁN NHÃN. Xem khối "AI KHÔNG ĐƯỢC TỰ CHẤM BÀI CỦA AI" ở đầu file.
#  Điền dần vào đây; câu nào chưa có trong bảng thì cột `nhan` để trống và
#  3_nguoi_cham_tinh_diem.py bỏ qua, nên chấm được tới đâu tính tới đó.
# ===========================================================================
NHAN: dict[tuple[str, str], tuple[str, str]] = {
    # ("C01_khong_ghi_so_nam", "trần quốc hưng là một ứng viên có kinh nghiệm 5 năm"): ("SAISO", "CV chỉ có mốc 03/2019, không ghi số năm"),
}


def _tra(id_tin: str, cau: str) -> tuple[str, str]:
    """Khớp theo tiền tố. Nhiều khoá cùng khớp -> báo để người chấm kéo dài khoá."""
    hit = [(k, v) for k, v in NHAN.items() if k[0] == id_tin and cau.startswith(k[1])]
    if not hit:
        return "", ""
    if len(hit) > 1:
        print(f"  ⚠ {id_tin}: {len(hit)} khoá cùng khớp câu «{cau[:50]}…» — kéo dài khoá cho phân biệt")
    return hit[0][1]


def main() -> int:
    la = {n for n, _ in NHAN.values()} - HOP_LE
    if la:
        raise SystemExit(f"Nhãn không hợp lệ trong bảng NHAN: {sorted(la)} — xem LUAT_NGUOI_CHAM.md")

    tong_cau = tong_trong = 0
    for ver in VERS:
        p = OUT / ver / "nguoi_cham_tung_cau.csv"
        if not p.exists():
            print(f"[{ver}] chưa có phiếu chấm — chạy 1_chay_model_va_may_cham.py trước")
            continue

        with p.open(encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))

        trong = 0
        for r in rows:
            nhan, ghi_chu = _tra(r["id_tin"], r["cau"])
            r["nhan"], r["ghi_chu"] = nhan, ghi_chu
            if not nhan:
                trong += 1

        with p.open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=["id_tin", "stt_cau", "cau", "nhan", "ghi_chu"])
            w.writeheader()
            w.writerows(rows)

        tong_cau += len(rows)
        tong_trong += trong
        print(f"[{ver}] {len(rows) - trong}/{len(rows)} câu đã có nhãn")

    print(f"\nTổng: {tong_cau - tong_trong}/{tong_cau} câu đã gán nhãn.")
    if tong_trong:
        print(f"Còn {tong_trong} câu chưa gán — thêm dòng vào bảng NHAN trong chính file này.")
        print("Nhớ: nhãn phải do NGƯỜI gán, không nhờ mô hình chấm hộ (lý do ở đầu file).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
