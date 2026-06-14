using System.Data;
namespace GP35.SRIS.Domain.Connection;

public interface IConnectionManager
{
  Task<IDbConnection> GetDbConnectionAsync();
}
