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
///
/// <para><b>V055 (07/09/2026) tách SOẠN khỏi DUYỆT.</b> <see cref="EnsureCanEditAsync"/> là cửa
/// SOẠN (nhân sự + DM của vị trí + Admin, như cũ). <see cref="EnsureCanApproveAsync"/> là cửa
/// DUYỆT và CHỈ Trưởng bộ phận của vị trí đó đi qua được — nhân sự soạn xong phải gửi cho họ.
/// Trước đó ai soạn được thì cũng tự chốt được, nên cửa duyệt không tồn tại trên thực tế.</para>
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

    /// <summary>
    /// Cửa DUYỆT bộ tiêu chí: chỉ Trưởng bộ phận phụ trách đúng vị trí đó (Admin bypass —
    /// công ty nhỏ chạy bằng một tài khoản Admin duy nhất).
    ///
    /// <para>Nhân sự KHÔNG qua cửa này, kể cả khi chính họ là người ngồi nhập bộ tiêu chí: bộ
    /// tiêu chí đã duyệt chính là phiếu chấm phỏng vấn, mà "hỏi ứng viên cái gì cho vị trí này"
    /// là chuyên môn của bộ phận. Để nhân sự tự chốt thì cửa duyệt chỉ là một nút bấm thêm.</para>
    /// </summary>
    public static async Task EnsureCanApproveAsync(
        IJobRepo jobRepo, IContextData contextData, long companyId, long jobId)
    {
        if (string.Equals(contextData.Role, RoleConstants.Admin, StringComparison.OrdinalIgnoreCase))
            return;

        if (!string.Equals(contextData.Role, RoleConstants.DepartmentManager, StringComparison.OrdinalIgnoreCase))
            throw Error(HttpStatusCode.Forbidden, "FORBIDDEN",
                "Chỉ Trưởng bộ phận phụ trách vị trí này mới được duyệt bộ tiêu chí. " +
                "Hãy bấm \"Gửi Trưởng bộ phận duyệt\" để chuyển cho họ.");

        var job = await jobRepo.GetByIdAsync(companyId, jobId)
            ?? throw Error(HttpStatusCode.NotFound, "NOT_FOUND", $"Không tìm thấy Job (job_id={jobId}).");

        if (job.DepartmentManagerId is not long dmId)
            throw Error(HttpStatusCode.Forbidden, "FORBIDDEN",
                "Tin tuyển dụng này chưa gán Trưởng bộ phận phụ trách nên chưa có ai duyệt được " +
                "bộ tiêu chí. Hãy đề nghị bộ phận nhân sự gán người phụ trách trước.");

        if (dmId != contextData.UserId)
            throw Error(HttpStatusCode.Forbidden, "FORBIDDEN",
                "Chỉ Trưởng bộ phận phụ trách vị trí này mới được duyệt bộ tiêu chí của nó.");
    }

    /// <summary>
    /// Cửa SOẠN + DUYỆT cho bộ tiêu chí còn nằm ở YÊU CẦU TUYỂN DỤNG (V056) — job chưa tồn tại
    /// nên không có <c>Job.department_manager_id</c> để đối chiếu.
    ///
    /// <para>Ở đây soạn và duyệt là MỘT cửa, khác hẳn phía job: yêu cầu tuyển dụng chỉ Trưởng bộ
    /// phận tạo được (<c>[WithRole(DepartmentManager)]</c> trên RecruitmentRequestController), nên
    /// người ra đề cũng chính là người duyệt. Bắt họ tự "gửi duyệt" cho chính mình rồi tự bấm
    /// duyệt là thêm một nút không kiểm soát thêm được gì — đó là lý do đường này bỏ qua PENDING.
    /// Cửa PENDING của V055 vẫn còn nguyên cho bộ tiêu chí sửa TRÊN JOB, nơi nhân sự soạn hộ.</para>
    ///
    /// <para>Chủ sở hữu là <c>RecruitmentRequest.created_by</c>, không phải role: một công ty có
    /// nhiều Trưởng bộ phận và đề bài của bộ phận này không phải việc của bộ phận kia.</para>
    /// </summary>
    public static async Task EnsureCanEditRequestCriteriaAsync(
        IRecruitmentRequestRepo requestRepo, IContextData contextData, long companyId, long requestId)
    {
        var request = await requestRepo.GetByIdAsync(companyId, requestId)
            ?? throw Error(HttpStatusCode.NotFound, "NOT_FOUND",
                $"Không tìm thấy yêu cầu tuyển dụng (request_id={requestId}).");

        if (string.Equals(contextData.Role, RoleConstants.Admin, StringComparison.OrdinalIgnoreCase))
            return;

        if (request.CreatedBy is long chuNhan && chuNhan == contextData.UserId)
            return;

        throw Error(HttpStatusCode.Forbidden, "FORBIDDEN",
            "Chỉ người tạo yêu cầu tuyển dụng này mới được ra đề bộ tiêu chí cho nó.");
    }

    private static BaseException Error(HttpStatusCode status, string code, string msg) => new(msg)
    {
        ErrorCode = code, ErrorMessage = msg, HttpStatus = (int)status
    };
}
