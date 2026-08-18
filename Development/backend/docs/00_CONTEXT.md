# 00 — CONTEXT.md

Kim chỉ nam (single source of truth) cho mọi chat trong Project SRIS. Chat mới PHẢI đọc file này đầu tiên.

> Số mục (5.x, Section 15…) GIỮ NGUYÊN vì code trích dẫn thẳng (`docs 5.15`, `docs 5.17`, `15.4`…).
> 5.5 và 5.6 bỏ trống — đừng dùng lại số đó.

---

## 0. TRẠNG THÁI DỰ ÁN

- Đã bảo vệ hội đồng lần 1 (07/2026), nhận 4 feedback → 3 vấn đề gốc (Section 12). Đang giai đoạn sửa theo feedback.
- **Định vị đã chốt:** "Quy trình tuyển dụng tối giản đúng chuẩn cho công ty chưa có phòng HR" — target công ty ≤200 nhân sự + công ty gia đình. Nguyên tắc: **đơn giản là mặc định, phức tạp là tùy chọn**.
- **AI làm HAI việc, cả hai đều chỉ ĐỀ XUẤT:** (1) bóc tiêu chí từ JD → người duyệt chốt → cả hội đồng phỏng vấn chấm trên cùng bộ tiêu chí đó; (2) **sàng lọc CV theo tin tuyển dụng** (V044, 16/08/2026) — tóm tắt CV, liệt kê yêu cầu đạt/thiếu kèm câu trích nguyên văn, mức phù hợp 0-100 và đề xuất `PROCEED`/`CONSIDER`/`REJECT`.
- **Mức phù hợp ĐƯỢC dùng xếp thứ tự đọc** trong một tin tuyển dụng (V046, 17/08/2026) — người tuyển dụng xem trước hồ sơ AI thấy khớp nhất. Nhưng **AI không quyết ai đi tiếp**: không đường code nào đọc điểm/đề xuất rồi tự đổi trạng thái hồ sơ, và điểm chỉ so được trong CÙNG một vị trí.
  > Đây là điểm ĐẢO so với bản 08/08/2026 ("hệ thống không chấm điểm, không xếp hạng"), theo yêu cầu hội đồng: *"điều chỉnh AI vẫn duy trì tính năng phân loại hồ sơ, chấm điểm hồ sơ tạo cơ sở cho người phỏng vấn"*. Cách làm cũng khác bản đã cắt: LLM đọc hiểu và phải trích được câu trong CV mới tính là đạt, chạy khi người dùng bấm — KHÔNG phải so vector tự động toàn bộ.
- AI chạy Local (Ollama), không OpenAI/Gemini.
- Đã code end-to-end: Auth/RBAC, multi-tenant RLS, Career Site, pipeline 4 pha, Yêu cầu tuyển dụng, bóc tiêu chí + duyệt, phiếu chấm phỏng vấn + verdict, đặt lịch phỏng vấn, đề xuất tuyển + duyệt của Giám đốc, thư mời nhận việc, email automation, dashboard.
- Việc còn lại: minh chứng sơ cấp (B2), vẽ lại ERD (B3), tài liệu + slide (B5).

---

## 1. TÓM TẮT DỰ ÁN

- Tên: **Smart Recruitment and Interview System (SRIS)** — Hệ thống Tuyển dụng và Phỏng vấn Thông minh.
- Mô hình: **SaaS multi-tenant ATS** — cho thuê dùng trả phí định kỳ, KHÔNG bán đứt. Nhiều công ty dùng chung hệ thống, cô lập theo `company_id`.
- **Đối tượng:** công ty nhỏ ≤200 nhân sự + công ty gia đình — nhóm chưa có phòng HR chuyên trách hoặc HR kiêm nhiệm. (Mốc ≤200 lao động khớp định nghĩa DNNVV theo Luật Hỗ trợ DNNVV 04/2017/QH14 — căn cứ pháp lý khi bảo vệ.)
- **Luận điểm PDPD:** Luật Bảo vệ dữ liệu cá nhân hiệu lực 01/01/2026 → doanh nghiệp tuyển dụng phải tuân thủ nghiêm về dữ liệu ứng viên. Local AI + cô lập dữ liệu = **lợi thế tuân thủ pháp luật**, không chỉ là điểm kỹ thuật.
- Team 5: 1 BA Lead/PM (kiêm Backend, là tôi) · 2 Backend (.NET) · 2 Frontend (React).
- Stack: **.NET 10 + EF Core** (orchestration & DB) · **Python FastAPI** (AI) · **React** · **SQL Server 2025** (không dùng kiểu VECTOR — hạ tầng vector đã xoá ở V036) · **MinIO** (lưu file CV) · **Redis** (cache) · **Ollama** (local LLM).
- 2 mảng chủ đạo: Recruitment (tuyển dụng) · Interview (phỏng vấn).
- Tuyển cho MỌI vị trí, không chỉ IT.

---

## 2. VAI TRÒ NGƯỜI DÙNG

Nguyên tắc cửa vào: người trong cuộc đều đăng nhập Portal. Chỉ Candidate là khách ẩn danh qua magic link, KHÔNG cần account.

| Role | Mô tả | Cách vào | Quyền chính |
|---|---|---|---|
| Admin (per tenant) | Quản trị viên công ty | Đăng nhập Portal | Quản lý user, phòng ban, brand, email; **superuser — bypass mọi cổng quyền** |
| Human Resource | Vận hành toàn bộ pipeline | Đăng nhập Portal | Tạo Tin tuyển dụng từ Yêu cầu **Giám đốc đã duyệt** (V047); duyệt bộ tiêu chí AI bóc; Kanban, sàng lọc, ĐẶT LỊCH phỏng vấn, soạn thư mời theo điều khoản Giám đốc chốt |
| Interviewer | Người chấm phỏng vấn | Đăng nhập Portal | Xem buổi được giao, chấm theo tiêu chí + nêu **đề xuất tuyển/không**, sửa tới khi hồ sơ khóa |
| Department Manager | Trưởng bộ phận — ra đề và ĐỀ XUẤT | Đăng nhập Portal | Tạo Yêu cầu tuyển dụng (5.17); duyệt ứng viên vào vòng phỏng vấn; đọc đề xuất của panel rồi **gửi Đề xuất tuyển** lên Giám đốc |
| **Giám đốc** (V043) | Người quyết tuyển | Đăng nhập Portal | Duyệt/không duyệt Đề xuất tuyển của DM + **chốt mức lương và ngày vào làm**; phạm vi toàn công ty |
| Candidate | Ứng viên ngoài hệ thống | Magic link | Nộp CV, xem trạng thái, xem thư mời |

- **Mỗi User giữ ĐÚNG 1 role** — code không gán chồng. Công ty gia đình dùng **1 tài khoản Admin** làm hết; tách vai = tạo thêm tài khoản khi công ty lớn lên.
- ⚠️ **Human Resource là TÊN GỌI mới; GIÁ TRỊ trong `User.role` và trong JWT vẫn là `'Recruiter'`** (`RoleConstants.HumanResource`) — đổi giá trị sẽ phải migrate dữ liệu + đá mọi phiên đăng nhập. Viết SRS/ERD phải nhớ chi tiết này.
- Câu thần chú: **Human Resource lái · Interviewer chấm · DM ra đề + chọn người gặp + đề xuất · Giám đốc quyết tuyển · Candidate ứng tuyển · Admin dựng sân.**
- Ba tầng tách bạch (chốt 15/08/2026 sau bảo vệ hội đồng): Interviewer đưa INPUT (điểm + đề xuất) → DM đưa **KIẾN NGHỊ chuyên môn** (ai đáng gặp, ai nên tuyển) → **Giám đốc RA QUYẾT ĐỊNH** tuyển và chốt điều khoản. Trưởng bộ phận không đủ thẩm quyền tuyển người, nên hệ thống không cho họ tự đẩy hồ sơ sang bước Quyết định.

---

## 3. SCOPE

### IN-SCOPE
- **Recruitment:** Career Site công khai · Yêu cầu tuyển dụng (DM) → Tin tuyển dụng (HR) — 5.17 · AI bóc tiêu chí từ JD → người duyệt chốt (5.18) · nhận + lưu CV (parse PDF, KHÔNG chấm) · Kanban 4 pha + state machine nội bộ · Email automation · Multi-tenant + brand theming.
- **Interview:** phiếu chấm theo bộ tiêu chí chung + đề xuất tuyển của từng interviewer (5.7) · thư viện tiêu chí mẫu cấp công ty · đặt lịch phỏng vấn nội bộ + .ics (Section 15) · đề xuất tuyển → Giám đốc duyệt (5.14) · thư mời nhận việc (5.15).
- **Chung:** Dashboard analytics · RBAC 5 role + candidate magic link · Activity Log & Internal Notes · danh mục phòng ban / loại hình làm việc.
- **Điểm "smart":** AI bóc tiêu chí từ JD cho người duyệt, rồi cả hội đồng phỏng vấn chấm trên **CÙNG một bộ tiêu chí** — nhất quán, truy vết được, AI không quyết thay người.
- **"Wow" phụ:** phiếu chấm ẩn cho tới khi nộp (chống hùa theo) · đặt lịch self-service kiểu Calendly thu nhỏ · trang trạng thái cho ứng viên.

### OUT-OF-SCOPE
- **Máy chấm điểm CV bằng VECTOR, chạy tự động cho mọi hồ sơ** — đã cắt 08/08/2026 và không dựng lại. (Đừng nhầm với sàng lọc CV bằng LLM ở V044: việc đó IN-SCOPE, chạy khi người dùng bấm, và bắt buộc trích dẫn được câu trong CV — xem 5.19.)
- **Chấm điểm CV theo từng tiêu chí** (`cv_matchable`, `keywords`) — cắt cùng đợt, cột đã xoá ở V038. Tiêu chí giờ chỉ phục vụ phiếu chấm phỏng vấn.
- **Xếp hạng ứng viên xuyên tin tuyển dụng** — mỗi lượt sàng lọc đối chiếu với đúng một JD nên điểm không so được giữa hai vị trí khác nhau.
- **Talent Pool / gợi ý CV cũ** — vẫn OUT (08/08/2026), không thiết kế lại.
- **Bài test online** — công ty ≤200 người hầu như không tổ chức test (4.2 bước 5); cần kiểm tra năng lực thì làm offline, ghi vào Internal Notes.
- Khác: dynamic subdomain · Super Admin portal · đồng bộ 2 chiều Google/Outlook Calendar (đặt lịch nội bộ CÓ làm; .ics in-scope) · tự dò lịch rảnh interviewer · coding challenge · Core HR · chatbot real-time · chat tự do HR↔AI · LDAP/SSO · mobile native · webcam proctoring · OCR cho PDF scan · **AI tham gia quyết định tuyển** (đã cân nhắc và loại — AI là decision support, người quyết).

> **Hạ tầng vector đã XOÁ HẲN (V036):** không còn bảng `CvChunk`, không còn cột `embedding` ở Job/CvDocument/EvaluationCriteria, không còn `IEmbeddingClient` / endpoint `/embed`. Giữ code chết chỉ đẻ ra câu hỏi "cái này dùng làm gì" mà không có câu trả lời (bài học V034).

---

## 4. BỐI CẢNH, NGHIỆP VỤ AS-IS & KPI

### 4.1 Số liệu desk research CÓ NGUỒN (trích nguồn khi viết report)
- Việt Nam ~900.000 doanh nghiệp, trên 98% là DNNVV, đóng góp hơn 40% GDP, tạo hơn 50% việc làm (Bộ KH&ĐT, Q1/2025).
- DNNVV = lao động BHXH bình quân năm ≤200 người (Luật Hỗ trợ DNNVV 04/2017/QH14).
- 55% doanh nghiệp nhỏ chưa từng áp dụng công nghệ số nào vào kinh doanh; 60% nêu chi phí là lý do trì hoãn (VCCI, đầu 2025).
- Doanh nghiệp dưới 25 nhân viên thiếu hụt nhân sự cao nhất: 40,6% (TopCV).
- Trung bình 23 ngày để tìm ứng viên phù hợp; ~1/3 thời gian trong tháng dành cho phỏng vấn (Glassdoor). Tuyển sai tốn hơn 15.000 USD/năm (CareerBuilder).
- 62% doanh nghiệp nhỏ từng tuyển sai (Monster) · chi phí tuyển sai ≈ 3-4 lần lương năm (SHRM) · ~78% nhà tuyển dụng mất ứng viên vì xếp lịch chậm (Calendly) · 90% HR tại SME VN làm việc không theo quy trình nhất quán.

### 4.2 Quy trình As-Is của công ty ≤200 người

| Bước | Công ty nhỏ ĐANG làm | Vấn đề | SRIS cấu trúc hóa thành |
|---|---|---|---|
| 1. Phát sinh nhu cầu | Trưởng bộ phận "nói miệng" cần người; tiêu chí trong đầu | Người sàng lọc không biết chính xác cần gì | Yêu cầu tuyển dụng (5.17) |
| 2. Tìm nguồn | Người quen giới thiệu + đăng Facebook/Zalo | Ưu ái hồ sơ quen → loại nhầm hồ sơ giỏi | Career Site |
| 3. Nhận CV | Rải email, Zalo/Messenger, bản in | Thất lạc, quên phản hồi | Pha Tiếp nhận & sàng lọc — kho tập trung |
| 4. Sàng lọc | Chủ/quản lý tự đọc, cảm tính | Tuyển sai lặp lại (62% — Monster) | Pha Sàng lọc + bộ tiêu chí đã chốt làm khung đọc CV |
| 5. Kiểm tra năng lực | Hầu như KHÔNG tổ chức test — thử việc mới là vòng đánh giá thật | — | Không có bước test |
| 6. Phỏng vấn | Thường 1 vòng, không phiếu chấm | So sánh ứng viên bằng trí nhớ | Pha Phỏng vấn — phiếu chấm chung (5.7) |
| 7. Quyết + offer | Quyết nhanh nhưng hay im lặng với UV; offer qua điện thoại | Mất ứng viên vì im lặng/chậm (78% — Calendly) | Pha Quyết định — DM đề xuất, Giám đốc chốt; thư mời + trang trạng thái (5.15) |
| 8. Thử việc, tham chiếu | Vòng đánh giá thật | — | Ngoài scope — ghi Internal Notes |

**Luận điểm vàng cho defense:** công ty nhỏ KHÔNG thiếu bước — họ làm gần đủ các bước như công ty lớn nhưng làm PHI CẤU TRÚC (miệng, Zalo, trí nhớ, cảm tính). SRIS không thêm quy trình — SRIS cấu trúc hóa đúng những gì họ đang làm sẵn.

**Trả lời "công ty nhỏ tuyển ít, cần gì hệ thống":** (1) công ty 30-200 người với turnover ~15-25%/năm vẫn tuyển 8-60 lượt/năm, mỗi lượt hàng chục CV; (2) người tuyển là chủ/trưởng bộ phận — giờ công đắt nhất công ty; (3) tuyển sai 1 người ở công ty 15 người = 7% nhân sự, rủi ro tỷ lệ NGHỊCH với quy mô; (4) chính vì tuyển ít nên họ không thể nuôi HR chuyên trách hay mua ATS enterprise.

### 4.3 KPI

| KPI | As-Is | To-Be |
|---|---|---|
| Time-to-Hire | **Chờ số phỏng vấn sâu (B2)** — desk research: 23 ngày (Glassdoor) | Giảm ~30% so baseline |
| HR/chủ làm tác vụ admin | Chờ số B2 | < 1 h/ngày |
| Báo cáo nguồn ứng viên | Không có | Dashboard 360° theo UTM |
| Kho hồ sơ tập trung | CV rải email/Zalo/Excel | 100% hồ sơ tập trung + truy vết |

> QUY TẮC: mọi con số As-Is trong tài liệu chính thức phải có nguồn (khảo sát của nhóm hoặc desk research trích dẫn được). KHÔNG tự bịa số.

---

## 5. CÁC QUYẾT ĐỊNH THIẾT KẾ ĐÃ CHỐT

### 5.1 Authentication
- Internal user (5 role): JWT + email/password, đăng nhập Portal.
- Candidate: magic link, TTL cấu hình, KHÔNG cần account — actor ẩn danh duy nhất.
- Vì sao người trong cuộc đều login: interviewer cần xem lịch sử + sửa điểm; DM cần xem kết quả để quyết. Nhu cầu định danh lâu dài, magic link một-tác-vụ không kham được. Giống ATS thật (Greenhouse, Lever).

### 5.2 Database — SQL Server 2025 + cô lập tenant
- Multi-tenant: shared schema + cột `company_id` ở MỌI bảng.
- Cô lập tenant có **3 lớp phòng thủ**:
  1. **RLS** (lõi, ép ở tầng DB): security predicate tự chèn điều kiện lọc tenant vào mọi SELECT/UPDATE/DELETE/INSERT — dev quên `company_id` thì DB vẫn chặn. Tenant set qua `SESSION_CONTEXT('CompanyId')` **đầu MỖI request** (bẫy connection pooling).
  2. **EF Core Global Query Filter** (tầng code): khai báo 1 lần, mọi LINQ tự kèm `company_id`.
  3. **Test cô lập tenant**: tạo dữ liệu công ty A+B, đăng nhập A khẳng định không thấy dòng của B (còn nợ — Việc 7).
- Mọi UNIQUE theo `(company_id, ...)`.

### 5.3 AI Integration — Local AI
KHÔNG OpenAI/Gemini (thầy: gọi API là mức thấp nhất, tốn tiền/request, phụ thuộc bên thứ 3). Cộng luận điểm PDPD: dữ liệu CV không rời hệ thống.

| Tính năng | Cách làm |
|---|---|
| Bóc tiêu chí từ Yêu cầu tuyển dụng/JD | Local LLM (Ollama, qwen2.5) → danh sách tiêu chí DRAFT cho người duyệt (5.18) |

- **Không còn embedding.** Hệ thống chỉ dùng LLM sinh văn bản có cấu trúc, không dùng vector (V036).
- Lượt bóc **chạy nền** (V037): API xếp hàng vào bảng `CriteriaExtraction` rồi trả `202`; `CriteriaExtractionWorker` gọi AI; FE hỏi `GET /api/jobs/{id}/criteria/extract-status` tới khi `running=false`. Local LLM trên CPU mất hàng chục giây — gọi đồng bộ là axios (30s) cắt ngang giữa chừng.

### 5.4 Python vs .NET
- **Python (FastAPI):** bóc tiêu chí từ JD — endpoint DUY NHẤT. Stateless, KHÔNG đụng DB, KHÔNG biết tenant.
- **.NET + EF Core:** orchestration, business logic, truy cập DB. Mọi request qua .NET; .NET gọi Python qua HTTP nội bộ.
- Chỉ tách Python KHI bắt buộc (thư viện AI). .NET tự làm được (vd extract PDF) thì để .NET.
- Hệ quả: mọi tác vụ AI là gen đơn, stateless (1 request → 1 kết quả). KHÔNG chat tự do HR↔AI.

### 5.7 Chấm phỏng vấn — phiếu chung + đề xuất tuyển
**Mặc định tối giản:** job 1 người chấm (chủ tự phỏng vấn tự chấm) → chỉ là phiếu chấm theo tiêu chí có lưu vết. Nhiều interviewer thì so sánh mới có ý nghĩa.

- Bộ tiêu chí chấm = bộ tiêu chí của job do AI bóc + người duyệt chốt (5.18). Interviewer chấm TOÀN BỘ tiêu chí. HR/DM tùy biến per-job, không hard-code.
- **Mỗi interviewer nộp 2 thứ:** điểm + note theo từng tiêu chí, và **đề xuất thẳng** `STRONG_HIRE / HIRE / CONSIDER / NO_HIRE` kèm nhận xét viết tay (`InterviewFeedback`, V031). Nộp phiếu bắt buộc phải chọn đề xuất.
- **Blind review:** phiếu của người khác chỉ lộ khi đã `SUBMITTED`. Nháp là riêng tư — chống bias hùa theo. Query lộ điểm trước submit = phá blind review.
- **Mốc khóa phiếu = trạng thái HỒ SƠ, không phải trạng thái phiếu:** submit chỉ MỞ BLIND; interviewer vẫn sửa được. Phiếu khóa cứng khi hồ sơ sang OFFER / HIRED / REJECTED (người quyết đã dùng nó để chốt). Ép ở service (`EnsureNotLockedAsync`), FE hiển thị theo cờ `isLocked`.
- Chấm LIVE trong buổi, không dựa trí nhớ: trang mở từ đầu buổi, nháp tự lưu ở server, cuối buổi Submit.
- **Màn quyết định của DM đọc ĐỀ XUẤT, không đọc điểm:** `GET /api/applications/{id}/decision-brief` trả về đề xuất của từng interviewer + note theo tiêu chí + internal notes, **không trả điểm số nào**; ý kiến trái chiều xếp lên đầu, danh sách hiển thị "2/3 nên tuyển". Lý do đổi: bày trung bình có trọng số + độ lệch chuẩn rồi bắt DM tự suy ra ý panel là bắt người đọc số thay vì đọc người.
- `reject_reason` **TÙY CHỌN** (ép nhập chỉ đẻ lý do rác). Gợi ý 1 chạm: chip preset (Chuyên môn chưa đạt · Thiếu kinh nghiệm · Không hợp văn hóa · Lương không khớp · Đã chọn người khác · Khác). Tách 2 thứ: `reject_reason` (nội bộ, analytics, ghi thật) ≠ email báo rớt (lịch sự chung chung).

### 5.8 State Machine — 6 trạng thái NỘI BỘ, hiển thị 4 PHA
`NEW → SCREENING → INTERVIEW → OFFER → HIRED / REJECTED`. 8 transition, forward-only. **Giữ làm lõi kỹ thuật — KHÔNG phơi ra người dùng/hội đồng.**

- Forward (4): NEW→SCREENING · SCREENING→INTERVIEW · INTERVIEW→OFFER (**Guard G2: ≥1 phiếu chấm đã nộp**) · OFFER→HIRED.
- Reject (4): từ NEW/SCREENING/INTERVIEW/OFFER → một REJECTED duy nhất.
- Confirm marker trên transition tới hạn (vào OFFER, nhận việc, mọi reject). KHÔNG admin override.
- **Ai chạm hồ sơ (sửa sau bảo vệ hội đồng 15/08/2026 — DM có HAI cửa):**
  - `NEW→SCREENING`: Human Resource tự sàng lọc hồ sơ, không cổng duyệt.
  - `SCREENING→INTERVIEW` — **cửa 1 của DM: CHỌN ai được vào vòng phỏng vấn.** Human Resource KHÔNG tự đưa ai vào phỏng vấn; nhân sự chỉ **lên lịch** cho người đã được duyệt (mời vào pool / chốt lịch tay đều đòi hồ sơ đã ở INTERVIEW). Lý do hội đồng nêu: ai đáng gặp là phán đoán chuyên môn của trưởng bộ phận, không phải việc vận hành của nhân sự. Job **bắt buộc** có `department_manager_id` khi đăng (Status=Open) — không có DM thì không ai duyệt được, BE chặn ngay lúc đăng tin.
  - `INTERVIEW→OFFER` — **cửa của GIÁM ĐỐC: quyết tuyển** (chốt 15/08/2026, V043). Trưởng bộ phận KHÔNG đủ thẩm quyền tuyển: họ đọc đề xuất panel rồi gửi **phiếu Đề xuất tuyển** (`HiringProposal`); Giám đốc duyệt — chính hành động duyệt đó đẩy hồ sơ sang OFFER kèm mức lương + ngày vào làm đã chốt. Giám đốc có phạm vi TOÀN CÔNG TY, không gán theo vị trí. Không duyệt ≠ loại: hồ sơ ở lại INTERVIEW, DM đề xuất lại được.
  - Loại hồ sơ (`→REJECTED`) không bị khoá theo vai: nhân sự loại ở bước sàng lọc, DM loại ở hai màn duyệt của mình.
  - Admin là superuser, đi qua cả hai cửa (công ty nhỏ 1 tài khoản chạy trọn luồng).
- forward-only ≠ cứng nhắc: reschedule + nhiều vòng diễn ra BÊN TRONG stage INTERVIEW (5.12).
- Khi trình bày: nói "quy trình 4 pha, chỉ tiến không lùi, có chốt cửa". Thuật ngữ state machine/guard chỉ dùng trong Q&A kỹ thuật.

### 5.9 Đặt lịch phỏng vấn — tóm tắt
Đặt lịch nội bộ, KHÔNG Google Calendar. **Viết lại 15/08/2026 — bỏ pool khung + magic link `SCHEDULE`:** HR gọi cho người phỏng vấn hỏi lịch rảnh, gọi ứng viên thống nhất giờ, rồi NHẬP buổi vào hệ thống (ứng viên + panel 1..5 người + giờ). Hệ thống chống trùng giờ, gửi email xác nhận + .ics, tạo bản ghi để interviewer chấm. Lý do bỏ: ngồi đợi ứng viên bấm link chậm hơn một cuộc gọi. **Cập nhật 16/08/2026 (V045):** panel không còn do HR tự chọn — DM chỉ định ai được gặp từng ứng viên, HR chọn trong danh sách đó. Chi tiết: Section 15.

### 5.10 Cấu trúc Web — 2 site tách biệt
- **Career Site (công khai):** `/{slug}/career` — ứng viên xem tin + nộp CV, không đăng nhập. API `/api/public/{slug}/...`, tenant giải từ slug bằng middleware riêng.
- **Internal Portal (nội bộ):** đăng nhập `/login` (JWT, tenant nằm trong token). Khu theo role: `/admin` · `/human-resource` · `/interviewer` · `/dept`. Admin (superuser) thấy đủ các khu — công ty nhỏ 1 tài khoản Admin chạy trọn luồng.
- Trang cho ứng viên qua magic link: `/schedule` · `/status` · `/offer`.
- KHÔNG để nút "Đăng nhập" nổi bật ở header Career Site (ứng viên tưởng phải tạo account).

### 5.11 Tầng truy cập DB — EF Core
- Không còn cột VECTOR nào trong schema (V036) — phần bàn về `SqlVector<float>` / `EF.Functions.VectorDistance` không còn áp dụng.
- Global Query Filter vá lỗi multi-tenant; LINQ khó tạo SQL injection và khó quên `company_id`.
- Cửa thoát: `FromSqlRaw` cho câu EF dịch không gọn.

### 5.12 Phỏng vấn nhiều vòng — dữ liệu trong INTERVIEW
- Nhiều vòng = DỮ LIỆU bên trong stage INTERVIEW, KHÔNG thêm state. Card nằm yên ở INTERVIEW; mỗi vòng = 1 buổi + 1 phiếu chấm riêng (`round_number` trên schedule). Xong vòng: HR đặt buổi vòng kế, hoặc DM đề xuất tuyển để Giám đốc quyết, hoặc loại.
- Guard G2 giữ mức "≥1 phiếu chấm" — KHÔNG siết "chấm hết mọi vòng".
- Vì sao KHÔNG INTERVIEW_1/_2/_3: phình state, hard-code số vòng, phá forward-only.
- Với công ty nhỏ: mặc định 1 vòng là đủ (khớp As-Is 4.2); multi-round là năng lực sẵn khi cần. Bằng chứng thực tế: VPBank Young Talents 2026 (Section 10).
- **Đánh số vòng (chốt 13/08/2026 — V041).** Theo mô hình "interview plan" của các ATS thật (Greenhouse, Lever, Ashby, Workable): mỗi vị trí có một DÃY vòng liên tục `1,2,3...`; **SỐ do hệ thống đánh, người dùng chỉ đặt TÊN** (`InterviewSlotPool.name` — "Sơ loại qua điện thoại", "Phỏng vấn chuyên môn"). Không nơi nào cho gõ số vòng: trước đó HR chọn tự do 1–5 nên mở được "Vòng 5" khi vị trí mới có vòng 1.
  - Mở pool = **vòng kế tiếp** (mặc định) hoặc **mở lại một vòng ĐÃ CÓ** — đường dành cho ứng viên nộp muộn: họ vẫn phải qua vòng 1 dù người khác đã sang vòng 3. Mở lại thì kế thừa tên cũ của vòng đó.
  - BE chặn nhảy cóc (`roundNumber > maxRound + 1` → 400). Vòng đã hủy không tính vào `maxRound`.
  - Chốt lịch tay đếm theo **chính ứng viên** (`max vòng của hồ sơ + 1`), vì người vào sau chốt tay buổi đầu tiên vẫn là vòng 1 của họ.
  - **Vòng sau phải diễn ra SAU vòng trước:** mọi khung của vòng N phải muộn hơn khung MUỘN NHẤT của vòng N−1 (mốc là khung muộn nhất vì ứng viên nào cũng có thể đã đặt đúng khung đó). Không có ràng buộc này thì mở được vòng 2 ngày 19 trong khi vòng 1 ngày 21. Chỉ áp khi mở vòng MỚI — mở lại vòng cũ cho ứng viên nộp muộn không bị chặn.
  - Lịch đã HỦY / pool đã HỦY không tính ở mọi phép đếm trên (buổi không diễn ra thì không chiếm số vòng). Pool CLOSED của chốt tay thì VẪN tính — đó là buổi có thật.
  - Tên vòng là TÙY CHỌN; bỏ trống thì mọi màn hình hiện "Vòng N" như cũ.

### 5.13 Actionable Email + Magic Link
- Magic link: URL chứa chuỗi ngẫu nhiên dài. DB lưu **hash** token (SHA-256) kèm purpose, hồ sơ, TTL, đã dùng chưa. Rate limit, đếm truy cập, ràng buộc purpose.
- **2 purpose — đều của ứng viên: `STATUS` · `OFFER_RESPONSE`.** (`SCHEDULE` bỏ 15/08/2026 cùng luồng ứng viên tự chọn khung.)
- Actionable Email: email HTML có nút trỏ magic link. **BẪY:** nút trong email KHÔNG trực tiếp thực hiện hành động (trình quét email tự bấm thử) — nút chỉ MỞ trang, người dùng bấm trên trang mới ghi kết quả.
- "one-time" = **đốt khi CHỐT**, không phải khi mở. Trong TTL mở lại được; đã chốt → trang "Đã xử lý, chỉ xem".
- TTL theo purpose: OFFER_RESPONSE ~5-7 ngày · STATUS dài.
- Chấm điểm & quyết tuyển KHÔNG dùng magic link — nằm trong Portal.

### 5.14 Người quyết — Department Manager (cập nhật 15/08/2026)
- Người quyết = DM sở hữu job (`Job.department_manager_id` → User). **Bắt buộc khi đăng tin** (Status=Open); bản nháp thì chưa cần.
- **Hai cửa, hai người:**
  1. `SCREENING→INTERVIEW` — chọn ai được vào vòng phỏng vấn **và ai sẽ phỏng vấn người đó** (màn *Duyệt Vào Phỏng Vấn*, `/dept/screening`).
  2. `INTERVIEW→OFFER` và rời OFFER — quyết tuyển: **CHỈ Giám đốc** (V043). DM gửi phiếu Đề xuất tuyển ở màn *Quyết Định Tuyển Dụng* (`/dept/hiring-decision`), Giám đốc duyệt — chính hành động duyệt đó đẩy hồ sơ sang OFFER.

- **Cửa LOẠI hồ sơ cũng có người gác (siết 17/08/2026 — feedback hội đồng lần 2).** Trước đó mọi đường sang `REJECTED` không kiểm ai bấm, nên bộ phận nhân sự loại được ứng viên một mình ở bất kỳ bước nào: cửa "đồng ý" khoá còn cửa "loại" mở toang, mà về nghiệp vụ **loại hồ sơ chính là phê duyệt hồ sơ** — đúng điểm hội đồng phê *"nhân sự không được quyền phê duyệt hồ sơ ứng tuyển"*.

  | Chặng | Cho đi tiếp | Loại hồ sơ |
  |---|---|---|
  | `NEW` | Human Resource | **Human Resource** |
  | `SCREENING` | DM của job | **DM của job** |
  | `INTERVIEW` | **Giám đốc** (qua đề xuất) | **DM của job** |
  | `OFFER` | Giám đốc | **Giám đốc** |

  Ranh giới là chữ **TUYỂN**: "đồng ý tuyển" là của Giám đốc, "đóng hồ sơ không tuyển" thuộc về người đã trực tiếp xét ứng viên. Giám đốc qua được mọi cửa (cấp trên); Admin bypass tất cả.
  Cố ý KHÔNG bắt Giám đốc gác `INTERVIEW→REJECTED`: tuyển 1 người trong 20 thì họ phải bấm đóng 19 hồ sơ, mà chẳng kiểm soát thêm gì — DM vốn đã phủ quyết được bằng cách không gửi đề xuất.
  Ứng viên từ chối thư mời (`OFFER→REJECTED`) đi bằng cờ `isCandidateAnswer`, KHÔNG qua guard — nếu chặn nhầm thì ứng viên bấm link trong email sẽ ăn 403.
- **Người phỏng vấn do DM chỉ định (V045 — 16/08/2026).** Duyệt vào vòng phỏng vấn và chỉ định người phỏng vấn là MỘT quyết định, gửi trong một lệnh (`POST .../transition` kèm `interviewerIds`) — tách ra màn riêng thì DM quên làm và nhân sự ngồi chờ. Sửa sau đó: `PUT /api/applications/{id}/interviewers` (màn *Lịch Phỏng Vấn* của DM), dùng khi vòng sau cần người khác hoặc người được chỉ định nghỉ việc. Bảng `ApplicationInterviewer` (không có `round_number`: đây là "ai ĐƯỢC PHÉP gặp người này", mỗi buổi nhân sự lấy một tập con).
- **Human Resource lái vận hành, không chọn người:** sàng lọc hồ sơ, ĐẶT LỊCH phỏng vấn cho người đã duyệt, soạn thư mời theo điều khoản Giám đốc chốt. Đặt lịch đòi hồ sơ đã ở INTERVIEW — trước 15/08/2026 thao tác mời TỰ đẩy state, tức mời ai là mặc nhiên chọn người đó. Từ V045, dropdown người phỏng vấn của nhân sự chỉ hiện nhóm DM đã chỉ định; id ngoài danh sách bị BE trả 409.
- Cộng với 5.17, DM đứng **ba chốt**: ra đề (Yêu cầu tuyển dụng) → chọn người gặp → **đề xuất tuyển**. Vẫn KHÔNG đụng vận hành (không đặt lịch, không gửi email) và KHÔNG quyết tuyển.
- Job cũ chưa gán DM: cửa vào phỏng vấn (và cửa loại ở SCREENING/INTERVIEW) bị BE chặn với thông báo "chưa gán Trưởng bộ phận phụ trách" — gán DM cho tin là xong. Cửa quyết tuyển KHÔNG rơi về Human Resource: từ V043 nó là của Giám đốc bất kể job có DM hay không.
- Một người vừa là DM vừa chấm phỏng vấn: gán họ làm interviewer của khung. Không cần cơ chế riêng.

### 5.15 Thư mời nhận việc (Offer Letter)
- **Không có nút "Đồng ý / Từ chối" cho ứng viên.** Công ty nhỏ gửi thư mời rồi ứng viên gọi/mail trả lời; bắt bấm nút trong hệ thống lạ chỉ thêm bước thừa mà không thay được cuộc trao đổi thật.
- `OfferDetail` = nội dung một lá thư: salary/currency/start_date, job_title, department, reporting_to, employment_type, work_location, salary_period, bonus, benefits, terms, hr_contact_*, signer_*, candidate_address, note. Các mục lấy từ Job được **chụp lại lúc soạn** — sửa Job về sau KHÔNG đổi nội dung thư đã phát đi. **0..1 offer per Application** (UNIQUE `application_id`).
- Liên hệ đầu thư (tên/địa chỉ/email/điện thoại công ty) lấy từ `Company`, nhập một lần ở hồ sơ công ty.
- **Nội dung thư là EMAIL TEMPLATE sửa được** (loại `OFFER_RESPONSE`): code dựng các khối dữ liệu (`{{positionBlock}}`, `{{compensationBlock}}`, `{{termsBlock}}`, `{{signature}}`, `{{letterhead}}`), template giữ phần lời văn + hình ảnh. Mỗi công ty đổi được câu chữ mà không sợ nhãn trống thò ra.
- **Mang brand của tenant:** logo + màu lấy từ cùng bộ brand với Career Site. Màu quá sáng tự làm tối cho đủ tương phản trên giấy trắng; chưa cấu hình brand → navy mặc định. Tải logo là best-effort (link hỏng → in thư không logo, không bao giờ lỗi 500).
- **Luồng:** DM gửi Đề xuất tuyển → **Giám đốc duyệt + chốt lương/ngày vào làm** (hồ sơ sang OFFER) → HR soạn thư (form điền sẵn ĐÚNG điều khoản Giám đốc chốt, phần còn lại lấy từ Job/Company, sửa được) → lưu `OfferDetail` (PENDING) + gửi email → ứng viên trả lời NGOÀI hệ thống → HR bấm "Đã nhận việc"/"Từ chối" trong Portal → ACCEPTED+HIRED (kèm email onboarding) / DECLINED+REJECTED.
- Trang ứng viên (magic link `OFFER_RESPONSE`) **CHỈ ĐỌC**: tóm tắt + PDF thư mời (QuestPDF, font Lato có dấu tiếng Việt) + nút tải. Token **không bị đốt khi mở** — không chốt gì ở đó thì đốt chỉ làm ứng viên mất bản thư.
- Ghi nhận kết quả **không** áp luật "chỉ DM của job quyết": ứng viên nhận hay từ chối là sự thật khách quan, không phải quyết định mới. Bắt đúng DM mới được gõ vào sẽ làm hồ sơ kẹt ở OFFER trong khi thư đã có câu trả lời.
- KHÔNG làm: lịch sử thương lượng, ký số.

### 5.16 4 pha hiển thị + tối giản mặc định
- **4 pha người trong công ty thấy** (đổi nhãn 17/08/2026): **Tiếp nhận & sàng lọc** → **Chờ Trưởng bộ phận duyệt** → **Phỏng vấn** → **Quyết định**. (Map nội bộ: NEW → SCREENING → INTERVIEW → OFFER→HIRED/REJECTED.) Kanban 4 cột; 6 state là chuyện bên trong.
- **Vì sao đổi tên:** bộ nhãn cũ ("Hồ sơ mới → Sàng lọc") đọc lên thì tưởng việc sàng lọc diễn ra ở pha 2, trong khi thực tế nhân sự đọc CV và loại hồ sơ ở pha 1; pha 2 là lúc hồ sơ ĐÃ qua tay họ và đang chờ Trưởng bộ phận chọn ai được gặp. Tên cũ khiến chính bảng phân quyền ở 5.14 đọc lên thấy vô lý. Tên mới nói thẳng hồ sơ đang chờ AI, nhìn Kanban là biết.
- **Ứng viên thấy bộ nhãn KHÁC, trung tính:** "Đã nhận hồ sơ → Đang xem xét → Phỏng vấn → Kết quả". Cơ cấu nội bộ của nhà tuyển dụng không phải thứ để phơi ra cho người ứng tuyển.
- **Bật/tắt theo nhu cầu:**

| Tính năng | Mặc định | Bật khi |
|---|---|---|
| So sánh nhiều phiếu chấm | 1 người chấm | Job gán >1 interviewer |
| Phiếu Yêu cầu tuyển dụng (5.17) | Không dùng | Công ty có DM tách vai (chủ nhỏ tạo job trực tiếp) |
| Người duyệt/quyết tách khỏi nhân sự | Admin 1 tài khoản làm hết | Job gán `department_manager_id` (bắt buộc khi đăng tin) |
| Phỏng vấn nhiều vòng | 1 vòng | HR đặt buổi cho vòng tiếp theo |

- **Cách nói khi bảo vệ:** "Mặc định chỉ 4 bước, MỘT người làm được hết. Bước nâng cao là tùy chọn, bật khi công ty lớn lên. Quy trình này không phải nhóm bịa ra — nó cấu trúc hóa đúng các bước doanh nghiệp nhỏ ĐÃ làm, chỉ tự động hóa khúc chậm."
- Trình bày demo: mở đầu bằng đường ĐƠN GIẢN NHẤT (đăng tin → AI bóc tiêu chí, người duyệt → CV vào → phỏng vấn chấm theo tiêu chí → tuyển), sau đó mới bật dần tùy chọn.

### 5.17 Yêu cầu tuyển dụng (Hiring Requisition) — ĐÃ CODE
- **Luồng:** DM tạo **Yêu cầu tuyển dụng** — không phải JD chi tiết, chỉ cần vị trí, số lượng, và **các tiêu chí cần thiết** (gõ tự nhiên) → **GIÁM ĐỐC duyệt** → HR tạo **Tin tuyển dụng** công khai từ yêu cầu đã duyệt.
- **Người duyệt đổi từ HR sang GIÁM ĐỐC (V047, 18/08/2026 — phản hồi hội đồng):** mở một vị trí là cam kết chi tiền, nên nó thuộc người chịu trách nhiệm — cùng lý do đã đưa quyết định tuyển về tay Giám đốc ở V043. Để nhân sự gác cửa này là tái lập đúng điều hội đồng phê ("nhân sự không được quyền phê duyệt"), chỉ khác là ở ĐẦU quy trình. Đường tắt cũ "tạo job từ yêu cầu PENDING = ngầm chấp thuận" nay chỉ còn cho Admin (công ty 1 tài khoản).
- **Mô hình hóa (đã chốt): entity RIÊNG `RecruitmentRequest`** (V019), không phải giai đoạn của Job — phiếu và tin là 2 vật thể của 2 chủ, và tính năng phải tắt được. Trạng thái: `PENDING → APPROVED → CONVERTED` / `REJECTED`; DM tự hủy khi còn PENDING → `CANCELLED`. Khi CONVERTED lưu `job_id` để truy vết "job này từ đề bài nào". Có `review_note` + `reviewed_by/at`.
- **Vì sao:** (1) đúng thực tế doanh nghiệp — trưởng bộ phận biết cần người thế nào, HR biết cách đăng tin (khớp As-Is 4.2 bước 1); (2) trả lời gốc câu hội đồng "tiêu chí từ đâu ra" — tri thức chuyên môn đến từ DM, không phải HR bịa, không phải AI bịa; (3) cho DM vai trò đầu-cuối tròn trịa (ra đề → chốt).
- **Tùy chọn theo quy mô:** công ty nhỏ dùng 1 tài khoản Admin → bỏ qua phiếu, tạo job + gõ tiêu chí trực tiếp.

### 5.18 Tiêu chí là trục xuyên suốt — AI bóc, người duyệt, interviewer chấm
**Đây là câu trả lời chính thức cho câu hội đồng "AI dựa vào đâu?".**

**Luồng 4 bước:**
1. Người có chuyên môn (DM / chủ) viết Yêu cầu tuyển dụng hoặc JD — **tri thức nằm ở ĐÂY**.
2. AI (Local LLM) bóc thành danh sách tiêu chí có cấu trúc — trạng thái `DRAFT`, chỉ là gợi ý nháp.
3. Người tuyển DUYỆT: sửa / thêm-bớt / chỉnh trọng số → chốt bộ tiêu chí (`APPROVED`). **AI không quyết tiêu chí — AI đỡ việc gõ tay.**
4. Bộ tiêu chí đã chốt là **phiếu chấm phỏng vấn** (5.7) — mọi interviewer chấm trên cùng một khung.

**Thuộc tính mỗi tiêu chí:** tên, mô tả, trọng số, nguồn gốc (`source` MANUAL / AI_EXTRACTED), trạng thái (`DRAFT` / `APPROVED` + `approved_by/at`).
> Các cột `criteria_type` (HARD/SOFT), `cv_matchable`, `keywords`, `embedding` đã bị xoá khỏi DB (`embedding` ở V036, ba cột còn lại ở V038) — chúng là mô hình dữ liệu của máy chấm CV, không còn tính năng nào đọc. Một tiêu chí giờ chỉ có `name` + `weight` + `max_score`: một dòng phiếu chấm, cho điểm 0..max_score.

**Trạng thái code:**
- Python: `POST /extract-criteria` (Ollama qwen2.5 — JSON schema + validate + retry 3; lỗi → 502 để .NET fallback nhập tay). Đầu vào gồm cả phần yêu cầu + kỹ năng của job, không chỉ mô tả.
- .NET: `EvaluationCriteriaService` — extract ra DRAFT → duyệt thành APPROVED; tạo tay = APPROVED luôn. DRAFT không bao giờ lọt vào phiếu chấm (repo mặc định `approvedOnly`).
- API: `POST /api/jobs/{id}/criteria/extract` · `POST .../criteria/approve` · CRUD tiêu chí per-job.
- **Thư viện tiêu chí mẫu cấp công ty:** `/api/criteria-templates` — HR dựng khuôn sẵn rồi clone vào job (giúp công ty nhỏ không biết bắt đầu từ đâu).

**Câu chốt bảo vệ:** "Tiêu chí không do AI nghĩ ra — nó nằm trong yêu cầu tuyển dụng do người có chuyên môn viết. AI chỉ bóc thành danh sách cho người duyệt, và cả hội đồng phỏng vấn chấm trên đúng bộ tiêu chí đó. AI đỡ việc tay; con người đặt chuẩn và ra quyết định."

### 5.19 Sàng lọc CV bằng AI + xếp thứ tự đọc (V044 16/08/2026, V046 17/08/2026) — ĐÃ CODE

Đáp thẳng feedback hội đồng lần 1: *"điều chỉnh AI vẫn duy trì tính năng phân loại hồ sơ, chấm điểm hồ sơ tạo cơ sở cho người phỏng vấn"*.

**Làm gì:** người dùng bấm → AI đọc CV, đối chiếu với tin tuyển dụng (JD + Yêu cầu ứng viên + Kỹ năng), trả về:
- `summary` — 3-5 câu chân dung nghề nghiệp
- `matched[]` — yêu cầu ĐẠT, **mỗi mục bắt buộc kèm `evidence` trích nguyên văn từ CV**
- `missing[]` — yêu cầu CV không nhắc tới
- `fitScore` 0-100 · `decision` `PROCEED`/`CONSIDER`/`REJECT` + lý do

**Chạy nền:** `POST /api/applications/{id}/cv-screening` (1 hồ sơ) hoặc `POST /api/jobs/{id}/cv-screening` (cả vị trí) → `202` → `CvScreeningWorker` → FE hỏi lại tới khi xong. Local LLM trên CPU mất hàng chục giây nên gọi đồng bộ là trình duyệt bỏ cuộc trước.

**Xếp thứ tự (V046):** `GET /api/jobs/{id}/applications?sort=fit` đưa hồ sơ khớp nhất lên đầu. **Hồ sơ chưa phân tích xếp CUỐI, không phải điểm 0** — "chưa ai đọc" khác hẳn "đọc rồi thấy không hợp".

**Ba lằn ranh phải giữ (câu trả lời cho "vậy máy tuyển người à?"):**
1. `CvScreeningService` KHÔNG gọi `IApplicationStateService`, không đụng `current_state`. Không có đường nào để `REJECT` của model thành `REJECTED` của hồ sơ.
2. Không trích được câu trong CV thì **không được tính là đạt** — mọi kết luận "có" đều kiểm chứng được ngay trên màn hình, đây là dây neo chống model bịa.
3. Điểm chỉ so trong CÙNG một vị trí; giao diện luôn hiện kèm chữ (`Nên mời`/`Cân nhắc`/`Ít phù hợp`) chứ không để con số đứng trần như điểm thi, và `REJECT` để màu xám — đỏ đọc như "đã loại", mà AI không loại được ai.

**Khác gì bản đã cắt 08/08/2026:** bản cũ so **vector**, chấm **tự động mọi hồ sơ**, và điểm là con số không giải thích được. Bản này là **LLM đọc hiểu**, **chạy khi người dùng bấm**, và **phải trích dẫn**. Hạ tầng vector vẫn xoá hẳn (V036) — không thêm lại.

> Chất lượng phụ thuộc `PdfTextExtractor` bóc text đúng THỨ TỰ ĐỌC (Docstrum + reading-order của PdfPig). Bản trước cố ý vứt thứ tự vì text chỉ dùng cho embedding — đó chính là lý do tính năng tóm tắt CV ở V033 chết ngay ở V034.

**Người phỏng vấn ĐỌC được bản phân tích này** (mở từ popup buổi phỏng vấn) nhưng không chạy được lượt mới — đúng chữ "tạo cơ sở cho người phỏng vấn". Phần đẩy lên trước là mục **thiếu**: đó là danh sách câu nên hỏi trong buổi, chứ không phải bản án đọc trước.

---

## 6. QUY TRÌNH NGHIỆP VỤ

**MẢNG 1 — RECRUITMENT:** [nếu bật phiếu] DM tạo Yêu cầu tuyển dụng → Giám đốc duyệt → HR tạo Tin tuyển dụng / [mặc định công ty nhỏ] chủ tạo job trực tiếp → AI bóc tiêu chí DRAFT → người duyệt chốt bộ tiêu chí (5.18) → ứng viên nộp CV qua Career Site hoặc HR nộp hộ → hệ thống parse PDF + lưu hồ sơ ở NEW → HR bấm **Phân tích CV toàn bộ** cho AI đối chiếu từng CV với tin tuyển dụng (V044) → Kanban 4 pha xếp hồ sơ phù hợp nhất lên đầu (V046) để HR đọc trước, rồi HR tự quyết.

**MẢNG 2 — INTERVIEW & OFFER:** DM duyệt ứng viên vào vòng phỏng vấn → HR gọi chốt giờ rồi đặt buổi, hệ thống gửi xác nhận + .ics (5.9, Section 15) → phỏng vấn + chấm theo CÙNG bộ tiêu chí, mỗi interviewer nêu đề xuất tuyển/không (5.7) → DM đọc bản tóm đề xuất rồi **gửi đề xuất tuyển**; **GIÁM ĐỐC duyệt** = hồ sơ sang Quyết định kèm lương + ngày vào làm đã chốt (5.14) → HR soạn thư mời theo đúng điều khoản đó (5.15) → ứng viên trả lời ngoài hệ thống → HR ghi nhận → HIRED/REJECTED + Dashboard.

---

## 7. FEATURE TREE (9 MODULE)

| Module | Highlight |
|---|---|
| M1. Job Management | Career Site, Yêu cầu tuyển dụng (DM) → Job (HR), danh mục phòng ban + loại hình làm việc, benefit mặc định của công ty, form nộp CV one-page |
| M2. Candidate Pipeline | Kanban 4 pha, state machine nội bộ (6 state), Activity Log, Internal Notes |
| M3. AI Criteria | AI bóc tiêu chí từ JD (DRAFT → người duyệt chốt) + thư viện tiêu chí mẫu → bộ tiêu chí dùng cho phiếu chấm phỏng vấn |
| M4. Email Automation | Email trigger theo state machine; **HR sửa nội dung template** (không phải sửa HTML), chèn ảnh từ file, SMTP + tên miền email riêng theo tenant |
| M5. Interview Scoring | Phiếu chấm theo bộ tiêu chí chung, blind cho tới khi nộp, đề xuất tuyển của từng interviewer, bản tóm cho người quyết |
| M6. Dashboard & Analytics | Funnel, time-to-hire, offer acceptance rate, reject-reason/source breakdown |
| M7. Multi-tenant & Brand | Cô lập theo `company_id` (RLS + Global Query Filter), brand theming dùng chung cho Career Site + thư mời |
| M8. Auth & Authorization | JWT + RBAC 5 role (mỗi user 1 role; Admin superuser); candidate magic link; hồ sơ + avatar user |
| M9. Interview Scheduling | Nhân sự đặt lịch trực tiếp (panel 1..5) + chống trùng + .ics (15.4) |

*(M10 Offer: thư mời nhận việc — 5.15; gộp vào M2 khi vẽ tài liệu hay tách riêng đều được, miễn nhất quán.)*

---

## 8. TIẾN ĐỘ

- **Xong:** Auth/RBAC, multi-tenant, CRUD Job & Application, Career Site, Kanban + state machine, email automation, dashboard, bóc tiêu chí + duyệt, phiếu chấm + đề xuất tuyển, đặt lịch phỏng vấn, phiếu Đề xuất tuyển + duyệt của Giám đốc, Yêu cầu tuyển dụng, thư mời nhận việc.
- **Đang/còn:** minh chứng sơ cấp (B2) · ERD mới (B3) · tài liệu + slide bảo vệ 2 (B5). Chi tiết ở **CÁC VIỆC**.

---

## 9. PHÂN CÔNG TEAM

| Người | Phụ trách |
|---|---|
| FE 1 | Candidate Portal — landing, form CV, trang đặt lịch, trang status/offer |
| FE 2 | Employer Dashboard — Kanban, chi tiết ứng viên, báo cáo, brand |
| BE 1 | Core API, Auth/JWT, RBAC, multi-tenant, state machine, chấm phỏng vấn |
| BE 2 | File upload, PDF extract, email service, đặt lịch phỏng vấn |
| BE 3 (tôi) | AI service (Python), analytics, tài liệu |

---

## 10. PITCH POINTS / Q&A HỘI ĐỒNG

**HỘI ĐỒNG CHÚ TRỌNG NGHIỆP VỤ** — hỏi kỹ nghiệp vụ, KHÔNG chấm code cao siêu. **TÂM THẾ: BẢO VỆ chứ không thuyết trình** — câu hỏi là để mình giải thích, KHÔNG phải lệnh bắt sửa; mỗi thiết kế thủ sẵn "vì sao chọn vậy + vì sao không cách khác".
Xưng hô: KHÔNG "web của chúng em". Nhóm là người thiết kế & phát triển; mô hình = dịch vụ SaaS.

- **Vì sao đề tài (business trước):** (1) vấn đề thật & tốn kém — tuyển sai đắt, 62% DN nhỏ từng tuyển sai, hồ sơ thất lạc, quy trình tùy tiện (4.2); (2) khoảng trống — tool ngoại đắt + phải ghép nhiều cái, tool nội chấm CV nông, chưa ai làm "vừa đủ cấu trúc" cho công ty chưa có phòng HR; (3) tại sao BÂY GIỜ — Local AI mã nguồn mở chạy được trên máy phổ thông + PDPD hiệu lực 2026.
- **"Công ty nhỏ tuyển ít, cần gì hệ thống?"** → 4 vế ở 4.2. "Tuyển ít" là lý do tồn tại của SRIS, không phải điểm yếu.
- **"Quy trình quá phức tạp?"** → "Mặc định chỉ 4 pha, MỘT người làm được hết. Công ty nhỏ vốn đã làm gần đủ các bước này rồi nhưng làm phi cấu trúc (miệng, Zalo, trí nhớ). Hệ thống còn tự BỎ bước cho bạn — không có DM thì khỏi tầng duyệt." (5.16)
- **"Tính năng chưa thông minh, ai cũng nghĩ đến rồi?"** → "thông minh nghiệp vụ, không khoe model": AI bóc tiêu chí từ JD để cả hội đồng chấm trên cùng một khung, thay vì mỗi người hỏi một kiểu rồi so bằng trí nhớ. Chất lượng bóc tiêu chí đã đo có số (§16).
- **"AI chấm CV dựa vào đâu?"** → "AI KHÔNG chấm CV. Nó bóc tiêu chí từ JD cho người duyệt; người đọc CV, và interviewer chấm theo bộ tiêu chí đó."
- **"AI đề xuất tiêu chí thì có uy tín không, phải người có chuyên môn chứ?"** → "Đúng — nên người có chuyên môn LÀ người đặt tiêu chí: họ viết yêu cầu tuyển dụng, và họ duyệt danh sách AI bóc ra. AI không quyết tiêu chí."
- **"Có phương pháp đánh giá AI không?"** → khung §16: bộ test cố định, đổi 1 yếu tố/lần, đo 2 tầng (máy + rubric người). Đã áp dụng thật lên tính năng bóc tiêu chí và có số: Precision 0.833 · Recall 0.938 · F1 0.882, không tiêu chí nào AI tự bịa.
- **"Giá trị cho người dùng là gì?"** → nối pain đo được → tính năng: hồ sơ thất lạc → kho tập trung truy vết; phỏng vấn không phiếu chấm, so bằng trí nhớ → cùng một bộ tiêu chí + đề xuất có lưu vết; mất ứng viên vì xếp lịch chậm/im lặng → self-scheduling + trang trạng thái; sợ luật dữ liệu → Local AI + cô lập = tuân thủ PDPD.
- **Mô hình SaaS là gì, sao chọn:** phần mềm cung cấp như dịch vụ, thuê dùng trả phí kỳ, không mua đứt, không tự nuôi hạ tầng. Hợp target: công ty nhỏ cần dùng ngay, không nuôi đội IT; chi phí thêm 1 khách ≈ 0 (AI local) → giá thuê rẻ bền; dữ liệu cô lập từng công ty.
- **Vì sao Ollama:** công cụ chạy LLM mã nguồn mở tại máy/máy chủ nội bộ → đúng Local AI: chi phí ≈ 0, dữ liệu không ra ngoài; kiến trúc tách service nên đổi model nhẹ nhàng.
- **Đối chiếu VPBank Young Talents 2026:** V1 lọc hồ sơ → Sàng lọc · V3 PV nhóm + V4 PV cá nhân → Phỏng vấn (5.12) · V5 → Quyết định. (V2 test online: SRIS cố ý KHÔNG làm — nghiệp vụ tập đoàn, không phải của công ty ≤200 người.) Chứng minh pipeline sát thực tế; công ty nhỏ dùng bản rút gọn của cùng khung.
- **Vì sao interviewer & DM đăng nhập:** người trong cuộc, cần lịch sử + sửa điểm + xem kết quả; như Greenhouse/Lever. Chỉ ứng viên ẩn danh magic link.
- **Lỡ dev quên `company_id`:** "Hệ thống không tin trí nhớ lập trình viên. RLS tầng DB + Global Query Filter tầng code + test cô lập." (5.2)
- **Sao không tích hợp Google Calendar:** tự quản lịch nội bộ + .ics chuẩn mở → không khóa nhà cung cấp, không phát sinh chi phí (15.3).
- **LLM deploy ở đâu:** bóc tiêu chí chạy lúc cấu hình job (không real-time) → LLM chạy local/batch, không host 24/7 → Cost Analysis.
- **PDF scan:** nhận diện → từ chối file; OCR là hướng mở rộng.
- **Existing solution:** không so hơn thua — mỗi đối thủ một mảnh (Teamtailor pipeline · Calendly đặt lịch), doanh nghiệp phải ghép nhiều tool nhiều khoản phí; SRIS gộp một dịch vụ + phần nghiệp vụ đối thủ thiếu (một bộ tiêu chí xuyên suốt từ ra đề tới phỏng vấn) + rẻ (AI local) + PDPD.

---

## 11. RỦI RO & GIẢM THIỂU

| Rủi ro | Impact | Mitigation |
|---|---|---|
| Minh chứng khảo sát sơ cấp thiếu (form ít phản hồi) | Cao | Trọng tâm là **phỏng vấn sâu 3-5 công ty** (mỗi thành viên 1 công ty qua quan hệ); form Google chạy song song; desk research có nguồn (4.1) làm lớp thứ 3 |
| Rò rỉ dữ liệu xuyên tenant | Cao | RLS + Global Query Filter + test cô lập (5.2) |
| Review tăng scope | Cao | Kiểm soát chặt, Limitations & Exclusions |
| User adoption (kháng Excel) | Cao | UI/UX mượt; magic link không cần login; mặc định 4 pha tối giản |
| Chất lượng bóc tiêu chí chưa được đo | Trung | **Đã xử lý** — thực nghiệm §16 trên bộ JD cố định 10 tin đa ngành: F1 0.882, 0 tiêu chí bịa |
| PDF extract sai/rỗng | Trung | PdfPig; file scan → từ chối, báo rõ |

---

## 12. FEEDBACK

### 12.1 Thầy hướng dẫn (20/05/2026)
- Kỹ thuật: Local AI (không OpenAI/Gemini) · Python tính AI, .NET quản trị · SQL Server 2025 (KHÔNG dùng kiểu VECTOR — xoá ở V036) · cần Cost Analysis.
- Nghiệp vụ: gộp phase sàng lọc · khách tự chọn tiêu chí (CRUD) · 2 mảng Recruitment + Interview.
- Trình bày: KHÔNG "web của chúng em" · existing solution lấy khoảng trống.
- Tài liệu: fishbone · class diagram theo giáo trình · Limitations & Exclusions · Report 2 Resource + kế hoạch test · không khách thật → không Acceptance Test.

### 12.2 Hội đồng (Bảo vệ 1, 07/2026) — 4 feedback → 3 vấn đề gốc → hướng giải đã chốt

| # | Feedback hội đồng | Vấn đề gốc | Hướng giải |
|---|---|---|---|
| 1 | Bổ sung bối cảnh và khảo sát | A. Thiếu minh chứng | Phỏng vấn sâu 3-5 công ty nhỏ + form song song (B2) + desk research có nguồn (4.1) + As-Is (4.2); mọi số As-Is phải có nguồn |
| 2 | Trình bày rõ vấn đề; quy trình quá phức tạp, tốn thời gian | B. Phức tạp | Target thu hẹp; 4 pha hiển thị; tối giản mặc định + tùy chọn bật (5.16); demo đường đơn giản trước; "hệ thống tự bỏ bước cho bạn" |
| 3 | Chứng minh quy trình đúng với doanh nghiệp | A + B | As-Is desk research (4.2) + phỏng vấn sâu quy trình thật; map 4 pha vào quy trình họ ĐANG làm; đối chiếu VPBank |
| 4 | Tính năng chưa thông minh, ai cũng nghĩ đến rồi | C. Định vị "smart" | AI bóc tiêu chí → người duyệt → cả hội đồng chấm cùng khung; chất lượng bóc tiêu chí đo có số (§16); "thông minh nghiệp vụ, không khoe model" |
| 5 | Làm sao thuyết phục giá trị cho người dùng | A | Value = pain đo được (B2 + 4.1) → tính năng → kết quả; PDPD compliance angle |

### 12.3 Hội đồng (Bảo vệ 1 — vòng góp ý nghiệp vụ) → trạng thái xử lý tính tới 17/08/2026

| # | Hội đồng nêu | Trạng thái | Ở đâu |
|---|---|---|---|
| 1 | Nhân sự không được quyền phê duyệt hồ sơ ứng tuyển | ✅ ĐÃ SỬA | Cửa duyệt: DM (V044, 15/08). Cửa **loại** siết 17/08 — trước đó vẫn hở, nhân sự loại được ở mọi bước. Bảng phân quyền ở 5.14 |
| 2 | Hệ thống thiếu Giám đốc quyết định hồ sơ ứng tuyển | ✅ ĐÃ SỬA | Actor `Director` + phiếu `HiringProposal` (V043, 15/08). Duyệt đề xuất là đường DUY NHẤT đẩy hồ sơ sang OFFER |
| 3 | Lọc hồ sơ ứng tuyển phải do Quản lý bộ phận | ✅ ĐÃ SỬA | `SCREENING→INTERVIEW` và `SCREENING→REJECTED` đều chỉ DM của job. Nhân sự giữ sàng lọc vòng đầu ở `NEW` — đó là công việc chuẩn ngành của recruiter, không phải phê duyệt |
| 4 | AI vẫn duy trì phân loại / chấm điểm hồ sơ, tạo cơ sở cho người phỏng vấn | ✅ ĐÃ SỬA | Sàng lọc CV bằng LLM (V044) + xếp thứ tự đọc theo mức phù hợp (V046) — mục 5.19. Người phỏng vấn đọc được CV lẫn bản phân tích (mở được từ 17/08; trước đó vai này không mở nổi CV) |
| 5 | Offer letter cần tạo form cho phép điều chỉnh | ⚠️ HIỂU NHẦM | Form đã sửa được **từ 07/08/2026**, 21 trường gồm lương/tiền tệ/kỳ lương/ngày vào làm (`MakeOfferDto`). Buổi bảo vệ nhóm trả lời nhầm là "lương lấy từ JD" nên hội đồng ghi nhận sai. Buổi 2: MỞ FORM, XOÁ SỐ, GÕ SỐ KHÁC, XUẤT PDF tại chỗ — đừng giải thích bằng lời |
| 6 | Không thể dựa trên JD để đưa ra mức lương | ✅ ĐÚNG VÀ ĐÃ ĐÚNG | Lương gợi ý lấy từ **quyết định của Giám đốc** khi duyệt đề xuất (`OfferLetterDefaultsDto.TermsFromDirector`), chỉ khi chưa có đề xuất mới rơi về khoảng lương của tin |
| 7 | Rà soát tài liệu cho khớp chương trình | 🔄 ĐANG LÀM | File này: 17/08 đã gỡ các câu "hệ thống KHÔNG chấm điểm / KHÔNG xếp hạng" (sai từ khi có V044/V046) và các chỗ còn ghi stack dùng kiểu VECTOR |
| 8 | Nhầm khái niệm IT và ST, điều chỉnh lại TC | ❓ CẦN HỎI LẠI | Suy đoán: Integration Test vs System Test, TC = Test Case. Nằm ở tài liệu báo cáo, KHÔNG có trong repo. **Hỏi GVHD xác nhận trước khi sửa** — đoán sai thì viết lại cả bộ TC vô ích |

---

## 13. CHO CHAT MỚI — CÁCH DÙNG FILE NÀY

- Đọc file này TRƯỚC TIÊN. Các Report/SRS cũ **chưa** cập nhật tái định vị — file này mới là chuẩn.
- Format: Markdown table (`|---|`), KHÔNG HTML table · tiếng Việt · flow → SVG · tài liệu chính thức → file Word, không paste dài.
- Lưu ý cốt lõi:
  - **Định vị: quy trình tối giản đúng chuẩn cho công ty chưa có phòng HR (≤200 người + gia đình). Đơn giản mặc định, phức tạp tùy chọn. AI = trợ lý thầm lặng. Hệ thống KHÔNG thêm quy trình — nó cấu trúc hóa cái công ty nhỏ đang làm rời rạc (4.2).**
  - **Hội đồng chú trọng NGHIỆP VỤ. Tâm thế BẢO VỆ. Kỹ thuật là đạn Q&A dự phòng, không chủ động khoe.**
  - **AI chấm mức phù hợp CV↔JD và xếp thứ tự đọc, nhưng KHÔNG quyết tuyển.** Hai việc của AI: bóc tiêu chí từ JD (5.18) và sàng lọc CV (5.19). Mọi quyết định pipeline vẫn do người bấm.
  - **Luồng tiêu chí:** DM tạo Yêu cầu tuyển dụng (tùy chọn) → HR tạo Job → AI bóc tiêu chí DRAFT → người duyệt chốt → bộ tiêu chí đó LÀ phiếu chấm phỏng vấn. **Đã code — đừng thiết kế lại.**
  - Pipeline: hiển thị **4 pha**; **6 state nội bộ, 8 transition**, forward-only, guard G2 (5.8, 5.16).
  - Chấm vs đề xuất vs quyết (5.7, 5.14): phiếu ẩn tới khi nộp; interviewer nêu đề xuất tuyển; DM đọc **đề xuất chứ không đọc điểm**, duyệt ai vào phỏng vấn (SCREENING→INTERVIEW) rồi **gửi Đề xuất tuyển**; **GIÁM ĐỐC quyết tuyển** (INTERVIEW→OFFER) và chốt lương/ngày vào làm; HR sàng lọc + đặt lịch + soạn thư. `reject_reason` tùy chọn.
  - Token (5.13): one-time = đốt khi CHỐT; **2 purpose**: STATUS · OFFER_RESPONSE.
  - Role: 5 role (thêm **Giám đốc** — V043), mỗi user 1 role, Admin superuser; **giá trị role của Human Resource trong DB/JWT là `'Recruiter'`**.
  - Stack: SQL Server 2025 · EF Core · MinIO · Redis · Local AI (Ollama + qwen2.5, chỉ bóc tiêu chí). PDPD 2026 = luận điểm tuân thủ.
  - Số liệu: KHÔNG bịa; mọi As-Is chờ B2 hoặc trích desk research có nguồn (4.1).

---

## CÁC VIỆC

- [ ] **B2 — MINH CHỨNG SƠ CẤP (đang chạy):** phỏng vấn sâu 3-5 công ty ≤200 người (mỗi thành viên 1 công ty, ~30 phút). Kịch bản đã soạn xong: `SRIS_B2_Bo_cau_hoi_phong_van.docx` (bản trần cho team) + `SRIS_B2_Kich_ban_Phong_van_sau.docx` (bản đầy đủ kèm phiếu ghi). Form Google 14 câu chạy song song. **Deliverable:** bảng "N công ty × quy trình thực tế × pain × con số" → điền KPI As-Is (4.3) + 3 slide: (1) phương pháp minh chứng 3 lớp + nêu hạn chế mẫu nhỏ, (2) bảng kết quả + 1-2 quote nguyên văn ẩn danh, (3) KPI As-Is + "3 nỗi đau → 3 việc hệ thống giải quyết".
- [ ] **B3 — ERD + thiết kế chi tiết:** schema trong code đã xong. Còn lại: (1) chốt cờ bật/tắt 5.16 nằm ở đâu (Company setting hay Job setting); (2) **vẽ lại ERD** khớp schema thật + đếm lại số entity.
  - Bảng phải có trong ERD mới: Company · User · Department · Job · RecruitmentRequest · Application · CvDocument · EvaluationCriteria · CriteriaTemplate · InterviewSlotPool · InterviewSlot · InterviewSchedule · InterviewScore · InterviewFeedback · OfferDetail · MagicLinkToken · EmailTemplate.
  - Quy ước vẽ: chỉ thuộc tính + quan hệ bằng đường nối, KHÔNG vẽ cột FK; KHÔNG vẽ ActivityLog + EmailLog; mọi bảng đều có `company_id`. Application → MagicLinkToken là 1-N (nhãn *generates*). Job có 2 FK tới User (`department_manager_id`, `created_by`) → 2 đường nối: *decides hiring for* + *creates*.
- [x] **B4 — THỰC NGHIỆM ĐÁNH GIÁ AI BÓC TIÊU CHÍ (xong 14/08/2026):** đã áp khung §16 lên tính năng đang chạy — bộ 10 JD đa ngành, **4 bậc prompt (ablation)**, đo 2 tầng (máy + rubric người, 299 nhãn tay). Kết quả: **F1 0.734 → 0.882 qua 4 bậc**, giữ prompt production. Số liệu ở `ai-experiments/exp_criteria_extract/out/KET_QUA.md` (bảng gộp: `out/KET_QUA_TONG_HOP.xlsx`), tóm tắt ở §16.2.
- [ ] **B5 — Tài liệu + trình bày lại:** cập nhật Business Overview / SRS / Use Case / ERD / slide theo tái định vị; slide bảo vệ 2: mở bằng bối cảnh + minh chứng B2 → 4 pha demo đơn giản trước → điểm smart → Q&A dự phòng.

### Backlog kỹ thuật
- [ ] Test cô lập tenant tự động (tạo dữ liệu A+B, khẳng định A không thấy B) — 5.2.
- [ ] Cost Analysis: chi phí AI ≈ 0đ; chi phí biên thêm 1 tenant ≈ 0; trade-off RAM local LLM.
- [ ] Deploy Local AI: LLM chạy nền/theo lượt, KHÔNG host 24/7; cân nhắc giữ model nóng quanh giờ demo.

---

## 14. BÀI HỌC KỸ THUẬT (PoC đã chạy thật)

Kiến trúc: React → .NET (orchestration) → Python AI Service (stateless) + SQL Server 2025. **.NET là "bộ não"; Python là "máy tính toán" không đụng DB, không biết tenant.**

- **Gọi service AI cục bộ:** dùng `127.0.0.1` thay `localhost` trên Windows (tránh chờ phân giải IPv6); AI service chạy tiến trình riêng để lỗi/nặng bên đó không kéo sập API.
- **PDF extract:** PdfPig ở .NET (tránh iText7 AGPL); bóc text theo `GetWords()` (tránh dính chữ ở CV 2 cột). File CV gốc lưu MinIO, DB chỉ giữ metadata + text. 3 loại PDF: có-text → extract · 2 cột → được (thứ tự lộn xộn) · scan → text quá ngắn → `parse_status=FAILED`, từ chối. Còn thiếu: duplicate detection (trùng email/SĐT).
- **Local LLM ra JSON có schema:** Ollama (11434) + qwen2.5, Structured Output (JSON schema Pydantic, `temperature=0`), validate + retry 3, fallback nhập tay. **Pattern "LLM ra JSON có schema + validate + retry + DRAFT→duyệt" là thứ đang chạy cho bóc tiêu chí (5.18).** Demo có thể dùng model nhẹ (gemma3:4b) nếu cần tốc độ.
- **Bóc tiêu chí:** đầu vào phải gồm cả phần yêu cầu + kỹ năng của job, không chỉ mô tả — nếu không LLM biến "mô tả công việc" thành tiêu chí đánh giá. Đo thật cho thấy lỗi này chỉ còn xuất hiện ở tin có phần yêu cầu quá mỏng (§16.2).

---

## 15. ĐẶT LỊCH PHỎNG VẤN — CHI TIẾT (ĐÃ CODE)

Tách 2 bài toán: "chốt mốc thời gian" (nghiệp vụ lõi = IN) vs "đẩy lịch vào Google/Outlook" (OUT).

**VIẾT LẠI 15/08/2026 — mô hình lõi = NHÂN SỰ CHỦ ĐỘNG CHỐT.** Bộ phận nhân sự gọi cho người phỏng vấn hỏi lịch rảnh, gọi cho ứng viên thống nhất giờ, rồi NHẬP buổi vào hệ thống. Mô hình cũ (pool khung dùng chung + magic link `SCHEDULE` cho ứng viên tự chọn) **đã bỏ hẳn**: nó bắt nhân sự ngồi đợi ứng viên bấm link, trong khi một cuộc gọi là chốt xong — và khi ứng viên không bấm thì vẫn phải gọi, tức mọi trường hợp đều tốn thêm một vòng chờ.

### 15.1 Thứ tự thao tác: DM DUYỆT + CHỈ ĐỊNH NGƯỜI trước, NHÂN SỰ CHỐT GIỜ sau
DM duyệt hồ sơ vào vòng Phỏng vấn TRƯỚC (cửa quyết định con người — 5.8/5.14) **và chỉ định luôn ai được phỏng vấn ứng viên đó** → hồ sơ hiện ở màn Lịch Phỏng Vấn của nhân sự → nhân sự bấm "Đặt lịch phỏng vấn": chọn ứng viên + giờ đã hẹn, người phỏng vấn đã điền sẵn theo chỉ định của DM (bỏ bớt ai bận thì bấm x, KHÔNG thêm được người ngoài danh sách).

Hai lời từ chối của BE ở bước này nói hai chuyện khác nhau:
- hồ sơ chưa duyệt → "chưa được Trưởng bộ phận duyệt vào vòng phỏng vấn";
- duyệt rồi nhưng chưa ai được chỉ định → "Trưởng bộ phận chưa chỉ định người phỏng vấn cho ứng viên này".

**Vì sao chia đôi như vậy (V045 — 16/08/2026):** chọn ai gặp ứng viên là phán đoán chuyên môn (ai đủ sức hỏi mảng này, ai đang rảnh tay trong bộ phận), còn chốt giờ là việc vận hành. Trước V045 nhân sự truyền id tùy ý khi đặt buổi, tức là họ đang quyết cả hai. Danh sách chỉ chặn được khi nó là ràng buộc — đừng nới thành "gợi ý".

### 15.2 Hệ thống lo gì sau khi nhân sự bấm lưu
- **Chống trùng giờ (giữ nguyên):** chặn nếu chính ứng viên, hoặc bất kỳ ai trong panel, đã có buổi cách dưới `MinGap` (1 tiếng). Nhân sự đã gọi điện nhưng không nhớ hết lịch của 5 người — đây là lưới an toàn, và lỗi báo TÊN người bận kèm giờ buổi kia.
- **Chặn giờ quá khứ** và **chặn nhảy cóc vòng** (buổi đầu tiên của một ứng viên luôn là vòng 1).
- **Email xác nhận + tệp .ics** gửi ứng viên (best-effort — email hỏng không làm rớt buổi đã lưu).
- **Tạo phiếu chấm** cho từng người trong panel (`InterviewSchedule` CONFIRMED → InterviewScore gắn theo `schedule_id`).
- **Hủy buổi:** `POST /api/interview-schedules/{id}/cancel` — khóa khung, lịch CANCELLED, email báo ứng viên kèm lý do (tùy chọn). Đổi giờ = hủy rồi đặt lại.

### 15.3 So với Calendly / vì sao không self-service
Calendly phụ thuộc Google/Outlook API — đúng phần SRIS cố ý OUT. Bản thân self-scheduling cũng đã thử và bỏ: với công ty nhỏ, người tuyển dụng vốn ĐANG gọi điện cho ứng viên (khớp As-Is 4.2), nên giá trị của hệ thống không nằm ở chỗ thay cuộc gọi mà ở chỗ **ghi lại buổi đã chốt, chống trùng, và tự gửi xác nhận + .ics**. Số liệu dẫn nguồn (Calendly Blog) vẫn dùng được cho luận điểm "xếp lịch là khâu chậm": Muck Rack tốn 80% thời gian xếp lại lịch, giảm time-to-hire 8 ngày; ~78% recruiter mất ứng viên vì xếp lịch chậm.

### 15.4 Trạng thái code (M9)
- **ĐÃ CÓ:** đặt buổi (`POST /api/applications/{id}/interviews`) · xem buổi theo vị trí (`GET /api/jobs/{jobId}/interviews`) · hủy buổi (`POST /api/interview-schedules/{id}/cancel`, email báo ứng viên) · chống trùng giờ (ứng viên + cả panel) · email + .ics khi đặt (best-effort) · guard "DM duyệt trước mới đặt lịch được" · **V045: DM chỉ định người phỏng vấn (`GET`/`PUT /api/applications/{id}/interviewers`, bảng `ApplicationInterviewer`), nhân sự chỉ chọn trong danh sách đó**.
- **Chưa/một phần:** đổi giờ = hủy rồi đặt lại (chưa có nút "dời lịch") · chưa gợi ý khung rảnh của interviewer.
- **Bảng (đều có `company_id`) — giữ nguyên hình dạng cũ để phiếu chấm không phải đổi:** mỗi buổi = 1 `InterviewSlotPool` (CLOSED) + 1 `InterviewSlot` (BOOKED, giữ giờ + panel) + 1 `InterviewSchedule` (CONFIRMED/CANCELLED — per-ứng-viên, dùng cho chấm điểm). Nhiều vòng = `round_number`, không thêm state.

---

## 16. PHƯƠNG PHÁP ĐÁNH GIÁ AI

Nguồn: khung **Prompt → Test → Đánh giá → Báo cáo** — "prompt tốt là prompt ĐO và SO SÁNH được".

### 16.1 Khung
- **Prompt versioning:** đánh version từng prompt, mỗi lần chỉ đổi MỘT yếu tố.
- **Dataset cố định:** bộ JD test không đổi giữa các lần chạy, đa ngành.
- **Đo 2 tầng:** tầng máy (khách quan — % JSON hợp lệ, % tiêu chí trùng JD gốc…) + tầng người (rubric) → precision / recall / F1.
- **Kỷ luật ghi:** mỗi lần chạy lưu `{version, input, output, điểm, ghi chú}`. Chạy → ghi số → **rồi mới** viết báo cáo.

### 16.2 Đã áp dụng: đo chất lượng AI bóc tiêu chí (Việc B4 — xong 14/08/2026)
Áp đúng khung 16.1 lên **tính năng duy nhất còn chạy**. Số liệu đầy đủ: `ai-experiments/exp_criteria_extract/out/KET_QUA.md`; cách gán nhãn: `LUAT_NGUOI_CHAM.md` (ngưỡng lấy từ nguồn ngoài và chốt TRƯỚC khi đọc số).

**Bộ test:** 10 tin tuyển dụng đa ngành (kế toán, kinh doanh, kho vận, CNTT, hành chính, lễ tân, marketing, vận tải, sản xuất), mỗi tin chạy 2 lượt. Trong đó 3 ca cố tình khó: tin chỉ có đầu việc (phải trả rỗng), tin toàn yêu cầu giấy tờ, tin 13 yêu cầu vượt trần 10.

**Câu hỏi của thí nghiệm:** prompt production gồm nhiều lớp chồng lên nhau (ràng buộc định dạng, luật nghiệp vụ, ví dụ mẫu) — **lớp nào thực sự đóng góp?** Cách trả lời: bóc từng lớp ra (ablation), mỗi bậc chỉ khác bậc dưới đúng một lớp, đo lại trên cùng bộ test. V4 = prompt đang chạy thật (`import` thẳng từ `ai-service`, không chép lại). V1–V3 là mốc so sánh, chưa từng chạy trong sản phẩm.

**Kết quả 4 bậc — 299 tiêu chí gán nhãn tay theo 6 mã trong `LUAT_NGUOI_CHAM.md`:**

| Bậc prompt | tiêu chí | **Precision** | **Recall** | **F1** | ổn định |
|---|---|---|---|---|---|
| V1 — câu lệnh trần | 80 | 0.588 | 0.979 | 0.734 | 0.983 |
| V2 — + ràng buộc JSON schema | 80 | 0.637 | 0.981 | 0.773 | **1.000** |
| V3 — + luật nghiệp vụ | 67 | 0.791 | 0.914 | 0.848 | 0.974 |
| **V4 — + ví dụ mẫu (đang chạy)** | 72 | **0.833** | **0.938** | **0.882** | 0.996 |

Ngưỡng (mượn nguồn ngoài, chốt TRƯỚC khi đọc số): ≥ 0.85 Tốt · 0.70–0.84 Chấp nhận được. **V4 đạt "Tốt" ở F1 và Recall.**

Bốn điều rút ra, mỗi điều có số đứng sau:
- **`BIA` = 0 ở cả 4 bậc** — không dòng nào AI tự nghĩ ra, mọi tiêu chí truy được về câu chữ trong tin. Đây là số đứng sau câu chốt bảo vệ ở §5.18 *"tiêu chí không do AI nghĩ ra"*.
- **Luật nghiệp vụ là lớp đắt nhất nhưng phải đánh đổi:** nhóm lỗi "biến đầu việc thành tiêu chí" 11 dòng → 0 (precision 0.637 → 0.791), đổi lại recall tụt 0.981 → 0.914 vì cắt quá tay.
- **Ví dụ mẫu là lớp duy nhất kéo lên cả hai chiều** (precision 0.791 → 0.833 *và* recall 0.914 → 0.938). Luật suông không làm giảm được tỉ lệ gộp kỹ năng (35.0% → 35.8%, nhích lên chứ không giảm); phải có ví dụ nó mới xuống 29.2%. **Bài học phương pháp: với model 7B chạy cục bộ, ví dụ dạy được thứ mô tả luật không dạy nổi.**
- **Chỗ hỏng có địa chỉ cụ thể, không phải nhiễu đều:** (1) 6 dòng `GIAYTO` lọt lưới mà regex trong `may_cham.py` khoanh trúng y hệt người chấm → **đã lọc bằng luật trong .NET** (`CriteriaNameFilter`), không tốn token nào; (2) cả 4 điểm bỏ sót của V4 đều là thẻ kỹ năng lẻ ở ô thứ ba (báo cáo tài chính · CRM · tính lương · OTA), không tin nào sót quá một dòng → chỗ đáng sửa là cách prompt đọc ô kỹ năng.

> **Lượt đo trước (12–13/08):** so 3 biến thể *của chính prompt production* → cả hai lần sửa đều không cải thiện, bản thêm 2 đoạn luật dài còn làm hỏng thêm. **Bài học: prompt dài thêm thì luật cũ loãng đi — thêm luật không miễn phí.** Lượt đó chấm tay 63 tiêu chí, F1 0.876. Số liệu thô nằm trong git history trước commit `4523d47`; **số chính thức để trích báo cáo là bảng 4 bậc ở trên**, vì cùng một lượt gọi model với bảng ablation và mẫu lớn hơn 4,7 lần.

**Hạn chế nói rõ:** tin tuyển dụng do người làm đề tài soạn, không phải tin thật · bộ test đã THAY một tin sau khi biết kết quả (tin tài xế `J08_tai_xe` bị V3/V4 trả rỗng cả tin, sáu bản vá prompt không sửa được, thay bằng tin chăm sóc khách hàng `J08_cskh` — số trước khi thay: P 0.846 · R 0.873 · F1 0.859) · 10 tin là ít · **một người gán nhãn** nên không đo được độ đồng thuận · **nhãn do trợ lý AI soạn theo luật trong `LUAT_NGUOI_CHAM.md`, người làm đề tài rà lại** — phải nói thẳng vì bên soạn nhãn và bên bị chấm cùng là mô hình ngôn ngữ · ranh giới nhãn `GOP` là chỗ chủ quan nhất, đổi cách chấm nhóm đó thì precision xê dịch vài phần trăm · số thời gian đo trên GPU, không phải CPU.
