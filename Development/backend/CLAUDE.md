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

> **Vector handling:** dùng SQL Server 2025 `VECTOR(1024)`. EF Core 10 hỗ trợ native kiểu
> vector (`SqlVector<float>` + `EF.Functions.VectorDistance("cosine", ...)`), không cần extension.
> Hiện code vẫn xử lý vector bằng raw SQL (`CAST(... AS VECTOR(1024))` + `Ignore(Embedding)` trong
> `SrisDbContext`); chuyển sang map native là việc tối ưu riêng, cần spike verify trên SQL Server 2025 thật trước.

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
- Standardized response: `{ ErrorCode, DevMsg, UserMsg, TraceId, ValidationFailures }`
- Global handler: `ConfigureExceptionHandler()`; model validation: `[ModelValidation]`

## Coding Conventions

- PascalCase for all C# identifiers and DB column names
- `async/await` for all I/O-bound operations
- Logging: `_logger.Here()` for caller context
- Config: `InitConfig<T>()` where T inherits `DefaultConfig`
- Controllers: `[ApiController]` + `[Route("api/[controller]s")]`
- All DI registrations in `HostBase/Extensions/ServiceCollectionExtensions.cs`

## JSON Serialization

- API responses: `System.Text.Json` (camelCase)
- Error responses: `Newtonsoft.Json` via `ErrorObjectCommon.ToString()`
- Both coexist — verify which is active per execution path

---

## Business Context (tóm tắt — chi tiết ở docs/00_CONTEXT.md)

Hệ thống SaaS ATS multi-tenant, tuyển MỌI vị trí (không chỉ IT).
**Target (chốt hậu-hội-đồng 07/2026): công ty nhỏ ≤200 nhân sự + công ty gia đình.**
Nguyên tắc thiết kế: **đơn giản là mặc định, phức tạp là tùy chọn.**

> **MODULE QUIZ ĐÃ LOẠI HOÀN TOÀN KHỎI SCOPE (07/2026)** — cả quiz nhập tay lẫn AI gen
> (docs Section 3 OUT). Không thiết kế, không code, không tài liệu gì thêm cho quiz.

### Roles (4 login + 1 ẩn danh — GÁN CHỒNG được, 1 người giữ nhiều role)
- `Admin` / `Recruiter` / `Interviewer` / `DepartmentManager` → đăng nhập Portal (JWT)
- `Candidate` → **magic link only**, không có account, không có User row
- Câu thần chú: Recruiter lái · Interviewer chấm · DM quyết (và RA ĐỀ) · Candidate ứng tuyển · Admin dựng sân

### Pipeline: 6 state nội bộ, hiển thị 4 PHA
NEW → SCREENING → INTERVIEW → OFFER → HIRED / REJECTED (8 transition)  
Forward-only. Reject từ bất kỳ state nào → REJECTED (bắt buộc `reject_reason`).  
Người dùng thấy **4 pha**: Hồ sơ mới (NEW) · Sàng lọc (SCREENING) · Phỏng vấn (INTERVIEW) · Quyết định (OFFER→HIRED/REJECTED). 6 state là chuyện nội bộ, không phơi ra UI/tài liệu.

### Luồng tiêu chí (trục xuyên suốt — 5.17, 5.18)
DM tạo Yêu cầu tuyển dụng (tùy chọn) → Recruiter tạo Job → AI bóc tiêu chí `DRAFT` →
người duyệt chốt → chấm CV **theo TỪNG tiêu chí** (khớp/thiếu + câu bằng chứng) →
cùng bộ tiêu chí dùng cho phiếu chấm phỏng vấn. KHÔNG ném cả JD↔CV lấy 1 con số.

### AI Service (Python FastAPI — port riêng)
- .NET **không gọi AI trực tiếp** — chỉ gọi qua HTTP nội bộ đến Python service
- Python stateless, không đụng DB, không biết tenant
- Embedding: `BAAI/bge-m3` → `VECTOR(1024)` (đổi từ `paraphrase-multilingual-MiniLM-L12-v2`/384: 1024 chiều + đọc tới 8192 token để embed trọn CV dài / CV tiếng Việt, không cắt cụt)
- **Talent Pool reverse matching = hero smart feature** (đã code): JD mới → quét kho CvDocument cũ cùng tenant

### Magic link purposes (chỉ của Candidate)
`SCHEDULE` · `STATUS` · `OFFER_RESPONSE` (3 purpose — QUIZ đã loại)  
Lưu **hash** token (SHA-256), không lưu gốc. "One-time" = đốt khi CHỐT, không phải khi mở.

### Người quyết tuyển
`Job.department_manager_id` → DepartmentManager quyết ở bước OFFER.  
Null = Recruiter quyết (đường mặc định của công ty nhỏ). Interviewer chỉ chấm (input), không quyết.
DM đứng HAI đầu: ra đề (Yêu cầu tuyển dụng — 5.17) và chốt (OFFER).

---

## Coding Rules bắt nguồn từ nghiệp vụ (BẮT BUỘC tuân thủ)

1. **Multi-tenant:** mọi bảng có `company_id`. KHÔNG BAO GIỜ query thiếu cột này.
   RLS được ép ở tầng DB qua `SESSION_CONTEXT('CompanyId')` — phải set lại
   **đầu MỖI request** (bẫy connection pooling). Quên = rò dữ liệu xuyên tenant.

2. **State machine guard:** INTERVIEW→OFFER cần G2 (≥1 phiếu chấm `status='SUBMITTED'`).
   Check guard trước khi transition. (G1 không còn — thuộc nhánh quiz đã loại; giữ tên G2 khớp tài liệu cũ.)

3. **Multi-round interview = DỮ LIỆU trong state INTERVIEW** (`InterviewSchedule.round_number`),
   KHÔNG thêm state INTERVIEW_1/_2. Sơ đồ 6 state/8 transition giữ nguyên.

4. **Tiêu chí (EvaluationCriteria):** AI bóc → `DRAFT` → người duyệt chốt. AI KHÔNG quyết tiêu chí.
   Chấm CV chỉ tính nhóm `CV_MATCHABLE`; tiêu chí `HARD` lọc bằng rule, `SOFT` bằng vector (5.18).

5. **Blind Review (InterviewScore):** điểm/note ẩn cho tới khi `status='SUBMITTED'`.
   Query lộ điểm trước submit = phá blind review. (Blind chỉ tự bật khi job có >1 interviewer — 5.7.)

6. **OfferDetail:** 0..1 per Application (UNIQUE `application_id`). Một offer / một application.

> Khi đụng feature lớn (criteria/chấm CV, scoring, scheduling), đọc section tương ứng
> trong `docs/00_CONTEXT.md` (vd tiêu chí → 5.17/5.18, scoring → 5.7, scheduling → Section 15).