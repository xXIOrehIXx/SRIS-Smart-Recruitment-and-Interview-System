namespace GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;

/// <summary>Thêm 1 ghi chú nội bộ vào hồ sơ.</summary>
public class CreateNoteDto
{
    public string Content { get; set; } = null!;
}

/// <summary>1 ghi chú nội bộ (kèm người viết + thời điểm).</summary>
public class InternalNoteDto
{
    public long NoteId { get; set; }
    public long ApplicationId { get; set; }
    public long AuthorId { get; set; }
    public string? AuthorEmail { get; set; }
    public string Content { get; set; } = null!;
    public DateTime? CreatedAt { get; set; }
}
