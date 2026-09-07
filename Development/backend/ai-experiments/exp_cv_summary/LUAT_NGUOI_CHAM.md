# Luật chấm tay — bản tóm tắt CV

> Đọc hết file này **trước khi** gán nhãn dòng đầu tiên. Ngưỡng ở mục 4 chốt **trước khi
> nhìn số**, để không có chuyện gọt ngưỡng cho vừa kết quả.

---

## 1. Đơn vị chấm là CÂU, không phải cả bản tóm tắt

Một bản tóm tắt 4 câu thường có 3 câu đúng và 1 câu bịa. Chấm cả bản là "sai" thì mất
thông tin, chấm là "đúng" thì giấu mất lỗi. Chấm theo câu mới ra được precision đúng nghĩa.

Mỗi dòng trong `nguoi_cham_tung_cau.csv` là **một câu** trong bản tóm tắt, mang **đúng một**
trong 5 mã dưới đây.

---

## 2. Năm mã nhãn

| Mã | Nghĩa | Tính vào |
|---|---|---|
| `DUNG` | Câu kể lại đúng một thông tin có thật trong CV | TP |
| `BIA` | Thông tin **không hề có** trong CV | FP |
| `SUYDIEN` | Có gốc trong CV nhưng model **suy ra thêm** thứ CV không nói | FP |
| `SAISO` | Con số / mốc thời gian **sai** so với CV | FP |
| `SAORONG` | Câu khen chung chung, **không mang thông tin của CV này** | FP |

### Ranh giới khi phân vân

**`BIA` vs `SUYDIEN`** — hỏi: *câu này có điểm neo nào trong CV không?*
- CV không nhắc gì tới Kubernetes, tóm tắt viết "từng triển khai Kubernetes" → `BIA`.
- CV **liệt kê** "Kubernetes" ở mục Kỹ năng, tóm tắt viết "có kinh nghiệm **triển khai**
  Kubernetes" → `SUYDIEN` (có neo là dòng liệt kê, nhưng CV chưa từng nói đã làm gì với nó).
- CV ghi "Kỹ sư Công nghệ thông tin", tóm tắt viết "thành thạo Java" → `SUYDIEN`.

**`SAISO` vs `BIA`** — con số **có mặt** trong CV nhưng bị dùng sai chỗ, hoặc con số **được
tính ra** từ dữ liệu CV, đều là `SAISO`. Con số không liên quan gì tới CV mới là `BIA`.
- CV: "03/2019 đến nay", không câu nào ghi số năm. Tóm tắt: "5 năm kinh nghiệm" → `SAISO`
  (model tự cộng — đúng thứ prompt production cấm).
- CV: "đội đạt 118% chỉ tiêu 2023". Tóm tắt: "đạt 181%" → `SAISO`.
- CV: "quản lý đội 12 người". Tóm tắt: "quản lý 12 dự án" → `SAISO` (số đúng, đối tượng sai).

**`SAORONG`** — phép thử: **gỡ câu đó ra, gắn sang CV của ứng viên khác. Vẫn đúng không?**
Vẫn đúng ⇒ `SAORONG`. Câu chứa dữ kiện riêng của CV này thì không bao giờ là `SAORONG`,
kể cả khi nó có kèm lời khen.
- "Ứng viên có nhiều kinh nghiệm và tiềm năng phát triển." → `SAORONG`
- "Ứng viên phù hợp với vị trí đang tuyển." → `SAORONG` (và còn là phán xét, không phải tóm tắt)
- "Anh có 6 năm làm kế toán tổng hợp tại công ty thương mại." → `DUNG`

**Câu nêu đúng là ứng viên KHÔNG có gì** (ca `C03_fresher_mong`) là `DUNG`, không phải
`SAORONG`: "Ứng viên mới tốt nghiệp, chưa có kinh nghiệm đi làm" là thông tin thật và hữu ích.

**Nhận xét về định dạng CV** (ca `C06`) — "CV trình bày lộn xộn, khó đọc" → `SAORONG`:
nó không kể gì về ứng viên, và prompt production cấm thẳng.

**Tóm tắt viết bằng tiếng Anh** (ca `C07`) — vẫn chấm nội dung bình thường theo 5 mã trên;
lỗi ngôn ngữ ghi vào cột `ghi_chu`, đếm riêng, KHÔNG trộn vào precision.

> Phân vân thì cứ gán mã bạn nghiêng về **và ghi lý do vào `ghi_chu`**. Tỉ lệ dòng phân vân
> chính là **độ nhạy của phép đo với người chấm** — lúc viết báo cáo sẽ cần con số đó.

---

## 3. Đếm bỏ sót (mẫu số của recall)

Trong `nguoi_cham_bo_sot.csv`, mỗi CV một dòng. Mở `dataset.json`, đọc `moc_phai_co` của
CV đó — đó là các dữ kiện **một bản tóm tắt tốt bắt buộc phải nhắc tới**. Đếm xem bản tóm
tắt **bỏ sót mấy mốc**, điền vào `so_moc_bi_bo_sot`.

Tính là "có nhắc" khi diễn đạt khác nhưng cùng ý — "làm backend từ 2019" và "phát triển API
từ năm 2019" là **cùng một mốc**. Máy không nhận ra chỗ này, nên bước này bắt buộc người làm.

**Bỏ qua bước này thì recall vĩnh viễn bằng 1 và cả bộ số trông đẹp một cách vô nghĩa.**

---

## 4. Ngưỡng — chốt TRƯỚC khi đọc số

Lấy nguyên khung Good / Acceptable / Needs Improvement của `AI_TESTING_REFERENCE.md`
(slide nhóm SmartHR) để khỏi bị nghi gọt ngưỡng cho vừa kết quả của mình.

| Chỉ số | Tốt | Chấp nhận được | Cần cải thiện |
|---|---|---|---|
| Precision | ≥ 0.85 | 0.70 – 0.84 | < 0.70 |
| Recall | ≥ 0.85 | 0.70 – 0.84 | < 0.70 |
| F1 | ≥ 0.85 | 0.70 – 0.84 | < 0.70 |

Riêng hai chỉ số dưới đây **SRIS tự đặt**, vì chúng nói về đúng rủi ro của bài toán này —
người tuyển dụng đọc bản tóm tắt **thay cho** việc mở file CV, nên một câu bịa nguy hiểm
hơn hẳn một câu thiếu:

| Chỉ số | Tốt | Chấp nhận được | Cần cải thiện |
|---|---|---|---|
| Tỉ lệ câu `BIA` + `SAISO` | 0% | ≤ 5% | > 5% |
| Tỉ lệ câu `SAORONG` | ≤ 5% | ≤ 15% | > 15% |

Đặt `BIA + SAISO` ở mức **0%** là cố ý: bản tóm tắt sai một con số thì người đọc mất niềm
tin vào toàn bộ phần còn lại, mà họ không có cách nào biết câu nào sai nếu không mở CV ra —
tức là mất luôn lợi ích của tính năng.

---

## 5. Công thức

```
TP = số câu DUNG
FP = số câu BIA + SUYDIEN + SAISO + SAORONG
FN = tổng số mốc bị bỏ sót (mục 3)

Precision = TP / (TP + FP)
Recall    = TP / (TP + FN)
F1        = 2·P·R / (P + R)
```

**Vì sao FN đếm theo MỐC còn TP đếm theo CÂU:** một câu có thể chứa nhiều mốc, nên hai vế
không cùng đơn vị — đây là **hạn chế đã biết** của phép đo, phải ghi trong báo cáo. Giữ cách
này vì nó ổn định qua cả 4 bậc nên vẫn **so giữa các bậc** được, mà đó mới là mục đích.
Đừng trích riêng con số recall ra khỏi ngữ cảnh so sánh.
