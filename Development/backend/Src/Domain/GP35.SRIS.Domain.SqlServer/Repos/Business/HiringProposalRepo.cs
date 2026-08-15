using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class HiringProposalRepo : BaseRepo<long, HiringProposal>, IHiringProposalRepo
{
    private readonly SrisDbContext _db;

    public HiringProposalRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<long> InsertAsync(long companyId, HiringProposal proposal)
    {
        proposal.CompanyId = companyId;
        _db.HiringProposals.Add(proposal);
        await _db.SaveChangesAsync();
        return proposal.ProposalId;
    }

    public async Task<IReadOnlyList<HiringProposalRow>> GetListAsync(long companyId, string? status)
    {
        // Global Query Filter tự kèm company_id. Join sẵn ứng viên + vị trí: màn Giám đốc là
        // một hàng đợi, gọi thêm API cho từng dòng thì 20 đề xuất là 20 request.
        var query = _db.HiringProposals.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(p => p.Status == status);

        return await (
            from p in query
            join a in _db.Applications.AsNoTracking() on p.ApplicationId equals a.ApplicationId
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            join j in _db.Jobs.AsNoTracking() on a.JobId equals j.JobId
            join uc in _db.Users.AsNoTracking() on p.CreatedBy equals (long?)uc.UserId into gc
            from uc in gc.DefaultIfEmpty()
            join ud in _db.Users.AsNoTracking() on p.DecidedBy equals (long?)ud.UserId into gd
            from ud in gd.DefaultIfEmpty()
            orderby p.ProposalId descending
            select new HiringProposalRow(
                p,
                uc != null ? (uc.FullName ?? uc.Email) : null,
                ud != null ? (ud.FullName ?? ud.Email) : null,
                c.FullName,
                c.Email,
                j.JobId,
                j.Title,
                j.Department,
                a.CurrentState))
            .ToListAsync();
    }

    public async Task<HiringProposal?> GetByIdAsync(long companyId, long proposalId)
    {
        return await _db.HiringProposals.FirstOrDefaultAsync(p => p.ProposalId == proposalId);
    }

    public async Task<IReadOnlyList<HiringProposal>> GetByApplicationAsync(long companyId, long applicationId)
    {
        return await _db.HiringProposals.AsNoTracking()
            .Where(p => p.ApplicationId == applicationId)
            .OrderByDescending(p => p.ProposalId)
            .ToListAsync();
    }

    public async Task<HiringProposal?> GetPendingByApplicationAsync(long companyId, long applicationId)
    {
        return await _db.HiringProposals.AsNoTracking()
            .FirstOrDefaultAsync(p => p.ApplicationId == applicationId && p.Status == "PENDING");
    }

    public async Task<HiringProposal?> GetApprovedByApplicationAsync(long companyId, long applicationId)
    {
        return await _db.HiringProposals.AsNoTracking()
            .Where(p => p.ApplicationId == applicationId && p.Status == "APPROVED")
            .OrderByDescending(p => p.ProposalId)
            .FirstOrDefaultAsync();
    }

    public Task SaveAsync() => _db.SaveChangesAsync();
}
