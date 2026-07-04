using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos;
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
[Authorize]
[WithRole(RoleConstants.Recruiter, RoleConstants.Admin)]
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
        public async Task<IActionResult> Create([FromBody] JobCreateDto dto)
        {
            var job = await _jobService.CreateAsync(_contextData.CompanyId, _contextData.UserId, dto);
            return Ok(job);
        }

        /// <summary>Danh sách Job của công ty hiện tại (mọi user đã đăng nhập).</summary>
        [HttpGet]
        public async Task<IActionResult> List()
        {
            var jobs = await _jobService.GetListAsync(_contextData.CompanyId);
            return Ok(jobs);
        }

        /// <summary>Chi tiết 1 Job.</summary>
        [HttpGet("{jobId:long}")]
        public async Task<IActionResult> GetById(long jobId)
        {
            return Ok(await _jobService.GetByIdAsync(_contextData.CompanyId, jobId));
        }

        /// <summary>Sửa Job (title/JD/DM/status). Đóng job = Status "Closed". JD đổi -> embedding tự làm mới.</summary>
        [HttpPut("{jobId:long}")]
        [Authorize(Roles = "Recruiter")]
        public async Task<IActionResult> Update(long jobId, [FromBody] JobUpdateDto dto)
        {
            return Ok(await _jobService.UpdateAsync(_contextData.CompanyId, jobId, dto));
        }
    }
}
