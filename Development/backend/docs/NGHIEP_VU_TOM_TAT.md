# SRIS — Nghiệp vụ tóm tắt (đọc 5 phút)

Hệ thống tuyển dụng cho công ty nhỏ (≤200 người). Nhiều công ty dùng chung, dữ liệu cô lập từng công ty.

## Ai làm gì

| Vai | Việc | Vào bằng |
|---|---|---|
| Admin | Tạo tài khoản, gán vai, cấu hình công ty | Đăng nhập |
| Recruiter | Vận hành mọi thứ: đăng tin, sàng lọc, đặt lịch, gửi offer | Đăng nhập |
| Interviewer | Chấm điểm phỏng vấn | Đăng nhập |
| Department Manager (DM) | Ra đề (cần tuyển ai) + chốt tuyển ở bước cuối | Đăng nhập |
| Ứng viên | Nộp CV, chọn lịch, xem trạng thái, nhận/từ chối offer | Link qua email, KHÔNG cần tài khoản |

Một người có thể giữ nhiều vai (công ty gia đình: 1 chủ làm hết).

## Hồ sơ chạy qua 4 pha

**Hồ sơ mới → Sàng lọc → Phỏng vấn → Quyết định.** Chỉ tiến, không lùi. Loại được ở bất kỳ pha nào (bắt buộc ghi lý do).

1. **Hồ sơ mới** — ứng viên nộp CV trên trang tuyển dụng công khai của công ty. Hệ thống tự đọc PDF và chấm điểm sẵn.
2. **Sàng lọc** — Recruiter xem điểm + bằng chứng rồi tự quyết giữ hay loại.
3. **Phỏng vấn** — đặt lịch, phỏng vấn (1 vòng mặc định, nhiều vòng nếu cấu hình), interviewer chấm điểm theo tiêu chí.
4. **Quyết định** — DM (không có DM thì Recruiter) xem điểm rồi chốt → gửi offer → ứng viên tự bấm nhận/từ chối → TUYỂN hoặc LOẠI.

Chốt cửa duy nhất: muốn sang pha Quyết định phải có ít nhất 1 phiếu chấm phỏng vấn đã nộp.

## AI chấm CV thế nào

- Người tạo job viết yêu cầu/JD → AI **bóc thành danh sách tiêu chí NHÁP** → người duyệt sửa và chốt. AI không tự quyết tiêu chí.
- Hệ thống chấm CV **theo từng tiêu chí đã chốt**: khớp hay thiếu, kèm câu trích từ CV làm bằng chứng. Không phải một con số vô hồn.
- Cùng bộ tiêu chí đó dùng luôn cho phiếu chấm phỏng vấn — xuyên suốt từ lọc CV đến phỏng vấn.

## Đặt lịch phỏng vấn (kiểu Calendly)

Recruiter mở **1 bộ khung giờ chung** cho job (gán interviewer từng khung) → mời danh sách ứng viên → mỗi người nhận 1 link riêng qua email → ứng viên tự chọn khung, **ai chốt trước lấy trước** → email xác nhận + file lịch .ics. Ứng viên bận hết khung → bấm "không khung nào phù hợp" → hệ thống gắn cờ nhắc Recruiter gọi điện; gọi xong chốt lịch tay trong hệ thống.

## Chấm phỏng vấn

Interviewer mở phiếu chấm ngay trong buổi, gõ điểm + ghi chú theo từng tiêu chí, nháp tự lưu, cuối buổi bấm nộp. Job có nhiều người chấm → tự bật **chấm mù**: không ai thấy điểm người khác trước khi nộp. Nộp xong hệ thống tổng hợp radar + chỉ ra tiêu chí các người chấm lệch nhau nhiều (chỗ cần bàn).

## Talent Pool (tính năng đinh)

Mở job mới → hệ thống tự quét **kho CV cũ của chính công ty** tìm người phù hợp. CV rớt job trước không chết — sống lại cho job sau. Chỉ tìm trong CV nộp vào công ty mình, không đụng công ty khác.

## Link cho ứng viên (magic link)

Ứng viên không có tài khoản. Mọi tương tác qua link gửi email, 3 loại: **chọn lịch** · **xem trạng thái** · **trả lời offer**. Link có hạn dùng, bấm chốt xong là link cháy (mở xem lại thì được, chốt lần 2 thì không).

## Email tự động

Hệ thống tự gửi email khi: mời chọn lịch, xác nhận lịch, có kết quả (đậu/rớt), gửi offer. Công ty cấu hình được SMTP riêng để email đi từ tên miền của mình.
