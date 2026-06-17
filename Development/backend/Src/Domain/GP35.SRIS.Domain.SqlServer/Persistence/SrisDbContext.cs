using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Shared.Context;
using Microsoft.EntityFrameworkCore;

namespace GP35.SRIS.Domain.SqlServer.Persistence;

/// <summary>
/// EF Core DbContext cho luồng CV-scoring (quyết định 5.11 — chuyển từ Dapper sang EF Core).
///
/// Hai điểm cốt lõi về cô lập tenant (docs 5.2 — 3 lớp phòng thủ):
///  - Lớp 2 (tầng code): <b>Global Query Filter</b> tự kèm <c>company_id</c> vào mọi LINQ.
///  - Lớp 1 (tầng DB): RLS đọc <c>SESSION_CONTEXT('CompanyId')</c> — được set qua
///    <see cref="TenantSessionConnectionInterceptor"/> mỗi khi EF mở connection (bẫy pooling).
///
/// Cột VECTOR(384) <c>embedding</c> KHÔNG map ở đây (EF Core 8 chưa hỗ trợ kiểu vector) —
/// mọi thao tác vector dùng raw SQL (cửa thoát <c>FromSqlRaw</c>/<c>ExecuteSqlRaw</c> — 5.11).
/// </summary>
public class SrisDbContext : DbContext
{
    private readonly long _companyId;

    public SrisDbContext(DbContextOptions<SrisDbContext> options, IContextData? contextData = null)
        : base(options)
    {
        _companyId = contextData?.CompanyId ?? 0;
    }

    public DbSet<Candidate> Candidates => Set<Candidate>();
    public DbSet<Job> Jobs => Set<Job>();
    public DbSet<CvDocument> CvDocuments => Set<CvDocument>();
    public DbSet<Application> Applications => Set<Application>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Company> Companies => Set<Company>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        // Tên cột (snake_case) + khóa chính đã khai báo bằng [Column]/[Key] trên entity,
        // EF Core tự đọc. Ở đây chỉ cấu hình thêm: tên bảng, bỏ map cột không có ở schema
        // local, store-generated created_at, và Global Query Filter theo company.

        b.Entity<Candidate>(e =>
        {
            e.ToTable("Candidate");
            e.HasKey(x => x.CandidateId);
            // Các cột chỉ có ở remote/entity, schema local (rút gọn) chưa có -> bỏ map.
            e.Ignore(x => x.LinkedinUrl);
            e.Ignore(x => x.CurrentPosition);
            e.Ignore(x => x.YearsExperience);
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<Job>(e =>
        {
            e.ToTable("Job");
            e.HasKey(x => x.JobId);
            e.Ignore(x => x.Embedding); // VECTOR(384) -> xử lý bằng raw SQL
            e.Ignore(x => x.Department);
            e.Ignore(x => x.Location);
            e.Ignore(x => x.EmploymentType);
            e.Ignore(x => x.Quantity);
            e.Ignore(x => x.CvScoreThreshold);
            e.Ignore(x => x.CreatedBy);
            e.Ignore(x => x.ClosedAt);
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<CvDocument>(e =>
        {
            e.ToTable("CvDocument");
            e.HasKey(x => x.CvId);
            e.Ignore(x => x.Embedding); // VECTOR(384) -> xử lý bằng raw SQL
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<Application>(e =>
        {
            e.ToTable("Application");
            e.HasKey(x => x.ApplicationId);
            e.Ignore(x => x.StageUpdatedAt);
            e.Ignore(x => x.RejectedAt);
            e.Ignore(x => x.HiredAt);
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<User>(e =>
        {
            e.ToTable("User"); // EF tự bọc [User] (từ khóa SQL)
            e.HasKey(x => x.UserId);
            // Cột chỉ có ở remote/entity, schema local chưa có -> bỏ map.
            e.Ignore(x => x.FullName);
            e.Ignore(x => x.Phone);
            e.Ignore(x => x.LastLoginAt);
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            // Truy vấn User thường lọc theo company; login (GetByEmail) dùng IgnoreQueryFilters.
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<Company>(e =>
        {
            e.ToTable("Company");
            e.HasKey(x => x.CompanyId);
            e.Ignore(x => x.Industry);
            e.Ignore(x => x.EmailDomain);
            e.Ignore(x => x.SmtpHost);
            e.Ignore(x => x.SmtpPort);
            e.Ignore(x => x.SmtpUsername);
            e.Ignore(x => x.SmtpFromEmail);
            e.Ignore(x => x.SubscriptionPlan);
            e.Ignore(x => x.Status);
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            // Company là bảng tenant (không có cột company_id riêng) -> không Global Query Filter;
            // cô lập do RLS (SESSION_CONTEXT) + WHERE company_id tường minh trong repo.
        });
    }

    /// <summary>
    /// created_at có DEFAULT SYSUTCDATETIME() ở DB và NOT NULL — đánh dấu store-generated
    /// để EF bỏ qua khi INSERT (tránh gửi NULL vi phạm NOT NULL) và đọc lại sau khi lưu.
    /// </summary>
    private static void ConfigureCreatedAt(
        Microsoft.EntityFrameworkCore.Metadata.Builders.PropertyBuilder<DateTime?> prop)
        => prop.HasDefaultValueSql("SYSUTCDATETIME()").ValueGeneratedOnAdd();
}
