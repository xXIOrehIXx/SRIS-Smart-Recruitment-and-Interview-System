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

    public async Task<Company?> UpdateBrandAsync(long companyId, string? name, string? logoUrl, string? primaryColor)
    {
        // Tracking (không AsNoTracking) để EF phát UPDATE. Cô lập tenant: WHERE company_id tường minh + RLS.
        var company = await _db.Companies.FirstOrDefaultAsync(c => c.CompanyId == companyId);
        if (company is null) return null;

        if (name is not null) company.Name = name;
        company.LogoUrl = logoUrl ?? company.LogoUrl;
        company.PrimaryColor = primaryColor ?? company.PrimaryColor;
        company.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return company;
    }
}
