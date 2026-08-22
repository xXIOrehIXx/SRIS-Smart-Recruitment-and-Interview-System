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

    /// <summary>
    /// Danh sách job CÒN NHẬN hồ sơ (Status = "Open" và chưa quá hạn nộp) của công ty.
    /// Tin quá hạn không lên danh sách nhưng vẫn mở được bằng link trực tiếp
    /// (xem <see cref="GetPublicJobAsync"/>).
    /// </summary>
    Task<IEnumerable<PublicJobDto>> ListOpenJobsAsync(long companyId);

    /// <summary>
    /// Chi tiết một tin công khai. Trả cả tin ĐÃ QUÁ HẠN (kèm <c>IsExpired = true</c>) để ứng viên
    /// mở link cũ vẫn đọc được nội dung và thấy rõ là hết hạn, thay vì ăn 404.
    /// Null nếu không tồn tại hoặc bị đóng khi CHƯA tới hạn (nhà tuyển dụng chủ động gỡ tin).
    /// </summary>
    Task<PublicJobDto?> GetPublicJobAsync(long companyId, long jobId);

    /// <summary>
    /// Ứng viên nộp CV (PDF) cho một job: tạo Candidate/Application + parse + chấm điểm nội bộ.
    /// Bắt buộc tên + email + số điện thoại. Trả xác nhận, KHÔNG trả điểm AI.
    /// </summary>
    Task<PublicApplyResultDto> ApplyAsync(
        long companyId, long jobId, string candidateName, string candidateEmail, string candidatePhone,
        string fileName, string? mimeType, byte[] fileBytes);
}
