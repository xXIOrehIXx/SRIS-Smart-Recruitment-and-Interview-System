"""
============================================================================
 ĐO CHẤT LƯỢNG AI ĐỀ XUẤT TIÊU CHÍ (docs 5.18, §16)

 Câu hỏi: AI đề xuất tiêu chí từ tin tuyển dụng có dùng được không, và MỖI
 THÀNH PHẦN trong prompt đóng góp bao nhiêu vào kết quả đó?

 Chạy cùng một bộ 10 tin tuyển dụng qua 4 phiên bản prompt (xem prompts.py),
 mỗi bậc chỉ thêm một lớp, rồi so số. V4 là prompt production thật.

 Đo hai tầng, đúng khung Section 16:
   Tầng 1 (script này)      — máy tự tính, không cần người: xem metrics.py.
   Tầng 2 (score_rubric.py) — người đọc từng tiêu chí và gán nhãn theo RUBRIC.md,
                              ra precision / recall / F1. Đây mới là số để trích.

 Gọi thẳng Ollama (không qua AI service) vì thí nghiệm cần đổi prompt và bật/tắt
 ràng buộc JSON schema — hai thứ mà endpoint sản phẩm cố tình không cho đổi.
 Riêng V4 dùng ĐÚNG prompt + tham số production, import trực tiếp từ
 ai-service/criteria_extract.py, nên số của V4 vẫn là số của cái đang chạy thật.

 Chạy (dùng Python của venv ai-service để có sẵn ollama + pydantic):
   cd ai-experiments/exp_criteria_extract
   ../../ai-service/.venv/Scripts/python run.py --version v4 --repeat 2
   ../../ai-service/.venv/Scripts/python run.py --all --repeat 2
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
import re
import time
from pathlib import Path

import ollama

from metrics import do_mot_tin, do_on_dinh
from prompts import MODEL, NUM_CTX, THANG_DO, VERSIONS

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


# --- Đọc đầu ra của model -------------------------------------------------

_FENCE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.S)


def doc_ket_qua(raw_text: str) -> list | None:
    """
    Moi danh sách tên tiêu chí ra khỏi đầu ra thô. Trả None nếu KHÔNG đọc nổi.

    Cố ý DỄ DÃI hết mức: chấp nhận cả khối ```json bọc ngoài, cả list trần không
    có khóa "criteria", cả phần tử là chuỗi thay vì object, và vài biến thể tên
    khóa tiếng Việt. Dễ dãi là có chủ ý — bậc V1 (không ép schema) phải được
    chấm ở điều kiện thuận lợi nhất, nếu không thì con số "V1 tệ" chỉ phản ánh
    script khó tính chứ không phản ánh model.
    """
    if not raw_text or not raw_text.strip():
        return None

    text = raw_text.strip()
    if (m := _FENCE.search(text)):
        text = m.group(1).strip()
    else:
        # Model hay viết một câu dẫn rồi mới tới JSON — cắt từ dấu mở đầu tiên.
        i = min((p for p in (text.find("{"), text.find("[")) if p != -1), default=-1)
        if i > 0:
            text = text[i:]

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None

    items = data.get("criteria", data.get("tieu_chi")) if isinstance(data, dict) else data
    if not isinstance(items, list):
        return None

    names = []
    for it in items:
        if isinstance(it, str):
            names.append(it.strip())
        elif isinstance(it, dict):
            v = it.get("name") or it.get("ten") or it.get("tieu_chi") or it.get("criterion")
            if isinstance(v, str) and v.strip():
                names.append(v.strip())
    return names


def goi_model(text: str, prompt: str, dung_schema: bool) -> tuple:
    """
    Một lượt gọi model. Trả (tên tiêu chí, giây, json_ok, lỗi hoặc None).

    json_ok = đọc được kết quả ngay lần đầu, KHÔNG cần thử lại. Đây là chỉ số
    chính phân biệt V1 với V2: sản phẩm thật có retry 3 lượt, nhưng retry là
    thời gian chờ thật của người bấm nút, nên tỉ lệ hỏng ngay lượt đầu mới là
    thứ đáng đo.
    """
    kwargs = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt.format(jd_text=text.strip())}],
        "options": {"temperature": 0, "num_ctx": NUM_CTX},
    }
    if dung_schema:
        # Cùng ràng buộc mà sản phẩm dùng: model bị ép sinh đúng khuôn Pydantic.
        from criteria_extract import CriteriaList
        kwargs["format"] = CriteriaList.model_json_schema()

    t0 = time.perf_counter()
    try:
        resp = ollama.chat(**kwargs)
    except Exception as e:  # Ollama chưa chạy, model chưa pull, hết RAM...
        return [], time.perf_counter() - t0, False, f"{type(e).__name__}: {e}"

    giay = time.perf_counter() - t0
    names = doc_ket_qua(resp["message"]["content"])
    if names is None:
        return [], giay, False, "khong doc duoc JSON"
    return names, giay, True, None


def tong_hop(ver: str, raw: list, repeat: int, out: Path) -> dict:
    """
    Từ đầu ra thô -> bảng chỉ số + các phiếu chấm tay. Tách riêng khỏi phần gọi model
    để thêm một phép đo mới thì TÍNH LẠI ĐƯỢC trên dữ liệu cũ (--recompute), không
    phải chạy lại cả bộ. Chạy lại là đổi số của những version đã chốt, mà đổi số đã
    báo cáo thì không còn so được với nhau nữa.
    """
    mo_ta = VERSIONS[ver][2]
    rows = []
    for r in raw:
        m = do_mot_tin(r["cac_luot"][0])
        rows.append({
            "id": r["id"], "nganh": r["industry"],
            "so_tieu_chi": m["so_tieu_chi"],
            "so_giay_to": m["so_giay_to"], "giay_to_rate": m["giay_to_rate"],
            "so_gop": m["so_gop"], "gop_rate": m["gop_rate"],
            "so_nguong": m["so_nguong"], "nguong_rate": m["nguong_rate"],
            "trung_lap": m["trung_lap"], "qua_tran": m["qua_tran"],
            "json_ok": r["json_ok"],
            "on_dinh": round(do_on_dinh(r["cac_luot"]), 4),
            "giay_tb": round(sum(r["giay"]) / len(r["giay"]), 2),
            "loi": len(r["loi"]),
        })

    with (out / "auto_metrics.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    # Phiếu chấm tay cho tầng 2 — mỗi tiêu chí một dòng, cột nhan để TRỐNG cho người điền.
    # Chỉ ghi khi chưa có, để --recompute không xoá mất nhãn đã chấm.
    if not (out / "labels.csv").exists():
        with (out / "labels.csv").open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["id", "tieu_chi", "nhan", "ghi_chu"])
            for r in raw:
                for name in r["cac_luot"][0]:
                    w.writerow([r["id"], name, "", ""])

    # Tiêu chí AI BỎ SÓT thì không có dòng nào để gán nhãn -> phải đếm riêng, nếu
    # không thì recall vĩnh viễn bằng 1 và bộ số đo trông đẹp một cách vô nghĩa.
    if not (out / "missing.csv").exists():
        with (out / "missing.csv").open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["id", "so_bo_sot", "ghi_chu"])
            for r in raw:
                w.writerow([r["id"], "", ""])

    tong = sum(r["so_tieu_chi"] for r in rows)
    tong_luot = len(rows) * repeat
    tt = {
        "version": ver, "mo_ta": mo_ta,
        "tong_tieu_chi": tong,
        "json_ok_rate": round(sum(r["json_ok"] for r in rows) / tong_luot, 4),
        "giay_to_rate": round(sum(r["so_giay_to"] for r in rows) / tong, 4) if tong else 0.0,
        "gop_rate": round(sum(r["so_gop"] for r in rows) / tong, 4) if tong else 0.0,
        "nguong_rate": round(sum(r["so_nguong"] for r in rows) / tong, 4) if tong else 0.0,
        "trung_lap": sum(r["trung_lap"] for r in rows),
        "qua_tran": sum(r["qua_tran"] for r in rows),
        "on_dinh": round(sum(r["on_dinh"] for r in rows) / len(rows), 4),
        "giay_tb": round(sum(r["giay_tb"] for r in rows) / len(rows), 2),
    }

    print(f"\n  Tổng tiêu chí   : {tt['tong_tieu_chi']} ({tong / len(rows):.1f}/tin)")
    print(f"  JSON hợp lệ     : {tt['json_ok_rate'] * 100:.1f}%  (lượt đầu, không retry)")
    print(f"  Là giấy tờ      : {tt['giay_to_rate'] * 100:.1f}%")
    print(f"  Gộp nhiều kỹ năng: {tt['gop_rate'] * 100:.1f}%")
    print(f"  Dạng ngưỡng     : {tt['nguong_rate'] * 100:.1f}%")
    print(f"  Trùng lặp / vượt trần: {tt['trung_lap']} / {tt['qua_tran']}")
    print(f"  Độ ổn định      : {tt['on_dinh']:.3f}")
    print(f"  Thời gian TB    : {tt['giay_tb']:.1f}s/tin")
    return tt


def tinh_lai(ver: str) -> dict:
    """Tính lại chỉ số cho một version đã chạy, đọc từ out/<ver>/raw.json."""
    out = HERE / "out" / ver
    raw = json.loads((out / "raw.json").read_text(encoding="utf-8"))
    repeat = raw[0].get("so_luot", len(raw[0]["cac_luot"]))
    print(f"\n{'=' * 74}\n {ver.upper()} — {VERSIONS[ver][2]}   [tính lại từ dữ liệu cũ]\n{'=' * 74}")
    return tong_hop(ver, raw, repeat, out)


def chay_mot_version(ver: str, jobs: list, repeat: int) -> dict:
    """Chạy trọn bộ test cho một phiên bản prompt, ghi ra out/<ver>/."""
    prompt, dung_schema, mo_ta = VERSIONS[ver]
    out = HERE / "out" / ver
    out.mkdir(parents=True, exist_ok=True)

    print(f"\n{'=' * 74}\n {ver.upper()} — {mo_ta}\n{'=' * 74}")

    raw, rows = [], []
    for job in jobs:
        text = ghep_van_ban(job)
        cac_luot, cac_giay, cac_loi, so_json_ok = [], [], [], 0

        for lan in range(repeat):
            names, giay, json_ok, loi = goi_model(text, prompt, dung_schema)
            cac_luot.append(names)
            cac_giay.append(giay)
            so_json_ok += int(json_ok)
            if loi:
                cac_loi.append(loi)
            # flush=True: một lượt chạy đầy đủ mất hàng chục phút. Không flush thì Python
            # gom buffer khi output bị chuyển hướng ra file, và người chạy ngồi nhìn màn
            # hình trống không biết nó còn sống hay đã treo.
            print(f"    {job['id']:<20} lượt {lan + 1}/{repeat}  "
                  f"{len(names):>2} tiêu chí  {giay:>6.1f}s"
                  + ("" if json_ok else f"  HỎNG: {loi[:50]}"), flush=True)

        # Lượt 1 là lượt đem đi chấm tay — chọn cố định chứ không chọn lượt "đẹp nhất",
        # vì chọn lượt đẹp là tự chấm điểm cho mình.
        raw.append({
            "id": job["id"], "title": job["title"], "industry": job["industry"],
            "expect": job.get("expect", ""),
            "source_text": text,
            "cac_luot": cac_luot,
            "giay": [round(g, 2) for g in cac_giay],
            "json_ok": so_json_ok, "so_luot": repeat,
            "loi": cac_loi,
        })

    (out / "raw.json").write_text(
        json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
    return tong_hop(ver, raw, repeat, out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", nargs="+", choices=list(VERSIONS), help="chạy các phiên bản này")
    ap.add_argument("--all", action="store_true",
                    help="chạy cả 5 bậc của thang đo (không gồm bản đối chứng), rồi in bảng so")
    ap.add_argument("--repeat", type=int, default=2, help="số lượt/tin (>=2 mới đo được độ ổn định)")
    ap.add_argument("--recompute", action="store_true",
                    help="KHÔNG gọi model — tính lại chỉ số từ out/<ver>/raw.json đã có")
    args = ap.parse_args()

    if not args.version and not args.all:
        ap.error("chọn --version <v1 v2 ...> hoặc --all")

    cac_ver = list(THANG_DO) if args.all else args.version

    if args.recompute:
        co = [v for v in cac_ver if (HERE / "out" / v / "raw.json").exists()]
        if thieu := [v for v in cac_ver if v not in co]:
            print(f"[!] Bỏ qua (chưa có raw.json): {', '.join(thieu)}")
        tong_ket = [tinh_lai(v) for v in co]
    else:
        jobs = json.loads((HERE / "dataset.json").read_text(encoding="utf-8"))["jobs"]
        print(f"[ ] {len(jobs)} tin x {args.repeat} lượt x {len(cac_ver)} phiên bản "
              f"= {len(jobs) * args.repeat * len(cac_ver)} lượt gọi model ({MODEL})")
        print("[ ] Lượt đầu tiên chậm hơn hẳn (Ollama nạp model vào bộ nhớ).")
        tong_ket = [chay_mot_version(v, jobs, args.repeat) for v in cac_ver]

    if len(tong_ket) > 1:
        (HERE / "out" / "so_sanh_version.csv").write_text(
            "\n".join(
                [",".join(tong_ket[0].keys())]
                + [",".join(str(v) for v in t.values()) for t in tong_ket]
            ),
            encoding="utf-8-sig",
        )
        print(f"\n{'=' * 78}\n BẢNG SO {len(tong_ket)} PHIÊN BẢN — tầng máy\n{'=' * 78}")
        print(f"{'ver':<5}{'tiêu chí':>10}{'JSON ok':>10}{'giấy tờ':>10}"
              f"{'ngưỡng':>9}{'gộp':>8}{'ổn định':>10}{'giây/tin':>10}")
        for t in tong_ket:
            print(f"{t['version']:<5}{t['tong_tieu_chi']:>10}"
                  f"{t['json_ok_rate'] * 100:>9.1f}%{t['giay_to_rate'] * 100:>9.1f}%"
                  f"{t['nguong_rate'] * 100:>8.1f}%{t['gop_rate'] * 100:>7.1f}%"
                  f"{t['on_dinh']:>10.3f}{t['giay_tb']:>10.1f}")
        print(f"\nĐã ghi: {HERE / 'out' / 'so_sanh_version.csv'}")

    print("\nTIẾP THEO — tầng 2 (đây mới là số precision/recall/F1 để trích vào báo cáo):")
    for v in cac_ver:
        print(f"  out/{v}/labels.csv   → điền cột 'nhan' theo RUBRIC.md")
        print(f"  out/{v}/missing.csv  → đếm yêu cầu trong tin mà AI BỎ SÓT")
    print(f"  rồi chạy: python score_rubric.py --tag <ver>")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
