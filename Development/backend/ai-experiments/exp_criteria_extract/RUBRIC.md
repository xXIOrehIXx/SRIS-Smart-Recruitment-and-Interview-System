# Rubric chấm tay — AI đề xuất tiêu chí

Tầng 1 (`metrics.py`) chỉ bắt được lỗi có hình dạng cố định. Còn câu hỏi thật —
*"tiêu chí này có dùng được không?"* — thì phải người đọc mới trả lời được.
File này là luật chấm, để hai người chấm cùng một bộ thì ra cùng một kết quả,
và để chính bạn chấm lại sau một tháng vẫn ra như cũ.

## Chấm thế nào

Mở `out/<tag>/labels.csv`, mỗi dòng là một tiêu chí AI đề xuất. Điền cột `nhan`
bằng **đúng một** trong 6 mã dưới đây. Cột `ghi_chu` để trống cũng được, nhưng
**ca nào phân vân thì bắt buộc ghi lý do** — đó là chỗ người đọc báo cáo sẽ hỏi.

Đọc kèm cột `expect` trong `dataset.json`: nó nói trước mỗi tin *đáng lẽ* ra gì.
Nhưng `expect` là dự đoán của người soạn bộ test, **không phải đáp án** — thấy AI
làm khác mà vẫn hợp lý thì chấm theo cái đúng, rồi sửa `expect` lại.

## Sáu nhãn

| Mã | Nghĩa | Phép thử |
|---|---|---|
| `DUNG` | Tiêu chí dùng được | Thoả **cả ba** điều kiện dưới |
| `BIA` | AI tự nghĩ ra | Đọc kỹ cả 3 mục của tin mà không thấy căn cứ nào |
| `DAUVIEC` | Là việc sẽ làm, không phải yêu cầu | Thứ ứng viên làm **sau khi** vào công ty |
| `GIAYTO` | Đọc hồ sơ là biết | Cầm CV/bằng cấp lên là kết luận được, không cần hỏi |
| `GOP` | Nhồi nhiều kỹ năng một dòng | Muốn cho điểm phải cho **hai** điểm khác nhau |
| `TRUNG` | Trùng dòng khác trong cùng tin | Đã có dòng khác nói cùng một chuyện |

### `DUNG` phải thoả cả ba

1. **Có căn cứ trong tin** — không bịa.
2. **Phải gặp người mới biết** — hỏi, nghe, hoặc quan sát mới kết luận được.
3. **Một dòng một kỹ năng** — cho được đúng một điểm.

Thiếu điều kiện nào thì gán nhãn lỗi tương ứng, đừng gán `DUNG` rồi ghi chú
"nhưng hơi gộp". Nửa điểm không tồn tại ở đây.

### Ranh giới hay gây tranh cãi — chốt trước cho khỏi chấm lệch

- **"Có 2 năm kinh nghiệm kế toán tổng hợp"** → `DUNG`. Con số năm thì CV có thật,
  nhưng thứ đem chấm là *đã làm được gì trong 2 năm đó* — phải hỏi mới biết.
- **"Tốt nghiệp Đại học Kế toán"** → `GIAYTO`. Nhìn bằng là xong.
- **"Có chứng chỉ CPA"** → `GIAYTO`. Có hoặc không, không có mức độ.
- **"Tiếng Anh giao tiếp"** → `DUNG`. Ai cũng ghi được vào CV; nói chuyện hai phút
  mới biết thật. Nhưng **"Có IELTS 6.5"** → `GIAYTO`.
- **"Thành thạo MISA/Fast"** → `DUNG`, **không** phải `GOP`. Dấu `/` ở đây là hai
  biến thể của cùng một thứ (phần mềm kế toán), không phải hai kỹ năng.
- **"Kinh nghiệm Entity Framework, REST API, microservices"** → `GOP`. Ba kỹ năng
  thật sự khác nhau, phải tách ba dòng.
- **"Sức khỏe tốt", "chịu được áp lực"** → `DUNG` nếu tin có nêu. Nó mơ hồ, nhưng
  người phỏng vấn vẫn cho điểm được, mà mơ hồ là lỗi của tin chứ không phải của AI.
- **"Ngoại hình ưa nhìn, cao từ 1m60"** → `GIAYTO`. Nhìn là biết, không phải chấm.

## Đếm phần AI BỎ SÓT

`labels.csv` chỉ có những dòng AI ĐÃ đề xuất. Thứ nó bỏ quên thì không có dòng nào
để chấm — mà bỏ sót mới là lỗi nguy hiểm hơn, vì người dùng không nhìn thấy được.

Mở `out/<tag>/missing.csv`, với mỗi tin: đọc lại 3 mục trong `dataset.json`, đếm
xem **có bao nhiêu yêu cầu đáng lẽ phải thành tiêu chí mà AI không nêu ra**.
Chỉ đếm thứ tự nó cũng phải đạt cả ba điều kiện `DUNG` — đừng tính "Tốt nghiệp
Đại học" là bỏ sót, vì bỏ nó mới là đúng.

Với tin `J10_qua_nhieu` (13 yêu cầu, trần 10): chỉ tính bỏ sót nếu AI **bỏ mất
thứ quan trọng mà lại giữ thứ ít quan trọng hơn**. Cắt bớt cho đủ trần là đúng
thiết kế, cắt nhầm cái quan trọng mới là lỗi.

## Ba con số ra được

```
Precision = DUNG / tổng số tiêu chí đề xuất      -> "AI nói ra thì bao nhiêu phần dùng được"
Recall    = DUNG / (DUNG + bỏ sót)               -> "thứ đáng lấy thì AI lấy được bao nhiêu"
F1        = trung bình điều hòa của hai số trên
```

Kèm theo là bảng phân rã lỗi (`BIA` / `DAUVIEC` / `GIAYTO` / `GOP` / `TRUNG`) —
phần này quan trọng ngang ba con số kia, vì nó nói **sai kiểu gì**, tức là sửa
prompt ở đâu. Precision 0.8 do gộp dòng khác hẳn precision 0.8 do bịa.

## Hạn chế phải nói rõ khi trích số

Viết thẳng vào báo cáo, đừng để người khác phát hiện hộ:

- Tin tuyển dụng trong `dataset.json` **do người làm đề tài soạn** theo văn phong
  tin tuyển dụng tiếng Việt thường gặp, **không phải tin thật của doanh nghiệp**.
- **Chỉ một người chấm**, nên không đo được độ đồng thuận giữa nhiều người chấm.
- Người chấm cũng là người viết prompt → **có thiên lệch**. Cách giảm: chấm theo
  đúng luật ở trên chứ không chấm theo cảm giác, và ghi chú mọi ca phân vân.
- 10 tin là **ít**. Đủ để thấy xu hướng và so hai phiên bản prompt, không đủ để
  tuyên bố một con số chính xác tới phần trăm.

Nói rõ hạn chế không làm số liệu yếu đi — nó làm người đọc tin phần còn lại.
