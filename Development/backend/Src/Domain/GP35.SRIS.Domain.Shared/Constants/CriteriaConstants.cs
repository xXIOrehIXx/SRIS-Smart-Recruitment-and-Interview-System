namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>
/// Phân loại tiêu chí (docs 5.18): HARD = yêu cầu cứng loại-trừ (chứng chỉ, số năm, địa điểm)
/// -> lọc bằng RULE/keyword; SOFT = kỹ năng/năng lực -> so vector.
/// </summary>
public static class CriteriaType
{
    public const string Hard = "HARD";
    public const string Soft = "SOFT";
}

/// <summary>
/// Vòng đời tiêu chí (pattern DRAFT -> duyệt -> APPROVED). AI bóc ra DRAFT;
/// người duyệt chốt. Chấm CV/phỏng vấn CHỈ dùng tiêu chí APPROVED.
/// </summary>
public static class CriteriaStatus
{
    public const string Draft = "DRAFT";
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
