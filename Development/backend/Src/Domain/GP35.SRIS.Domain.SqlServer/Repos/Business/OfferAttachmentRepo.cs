using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class OfferAttachmentRepo : BaseRepo<long, OfferAttachment>, IOfferAttachmentRepo
{
    private readonly SrisDbContext _db;

    public OfferAttachmentRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<IReadOnlyList<OfferAttachment>> GetByApplicationAsync(long companyId, long applicationId)
    {
        // Global Query Filter tự kèm company_id.
        return await _db.OfferAttachments
            .AsNoTracking()
            .Where(a => a.ApplicationId == applicationId)
            .OrderByDescending(a => a.CreatedAt)
            .ThenByDescending(a => a.AttachmentId)
            .ToListAsync();
    }

    public async Task<OfferAttachment?> GetByIdAsync(long companyId, long attachmentId)
    {
        return await _db.OfferAttachments
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.AttachmentId == attachmentId);
    }

    public async Task<long> InsertAsync(long companyId, OfferAttachment attachment)
    {
        attachment.CompanyId = companyId;
        _db.OfferAttachments.Add(attachment);
        await _db.SaveChangesAsync();
        return attachment.AttachmentId;
    }

    public async Task<int> DeleteAsync(long companyId, long attachmentId)
    {
        return await _db.OfferAttachments
            .Where(a => a.AttachmentId == attachmentId)
            .ExecuteDeleteAsync();
    }
}
