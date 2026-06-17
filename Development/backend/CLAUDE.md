# SRIS — Smart Recruitment and Interview System (Backend)

## Project Overview

ASP.NET Core 8 Web API — hệ thống tuyển dụng và phỏng vấn thông minh.

**Solution:** `GP35.SRIS.sln`  
**Entry point:** `Hosts/GP35.SRIS/`

> Chi tiết nghiệp vụ đầy đủ: `docs/00_CONTEXT.md` (single source of truth — đọc khi làm feature lớn).

## Tech Stack

- .NET 8 / ASP.NET Core 8
- SQL Server 2025 (primary database, compatibility level 170 — kiểu VECTOR)
- MinIO (file/document storage)
- Redis (caching)
- Serilog (logging)
- AutoMapper
- Swashbuckle (Swagger)

> **Vector handling:** dùng SQL Server 2025 `VECTOR(384)`. Trên .NET 8 cần
> package `EFCore.SqlServer.VectorSearch` để dùng `EF.Functions.VectorDistance("cosine", ...)`.
> (Nếu nâng .NET 10 → EF Core 10 hỗ trợ native, bỏ extension.)

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

### Roles (4 login + 1 ẩn danh)
- `Admin` / `Recruiter` / `Interviewer` / `DepartmentManager` → đăng nhập Portal (JWT)
- `Candidate` → **magic link only**, không có account, không có User row

### Pipeline state machine
NEW → SCREENING → QUIZ → INTERVIEW → OFFER → HIRED / REJECTED  
Forward-only. Reject từ bất kỳ state nào → REJECTED (bắt buộc `reject_reason`).

### AI Service (Python FastAPI — port riêng)
- .NET **không gọi AI trực tiếp** — chỉ gọi qua HTTP nội bộ đến Python service
- Python stateless, không đụng DB, không biết tenant
- Embedding: `paraphrase-multilingual-MiniLM-L12-v2` → `VECTOR(384)`

### Magic link purposes (chỉ của Candidate)
`QUIZ` · `SCHEDULE` · `STATUS` · `OFFER_RESPONSE`  
Lưu **hash** token (SHA-256), không lưu gốc. "One-time" = đốt khi CHỐT, không phải khi mở.

### Người quyết tuyển
`Job.department_manager_id` → DepartmentManager quyết ở bước OFFER.  
Null = Recruiter quyết. Interviewer chỉ chấm (input), không quyết.

---

## Coding Rules bắt nguồn từ nghiệp vụ (BẮT BUỘC tuân thủ)

1. **Multi-tenant:** mọi bảng có `company_id`. KHÔNG BAO GIỜ query thiếu cột này.
   RLS được ép ở tầng DB qua `SESSION_CONTEXT('CompanyId')` — phải set lại
   **đầu MỖI request** (bẫy connection pooling). Quên = rò dữ liệu xuyên tenant.

2. **State machine guards:** QUIZ→INTERVIEW cần G1 (quiz đã nộp);
   INTERVIEW→OFFER cần G2 (≥1 phiếu chấm `status='SUBMITTED'`). Check guard trước khi transition.

3. **Multi-round interview = DỮ LIỆU trong state INTERVIEW** (`InterviewSchedule.round_number`),
   KHÔNG thêm state INTERVIEW_1/_2. Sơ đồ 7 state/11 transition giữ nguyên.

4. **Quiz:** MCQ-only. AI gen → `status='DRAFT'` → Recruiter duyệt → `'READY'`.
   KHÔNG phát quiz DRAFT cho ứng viên.

5. **Blind Review (InterviewScore):** điểm/note ẩn cho tới khi `status='SUBMITTED'`.
   Query lộ điểm trước submit = phá blind review.

6. **OfferDetail:** 0..1 per Application (UNIQUE `application_id`). Một offer / một application.

> Khi đụng feature lớn (quiz engine, scoring, scheduling), đọc section tương ứng
> trong `docs/00_CONTEXT.md` (vd quiz → 5.6, scoring → 5.7, scheduling → Section 15).