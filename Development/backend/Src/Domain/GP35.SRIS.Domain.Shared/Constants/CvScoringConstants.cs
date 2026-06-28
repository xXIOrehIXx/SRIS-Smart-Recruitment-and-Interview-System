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

    /// <summary>
    /// Trạng thái KẾT QUẢ trả về cho luồng nộp CV (DTO <c>CvScoreResultDto.Status</c>).
    /// Cách A (chấm nền): nộp CV đọc được -> trả <see cref="Pending"/> ngay; worker nền chấm xong mới có điểm.
    /// </summary>
    public static class CvScoreStatus
    {
        /// <summary>Đã chấm xong, có điểm.</summary>
        public const string Scored = "SCORED";

        /// <summary>Đã nhận hồ sơ, ĐANG CHỜ chấm nền (Cách A) — chưa có điểm.</summary>
        public const string Pending = "PENDING";

        /// <summary>CV scan ảnh / không bóc được text -> chờ HR nhập tay (= <see cref="CvParseStatus.NeedsManualEdit"/>).</summary>
        public const string NeedsManualEdit = CvParseStatus.NeedsManualEdit;

        /// <summary>Không nhận được (file hỏng, job không tồn tại / thiếu JD).</summary>
        public const string Failed = CvParseStatus.Failed;
    }
}
