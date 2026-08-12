using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class CvDocumentRepo : BaseRepo<long, CvDocument>, ICvDocumentRepo
{
    private readonly SrisDbContext _db;

    public CvDocumentRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<long> InsertAsync(CvDocument cv)
    {
        _db.CvDocuments.Add(cv);
        await _db.SaveChangesAsync();
        return cv.CvId;
    }

    public async Task<CvFileInfo?> GetFileInfoAsync(long companyId, long cvId)
    {
        // Global Query Filter tự kèm company_id; join Candidate lấy tên (đặt tên file tải về).
        return await (
            from c in _db.CvDocuments.AsNoTracking()
            join cand in _db.Candidates.AsNoTracking() on c.CandidateId equals cand.CandidateId
            where c.CvId == cvId
            select new CvFileInfo(c.FileUrl, c.FileName, c.MimeType, cand.FullName))
            .FirstOrDefaultAsync();
    }

    public async Task<string?> GetExtractedTextAsync(long companyId, long cvId)
    {
        // Global Query Filter tự kèm company_id.
        return await _db.CvDocuments.AsNoTracking()
            .Where(c => c.CvId == cvId)
            .Select(c => c.ExtractedText)
            .FirstOrDefaultAsync();
    }
}
