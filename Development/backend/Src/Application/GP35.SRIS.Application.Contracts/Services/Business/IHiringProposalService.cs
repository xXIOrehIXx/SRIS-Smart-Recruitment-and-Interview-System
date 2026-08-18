using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Đề xuất tuyển (docs 5.14 — V043): Trưởng bộ phận đề xuất, GIÁM ĐỐC quyết.
/// Duyệt đề xuất là hành động DUY NHẤT đẩy hồ sơ INTERVIEW→OFFER trong luồng bình thường.
/// </summary>
public interface IHiringProposalService
{
    /// <summary>DM đề xuất tuyển 1 hồ sơ đang ở bước Phỏng vấn (cần ≥1 phiếu chấm đã nộp — G2).</summary>
    Task<HiringProposalDto> CreateAsync(long companyId, long userId, long applicationId, CreateProposalDto dto);

    /// <summary>Giám đốc duyệt/từ chối. Duyệt -> hồ sơ sang OFFER kèm điều khoản đã chốt.</summary>
    Task<HiringProposalDto> DecideAsync(long companyId, long userId, long proposalId, DecideProposalDto dto);

    /// <summary>Hàng đợi đề xuất của công ty (?status=PENDING để lọc).</summary>
    Task<IReadOnlyList<HiringProposalDto>> GetListAsync(long companyId, string? status);

    /// <summary>Lịch sử đề xuất của 1 hồ sơ (mới nhất trước).</summary>
    Task<IReadOnlyList<HiringProposalDto>> GetByApplicationAsync(long companyId, long applicationId);
}
