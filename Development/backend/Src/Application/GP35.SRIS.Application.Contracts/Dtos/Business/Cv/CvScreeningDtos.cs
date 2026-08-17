namespace GP35.SRIS.Application.Contracts.Dtos.Business.Cv;

/// <summary>1 yêu cầu của tin tuyển dụng mà CV chứng minh được, kèm câu trích từ CV.</summary>
public class MatchedRequirementDto
{
    public string Requirement { get; set; } = null!;

    /// <summary>
    /// Câu/cụm trích từ CV. Đây là dây neo chống bịa: người đọc kiểm chứng ngay trên màn hình
    /// mà không phải mở lại file PDF, nên FE PHẢI hiện nó cạnh tên yêu cầu, không được ẩn đi.
    /// </summary>
    public string Evidence { get; set; } = null!;
}

/// <summary>Kết quả AI đối chiếu CV với JD. Chỉ có khi lượt sàng lọc ở trạng thái DONE.</summary>
public class CvScreeningResultDto
{
    /// <summary>3-5 câu chân dung nghề nghiệp của ứng viên.</summary>
    public string Summary { get; set; } = null!;

    public List<MatchedRequirementDto> Matched { get; set; } = [];

    /// <summary>Yêu cầu của tin tuyển dụng mà CV không nhắc tới.</summary>
    public List<string> Missing { get; set; } = [];

    /// <summary>
    /// 0-100. Dùng xếp thứ tự đọc trong một vị trí (V046), KHÔNG phải quyết định tuyển.
    /// Người xem vẫn phải đọc <see cref="Matched"/> / <see cref="Missing"/> để tự kiểm chứng.
    /// </summary>
    public int FitScore { get; set; }

    /// <summary>PROCEED | CONSIDER | REJECT — ĐỀ XUẤT, không phải quyết định.</summary>
    public string Decision { get; set; } = null!;

    public string DecisionReason { get; set; } = null!;
}

/// <summary>
/// Kết quả xếp hàng sàng lọc HÀNG LOẠT cho 1 vị trí (V046) — để xếp hạng được cả danh sách thì
/// phải có điểm cho cả danh sách, mà bấm từng hồ sơ một thì không ai làm.
/// <para>
/// Vẫn là một hành động do người dùng bấm, KHÔNG phải chấm tự động khi nhận CV: mỗi lượt bắt
/// Local LLM đọc hai văn bản dài, nổ ra hàng chục lượt sau lưng người dùng là đốt CPU máy demo.
/// </para>
/// </summary>
public class JobScreeningQueueDto
{
    public long JobId { get; set; }

    /// <summary>Số hồ sơ vừa được xếp vào hàng đợi.</summary>
    public int Queued { get; set; }

    /// <summary>Đã có kết quả từ trước nên bỏ qua (chỉ khi không yêu cầu chấm lại).</summary>
    public int SkippedDone { get; set; }

    /// <summary>Đang xếp hàng/đang chạy dở từ lượt trước nên không xếp chồng.</summary>
    public int SkippedRunning { get; set; }

    /// <summary>Tổng số hồ sơ ở vòng sàng lọc (NEW + SCREENING) của vị trí này.</summary>
    public int TotalCandidates { get; set; }
}

/// <summary>
/// Trạng thái lượt sàng lọc gần nhất của 1 hồ sơ. FE hỏi lại tới khi <c>running=false</c>,
/// rồi đọc <see cref="Result"/> (DONE) hoặc <see cref="ErrorMessage"/> (FAILED).
/// </summary>
public class CvScreeningStatusDto
{
    public long ApplicationId { get; set; }

    /// <summary>NONE | PENDING | RUNNING | DONE | FAILED. NONE = chưa bao giờ phân tích.</summary>
    public string Status { get; set; } = null!;

    /// <summary>true khi PENDING/RUNNING — FE còn phải hỏi lại.</summary>
    public bool Running { get; set; }

    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }

    public CvScreeningResultDto? Result { get; set; }

    public DateTime? RequestedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
}
