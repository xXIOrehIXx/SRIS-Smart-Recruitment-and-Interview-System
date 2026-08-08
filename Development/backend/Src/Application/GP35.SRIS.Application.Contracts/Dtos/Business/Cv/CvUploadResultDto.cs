namespace GP35.SRIS.Application.Contracts.Dtos.Business.Cv;

/// <summary>Kết quả một lần nộp CV (nhận hồ sơ — KHÔNG chấm điểm).</summary>
public class CvUploadResultDto
{
    /// <summary>"RECEIVED" | "NEEDS_MANUAL_EDIT" | "FAILED" (xem <c>CvIntakeStatus</c>).</summary>
    public string Status { get; set; } = null!;

    /// <summary>Lý do khi không nhận được hồ sơ (scan ảnh / file hỏng / job không tồn tại).</summary>
    public string? Reason { get; set; }

    public long? ApplicationId { get; set; }
    public long? CandidateId { get; set; }
    public long? CvId { get; set; }
    public string? CandidateName { get; set; }

    public int? PageCount { get; set; }
    public int? CharCount { get; set; }

    /// <summary>200 ký tự đầu của text bóc ra (để người nộp kiểm tra nhanh CV đọc đúng chưa).</summary>
    public string? ExtractPreview { get; set; }
}
