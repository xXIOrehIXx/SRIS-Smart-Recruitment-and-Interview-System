using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>Đọc hồ sơ ứng tuyển cho màn Kanban + chi tiết ứng viên (read-only).</summary>
public interface IApplicationQueryService : IBaseService
{
    /// <summary>Toàn bộ hồ sơ của 1 job cho Kanban (FE nhóm theo state thành 4 pha — 5.16).</summary>
    Task<ApplicationBoardDto> GetBoardByJobAsync(long companyId, long jobId);

    /// <summary>Chi tiết 1 hồ sơ (404 nếu không thuộc company).</summary>
    Task<ApplicationDetailDto> GetDetailAsync(long companyId, long applicationId);
}
