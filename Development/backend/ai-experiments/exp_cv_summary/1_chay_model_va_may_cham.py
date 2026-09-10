"""
============================================================================
 BƯỚC 1 — gọi model 4 bậc prompt, ghi đầu ra thô, đo tầng máy, sinh phiếu chấm tay.

 Chạy:
   ..\\..\\ai-service\\.venv\\Scripts\\python.exe 1_chay_model_va_may_cham.py --all --repeat 2
   ..\\..\\ai-service\\.venv\\Scripts\\python.exe 1_chay_model_va_may_cham.py --version v4 --repeat 2
   ..\\..\\ai-service\\.venv\\Scripts\\python.exe 1_chay_model_va_may_cham.py --all --recompute

 --recompute: tính lại phép đo từ raw.json đã có, KHÔNG gọi model. Dùng khi thêm
 phép đo mới vào may_cham.py — số cũ vẫn so được vì đầu ra model không đổi.

 NGUYÊN TẮC: LƯỢT 1 LÀ LƯỢT ĐEM ĐI CHẤM. Lượt 2 chỉ để đo độ ổn định. Chọn lượt
 "đẹp hơn" để chấm là tự chấm điểm cho mình.
============================================================================
"""

import argparse
import csv
import json
import time
from pathlib import Path

import ollama
from pydantic import ValidationError

import may_cham
from prompts import MODEL, NUM_CTX, VERSIONS, _LlmDraft, dung_prompt

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"
DATASET = json.loads((ROOT / "dataset.json").read_text(encoding="utf-8"))["cases"]

MAX_RETRY = 3


def _chat(prompt: str, dung_schema: bool) -> str:
    """
    Gọi Ollama. `dung_schema=False` (chỉ V1) là chỗ khác biệt duy nhất giữa V1 và V2 —
    cùng câu chữ, khác mỗi việc có ép `format` hay không.

    think=False: qwen3 mặc định sinh khối <think> dài trước khi trả lời. Giống hệt
    ai-service, và phải giống thì thời gian đo mới nói được điều gì về sản phẩm.
    """
    kwargs = dict(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        options={"temperature": 0, "num_ctx": NUM_CTX},
    )
    if dung_schema:
        kwargs["format"] = _LlmDraft.model_json_schema()
    try:
        return ollama.chat(think=False, **kwargs)["message"]["content"]
    except (ollama.ResponseError, TypeError):
        return ollama.chat(**kwargs)["message"]["content"]


def _boc_summary(raw: str) -> tuple[str, bool]:
    """
    Lấy trường summary ra khỏi đầu ra model. Trả (summary, json_hop_le_ngay_luot_dau).

    V1 không bị ép schema nên hay bọc JSON trong ```json ... ``` hoặc kèm câu dẫn.
    Gỡ được thì vẫn tính là 'không hợp lệ ngay lượt đầu' — vì trong sản phẩm thật
    Pydantic sẽ ném lỗi và service phải gọi lại, đó chính là cái giá phải đo.
    """
    try:
        return json.loads(raw)["summary"], True
    except (json.JSONDecodeError, KeyError, TypeError):
        pass

    i, j = raw.find("{"), raw.rfind("}")
    if i != -1 and j > i:
        try:
            d = json.loads(raw[i : j + 1])
            if isinstance(d.get("summary"), str):
                return d["summary"], False
        except json.JSONDecodeError:
            pass
    return raw.strip(), False


def chay_mot_bac(ver: str, repeat: int, recompute: bool) -> None:
    thu_muc = OUT / ver
    thu_muc.mkdir(parents=True, exist_ok=True)
    raw_path = thu_muc / "raw.json"

    if recompute:
        if not raw_path.exists():
            print(f"   [{ver}] chưa có raw.json -> bỏ qua --recompute")
            return
        ket_qua = json.loads(raw_path.read_text(encoding="utf-8"))
        print(f"   [{ver}] tính lại từ raw.json ({len(ket_qua)} tin), không gọi model")
    else:
        ket_qua = []
        for case in DATASET:
            prompt = dung_prompt(ver, case["jd"], case["cv"])
            luot = []
            for lan in range(repeat):
                t0 = time.perf_counter()
                raw, loi = "", None
                for _ in range(MAX_RETRY):
                    try:
                        raw = _chat(prompt, VERSIONS[ver]["schema"])
                        break
                    except Exception as e:  # noqa: BLE001 - ghi lại rồi chạy tiếp
                        loi = e
                giay = round(time.perf_counter() - t0, 2)
                summary, hop_le = _boc_summary(raw) if raw else ("", False)
                luot.append(
                    {
                        "summary": summary,
                        "json_hop_le": hop_le,
                        "giay": giay,
                        "loi": str(loi) if loi else None,
                        "raw": raw,
                    }
                )
                print(f"   [{ver}] {case['id']} lượt {lan + 1}: {giay}s, {len(summary)} ký tự")
            ket_qua.append({"id": case["id"], "luot": luot})
        raw_path.write_text(
            json.dumps(ket_qua, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    _do_va_ghi(ver, ket_qua, thu_muc)


def _do_va_ghi(ver: str, ket_qua: list, thu_muc: Path) -> None:
    theo_tin = []
    for case, kq in zip(DATASET, ket_qua):
        luot = kq["luot"]
        # LƯỢT 1 là lượt đem đi chấm — xem đầu file.
        s1 = luot[0]["summary"]
        do = may_cham.do_mot_ban(s1, case["cv"], case["moc_phai_co"])
        do["id"] = case["id"]
        do["json_hop_le"] = luot[0]["json_hop_le"]
        do["giay"] = luot[0]["giay"]
        do["on_dinh"] = (
            round(may_cham.on_dinh(s1, luot[1]["summary"]), 3) if len(luot) > 1 else None
        )
        theo_tin.append(do)

    cols = [
        "id", "json_hop_le", "so_cau", "dung_khuon_3_5_cau", "so_luong_so_la",
        "so_la", "ti_le_sao_rong", "nhac_dinh_dang", "so_moc_thieu",
        "so_moc_phai_co", "so_ky_tu", "on_dinh", "giay",
    ]
    with (thu_muc / "may_cham.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for r in theo_tin:
            w.writerow(["; ".join(r[c]) if isinstance(r.get(c), list) else r.get(c, "") for c in cols])

    _ghi_phieu_cham_tay(ver, ket_qua, thu_muc)
    print(f"   [{ver}] -> {thu_muc / 'may_cham.csv'}")


def _ghi_phieu_cham_tay(ver: str, ket_qua: list, thu_muc: Path) -> None:
    """
    Sinh phiếu chấm tay CÒN TRỐNG: mỗi CÂU trong bản tóm tắt là một dòng cần gán nhãn.

    Đơn vị chấm là CÂU chứ không phải cả bản tóm tắt: một bản 4 câu thường có 3 câu
    đúng và 1 câu bịa: chấm cả bản thành "sai" thì mất thông tin, chấm thành "đúng"
    thì giấu mất lỗi. Chấm theo câu ra được precision đúng nghĩa.
    """
    with (thu_muc / "nguoi_cham_tung_cau.csv").open(
        "w", newline="", encoding="utf-8-sig"
    ) as f:
        w = csv.writer(f)
        w.writerow(["id_tin", "stt_cau", "cau", "nhan", "ghi_chu"])
        for case, kq in zip(DATASET, ket_qua):
            for i, cau in enumerate(may_cham.tach_cau(kq["luot"][0]["summary"]), 1):
                w.writerow([case["id"], i, cau, "", ""])

    with (thu_muc / "nguoi_cham_bo_sot.csv").open(
        "w", newline="", encoding="utf-8-sig"
    ) as f:
        w = csv.writer(f)
        w.writerow(["id_tin", "so_moc_phai_co", "so_moc_bi_bo_sot", "ghi_chu"])
        for case in DATASET:
            w.writerow([case["id"], len(case["moc_phai_co"]), "", ""])


def gop_4_ban() -> None:
    """Bảng so 4 bậc — file để vẽ biểu đồ trong báo cáo."""
    dong = []
    for ver in ["v1", "v2", "v3", "v4"]:
        p = OUT / ver / "may_cham.csv"
        if not p.exists():
            continue
        with p.open(encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))
        if not rows:
            continue
        n = len(rows)

        def fl(c):
            return [float(r[c]) for r in rows if r[c] not in ("", "None")]

        dong.append(
            {
                "ver": ver.upper(),
                "ten": VERSIONS[ver]["ten"],
                "so_tin": n,
                "json_hop_le_%": round(
                    100 * sum(r["json_hop_le"] == "True" for r in rows) / n, 1
                ),
                "dung_khuon_3_5_cau_%": round(
                    100 * sum(r["dung_khuon_3_5_cau"] == "True" for r in rows) / n, 1
                ),
                "tin_co_so_la": sum(int(r["so_luong_so_la"]) > 0 for r in rows),
                "tong_so_la": sum(int(r["so_luong_so_la"]) for r in rows),
                "ti_le_sao_rong_tb": round(sum(fl("ti_le_sao_rong")) / n, 3),
                "tin_nhac_dinh_dang": sum(r["nhac_dinh_dang"] == "True" for r in rows),
                "moc_bo_sot_%": round(
                    100
                    * sum(int(r["so_moc_thieu"]) for r in rows)
                    / max(1, sum(int(r["so_moc_phai_co"]) for r in rows)),
                    1,
                ),
                "so_cau_tb": round(sum(fl("so_cau")) / n, 1),
                "on_dinh_tb": round(sum(fl("on_dinh")) / max(1, len(fl("on_dinh"))), 3),
                "giay_tb": round(sum(fl("giay")) / n, 1),
            }
        )

    if not dong:
        return
    with (OUT / "may_cham_4_ban.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(dong[0].keys()))
        w.writeheader()
        w.writerows(dong)
    print(f"\n-> {OUT / 'may_cham_4_ban.csv'}")
    for d in dong:
        print(
            f"   {d['ver']}: JSON {d['json_hop_le_%']}% · khuôn 3-5 câu {d['dung_khuon_3_5_cau_%']}%"
            f" · tin có số lạ {d['tin_co_so_la']}/{d['so_tin']} · sáo rỗng {d['ti_le_sao_rong_tb']}"
            f" · bỏ sót mốc {d['moc_bo_sot_%']}% · ổn định {d['on_dinh_tb']} · {d['giay_tb']}s"
        )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", choices=list(VERSIONS))
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--repeat", type=int, default=2)
    ap.add_argument("--recompute", action="store_true")
    a = ap.parse_args()

    vers = list(VERSIONS) if a.all else ([a.version] if a.version else ["v4"])
    print(f"Model: {MODEL} · num_ctx={NUM_CTX} · {len(DATASET)} CV · bậc: {', '.join(vers)}")
    if not a.recompute:
        print("Lượt gọi ĐẦU TIÊN chậm hơn hẳn vì Ollama nạp model — đừng đưa số đó vào báo cáo.\n")

    for v in vers:
        print(f"=== {VERSIONS[v]['ten']} ===")
        chay_mot_bac(v, a.repeat, a.recompute)
    gop_4_ban()


if __name__ == "__main__":
    main()
