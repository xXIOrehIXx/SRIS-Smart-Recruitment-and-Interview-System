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
/// Cột VECTOR(1024) <c>embedding</c> hiện KHÔNG map ở đây — mọi thao tác vector dùng raw SQL
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
    public DbSet<MagicLinkToken> MagicLinkTokens => Set<MagicLinkToken>();
    public DbSet<UserAuthToken> UserAuthTokens => Set<UserAuthToken>();
    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();
    public DbSet<InterviewSchedule> InterviewSchedules => Set<InterviewSchedule>();
    public DbSet<InterviewSlotPool> InterviewSlotPools => Set<InterviewSlotPool>();
    public DbSet<InterviewSlot> InterviewSlots => Set<InterviewSlot>();
    public DbSet<InterviewSlotInterviewer> InterviewSlotInterviewers => Set<InterviewSlotInterviewer>();
    public DbSet<EvaluationCriteria> EvaluationCriterias => Set<EvaluationCriteria>();
    public DbSet<CvChunk> CvChunks => Set<CvChunk>();
    public DbSet<ApplicationCriterionMatch> ApplicationCriterionMatches => Set<ApplicationCriterionMatch>();
    public DbSet<CriteriaTemplate> CriteriaTemplates => Set<CriteriaTemplate>();
    public DbSet<CriteriaTemplateItem> CriteriaTemplateItems => Set<CriteriaTemplateItem>();
    public DbSet<InterviewScore> InterviewScores => Set<InterviewScore>();
    public DbSet<OfferDetail> OfferDetails => Set<OfferDetail>();
    public DbSet<InternalNote> InternalNotes => Set<InternalNote>();
    public DbSet<EmailTemplate> EmailTemplates => Set<EmailTemplate>();
    public DbSet<RecruitmentRequest> RecruitmentRequests => Set<RecruitmentRequest>();
    public DbSet<JobRequirement> JobRequirements => Set<JobRequirement>();
    public DbSet<JobBenefit> JobBenefits => Set<JobBenefit>();

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
            e.Ignore(x => x.Embedding); // VECTOR(1024) -> xử lý bằng raw SQL
            e.Ignore(x => x.Quantity);
            e.Ignore(x => x.CvScoreThreshold);
            e.Ignore(x => x.ClosedAt);
            // V020: JobRequirement / JobBenefit (2 bảng 1-N) thêm sau.
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<CvDocument>(e =>
        {
            e.ToTable("CvDocument");
            e.HasKey(x => x.CvId);
            e.Ignore(x => x.Embedding); // VECTOR(1024) -> xử lý bằng raw SQL
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
            // full_name / phone / last_login_at: đã thêm ở migration V014.
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            // Truy vấn User thường lọc theo company; login (GetByEmail) dùng IgnoreQueryFilters.
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<MagicLinkToken>(e =>
        {
            e.ToTable("MagicLinkToken");
            e.HasKey(x => x.TokenId);
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
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

        b.Entity<InterviewSlotPool>(e =>
        {
            e.ToTable("InterviewSlotPool");
            e.HasKey(x => x.PoolId);
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
            e.HasMany(x => x.Interviewers)
                .WithOne()
                .HasForeignKey(x => x.SlotId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<InterviewSlotInterviewer>(e =>
        {
            e.ToTable("InterviewSlotInterviewer");
            e.HasKey(x => new { x.SlotId, x.InterviewerId });
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<EvaluationCriteria>(e =>
        {
            e.ToTable("EvaluationCriteria");
            e.HasKey(x => x.CriteriaId);
            e.Ignore(x => x.Description);   // chưa có ở schema local
            e.Ignore(x => x.DisplayOrder);
            // Cột embedding VECTOR(1024) (V013) không có trên entity — xử lý bằng raw SQL (5.11).
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<CvChunk>(e =>
        {
            e.ToTable("CvChunk");
            e.HasKey(x => x.ChunkId);
            e.Ignore(x => x.Embedding); // VECTOR(1024) -> xử lý bằng raw SQL
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<ApplicationCriterionMatch>(e =>
        {
            e.ToTable("ApplicationCriterionMatch");
            e.HasKey(x => x.MatchId);
            // evaluated_at có DEFAULT ở DB nhưng service luôn set tường minh khi ghi.
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<CriteriaTemplate>(e =>
        {
            e.ToTable("CriteriaTemplate");
            e.HasKey(x => x.TemplateId);
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<CriteriaTemplateItem>(e =>
        {
            e.ToTable("CriteriaTemplateItem");
            e.HasKey(x => x.ItemId);
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

        b.Entity<OfferDetail>(e =>
        {
            e.ToTable("OfferDetail");
            e.HasKey(x => x.OfferId);
            // decided_by / note / expires_at: đã thêm ở migration V005.
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<InternalNote>(e =>
        {
            e.ToTable("InternalNote");
            e.HasKey(x => x.NoteId);
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<EmailTemplate>(e =>
        {
            e.ToTable("EmailTemplate");
            e.HasKey(x => x.TemplateId);
            // name / is_active: thêm ở migration V007.
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<RecruitmentRequest>(e =>
        {
            e.ToTable("RecruitmentRequest");
            e.HasKey(x => x.RequestId);
            e.Property(x => x.SalaryMin).HasColumnType("decimal(18,2)");
            e.Property(x => x.SalaryMax).HasColumnType("decimal(18,2)");
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<UserAuthToken>(e =>
        {
            e.ToTable("UserAuthToken");
            e.HasKey(x => x.TokenId);
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            // KHÔNG Global Query Filter: tra pre-auth theo hash (như Company). Cô lập không cần —
            // token hash toàn cục unique, tìm ra là biết company_id + user_id.
        });

        b.Entity<JobRequirement>(e =>
        {
            e.ToTable("JobRequirement");
            e.HasKey(x => x.RequirementId);
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<JobBenefit>(e =>
        {
            e.ToTable("JobBenefit");
            e.HasKey(x => x.BenefitId);
            ConfigureCreatedAt(e.Property(x => x.CreatedAt));
            e.HasQueryFilter(x => x.CompanyId == _companyId);
        });

        b.Entity<Company>(e =>
        {
            e.ToTable("Company");
            e.HasKey(x => x.CompanyId);
            e.Ignore(x => x.Industry);
            e.Ignore(x => x.SubscriptionPlan);
            e.Ignore(x => x.Status);
            // SMTP per-tenant (V017): các cột email_domain/smtp_* giờ có trong DB -> map bình thường.
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
