using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// Lượt AI đối chiếu CV với JD của MỘT hồ sơ (V044) — vừa là hàng đợi cho worker, vừa là
/// chỗ lưu kết quả.
/// <para>
/// Không phải nhật ký lịch sử: mỗi hồ sơ đúng một dòng, bấm phân tích lại là ghi đè.
/// </para>
/// <para>
/// <see cref="Decision"/> là ĐỀ XUẤT THAM KHẢO. Không có đường nào trong hệ thống đọc nó
/// rồi tự đổi trạng thái hồ sơ — người tuyển dụng đọc rồi tự quyết.
/// </para>
/// </summary>
public class CvScreening : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("screening_id")]
    public long ScreeningId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }

    /// <summary>Khoá theo hồ sơ, không theo CV: cùng CV nộp 2 vị trí thì đối chiếu với 2 JD khác nhau.</summary>
    [Column("application_id")]
    public long ApplicationId { get; set; }

    [Column("job_id")]
    public long JobId { get; set; }

    [Column("cv_id")]
    public long CvId { get; set; }

    /// <summary>PENDING | RUNNING | DONE | FAILED (hằng số ở <c>ScreeningStatus</c>).</summary>
    [Column("status")]
    public string Status { get; set; } = null!;

    /// <summary>AI_SCREEN_FAILED | CV_NO_TEXT | JD_EMPTY. Chỉ có nghĩa khi Status = FAILED.</summary>
    [Column("error_code")]
    public string? ErrorCode { get; set; }

    /// <summary>Câu hiện cho người dùng khi hỏng (đã viết sẵn theo ngôn ngữ người dùng).</summary>
    [Column("error_message")]
    public string? ErrorMessage { get; set; }

    /// <summary>3-5 câu chân dung nghề nghiệp của ứng viên. Chỉ có nghĩa khi Status = DONE.</summary>
    [Column("summary")]
    public string? Summary { get; set; }

    /// <summary>JSON <c>[{"requirement","evidence"}]</c> — yêu cầu ĐẠT kèm câu trích từ CV.</summary>
    [Column("matched_json")]
    public string? MatchedJson { get; set; }

    /// <summary>JSON <c>["..."]</c> — yêu cầu CV không nhắc tới.</summary>
    [Column("missing_json")]
    public string? MissingJson { get; set; }

    /// <summary>
    /// 0-100. Dùng để xếp THỨ TỰ ĐỌC trong một vị trí (V046) — đưa hồ sơ khớp nhất lên đầu cho
    /// người tuyển dụng xem trước. Vẫn KHÔNG phải quyết định: không có đường code nào đọc số này
    /// rồi đổi <c>current_state</c>, và nó không so được giữa hai vị trí khác nhau (mỗi lượt chấm
    /// đối chiếu với đúng một JD).
    /// </summary>
    [Column("fit_score")]
    public int? FitScore { get; set; }

    /// <summary>PROCEED | CONSIDER | REJECT (hằng số ở <c>ScreeningDecision</c>).</summary>
    [Column("decision")]
    public string? Decision { get; set; }

    [Column("decision_reason")]
    public string? DecisionReason { get; set; }

    [Column("requested_by")]
    public long? RequestedBy { get; set; }

    [Column("requested_at")]
    public DateTime? RequestedAt { get; set; }

    [Column("started_at")]
    public DateTime? StartedAt { get; set; }

    [Column("finished_at")]
    public DateTime? FinishedAt { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}
