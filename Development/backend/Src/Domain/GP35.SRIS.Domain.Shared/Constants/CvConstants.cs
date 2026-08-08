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
}
