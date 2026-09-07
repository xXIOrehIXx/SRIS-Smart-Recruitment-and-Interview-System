# Thí nghiệm 2 — chất lượng bản TÓM TẮT CV

**Đây KHÔNG phải code chạy trong sản phẩm.** `GP35.SRIS.sln` không tham chiếu gì ở đây —
xoá cả thư mục thì hệ thống vẫn build và chạy bình thường.

Cùng khuôn với `exp_criteria_extract/` (đọc thư mục đó trước nếu chưa quen), nhưng đo một
tính năng khác: **trường `summary` của lượt sàng lọc CV** (`/screen-cv`, V044) — đoạn văn
người tuyển dụng đọc **thay cho** việc mở file CV.

Trả lời hai câu:

1. **Bản tóm tắt AI viết có dùng được không?** Nó có bịa không?
2. **Mỗi thành phần trong prompt đóng góp bao nhiêu?** Bỏ nó đi thì tệ hơn bao nhiêu?

---

## 1. Vì sao đo phần này riêng

`/screen-cv` trả về 5 thứ: `summary` · `matched` (kèm trích dẫn) · `missing` · `fit_score` ·
`decision`. Bốn thứ sau đã có **dây neo bằng máy** ngay trong sản phẩm:

- `matched` bị `_verify()` bên `ai-service/cv_screening.py` đối chiếu từng trích dẫn với CV
  thật, trích dẫn bịa là bị đẩy xuống `missing`;
- `decision` bị code ép lại theo `fit_score`, model không được tự viết.

**`summary` là trường DUY NHẤT model được viết tự do và không có gì kiểm.** Nó cũng là thứ
người dùng đọc đầu tiên và tin nhiều nhất. Nên nếu chỉ đo được một chỗ thì đo chỗ này.

---

## 2. Hai tầng đo

| | Ai làm | Đo được gì | Đo KHÔNG được gì |
|---|---|---|---|
| **Tầng máy** | Script tự chạy | JSON hợp lệ · số câu · **số lạ** · sáo rỗng · chê định dạng · ổn định · giây | **Bản tóm tắt có ĐÚNG không** |
| **Tầng người** | **Người ngồi chấm tay** | Precision / Recall / F1 · sai kiểu gì | — |

**Phép đo "số lạ" là chỗ thí nghiệm này ăn hơn thí nghiệm bóc tiêu chí.** Tóm tắt là *kể
lại*, nên mọi con số trong bản tóm tắt bắt buộc phải có mặt trong CV gốc. Máy đối chiếu
được chính xác, không cần người đọc — hiếm khi máy bắt được lỗi **nội dung** như vậy.

> ⚠️ **Nhãn tầng người phải do NGƯỜI gán.** Nhờ mô hình ngôn ngữ chấm đầu ra của mô hình
> ngôn ngữ là lập luận vòng tròn: cùng một điểm mù (đọc "03/2019 đến nay" thành "5 năm")
> vừa gây ra lỗi vừa bỏ qua lỗi đó lúc chấm. Hội đồng hỏi "ai gán nhãn" thì câu trả lời
> phải là một cái tên người.

---

## 3. Bốn bậc prompt

Mỗi bậc thêm **đúng một lớp** — có vậy chênh lệch mới quy được cho một nguyên nhân.

| Ver | Thêm gì | Câu hỏi nó trả lời |
|---|---|---|
| **V1** | Bảo tóm tắt, hết. Không luật, **không ép JSON** | Ném CV cho model thì được gì? |
| **V2** | **+ ràng buộc JSON schema** (Pydantic) & `temperature=0`. Câu chữ giữ nguyên V1 | Ép khuôn đầu ra thì được gì? |
| **V3** | **+ luật chống bịa**: chỉ dùng chữ trong CV · không suy diễn · bỏ qua lỗi PDF | Dặn "đừng bịa" là đủ chưa? |
| **V4** | **+ luật riêng của bản tóm tắt**: 3-5 câu · dựng chân dung nghề nghiệp · **cấm tự cộng số năm** · cấm viết chung chung = **prompt production** | Luật cụ thể hơn luật tổng quát bao nhiêu? |

### ⚠️ Gọi đúng tên khi báo cáo

Đây là **thí nghiệm bóc lớp (ablation)** — lấy prompt production rồi gỡ dần từng lớp.
**KHÔNG phải nhật ký cải tiến của nhóm:** V1/V2/V3 chưa từng chạy trong sản phẩm.

- ✅ "Đóng góp của từng thành phần trong prompt"
- ❌ ~~"Quá trình cải tiến prompt qua các phiên bản"~~ ← hội đồng hỏi *"commit nào là V1?"* là lộ

V4 **không được chép lại** trong thư mục này — `prompts.py` import thẳng từ
`ai-service/cv_screening.py`, để không bao giờ đo nhầm một bản prompt đã cũ.

---

## 4. Kết quả tầng máy (đo 07/09/2026)

| Bậc | JSON hợp lệ | Đúng khuôn 3-5 câu | CV có **số lạ** | Sáo rỗng | Bỏ sót mốc | Số câu TB | Ổn định | Giây/CV |
|---|---|---|---|---|---|---|---|---|
| V1 | 100% | 90% | 3/10 | 0,067 | 48,6% | 3,4 | 0,866 | 3,3 |
| V2 | 100% | **40%** | 3/10 | **0,166** | 45,9% | **9,4** | **1,000** | 8,2 |
| V3 | 100% | 80% | **5/10** | **0** | **37,8%** | 4,8 | 0,869 | 5,4 |
| **V4** | 100% | **90%** | **2/10** | **0** | 51,4% | 3,4 | 0,822 | 7,9 |

**V4 là bản tốt nhất** — ít số lạ nhất, sáo rỗng bằng 0, giữ khuôn tốt nhất.

Ba điều rút ra (chi tiết + trích dẫn thật ở `out/KET_QUA.md`):

- **Ràng buộc schema không cứu JSON** (100% ở cả 4 bậc) — nhưng nó **tất định hoá** (ổn định
  0,866 → 1,000), đúng như thí nghiệm bóc tiêu chí đã thấy.
- **Schema một mình làm bản tóm tắt TỆ ĐI.** `max_length=1500` biến thành *chỉ tiêu*: 3,4 →
  **9,4 câu**, sáo rỗng **tăng 2,5 lần**. Ràng buộc định dạng ép được *hình dạng*, không thay
  được *luật viết*.
- **Luật tổng quát không chặn được lỗi cụ thể.** V3 dặn "đừng bịa" → dập sạch câu sáo rỗng
  (0,067 → 0) nhưng **số bịa lại tăng** (3 → 5 CV), vì model không coi việc cộng mốc thời
  gian ra số năm là bịa. Phải tới câu lệnh thẳng *"KHÔNG TỰ TÍNH SỐ NĂM"* của V4 mới xuống
  2/10. **Chênh lệch V3→V4 là giá trị của việc ngồi đọc đầu ra hỏng, không phải của việc
  nghĩ thêm luật.**

**Khiếm khuyết còn lại của V4** (chi tiết ở `out/KET_QUA.md` mục 3): ca `C09` — CV có **hai
mốc rời** và một khoảng nghỉ, cả 4 bậc kể cả V4 đều tự cộng thành *"4 năm kinh nghiệm"* và
bỏ mất giai đoạn 2016–2020. Luật cấm tự cộng số năm chỉ ăn khi CV có **một** mốc.

**Tầng người: chưa chấm.** Xem mục 6.

---

## 5. Bộ test

10 CV trong `dataset.json`, mỗi CV kèm một tin tuyển dụng. Bảy ca thường, ba ca cố tình khó:

| CV | Bẫy | Kết quả đúng phải là |
|---|---|---|
| `C01_khong_ghi_so_nam` | CV chỉ có mốc thời gian, không câu nào ghi số năm | Nhắc mốc ("từ 2019"), **không** tự chế ra số năm ✅ V4 làm đúng |
| `C03_fresher_mong` | CV gần như không có gì để kể | Ngắn, nói thẳng là chưa có kinh nghiệm ✅ |
| `C04_trai_nganh` | CV kinh doanh nộp vào vị trí IT | Kể đúng là dân kinh doanh, không xoay cho giống dân IT |
| `C06_text_pdf_lon_xon` | Text PDF dính chữ, mất dấu câu | Kể nội dung, **không** than phiền định dạng ✅ cả 4 bậc làm đúng |
| `C07_song_ngu` | CV phần lớn tiếng Anh | Tóm tắt vẫn phải bằng tiếng Việt |
| `C09_khoang_trong_su_nghiep` | Hai mốc rời + khoảng nghỉ 2 năm | Giữ đủ hai giai đoạn, không tự cộng ❌ **cả 4 bậc đều sai** |
| `C10_liet_ke_cong_nghe` | Rừng công nghệ liệt kê nhưng kinh nghiệm nói chung chung | Không biến dòng liệt kê thành "đã triển khai" |

CV **do người làm đề tài soạn**, không phải hồ sơ thật — vừa vì dữ liệu cá nhân, vừa để cài
được ca bẫy có đáp án biết trước. Hạn chế này phải nói rõ trong báo cáo.

**Không sửa `dataset.json` giữa các lần chạy** — đổi bộ test thì các bậc hết so được.

---

## 6. Cách chạy

Cần **Ollama đang chạy** và đã `ollama pull qwen3:8b`. Dùng Python trong venv của ai-service:

```powershell
cd Development\backend\ai-experiments\exp_cv_summary

# Chạy cả 4 bậc, mỗi CV 2 lượt  (80 lượt gọi model, ~12 phút trên RTX 5060)
..\..\ai-service\.venv\Scripts\python.exe 1_chay_model_va_may_cham.py --all --repeat 2

# Thêm phép đo mới -> tính lại từ dữ liệu cũ, KHÔNG gọi model
..\..\ai-service\.venv\Scripts\python.exe 1_chay_model_va_may_cham.py --all --recompute

# Sau khi gán nhãn tay
..\..\ai-service\.venv\Scripts\python.exe 2_nguoi_cham_dien_nhan.py
..\..\ai-service\.venv\Scripts\python.exe 3_nguoi_cham_tinh_diem.py --all
..\..\ai-service\.venv\Scripts\python.exe 4_gop_ket_qua_excel.py
```

> Lượt gọi **đầu tiên** chậm hơn hẳn vì Ollama nạp model vào bộ nhớ. Đừng lấy con số thời
> gian của lượt đó đưa vào báo cáo.

### Chấm tay (tầng người) — việc còn lại

1. Đọc **`LUAT_NGUOI_CHAM.md`** — 5 mã (`DUNG` / `BIA` / `SUYDIEN` / `SAISO` / `SAORONG`),
   ranh giới khi phân vân, và ngưỡng Tốt/Chấp nhận được/Cần cải thiện (chốt trước khi đo).
2. Mở `out/<ver>/nguoi_cham_tung_cau.csv` — mỗi **câu** một dòng — đối chiếu với CV trong
   `dataset.json`.
3. Điền nhãn vào bảng `NHAN` trong **`2_nguoi_cham_dien_nhan.py`**, KHÔNG gõ thẳng vào CSV
   (chạy lại script 1 là mất sạch).
4. Đếm mốc bỏ sót vào `out/<ver>/nguoi_cham_bo_sot.csv`. **Bỏ qua bước này thì recall vĩnh
   viễn bằng 1 và cả bộ số trông đẹp một cách vô nghĩa.**

---

## 7. File nào là gì

Tên file nói luôn nó thuộc tầng nào: **`may_cham_*` = máy tự đo · `nguoi_cham_*` = người
chấm tay**. Bốn script có số ở đầu là **thứ tự chạy**.

| # | Script | Tầng | Làm gì |
|---|---|---|---|
| 1 | `1_chay_model_va_may_cham.py` | 🤖 | Gọi model 4 bậc → `raw.json` + đo tầng máy + sinh phiếu chấm tay trống |
| 2 | `2_nguoi_cham_dien_nhan.py` | 🧑 | **Bảng nhãn** — ghi vào 4 thư mục. **Sửa nhãn thì sửa ở đây** |
| 3 | `3_nguoi_cham_tinh_diem.py` | 🧑 | Nhãn → Precision / Recall / F1 + phân rã lỗi |
| 4 | `4_gop_ket_qua_excel.py` | 🤖+🧑 | Gộp tất cả vào **một** file Excel |

| File dùng chung | Nội dung |
|---|---|
| `dataset.json` | 10 CV + JD — **không sửa giữa các lần chạy** |
| `prompts.py` | 4 bậc prompt (V4 nạp thẳng từ `ai-service/cv_screening.py`) |
| `may_cham.py` | Các phép đo máy (số lạ, sáo rỗng, đếm câu, ổn định, mốc thiếu) |
| `LUAT_NGUOI_CHAM.md` | 5 mã + ranh giới + ngưỡng — đọc trước khi chấm |

| Kết quả trong `out/` | Nội dung |
|---|---|
| `out/KET_QUA.md` | ⭐ **Đọc file này trước** — kết quả, trích dẫn thật, khiếm khuyết còn lại, hạn chế |
| `out/KET_QUA_TONG_HOP.xlsx` | 5 tab: `DocTruoc` · `TongHop` · `TheoTin` · 2 tab chấm tay |
| `out/may_cham_4_ban.csv` | Bảng so 4 bậc — file để vẽ biểu đồ |
| `out/<ver>/may_cham.csv` | Số đo máy từng CV |
| `out/<ver>/nguoi_cham_tung_cau.csv` | Phiếu chấm tay — mỗi câu một dòng |
| `out/<ver>/nguoi_cham_bo_sot.csv` | Mỗi CV một dòng: bỏ sót mấy mốc (mẫu số của recall) |
| `out/<ver>/raw.json` | Đầu ra thô, giữ để `--recompute` và đối chiếu khi nghi ngờ |

---

## 8. Nguyên tắc phải giữ

- **Lượt 1 là lượt đem đi chấm**, không chọn lượt "đẹp nhất".
- **Ngưỡng chốt TRƯỚC khi đọc số** (`LUAT_NGUOI_CHAM.md`), lấy của nguồn ngoài để khỏi bị
  nghi gọt cho vừa.
- **Không sửa `dataset.json` giữa các lần chạy.**
- **Nhãn tầng người do người gán**, không nhờ mô hình chấm hộ.
- **Hạn chế phải viết ra**: CV tự soạn · 10 CV là ít · một người gán nhãn · đo trên GPU chứ
  không phải CPU · phép "bỏ sót mốc" của máy rất thô.
