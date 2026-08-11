using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Tiêu chí đánh giá theo job (docs 5.7, 5.18) — trục xuyên suốt từ lọc CV đến phỏng vấn.
/// Luồng: người gõ trực tiếp HOẶC AI bóc từ JD (DRAFT) -> người duyệt chốt (APPROVED).
/// </summary>
public interface IEvaluationCriteriaService : IBaseService
{
    Task<CriteriaDto> CreateAsync(long companyId, long jobId, CriteriaInputDto dto);

    /// <summary>
    /// Tiêu chí của job. includeInactive=false (mặc định) chỉ trả tiêu chí đang bật.
    /// Luôn trả CẢ DRAFT (kèm status) — màn duyệt cần thấy; chấm CV/phỏng vấn tự lọc APPROVED.
    /// </summary>
    Task<IReadOnlyList<CriteriaDto>> GetByJobAsync(long companyId, long jobId, bool includeInactive = false);

    Task<CriteriaDto> UpdateAsync(long companyId, long criteriaId, CriteriaUpdateDto dto);

    /// <summary>
    /// XẾP HÀNG một lượt AI bóc tiêu chí từ JD (Local LLM — 5.18). Trả về NGAY với trạng thái
    /// PENDING; worker nền mới là chỗ gọi AI. Người dùng không phải ngồi đợi Local LLM chạy
    /// trên CPU — đó là lý do luồng này chuyển sang chạy nền (V037).
    /// <para>Ném lỗi ngay tại đây nếu job không tồn tại hoặc chưa có gì để bóc.</para>
    /// </summary>
    Task<CriteriaExtractionStatusDto> RequestExtractAsync(long companyId, long jobId, long userId);

    /// <summary>Trạng thái lượt bóc gần nhất của job — FE hỏi lại cho tới khi DONE/FAILED.</summary>
    Task<CriteriaExtractionStatusDto> GetExtractStatusAsync(long companyId, long jobId);

    /// <summary>
    /// Worker gọi: thật sự chạy một lượt bóc đã giành được, rồi tự đóng trạng thái DONE/FAILED.
    /// KHÔNG ném lỗi ra ngoài — mọi thất bại được ghi vào chính dòng hàng đợi để người dùng đọc.
    /// AI KHÔNG quyết tiêu chí: kết quả là DRAFT, người duyệt chốt qua <see cref="ApproveDraftsAsync"/>.
    /// </summary>
    Task RunExtractionAsync(long companyId, long jobId, long extractionId, CancellationToken ct = default);

    /// <summary>Người duyệt chốt: mọi DRAFT của job -> APPROVED (ghi ai duyệt, lúc nào). Trả số tiêu chí được duyệt.</summary>
    Task<int> ApproveDraftsAsync(long companyId, long jobId, long userId);

    /// <summary>Gỡ 1 tiêu chí khỏi job (soft — active=0).</summary>
    Task DeactivateAsync(long companyId, long criteriaId);
}
