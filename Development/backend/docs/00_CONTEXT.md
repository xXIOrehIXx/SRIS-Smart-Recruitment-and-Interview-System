# 00 — CONTEXT.md

Kim chỉ nam (single source of truth) cho mọi chat trong Project SRIS. Mọi chat mới Claude PHẢI đọc file này đầu tiên.
Quy ước tên gọi: Radar Chart = hình dạng mạnh/yếu theo trục tiêu chí; standard deviation (độ lệch chuẩn) = con số đo các interviewer có lệch nhau không → flag "cần bàn". Đừng gọi lẫn hai thứ.

---

## 0. TRẠNG THÁI DỰ ÁN

- **ĐÃ BẢO VỆ HỘI ĐỒNG (07/2026)** — nhận 4 feedback, quy về 3 vấn đề gốc (Section 12). Toàn bộ tái định vị hậu-hội-đồng đã CHỐT trong file này: target thu hẹp (≤200 người + công ty gia đình), pipeline hiển thị 4 pha, chấm CV theo TIÊU CHÍ (bỏ ném cả JD↔CV), Talent Pool nâng lên hero smart feature.
- **MODULE QUIZ ĐÃ LOẠI HOÀN TOÀN KHỎI SCOPE — thầy hướng dẫn ĐÃ XÁC NHẬN (07/2026)** (cả quiz nhập tay lẫn AI gen — lý do & đạn Q&A: Section 3 OUT + Section 10). State machine còn 6 state, magic link còn 3 purpose. **Code quiz đã GỠ HẲN khỏi main (07/2026):** xóa toàn bộ entities/services/controllers/endpoint AI; migration `V012__drop_quiz.sql` drop 6 bảng quiz + siết CHECK còn 6 state/3 purpose; state machine (bỏ G1), email, trang status ứng viên đã cập nhật theo. KHÔNG demo, KHÔNG đưa vào tài liệu.
- AI dùng Local AI + Vector (không OpenAI/Gemini).
- Đã hoàn thành PoC chạy thật: Việc 2 (Local AI+Vector), Việc 3 (PDF extract), Việc 4 (pipeline LLM JSON — tính năng gốc đã loại, GIỮ pattern tái dùng), Việc 5 (State Machine). Chi tiết & bài học ở Section 14.
- Đặt lịch phỏng vấn (Section 15) **ĐÃ CODE 07/2026 — mô hình POOL khung dùng chung (thay luồng 1-1)**. Chấm CV theo tiêu chí (5.18) ĐÃ CODE end-to-end (07/2026 — Việc B4 phần code, xem 5.18 mục TRẠNG THÁI CODE + Section 14); còn phần ĐO ngưỡng/chunk (khung §16, P/R/F1) chưa làm.** Yêu cầu tuyển dụng (5.17) chờ chốt mô hình hóa (Việc B3).
- Mô hình role: 4 role đăng nhập Portal — Admin, Recruiter, Interviewer, Department Manager; **một người gán được NHIỀU role** (công ty gia đình: 1 chủ giữ cả 4). Candidate là khách ẩn danh dùng magic link. Người quyết tuyển = Department Manager của job (Job.department_manager_id; để trống → Recruiter quyết). OfferDetail cho state OFFER; ứng viên tự nhận/từ chối qua magic link OFFER_RESPONSE. DB: nhóm bảng Quiz ĐÃ GỠ (V012); EvaluationCriteria ĐÃ MỞ RỘNG + thêm CvChunk/ApplicationCriterionMatch (V013 — 5.18); ERD mới (Việc B3) còn lại: thêm Yêu cầu tuyển dụng + vẽ lại sơ đồ. ERD vẽ kiểu chỉ thuộc tính + quan hệ bằng đường nối, không vẽ cột FK; GIỮ MagicLinkToken, KHÔNG vẽ ActivityLog + EmailLog; mọi bảng đều có company_id. Quan hệ Application → MagicLinkToken là 1-N, nhãn generates. Job có 2 FK tới User (department_manager_id, created_by) → 2 đường nối: decides hiring for + creates.
- Phạm vi: tuyển cho MỌI vị trí, không chỉ IT (Charter/Persona nghiêng IT chỉ là ví dụ).
- Tên đồ án: Smart Recruitment and Interview System (SRIS).
- CẦN HỎI THẦY: (1) phỏng vấn nhiều vòng có in-scope không (bằng chứng VPBank — 5.12, 10); (2) xác nhận tái định vị target ≤200 người + luồng Yêu cầu tuyển dụng mới.

---

## 1. TÓM TẮT DỰ ÁN

- Tên: Smart Recruitment and Interview System (SRIS) — Hệ thống Tuyển dụng và Phỏng vấn Thông minh.
- Mô hình: SaaS Multi-tenant ATS tích hợp AI — cung cấp DỊCH VỤ (thuê dùng, trả phí định kỳ), KHÔNG bán đứt. Nhiều công ty dùng chung một hệ thống, cô lập theo company_id.
- **Đối tượng (CHỐT hậu-hội-đồng): công ty NHỎ ≤200 nhân sự + công ty gia đình** — nhóm chưa có phòng HR chuyên trách hoặc HR kiêm nhiệm. (Mốc ≤200 lao động khớp định nghĩa DNNVV theo Luật Hỗ trợ DNNVV 04/2017/QH14 — dùng làm căn cứ pháp lý khi bảo vệ.)
- **Định vị (CHỐT): "Quy trình tuyển dụng tối giản đúng chuẩn cho công ty chưa có phòng HR."** AI là trợ lý thầm lặng, KHÔNG phải ngôi sao. Nguyên tắc thiết kế xuyên suốt: **đơn giản là mặc định, phức tạp là tùy chọn** — hệ thống lớn lên cùng công ty. Hệ thống KHÔNG thêm quy trình cho công ty nhỏ — nó CẤU TRÚC HÓA đúng các bước họ đang làm rời rạc (Section 4).
- **Luận điểm PDPD (CHỐT):** Luật Bảo vệ dữ liệu cá nhân VN hiệu lực 01/01/2026 → doanh nghiệp tuyển dụng phải tuân thủ nghiêm về dữ liệu ứng viên. Local AI + cô lập dữ liệu của SRIS = **lợi thế TUÂN THỦ PHÁP LUẬT**, không chỉ là điểm kỹ thuật. Dùng cho cả defense lẫn định vị thị trường.
- Thời gian: 3 tháng (01/04 — 15/07/2026). Đã qua Bảo vệ 1; đang giai đoạn sửa theo feedback hội đồng.
- Team 5: 1 BA Lead/PM (kiêm Backend, là tôi) · 2 Backend (.NET) · 2 Frontend (React).
- Stack: .NET 10 minimal API + EF Core (orchestration & DB) · Python FastAPI (AI: embedding + LLM) · React · SQL Server 2025 (kiểu VECTOR) · Amazon S3 (object storage — lưu CV gốc) · Local AI · Vercel (FE) · Render/VPS (BE).
- 2 mảng chủ đạo: Recruitment (tuyển dụng) · Interview (phỏng vấn).

---

## 2. VAI TRÒ NGƯỜI DÙNG

Nguyên tắc cửa vào: người trong cuộc đều đăng nhập Portal — Admin, Recruiter, Interviewer, Department Manager. Chỉ Candidate là khách ẩn danh, tham gia qua magic link an toàn, KHÔNG cần account. (Câu chốt khi bảo vệ.)

**GÁN CHỒNG ROLE:** 4 role là 4 TẬP QUYỀN, không phải 4 con người. Một User gán được nhiều role cùng lúc. Công ty gia đình: 1 chủ giữ cả 4 role, làm hết từ đăng tin đến quyết tuyển. Công ty lớn hơn: tách dần từng role ra từng người. → Câu bảo vệ: "Hệ thống phân quyền đầy đủ 4 role, sẵn sàng cho công ty tách vai — nhưng công ty nhỏ chỉ cần MỘT người giữ hết. Không bắt công ty 10 người xài bộ máy công ty 1000 người."

Ba vai tách bạch — chấm / quyết / thao tác: Interviewer chấm (cho điểm phỏng vấn). Department Manager (trưởng bộ phận) quyết (chốt tuyển hay không, ở bước OFFER) **và ra đề tuyển dụng (tạo Yêu cầu tuyển dụng — 5.17)**. Recruiter thao tác (vận hành cả pipeline, sàng lọc CV, đặt lịch).

| Role | Mô tả | Cách vào | Quyền chính |
|---|---|---|---|
| Admin (per tenant) | Quản trị viên công ty | Đăng nhập Portal | Quản lý user, gán role, cấu hình brand |
| Recruiter | Vận hành toàn bộ pipeline | Đăng nhập Portal | Xem Yêu cầu tuyển dụng → tạo Tin tuyển dụng; duyệt bộ tiêu chí AI bóc; quản lý Kanban, sàng lọc CV, đặt lịch, gửi offer |
| Interviewer | Người chấm phỏng vấn | Đăng nhập Portal | Xem buổi PV được giao, chấm điểm theo tiêu chí (Blind Review nếu bật), sửa điểm đã gửi (tới khi khóa), xem lịch sử |
| Department Manager | Trưởng bộ phận — ra đề và quyết | Đăng nhập Portal | Tạo Yêu cầu tuyển dụng (vị trí + tiêu chí cần thiết — 5.17); ở bước OFFER xem điểm/Radar rồi chốt tuyển hay không. Không đụng sàng lọc CV / vận hành |
| Candidate | Ứng viên ngoài hệ thống | Magic link | Nộp CV, chọn lịch / xem trạng thái / nhận-từ chối offer |

Cách phân biệt role (chống nhầm): (1) Vào bằng gì? 4 role nội bộ đều login; chỉ Candidate dùng magic link. (2) Việc cốt lõi 1 động từ? Câu thần chú: Recruiter lái · Interviewer chấm · Department Manager quyết · Candidate ứng tuyển · Admin dựng sân.
"Chấm" vs "quyết": Interviewer cho điểm (input). Department Manager ra phán xét tuyển/loại — chỉ ở MỘT điểm duy nhất là bước OFFER. Job không gán DM → Recruiter tự quyết. DM đứng HAI ĐẦU quy trình: ra đề (Yêu cầu tuyển dụng + tiêu chí) và chốt (OFFER) — vai tròn trịa, dễ bảo vệ.

---

## 3. SCOPE

### IN-SCOPE
- Recruitment: Career Site · Pipeline Kanban (hiển thị 4 pha — 5.16) + State Machine nội bộ · **Yêu cầu tuyển dụng (DM) → Tin tuyển dụng (Recruiter) — 5.17** · **AI bóc tiêu chí + chấm CV THEO TỪNG TIÊU CHÍ có giải thích (Local AI + Vector) — 5.18** · Email Automation · Multi-tenant (shared schema + company_id) · Brand theming.
- Interview: Collaborative Scoring + Radar Chart (Blind Review tự bật khi >1 người chấm) · CRUD tiêu chí chấm (dùng CHUNG bộ tiêu chí với chấm CV — 5.18) · Đặt lịch phỏng vấn nội bộ + .ics (Section 15).
- Chung: Dashboard Analytics · RBAC 4 role gán chồng + Candidate magic link · Activity Log & Internal Notes.
- **"Smart" (2 điểm nhấn khi bảo vệ):** (1) **Talent Pool reverse matching** — CV cũ "sống lại" cho job mới (hero, ĐÃ CODE); (2) **Chấm CV theo tiêu chí có giải thích** (khớp/thiếu + câu bằng chứng) — trả lời thẳng câu hội đồng "AI chấm dựa vào đâu".
- "Wow" phụ: Blind Review · Insight std deviation · Ứng viên tự nhận/từ chối offer online · Đặt lịch self-service kiểu Calendly thu nhỏ.

### TALENT POOL / CV SUGGESTION — HERO (đã code)
- Recruiter bấm "Gợi ý CV", hệ thống tìm CV cũ có vector gần JD/tiêu chí → Top N + điểm. Vector search LUÔN kèm company_id. KHÔNG real-time, không gợi ý ngược.
- Nguồn dữ liệu = KHO CvDocument CŨ của chính công ty đó — không nguồn mới, không scrape, không mua data. Vector không mất khi ứng viên rớt / job đóng.
- Cơ chế = ĐẢO CHIỀU truy vấn chấm CV: "JD mới → quét lại kho CV cũ". Tái dùng embedding + vector search, KHÔNG thêm model/hạ tầng.
- Cô lập tenant: chỉ thấy CV nộp vào cùng company_id.
- Pháp lý/đạo đức: ứng viên đã chủ động nộp CV cho chính công ty đó → xét lại cho vị trí khác là hợp lý. Khớp tinh thần PDPD (dữ liệu ở lại công ty).
- Giới hạn (ghi thẳng): chỉ có giá trị khi kho CV đủ lớn; công ty mới / kho trống → gợi ý không ra gì.
- **Vì sao là hero với target công ty nhỏ:** công ty nhỏ tuyển lặp các vị trí giống nhau + tuyển qua quan hệ; kho CV cũ là tài sản họ đang bỏ phí. Câu kể: "CV cũ không chết — hệ thống tự sống lại chúng cho vị trí mới."

### SOFT IN-SCOPE (chờ thầy)
- Phỏng vấn nhiều vòng (2-3 vòng): xem 5.12. (Bằng chứng thực tế: VPBank — 10.)

### OUT-OF-SCOPE
**Toàn bộ module Quiz / bài test online (cả nhập tay lẫn AI gen) — ĐÃ CÂN NHẮC VÀ LOẠI.** Lý do nghiệp vụ: (1) desk research + feedback hội đồng cho thấy công ty ≤200 người hầu như KHÔNG tổ chức test — họ tin phỏng vấn trực tiếp, tham chiếu và thử việc; giữ quiz = ép công ty nhỏ dùng quy trình công ty lớn, mâu thuẫn đúng điểm hội đồng chê. Lý do chất lượng: (2) chất lượng đề AI gen không có người kiểm chứng chuyên môn trong target segment; (3) chống gian lận online không thể đảm bảo trọn vẹn trong scope đồ án. Công ty cần kiểm tra năng lực (kế toán, kỹ thuật viên...) → tự tổ chức offline, ghi kết quả vào Internal Notes.
Các mục OUT khác: CV Suggestion nâng cao · dynamic subdomain · Super Admin portal · đồng bộ 2 chiều Google/Outlook Calendar (đặt lịch nội bộ CÓ làm — Section 15; .ics vẫn in-scope) · tự dò lịch rảnh interviewer · coding challenge · Core Recruiter · chatbot real-time · chat tự do Recruiter↔Local AI (thay bằng nút hành động AI đơn stateless) · LDAP/SSO · mobile native · webcam proctoring / giám sát sinh trắc · OCR cho PDF scan · **AI tham gia/hoà giải quyết định tuyển (ĐÃ CÂN NHẮC VÀ LOẠI — không ai giao quyết định tuyển cho AI; AI = decision support, người quyết)**.

---

## 4. BỐI CẢNH, NGHIỆP VỤ AS-IS & KPI

### 4.1 Số liệu desk research CÓ NGUỒN (dùng cho báo cáo, trích nguồn khi viết)
- Việt Nam ~900.000 doanh nghiệp, trên 98% là DNNVV, đóng góp hơn 40% GDP, tạo hơn 50% việc làm (Bộ KH&ĐT, Q1/2025).
- DNNVV = lao động BHXH bình quân năm ≤200 người (Luật Hỗ trợ DNNVV 04/2017/QH14) — target SRIS khớp định nghĩa pháp lý.
- 55% doanh nghiệp nhỏ chưa từng áp dụng bất kỳ công nghệ số nào vào kinh doanh (khảo sát VCCI, đầu 2025); 60% nêu chi phí là lý do chính trì hoãn giải pháp số; đa số chưa có bộ phận CNTT chuyên trách, không biết bắt đầu từ đâu.
- Doanh nghiệp quy mô dưới 25 nhân viên gặp thiếu hụt nhân sự cao nhất, 40,6% (TopCV, Báo cáo Thị trường tuyển dụng).
- Doanh nghiệp mất trung bình 23 ngày để tìm ứng viên phù hợp, dành ~1/3 thời gian trong tháng cho phỏng vấn (Glassdoor); phỏng vấn vội/hỏi sai dẫn đến tuyển sai tốn hơn 15.000 USD/năm (CareerBuilder).
- 62% doanh nghiệp nhỏ từng tuyển sai (Monster) · chi phí tuyển sai ≈ 3-4 lần lương năm (SHRM) · ~78% nhà tuyển dụng mất ứng viên vì xếp lịch chậm (Calendly Blog) · 90% HR tại SME VN làm việc không theo quy trình nhất quán.

### 4.2 Quy trình As-Is của công ty ≤200 người (desk research — nền bối cảnh, ĐỐI CHIẾU với phỏng vấn sâu B2)

| Bước | Công ty nhỏ ĐANG làm | Vấn đề | SRIS cấu trúc hóa thành |
|---|---|---|---|
| 1. Phát sinh nhu cầu | Trưởng bộ phận/chủ "nói miệng" cần người; tiêu chí trong đầu | Người sàng lọc không biết chính xác cần gì | Yêu cầu tuyển dụng (5.17) |
| 2. Tìm nguồn | Người quen/nhân viên giới thiệu + đăng tin (Facebook/Zalo, trang tuyển dụng) | Ưu ái hồ sơ quen → loại nhầm hồ sơ giỏi | Career Site + Talent Pool |
| 3. Nhận CV | Rải email, Zalo/Messenger, bản in | Thất lạc, quên phản hồi | Pha Hồ sơ mới — kho tập trung |
| 4. Sàng lọc | Chủ/quản lý tự đọc, cảm tính, hay tuyển theo "hình mẫu bản thân" | Tuyển sai lặp lại (62% — Monster) | Pha Sàng lọc — chấm theo tiêu chí + bằng chứng (5.18) |
| 5. Kiểm tra năng lực | HẦU NHƯ KHÔNG tổ chức bài test — thử việc mới là vòng đánh giá thật | — | KHÔNG có bước test (căn cứ loại quiz) |
| 6. Phỏng vấn | Thường 1 vòng, chủ + trưởng bộ phận cùng ngồi, không phiếu chấm; bắt qua nhiều vòng → ứng viên tự bỏ | So sánh ứng viên bằng trí nhớ | Pha Phỏng vấn — phiếu chấm chung, mặc định 1 vòng (5.7, 5.12) |
| 7. Quyết + offer | Quyết nhanh nhưng hay im lặng kéo dài với UV; offer qua điện thoại/tin nhắn | Mất ứng viên vì im lặng/chậm lịch (78% — Calendly) | Pha Quyết định — DM chốt tại OFFER; UV tự xem trạng thái + phản hồi offer (5.15) |
| 8. Thử việc, tham chiếu | Vòng đánh giá thật; tham chiếu chỉ với vị trí quan trọng | — | Ngoài scope — ghi Internal Notes (Limitations) |

**Luận điểm vàng cho defense:** công ty nhỏ KHÔNG thiếu bước — họ làm gần đủ các bước như công ty lớn nhưng làm PHI CẤU TRÚC (miệng, Zalo, trí nhớ, cảm tính). SRIS không thêm quy trình — SRIS cấu trúc hóa đúng những gì họ đang làm sẵn. Trả lời trực diện feedback #1 của hội đồng.

**Trả lời nghi vấn "công ty nhỏ tuyển ít, cần gì hệ thống":** (1) số học — công ty 30-200 người với turnover ~15-25%/năm vẫn tuyển 8-60 lượt/năm, mỗi lượt hàng chục CV (số cụ thể chờ B2/trích nguồn); (2) người tuyển là chủ/trưởng bộ phận — giờ công đắt nhất công ty; (3) tuyển sai 1 người ở công ty 15 người = 7% nhân sự, rủi ro theo tỷ lệ NGHỊCH với quy mô; (4) "tuyển ít" chính là lý do họ không thể thuê HR chuyên trách hay mua ATS enterprise → khoảng trống cho SaaS thuê tháng giá rẻ.

### 4.3 KPI

| KPI | As-Is | To-Be |
|---|---|---|
| Time-to-Hire | **CHỜ SỐ KHẢO SÁT/PHỎNG VẤN SÂU (Việc B2)** — tham chiếu desk research: 23 ngày (Glassdoor) | Giảm ~30% so baseline khảo sát |
| Recruiter/chủ làm tác vụ admin | CHỜ SỐ B2 (tham khảo cũ: 3-4 h/ngày) | < 1 h/ngày |
| Báo cáo nguồn ứng viên | Không có | Dashboard 360° theo UTM |
| Kho hồ sơ tập trung, không thất lạc | CV rải email/Zalo/Excel (90% HR SME làm không theo quy trình) | 100% hồ sơ tập trung + truy vết |

QUY TẮC: mọi con số As-Is trong tài liệu chính thức phải có nguồn (phỏng vấn sâu/khảo sát của nhóm hoặc desk research trích dẫn được — 4.1). KHÔNG tự bịa số.

---

## 5. CÁC QUYẾT ĐỊNH THIẾT KẾ ĐÃ CHỐT

Ghi chú đánh số: giữ ổn định số mục để khớp tài liệu/chat cũ — **5.5 và 5.6 không tồn tại** (thuộc module Quiz đã loại khỏi scope, xem Section 3 OUT).

### 5.1 Authentication
- Internal user (Admin / Recruiter / Interviewer / Department Manager): JWT + Email/Password, đăng nhập Portal.
- Candidate: Magic Link (token 1 lần khi chốt, TTL cấu hình) — KHÔNG cần account. Là actor ẩn danh duy nhất.
- Vì sao người trong cuộc đều login: interviewer cần xem lịch sử buổi đã chấm và sửa điểm; department manager cần xem kết quả để quyết. Nhu cầu định danh lâu dài, magic link một-tác-vụ không kham được. Dùng lại JWT như các ATS thật (Greenhouse, Lever).

### 5.2 Database — SQL Server 2025 + cô lập tenant
- Engine: SQL Server 2025 (kiểu VECTOR). Dev: Developer Edition. Deploy: Azure SQL Free Tier (đã xác minh hỗ trợ VECTOR; 100k vCore-giây/tháng, 32GB).
- Multi-tenant: shared schema + cột company_id mọi bảng; routing path-based /t/{slug}.
- Cô lập tenant — giá trị thật KHÔNG ở cột company_id mà ở ĐẢM BẢO không rò dữ liệu xuyên tenant. 3 lớp phòng thủ:
  1. RLS (lõi, ép ở tầng DB): security predicate tự chèn điều kiện lọc tenant vào MỌI câu SELECT/UPDATE/DELETE/INSERT — dev quên company_id thì DB vẫn chặn. Cần FILTER + BLOCK predicate. Tenant set qua SESSION_CONTEXT đầu mỗi request. Bẫy: connection pooling → PHẢI set lại SESSION_CONTEXT mỗi request.
  2. EF Core Global Query Filter (tầng code): khai báo 1 lần, mọi LINQ tự kèm company_id.
  3. Test cô lập tenant: tạo dữ liệu công ty A+B, đăng nhập A khẳng định không thấy dòng của B; chạy trong CI. Khớp kế hoạch test (SWT, bảng 1.2).
- Unique scope tenant: mọi UNIQUE theo (company_id, ...). VD email ứng viên unique (company_id, email).
- Vector search: VECTOR_DISTANCE('cosine', ...) — exact (kNN), đủ cho < 50.000 vector. KHÔNG dùng vector index / VECTOR_SEARCH (experimental). EF Core: EF.Functions.VectorDistance("cosine", ...). Câu vector PHẢI kèm company_id.

### 5.3 AI Integration — Local AI + Vector
KHÔNG OpenAI/Gemini (thầy: gọi API là mức thấp nhất, tốn tiền/request, phụ thuộc bên thứ 3). Cộng thêm luận điểm PDPD (Section 1): dữ liệu CV không rời hệ thống.

| Tính năng | Cách làm |
|---|---|
| Bóc tiêu chí từ Yêu cầu tuyển dụng/JD | Local LLM (Ollama, qwen2.5) → danh sách tiêu chí DRAFT cho người duyệt (5.18) |
| Chấm điểm CV theo TỪNG tiêu chí | Embedding tiêu chí + embedding đoạn CV → cosine per-criterion → khớp/thiếu + bằng chứng (5.18) |
| Đề xuất CV / Talent Pool | Vector search trong SQL Server 2025 (đảo chiều — Section 3) |

- Embedding model (chốt): BAAI/bge-m3, 1024 chiều → vector(1024). Đa ngôn ngữ (hỗ trợ tiếng Việt), đọc tới 8192 token nên embed trọn CV dài. (Bản nhẹ dự phòng: paraphrase-multilingual-mpnet-base-v2, 768 chiều.)
- RE-EMBEDDING: vector 2 model khác nhau KHÔNG so sánh được. Đổi model → BẮT BUỘC sinh lại vector toàn bộ CV/JD/tiêu chí cũ. Áp cho CẢ HAI tầng vector (5.18).
- Hướng: Hybrid — Embedding/Vector (chấm điểm, đã PoC) + Local LLM (bóc tiêu chí — pattern JSON schema đã PoC ở Việc 4).

### 5.4 Python vs .NET
- Python (FastAPI): sinh embedding + bóc tiêu chí. Stateless, KHÔNG đụng DB, KHÔNG biết tenant.
- .NET + EF Core: orchestration, business logic, truy cập DB. Mọi request qua .NET; .NET gọi Python qua HTTP nội bộ.
- Embedding: Python trả float[] → .NET bọc SqlVector<float> → EF Core lưu vector(1024).
- Chỉ tách Python KHI bắt buộc (thư viện AI). Phần .NET tự làm được (vd extract PDF) thì để .NET.
- Hệ quả: mọi tác vụ AI giữ dạng gen đơn, stateless (1 request → 1 kết quả). KHÔNG chat tự do Recruiter↔AI.

### 5.7 Collaborative Scoring — Blind Review + tách "chấm" vs "quyết định"
**Mặc định tối giản:** job chỉ 1 người chấm (chủ/quản lý tự phỏng vấn tự chấm) → không có blind, không radar so sánh — chỉ là phiếu chấm theo tiêu chí có lưu vết. **Blind Review + std deviation + Radar tự BẬT khi job có >1 interviewer.** (Đúng nguyên tắc "đơn giản mặc định, phức tạp tùy chọn".)

- Bộ tiêu chí chấm phỏng vấn = DÙNG CHUNG bộ tiêu chí của job (5.18): nhóm tiêu chí INTERVIEW_ONLY + có thể chấm lại cả nhóm CV_MATCHABLE ở mức người thật. Recruiter/DM tùy biến per-job, không hard-code.
- Interviewer chấm trong Portal: Recruiter set up buổi PV + gán interviewer → interviewer login, thấy buổi được giao → trang chấm (tiêu chí + ô điểm + note từng tiêu chí) → submit. Sửa được điểm đến khi buổi/vòng khóa; xem lịch sử.
- Chấm LIVE trong buổi PV, KHÔNG dựa trí nhớ: trang mở từ đầu buổi, gõ điểm + note ngay; nháp TỰ LƯU ở server; cuối buổi Submit. Số hóa đúng thói quen as-is.
- Blind Review (khi bật): mỗi interviewer chấm độc lập, nháp riêng tư, hệ thống chỉ MỞ BLIND sau khi đã submit. Chống bias hùa theo.
- TÁCH BẠCH "chấm" vs "quyết định": chấm = INPUT (interviewer). Quyết = phán xét tuyển/loại (DM của job; không gán DM → Recruiter). Recruiter thao tác Kanban.
- "Check" là MÁY làm: sau khi panel submit, hệ thống tổng hợp Radar (hình dạng mạnh/yếu) + standard deviation (đo đồng thuận). Lệch cao ở 1 trục → flag "cần bàn". Khi nào bàn mồm: CHỈ ở tiêu chí bị flag. → Luận điểm: hệ thống không thay phán xét con người, nó làm cuộc nói chuyện gọn + đúng trọng tâm.
- Người quyết đọc bảng: cột đồng thuận trước → đào chỗ lệch (đọc note) → Radar tổng thể → quyết. Hệ thống KHÔNG auto-quyết (đã loại phương án AI hoà giải — Section 3 OUT).
- reject_reason — bắt buộc nhưng 1-CHẠM: chip preset (Chuyên môn chưa đạt · Thiếu kinh nghiệm · Không hợp văn hóa · Lương không khớp · Đã chọn người khác · Khác). Tách 2 thứ: reject_reason (NỘI BỘ, analytics, ghi thật) ≠ email báo rớt (lịch sự chung chung). Reject hàng loạt ở SCREENING → tự điền "Điểm CV dưới ngưỡng".

### 5.8 State Machine — 6 trạng thái NỘI BỘ, hiển thị 4 PHA
6 trạng thái: NEW → SCREENING → INTERVIEW → OFFER → HIRED / REJECTED. 8 transition, forward-only. **GIỮ NGUYÊN làm lõi kỹ thuật — KHÔNG phơi ra người dùng/hội đồng.** Người dùng thấy 4 PHA (5.16): Hồ sơ mới (NEW) · Sàng lọc (SCREENING) · Phỏng vấn (INTERVIEW) · Quyết định (OFFER→HIRED/REJECTED).

- Forward (4): NEW→SCREENING · SCREENING→INTERVIEW · INTERVIEW→OFFER (Guard G2: ≥1 phiếu chấm đã submit) · OFFER→HIRED. (Guard G1 không còn — thuộc nhánh quiz đã loại; giữ tên G2 để khớp tài liệu/chat cũ.)
- Reject (4): từ NEW/SCREENING/INTERVIEW/OFFER → một REJECTED duy nhất, bắt buộc reject_reason.
- Confirm marker trên transition tới hạn (vào OFFER, nhận việc, mọi reject). KHÔNG admin override.
- Ai chạm hồ sơ ở từng stage: NEW: hệ thống (chấm theo tiêu chí tự động) + Recruiter. SCREENING: Recruiter sàng lọc trực tiếp, KHÔNG cổng duyệt riêng. INTERVIEW→OFFER: điểm quyết duy nhất — DM của job xem điểm/Radar rồi chốt; không DM → Recruiter.
- forward-only ≠ cứng nhắc: reschedule + multi-round diễn ra BÊN TRONG stage INTERVIEW (5.12).
- Khi trình bày/viết tài liệu: nói "quy trình 4 pha, chỉ tiến không lùi, có chốt cửa" — thuật ngữ state machine/guard chỉ dùng trong Q&A kỹ thuật.

### 5.9 Interview Scheduling — tóm tắt
Hệ thống tự đặt lịch nội bộ, KHÔNG Google Calendar. MỘT tính năng đặt lịch duy nhất: Recruiter mở 1 POOL khung (gán interviewer từng khung) cho job + vòng → mời danh sách ứng viên → mỗi người 1 magic link (purpose=SCHEDULE) → ứng viên tự chọn khung → chốt khung đó (BOOKED), các khung khác GIỮ OPEN cho người sau, email xác nhận + .ics.
- Nhóm hay cá nhân = Recruiter quyết lúc đó, KHÔNG phải 2 mode kỹ thuật: pool slot dùng chung, first-come-first-served; PV nhóm/panel → cố ý mời nhiều ứng viên CÙNG pool.
- Link đặt lịch RIÊNG từng ứng viên nhưng trỏ về CÙNG pool, chỉ sinh sau khi card vào INTERVIEW + Recruiter mở pool + mời. Chi tiết: Section 15.

### 5.10 Cấu trúc Web — 2 site tách biệt
- Career Site (công khai) — ứng viên, vào bằng /t/{slug} + magic link, KHÔNG đăng nhập.
- Internal Portal (nội bộ) — nhân sự đăng nhập /t/{slug}/login (JWT). Khu theo role: /admin · /recruiter · /interviewer · /manager. Người giữ nhiều role thấy đủ các khu tương ứng.
- KHÔNG nút "Đăng nhập" nổi bật ở header Career Site (ứng viên tưởng phải tạo account). Link nhỏ ở footer nếu cần.
- DEMO: mở sẵn 2 tab (Career Site + Portal đã login).

### 5.11 Tầng truy cập DB — EF Core thay raw ADO.NET
- Lý do 1 — vector hỗ trợ chính thức: EF Core 10 hỗ trợ VECTOR của SQL Server 2025: SqlVector<float> + [Column(TypeName="vector(1024)")] + EF.Functions.VectorDistance. VECTOR_SEARCH/index vẫn experimental → KHÔNG dùng.
- Lý do 2 — hội đồng chú trọng NGHIỆP VỤ → ADO.NET không đổi điểm, EF Core cắt plumbing.
- Lý do 3 — Global Query Filter vá lỗi multi-tenant.
- Lý do 4 — an toàn vibe code: AI sinh LINQ khó tạo SQL injection + khó quên company_id.
- Cửa thoát: FromSqlRaw cho câu EF dịch không gọn.
- TRƯỚC KHI CHUYỂN: họp nhóm thống nhất; spike verify trên SQL Server 2025 thật; migrate data layer PoC.

### 5.12 Phỏng vấn nhiều vòng (2-3 vòng) — dữ liệu trong INTERVIEW
- Nhiều vòng = DỮ LIỆU bên trong stage INTERVIEW, KHÔNG thêm state. Card nằm yên ở INTERVIEW; mỗi vòng = 1 Interview Request + 1 phiếu chấm riêng. Xong vòng, Recruiter chọn: mở vòng kế / sang OFFER (G2) / REJECTED.
- Số vòng cấu hình theo job. Thêm round_number (hoặc InterviewRound) + badge "Vòng x/y". Guard G2 giữ mức "≥1 phiếu chấm" — KHÔNG siết "chấm hết mọi vòng".
- Vì sao KHÔNG INTERVIEW_1/_2/_3: phình state, hard-code số vòng, phá forward-only.
- Với target công ty nhỏ: mặc định 1 vòng là đủ (khớp As-Is 4.2); multi-round là năng lực sẵn khi cần. Bằng chứng thực tế: VPBank Young Talents 2026 (10).

### 5.13 Actionable Email + Magic Link — cùng MỘT cơ chế
- Magic link: URL chứa chuỗi ngẫu nhiên dài. Lưu DB kèm (purpose, hồ sơ, TTL, đã dùng chưa). Bảo mật: lưu HASH token, one-time, TTL cấu hình, rate limit, đếm truy cập, ràng buộc purpose.
- **3 purpose — đều của ứng viên: SCHEDULE · STATUS · OFFER_RESPONSE.**
- Actionable Email: email HTML có nút trỏ magic link. BẪY: nút email KHÔNG trực tiếp thực hiện hành động (trình quét email tự bấm thử) — nút chỉ MỞ trang nhỏ, người dùng bấm nút trên trang mới ghi kết quả.
- "one-time" = hành động CHỐT chỉ làm một lần, KHÔNG phải "mở một lần". Token đốt khi bấm chốt. Trong TTL mở lại được, nháp khôi phục; đã chốt → trang "Đã xử lý, chỉ xem".
- TTL theo purpose: SCHEDULE ~5 ngày · OFFER_RESPONSE ~5-7 ngày · STATUS dài.
- Chấm điểm & quyết tuyển KHÔNG dùng magic link — nằm trong Portal.

### 5.14 Người quyết tuyển — Department Manager
- Người quyết = DM sở hữu job (Job.department_manager_id → User, nullable). Có DM → DM quyết ở OFFER; trống → Recruiter quyết (đây cũng là đường mặc định của công ty nhỏ 1 người nhiều role).
- DM xuất hiện ở HAI đầu: tạo Yêu cầu tuyển dụng (5.17) và chốt ở OFFER. KHÔNG gác cổng CV, KHÔNG đụng vận hành.
- Một người vừa là DM vừa chấm phỏng vấn: gán họ làm interviewer của slot (InterviewSlot.interviewer_id). Không cần cơ chế riêng.
- KHÔNG cổng duyệt CV riêng, KHÔNG bảng cấu hình thẩm quyền.

### 5.15 Offer — OfferDetail + ứng viên tự phản hồi
- OfferDetail (tối giản): 1-1 (0..1) với Application. Field: salary_amount, currency, start_date, status (PENDING/ACCEPTED/DECLINED), sent_at, responded_at. Mở KPI offer acceptance rate.
- KHÔNG làm: lịch sử thương lượng, tạo offer letter, ký số (Core Recruiter — ngoài scope).
- Luồng: tại INTERVIEW→OFFER, DM quyết (không DM → Recruiter) → OfferDetail + gửi offer.
- Self-service: magic link OFFER_RESPONSE → trang hiện OfferDetail + Đồng ý/Từ chối → cập nhật status → OFFER→HIRED / →REJECTED.
- status OfferDetail vs current_state Application KHÔNG trùng: một theo artifact, một theo pipeline; đồng bộ (ACCEPTED ↔ HIRED).

### 5.16 TÁI ĐỊNH VỊ HẬU-HỘI-ĐỒNG — 4 pha hiển thị + tối giản mặc định (CHỐT)
**Nguyên tắc: đơn giản là mặc định, phức tạp là tùy chọn.** Hệ thống lớn lên cùng công ty — không bắt công ty 10 người xài bộ máy công ty 1000 người.

- **4 pha người dùng thấy:** Hồ sơ mới → Sàng lọc → Phỏng vấn → Quyết định. (Map nội bộ: NEW → SCREENING → INTERVIEW → OFFER→HIRED/REJECTED.) Kanban hiển thị 4 cột pha; 6 state là chuyện bên trong.
- **Bảng bật/tắt theo nhu cầu (per-company hoặc per-job):**

| Tính năng | Mặc định | Bật khi |
|---|---|---|
| Blind Review + std dev + Radar so sánh | TẮT (tự bật) | Job có >1 interviewer |
| Phiếu Yêu cầu tuyển dụng (5.17) | TẮT | Công ty có DM tách vai (chủ nhỏ tạo job + gõ tiêu chí trực tiếp) |
| Người quyết tách riêng (DM ở OFFER) | TẮT (Recruiter quyết) | Job gán department_manager_id |
| Phỏng vấn nhiều vòng | 1 vòng | Job cấu hình >1 vòng |

- **Cách nói khi bảo vệ:** "Mặc định chỉ 4 bước, MỘT người làm được hết. Các bước nâng cao là tùy chọn, bật khi công ty lớn lên. Quy trình này không phải nhóm bịa ra — nó cấu trúc hóa đúng các bước doanh nghiệp nhỏ ĐÃ làm (As-Is 4.2 + phỏng vấn sâu B2 + đối chiếu VPBank), chỉ tự động hóa khúc chậm."
- Trình bày demo: mở đầu bằng đường ĐƠN GIẢN NHẤT (đăng tin → CV vào, AI xếp hạng theo tiêu chí → phỏng vấn → tuyển), sau đó mới bật dần các tùy chọn.

### 5.17 YÊU CẦU TUYỂN DỤNG (Hiring Requisition) — DM ra đề, Recruiter triển khai (chi tiết ERD = Việc B3)
- **Luồng:** Department Manager tạo **Yêu cầu tuyển dụng** — KHÔNG phải JD chi tiết, chỉ cần: vị trí cần tuyển, số lượng, và **các tiêu chí cần thiết** (gõ tự nhiên). → Recruiter vào xem yêu cầu → tạo **Tin tuyển dụng** công khai (mô tả đầy đủ, phúc lợi, form nộp) từ yêu cầu đó.
- **Vì sao:** (1) đúng thực tế doanh nghiệp — trưởng bộ phận biết cần người thế nào, HR biết cách đăng tin (khớp As-Is 4.2 bước 1); (2) giải quyết gốc câu hội đồng "tiêu chí từ đâu ra" — tri thức chuyên môn đến từ DM, không phải HR bịa, không phải AI bịa; (3) cho DM vai trò đầu-cuối tròn trịa (ra đề → chốt).
- **Tùy chọn theo quy mô (5.16):** công ty nhỏ 1 người nhiều role → bỏ qua phiếu yêu cầu, tạo job + gõ tiêu chí trực tiếp (về bản chất là tự ra đề cho mình). Có DM tách vai → bật phiếu.
- **CHỜ CHỐT (Việc B3):** mô hình hóa — entity HiringRequisition riêng hay Job có giai đoạn requisition; quan hệ với Job/EvaluationCriteria; trạng thái phiếu (DRAFT/SENT/CONVERTED...).

### 5.18 TIÊU CHÍ LÀ TRỤC XUYÊN SUỐT + CHẤM CV THEO TỪNG TIÊU CHÍ (thay cách "ném cả JD↔CV")
**Đây là câu trả lời chính thức cho câu hội đồng "AI chấm CV dựa vào đâu?" — cách cũ (embed cả JD ↔ cả CV, ra 1 con số) YẾU: không giải thích được, JD lẫn đoạn nhiễu (giới thiệu công ty, phúc lợi) làm loãng điểm. ĐÃ BỎ.**

**Luồng tiêu chí (4 bước):**
1. Người có chuyên môn (DM / chủ) viết Yêu cầu tuyển dụng hoặc JD — tri thức nằm ở ĐÂY.
2. AI (Local LLM) bóc thành danh sách tiêu chí có cấu trúc — DRAFT, chỉ là gợi ý nháp (pattern DRAFT→duyệt→READY — Section 14, Việc 4).
3. Người tuyển DUYỆT: sửa / thêm-bớt / chỉnh trọng số → chốt bộ tiêu chí. **AI không quyết tiêu chí — AI đỡ việc gõ tay.**
4. Hệ thống chấm CV theo TỪNG tiêu chí đã chốt; cùng bộ tiêu chí dùng tiếp cho phiếu chấm phỏng vấn (5.7). MỘT bộ tiêu chí xuyên suốt từ lọc CV đến phỏng vấn — nhất quán, truy vết được.

**Thuộc tính mỗi tiêu chí (mở rộng EvaluationCriteria — chi tiết Việc B3):**
- Nguồn gốc: từ yêu cầu/JD nào, ai duyệt (audit).
- Cờ đánh giá: CV_MATCHABLE (thấy được trong CV — kỹ năng, kinh nghiệm) vs INTERVIEW_ONLY (chỉ đánh giá khi gặp người — giao tiếp, quản lý, văn hóa). Chấm CV CHỈ tính nhóm CV_MATCHABLE — tránh loại oan ứng viên vì thứ CV không thể hiện.
- Loại: HARD (yêu cầu cứng — chứng chỉ, địa điểm, số năm tối thiểu) vs SOFT (năng lực mềm dẻo). HARD → lọc bằng RULE/keyword (vector so ngữ nghĩa dễ sai với yêu cầu cứng); SOFT → vector. Nói thẳng thiết kế lai này khi bảo vệ — cho thấy nhóm hiểu giới hạn AI.
- Trọng số (weight).

**Cơ chế chấm (tầng vector):**
- CV bổ thành các ĐOẠN (chunk) → embed từng đoạn. Mỗi tiêu chí SOFT → embed.
- Mỗi tiêu chí đi tìm đoạn CV khớp nhất (cosine). ≥ ngưỡng → KHỚP, kèm CÂU BẰNG CHỨNG (đoạn CV đó); < ngưỡng → THIẾU.
- Điểm tổng = tổng CÓ TRỌNG SỐ các tiêu chí khớp (trên nhóm CV_MATCHABLE, sau khi qua lọc HARD).
- Hiển thị: "Khớp: React, Node (kèm trích đoạn) · Thiếu: kinh nghiệm quản lý" — KHÔNG chỉ một con số trần trụi. Người tuyển đọc bằng chứng và tự quyết — AI chỉ ra bằng chứng, con người phán.
- Ngưỡng khớp/thiếu + cách chunk: số hiện tại là ĐIỂM KHỞI ĐẦU — PoC Việc B4 đo rồi mới khóa.
- **2 TẦNG VECTOR song song:** tầng cả-CV (đang có, Talent Pool dùng — GIỮ NGUYÊN) + tầng từng-đoạn (mới, chấm theo tiêu chí). Không thay thế nhau. Về sau Talent Pool có thể nâng lên match theo tiêu chí, nhưng phase này giữ nguyên cách cả-CV đã code.

**TRẠNG THÁI CODE (07/2026): toàn bộ luồng trên ĐÃ CODE end-to-end, build sạch.**
- DB: migration `V013__criteria_scoring.sql` — EvaluationCriteria mở rộng (criteria_type HARD/SOFT · cv_matchable · source MANUAL/AI_EXTRACTED · status DRAFT/APPROVED + approved_by/at · keywords · embedding); bảng mới `CvChunk` (đoạn CV + VECTOR(1024)) + `ApplicationCriterionMatch` (matched/similarity/evidence, UNIQUE app+criteria); `Application.criteria_score` (TÁCH khỏi ai_match_score cả-CV); RLS đầy đủ cho bảng mới.
- Python: `POST /extract-criteria` (Ollama qwen2.5, JSON schema + validate + retry 3 — tái dùng nguyên pattern Việc 4; lỗi → 502 để .NET fallback nhập tay). `/embed` không cần Ollama.
- .NET: `EvaluationCriteriaService` (extract DRAFT → duyệt APPROVED, tạo tay = APPROVED luôn) · `CvChunker` (cắt 120-700 ký tự/đoạn) · `CriteriaScoringService` (HARD = dò keyword có bỏ dấu + evidence ±120 ký tự; SOFT = CROSS APPLY VECTOR_DISTANCE trong SQL lấy đoạn khớp nhất; điểm = Σweight khớp/Σweight×100 trên nhóm CV_MATCHABLE; rớt HARD = cờ HardPassed, KHÔNG auto-reject). Tự chạy trong worker chấm nền sau khi embed CV.
- API: `POST api/jobs/{id}/criteria/extract` · `POST .../criteria/approve` · `GET api/applications/{id}/criteria-matches` · `POST .../criteria-score` (chấm lại).
- Ngưỡng khớp: config `AiService:CriteriaMatchThreshold` (mặc định 0.6 — CHƯA calibrate, chờ phần đo B4). DRAFT không bao giờ lọt vào chấm/phiếu phỏng vấn (repo mặc định approvedOnly).

**Câu chốt bảo vệ:** "Tiêu chí không do AI nghĩ ra — nó nằm trong yêu cầu tuyển dụng do người có chuyên môn viết. AI chỉ bóc thành danh sách cho người duyệt. Hệ thống chấm CV theo từng tiêu chí đã duyệt và chỉ ra bằng chứng trong CV — khớp gì, thiếu gì. AI đỡ việc tay và chỉ bằng chứng; con người đặt chuẩn và ra quyết định."

---

## 6. QUY TRÌNH NGHIỆP VỤ

**MẢNG 1 — RECRUITMENT:** [Nếu bật phiếu] DM tạo Yêu cầu tuyển dụng (vị trí + tiêu chí — 5.17) → Recruiter tạo Tin tuyển dụng từ yêu cầu / [Mặc định công ty nhỏ] chủ tạo job + gõ tiêu chí trực tiếp → AI bóc tiêu chí DRAFT → người duyệt chốt bộ tiêu chí (5.18) → ứng viên nộp CV (Career Site) → parse + chấm theo TỪNG tiêu chí (khớp/thiếu + bằng chứng) → Recruiter sàng lọc trên Kanban 4 pha (không cổng duyệt riêng). Talent Pool: mở job mới → hệ thống gợi ý CV cũ phù hợp (hero).

**MẢNG 2 — INTERVIEW & OFFER:** Đặt lịch phỏng vấn qua magic link SCHEDULE (5.9, Section 15) → Phỏng vấn (mặc định 1 vòng; multi-round nếu cấu hình — 5.12; nhóm/cá nhân tùy Recruiter) + chấm theo CÙNG bộ tiêu chí (1 người chấm mặc định; Blind Review tự bật khi >1 — 5.7) → tại cửa Phỏng vấn→Quyết định: DM quyết (không DM → Recruiter — 5.14) → OfferDetail + ứng viên tự nhận/từ chối (5.15) → HIRED/REJECTED + Dashboard.

---

## 7. FEATURE TREE (9 MODULE)

| Module | Highlight |
|---|---|
| M1. Job Management | Career Site, Yêu cầu tuyển dụng (DM) → Job (Recruiter), Form nộp CV one-page |
| M2. Candidate Pipeline | Kanban 4 pha, State Machine nội bộ (6 state), Activity Log, Internal Notes |
| M3. AI Criteria + CV Scoring + Talent Pool | AI bóc tiêu chí (DRAFT→duyệt), chấm CV theo từng tiêu chí (khớp/thiếu + bằng chứng), **Talent Pool reverse matching (hero)** |
| M4. Email Automation | Email trigger theo state machine, template động |
| M5. Collaborative Scoring | Chấm theo bộ tiêu chí chung; multi-interviewer + radar + Blind Review tự bật khi >1 người chấm |
| M6. Dashboard & Analytics | Funnel chart, KPI card, reject_reason analytics |
| M7. Multi-tenant & Brand | Cô lập theo company_id (RLS + Global Query Filter), brand theming |
| M8. Auth & Authorization | JWT + RBAC 4 role GÁN CHỒNG; candidate magic link |
| M9. Interview Scheduling | Self-scheduling nội bộ + magic link SCHEDULE + .ics (chi tiết 15.4) |

---

## 8. KẾ HOẠCH & MỐC

| Giai đoạn | Mục tiêu |
|---|---|
| T1 (T4) — XONG | Auth + RBAC, CRUD Job & Application, Kanban tĩnh, Form nộp CV, ERD + Use Case |
| T2 (T5) — XONG | State machine + email, AI chấm điểm (bản cũ), Kanban động, Collaborative Scoring, Dashboard (module quiz từng build ở giai đoạn này — nay đã loại khỏi scope, code tắt/tách nhánh) |
| T3 (T6-7) — ĐANG | Bảo vệ 1 (XONG — nhận feedback) → **giai đoạn hậu-hội-đồng: phỏng vấn sâu + form (B2), ERD mới (B3), chấm theo tiêu chí (B4), tài liệu + trình bày lại (B5)** → Bảo vệ 2 (ăn điểm) |

---

## 9. PHÂN CÔNG TEAM

| Người | Phụ trách |
|---|---|
| FE 1 | Candidate Portal — landing, form CV, trang đặt lịch, trang status/offer response |
| FE 2 | Employer Dashboard — Kanban, chi tiết UV, báo cáo, brand |
| BE 1 | Core API, Auth/JWT, RBAC, Multi-tenant, State Machine, Collaborative Scoring |
| BE 2 | File upload, PDF extract, Email service, Interview Scheduling |
| BE 3 (tôi) | AI service (Python, Vector), Analytics, tài liệu |

---

## 10. PITCH POINTS / Q&A HỘI ĐỒNG

HỘI ĐỒNG CHÚ TRỌNG NGHIỆP VỤ — hỏi nhiều, soi kỹ nghiệp vụ, KHÔNG chấm code cao siêu. TÂM THẾ: BẢO VỆ chứ không phải thuyết trình — câu hỏi của hội đồng là để mình giải thích, KHÔNG phải lệnh bắt sửa; mỗi thiết kế thủ sẵn "vì sao chọn vậy + vì sao không cách khác".
Xưng hô: KHÔNG "web của chúng em". Nhóm là người thiết kế & phát triển/vận hành; mô hình = dịch vụ SaaS.

- **Vì sao đề tài (khung 4 lớp, business trước):** (1) Vấn đề thật & tốn kém — tuyển sai đắt (3-4 lần lương năm), 62% DN nhỏ từng tuyển sai, hồ sơ thất lạc, quy trình tùy tiện (As-Is 4.2); (2) Khoảng trống — tool ngoại đắt + phải ghép nhiều cái, tool nội chấm CV nông, chưa ai làm "vừa đủ cấu trúc" cho công ty chưa có phòng HR; (3) Tại sao BÂY GIỜ — SQL Server 2025 VECTOR native + Local AI mã nguồn mở + PDPD hiệu lực 2026; (4) (phụ) hợp đồ án 3 tháng. Lưu ý: chi phí tuyển sai nói ĐỊNH TÍNH hoặc kèm nguồn, không bịa số.
- **"Công ty nhỏ tuyển ít, cần gì hệ thống?"** → 4 vế (4.2): tuyển ít lần nhưng không ít việc (8-60 lượt/năm tùy quy mô, mỗi lượt hàng chục CV); người làm tuyển dụng là chủ/trưởng bộ phận — giờ công đắt nhất công ty; tuyển sai 1 người ở công ty 15 người = 7% nhân sự, rủi ro tỷ lệ nghịch quy mô; và chính vì tuyển ít nên họ KHÔNG THỂ nuôi HR chuyên trách hay mua ATS enterprise → cần dịch vụ thuê tháng "tối giản đúng chuẩn". "Tuyển ít" là lý do tồn tại của SRIS, không phải điểm yếu.
- **"Quy trình quá phức tạp?"** → "Mặc định chỉ 4 pha, MỘT người làm được hết. Bước nâng cao là tùy chọn, bật khi công ty lớn lên. Quy trình không phải nhóm bịa — công ty nhỏ vốn làm gần đủ các bước này rồi nhưng làm phi cấu trúc (miệng, Zalo, trí nhớ — As-Is 4.2 + phỏng vấn sâu B2); hệ thống chỉ cấu trúc hóa và tự động hóa khúc chậm. Hệ thống còn tự BỎ bước cho bạn (không DM thì khỏi tầng duyệt, không có bước test)." (5.16)
- **"Vì sao Bảo vệ 1 có quiz, giờ bỏ?"** → "Nhóm loại dựa trên bằng chứng: (1) hội đồng nhận xét tính năng chưa thực sự thông minh và quy trình quá cồng kềnh với công ty nhỏ; (2) nghiên cứu nghiệp vụ cho thấy công ty ≤200 người hầu như không tổ chức test — họ tin phỏng vấn trực tiếp và thử việc; (3) chất lượng đề AI và chống gian lận online không thể kiểm chứng trọn vẹn. Giữ quiz là ép công ty nhỏ dùng quy trình công ty lớn — mâu thuẫn đúng điểm hội đồng chỉ ra. Công ty cần kiểm tra năng lực thì tổ chức offline, kết quả ghi vào ghi chú nội bộ." (Loại tính năng theo bằng chứng = điểm cộng của tư duy BA, không phải điểm trừ.)
- **"Tính năng chưa thông minh, ai cũng nghĩ đến rồi?"** → chỉ vào 2 điểm: (1) Talent Pool reverse matching — "CV cũ không chết, hệ thống tự sống lại chúng cho job mới; đối thủ nhỏ không làm, ATS xịn bán như tính năng cao cấp"; (2) chấm CV theo tiêu chí có giải thích + bằng chứng — "đa số chỉ đưa một con số; SRIS nói khớp gì thiếu gì kèm trích đoạn". Kèm câu: "thông minh nghiệp vụ, không phải khoe model."
- **"AI chấm CV dựa vào đâu? Tiêu chí gì?"** → luồng 4 bước 5.18: tiêu chí từ Yêu cầu tuyển dụng do người có chuyên môn viết → AI bóc DRAFT → người duyệt chốt → chấm theo TỪNG tiêu chí, khớp/thiếu + bằng chứng. "AI đỡ việc tay và chỉ bằng chứng; con người đặt chuẩn và quyết."
- **"AI đề xuất tiêu chí thì có uy tín không, phải người có chuyên môn chứ?"** → "Đúng — nên người có chuyên môn LÀ người đặt tiêu chí: họ viết yêu cầu tuyển dụng, và họ duyệt danh sách AI bóc ra. AI không quyết tiêu chí."
- **"Có phương pháp đánh giá AI không?"** → khung Section 16: bộ test cố định, đổi 1 yếu tố/lần, đo 2 tầng (máy + rubric người); nhóm đã áp dụng khung này đo pipeline LLM (số máy đo cải thiện đều v1→v5: 11.7%→60.4%) và tái dùng cho chấm CV theo tiêu chí (Việc B4 — P/R/F1 hợp bài toán phân loại pass/loại theo ngưỡng).
- **"Giá trị cho người dùng là gì?"** → nối pain đo được → tính năng: mất X giờ đọc CV (số B2) → chấm theo tiêu chí còn Y phút; hồ sơ thất lạc → kho tập trung truy vết; sợ luật dữ liệu → Local AI + cô lập = tuân thủ PDPD; tuyển lặp vị trí → Talent Pool tận dụng kho CV cũ; mất ứng viên vì xếp lịch chậm/im lặng → self-scheduling + trang trạng thái.
- **Mô hình SaaS là gì, sao chọn:** phần mềm cung cấp như dịch vụ, thuê dùng trả phí kỳ, không mua đứt, không tự nuôi hạ tầng. Hợp target: công ty nhỏ cần dùng ngay, không nuôi đội IT; chi phí thêm 1 khách ≈ 0 (AI local) → giá thuê rẻ bền; dữ liệu cô lập từng công ty.
- **Vì sao dùng Ollama:** công cụ chạy LLM mã nguồn mở tại máy/máy chủ nội bộ → đúng Local AI: chi phí ≈ 0, dữ liệu không ra ngoài; đổi model nhẹ nhàng; Ollama chỉ là "người chạy model", kiến trúc tách service nên thay được.
- **Đối chiếu VPBank Young Talents 2026:** V1 lọc hồ sơ → Sàng lọc · V3 PV nhóm + V4 PV cá nhân → Phỏng vấn (multi-round 5.12) · V5 → Quyết định. (V2 test online của VPBank: SRIS cố ý KHÔNG làm — nghiệp vụ tập đoàn, không phải nghiệp vụ công ty ≤200 người; nếu khách cần thì tổ chức ngoài hệ thống.) Chứng minh pipeline sát thực tế; công ty nhỏ dùng bản rút gọn của cùng khung.
- **Vì sao interviewer & DM đăng nhập:** người trong cuộc, cần lịch sử + sửa điểm + xem kết quả; như Greenhouse/Lever. Chỉ ứng viên ẩn danh magic link.
- **Lỡ dev quên company_id:** "Hệ thống không tin trí nhớ lập trình viên. RLS tầng DB + Global Query Filter tầng code + test cô lập CI." (5.2)
- **CV có rò rỉ giữa công ty không:** Không — vector search luôn kèm company_id; cộng luận điểm PDPD.
- **Sao không tích hợp Google Calendar:** tự quản lịch nội bộ + .ics chuẩn mở → không khóa nhà cung cấp, không phát sinh chi phí (15.3).
- **LLM deploy ở đâu:** bóc tiêu chí chạy nền lúc cấu hình job (không real-time); embedding nhẹ host cloud; LLM chạy local/batch, không host 24/7 → Cost Analysis.
- **Mở rộng dữ liệu lớn:** exact VECTOR_DISTANCE (<50k vector); vượt → vector index (DiskANN) không đổi thiết kế.
- **PDF scan:** nhận diện → từ chối file; OCR là hướng mở rộng.
- **Existing solution:** không so hơn thua — mỗi đối thủ một mảnh (Teamtailor pipeline · Calendly đặt lịch), doanh nghiệp phải ghép nhiều tool nhiều khoản phí; SRIS gộp một dịch vụ + phần nghiệp vụ các đối thủ thiếu (tiêu chí xuyên suốt từ lọc CV đến phỏng vấn, blind review, talent pool) + rẻ (AI local) + PDPD. Với mảnh "bài test" (JobTest): SRIS cố ý đứng ngoài — target công ty nhỏ không test.

---

## 11. RỦI RO & GIẢM THIỂU

| Rủi ro | Impact | Mitigation |
|---|---|---|
| **Redesign hậu-hội-đồng sát deadline (requisition + chấm theo tiêu chí)** | CAO | Tái dùng tối đa cái có sẵn (EvaluationCriteria đã per-job, vector pipeline đã PoC, pattern DRAFT→duyệt đã có); chi tiết mới = Việc B3/B4 có PoC trước khi khóa; KHÔNG thêm tính năng ngoài danh sách chốt |
| Minh chứng khảo sát sơ cấp thiếu (form ít phản hồi) | Trung | **Chuyển trọng tâm sang phỏng vấn sâu 3-5 công ty** (mỗi thành viên tìm 1 công ty qua quan hệ); form Google chạy song song, được bao nhiêu tính bấy nhiêu; desk research có nguồn (4.1) làm lớp thứ 3 |
| **Thời gian còn lại quá ngắn cho B2-B5 (hạn Bảo vệ 2 — CẦN XÁC NHẬN ngày thật)** | CAO | B2 chạy NGAY song song; critical path = B3→B4; B4 thu về mức PoC demo được nếu thiếu giờ; B5 làm cuối; KHÔNG nhận thêm việc ngoài danh sách |
| Review tăng scope | Cao | Kiểm soát chặt, Limitations & Exclusions |
| Chuyển EF Core tốn công | Trung | Đổi giai đoạn đầu; spike verify (5.11) |
| Vector EF Core 10 còn mới | Trung | Spike verify; FromSqlRaw cửa thoát |
| Rò rỉ xuyên tenant | Cao | RLS + Global Query Filter + test CI (5.2) |
| User adoption (kháng Excel) | Cao | UI/UX mượt; magic link không cần login; mặc định 4 pha tối giản |
| PDF extract sai/rỗng | Trung | PdfPig; scan → từ chối |
| Đổi embedding model | Trung | Quy tắc re-embedding; chốt model sớm |
| Chunk CV + ngưỡng khớp/thiếu chưa chuẩn | Trung | PoC Việc B4 đo trước khi khóa; hiển thị bằng chứng để người kiểm tra |

---

## 12. FEEDBACK

### 12.1 Thầy hướng dẫn (20/05/2026)
- Kỹ thuật: Local AI (không OpenAI/Gemini) · Python tính AI, .NET quản trị · SQL Server 2025 Vector · cần Cost Analysis.
- Nghiệp vụ: gộp phase sàng lọc · khách tự chọn tiêu chí (CRUD) · 2 mảng Recruitment + Interview · đề xuất CV soft in-scope.
- Trình bày: KHÔNG "web của chúng em" · existing solution lấy khoảng trống.
- Tài liệu: fishbone · class diagram theo giáo trình · Limitations & Exclusions · Report 2 Resource + kế hoạch test · không khách thật → không Acceptance Test.

### 12.2 HỘI ĐỒNG (Bảo vệ, 07/2026) — 4 feedback → 3 vấn đề gốc → hướng giải ĐÃ CHỐT

| # | Feedback hội đồng | Vấn đề gốc | Hướng giải (đã chốt trong file này) |
|---|---|---|---|
| 1 | Bổ sung bối cảnh và khảo sát | A. Thiếu minh chứng | **Phỏng vấn sâu 3-5 công ty nhỏ + form song song (Việc B2)** + desk research có nguồn (4.1) + As-Is (4.2); mọi số As-Is phải có nguồn |
| 2 | Trình bày rõ vấn đề; quy trình quá phức tạp, tốn thời gian | B. Phức tạp | Target thu hẹp; 4 pha hiển thị; tối giản mặc định + tùy chọn bật (5.16); **loại hẳn module Quiz**; demo đường đơn giản trước; "hệ thống tự bỏ bước cho bạn" |
| 3 | Chứng minh quy trình đúng với doanh nghiệp, phải có minh chứng | A + B | As-Is desk research (4.2) + phỏng vấn sâu quy trình thật; map 4 pha vào quy trình họ ĐANG làm; đối chiếu VPBank |
| 4 | Tính năng chưa thông minh, ai cũng nghĩ đến rồi | C. Định vị "smart" | 2 điểm nhấn: Talent Pool reverse matching (hero, đã code) + chấm CV theo tiêu chí có giải thích (5.18); "thông minh nghiệp vụ, không khoe model"; quiz loại hẳn |
| 5 | Làm sao thuyết phục giá trị cho người dùng | A | Value = pain đo được (B2 + 4.1) → tính năng → kết quả; PDPD compliance angle |

---

## 13. CHO CHAT MỚI — CÁCH DÙNG FILE NÀY

- Đọc file này TRƯỚC TIÊN. Tham chiếu file khác khi cần (Charter, Business Goals, Personas, Feature Tree, 3 Report — LƯU Ý: các Report cũ CHƯA cập nhật tái định vị + chưa bỏ quiz, file này mới là chuẩn).
- Format: Markdown table (|---|), KHÔNG HTML table · tiếng Việt · vẽ flow → công cụ visualize (SVG) · tài liệu chính thức → file Word, không paste dài.
- Lưu ý cốt lõi:
  - **Định vị: quy trình tối giản đúng chuẩn cho công ty chưa có phòng HR (≤200 người + gia đình). Đơn giản mặc định, phức tạp tùy chọn. AI = trợ lý thầm lặng. Hệ thống KHÔNG thêm quy trình — nó cấu trúc hóa cái công ty nhỏ đang làm rời rạc (4.2).**
  - **HỘI ĐỒNG CHÚ TRỌNG NGHIỆP VỤ. TÂM THẾ BẢO VỆ, không thuyết trình. Kỹ thuật là đạn Q&A dự phòng, không chủ động khoe.**
  - **MODULE QUIZ ĐÃ LOẠI HOÀN TOÀN** (Section 3 OUT + đạn Q&A Section 10). Không thiết kế, không code, không tài liệu gì thêm cho quiz.
  - DB SQL Server 2025; AI Local AI + Vector (không OpenAI); embedding BAAI/bge-m3 (1024 chiều, 8192 token). EF Core (SqlVector + VectorDistance; FromSqlRaw cửa thoát). Cô lập tenant: RLS + Global Query Filter + test (5.2). PDPD 2026 = luận điểm tuân thủ. Object storage: Amazon S3.
  - Không "web của chúng em"; mô hình dịch vụ SaaS. Tuyển MỌI vị trí.
  - Role: 4 role GÁN CHỒNG (1 người giữ được nhiều/cả 4); chỉ Candidate ẩn danh magic link. Câu thần chú: Recruiter lái · Interviewer chấm · DM quyết (và RA ĐỀ) · Candidate ứng tuyển · Admin dựng sân.
  - **Luồng tiêu chí (5.17, 5.18): DM tạo Yêu cầu tuyển dụng (tùy chọn) → Recruiter tạo Job → AI bóc tiêu chí DRAFT → người duyệt chốt → chấm CV THEO TỪNG tiêu chí (CV_MATCHABLE, HARD lọc rule/SOFT vector, khớp/thiếu + bằng chứng) → cùng bộ tiêu chí chấm phỏng vấn. KHÔNG ném cả JD↔CV. Phần 5.18 ĐÃ CODE (xem TRẠNG THÁI CODE trong 5.18) — chat mới ĐỪNG thiết kế lại; 5.17 (requisition) còn chờ chốt B3.**
  - Pipeline: hiển thị 4 pha (Hồ sơ mới · Sàng lọc · Phỏng vấn · Quyết định); **6 state nội bộ, 8 transition**, forward-only, guard G2 (5.8, 5.16). Bảng bật/tắt 5.16.
  - Chấm vs quyết (5.7, 5.14): 1 người chấm mặc định; Blind + std dev + Radar tự bật khi >1. DM quyết chỉ ở OFFER; trống → Recruiter. reject_reason bắt buộc 1-chạm.
  - Token (5.13): one-time = đốt khi CHỐT; **3 purpose**: SCHEDULE · STATUS · OFFER_RESPONSE. Web 2 site (5.10). Đặt lịch nội bộ + .ics (5.9, 15). Multi-round = dữ liệu trong INTERVIEW (5.12). Offer self-service (5.15).
  - Talent Pool = HERO smart feature (đã code — Section 3).
  - Số liệu: KHÔNG bịa; mọi As-Is chờ B2 (phỏng vấn sâu + form) hoặc trích desk research có nguồn (4.1).

---

## CÁC VIỆC

### Ưu tiên HẬU-HỘI-ĐỒNG (mỗi việc 1 chat mới)
- [x] **Việc B1:** Chốt tái định vị + cập nhật file context (CHÍNH LÀ BẢN NÀY — đã gồm quyết định loại quiz + desk research As-Is).
- [ ] **Việc B2 — MINH CHỨNG SƠ CẤP (ĐANG CHẠY):** trọng tâm = **phỏng vấn sâu 3-5 công ty ≤200 người/gia đình** (mỗi thành viên nhóm tìm 1 công ty qua quan hệ; ~30 phút/công ty). **Kịch bản ĐÃ SOẠN XONG:** bộ 23 câu / 6 phần (`SRIS_B2_Bo_cau_hoi_phong_van.docx` — bản trần cho team; bản đầy đủ kèm phiếu ghi kết quả + khung trình bày: `SRIS_B2_Kich_ban_Phong_van_sau.docx`). LƯU Ý: kịch bản KHÔNG hỏi về bài test (đã chốt bỏ — quiz loại khỏi scope, luận cứ dùng desk research + feedback hội đồng là đủ; nếu đáp viên TỰ kể về test thì vẫn ghi nhận). Form Google 14 câu GIỮ chạy song song, được bao nhiêu tính bấy nhiêu. Deliverable: bảng "N công ty × quy trình thực tế × pain × con số" (gộp từ phiếu ghi) → điền KPI As-Is (4.3) + **3 slide trình bày**: (1) Phương pháp minh chứng 3 lớp + nêu hạn chế mẫu nhỏ, (2) Bảng kết quả + 1-2 quote nguyên văn ẩn danh, (3) KPI As-Is + câu chuyển "3 nỗi đau → 3 việc hệ thống giải quyết" (mock SVG đã có — thay số thật rồi dựng PowerPoint ở Việc B5).
- [ ] **Việc B3 — ERD + thiết kế chi tiết mới (PHẦN SCHEMA TRONG CODE ĐÃ XONG TRƯỚC):** trong DB/code đã có sẵn: EvaluationCriteria mở rộng + ApplicationCriterionMatch + CvChunk + 2 tầng vector (V013 — xem 5.18 TRẠNG THÁI CODE); bảng Quiz đã gỡ (V012). **Còn lại của B3:** (1) chốt HiringRequisition — entity riêng hay giai đoạn của Job (khuyến nghị đang nghiêng entity riêng — phiếu và tin là 2 vật thể 2 chủ, tính năng tắt/bật được); (2) cờ bật/tắt 5.16 nằm ở đâu (Company setting / Job setting); (3) VẼ LẠI ERD .puml/.drawio khớp schema thật + đếm lại số entity.
- [x] **Việc B4a — CODE chấm CV theo tiêu chí: XONG (07/2026).** Bóc tiêu chí (Ollama, JSON schema) → DRAFT → duyệt → chunk CV → HARD rule / SOFT vector + bằng chứng → điểm trọng số + API. Chi tiết: 5.18 mục TRẠNG THÁI CODE.
- [ ] **Việc B4b — ĐO (phần còn lại của B4):** bộ CV/JD test đa ngành → đo chọn ngưỡng khớp/thiếu (hiện 0.6 placeholder, chỉnh qua config không cần sửa code) + cỡ chunk; P/R/F1 theo khung Section 16; đo chất lượng bóc tiêu chí (% tiêu chí trùng JD gốc, tầng rubric người). Màn hình FE hiển thị khớp/thiếu + bằng chứng (BE đã có API).
- [ ] **Việc B5 — Tài liệu + trình bày lại:** cập nhật Business Overview/Report theo tái định vị + LOẠI QUIZ khỏi mọi tài liệu (SRS, Use Case, ERD, slide); slide bảo vệ 2: mở bằng bối cảnh + minh chứng B2 → 4 pha demo đơn giản trước → 2 điểm smart → Q&A dự phòng (gồm câu "vì sao bỏ quiz"). Cập nhật docs gửi nhóm.

### Backlog kỹ thuật (giữ từ trước, làm xen kẽ)
- [ ] Việc 0: spike verify EF Core + VectorDistance trên SQL Server 2025; họp nhóm chuyển EF Core; migrate PoC.
- [ ] Việc 6: Email State Machine (cập nhật theo 6 state). · Việc 7: Multi-tenant RLS + Global Query Filter + test cô lập (5.2).
- [ ] Việc 8: Cost Analysis (chi phí AI = 0đ; chi phí biên thêm 1 tenant ≈ 0; trade-off RAM local LLM). · Việc 9: cập nhật Business Overview Document (gộp vào B5).
- [x] Việc 10: Interview Scheduling (Section 15) + multi-round (5.12). **ĐÃ CODE 07/2026 — mô hình POOL khung dùng chung (mở pool → mời danh sách → first-come), thay luồng 1-1; cờ vàng/đỏ báo bận + chốt lịch tay.**
- [ ] Việc 12a: Thư viện tiêu chí mẫu theo nhóm vị trí — GIỮ, phục vụ 5.18 (template tiêu chí cho công ty nhỏ không biết bắt đầu từ đâu); gộp thiết kế schema vào Việc B3.
- [x] Việc 13: Talent Pool (đã code — hero, Section 3).
- [ ] Deploy Local AI: embedding lên VPS/cloud; LLM chạy nền/batch hoặc model nhỏ, KHÔNG host 24/7 → Cost Analysis.

---

## 14. TIẾN ĐỘ & BÀI HỌC KỸ THUẬT (PoC đã chạy thật)

Kiến trúc chung: React → .NET (orchestration) → Python AI Service (sinh vector / bóc tiêu chí) + SQL Server 2025 (lưu vector + chấm). .NET là "bộ não"; Python "máy tính toán" stateless không đụng DB/tenant.

- **Việc 2 — Local AI + Vector (23/05):** PoC end-to-end "text → embedding → vector → điểm 0–100"; ranking đúng (CV .NET > Java > designer). Bài học: chốt model multilingual (MiniLM 384 → nâng BAAI/bge-m3 1024/8192 token); quy tắc re-embedding; điểm = (1 - cosine_distance)*100; dùng 127.0.0.1 thay localhost trên Windows. LƯU Ý: pipeline này giờ là NỀN cho chấm theo tiêu chí (5.18) — đổi đơn vị so khớp từ "cả CV↔cả JD" sang "tiêu chí↔đoạn CV" (Việc B4), phần embedding + VectorDistance tái dùng nguyên.
- **Việc 3 — PDF extract (24/05):** PdfPig ở .NET (tránh iText7 AGPL); bóc text theo GetWords() (tránh dính chữ CV 2 cột); POST /applications/upload; ScoreCvAsync. File CV gốc lưu object storage (Amazon S3): CvDocument giữ metadata file_url + file_name/size/mime; DB chỉ lưu text + vector. 3 loại PDF: có-text → extract · 2-cột → được (thứ tự lộn xộn, embedding không nhạy) · scan → text quá ngắn → parse_status=FAILED, từ chối. Bài học chưa làm: calibrate "2 mốc neo"; duplicate detection (trùng email/SĐT); OCR out-scope.
- **Việc 4 — Pipeline Local LLM ra JSON có schema (25/05):** Ollama (11434), qwen2.5; Structured Output (JSON schema Pydantic, temperature=0); validate + retry 3; fallback nhập tay. Tính năng gốc (gen quiz) ĐÃ LOẠI khỏi scope — **giá trị còn lại của PoC: pattern "LLM ra JSON có schema + validate + retry + DRAFT→duyệt" TÁI DÙNG NGUYÊN cho bóc tiêu chí (5.18, Việc B4)**; demo bóc tiêu chí có thể dùng model nhẹ (gemma3:4b) nếu cần tốc độ.
- **Việc 5 — State Machine:** xem 5.8 (PoC xong; cập nhật còn 6 state sau khi loại quiz).
- **Việc B4a — Chấm CV theo tiêu chí (07/2026):** code end-to-end theo đúng 5.18 (chi tiết ở mục TRẠNG THÁI CODE của 5.18). Bài học: (1) tiêu chí HARD dò keyword phải so CẢ bản bỏ dấu (CV Việt hay gõ không dấu); (2) so khớp SOFT chạy ngay trong SQL Server (CROSS APPLY VECTOR_DISTANCE) — không kéo vector về .NET; (3) sửa nội dung tiêu chí → repo tự NULL embedding để lần chấm sau embed lại (quy tắc re-embedding); (4) tách criteria_score khỏi ai_match_score để so sánh được 2 cách chấm khi demo/đo; (5) LƯU CvChunk (không so xong vứt) → đổi tiêu chí chấm lại không tốn tiền embed lại cả kho CV. Còn thiếu: phần ĐO (Việc B4b) — ngưỡng 0.6 và cỡ chunk 120-700 là placeholder chưa calibrate.

---

## 15. ĐẶT LỊCH PHỎNG VẤN — CHI TIẾT KỸ THUẬT (ĐÃ CODE 07/2026 — pool dùng chung)

Bối cảnh: tự đặt lịch nội bộ, KHÔNG Google Calendar. Tách 2 bài toán: "chốt mốc thời gian" (nghiệp vụ lõi = IN) vs "đẩy lịch vào Google/Outlook" (OUT). MỘT tính năng đặt lịch duy nhất (Calendly thu nhỏ): xóa vòng email qua lại, tái dùng magic link, demo nổi bật.
Mô hình lõi = POOL KHUNG DÙNG CHUNG: Recruiter mở 1 pool (job + vòng) 1 lần, mời DANH SÁCH ứng viên, ai chốt trước lấy trước, các khung khác giữ OPEN cho người sau. Cá nhân = pool mời 1 người (là trường hợp con); PV nhóm = mời nhiều người cùng pool. KHÔNG có luồng 1-1 riêng.

### 15.1 Thứ tự thao tác: KÉO trước, MỞ POOL + MỜI sau (thủ công)
Card kéo sang Interview TRƯỚC ("cửa quyết định con người") → mở khóa "Mở pool khung" → Recruiter mở pool (nhiều khung, gán interviewer) rồi tick chọn ứng viên để MỜI (KHÔNG popup ép). Bản ghi per-ứng-viên (InterviewSchedule) tạo lúc MỜI: PENDING → CONFIRMED (chốt khung) / NO_SLOT_FITS (báo bận) / CANCELLED (hủy pool). Slot thuộc pool, KHÔNG thuộc từng ứng viên.

### 15.2 Token magic link
Cùng cơ chế token, purpose SCHEDULE, RIÊNG từng ứng viên nhưng trỏ về CÙNG pool. Token 32 byte; lưu HASH; one-time (đốt khi CHỐT / báo bận); TTL; ràng buộc purpose; đếm truy cập. (Pattern 5.1/5.13.) Đổi khung sau khi chốt = KHÔNG self-service — Recruiter xử lý tay (chốt tay / mở pool mới).

### 15.3 TTL + nhánh hết khung + so sánh Calendly
- TTL link đặt lịch ~5 ngày, cấu hình. Lọc slot = token còn hạn AND slot tương lai AND slot OPEN của pool.
- Pool slot DÙNG CHUNG, first-come-first-served. Mỗi giờ thật chỉ đặt 1 lần → chống trùng giờ interviewer (kiểm giờ + interviewer BOOKED ở pool khác lúc chốt). 3 ca: 1 ứng viên chọn trong vài khung · nhiều ứng viên chung pool · PV nhóm cố ý cùng pool.
- "Tranh slot" là hành vi đúng: khóa lạc quan — UPDATE InterviewSlot SET status='BOOKED', booked_application_id=@a WHERE slot_id=@s AND status='OPEN'; rowcount=0 → "khung vừa có người đặt, chọn khung khác". Chốt CHỈ khung đó, KHÔNG khóa khung anh em (đó là điểm khác luồng 1-1 cũ). Ẩn slot theo kiểu load lại trang; real-time là SHOULD.
- Nhánh báo bận: nút "Không khung nào phù hợp" → schedule của ỨNG VIÊN ĐÓ = NO_SLOT_FITS + đốt token (pool + người khác KHÔNG ảnh hưởng). Đếm số lần báo bận suy CỜ nhắc Recruiter: 1 lần = vàng, ≥2 = đỏ ("nên gọi điện chốt tay"). KHÔNG auto-reject — chỉ để Recruiter nhìn thấy rồi tự quyết (mở pool vòng mới / gọi điện / reject tay).
- Nhánh gọi điện: "chốt lịch tay" (manual-interview) tạo pool 1 khung (CLOSED, slot BOOKED) + schedule CONFIRMED cho ứng viên → có schedule để interviewer chấm điểm (không qua magic link).
- So Calendly (khoảng trống đối thủ): Calendly phụ thuộc Google/Outlook API — chính phần SRIS cố ý OUT. SRIS = self-scheduling KHÔNG sync, thay bằng .ics. Số liệu (Calendly Blog, dẫn nguồn): Muck Rack tốn 80% thời gian xếp lại lịch, giảm time-to-hire 8 ngày; ~78% recruiter mất ứng viên vì xếp lịch chậm.

### 15.4 Feature Tree — M9 (trạng thái CODE)
- ĐÃ CODE: mở pool (POST /api/jobs/{jobId}/interview-pools) · mời danh sách (POST /api/interview-pools/{poolId}/invitations, mỗi người 1 magic link SCHEDULE) · xem pool + cờ (GET .../interview-pools) · hủy pool (POST .../cancel) · chốt lịch tay (POST /api/applications/{id}/manual-interview) · trang ứng viên chọn/chốt/báo bận (/api/candidate/schedule) · chốt + booked_application_id + chống trùng giờ · cờ vàng/đỏ báo bận · trigger email (.ics khi CONFIRMED, best-effort) · guard KÉO-trước (chỉ mời khi ở INTERVIEW).
- SHOULD (chưa/ một phần): reschedule = mở pool vòng mới (chưa có nút gộp) · real-time ẩn slot · ô ghi chú gợi ý giờ.
- OUT: Calendar 2-way sync · dò lịch rảnh · auto-suggest · đổi khung self-service sau chốt.
- Bảng (kèm company_id): **InterviewSlotPool** (OPEN/CLOSED/CANCELLED — 1 pool = job+round, sở hữu slot) · InterviewSchedule (PENDING/CONFIRMED/NO_SLOT_FITS/CANCELLED — per-ứng-viên, thêm pool_id, dùng cho chấm điểm) · InterviewSlot (OPEN/BOOKED/LOCKED — thuộc pool_id, thêm booked_application_id). Multi-round = round_number trên pool/schedule (5.12), không thêm state.

---

## 16. PHƯƠNG PHÁP ĐÁNH GIÁ AI — KHUNG TÁI DÙNG CHO VIỆC B4

**TRẠNG THÁI:** khung phương pháp GIỮ; nguồn gốc là pipeline gen quiz (tính năng đã loại khỏi scope). Giá trị hiện tại: (1) đạn Q&A khi hội đồng hỏi "có phương pháp đánh giá AI không" — nhóm đã áp dụng và có số thật; (2) khung TÁI DÙNG cho đánh giá bóc tiêu chí + chấm CV theo tiêu chí ở Việc B4 (cùng triết lý: bộ test cố định, đổi 1 yếu tố/lần, đo 2 tầng).

Nguồn: slide môn học — khung Prompt → Test → Đánh giá → Báo cáo; "prompt tốt là prompt ĐO và SO SÁNH được".

### 16.1 Khung áp cho Việc B4
- Prompt versioning: versioning từng prompt trong pipeline (bóc tiêu chí).
- Dataset: bộ JD/CV test cố định đa ngành.
- Đo 2 tầng: tầng tự động (máy, khách quan — % JSON hợp lệ, % tiêu chí trùng JD gốc...) + tầng người (rubric 0-5) → pass-rate.
- Định lượng P/R/F1: HỢP với CV scoring (pass/loại theo ngưỡng = bài toán phân loại) — dùng làm chỉ số chính của B4.

### 16.2 Bằng chứng đã áp dụng khung (số máy đo, giữ làm đạn Q&A)
Pipeline LLM cải thiện đều qua versioning trên cùng bộ 12 JD test: v1_baseline 11.7% → v2_skill_extraction 27.9% → v3_fewshot 43.2% → v4_situational 50.4% → v5_self_critique 60.4% (tỷ lệ câu đạt tiêu chí máy đo). File: quiz_grading_ALL.xlsx (6 sheet). Nếu hội đồng hỏi sâu: nói thẳng "tính năng gốc đã loại khỏi scope theo tái định vị; nhóm giữ phương pháp và tái dùng cho chấm CV theo tiêu chí — số liệu chứng minh kỷ luật đo lường".

### 16.3 Các bước thực hiện (chạy → ghi số → mới viết) — KHUNG cho Việc B4
1. Chuẩn bị khung đo TRƯỚC khi chạy (bộ test + rubric + bảng versioning trống).
2. Baseline → chạy → chấm → ghi (mốc gốc).
3. Cải tiến từng version, mỗi lần 1 yếu tố, cùng bộ test cùng rubric.
4. Tổng hợp bảng số thật → chọn bản chốt.
5. Viết báo cáo sau cùng, khi bảng biểu nằm sẵn.
- Kỷ luật ghi: mỗi lần chạy lưu {version, input, output, điểm, ghi chú}.
