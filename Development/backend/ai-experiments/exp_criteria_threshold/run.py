"""
============================================================================
 ĐO NGƯỠNG KHỚP TIÊU CHÍ SOFT (docs 5.18)

 Câu hỏi: CriteriaMatchThreshold nên để bao nhiêu? Hiện appsettings.json để 0.5,
 mặc định trong code là 0.6 — cả hai đều là số áng chừng, chưa đo.

 Cách đo: lấy đúng model đang chạy thật (BAAI/bge-m3 qua AI service /embed),
 tính cosine similarity cho từng cặp (tiêu chí, đoạn CV) trong dataset.json,
 rồi quét ngưỡng và xem ngưỡng nào phân loại đúng nhất so với nhãn người gán.

 Similarity ở đây khớp production: SQL Server trả VECTOR_DISTANCE('cosine', ...)
 và CriteriaScoringService tính similarity = 1 - distance = cosine similarity.

 Chạy:
   cd ai-experiments/exp_criteria_threshold
   python run.py                 # AI service phải đang chạy ở 127.0.0.1:8000
   python run.py --url http://127.0.0.1:8001
============================================================================
"""

import argparse
import csv
import json
import math
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out"


def embed(text: str, base_url: str) -> list[float]:
    """Gọi AI service — cùng đường đi mà .NET dùng khi chấm CV thật."""
    body = json.dumps({"text": text}).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url}/embed", data=body, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))["vector"]


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return 0.0 if na == 0 or nb == 0 else dot / (na * nb)


def evaluate(sims: list[tuple[float, int]], threshold: float) -> dict:
    tp = sum(1 for s, y in sims if s >= threshold and y == 1)
    fp = sum(1 for s, y in sims if s >= threshold and y == 0)
    fn = sum(1 for s, y in sims if s < threshold and y == 1)
    tn = sum(1 for s, y in sims if s < threshold and y == 0)

    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    accuracy = (tp + tn) / len(sims) if sims else 0.0

    return {
        "threshold": round(threshold, 2),
        "TP": tp, "FP": fp, "FN": fn, "TN": tn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "accuracy": round(accuracy, 4),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8000")
    args = ap.parse_args()

    data = json.loads((HERE / "dataset.json").read_text(encoding="utf-8"))
    pairs = data["pairs"]
    print(f"[ ] {len(pairs)} cặp, {sum(p['label'] for p in pairs)} dương / "
          f"{sum(1 for p in pairs if p['label'] == 0)} âm")

    # Cache theo text: mỗi tiêu chí lặp lại 6 lần, khỏi embed thừa.
    cache: dict[str, list[float]] = {}

    def vec(text: str) -> list[float]:
        if text not in cache:
            cache[text] = embed(text, args.url)
        return cache[text]

    print("[ ] Đang tính embedding (bge-m3)...")
    rows = []
    for i, p in enumerate(pairs, 1):
        sim = cosine(vec(p["criterion"]), vec(p["text"]))
        rows.append({**p, "similarity": round(sim, 4)})
        if i % 12 == 0:
            print(f"    {i}/{len(pairs)}")

    OUT.mkdir(exist_ok=True)

    with (OUT / "pair_similarity.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["criterion", "text", "label", "similarity"])
        w.writeheader()
        w.writerows(rows)

    sims = [(r["similarity"], r["label"]) for r in rows]

    # Quét ngưỡng 0.30 -> 0.90.
    results = [evaluate(sims, t / 100) for t in range(30, 91, 2)]

    with (OUT / "threshold_sweep.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(results[0].keys()))
        w.writeheader()
        w.writerows(results)

    pos = [s for s, y in sims if y == 1]
    neg = [s for s, y in sims if y == 0]
    best = max(results, key=lambda r: (r["f1"], r["accuracy"]))

    print("\n=== PHÂN BỐ SIMILARITY ===")
    print(f"  Cặp ĐÚNG (label=1): min {min(pos):.3f} | trung bình {sum(pos)/len(pos):.3f} | max {max(pos):.3f}")
    print(f"  Cặp SAI  (label=0): min {min(neg):.3f} | trung bình {sum(neg)/len(neg):.3f} | max {max(neg):.3f}")

    print("\n=== QUÉT NGƯỠNG ===")
    print(f"{'ngưỡng':>7} {'precision':>10} {'recall':>8} {'F1':>8} {'accuracy':>9}  TP/FP/FN/TN")
    for r in results:
        star = "  <-- tốt nhất" if r["threshold"] == best["threshold"] else ""
        print(f"{r['threshold']:>7.2f} {r['precision']:>10.3f} {r['recall']:>8.3f} "
              f"{r['f1']:>8.3f} {r['accuracy']:>9.3f}  "
              f"{r['TP']}/{r['FP']}/{r['FN']}/{r['TN']}{star}")

    print(f"\n>>> Ngưỡng F1 cao nhất: {best['threshold']} "
          f"(F1={best['f1']}, precision={best['precision']}, recall={best['recall']})")
    for t in (0.5, 0.6):
        cur = next(r for r in results if r["threshold"] == t)
        print(f">>> Ngưỡng {t} hiện tại:   F1={cur['f1']}, precision={cur['precision']}, "
              f"recall={cur['recall']}, accuracy={cur['accuracy']}")

    print(f"\nĐã ghi: {OUT / 'pair_similarity.csv'}")
    print(f"        {OUT / 'threshold_sweep.csv'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
