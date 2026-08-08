using GP35.SRIS.Application.Contracts.Dtos.Business.Cv;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// NHẬN hồ sơ: PDF -> text -> lưu file gốc + CvDocument + Application (NEW).
/// Không chấm điểm, không xếp hạng — sàng lọc là việc của con người (bộ tiêu chí ở 5.18
/// chỉ dùng cho phiếu chấm phỏng vấn).
/// </summary>
public interface ICvIntakeService : IBaseService
{
    /// <summary>
    /// Nộp CV dạng FILE PDF cho một job. File hỏng / scan ảnh -> trả FAILED / NEEDS_MANUAL_EDIT
    /// và KHÔNG tạo hồ sơ (CvDocument vẫn được lưu để người dùng biết đã nộp gì).
    /// </summary>
    Task<CvUploadResultDto> UploadCvAsync(
        long companyId, long jobId, string candidateName, string candidateEmail, string? candidatePhone,
        string fileName, string? mimeType, byte[] fileBytes);

    /// <summary>
    /// Tạo URL tải tạm thời (presigned) để xem/tải lại file CV gốc của 1 cv_id.
    /// Trả về null nếu CV không tồn tại hoặc không có file gốc.
    /// </summary>
    Task<string?> GetCvFileUrlAsync(long companyId, long cvId);
}
