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
        // rồi cập nhật riêng vector bằng raw SQL nếu có (CAST JSON -> VECTOR(1024)).
        _db.CvDocuments.Add(cv);
        await _db.SaveChangesAsync();

        if (embedding is { Length: > 0 })
        {
            var vectorJson = JsonSerializer.Serialize(embedding);
            await _db.Database.ExecuteSqlRawAsync(
                "UPDATE CvDocument SET embedding = CAST({0} AS VECTOR(1024)) " +
                "WHERE cv_id = {1} AND company_id = {2}",
                vectorJson, cv.CvId, cv.CompanyId);
        }

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

    public async Task UpdateEmbeddingAsync(long companyId, long cvId, float[] embedding)
    {
        // CAST chuỗi JSON -> VECTOR(1024) ở phía SQL Server (cửa thoát raw SQL — 5.11).
        var vectorJson = JsonSerializer.Serialize(embedding);
        await _db.Database.ExecuteSqlRawAsync(
            "UPDATE CvDocument SET embedding = CAST({0} AS VECTOR(1024)), updated_at = SYSUTCDATETIME() " +
            "WHERE cv_id = {1} AND company_id = {2}",
            vectorJson, cvId, companyId);
    }

    public async Task<IReadOnlyList<TalentPoolRow>> GetTalentPoolByJobAsync(
        long companyId, long jobId, int withinMonths, int topN)
    {
        // VECTOR_DISTANCE đo ngay trong SQL Server (cột embedding Ignore ở EF -> cửa thoát raw SQL 5.11).
        // Đảo chiều truy vấn chấm CV: 1 JD -> quét kho CvDocument cũ. company_id kèm mọi bảng (cô lập tenant);
        // bỏ CV chưa parse (embedding NULL), CV quá "cũ", CV đã ứng vào chính job này, và ỨNG VIÊN ĐÃ ĐƯỢC
        // TUYỂN (HIRED) ở bất kỳ job nào trong công ty (đã là nhân viên -> không gợi ý lại).
        var rows = await _db.Database
            .SqlQueryRaw<TalentPoolRow>(
                "SELECT TOP({3}) c.cv_id AS CvId, c.candidate_id AS CandidateId, cand.full_name AS CandidateName, " +
                "       c.created_at AS UploadedAt, " +
                "       VECTOR_DISTANCE('cosine', c.embedding, j.embedding) AS Distance " +
                "FROM CvDocument c " +
                "JOIN Job j ON j.job_id = {1} AND j.company_id = {0} " +
                "JOIN Candidate cand ON cand.candidate_id = c.candidate_id AND cand.company_id = {0} " +
                "WHERE c.company_id = {0} " +
                "  AND c.embedding IS NOT NULL " +
                "  AND c.created_at >= DATEADD(MONTH, -{2}, SYSUTCDATETIME()) " +
                "  AND NOT EXISTS (SELECT 1 FROM Application a " +
                "                  WHERE a.cv_id = c.cv_id AND a.job_id = {1} AND a.company_id = {0}) " +
                "  AND NOT EXISTS (SELECT 1 FROM Application h " +
                "                  WHERE h.candidate_id = c.candidate_id AND h.company_id = {0} " +
                "                    AND h.current_state = 'HIRED') " +
                "ORDER BY Distance ASC",
                companyId, jobId, withinMonths, topN)
            .ToListAsync();

        return rows;
    }
}
