"""
============================================================================
 TẦNG 2 — TỔNG HỢP PHIẾU CHẤM TAY

 Đọc out/<tag>/nguoi_cham_tung_dong.csv (người đã điền nhãn theo LUAT_NGUOI_CHAM.md) và
 out/<tag>/nguoi_cham_bo_sot.csv (số tiêu chí AI bỏ sót), rồi ra:

   Precision = DUNG / tổng đề xuất
   Recall    = DUNG / (DUNG + bỏ sót)
   F1        = trung bình điều hòa

 kèm bảng phân rã lỗi theo từng kiểu và từng tin.

 Vì sao cần cả recall: nguoi_cham_tung_dong.csv chỉ chứa thứ AI ĐÃ nói ra. Chỉ đo precision
 thì một mô hình "chỉ nói 1 tiêu chí chắc ăn rồi thôi" sẽ đạt precision 1.0 —
 con số đẹp cho một hệ thống vô dụng.

 Chạy:
   cd ai-experiments/exp_criteria_extract
   python 3_nguoi_cham_tinh_diem.py                  # out/baseline
   python 3_nguoi_cham_tinh_diem.py --tag truoc_v038
============================================================================
"""

import sys

# Console Windows mặc định là cp1252, in tiếng Việt ra là UnicodeEncodeError giữa chừng
# (mất luôn cả bảng kết quả). Ép UTF-8 cho stdout thay vì bắt người chạy tự đặt
# PYTHONIOENCODING mỗi lần.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import argparse
import csv
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent

NHAN_DUNG = "DUNG"
NHAN_LOI = ["BIA", "DAUVIEC", "GIAYTO", "GOP", "TRUNG"]
TAT_CA = [NHAN_DUNG] + NHAN_LOI

MO_TA = {
    "BIA": "bịa — không có căn cứ trong tin",
    "DAUVIEC": "đầu việc — không phải yêu cầu ứng viên",
    "GIAYTO": "giấy tờ — đọc hồ sơ là biết, không cần phỏng vấn",
    "GOP": "gộp — nhiều kỹ năng trong một dòng",
    "TRUNG": "trùng — đã có dòng khác nói cùng chuyện",
}


def doc_labels(path: Path) -> list:
    if not path.exists():
        raise SystemExit(f"Chưa có {path} — chạy 1_chay_model_va_may_cham.py trước.")
    with path.open(encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", default="baseline")
    args = ap.parse_args()

    out = HERE / "out" / args.tag
    rows = doc_labels(out / "nguoi_cham_tung_dong.csv")

    # Chưa chấm xong thì dừng hẳn. Tính precision trên bộ chấm dở là tự lừa mình:
    # phần chưa chấm gần như luôn là phần khó, tức là phần nhiều lỗi nhất.
    chua = [r for r in rows if not (r.get("nhan") or "").strip()]
    if chua:
        print(f"[!] Còn {len(chua)}/{len(rows)} dòng chưa gán nhãn trong nguoi_cham_tung_dong.csv. Ví dụ:")
        for r in chua[:5]:
            print(f"      {r['id']:<20} {r['tieu_chi'][:60]}")
        print("\n    Đọc LUAT_NGUOI_CHAM.md rồi điền cột 'nhan' (DUNG/BIA/DAUVIEC/GIAYTO/GOP/TRUNG).")
        return 1

    sai_ma = {(r.get("nhan") or "").strip().upper() for r in rows} - set(TAT_CA)
    if sai_ma:
        print(f"[!] Nhãn không hợp lệ: {', '.join(sorted(sai_ma))}")
        print(f"    Chỉ dùng: {', '.join(TAT_CA)}")
        return 1

    bo_sot = {}
    mpath = out / "nguoi_cham_bo_sot.csv"
    if mpath.exists():
        with mpath.open(encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                v = (r.get("so_bo_sot") or "").strip()
                bo_sot[r["id"]] = int(v) if v.isdigit() else None

    thieu_sot = [k for k, v in bo_sot.items() if v is None]
    if thieu_sot:
        print(f"[!] Chưa điền số bỏ sót cho: {', '.join(thieu_sot)}")
        print("    Không có số này thì recall vô nghĩa (xem đầu file). Điền vào nguoi_cham_bo_sot.csv.")
        return 1

    theo_tin = defaultdict(lambda: defaultdict(int))
    for r in rows:
        theo_tin[r["id"]][(r["nhan"] or "").strip().upper()] += 1

    # Tin mà AI trả RỖNG không có dòng nào trong nguoi_cham_tung_dong.csv. Vẫn phải đưa vào bảng:
    # nếu bỏ qua thì số bỏ sót của đúng những tin AI im lặng bị rơi khỏi mẫu số recall,
    # tức là tin nào AI làm tệ nhất lại là tin không bị tính điểm. Recall sẽ đẹp lên
    # một cách vô nghĩa đúng ở chỗ đáng lo nhất.
    for tin in bo_sot:
        theo_tin.setdefault(tin, defaultdict(int))

    print(f"\n=== TẦNG 2 — NGƯỜI CHẤM ({args.tag}) ===\n")
    print(f"{'tin':<22}{'đề xuất':>8}{'DUNG':>6}{'sót':>5}{'prec':>8}{'recall':>8}{'F1':>7}")
    print("-" * 64)

    ket = []
    for tin in sorted(theo_tin):
        d = theo_tin[tin]
        tong = sum(d.values())
        dung = d.get(NHAN_DUNG, 0)
        sot = bo_sot.get(tin, 0)

        # Tin AI trả rỗng mà cũng KHÔNG bỏ sót gì (ca đối chứng J09: tin không nêu
        # yêu cầu nào, trả rỗng là đúng) thì không có gì để tính tỉ lệ — mẫu số bằng 0.
        # In 0.000 ở đây là vu oan: bảng sẽ có một dòng toàn số 0 cho đúng ca chạy chuẩn.
        khong_ap_dung = tong == 0 and sot == 0
        p = dung / tong if tong else 0.0
        rc = dung / (dung + sot) if (dung + sot) else 1.0
        f1 = 2 * p * rc / (p + rc) if (p + rc) else 0.0
        if khong_ap_dung:
            print(f"{tin:<22}{tong:>8}{dung:>6}{sot:>5}{'—':>8}{'—':>8}{'ĐẠT':>7}")
        else:
            print(f"{tin:<22}{tong:>8}{dung:>6}{sot:>5}{p:>8.3f}{rc:>8.3f}{f1:>7.3f}")
        ket.append({
            "id": tin, "de_xuat": tong, "dung": dung, "bo_sot": sot,
            **{k.lower(): d.get(k, 0) for k in NHAN_LOI},
            "precision": "" if khong_ap_dung else round(p, 4),
            "recall": "" if khong_ap_dung else round(rc, 4),
            "f1": "" if khong_ap_dung else round(f1, 4),
        })

    T = sum(r["de_xuat"] for r in ket)
    D = sum(r["dung"] for r in ket)
    S = sum(r["bo_sot"] for r in ket)
    P = D / T if T else 0.0
    R = D / (D + S) if (D + S) else 1.0
    F = 2 * P * R / (P + R) if (P + R) else 0.0

    print("-" * 64)
    print(f"{'TỔNG':<22}{T:>8}{D:>6}{S:>5}{P:>8.3f}{R:>8.3f}{F:>7.3f}")

    print("\n=== SAI KIỂU GÌ ===")
    for ma in NHAN_LOI:
        n = sum(r[ma.lower()] for r in ket)
        if n:
            print(f"  {ma:<9} {n:>3} ({n / T * 100:>5.1f}%)  {MO_TA[ma]}")
    if T == D:
        print("  (không có lỗi nào — kiểm lại xem đã chấm nghiêm chưa)")

    with (out / "nguoi_cham_tong_ket.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(ket[0].keys()))
        w.writeheader()
        w.writerows(ket)
        w.writerow({
            "id": "TONG", "de_xuat": T, "dung": D, "bo_sot": S,
            **{k.lower(): sum(r[k.lower()] for r in ket) for k in NHAN_LOI},
            "precision": round(P, 4), "recall": round(R, 4), "f1": round(F, 4),
        })

    print(f"\nĐã ghi: {out / 'nguoi_cham_tong_ket.csv'}")
    print("\nBa con số để trích vào báo cáo — nhớ kèm phần hạn chế ở cuối LUAT_NGUOI_CHAM.md:")
    print(f"  Precision {P:.3f} · Recall {R:.3f} · F1 {F:.3f}  (trên {T} tiêu chí / {len(ket)} tin)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
