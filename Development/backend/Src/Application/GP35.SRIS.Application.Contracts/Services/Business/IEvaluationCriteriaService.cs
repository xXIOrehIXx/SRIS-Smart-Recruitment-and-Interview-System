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
    /// AI KHÔNG quyết tiêu chí: kết quả là DRAFT, người soạn gửi duyệt qua
    /// <see cref="SubmitForReviewAsync"/>, Trưởng bộ phận chốt qua <see cref="ApproveDraftsAsync"/>.
    /// </summary>
    /// <param name="jobId">Lượt bóc từ tin tuyển dụng. Null nếu bóc từ yêu cầu tuyển dụng.</param>
    /// <param name="requestId">Lượt bóc từ yêu cầu tuyển dụng (V056). Đúng một trong hai có giá trị.</param>
    Task RunExtractionAsync(long companyId, long? jobId, long? requestId, long extractionId,
        CancellationToken ct = default);

    /// <summary>
    /// Người soạn gửi bộ tiêu chí cho Trưởng bộ phận duyệt: mọi DRAFT của job -> PENDING (V055).
    /// Trả số dòng đã gửi.
    /// </summary>
    Task<int> SubmitForReviewAsync(long companyId, long jobId, long userId);

    /// <summary>
    /// Trưởng bộ phận CHỐT: mọi PENDING của job -> APPROVED (ghi ai duyệt, lúc nào).
    /// Trả số tiêu chí được duyệt. Nhân sự KHÔNG qua được cửa này (V055).
    /// </summary>
    Task<int> ApproveDraftsAsync(long companyId, long jobId, long userId);

    /// <summary>
    /// Trưởng bộ phận trả bộ tiêu chí về nháp kèm lý do: PENDING -> DRAFT (V055).
    /// <paramref name="note"/> bắt buộc. Trả số dòng đã trả về.
    /// </summary>
    Task<int> RequestChangesAsync(long companyId, long jobId, long userId, string? note);

    /// <summary>Gỡ 1 tiêu chí khỏi job (soft — active=0).</summary>
    Task DeactivateAsync(long companyId, long criteriaId);

    // ---- V056: bộ tiêu chí ra đời trên YÊU CẦU TUYỂN DỤNG, trước cả khi có job ----
    // Trưởng bộ phận vừa mô tả vị trí vừa ra đề, cùng lúc trên cùng văn bản. Ở đường này họ
    // vừa soạn vừa duyệt nên KHÔNG có bước PENDING của V055 — cửa đó dành cho bộ tiêu chí sửa
    // trên job, nơi nhân sự soạn hộ.

    /// <summary>Tiêu chí của một yêu cầu tuyển dụng (gồm cả DRAFT — FE phân biệt qua status).</summary>
    Task<IReadOnlyList<CriteriaDto>> GetByRequestAsync(long companyId, long requestId, bool includeInactive = false);

    /// <summary>Thêm 1 tiêu chí gõ tay cho yêu cầu tuyển dụng -> APPROVED luôn.</summary>
    Task<CriteriaDto> CreateForRequestAsync(long companyId, long requestId, CriteriaInputDto dto);

    /// <summary>Xếp hàng một lượt AI bóc tiêu chí từ chính nội dung yêu cầu tuyển dụng.</summary>
    Task<CriteriaExtractionStatusDto> RequestExtractForRequestAsync(long companyId, long requestId, long userId);

    /// <summary>Trạng thái lượt bóc gần nhất của yêu cầu tuyển dụng.</summary>
    Task<CriteriaExtractionStatusDto> GetExtractStatusForRequestAsync(long companyId, long requestId);

    /// <summary>Trưởng bộ phận chốt bộ tiêu chí ngay trên yêu cầu: DRAFT -> APPROVED. Trả số dòng.</summary>
    Task<int> ApproveForRequestAsync(long companyId, long requestId, long userId);

    /// <summary>
    /// CHUYỂN bộ tiêu chí ĐÃ DUYỆT của yêu cầu sang tin tuyển dụng vừa tạo từ nó — từ giây phút
    /// này bộ tiêu chí là phiếu chấm phỏng vấn của vị trí. Gọi bên trong lượt tạo tin, không gác
    /// quyền riêng. Trả số dòng đã chuyển.
    /// </summary>
    Task<int> AttachRequestCriteriaToJobAsync(long companyId, long requestId, long jobId);
}
