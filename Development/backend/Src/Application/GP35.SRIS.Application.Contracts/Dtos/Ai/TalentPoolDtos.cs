namespace GP35.SRIS.Application.Contracts.Dtos.Ai;

/// <summary>
/// 1 ứng viên gợi ý từ Talent Pool (kho CV cũ của công ty) cho 1 job. Score 0–100 (cao = hợp),
/// kèm "tuổi CV" để Recruiter tự cân độ tươi (CV cũ quá -> ứng viên có thể đã có việc).
/// </summary>
public class TalentPoolSuggestionDto
{
    public long CvId { get; set; }
    public long CandidateId { get; set; }
    public string CandidateName { get; set; } = null!;
    public string? CandidateEmail { get; set; }
    public decimal Score { get; set; }
    public double CosineDistance { get; set; }
    public DateTime? UploadedAt { get; set; }
    /// <summary>Số ngày kể từ lúc nộp CV (để FE hiển thị/sắp xếp độ tươi).</summary>
    public int? AgeDays { get; set; }
    /// <summary>Mô tả tuổi CV dễ đọc, vd "nộp 3 tháng trước".</summary>
    public string? AgeText { get; set; }
}

/// <summary>Kết quả gợi ý Talent Pool cho 1 job (kèm tham số đã dùng để truy vết).</summary>
public class TalentPoolResultDto
{
    public long JobId { get; set; }
    public int WithinMonths { get; set; }
    public int Count { get; set; }
    public List<TalentPoolSuggestionDto> Suggestions { get; set; } = new();
}

/// <summary>Recruiter mời 1 ứng viên trong kho ứng tuyển vào job (email lấy từ gợi ý).</summary>
public class TalentPoolInviteDto
{
    public string CandidateEmail { get; set; } = null!;
    public string? CandidateName { get; set; }
}
