# Thí nghiệm đánh giá AI

**Đây KHÔNG phải code chạy trong sản phẩm.** Không có gì ở đây được `GP35.SRIS.sln`
tham chiếu tới — xoá đi thì hệ thống vẫn build và chạy bình thường.

Thư mục này giữ **bằng chứng cho phương pháp đánh giá AI** (khung Section 16 trong
`docs/00_CONTEXT.md`) và trả lời hai câu:

1. **AI bóc tiêu chí từ tin tuyển dụng có dùng được không?** Dùng được tới mức nào?
2. **Mỗi thành phần trong prompt đóng góp bao nhiêu?** Bỏ nó đi thì tệ hơn bao nhiêu?

Chỉ có **một** thí nghiệm — `exp_criteria_extract/` — vì AI trong sản phẩm chỉ còn làm
đúng một việc.

---

## 1. Hai tầng đo — ai làm việc gì

Đây là chỗ dễ nhầm nhất, nên nói trước.

| | Ai làm | Đo được gì | Đo KHÔNG được gì |
|---|---|---|---|
| **Tầng máy** | Script tự chạy | JSON có hợp lệ không · bao nhiêu tiêu chí · bao nhiêu dòng là "giấy tờ" · chạy lại có ra giống không · nhanh chậm | **Tiêu chí có ĐÚNG không** |
| **Tầng người** | **Bạn ngồi chấm tay** | Precision / Recall / F1 · sai kiểu gì | — |

Vì sao phải có tầng người: máy đếm được dòng nào chứa chữ "bằng cấp", nhưng máy **không biết**
dòng *"Kỹ năng đàm phán"* là tiêu chí tốt còn *"Báo cáo doanh số hàng tuần"* là đầu việc.
Phải có người đọc mới phán được.

> **Số để trích vào báo cáo là số tầng người.** Tầng máy dùng để **so giữa các phiên bản**,
> vì cùng một sai số xuất hiện ở cả hai bên nên không làm lệch kết luận.

---

## 2. Bốn phiên bản prompt

Mỗi bậc thêm **đúng một lớp** so với bậc dưới. Có vậy chênh lệch số đo mới quy được cho
một nguyên nhân duy nhất.

| Ver | Thêm gì | Câu hỏi nó trả lời |
|---|---|---|
| **V1** | Câu lệnh trần. Không luật, không ví dụ, **không ép định dạng JSON** | Ném mỗi tin tuyển dụng cho model thì được gì? |
| **V2** | **+ Ràng buộc JSON schema** (Pydantic) & `temperature=0`. Câu chữ giữ nguyên V1 | Ép khuôn đầu ra thì được gì? |
| **V3** | **+ Luật nghiệp vụ**: yêu cầu vs đầu việc · bỏ thứ đọc hồ sơ là biết · tách kỹ năng · trần 10 | Dạy luật có giảm được tiêu chí rác không? |
| **V4** | **+ Khối ví dụ mẫu** (few-shot) = **prompt đang chạy thật** | Cho ví dụ cụ thể có hơn nói luật suông không? |

### ⚠️ Gọi đúng tên khi báo cáo

Đây là **thí nghiệm bóc lớp (ablation)**: lấy prompt production rồi **gỡ dần từng lớp ra**
để xem lớp nào đáng giá bao nhiêu. **Nó KHÔNG phải nhật ký cải tiến của nhóm** — V1/V2/V3
chưa từng chạy trong sản phẩm, chúng chỉ là mốc so sánh.

Nên slide phải ghi:

- ✅ **"Đóng góp của từng thành phần trong prompt"**
- ❌ ~~"Quá trình cải tiến prompt qua các phiên bản"~~ ← hội đồng hỏi *"commit nào là V1?"* là lộ

V4 **không được chép lại** trong thư mục này — nó `import` thẳng từ
`ai-service/criteria_extract.py`, để không bao giờ đo nhầm một bản prompt đã cũ.

---

## 3. Kết quả

### 3.1 Tầng máy — 4 phiên bản (đo 14/08/2026)

| Ver | Tiêu chí | JSON hợp lệ | Giấy tờ | Gộp kỹ năng | Vượt trần | Ổn định | Giây/tin |
|---|---|---|---|---|---|---|---|
| V1 | 80 | 100% | 8,8% | 33,8% | **3** | 0,983 | 3,5 |
| V2 | 80 | 100% | **5,0%** | 35,0% | 0 | **1,000** | 2,5 |
| V3 | 67 | 100% | 9,0% | 35,8% | 0 | 0,974 | 2,3 |
| **V4** | 72 | 100% | 8,3% | **29,2%** | 0 | 0,996 | 2,3 |

**V4 là bản tốt nhất** — bản duy nhất vừa lọc được tiêu chí rác vừa không cắt quá tay.

Ba điều rút ra (chi tiết + ví dụ thật ở `exp_criteria_extract/out/KET_QUA.md` mục 3):

- **Ràng buộc schema không cứu JSON** (model vốn đã trả JSON đúng 100% ở mọi bậc) — nó ăn ở
  chỗ khác: **cưỡng chế trần 10** (tin `J10` từ 13 dòng xuống 10) và **tất định hoá**
  (ổn định 0,983 → 1,000).
- **Luật nghiệp vụ làm model biết im lặng.** Ca đối chứng `J09` (tin chỉ có đầu việc):
  không luật → **7 tiêu chí rác**, có luật → **0** ✅. Đây là so sánh trực quan nhất của cả bộ.
- **Ví dụ dạy được thứ luật suông không dạy nổi.** Luật "mỗi tiêu chí một kỹ năng" không làm
  giảm tỉ lệ gộp (35,0% → 35,8%, nhích lên chứ không giảm); phải có ví dụ mới xuống 29,2%.

### 3.2 Tầng người — chấm tay prompt production (đo 12–13/08/2026)

**Precision 0.841 · Recall 0.914 · F1 0.876** trên 63 tiêu chí / 10 tin.
**`BIA` = 0** — không dòng nào AI tự bịa, mọi tiêu chí truy được về câu chữ trong tin.

> Lượt chấm tay này chạy trên **cùng prompt production (= V4)** nhưng ở một lượt gọi model
> khác lượt 14/08 (63 vs 65 tiêu chí — `temperature=0` giảm ngẫu nhiên chứ không xoá hẳn).
> Dữ liệu nhãn thô nằm trong git history trước commit `4523d47`.

### 3.3 Tầng người — chấm tay cả 4 bậc ablation (đo 14/08/2026)

299 tiêu chí của cả 4 bậc đã gán nhãn. Đây là bộ số để trích vào báo cáo:

| | V1 | V2 | V3 | **V4** |
|---|---|---|---|---|
| Precision | 0.588 | 0.637 | 0.791 | **0.833** |
| Recall | 0.979 | 0.981 | 0.914 | **0.938** |
| F1 | 0.734 | 0.773 | 0.848 | **0.882** |

Chi tiết + cách đọc: `out/KET_QUA.md` mục 3. Bảng gộp cả hai tầng: `out/KET_QUA_TONG_HOP.xlsx`.

---

## 4. Cách chạy

Cần **Ollama đang chạy** và đã `ollama pull qwen2.5`. Dùng Python trong venv của ai-service
(đã có sẵn `ollama` + `pydantic`):

```powershell
cd Development\backend\ai-experiments\exp_criteria_extract

# Chạy cả 4 phiên bản, mỗi tin 2 lượt  (~80 lượt gọi model)
..\..\ai-service\.venv\Scripts\python.exe 1_chay_model_va_may_cham.py --all --repeat 2

# Chạy lại một phiên bản
..\..\ai-service\.venv\Scripts\python.exe 1_chay_model_va_may_cham.py --version v4 --repeat 2

# Thêm phép đo mới -> tính lại từ dữ liệu cũ, KHÔNG gọi model
..\..\ai-service\.venv\Scripts\python.exe 1_chay_model_va_may_cham.py --all --recompute
```

> Lượt gọi **đầu tiên** chậm hơn hẳn vì Ollama phải nạp model vào bộ nhớ. Đừng lấy con số
> thời gian của lượt đó đưa vào báo cáo.

---

## 5. Cách chấm tay (tầng người)

Mỗi phiên bản có một thư mục `out/<ver>/`. **Cả 4 bậc đã chấm xong 14/08/2026** — phần dưới
là cách chấm lại hoặc sửa nhãn.

**Bước 1 — gán nhãn.** Mỗi dòng trong `nguoi_cham_tung_dong.csv` là một tiêu chí AI đề xuất,
mang một trong 6 mã (định nghĩa đầy đủ + ranh giới ở **`LUAT_NGUOI_CHAM.md`**):

| Mã | Nghĩa |
|---|---|
| `DUNG` | Tiêu chí dùng được |
| `GIAYTO` | Đọc hồ sơ là biết, không đáng cho điểm phỏng vấn |
| `DAUVIEC` | Là việc sẽ làm, không phải yêu cầu với ứng viên |
| `GOP` | Nhồi nhiều kỹ năng vào một dòng |
| `BIA` | AI tự nghĩ ra, không có trong tin |
| `TRUNG` | Trùng nghĩa với một dòng khác |

Phân vân thì ghi lý do vào cột `ghi_chu` — tỉ lệ dòng phân vân chính là **độ nhạy của phép đo
với người chấm**, lúc viết báo cáo sẽ cần.

> ⚠️ **Đừng sửa tay vào `nguoi_cham_tung_dong.csv`** — chạy lại `1_chay_model_va_may_cham.py`
> là mất sạch. Nhãn nằm trong bảng `LABELS` của `2_nguoi_cham_dien_nhan.py`, khoá theo
> *mã tin + nguyên văn tiêu chí* nên một tiêu chí xuất hiện ở nhiều bậc luôn nhận cùng nhãn.
> Sửa ở đó rồi chạy lại script, nó ghi đè vào cả 4 thư mục.

**Bước 2 — đếm bỏ sót** (`nguoi_cham_bo_sot.csv`, cũng do `2_nguoi_cham_dien_nhan.py` ghi).
Mở tin gốc, đếm yêu cầu nào **AI bỏ sót không bóc**. Bỏ qua bước này thì recall vĩnh viễn
bằng 1 và cả bộ số trông đẹp một cách vô nghĩa.

**Bước 3 — tính điểm và gộp báo cáo:**

```powershell
..\..\ai-service\.venv\Scripts\python.exe 2_nguoi_cham_dien_nhan.py          # điền nhãn vào cả 4 bậc
..\..\ai-service\.venv\Scripts\python.exe 3_nguoi_cham_tinh_diem.py --tag v4 # P / R / F1 một bậc
..\..\ai-service\.venv\Scripts\python.exe 4_gop_ket_qua_excel.py             # gộp tất cả vào 1 file Excel
```

---

## 6. Bộ test

10 tin tuyển dụng đa ngành trong `dataset.json` — kế toán, kinh doanh, kho vận, CNTT, hành
chính, lễ tân, marketing, sản xuất, chăm sóc khách hàng. Trong đó **2 ca cố tình khó**:

| Tin | Bẫy | Kết quả đúng phải là |
|---|---|---|
| `J09_chi_dau_viec` | Chỉ liệt kê đầu việc, không nêu yêu cầu nào | **Trả về rỗng** ✅ V3/V4 làm đúng |
| `J10_qua_nhieu` | 13 yêu cầu, trần là 10 | Chọn 10 cái quan trọng nhất ✅ V2 trở đi làm đúng |

Tin **do người làm đề tài soạn**, không phải tin thật của doanh nghiệp — hạn chế này phải nói
rõ trong báo cáo.

---

## 7. File nào là gì

Tên file nói luôn nó thuộc tầng nào: **`may_cham_*` = máy tự đo · `nguoi_cham_*` = người chấm
tay**. Bốn script có số ở đầu là **thứ tự chạy**.

**Chạy theo thứ tự — mỗi bước một script:**

| # | Script | Tầng | Làm gì |
|---|---|---|---|
| 1 | `1_chay_model_va_may_cham.py` | 🤖 máy | Gọi model 4 bậc prompt → ghi `raw.json` + đo tầng máy + sinh phiếu chấm tay còn trống |
| 2 | `2_nguoi_cham_dien_nhan.py` | 🧑 người | **Bảng nhãn** — chứa nhãn của cả 285 tiêu chí, ghi vào 4 thư mục. **Sửa nhãn thì sửa ở đây** |
| 3 | `3_nguoi_cham_tinh_diem.py` | 🧑 người | Đọc nhãn → precision / recall / F1 + bảng phân rã lỗi |
| 4 | `4_gop_ket_qua_excel.py` | 🤖+🧑 | Gộp tất cả vào **một** file Excel để đọc |

**File dùng chung (không chạy trực tiếp):**

| File | Tầng | Nội dung |
|---|---|---|
| `dataset.json` | — | 10 tin test — **không sửa giữa các lần chạy** |
| `prompts.py` | — | Định nghĩa 4 phiên bản prompt (V4 nạp thẳng từ ai-service) |
| `may_cham.py` | 🤖 máy | Các phép đo máy tự tính (giấy tờ, ngưỡng, gộp, trùng, ổn định) |
| `LUAT_NGUOI_CHAM.md` | 🧑 người | **6 mã + ranh giới khi phân vân** — luật chấm tay, đọc trước khi chấm |

**Kết quả trong `out/`:**

| File | Tầng | Nội dung |
|---|---|---|
| `out/KET_QUA_TONG_HOP.xlsx` | 🤖+🧑 | ⭐ **Mở file này trước** — 6 tab: `DocTruoc` (ai chấm cái gì) · `TongHop` (4 bậc, máy + người) · `TheoTin` (10 tin × 4 bậc) · và 3 tab bê nguyên 3 file chấm tay bên dưới: `NguoiCham_TungDong` / `NguoiCham_BoSot` / `NguoiCham_TongKet` |
| `out/KET_QUA.md` | 🤖+🧑 | **Bản tường thuật đầy đủ** — kết quả, ví dụ thật, khiếm khuyết, hạn chế |
| `out/may_cham_4_ban.csv` | 🤖 máy | Bảng so 4 phiên bản, dùng để vẽ biểu đồ |
| `out/<ver>/may_cham.csv` | 🤖 máy | Số đo máy của từng tin trong một phiên bản |
| `out/<ver>/nguoi_cham_tung_dong.csv` | 🧑 người | **Phiếu chấm tay** — mỗi tiêu chí một dòng + nhãn + lý do |
| `out/<ver>/nguoi_cham_bo_sot.csv` | 🧑 người | Mỗi tin một dòng: AI bỏ sót mấy tiêu chí (mẫu số của recall) |
| `out/<ver>/nguoi_cham_tong_ket.csv` | 🧑 người | P / R / F1 của phiên bản đó, do script 3 ghi ra |
| `out/<ver>/raw.json` | — | Đầu ra thô của model, giữ để `--recompute` và để đối chiếu khi nghi ngờ |
| `AI_TESTING_REFERENCE.md` | — | Tham khảo **cách trình bày**, bóc từ slide một nhóm capstone khác — không phải thiết kế của SRIS. Khung ngưỡng Tốt/Chấp nhận được trong `LUAT_NGUOI_CHAM.md` lấy từ đây |

> **Vì sao cần cả hai tầng.** Máy đo được thứ có hình dạng cố định (đếm dấu phẩy, dò regex
> giấy tờ, so hai lượt chạy có giống nhau không) — rẻ, lặp lại được, nhưng mù trước câu hỏi
> *"tiêu chí này có dùng được không"*. Bằng chứng: cột "JSON hợp lệ" phẳng lì 100% ở cả 4 bậc,
> chẳng phân biệt được bậc nào hơn bậc nào. Ngược lại chỉ chấm tay thì không đo nổi độ ổn định
> giữa hai lượt và không lặp lại được. **Precision / Recall / F1 chỉ ra được từ tầng người.**

---

## 8. Nguyên tắc phải giữ

- **Lượt 1 là lượt đem đi chấm**, không chọn lượt "đẹp nhất". Chọn lượt đẹp là tự chấm điểm cho mình.
- **Ngưỡng Tốt / Chấp nhận được / Cần cải thiện chốt TRƯỚC khi đọc số** (`LUAT_NGUOI_CHAM.md`), lấy của
  nguồn ngoài để khỏi bị nghi gọt cho vừa.
- **Không sửa `dataset.json` giữa các lần chạy** — đổi bộ test thì các phiên bản hết so được.
- **Hạn chế phải viết ra**: tin tự soạn · 10 tin là ít · một người gán nhãn · thời gian đo trên
  GPU chứ không phải CPU. Nêu trước còn hơn để hội đồng tự tìm ra.
