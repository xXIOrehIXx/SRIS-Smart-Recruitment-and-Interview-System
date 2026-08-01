"""
============================================================
RUNNER — chạy 1 version pipeline trên bộ JD test, xuất kết quả (Bước 2-3)
------------------------------------------------------------
Dùng:
  python run.py v1_baseline                 # chạy full 12 JD
  python run.py v1_baseline --limit 1       # smoke test 1 JD (chạy nhanh)
  python run.py v1_baseline --num 8         # 8 câu / JD (mặc định 10)

Xuất ra  out/<version>/ :
  raw.json        — toàn bộ câu gen (đầy đủ, để truy vết)
  grading.csv     — câu gen theo đúng cột sheet Cham_diem, 5 cột rubric để TRỐNG
                    cho bạn chấm tay (mở bằng Excel, utf-8-sig nên không lỗi font).
  auto_metrics.csv— tầng đo tự động (16.2) cho version này.
Và in bảng tóm tắt ra màn hình.
============================================================
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from pathlib import Path

import metrics as M
from pipelines import VERSIONS

HERE = Path(__file__).resolve().parent
JD_FILE = HERE.parent / "files" / "jd_test_set.json"
OUT_ROOT = HERE / "out"

LETTERS = ["A", "B", "C", "D"]


def load_jds(limit: int | None) -> list[dict]:
    data = json.loads(JD_FILE.read_text(encoding="utf-8"))
    jds = data["jds"]
    return jds[:limit] if limit else jds


def question_cell(q) -> str:
    """Gộp câu hỏi + 4 đáp án + đánh dấu đáp án đúng vào 1 ô để dễ chấm."""
    lines = [q.question]
    for i, opt in enumerate(q.options):
        mark = "  ✓" if i == q.correct_index else ""
        lines.append(f"{LETTERS[i] if i < 4 else i}. {opt}{mark}")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("version", choices=list(VERSIONS))
    ap.add_argument("--limit", type=int, default=None, help="chỉ chạy N JD đầu (smoke test)")
    ap.add_argument("--num", type=int, default=10, help="số câu / JD")
    args = ap.parse_args()

    pipeline = VERSIONS[args.version]
    jds = load_jds(args.limit)
    out_dir = OUT_ROOT / args.version
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f">> Version: {args.version} | {len(jds)} JD | {args.num} câu/JD")
    results = []
    raw_dump = []
    stt = 0
    grading_rows = []

    for i, jd in enumerate(jds, 1):
        t0 = time.time()
        print(f"   [{i}/{len(jds)}] {jd['id']} ...", flush=True)
        res = pipeline(jd["jd_text"], args.num,
                       title=jd.get("title", ""), level=jd.get("level", ""))
        res.jd_id = jd["id"]
        dt = time.time() - t0
        print(f"        -> {len(res.questions)} câu, json_ok={res.json_ok}, {dt:.1f}s")
        results.append(res)

        raw_dump.append({
            "jd_id": jd["id"], "json_ok": res.json_ok, "error": res.error,
            "questions": [
                {"skill": q.skill, "question": q.question,
                 "options": q.options, "correct_index": q.correct_index}
                for q in res.questions
            ],
        })
        for q in res.questions:
            stt += 1
            grading_rows.append([
                stt, args.version, jd["id"], q.skill, question_cell(q),
                "", "", "", "", "",   # 5 cột rubric: Correctness Relevance Distractor TinhHuong RoRang
                "", "", "",           # Diem TB, Dat, Ghi chu
            ])

    # raw.json
    (out_dir / "raw.json").write_text(
        json.dumps(raw_dump, ensure_ascii=False, indent=2), encoding="utf-8")

    # grading.csv — đúng thứ tự cột sheet Cham_diem
    header = ["STT", "Version", "JD_id", "Skill", "Câu hỏi (đầy đủ)",
              "Correctness", "Relevance", "Distractor", "Tình huống", "Rõ ràng",
              "Điểm TB", "Đạt", "Ghi chú"]
    with (out_dir / "grading.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(grading_rows)

    # auto_metrics
    agg = M.aggregate(results)
    with (out_dir / "auto_metrics.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        for k, v in agg.items():
            w.writerow([k, v])

    print("\n===== TẦNG ĐO TỰ ĐỘNG (16.2) =====")
    print(f"  Tổng số câu gen         : {agg['total_questions']}")
    print(f"  JSON hợp lệ (theo JD)   : {agg['json_success_rate']}%")
    print(f"  Đúng cấu trúc           : {agg['pct_structural_ok']}%")
    print(f"  Không trùng             : {agg['pct_unique']}%")
    print(f"  Dạng tình huống (heur.) : {agg['pct_situational']}%")
    print(f"\n>> Đã ghi: {out_dir}\\grading.csv  (chấm rubric tay vào đây)")
    print(f">> Đã ghi: {out_dir}\\raw.json, auto_metrics.csv")
    return 0


if __name__ == "__main__":
    sys.exit(main())
