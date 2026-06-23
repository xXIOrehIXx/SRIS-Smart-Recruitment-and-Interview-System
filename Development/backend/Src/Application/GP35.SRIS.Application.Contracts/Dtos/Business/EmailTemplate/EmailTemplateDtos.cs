namespace GP35.SRIS.Application.Contracts.Dtos.EmailTemplate;

/// <summary>Template email trả về cho Portal.</summary>
public class EmailTemplateDto
{
    public long TemplateId { get; set; }
    public string Type { get; set; } = null!;
    public string? Name { get; set; }
    public string Subject { get; set; } = null!;
    public string Body { get; set; } = null!;
    public bool IsActive { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>Tạo/sửa template. Body hỗ trợ placeholder {{candidateName}}, {{jobTitle}}, {{link}}, {{expiresAt}}, {{startTime}}.</summary>
public class EmailTemplateUpsertDto
{
    public string Type { get; set; } = null!;
    public string? Name { get; set; }
    public string Subject { get; set; } = null!;
    public string Body { get; set; } = null!;
    public bool IsActive { get; set; } = true;
}
