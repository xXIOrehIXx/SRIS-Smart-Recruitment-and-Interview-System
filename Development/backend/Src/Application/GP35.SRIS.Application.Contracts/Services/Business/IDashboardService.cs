using GP35.SRIS.Application.Contracts.Dtos.Business.Dashboard;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Dashboard / Analytics (docs 4, M7): phễu tuyển dụng, time-to-hire, offer acceptance rate,
/// phân rã lý do loại + nguồn ứng viên. Mọi số liệu cô lập theo tenant.
/// </summary>
public interface IDashboardService : IBaseService
{
    /// <summary>Tổng quan KPI cho dashboard. jobId null = toàn công ty; có giá trị = 1 job.</summary>
    Task<DashboardOverviewDto> GetOverviewAsync(long companyId, long? jobId);
}
