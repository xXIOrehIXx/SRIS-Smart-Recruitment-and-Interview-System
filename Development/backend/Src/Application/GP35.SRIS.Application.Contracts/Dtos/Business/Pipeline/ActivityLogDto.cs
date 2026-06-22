namespace GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;

/// <summary>
/// 1 dòng lịch sử hồ sơ (audit). Action vd STATE_CHANGE / INTERVIEW_REQUEST_CREATED / OFFER_MADE...
/// From/ToState chỉ có ở chuyển state. ActorEmail null = hệ thống/ứng viên (qua magic link).
/// </summary>
public class ActivityLogDto
{
    public long LogId { get; set; }
    public long? ActorId { get; set; }
    public string? ActorEmail { get; set; }
    public string Action { get; set; } = null!;
    public string? FromState { get; set; }
    public string? ToState { get; set; }
    public string? Detail { get; set; }
    public DateTime? CreatedAt { get; set; }
}
