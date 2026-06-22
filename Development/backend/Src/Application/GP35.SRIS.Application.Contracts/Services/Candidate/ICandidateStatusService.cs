using GP35.SRIS.Application.Contracts.Dtos.Candidate.Status;

namespace GP35.SRIS.Application.Contracts.Services.CandidatePortal;

/// <summary>
/// Ứng viên tự xem trạng thái hồ sơ qua magic link STATUS (docs 5.13). Không login, chỉ đọc —
/// token KHÔNG bị đốt (xem lại nhiều lần trong TTL ~30 ngày). Không lộ dữ liệu nội bộ.
/// </summary>
public interface ICandidateStatusService : IBaseService
{
    /// <summary>Trạng thái hồ sơ (bước hiện tại + thông điệp thân thiện).</summary>
    Task<CandidateStatusDto> GetStatusAsync(string rawToken);
}
