# Kết quả đo — AI đề xuất tiêu chí

**Ngày đo:** 14/08/2026 · **Model:** `qwen2.5` 7B qua Ollama · `temperature=0`, `num_ctx=8192`
**Bộ test:** 10 tin tuyển dụng đa ngành × 2 lượt × 4 phiên bản prompt = **80 lượt gọi model**

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
| V1 | 81 | 100% | 11,1% | 30,9% | **3** | 0,983 | 3,3 |
| V2 | 79 | 100% | 8,9% | 34,2% | 0 | **1,000** | 2,5 |
| V3 | 60 | 100% | 8,3% | 35,0% | 0 | 0,974 | 2,1 |
| **V4** | 65 | 100% | **7,7%** | **27,7%** | 0 | 0,996 | 2,1 |

**Kết luận: V4 là bản tốt nhất** — bản duy nhất vừa lọc được tiêu chí rác vừa không cắt quá tay.

---

## 3. Từng lớp đóng góp gì

### 3.1 V1 → V2: ràng buộc định dạng — **cưỡng chế trần và tất định hoá**

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

### 3.2 V2 → V3: luật nghiệp vụ — **model biết im lặng**

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

**Nhưng luật cắt hơi tay.** Tổng tiêu chí tụt 79 → 60, và tin `J03` (kho vận) rơi từ 9 xuống 5.

### 3.3 V3 → V4: ví dụ mẫu — **dạy được thứ luật suông không dạy nổi**

| | V2 | V3 (thêm luật) | V4 (thêm ví dụ) |
|---|---|---|---|
| Gộp kỹ năng | 34,2% | 35,0% ← luật **không ăn** | **27,7%** ← ví dụ ăn |

Luật *"mỗi tiêu chí chỉ một kỹ năng"* viết trong V3 **không** làm giảm tỉ lệ gộp (34,2% → 35,0%,
đứng yên). Phải đến khi cho ví dụ cụ thể trong V4 nó mới xuống 27,7%.

Ví dụ đồng thời **kéo lại phần V3 cắt quá tay**: `J03` hồi từ 5 lên 8 tiêu chí.

> **Bài học rút ra:** với model 7B chạy cục bộ, **ví dụ dạy được thứ mà mô tả luật không dạy nổi.**
> Đây là kết luận về phương pháp, không chỉ về sản phẩm.

---

## 4. Số tiêu chí từng tin qua 4 bậc

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
| **J08 tài xế** | 7/7 | 7/7 | **0/0** | **0/0** | ❌ sai — xem mục 5 |
| **J09 chỉ đầu việc** | 7/7 | 7/7 | **0/0** | **0/0** | ✅ đúng — ca đối chứng |
| **J10 quá trần** | **13/13** | 10/10 | 10/10 | 10/10 | ✅ schema cưỡng chế trần |

---

## 5. Hai khiếm khuyết còn lại của V4

### 5.1 `J08_tai_xe` trả rỗng dù tin có 3 yêu cầu chấm được

Tin tài xế có 6 yêu cầu: 3 là giấy tờ/nhân khẩu (bằng lái B2, tuổi 22–40, thường trú Hà Nội)
và **3 chấm được** (thuộc đường nội thành, xử lý khi khách từ chối nhận, trung thực với tiền COD).
Model bỏ cả tin.

Người dùng sẽ nhận thông báo *"tin chưa nêu yêu cầu nào"* trong khi họ đã nhập yêu cầu đầy đủ.
Đây là lỗi nghiêm trọng hơn lỗi thừa dòng, vì nó khiến người dùng tin sai về chính tin của mình.

### 5.2 Lọt 5 dòng "giấy tờ" (7,7%)

```
[J01] Tốt nghiệp Cao đẳng trở lên chuyên ngành Kế toán - Kiểm toán
[J03] Tốt nghiệp THPT trở lên
[J05] Tốt nghiệp Đại học các ngành Quản trị nhân lực, Luật hoặc tương đương
[J06] Ngoại hình ưa nhìn
[J06] Chiều cao từ 1m60 trở lên
```

Quy luật: model bỏ được `"Tốt nghiệp Đại học"` trần trụi (thấy ở `J10`), nhưng **thêm chuyên
ngành vào là nó giữ lại** — câu dài hơn thì "trông giống yêu cầu thật" hơn.

### 5.3 Hướng xử lý: lọc bằng luật trong .NET, không phải viết prompt dài thêm — **ĐÃ LÀM 14/08/2026**

Hàm `la_giay_to()` trong `metrics.py` — regex thuần, tất định — khoanh **đúng 5 dòng đó**, không
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
luôn — dòng đó không chấm được gì. 33 test bám thẳng vào 5 dòng ở mục 5.2 và bộ tiêu chí thật của
job 46: `Tests/GP35.SRIS.Application.Tests/Services/CriteriaNameFilterTests.cs`.

> **Đọc bảng ở mục 2 cho đúng sau thay đổi này:** 7,7% là tỉ lệ lọt của **model**, không phải của
> **hệ thống**. Sau bước lọc, tỉ lệ giấy tờ tới tay người duyệt là 0% do cấu tạo. Bộ đo vẫn cố ý
> đo đầu ra thô của model — có vậy mới biết prompt đang khá lên hay tệ đi, thay vì nhìn vào con số
> đã được regex dọn sạch. Vì lý do đó, `GIAY_TO_PATTERNS` bên `metrics.py` và bên C# phải giữ
> giống nhau; sửa một bên thì sửa cả hai rồi đo lại.

---

## 6. Hạn chế của phép đo

Nêu trước còn hơn để hội đồng tự tìm ra.

- **Tin tuyển dụng do người làm đề tài soạn**, không phải tin thật của doanh nghiệp.
- **10 tin là ít** — đủ để so 4 phiên bản và thấy lỗi có hệ thống, không đủ để tuyên bố một
  tỉ lệ chính xác tới phần trăm.
- **Chỉ số tầng máy là heuristic.** `la_gop()` chỉ đếm dấu phẩy và chữ "và" nên báo nhầm:
  `"Kỹ năng đàm phán và thuyết phục"` bị tính là gộp dù gần như một kỹ năng;
  `"Thành thạo Excel (hàm SUMIF, VLOOKUP, PivotTable)"` có dấu phẩy trong ngoặc là ví dụ minh
  hoạ chứ không phải 3 kỹ năng. **Vì vậy đừng trích 27,7% như con số lỗi thật** — nó dùng để
  so giữa các phiên bản, nơi cùng sai số xuất hiện ở cả 4 bên nên không làm lệch kết luận.
- **`temperature=0` giảm ngẫu nhiên chứ không xoá hẳn.** Cùng prompt V4: lượt đo 12/08 ra 63
  tiêu chí, lượt 14/08 ra 65.
- **Số thời gian là GPU**, xem cảnh báo đầu file.
- **Chưa có precision / recall / F1 cho lượt đo này.** Toàn bộ bảng trên là tầng máy. Muốn có
  số tầng người thì phải gán nhãn tay `out/<ver>/labels.csv` theo `RUBRIC.md` rồi chạy
  `score_rubric.py --tag <ver>`.

---

## 7. Việc tiếp theo

1. **Gán nhãn tay V1 và V4** (81 và 65 dòng) → có câu *"F1 từ X lên Y"*, đây mới là số để trích
   vào báo cáo. Gán nhãn thêm V2/V3 thì có biểu đồ F1 đủ 4 điểm.
2. ~~**Đưa `la_giay_to()` vào `CriteriaExtractionClient`** làm bước lọc~~ — **xong 14/08/2026**,
   xem mục 5.3. Làm luôn cả `la_nguong()` (cắt, không bỏ).
3. **Điều tra `J08`**: vì sao tin có 3 yêu cầu chấm được mà model trả rỗng. Đây là khiếm khuyết
   nặng nhất còn lại — bộ lọc ở mục 5.3 không đụng gì tới nó, vì nó là lỗi model bỏ SÓT chứ không
   phải trả THỪA.
4. **Thêm ví dụ `"Tốt nghiệp Đại học chuyên ngành ..."` vào khối few-shot** rồi đo lại. Mục 3.3
   cho thấy ví dụ dạy được thứ luật suông không dạy nổi, nên nhiều khả năng ăn. Không gấp: bộ lọc
   đã chặn chắc rồi, đây chỉ là để con số 7,7% ở tầng model đẹp hơn.
