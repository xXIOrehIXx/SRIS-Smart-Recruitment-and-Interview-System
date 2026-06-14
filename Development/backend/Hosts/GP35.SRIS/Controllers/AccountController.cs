using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos;

namespace GP35.SRIS
{
  [Route("api/[controller]")]
  [ApiController]
  public class AccountController : ControllerBase
  {
    private readonly IAuthService _authService;
    public AccountController(IAuthService authService)
    {
      _authService = authService;
    }

    // POST: api/Account/Login
    [HttpPost("Login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
      var result = await _authService.LoginAsync(request.Email, request.Password);
      return Ok(result);
    }
  }
}
