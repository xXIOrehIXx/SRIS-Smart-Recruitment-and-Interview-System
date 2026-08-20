namespace GP35.SRIS.Lib.Services.Excel;

/// <summary>1 dòng ứng viên trong file Excel — đã là chữ hiển thị, không còn mã nội bộ.</summary>
public class CandidateExportRow
{
    public string CandidateName { get; set; } = "";
    public string CandidateEmail { get; set; } = "";
    public string? CandidatePhone { get; set; }
    public string? Source { get; set; }

    /// <summary>Nhãn 4 pha (đã dịch từ state nội bộ trước khi tới đây).</summary>
    public string StateLabel { get; set; } = "";

    public string? RejectReason { get; set; }
    public DateTime? AppliedAt { get; set; }
    public string? CvFileName { get; set; }

    /// <summary>Null = hồ sơ chưa được AI phân tích — để TRỐNG, không ghi 0 (V046).</summary>
    public int? FitScore { get; set; }

    /// <summary>"Nên mời" / "Cân nhắc" / "Ít phù hợp" — hoặc "Chưa phân tích".</summary>
    public string? FitLabel { get; set; }

    public string? Summary { get; set; }

    /// <summary>Yêu cầu ĐẠT, mỗi dòng một mục kèm câu trích từ CV.</summary>
    public string? Matched { get; set; }

    /// <summary>Yêu cầu CV không nhắc tới, mỗi dòng một mục.</summary>
    public string? Missing { get; set; }
}

/// <summary>Dữ liệu dựng nên file Excel danh sách ứng viên của MỘT vị trí.</summary>
public class CandidateExportModel
{
    public string JobTitle { get; set; } = "";
    public string? CompanyName { get; set; }
    public DateTime ExportedAt { get; set; } = DateTime.Now;
    public List<CandidateExportRow> Rows { get; set; } = new();
}
