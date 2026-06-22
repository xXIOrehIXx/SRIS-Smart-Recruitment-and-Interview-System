namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>
/// 4 role đăng nhập Portal (khớp CHECK constraint User.role ở V001). Candidate KHÔNG phải role —
/// là khách ẩn danh dùng magic link, không có User row. Admin được coi là superuser (bỏ qua mọi [WithRole]).
/// </summary>
public static class RoleConstants
{
    public const string Admin = "Admin";
    public const string Recruiter = "Recruiter";
    public const string Interviewer = "Interviewer";
    public const string DepartmentManager = "DepartmentManager";

    public static readonly string[] All = { Admin, Recruiter, Interviewer, DepartmentManager };
}
