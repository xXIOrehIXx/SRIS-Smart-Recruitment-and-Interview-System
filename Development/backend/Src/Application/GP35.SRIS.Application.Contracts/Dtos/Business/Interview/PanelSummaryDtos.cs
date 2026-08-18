namespace GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

/// <summary>
/// Kết quả AI tổng hợp ý kiến hội đồng phỏng vấn của 1 hồ sơ (V047).
/// Chỉ có khi lượt tổng hợp ở trạng thái DONE.
/// <para>
/// KHÔNG có trường kết luận tuyển/không tuyển — cố ý. AI đọc hộ các phiếu; người quyết vẫn
/// đọc phiếu gốc bên dưới rồi tự chốt (Trưởng bộ phận đề xuất, Giám đốc quyết — V043).
/// </para>
/// </summary>
public class PanelSummaryResultDto
{
    /// <summary>3-5 câu tổng hợp cả hội đồng nhìn nhận ứng viên thế nào.</summary>
    public string Consensus { get; set; } = null!;

    /// <summary>Nhận định từ 2 người phỏng vấn trở lên cùng nêu. Rỗng khi chỉ có 1 phiếu.</summary>
    public List<string> Agreements { get; set; } = [];

    /// <summary>Chỗ các phiếu nói ngược nhau — thứ người quyết cần nhìn thấy nhất.</summary>
    public List<string> Disagreements { get; set; } = [];

    /// <summary>Điều còn bỏ ngỏ, nên hỏi thêm trước khi chốt.</summary>
    public List<string> OpenQuestions { get; set; } = [];

    /// <summary>Số phiếu AI đã đọc lúc sinh bản tóm tắt này.</summary>
    public int SourceVerdictCount { get; set; }
}

/// <summary>
/// Trạng thái lượt tổng hợp gần nhất của 1 hồ sơ. FE hỏi lại tới khi <c>running=false</c>,
/// rồi đọc <see cref="Result"/> (DONE) hoặc <see cref="ErrorMessage"/> (FAILED).
/// </summary>
public class PanelSummaryStatusDto
{
    public long ApplicationId { get; set; }

    /// <summary>NONE | PENDING | RUNNING | DONE | FAILED. NONE = chưa bao giờ tổng hợp.</summary>
    public string Status { get; set; } = null!;

    /// <summary>true khi PENDING/RUNNING — FE còn phải hỏi lại.</summary>
    public bool Running { get; set; }

    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }

    public PanelSummaryResultDto? Result { get; set; }

    public DateTime? RequestedAt { get; set; }
    public DateTime? FinishedAt { get; set; }

    /// <summary>
    /// Số phiếu chấm ĐÃ NỘP của hồ sơ ngay lúc hỏi. Nhiều hơn
    /// <c>Result.SourceVerdictCount</c> nghĩa là có người nộp phiếu sau khi tổng hợp — FE nhắc
    /// người dùng bấm tổng hợp lại thay vì để họ đọc một bản thiếu phiếu mà không biết.
    /// </summary>
    public int CurrentVerdictCount { get; set; }
}
