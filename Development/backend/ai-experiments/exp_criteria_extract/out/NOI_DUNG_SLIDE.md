# Nội dung slide — Phần đánh giá AI của SRIS

> **File này để COPY gửi cho Claude chat / Claude design.** Mọi con số đã đối chiếu với
> `out/KET_QUA.md` và `out/KET_QUA_TONG_HOP.xlsx` ngày 14/08/2026. Đừng sửa số bằng tay —
> sửa thì phải chạy lại `3_nguoi_cham_tinh_diem.py` rồi cập nhật cả hai nơi.
>
> **Bố cục bám theo 5 slide tham khảo của nhóm SmartHR** (`AI_TESTING_REFERENCE.md`), trừ
> slide "so sánh model" — xem lý do ở cuối file.

---

## PROMPT GỬI KÈM (dán khối này trước, rồi dán nội dung slide bên dưới)

```
Làm bộ slide cho phần "Đánh giá chất lượng AI" trong buổi bảo vệ đồ án tốt nghiệp.
6 slide, tiếng Việt, khổ 16:9.

Bối cảnh: hệ thống tuyển dụng SRIS có đúng một tính năng AI — đọc tin tuyển dụng
rồi bóc ra danh sách tiêu chí đánh giá ứng viên. Model chạy CỤC BỘ trên máy công ty
(Ollama + qwen2.5 7B), không gọi API ngoài.

Người xem là hội đồng chấm đồ án, không phải kỹ sư AI. Ưu tiên: mỗi slide một ý,
bảng số phải đọc được từ xa, tránh chữ nhỏ dày đặc.

Phong cách: sạch, chuyên nghiệp, dùng màu nhấn cho con số quan trọng. Slide 5 cần
một biểu đồ đường 3 đường (Precision / Recall / F1) qua 4 mốc.
```

---

# SLIDE 1 — Khung đánh giá: 4 bước

**Tiêu đề:** Đo chất lượng AI như thế nào

**Sơ đồ ngang 4 khối, có mũi tên nối:**

```
Bộ test cố định  →  4 bậc prompt  →  Tầng máy đo  →  Tầng người chấm  →  P / R / F1
   10 tin JD         mỗi bậc            tự động           rubric 6 mã
   đa ngành        thêm 1 lớp
```

**Bốn dòng giải thích, mỗi khối một dòng:**

| Bước | Làm gì |
|---|---|
| 1. Bộ test cố định | 10 tin tuyển dụng đa ngành, **không đổi giữa các lần chạy** — đổi bộ test thì các phiên bản hết so được với nhau |
| 2. Bốn bậc prompt | Mỗi bậc chỉ thêm **đúng một lớp** so với bậc dưới, nên chênh lệch số đo quy được cho một nguyên nhân |
| 3. Tầng máy | Script tự đếm: JSON có hợp lệ không, bao nhiêu dòng "giấy tờ", chạy lại có ra giống không, nhanh chậm |
| 4. Tầng người | Người đọc từng tiêu chí, gán 1 trong 6 nhãn → ra Precision / Recall / F1 |

**Con số đóng khung góc slide:**
`10 tin × 2 lượt × 4 bậc = 80 lượt gọi model · 299 tiêu chí chấm tay`

**Ghi chú thuyết trình:** Nhấn "bộ test cố định" và "mỗi bậc một lớp" — đó là hai điều kiện
để con số có nghĩa. Không có chúng thì bảng kết quả chỉ là số đẹp.

---

# SLIDE 2 — Vì sao cần cả máy chấm lẫn người chấm

**Tiêu đề:** Hai tầng đo — mỗi tầng có điểm mù riêng

**Bảng 2 dòng (đây là bảng chính của slide):**

| | Ai làm | Đo được | ĐIỂM MÙ |
|---|---|---|---|
| **Tầng máy** | Script tự chạy | Dòng "giấy tờ" · dòng gộp kỹ năng · dòng trùng · vượt trần · hai lượt có giống nhau không · giây/tin | **Không biết một tiêu chí có DÙNG ĐƯỢC hay không** |
| **Tầng người** | Người đọc, chấm theo rubric | Precision · Recall · F1 · sai kiểu gì | Không lặp lại được · không đo nổi độ ổn định |

**Khối bằng chứng (đặt dưới bảng, nền nhạt):**

> **Bằng chứng cho thấy chỉ đo máy là không đủ:** chỉ số "JSON hợp lệ" đạt **100% ở cả 4 bậc
> prompt** — phẳng lì, không phân biệt nổi bậc nào hơn bậc nào. Trong khi Precision ở tầng
> người chạy từ **0,588 lên 0,833** qua đúng 4 bậc đó.

**Ghi chú thuyết trình:** Câu chốt — *"Máy đếm được dòng nào chứa chữ 'bằng cấp', nhưng máy
không biết dòng 'Kỹ năng đàm phán' là tiêu chí tốt còn 'Báo cáo doanh số hàng tuần' là đầu
việc. Phải có người đọc mới phán được."*

---

# SLIDE 3 — Chấm thế nào: rubric, công thức, ngưỡng

**Tiêu đề:** Chấm theo luật · Công thức · Ngưỡng chốt trước khi đọc số

**Bố cục đề xuất:** chia dọc làm 3 khối. Khối A hẹp bên trái, khối B rộng ở giữa (đây là
trọng tâm slide), khối C bên phải. Hai khối cảnh báo nằm ngang bên dưới cả ba.

---

## KHỐI A — Sáu nhãn, và mỗi nhãn rơi vào ô nào

Người chấm đọc từng tiêu chí AI đề xuất rồi gán **đúng một** trong 6 mã:

| Mã | Nghĩa | Rơi vào ô |
|---|---|---|
| `DUNG` | Tiêu chí dùng được — có căn cứ trong tin, phải gặp người mới biết, một dòng một kỹ năng | **TP** |
| `BIA` | AI tự nghĩ ra, không có trong tin | FP |
| `DAUVIEC` | Là việc sẽ làm sau khi vào công ty, không phải yêu cầu với ứng viên | FP |
| `GIAYTO` | Cầm hồ sơ lên đọc là biết (bằng cấp, chứng chỉ, tuổi, nơi ở) | FP |
| `GOP` | Nhồi nhiều kỹ năng vào một dòng — không cho điểm được | FP |
| `TRUNG` | Trùng nghĩa với một dòng khác trong cùng tin | FP |
| *(không có dòng nào)* | **Bỏ sót** — yêu cầu đáng lấy mà AI quên không nêu | **FN** |

> **`TN` không tồn tại trong bài toán này** — xem khối cảnh báo cuối slide.

---

## KHỐI B — Ba công thức, kèm số thật của V4

Ba dòng công thức, mỗi dòng gồm: **tên · công thức chữ · phép tính thật · kết quả**.
Để số thật ngay cạnh công thức, đừng tách sang slide khác — hội đồng nhìn một lần là hiểu.

**1. Precision — "AI nói ra thì bao nhiêu phần dùng được"**

```
Precision = DUNG / tổng số tiêu chí AI đề xuất
          = 60 / 72
          = 0,833
```
Đọc là: AI đề xuất 100 dòng thì khoảng 83 dòng xài được, 17 dòng người duyệt phải xoá.

**2. Recall — "thứ đáng lấy thì AI lấy được bao nhiêu"**

```
Recall = DUNG / (DUNG + bỏ sót)
       = 60 / (60 + 4)
       = 0,938
```
Đọc là: tin tuyển dụng đáng lẽ cho ra 64 tiêu chí, AI vớt được 60, quên 4.

**3. F1 — gộp hai số trên thành một để còn so được giữa 4 bậc**

```
F1 = 2 × Precision × Recall / (Precision + Recall)
   = 2 × 0,833 × 0,938 / (0,833 + 0,938)
   = 0,882
```

---

## KHỐI C — Ngưỡng đánh giá

| Chỉ số | Tốt | Chấp nhận được | Cần cải thiện | **V4 đạt** |
|---|---|---|---|---|
| Precision | ≥ 0,85 | 0,70 – 0,84 | < 0,70 | 0,833 → *Chấp nhận được* |
| Recall | ≥ 0,85 | 0,70 – 0,84 | < 0,70 | **0,938 → Tốt** |
| F1 | ≥ 0,85 | 0,70 – 0,84 | < 0,70 | **0,882 → Tốt** |

Gợi ý trình bày: tô 3 mức bằng 3 màu (xanh / vàng / đỏ) và đánh dấu vị trí V4 rơi vào đâu.

---

## BỐN KHỐI CẢNH BÁO (đặt dưới, mỗi khối 2–3 dòng)

**1. Vì sao F1 là trung bình ĐIỀU HOÀ, không phải trung bình cộng**

Vì nó phạt nặng khi một trong hai bên thấp. Bảng đối chứng:

| | Precision | Recall | Trung bình cộng | **F1** |
|---|---|---|---|---|
| Model "chỉ nói 1 tiêu chí chắc ăn rồi thôi" | 1,000 | 0,100 | 0,550 *nghe được* | **0,182** *lộ ngay* |
| **V4 của SRIS** | 0,833 | 0,938 | 0,886 | **0,882** |

Trung bình cộng cho một hệ thống vô dụng số 0,55 — trông còn tạm. F1 cho nó 0,18, đúng bản chất.

**2. Vì sao phải đếm "bỏ sót" riêng**

Phiếu chấm chỉ chứa những dòng AI **đã** nói ra. Thứ nó **quên** thì không có dòng nào để chấm
— phải mở tin gốc đọc lại mà đếm. Bỏ qua bước này thì **recall vĩnh viễn bằng 1** và cả bộ số
trông đẹp một cách vô nghĩa.

**3. Vì sao KHÔNG có Accuracy và FPR**

Bài toán này là **bóc thông tin**, không phải phân loại. Không tồn tại "true negative" —
không ai đếm được số tiêu chí mà AI **đúng khi không nêu ra**. Mà cả Accuracy lẫn FPR đều cần
`TN` trong công thức. Bê nguyên hai chỉ số đó sang là sai bản chất bài toán, nên SRIS chỉ báo
cáo **Precision / Recall / F1**.

**4. Ngưỡng không do nhóm tự đặt**

Lấy nguyên khung ngưỡng của một nhóm capstone khác và **chốt TRƯỚC khi chạy số**. Ngưỡng tự
đặt sau khi đã biết kết quả thì luôn bị hỏi *"sao vừa khéo bằng đúng điểm của nhóm?"*.

---

## GHI CHÚ THUYẾT TRÌNH — ba câu hỏi hội đồng hay hỏi

| Hỏi | Trả lời |
|---|---|
| *"Sao không dùng Accuracy như người ta?"* | Bài toán không có true negative. Dùng Accuracy ở đây là dùng sai công thức, không phải làm ít hơn. |
| *"Precision 0,833 chưa đạt Tốt, có sao không?"* | Trong hệ thống này **recall đắt hơn precision**: tiêu chí AI bóc ra là bản nháp bắt buộc có người duyệt. Dòng thừa thì người duyệt thấy và xoá mất mấy giây; dòng thiếu thì **không ai nhìn thấy gì cả**, không có ô nào báo "tin của bạn còn một yêu cầu chưa thành tiêu chí". Nên ưu tiên recall — và recall đạt 0,938. |
| *"Ai chấm? Có khách quan không?"* | Chấm theo luật viết sẵn trong `LUAT_NGUOI_CHAM.md`, có phần chốt trước các ca ranh giới để hai người chấm ra cùng kết quả. Hạn chế: **chỉ một người chấm** — đã ghi trong slide hạn chế. |

---

# SLIDE 4 — Bốn bậc prompt (thí nghiệm bóc lớp)

**Tiêu đề:** Lớp nào trong prompt thực sự đóng góp?

**Bảng 4 dòng:**

| Bậc | Thêm gì so với bậc dưới | Câu hỏi nó trả lời |
|---|---|---|
| **V1** | Câu lệnh trần — không luật, không ví dụ, không ép định dạng | Ném tin tuyển dụng cho model thì được gì? |
| **V2** | + Ràng buộc JSON schema, `temperature=0`. **Câu chữ giữ nguyên V1** | Ép khuôn đầu ra thì được gì? |
| **V3** | + Luật nghiệp vụ: yêu cầu vs đầu việc · bỏ thứ đọc hồ sơ là biết · tách kỹ năng · trần 10 | Dạy luật có giảm tiêu chí rác không? |
| **V4** | + Khối ví dụ mẫu (few-shot) — **prompt đang chạy thật** | Cho ví dụ cụ thể có hơn nói luật suông không? |

**Khối cảnh báo — BẮT BUỘC có trên slide:**

> ⚠️ Đây là **thí nghiệm bóc lớp (ablation)**: lấy prompt đang chạy rồi **gỡ dần từng lớp**
> để xem lớp nào đáng giá bao nhiêu.
> ✅ Gọi đúng: **"Đóng góp của từng thành phần trong prompt"**
> ❌ Gọi sai: ~~"Quá trình cải tiến prompt qua các phiên bản"~~ — V1/V2/V3 chưa từng chạy
> trong sản phẩm, hội đồng hỏi *"commit nào là V1?"* là lộ ngay.

**Ghi chú thuyết trình:** V4 không được chép lại trong bộ đo — nó `import` thẳng từ mã nguồn
đang chạy, nên số của V4 đúng là số của sản phẩm thật.

---

# SLIDE 5 — Kết quả

**Tiêu đề:** Kết quả 4 bậc — 299 tiêu chí chấm tay

**Bảng chính (tô đậm dòng V4):**

| Bậc | Tiêu chí đề xuất | Dùng được | Bỏ sót | Precision | Recall | **F1** |
|---|---|---|---|---|---|---|
| V1 | 80 | 47 | 1 | 0,588 | 0,979 | 0,734 |
| V2 | 80 | 51 | 1 | 0,637 | 0,981 | 0,773 |
| V3 | 67 | 53 | 5 | 0,791 | 0,914 | 0,848 |
| **V4 (đang chạy)** | **72** | **60** | **4** | **0,833** | **0,938** | **0,882** |

**Biểu đồ đường — 3 đường, trục X là V1→V4, trục Y từ 0,50 đến 1,00:**

```
Precision:  0,588  →  0,637  →  0,791  →  0,833
Recall:     0,979  →  0,981  →  0,914  →  0,938
F1:         0,734  →  0,773  →  0,848  →  0,882
```

**Ba câu kết luận (đặt cạnh biểu đồ):**

- **V1 → V2** (ép định dạng): precision gần như đứng yên. Cái nó ăn nằm chỗ khác — **độ ổn
  định 0,983 → 1,000** và cưỡng chế trần 10 dòng.
- **V2 → V3** (luật nghiệp vụ): precision nhảy **0,637 → 0,791** vì quét sạch nhóm lỗi "biến
  đầu việc thành tiêu chí" (11 dòng → 0). **Nhưng recall tụt** — luật cắt hơi tay.
- **V3 → V4** (ví dụ mẫu): **bậc duy nhất kéo lên CẢ HAI chiều.** Đây là luận điểm mạnh nhất
  của cả thí nghiệm.

**Khối kết luận cuối slide:**

> **V4 đạt "Tốt" ở F1 (0,882) và Recall (0,938); Precision 0,833 ở mức "Chấp nhận được".**
> → Giữ prompt hiện tại cho sản phẩm.

**Ghi chú thuyết trình:** Nếu hội đồng hỏi *"vì sao recall quan trọng hơn precision"* — tiêu
chí AI bóc ra là bản nháp có người duyệt: dòng thừa thì người duyệt thấy và xoá mất mấy giây,
dòng thiếu thì **không ai nhìn thấy gì cả**.

---

# SLIDE 6 — Sai kiểu gì, và những gì chưa làm được

**Tiêu đề:** AI sai ở đâu — và hạn chế của phép đo

**Bảng phân rã lỗi:**

| Kiểu lỗi | V1 | V2 | V3 | V4 |
|---|---|---|---|---|
| `BIA` — AI tự bịa | **0** | **0** | **0** | **0** |
| `DAUVIEC` — biến đầu việc thành tiêu chí | 7 | 11 | **0** | **0** |
| `GIAYTO` — thứ đọc hồ sơ là biết | 8 | 5 | 6 | 6 |
| `GOP` — nhiều kỹ năng một dòng | 12 | 10 | 8 | **5** |
| `TRUNG` — trùng dòng khác | 6 | 3 | **0** | 1 |

**Khối nhấn (con số đắt nhất của cả bài):**

> **`BIA` = 0 ở cả 4 bậc — không một dòng nào AI tự nghĩ ra.** Mọi tiêu chí đều truy được về
> câu chữ trong tin tuyển dụng. Đây là số đứng sau tuyên bố *"tiêu chí không do AI nghĩ ra,
> AI chỉ đọc lại tin của bạn"*.

**Khối hạn chế (viết thẳng, đừng giấu):**

- Tin tuyển dụng **do nhóm soạn**, không phải tin thật của doanh nghiệp
- **10 tin là ít** — đủ để so 4 bậc, không đủ để tuyên bố tỉ lệ chính xác tới phần trăm
- **Một người chấm** → chưa đo được độ đồng thuận giữa nhiều người chấm
- Bộ test **đã thay một tin sau khi biết kết quả** (tin tài xế → tin chăm sóc khách hàng);
  số trước khi thay: P 0,846 · R 0,873 · F1 0,859
- Chỉ số tầng máy là **heuristic đếm bằng regex** — dùng để so giữa các bậc, không phải tỉ lệ
  lỗi thật
- Số thời gian đo trên **GPU**, không phải CPU

**Ghi chú thuyết trình:** Slide này là điểm khác biệt so với nhóm tham khảo — họ trình bày như
thể AI luôn thành công. Nêu hạn chế trước còn hơn để hội đồng tự tìm ra; và nó cho thấy nhóm
hiểu phép đo của mình chứ không chỉ đọc số.

---

## Phụ lục — số liệu tầng máy (nếu cần slide phụ hoặc câu hỏi phụ)

| Bậc | Tiêu chí | JSON hợp lệ | Giấy tờ | Gộp kỹ năng | Vượt trần | Ổn định | Giây/tin |
|---|---|---|---|---|---|---|---|
| V1 | 80 | 100% | 8,8% | 33,8% | **3** | 0,983 | 3,5 |
| V2 | 80 | 100% | 5,0% | 35,0% | 0 | **1,000** | 2,5 |
| V3 | 67 | 100% | 9,0% | 35,8% | 0 | 0,974 | 2,3 |
| V4 | 72 | 100% | 8,3% | **29,2%** | 0 | 0,996 | 2,3 |

**Ba ca test đáng kể khi bị hỏi:**

| Tin | Bẫy | Kết quả |
|---|---|---|
| Công nhân sản xuất | Tin **chỉ có đầu việc**, không nêu yêu cầu nào | V1/V2 đẻ **7 tiêu chí rác** · V3/V4 trả **rỗng** ✅ đúng thiết kế |
| Trưởng nhóm phần mềm | **13 yêu cầu**, trần là 10 | V1 đẻ đủ 13 (vượt trần) · V2 trở đi cắt còn 10, và bỏ **đúng** 3 dòng nên bỏ |
| Nhân viên kho | Phần yêu cầu mỏng | V3 cắt quá tay còn 5 · V4 kéo lại 8 — cho thấy ví dụ mẫu chữa được chỗ luật làm hỏng |

---

## Vì sao KHÔNG có slide "so sánh model" như nhóm tham khảo

Nhóm SmartHR có slide so ChatGPT / Claude / Gemini rồi chọn Gemini 2.5 Flash. **SRIS không
làm slide tương đương, có lý do:**

1. **Không phải lựa chọn kỹ thuật mà là ràng buộc.** Dữ liệu ứng viên là dữ liệu cá nhân;
   hệ thống bán cho công ty nhỏ Việt Nam. Model phải chạy **trên máy công ty**, không gửi
   hồ sơ ra API ngoài. Bảng so ChatGPT/Gemini là bảng của bài toán khác.
2. **Chưa đo model local nào khác.** Toàn bộ số liệu trong bộ này chạy trên `qwen2.5` 7B.
   Muốn có bảng so sánh trung thực thì phải chạy lại cả bộ test trên `qwen2.5:14b`,
   `gemma3`, `llama3` rồi mới lập bảng — **chưa làm, nên không dựng bảng đó ra**.

**Nếu muốn có slide này:** chạy lại `1_chay_model_va_may_cham.py` với biến `MODEL` đổi sang
model khác, so trên cùng 10 tin. Tốn khoảng 15–20 phút/model trên GPU. Khi đó bảng so sánh
sẽ có tiêu chí thật: RAM cần, giây/tin, % JSON hợp lệ, và P/R/F1 nếu chấm tay tiếp.

Còn nếu không chạy: thay bằng **một slide ngắn giải thích ràng buộc "AI chạy cục bộ"** —
đây vốn là điểm mạnh của đồ án, không phải chỗ phải né.
