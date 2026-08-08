namespace GP35.SRIS.Application.Contracts.Dtos;

/// <summary>
/// Admin cấu hình brand công ty (logo + màu hiển thị trên Career Site/Portal). Slug KHÔNG đổi
/// được ở đây (là URL công khai, cố định). Trường null = giữ nguyên giá trị hiện tại.
/// </summary>
public class UpdateBrandDto
{
    public string? Name { get; set; }
    public string? LogoUrl { get; set; }
    public string? PrimaryColor { get; set; }

    // Liên hệ in ở đầu thư mời nhận việc (5.15). Nhập 1 lần, mọi thư sau đều tự có.
    public string? Address { get; set; }
    public string? ContactEmail { get; set; }
    public string? Phone { get; set; }
}
