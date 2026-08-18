using System.ComponentModel.DataAnnotations.Schema;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// Người phỏng vấn được Trưởng bộ phận CHỈ ĐỊNH cho một hồ sơ (V045, chốt 16/08/2026).
///
/// Khác <see cref="InterviewSlotInterviewer"/>: bảng kia là panel THỰC TẾ của một buổi đã đặt
/// (ai ngồi buổi đó, ai được chấm); bảng này là danh sách người ĐƯỢC PHÉP gặp ứng viên — quyết
/// định chuyên môn của DM, có trước khi có buổi nào. Bộ phận nhân sự đặt buổi chỉ chọn được
/// trong danh sách này.
///
/// Không có round_number: DM chỉ định "ai được gặp người này", mỗi buổi nhân sự lấy một tập con.
/// </summary>
public class ApplicationInterviewer : IHasCompanyInfo
{
    [Column("company_id")]
    public long CompanyId { get; set; }

    [Column("application_id")]
    public long ApplicationId { get; set; }

    [Column("interviewer_id")]
    public long InterviewerId { get; set; }

    /// <summary>DM đã chỉ định. Null = dòng backfill từ buổi đặt trước V045.</summary>
    [Column("assigned_by")]
    public long? AssignedBy { get; set; }

    [Column("assigned_at")]
    public DateTime? AssignedAt { get; set; }
}
