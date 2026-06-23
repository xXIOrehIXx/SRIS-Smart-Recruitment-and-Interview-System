namespace GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

/// <summary>1 dòng tiêu chí khi tạo/sửa khuôn.</summary>
public class CriteriaTemplateItemInputDto
{
    public string Name { get; set; } = null!;
    public decimal Weight { get; set; } = 1;
    public decimal MaxScore { get; set; } = 10;
}

/// <summary>Recruiter tạo khuôn tiêu chí mới (cấp company).</summary>
public class CriteriaTemplateInputDto
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public List<CriteriaTemplateItemInputDto> Items { get; set; } = new();
}

/// <summary>Recruiter sửa khuôn (header + thay toàn bộ dòng + bật/tắt).</summary>
public class CriteriaTemplateUpdateDto
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public bool Active { get; set; } = true;
    public List<CriteriaTemplateItemInputDto> Items { get; set; } = new();
}

/// <summary>1 dòng tiêu chí trong khuôn (đọc).</summary>
public class CriteriaTemplateItemDto
{
    public long ItemId { get; set; }
    public string Name { get; set; } = null!;
    public decimal Weight { get; set; }
    public decimal MaxScore { get; set; }
    public int DisplayOrder { get; set; }
}

/// <summary>1 khuôn tiêu chí kèm dòng (chi tiết).</summary>
public class CriteriaTemplateDto
{
    public long TemplateId { get; set; }
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public bool Active { get; set; }
    public List<CriteriaTemplateItemDto> Items { get; set; } = new();
}

/// <summary>Khuôn tiêu chí rút gọn cho danh sách (kèm số dòng).</summary>
public class CriteriaTemplateSummaryDto
{
    public long TemplateId { get; set; }
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public bool Active { get; set; }
    public int ItemCount { get; set; }
}
