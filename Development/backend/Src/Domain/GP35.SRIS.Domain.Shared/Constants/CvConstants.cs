namespace GP35.SRIS.Domain.Shared.Constants
{
    /// <summary>Trạng thái parse của CvDocument (cột parse_status varchar(20)).</summary>
    public static class CvParseStatus
    {
        /// <summary>Bóc được text từ PDF.</summary>
        public const string Ok = "OK";

        /// <summary>PDF scan ảnh / không bóc được text -> chờ nhập tay.</summary>
        public const string NeedsManualEdit = "NEEDS_MANUAL_EDIT";

        /// <summary>Lỗi khi xử lý (file hỏng...).</summary>
        public const string Failed = "FAILED";
    }

    /// <summary>Trạng thái KẾT QUẢ trả về cho luồng nộp CV (<c>CvUploadResultDto.Status</c>).</summary>
    public static class CvIntakeStatus
    {
        /// <summary>Đã nhận hồ sơ (Application tạo ở NEW).</summary>
        public const string Received = "RECEIVED";

        /// <summary>CV scan ảnh / không bóc được text -> chờ nhập tay (= <see cref="CvParseStatus.NeedsManualEdit"/>).</summary>
        public const string NeedsManualEdit = CvParseStatus.NeedsManualEdit;

        /// <summary>Không nhận được (file hỏng, job không tồn tại).</summary>
        public const string Failed = CvParseStatus.Failed;
    }

    /// <summary>
    /// Trạng thái một lượt sàng lọc CV chạy nền (V044). PENDING/RUNNING là "đang chạy";
    /// DONE/FAILED là trạng thái cuối — FE ngừng hỏi lại khi thấy hai giá trị này.
    /// (Cùng bộ chữ với <c>ExtractionStatus</c> vì cùng kiểu hàng đợi.)
    /// </summary>
    public static class ScreeningStatus
    {
        public const string Pending = "PENDING";
        public const string Running = "RUNNING";
        public const string Done = "DONE";
        public const string Failed = "FAILED";
    }

    /// <summary>Mã lỗi của lượt sàng lọc — FE hiện thông điệp khác nhau cho từng ca.</summary>
    public static class ScreeningErrorCode
    {
        /// <summary>AI service / Ollama hỏng -> mời thử lại sau.</summary>
        public const string AiFailed = "AI_SCREEN_FAILED";

        /// <summary>CV không có text để đọc (PDF scan ảnh) -> không có gì cho AI đối chiếu.</summary>
        public const string CvNoText = "CV_NO_TEXT";

        /// <summary>Tin tuyển dụng chưa có mô tả/yêu cầu -> không có gì để đối chiếu VỚI.</summary>
        public const string JdEmpty = "JD_EMPTY";
    }

    /// <summary>
    /// Đề xuất của AI sau khi đối chiếu CV với JD — THAM KHẢO. Không có đường code nào đọc
    /// giá trị này rồi tự đổi trạng thái hồ sơ; quyết định vẫn là của người tuyển dụng.
    /// </summary>
    public static class ScreeningDecision
    {
        /// <summary>Đáp ứng các yêu cầu cốt lõi -> nên mời phỏng vấn.</summary>
        public const string Proceed = "PROCEED";

        /// <summary>Có nền tảng liên quan nhưng thiếu một phần yêu cầu cốt lõi -> người xem thêm.</summary>
        public const string Consider = "CONSIDER";

        /// <summary>Lệch ngành hoặc thiếu phần lớn yêu cầu cốt lõi.</summary>
        public const string Reject = "REJECT";
    }
}
