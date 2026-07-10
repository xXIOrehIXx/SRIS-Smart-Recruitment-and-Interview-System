using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Đặt lịch phỏng vấn theo POOL DÙNG CHUNG — phía Recruiter (docs Section 15). Mở 1 pool khung cho
/// job + vòng, mời nhiều ứng viên (mỗi người 1 magic link SCHEDULE), ai chốt trước lấy trước.
/// Nhiều vòng = dữ liệu trong INTERVIEW (5.12), không thêm state.
/// </summary>
public interface IInterviewPoolService : IBaseService
{
    /// <summary>Mở 1 pool khung dùng chung cho 1 job + vòng. Chưa gửi email (chưa mời ai).</summary>
    Task<PoolDto> CreatePoolAsync(long companyId, long userId, long jobId, CreatePoolDto dto);

    /// <summary>Mời 1 danh sách ứng viên vào pool: tạo invite + phát magic link SCHEDULE (tự gửi email).</summary>
    Task<InviteResultDto> InviteAsync(long companyId, long userId, long poolId, InvitePoolDto dto);

    /// <summary>Mọi pool của 1 job kèm khung + danh sách ứng viên đã mời (có cờ nhắc gọi điện).</summary>
    Task<IReadOnlyList<PoolDto>> GetPoolsByJobAsync(long companyId, long jobId);

    /// <summary>Hủy pool: khóa khung + hủy invite chờ + email báo ứng viên đã chốt (best-effort).</summary>
    Task CancelPoolAsync(long companyId, long userId, long poolId, CancelPoolDto dto);

    /// <summary>
    /// Recruiter chốt lịch TAY cho 1 ứng viên (nhánh gọi điện — không qua pool/magic link). Trả schedule_id
    /// để interviewer chấm điểm được. Chỉ khi hồ sơ đang ở INTERVIEW.
    /// </summary>
    Task<long> ManualConfirmAsync(long companyId, long userId, long applicationId, ManualConfirmDto dto);
}
