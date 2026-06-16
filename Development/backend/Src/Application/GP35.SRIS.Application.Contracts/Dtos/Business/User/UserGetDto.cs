namespace GP35.SRIS.Application.Contracts.Dtos;

public class UserGetDto : BaseEntityDto<Guid>
{
    public long UserId { get; set; }
    public string Email { get; set; }
    public string? FullName { get; set; }
    public string? Phone { get; set; }
    public string? Role { get; set; }
    public string PasswordHash { get; set; }
    public string Salt { get; set; }
    public string CompanyId { get; set; }
}