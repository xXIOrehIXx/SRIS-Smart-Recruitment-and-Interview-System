using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class CandidateRepo : BaseRepo<long, Candidate>, ICandidateRepo
{
    private readonly SrisDbContext _db;

    public CandidateRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<Candidate?> GetByEmailAsync(long companyId, string email)
    {
        // Global Query Filter tự kèm company_id; vẫn dùng AsNoTracking cho truy vấn đọc.
        return await _db.Candidates
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Email == email);
    }

    public async Task<Candidate?> GetByIdAsync(long companyId, long candidateId)
    {
        // Global Query Filter tự kèm company_id; truyền companyId tham số để giữ signature thống nhất với IJobRepo.
        return await _db.Candidates
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.CandidateId == candidateId);
    }

    public async Task<long> InsertAsync(long companyId, Candidate candidate)
    {
        candidate.CompanyId = companyId;
        _db.Candidates.Add(candidate);
        await _db.SaveChangesAsync();
        return candidate.CandidateId; // EF đọc lại khóa IDENTITY sau khi lưu
    }
}
