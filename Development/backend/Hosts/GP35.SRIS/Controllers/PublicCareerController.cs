using GP35.SRIS.Application.Contracts.Services.CandidatePortal;
using GP35.SRIS.Domain.Shared.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Career Site CÔNG KHAI (M1) — ứng viên ẩn danh, không login, không magic link. Tenant giải qua
/// slug ở <c>CareerSiteTenantMiddleware</c> (set IContextData.CompanyId trước khi controller chạy).
/// Cô lập tenant: Global Query Filter + RLS theo companyId đó.
/// </summary>
[Route("api/public/{slug}")]
[ApiController]
[AllowAnonymous]
public class PublicCareerController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly ICareerSiteService _careerSite;

    public PublicCareerController(IContextData contextData, ICareerSiteService careerSite)
    {
        _contextData = contextData;
        _careerSite = careerSite;
    }

    /// <summary>Brand công khai của công ty (tên/logo/màu) để render Career Site.</summary>
    [HttpGet("brand")]
    public async Task<IActionResult> Brand(string slug)
    {
        if (!TryGetCompany(out var companyId))
            return CompanyNotFound(slug);

        var brand = await _careerSite.GetBrandAsync(companyId);
        return brand is null ? CompanyNotFound(slug) : Ok(brand);
    }

    /// <summary>Danh sách vị trí đang mở.</summary>
    [HttpGet("jobs")]
    public async Task<IActionResult> Jobs(string slug)
    {
        if (!TryGetCompany(out var companyId))
            return CompanyNotFound(slug);

        return Ok(await _careerSite.ListOpenJobsAsync(companyId));
    }

    /// <summary>Chi tiết một vị trí đang mở.</summary>
    [HttpGet("jobs/{jobId:long}")]
    public async Task<IActionResult> Job(string slug, long jobId)
    {
        if (!TryGetCompany(out var companyId))
            return CompanyNotFound(slug);

        var job = await _careerSite.GetOpenJobAsync(companyId, jobId);
        return job is null
            ? NotFound(new { error = "Vị trí tuyển dụng không tồn tại hoặc đã đóng." })
            : Ok(job);
    }

    /// <summary>
    /// Ứng viên nộp CV (PDF, multipart/form-data) cho một vị trí. BẮT BUỘC họ tên + email + số điện thoại.
    /// </summary>
    [HttpPost("jobs/{jobId:long}/apply")]
    [RequestSizeLimit(20 * 1024 * 1024)] // 20MB
    public async Task<IActionResult> Apply(
        string slug,
        long jobId,
        [FromForm] string candidateName,
        [FromForm] string candidateEmail,
        [FromForm] string candidatePhone,
        IFormFile file)
    {
        if (!TryGetCompany(out var companyId))
            return CompanyNotFound(slug);

        if (file is null || file.Length == 0)
            return BadRequest(new { error = "Thiếu file CV (trường 'file')." });
        if (!file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "File CV phải có đuôi .pdf" });

        byte[] bytes;
        using (var ms = new MemoryStream())
        {
            await file.CopyToAsync(ms);
            bytes = ms.ToArray();
        }

        var result = await _careerSite.ApplyAsync(
            companyId, jobId, candidateName, candidateEmail, candidatePhone,
            file.FileName, file.ContentType, bytes);

        return Ok(result);
    }

    // companyId được middleware set từ slug; <= 0 nghĩa là slug không khớp công ty nào.
    private bool TryGetCompany(out long companyId)
    {
        companyId = _contextData.CompanyId;
        return companyId > 0;
    }

    private IActionResult CompanyNotFound(string slug) =>
        NotFound(new { error = $"Không tìm thấy công ty với slug '{slug}'." });
}
