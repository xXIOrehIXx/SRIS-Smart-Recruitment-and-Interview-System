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
- Câu thần chú: Human Resource lái · Interviewer chấm · DM ra đề + chọn người gặp + ĐỀ XUẤT ·
  **Giám đốc quyết tuyển** · Candidate ứng tuyển · Admin dựng sân

### Pipeline: 6 state nội bộ, hiển thị 4 PHA
NEW → SCREENING → INTERVIEW → OFFER → HIRED / REJECTED (8 transition)  
Forward-only. Reject từ bất kỳ state nào → REJECTED (`reject_reason` TÙY CHỌN — chốt 02/08/2026, không ép nhập nữa).  
Người dùng thấy **4 pha**: Hồ sơ mới (NEW) · Sàng lọc (SCREENING) · Phỏng vấn (INTERVIEW) · Quyết định (OFFER→HIRED/REJECTED). 6 state là chuyện nội bộ, không phơi ra UI/tài liệu.

### Luồng tiêu chí (trục xuyên suốt — 5.17, 5.18)
DM tạo Yêu cầu tuyển dụng (tùy chọn) → Human Resource tạo Job → AI bóc tiêu chí `DRAFT` →
người duyệt chốt → **bộ tiêu chí đó là phiếu chấm phỏng vấn** (interviewer chấm, 5.7).

> **SÀNG LỌC CV BẰNG AI + TALENT POOL ĐÃ LOẠI KHỎI SCOPE (chốt 08/08/2026).**
> Hệ thống KHÔNG chấm điểm / xếp hạng ứng viên: bỏ cả điểm tổng JD↔CV lẫn chấm CV
> theo từng tiêu chí, bỏ Talent Pool. Không thiết kế, không code, không tài liệu gì
> thêm cho việc máy chấm CV. Nhận hồ sơ = `CvIntakeService` (parse PDF + lưu, không chấm).
>
> **HẠ TẦNG VECTOR ĐÃ XOÁ HẲN (V036).** Không còn `CvChunk`, không còn cột `embedding`
> ở Job/CvDocument/EvaluationCriteria, không còn `IEmbeddingClient` / endpoint `/embed`.
> AI của hệ thống chỉ còn ĐÚNG MỘT đường: bóc tiêu chí từ JD. Đừng thêm lại vector cho
> tính năng nào mà chưa có quyết định mở lại scope.

### AI Service (Python FastAPI — port riêng)
- .NET **không gọi AI trực tiếp** — chỉ gọi qua HTTP nội bộ đến Python service
- Python stateless, không đụng DB, không biết tenant
- Endpoint DUY NHẤT: **`/extract-criteria`** (Ollama `qwen2.5`, `temperature=0`, output ràng buộc
  bằng JSON schema + validate Pydantic + retry 3 lượt). Lỗi → HTTP 502.
- **Chạy NỀN (V037):** `POST /api/jobs/{id}/criteria/extract` chỉ xếp hàng rồi trả `202`;
  `CriteriaExtractionWorker` nhặt việc, gọi AI, ghi kết quả vào bảng `CriteriaExtraction`.
  FE hỏi `GET .../criteria/extract-status` tới khi `running=false`.
  Lý do: Local LLM trên CPU mất hàng chục giây — gọi đồng bộ là axios (30s) cắt ngang
  trong khi backend vẫn đang chạy.

### Magic link purposes (chỉ của Candidate)
`STATUS` · `OFFER_RESPONSE` (2 purpose — QUIZ loại 07/2026, **SCHEDULE loại 15/08/2026**)  
Lưu **hash** token (SHA-256), không lưu gốc. "One-time" = đốt khi CHỐT, không phải khi mở.

### Đặt lịch phỏng vấn (viết lại 15/08/2026)
KHÔNG còn pool khung dùng chung cho ứng viên tự chọn. Bộ phận nhân sự gọi cho người phỏng vấn
hỏi lịch rảnh, gọi ứng viên chốt giờ, rồi NHẬP buổi (`POST /api/applications/{id}/interviews`).
Hệ thống chống trùng giờ + gửi email xác nhận kèm .ics. Lưu trữ giữ nguyên hình dạng cũ
(pool 1 khung CLOSED + slot BOOKED + schedule CONFIRMED) nên phiếu chấm không phải đổi.
Lý do bỏ: chờ ứng viên bấm link chậm hơn một cuộc gọi.

### Người quyết (cập nhật 15/08/2026 — sau bảo vệ hội đồng)
Hai cửa có người gác, HAI người KHÁC NHAU:
1. `SCREENING→INTERVIEW` — **Trưởng bộ phận phụ trách vị trí** (`Job.department_manager_id`)
   chọn ai được vào vòng phỏng vấn. Job chưa gán DM thì KHÔNG ai đi qua cửa này (403, kể cả
   HR) — vì thế đăng tin (Status=Open) bắt buộc có DM.
2. `INTERVIEW→OFFER` + rời OFFER — **GIÁM ĐỐC** quyết tuyển (phạm vi toàn công ty). DM KHÔNG
   đủ thẩm quyền: họ gửi **phiếu Đề xuất tuyển** (`HiringProposal`, V043), Giám đốc duyệt —
   chính hành động duyệt đó đẩy hồ sơ sang OFFER kèm mức lương + ngày vào làm đã chốt.
   Không duyệt ≠ loại ứng viên: hồ sơ ở lại INTERVIEW, DM đề xuất lại được.

Human Resource sàng lọc (`NEW→SCREENING`), **đặt lịch** cho người đã duyệt, soạn thư mời theo
điều khoản Giám đốc chốt — không chọn người, không quyết. Đặt lịch đòi hồ sơ ĐÃ ở INTERVIEW.
Interviewer chỉ chấm (input). Admin bypass cả hai cửa.
DM đứng BA chốt: ra đề (Yêu cầu tuyển dụng — 5.17) · chọn người gặp · đề xuất tuyển.

---

## Coding Rules bắt nguồn từ nghiệp vụ (BẮT BUỘC tuân thủ)

1. **Multi-tenant:** mọi bảng có `company_id`. KHÔNG BAO GIỜ query thiếu cột này.
   RLS được ép ở tầng DB qua `SESSION_CONTEXT('CompanyId')` — phải set lại
   **đầu MỖI request** (bẫy connection pooling). Quên = rò dữ liệu xuyên tenant.

2. **State machine guard:** INTERVIEW→OFFER cần G2 (≥1 phiếu chấm `status='SUBMITTED'`).
   Check guard trước khi transition. (G1 không còn — thuộc nhánh quiz đã loại; giữ tên G2 khớp tài liệu cũ.)
   Ngoài guard dữ liệu còn **guard NGƯỜI** (`EnsureCanDecideAsync`): SCREENING→INTERVIEW chỉ
   DM của job; INTERVIEW→OFFER và rời OFFER chỉ Giám đốc. Đường nào tự đẩy state hộ người dùng
   (`AdvanceToAsync`) phải kiểm quyền CẢ chặng TRƯỚC khi đi bước đầu — nếu không hồ sơ nhảy
   một nấc rồi mới báo 403.

3. **Multi-round interview = DỮ LIỆU trong state INTERVIEW** (`InterviewSchedule.round_number`),
   KHÔNG thêm state INTERVIEW_1/_2. Sơ đồ 6 state/8 transition giữ nguyên.

4. **Tiêu chí (EvaluationCriteria):** AI bóc → `DRAFT` → người duyệt chốt. AI KHÔNG quyết tiêu chí.
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

> Khi đụng feature lớn (tiêu chí, chấm phỏng vấn, scheduling), đọc section tương ứng
> trong `docs/00_CONTEXT.md` (tiêu chí → 5.17/5.18, chấm phỏng vấn → 5.7, scheduling → Section 15).
> Phần mô tả chấm CV/Talent Pool trong docs là hồ sơ thiết kế CŨ — đọc khối "CHỐT 08/08/2026"
> ở đầu Section 3 trước khi tin bất cứ dòng nào nói hệ thống có chấm điểm CV.