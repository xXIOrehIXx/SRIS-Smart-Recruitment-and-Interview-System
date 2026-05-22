**ĐỒ ÁN TỐT NGHIỆP**

──────────────────

**BUSINESS OVERVIEW DOCUMENT**

_Tài liệu Tổng quan Nghiệp vụ_

Tên đề tài:

**Xây dựng Hệ thống tuyển dụng và phỏng vấn thông minh**

_cho Doanh nghiệp (Smart Recruitment and Interview System)_

| **Sản phẩm:**  | Smart Recruitment and Interview System           |
| -------------- | ------------------------------------------------ |
| **Mô hình:**   | SaaS Multi-tenant ATS tích hợp AI                |
| **Team:**      | 5 thành viên (3 Backend .NET + 2 Frontend React) |
| **Thời gian:** | 3 tháng (01/04/2026 - 15/07/2026)                |
| **Phiên bản:** | v1.0 - 19/05/2026                                |

# Mục lục

**1\.** Executive Summary - Tóm tắt điều hành

**2\.** Bối cảnh & Vấn đề kinh doanh

**3\.** Đối tượng người dùng (Personas)

**4\.** Phạm vi sản phẩm (Scope)

**5\.** Tính năng nghiệp vụ cốt lõi

**6\.** Quy trình nghiệp vụ end-to-end

**7\.** Mục tiêu kinh doanh & KPI

**8\.** Phân tích rủi ro & Giảm thiểu

**9\.** Kế hoạch triển khai 3 tháng

# 1\. Executive Summary - Tóm tắt điều hành

Dự án Smart Recruitment and Interview System (SRIS) là một nền tảng SaaS đa thuê bao (multi-tenant) hỗ trợ doanh nghiệp IT quy mô từ 100 nhân sự trở lên quản lý toàn bộ vòng đời tuyển dụng - từ đăng tin tuyển dụng, sàng lọc CV, phỏng vấn, đến ra quyết định tuyển dụng.

Sản phẩm tích hợp ba ứng dụng AI cốt lõi:

- **Chấm điểm CV tự động** - so khớp CV ứng viên với Job Description, trả về điểm 0-100 kèm nhận xét điểm mạnh/yếu.
- **Sinh câu hỏi quiz từ JD** - tự động tạo bộ câu hỏi trắc nghiệm phù hợp từng vị trí, giảm 90% thời gian HR soạn đề.
- **Phát hiện gian lận quiz** - hệ thống chống gian lận 3 lớp khi ứng viên làm bài kiểm tra online.

Bên cạnh đó, sản phẩm giải quyết các vấn đề thực tế của thị trường Việt Nam thông qua các tính năng đặc thù như Actionable Email cho Hiring Manager (phê duyệt CV ngay trong email không cần login), Collaborative Scoring với Radar Chart (chấm phỏng vấn đa tiêu chí, chống thiên kiến), và Dashboard 360° (báo cáo nguồn ứng viên theo UTM source).

**💡 Giá trị cốt lõi**

Hệ thống hướng tới giảm 30% Time-to-Hire (từ 18 ngày xuống dưới 12 ngày) và tiết kiệm 20 giờ/tuần cho mỗi Recruiter thông qua tự động hóa và ứng dụng AI.

# 2\. Bối cảnh & Vấn đề kinh doanh

## 2.1 Bối cảnh thị trường

Thị trường tuyển dụng IT Việt Nam đang trong giai đoạn cạnh tranh khốc liệt. Các công ty quy mô 100+ nhân sự gặp ba điểm nghẽn lớn:

### Nỗi đau 1 - Nhập liệu thủ công tốn thời gian

HR Recruiter dành 3-4 giờ mỗi ngày chỉ để sao chép thông tin từ file CV PDF vào file Excel quản lý. Đây là công việc lặp đi lặp lại, không tạo giá trị trực tiếp.

### Nỗi đau 2 - Thất thoát ứng viên (Candidate Leakage)

Khi tỷ lệ apply cao (đặc biệt vào các Job Fair), HR thường bỏ sót email, quên gửi phản hồi (rejection letter), dẫn đến hình ảnh nhà tuyển dụng (Employer Branding) bị tổn hại nghiêm trọng.

### Nỗi đau 3 - Thiếu dữ liệu điều hành (No Analytics)

Giám đốc không biết nguồn tuyển dụng nào (VietnamWorks, TopCV, LinkedIn) mang lại ứng viên chất lượng nhất để phân bổ ngân sách marketing tuyển dụng hợp lý.

## 2.2 Cơ hội từ AI và SaaS

Các nền tảng ATS quốc tế (Workable, Greenhouse, Teamtailor) đã chứng minh mô hình SaaS Multi-tenant là chuẩn industry. Tuy nhiên, chưa có sản phẩm nào tối ưu riêng cho thị trường Việt Nam với các đặc thù:

- Văn hóa làm việc: Hiring Manager bận, ngại đăng nhập hệ thống lạ
- Quy mô SMB phổ biến: 100-500 nhân sự, ngân sách hạn chế cho ATS enterprise
- Tích hợp AI: ChatGPT/Gemini đã chín muồi, đặc biệt với tiếng Việt
- Tuân thủ pháp lý: Luật An ninh mạng Việt Nam 2018 về xử lý dữ liệu cá nhân

# 3\. Đối tượng người dùng (Personas)

Hệ thống phục vụ 5 nhóm người dùng chính, mỗi nhóm có hồ sơ và nhu cầu riêng biệt.

## 3.1 Chị Mai - Recruiter (Key User)

| **Vai trò**           | Chuyên viên Tuyển dụng (HR Manager)                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Câu nói đặc trưng** | "Chị dành cả thanh xuân chỉ để copy paste dữ liệu từ Email ứng viên ra file Excel."                                                    |
| **Pain points**       | • Quên nhắc ứng viên lịch phỏng vấn<br><br>• Trưởng bộ phận không phản hồi CV kịp thời<br><br>• Cuối tháng tổng hợp KPI mất hẳn 1 ngày |
| **Mục tiêu**          | • Hệ thống có nút 1-click duyệt ứng viên<br><br>• Tự động đọc CV, trích xuất số điện thoại, bắt CV trùng                               |

## 3.2 Anh Bình - Hiring Manager (End User)

| **Vai trò**           | Trưởng Phòng Kỹ Thuật (Hiring Manager)                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Câu nói đặc trưng** | "Đừng bắt tôi đăng nhập vào hệ thống lạ nào nữa. Gửi mail ngắn gọn, tôi ấn Duyệt là xong."                                                                        |
| **Pain points**       | • Phải đọc CV dài 4 trang định dạng lộn xộn<br><br>• Quên trả lời email HR dẫn đến mất ứng viên giỏi<br><br>• Khó đánh giá chéo với các Leader khác khi phỏng vấn |
| **Mục tiêu**          | • UI tối ưu cho điện thoại (mobile-first)<br><br>• ATS auto generate bảng tóm tắt kỹ năng ứng viên                                                                |

## 3.3 Tuấn Kiệt - Ứng viên IT (External User)

| **Vai trò**           | Ứng viên IT (Candidate)                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Câu nói đặc trưng** | "Nếu trang tuyển dụng bắt tạo tài khoản dài dòng, tôi sẽ thoát và nộp công ty khác."                                      |
| **Pain points**       | • Gửi CV xong không có email confirm<br><br>• Website tuyển dụng load chậm<br><br>• Bắt điền lại thông tin đã có trong CV |
| **Mục tiêu**          | • Nộp CV trong 1 trang duy nhất (one-page)<br><br>• Nhận email phản hồi chuyên nghiệp ngay sau Submit                     |

## 3.4 Nhóm phụ - Admin & Interviewer

| **Vai trò**     | **Admin (per tenant)**                                           | **Interviewer**                                                           |
| --------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Mô tả**       | Quản trị viên công ty, quản lý user trong tenant, cấu hình brand | Người chấm phỏng vấn theo tiêu chí (có thể là nhiều người cho 1 ứng viên) |
| **Quyền chính** | Cấu hình hệ thống, quản lý role, brand theming                   | Chấm điểm theo tiêu chí, xem radar chart, đề xuất hire/reject             |

# 4\. Phạm vi sản phẩm (Scope)

## 4.1 Trong phạm vi (In-Scope)

Hệ thống bao gồm 9 module nghiệp vụ chính:

| **#**  | **Module**                | **Phạm vi**                                                         |
| ------ | ------------------------- | ------------------------------------------------------------------- |
| **M1** | **Job Management**        | Quản lý tin tuyển dụng, Career Site công khai, form nộp CV one-page |
| **M2** | **Candidate Pipeline**    | Kanban kéo thả, State Machine, Activity Log, Internal Notes         |
| **M3** | **AI CV Scoring**         | Chấm điểm CV 0-100, ranking ứng viên, cache theo hash file          |
| **M4** | **Email Automation**      | 4 email tự động theo state machine, template động                   |
| **M5** | **Quiz Engine + AI**      | AI sinh quiz từ JD, magic link, đếm ngược, anti-cheat 3 lớp         |
| **M6** | **Collaborative Scoring** | Multi-interviewer chấm theo tiêu chí, Radar chart, Blind Review     |
| **M7** | **Dashboard & Analytics** | Funnel chart, KPI metric card, báo cáo nguồn UTM                    |
| **M8** | **Multi-tenant & Brand**  | Tách dữ liệu theo company_id, theming logo + màu chủ đạo            |
| **M9** | **Auth & Authorization**  | JWT + RBAC 4 role, Candidate magic link không cần đăng ký           |

## 4.2 Ngoài phạm vi (Out-of-Scope)

Các tính năng sau không nằm trong scope đồ án 3 tháng:

- Mobile app native (iOS/Android) - Web responsive đã đáp ứng đủ
- Webcam proctoring cho quiz - Yêu cầu ML model riêng, vượt scope
- Tích hợp Google Calendar / lịch phỏng vấn tự động
- Coding challenge / online judge platform
- Module tính lương / chấm công (Core HR)
- Chatbot AI phản hồi ứng viên real-time
- Tích hợp LDAP / SSO Active Directory (chỉ làm optional NFR)
- Subdomain động (congtyA.smarthire.vn) - dùng path routing /t/{slug} cho demo

# 5\. Tính năng nghiệp vụ cốt lõi

Phần này mô tả chi tiết 5 tính năng có giá trị nghiệp vụ cao nhất, là điểm khác biệt của sản phẩm so với các ATS thị trường.

## 5.1 AI Quiz Generation - Sinh câu hỏi tự động từ JD

HR không cần tự soạn câu hỏi trắc nghiệm cho từng vị trí. Hệ thống tự động phân tích Job Description và sinh ra bộ 10-20 câu MCQ phù hợp với yêu cầu kỹ năng.

**Quy trình hoạt động:**

- HR tạo Job + JD → bấm "AI Gen Quiz"
- Hệ thống gửi JD lên OpenAI với prompt được tối ưu sẵn
- OpenAI trả về JSON gồm: question, 4 options, correct_answer, explanation, difficulty
- HR preview, sửa nếu cần, publish bộ đề
- Bộ đề được cache theo job_id → mọi ứng viên cùng job dùng chung 1 đề, tiết kiệm chi phí OpenAI

**⭐ Điểm mới so với thị trường**

Đa số ATS hiện chỉ chấm điểm CV bằng AI, chưa làm AI sinh quiz tự động. Đây là điểm khác biệt được thầy hướng dẫn gợi ý bổ sung.

## 5.2 Anti-cheat 3 lớp cho Quiz online

Triết lý: "Raise the cost of cheating" - không cố detect 100% mà tăng chi phí gian lận. Hệ thống áp dụng mô hình defense-in-depth 3 tầng:

| **Lớp** | **Cơ chế**                | **Detect được gì**                                                                                 |
| ------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| **1**   | **Behavioral signals**    | Phát hiện chuyển tab, paste content, mở DevTools, đo thời gian per câu - gắn cờ ứng viên đáng nghi |
| **2**   | **Question design**       | AI sinh câu hỏi tình huống thay vì tra cứu - khó Google trong 30 giây                              |
| **3**   | **Cross-check Stage 1↔2** | So sánh điểm quiz async với quiz onsite - chênh > 30% nghi ngờ gian lận                            |

**Disclosure & Consent:**

Trước khi làm bài, ứng viên xem màn hình thông báo rõ những hành vi nào sẽ được ghi nhận. Ứng viên phải tick checkbox đồng ý mới được bắt đầu. Phù hợp với Luật An ninh mạng Việt Nam 2018 về thu thập dữ liệu cá nhân.

## 5.3 Actionable Email cho Hiring Manager

Giải quyết trực tiếp pain point của Persona Anh Bình: "Đừng bắt tôi đăng nhập hệ thống lạ."

**Cách hoạt động:**

- HR sàng lọc CV, bấm "Gửi Sếp duyệt"
- Hệ thống gửi email vào inbox Hiring Manager kèm CV PDF và AI Summary
- Email có nhúng sẵn 2 nút bấm: \[Phê duyệt Phỏng vấn\] và \[Loại\]
- Hiring Manager bấm thẳng từ điện thoại hoặc desktop - không cần login
- Kanban tự cập nhật stage, hoặc hiện popup Quick Note nếu Loại

**Bảo mật:**

Mỗi nút bấm trong email là một URL chứa token một lần dùng, có TTL 48-72 giờ. Sau khi sử dụng, token bị vô hiệu hóa để tránh forward email hoặc bấm trùng.

## 5.4 Collaborative Scoring với Blind Review

Cho phép nhiều interviewer chấm phỏng vấn ứng viên độc lập theo nhiều tiêu chí, tránh thiên kiến (anchoring bias).

**Đặc trưng:**

- HR cấu hình bộ tiêu chí cho từng job (ví dụ: Kỹ thuật, Giao tiếp, Tư duy, Tiếng Anh, Culture fit)
- Mỗi interviewer chấm thang điểm 1-5 cho từng tiêu chí, kèm note
- Trạng thái scoring: draft → submitted - chỉ thấy điểm người khác khi mình đã submit
- Hệ thống tự tổng hợp, hiển thị Radar Chart 5 trục so sánh interviewer
- Insight tự động: phát hiện đồng thuận (std dev &lt; 0.5) hoặc bất đồng (std dev &gt; 1.0) giữa interviewer

**💡 Lưu ý kỹ thuật**

Insight tự động không dùng AI - chỉ dùng standard deviation (thống kê đơn giản). Đây là quyết định thiết kế thông minh: không phải mọi tính năng "thông minh" đều cần AI.

## 5.5 Multi-tenant Architecture - Đa thuê bao

Hệ thống phục vụ nhiều công ty khách hàng trên cùng một hạ tầng, dữ liệu các công ty được cách ly tuyệt đối.

**Chiến lược:**

Shared Schema + cột company_id - đây là chuẩn industry được Notion, Linear, Slack sử dụng.

- **Tách dữ liệu:** Mọi bảng nghiệp vụ đều có cột company_id, mọi query bắt buộc WHERE company_id
- **Defense-in-depth:** EF Core Global Query Filter tự động inject filter, kết hợp với Row-Level Security của SQL Server
- **Brand theming:** Mỗi công ty upload logo, chọn màu chủ đạo, viết section "Về công ty" riêng
- **Career Site path:** /t/{company-slug} cho mỗi tenant (ví dụ: /t/techcorp, /t/financeco)

# 6\. Quy trình nghiệp vụ end-to-end

Quy trình tuyển dụng đầy đủ trải qua 7 phase, từ khi ứng viên nộp CV đến khi có kết quả tuyển dụng.

## Phase 0 - HR Setup (làm 1 lần khi tạo Job)

- HR tạo Job với mô tả công việc (JD) chi tiết
- Bấm "AI Gen Quiz" → OpenAI tạo bộ câu hỏi từ JD
- HR review, sửa câu sai, publish bộ đề

## Phase 1 - Ứng viên nộp CV

- Ứng viên vào Career Site công ty, xem job đang mở
- Click "Ứng tuyển" → form one-page, upload PDF, không cần tạo tài khoản
- Nhận email confirm tự động ngay sau Submit

## Phase 2 - Hệ thống xử lý tự động

- CV Parser API bóc tách: họ tên, SĐT, email, skills, kinh nghiệm
- AI Scoring: so CV với JD → trả điểm 0-100 + nhận xét điểm mạnh/yếu
- Lưu DB, ứng viên xuất hiện trên Kanban HR ở cột "New"

## Phase 3 - Sàng lọc sơ bộ

## _HR_

- HR xem Kanban, sort theo AI score, filter theo job/source
- Review CV chi tiết, đọc AI Summary, ghi chú nội bộ
- Bấm "Gửi Sếp duyệt" cho các CV phù hợp

## _Hiring Manager_

- Email vào inbox HM kèm CV PDF + AI Summary
- HM bấm "Phê duyệt" → Kanban tự chuyển sang Quiz stage
- Hoặc bấm "Loại" → popup Quick Note để HM nhập lý do

## Phase 4 - Ứng viên làm AI Quiz

- Magic link gửi vào email ứng viên (TTL 48h)
- Disclosure & Consent screen → ứng viên đồng ý mới bắt đầu
- Làm bài với timer đếm ngược, anti-cheat ghi nhận hành vi
- Hết giờ tự submit → chấm điểm tự động → hiện badge trên Kanban

## Phase 5 - Phỏng vấn & Collaborative Scoring

- HR lên lịch phỏng vấn cho UV đạt điểm quiz
- Nhiều interviewer chấm độc lập theo tiêu chí (Blind Review)
- Hệ thống tổng hợp, hiển thị Radar Chart so sánh
- Insight tự động cảnh báo nếu có bất đồng lớn giữa interviewer

## Phase 6 - Kết quả & Dashboard

- Email offer letter tự gửi cho ứng viên trúng tuyển
- Email cảm ơn cho ứng viên không trúng
- Activity Log ghi lại toàn bộ lịch sử ứng viên
- Dashboard cập nhật funnel chart, time-to-hire, cost-per-hire, UTM source

# 7\. Mục tiêu kinh doanh & KPI

Hệ thống đặt mục tiêu đạt được 4 KPI cụ thể, đo lường được sau khi triển khai:

| **KPI**                        | **Hiện trạng (As-Is)** | **Mục tiêu (To-Be)**                  |
| ------------------------------ | ---------------------- | ------------------------------------- |
| **Time-to-Hire**               | 18 ngày                | **< 12 ngày (giảm 30%)**              |
| **Recruiter làm tác vụ Admin** | 3-4 giờ/ngày           | **< 1 giờ/ngày (tiết kiệm 20h/tuần)** |
| **Báo cáo nguồn ứng viên**     | Không có               | **Dashboard 360° theo UTM source**    |
| **Phát hiện gian lận quiz**    | 0% (không có cơ chế)   | **\> 60% (risk score + cross-check)** |

**📊 Ý nghĩa các KPI**

Time-to-Hire và 20h/tuần là chỉ số trực tiếp đo hiệu quả của Email Automation và AI Scoring. Dashboard UTM source giúp Giám đốc ra quyết định phân bổ ngân sách marketing tuyển dụng (~500 triệu/năm cho doanh nghiệp 100+ nhân sự).

# 8\. Phân tích rủi ro & Giảm thiểu

Đánh giá 5 rủi ro chính của dự án và chiến lược giảm thiểu:

| **Rủi ro**                             | **Impact** | **Chiến lược giảm thiểu**                                           |
| -------------------------------------- | ---------- | ------------------------------------------------------------------- |
| **Kháng cự thay đổi (HR quen Excel)**  | **Cao**    | UI/UX mượt nhất có thể, đào tạo qua Prototype sớm trước khi go-live |
| **CV Parser sai với PDF phức tạp**     | **Trung**  | Fallback Manual Edit - HR sửa thủ công sau khi nhận kết quả thô     |
| **Chi phí OpenAI cao khi nhiều UV**    | **Trung**  | Cache kết quả theo hash CV + hash JD, batch processing              |
| **Ứng viên gian lận quiz online**      | **Cao**    | Anti-cheat 3 lớp + cross-check với onsite test                      |
| **Bất đồng giữa interviewer khi chấm** | **Thấp**   | Insight tự động cảnh báo std deviation > 1.0                        |

# 9\. Kế hoạch triển khai 3 tháng

Dự án được chia thành 3 giai đoạn rõ ràng, mỗi giai đoạn có mục tiêu báo cáo cụ thể với thầy hướng dẫn:

## Tháng 1 (T4/2026) - Nền tảng & Setup

**Mục tiêu báo cáo:**

Thầy thấy được thiết kế hệ thống chuẩn, source code chạy được, demo Auth và luồng nộp CV cơ bản.

**Công việc chính:**

- Chốt requirement, viết SRS hoàn thiện
- Thiết kế ERD database (SQL Server) + Use Case diagrams
- Setup project: .NET Core + React + SQL Server
- Hoàn thiện Auth + RBAC, CRUD Job & Application cơ bản
- Giao diện Kanban tĩnh, form nộp CV one-page

## Tháng 2 (T5/2026) - Tính năng cốt lõi

**Mục tiêu báo cáo:**

Demo end-to-end: nộp CV → AI chấm điểm → HR kéo Kanban → gửi quiz → kết quả → email tự động gửi đi.

**Công việc chính:**

- State Machine + Email tự động hoàn chỉnh
- Tích hợp OpenAI: AI Scoring CV + AI Gen Quiz
- Kanban kéo thả hoạt động đầy đủ
- Quiz Engine FE + BE (bao gồm Anti-cheat)
- Collaborative Scoring + Radar Chart
- Dashboard với funnel chart, KPI cards
- Brand theming + Multi-tenant data isolation

## Tháng 3 (T6-T7/2026) - Hoàn thiện & Bảo vệ

**Mục tiêu báo cáo:**

Sản phẩm hoàn thiện, deploy thật trên cloud, tài liệu đầy đủ, sẵn sàng bảo vệ.

**Công việc chính:**

- Bug fix, tối ưu UX dựa trên feedback
- Deploy hệ thống lên server thật (Azure SQL + Vercel + Render/VPS)
- Viết báo cáo đồ án hoàn chỉnh
- Làm slide thuyết trình + chuẩn bị demo script cho hội đồng
- Test toàn bộ flow với data thật, chuẩn bị bài bảo vệ

## Phân công nhóm 5 người

| **Vai trò** | **Phụ trách chính**     | **Module/Tính năng**                                               |
| ----------- | ----------------------- | ------------------------------------------------------------------ |
| **FE 1**    | **Candidate Portal**    | Career Site, form nộp CV, trang làm quiz, status tracking          |
| **FE 2**    | **Employer Dashboard**  | Kanban board, chi tiết ứng viên, dashboard biểu đồ, brand settings |
| **BE 1**    | **Core API**            | Auth/JWT, RBAC, Multi-tenant, State Machine, Collaborative Scoring |
| **BE 2**    | **Service Layer**       | File upload, PDF extract, Email service, Quiz engine               |
| **BA/PM**   | **Quản trị + AI Layer** | AI scoring service, Prompt engineering, Analytics, Tài liệu        |

## Tổng kết

Hệ thống Smart Recruitment and Interview System (SRIS) là dự án có quy mô vừa phải nhưng đầy đủ tính nghiệp vụ enterprise, phù hợp để bảo vệ đồ án tốt nghiệp với 5 thành viên trong 3 tháng. Sản phẩm tích hợp AI có lý do nghiệp vụ rõ ràng (không phải gắn AI để có), giải quyết các pain points thực tế của thị trường tuyển dụng IT Việt Nam, và có roadmap kỹ thuật rõ ràng để scale lên trong tương lai.

─────── Hết tài liệu ───────