namespace GP35.SRIS.Application.Contracts.Dtos;

public class UserGetDto : BaseEntityDto<Guid>
{
    public long UserId { get; set; }
    public string Email { get; set; }
    public string PasswordHash { get; set; }
    public string Salt { get; set; }
}