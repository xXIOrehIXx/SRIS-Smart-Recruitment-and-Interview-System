# Việc 11 — Cải tiến AI gen quiz qua 5 version (ghi chú)

## Few-shot là gì?
Few-shot Prompting là kỹ thuật đưa cho AI **2–5 ví dụ mẫu** (câu hỏi kèm đáp án) **trước** yêu cầu chính, để AI học **văn phong, định dạng, quy luật** mình muốn rồi làm theo. Bản chất: "Show, don't tell" — cho xem mẫu thay vì giải thích dài dòng.

## Nguyên tắc thí nghiệm (quy tắc 16.4)
Mỗi version chỉ **đổi đúng 1 yếu tố** so với bản trước, chạy trên **cùng 1 bộ 12 JD cố định**. Nhờ vậy nếu điểm tăng, chỉ ra được **chính xác** cải tiến nào tạo ra mức tăng đó — đó là cái "khoa học" hội đồng muốn thấy (ablation study).

| Version | Yếu tố thêm mới | Mục đích / kỳ vọng |
|---|---|---|
| **v1_baseline** | — (gửi cả JD → xin N câu 1 phát) | Mốc gốc trung thực để đối chiếu |
| **v2_skill_extraction** | Tách 2 bước: trích skill cốt lõi từ JD → gen theo từng skill | Câu bám đúng chuyên môn, hết kiểu "hỏi lại nội dung JD"; JD rác → ít skill → ít câu, không bịa |
| **v3_fewshot** | + 1–2 câu mẫu (few-shot) trong prompt | Model học phong cách ra đề qua ví dụ (chữa các JD kỹ thuật v2 bị tụt) |
| **v4_situational** | + chỉ thị tường minh: ép câu tình huống + distractor dựa lỗi hiểu sai | Đẩy mạnh câu vận dụng thay học vẹt; đáp nhiễu "bẫy" hơn |
| **v5_self_critique** | + lượt AI tự soát & sửa sau khi gen (loại câu bịa, sửa đáp án lộ) | Dọn lỗi còn sót → chất lượng cao nhất (bản "after" so với v1) |

**Mạch cải tiến:** v1 thô → v2 đúng chuyên môn → v3 đúng phong cách → v4 đúng dạng câu (tình huống) → v5 tự dọn lỗi.

**Số liệu auto (% câu tình huống):** 11.7 → 27.9 → 43.2 → 50.4 → 60.4 — **tăng đơn điệu** qua từng bước. Chất lượng thật thì người chấm rubric xác nhận (so v1 vs v5).

---

## Giải thích sâu 4 điểm hay bị hỏi

### 1. v2 — hỏi theo *skill*, không theo *description*
JD vẫn dùng nhưng **đổi vai**: thay vì "đọc JD đẻ câu luôn", chia 2 bước:
- **Bước A:** đọc JD → rút danh sách **skill** cần test (vd JD .NET junior → `["C# OOP", "SQL JOIN", "Entity Framework", ...]`)
- **Bước B:** với **mỗi skill** → gen riêng vài câu cho skill đó.

→ Câu bám vào skill ("Index trong SQL dùng để làm gì?"), không còn dính nội dung JD ("Vị trí này có yêu cầu SQL không?"). JD chỉ là **nguồn để biết cần test cái gì**, không phải đề bài trực tiếp.

**Lợi ích phụ:** JD rác → bước A rút ra ít/không skill → bước B gen ít câu → **không bịa** (lý do `edge_jd_rac` ra 3 câu thay vì 10).

### 2. Few-shot — ai làm? → **Lập trình viên làm sẵn, recruiter KHÔNG đụng**
2 câu mẫu được **dán cứng trong code**, chạy tự động, recruiter không thấy và không phải làm gì. Hai mẫu thật đang nhúng:
- *Ví dụ 1 (kỹ thuật):* "Bảng Orders 1 triệu dòng, lọc theo CustomerId đang quét toàn bảng và chậm. Cách hiệu quả nhất để cải thiện?" → [Tạo index trên CustomerId / Thêm RAM / Bỏ SELECT \* / Chạy ban đêm]
- *Ví dụ 2 (kế toán):* "Doanh nghiệp mua hàng 100 triệu chưa trả tiền. Bút toán đúng?" → [Nợ Hàng hóa / Có Phải trả người bán / …3 đáp sai…]

Model đọc 2 ví dụ → hiểu "đề tốt là kiểu **tình huống có bối cảnh**, không phải hỏi định nghĩa" → tự ra đề theo phong cách đó cho skill hiện tại. **Tuyệt đối không chép lại** 2 ví dụ (ghi rõ trong prompt) — chỉ học *cách đặt câu*. Recruiter vẫn chỉ bấm "Gen quiz" như thường.

### 3. v4 — ép tình huống (nói rõ)
v3 chỉ **làm mẫu**, không ra lệnh. v4 thêm **chỉ thị bắt buộc** vào prompt (text thật):
> **Ràng buộc BẮT BUỘC:**
> - Mỗi câu phải là **TÌNH HUỐNG/BÀI TOÁN thực tế** (mô tả bối cảnh/sự cố rồi hỏi cách xử lý), KHÔNG hỏi định nghĩa thuộc lòng ("X là gì?").
> - 3 phương án sai dựa trên **LỖI HIỂU SAI PHỔ BIẾN** của người mới (nghe hợp lý, dễ chọn nhầm) — KHÔNG sai hiển nhiên/lạc đề.
> - Đáp đúng và đáp sai **cùng độ dài/văn phong**, tránh lộ đáp án qua hình thức.

**Khác biệt:** v3 = "đây là mẫu, nhìn theo" · v4 = "**BẮT BUỘC** phải làm thế này". Mạnh tay hơn → tỉ lệ câu tình huống cao hơn.

**Tác dụng phụ đã thấy:** ép quá → JD rỗng (`edge_jd_rac`) model bịa bối cảnh cho đủ → bật lại 10 câu.

### 4. v5 — AI tự soát lại bài chính nó. Phổ biến không? → **Có, rất phổ biến**
**Cơ chế:** gen xong không trả luôn, mà đưa lại cho model: "đây là câu nháp, soi lại — câu nào học vẹt thì sửa thành tình huống, distractor dở thì thay, câu nào bịa thì **LOẠI**" → model trả bản đã sửa.

Đây là kỹ thuật có tên trong ngành, AI engineer dùng nhiều:
- **Self-Refine / Self-Critique** (model tự phê bình rồi sửa)
- **Reflexion** (tự phản tỉnh qua nhiều vòng)
- Họ hàng với **LLM-as-a-judge** và **self-consistency**

Sản phẩm thật hay dùng vì **rẻ và hiệu quả** (chỉ tốn thêm 1 lượt gọi, không cần train lại).

**Bằng chứng trong dữ liệu:** v5 tự chữa lỗi v4 — `edge_jd_rac` từ 10 câu bịa → soát còn 7; cấu trúc + không-trùng lên 100%.

**Giới hạn (nói thẳng để bảo vệ cho chắc):**
- Không thần thánh — model có **điểm mù** của chính nó; lỗi nó không nhận lúc gen thì lúc soát cũng dễ bỏ sót.
- Tốn **gấp đôi** lượt gọi → chậm (v5 ~45s/JD, gấp đôi v4).
- Vẫn là "AI tự chấm AI" → **không thay được người chấm**. Đó là lý do rubric người chấm vẫn là **trục quyết định**, còn self-critique chỉ là bước **làm sạch** trước khi giao.

---

**Tóm 1 câu:** v2 đổi *cách lấy đề tài* (skill thay vì JD), v3–v4 đổi *cách ra đề* (mẫu → ép lệnh), v5 thêm *bước tự dọn*. Cả 4 đều ở **tầng code**, recruiter không phải làm gì thêm.
