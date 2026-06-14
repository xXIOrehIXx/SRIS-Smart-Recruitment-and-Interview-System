using System.ComponentModel.DataAnnotations.Schema;

namespace GP35.SRIS.Domain;

public class BaseEntity<TKey>
{
}

public interface IHasCreateInfo
{
    public DateTime? CreatedAt { get; set; }
    //public string? CreatedBy { get; set; }

}

public interface IHasModifyInfo
{
    public DateTime? UpdatedAt { get; set; }
    //public string? ModifiedBy { get; set; }
}

public interface IHasCompanyInfo
{
    [Column("company_id")]
    public long CompanyId { get; set; }
}