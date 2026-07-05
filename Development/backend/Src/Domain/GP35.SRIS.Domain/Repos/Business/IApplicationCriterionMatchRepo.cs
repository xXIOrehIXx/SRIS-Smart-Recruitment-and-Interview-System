using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>1 dòng kết quả khớp/thiếu kèm thông tin tiêu chí (join sẵn cho màn hiển thị).</summary>
public record CriterionMatchRow(
    long CriteriaId, string CriteriaName, string CriteriaType, bool CvMatchable,
    decimal Weight, bool Matched, decimal? Similarity, string? Evidence, DateTime EvaluatedAt);

/// <summary>Kết quả chấm CV theo từng tiêu chí (docs 5.18).</summary>
public interface IApplicationCriterionMatchRepo : IBaseRepo<long, ApplicationCriterionMatch>
{
    /// <summary>Chấm lại = thay trọn bộ kết quả của hồ sơ (xóa cũ, ghi mới).</summary>
    Task ReplaceForApplicationAsync(long companyId, long applicationId, IReadOnlyList<ApplicationCriterionMatch> matches);

    /// <summary>Kết quả khớp/thiếu + bằng chứng của 1 hồ sơ (kèm tên/loại/trọng số tiêu chí).</summary>
    Task<IReadOnlyList<CriterionMatchRow>> GetByApplicationAsync(long companyId, long applicationId);
}
