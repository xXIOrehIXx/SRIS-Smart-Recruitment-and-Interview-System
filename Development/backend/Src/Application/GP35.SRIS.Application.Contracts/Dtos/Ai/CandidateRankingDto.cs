namespace GP35.SRIS.Application.Contracts.Dtos.Ai;

/// <summary>1 dòng bảng xếp hạng ứng viên theo điểm AI.</summary>
public class CandidateRankingDto
{
    public long ApplicationId { get; set; }
    public long CandidateId { get; set; }
    public string CandidateName { get; set; } = null!;
    public decimal? Score { get; set; }
    public string CurrentState { get; set; } = null!;
    /// <summary>CV gốc — FE dùng gọi /cv-scoring/cv/{cvId}/file-url để mở file.</summary>
    public long CvId { get; set; }
}
