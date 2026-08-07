namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>
/// 4 role đăng nhập Portal (khớp CHECK constraint User.role ở V001). Candidate KHÔNG phải role —
/// là khách ẩn danh dùng magic link, không có User row. Admin được coi là superuser (bỏ qua mọi [WithRole]).
/// </summary>
public static class RoleConstants
{
    public const string Admin = "Admin";

    /// <summary>
    /// Vai trò Nhân sự (Human Resource) — lái toàn bộ vận hành tuyển dụng.
    /// <para>
    /// GIÁ TRỊ vẫn là <c>"Recruiter"</c>: đó là chuỗi đang nằm trong cột <c>User.role</c> và trong
    /// CHECK constraint <c>CK_User_role</c> (V001). Chỉ TÊN GỌI đổi cho khớp tài liệu — đổi luôn
    /// giá trị sẽ phải migrate dữ liệu và đá mọi phiên đăng nhập hiện có (JWT mang role cũ).
    /// Muốn đổi cả giá trị thì phải làm kèm migration + đổi CHECK constraint, không sửa mỗi đây.
    /// </para>
    /// </summary>
    public const string HumanResource = "Recruiter";

    public const string Interviewer = "Interviewer";
    public const string DepartmentManager = "DepartmentManager";

    public static readonly string[] All = { Admin, HumanResource, Interviewer, DepartmentManager };
}
