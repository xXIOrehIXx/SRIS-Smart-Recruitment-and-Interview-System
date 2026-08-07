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
