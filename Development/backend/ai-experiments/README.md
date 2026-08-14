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
| V1 | 81 | 100% | 11,1% | 30,9% | **3** | 0,983 | 3,3 |
| V2 | 79 | 100% | 8,9% | 34,2% | 0 | **1,000** | 2,5 |
| V3 | 60 | 100% | 8,3% | 35,0% | 0 | 0,974 | 2,1 |
| **V4** | 65 | 100% | **7,7%** | **27,7%** | 0 | 0,996 | 2,1 |

**V4 là bản tốt nhất** — bản duy nhất vừa lọc được tiêu chí rác vừa không cắt quá tay.

Ba điều rút ra (chi tiết + ví dụ thật ở `exp_criteria_extract/out/KET_QUA.md` mục 3):

- **Ràng buộc schema không cứu JSON** (model vốn đã trả JSON đúng 100% ở mọi bậc) — nó ăn ở
  chỗ khác: **cưỡng chế trần 10** (tin `J10` từ 13 dòng xuống 10) và **tất định hoá**
  (ổn định 0,983 → 1,000).
- **Luật nghiệp vụ làm model biết im lặng.** Ca đối chứng `J09` (tin chỉ có đầu việc):
  không luật → **7 tiêu chí rác**, có luật → **0** ✅. Đây là so sánh trực quan nhất của cả bộ.
- **Ví dụ dạy được thứ luật suông không dạy nổi.** Luật "mỗi tiêu chí một kỹ năng" không làm
  giảm tỉ lệ gộp (34,2% → 35,0%, đứng yên); phải có ví dụ mới xuống 27,7%.

### 3.2 Tầng người — chấm tay prompt production (đo 12–13/08/2026)

**Precision 0.841 · Recall 0.914 · F1 0.876** trên 63 tiêu chí / 10 tin.
**`BIA` = 0** — không dòng nào AI tự bịa, mọi tiêu chí truy được về câu chữ trong tin.

> Lượt chấm tay này chạy trên **cùng prompt production (= V4)** nhưng ở một lượt gọi model
> khác lượt 14/08 (63 vs 65 tiêu chí — `temperature=0` giảm ngẫu nhiên chứ không xoá hẳn).
> Dữ liệu nhãn thô nằm trong git history trước commit `4523d47`.
> **Bốn phiên bản của lượt 14/08 CHƯA được chấm tay** — xem mục 5.

---

## 4. Cách chạy

Cần **Ollama đang chạy** và đã `ollama pull qwen2.5`. Dùng Python trong venv của ai-service
(đã có sẵn `ollama` + `pydantic`):

```powershell
cd Development\backend\ai-experiments\exp_criteria_extract

# Chạy cả 4 phiên bản, mỗi tin 2 lượt  (~80 lượt gọi model)
..\..\ai-service\.venv\Scripts\python.exe run.py --all --repeat 2

# Chạy lại một phiên bản
..\..\ai-service\.venv\Scripts\python.exe run.py --version v4 --repeat 2

# Thêm phép đo mới -> tính lại từ dữ liệu cũ, KHÔNG gọi model
..\..\ai-service\.venv\Scripts\python.exe run.py --all --recompute
```

> Lượt gọi **đầu tiên** chậm hơn hẳn vì Ollama phải nạp model vào bộ nhớ. Đừng lấy con số
> thời gian của lượt đó đưa vào báo cáo.

---

## 5. Cách chấm tay (tầng người)

Mỗi phiên bản có một thư mục `out/<ver>/`. Làm 3 bước:

**Bước 1 — điền `labels.csv`.** Mỗi dòng là một tiêu chí AI đề xuất. Cột `nhan` đang trống,
điền một trong 6 mã (định nghĩa đầy đủ + ranh giới ở **`RUBRIC.md`**):

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

**Bước 2 — điền `missing.csv`.** Mở tin gốc, đếm yêu cầu nào **AI bỏ sót không bóc**. Bỏ qua
bước này thì recall vĩnh viễn bằng 1 và cả bộ số trông đẹp một cách vô nghĩa.

**Bước 3 — tính điểm:**

```powershell
..\..\ai-service\.venv\Scripts\python.exe score_rubric.py --tag v4
```

> **Tối thiểu chấm V1 và V4** để có câu "F1 từ X lên Y". Chấm cả 4 thì có biểu đồ F1 đầy đủ
> (~240 dòng). `labels.csv` của cả 4 phiên bản đều lưu sẵn, chấm thêm lúc nào cũng được.

---

## 6. Bộ test

10 tin tuyển dụng đa ngành trong `dataset.json` — kế toán, kinh doanh, kho vận, CNTT, hành
chính, lễ tân, marketing, vận tải, sản xuất. Trong đó **3 ca cố tình khó**:

| Tin | Bẫy | Kết quả đúng phải là |
|---|---|---|
| `J09_chi_dau_viec` | Chỉ liệt kê đầu việc, không nêu yêu cầu nào | **Trả về rỗng** ✅ V3/V4 làm đúng |
| `J08_tai_xe` | Phần lớn yêu cầu là giấy tờ (bằng lái, tuổi, hộ khẩu) | Bỏ giấy tờ, **giữ 3 yêu cầu chấm được** ❌ V3/V4 trả rỗng — lỗi còn tồn |
| `J10_qua_nhieu` | 13 yêu cầu, trần là 10 | Chọn 10 cái quan trọng nhất ✅ V2 trở đi làm đúng |

Tin **do người làm đề tài soạn**, không phải tin thật của doanh nghiệp — hạn chế này phải nói
rõ trong báo cáo.

---

## 7. File nào là gì

| File | Nội dung |
|---|---|
| `exp_criteria_extract/dataset.json` | 10 tin test — **không sửa giữa các lần chạy** |
| `exp_criteria_extract/prompts.py` | Định nghĩa 4 phiên bản prompt (V4 nạp từ ai-service) |
| `exp_criteria_extract/run.py` | Chạy bộ test, đo tầng máy, sinh phiếu chấm tay |
| `exp_criteria_extract/metrics.py` | Các phép đo máy tự tính (giấy tờ, ngưỡng, gộp, trùng, ổn định) |
| `exp_criteria_extract/RUBRIC.md` | **6 mã + ranh giới khi phân vân** — đọc trước khi chấm |
| `exp_criteria_extract/score_rubric.py` | Đọc nhãn đã điền → precision / recall / F1 |
| `out/KET_QUA.md` | **Bản tổng hợp đầy đủ** — kết quả, ví dụ thật, khiếm khuyết, hạn chế |
| `out/so_sanh_version.csv` | Bảng so 4 phiên bản, dùng để vẽ biểu đồ |
| `out/<ver>/raw.json` | Đầu ra thô của model, để đối chiếu khi nghi ngờ |
| `out/<ver>/labels.csv` | **Phiếu chấm tay** — bạn điền cột `nhan` |
| `AI_TESTING_REFERENCE.md` | Tham khảo **cách trình bày**, bóc từ slide một nhóm capstone khác — không phải thiết kế của SRIS. Khung ngưỡng Tốt/Chấp nhận được trong `RUBRIC.md` lấy từ đây |

---

## 8. Nguyên tắc phải giữ

- **Lượt 1 là lượt đem đi chấm**, không chọn lượt "đẹp nhất". Chọn lượt đẹp là tự chấm điểm cho mình.
- **Ngưỡng Tốt / Chấp nhận được / Cần cải thiện chốt TRƯỚC khi đọc số** (`RUBRIC.md`), lấy của
  nguồn ngoài để khỏi bị nghi gọt cho vừa.
- **Không sửa `dataset.json` giữa các lần chạy** — đổi bộ test thì các phiên bản hết so được.
- **Hạn chế phải viết ra**: tin tự soạn · 10 tin là ít · một người gán nhãn · thời gian đo trên
  GPU chứ không phải CPU. Nêu trước còn hơn để hội đồng tự tìm ra.
