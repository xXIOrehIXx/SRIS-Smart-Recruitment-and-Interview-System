namespace GP35.SRIS.Domain.Shared.Constants
{
    /// <summary>Trạng thái parse của CvDocument (cột parse_status varchar(20)).</summary>
    public static class CvParseStatus
    {
        /// <summary>Bóc được text -> đã chấm điểm.</summary>
        public const string Ok = "OK";

        /// <summary>PDF scan ảnh / không bóc được text -> chờ HR nhập tay.</summary>
        public const string NeedsManualEdit = "NEEDS_MANUAL_EDIT";

        /// <summary>Lỗi khi xử lý (file hỏng, AI service chết...).</summary>
        public const string Failed = "FAILED";
    }

    /// <summary>Trạng thái hồ sơ (cột Application.current_state varchar(20)).</summary>
    public static class ApplicationState
    {
        public const string New = "NEW";
    }
}
