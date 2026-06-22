using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Ghi chú nội bộ trên hồ sơ (docs: "Activity Log & Internal Notes"). Nội bộ HR/Interviewer/DM,
/// KHÔNG gửi ứng viên. Khác reject_reason (lý do loại, cũng nội bộ nhưng gắn 1 lần lúc reject).
/// </summary>
public interface IInternalNoteService : IBaseService
{
    /// <summary>Thêm 1 ghi chú vào hồ sơ. Trả về ghi chú vừa tạo.</summary>
    Task<InternalNoteDto> AddAsync(long companyId, long userId, long applicationId, CreateNoteDto dto);

    /// <summary>Các ghi chú của 1 hồ sơ (mới nhất trước).</summary>
    Task<IReadOnlyList<InternalNoteDto>> GetByApplicationAsync(long companyId, long applicationId);
}
