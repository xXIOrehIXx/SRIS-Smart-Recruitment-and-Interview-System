# SRIS — Nghiệp vụ tóm tắt (đọc 5 phút)

Hệ thống tuyển dụng cho công ty nhỏ (≤200 người) chưa có phòng HR chuyên trách. Nhiều công ty dùng chung một hệ thống, dữ liệu cô lập từng công ty.

**Nguyên tắc xuyên suốt:** đơn giản là mặc định, phức tạp là tùy chọn. Hệ thống không thêm quy trình — nó cấu trúc hóa đúng các bước công ty nhỏ đang làm bằng miệng, Zalo và trí nhớ.

> Bản đầy đủ: `00_CONTEXT.md`.

## Ai làm gì

| Vai | Việc | Vào bằng |
|---|---|---|
| Admin | Tạo tài khoản, phòng ban, cấu hình công ty + thương hiệu | Đăng nhập |
| Human Resource | Vận hành mọi thứ: đăng tin, sàng lọc, đặt lịch, soạn thư mời | Đăng nhập |
| Interviewer | Chấm phỏng vấn theo tiêu chí + nêu đề xuất tuyển/không | Đăng nhập |
| Department Manager (DM) | Ra đề (cần tuyển ai, tiêu chí gì) + chốt tuyển ở bước cuối | Đăng nhập |
| Ứng viên | Nộp CV, chọn lịch, xem trạng thái, xem thư mời | Link qua email, KHÔNG cần tài khoản |

**Mỗi tài khoản giữ đúng MỘT vai.** Công ty gia đình dùng **1 tài khoản Admin** làm hết (Admin làm được mọi việc); công ty lớn hơn thì tạo thêm tài khoản để tách vai.

## Hồ sơ chạy qua 4 pha

**Hồ sơ mới → Sàng lọc → Phỏng vấn → Quyết định.** Chỉ tiến, không lùi. Loại được ở bất kỳ pha nào (ghi lý do là tùy chọn — có chip chọn nhanh cho ai muốn ghi).

1. **Hồ sơ mới** — ứng viên nộp CV trên trang tuyển dụng công khai. Hệ thống đọc PDF, lưu file + nội dung vào kho tập trung.
2. **Sàng lọc** — Human Resource tự đọc và quyết giữ hay loại, dùng bộ tiêu chí đã chốt làm khung đọc CV. **Hệ thống không chấm điểm, không xếp hạng ứng viên.**
3. **Phỏng vấn** — đặt lịch, phỏng vấn (mặc định 1 vòng), interviewer chấm theo tiêu chí và nêu đề xuất.
4. **Quyết định** — DM (không có DM thì Human Resource) đọc đề xuất của những người đã phỏng vấn rồi chốt → gửi thư mời → ứng viên trả lời → TUYỂN hoặc LOẠI.

Chốt cửa duy nhất: muốn sang pha Quyết định phải có ít nhất **1 phiếu chấm phỏng vấn đã nộp**.

## Tiêu chí — trục xuyên suốt, và cũng là chỗ AI giúp

1. **DM ra đề:** tạo Yêu cầu tuyển dụng — cần vị trí gì, mấy người, tiêu chí gì (gõ tự nhiên). Human Resource duyệt rồi tạo tin tuyển dụng từ đó. *(Tùy chọn — công ty nhỏ bỏ qua bước này, tự tạo job luôn.)*
2. **AI bóc tiêu chí:** đọc yêu cầu/JD → đề xuất danh sách tiêu chí có cấu trúc, để ở trạng thái **nháp**.
3. **Người duyệt chốt:** sửa, thêm bớt, chỉnh trọng số rồi chốt. **AI không quyết tiêu chí — AI chỉ đỡ việc gõ tay.**
4. **Bộ tiêu chí đã chốt LÀ phiếu chấm phỏng vấn** — mọi người phỏng vấn chấm trên cùng một khung, thay vì mỗi người một cảm nhận.

Công ty không biết bắt đầu từ đâu thì dùng **thư viện tiêu chí mẫu** dựng sẵn rồi áp vào job.

> AI chạy tại chỗ (Local AI), dữ liệu ứng viên không gửi ra dịch vụ ngoài — hợp Luật Bảo vệ dữ liệu cá nhân hiệu lực 01/01/2026.

## Đặt lịch phỏng vấn (kiểu Calendly)

Human Resource mở **1 bộ khung giờ chung** cho job (gán interviewer từng khung) → mời danh sách ứng viên → mỗi người nhận 1 link riêng qua email → ứng viên tự chọn khung, **ai chốt trước lấy trước** → email xác nhận + file lịch `.ics`. Ứng viên bận hết khung → bấm "không khung nào phù hợp" → hệ thống gắn cờ nhắc Human Resource gọi điện; gọi xong chốt lịch tay trong hệ thống.

## Chấm phỏng vấn và quyết định

- Interviewer mở phiếu ngay trong buổi, gõ điểm + ghi chú theo từng tiêu chí, nháp tự lưu, cuối buổi bấm nộp — kèm **đề xuất thẳng: rất nên tuyển / nên tuyển / cân nhắc / không nên**, và viết lý do.
- **Chấm mù:** không ai thấy phiếu người khác trước khi họ nộp — chống hùa theo. Nộp rồi vẫn sửa được cho tới khi hồ sơ sang bước Quyết định thì khóa.
- **Màn quyết định của DM đọc ĐỀ XUẤT, không đọc điểm:** hiện "2/3 nên tuyển", mở ra là lời nhận xét của từng người, ý kiến trái chiều xếp lên đầu. Bày trung bình có trọng số rồi bắt DM tự suy ra ý cả nhóm là bắt người đọc số thay vì đọc người.

## Thư mời nhận việc

Human Resource soạn thư (form điền sẵn từ tin tuyển dụng + hồ sơ công ty, sửa được) → hệ thống gửi email kèm link → ứng viên mở link xem/tải thư (mang logo và màu thương hiệu của công ty). **Ứng viên trả lời ngoài hệ thống** — gọi điện hay email như họ vẫn làm — rồi Human Resource/DM bấm "Đã nhận việc" hoặc "Từ chối" trong hệ thống. Nhận việc thì hệ thống gửi tiếp email chào mừng.

## Link cho ứng viên (magic link)

Ứng viên không có tài khoản. Mọi tương tác qua link gửi email, 3 loại: **chọn lịch** · **xem trạng thái** · **xem thư mời**. Link có hạn dùng; bấm chốt xong là link cháy (mở xem lại thì được, chốt lần 2 thì không).

## Email tự động

Hệ thống tự gửi email khi: mời chọn lịch, xác nhận lịch, có kết quả (đậu/rớt), gửi thư mời, chào mừng người mới. Human Resource sửa được nội dung email (sửa lời văn, không phải sửa HTML) và chèn ảnh. Công ty cấu hình SMTP riêng để email đi từ tên miền của mình.
