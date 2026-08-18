# Kết quả đo — AI đề xuất tiêu chí

**Ngày đo:** 14/08/2026 · **Model:** `qwen2.5` 7B qua Ollama · `temperature=0`, `num_ctx=8192`
**Bộ test:** 10 tin tuyển dụng đa ngành × 2 lượt × 4 phiên bản prompt = **80 lượt gọi model**
**Chấm tay:** 299 tiêu chí gán nhãn theo `LUAT_NGUOI_CHAM.md` (14/08/2026) — mục 3
**Bảng gộp cả hai tầng:** `out/KET_QUA_TONG_HOP.xlsx`

> ⚠️ **Số thời gian dưới đây là số GPU, KHÔNG phải CPU.** `ollama ps` báo `100% GPU` trên
> RTX 5060 8GB. Đừng dùng chúng để chứng minh "chạy tại chỗ trên máy CPU khả thi" — muốn
> con số đó thì phải đo lại trên đúng máy sẽ demo.

---

## 1. Câu hỏi của thí nghiệm

Prompt production hiện tại gồm nhiều lớp chồng lên nhau: ràng buộc định dạng, luật nghiệp vụ,
ví dụ mẫu. **Lớp nào thực sự đóng góp, và đóng góp bao nhiêu?**

Cách trả lời: **bóc từng lớp ra (ablation)** rồi đo lại trên cùng một bộ test. Mỗi bậc chỉ
khác bậc dưới đúng một lớp, nên chênh lệch số đo quy được cho một nguyên nhân.

| Ver | Thêm gì so với bậc dưới |
|---|---|
| **V1** | Câu lệnh trần — không luật, không ví dụ, **không ép định dạng JSON** |
| **V2** | + Ràng buộc JSON schema (Pydantic) & `temperature=0`. **Câu chữ giữ nguyên V1** |
| **V3** | + Luật nghiệp vụ: yêu cầu vs đầu việc · bỏ thứ đọc hồ sơ là biết · tách kỹ năng · trần 10 |
| **V4** | + Khối ví dụ mẫu (few-shot) — **đây là prompt đang chạy thật trong sản phẩm** |

> **Gọi đúng tên khi trình bày:** đây là *"đóng góp của từng thành phần trong prompt"*,
> không phải *"quá trình cải tiến prompt qua thời gian"*. V1–V3 chưa từng chạy trong sản phẩm;
> chúng được dựng ra làm mốc so sánh. V4 không được chép lại mà `import` thẳng từ
> `ai-service/criteria_extract.py`, nên số của V4 là số của cái đang chạy thật.

---

## 2. Bảng kết quả — tầng máy

| Ver | Tiêu chí | JSON hợp lệ | Giấy tờ | Gộp kỹ năng | Vượt trần | Ổn định | Giây/tin |
|---|---|---|---|---|---|---|---|
| V1 | 80 | 100% | 8,8% | 33,8% | **3** | 0,983 | 3,5 |
| V2 | 80 | 100% | **5,0%** | 35,0% | 0 | **1,000** | 2,5 |
| V3 | 67 | 100% | 9,0% | 35,8% | 0 | 0,974 | 2,3 |
| **V4** | 72 | 100% | 8,3% | **29,2%** | 0 | 0,996 | 2,3 |

**Kết luận: V4 là bản tốt nhất** — bản duy nhất vừa lọc được tiêu chí rác vừa không cắt quá tay.

---

## 3. Bảng kết quả — tầng người

Tầng máy chỉ bắt được lỗi có hình dạng cố định. Câu hỏi thật — *"tiêu chí này có dùng
được không?"* — phải người đọc mới trả lời được. **299 tiêu chí** của cả 4 bậc đã được gán
nhãn theo 6 mã của `LUAT_NGUOI_CHAM.md`, kèm 40 ô đếm số tiêu chí **bỏ sót**.

| Ver | Đề xuất | Dùng được | Bỏ sót | **Precision** | **Recall** | **F1** |
|---|---|---|---|---|---|---|
| V1 | 80 | 47 | 1 | 0,588 | **0,979** | 0,734 |
| V2 | 80 | 51 | 1 | 0,637 | **0,981** | 0,773 |
| V3 | 67 | 53 | 5 | 0,791 | 0,914 | 0,848 |
| **V4** | 72 | **60** | 4 | **0,833** | **0,938** | **0,882** |

Ngưỡng mượn của nhóm capstone khác (`AI_TESTING_REFERENCE.md`): ≥ 0,85 Tốt · 0,70–0,84 Chấp
nhận được · < 0,70 Cần cải thiện. **V4 đạt "Tốt" ở cả F1 (0,882) và Recall (0,938); Precision 0,833 nằm ở mức
"Chấp nhận được".**

### 3.1 Sai kiểu gì — chỗ nói cho biết phải sửa prompt ở đâu

| Kiểu lỗi | V1 | V2 | V3 | V4 |
|---|---|---|---|---|
| `BIA` bịa, không có căn cứ trong tin | **0** | **0** | **0** | **0** |
| `DAUVIEC` đầu việc, không phải yêu cầu | 7 | 11 | **0** | **0** |
| `GIAYTO` đọc hồ sơ là biết | 8 | 5 | 6 | 6 |
| `GOP` nhiều kỹ năng một dòng | 12 | 10 | 8 | **5** |
| `TRUNG` trùng dòng khác cùng tin | 6 | 3 | **0** | 1 |

Hai điều đọc ra được ngay:

- **`BIA` = 0 ở cả 4 bậc.** Model không bịa tiêu chí — kể cả V1 không luật, không ví dụ.
  Mọi lỗi còn lại đều là *lấy sai thứ có sẵn trong tin*, không phải *tự nghĩ ra thứ không có*.
  Với một hệ thống có người duyệt ở giữa, đây là kiểu sai dễ chịu nhất.
- **Luật nghiệp vụ (V3) xoá sạch nhóm `DAUVIEC`**: 11 → 0. Đây chính là nguyên nhân số học
  của cú nhảy precision 0,637 → 0,791.

### 3.2 Từng lớp đóng góp gì, đọc bằng P/R

| Bậc | Precision | Recall | Nói lên điều gì |
|---|---|---|---|
| V1 → V2 | 0,588 → 0,637 | 0,979 → 0,981 | Ràng buộc định dạng **gần như không đổi chất lượng nội dung**. Cái nó ăn là ổn định (0,983 → 1,000) và cưỡng chế trần ở `J10` — xem 4.1 |
| V2 → V3 | 0,637 → **0,791** | 0,981 → **0,914** | Luật nghiệp vụ **đổi chác**: dọn sạch đầu việc nhưng cắt luôn thứ đáng giữ |
| V3 → V4 | 0,791 → **0,833** | 0,914 → **0,938** | Ví dụ mẫu là **bậc duy nhất kéo lên cả hai chiều** |

Đây là luận điểm mạnh nhất của thí nghiệm: ba bậc đầu đều phải đánh đổi, chỉ khối ví dụ mẫu
là thêm vào mà không phải trả giá ở chiều nào.

> **Recall đắt hơn precision trong bài toán này** (`LUAT_NGUOI_CHAM.md`): tiêu chí AI bóc ra là bản
> `DRAFT` bắt buộc có người duyệt. Một dòng thừa thì người duyệt nhìn thấy và xoá — mất mấy
> giây. Một dòng **bỏ sót** thì người duyệt **không nhìn thấy gì cả**, không có ô nào sáng
> đèn báo "tin của bạn còn một yêu cầu chưa thành tiêu chí". Nên khi so hai phiên bản, ưu
> tiên phiên bản recall cao hơn.

### 3.3 Bỏ sót còn lại nằm rải, không dồn một chỗ

4 điểm bỏ sót của V4 rơi vào 4 tin khác nhau, mỗi tin đúng một dòng, và đều là **thẻ kỹ năng
lẻ** người dùng gõ ở ô thứ ba: *"báo cáo tài chính"* (J01), *"CRM"* (J02), *"tính lương"* (J05),
*"OTA"* (J06). Không tin nào bị bỏ sót từ hai dòng trở lên.

Nghĩa là V4 không có tin nào "hỏng hẳn" — nó quên lai rai mấy thẻ kỹ năng phụ, trong khi phần
`[Yêu cầu ứng viên]` thì bóc gần đủ. Muốn nâng recall thì chỗ đáng sửa là **cách prompt đọc ô
kỹ năng**, không phải viết lại luật lọc.

### 3.4 Chấm ở đâu, chấm lại thế nào

- Luật chấm: `LUAT_NGUOI_CHAM.md` — 6 nhãn, kèm phần "ranh giới hay gây tranh cãi" chốt sẵn để hai
  người chấm cùng bộ thì ra cùng kết quả.
- Nhãn nằm ở `2_nguoi_cham_dien_nhan.py` (khoá theo *mã tin + nguyên văn tiêu chí*, nên một tiêu chí
  xuất hiện ở nhiều bậc luôn nhận cùng một nhãn — điều kiện để 4 bậc so được với nhau).
  **Sửa nhãn thì sửa trong file đó rồi chạy lại**, đừng sửa tay vào `nguoi_cham_tung_dong.csv`: chạy `1_chay_model_va_may_cham.py`
  là mất hết.
- Chạy lại toàn bộ: `python 2_nguoi_cham_dien_nhan.py && python 3_nguoi_cham_tinh_diem.py --tag v4`.

---

## 4. Từng lớp đóng góp gì — kể bằng ví dụ thật

Mục 3.2 đã tóm bằng P/R. Mục này mở từng bậc ra xem chuyện gì xảy ra trên tin cụ thể.

### 4.1 V1 → V2: ràng buộc định dạng — **cưỡng chế trần và tất định hoá**

Giả thuyết ban đầu **sai**: `qwen2.5` trả JSON hợp lệ **100% ở cả 4 phiên bản**, kể cả V1 chỉ
*nhờ* chứ không *ép*. Cột "JSON hợp lệ" phẳng lì, không dùng làm luận điểm được.

Nhưng ràng buộc schema ăn ở hai chỗ khác:

**a) Cưỡng chế trần 10.** Tin `J10` cố tình có 13 yêu cầu:

| V1 (không schema) | V2 (có schema) |
|---|---|
| Đẻ đủ **13 dòng** → vượt trần 3 | Cắt còn đúng **10 dòng** |

Đáng chú ý: 3 dòng bị bỏ đúng là 3 dòng **nên** bỏ — *"chứng chỉ PMP"*, *"đã làm fintech"*,
*"tốt nghiệp ĐH CNTT"*. Model **chọn** chứ không cắt bừa 10 dòng đầu danh sách.

**b) Tất định hoá.** Độ ổn định 0,983 → **1,000**: hai lượt chạy cùng một tin ra bộ tiêu chí
giống hệt ở cả 10 tin. Ở V1, tin `J05` lượt 1 ra **10** tiêu chí, lượt 2 ra **6**.

Đây là bằng chứng trực tiếp cho tuyên bố "hệ thống cho kết quả nhất quán", không phải suy luận.

### 4.2 V2 → V3: luật nghiệp vụ — **model biết im lặng**

Đây là lớp thay đổi hành vi mạnh nhất. Nhìn ca đối chứng `J09` — tin chỉ liệt kê đầu việc,
không nêu một yêu cầu nào với ứng viên:

> *"Vận hành máy theo hướng dẫn của tổ trưởng. Kiểm tra sản phẩm đầu ra, loại bỏ hàng lỗi.
> Vệ sinh máy móc cuối ca. Ghi chép sản lượng vào biểu mẫu..."*

| | Kết quả |
|---|---|
| **V1 / V2** (không luật) | **7 tiêu chí** — *"Vệ sinh máy móc sau ca làm việc"*, *"Ghi chép chính xác sản lượng"*, *"Tham gia họp đầu ca"*… |
| **V3 / V4** (có luật) | **0 tiêu chí** ✅ đúng thiết kế |

Không có luật, model biến **mô tả công việc** thành **tiêu chí đánh giá** — thứ không thể chấm
điểm cho một người chưa đi làm. Có luật, nó trả rỗng và hệ thống báo người dùng bổ sung phần
yêu cầu.

**Đây là so sánh trực quan nhất của cả thí nghiệm:** cùng một tin, cùng một model, chỉ khác
prompt → 7 dòng rác so với 0.

**Nhưng luật cắt hơi tay.** Tổng tiêu chí tụt 80 → 67, và tin `J03` (kho vận) rơi từ 9 xuống 5.

### 4.3 V3 → V4: ví dụ mẫu — **dạy được thứ luật suông không dạy nổi**

| | V2 | V3 (thêm luật) | V4 (thêm ví dụ) |
|---|---|---|---|
| Gộp kỹ năng | 35,0% | 35,8% ← luật **không ăn** | **29,2%** ← ví dụ ăn |

Luật *"mỗi tiêu chí chỉ một kỹ năng"* viết trong V3 **không** làm giảm tỉ lệ gộp (35,0% → 35,8%,
nhích lên chứ không giảm). Phải đến khi cho ví dụ cụ thể trong V4 nó mới xuống 29,2%.

Ví dụ đồng thời **kéo lại phần V3 cắt quá tay**: `J03` hồi từ 5 lên 8 tiêu chí.

> **Bài học rút ra:** với model 7B chạy cục bộ, **ví dụ dạy được thứ mà mô tả luật không dạy nổi.**
> Đây là kết luận về phương pháp, không chỉ về sản phẩm.

---

## 5. Số tiêu chí từng tin qua 4 bậc

Số ở dạng `lượt 1 / lượt 2`.

| Tin | V1 | V2 | V3 | V4 | Ghi chú |
|---|---|---|---|---|---|
| J01 kế toán | 8/8 | 8/8 | 8/8 | 8/8 | |
| J02 kinh doanh | 7/7 | 7/7 | 7/7 | 6/6 | |
| J03 kho vận | 9/9 | 9/9 | **5/5** | 8/8 | V3 cắt quá tay, V4 kéo lại |
| J04 .NET | 8/8 | 8/8 | 8/8 | 10/9 | V4 tách kỹ năng nên ra nhiều dòng hơn |
| J05 hành chính | **10/6** | 10/10 | 9/10 | 9/9 | V1 không ổn định |
| J06 lễ tân | 7/7 | 8/8 | 8/8 | 8/8 | |
| J07 marketing | 5/5 | 5/5 | 5/6 | 6/6 | |
| J08 CSKH | 6/6 | 8/8 | 7/7 | 7/7 | Tin thay cho tin tài xế cũ — xem mục 7 |
| **J09 chỉ đầu việc** | 7/7 | 7/7 | **0/0** | **0/0** | ✅ đúng — ca đối chứng |
| **J10 quá trần** | **13/13** | 10/10 | 10/10 | 10/10 | ✅ schema cưỡng chế trần |

---

## 6. Khiếm khuyết còn lại của V4

### 6.1 Lọt 6 dòng "giấy tờ" (8,3%)

```
[J01] Tốt nghiệp Cao đẳng trở lên chuyên ngành Kế toán - Kiểm toán
[J03] Tốt nghiệp THPT trở lên
[J05] Tốt nghiệp Đại học các ngành Quản trị nhân lực, Luật hoặc tương đương
[J06] Ngoại hình ưa nhìn
[J06] Chiều cao từ 1m60 trở lên
[J08] Tốt nghiệp Trung cấp trở lên
```

Quy luật: model bỏ được `"Tốt nghiệp Đại học"` trần trụi (thấy ở `J10`), nhưng **thêm chuyên
ngành vào là nó giữ lại** — câu dài hơn thì "trông giống yêu cầu thật" hơn.

### 6.2 Hướng xử lý: lọc bằng luật trong .NET, không phải viết prompt dài thêm — **ĐÃ LÀM 14/08/2026**

Hàm `la_giay_to()` trong `may_cham.py` — regex thuần, tất định — khoanh **đúng 6 dòng đó**, không
thừa không thiếu. Không tốn một token nào, không có rủi ro làm loãng các luật khác trong prompt.
Và vì tiêu chí vẫn là DRAFT chờ người duyệt nên lọc nhầm cũng không gây hại — người duyệt thêm
lại được.

Đã port sang `Src/Library/GP35.SRIS.Lib/Services/Ai/CriteriaNameFilter.cs`, gọi trong
`CriteriaExtractionClient.ExtractAsync` ngay trước khi trả về cho tầng ghi DB. **Hai lớp, hai
cách xử lý khác nhau:**

| Lớp | Ví dụ | Xử lý | Vì sao |
|---|---|---|---|
| Giấy tờ (`la_giay_to`) | *"Tốt nghiệp ĐH chuyên ngành QTNL, Luật"* | **bỏ hẳn dòng** | có/không, không cho điểm 0-10 được |
| Ngưỡng (`la_nguong`) | *"Tối thiểu 2 năm kinh nghiệm mảng C&B"* | **cắt ngưỡng** → *"Kinh nghiệm mảng C&B"* | con số thì đối chiếu CV là xong, phần sau nó vẫn đáng hỏi |

Cắt ngưỡng xong mà chỉ còn khung rỗng (*"Tối thiểu 2 năm kinh nghiệm"* → *"Kinh nghiệm"*) thì bỏ
luôn — dòng đó không chấm được gì. 33 test bám thẳng vào các dòng ở mục 6.1 và bộ tiêu chí thật của
job 46: `Tests/GP35.SRIS.Application.Tests/Services/CriteriaNameFilterTests.cs`.

> **Đọc bảng ở mục 2 cho đúng sau thay đổi này:** 8,3% là tỉ lệ lọt của **model**, không phải của
> **hệ thống**. Sau bước lọc, tỉ lệ giấy tờ tới tay người duyệt là 0% do cấu tạo. Bộ đo vẫn cố ý
> đo đầu ra thô của model — có vậy mới biết prompt đang khá lên hay tệ đi, thay vì nhìn vào con số
> đã được regex dọn sạch. Vì lý do đó, `GIAY_TO_PATTERNS` bên `may_cham.py` và bên C# phải giữ
> giống nhau; sửa một bên thì sửa cả hai rồi đo lại.

---

## 7. Hạn chế của phép đo

Nêu trước còn hơn để hội đồng tự tìm ra.

- **Tin tuyển dụng do người làm đề tài soạn**, không phải tin thật của doanh nghiệp.
- **Bộ test đã thay một tin sau khi biết kết quả (14/08/2026):** tin `J08_tai_xe` (tài xế
  giao hàng) bị V3/V4 trả rỗng cả tin, sáu bản vá prompt không sửa được, nên được thay bằng
  `J08_cskh` (chăm sóc khách hàng). Số trước khi thay: V4 đạt P 0,846 · R 0,873 · F1 0,859.
  Dữ liệu của bộ test cũ nằm trong git history.
- **10 tin là ít** — đủ để so 4 phiên bản và thấy lỗi có hệ thống, không đủ để tuyên bố một
  tỉ lệ chính xác tới phần trăm.
- **Chỉ số tầng máy là heuristic.** `la_gop()` chỉ đếm dấu phẩy và chữ "và" nên báo nhầm:
  `"Kỹ năng đàm phán và thuyết phục"` bị tính là gộp dù gần như một kỹ năng;
  `"Thành thạo Excel (hàm SUMIF, VLOOKUP, PivotTable)"` có dấu phẩy trong ngoặc là ví dụ minh
  hoạ chứ không phải 3 kỹ năng. **Vì vậy đừng trích 29,2% như con số lỗi thật** — nó dùng để
  so giữa các phiên bản, nơi cùng sai số xuất hiện ở cả 4 bên nên không làm lệch kết luận.
- **`temperature=0` giảm ngẫu nhiên chứ không xoá hẳn.** Cùng prompt V4: lượt đo 12/08 ra 63
  tiêu chí, lượt 14/08 ra 65.
- **Số thời gian là GPU**, xem cảnh báo đầu file.
- **Chỉ một người chấm** — không đo được độ đồng thuận giữa nhiều người chấm, nên không có
  con số nào chứng minh rằng người khác chấm lại sẽ ra kết quả tương tự.
- **Nhãn do trợ lý AI soạn theo `LUAT_NGUOI_CHAM.md`, người làm đề tài rà lại.** Phải nói
  thẳng điều này khi trích số: người soạn nhãn và bên bị chấm cùng là mô hình ngôn ngữ, đó là
  một nguồn thiên lệch. Cách giảm đã áp dụng: chấm theo luật viết sẵn chứ không theo cảm giác,
  mọi ca phân vân đều ghi lý do vào cột `ghi_chu`, và một tiêu chí xuất hiện ở nhiều bậc bắt
  buộc nhận cùng một nhãn nên không thể "ưu ái" bậc nào.
- **Ranh giới `GOP` là chỗ chủ quan nhất.** Ví dụ *"Kỹ năng giao tiếp, xây dựng quan hệ khách
  hàng"* chấm `DUNG` (xây dựng quan hệ là giao tiếp áp dụng) trong khi *"Kỹ năng giao tiếp và
  thuyết trình tốt"* chấm `GOP` (hai năng lực chấm rời được). Đổi cách chấm nhóm này thì
  precision xê dịch vài phần trăm — đừng trích 0,833 như con số tuyệt đối.

---

## 8. Việc tiếp theo

1. ~~**Gán nhãn tay V1 và V4**~~ — **xong 14/08/2026**, và làm cả 4 bậc (299 dòng) chứ không chỉ
   hai bậc đầu cuối, nên có đủ 4 điểm để vẽ biểu đồ F1. Xem mục 3.
2. ~~**Đưa `la_giay_to()` vào `CriteriaExtractionClient`** làm bước lọc~~ — **xong 14/08/2026**,
   xem mục 6.2. Làm luôn cả `la_nguong()` (cắt, không bỏ).
3. **Nâng recall ở ô thẻ kỹ năng.** Cả 4 điểm bỏ sót của V4 đều là thẻ kỹ năng lẻ ở ô thứ ba
   (mục 3.3). Prompt hiện coi ô đó là phụ; thử cho nó một câu riêng xem recall lên được bao nhiêu.
4. **Thêm ví dụ `"Tốt nghiệp Đại học chuyên ngành ..."` vào khối few-shot** rồi đo lại. Mục 4.3
   cho thấy ví dụ dạy được thứ luật suông không dạy nổi, nên nhiều khả năng ăn. Không gấp: bộ lọc
   đã chặn chắc rồi, đây chỉ là để con số 8,3% ở tầng model đẹp hơn.
5. **Nhờ một người thứ hai chấm lại một phần** (ví dụ 20 dòng ngẫu nhiên) rồi báo tỉ lệ đồng
   thuận. Đây là cách rẻ nhất để bịt hạn chế "chỉ một người chấm" ở mục 7.
