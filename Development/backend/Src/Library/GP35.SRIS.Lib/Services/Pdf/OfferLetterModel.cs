namespace GP35.SRIS.Lib.Services.Pdf;

/// <summary>
/// Dữ liệu để in một thư mời nhận việc (docs 5.15). Thuần dữ liệu — KHÔNG tham chiếu entity
/// Domain, để tầng Library không phụ thuộc ngược lên Domain/Application.
/// Mọi trường đều nullable: mục nào rỗng thì bản PDF BỎ HẲN dòng đó (không in "N/A").
/// </summary>
public class OfferLetterModel
{
    // --- Đầu thư: công ty gửi ---
    public string? CompanyName { get; set; }
    public string? CompanyAddress { get; set; }
    public string? CompanyEmail { get; set; }
    public string? CompanyPhone { get; set; }

    /// <summary>
    /// Logo công ty (PNG/JPEG/...) in ở đầu thư. Null = không in logo, phần đầu thư tự dồn lại.
    /// Là bytes chứ không phải URL: tầng in KHÔNG được đi gọi mạng — xem <see cref="IBrandLogoFetcher"/>.
    /// </summary>
    public byte[]? LogoBytes { get; set; }

    /// <summary>Màu brand (<c>Company.primary_color</c>), vd "#0F62FE". Null/sai -> navy mặc định.</summary>
    public string? BrandColor { get; set; }

    /// <summary>
    /// URL logo công ty — bản EMAIL nhúng bằng URL (mail client tự tải), khác bản PDF phải
    /// nhúng bytes. Null = không in logo.
    /// </summary>
    public string? CompanyLogoUrl { get; set; }

    /// <summary>Ngày phát hành thư (mặc định: ngày gửi).</summary>
    public DateTime LetterDate { get; set; } = DateTime.Now;

    // --- Người nhận ---
    public string? CandidateName { get; set; }
    public string? CandidateAddress { get; set; }

    // --- Thông tin vị trí ---
    public string? JobTitle { get; set; }
    public string? Department { get; set; }
    public string? ReportingTo { get; set; }
    public DateTime? StartDate { get; set; }
    public string? EmploymentType { get; set; }
    public string? WorkLocation { get; set; }

    // --- Lương & phúc lợi ---
    public decimal? SalaryAmount { get; set; }
    public string? Currency { get; set; }
    /// <summary>"THANG" -> "/tháng", "NAM" -> "/năm". Khác/null -> không ghi kỳ.</summary>
    public string? SalaryPeriod { get; set; }
    public string? Bonus { get; set; }
    public string? Benefits { get; set; }

    // --- Điều khoản & chân thư ---
    /// <summary>Mỗi dòng là một gạch đầu dòng điều khoản.</summary>
    public string? Terms { get; set; }
    public DateTime? AcceptanceDeadline { get; set; }
    public string? HrContactName { get; set; }
    public string? HrContactEmail { get; set; }
    public string? SignerName { get; set; }
    public string? SignerTitle { get; set; }
    /// <summary>Lời nhắn thêm của nhà tuyển dụng, in trước đoạn kết.</summary>
    public string? Note { get; set; }
}
