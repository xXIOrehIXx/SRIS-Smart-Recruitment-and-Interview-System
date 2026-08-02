namespace GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;

/// <summary>Yêu cầu chuyển hồ sơ sang 1 state (state machine — 5.8).</summary>
public class TransitionRequestDto
{
    /// <summary>State đích: SCREENING | INTERVIEW | OFFER | HIRED | REJECTED.</summary>
    public string ToState { get; set; } = null!;

    /// <summary>Lý do — TÙY CHỌN, kể cả khi reject (1-chạm chip preset — 5.7).</summary>
    public string? Reason { get; set; }
}

/// <summary>Yêu cầu loại hồ sơ — reject_reason tùy chọn (5.7).</summary>
public class RejectRequestDto
{
    // Phải để nullable: kiểu tham chiếu non-nullable bị ASP.NET coi là bắt buộc ngầm,
    // gửi body không có reason sẽ dính lỗi model validation trước cả khi vào service.
    public string? Reason { get; set; }
}

/// <summary>Kết quả sau khi chuyển state.</summary>
public class ApplicationStateDto
{
    public long ApplicationId { get; set; }
    public string FromState { get; set; } = null!;
    public string ToState { get; set; } = null!;
    public DateTime ChangedAt { get; set; }
}
