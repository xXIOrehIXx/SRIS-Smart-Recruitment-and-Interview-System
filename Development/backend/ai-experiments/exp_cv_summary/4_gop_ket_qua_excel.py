"""
============================================================================
 BƯỚC 4 — GỘP MỌI SỐ ĐO VÀO MỘT FILE EXCEL

 Đọc: out/may_cham_4_ban.csv (tầng máy)
      out/<ver>/may_cham.csv, nguoi_cham_tong_ket.csv, nguoi_cham_tung_cau.csv,
      nguoi_cham_bo_sot.csv (tầng người)
 -> out/KET_QUA_TONG_HOP.xlsx

 Năm tab:
   1. DocTruoc  — ai chấm cái gì, mã nhãn, ngưỡng, và ranh giới của phép đo
   2. TongHop   — mỗi bậc một dòng, tầng máy và tầng người cạnh nhau
   3. TheoTin   — 10 CV x 4 bậc, xem CV nào kéo tụt chỉ số
   4. NguoiCham_TungCau — phiếu chấm tay bê nguyên
   5. NguoiCham_BoSot   — mốc bị bỏ sót

 Tầng người chưa chấm thì các ô đó để trống — file vẫn dựng được, vì tầng máy
 tự nó đã là một bộ số đọc được.

 Chạy:  ..\\..\\ai-service\\.venv\\Scripts\\python.exe 4_gop_ket_qua_excel.py
============================================================================
"""

import csv
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = Path(__file__).parent
OUT = HERE / "out"
VERS = ["v1", "v2", "v3", "v4"]

MO_TA_VER = {
    "v1": "Bảo tóm tắt, hết — không luật, không ép JSON",
    "v2": "+ Ràng buộc JSON schema (Pydantic) & temperature=0",
    "v3": "+ Luật chống bịa (chỉ dùng chữ trong CV, không suy diễn)",
    "v4": "+ Luật riêng của bản tóm tắt (3-5 câu, cấm tự cộng số năm, cấm chung chung) = PROMPT THẬT",
}

DAM = Font(bold=True)
NEN = PatternFill("solid", fgColor="DDEBF7")
NEN_V4 = PatternFill("solid", fgColor="E2EFDA")


def _doc(p: Path) -> list[dict]:
    if not p.exists():
        return []
    with p.open(encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def _rong(ws, tran=60) -> None:
    for col in ws.columns:
        n = max((len(str(c.value)) for c in col if c.value is not None), default=8)
        ws.column_dimensions[get_column_letter(col[0].column)].width = min(tran, max(10, n + 2))


def _bang(ws, tieu_de: list[str], dong: list[list]) -> None:
    ws.append(tieu_de)
    for c in ws[ws.max_row]:
        c.font, c.fill, c.alignment = DAM, NEN, Alignment(wrap_text=True, vertical="top")
    for d in dong:
        ws.append(d)


def tab_doc_truoc(wb: Workbook) -> None:
    ws = wb.create_sheet("DocTruoc")
    for dong in [
        ["THÍ NGHIỆM: chất lượng bản TÓM TẮT CV của lượt sàng lọc CV (/screen-cv)"],
        [],
        ["Đây là thí nghiệm BÓC LỚP (ablation), KHÔNG phải nhật ký cải tiến prompt."],
        ["V4 là prompt đang chạy thật; V1/V2/V3 là bản rút gọn của chính nó, dựng ra để đo"],
        ["'bỏ lớp này đi thì tệ hơn bao nhiêu'. V1-V3 CHƯA TỪNG chạy trong sản phẩm."],
        [],
        ["HAI TẦNG ĐO — ai làm việc gì"],
        ["Tầng máy", "Script tự chạy", "JSON hợp lệ · số câu · SỐ LẠ (con số không có trong CV) · tỉ lệ sáo rỗng · ổn định · giây"],
        ["Tầng người", "Người ngồi chấm tay", "Precision / Recall / F1 · sai kiểu gì"],
        ["", "", "Máy KHÔNG biết bản tóm tắt có đúng không. Precision/Recall chỉ ra được từ tầng người."],
        ["", "", "Nhãn phải do NGƯỜI gán: nhờ mô hình chấm đầu ra của mô hình là lập luận vòng tròn."],
        [],
        ["NĂM MÃ NHÃN (đầy đủ + ranh giới khi phân vân: LUAT_NGUOI_CHAM.md)"],
        ["DUNG", "Kể lại đúng một thông tin có thật trong CV", "-> TP"],
        ["BIA", "Thông tin không hề có trong CV", "-> FP"],
        ["SUYDIEN", "Có neo trong CV nhưng model suy ra thêm", "-> FP"],
        ["SAISO", "Con số / mốc thời gian sai hoặc tự tính ra", "-> FP"],
        ["SAORONG", "Câu khen chung chung, gắn sang CV khác vẫn đúng", "-> FP"],
        [],
        ["NGƯỠNG (chốt TRƯỚC khi đo — nguồn: AI_TESTING_REFERENCE.md)"],
        ["Precision / Recall / F1", ">= 0.85 Tốt", "0.70-0.84 Chấp nhận được", "< 0.70 Cần cải thiện"],
        ["Tỉ lệ BIA + SAISO", "0% Tốt", "<= 5% Chấp nhận được", "> 5% Cần cải thiện"],
        ["Tỉ lệ SAORONG", "<= 5% Tốt", "<= 15% Chấp nhận được", "> 15% Cần cải thiện"],
        [],
        ["HẠN CHẾ PHẢI GHI TRONG BÁO CÁO"],
        ["", "CV do người làm đề tài soạn, không phải hồ sơ thật (dữ liệu cá nhân + cần cài ca bẫy có đáp án)"],
        ["", "10 CV là ít; một người gán nhãn"],
        ["", "FN đếm theo MỐC còn TP đếm theo CÂU -> recall không cùng đơn vị, chỉ dùng để SO GIỮA CÁC BẬC"],
        ["", "Thời gian đo trên GPU (RTX 5060), không phải CPU như máy demo"],
    ]:
        ws.append(dong)
    ws["A1"].font = Font(bold=True, size=13)
    for r in (7, 13, 20, 25):
        ws.cell(row=r, column=1).font = DAM
    _rong(ws, tran=95)


def tab_tong_hop(wb: Workbook) -> None:
    ws = wb.create_sheet("TongHop")
    may = {r["ver"].lower(): r for r in _doc(OUT / "may_cham_4_ban.csv")}
    nguoi = {v: (_doc(OUT / v / "nguoi_cham_tong_ket.csv") or [{}])[0] for v in VERS}

    _bang(
        ws,
        ["Bậc", "Thêm gì so với bậc dưới",
         "JSON hợp lệ %", "Đúng khuôn 3-5 câu %", "CV có số lạ", "Tổng số lạ",
         "Tỉ lệ sáo rỗng", "CV bị chê định dạng", "Bỏ sót mốc %", "Ổn định", "Giây/CV",
         "Precision", "Recall", "F1", "BIA+SAISO", "SAORONG"],
        [
            [
                v.upper(), MO_TA_VER[v],
                may.get(v, {}).get("json_hop_le_%", ""),
                may.get(v, {}).get("dung_khuon_3_5_cau_%", ""),
                may.get(v, {}).get("tin_co_so_la", ""),
                may.get(v, {}).get("tong_so_la", ""),
                may.get(v, {}).get("ti_le_sao_rong_tb", ""),
                may.get(v, {}).get("tin_nhac_dinh_dang", ""),
                may.get(v, {}).get("moc_bo_sot_%", ""),
                may.get(v, {}).get("on_dinh_tb", ""),
                may.get(v, {}).get("giay_tb", ""),
                nguoi[v].get("precision", ""),
                nguoi[v].get("recall", ""),
                nguoi[v].get("f1", ""),
                nguoi[v].get("ti_le_bia_saiso", ""),
                nguoi[v].get("ti_le_saorong", ""),
            ]
            for v in VERS
        ],
    )
    for c in ws[ws.max_row]:
        c.fill = NEN_V4  # V4 = bản đang chạy thật
    ws.append([])
    ws.append(["Cột Precision/Recall/F1 trống = tầng người chưa chấm (xem tab DocTruoc)."])
    _rong(ws, tran=70)


def tab_theo_tin(wb: Workbook) -> None:
    ws = wb.create_sheet("TheoTin")
    tieu_de = ["Mã CV"]
    for v in VERS:
        tieu_de += [f"{v.upper()} câu", f"{v.upper()} số lạ", f"{v.upper()} sáo rỗng", f"{v.upper()} sót mốc"]

    theo = {v: {r["id"]: r for r in _doc(OUT / v / "may_cham.csv")} for v in VERS}
    ids = sorted({i for v in VERS for i in theo[v]})
    dong = []
    for i in ids:
        d = [i]
        for v in VERS:
            r = theo[v].get(i, {})
            d += [r.get("so_cau", ""), r.get("so_la", ""), r.get("ti_le_sao_rong", ""), r.get("so_moc_thieu", "")]
        dong.append(d)
    _bang(ws, tieu_de, dong)
    _rong(ws, tran=32)


def tab_cham_tay(wb: Workbook) -> None:
    ws = wb.create_sheet("NguoiCham_TungCau")
    _bang(ws, ["Bậc", "Mã CV", "STT câu", "Câu", "Nhãn", "Ghi chú"],
          [[v.upper(), r["id_tin"], r["stt_cau"], r["cau"], r.get("nhan", ""), r.get("ghi_chu", "")]
           for v in VERS for r in _doc(OUT / v / "nguoi_cham_tung_cau.csv")])
    ws.column_dimensions["D"].width = 100
    for row in ws.iter_rows(min_row=2, min_col=4, max_col=4):
        row[0].alignment = Alignment(wrap_text=True, vertical="top")
    for col, w in [("A", 8), ("B", 26), ("C", 9), ("E", 11), ("F", 40)]:
        ws.column_dimensions[col].width = w

    ws2 = wb.create_sheet("NguoiCham_BoSot")
    _bang(ws2, ["Bậc", "Mã CV", "Số mốc phải có", "Số mốc bị bỏ sót", "Ghi chú"],
          [[v.upper(), r["id_tin"], r["so_moc_phai_co"], r.get("so_moc_bi_bo_sot", ""), r.get("ghi_chu", "")]
           for v in VERS for r in _doc(OUT / v / "nguoi_cham_bo_sot.csv")])
    _rong(ws2, tran=40)


def main() -> int:
    wb = Workbook()
    wb.remove(wb.active)
    tab_doc_truoc(wb)
    tab_tong_hop(wb)
    tab_theo_tin(wb)
    tab_cham_tay(wb)

    p = OUT / "KET_QUA_TONG_HOP.xlsx"
    wb.save(p)
    print(f"-> {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
