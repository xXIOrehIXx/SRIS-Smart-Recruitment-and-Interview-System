using GP35.SRIS.Application.Contracts.Dtos.Candidate.Offer;

namespace GP35.SRIS.Application.Contracts.Services.CandidatePortal;

/// <summary>
/// Ứng viên xem/tải THƯ MỜI NHẬN VIỆC qua magic link OFFER_RESPONSE (docs 5.15). Không login,
/// không thao tác: không còn nút Đồng ý/Từ chối — ứng viên trả lời nhà tuyển dụng ngoài hệ thống,
/// Human Resource/DM ghi nhận kết quả trong Portal.
///
/// Vì thế token KHÔNG bị đốt khi mở: ứng viên phải xem/tải lại được thư trong suốt thời gian hiệu lực.
/// </summary>
public interface ICandidateOfferService : IBaseService
{
    /// <summary>Bản tóm tắt thư mời để hiện trên trang (vị trí, lương, ngày bắt đầu, liên hệ HR).</summary>
    Task<CandidateOfferDto> GetOfferAsync(string rawToken);

    /// <summary>File PDF thư mời nhận việc để ứng viên xem/tải.</summary>
    Task<(byte[] Content, string FileName)> GetLetterPdfAsync(string rawToken);
}
