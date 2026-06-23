using GP35.SRIS.Application.Contracts.Dtos.CareerSite;

namespace GP35.SRIS.Application.Contracts.Services.CandidatePortal;

/// <summary>
/// Career Site công khai (M1) — luồng ứng viên ẩn danh: xem brand, xem job đang mở, nộp CV.
/// Tenant đã được giải qua slug ở middleware (companyId truyền vào). Không lộ dữ liệu nội bộ
/// (điểm AI, embedding).
/// </summary>
public interface ICareerSiteService : IBaseService
{
    /// <summary>Brand công khai (tên/logo/màu) để Career Site render.</summary>
    Task<PublicBrandDto?> GetBrandAsync(long companyId);

    /// <summary>Danh sách job đang mở (Status = "Open") của công ty.</summary>
    Task<IEnumerable<PublicJobDto>> ListOpenJobsAsync(long companyId);

    /// <summary>Chi tiết một job đang mở. Null nếu không tồn tại hoặc đã đóng.</summary>
    Task<PublicJobDto?> GetOpenJobAsync(long companyId, long jobId);

    /// <summary>
    /// Ứng viên nộp CV (PDF) cho một job: tạo Candidate/Application + parse + chấm điểm nội bộ.
    /// Bắt buộc tên + email + số điện thoại. Trả xác nhận, KHÔNG trả điểm AI.
    /// </summary>
    Task<PublicApplyResultDto> ApplyAsync(
        long companyId, long jobId, string candidateName, string candidateEmail, string candidatePhone,
        string fileName, string? mimeType, byte[] fileBytes);
}
