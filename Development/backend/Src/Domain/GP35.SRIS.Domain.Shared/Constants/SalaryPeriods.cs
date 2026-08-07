namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>
/// Kỳ lương in trên thư mời nhận việc (<c>OfferDetail.salary_period</c> — docs 5.15).
/// Giá trị lưu DB không dấu để tránh lặp lại bài học V026 (cột VARCHAR nuốt dấu tiếng Việt).
/// </summary>
public static class SalaryPeriods
{
    /// <summary>Lương tháng — mặc định ở Việt Nam.</summary>
    public const string Month = "THANG";

    /// <summary>Lương năm (gross/năm) — dùng khi công ty chốt theo package năm.</summary>
    public const string Year = "NAM";
}
