# Tổng kết nghiên cứu (bản đã hiệu chỉnh câu chữ)

> Bản này giữ nguyên phát hiện của nhóm, chỉ hiệu chỉnh câu chữ để khớp định vị đã chốt
> (00_CONTEXT.md — Section 1, 5.8, 5.16, 10) và tránh tự mâu thuẫn khi bảo vệ.
> Chỗ đánh dấu ⬜ là số liệu chờ điền từ phiếu phỏng vấn sâu (Việc B2).

## 1. Về nhu cầu sử dụng tính năng duyệt CV

**Nhóm công ty nhỏ (≤ ⬜ nhân sự):** chưa có phòng ban riêng quản lý tuyển dụng; số lượng hồ sơ
mỗi đợt tuyển chưa lớn. Với nhóm này, **nỗi đau chính không nằm ở khối lượng CV phải đọc,
mà nằm ở NGUỒN ứng viên** — tin tuyển dụng không đến được đúng người, ứng viên nhỏ giọt.
Vì vậy tính năng chủ lực cho nhóm này là **Career Site quảng bá thương hiệu** để kéo ứng viên
về, chứ không phải công cụ lọc bớt hồ sơ.

**Nhóm công ty vừa (⬜–200 nhân sự — vẫn trong định nghĩa DNNVV ≤200 lao động theo Luật Hỗ trợ
DNNVV 04/2017/QH14, đúng target hệ thống):** phần nhiều đã có bộ phận tuyển dụng riêng, làm việc
trên máy tính; công ty có chút tên tuổi thu hút rất nhiều hồ sơ mỗi đợt tuyển. Một số đã dùng
giải pháp duyệt CV bằng AI, số khác vẫn duyệt thủ công truyền thống.

## 2. Giải pháp cho từng nhóm vấn đề

### Công ty nhỏ
Quy trình tuyển dụng hiện tại của họ tối giản, nhanh, phù hợp quy mô. Nhưng khi doanh nghiệp
phát triển, quy trình này lộ điểm yếu:

- Chưa có tên tuổi → khả năng thu hút nhân tài yếu.
- Chưa khai thác hiệu quả kênh tuyển dụng qua Internet → thông tin tuyển dụng không đến được
  ứng viên thật sự có nhu cầu → ứng viên nhỏ giọt, thậm chí không có ai ứng tuyển.
- Các công ty được phỏng vấn đều chưa số hóa hoàn toàn quy trình tuyển dụng, nhưng **thể hiện
  thái độ tích cực với việc số hóa** và mong muốn một phương thức tuyển dụng đơn giản, nhanh,
  hiệu quả và dễ thao tác.

→ Nhóm quyết định cung cấp **Career Site tùy biến thương hiệu** làm một trong những tính năng
chính, để công ty quảng bá tên tuổi và thu hút ứng viên tiềm năng — đánh đúng nỗi đau về nguồn
ứng viên của nhóm này.

### Công ty vừa
Quy trình đã bắt đầu chuyên nghiệp hóa, nhưng khi mở rộng lại lộ điểm yếu:

- Nhiều hồ sơ đổ về mỗi đợt tuyển → duyệt thủ công quá tải, đứt gãy thông tin, **lãng quên
  các hồ sơ cũ tiềm năng**.
- Một số đã dùng giải pháp duyệt CV bằng AI, nhưng **hệ thống phổ thông thường chỉ đưa ra
  một con số tổng thể không giải thích được, hoặc tự động loại ứng viên khiến doanh nghiệp
  mất quyền tự quyết.** *(→ minh chứng trực tiếp cho quyết định KHÔNG để máy chấm điểm ứng
  viên: SRIS chỉ chuẩn bị bộ tiêu chí, người đọc hồ sơ và quyết — giữ nguyên văn làm quote
  khi bảo vệ.)*
- Dữ liệu ứng viên rải rác trên công cụ cá nhân (Zalo, Excel) — không phân quyền, không lưu
  vết truy cập → **rủi ro pháp lý nghiêm trọng** trước Luật Bảo vệ dữ liệu cá nhân (hiệu lực
  01/01/2026).

→ SRIS trả lời nhóm này bằng **kho hồ sơ tập trung có phân quyền và lưu vết** thay vì một bộ
máy chấm điểm: hồ sơ không còn rải rác trên Zalo/Excel, và mỗi vị trí có một bộ tiêu chí thống
nhất để cả hội đồng phỏng vấn dựa vào. Về dữ liệu: **Local AI + cô lập dữ liệu theo từng công ty
(tenant)** — dữ liệu CV không rời hệ thống ra bất kỳ bên thứ ba nào (không gọi API AI bên ngoài),
mọi truy cập được phân quyền và lưu vết — giúp doanh nghiệp đáp ứng yêu cầu bảo vệ dữ liệu cá
nhân 2026.

## 3. Những thay đổi trong quy trình hệ thống

- Quy trình chuẩn gồm **4 giai đoạn: Nhận hồ sơ → Sàng lọc → Phỏng vấn → Quyết định** —
  mặc định tối giản, MỘT người làm được hết. Các bước nâng cao (phiếu yêu cầu tuyển dụng,
  người quyết tách riêng, phỏng vấn nhiều vòng, blind review) là **tùy chọn, bật khi công ty
  lớn lên** — hệ thống tự BỎ bước cho công ty nhỏ, không bắt công ty 10 người dùng bộ máy
  công ty 1000 người.
- **Loại ứng viên được ở bất kỳ giai đoạn nào chỉ với một thao tác** (kèm lý do chọn nhanh
  1-chạm) — đáp ứng nhu cầu "đọc hồ sơ xong quyết luôn" ở chiều loại. Ở chiều tuyển, hệ thống
  giữ đúng một chốt chất lượng: phải có ít nhất một phiếu chấm phỏng vấn trước khi ra offer —
  khớp thực tế công ty nhỏ luôn gặp mặt ứng viên trước khi nhận việc.
- Bổ sung **AI đề xuất tiêu chí đánh giá từ tin tuyển dụng**: người duyệt chốt, và bộ tiêu chí
  đó trở thành phiếu chấm chung cho cả hội đồng phỏng vấn.
- SRIS cung cấp theo mô hình **thuê bao trả phí theo tháng (subscription)**.

## 4. Bảng số liệu chờ điền (deliverable Việc B2)

| # | Công ty (ẩn danh) | Quy mô (số NS) | Ngành | Quy trình thực tế (tóm tắt) | Pain chính | Con số ghi nhận (time-to-hire, giờ/tuần cho tuyển dụng, số CV/đợt…) | Quote đáng giá |
|---|---|---|---|---|---|---|---|
| 1 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 3 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

> Quy tắc: mọi con số As-Is đưa vào tài liệu chính thức phải lấy từ bảng này hoặc desk
> research có nguồn (00_CONTEXT.md mục 4.1). KHÔNG tự bịa số.
