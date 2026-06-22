using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>1 ghi chú nội bộ kèm email người viết (join User).</summary>
public record InternalNoteRow(long NoteId, long UserId, string? AuthorEmail, string Content, DateTime? CreatedAt);

/// <summary>
/// Ghi chú nội bộ trên hồ sơ (docs: "Activity Log & Internal Notes"). HR/Interviewer/DM gõ tay,
/// KHÔNG gửi ứng viên. Cô lập tenant qua Global Query Filter + RLS.
/// </summary>
public interface IInternalNoteRepo : IBaseRepo<long, InternalNote>
{
    /// <summary>Thêm 1 ghi chú, trả về note_id.</summary>
    Task<long> InsertAsync(long companyId, InternalNote note);

    /// <summary>Các ghi chú của 1 hồ sơ (mới nhất trước), kèm email người viết.</summary>
    Task<IReadOnlyList<InternalNoteRow>> GetByApplicationAsync(long companyId, long applicationId);
}
