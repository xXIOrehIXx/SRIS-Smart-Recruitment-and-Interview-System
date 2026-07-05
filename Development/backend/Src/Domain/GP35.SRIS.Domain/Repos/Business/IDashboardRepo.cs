namespace GP35.SRIS.Domain.Repos;

/// <summary>Số hồ sơ theo 1 state (phục vụ funnel).</summary>
public record StateCount(string State, int Count);

/// <summary>Số hồ sơ theo 1 nhãn (lý do loại / nguồn ứng viên / trạng thái offer).</summary>
public record LabelCount(string? Label, int Count);

/// <summary>1 card ứng viên trong Kanban board (tầng Domain).</summary>
public record KanbanCard(
    long ApplicationId,
    long CandidateId,
    string CandidateName,
    string CandidateEmail,
    string JobTitle,
    long JobId,
    string CurrentState,
    decimal? AiMatchScore,
    DateTime AppliedAt,
    DateTime? StageUpdatedAt);

/// <summary>
/// Truy vấn tổng hợp cho Dashboard/Analytics (docs 4, M7). Mọi truy vấn tự kèm company_id
/// (Global Query Filter) — cô lập tenant. jobId null = toàn công ty; có giá trị = lọc theo 1 job.
/// </summary>
public interface IDashboardRepo
{
    /// <summary>Phễu tuyển dụng: số hồ sơ theo từng state.</summary>
    Task<IReadOnlyList<StateCount>> GetFunnelAsync(long companyId, long? jobId);

    /// <summary>Phân rã lý do loại (chỉ hồ sơ REJECTED có reject_reason) — dashboard "tại sao rớt".</summary>
    Task<IReadOnlyList<LabelCount>> GetRejectReasonsAsync(long companyId, long? jobId);

    /// <summary>Phân rã nguồn ứng viên (Candidate.source).</summary>
    Task<IReadOnlyList<LabelCount>> GetSourceBreakdownAsync(long companyId, long? jobId);

    /// <summary>Số offer theo trạng thái (PENDING/ACCEPTED/DECLINED) — tính offer acceptance rate.</summary>
    Task<IReadOnlyList<LabelCount>> GetOfferStatusCountsAsync(long companyId, long? jobId);

    /// <summary>Số ngày từ lúc nộp (created_at) -> tuyển (hired_at) của mỗi hồ sơ HIRED — tính time-to-hire.</summary>
    Task<IReadOnlyList<double>> GetHireDurationDaysAsync(long companyId, long? jobId);

    /// <summary>Lấy danh sách ứng viên theo state cho Kanban board.</summary>
    Task<IReadOnlyList<KanbanCard>> GetKanbanCardsAsync(long companyId, long? jobId);
}
