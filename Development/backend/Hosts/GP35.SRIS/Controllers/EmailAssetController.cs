using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using GP35.SRIS.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Ảnh dùng trong email (logo, banner) — người tuyển dụng tải từ máy lên, hệ thống trả về
/// một ĐỊA CHỈ CỐ ĐỊNH để nhúng vào thư.
///
/// <para><b>Vì sao không dùng link tạm (presigned) như file CV:</b> link đó hết hạn sau ~1 giờ,
/// nhúng vào email thì vài tiếng sau ứng viên mở ra chỉ thấy ô ảnh vỡ. Ảnh email phải sống lâu
/// bằng chính email, nên phục vụ qua endpoint công khai bên dưới.</para>
///
/// <para><b>Vì sao không dán thẳng ảnh vào ô soạn thảo:</b> trình duyệt sẽ nhúng ảnh dạng
/// base64, mà Gmail/Outlook chặn base64 trong email — người soạn thấy ảnh, người nhận thấy ô
/// trống, lại làm email phình quá giới hạn 102KB của Gmail.</para>
/// </summary>
[ApiController]
public class EmailAssetController : ControllerBase
{
    private const int MaxBytes = 2 * 1024 * 1024;

    private static readonly Dictionary<string, string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".gif"] = "image/gif",
        [".webp"] = "image/webp",
    };

    private readonly IContextData _contextData;
    private readonly IFileStorageService _storage;

    public EmailAssetController(IContextData contextData, IFileStorageService storage)
    {
        _contextData = contextData;
        _storage = storage;
    }

    /// <summary>
    /// Tải ảnh từ máy lên, trả { url } để chèn vào email. Chỉ Human Resource (Admin bypass).
    /// </summary>
    [HttpPost("api/email-assets")]
    [Authorize]
    [WithRole(RoleConstants.HumanResource)]
    [RequestSizeLimit(MaxBytes + 8192)]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "Chưa chọn ảnh." });

        if (file.Length > MaxBytes)
            return BadRequest(new { error = "Ảnh tối đa 2MB — ảnh quá nặng làm email bị cắt." });

        var ext = Path.GetExtension(file.FileName);
        if (!AllowedTypes.TryGetValue(ext ?? "", out var contentType))
            return BadRequest(new { error = "Chỉ nhận ảnh PNG, JPG, GIF hoặc WEBP." });

        // Tên file do hệ thống sinh: người dùng không đặt được đường dẫn -> không lo tên độc.
        var fileName = $"{Guid.NewGuid():N}{ext!.ToLowerInvariant()}";
        var objectName = EmailAssetPaths.ObjectName(_contextData.CompanyId, fileName);

        using var stream = file.OpenReadStream();
        await _storage.UploadAsync(objectName, stream, file.Length, contentType);

        // Địa chỉ tuyệt đối để trình duyệt (trang Portal) và email client tải được. Riêng email
        // thì lúc gửi ảnh còn được đính thẳng vào thư theo địa chỉ này — xem EmailInlineImages.
        var url = $"{Request.Scheme}://{Request.Host}" +
                  $"{EmailAssetPaths.PublicPrefix}{_contextData.CompanyId}/{fileName}";
        return Ok(new { url });
    }

    /// <summary>
    /// Phục vụ ảnh cho email client — KHÔNG đăng nhập (Gmail tải ảnh giúp người nhận, không
    /// mang theo phiên đăng nhập nào). Chỉ trả file trong thư mục ảnh email, không phải CV.
    /// </summary>
    [HttpGet("api/public/email-assets/{companyId:long}/{fileName}")]
    [AllowAnonymous]
    public async Task<IActionResult> Get(long companyId, string fileName)
    {
        // Chặn ../ và mọi đường dẫn lồng: chỉ nhận đúng một tên file phẳng.
        if (string.IsNullOrWhiteSpace(fileName) ||
            fileName.Contains('/') || fileName.Contains('\\') || fileName.Contains(".."))
            return NotFound();

        var ext = Path.GetExtension(fileName);
        if (!AllowedTypes.ContainsKey(ext ?? ""))
            return NotFound();

        var file = await _storage.DownloadAsync(EmailAssetPaths.ObjectName(companyId, fileName));
        if (file is null) return NotFound();

        // Tên file là GUID nên nội dung không bao giờ đổi -> cho cache lâu, email mở lại vẫn nhanh.
        Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        return File(file.Value.Content, file.Value.ContentType);
    }
}
