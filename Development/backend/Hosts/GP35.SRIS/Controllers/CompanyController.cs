using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos;
using GP35.SRIS.Application.Contracts.Services;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;

namespace GP35.SRIS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CompanyController : ControllerBase
    {
        private readonly IContextData _contextData;
        private readonly ICompanyService _companyService;

        public CompanyController(IContextData contextData, ICompanyService companyService)
        {
            _contextData = contextData;
            _companyService = companyService;
        }

        [HttpGet]
        public async Task<IActionResult> Get()
        {
            var company = await _companyService.GetByCompanyId(_contextData.CompanyId);

            if (company == null)
            {
                return NotFound();
            }

            return Ok(company);
        }

        /// <summary>Cấu hình brand (name/logo/màu) — CHỈ Admin (docs 2: "Quản lý user, cấu hình brand").</summary>
        [HttpPut("brand")]
        [WithRole(RoleConstants.Admin)]
        public async Task<IActionResult> UpdateBrand([FromBody] UpdateBrandDto dto)
        {
            var company = await _companyService.UpdateBrandAsync(_contextData.CompanyId, dto);
            return Ok(company);
        }

        /// <summary>Cập nhật hồ sơ công ty (name/logo/màu) — CHỈ Admin. Slug (URL công khai) cố định.</summary>
        [HttpPut]
        [WithRole(RoleConstants.Admin)]
        public async Task<IActionResult> Update([FromBody] UpdateBrandDto dto)
        {
            var company = await _companyService.UpdateBrandAsync(_contextData.CompanyId, dto);
            return Ok(company);
        }

        /// <summary>Đọc cấu hình SMTP riêng của công ty (che mật khẩu) — CHỈ Admin.</summary>
        [HttpGet("smtp")]
        [WithRole(RoleConstants.Admin)]
        public async Task<IActionResult> GetSmtp()
            => Ok(await _companyService.GetSmtpAsync(_contextData.CompanyId));

        /// <summary>Cấu hình SMTP riêng của công ty (email đi từ tên miền công ty) — CHỈ Admin.</summary>
        [HttpPut("smtp")]
        [WithRole(RoleConstants.Admin)]
        public async Task<IActionResult> UpdateSmtp([FromBody] UpdateSmtpDto dto)
            => Ok(await _companyService.UpdateSmtpAsync(_contextData.CompanyId, dto));

        /// <summary>Gửi email thử bằng SMTP hiện hành để kiểm tra cấu hình — CHỈ Admin.</summary>
        [HttpPost("smtp/test")]
        [WithRole(RoleConstants.Admin)]
        public async Task<IActionResult> TestSmtp([FromBody] SendTestEmailDto dto)
        {
            var sent = await _companyService.SendTestEmailAsync(_contextData.CompanyId, dto.ToEmail);
            return Ok(new { sent, message = sent
                ? "Đã gửi email thử. Kiểm tra hộp thư (cả Spam)."
                : "Chưa gửi được — kiểm tra Host/User/Password SMTP." });
        }
    }
}
