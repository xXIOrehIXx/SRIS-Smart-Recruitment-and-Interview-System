namespace GP35.SRIS.Application.Contracts;

public class BaseEntityDto<TKey> : BaseEntityDto
{
}

public class BaseEntityDto
{
  public DateTime? CreatedDate { get; set; }
  public string? CreatedBy { get; set; }
  public DateTime? ModifiedDate { get; set; }
  public string? ModifiedBy { get; set; }

}
