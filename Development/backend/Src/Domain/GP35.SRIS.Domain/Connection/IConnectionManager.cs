using System.Data;
namespace GP35.SRIS.Domain.Connection;

public interface IConnectionManager : IAsyncDisposable
{
  Task<IDbConnection> GetDbConnectionAsync();
}
