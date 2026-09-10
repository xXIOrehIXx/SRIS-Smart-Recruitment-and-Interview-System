"""
============================================================================
 BƯỚC 3 — TỔNG HỢP PHIẾU CHẤM TAY -> Precision / Recall / F1

 Đọc out/<ver>/nguoi_cham_tung_cau.csv (đã điền nhãn theo LUAT_NGUOI_CHAM.md)
 và out/<ver>/nguoi_cham_bo_sot.csv (số mốc AI bỏ sót), rồi ra:

   TP = câu DUNG
   FP = câu BIA + SUYDIEN + SAISO + SAORONG
   FN = tổng mốc bị bỏ sót

   Precision = TP / (TP + FP)
   Recall    = TP / (TP + FN)
   F1        = trung bình điều hòa

 kèm bảng phân rã lỗi theo kiểu và theo từng CV.

 VÌ SAO CẦN CẢ RECALL: nguoi_cham_tung_cau.csv chỉ chứa thứ AI ĐÃ nói ra. Chỉ đo
 precision thì một model viết đúng MỘT câu chắc ăn rồi thôi sẽ đạt precision 1.0 —
 con số đẹp cho một bản tóm tắt vô dụng.

 Chạy:
   ..\\..\\ai-service\\.venv\\Scripts\\python.exe 3_nguoi_cham_tinh_diem.py --tag v4
   ..\\..\\ai-service\\.venv\\Scripts\\python.exe 3_nguoi_cham_tinh_diem.py --all
============================================================================
"""

import sys

# Console Windows mặc định cp1252 -> in tiếng Việt là UnicodeEncodeError giữa chừng,
# mất luôn cả bảng kết quả. Ép UTF-8 thay vì bắt người chạy tự đặt PYTHONIOENCODING.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import argparse  # noqa: E402
import csv  # noqa: E402
from collections import defaultdict  # noqa: E402
from pathlib import Path  # noqa: E402

HERE = Path(__file__).parent
OUT = HERE / "out"

NHAN_DUNG = "DUNG"
NHAN_LOI = ["BIA", "SUYDIEN", "SAISO", "SAORONG"]
TAT_CA = [NHAN_DUNG] + NHAN_LOI

MO_TA = {
    "BIA": "bịa — thông tin không hề có trong CV",
    "SUYDIEN": "suy diễn — có neo trong CV nhưng model suy ra thêm",
    "SAISO": "sai số — con số / mốc thời gian sai hoặc tự tính ra",
    "SAORONG": "sáo rỗng — gắn sang CV khác vẫn đúng",
}


def _doc(path: Path) -> list[dict]:
    if not path.exists():
        raise SystemExit(f"Chưa có {path} — chạy 1_chay_model_va_may_cham.py trước.")
    with path.open(encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def tinh(ver: str, im: bool = False) -> dict | None:
    thu_muc = OUT / ver
    cau = _doc(thu_muc / "nguoi_cham_tung_cau.csv")
    sot = _doc(thu_muc / "nguoi_cham_bo_sot.csv")

    da_cham = [r for r in cau if (r.get("nhan") or "").strip()]
    if not da_cham:
        if not im:
            print(f"[{ver}] chưa gán nhãn dòng nào — mở {thu_muc / 'nguoi_cham_tung_cau.csv'}")
        return None

    la = [r for r in da_cham if (r["nhan"] or "").strip().upper() not in TAT_CA]
    if la:
        print(f"[{ver}] ⚠ {len(la)} dòng mang nhãn lạ: "
              f"{sorted({r['nhan'] for r in la})} — xem LUAT_NGUOI_CHAM.md")

    dem = defaultdict(int)
    for r in da_cham:
        dem[(r["nhan"] or "").strip().upper()] += 1

    tp = dem[NHAN_DUNG]
    fp = sum(dem[n] for n in NHAN_LOI)
    fn = sum(int(r["so_moc_bi_bo_sot"]) for r in sot if (r.get("so_moc_bi_bo_sot") or "").strip().isdigit())

    p = tp / (tp + fp) if (tp + fp) else 0.0
    r_ = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * p * r_ / (p + r_) if (p + r_) else 0.0

    tong = tp + fp
    ti_bia_saiso = (dem["BIA"] + dem["SAISO"]) / tong if tong else 0.0
    ti_saorong = dem["SAORONG"] / tong if tong else 0.0

    kq = {
        "ver": ver.upper(), "TP": tp, "FP": fp, "FN": fn,
        "precision": round(p, 3), "recall": round(r_, 3), "f1": round(f1, 3),
        "ti_le_bia_saiso": round(ti_bia_saiso, 3),
        "ti_le_saorong": round(ti_saorong, 3),
        "so_cau_da_cham": len(da_cham),
        "so_cau_phan_van": sum(1 for r in da_cham if (r.get("ghi_chu") or "").strip()),
        **{f"n_{n}": dem[n] for n in TAT_CA},
    }

    with (thu_muc / "nguoi_cham_tong_ket.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(kq.keys()))
        w.writeheader()
        w.writerow(kq)

    if not im:
        _in(ver, kq, dem, da_cham, sot)
    return kq


def _muc(gia_tri: float, tot: float, chap_nhan: float) -> str:
    """Ngưỡng chốt TRƯỚC khi đo — xem LUAT_NGUOI_CHAM.md mục 4."""
    if gia_tri >= tot:
        return "Tốt"
    if gia_tri >= chap_nhan:
        return "Chấp nhận được"
    return "Cần cải thiện"


def _muc_nguoc(gia_tri: float, tot: float, chap_nhan: float) -> str:
    """Cho chỉ số càng THẤP càng tốt (tỉ lệ bịa, tỉ lệ sáo rỗng)."""
    if gia_tri <= tot:
        return "Tốt"
    if gia_tri <= chap_nhan:
        return "Chấp nhận được"
    return "Cần cải thiện"


def _in(ver, kq, dem, da_cham, sot) -> None:
    print(f"\n=== {ver.upper()} — {kq['so_cau_da_cham']} câu đã chấm ===")
    print(f"TP={kq['TP']}  FP={kq['FP']}  FN={kq['FN']} (mốc bỏ sót)")
    print(f"  Precision {kq['precision']:.3f}  [{_muc(kq['precision'], 0.85, 0.70)}]")
    print(f"  Recall    {kq['recall']:.3f}  [{_muc(kq['recall'], 0.85, 0.70)}]")
    print(f"  F1        {kq['f1']:.3f}  [{_muc(kq['f1'], 0.85, 0.70)}]")
    print(f"  Tỉ lệ BIA+SAISO {kq['ti_le_bia_saiso']:.3f}  [{_muc_nguoc(kq['ti_le_bia_saiso'], 0.0, 0.05)}]")
    print(f"  Tỉ lệ SAORONG   {kq['ti_le_saorong']:.3f}  [{_muc_nguoc(kq['ti_le_saorong'], 0.05, 0.15)}]")

    print("\n  Phân rã lỗi:")
    for n in NHAN_LOI:
        if dem[n]:
            print(f"    {n:9s} {dem[n]:3d}  — {MO_TA[n]}")
    if not sum(dem[n] for n in NHAN_LOI):
        print("    (không có lỗi nào)")

    theo_tin = defaultdict(lambda: defaultdict(int))
    for r in da_cham:
        theo_tin[r["id_tin"]][(r["nhan"] or "").strip().upper()] += 1
    sot_map = {r["id_tin"]: r.get("so_moc_bi_bo_sot", "") for r in sot}

    print("\n  Theo từng CV:")
    print(f"    {'CV':28s} {'DUNG':>5s} {'lỗi':>4s} {'sót':>4s}")
    for tin in sorted(theo_tin):
        d = theo_tin[tin]
        print(f"    {tin:28s} {d[NHAN_DUNG]:5d} {sum(d[n] for n in NHAN_LOI):4d} "
              f"{sot_map.get(tin, '') or '-':>4s}")

    if kq["so_cau_phan_van"]:
        print(f"\n  {kq['so_cau_phan_van']} câu có ghi chú của người chấm "
              f"({kq['so_cau_phan_van'] / kq['so_cau_da_cham']:.0%}) — độ nhạy của phép đo với người chấm.")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", default="v4", help="bậc prompt: v1|v2|v3|v4")
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()

    vers = ["v1", "v2", "v3", "v4"] if a.all else [a.tag]
    bang = [k for k in (tinh(v) for v in vers) if k]

    if a.all and bang:
        print("\n=== SO 4 BẬC (tầng người) ===")
        print(f"    {'':12s}" + "".join(f"{b['ver']:>10s}" for b in bang))
        for nhan, key in [("Precision", "precision"), ("Recall", "recall"), ("F1", "f1"),
                          ("BIA+SAISO", "ti_le_bia_saiso"), ("SAORONG", "ti_le_saorong")]:
            print(f"    {nhan:12s}" + "".join(f"{b[key]:>10.3f}" for b in bang))

        with (OUT / "nguoi_cham_4_ban.csv").open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=list(bang[0].keys()))
            w.writeheader()
            w.writerows(bang)
        print(f"\n-> {OUT / 'nguoi_cham_4_ban.csv'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
