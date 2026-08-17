using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;
using GP35.SRIS.Domain.Repos;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>Đọc hồ sơ ứng tuyển cho màn Kanban + chi tiết ứng viên (read-only).</summary>
public interface IApplicationQueryService : IBaseService
{
    /// <summary>
    /// Toàn bộ hồ sơ của 1 job cho Kanban (FE nhóm theo state thành 4 pha — 5.16), kèm kết quả
    /// sàng lọc CV. <paramref name="sort"/> = <see cref="BoardSort.Fit"/> thì phù hợp cao lên đầu.
    /// </summary>
    Task<ApplicationBoardDto> GetBoardByJobAsync(
        long companyId, long jobId, BoardSort sort = BoardSort.Recent);

    /// <summary>Chi tiết 1 hồ sơ (404 nếu không thuộc company).</summary>
    Task<ApplicationDetailDto> GetDetailAsync(long companyId, long applicationId);
}
