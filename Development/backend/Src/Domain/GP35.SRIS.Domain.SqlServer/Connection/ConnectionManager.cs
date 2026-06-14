using Microsoft.Data.SqlClient;
using System.Data;
using GP35.SRIS.Domain;
using GP35.SRIS.Domain.Connection;

namespace GP35.SRIS.Domain.SqlServer.Connection;

public class ConnectionManager : IConnectionManager
{
  private readonly string _connectionString;
  private SqlConnection _dbConnection;

  public ConnectionManager(string connectionString)
  {
    _connectionString = connectionString;
  }

  public async Task<IDbConnection> GetDbConnectionAsync()
  {
    if (_dbConnection == null)
    {
      _dbConnection = new SqlConnection(_connectionString);
      await _dbConnection.OpenAsync();
    }
    return _dbConnection;
  }
}
