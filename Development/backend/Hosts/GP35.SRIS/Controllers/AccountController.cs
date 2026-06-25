using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos;
using GP35.SRIS.Lib.Services;
using Microsoft.AspNetCore.Authorization;

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

    [AllowAnonymous]
    [HttpPost("Login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
      var result = await _authService.LoginAsync(request.Email, request.Password);
      return Ok(result);
    }

    [AllowAnonymous]
    [HttpPost("ComputeHash")]
    public IActionResult ComputeHash([FromBody] HashRequest request)
    {
      var encodeService = HttpContext.RequestServices.GetRequiredService<IEncodeService>();
      var hash = encodeService.SHA256WithSalt(request.Password, "salt");
      return Ok(new { hash });
    }
  }

  public class HashRequest
  {
    public string Password { get; set; }
  }
}