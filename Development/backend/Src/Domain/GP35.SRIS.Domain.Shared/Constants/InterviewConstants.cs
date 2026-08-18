namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>Trạng thái 1 lịch phỏng vấn / 1 vòng (InterviewSchedule.status) — docs 15.4.</summary>
public static class InterviewScheduleStatus
{
    /// <summary>Đã mở khung, chờ ứng viên chọn.</summary>
    public const string Pending = "PENDING";

    /// <summary>Ứng viên đã chốt 1 khung.</summary>
    public const string Confirmed = "CONFIRMED";

    /// <summary>Ứng viên báo không khung nào phù hợp -> Human Resource mở vòng mới.</summary>
    public const string NoSlotFits = "NO_SLOT_FITS";

    /// <summary>Human Resource hủy lịch.</summary>
    public const string Cancelled = "CANCELLED";
}

/// <summary>
/// Trạng thái 1 phiếu chấm (InterviewScore.status) — Blind Review (docs 5.7).
/// DRAFT = nháp riêng tư, ẩn với người khác; SUBMITTED = đã nộp -> mới mở blind (lộ điểm/note).
/// </summary>
public static class InterviewScoreStatus
{
    public const string Draft = "DRAFT";
    public const string Submitted = "SUBMITTED";
}

/// <summary>
/// Kết luận của người phỏng vấn (InterviewFeedback.recommendation — V031). Đây là thứ
/// người quyết tuyển đọc trước tiên: "nên tuyển hay không", điểm chỉ là phần bổ trợ.
/// </summary>
public static class InterviewRecommendation
{
    public const string StrongHire = "STRONG_HIRE";
    public const string Hire = "HIRE";

    /// <summary>Còn lăn tăn — không phải "không", nhưng cũng chưa dám gật.</summary>
    public const string Consider = "CONSIDER";
    public const string NoHire = "NO_HIRE";

    public static bool IsValid(string? value) =>
        value is StrongHire or Hire or Consider or NoHire;

    /// <summary>Gật đầu (mạnh hay thường đều tính là đề xuất tuyển).</summary>
    public static bool IsPositive(string? value) =>
        value is StrongHire or Hire;
}

/// <summary>
/// Ràng buộc thời gian giữa các buổi phỏng vấn — chỉ còn chặn TRÙNG ĐÚNG GIỜ.
///
/// <para>
/// Trước 18/08/2026 hai buổi phải cách nhau 1 tiếng. Bỏ luật đó vì nó chặn nhầm việc có thật:
/// buổi phỏng vấn 30 phút xong là gọi người kế tiếp vào luôn, mà hệ thống lại không cho đặt.
/// Giờ phỏng vấn vốn do nhân sự gọi điện thống nhất với cả người phỏng vấn lẫn ứng viên rồi
/// mới nhập vào — họ biết buổi trước dài bao lâu, hệ thống thì không (bảng không lưu thời lượng).
/// </para>
///
/// <para>
/// Cái còn giữ lại: một người không thể bắt đầu hai buổi ở CÙNG một thời điểm — đó là lỗi
/// nhập liệu chứ không phải lựa chọn xếp lịch. <see cref="MinGap"/> để 1 phút chính là để câu
/// truy vấn cửa sổ (biên mở) bắt được đúng ca trùng khít này; đặt 0 thì cửa sổ rỗng và không
/// còn chặn gì cả. Muốn biết ai sắp bận sát giờ thì xem lịch bận ngay trong form đặt lịch
/// (<c>GET /api/interviews/interviewer-busy</c>, V047) — nhắc bằng THÔNG TIN, không chặn.
/// </para>
/// </summary>
public static class InterviewTiming
{
    /// <summary>Cửa sổ coi là "trùng giờ" (phút) — chỉ đủ rộng để bắt hai buổi cùng thời điểm.</summary>
    public const int MinGapMinutes = 1;

    /// <summary>Cùng giá trị dạng TimeSpan — dùng làm cửa sổ chống trùng khi chốt khung.</summary>
    public static TimeSpan MinGap => TimeSpan.FromMinutes(MinGapMinutes);
}

/// <summary>
/// Ràng buộc về nhóm người phỏng vấn. Dùng CHUNG cho hai chỗ: Trưởng bộ phận chỉ định người
/// được gặp ứng viên (V045) và bộ phận nhân sự chọn panel cho từng buổi — hai nơi lệch số thì
/// DM chỉ định được 6 người mà nhân sự không xếp nổi buổi nào có đủ họ.
/// </summary>
public static class InterviewPanel
{
    /// <summary>Số người phỏng vấn tối đa cho một ứng viên / một buổi.</summary>
    public const int MaxSize = 5;
}

/// <summary>Trạng thái 1 khung giờ (InterviewSlot.status) — docs 15.3.</summary>
public static class InterviewSlotStatus
{
    /// <summary>Còn trống, ứng viên chọn được.</summary>
    public const string Open = "OPEN";

    /// <summary>Ứng viên đã đặt khung này.</summary>
    public const string Booked = "BOOKED";

    /// <summary>Khung bị khóa khi pool bị hủy (không còn dùng được).</summary>
    public const string Locked = "LOCKED";
}

/// <summary>Trạng thái 1 pool khung phỏng vấn dùng chung (InterviewSlotPool.status) — docs 15.</summary>
public static class InterviewPoolStatus
{
    /// <summary>Đang mở, còn nhận ứng viên chọn khung.</summary>
    public const string Open = "OPEN";

    /// <summary>Đã đóng (hết khung / recruiter đóng thủ công / dùng cho lịch chốt tay).</summary>
    public const string Closed = "CLOSED";

    /// <summary>Human Resource hủy pool.</summary>
    public const string Cancelled = "CANCELLED";
}

/// <summary>
/// Cờ nhắc recruiter khi ứng viên báo bận nhiều lần (docs 15). Đếm số schedule NO_SLOT_FITS:
/// 0 = không cờ, 1 = vàng (tự quyết mở vòng mới / gọi điện), >= <see cref="RedThreshold"/> = đỏ (nên gọi điện chốt tay).
/// Không auto-reject — chỉ để recruiter NHÌN THẤY.
/// </summary>
public static class SchedulingFlag
{
    public const string None = "NONE";
    public const string Yellow = "YELLOW";
    public const string Red = "RED";

    /// <summary>Số lần báo bận để chuyển sang cờ đỏ.</summary>
    public const int RedThreshold = 2;

    /// <summary>Suy cờ từ số lần báo bận.</summary>
    public static string From(int noSlotFitsCount) =>
        noSlotFitsCount <= 0 ? None : noSlotFitsCount >= RedThreshold ? Red : Yellow;
}

/// <summary>
/// Trạng thái một lượt AI tổng hợp ý kiến hội đồng phỏng vấn (V047) — cùng bộ chữ với
/// <c>ScreeningStatus</c>/<c>ExtractionStatus</c> vì cùng kiểu hàng đợi chạy nền.
/// </summary>
public static class PanelSummaryStatus
{
    public const string Pending = "PENDING";
    public const string Running = "RUNNING";
    public const string Done = "DONE";
    public const string Failed = "FAILED";
}

/// <summary>Mã lỗi của lượt tổng hợp — FE hiện thông điệp khác nhau cho từng ca.</summary>
public static class PanelSummaryErrorCode
{
    /// <summary>AI service / Ollama hỏng -> mời thử lại sau.</summary>
    public const string AiFailed = "AI_SUMMARY_FAILED";

    /// <summary>Chưa có phiếu chấm nào được nộp -> chưa có gì để tổng hợp.</summary>
    public const string NoVerdicts = "NO_VERDICTS";
}
