using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

public interface ICandidateRepo : IBaseRepo<long, Candidate>
{
    /// <summary>Tìm ứng viên theo email trong phạm vi 1 công ty (để tránh tạo trùng).</summary>
    Task<Candidate?> GetByEmailAsync(long companyId, string email);

    /// <summary>Thêm ứng viên, trả về candidate_id vừa sinh.</summary>
    Task<long> InsertAsync(long companyId, Candidate candidate);
}
