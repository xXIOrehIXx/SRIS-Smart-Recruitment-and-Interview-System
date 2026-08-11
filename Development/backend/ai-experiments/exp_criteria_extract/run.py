"""
============================================================================
 ĐO CHẤT LƯỢNG AI ĐỀ XUẤT TIÊU CHÍ (docs 5.18)

 Câu hỏi: AI đề xuất tiêu chí từ tin tuyển dụng có dùng được không, và dùng
 được tới mức nào?

 Trước đây nhóm đo kỹ hai thứ đã CẮT khỏi phạm vi (sinh câu hỏi quiz — exp/,
 ngưỡng khớp vector — exp_criteria_threshold/) nhưng chưa đo thứ DUY NHẤT còn
 chạy trong sản phẩm. Bộ này lấp đúng chỗ trống đó.

 Đo hai tầng, đúng khung Section 16:
   Tầng 1 (script này)     — máy tự tính, không cần người: xem metrics.py.
   Tầng 2 (score_rubric.py) — người đọc từng tiêu chí và gán nhãn theo RUBRIC.md,
                              ra precision / recall / F1. Đây mới là số để trích.

 Script này gọi ĐÚNG AI service đang chạy thật (không gọi thẳng Ollama), và
 ghép 3 ô đầu vào y hệt BuildSourceText của .NET — đo cái chạy thật, không đo
 một bản mô phỏng gần giống.

 Chạy:
   cd ai-experiments/exp_criteria_extract
   python run.py                          # AI service ở 127.0.0.1:8000
   python run.py --repeat 3               # 3 lượt/tin để đo độ ổn định
   python run.py --tag truoc_v038         # ghi vào out/truoc_v038/ để so phiên bản
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
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

from metrics import do_mot_tin, do_on_dinh

HERE = Path(__file__).parent


def ghep_van_ban(job: dict) -> str:
    """
    Bản sao của EvaluationCriteriaService.BuildSourceText (.NET).
    Giữ nguyên tiêu đề từng mục — prompt dựa vào đúng ranh giới đó để phân biệt
    đầu việc với yêu cầu. Mục trống thì bỏ hẳn tiêu đề, không để tiêu đề rỗng.
    """
    phan = []
    if (job.get("jd_text") or "").strip():
        phan.append("[Mô tả công việc]\n" + job["jd_text"].strip())
    reqs = [r.strip() for r in job.get("requirements", []) if r and r.strip()]
    if reqs:
        phan.append("[Yêu cầu ứng viên]\n" + "\n".join("- " + r for r in reqs))
    if (job.get("skill_tags") or "").strip():
        phan.append("[Kỹ năng yêu cầu]\n" + job["skill_tags"].strip())
    return "\n\n".join(phan).strip()


def goi_ai(text: str, base_url: str, timeout: int) -> tuple:
    """
    Gọi /extract-criteria. Trả (danh sách tên tiêu chí, giây, lỗi hoặc None).
    Lỗi KHÔNG làm dừng cả lượt chạy: một tin hỏng vẫn phải đo được 9 tin còn lại,
    và bản thân tỉ lệ hỏng cũng là một số đáng báo cáo.
    """
    body = json.dumps({"jd_text": text}).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url}/extract-criteria", data=body,
        headers={"Content-Type": "application/json"},
    )
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        giay = time.perf_counter() - t0
        return [c["name"] for c in data.get("criteria", [])], giay, None
    except urllib.error.HTTPError as e:
        return [], time.perf_counter() - t0, f"HTTP {e.code}: {e.read().decode('utf-8', 'ignore')[:200]}"
    except Exception as e:  # timeout, service chưa chạy...
        return [], time.perf_counter() - t0, f"{type(e).__name__}: {e}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8000")
    ap.add_argument("--repeat", type=int, default=1, help="số lượt/tin (>=2 mới đo được độ ổn định)")
    ap.add_argument("--timeout", type=int, default=600)
    ap.add_argument("--tag", default="baseline", help="tên thư mục con trong out/")
    args = ap.parse_args()

    out = HERE / "out" / args.tag
    out.mkdir(parents=True, exist_ok=True)

    jobs = json.loads((HERE / "dataset.json").read_text(encoding="utf-8"))["jobs"]
    print(f"[ ] {len(jobs)} tin tuyển dụng x {args.repeat} lượt -> {args.url}")
    print("[ ] Lượt đầu tiên sẽ chậm hơn hẳn (Ollama nạp model vào RAM).\n")

    raw, rows = [], []
    for job in jobs:
        text = ghep_van_ban(job)
        cac_luot, cac_giay, cac_loi = [], [], []

        for lan in range(args.repeat):
            names, giay, loi = goi_ai(text, args.url, args.timeout)
            cac_luot.append(names)
            cac_giay.append(giay)
            if loi:
                cac_loi.append(loi)
            print(f"    {job['id']:<20} lượt {lan + 1}/{args.repeat}  "
                  f"{len(names):>2} tiêu chí  {giay:>6.1f}s" + (f"  LỖI: {loi[:60]}" if loi else ""))

        # Lượt 1 là lượt đem đi chấm tay — chọn cố định chứ không chọn lượt "đẹp nhất",
        # vì chọn lượt đẹp là tự chấm điểm cho mình.
        chinh = cac_luot[0]
        m = do_mot_tin(chinh)

        raw.append({
            "id": job["id"], "title": job["title"], "industry": job["industry"],
            "expect": job.get("expect", ""),
            "source_text": text,
            "cac_luot": cac_luot,
            "giay": [round(g, 2) for g in cac_giay],
            "loi": cac_loi,
        })
        rows.append({
            "id": job["id"], "nganh": job["industry"],
            "so_tieu_chi": m["so_tieu_chi"],
            "so_giay_to": m["so_giay_to"], "giay_to_rate": m["giay_to_rate"],
            "so_gop": m["so_gop"], "gop_rate": m["gop_rate"],
            "trung_lap": m["trung_lap"], "qua_tran": m["qua_tran"],
            "on_dinh": round(do_on_dinh(cac_luot), 4),
            "giay_tb": round(sum(cac_giay) / len(cac_giay), 2),
            "loi": len(cac_loi),
        })

    (out / "raw.json").write_text(
        json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")

    with (out / "auto_metrics.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    # Phiếu chấm tay cho tầng 2 — mỗi tiêu chí một dòng, cột nhan để TRỐNG cho người điền.
    with (out / "labels.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["id", "tieu_chi", "nhan", "ghi_chu"])
        for r in raw:
            for name in r["cac_luot"][0]:
                w.writerow([r["id"], name, "", ""])

    # Tiêu chí AI BỎ SÓT thì không có dòng nào để gán nhãn -> phải đếm riêng, nếu
    # không thì recall vĩnh viễn bằng 1 và bộ số đo trông đẹp một cách vô nghĩa.
    with (out / "missing.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["id", "so_bo_sot", "ghi_chu"])
        for r in raw:
            w.writerow([r["id"], "", ""])

    tong = sum(r["so_tieu_chi"] for r in rows)
    gt = sum(r["so_giay_to"] for r in rows)
    gop = sum(r["so_gop"] for r in rows)
    moi_giay = [g for r in raw for g in r["giay"]]
    moi_giay.sort()

    print("\n=== TẦNG 1 — MÁY ĐO ===")
    print(f"  Tổng tiêu chí đề xuất : {tong} ({tong / len(rows):.1f}/tin)")
    print(f"  Là giấy tờ            : {gt} ({gt / tong * 100:.1f}%)" if tong else "  Là giấy tờ: n/a")
    print(f"  Gộp nhiều kỹ năng     : {gop} ({gop / tong * 100:.1f}%)" if tong else "")
    print(f"  Cặp trùng lặp         : {sum(r['trung_lap'] for r in rows)}")
    print(f"  Vượt trần 10          : {sum(r['qua_tran'] for r in rows)}")
    print(f"  Lượt hỏng             : {sum(r['loi'] for r in rows)}/{len(jobs) * args.repeat}")
    if args.repeat > 1:
        od = sum(r["on_dinh"] for r in rows) / len(rows)
        print(f"  Độ ổn định (Jaccard)  : {od:.3f}")
    if moi_giay:
        p50 = moi_giay[len(moi_giay) // 2]
        print(f"  Thời gian: nhanh nhất {moi_giay[0]:.1f}s | trung vị {p50:.1f}s | chậm nhất {moi_giay[-1]:.1f}s")
        print("    (lượt đầu gồm cả thời gian nạp model — bỏ nó ra khi trích số vào báo cáo)")

    print(f"\nĐã ghi: {out / 'raw.json'}")
    print(f"        {out / 'auto_metrics.csv'}")
    print(f"\nTIẾP THEO — tầng 2 (bắt buộc, đây mới là số để trích vào báo cáo):")
    print(f"  1. Mở {out / 'labels.csv'}, đọc RUBRIC.md, điền cột 'nhan' cho từng dòng.")
    print(f"  2. Mở {out / 'missing.csv'}, đếm số yêu cầu trong tin mà AI BỎ SÓT.")
    print(f"  3. python score_rubric.py --tag {args.tag}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
