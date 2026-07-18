using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class RecruitmentRequestRepo : BaseRepo<long, RecruitmentRequest>, IRecruitmentRequestRepo
{
    private readonly SrisDbContext _db;

    public RecruitmentRequestRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<long> InsertAsync(long companyId, RecruitmentRequest request)
    {
        request.CompanyId = companyId;
        _db.RecruitmentRequests.Add(request);
        await _db.SaveChangesAsync();
        return request.RequestId;
    }

    public async Task<IReadOnlyList<RecruitmentRequestRow>> GetListAsync(long companyId, string? status)
    {
        // Global Query Filter tự kèm company_id; join User lấy tên người tạo/người duyệt.
        var query = _db.RecruitmentRequests.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(r => r.Status == status);

        return await (
            from r in query
            join uc in _db.Users.AsNoTracking() on r.CreatedBy equals (long?)uc.UserId into gc
            from uc in gc.DefaultIfEmpty()
            join ur in _db.Users.AsNoTracking() on r.ReviewedBy equals (long?)ur.UserId into gr
            from ur in gr.DefaultIfEmpty()
            orderby r.RequestId descending
            select new RecruitmentRequestRow(
                r,
                uc != null ? (uc.FullName ?? uc.Email) : null,
                ur != null ? (ur.FullName ?? ur.Email) : null))
            .ToListAsync();
    }

    public async Task<RecruitmentRequest?> GetByIdAsync(long companyId, long requestId)
    {
        return await _db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.RequestId == requestId);
    }

    public Task SaveAsync() => _db.SaveChangesAsync();
}
