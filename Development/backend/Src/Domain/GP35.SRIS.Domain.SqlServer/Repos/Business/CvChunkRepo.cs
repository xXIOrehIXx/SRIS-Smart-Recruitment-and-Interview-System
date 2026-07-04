using System.Text.Json;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class CvChunkRepo : BaseRepo<long, CvChunk>, ICvChunkRepo
{
    private readonly SrisDbContext _db;

    public CvChunkRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<bool> HasEmbeddedChunksAsync(long companyId, long cvId)
    {
        // Cột embedding không map EF -> kiểm bằng raw SQL (5.11).
        var count = await _db.Database
            .SqlQueryRaw<int>(
                "SELECT COUNT(*) AS Value FROM CvChunk " +
                "WHERE cv_id = {0} AND company_id = {1} AND embedding IS NOT NULL",
                cvId, companyId)
            .SingleAsync();
        return count > 0;
    }

    public async Task ReplaceChunksAsync(
        long companyId, long cvId, IReadOnlyList<(string Content, float[] Embedding)> chunks)
    {
        await _db.CvChunks.Where(c => c.CvId == cvId).ExecuteDeleteAsync();

        for (var i = 0; i < chunks.Count; i++)
        {
            var chunk = new CvChunk
            {
                CompanyId = companyId,
                CvId = cvId,
                ChunkIndex = i,
                Content = chunks[i].Content
            };
            _db.CvChunks.Add(chunk);
            await _db.SaveChangesAsync();

            var vectorJson = JsonSerializer.Serialize(chunks[i].Embedding);
            await _db.Database.ExecuteSqlRawAsync(
                "UPDATE CvChunk SET embedding = CAST({0} AS VECTOR(1024)) " +
                "WHERE chunk_id = {1} AND company_id = {2}",
                vectorJson, chunk.ChunkId, companyId);
        }
    }
}
