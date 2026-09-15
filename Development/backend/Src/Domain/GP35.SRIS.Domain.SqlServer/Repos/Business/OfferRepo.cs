using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class OfferRepo : BaseRepo<long, OfferDetail>, IOfferRepo
{
    private readonly SrisDbContext _db;

    public OfferRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<OfferDetail?> GetByApplicationAsync(long companyId, long applicationId)
    {
        return await _db.OfferDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.ApplicationId == applicationId);
    }

    public async Task<IReadOnlyList<OfferListRow>> GetListAsync(long companyId, long? jobId)
    {
        // LEFT JOIN OfferDetail: 0..1 thư / hồ sơ (UNIQUE application_id) nên không nhân bản dòng.
        // Global Query Filter tự kèm company_id cho cả bốn bảng.
        var query =
            from a in _db.Applications.AsNoTracking()
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            join j in _db.Jobs.AsNoTracking() on a.JobId equals j.JobId
            join o in _db.OfferDetails.AsNoTracking() on a.ApplicationId equals o.ApplicationId into offers
            from o in offers.DefaultIfEmpty()
            where a.CurrentState == ApplicationState.Offer || o != null
            select new { a, c, j, o };

        if (jobId is long id)
            query = query.Where(x => x.a.JobId == id);

        // Hồ sơ CHỜ SOẠN THƯ lên đầu — đó là việc nhân sự phải làm, còn thư đã gửi chỉ để theo dõi.
        return await query
            .OrderBy(x => x.o == null ? 0 : 1)
            .ThenByDescending(x => x.a.StageUpdatedAt)
            .Select(x => new OfferListRow(
                x.a.ApplicationId, x.a.JobId, x.j.Title, x.c.FullName, x.c.Email,
                x.a.CurrentState, x.o))
            .ToListAsync();
    }

    public async Task<long> InsertAsync(long companyId, OfferDetail offer)
    {
        offer.CompanyId = companyId;
        _db.OfferDetails.Add(offer);
        await _db.SaveChangesAsync();
        return offer.OfferId;
    }

    public async Task<int> SetOutcomeAsync(
        long companyId, long offerId, string status, long? outcomeBy, string? note, DateTime respondedAt)
    {
        // Khóa lạc quan: chỉ chốt khi còn PENDING -> lần ghi nhận thứ 2 không ghi đè (rowcount=0).
        return await _db.OfferDetails
            .Where(o => o.OfferId == offerId && o.Status == OfferStatus.Pending)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.Status, status)
                .SetProperty(o => o.OutcomeBy, outcomeBy)
                .SetProperty(o => o.OutcomeNote, note)
                .SetProperty(o => o.RespondedAt, respondedAt)
                .SetProperty(o => o.UpdatedAt, respondedAt));
    }
}
