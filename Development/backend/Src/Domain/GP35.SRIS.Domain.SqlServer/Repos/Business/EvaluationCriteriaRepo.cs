using System.Text.Json;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class EvaluationCriteriaRepo : BaseRepo<long, EvaluationCriteria>, IEvaluationCriteriaRepo
{
    private readonly SrisDbContext _db;

    public EvaluationCriteriaRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<long> InsertAsync(long companyId, EvaluationCriteria criteria)
    {
        criteria.CompanyId = companyId;
        _db.EvaluationCriterias.Add(criteria);
        await _db.SaveChangesAsync();
        return criteria.CriteriaId;
    }

    public async Task<IReadOnlyList<EvaluationCriteria>> GetByJobAsync(
        long companyId, long jobId, bool activeOnly, bool approvedOnly = true)
    {
        var q = _db.EvaluationCriterias.AsNoTracking().Where(c => c.JobId == jobId);
        if (activeOnly) q = q.Where(c => c.Active);
        if (approvedOnly) q = q.Where(c => c.Status == CriteriaStatus.Approved);
        return await q.OrderBy(c => c.CriteriaId).ToListAsync();
    }

    public async Task<EvaluationCriteria?> GetByIdAsync(long companyId, long criteriaId)
    {
        return await _db.EvaluationCriterias.AsNoTracking().FirstOrDefaultAsync(c => c.CriteriaId == criteriaId);
    }

    public async Task<int> UpdateAsync(long companyId, long criteriaId, string name, decimal weight,
        decimal maxScore, bool active, string criteriaType, bool cvMatchable, string? keywords)
    {
        var rows = await _db.EvaluationCriterias
            .Where(c => c.CriteriaId == criteriaId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.Name, name)
                .SetProperty(c => c.Weight, weight)
                .SetProperty(c => c.MaxScore, maxScore)
                .SetProperty(c => c.Active, active)
                .SetProperty(c => c.CriteriaType, criteriaType)
                .SetProperty(c => c.CvMatchable, cvMatchable)
                .SetProperty(c => c.Keywords, keywords)
                .SetProperty(c => c.UpdatedAt, DateTime.UtcNow));

        // Nội dung đổi -> embedding cũ (nếu có) không còn khớp -> xóa để lần chấm sau embed lại.
        if (rows > 0)
        {
            await _db.Database.ExecuteSqlRawAsync(
                "UPDATE EvaluationCriteria SET embedding = NULL WHERE criteria_id = {0} AND company_id = {1}",
                criteriaId, companyId);
        }
        return rows;
    }

    public async Task<int> DeleteDraftsAsync(long companyId, long jobId)
    {
        return await _db.EvaluationCriterias
            .Where(c => c.JobId == jobId && c.Status == CriteriaStatus.Draft)
            .ExecuteDeleteAsync();
    }

    public async Task<int> ApproveDraftsAsync(long companyId, long jobId, long userId)
    {
        return await _db.EvaluationCriterias
            .Where(c => c.JobId == jobId && c.Status == CriteriaStatus.Draft)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.Status, CriteriaStatus.Approved)
                .SetProperty(c => c.ApprovedBy, userId)
                .SetProperty(c => c.ApprovedAt, DateTime.UtcNow)
                .SetProperty(c => c.UpdatedAt, DateTime.UtcNow));
    }

    public async Task<IReadOnlyList<long>> GetSoftCriteriaNeedingEmbeddingAsync(long companyId, long jobId)
    {
        // Cột embedding không map EF -> kiểm NULL bằng raw SQL (cửa thoát 5.11).
        return await _db.Database
            .SqlQueryRaw<long>(
                "SELECT criteria_id AS Value FROM EvaluationCriteria " +
                "WHERE company_id = {0} AND job_id = {1} AND active = 1 " +
                "  AND status = 'APPROVED' AND cv_matchable = 1 AND criteria_type = 'SOFT' " +
                "  AND embedding IS NULL",
                companyId, jobId)
            .ToListAsync();
    }

    public async Task UpdateEmbeddingAsync(long companyId, long criteriaId, float[] embedding)
    {
        var vectorJson = JsonSerializer.Serialize(embedding);
        await _db.Database.ExecuteSqlRawAsync(
            "UPDATE EvaluationCriteria SET embedding = CAST({0} AS VECTOR(1024)) " +
            "WHERE criteria_id = {1} AND company_id = {2}",
            vectorJson, criteriaId, companyId);
    }

    public async Task<IReadOnlyList<SoftCriterionMatch>> GetBestChunkPerSoftCriterionAsync(
        long companyId, long jobId, long cvId)
    {
        // Mỗi tiêu chí SOFT đi tìm đoạn CV gần nhất (CROSS APPLY + VECTOR_DISTANCE trong SQL Server).
        return await _db.Database
            .SqlQueryRaw<SoftCriterionMatch>(
                "SELECT c.criteria_id AS CriteriaId, ca.d AS Distance, ca.content AS Content " +
                "FROM EvaluationCriteria c " +
                "CROSS APPLY (SELECT TOP(1) ch.content, " +
                "                    VECTOR_DISTANCE('cosine', ch.embedding, c.embedding) AS d " +
                "             FROM CvChunk ch " +
                "             WHERE ch.cv_id = {2} AND ch.company_id = {0} AND ch.embedding IS NOT NULL " +
                "             ORDER BY d ASC) ca " +
                "WHERE c.company_id = {0} AND c.job_id = {1} AND c.active = 1 " +
                "  AND c.status = 'APPROVED' AND c.cv_matchable = 1 AND c.criteria_type = 'SOFT' " +
                "  AND c.embedding IS NOT NULL",
                companyId, jobId, cvId)
            .ToListAsync();
    }
}
