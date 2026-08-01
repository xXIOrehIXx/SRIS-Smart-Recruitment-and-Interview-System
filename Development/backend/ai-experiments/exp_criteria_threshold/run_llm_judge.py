"""
============================================================================
 ĐỐI CHỨNG: để LLM phán "đoạn CV này có chứng minh tiêu chí không?"

 Lý do có script này: run.py cho thấy cosine similarity KHÔNG tách được cặp
 đúng khỏi cặp sai (hai phân bố chồng lên nhau gần như hoàn toàn), nên không
 ngưỡng nào cứu được. Cần biết: vấn đề nằm ở NGƯỠNG hay ở CÁCH TIẾP CẬN?

 Script này chạy cùng 72 cặp qua Local LLM (Ollama, cùng model đang dùng để bóc
 tiêu chí) và đo lại bằng đúng thước đo. So hai con số sẽ biết nên đi hướng nào.

 Chạy:
   python run_llm_judge.py            # cần Ollama chạy sẵn
============================================================================
"""

import csv
import json
import os
from pathlib import Path

import ollama

HERE = Path(__file__).parent
OUT = HERE / "out"
MODEL = os.environ.get("SRIS_LLM_MODEL", "qwen2.5")

PROMPT = """Bạn là chuyên viên tuyển dụng đang sàng lọc CV.

TIÊU CHÍ CẦN ĐÁNH GIÁ:
{criterion}

ĐOẠN TRÍCH TỪ CV ỨNG VIÊN:
{text}

Hỏi: đoạn trích trên có CHỨNG MINH được ứng viên đạt tiêu chí này không?

QUY TẮC:
- "CO" chỉ khi đoạn trích cho thấy ứng viên ĐÃ THỰC SỰ LÀM/CÓ năng lực đó.
- "KHONG" nếu chỉ liên quan tới cùng lĩnh vực nhưng không chứng minh được năng lực
  (ví dụ: mới học ở trường, mới hỗ trợ người khác làm, mới có nguyện vọng, làm việc
  ở mức đơn giản hơn hẳn yêu cầu).
- Chỉ dựa vào đoạn trích, không suy diễn thêm.

Trả lời DUY NHẤT một từ: CO hoặc KHONG"""


def judge(criterion: str, text: str) -> int:
    resp = ollama.chat(
        model=MODEL,
        messages=[{"role": "user", "content": PROMPT.format(criterion=criterion, text=text)}],
        options={"temperature": 0},
    )
    answer = resp["message"]["content"].strip().upper()
    return 1 if answer.startswith("CO") else 0


def main() -> int:
    data = json.loads((HERE / "dataset.json").read_text(encoding="utf-8"))
    pairs = data["pairs"]
    print(f"[ ] {len(pairs)} cặp qua LLM ({MODEL})...")

    rows = []
    for i, p in enumerate(pairs, 1):
        pred = judge(p["criterion"], p["text"])
        rows.append({**p, "predicted": pred})
        if i % 12 == 0:
            print(f"    {i}/{len(pairs)}")

    tp = sum(1 for r in rows if r["predicted"] == 1 and r["label"] == 1)
    fp = sum(1 for r in rows if r["predicted"] == 1 and r["label"] == 0)
    fn = sum(1 for r in rows if r["predicted"] == 0 and r["label"] == 1)
    tn = sum(1 for r in rows if r["predicted"] == 0 and r["label"] == 0)

    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    accuracy = (tp + tn) / len(rows)

    OUT.mkdir(exist_ok=True)
    with (OUT / "llm_judge.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["criterion", "text", "label", "predicted"])
        w.writeheader()
        w.writerows(rows)

    print("\n=== LLM LÀM GIÁM KHẢO ===")
    print(f"  TP/FP/FN/TN = {tp}/{fp}/{fn}/{tn}")
    print(f"  precision = {precision:.3f}")
    print(f"  recall    = {recall:.3f}")
    print(f"  F1        = {f1:.3f}")
    print(f"  accuracy  = {accuracy:.3f}")
    print(f"\nĐã ghi: {OUT / 'llm_judge.csv'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
