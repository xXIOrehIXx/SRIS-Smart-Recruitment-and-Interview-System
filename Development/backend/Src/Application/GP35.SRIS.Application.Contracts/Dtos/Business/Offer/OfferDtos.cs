namespace GP35.SRIS.Application.Contracts.Dtos.Business.Offer;

/// <summary>
/// Người quyết tuyển (Department Manager của job; job không gán DM -> Human Resource) soạn THƯ MỜI
/// NHẬN VIỆC cho hồ sơ đang ở trạng thái OFFER (docs 5.15). Tạo OfferDetail + gửi email kèm link
/// mở file PDF thư mời. Ứng viên KHÔNG bấm đồng ý/từ chối trong hệ thống — trả lời ngoài hệ thống,
/// Human Resource ghi nhận kết quả sau (<see cref="OfferOutcomeDto"/>).
/// Trường để trống -> lấy mặc định từ Job/Company (xem <see cref="OfferLetterDefaultsDto"/>);
/// mục nào rỗng thì bản PDF bỏ hẳn dòng đó, không in "N/A".
/// </summary>
public class MakeOfferDto
{
    // --- Thông tin vị trí ---
    public string? JobTitle { get; set; }            // null -> Job.Title
    public string? Department { get; set; }          // null -> Job.Department
    public string? ReportingTo { get; set; }         // "Báo cáo cho" — null -> tên DM của job
    public DateTime? StartDate { get; set; }
    public string? EmploymentType { get; set; }      // null -> Job.EmploymentType
    public string? WorkLocation { get; set; }        // null -> Job.Location

    // --- Lương & phúc lợi ---
    public decimal? SalaryAmount { get; set; }
    public string? Currency { get; set; }            // null -> "VND"
    public string? SalaryPeriod { get; set; }        // "THANG" (mặc định) | "NAM"
    public string? Bonus { get; set; }
    public string? Benefits { get; set; }

    // --- Điều khoản & chân thư ---
    public string? Terms { get; set; }               // null -> 3 điều khoản mặc định của mẫu
    public string? HrContactName { get; set; }
    public string? HrContactEmail { get; set; }
    public string? SignerName { get; set; }          // null -> tên người ra offer
    public string? SignerTitle { get; set; }

    public string? CandidateAddress { get; set; }    // in ở đầu thư, gõ tay (CV không lưu địa chỉ)
    public string? Note { get; set; }                // lời nhắn thêm, in cuối phần điều khoản

    /// <summary>Hạn xác nhận in trên thư + TTL link xem thư. null -> 7 ngày.</summary>
    public int? ExpiresInDays { get; set; }
}

/// <summary>
/// Giá trị gợi ý để mở sẵn form soạn thư (Human Resource chỉ sửa lại chỗ cần).
/// Lấy từ Job + Company + hồ sơ ứng viên, KHÔNG ghi gì vào DB.
/// </summary>
public class OfferLetterDefaultsDto
{
    public string? CompanyName { get; set; }
    public string? CompanyAddress { get; set; }
    public string? CompanyEmail { get; set; }
    public string? CompanyPhone { get; set; }

    public string? CandidateName { get; set; }
    public string? CandidateEmail { get; set; }

    public string? JobTitle { get; set; }
    public string? Department { get; set; }
    public string? ReportingTo { get; set; }
    public string? EmploymentType { get; set; }
    public string? WorkLocation { get; set; }
    public decimal? SalaryAmount { get; set; }
    public string? Currency { get; set; }
    public string? SalaryPeriod { get; set; }

    /// <summary>
    /// Phúc lợi của job (bảng JobBenefit, mỗi dòng 1 mục) gộp thành text nhiều dòng.
    /// Người tuyển dụng đã gõ ở tin tuyển dụng rồi — không bắt gõ lại khi soạn thư.
    /// </summary>
    public string? Benefits { get; set; }

    public string? Terms { get; set; }
    public string? SignerName { get; set; }
    public string? SignerTitle { get; set; }
    public string? HrContactName { get; set; }
    public string? HrContactEmail { get; set; }
    public int ExpiresInDays { get; set; }
}

/// <summary>1 offer (góc nhìn nội bộ Portal) — kèm toàn bộ nội dung thư đã gửi.</summary>
public class OfferDto
{
    public long OfferId { get; set; }
    public long ApplicationId { get; set; }

    /// <summary>PENDING = đã gửi thư, chờ trả lời · ACCEPTED = đã nhận việc · DECLINED = đã từ chối.</summary>
    public string Status { get; set; } = null!;

    public string? JobTitle { get; set; }
    public string? Department { get; set; }
    public string? ReportingTo { get; set; }
    public DateTime? StartDate { get; set; }
    public string? EmploymentType { get; set; }
    public string? WorkLocation { get; set; }

    public decimal? SalaryAmount { get; set; }
    public string Currency { get; set; } = null!;
    public string? SalaryPeriod { get; set; }
    public string? Bonus { get; set; }
    public string? Benefits { get; set; }

    public string? Terms { get; set; }
    public string? HrContactName { get; set; }
    public string? HrContactEmail { get; set; }
    public string? SignerName { get; set; }
    public string? SignerTitle { get; set; }
    public string? CandidateAddress { get; set; }
    public string? Note { get; set; }

    public long? DecidedBy { get; set; }
    public long? OutcomeBy { get; set; }
    public string? OutcomeNote { get; set; }
    public DateTime? SentAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime? RespondedAt { get; set; }
}

/// <summary>Kết quả gửi thư mời: offer vừa tạo + link xem thư PDF để gửi ứng viên (token gốc 1 lần).</summary>
public class MakeOfferResultDto
{
    public OfferDto Offer { get; set; } = null!;
    public string MagicToken { get; set; } = null!;
    public DateTime TokenExpiresAt { get; set; }
}

/// <summary>
/// Human Resource/DM ghi nhận kết quả sau khi ứng viên trả lời NGOÀI hệ thống (email/điện thoại).
/// Accepted=true -> ACCEPTED + Application HIRED; false -> DECLINED + Application REJECTED.
/// </summary>
public class OfferOutcomeDto
{
    public bool Accepted { get; set; }
    /// <summary>Ghi chú tùy chọn (vd "ứng viên nhận offer công ty khác").</summary>
    public string? Note { get; set; }
}

/// <summary>Kết quả ghi nhận: trạng thái offer + trạng thái hồ sơ sau đồng bộ.</summary>
public class OfferOutcomeResultDto
{
    public string OfferStatus { get; set; } = null!;
    public string ApplicationState { get; set; } = null!;
}
