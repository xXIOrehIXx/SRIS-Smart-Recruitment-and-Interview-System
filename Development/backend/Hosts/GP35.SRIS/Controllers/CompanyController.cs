using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Services;
using GP35.SRIS.Domain.Shared.Context;

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
    }
}
