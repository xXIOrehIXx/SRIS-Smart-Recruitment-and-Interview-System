# SRIS — Smart Recruitment and Interview System (Backend)

## Project Overview

ASP.NET Core 10 Web API — hệ thống tuyển dụng và phỏng vấn thông minh.

**Solution:** `GP35.SRIS.sln`  
**Entry point:** `Hosts/GP35.SRIS/`

> Chi tiết nghiệp vụ đầy đủ: `docs/00_CONTEXT.md` (single source of truth — đọc khi làm feature lớn).

## Tech Stack

- .NET 10 / ASP.NET Core 10
- SQL Server 2025 (primary database, compatibility level 170 — kiểu VECTOR)
- MinIO (file/document storage)
- Redis (caching)
- Serilog (logging)
- AutoMapper
- Swashbuckle (Swagger)

> **Không còn vector.** Hạ tầng embedding/VECTOR đã xoá hẳn ở V036 (xem "Business Context" bên dưới).
> SQL Server 2025 vẫn là DB nhưng không tính năng nào dùng kiểu `VECTOR`.

## Solution Structure

​```

Development/backend/
├── Hosts/
│   └── GP35.SRIS/               # Web host (entry point)
├── Src/
│   ├── Application/
│   │   ├── GP35.SRIS.Application/           # Business logic services
│   │   └── GP35.SRIS.Application.Contracts/ # DTOs, interfaces, contracts
│   ├── Domain/
│   │   ├── GP35.SRIS.Domain/                # Entity models
│   │   ├── GP35.SRIS.Domain.Shared/         # Enums, constants, exceptions, extensions
│   │   └── GP35.SRIS.Domain.SqlServer/      # Repositories, UoW, DB config
│   └── Library/
│       ├── GP35.SRIS.Lib/                   # Email, HTTP integrations
│       ├── GP35.SRIS.Cache/                 # Caching extensions
│       ├── GP35.SRIS.Storage/               # Storage abstractions
│       └── GP35.SRIS.Storage.Minio/         # MinIO implementation

​```

## Layer Dependency Rules

- **Domain** must NOT depend on Application or Infrastructure
- **Application** depends on: Domain, Domain.Shared, Application.Contracts
- **HostBase** depends on: Application, Lib, Storage
- **Web Host** depends only on: HostBase

## Build & Run

```bash
dotnet restore
dotnet build
dotnet run --project Hosts/GP35.SRIS   # cần SQL Server + MinIO chạy sẵn
```

## Key Patterns

### Service Pattern
```csharp
public class XxxService : BaseService<XxxService>, IXxxService
{
    private readonly IXxxRepo _xxxRepo;

    public XxxService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _xxxRepo = serviceProvider.GetRequiredService<IXxxRepo>();
    }
}
```

### Repository
- Located in `Domain.SqlServer/Repos/`
- `BusinessUow` manages transactions

### Authentication
- Token-based via `AuthMiddleware` → populates `IContextData` (scoped)
- Services inject `IContextData` to access current user

### Permissions
- Constants in `PermissionConstants`
- Controllers: `[WithPermission(PermissionConstants.Xxx)]`, enforced by `PermissionMiddleware` after auth

### Error Handling
- Lỗi nghiệp vụ: ném `BaseException` (đặt `ErrorCode` / `ErrorMessage` / `HttpStatus`) →
  `ConfigureExceptionHandler()` bọc thành `ErrorObjectCommon`, body camelCase:
  `{ errorCode, devMsg, userMsg, moreInfo, traceId, validationFailures }`.
  FE đọc `error.response.data.userMsg`.
- `AuthMiddleware` trả cùng dạng body đó cho 401/403.
- Validate model: KHÔNG có attribute riêng — dùng `[ApiController]` mặc định của ASP.NET,
  trả `ValidationProblemDetails` (`{ errors: {...} }`, System.Text.Json camelCase), KHÁC dạng
  trên. Client cần đọc lỗi field thì bắt theo `errors`.

## Coding Conventions

- PascalCase for all C# identifiers and DB column names
- `async/await` for all I/O-bound operations
- Logging: `_logger.Here()` for caller context
- Config: `InitConfig<T>()` where T inherits `DefaultConfig`
- Controllers: `[ApiController]` + `[Route("api/[controller]s")]`
- All DI registrations in `HostBase/Extensions/ServiceCollectionExtensions.cs`

## JSON Serialization

- API responses: `System.Text.Json` (camelCase)
- Error responses: `Newtonsoft.Json` via `ErrorObjectCommon.ToString()` — cũng camelCase
  (ép bằng `CamelCasePropertyNamesContractResolver`; mặc định của Newtonsoft là PascalCase,
  để nguyên thì FE đọc `data.userMsg` ra undefined và nuốt mọi thông báo lỗi của BE)
- Hai bộ serializer cùng tồn tại nhưng CÙNG camelCase — client chỉ cần biết 1 quy ước

---

## Business Context (tóm tắt — chi tiết ở docs/00_CONTEXT.md)

Hệ thống SaaS ATS multi-tenant, tuyển MỌI vị trí (không chỉ IT).
**Target (chốt hậu-hội-đồng 07/2026): công ty nhỏ ≤200 nhân sự + công ty gia đình.**
Nguyên tắc thiết kế: **đơn giản là mặc định, phức tạp là tùy chọn.**

> **MODULE QUIZ ĐÃ LOẠI HOÀN TOÀN KHỎI SCOPE (07/2026)** — cả quiz nhập tay lẫn AI gen
> (docs Section 3 OUT). Không thiết kế, không code, không tài liệu gì thêm cho quiz.

### Roles (5 login + 1 ẩn danh — mỗi user 1 role; công ty nhỏ dùng 1 tài khoản Admin)
- `Admin` / **Human Resource** / `Interviewer` / `DepartmentManager` / `Director` → đăng nhập Portal (JWT)
  - ⚠️ Human Resource: tên gọi mới (khớp báo cáo). GIÁ TRỊ trong `User.role` + JWT vẫn là `'Recruiter'`
    — xem `RoleConstants.HumanResource` / `ROLES.HUMAN_RESOURCE`. URL Portal: `/human-resource/*`.
- `Candidate` → **magic link only**, không có account, không có User row
- `Director` (**Giám đốc**, V043 — chốt 15/08/2026): người DUY NHẤT quyết tuyển. Phạm vi toàn công ty,
  không gán theo job. URL Portal: `/director/*`.
- Câu thần chú: Human Resource lái · Interviewer chấm · DM ra đề + chọn người gặp (và chọn ai gặp) + ĐỀ XUẤT ·
  **Giám đốc quyết tuyển** · Candidate ứng tuyển · Admin dựng sân

### Pipeline: 6 state nội bộ, hiển thị 4 PHA
NEW → SCREENING → INTERVIEW → OFFER → HIRED / REJECTED (8 transition)  
Forward-only. Reject từ bất kỳ state nào → REJECTED (`reject_reason` TÙY CHỌN — chốt 02/08/2026, không ép nhập nữa).  
Người dùng trong công ty thấy **4 pha** (nhãn đổi 17/08/2026 để tên pha khớp NGƯỜI SỞ HỮU pha đó):
**Tiếp nhận & sàng lọc** (NEW — nhân sự đọc CV, loại hồ sơ không đạt) · **Chờ Trưởng bộ phận duyệt** (SCREENING — DM chọn ai đi phỏng vấn) · **Phỏng vấn** (INTERVIEW) · **Quyết định** (OFFER→HIRED/REJECTED).
Tên cũ "Hồ sơ mới / Sàng lọc" gây hiểu nhầm rằng việc sàng lọc nằm ở pha 2, trong khi pha 2 là lúc hồ sơ ĐÃ qua tay nhân sự.
Nhãn dùng chung ở FE `components/ApplicationStateTag.jsx` — **đừng khai lại bảng nhãn trong từng màn** (đã có 3 bản sao trôi khỏi bản gốc).
Trang trạng thái của ỨNG VIÊN giữ bộ nhãn RIÊNG, trung tính ("Đã nhận hồ sơ / Đang xem xét / Phỏng vấn / Kết quả") — ứng viên không cần biết hồ sơ đang nằm trên bàn ai. 6 state vẫn là chuyện nội bộ.

### Luồng tiêu chí (trục xuyên suốt — 5.17, 5.18)
DM tạo Yêu cầu tuyển dụng (tùy chọn) → **Giám đốc duyệt yêu cầu** (V047) → Human Resource tạo Job
→ AI bóc tiêu chí `DRAFT` → người duyệt chốt → **bộ tiêu chí đó là phiếu chấm phỏng vấn**
(interviewer chấm, 5.7).

**V052 (24/08/2026) — Trưởng bộ phận RA ĐỀ tiêu chí.** Màn Tiêu Chí (`/criteria`) mở cho cả DM:
họ bấm AI bóc tiêu chí, sửa/thêm/gỡ dòng, chốt bộ tiêu chí và áp khuôn mẫu — nhưng **chỉ trên
vị trí `Job.department_manager_id` = chính họ** (`JobCriteriaAccessGuard`, Admin bypass). Nhân sự
giữ nguyên quyền cũ (công ty nhỏ hay nhờ nhân sự nhập hộ). Thư viện khuôn mẫu cấp company thì DM
chỉ ĐỌC + áp vào job, không sửa/ẩn — khuôn dùng chung cả công ty.
Thư viện có sẵn 9 khuôn dựng sẵn (`CriteriaTemplateDefaults`, nạp lần đầu công ty mở màn Tiêu Chí
— cùng khuôn với `EmailTemplateDefaults`), trải các nhóm vị trí công ty nhỏ hay tuyển chứ không
riêng IT.

> **SÀNG LỌC CV BẰNG AI QUAY LẠI SCOPE (chốt 16/08/2026 — V044).** Ở màn chi tiết ứng
> viên, người tuyển dụng bấm một nút để AI đọc CV và đối chiếu với tin tuyển dụng: tóm
> tắt CV, liệt kê yêu cầu **đạt** (kèm câu trích nguyên văn từ CV) / **thiếu**, mức phù
> hợp 0-100 và đề xuất `PROCEED`/`CONSIDER`/`REJECT`.
>
> Ranh giới phải giữ: đề xuất là **THAM KHẢO**. Không đường code nào đọc `decision` rồi
> tự đổi `current_state`.
>
> **Cập nhật V046 (17/08/2026):** điểm phù hợp GIỜ lên danh sách và xếp được thứ tự
> (`?sort=fit`) — hội đồng yêu cầu giữ tính năng "phân loại/chấm điểm hồ sơ". Nó quyết định
> THỨ TỰ ĐỌC của người tuyển dụng, không quyết định ai đi tiếp. Xem mục 7 "Coding Rules".
> Cách làm mới KHÔNG phải cách cũ đã cắt 08/08/2026: bản cũ chấm điểm bằng vector cho
> mọi hồ sơ tự động; bản này là LLM đọc hiểu, chạy theo yêu cầu của người dùng, và luôn
> phải trích dẫn được câu trong CV thì mới được tính là đạt.
>
> **TALENT POOL vẫn OUT (08/08/2026).** Không thiết kế, không code lại.
>
> **HẠ TẦNG VECTOR VẪN XOÁ HẲN (V036).** Không còn `CvChunk`, không còn cột `embedding`
> ở Job/CvDocument/EvaluationCriteria, không còn `IEmbeddingClient` / endpoint `/embed`.
> Sàng lọc CV ở V044 là LLM đọc hiểu, KHÔNG phải so vector — đừng thêm lại vector.

### AI Service (Python FastAPI — port riêng)
- .NET **không gọi AI trực tiếp** — chỉ gọi qua HTTP nội bộ đến Python service
- Python stateless, không đụng DB, không biết tenant
- Ba endpoint, model đổi độc lập qua env, `temperature=0`, output ràng buộc bằng
  JSON schema + validate Pydantic + retry 3 lượt. Lỗi → HTTP 502.
  - **`/extract-criteria`** — bóc tiêu chí từ JD. Model `SRIS_LLM_MODEL` (mặc định `qwen2.5`).
  - **`/screen-cv`** — đối chiếu CV với JD. Model `SRIS_CV_MODEL` (mặc định `qwen3:8b`);
    bài này bắt model đọc hai văn bản dài rồi kết luận nên cần model khá hơn hẳn việc kia.
  - **`/summarize-panel`** (V047) — gom các phiếu chấm phỏng vấn của một ứng viên thành
    đồng thuận / mâu thuẫn / câu hỏi còn bỏ ngỏ. Model `SRIS_PANEL_MODEL` (mặc định = model
    bóc tiêu chí: đầu vào là vài đoạn nhận xét ngắn). **KHÔNG kết luận tuyển/không tuyển.**
- **Cả ba chạy NỀN,** cùng một khuôn (xếp hàng → `202` → worker → FE hỏi lại tới khi
  `running=false`). Lý do: Local LLM trên CPU mất hàng chục giây — gọi đồng bộ là axios (30s)
  cắt ngang trong khi backend vẫn đang chạy.
  - V037: `POST /api/jobs/{id}/criteria/extract` → bảng `CriteriaExtraction` → `CriteriaExtractionWorker`
    → `GET .../criteria/extract-status`.
  - V044: `POST /api/applications/{id}/cv-screening` → bảng `CvScreening` → `CvScreeningWorker`
    → `GET .../cv-screening`.
  - V047: `POST /api/applications/{id}/panel-summary` → bảng `PanelSummary` → `PanelSummaryWorker`
    → `GET .../panel-summary`.
  - Ba worker TÁCH RIÊNG, không gộp: mỗi hàng đợi chạy hết một mạch với đúng một model, xen kẽ
    trong một vòng lặp là bắt Ollama nạp/đuổi model liên tục.

### Magic link purposes (chỉ của Candidate)
`STATUS` · `OFFER_RESPONSE` (2 purpose — QUIZ loại 07/2026, **SCHEDULE loại 15/08/2026**)  
Lưu **hash** token (SHA-256), không lưu gốc. "One-time" = đốt khi CHỐT, không phải khi mở.

### Đặt lịch phỏng vấn (viết lại 15/08/2026)
KHÔNG còn pool khung dùng chung cho ứng viên tự chọn. Bộ phận nhân sự gọi cho người phỏng vấn
hỏi lịch rảnh, gọi ứng viên chốt giờ, rồi NHẬP buổi (`POST /api/applications/{id}/interviews`).
Hệ thống chống trùng giờ + gửi email xác nhận kèm .ics. Lưu trữ giữ nguyên hình dạng cũ
(pool 1 khung CLOSED + slot BOOKED + schedule CONFIRMED) nên phiếu chấm không phải đổi.
Lý do bỏ: chờ ứng viên bấm link chậm hơn một cuộc gọi.

**Sửa buổi đã chốt (24/08/2026):** `PUT /api/interview-schedules/{id}` — nhân sự dời giờ / đổi
người phỏng vấn / đổi tên vòng NGAY TRÊN buổi đó (`SchedulingRepo.RescheduleAsync`), chạy lại đủ
bộ luật của lúc đặt (hồ sơ còn ở INTERVIEW, panel nằm trong danh sách DM chỉ định, giờ ở tương
lai, không trùng — có loại trừ chính buổi đang sửa) rồi gửi lại email xác nhận kèm .ics.
`schedule_id` GIỮ NGUYÊN: hủy-rồi-đặt-lại làm ứng viên nhận thư báo hủy và bỏ mồ côi phiếu chấm
đã lưu của buổi cũ, chỉ để đổi một con số giờ. Vòng (`round_number`) không sửa được — muốn bỏ hẳn
một vòng thì hủy buổi.

**V045 (16/08/2026) — nhân sự chốt GIỜ, Trưởng bộ phận chốt NGƯỜI.** Panel không còn là
dropdown toàn công ty: DM chỉ định ai được gặp từng ứng viên (bảng `ApplicationInterviewer`),
nhân sự đặt buổi chỉ chọn được trong danh sách đó. Chỉ định đi KÈM hành động duyệt vào vòng
phỏng vấn (`POST .../transition` nhận thêm `interviewerIds`); sửa sau bằng
`PUT /api/applications/{id}/interviewers` (chỉ DM của job, Admin bypass).
Bảng KHÔNG có `round_number` — đây là "ai ĐƯỢC PHÉP gặp người này", mỗi buổi lấy một tập con.

### Người quyết (cập nhật 15/08/2026 — sau bảo vệ hội đồng)
Hai cửa có người gác, HAI người KHÁC NHAU:
1. `SCREENING→INTERVIEW` — **Trưởng bộ phận phụ trách vị trí** (`Job.department_manager_id`)
   chọn ai được vào vòng phỏng vấn **và ai sẽ phỏng vấn người đó** (V045). Job chưa gán DM thì
   KHÔNG ai đi qua cửa này (403, kể cả HR) — vì thế đăng tin (Status=Open) bắt buộc có DM.
2. `INTERVIEW→OFFER` + rời OFFER — **GIÁM ĐỐC** quyết tuyển (phạm vi toàn công ty). DM KHÔNG
   đủ thẩm quyền: họ gửi **phiếu Đề xuất tuyển** (`HiringProposal`, V043), Giám đốc duyệt —
   chính hành động duyệt đó đẩy hồ sơ sang OFFER kèm **mức lương đã chốt**.
   Không duyệt ≠ loại ứng viên: hồ sơ ở lại INTERVIEW, DM đề xuất lại được.
   **Giám đốc quyết TIỀN, không quyết NGÀY (V051 — 24/08/2026):** `proposed_start_date` /
   `approved_start_date` đã xoá khỏi phiếu đề xuất. Ngày vào làm là kết quả một cuộc gọi giữa
   nhân sự và ứng viên (ứng viên còn phải báo trước cho chỗ cũ), nên nó được nhập ở THƯ MỜI
   (`OfferDetail.start_date`). Đừng thêm lại: bắt DM đoán ngày từ trước cả tuần thì duyệt muộn
   vài ngày là ngày rơi vào quá khứ và chính hệ thống chặn không cho duyệt.

Human Resource sàng lọc (`NEW→SCREENING`), **đặt lịch** (và sửa lịch) cho người đã duyệt, soạn
thư mời theo điều khoản Giám đốc chốt — không chọn người, không quyết. **Ô lương trong thư mời
KHOÁ** khi hồ sơ đã qua đề xuất tuyển: `MakeOfferAsync` lấy `ApprovedSalary` của Giám đốc, bỏ qua
số client gửi lên (FE cũng disable ô đó). Ngày vào làm thì ngược lại — chỗ đó mới là việc của
nhân sự. Đặt lịch đòi hồ sơ ĐÃ ở INTERVIEW.
Interviewer chỉ chấm (input). Admin bypass cả hai cửa.
DM đứng BA chốt: ra đề (Yêu cầu tuyển dụng — 5.17) · chọn người gặp · đề xuất tuyển.

---

## Coding Rules bắt nguồn từ nghiệp vụ (BẮT BUỘC tuân thủ)

1. **Multi-tenant:** mọi bảng có `company_id`. KHÔNG BAO GIỜ query thiếu cột này.
   RLS được ép ở tầng DB qua `SESSION_CONTEXT('CompanyId')` — phải set lại
   **đầu MỖI request** (bẫy connection pooling). Quên = rò dữ liệu xuyên tenant.

2. **State machine guard:** INTERVIEW→OFFER cần G2 (≥1 phiếu chấm `status='SUBMITTED'`).
   Check guard trước khi transition. (G1 không còn — thuộc nhánh quiz đã loại; giữ tên G2 khớp tài liệu cũ.)
   Ngoài guard dữ liệu còn **guard NGƯỜI** (`EnsureCanDecideAsync`). Ranh giới là chữ **TUYỂN**:
   "đồng ý tuyển" là của Giám đốc, "đóng hồ sơ không tuyển" thuộc về người đã trực tiếp xét ứng
   viên ở chặng đó (siết 17/08/2026).
   - `NEW→SCREENING` và `NEW→REJECTED`: **nhân sự**, không gác. Sàng lọc vòng đầu là việc của họ
     (hồ sơ trùng, nộp nhầm vị trí, thiếu yêu cầu cứng) — siết cả chặng này là bắt DM đọc từng
     hồ sơ rác, đúng thứ sản phẩm định giải phóng cho họ.
   - `SCREENING→INTERVIEW`, `SCREENING→REJECTED`, `INTERVIEW→REJECTED`: **DM của job**
     (Giám đốc cũng qua — cấp trên, phạm vi toàn công ty).
   - `INTERVIEW→OFFER` + mọi đường rời OFFER: **CHỈ Giám đốc**.

   Trước 17/08/2026 MỌI đường sang REJECTED lọt qua guard không kiểm ai bấm — cửa "đồng ý" khoá
   còn cửa "loại" mở toang, tức nhân sự vẫn lọc được hồ sơ một mình. Đừng mở lại: đó đúng là
   điều hội đồng phê ("nhân sự không được quyền phê duyệt hồ sơ ứng tuyển").

   Cũng đừng siết ngược lại thành "Giám đốc gác cả `INTERVIEW→REJECTED`" (bản nháp đầu ngày
   17/08 làm vậy rồi bỏ): tuyển 1 người trong 20 là Giám đốc phải bấm đóng 19 hồ sơ, mà chẳng
   kiểm soát thêm được gì — DM vốn đã phủ quyết được bằng cách không gửi Đề xuất tuyển.
   Ứng viên từ chối thư mời đi bằng cờ `isCandidateAnswer`, KHÔNG qua guard — chặn nhầm đường
   này là ứng viên bấm "từ chối" trong email thì ăn 403.
   FE có bản sao luật ở `utils/decisionRights.js` (chỉ để ẩn nút, backend mới chặn thật).
   Đường nào tự đẩy state hộ người dùng (`AdvanceToAsync`) phải kiểm quyền CẢ chặng TRƯỚC khi
   đi bước đầu — nếu không hồ sơ nhảy một nấc rồi mới báo 403.
   V045: panel của buổi phải nằm TRỌN trong `ApplicationInterviewer` của hồ sơ
   (`EnsureInterviewersAssignedAsync`). Đừng nới thành "gợi ý" — danh sách chỉ chặn được khi nó
   là ràng buộc, và nới ra là trả quyền chọn người về cho nhân sự.

3. **Multi-round interview = DỮ LIỆU trong state INTERVIEW** (`InterviewSchedule.round_number`),
   KHÔNG thêm state INTERVIEW_1/_2. Sơ đồ 6 state/8 transition giữ nguyên.

4. **Tiêu chí (EvaluationCriteria):** AI bóc → `DRAFT` → người duyệt chốt. AI KHÔNG quyết tiêu chí.
   Người được ghi vào bộ tiêu chí của một vị trí: nhân sự (toàn công ty) + **Trưởng bộ phận phụ
   trách ĐÚNG vị trí đó** (V052) + Admin. Guard nằm ở `JobCriteriaAccessGuard`, dùng chung cho
   CRUD tiêu chí / bóc AI / duyệt / áp khuôn — đừng gác bằng mỗi `[WithRole]`, attribute chỉ biết
   role chứ không biết vị trí này của bộ phận nào. ĐỌC thì để mở (Giám đốc, DM khác cùng nhìn khi
   bàn về ứng viên).
   Tiêu chí đã duyệt dùng cho phiếu chấm phỏng vấn. Một tiêu chí CHỈ CÒN `name` + `weight` +
   `max_score` — `criteria_type` (HARD/SOFT), `cv_matchable`, `keywords` đã xoá hẳn ở V038
   (mô hình dữ liệu của máy chấm CV, chết theo tính năng). Đừng thêm lại.
   Prompt chỉ bóc thứ PHẢI HỎI MỚI BIẾT: bằng cấp/chứng chỉ/bằng lái không lên phiếu chấm,
   vì người tuyển dụng đã đối chiếu ở bước sàng lọc và không ai cho điểm 0-10 dòng "có bằng B2".
   Lượt bóc chạy NỀN: `RequestExtractAsync` chỉ xếp hàng, `RunExtractionAsync` (worker gọi)
   mới chạy thật và TỰ đóng trạng thái DONE/FAILED — không được để nó ném lỗi ra ngoài,
   vì dòng hàng đợi kẹt `RUNNING` là lượt bóc treo vĩnh viễn dưới mắt người dùng.

5. **Blind Review (InterviewScore):** điểm/note ẩn cho tới khi `status='SUBMITTED'`.
   Query lộ điểm trước submit = phá blind review. (Blind chỉ tự bật khi job có >1 interviewer — 5.7.)

6. **OfferDetail:** 0..1 per Application (UNIQUE `application_id`). Một offer / một application.

7. **Sàng lọc CV (CvScreening, V044 + xếp hạng V046):** AI đề xuất, KHÔNG quyết.
   `CvScreeningService` không được gọi `IApplicationStateService` và không được đụng
   `current_state` — ai định nối "REJECT → tự chuyển hồ sơ sang REJECTED" là đang biến gợi ý
   của model thành quyết định nghiệp vụ. Mỗi mục "đạt" phải kèm `evidence` trích từ CV; không
   trích được thì xếp xuống "thiếu".
   **V046 (17/08/2026) — `fit_score` ĐƯỢC lên danh sách và ĐƯỢC dùng xếp thứ tự.** Đảo lại luật
   cũ ("chỉ hiện trong hồ sơ một người"), theo yêu cầu hội đồng: *"AI vẫn duy trì tính năng phân
   loại hồ sơ, chấm điểm hồ sơ"*. `GET /api/jobs/{id}/applications?sort=fit` đưa hồ sơ khớp nhất
   lên đầu; hồ sơ **chưa phân tích xếp CUỐI, không phải điểm 0** — gộp "chưa chấm" với "chấm
   thấp" là đổ oan cho hồ sơ chưa ai đọc.
   Ranh giới còn lại phải giữ: điểm quyết định **THỨ TỰ ĐỌC**, không quyết định ai đi tiếp.
   Trên UI luôn hiện kèm chữ (`Nên mời`/`Cân nhắc`/`Ít phù hợp`), không để con số đứng trần như
   điểm thi, và `REJECT` để màu xám chứ không phải đỏ — đỏ đọc như "đã loại", mà AI không loại
   được ai.
   Chấm hàng loạt (`POST /api/jobs/{id}/cv-screening`) là **nút người dùng bấm**, KHÔNG chạy tự
   động khi nhận CV: mỗi lượt bắt Local LLM đọc hai văn bản dài, nổ hàng chục lượt sau lưng người
   dùng là treo máy demo. Đây cũng là chỗ khác bản đã cắt 08/08/2026 (vector, tự chấm mọi hồ sơ).
   Điểm chỉ so được TRONG một vị trí — mỗi lượt đối chiếu với đúng một JD, đừng xếp hạng xuyên job.
   Chất lượng phụ thuộc `PdfTextExtractor`: nó phải bóc text theo ĐÚNG THỨ TỰ ĐỌC
   (Docstrum + reading-order của PdfPig). Bản trước cố ý vứt thứ tự vì text chỉ dùng cho
   embedding — đó chính là lý do tính năng tóm tắt CV ở V033 chết ngay ở V034. Đừng "tối ưu"
   nó về lại `page.GetWords()` nối bằng dấu cách.

8. **Tổng hợp ý kiến hội đồng (PanelSummary, V047):** AI đọc các phiếu chấm ĐÃ NỘP rồi trả
   đồng thuận / mâu thuẫn / câu hỏi còn bỏ ngỏ — **không có trường kết luận tuyển**, và
   `PanelSummaryService` không đụng `current_state`. Đừng thêm "AI đề xuất tuyển" vào đây:
   người quyết là DM (đề xuất) và Giám đốc (quyết) — V043.
   Nguồn dữ liệu là `GetDecisionBriefAsync`, tức chỉ phiếu `SUBMITTED` — giữ nguyên đường này
   để BLIND REVIEW không bị phá (nháp của người khác không được lọt vào prompt).
   Interviewer KHÔNG đọc bản tổng hợp: nó gộp ý kiến cả panel, cho họ xem là phá blind ở vòng sau.

9. **Xuất Excel danh sách ứng viên (V047):** `GET /api/jobs/{id}/applications/export` (ClosedXML).
   Hồ sơ CHƯA phân tích để TRỐNG ô điểm, không ghi 0 — cùng luật với xếp hạng ở mục 7.
   Bảng nhãn 4 pha trong `ApplicationQueryService.StateLabel` là BẢN SAO của
   FE `components/ApplicationStateTag.jsx` (file do backend sinh nên không dùng lại được).
   Sửa nhãn thì sửa cả hai chỗ.

> Khi đụng feature lớn (tiêu chí, chấm phỏng vấn, scheduling), đọc section tương ứng
> trong `docs/00_CONTEXT.md` (tiêu chí → 5.17/5.18, chấm phỏng vấn → 5.7, scheduling → Section 15).
> Phần mô tả chấm CV bằng vector / Talent Pool trong docs là hồ sơ thiết kế CŨ đã cắt
> 08/08/2026 — KHÔNG phải mô tả tính năng sàng lọc CV hiện tại (V044, LLM đọc hiểu, người
> bấm mới chạy, chỉ đề xuất). Đọc khối "CHỐT 08/08/2026" ở đầu Section 3 rồi đọc tiếp mục 7
> trong "Coding Rules" ở trên trước khi tin bất cứ dòng nào nói hệ thống chấm điểm CV.