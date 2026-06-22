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
/// Cột VECTOR(384) <c>embedding</c> hiện KHÔNG map ở đây — mọi thao tác vector dùng raw SQL
/// (cửa thoát <c>FromSqlRaw</c>/<c>ExecuteSqlRaw</c> — 5.11). EF Core 10 đã hỗ trợ native kiểu
/// vector (<c>SqlVector&lt;float&gt;</c>); chuyển sang map native là việc tối ưu riêng.
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
    public DbSet<Quiz> Quizzes => Set<Quiz>();
    public DbSet<QuizQuestion> QuizQuestions => Set<QuizQuestion>();
    public DbSet<MagicLinkToken> MagicLinkTokens => Set<MagicLinkToken>();
    public DbSet<QuizAttempt> QuizAttempts => Set<QuizAttempt>();
    public DbSet<QuizAnswer> QuizAnswers => Set<QuizAnswer>();
    public DbSet<AntiCheatEvent> AntiCheatEvents => Set<AntiCheatEvent>();
    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();
    public DbSet<InterviewSchedule> InterviewSchedules => Set<InterviewSchedule>();
    public DbSet<InterviewSlot> InterviewSlots => Set<InterviewSlot>();
    public DbSet<EvaluationCriteria> EvaluationCriterias => Set<EvaluationCriteria>();
    public DbSet<InterviewScore> InterviewScores => Set<InterviewScore>();

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
            // stage_updated_at / rejected_at / hired_at: đã thêm ở migration V004.
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

        b.Entity<Quiz>(e =>
        {
            e.ToTable("Quiz");
            e.HasKey(x => x.QuizId);
            // Cột chỉ có ở entity (đầy đủ), schema local (rút gọn) chưa có -> bỏ map.
            e.Ignore(x => x.Title);
            e.Ignore(x => x.Stage);
            e.Ignore(x => x.TotalQuestions);
            e.Ignore(x => x.PassScore);
            e.Ignore(x => x.ShuffleQuestions);
            e.Ignore(x => x.TabSwitchLimit);
            // duration_min CÓ trong schema -> giữ map (để null khi AI gen).
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<QuizQuestion>(e =>
        {
            e.ToTable("QuizQuestion");
            e.HasKey(x => x.QuestionId);
            e.Ignore(x => x.Explanation);
            e.Ignore(x => x.Topic);
            e.Ignore(x => x.Difficulty);
            e.Ignore(x => x.DisplayOrder);
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<MagicLinkToken>(e =>
        {
            e.ToTable("MagicLinkToken");
            e.HasKey(x => x.TokenId);
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<QuizAttempt>(e =>
        {
            e.ToTable("QuizAttempt");
            e.HasKey(x => x.AttemptId);
            e.Ignore(x => x.MonitorCount); // không có ở schema local
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<QuizAnswer>(e =>
        {
            e.ToTable("QuizAnswer");
            e.HasKey(x => x.AnswerId);
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<AntiCheatEvent>(e =>
        {
            e.ToTable("AntiCheatEvent");
            e.HasKey(x => x.EventId);
            // Bảng này dùng occurred_at (không có created_at) — set tường minh trong repo.
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<ActivityLog>(e =>
        {
            e.ToTable("ActivityLog");
            e.HasKey(x => x.LogId);
            // from_state / to_state / detail: đã thêm ở migration V004.
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<InterviewSchedule>(e =>
        {
            e.ToTable("InterviewSchedule");
            e.HasKey(x => x.ScheduleId);
            e.Ignore(x => x.RoundName); // chưa có ở schema local
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<InterviewSlot>(e =>
        {
            e.ToTable("InterviewSlot");
            e.HasKey(x => x.SlotId);
            e.Ignore(x => x.EndTime);     // chưa có ở schema local
            e.Ignore(x => x.Location);
            e.Ignore(x => x.MeetingLink);
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<EvaluationCriteria>(e =>
        {
            e.ToTable("EvaluationCriteria");
            e.HasKey(x => x.CriteriaId);
            e.Ignore(x => x.Description);   // chưa có ở schema local
            e.Ignore(x => x.DisplayOrder);
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<InterviewScore>(e =>
        {
            e.ToTable("InterviewScore");
            e.HasKey(x => x.ScoreId);
            e.Ignore(x => x.SubmittedAt);   // chưa có ở schema local (suy từ status + updated_at)
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
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
