**ĐỒ ÁN TỐT NGHIỆP**

──────────────────

**BUSINESS OVERVIEW DOCUMENT**

_Tài liệu Tổng quan Nghiệp vụ_

Tên đề tài:

**Xây dựng Hệ thống tuyển dụng và phỏng vấn thông minh**

_cho Doanh nghiệp (Smart Recruitment and Interview System)_

| **Sản phẩm:**  | Smart Recruitment and Interview System (SRIS) |
| -------------- | ------------------------------------------------ |
| **Mô hình:**   | SaaS Multi-tenant ATS tích hợp AI cục bộ |
| **Đối tượng:** | Doanh nghiệp ≤ 200 nhân sự & công ty gia đình (mọi ngành nghề) |
| **Nhóm:**      | GP35 — 5 thành viên (3 Backend .NET · 2 Frontend React) |
| **Thời gian:** | 5 tháng (01/04/2026 – 31/08/2026) |
| **Phiên bản:** | v2.0 — 04/08/2026 |

**Lịch sử phiên bản**

| **Phiên bản** | **Ngày** | **Nội dung thay đổi** |
| --- | --- | --- |
| v1.0 | 19/05/2026 | Bản đầu — đối tượng doanh nghiệp IT ≥ 100 nhân sự, có module Quiz, dùng OpenAI |
| v2.0 | 04/08/2026 | **Cập nhật theo tái định vị hậu hội đồng:** thu hẹp đối tượng còn ≤ 200 nhân sự (mọi ngành), **loại module Quiz**, dựng **trục tiêu chí đánh giá**, chuyển từ OpenAI sang **Local AI**, gia hạn tới 31/08/2026, bổ sung kế hoạch chi tiết + WBS |
| v2.1 | 08/08/2026 | **Chốt vai trò của AI:** AI làm đúng một việc — **đề xuất bộ tiêu chí đánh giá từ tin tuyển dụng**, người duyệt chốt. Hệ thống không chấm điểm, không xếp hạng ứng viên. |

# Mục lục

**1\.** Executive Summary - Tóm tắt điều hành

**2\.** Bối cảnh & Vấn đề kinh doanh

**3\.** Đối tượng người dùng (Personas)

**4\.** Phạm vi sản phẩm (Scope)

**5\.** Tính năng nghiệp vụ cốt lõi

**6\.** Quy trình nghiệp vụ end-to-end

**7\.** Mục tiêu kinh doanh & KPI

**8\.** Phân tích rủi ro & Giảm thiểu

**9\.** Kế hoạch triển khai & Phân công

**10\.** Tổng kết

# 1\. Executive Summary - Tóm tắt điều hành

Dự án Smart Recruitment and Interview System (SRIS) là một nền tảng SaaS đa thuê bao
(multi-tenant) giúp **doanh nghiệp nhỏ dưới 200 nhân sự và công ty gia đình** quản lý toàn bộ
vòng đời tuyển dụng — từ đăng tin, sàng lọc CV, đặt lịch và chấm phỏng vấn, đến ra quyết định
tuyển dụng và gửi thư mời làm việc.

Đây là nhóm doanh nghiệp **chưa có phòng nhân sự chuyên trách**: người tuyển dụng thường kiêm
nhiệm, quản lý ứng viên bằng Excel và hộp thư cá nhân. Các nền tảng ATS quốc tế quá nặng và
quá đắt so với quy mô này.

**Định vị sản phẩm: "Quy trình tuyển dụng tối giản đúng chuẩn cho công ty chưa có phòng HR."**
Hệ thống không thêm quy trình mới cho doanh nghiệp — nó **cấu trúc hóa** đúng những bước họ đang
làm rời rạc. Nguyên tắc thiết kế xuyên suốt: **đơn giản là mặc định, phức tạp là tùy chọn.**

Sản phẩm dùng AI cho **đúng một việc**, chạy trên **hạ tầng cục bộ (Local AI)**:

- **Bóc tiêu chí tuyển dụng từ JD** — mô hình ngôn ngữ đọc mô tả công việc và đề xuất bộ tiêu chí
  đánh giá dạng **bản nháp**; người phụ trách chỉnh sửa và chốt. AI đề xuất, con người quyết định.
  Bộ tiêu chí đã chốt trở thành **phiếu chấm phỏng vấn**.

Hệ thống **không** chấm điểm hay xếp hạng ứng viên: sàng lọc hồ sơ là việc của con người, phần
máy làm là chuẩn bị bộ tiêu chí để việc đó có căn cứ và nhất quán.

Bên cạnh đó, sản phẩm giải quyết các đặc thù thực tế của thị trường Việt Nam: **ứng viên không
cần tạo tài khoản** (mọi tương tác qua magic link gửi email), **đặt lịch phỏng vấn theo pool
khung giờ dùng chung** kiểu Calendly, và **chấm phỏng vấn cộng tác có chế độ chấm mù** để chống
thiên kiến neo (anchoring bias).

**💡 Giá trị cốt lõi**

Hệ thống hướng tới giảm 30% Time-to-Hire (từ 18 ngày xuống dưới 12 ngày) và tiết kiệm khoảng
15–20 giờ/tuần cho người phụ trách tuyển dụng thông qua tự động hóa và ứng dụng AI cục bộ —
với **chi phí AI bằng 0** và **dữ liệu ứng viên không rời khỏi hạ tầng doanh nghiệp**.

# 2\. Bối cảnh & Vấn đề kinh doanh

## 2.1 Bối cảnh thị trường

Doanh nghiệp nhỏ và vừa chiếm phần lớn số lượng doanh nghiệp tại Việt Nam. Theo Luật Hỗ trợ
Doanh nghiệp nhỏ và vừa (04/2017/QH14), mốc **≤ 200 lao động** là ranh giới xác định doanh
nghiệp nhỏ và vừa — đây chính là phân khúc mục tiêu của SRIS.

Đặc điểm chung của nhóm này: **không có phòng nhân sự chuyên trách**. Người tuyển dụng thường
là chủ doanh nghiệp, kế toán kiêm nhiệm hoặc một nhân sự hành chính. Họ gặp ba điểm nghẽn lớn:

### Nỗi đau 1 - Quy trình rời rạc, dữ liệu phân mảnh

CV nằm rải rác trong hộp thư cá nhân, Zalo và ổ đĩa chung. Thông tin ứng viên được chép tay
sang Excel. Không ai nắm được ứng viên nào đang ở bước nào, ai đã liên hệ, ai còn chờ phản hồi.

### Nỗi đau 2 - Thất thoát ứng viên (Candidate Leakage)

Khi số lượng hồ sơ tăng, người phụ trách bỏ sót email, quên gửi phản hồi từ chối, quên nhắc lịch
phỏng vấn. Ứng viên tốt bỏ đi vì im lặng quá lâu, và hình ảnh nhà tuyển dụng bị tổn hại.

### Nỗi đau 3 - Đánh giá cảm tính, không lưu vết

Phỏng vấn xong không lưu lại điểm số hay lý do; quyết định dựa vào trí nhớ và cảm tính. Khi có
nhiều người cùng phỏng vấn, ý kiến người nói trước ảnh hưởng người nói sau. CV bị loại ở đợt
tuyển trước thì mất luôn, không được xem lại cho vị trí sau.

## 2.2 Cơ hội từ AI cục bộ và mô hình SaaS

Các nền tảng ATS quốc tế (Workable, Greenhouse, Teamtailor) đã chứng minh SaaS Multi-tenant là
chuẩn ngành. Tuy nhiên chưa có sản phẩm nào tối ưu cho phân khúc doanh nghiệp nhỏ Việt Nam với
các đặc thù sau:

- **Quy mô nhỏ, ngân sách hạn chế** — không đủ chi phí cho ATS enterprise tính theo đầu người dùng.
- **Không có phòng HR** — cần hệ thống dùng được ngay với **một tài khoản duy nhất**, không cần
  cấu hình quy trình phức tạp.
- **Mô hình ngôn ngữ mã nguồn mở đã đủ chín** — các mô hình chạy cục bộ (Ollama) hiện xử lý tốt
  tiếng Việt, cho phép tích hợp AI với **chi phí biên bằng 0**.
- **Tuân thủ pháp lý** — Luật Bảo vệ dữ liệu cá nhân có hiệu lực từ **01/01/2026** yêu cầu doanh
  nghiệp xử lý dữ liệu ứng viên chặt chẽ hơn. Kiến trúc **AI cục bộ + cô lập dữ liệu theo công ty**
  của SRIS là một **lợi thế tuân thủ**, không đơn thuần là lựa chọn kỹ thuật.

# 3\. Đối tượng người dùng (Personas)

Hệ thống phục vụ 5 nhóm người dùng. **Bốn vai trò nội bộ đăng nhập vào Portal; riêng ứng viên là
khách ẩn danh tham gia qua magic link, không cần tài khoản.**

Câu tóm tắt phân vai: **Recruiter lái · Interviewer chấm · Trưởng bộ phận quyết · Ứng viên ứng
tuyển · Admin dựng sân.**

## 3.1 Chị Mai - Người phụ trách tuyển dụng (Key User)

| **Vai trò**           | Recruiter — thường kiêm nhiệm hành chính/kế toán tại công ty 50–150 người |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Câu nói đặc trưng** | "Chị dành cả thanh xuân chỉ để copy paste dữ liệu từ email ứng viên ra file Excel." |
| **Pain points**       | • Quên nhắc ứng viên lịch phỏng vấn<br><br>• Trưởng bộ phận không phản hồi CV kịp thời<br><br>• Cuối tháng tổng hợp báo cáo mất hẳn một ngày |
| **Mục tiêu**          | • Một màn hình thấy hết ứng viên đang ở bước nào<br><br>• Hệ thống tự đọc CV và chỉ ra ai phù hợp, phù hợp ở điểm nào |

## 3.2 Anh Bình - Trưởng bộ phận (Department Manager)

| **Vai trò**           | Trưởng bộ phận có nhu cầu tuyển người — người **ra đề** và **chốt tuyển** |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Câu nói đặc trưng** | "Đừng bắt tôi học phần mềm mới. Tôi cần người biết việc, cho tôi xem đúng chỗ đó rồi tôi duyệt." |
| **Pain points**       | • Phải đọc CV dài lộn xộn, không biết nhìn vào đâu<br><br>• Nói yêu cầu bằng lời, HR hiểu một kiểu<br><br>• Khó đánh giá chéo với người phỏng vấn khác |
| **Mục tiêu**          | • Ghi rõ tiêu chí cần tuyển một lần, dùng xuyên suốt cả quy trình<br><br>• Đến bước cuối chỉ cần xem điểm tổng hợp rồi quyết |

## 3.3 Tuấn Kiệt - Ứng viên (External User)

| **Vai trò**           | Ứng viên nộp hồ sơ qua trang tuyển dụng của công ty |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Câu nói đặc trưng** | "Nếu trang tuyển dụng bắt tạo tài khoản dài dòng, tôi sẽ thoát và nộp công ty khác." |
| **Pain points**       | • Gửi CV xong không có email xác nhận<br><br>• Không biết hồ sơ của mình đang ở đâu<br><br>• Hẹn lịch phỏng vấn qua lại nhiều lượt email |
| **Mục tiêu**          | • Nộp CV trong một trang duy nhất, không cần tài khoản<br><br>• Tự chọn khung giờ phỏng vấn phù hợp và tra cứu được trạng thái |

## 3.4 Nhóm phụ - Admin & Interviewer

| **Vai trò**     | **Admin (theo từng công ty)**                                     | **Interviewer**                                                           |
| --------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Mô tả**       | Quản trị viên công ty: tạo tài khoản, phân vai, cấu hình thương hiệu | Người chấm phỏng vấn theo bộ tiêu chí (một buổi có thể nhiều người chấm) |
| **Quyền chính** | Quản lý người dùng và phòng ban, cấu hình công ty, brand theming | Chấm điểm theo tiêu chí, xem radar tổng hợp — **chỉ chấm, không quyết** |

**💡 Phân quyền theo quy mô**

Mỗi tài khoản giữ đúng một vai. Công ty gia đình chỉ cần **một tài khoản Admin** làm trọn quy
trình (Admin là siêu người dùng, bỏ qua mọi cổng phân quyền). Khi công ty lớn lên thì tách vai
bằng cách tạo thêm tài khoản Recruiter / Interviewer / Trưởng bộ phận. Hệ thống lớn lên cùng
doanh nghiệp — không bắt công ty 10 người dùng bộ máy của công ty 1000 người.

# 4\. Phạm vi sản phẩm (Scope)

## 4.1 Trong phạm vi (In-Scope)

Hệ thống bao gồm 9 module nghiệp vụ chính:

| **#**  | **Module**                | **Phạm vi**                                                         |
| ------ | ------------------------- | ------------------------------------------------------------------- |
| **M1** | **Job & Yêu cầu tuyển dụng** | Trưởng bộ phận tạo yêu cầu tuyển dụng (tùy chọn) → Recruiter tạo tin tuyển dụng; Career Site công khai theo thương hiệu; form nộp CV one-page |
| **M2** | **Candidate Pipeline**    | Kanban hiển thị 4 pha, State Machine 6 trạng thái ở tầng nội bộ, Activity Log, ghi chú nội bộ |
| **M3** | **AI đề xuất tiêu chí đánh giá** | LLM cục bộ đọc tin tuyển dụng → bộ tiêu chí **nháp** → người duyệt chỉnh & chốt → bộ tiêu chí đó thành phiếu chấm phỏng vấn dùng chung |
| **M4** | **Email Automation**      | Email tự động theo State Machine, mẫu email động, mỗi công ty cấu hình SMTP riêng |
| **M5** | **Collaborative Scoring** | Chấm phỏng vấn theo cùng bộ tiêu chí, radar tổng hợp, **Blind Review tự bật khi có > 1 người chấm** |
| **M6** | **Dashboard & Analytics** | Phễu tuyển dụng, time-to-hire, tỉ lệ chấp nhận offer, phân tích lý do loại và nguồn ứng viên |
| **M7** | **Multi-tenant & Brand**  | Cô lập dữ liệu theo `CompanyId` bằng Row-Level Security, brand theming (logo, màu, giới thiệu) |
| **M8** | **Auth & Authorization**  | JWT + phân quyền 4 vai; ứng viên dùng magic link, không cần đăng ký |
| **M9** | **Interview Scheduling**  | Pool khung giờ dùng chung + panel người phỏng vấn, mời hàng loạt, ai chốt trước lấy trước, sinh tệp lịch `.ics` |

## 4.2 Ngoài phạm vi (Out-of-Scope)

Các tính năng sau **không** nằm trong phạm vi đồ án:

- **Module Quiz / bài kiểm tra trực tuyến** — bao gồm cả sinh đề bằng AI và chống gian lận.
  **Đã loại khỏi phạm vi từ 07/2026** theo tái định vị (xem Mục 9.4): không phải nỗi đau cốt lõi
  của doanh nghiệp nhỏ và làm loãng trọng tâm sản phẩm.
- Ứng dụng di động thuần (iOS/Android) — web đáp ứng đa kích thước màn hình là đủ.
- Giám sát ứng viên qua webcam.
- Tích hợp Google Calendar / Outlook hai chiều (hệ thống chỉ sinh tệp `.ics`).
- Nền tảng chấm bài lập trình (coding challenge / online judge).
- Module tính lương, chấm công (Core HR).
- Chatbot AI trả lời ứng viên theo thời gian thực.
- Tích hợp LDAP / SSO Active Directory.
- Tên miền con động cho từng công ty (dùng định tuyến theo đường dẫn `/{slug}` cho bản demo).

# 5\. Tính năng nghiệp vụ cốt lõi

Phần này mô tả 6 tính năng có giá trị nghiệp vụ cao nhất — điểm khác biệt của sản phẩm so với
các ATS trên thị trường.

## 5.1 Trục tiêu chí - AI bóc tiêu chí, con người chốt

Toàn bộ giá trị "thông minh" của hệ thống xoay quanh **một bộ tiêu chí duy nhất**, dùng xuyên
suốt từ lọc CV đến phỏng vấn.

**Quy trình hoạt động:**

- Trưởng bộ phận tạo Yêu cầu tuyển dụng (tùy chọn) → Recruiter tạo tin tuyển dụng với mô tả công việc.
- Hệ thống gửi mô tả công việc sang mô hình ngôn ngữ chạy cục bộ → nhận về danh sách tiêu chí
  dạng **bản nháp**, mỗi tiêu chí gồm: tên, loại (bắt buộc / mong muốn), từ khóa nhận diện, trọng số.
- Người phụ trách xem lại, sửa, thêm, bớt rồi **chốt** bộ tiêu chí.
- Bộ tiêu chí đã chốt trở thành **phiếu chấm phỏng vấn** — người phỏng vấn cho điểm theo từng dòng.

**⭐ Nguyên tắc thiết kế**

AI **không được quyết** tiêu chí. Đầu ra của AI luôn ở trạng thái nháp và phải có người duyệt.
Đây là ranh giới trách nhiệm rõ ràng — khi tuyển sai, người quyết định là con người, không phải mô hình.

Với doanh nghiệp chưa biết bắt đầu từ đâu, hệ thống cung cấp **thư viện tiêu chí mẫu** theo nhóm
vị trí để chọn nhanh rồi tùy chỉnh.

## 5.2 Nhận và lưu hồ sơ

Ứng viên nộp CV qua trang tuyển dụng công khai; hệ thống bóc text từ PDF, lưu file gốc và tạo
hồ sơ ứng tuyển. CV scan ảnh không có lớp text được chuyển sang luồng nhập tay thay vì lưu
một bản rỗng. Không có bước chấm điểm nào ở đây.

## 5.3 Đặt lịch phỏng vấn theo pool khung giờ dùng chung

Giải quyết trực tiếp cảnh "hẹn tới hẹn lui" qua email giữa người tuyển dụng và ứng viên.

**Cách hoạt động:**

- Recruiter mở **một bộ khung giờ chung** cho tin tuyển dụng, gán người phỏng vấn cho từng khung.
- Chọn danh sách ứng viên cần phỏng vấn → mỗi người nhận **một liên kết riêng** qua email.
- Ứng viên tự chọn khung giờ phù hợp, **ai chốt trước lấy trước**; khung đã bị lấy sẽ biến mất
  với người vào sau.
- Chốt xong: hệ thống gửi email xác nhận kèm **tệp lịch `.ics`** cho cả hai phía.
- Ứng viên bận toàn bộ khung → bấm "không khung nào phù hợp" → hệ thống **gắn cờ nhắc** Recruiter
  gọi điện, gọi xong chốt lịch thủ công ngay trong hệ thống.

**Bảo mật:** mỗi liên kết chứa token có thời hạn, chỉ lưu **giá trị băm** trong cơ sở dữ liệu và
bị vô hiệu hóa sau khi ứng viên chốt — tránh chuyển tiếp email hoặc dùng lại.

## 5.4 Collaborative Scoring với Blind Review

Cho phép nhiều người phỏng vấn chấm độc lập theo cùng bộ tiêu chí, tránh thiên kiến neo
(anchoring bias).

**Đặc trưng:**

- Phiếu chấm sinh tự động từ **bộ tiêu chí đã chốt** của tin tuyển dụng — không phải bộ tiêu chí
  rời rạc do mỗi người tự nghĩ.
- Mỗi người chấm theo thang điểm cho từng tiêu chí, kèm ghi chú; nháp được lưu tự động trong buổi.
- Trạng thái phiếu: nháp → đã nộp. **Chỉ thấy điểm người khác sau khi mình đã nộp.**
- Chế độ chấm mù **tự bật khi tin tuyển dụng có nhiều hơn một người chấm** — công ty một người
  không phải bận tâm tới thiết lập này.
- Hệ thống tổng hợp radar theo trục tiêu chí và **chỉ ra tiêu chí có độ lệch lớn giữa những người
  chấm** — đó là chỗ cần ngồi lại bàn.

**💡 Lưu ý kỹ thuật**

Cảnh báo bất đồng không dùng AI — chỉ dùng độ lệch chuẩn (thống kê cơ bản). Không phải mọi tính
năng "thông minh" đều cần đến AI.

## 5.5 Kiến trúc đa thuê bao (Multi-tenant)

Hệ thống phục vụ nhiều công ty trên cùng một hạ tầng, dữ liệu giữa các công ty được cách ly tuyệt đối.

**Chiến lược:** Shared Schema + cột `CompanyId` — chuẩn được các nền tảng SaaS lớn sử dụng.

- **Cô lập dữ liệu:** mọi bảng nghiệp vụ đều có `CompanyId`; ràng buộc được ép **ở tầng cơ sở dữ
  liệu** bằng Row-Level Security, thiết lập lại theo từng request để tránh bẫy dùng chung kết nối.
- **Phòng thủ nhiều lớp:** EF Core Global Query Filter tự chèn điều kiện lọc, kết hợp với RLS —
  lập trình viên quên điều kiện lọc thì tầng dữ liệu vẫn chặn.
- **Khách ẩn danh:** ứng viên không có tài khoản, tenant được phân giải từ chính token trong
  magic link hoặc từ slug của Career Site.
- **Brand theming:** mỗi công ty tải logo, chọn màu chủ đạo, viết phần giới thiệu riêng cho trang
  tuyển dụng của mình.

# 6\. Quy trình nghiệp vụ end-to-end

Hệ thống quản lý hồ sơ ứng viên qua **6 trạng thái nội bộ**, nhưng chỉ hiển thị cho người dùng
**4 pha** để giữ giao diện đơn giản:

**Hồ sơ mới → Sàng lọc → Phỏng vấn → Quyết định**

Quy trình **chỉ tiến, không lùi**. Có thể loại hồ sơ ở bất kỳ pha nào (lý do loại là tùy chọn).
Cửa kiểm soát duy nhất: **muốn chuyển sang pha Quyết định phải có ít nhất một phiếu chấm phỏng
vấn đã nộp.** Phỏng vấn nhiều vòng được xử lý bằng **dữ liệu** (số thứ tự vòng), không sinh thêm
trạng thái.

## Phase 0 - Chuẩn bị (làm một lần cho mỗi vị trí)

- Trưởng bộ phận tạo Yêu cầu tuyển dụng (tùy chọn — công ty nhỏ có thể bỏ qua).
- Recruiter tạo tin tuyển dụng với mô tả công việc chi tiết.
- Hệ thống bóc tiêu chí thành bản nháp → người phụ trách chỉnh sửa và chốt.
- Tin được đăng lên Career Site công khai của công ty.

## Phase 1 - Ứng viên nộp CV

- Ứng viên vào trang tuyển dụng của công ty, xem các vị trí đang mở.
- Bấm "Ứng tuyển" → điền form một trang, tải lên CV dạng PDF, **không cần tạo tài khoản**.
- Nhận email xác nhận tự động ngay sau khi gửi.

## Phase 2 - Hệ thống xử lý tự động

- Hệ thống bóc text từ CV và lưu tệp gốc để đối chiếu; PDF scan không bóc được text thì báo rõ.
- Với tin tuyển dụng, AI **đề xuất bộ tiêu chí đánh giá** dạng nháp để người phụ trách chỉnh và chốt.
- Việc gọi AI chạy **bất đồng bộ ở tiến trình nền**: người dùng bấm xong không bị treo màn hình,
  giao diện hỏi trạng thái tới khi có kết quả; AI hỏng thì báo lỗi rõ và vẫn nhập tay được.
- Hồ sơ xuất hiện trên bảng Kanban ở pha "Hồ sơ mới".

## Phase 3 - Sàng lọc

- Recruiter mở từng hồ sơ và tự đọc — hệ thống không xếp hạng, không chấm điểm thay.
- **Bộ tiêu chí đã chốt** hiện sẵn bên cạnh hồ sơ để việc đọc có cùng một khung cho mọi ứng viên.
- Ghi chú nội bộ, trao đổi trong hệ thống.
- Quyết định giữ (chuyển sang pha Phỏng vấn) hoặc loại — mọi thao tác được ghi vào nhật ký hoạt động.

## Phase 4 - Phỏng vấn

- Recruiter mở pool khung giờ, gán người phỏng vấn, mời danh sách ứng viên.
- Ứng viên tự chọn khung giờ qua liên kết trong email; hệ thống gửi xác nhận kèm tệp lịch.
- Trong buổi, người phỏng vấn chấm theo bộ tiêu chí, nháp tự lưu, cuối buổi bấm nộp.
- Nhiều người chấm → **chấm mù** tự bật; sau khi nộp, hệ thống tổng hợp radar và chỉ ra các tiêu
  chí bị lệch điểm nhiều.

## Phase 5 - Quyết định & Kết quả

- Trưởng bộ phận (hoặc Recruiter nếu vị trí không gán trưởng bộ phận) xem điểm tổng hợp và chốt.
- Gửi thư mời làm việc → ứng viên bấm **nhận hoặc từ chối** ngay trong email → hệ thống tự
  chuyển sang trạng thái Tuyển hoặc Loại.
- Email kết quả được gửi tự động cho cả ứng viên trúng tuyển và không trúng tuyển.
- Dashboard cập nhật phễu tuyển dụng, time-to-hire, tỉ lệ chấp nhận offer, phân tích lý do loại
  và nguồn ứng viên.

# 7\. Mục tiêu kinh doanh & KPI

Hệ thống đặt mục tiêu đạt 5 chỉ số cụ thể, đo lường được sau khi triển khai:

| **KPI**                        | **Hiện trạng (As-Is)** | **Mục tiêu (To-Be)**                  |
| ------------------------------ | ---------------------- | ------------------------------------- |
| **Time-to-Hire**               | 18 ngày                | **< 12 ngày (giảm 30%)**              |
| **Thời gian làm tác vụ thủ công** | 3-4 giờ/ngày        | **< 1 giờ/ngày (tiết kiệm 15-20h/tuần)** |
| **Tỉ lệ hồ sơ có đánh giá lưu vết** | Gần như 0% (đánh giá bằng trí nhớ) | **100% hồ sơ có điểm theo tiêu chí + bằng chứng** |
| **Tái sử dụng CV đã có** | 0% (CV loại là mất) | **Mỗi tin tuyển dụng mới có gợi ý từ kho CV cũ** |
| **Báo cáo tuyển dụng**     | Không có               | **Dashboard phễu + time-to-hire + tỉ lệ nhận offer** |

**📊 Ý nghĩa các KPI**

Time-to-Hire và thời gian tác vụ thủ công đo trực tiếp hiệu quả của tự động hóa email, dựng bộ
tiêu chí và đặt lịch. Chỉ số về đánh giá có lưu vết đo đúng phần giá trị mà một file Excel không
thể thay thế — đây là lập luận trung tâm khi bảo vệ.

Số liệu hiện trạng được đối chiếu bằng **phỏng vấn sâu 3–5 doanh nghiệp** thuộc đúng phân khúc
mục tiêu (bộ 23 câu hỏi / 6 phần) kết hợp khảo sát trực tuyến — xem Mục 9.3.

# 8\. Phân tích rủi ro & Giảm thiểu

| **Rủi ro**                             | **Impact** | **Chiến lược giảm thiểu**                                           |
| -------------------------------------- | ---------- | ------------------------------------------------------------------- |
| **Kháng cự thay đổi (quen dùng Excel)** | **Cao**   | Giữ giao diện tối giản, mặc định dùng được với một tài khoản duy nhất; tính năng nâng cao là tùy chọn |
| **Bóc text CV sai với PDF phức tạp**   | **Trung**  | Cho phép sửa tay thông tin sau khi bóc; giữ tệp CV gốc để đối chiếu |
| **AI đề xuất tiêu chí sai hoặc bỏ sót** | **Cao** | Đầu ra luôn là **bản nháp bắt buộc có người duyệt** — người phụ trách thêm/sửa/xóa trước khi chốt; chất lượng đã đo trên bộ 10 tin đa ngành (F1 0,876) và hạn chế được công bố kèm số |
| **Hạ tầng chạy AI cục bộ (RAM/CPU)**   | **Trung**  | Tách dịch vụ AI thành tiến trình riêng; mô hình chỉ nạp khi có yêu cầu và giữ nóng giữa các lượt; đánh giá phương án thuê máy chủ khi triển khai thật |
| **Rò rỉ dữ liệu xuyên công ty**        | **Cao**    | Phòng thủ nhiều lớp: Row-Level Security ở tầng dữ liệu + Global Query Filter ở tầng ứng dụng + kiểm thử cô lập dữ liệu |
| **Mẫu phỏng vấn doanh nghiệp nhỏ (3-5 công ty)** | **Trung** | Nêu rõ hạn chế cỡ mẫu khi trình bày; kết hợp ba lớp minh chứng: desk research có nguồn + khảo sát + phỏng vấn sâu |
| **Bất đồng giữa người chấm phỏng vấn** | **Thấp**   | Tự động cảnh báo tiêu chí có độ lệch chuẩn lớn để nhóm ngồi lại bàn |

# 9\. Kế hoạch triển khai & Phân công

> **Kế hoạch chi tiết ở mức gói công việc** (104 gói, 1.230 giờ công, có mã WBS, người phụ trách,
> ước lượng, sprint, trạng thái và minh chứng trong mã nguồn) được trình bày trong tài liệu riêng:
> **`SRIS_WBS.md` — Work Breakdown Structure.** Mục này chỉ tóm tắt ở cấp giai đoạn.

## 9.1 Năm giai đoạn triển khai

| **Giai đoạn** | **Thời gian** | **Mục tiêu nghiệm thu** | **Khối lượng** |
| --- | --- | --- | --- |
| **GĐ1 — Khởi động & Phân tích** | T4/2026 (S1) | SRS, ERD, Use Case, wireframe; khung dự án build được | 110 giờ (8,9%) |
| **GĐ2 — Nền tảng hệ thống** | T4-T5/2026 (S2-S3) | Đăng nhập & phân quyền chạy thật, dữ liệu cô lập theo công ty, luồng đăng tin → nộp CV → lên Kanban | 218 giờ (17,7%) |
| **GĐ3 — Tính năng cốt lõi** | T5-T6/2026 (S4-S6) | State Machine, nhận & lưu hồ sơ, email tự động, chấm phỏng vấn + radar, dashboard, offer | 294 giờ (23,9%) |
| **GĐ4 — Tái định vị hậu hội đồng** | T7-T8/2026 (S7-S9) | Gỡ Quiz; trục tiêu chí (AI đề xuất → duyệt → phiếu chấm phỏng vấn); Yêu cầu tuyển dụng; pool khung giờ | 284 giờ (23,1%) |
| **GĐ5 — Hoàn thiện, Đo lường & Bảo vệ** | T8/2026 (S9-S10) | Minh chứng sơ cấp, đo chất lượng AI, kiểm thử, triển khai, tài liệu, bảo vệ 2 | 324 giờ (26,3%) |

**Cột mốc chính:**

| **Mốc** | **Ngày** | **Tiêu chí đạt** |
| --- | --- | --- |
| M0 — Chốt yêu cầu & thiết kế | 14/04/2026 | SRS + ERD + Use Case được duyệt |
| M1 — Nền tảng chạy được | 12/05/2026 | Luồng đăng tin → nộp CV chạy end-to-end |
| M2 — Bản demo đầy đủ | 23/06/2026 | 9 module chạy thông với dữ liệu demo |
| M3 — **Bảo vệ 1** | 10/07/2026 | Trình bày trước hội đồng, nhận phản hồi |
| M4 — Hoàn tất tái định vị | 09/08/2026 | Trục tiêu chí + đặt lịch phỏng vấn chạy thật |
| M5 — **Bảo vệ 2** | 31/08/2026 | Sản phẩm hoàn thiện, tài liệu và số liệu đo đầy đủ |

## 9.2 Phân công nhóm 5 người

| **Mã** | **Thành viên** | **Vai trò** | **Phạm vi phụ trách chính** | **Khối lượng** |
| --- | --- | --- | --- | --- |
| **BE1** | **Vũ Gia Khánh** | BA/PM kiêm Backend Lead | Kiến trúc hệ thống · Xác thực & phân quyền · State Machine · Magic link · AI service (bóc tiêu chí từ JD) · Phương pháp đánh giá AI · Tài liệu & bảo vệ | 252 giờ (20,5%) |
| **BE2** | **San** | Backend — Nền tảng dữ liệu & Hạ tầng | Thiết kế CSDL & migration · Multi-tenant/RLS · Lưu trữ tệp (MinIO) · Xử lý PDF · Hàng đợi & worker nền cho lượt bóc tiêu chí · Pool khung giờ · Kiểm thử & triển khai | 256 giờ (20,8%) |
| **BE3** | **Huy Minh** | Backend — Nghiệp vụ & Tích hợp | Job & Yêu cầu tuyển dụng · Quản lý người dùng & phòng ban · Email automation · Tổng hợp điểm phỏng vấn · Dashboard & Analytics · Dữ liệu demo · Sơ đồ thiết kế | 246 giờ (20,0%) |
| **FE1** | **Tùng Anh** | Frontend — Candidate Portal & Phỏng vấn | Career Site & form nộp CV · Các trang magic link (chọn lịch, tra trạng thái, trả lời offer) · Phiếu chấm phỏng vấn & màn interviewer · Màn gọi AI bóc tiêu chí · Kiểm thử FE | 236 giờ (19,2%) |
| **FE2** | **Hùng Anh** | Frontend — Employer Portal & Trực quan hóa | Hệ thống giao diện chung & layout · Kanban 4 pha · Quản lý tin tuyển dụng · Duyệt bộ tiêu chí · Yêu cầu tuyển dụng · Danh sách hồ sơ · Dashboard biểu đồ · Brand theming | 240 giờ (19,5%) |

**Nguyên tắc phân công:** mỗi gói công việc có đúng một người chịu trách nhiệm chính; công việc
liên tầng được tách thành gói Frontend và gói Backend riêng. Chênh lệch khối lượng giữa người
nhiều nhất và ít nhất là 20 giờ (8,1% so với trung bình 246 giờ/người).

## 9.3 Phương pháp minh chứng ba lớp

Để tránh lập luận cảm tính, nhóm dùng ba lớp minh chứng bổ trợ nhau:

1. **Desk research có nguồn** — số liệu thị trường và quy trình as-is của doanh nghiệp ≤ 200 người, trích dẫn nguồn đầy đủ.
2. **Khảo sát trực tuyến** — biểu mẫu 14 câu, chạy song song, thu thập trên diện rộng.
3. **Phỏng vấn sâu 3-5 doanh nghiệp** — bộ 23 câu / 6 phần, mỗi thành viên tiếp cận một doanh
   nghiệp qua quan hệ cá nhân (~30 phút/công ty). Kết quả tổng hợp thành bảng "N công ty × quy
   trình thực tế × nỗi đau × con số" để điền KPI hiện trạng ở Mục 7.

Hạn chế về cỡ mẫu được nêu thẳng khi trình bày, kèm cách bù đắp bằng hai lớp còn lại.

## 9.4 Quản lý thay đổi phạm vi

Đề tài đã trải qua một lần thay đổi phạm vi lớn sau Bảo vệ 1 (10/07/2026), được ghi nhận chính thức:

| **Nội dung** | **Trước** | **Sau** | **Lý do** |
| --- | --- | --- | --- |
| Đối tượng | Doanh nghiệp IT ≥ 100 nhân sự | Doanh nghiệp ≤ 200 nhân sự + công ty gia đình, mọi ngành | Phản hồi hội đồng: đối tượng quá rộng, thiếu minh chứng |
| Module Quiz | Trong phạm vi (sinh đề AI + chống gian lận 3 lớp) | **Loại hoàn toàn** | Không phải nỗi đau cốt lõi của doanh nghiệp nhỏ, làm loãng trọng tâm |
| Vai trò của AI | Máy chấm điểm hồ sơ (một điểm 0-100 cho cả bộ hồ sơ) | **AI đề xuất bộ tiêu chí đánh giá**, người duyệt chốt | Điểm số máy chấm không giải thích được thì người dùng không tin; bộ tiêu chí thì kiểm được từng dòng và dùng lại được khi phỏng vấn |
| Nhà cung cấp AI | OpenAI (API trả phí) | **Local AI** (Ollama) | Chi phí bằng 0, dữ liệu không rời hạ tầng, phù hợp Luật Bảo vệ dữ liệu cá nhân |
| Thời hạn | 15/07/2026 | 31/08/2026 | Bổ sung thời gian cho tái định vị và đo lường chất lượng AI |

Phần phương pháp đánh giá AI xây dựng trong giai đoạn làm Quiz **được tái sử dụng** cho việc đo
chất lượng bóc tiêu chí — khung "bộ test cố định, mỗi lần đổi một yếu tố, đo hai tầng
(máy chấm + rubric người)" giữ nguyên, chỉ đổi đối tượng đo.

# 10\. Tổng kết

Smart Recruitment and Interview System (SRIS) là dự án có quy mô vừa phải nhưng đầy đủ tính
nghiệp vụ của một sản phẩm thực tế, phù hợp để bảo vệ đồ án tốt nghiệp với 5 thành viên trong
5 tháng.

Ba điểm nhóm muốn nhấn mạnh:

1. **Sản phẩm có đối tượng rõ ràng.** Không làm ATS cho mọi doanh nghiệp, mà làm cho nhóm chưa
   có phòng nhân sự — nhóm bị các nền tảng lớn bỏ qua vì không đủ lợi nhuận.
2. **AI có lý do nghiệp vụ, không phải gắn cho có.** AI đề xuất tiêu chí đánh giá dưới dạng bản
   nháp; con người chốt tiêu chí và ra quyết định tuyển. Ranh giới trách nhiệm rõ ràng.
3. **Chất lượng AI được đo, không nói suông.** Bộ 10 tin tuyển dụng đa ngành, ba phiên bản prompt,
   chấm hai tầng: **F1 0.876**, không tiêu chí nào AI tự bịa. Hạn chế của phép đo cũng ghi rõ
   cùng số liệu — thay vì chỉ trưng con số đẹp.

Sản phẩm có kiến trúc phân tầng rõ ràng, dữ liệu cô lập theo từng doanh nghiệp ở tầng cơ sở dữ
liệu, và toàn bộ AI chạy cục bộ — đủ nền tảng để phát triển tiếp thành một sản phẩm thương mại
sau khi tốt nghiệp.

─────── Hết tài liệu ───────
