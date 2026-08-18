namespace GP35.SRIS.Application.Contracts.Dtos.Business.Cv;

/// <summary>
/// Thông tin bóc từ file CV để ĐIỀN SẴN form nhận hồ sơ (V047). Trường nào không chắc thì null —
/// người nhận hồ sơ vẫn nhìn và sửa trước khi lưu, nên ô trống an toàn hơn một giá trị đoán bừa.
/// </summary>
public class CvContactPreviewDto
{
    public string? CandidateName { get; set; }
    public string? CandidateEmail { get; set; }
    public string? CandidatePhone { get; set; }

    /// <summary>false = PDF scan ảnh, không có chữ để bóc; FE nói rõ thay vì im lặng để trống.</summary>
    public bool HasText { get; set; }
}
