namespace GP35.SRIS.Application.Contracts.Dtos.Candidate.Status;

/// <summary>
/// Trạng thái hồ sơ như ứng viên thấy qua magic link STATUS (docs 5.13). CHỈ thông tin an toàn cho
/// ứng viên — KHÔNG lộ dữ liệu nội bộ (reject_reason, điểm chấm, ghi chú). Link STATUS chỉ để xem,
/// không "chốt" gì nên token KHÔNG bị đốt (xem lại nhiều lần trong TTL).
/// </summary>
public class CandidateStatusDto
{
    public string CandidateName { get; set; } = null!;
    public string JobTitle { get; set; } = null!;

    /// <summary>State chuẩn (NEW/SCREENING/INTERVIEW/OFFER/HIRED/REJECTED) — cho FE render progress.</summary>
    public string CurrentStage { get; set; } = null!;
    /// <summary>Nhãn thân thiện của bước hiện tại (vd "Vòng phỏng vấn").</summary>
    public string StageLabel { get; set; } = null!;
    /// <summary>Thông điệp lịch sự cho ứng viên theo bước hiện tại.</summary>
    public string StatusMessage { get; set; } = null!;

    /// <summary>Hồ sơ đã chốt (HIRED hoặc REJECTED) — không còn tiến nữa.</summary>
    public bool IsClosed { get; set; }
    /// <summary>Đã trúng tuyển.</summary>
    public bool IsHired { get; set; }

    /// <summary>Lần cập nhật trạng thái gần nhất.</summary>
    public DateTime? UpdatedAt { get; set; }
}
