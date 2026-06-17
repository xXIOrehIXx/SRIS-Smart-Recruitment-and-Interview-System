using System.Text.Json;
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

    public async Task<long> InsertAsync(CvDocument cv, float[]? embedding)
    {
        // Cột embedding (VECTOR) không map trong EF -> insert phần còn lại bằng EF,
        // rồi cập nhật riêng vector bằng raw SQL nếu có (CAST JSON -> VECTOR(384)).
        _db.CvDocuments.Add(cv);
        await _db.SaveChangesAsync();

        if (embedding is { Length: > 0 })
        {
            var vectorJson = JsonSerializer.Serialize(embedding);
            await _db.Database.ExecuteSqlRawAsync(
                "UPDATE CvDocument SET embedding = CAST({0} AS VECTOR(384)) " +
                "WHERE cv_id = {1} AND company_id = {2}",
                vectorJson, cv.CvId, cv.CompanyId);
        }

        return cv.CvId;
    }

    public async Task<CvFileInfo?> GetFileInfoAsync(long companyId, long cvId)
    {
        // Global Query Filter tự kèm company_id.
        return await _db.CvDocuments
            .AsNoTracking()
            .Where(c => c.CvId == cvId)
            .Select(c => new CvFileInfo(c.FileUrl, c.FileName, c.MimeType))
            .FirstOrDefaultAsync();
    }
}
