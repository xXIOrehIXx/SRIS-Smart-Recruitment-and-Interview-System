# Kết quả — chất lượng bản TÓM TẮT CV (đo 07/09/2026)

Model `qwen3:8b` · `temperature=0` · `num_ctx=12288` · GPU RTX 5060 · 10 CV × 4 bậc × 2 lượt
= 80 lượt gọi. Lượt 1 là lượt đem đi chấm; lượt 2 chỉ dùng đo độ ổn định.

> **Đây là thí nghiệm bóc lớp (ablation), không phải nhật ký cải tiến.** V4 là prompt đang
> chạy thật; V1–V3 là bản rút gọn của chính nó, dựng ra để đo "bỏ lớp này thì tệ hơn bao
> nhiêu". V1–V3 chưa từng chạy trong sản phẩm. Xem `prompts.py`.

---

## 1. Tầng máy — 4 bậc

| Bậc | Thêm gì | JSON hợp lệ | Đúng khuôn 3-5 câu | CV có **số lạ** | Sáo rỗng | Bỏ sót mốc | Số câu TB | Ổn định | Giây/CV |
|---|---|---|---|---|---|---|---|---|---|
| V1 | (gốc) bảo tóm tắt, hết | 100% | 90% | **3/10** (4 số) | 0,067 | 48,6% | 3,4 | 0,866 | 3,3 |
| V2 | + ràng buộc JSON schema | 100% | **40%** | 3/10 (3 số) | **0,166** | 45,9% | **9,4** | **1,000** | 8,2 |
| V3 | + luật chống bịa | 100% | 80% | **5/10** (5 số) | **0** | **37,8%** | 4,8 | 0,869 | 5,4 |
| **V4** | + luật riêng của bản tóm tắt | 100% | **90%** | **2/10** (2 số) | **0** | 51,4% | 3,4 | 0,822 | 7,9 |

**"Số lạ" = con số xuất hiện trong bản tóm tắt nhưng KHÔNG có trong CV.** Đây là phép đo
đáng giá nhất của tầng máy: tóm tắt là *kể lại*, nên mọi con số bắt buộc phải truy được về
CV gốc. Con số lạ = model hoặc tự tính, hoặc bịa. Cả hai đều là lỗi, và cả hai đều **máy tự
bắt được không cần người đọc**.

---

## 2. Bốn điều rút ra

### 2.1 Ràng buộc schema KHÔNG cứu JSON — cột đó phẳng lì 100% ở cả 4 bậc

Y hệt kết luận của thí nghiệm bóc tiêu chí: model đã trả JSON đúng ngay cả khi không ép.
Nếu chỉ nhìn cột này thì không phân biệt được bậc nào hơn bậc nào — đó chính là lý do phải
có các phép đo khác, và xa hơn là phải có tầng người.

### 2.2 Schema một mình làm bản tóm tắt TỆ ĐI

Đây là kết quả ngược trực giác nhất của cả bộ, nên nói rõ.

`_LlmDraft.summary` khai `max_length=1500`. Ép schema mà **không kèm luật viết** thì con số
1500 trở thành *chỉ tiêu* chứ không phải *trần*: số câu trung bình nhảy từ 3,4 lên **9,4**,
tỉ lệ đúng khuôn 3-5 câu rơi từ 90% xuống **40%**, và tỉ lệ câu sáo rỗng **tăng gấp 2,5 lần**
(0,067 → 0,166) vì model phải viết cho đủ dài nên độn thêm lời khen chung chung.

Đổi lại V2 là bậc duy nhất **ổn định tuyệt đối 1,000** giữa hai lượt — đúng tác dụng tất
định hoá mà thí nghiệm bóc tiêu chí cũng đo được.

> **Bài học:** ràng buộc định dạng không thay được luật viết. Nó ép được *hình dạng*, còn
> *nội dung* thì phải dặn.

### 2.3 Luật chống bịa dập được câu sáo rỗng, nhưng KHÔNG dập được số bịa

V3 đưa tỉ lệ sáo rỗng về **0** và giữ nguyên tới V4 — luật "chỉ dùng thông tin có trong CV"
đủ để model thôi viết "ứng viên tiềm năng, ham học hỏi".

Nhưng số CV có số lạ lại **tăng lên 5/10** — cao nhất trong cả 4 bậc. Vì luật chống bịa nói
về *thông tin*, còn model không coi việc **cộng mốc thời gian ra số năm** là bịa: nó nghĩ nó
đang tính toán từ dữ liệu có sẵn. Ca `C06` (text PDF dính chữ) thậm chí đẻ ra số `9` không
có trong CV.

Phải tới **V4** — bậc có câu lệnh thẳng *"KHÔNG TỰ TÍNH SỐ NĂM KINH NGHIỆM"* — số CV có số
lạ mới xuống **2/10**, thấp nhất cả bộ.

> **Bài học:** luật tổng quát ("đừng bịa") không chặn được lỗi cụ thể. Câu lệnh chặn được
> lỗi tự cộng số năm chỉ viết ra được sau khi **ngồi đọc đầu ra hỏng thật**. Chênh lệch
> V3→V4 chính là giá trị của việc đọc đầu ra, không phải của việc nghĩ thêm luật.

### 2.4 V4 gọn hơn và đúng hơn, nhưng nhắc ít dữ kiện hơn — đánh đổi có thật

V4 bỏ sót mốc **51,4%**, cao hơn V3 (37,8%). Lý do nhìn thấy được: V4 viết 3,4 câu, V3 viết
4,8 câu — dài hơn thì nhắc được nhiều thứ hơn.

Không coi đây là lỗi của V4 vì bản tóm tắt sinh ra để **đọc thay việc mở file CV**: một bản
5 câu đúng có ích hơn một bản 9 câu trong đó có câu sai. Nhưng phải ghi ra, và **con số
51,4% này là của phép đo máy rất thô** (khớp từ khoá — không nhận ra "làm backend từ 2019"
và "phát triển API từ năm 2019" là cùng một mốc). Recall thật phải chấm tay.

---

## 3. Khiếm khuyết CÒN LẠI của prompt production (V4)

Nêu trước còn hơn để hội đồng tự tìm ra.

### 3.1 Vẫn tự cộng ra số năm ở ca `C09` — cả 4 bậc đều sai

CV của Trịnh Thu Hà **không câu nào ghi số năm**, chỉ có hai khoảng: `05/2016 - 07/2020` và
`09/2022 - nay`, cùng một dòng ghi rõ nghỉ chăm con 2 năm ở giữa.

Cả bốn bậc, **kể cả V4**, đều viết ra *"có kinh nghiệm 4 năm trong lĩnh vực C&B"*:

> **V4:** "Trịnh Thu Hà là chuyên viên nhân sự có kinh nghiệm **4 năm** trong lĩnh vực C&B,
> làm việc tại Công ty TNHH May mặc Tiến Thành từ 2022 đến nay."

Con số 4 không có trong CV. Tệ hơn: nó **bỏ mất hẳn giai đoạn 2016–2020**, nên câu này vừa
sai số vừa thiếu. Luật cấm tự cộng số năm **có tác dụng khi CV chỉ có MỘT mốc** (ca `C01`:
V1 bịa "5 năm", V4 viết đúng "từ năm 2019 đến nay") nhưng **thua khi CV có nhiều mốc rời**.

Ca `C04` (CV trái ngành) cũng còn một số lạ.

### 3.2 Vì sao vẫn giữ V4

Nó là bậc tốt nhất ở **cả ba** phép đo quan trọng — ít số lạ nhất (2/10), sáo rỗng 0, đúng
khuôn 3-5 câu cao nhất (90%) — và là bậc duy nhất vừa gọn vừa không độn.

Hai chỗ đáng làm tiếp, **chưa làm**:
- Thêm luật riêng cho ca **CV nhiều mốc rời** (mục 3.1).
- Cân nhắc nới độ dài lên 4-6 câu để đỡ bỏ sót, rồi **đo lại** — chưa đo thì chưa được đổi.

---

## 4. Tầng người — CHƯA CHẤM

Precision / Recall / F1 **chỉ ra được từ tầng người**, và nhãn phải do **người làm đề tài**
gán, không nhờ mô hình chấm hộ: cùng một điểm mù sẽ vừa gây ra lỗi vừa bỏ qua lỗi đó lúc
chấm, số đẹp lên mà không ai biết vì sao (xem đầu file `2_nguoi_cham_dien_nhan.py`).

Phiếu chấm đã sinh sẵn và còn trống: `out/<ver>/nguoi_cham_tung_cau.csv` (mỗi **câu** một
dòng, tổng 4 bậc) và `out/<ver>/nguoi_cham_bo_sot.csv`. Luật chấm ở `LUAT_NGUOI_CHAM.md`.

**Số ở mục 1 dùng được ngay** — tầng máy chỉ đếm và đối chiếu chuỗi, không phán xét nội dung.

---

## 5. Hạn chế của phép đo — phải ghi trong báo cáo

- **CV do người làm đề tài soạn**, không phải hồ sơ thật: vừa vì dữ liệu cá nhân, vừa để cài
  được ca bẫy có đáp án biết trước. Model có thể xử lý CV thật khác đi.
- **10 CV là ít.** Chênh lệch 1 CV đã là 10% trên mọi tỉ lệ trong bảng.
- **Phép "bỏ sót mốc" của máy rất thô** — khớp từ khoá, không hiểu diễn đạt khác.
- **Đo trên GPU (RTX 5060)**, không phải CPU như máy demo. Cột giây/CV không dùng để hứa
  hiệu năng lúc chạy thật.
- Tầng người chưa chấm nên chưa có Precision / Recall / F1.
