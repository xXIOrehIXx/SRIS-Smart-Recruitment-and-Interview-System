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
