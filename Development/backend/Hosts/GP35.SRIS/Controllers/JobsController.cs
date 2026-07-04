using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers
{
    /// <summary>
    /// Quản lý Job. Tạo Job chỉ dành cho Recruiter (docs 2, 5.14 — Recruiter vận hành pipeline).
    /// </summary>
[Route("api/[controller]")]
[ApiController]
    public class JobsController : ControllerBase
    {
        private readonly IContextData _contextData;
        private readonly IJobService _jobService;

        public JobsController(IContextData contextData, IJobService jobService)
        {
            _contextData = contextData;
            _jobService = jobService;
        }

        /// <summary>Tạo Job mới — CHỈ Recruiter (role check qua JWT). Để trống Status = "Open".</summary>
        [HttpPost]
        [Authorize(Roles = "Recruiter")]
        [WithRole(RoleConstants.Recruiter, RoleConstants.Admin)]
        public async Task<IActionResult> Create([FromBody] JobCreateDto dto)
        {
            var job = await _jobService.CreateAsync(_contextData.CompanyId, _contextData.UserId, dto);
            return Ok(job);
        }

        /// <summary>Danh sách Job đang tuyển (public, không cần login).</summary>
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> List()
        {
            var jobs = await _jobService.GetPublicJobsAsync();
            return Ok(jobs);
        }
    }
}
