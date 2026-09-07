namespace GP35.SRIS.Domain.Shared.Constants;

// Từng có ở đây: CriteriaType (HARD/SOFT). Xoá ở V038 cùng cột criteria_type — nhãn đó phân
// loại theo CÁCH MÁY CHẤM CV (dò keyword hay so vector), mà chấm CV đã cắt khỏi scope
// 08/08/2026. Mọi tiêu chí giờ bình đẳng: một dòng phiếu chấm, cho điểm 0..MaxScore.

/// <summary>
/// Vòng đời tiêu chí: AI bóc ra DRAFT -> nhân sự sửa -> gửi PENDING -> Trưởng bộ phận chốt
/// APPROVED (hoặc trả về DRAFT kèm ghi chú). Phiếu chấm phỏng vấn CHỈ dùng tiêu chí APPROVED.
///
/// <para>V055 (07/09/2026) thêm <see cref="Pending"/>: trước đó nhân sự vừa soạn vừa tự chốt
/// được, nên Trưởng bộ phận — người ra đề — có thể chưa từng nhìn bộ tiêu chí đang được dùng
/// làm phiếu chấm cho vị trí của mình.</para>
///
/// <para>Chỉ LUỒNG AI BÓC đi qua cửa này. Tiêu chí gõ tay và tiêu chí áp từ khuôn mẫu vẫn vào
/// thẳng APPROVED: người dùng tự viết ra thì không cần ai duyệt lại chữ của chính họ.</para>
/// </summary>
public static class CriteriaStatus
{
    public const string Draft = "DRAFT";

    /// <summary>Đã gửi, đang chờ Trưởng bộ phận duyệt — KHOÁ SỬA để người duyệt không xem một bản đang chạy.</summary>
    public const string Pending = "PENDING";

    public const string Approved = "APPROVED";
}

/// <summary>Nguồn gốc tiêu chí — audit "AI không quyết tiêu chí" (docs 5.18).</summary>
public static class CriteriaSource
{
    public const string Manual = "MANUAL";
    public const string AiExtracted = "AI_EXTRACTED";
}

/// <summary>
/// Trạng thái một lượt bóc tiêu chí chạy nền (V037). PENDING/RUNNING là "đang chạy";
/// DONE/FAILED là trạng thái cuối — FE ngừng hỏi lại khi thấy hai giá trị này.
/// </summary>
public static class ExtractionStatus
{
    public const string Pending = "PENDING";
    public const string Running = "RUNNING";
    public const string Done = "DONE";
    public const string Failed = "FAILED";
}

/// <summary>Mã lỗi của lượt bóc — FE hiện thông điệp khác nhau cho hai ca này.</summary>
public static class ExtractionErrorCode
{
    /// <summary>AI service / Ollama hỏng -> mời người dùng nhập tay hoặc áp template.</summary>
    public const string AiFailed = "AI_EXTRACT_FAILED";

    /// <summary>JD chỉ liệt kê đầu việc, không nêu yêu cầu nào -> mời bổ sung rồi bóc lại.</summary>
    public const string NoRequirements = "JD_NO_REQUIREMENTS";
}
