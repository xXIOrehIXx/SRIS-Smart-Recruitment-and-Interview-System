namespace GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;

/// <summary>Yêu cầu chuyển hồ sơ sang 1 state (state machine — 5.8). Reason bắt buộc khi REJECTED.</summary>
public class TransitionRequestDto
{
    /// <summary>State đích: SCREENING | QUIZ | INTERVIEW | OFFER | HIRED | REJECTED.</summary>
    public string ToState { get; set; } = null!;

    /// <summary>Lý do (bắt buộc khi reject; 1-chạm chip preset — 5.7).</summary>
    public string? Reason { get; set; }
}

/// <summary>Yêu cầu loại hồ sơ — reject_reason bắt buộc (5.7).</summary>
public class RejectRequestDto
{
    public string Reason { get; set; } = null!;
}

/// <summary>Kết quả sau khi chuyển state.</summary>
public class ApplicationStateDto
{
    public long ApplicationId { get; set; }
    public string FromState { get; set; } = null!;
    public string ToState { get; set; } = null!;
    public DateTime ChangedAt { get; set; }
}
