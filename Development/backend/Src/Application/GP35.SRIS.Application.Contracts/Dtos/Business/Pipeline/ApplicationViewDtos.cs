namespace GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;

/// <summary>
/// 1 card ứng viên trên Kanban (5.16). FE tự nhóm theo <see cref="CurrentState"/> vào 4 pha hiển thị:
/// NEW=Hồ sơ mới · SCREENING=Sàng lọc · INTERVIEW=Phỏng vấn · OFFER/HIRED/REJECTED=Quyết định.
/// </summary>
public class ApplicationCardDto
{
    public long ApplicationId { get; set; }
    public long CandidateId { get; set; }
    public string CandidateName { get; set; } = null!;
    public string CandidateEmail { get; set; } = null!;
    public string CurrentState { get; set; } = null!;
    public long CvId { get; set; }
    public DateTime? AppliedAt { get; set; }

    // --- Sàng lọc CV bằng AI (V046) -----------------------------------------
    // Đưa lên card để người tuyển dụng biết nên đọc hồ sơ nào trước. Vẫn là THAM KHẢO:
    // không đường code nào đọc mấy trường này rồi tự đổi trạng thái hồ sơ.

    /// <summary>null = chưa phân tích bao giờ. Ngoài ra: PENDING | RUNNING | DONE | FAILED.</summary>
    public string? ScreeningStatus { get; set; }

    /// <summary>0-100, chỉ có khi lượt sàng lọc đã DONE. null = chưa có điểm, KHÔNG phải điểm 0.</summary>
    public int? FitScore { get; set; }

    /// <summary>PROCEED | CONSIDER | REJECT — đề xuất của AI, chỉ có khi DONE.</summary>
    public string? ScreeningDecision { get; set; }
}

/// <summary>Toàn bộ hồ sơ của 1 job cho màn Kanban.</summary>
public class ApplicationBoardDto
{
    public long JobId { get; set; }

    /// <summary>Thứ tự đã áp dụng: "recent" (mới nộp trước) | "fit" (phù hợp cao trước).</summary>
    public string Sort { get; set; } = "recent";

    public List<ApplicationCardDto> Applications { get; set; } = new();
}

/// <summary>Chi tiết 1 hồ sơ cho màn xem ứng viên (không lộ điểm phỏng vấn khi chưa submit — blind review 5.7).</summary>
public class ApplicationDetailDto
{
    public long ApplicationId { get; set; }
    public string CurrentState { get; set; } = null!;
    public string? RejectReason { get; set; }
    public DateTime? AppliedAt { get; set; }
    public DateTime? StageUpdatedAt { get; set; }

    public long CandidateId { get; set; }
    public string CandidateName { get; set; } = null!;
    public string CandidateEmail { get; set; } = null!;
    public string? CandidatePhone { get; set; }
    public string? CandidateSource { get; set; }

    public long JobId { get; set; }
    public string JobTitle { get; set; } = null!;

    public long CvId { get; set; }
    public string? CvFileName { get; set; }
    public string CvParseStatus { get; set; } = null!;
}
