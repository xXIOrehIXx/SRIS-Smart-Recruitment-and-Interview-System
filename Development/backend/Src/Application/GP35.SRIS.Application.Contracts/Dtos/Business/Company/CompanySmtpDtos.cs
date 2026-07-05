namespace GP35.SRIS.Application.Contracts.Dtos;

/// <summary>Cấu hình SMTP của công ty (đọc) — KHÔNG trả mật khẩu thật, chỉ cờ đã đặt hay chưa.</summary>
public class CompanySmtpDto
{
    public string? Host { get; set; }
    public int? Port { get; set; }
    public string? Username { get; set; }
    public string? FromEmail { get; set; }
    /// <summary>Đã lưu mật khẩu SMTP hay chưa (không lộ giá trị).</summary>
    public bool HasPassword { get; set; }
    /// <summary>Đã cấu hình đủ để gửi (có Host) hay chưa. False = đang fallback SMTP global.</summary>
    public bool Configured { get; set; }
}

/// <summary>Admin cập nhật SMTP riêng của công ty. Password để TRỐNG = giữ nguyên mật khẩu cũ.</summary>
public class UpdateSmtpDto
{
    public string? Host { get; set; }
    public int? Port { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string? FromEmail { get; set; }
}

/// <summary>Gửi email thử để kiểm tra cấu hình SMTP.</summary>
public class SendTestEmailDto
{
    public string ToEmail { get; set; } = null!;
}
