using System.Net;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.Domain.Shared.Exceptions;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Ai được ĐỘNG VÀO bộ tiêu chí của một vị trí (chốt 24/08/2026).
///
/// <para>Trưởng bộ phận là người RA ĐỀ (docs 5.17/5.18 — "DM ra đề · chọn người gặp · đề xuất
/// tuyển"), nên họ bóc tiêu chí bằng AI và chốt bộ tiêu chí cho vị trí mình phụ trách. Bộ phận
/// nhân sự giữ nguyên quyền cũ: họ lái toàn bộ vận hành và ở công ty nhỏ thường là người ngồi
/// nhập hộ.</para>
///
/// <para>Ràng buộc riêng của DM là <b>đúng vị trí mình phụ trách</b> (<c>Job.department_manager_id</c>)
/// — cùng một luật với cửa SCREENING→INTERVIEW và với việc chỉ định người phỏng vấn, vì đều là
/// "chuyện chuyên môn của bộ phận này". Không siết chỗ này thì DM bộ phận kỹ thuật đi chốt phiếu
/// chấm cho vị trí kế toán.</para>
///
/// <para>Chỉ chặn GHI. ĐỌC để mở: bộ tiêu chí là thứ Giám đốc/nhân sự/DM khác cùng nhìn khi bàn
/// về ứng viên, chặn đọc chỉ tạo ra màn hình trống không giải thích được.</para>
/// </summary>
internal static class JobCriteriaAccessGuard
{
    public static async Task EnsureCanEditAsync(
        IJobRepo jobRepo, IContextData contextData, long companyId, long jobId)
    {
        // Chỉ Trưởng bộ phận mới bị hỏi "vị trí này có phải của anh không". Admin là superuser,
        // nhân sự có phạm vi toàn công ty.
        if (!string.Equals(contextData.Role, RoleConstants.DepartmentManager, StringComparison.OrdinalIgnoreCase))
            return;

        var job = await jobRepo.GetByIdAsync(companyId, jobId)
            ?? throw Error(HttpStatusCode.NotFound, "NOT_FOUND", $"Không tìm thấy Job (job_id={jobId}).");

        if (job.DepartmentManagerId is not long dmId)
            throw Error(HttpStatusCode.Forbidden, "FORBIDDEN",
                "Tin tuyển dụng này chưa gán Trưởng bộ phận phụ trách. Hãy đề nghị bộ phận nhân sự " +
                "gán người phụ trách trước khi ra đề tiêu chí.");

        if (dmId != contextData.UserId)
            throw Error(HttpStatusCode.Forbidden, "FORBIDDEN",
                "Chỉ Trưởng bộ phận phụ trách vị trí này mới được sửa bộ tiêu chí của nó.");
    }

    private static BaseException Error(HttpStatusCode status, string code, string msg) => new(msg)
    {
        ErrorCode = code, ErrorMessage = msg, HttpStatus = (int)status
    };
}
