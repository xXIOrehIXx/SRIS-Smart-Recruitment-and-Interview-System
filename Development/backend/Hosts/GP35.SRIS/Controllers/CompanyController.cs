using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers
{
  [Route("api/[controller]")]
  [ApiController]
  [Authorize]
  public class CompanyController : Controller
  {
    [HttpGet]
    public IActionResult Get()
    {
      return Ok(new { Message = "Hello from CompanyController!" });
    }
  }
}
