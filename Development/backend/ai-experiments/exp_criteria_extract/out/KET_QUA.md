# Đo chất lượng AI đề xuất tiêu chí — lượt đo đầu tiên

**Ngày đo:** 12/08/2026 · **Model:** `qwen2.5` 7B qua Ollama · `temperature=0`, `num_ctx=8192`
**Bộ test:** 10 tin tuyển dụng nhiều ngành, mỗi tin chạy 2 lượt (20 lượt gọi).

> ⚠️ **Số thời gian dưới đây là số GPU, KHÔNG phải CPU.** `ollama ps` báo `100% GPU` trên
> RTX 5060 8GB. Đừng dùng chúng để chứng minh "chạy tại chỗ trên máy CPU khả thi" — muốn
> con số đó thì phải đo lại trên đúng máy sẽ demo, hoặc ép `CUDA_VISIBLE_DEVICES=""`.
> Đây cũng là lý do phải kiểm `ollama ps` mỗi lần đo, không đoán.

---

## Kết quả tầng 1 — máy đo

Ba phiên bản prompt, cùng một bộ test:

| | tiêu chí | giấy tờ sót | gộp nhiều kỹ năng | ổn định | lượt hỏng |
|---|---|---|---|---|---|
| **baseline** (đang dùng) | 63 | 5 (7.9%) | 16 (25.4%) | **1.000** | 0/20 |
| v2 — thêm 2 đoạn luật dài | 52 | 4 (7.7%) | 15 (28.8%) | 0.865 | 0/20 |
| v3 — chỉ thêm ví dụ ngắn | 62 | 5 (8.1%) | 18 (29.0%) | **1.000** | 0/20 |

**Kết luận: giữ baseline.** Hai lần sửa prompt đều không cải thiện, v2 còn làm hỏng thêm.

### Cái chạy đúng

- **Ổn định tuyệt đối** — 2 lượt cùng một tin ra bộ tiêu chí giống hệt (Jaccard 1.000).
  Đây là bằng chứng trực tiếp cho `temperature=0`, không phải suy luận.
- **0/20 lượt hỏng**, **0 tiêu chí vượt trần 10**, **0 cặp trùng lặp**.
- **Luật TÁCH chạy đúng**: `J04` tách `"Kinh nghiệm với Entity Framework, REST API, kiến
  trúc microservices"` thành 3 tiêu chí riêng. `J01` tách `"Cẩn thận, trung thực, chịu được
  áp lực"` thành 3 dòng.
- **Luật ưu tiên khi vượt trần chạy đúng**: `J10` có 13 yêu cầu, trần là 10 — model bỏ đúng
  "Tốt nghiệp Đại học", "chứng chỉ PMP", "ưu tiên fintech", giữ lại 10 kỹ năng lõi. Nó
  **chọn** chứ không cắt bừa 10 dòng đầu.
- **Ca đối chứng `J09` đạt**: tin chỉ có đầu việc → trả rỗng, đúng như thiết kế.

### Hai khiếm khuyết còn lại — chỉnh prompt KHÔNG sửa được

**1. Lọt 5 tiêu chí "giấy tờ" (7.9%)** — y hệt nhau ở cả 3 phiên bản:

| Tin | Dòng lọt |
|---|---|
| J01 | Tốt nghiệp Cao đẳng trở lên chuyên ngành Kế toán - Kiểm toán |
| J03 | Tốt nghiệp THPT trở lên |
| J05 | Tốt nghiệp Đại học các ngành Quản trị nhân lực, Luật hoặc tương đương |
| J06 | Ngoại hình ưa nhìn · Chiều cao từ 1m60 trở lên |

Quy luật: model bỏ được `"Tốt nghiệp Đại học"` trần trụi (thấy ở `J10`), nhưng **thêm chuyên
ngành vào là nó giữ lại** — câu dài hơn thì "trông giống yêu cầu thật" hơn. v3 đã thêm hẳn
`"Tốt nghiệp Đại học chuyên ngành Kế toán - Kiểm toán"` vào danh sách BỎ trong prompt và
**vẫn lọt y nguyên**.

**2. `J08_tai_xe` trả RỖNG dù tin có 3 yêu cầu chấm được.** Tin tài xế có 6 yêu cầu, trong
đó 3 là giấy tờ/nhân khẩu (bằng lái B2, tuổi 22-40, thường trú Hà Nội) và 3 chấm được
(thuộc đường nội thành, kinh nghiệm xử lý khi khách từ chối nhận, trung thực với tiền COD).
Model bỏ cả tin. Người dùng sẽ nhận thông báo *"tin chưa nêu yêu cầu nào"* trong khi họ đã
nhập yêu cầu đầy đủ — đúng cái bẫy mà comment trong `EvaluationCriteriaService` cảnh báo.

v2 thêm hẳn một đoạn nêu **đích danh ca tài xế** và bảo "ba dòng sau PHẢI GIỮ". Không ăn.
Tệ hơn, đoạn đó làm `J03_kho_van` sập theo (lượt 1 ra 0 tiêu chí), làm `J04` **gộp ngược**
`"C# và ASP.NET Core"` về một dòng, và làm `J02` bịa ra `"Kỹ năng sử dụng CRM"` từ một dòng
đầu việc. Bài học: **prompt dài thêm thì luật cũ loãng đi** — thêm luật không miễn phí.

---

## Đề xuất

**Đừng chỉnh prompt tiếp cho hai lỗi này.** Ba lượt thử đã cho thấy chúng không nhạy với
cách diễn đạt. Hai hướng còn lại, theo thứ tự ưu tiên:

1. **Lọc "giấy tờ" bằng LUẬT trong .NET, không bằng lời năn nỉ model.** Chính hàm
   `la_giay_to()` trong `metrics.py` nhận diện đúng cả 5 dòng lọt, bằng regex, tất định,
   không tốn một token nào. Chuyển nó thành một bước lọc trong `CriteriaExtractionClient`
   là xong — và vì tiêu chí vẫn là DRAFT chờ người duyệt nên lọc nhầm cũng không gây hại
   (người duyệt thêm lại được).
2. **Chấp nhận và nói rõ.** 7.9% dòng thừa trên một bản nháp mà người duyệt bắt buộc phải
   rà trước khi chốt là mức chấp nhận được. Nhưng ca `J08` (trả rỗng dù tin có yêu cầu) thì
   không — nó khiến người dùng tin sai rằng tin của họ thiếu nội dung.

---

## Kết quả tầng 2 — người chấm (13/08/2026)

Chấm tay 63 tiêu chí của lượt `baseline` theo 6 mã trong `RUBRIC.md`, cộng phần đếm tiêu chí
AI **bỏ sót** ở `missing.csv`. Ngưỡng đánh giá chốt trong `RUBRIC.md` **trước khi** đọc số,
và lấy nguyên của nguồn ngoài để khỏi bị nghi gọt cho vừa.

| Chỉ số | Giá trị | Xếp theo ngưỡng |
|---|---|---|
| **Precision** | **0.841** | Chấp nhận được (0.70–0.84) |
| **Recall** | **0.914** | Tốt (≥ 0.85) |
| **F1** | **0.876** | Tốt (≥ 0.85) |

Trên 63 tiêu chí đề xuất / 10 tin, trong đó 53 dòng dùng được và 5 yêu cầu bị bỏ sót.

### Từng tin

| tin | đề xuất | DUNG | sót | prec | recall | F1 |
|---|---|---|---|---|---|---|
| J01_ke_toan | 8 | 7 | 0 | 0.875 | 1.000 | 0.933 |
| J02_kinh_doanh | 6 | 6 | 0 | 1.000 | 1.000 | 1.000 |
| J03_kho_van | 6 | 2 | 1 | 0.333 | 0.667 | 0.444 |
| J04_dotnet | 10 | 10 | 0 | 1.000 | 1.000 | 1.000 |
| J05_hanh_chinh | 9 | 7 | 0 | 0.778 | 1.000 | 0.875 |
| J06_le_tan | 8 | 6 | 0 | 0.750 | 1.000 | 0.857 |
| J07_marketing | 6 | 6 | 0 | 1.000 | 1.000 | 1.000 |
| J08_tai_xe | 0 | 0 | 3 | 0.000 | 0.000 | 0.000 |
| J09_chi_dau_viec | 0 | 0 | 0 | — | — | ĐẠT (ca đối chứng) |
| J10_qua_nhieu | 10 | 9 | 1 | 0.900 | 0.900 | 0.900 |
| **TỔNG** | **63** | **53** | **5** | **0.841** | **0.914** | **0.876** |

### Sai kiểu gì (10 dòng lỗi / 63)

| Mã | Số dòng | % | Nghĩa |
|---|---|---|---|
| `GIAYTO` | 5 | 7.9% | đọc hồ sơ là biết, không đáng cho điểm phỏng vấn |
| `GOP` | 3 | 4.8% | nhồi nhiều kỹ năng vào một dòng |
| `DAUVIEC` | 2 | 3.2% | là việc sẽ làm, không phải yêu cầu ứng viên |
| `BIA` | **0** | 0% | — |
| `TRUNG` | **0** | 0% | — |

**`BIA` = 0 là con số đáng nói nhất ở bảng này.** Trong 63 dòng không có dòng nào AI tự nghĩ ra
— mọi tiêu chí đều truy được về câu chữ trong tin. Đây đúng câu chốt bảo vệ ở §5.18: *"Tiêu chí
không do AI nghĩ ra."* Giờ nó có số đằng sau, không còn là lời khẳng định suông.

### Ba chỗ mất điểm — đều là lỗi có địa chỉ, không phải nhiễu

**1. `GIAYTO` 5 dòng — tầng máy và người chấm chỉ đúng CÙNG 5 dòng đó.** Hàm `la_giay_to()`
trong `metrics.py` (regex, tất định) khoanh đúng 5 dòng mà người chấm gán `GIAYTO`, không thừa
không thiếu. Nghĩa là **lỗi này lọc được bằng luật, không cần model** — củng cố đề xuất số 1 ở
trên. Bỏ được 5 dòng này thì precision lên **0.914** mà không đụng một token nào.

**2. `J08_tai_xe` kéo tụt recall một mình.** 3/5 dòng bỏ sót của cả bộ nằm ở tin này, vì AI trả
rỗng. Bỏ tin này ra thì recall là **0.964**. Nói cách khác: recall của hệ thống không "hơi thấp
đều" — nó **tốt ở 9 tin và sập hẳn ở 1 tin**. Hai loại lỗi này cần hai cách chữa khác nhau, và
gộp vào một con số trung bình là giấu mất điều đó.

**3. `J03_kho_van` kéo tụt precision một mình** (0.333). Tin này phần yêu cầu mỏng, AI **độn thêm
tiêu chí từ ô kỹ năng**: đẻ ra hai dòng `"Quản lý kho"` và `"Kiểm kê"` — vốn là gạch đầu dòng
trong phần mô tả công việc, không phải năng lực chấm được. Đây là dạng lỗi `DAUVIEC` duy nhất
trong cả bộ, và nó chỉ xuất hiện đúng ở tin nghèo yêu cầu nhất.

**Một phát hiện phụ ở `J10`:** luật TÁCH và trần 10 đá nhau. AI tự tách `"Kỹ năng giao tiếp và
thuyết trình"` thành 2 dòng — hợp lý xét riêng — nhưng vì tin đã có 13 yêu cầu, dòng tách thêm
đó chiếm mất suất cuối, và thứ bị đẩy ra là `"Tiếng Anh giao tiếp với khách hàng nước ngoài"`
trong khi mô tả công việc ghi rõ *"làm việc với khách hàng"*. Tách trước rồi mới cắt cho đủ trần
là sai thứ tự.

### Cách chấm — nói rõ để người đọc tự kiểm

- Người chấm: **một người**, cũng là người viết prompt → có thiên lệch. Giảm bằng cách chấm theo
  đúng bảng ranh giới trong `RUBRIC.md` chứ không theo cảm giác.
- **9/63 dòng được ghi chú `PHÂN VÂN`** trong `labels.csv` kèm lý do — hầu hết là ca "một dòng
  có chữ *và*" (vd `"Nắm vững chế độ kế toán và luật thuế"`). Chấm `DUNG` theo tiền lệ
  `"đàm phán và thuyết phục"` mà `RUBRIC.md` đã chốt sẵn. **Kịch bản xấu nhất:** lật cả 8 dòng
  phân vân đang mang nhãn `DUNG` sang `GOP` thì precision tụt còn **0.714** và F1 còn **0.796**
  — vẫn nằm trong mức "chấp nhận được" của ngưỡng. Biên độ 0.714–0.841 chính là **độ nhạy của
  phép đo với người chấm**; nói ra trước còn hơn để hội đồng tự tính.
- Nhãn thô ở `out/baseline/labels.csv` + `missing.csv`, tổng hợp ở `rubric_summary.csv`.

---

## Hạn chế

- Tin tuyển dụng **do người làm đề tài soạn**, không phải tin thật của doanh nghiệp.
- **10 tin là ít** — đủ để so hai phiên bản prompt và thấy lỗi hệ thống, không đủ để tuyên
  bố một tỉ lệ chính xác tới phần trăm.
- Chỉ số tầng 1 là **heuristic**: `la_giay_to()` dò theo từ khóa, `la_gop()` chỉ đếm dấu
  phẩy và chữ "và" nên có báo nhầm (vd `"Kỹ năng đàm phán và thuyết phục"` bị tính là gộp
  dù gần như là một kỹ năng). Vì vậy tỉ lệ gộp 25-29% **không nên trích như con số lỗi** —
  nó dùng để so giữa các phiên bản, nơi cùng sai số xuất hiện ở cả hai bên.
- Số thời gian là **GPU**, xem cảnh báo đầu file.
