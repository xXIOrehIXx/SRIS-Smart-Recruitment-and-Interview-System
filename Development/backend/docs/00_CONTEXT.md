# 00 — CONTEXT.md

> **Kim chỉ nam (single source of truth) cho mọi chat trong Project SRIS. Mọi chat mới Claude PHẢI đọc file này đầu tiên.**
>
> *Quy ước tên gọi: **Radar Chart** = hình dạng mạnh/yếu theo trục tiêu chí; **standard deviation (độ lệch chuẩn)** = con số đo các interviewer có lệch nhau không → flag "cần bàn". Đừng gọi lẫn hai thứ.*

---

## 0. TRẠNG THÁI DỰ ÁN

- Đã báo cáo thầy (Business Overview Document) → OK; đang chỉnh theo feedback (Section 12).
- AI dùng **Local AI + Vector** (không OpenAI/Gemini).
- **Đã hoàn thành PoC chạy thật:** Việc 2 (Local AI+Vector), Việc 3 (PDF extract), Việc 4 (Gen Quiz AI), Việc 5 (State Machine). Chi tiết & bài học ở Section 14.
- **Thiết kế xong, chờ code:** Đặt lịch phỏng vấn (Section 15).
- **Mô hình role:** 4 role đăng nhập Portal — Admin, Recruiter, Interviewer, Department Manager; Candidate là khách ẩn danh dùng magic link. Người quyết tuyển một vị trí là Department Manager của job (cột `Job.department_manager_id`; để trống → Recruiter quyết). Tiêu chí chấm per-job do Recruiter cấu hình. OfferDetail cho state OFFER; ứng viên tự nhận/từ chối qua magic link `OFFER_RESPONSE`. **DB: 21 bảng** (V001). **ERD vẽ 19 thực thể nghiệp vụ** — GIỮ `MagicLinkToken` (cơ chế cửa vào của Candidate), KHÔNG vẽ `ActivityLog` + `EmailLog` (log/audit thuần). Quan hệ `Application` → `MagicLinkToken` là **1-N**, nhãn `generates` (một hồ sơ phát sinh nhiều token theo 4 purpose + cấp lại khi hết hạn). ERD vẽ kiểu **chỉ thuộc tính + quan hệ bằng đường nối, không vẽ cột khóa ngoại**; mọi bảng đều có `company_id` (cô lập tenant) nên không vẽ hết các đường Company cho đỡ rối. `Job` có 2 FK tới `User` (`department_manager_id`, `created_by`) nhưng theo quy ước KHÔNG vẽ cột FK trong box → thể hiện bằng 2 đường nối: `decides hiring for` (Department Manager quyết tuyển) + `creates` (Recruiter tạo job).
- **Phạm vi:** tuyển cho **MỌI vị trí**, không chỉ IT (Charter/Persona nghiêng IT chỉ là ví dụ).
- Tên đồ án: **Smart Recruitment and Interview System (SRIS)**.
- **CẦN HỎI THẦY:** (1) "Đề xuất CV" (basic) có in-scope không; (2) phỏng vấn nhiều vòng có in-scope không (đã có bằng chứng thực tế VPBank ủng hộ — xem 5.12, 10).

---

## 1. TÓM TẮT DỰ ÁN

- **Tên:** Smart Recruitment and Interview System (SRIS) — Hệ thống Tuyển dụng và Phỏng vấn Thông minh.
- **Mô hình:** SaaS Multi-tenant ATS tích hợp AI — **cung cấp DỊCH VỤ (thuê dùng, trả phí định kỳ), KHÔNG bán đứt.** Nhiều công ty dùng chung một hệ thống, cô lập theo `company_id`.
- **Đối tượng:** công ty 100+ nhân sự, tuyển mọi vị trí.
- **Thời gian:** 3 tháng (01/04 — 15/07/2026).
- **Team 5:** 1 BA Lead/PM (kiêm Backend, là tôi) · 2 Backend (.NET) · 2 Frontend (React).
- **Stack:** .NET 10 minimal API **+ EF Core** (orchestration & DB) · Python FastAPI (AI: embedding + LLM) · React · **SQL Server 2025** (kiểu VECTOR) · **MinIO** (object storage — lưu CV gốc) · Local AI · Vercel (FE) · Render/VPS (BE).
- **2 mảng chủ đạo:** Recruitment (tuyển dụng) · Interview (phỏng vấn).

---

## 2. VAI TRÒ NGƯỜI DÙNG

> **Nguyên tắc cửa vào:** người trong cuộc đều **đăng nhập Portal** — Admin, Recruiter, Interviewer, Department Manager. **Chỉ Candidate** là khách ẩn danh, tham gia qua **magic link an toàn, KHÔNG cần account**. (Câu chốt khi bảo vệ.)

> **Ba vai tách bạch — chấm / quyết / thao tác:** **Interviewer** *chấm* (cho điểm phỏng vấn). **Department Manager** (trưởng bộ phận) *quyết* (chốt tuyển hay không, ở bước OFFER). **Recruiter** *thao tác* (vận hành cả pipeline, sàng lọc CV, đặt lịch, gen quiz). Người mở nhu cầu tuyển một vị trí chính là Department Manager của job đó.

| Role | Mô tả | Cách vào | Quyền chính |
|---|---|---|---|
| Admin (per tenant) | Quản trị viên công ty | Đăng nhập Portal | Quản lý user, cấu hình brand |
| Recruiter | Vận hành toàn bộ pipeline | Đăng nhập Portal | Tạo job, cấu hình tiêu chí chấm theo job, quản lý Kanban, sàng lọc & duyệt CV, gen + duyệt quiz, đặt lịch, gửi offer |
| Interviewer | Người chấm phỏng vấn | Đăng nhập Portal | Xem buổi PV được giao, chấm điểm theo tiêu chí (Blind Review), sửa điểm đã gửi (tới khi buổi/vòng bị khóa), xem lịch sử buổi đã chấm |
| Department Manager | Trưởng bộ phận — người quyết định tuyển | Đăng nhập Portal | Mở/sở hữu nhu cầu tuyển (job); ở bước OFFER xem điểm/Radar rồi **chốt tuyển hay không**. Không đụng sàng lọc CV / quiz / phỏng vấn |
| Candidate | Ứng viên ngoài hệ thống | **Magic link** | Nộp CV, làm quiz / chọn lịch / xem trạng thái / nhận-từ chối offer |

> **Cách phân biệt role (chống nhầm):** **(1) Vào bằng gì?** 4 role nội bộ đều login; chỉ Candidate dùng magic link. **(2) Việc cốt lõi 1 động từ?** Câu thần chú: **Recruiter lái · Interviewer chấm · Department Manager quyết · Candidate ứng tuyển · Admin dựng sân.**
>
> **"Chấm" vs "quyết" — câu hay bị hỏi:** `Interviewer` cho điểm (input). `Department Manager` ra phán xét tuyển/loại — chỉ ở **một điểm duy nhất** trong cả luồng là bước OFFER. `Recruiter` vận hành Kanban giữa hai việc đó và gác khúc sàng lọc CV. Người quyết của một job = Department Manager gán cho job (`Job.department_manager_id`); job không gán DM thì Recruiter tự quyết. **Ghi thẳng câu này trong báo cáo** — ba vai chấm/quyết/thao tác tách bạch là điểm cộng nghiệp vụ.

---

## 3. SCOPE

### IN-SCOPE
**Recruitment:** Career Site · Pipeline Kanban + State Machine · AI chấm điểm CV (Local AI + Vector) · Email Automation · Multi-tenant (shared schema + company_id) · Brand theming.
**Interview:** Quiz Engine 2 loại (Async + Onsite) · AI Gen quiz từ JD (Local LLM) · Anti-cheat 3-layer · Collaborative Scoring + Radar Chart · CRUD tiêu chí chấm.
**Chung:** Dashboard Analytics · RBAC 4 role (login) + Candidate magic link · Activity Log & Internal Notes.
**"Wow":** Hybrid 2-stage test · Blind Review · Insight std deviation · Ứng viên tự nhận/từ chối offer online (self-service) · Disclosure & Consent.

### SOFT IN-SCOPE (chờ thầy)
- **CV Suggestion / Talent Pool (basic) — QUYẾT ĐỊNH: SẼ LÀM** (vẫn xác nhận thầy phạm vi phase 1). Recruiter bấm "Gợi ý CV", hệ thống tìm CV cũ có vector gần JD → Top N + điểm. Vector search LUÔN kèm `company_id`. KHÔNG real-time, không gợi ý ngược. (PoC đã chứng minh khả thi.)
  * **Nguồn dữ liệu = KHO `CvDocument` CŨ của chính công ty đó** — không nguồn mới, không scrape, không mua data. Mỗi CV ứng viên từng nộp đã được parse + sinh embedding + lưu; vector đó không mất khi ứng viên rớt / job đóng. Talent Pool chỉ quét lại kho đã tích lũy.
  * **Cơ chế = ĐẢO CHIỀU truy vấn chấm CV đã PoC:** thay vì "CV mới vào → so 1 JD", thì "JD mới → quét lại kho CV cũ". Tái dùng đúng embedding + vector search, KHÔNG thêm model / hạ tầng.
  * **Cô lập tenant:** chỉ thấy CV nộp vào cùng `company_id` — không bao giờ gợi ý xuyên công ty (câu hội đồng hay hỏi).
  * **Pháp lý/đạo đức:** ứng viên đã chủ động nộp CV cho chính công ty đó → xét lại cho vị trí khác là hợp lý, không phải dùng lén.
  * **Giới hạn (ghi thẳng, đừng vẽ thần kỳ):** chỉ có giá trị khi kho CV đủ lớn; công ty mới / kho trống → gợi ý không ra gì.
- **Phỏng vấn nhiều vòng (2-3 vòng):** xem 5.12. (Bằng chứng thực tế: VPBank có PV nhóm + PV cá nhân — 10.)

### OUT-OF-SCOPE
CV Suggestion nâng cao · dynamic subdomain · Super Admin portal · đồng bộ 2 chiều Google/Outlook Calendar (đặt lịch *nội bộ* thì CÓ làm — Section 15; .ics đính kèm vẫn in-scope) · tự dò lịch rảnh interviewer · coding challenge · Core Recruiter · chatbot real-time · **chat tự do Recruiter↔Local AI** (thay bằng nút hành động AI — 5.6) · LDAP/SSO · mobile native · **webcam proctoring / giám sát sinh trắc** (đối lập có chủ đích với JobTest — 5.5) · OCR cho PDF scan.

---

## 4. KPI

| KPI | As-Is | To-Be |
|---|---|---|
| Time-to-Hire | 18 ngày | < 12 ngày (-30%) |
| Recruiter làm tác vụ admin | 3-4 h/ngày | < 1 h/ngày |
| Báo cáo nguồn ứng viên | Không có | Dashboard 360° theo UTM |
| Phát hiện gian lận quiz | 0% | > 60% |

---

## 5. CÁC QUYẾT ĐỊNH THIẾT KẾ ĐÃ CHỐT

### 5.1 Authentication
- **Internal user (Admin / Recruiter / Interviewer / Department Manager):** JWT + Email/Password, đăng nhập Portal.
- **Candidate:** Magic Link (token 1 lần khi chốt, TTL cấu hình) — KHÔNG cần account. Là actor ẩn danh **duy nhất**.
- **Vì sao người trong cuộc đều login:** interviewer cần xem lịch sử các buổi đã chấm và sửa điểm đã gửi (tới khi buổi/vòng bị khóa); department manager cần xem kết quả để quyết tuyển. Đó là nhu cầu định danh lâu dài, magic link một-tác-vụ không kham được. Dùng lại đúng cơ chế JWT đã có cho Admin/Recruiter — như các ATS thật (Greenhouse, Lever).

### 5.2 Database — SQL Server 2025 + cô lập tenant
- **Engine:** SQL Server 2025 (kiểu VECTOR). Dev: Developer Edition. Deploy: Azure SQL Free Tier (đã xác minh hỗ trợ VECTOR; 100k vCore-giây/tháng, 32GB).
- **Multi-tenant:** shared schema + cột `company_id` mọi bảng; routing path-based `/t/{slug}`.
- **Cô lập tenant — giá trị thật KHÔNG ở cột `company_id` (việc đó tầm thường) mà ở việc ĐẢM BẢO không rò dữ liệu xuyên tenant.** Đây là phần kỹ thuật + câu hội đồng hay hỏi. 3 lớp phòng thủ:
  1. **RLS (lõi, ép ở tầng DB):** security predicate gắn vào bảng, tự chèn điều kiện lọc tenant vào MỌI câu SELECT/UPDATE/DELETE/INSERT — dev quên `company_id` thì DB vẫn chặn. Cần FILTER + BLOCK predicate. Tenant set qua `SESSION_CONTEXT` đầu mỗi request. **Bẫy:** connection pooling → PHẢI set lại `SESSION_CONTEXT` mỗi request.
  2. **EF Core Global Query Filter (tầng code):** khai báo 1 lần, mọi LINQ tự kèm `company_id`. (Một lý do chọn EF Core — xem 5.11.)
  3. **Test cô lập tenant (lưới):** test tạo dữ liệu công ty A+B, đăng nhập A khẳng định không thấy dòng của B; chạy trong CI. Khớp kế hoạch test (môn SWT, bảng 1.2).
- **Unique scope tenant:** mọi UNIQUE theo `(company_id, ...)`. VD email ứng viên unique `(company_id, email)` — 1 người nộp 2 công ty là bình thường.
- **Vector search:** `VECTOR_DISTANCE('cosine', ...)` — exact (kNN), đủ cho < 50.000 vector. KHÔNG dùng vector index / `VECTOR_SEARCH` (experimental). Trong EF Core: `EF.Functions.VectorDistance("cosine", ...)`. Câu vector PHẢI kèm `company_id`.

### 5.3 AI Integration — Local AI + Vector
**KHÔNG OpenAI/Gemini** (thầy: gọi API là mức thấp nhất, tốn tiền/request, phụ thuộc bên thứ 3).

| Tính năng | Cách làm |
|---|---|
| Chấm điểm CV ↔ JD | Embedding local → vector → cosine. Tự viết logic điểm. |
| Đề xuất CV / tìm Talent Pool | Vector search trong SQL Server 2025 |
| Gen Quiz từ JD | Local LLM qua Ollama (qwen2.5) |

- **Embedding model (chốt):** `paraphrase-multilingual-MiniLM-L12-v2`, 384 chiều → `vector(384)`. Hỗ trợ tiếng Việt.
- **RE-EMBEDDING:** vector 2 model khác nhau KHÔNG so sánh được. Đổi model → BẮT BUỘC sinh lại vector toàn bộ CV/JD cũ. Cần quy trình re-embedding.
- **Hướng:** Hybrid — Embedding/Vector (chấm điểm, đã PoC) + Local LLM (Gen Quiz, đã PoC).

### 5.4 Python vs .NET
- **Python (FastAPI):** sinh embedding + gen quiz. Stateless, KHÔNG đụng DB, KHÔNG biết tenant.
- **.NET + EF Core:** orchestration, business logic, truy cập DB. Mọi request qua .NET; .NET gọi Python qua HTTP nội bộ.
- Embedding: Python trả `float[]` → .NET bọc `SqlVector<float>` → EF Core lưu `vector(384)`. Tách Python/.NET KHÔNG đổi.
- Chỉ tách Python KHI bắt buộc (thư viện AI). Phần .NET tự làm được (vd extract PDF) thì để .NET.
- **Hệ quả:** mọi tác vụ AI giữ dạng **gen đơn, stateless** (1 request → 1 kết quả). Đây là lý do KHÔNG làm chat tự do Recruiter↔AI (cần giữ lịch sử hội thoại → phá stateless); thay bằng nút hành động AI (5.6).

### 5.5 Anti-cheat — "Raise the cost of cheating"
| Layer | Mô tả | Detect |
|---|---|---|
| 1. Behavioral | Tab switch, paste, DevTools, blur/minimize, disconnect, time/câu | Gian lận đơn thiết bị |
| 2. Question design | Câu tình huống thay vì tra cứu; xáo trộn câu + đáp án (test matrix) | Khó Google 30s; khó trao đáp án |
| 3. Cross-check Stage 1↔2 | Async vs Onsite chênh > 30% | Gian lận đa thiết bị / nhờ AI ở nhà |

- **Rule cụ thể Layer 1 (tham khảo VPBank + JobTest):**
  * Chuyển tab quá **ngưỡng N** (cấu hình) → cảnh báo, vượt thì **auto-submit/khóa bài**.
  * **Blur/minimize/đóng trình duyệt** → cảnh báo hoặc dừng bài, lưu phần đã làm.
  * **Mất mạng/disconnect** → auto-save phần đã làm (không mất sạch).
  * Đếm **số màn hình** trước khi vào thi (chống multi-monitor).
- **Disclosure (CÔNG KHAI ngưỡng):** báo rõ cho ứng viên "bài thi có giám sát; tối đa **N lần** chuyển tab, lần N+1 khóa bài" — ngưỡng N cấu hình được. Lý do chọn công khai (kiểu VPBank): minh bạch + răn đe mạnh + tránh loại nhầm người lỡ tay.
- **Consent bắt buộc:** UV tick đồng ý (có giám sát + làm độc lập, không dùng AI/công cụ/tài liệu) mới làm bài. (Honor code + hợp lệ pháp lý.)
- **Đối lập có chủ đích với JobTest:** JobTest bán phần đắt = giám sát sinh trắc (webcam + AI khuôn mặt). SRIS cố tình dừng ở behavioral + thiết kế câu hỏi + cross-check → triết lý "raise the cost of cheating", không giám sát camera; webcam = OUT (riêng tư + ngoài scope). SRIS hơn JobTest ở **cross-check 2 vòng** (JobTest chỉ 1 bài test).

### 5.6 Quiz — Hybrid 2 Stage (MCQ-only)
**2 stage:** Pre-screening (UV làm tại nhà, MCQ cơ bản ~10 câu) · Technical Assessment (onsite có giám sát, MCQ + tình huống ~20 câu). Hai stage tạo dữ liệu cho cross-check Layer 3 (5.5).

- **MCQ-only (KHÔNG tự luận):** lý do — (1) chấm tự động, khách quan, không cần AI chấm; (2) tự luận bị ChatGPT viết hộ dễ; (3) local 7B chấm tự luận không đáng tin, khó bảo vệ. *Lưu ý:* test năng lực kiểu VPBank (logic, lập luận số) bản chất CŨNG là trắc nghiệm — đi hướng nào cũng MCQ.
- **Lõi nội dung = JD-based + câu tình huống:** AI gen quiz **theo từng JD** (đúng thế mạnh + mục tiêu "tuyển mọi vị trí"). KHÔNG đua aptitude chung (cần ngân hàng đề cố định, lệch định vị AI-gen). KHÔNG tự chấm văn hóa/tính cách (chủ quan — đó là sản phẩm riêng của JobTest). Muốn chạm văn hóa/soft-skill: dùng **câu tình huống MCQ** + Recruiter **thêm câu văn hóa thủ công** ở bước duyệt.
- **Timer tách khỏi TTL (2 đồng hồ khác nhau):**
  * **TTL magic link** = cửa sổ được phép VÀO (vd Quiz 48h). Vào lúc nào trong cửa sổ cũng được.
  * **Timer lượt làm** = khi bấm Bắt đầu thì có X phút liên tục, hết giờ **auto-submit**. Tính ở **server** (bắt đầu khi load quiz lần đầu), không tin client.
  * Phải có CẢ HAI: thiếu timer-lượt → UV mở link tra cứu cả ngày.
- **Duyệt quiz AI:** Recruiter vừa gen vừa review/duyệt trong portal. Quiz AI sinh ra luôn ở **DRAFT** → Recruiter xem/sửa/duyệt → **READY** mới phát cho ứng viên. AI lo phần thô, Recruiter là cổng chất lượng cuối. Giữ đơn giản: KHÔNG kéo interviewer vào duyệt quiz, KHÔNG thêm role/state riêng cho quiz.
- **Nút hành động AI cho Recruiter (thay cho chat tự do):** mỗi nút = 1 lệnh gen đơn stateless (đúng pipeline đã PoC), KHÔNG dựng chatbot:
  * **Tạo thêm N câu** — gen thêm từ cùng JD, nối vào DRAFT.
  * **Gen lại câu này** — làm lại riêng 1 câu, thay tại chỗ.
  * **Thêm câu theo chủ đề [ô nhập]** — gen 1 câu ràng buộc chủ đề Recruiter gõ (vd "Docker").
  * **Sửa tay** — Recruiter tự gõ sửa text/đáp án (không gọi AI).
  * Lý do bỏ chat tự do: local 7B multi-turn dễ trôi/vỡ JSON; phải giữ lịch sử → phá stateless (5.4); chậm (mỗi lượt ~15-20s); Quiz là SHOULD-have, không đáng phình scope/rủi ro demo.

- **QUIZ ENGINE = PROVIDER-AGNOSTIC (tách engine khỏi nguồn đề):** engine lõi (phát đề, chấm tự động, anti-cheat, 2-stage, magic link) KHÔNG quan tâm đề từ đâu ra. AI gen HẠ từ "lõi" xuống "công cụ hỗ trợ OPTIONAL" — thiếu LLM hệ thống vẫn chạy. **3 nguồn đề (không loại trừ nhau):** (1) Recruiter nhập tay / import file — đơn giản nhất, luôn có, là lõi; (2) AI gợi ý câu nháp từ JD — optional, nút trợ giúp; (3) ngân hàng câu hỏi đã duyệt — tái dùng.
- **KHUNG SẴN 2 tầng (trả lời "HR tự nghĩ ra à / phải có khung sẵn"):**
  * **Thư viện tiêu chí mẫu (template) theo nhóm vị trí** — vd Dev: "Kỹ năng kỹ thuật / Giải quyết vấn đề / Giao tiếp"; Sales: "Hiểu sản phẩm / Kỹ năng bán hàng". HR CHỌN template rồi tùy biến, KHÔNG nghĩ từ con số không.
  * **Ngân hàng câu hỏi đã duyệt** — câu Recruiter duyệt tốt → lưu lại, tái dùng cho job tương tự; mỗi câu có nguồn gốc (gen từ JD nào, ai duyệt). Càng dùng càng giàu, công ty có bộ đề riêng.
- **TRẢ LỜI CÂU THẦY "HR thêm tiêu chí/câu rồi nghỉ việc thì ai biết nó thêm gì":** hệ thống KHÔNG dựa trí nhớ người. (1) **Tri thức từ JD** — tiêu chí & câu hỏi dẫn xuất từ JD do **Department Manager viết** (không phải HR bịa); đúng nguyên tắc "tri thức từ DM/JD, thao tác từ Recruiter". (2) **Template làm khung** — kế thừa từ thư viện chuẩn. (3) **Nguồn gốc** — mỗi tiêu chí/câu gắn JD nào (per-job, đã có). (4) **Audit** — `ActivityLog` ghi ai thêm/sửa lúc nào. Người kế nhiệm mở lên thấy ngay: kế thừa template nào, gắn JD nào, ai thêm ngày nào.
- **PIPELINE GEN CHẤT LƯỢNG (ĐANG NGHIÊN CỨU — KHÔNG gửi mỗi JD trống cho AI):** JD là input SAI để gen câu (nhiều chữ chung chung, thiếu chi tiết). Hướng: tách thành các bước, mỗi bước task hẹp cho model nhỏ.
  1. **Trích skill từ JD** (AI, task hẹp) → danh sách `{skill, num_questions}`.
  2. **Recruiter chốt khung** — chỉ chọn **CẤP VỊ TRÍ** (Junior/Mid/Senior); AI tự gán độ khó từng câu theo cấp. **HR KHÔNG cần chuyên môn đặt "EF khó / SQL dễ"** — đó là việc AI làm dựa JD; HR chỉ làm phán xét cấp vị trí (việc HR chắc chắn làm được). Recruiter vẫn bớt skill thừa / đổi số câu / thêm chủ đề.
  3. **Gen TỪNG CHỦ ĐỀ** (mỗi skill 1 lượt, không "1 phát 10 câu") + **few-shot** (1-2 câu mẫu) + ép **câu tình huống** (áp dụng, không hỏi định nghĩa thuộc lòng — trùng Layer 2 anti-cheat) + **distractor hợp lý** (3 đáp án sai dựa lỗi hiểu sai thường gặp) + **self-critique 2 lượt** (AI tự soát "đúng 1 đáp án? distractor có lộ?").
  4. → DRAFT → Recruiter duyệt → vào ngân hàng câu hỏi.
  * **Câu chốt bảo vệ:** "AI không phải nguồn chân lý. Nó gợi ý câu nháp từ JD; người duyệt mới quyết câu nào vào ngân hàng. Có khung chuẩn để dựa, có người duyệt chịu trách nhiệm, có log truy vết. Thiếu AI thì nhập tay từ template — engine không phụ thuộc AI." KHÔNG claim "câu AI local chất lượng cao" → reframe thành **kiến trúc pipeline + kiểm soát con người**.

### 5.7 Collaborative Scoring — Blind Review + tách "chấm" vs "quyết định"
- Recruiter TỰ định nghĩa bộ tiêu chí từng job (không hard-code).
- **Interviewer chấm trong Portal (đăng nhập):** Recruiter set up buổi PV + gán interviewer → interviewer đăng nhập, thấy danh sách buổi được giao → mở trang chấm (tiêu chí + ô điểm + ô note từng tiêu chí) → submit. Interviewer **sửa lại điểm đã gửi** đến khi buổi/vòng bị khóa, và **xem lịch sử các buổi đã chấm**.
- **Chấm LIVE trong buổi PV, KHÔNG dựa trí nhớ:** thực tế người ta vừa phỏng vấn vừa ghi → trang mở từ đầu buổi, gõ điểm + note ngay; **nháp TỰ LƯU ở server** (đổi máy/đóng nhầm tab vẫn còn); cuối buổi mới Submit. Số hóa đúng thói quen as-is.
- **Blind Review giữ nguyên:** mỗi interviewer chấm độc lập, nháp riêng tư, hệ thống chỉ MỞ BLIND (lộ điểm/note nhau) SAU khi đã submit. Chống bias hùa theo + tạo dữ liệu. (Login không phá blind — nháp vẫn riêng.)

**TÁCH BẠCH "chấm" vs "quyết định" (câu hay bị hỏi):**
- **Chấm điểm = INPUT** (interviewer cho ý kiến: điểm + note). **Quyết định = phán xét tuyển/loại** (Department Manager).
- **Ai quyết:** **Department Manager của job** (`Job.department_manager_id`, 5.14). DM mở nhu cầu tuyển rồi giao Recruiter chạy; DM **không đụng** sàng lọc CV / quiz / phỏng vấn; chỉ vào ở **bước OFFER** xem điểm/Radar rồi chốt tuyển hay không. Job không gán DM → **Recruiter tự quyết**.
- **Recruiter thao tác Kanban.** Recruiter kéo state. Tại cửa INTERVIEW→OFFER: job có DM thì DM là người chốt; không có DM thì Recruiter chốt luôn. Tách rạch ròi: **quyết = Department Manager (hoặc Recruiter mặc định), thao tác Kanban = Recruiter.**
- **"Check" là MÁY làm, không phải người soi điểm:** sau khi cả panel submit, hệ thống tổng hợp **Radar Chart** (hình dạng mạnh/yếu) + **standard deviation** (lệch chuẩn — đo đồng thuận). Lệch thấp = panel đồng ý, tin được; **lệch cao ở 1 trục = panel bất đồng → flag "cần bàn"**. Đây là cải tiến so với as-is "ghi giấy + chốt mồm".
- **Khi nào bàn mồm:** CHỈ ở tiêu chí bị flag lệch cao (người quyết hỏi nhanh người chấm thấp/cao lý do, đọc note). Tiêu chí đồng thuận thì bảng tự nói, khỏi họp. → Luận điểm nghiệp vụ: **hệ thống không thay phán xét con người, nó làm cuộc nói chuyện gọn + đúng trọng tâm.**
- **Người quyết đọc bảng theo thứ tự:** nhìn cột đồng thuận trước (không nhìn TB trước) → đào chỗ lệch (đọc note) → Radar xem tổng thể → quyết. Hệ thống KHÔNG auto-quyết (tuyển người là phán xét con người).
- **Tiêu chí chấm là PER-JOB:** bộ tiêu chí định nghĩa theo từng job (linh hoạt), không phải một bộ chung cả công ty. Trong ERD `EvaluationCriteria` có `job_id`.

**`reject_reason` — bắt buộc nhưng 1-CHẠM:**
- **Giữ bắt buộc** (KPI dashboard "tại sao rớt" sống nhờ field này; optional → ai cũng skip → dashboard vô dụng + mất điểm bảo vệ). Friction sợ hãi đến từ tưởng tượng "ô text bắt gõ luận văn" — sai.
- **Cách đúng = chip preset 1 chạm:** `Chuyên môn chưa đạt` · `Thiếu kinh nghiệm` · `Không hợp văn hóa` · `Lương không khớp` · `Đã chọn người khác` · `Khác (ghi rõ)`. Tap 1 cái là xong; ô text optional nếu muốn thêm.
- **Tách 2 thứ:** `reject_reason` (NỘI BỘ, để analytics, ghi thật) ≠ email báo rớt (gửi ứng viên, lịch sự chung chung). Reason nội bộ KHÔNG tự gửi cho ứng viên.
- Reject hàng loạt CV điểm thấp ở SCREENING → hệ thống tự điền `Điểm CV dưới ngưỡng`, không bắt gõ tay từng cái.

### 5.8 State Machine
**7 trạng thái:** NEW → SCREENING → QUIZ → INTERVIEW → OFFER → HIRED / REJECTED. **11 transition**, forward-only.
- Forward (6): NEW→SCREENING · SCREENING→QUIZ · SCREENING→INTERVIEW (bỏ qua quiz, vị trí phi kỹ thuật) · QUIZ→INTERVIEW (**Guard G1:** phải có bài quiz đã nộp) · INTERVIEW→OFFER (**Guard G2:** ≥1 phiếu chấm đã submit) · OFFER→HIRED.
- Reject (5): từ NEW/SCREENING/QUIZ/INTERVIEW/OFFER → **một** REJECTED duy nhất, bắt buộc `reject_reason`.
- **Confirm marker** trên transition tới hạn (vào OFFER, nhận việc, mọi reject — vì có gửi email). KHÔNG làm admin override (confirm dialog đủ).
- Việc 5 ĐÃ HOÀN THÀNH (PoC).
- **Ai chạm hồ sơ ở từng stage:**
  * **NEW:** chỉ **hệ thống** (chấm điểm vector tự động) + **Recruiter** (mở pipeline xem). Department Manager KHÔNG xem ở NEW.
  * **SCREENING:** **Recruiter** sàng lọc và duyệt CV trực tiếp, chủ động chuyển stage. KHÔNG có cổng duyệt CV riêng — Recruiter là người gác khúc đầu.
  * **INTERVIEW → OFFER:** **điểm quyết duy nhất** trong cả luồng. Recruiter đẩy hồ sơ tới đây (qua Guard G2); **Department Manager của job** xem điểm/Radar rồi chốt: tuyển (→ OFFER) hoặc loại (→ REJECTED). Job không gán DM → Recruiter chốt.
- **forward-only ≠ cứng nhắc:** đổi lịch phỏng vấn (reschedule) và phỏng vấn nhiều vòng (5.12) diễn ra BÊN TRONG stage INTERVIEW, không phải transition → không mâu thuẫn.

### 5.9 Interview Scheduling — tóm tắt
Hệ thống tự đặt lịch nội bộ, KHÔNG Google Calendar. **MỘT tính năng đặt lịch duy nhất:** Recruiter mở 1+ khung giờ + gán interviewer → magic link (`purpose=SCHEDULE`) cho ứng viên → ứng viên chọn/xác nhận khung → chốt, khóa khung còn lại, email xác nhận 2 bên + .ics.
- **Nhóm hay cá nhân = Recruiter quyết lúc đó, KHÔNG phải 2 mode kỹ thuật:** Recruiter mở khung rảnh interviewer thành **pool slot dùng chung**, ứng viên tự chọn ai trước được trước (slot đặt rồi ẩn khỏi người khác → interviewer không trùng giờ); muốn PV nhóm/panel → cố ý mời nhiều ứng viên vào CÙNG khung. Hệ thống chỉ cần "mở khung + magic link + .ics".
- Link đặt lịch RIÊNG, chỉ sinh sau khi card vào INTERVIEW + Recruiter mở khung. **Chi tiết kỹ thuật: Section 15.**

### 5.10 Cấu trúc Web — 2 site tách biệt
- **Career Site (công khai)** — ứng viên, vào bằng link `/t/{slug}` + magic link, KHÔNG đăng nhập.
- **Internal Portal (nội bộ)** — nhân sự đăng nhập `/t/{slug}/login` (JWT). Sau khi đăng nhập, vào khu theo role: `/t/{slug}/admin` · `/t/{slug}/recruiter` · `/t/{slug}/interviewer` · `/t/{slug}/manager` (Department Manager). Mỗi khu chỉ mở đúng quyền của role.
- Nhân sự gõ `/t/{slug}/login` MỘT lần đầu; sau đó browser nhớ/bookmark/JWT còn hạn. 2 cửa riêng (như Greenhouse, Lever).
- **KHÔNG nút "Đăng nhập" nổi bật ở header Career Site** (làm ứng viên tưởng phải tạo account — sợ persona Tuấn Kiệt). Nếu cần, chỉ link nhỏ ở footer.
- **Các kiểu cửa vào:** Candidate = link công khai + magic link (không bao giờ login) · Admin / Recruiter / Interviewer / Department Manager = `/t/{slug}/login` (luôn login). Chỉ Candidate ẩn danh.
- **DEMO:** chuẩn bị sẵn URL login để paste, hoặc mở sẵn 2 tab (Career Site + Portal đã login).

### 5.11 Tầng truy cập DB — EF Core thay raw ADO.NET
- **Quyết định:** dùng **EF Core** thay kế hoạch raw ADO.NET (viết SQL tay).
- **Lý do 1 — vector đã hỗ trợ chính thức:** EF Core 10 hỗ trợ kiểu VECTOR của SQL Server 2025 (chỉ 2025+): `SqlVector<float>` + `[Column(TypeName="vector(384)")]` + `EF.Functions.VectorDistance("cosine", ...)`. Khớp đúng exact distance (5.2/5.3). VECTOR_SEARCH/index vẫn experimental → KHÔNG dùng. Nguồn: learn.microsoft.com/en-us/ef/core/providers/sql-server/vector-search.
- **Lý do 2 — hội đồng chú trọng NGHIỆP VỤ**, không chấm việc viết SQL tay → ADO.NET không đổi điểm, chỉ tốn thời gian. EF Core cắt plumbing → dồn thời gian cho nghiệp vụ.
- **Lý do 3 — vá lỗi multi-tenant:** EF Core có Global Query Filter (ADO.NET không có) → tự kèm `company_id`.
- **Lý do 4 — an toàn vibe code:** AI sinh LINQ khó tạo SQL injection + khó quên company_id; ghép chuỗi SQL thô dễ dính cả hai.
- **Cửa thoát:** câu nào EF dịch không gọn → dùng `FromSqlRaw` riêng chỗ đó.
- **TRƯỚC KHI CHUYỂN:** (1) họp nhóm thống nhất; (2) spike verify `EF.Functions.VectorDistance` chạy đúng trên SQL Server 2025 thật; (3) migrate data layer PoC Việc 2-5 (rẻ vì đang giai đoạn đầu).

### 5.12 Phỏng vấn nhiều vòng (2-3 vòng) — dữ liệu trong INTERVIEW
- **Nguyên tắc:** nhiều vòng = **DỮ LIỆU bên trong stage INTERVIEW**, KHÔNG thêm state. **Sơ đồ 7 state/11 transition giữ nguyên.**
- Card nằm yên ở INTERVIEW suốt các vòng. Mỗi vòng = 1 Interview Request (đặt lịch riêng) + 1 phiếu Collaborative Scoring riêng. Xong vòng, Recruiter chọn: mở vòng kế (tạo thêm request, KHÔNG đổi state) / sang OFFER (qua G2) / REJECTED.
- Số vòng cấu hình theo job, KHÔNG hard-code. Thêm `round_number` (hoặc bảng `InterviewRound`) + badge "Vòng x/y" trên Kanban. Có thể thêm `round_name` cấu hình.
- Guard G2 giữ mức tối thiểu "≥1 phiếu chấm đã submit" — KHÔNG siết "chấm hết mọi vòng" (quyết định đủ vòng là việc của Recruiter).
- Vì sao KHÔNG tạo INTERVIEW_1/_2/_3: phình state, hard-code số vòng, phá forward-only.
- **Bằng chứng thực tế:** VPBank Young Talents 2026 có V3 PV nhóm + V4 PV cá nhân = đúng 2 vòng trong stage INTERVIEW (10).

### 5.13 Actionable Email + Magic Link — cùng MỘT cơ chế
- **Magic link:** URL chứa chuỗi ngẫu nhiên dài (là "chìa khóa", không cần mật khẩu). Lưu DB kèm (purpose, hồ sơ nào, TTL, đã dùng chưa). Bấm → tra DB → mở đúng trang. Bảo mật: **lưu HASH token** (không lưu gốc), one-time, TTL cấu hình, rate limit, đếm số lần truy cập, ràng buộc purpose.
- **Các purpose (4) — tất cả của ứng viên** (vì người trong cuộc đã đăng nhập Portal): QUIZ (UV làm bài) · SCHEDULE (UV chọn/xác nhận lịch) · STATUS (UV xem trạng thái) · OFFER_RESPONSE (UV xem offer + bấm Đồng ý/Từ chối).
- **Actionable Email:** email HTML có nút (`<a>`) trỏ tới magic link. Dùng cho ứng viên: mời làm quiz, mời chọn lịch, gửi offer.
- **BẪY quan trọng:** nút trong email KHÔNG được trực tiếp thực hiện hành động — vì trình quét email (Gmail/Outlook) có thể tự bấm thử link. **Cách đúng:** nút email chỉ MỞ một **trang nhỏ** (hiện nội dung + nút hành động); người dùng bấm nút *trên trang đó* mới ghi kết quả.

- **Làm rõ "one-time":** "one-time" = **hành động CHỐT chỉ làm một lần**, KHÔNG phải "mở một lần". Token chỉ bị **đốt khi bấm chốt** (Nộp bài / Xác nhận lịch / Phản hồi offer). Trong lúc còn hạn (TTL), **mở đi mở lại bao nhiêu lần cũng được.**
  * Đang làm quiz dở, đóng nhầm tab → bấm lại link cũ → trang mở lại, nháp khôi phục, làm tiếp.
  * Đã chốt rồi mới mở lại → trang hiện "Đã xử lý, không sửa được" (chỉ xem).
  * Vẫn an toàn: TTL + rate limit + đếm lần truy cập + không submit lại lần hai.

- **TTL theo purpose (cấu hình được):**

| Purpose | TTL gợi ý | Lý do |
|---|---|---|
| QUIZ | 48h | Cửa sổ được vào làm; timer-lượt tính riêng ở server (5.6) |
| SCHEDULE | ~5 ngày | Đủ để UV rảnh là chọn slot (15.3) |
| OFFER_RESPONSE | ~5–7 ngày | Đủ để UV cân nhắc, thương lượng ngoài hệ thống rồi chốt |
| STATUS | dài / tới khi đóng vị trí | UV xem trạng thái lâu dài |

- **Chấm điểm KHÔNG dùng magic link nữa:** interviewer đăng nhập Portal, danh sách buổi được giao hiện ngay sau login (5.7). Không phát link chấm; không có purpose SCORE/APPROVE/OFFER. Quyết tuyển cũng nằm trong Portal (Department Manager — 5.14).

### 5.14 Người quyết tuyển — Department Manager
- **Người quyết tuyển một vị trí = Department Manager (trưởng bộ phận) sở hữu job đó.** Mô hình hóa bằng cột **`Job.department_manager_id → User`** (nullable). Có DM → DM đó quyết ở bước OFFER; **để trống → Recruiter quyết** (job tuyển số lượng lớn không cần trưởng bộ phận duyệt).
- **DM chỉ xuất hiện ở bước OFFER:** mở nhu cầu tuyển rồi giao Recruiter chạy; KHÔNG gác cổng CV, KHÔNG đụng quiz/phỏng vấn. Cả luồng chỉ có **một điểm quyết** — cửa INTERVIEW→OFFER (5.8).
- **Một người có thể vừa là DM vừa chấm phỏng vấn:** nếu DM tham gia buổi PV, chỉ cần gán họ làm interviewer của slot đó (`InterviewSlot.interviewer_id` trỏ về User). Không cần cơ chế riêng.
- **KHÔNG còn cổng duyệt CV riêng và KHÔNG có bảng cấu hình thẩm quyền:** Recruiter tự sàng lọc và chuyển bước (đúng thực tế recruiter gác khúc đầu). "Ai quyết" chỉ là đọc `Job.department_manager_id` ở bước offer — không cần thực thể trung gian.
- **Luận điểm bảo vệ:** ba vai chấm/quyết/thao tác là ba con người khác nhau, rõ ràng và sát cơ cấu thật của doanh nghiệp (trưởng bộ phận mở req và quyết, recruiter vận hành, interviewer chấm).

### 5.15 Offer — OfferDetail + ứng viên tự phản hồi
- **OfferDetail (tối giản):** gắn 1-1 (0..1) với Application. Field: `salary_amount`, `currency`, `start_date`, `status` (PENDING/ACCEPTED/DECLINED), `sent_at`, `responded_at`. Mục đích: state OFFER **có nội dung thật** thay vì nhãn rỗng, và mở KPI **tỉ lệ nhận offer** (offer acceptance rate) — số liệu nghiệp vụ hội đồng thích.
- **KHÔNG làm (giữ scope):** lịch sử thương lượng nhiều vòng, tạo offer letter, ký số. Đó là Core Recruiter — ngoài scope. Một offer / một application; thương lượng diễn ra ngoài hệ thống, Recruiter cập nhật con số cuối.
- **Luồng ra offer:** tại cửa INTERVIEW→OFFER, **Department Manager của job quyết tuyển** (xem điểm/Radar rồi chốt); job không gán DM thì Recruiter quyết. Quyết xong → tạo OfferDetail + Recruiter gửi offer cho ứng viên.
- **Ứng viên tự nhận/từ chối (self-service):** ứng viên nhận magic link `purpose=OFFER_RESPONSE` → trang nhỏ hiện OfferDetail + 2 nút **Đồng ý / Từ chối** → bấm → cập nhật `OfferDetail.status` → đẩy state OFFER→HIRED / →REJECTED. Recruiter không phải nhập tay.
  * Lý do chọn self-service: đồng bộ trải nghiệm ứng viên đầu-cuối (đã tự làm quiz/chọn lịch/xem trạng thái bằng magic link), không phải món lạ. Chi phí thấp: dùng lại khuôn trang SCHEDULE.
  * **`status` của OfferDetail vs `current_state` của Application KHÔNG trùng:** một cái theo dõi artifact offer, một cái theo dõi pipeline; đồng bộ với nhau (`ACCEPTED` ↔ HIRED) chứ không thừa.

---

## 6. QUY TRÌNH NGHIỆP VỤ

**MẢNG 1 — RECRUITMENT:** Recruiter tạo Job + JD (job thuộc một Department Manager, có thể để trống) → ứng viên nộp CV (Career Site) → parse + AI chấm điểm → Recruiter sàng lọc & duyệt CV trực tiếp trên Kanban (không có cổng duyệt riêng).

**MẢNG 2 — INTERVIEW & OFFER:** Quiz (AI gen, Recruiter duyệt — 5.6, anti-cheat) → Phỏng vấn (có thể nhiều vòng — 5.12; PV nhóm/cá nhân tùy Recruiter — 5.9) + Collaborative Scoring (interviewer chấm trong Portal — 5.7) → tại cửa INTERVIEW→OFFER **Department Manager quyết tuyển** (job không có DM → Recruiter quyết — 5.14) → OfferDetail + ứng viên tự nhận/từ chối (OFFER_RESPONSE — 5.15) → HIRED/REJECTED + Dashboard.

---

## 7. FEATURE TREE (9 MODULE)

| Module | Highlight |
|---|---|
| M1. Job Management | Career Site, Job CRUD, Form nộp CV one-page |
| M2. Candidate Pipeline | Kanban, State Machine, Activity Log, Internal Notes |
| M3. AI CV Scoring + Suggestion | Embedding + Vector, chấm điểm, ranking, gợi ý CV (basic) |
| M4. Email Automation | Email trigger theo state machine, template động |
| M5. Quiz Engine + AI | AI Gen (local LLM, MCQ + nút hành động AI), magic link, anti-cheat, 2-stage |
| M6. Collaborative Scoring | Multi-interviewer (login Portal) + radar + Blind Review + CRUD tiêu chí |
| M7. Dashboard & Analytics | Funnel chart, KPI card |
| M8. Multi-tenant & Brand | Cô lập theo company_id (RLS + Global Query Filter), brand theming |
| M9. Auth & Authorization | JWT + RBAC (Admin/Recruiter/Interviewer/Department Manager); candidate magic link |

*(M10 — Interview Scheduling: Section 15.4)*

---

## 8. KẾ HOẠCH 3 THÁNG & MỐC

| Tháng | Mục tiêu |
|---|---|
| T1 (T4) | Auth + RBAC, CRUD Job & Application, Kanban tĩnh, Form nộp CV, ERD + Use Case |
| T2 (T5) | State machine + email, AI chấm điểm, Kanban động, Quiz, Collaborative Scoring, Dashboard |
| T3 (T6-7) | Bug fix, deploy, báo cáo, slide, demo |

**Mốc:** Tuần 5 review scope (report 1-2-3, rủi ro tăng scope → kiểm soát chặt) · Tuần 13-14 Bảo vệ 1.1 · sau đó Bảo vệ 1.2 (ăn điểm).

---

## 9. PHÂN CÔNG TEAM

| Người | Phụ trách |
|---|---|
| FE 1 | Candidate Portal — landing, form CV, trang quiz, status |
| FE 2 | Employer Dashboard — Kanban, chi tiết UV, báo cáo, brand |
| BE 1 | Core API, Auth/JWT, RBAC, Multi-tenant, State Machine, Collaborative Scoring |
| BE 2 | File upload, PDF extract, Email service, Quiz engine |
| BE 3 (tôi) | AI service (Python, Vector), Analytics, tài liệu |

---

## 10. PITCH POINTS / Q&A HỘI ĐỒNG

**HỘI ĐỒNG CHÚ TRỌNG NGHIỆP VỤ — hỏi nhiều, soi kỹ nghiệp vụ, KHÔNG chấm code cao siêu.** Chuẩn bị trả lời sâu về luồng nghiệp vụ + lý do thiết kế.

**Xưng hô (thầy):** KHÔNG "web của chúng em". Nhóm là người **thiết kế & phát triển/vận hành**, không phải chủ. Mô hình = **cung cấp dịch vụ SaaS** (thuê dùng, trả phí), không bán đứt.

- **Vì sao đề tài:** nghiệp vụ sâu, enterprise, không phải CRUD; B2B SaaS ít nhóm chọn; AI có lý do thực tế; scope vừa 3 tháng.
- **Về AI:** Local AI (embedding mã nguồn mở, chạy tại chỗ) + Vector trên SQL Server 2025, không phụ thuộc OpenAI; tự xây logic chấm; đã có PoC chạy thật.
- **AI chấm CV thế nào:** model biến CV/JD thành vector; SQL đo tương đồng bằng VECTOR_DISTANCE; nhóm tự viết công thức ra điểm 0–100. AI chỉ sinh vector, không phải hộp đen.
- **Đối chiếu thực tế — VPBank Young Talents 2026:** phễu V1 loại hồ sơ → SCREENING · V2 test online → QUIZ · V3 PV nhóm + V4 PV cá nhân → INTERVIEW (2 vòng, đúng multi-round 5.12) · V5 → OFFER/HIRED. Một ngân hàng lớn cũng có PV nhóm rồi cá nhân → chứng minh thiết kế của mình sát thực tế. VPBank thuê ngoài nền tảng test (jobtest.vn) — SRIS tự xây quiz engine + anti-cheat.
- **Vì sao interviewer & department manager đăng nhập:** họ là người trong cuộc, cần xem lịch sử buổi đã chấm, sửa điểm đã gửi, xem kết quả để quyết — như các ATS thật (Greenhouse, Lever). Dùng lại JWT đã có. Chỉ ứng viên ẩn danh mới dùng magic link. Blind Review vẫn đảm bảo (submit độc lập, ẩn điểm tới khi nộp).
- **Ba vai tách bạch:** Interviewer chấm (input), Department Manager quyết (chỉ ở bước OFFER), Recruiter vận hành pipeline + sàng lọc CV. Người quyết của job = Department Manager sở hữu job; job không có DM thì Recruiter quyết.
- **Lỡ dev quên company_id thì sao:** *"Hệ thống không tin vào việc lập trình viên nhớ. RLS ở tầng DB tự ép điều kiện cô lập vào mọi câu lệnh; EF Core Global Query Filter tự lọc ở tầng code; có test cô lập chạy tự động."* (5.2)
- **CV có rò rỉ giữa công ty không:** Không — vector search luôn kèm `company_id`, không cross-tenant.
- **Có đề xuất CV không:** Có (gợi ý từ Talent Pool theo vector); nâng cao ngoài scope phase 1, kiến trúc sẵn sàng mở rộng.
- **Chất lượng đề quiz đảm bảo thế nào:** AI sinh đề MCQ ở DRAFT, Recruiter review/sửa/duyệt (có nút gen thêm/gen lại/thêm theo chủ đề) rồi mới phát; AI lo phần thô, con người là cổng chất lượng cuối; thiếu LLM vẫn có fallback Recruiter nhập tay. (5.6)
- **Thời ChatGPT, test online còn ý nghĩa gì:** test tại nhà chỉ để sàng nhanh; điểm thật xác nhận ở vòng onsite có giám sát; hệ thống tự đối chiếu 2 vòng (chênh > 30% → cờ gian lận). (5.5)
- **Phỏng vấn nhiều vòng:** dữ liệu trong stage INTERVIEW (mỗi vòng đặt lịch + chấm riêng), không thêm state, số vòng cấu hình theo job. (5.12)
- **Sao không tích hợp Google Calendar:** hệ thống tự quản lý lịch nội bộ + phát hành .ics chuẩn mở → không khóa cứng nhà cung cấp, không phát sinh chi phí. (15.3)
- **LLM gen quiz deploy ở đâu:** tác vụ chạy nền lúc cấu hình job (không real-time), quiz sinh trước + lưu DB; kiến trúc tách service cho đặt LLM lên máy phù hợp; thiếu LLM vẫn chạy nhờ fallback Recruiter nhập tay.
- **Mở rộng khi dữ liệu lớn:** hiện exact VECTOR_DISTANCE (< 50k vector); vượt ngưỡng → nâng vector index (DiskANN) không đổi thiết kế.
- **PDF scan thì sao:** hệ thống nhận diện PDF scan (không lớp text) → từ chối file không đọc được; OCR là hướng mở rộng.
- **Existing solution:** không so hơn thua, nêu "có tính năng X mà đối thủ (Teamtailor/Calendly/JobTest) không có/không phù hợp" — lấy khoảng trống đối thủ (so Calendly: 15.3; so JobTest: 5.5).

---

## 11. RỦI RO & GIẢM THIỂU

| Rủi ro | Impact | Mitigation |
|---|---|---|
| CV Suggestion phình to | Trung | Ghi rõ giới hạn basic, hỏi thầy |
| Review tuần 5 tăng scope | Cao | Kiểm soát chặt, ghi Limitations & Exclusions |
| Chuyển EF Core tốn công viết lại | Trung | Đổi NGAY giai đoạn đầu; họp nhóm; spike verify (5.11) |
| Vector EF Core 10 còn mới | Trung | Spike verify trước; giữ FromSqlRaw làm cửa thoát |
| Rò rỉ xuyên tenant (quên company_id) | Cao | RLS + Global Query Filter + test cô lập trong CI (5.2) |
| User adoption (kháng cự từ Excel) | Cao | UI/UX mượt, Prototype sớm; ứng viên dùng magic link không cần login |
| PDF extract sai/rỗng | Trung | PdfPig cho PDF text; scan → từ chối file |
| Embedding sai ngoài IT | Trung | Model multilingual general-purpose; test thêm cặp ngoài IT |
| Đổi embedding model phải re-embedding | Trung | Ghi rõ quy tắc; chốt model sớm |
| Gen Quiz LLM chậm | Trung | Làm sau cùng; fallback Recruiter nhập tay; SHOULD-have; nút gen đơn stateless (không chat) |
| Phỏng vấn nhiều vòng bị đẩy scope | Thấp | Ghi rõ mức làm (5.12); hỏi thầy; có bằng chứng VPBank |

---

## 12. FEEDBACK CỦA THẦY (20/05/2026)

**Kỹ thuật:** dùng Local AI (không OpenAI/Gemini, gọi API là mức thấp nhất + tốn tiền) · Python tính AI, .NET quản trị (tách khi cần) · SQL Server 2025 hỗ trợ Vector · cần bảng Cost Analysis.
**Nghiệp vụ:** Phase 3+4 đều là sàng lọc → gộp · cho khách tự chọn tiêu chí (CRUD) · 2 mảng Recruitment + Interview · đề xuất CV → soft in-scope (chờ xác nhận) · rủi ro hội đồng đòi CV nâng cao → kiểm soát.
**Trình bày:** KHÔNG "web của chúng em" · existing solution lấy khoảng trống đối thủ.
**Tài liệu:** thích fishbone · class diagram tham khảo sách giáo trình (không Visual Paradigm) · Limitations & Exclusions thêm rủi ro tăng scope · Report 2 quan trọng Resource (1.1) + kế hoạch test (1.2, SWT) · không khách thật → không Acceptance Test · tham khảo môn SWR.
**CẦN HỎI THẦY:** Đề xuất CV (basic) + phỏng vấn nhiều vòng có in-scope không.

---

## 13. CHO CHAT MỚI — CÁCH DÙNG FILE NÀY

1. Đọc file này TRƯỚC TIÊN. Tham chiếu file khác khi cần (Charter, Business Goals, Stakeholder Matrix, Personas, Feature Tree, 3 Report).
2. **Format:** Markdown table (`|---|`), KHÔNG HTML table · tiếng Việt · vẽ flow → công cụ visualize (SVG) · tài liệu chính thức → file Word, không paste dài.
3. **Lưu ý cốt lõi:**
   - DB **SQL Server 2025**; AI **Local AI + Vector** (không OpenAI); embedding `paraphrase-multilingual-MiniLM-L12-v2` (384 chiều).
   - Tầng DB dùng **EF Core** (`SqlVector<float>` + `EF.Functions.VectorDistance`; cửa thoát `FromSqlRaw`). (5.11)
   - Cô lập tenant: **RLS + Global Query Filter + test** (5.2).
   - **HỘI ĐỒNG CHÚ TRỌNG NGHIỆP VỤ** — ưu tiên làm rõ luồng nghiệp vụ hơn kỹ thuật.
   - Không "web của chúng em"; mô hình **dịch vụ SaaS**, không bán đứt.
   - Tuyển MỌI vị trí, không chỉ IT.
   - **Role (4 login + 1 ẩn danh):** Admin, Recruiter, Interviewer, Department Manager đều đăng nhập Portal; chỉ Candidate dùng magic link. Câu thần chú: **Recruiter lái · Interviewer chấm · Department Manager quyết · Candidate ứng tuyển · Admin dựng sân** (2, 5.10).
   - **Chấm vs quyết (5.7, 5.14):** interviewer chấm trong Portal = input (điểm + note, chấm LIVE, nháp lưu server, sửa được tới khi khóa, xem lịch sử); **Department Manager quyết tuyển — chỉ ở bước OFFER** (`Job.department_manager_id`, để trống → Recruiter quyết); người quyết đọc Radar + std dev; Recruiter thao tác Kanban + sàng lọc CV. Chỉ bàn mồm ở tiêu chí std dev cao. `reject_reason` bắt buộc nhưng 1-chạm (chip preset), nội bộ ≠ email gửi UV. Tiêu chí chấm = per-job.
   - **Token (5.13):** "one-time" = đốt khi CHỐT, không phải khi mở → vào lại được trong TTL; magic link **4 purpose đều của ứng viên** (QUIZ/SCHEDULE/STATUS/OFFER_RESPONSE). Chấm điểm & quyết tuyển nằm trong Portal, không dùng magic link.
   - Web 2 site: Career Site (`/t/{slug}`) + Internal Portal (`/t/{slug}/login`, khu theo role) (5.10).
   - Quiz: **MCQ-only**, JD-based + câu tình huống; Recruiter gen + duyệt (DRAFT→READY) qua **nút hành động AI, không chat**; timer-lượt tách TTL (5.6).
   - Anti-cheat: **công khai ngưỡng** tab-switch + xáo trộn câu/đáp án + đếm màn hình + cross-check 2 vòng; **webcam OUT** (5.5).
   - **KHÔNG có cổng duyệt CV riêng** — Recruiter sàng lọc trực tiếp (5.8). Quyết tuyển ở cửa INTERVIEW→OFFER do Department Manager (để trống → Recruiter). Interviewer chấm trong Portal, Blind Review giữ (5.7). Offer có **OfferDetail** (lương/ngày vào làm/trạng thái); ứng viên tự nhận/từ chối qua `OFFER_RESPONSE` (5.15).
   - Đặt lịch = **1 tính năng**, Recruiter mở khung mời 1 hay nhiều ứng viên; nhóm/cá nhân tùy Recruiter (5.9, 15).
   - Multi-round = dữ liệu trong INTERVIEW, không thêm state (5.12).
   - CV Suggestion + multi-round chờ xác nhận thầy.

### CÁC VIỆC

**Đã xong (PoC chạy thật):** Việc 1 (file này) · Việc 2 (Local AI+Vector) · Việc 3 (PDF extract) · Việc 4 (Gen Quiz AI) · Việc 5 (State Machine). *(data layer viết ADO.NET → migrate EF Core khi nhóm chuyển — 5.11.)*

**Ưu tiên kỹ thuật (mỗi việc 1 chat mới):**
- [ ] Việc 0 (làm trước): spike verify EF Core + `EF.Functions.VectorDistance` trên SQL Server 2025; họp nhóm chuyển EF Core; migrate PoC cũ.
- [ ] Việc 6: Email State Machine (gắn vào Việc 5).
- [ ] Việc 7: Multi-tenant — RLS + Global Query Filter + test cô lập (5.2).

**Tài liệu:** Việc 8: Cost Analysis (chi phí AI = 0đ; chi phí biên thêm 1 tenant ≈ 0). · Việc 9: Cập nhật Business Overview Document.

**Phát sinh:** Việc 10: Interview Scheduling (Section 15) + multi-round (5.12) — làm sau Việc 5-6.
- [ ] Việc 11 (ĐANG NGHIÊN CỨU): Pipeline + prompt gen quiz chất lượng (5.6) — trích skill → blueprint cấp vị trí → gen từng chủ đề + few-shot + câu tình huống + distractor + self-critique. Viết prompt cho từng bước; thử trên qwen2.5 / model nhỏ. KHÔNG chỉ gửi mỗi JD. **Phương pháp đánh giá + 5 bước thực hiện: xem Section 16** (chuẩn bị khung đo → v1 baseline → cải tiến từng version → tổng hợp → báo cáo; chạy → ghi số → mới viết).
- [ ] Việc 12: Thư viện tiêu chí mẫu (template) + ngân hàng câu hỏi đã duyệt (5.6) — schema (thêm bảng gì, audit/nguồn gốc ra sao).
- [ ] Việc 13: CV Suggestion / Talent Pool (3, SẼ LÀM) — đảo chiều vector search trên kho `CvDocument` cũ, kèm `company_id`; gắn vào Feature Tree M3.
- [ ] Deploy Local AI: embedding (nhẹ) lên VPS/cloud chạy thật; LLM quiz chạy nền/batch hoặc model nhỏ (gemma3:4b / qwen2.5:3b), KHÔNG host 24/7 — đưa trade-off RAM/máy vào Cost Analysis (Việc 8).

---

## 14. TIẾN ĐỘ & BÀI HỌC KỸ THUẬT (PoC đã chạy thật)

**Kiến trúc chung:** React → .NET (orchestration) → Python AI Service (sinh vector / gen quiz) + SQL Server 2025 (lưu vector + chấm). .NET là "bộ não"; Python "máy tính toán" stateless không đụng DB/tenant.

**Việc 2 — Local AI + Vector (23/05):** PoC chạy thật end-to-end "text → embedding → vector → điểm 0–100"; ranking đúng (CV .NET > Java > designer); CV trùng JD ~100đ. *Bài học:* chốt model 384 chiều multilingual; quy tắc re-embedding; điểm = (1 - cosine_distance)*100; dùng `127.0.0.1` thay `localhost` trên Windows.

**Việc 3 — PDF extract (24/05):** PdfPig ở .NET (Apache/MIT — tránh iText7 AGPL); `PdfTextExtractor.cs` bóc text theo `GetWords()` (tránh dính chữ CV 2 cột); endpoint `POST /applications/upload` (multipart); hàm chung `ScoreCvAsync`. **File CV gốc lưu trên MinIO** (object storage): `CvDocument` giữ metadata `file_url` (object key, vd `cv/1/12/abc.pdf`) + `file_name`/`file_size`/`mime_type`; DB chỉ lưu text đã bóc + vector, không nhồi binary. 3 loại PDF: có-text → extract · 2-cột → extract được (thứ tự lộn xộn nhưng embedding không nhạy) · scan ảnh → text quá ngắn → `parse_status=FAILED`, từ chối file (không crash). PoC: PDF text → chấm điểm OK; scan → nhận diện đúng; ranking đúng qua đường PDF (.NET 86đ > Java 60đ > designer 21đ). *Bài học (chưa làm):* calibrate điểm bằng "2 mốc neo" (DIST_TOT=100đ, DIST_KEM=0đ) khi có dữ liệu thật; duplicate detection mức 1 (trùng email/SĐT) khi làm Pipeline; OCR out-scope.

**Việc 4 — Gen Quiz AI (25/05):** LLM local qua **Ollama** (cổng 11434), model **qwen2.5**; Structured Output (JSON schema từ Pydantic + `format`, temperature=0); validate + retry 3 lần; fallback Recruiter nhập tay; dọn tiền tố "A) B)" bằng code. Mức A (script): "JD → 10 câu JSON sạch" ~15-20s, đa ngành OK (IT + Kế toán), ~8/10 câu dùng ngay. Mức B (nối hệ thống): Python phục vụ `/embed` + `/generate-quiz`; .NET thêm `POST /jobs/{id}/generate-quiz` + `GET /jobs/{id}/quiz`; bảng `Quizzes` (DRAFT/READY) + `QuizQuestions` (4 phương án JSON). *Bài học:* quiz AI luôn DRAFT → Recruiter review/duyệt → READY (5.6); gen chạy nền không real-time; SHOULD-have; **nút hành động AI = gen đơn stateless (không chat)** — đúng cách model nhỏ chạy tốt. Demo: gen sẵn quiz mẫu + demo live model nhẹ (gemma3:4b) trên laptop; chi phí LLM → Cost Analysis.

**Việc 5 — State Machine:** xem 5.8 (đã hoàn thành PoC).

---

## 15. ĐẶT LỊCH PHỎNG VẤN — CHI TIẾT KỸ THUẬT (thiết kế, chưa code)

**Bối cảnh:** hệ thống tự đặt lịch nội bộ, KHÔNG Google Calendar. Tách 2 bài toán: "chốt mốc thời gian các bên đồng ý" (nghiệp vụ lõi = IN) vs "đẩy lịch vào Google/Outlook" (đồng bộ = OUT). **MỘT tính năng đặt lịch duy nhất** (cơ chế ứng viên chọn/xác nhận slot — Calendly thu nhỏ) vì xóa vòng email qua lại (pain point chị Mai), tái dùng magic link, demo nổi bật.

> **Nhóm hay cá nhân = Recruiter quyết, KHÔNG phải 2 mode kỹ thuật.** Recruiter mở khung rảnh của interviewer thành **pool slot dùng chung**; ứng viên tự chọn, ai chốt trước được trước, slot đặt rồi thì ẩn khỏi người khác (mỗi giờ thật dùng 1 lần → không trùng giờ interviewer). 3 ca: (1) 1 ứng viên chọn trong vài khung; (2) nhiều ứng viên dùng chung pool, first-come-first-served; (3) PV nhóm/panel → cố ý mời nhiều ứng viên vào CÙNG khung. Hệ thống chỉ cần "mở khung + magic link + .ics".

### 15.1 Thứ tự thao tác: KÉO trước, TẠO sau (thủ công)
Card kéo sang Interview TRƯỚC ("cửa quyết định con người": pass quiz KHÔNG tự sang) → mở khóa "Tạo Interview Request" → Recruiter chủ động bấm tạo khi sẵn sàng (KHÔNG popup ép). Trạng thái phụ trên card: chưa có Schedule → PENDING → CONFIRMED.

### 15.2 Token magic link
Cùng cơ chế token, khác `purpose` (QUIZ/SCHEDULE/STATUS/OFFER_RESPONSE — đều của ứng viên). Bảo mật: token 32 byte; **lưu HASH** (không lưu gốc); one-time + TTL; ràng buộc purpose; rate limit; đếm số lần truy cập. (Là pattern ở 5.1/5.13, không xây mới.)

### 15.3 TTL + nhánh hết khung + so sánh Calendly
- TTL link đặt lịch ~5 ngày, **cấu hình được** (Quiz 48h · Đặt lịch ~5 ngày · Status dài). Lọc slot hiển thị = token còn hạn AND slot tương lai AND slot OPEN.
- **Pool slot DÙNG CHUNG, ai chốt trước được trước (first-come-first-served).** Recruiter mở các khung rảnh của interviewer thành bộ slot dùng chung cho nhóm ứng viên đang xét; ứng viên nào chốt một slot trước → slot đó `BOOKED` → **biến mất** khỏi danh sách của ứng viên khác (mỗi giờ thật chỉ bị đặt 1 lần → interviewer không trùng giờ). Recruiter KHÔNG cần chia khung riêng từng người. 3 ca: **(1) 1 ứng viên** — mở vài khung, chọn 1; **(2) nhiều ứng viên, 1 interviewer ít giờ** — pool dùng chung, first-come-first-served, slot đặt rồi thì ẩn; **(3) PV nhóm/panel** — cố ý mời nhiều ứng viên vào CÙNG khung (chủ đích).
- **"Tranh slot" KHÔNG phải lỗi cần né — là hành vi đúng** (thời gian interviewer là tài nguyên giới hạn). Hai ứng viên bấm cùng slot đúng cùng lúc → khóa lạc quan xử lý: `UPDATE InterviewSlot SET status='BOOKED' WHERE slot_id=@s AND status='OPEN'` — chỉ 1 câu ăn dòng (rowcount=1), người kia rowcount=0 → trang báo "khung vừa có người đặt, chọn khung khác". Không hỏng dữ liệu, không cần đăng nhập (token đã gắn hồ sơ; cái bảo vệ là kiểm tra lại lúc chốt, không phải session). Ẩn slot đã đặt theo kiểu **load lại trang là đủ**; auto-refresh real-time là SHOULD.
- **Nhánh hết khung / link hết hạn:** nút "Không khung nào phù hợp" → báo Recruiter mở vòng mới (token cũ chết). Trạng thái `NO_SLOT_FITS`. (Tùy chọn: ô ghi chú UV gợi ý giờ rảnh — không tự khớp lịch.)
- **So Calendly (lấy khoảng trống đối thủ):** Calendly tự đọc calendar thật của interviewer + tự đẩy event → phụ thuộc Google/Outlook API (chính là phần SRIS cố ý OUT). SRIS = "self-scheduling KHÔNG sync calendar", thay tự-đẩy bằng .ics. Số liệu (Calendly Blog — dẫn nguồn khi đưa vào báo cáo): Muck Rack từng tốn 80% thời gian xếp lại lịch, giảm time-to-hire 8 ngày; ~78% nhà tuyển dụng mất ứng viên vì xếp lịch chậm. Nguồn: calendly.com/blog/automate-recruiting-process.

### 15.4 Gợi ý Feature Tree — M10
**MUST:** Interview Request riêng từng ứng viên · magic link SCHEDULE (hash, one-time, TTL) · lọc slot (OPEN + tương lai + token hạn) · chốt slot + khóa + chống trùng · mời 1 hay nhiều ứng viên vào cùng khung (PV nhóm/cá nhân) · xử lý hết khung/hết hạn · trigger từ State Machine (Việc 5) + email (Việc 6) · màn hình Recruiter tạo request · trang ứng viên chọn/xác nhận slot · nút "Không khung phù hợp" · hiển thị giờ + trạng thái trên Kanban.
**SHOULD:** .ics đính kèm · reschedule/cancel thủ công · ô ghi chú gợi ý giờ.
**OUT:** Calendar 2-way sync · dò lịch rảnh interviewer · auto-suggest khung.
**Bảng (kèm company_id):** `InterviewSchedule` (PENDING/CONFIRMED/NO_SLOT_FITS/CANCELLED) · `InterviewSlot` (OPEN/BOOKED/LOCKED). *(Multi-round: thêm `round_number`/`InterviewRound` — 5.12.)*

---

## 16. PHƯƠNG PHÁP ĐÁNH GIÁ AI — GEN QUIZ (áp khung slide môn học)

**Nguồn:** slide môn học (tài liệu chung, KHÔNG riêng SRIS) — khung 4 giai đoạn **Prompt → Test → Đánh giá → Báo cáo**; thông điệp lõi: *"prompt tốt không phải prompt dài/hay, mà là prompt ĐO LƯỜNG và SO SÁNH được"*; mục tiêu cuối = có **bằng chứng khoa học** trong báo cáo để thuyết phục hội đồng (không kết luận bằng cảm giác "AI trả lời hay"). Slide lấy ví dụ **chatbot** — phải DỊCH sang gen quiz, không bê nguyên.

### 16.1 Map khung trường → gen quiz (chỗ lệch quan trọng)
| Mục slide | Chatbot | Gen quiz áp thế nào |
|---|---|---|
| Prompt = business rule mềm + versioning | 1 prompt | Pipeline nhiều prompt (trích skill / gen / self-critique), versioning từng cái |
| Dataset 150–200 + Ground Truth | 150–200 câu user + intent đúng | **Bộ JD test** (~12 JD đa ngành) → ~15 câu/JD ≈ 180 câu gen ra để chấm. "150–200" = tổng câu gen được đánh giá, KHÔNG phải 150 JD |
| Định tính (rubric 3–5 tiêu chí) | Relevance/Clarity… cho câu trả lời | **Rubric riêng cho câu MCQ** (16.3) — TRỤC CHÍNH cho gen quiz |
| Định lượng (Precision/Recall/F1, Confusion Matrix) | Phân loại intent | **KHÔNG ép vào "chất lượng câu quiz"** (generation không có 1 đáp án đúng duy nhất để so → hội đồng vặn "ground truth của câu tự sinh là gì"). Phần này hợp **CV SCORING** hơn (pass/loại theo ngưỡng = phân loại) |
| Đa dạng câu (Baseline/Variation/Edge/Advanced) | Câu user nhiều kiểu | Đa dạng **JD test** (ngành, cấp vị trí) + edge case JD rác/thiếu thông tin |
| Báo cáo so sánh version | Bảng điểm TB v1/v2/v3 + %cải thiện | Y nguyên — bảng version pipeline gen (16.4) |

> **CHỐT:** gen quiz đo bằng **rubric định tính + pass-rate**; **Precision/Recall/F1 để dành cho CV scoring** (đúng bài toán phân loại). Đừng nhét confusion matrix vào chất lượng câu quiz.

### 16.2 "Dataset" & "đo được" cho gen quiz
- **Dataset đầu vào = bộ JD test** (~12 JD: Dev Junior/Senior, Kế toán, Sales, Marketing… + vài JD "xấu" thiếu chi tiết làm edge case). KHÔNG phải bộ câu quiz chuẩn.
- **Đo 2 tầng (vẫn ra số định lượng mà không gượng):**
  * **Tầng tự động** (máy check, khách quan tuyệt đối): % JSON hợp lệ · % câu có đúng 1 đáp án đúng · % câu không trùng · % câu dạng tình huống (không hỏi định nghĩa thuộc lòng). Ra % ngay, so version được.
  * **Tầng rubric** (người chấm bareme 0–5 theo 16.3) → **pass-rate** = % câu đạt ngưỡng (vd ≥4/5). **Pass-rate là con số định lượng chốt — thay vai trò F1 trong báo cáo gen quiz.**

### 16.3 Rubric chấm 1 câu MCQ (mỗi tiêu chí 0–5, chọn 3–5 cái như slide khuyến nghị)
| Tiêu chí | Hỏi gì | 0đ | 5đ |
|---|---|---|---|
| Correctness | Có đúng 1 đáp án đúng? | sai / nhiều đáp án đúng | đúng duy nhất 1 |
| Relevance (bám JD) | Khớp skill trong JD? | lạc đề | đúng skill, đúng trọng tâm |
| Distractor | 3 đáp án sai hợp lý? | lộ liễu, dễ loại | đều hợp lý, dựa lỗi hiểu sai thật |
| Tình huống | Áp dụng hay thuộc lòng? | Google 10s ra | tình huống, hiểu mới làm được |
| Rõ ràng | Rõ chữ, đúng độ khó cấp vị trí? | mơ hồ, sai cấp | rõ, đúng Junior/Senior |
*(Gọn thì lấy 3 cái đầu.)*

### 16.4 Prompt versioning — phần ăn điểm nhất (mỗi version đổi ĐÚNG 1 yếu tố, cùng bộ JD, cùng rubric)
| Version | Đổi gì so với bản trước | Pass-rate kỳ vọng |
|---|---|---|
| v1_baseline | gửi JD → gen 10 câu (1 phát) | thấp (~40%) — mốc gốc |
| v2_skill_extraction | thêm bước trích skill → gen từng skill | tăng |
| v3_fewshot | thêm 1–2 câu mẫu vào prompt gen | tăng |
| v4_situational | ép câu tình huống + ràng buộc distractor | tăng |
| v5_self_critique | thêm lượt AI tự soát rồi sửa | cao nhất |
- Lưu prompt + kết quả mỗi version (Google Sheet/file repo). Bảng này + pass-rate thật = **bằng chứng khoa học** slide đòi. **KHÔNG đổi nhiều yếu tố cùng lúc** (không thì không biết cải tiến từ đâu).

### 16.5 Viết prompt 4 thành phần (slide 3) cho từng bước pipeline (mỗi prompt 1 việc hẹp)
- **Trích skill** — vai: chuyên gia phân tích JD; nhiệm vụ: liệt kê skill cốt lõi; ngữ cảnh: vị trí X cấp Y; đầu ra: JSON `{skill, num_questions}`, không giải thích.
- **Gen câu** — vai: người ra đề MCQ; nhiệm vụ: viết N câu tình huống cho 1 skill; ngữ cảnh: cấp vị trí + 1–2 câu mẫu (few-shot); đầu ra: JSON đúng schema, 4 đáp án, đúng 1 đúng, 3 distractor dựa lỗi hiểu sai thật.
- **Self-critique** — vai: người soát đề; nhiệm vụ: kiểm đúng-1-đáp-án + distractor có lộ + có phải tình huống; đầu ra: câu đã sửa / cờ loại.

### 16.6 CÁC BƯỚC THỰC HIỆN (chạy → ghi số → MỚI viết báo cáo)
1. **Chuẩn bị khung đo (TRƯỚC khi chạy):** bộ JD test + file rubric (16.3) + bảng versioning trống (16.4). Có thước trước khi đo.
2. **Viết prompt v1 baseline** → chạy trên bộ JD → chấm rubric → ghi pass-rate (mốc gốc).
3. **Cải tiến từng version (v2→v5), mỗi lần 1 yếu tố** → chạy lại CÙNG bộ JD → chấm CÙNG rubric → điền bảng.
4. **Tổng hợp:** bảng version đầy số thật → chọn version tốt nhất làm bản chốt.
5. **Viết báo cáo:** lúc này mới viết, vì đã có bảng so sánh version + pass-rate + ví dụ câu tốt/xấu + kết luận version thắng + điểm cần cải thiện (đúng cấu trúc slide 6 "Đánh giá & tổng hợp").
- **Kỷ luật ghi:** ngay từ bước 1, mỗi lần chạy lưu {version, JD, câu gen, điểm rubric, ghi chú}. Tới lúc viết báo cáo, bảng biểu/dẫn chứng nằm sẵn — không phải chạy lại/nhớ lại.
- **Checklist trước nộp (slide 8):** prompt rõ + lưu version · bộ câu đủ lớn/đa dạng · không đánh giá bằng 1–2 câu · tiêu chí có bareme · có Ground Truth/đáp án mong đợi.
