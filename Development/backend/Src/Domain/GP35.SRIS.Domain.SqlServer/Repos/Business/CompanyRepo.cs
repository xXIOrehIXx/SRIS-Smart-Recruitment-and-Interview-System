using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class CompanyRepo : BaseRepo<long, Company>, ICompanyRepo
{
    private readonly SrisDbContext _db;

    public CompanyRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<Company> GetByCompanyId(long companyId)
    {
        // Cô lập tenant do RLS (SESSION_CONTEXT) + WHERE tường minh.
        return await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.CompanyId == companyId);
    }

    public async Task<Company?> GetBySlugAsync(string slug)
    {
        // Company không nằm dưới RLS + không có Global Query Filter -> tra được trước khi
        // tenant context được set (dùng để giải companyId cho Career Site công khai).
        return await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Slug == slug);
    }

    public async Task<long> InsertAsync(Company company)
    {
        // Company là bảng tenant gốc (không có company_id, không dưới RLS) -> insert thẳng.
        _db.Companies.Add(company);
        await _db.SaveChangesAsync();
        return company.CompanyId;
    }

    public async Task<Company?> UpdateSmtpAsync(
        long companyId, string? host, int? port, string? username, string? password, string? fromEmail)
    {
        var company = await _db.Companies.FirstOrDefaultAsync(c => c.CompanyId == companyId);
        if (company is null) return null;

        company.SmtpHost = host;
        company.SmtpPort = port;
        company.SmtpUsername = username;
        if (password is not null) company.SmtpPassword = password; // null = giữ nguyên
        company.SmtpFromEmail = fromEmail;
        company.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return company;
    }

    public async Task<Company?> UpdateBrandAsync(
        long companyId, string? name, string? logoUrl, string? primaryColor,
        string? address, string? contactEmail, string? phone, string? defaultBenefits = null,
        string? emailDomain = null)
    {
        // Tracking (không AsNoTracking) để EF phát UPDATE. Cô lập tenant: WHERE company_id tường minh + RLS.
        var company = await _db.Companies.FirstOrDefaultAsync(c => c.CompanyId == companyId);
        if (company is null) return null;

        // null = giữ nguyên: endpoint /brand chỉ gửi logo+màu, không được xoá mất liên hệ công ty.
        if (name is not null) company.Name = name;
        company.LogoUrl = logoUrl ?? company.LogoUrl;
        company.PrimaryColor = primaryColor ?? company.PrimaryColor;
        company.Address = address ?? company.Address;
        company.ContactEmail = contactEmail ?? company.ContactEmail;
        company.Phone = phone ?? company.Phone;
        company.EmailDomain = emailDomain ?? company.EmailDomain;
        // Chuỗi RỖNG ở đây là người dùng cố ý xoá hết quyền lợi mặc định -> lưu NULL.
        // null là "client không gửi mục này", phải giữ nguyên (endpoint /brand không gửi).
        if (defaultBenefits is not null)
            company.DefaultBenefits = defaultBenefits.Length == 0 ? null : defaultBenefits;
        company.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return company;
    }
}
