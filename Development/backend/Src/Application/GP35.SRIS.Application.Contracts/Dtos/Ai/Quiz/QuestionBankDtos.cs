namespace GP35.SRIS.Application.Contracts.Dtos.Ai.Quiz;

/// <summary>1 câu trong ngân hàng câu hỏi đã duyệt (góc nhìn quản lý — có đáp án).</summary>
public class QuestionBankItemDto
{
    public long BankItemId { get; set; }
    public string Content { get; set; } = null!;
    public List<string> Options { get; set; } = new();
    /// <summary>Chỉ số (bắt đầu 0) của phương án đúng.</summary>
    public int CorrectIndex { get; set; }
    public string? Topic { get; set; }
    public string? Difficulty { get; set; }
    /// <summary>Số lần câu này đã được kéo lại vào 1 quiz.</summary>
    public int TimesUsed { get; set; }
    public DateTime? ApprovedAt { get; set; }
}

/// <summary>Kết quả tìm trong bank (có phân trang).</summary>
public class QuestionBankSearchResultDto
{
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public List<QuestionBankItemDto> Items { get; set; } = new();
}

/// <summary>Kéo câu từ bank vào 1 quiz DRAFT (tái dùng câu đã duyệt thay vì gen mới).</summary>
public class AddFromBankDto
{
    /// <summary>Lọc theo chủ đề/từ khoá (tùy chọn). Bỏ trống = lấy câu mới/được tái dùng nhiều nhất.</summary>
    public string? Topic { get; set; }
    /// <summary>Số câu muốn kéo (mặc định 5).</summary>
    public int Count { get; set; } = 5;
}
