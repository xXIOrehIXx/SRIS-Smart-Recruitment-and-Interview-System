using Microsoft.Data.SqlClient;
using System.Data;
using Microsoft.Extensions.DependencyInjection;
using Dapper;
using System.Reflection;
using GP35.SRIS.Domain;
using GP35.SRIS.Domain.Connection;
using System.ComponentModel.DataAnnotations.Schema;
using Dapper;

namespace GP35.SRIS.Domain.SqlServer;

public class BaseRepo<TKey, T> : IBaseRepo<TKey, T> where T : BaseEntity<TKey>
{
    static BaseRepo()
    {
        DefaultTypeMap.MatchNamesWithUnderscores = true;
    }

    protected readonly string _tableName;
    protected IConnectionManager _connectionManager;

    public BaseRepo(IServiceProvider serviceProvider)
    {
        _tableName = GetTableName();
        _connectionManager = serviceProvider.GetRequiredService<IConnectionManager>();
    }

    public virtual string GetTableName()
    {
        var type = typeof(T);
        var attr = type.GetCustomAttribute<TableAttribute>();
        var tableName = attr?.Name ?? type.Name;

        if (string.IsNullOrWhiteSpace(tableName))
            return tableName;

        if (tableName.StartsWith("[") && tableName.EndsWith("]"))
            return tableName;

        return $"[{tableName}]";
    }

    #region Protected Helper Methods

    public virtual async Task<IEnumerable<T>> QueryAsync(string sql, object param = null, CommandType commandType = CommandType.Text, int? commandTimeout = null, IDbTransaction transaction = null)
    {
        var connection = await GetConnectionAsync();
        return await connection.QueryAsync<T>(sql, param, transaction, commandTimeout, commandType);
    }

    public virtual async Task<IEnumerable<dynamic>> QueryAsyncDynamic(string sql, object param = null, CommandType commandType = CommandType.Text, int? commandTimeout = null, IDbTransaction transaction = null)
    {
        var connection = await GetConnectionAsync();
        return await connection.QueryAsync(sql, param, transaction, commandTimeout, commandType);
    }

    public virtual async Task<T> QuerySingleOrDefaultAsync(string sql, object param = null, CommandType commandType = CommandType.Text, int? commandTimeout = null, IDbTransaction transaction = null)
    {
        var connection = await GetConnectionAsync();
        return await connection.QuerySingleOrDefaultAsync<T>(sql, param, transaction, commandTimeout, commandType);
    }

    public virtual async Task<T> QuerySingleAsync(string sql, object param = null, CommandType commandType = CommandType.Text, int? commandTimeout = null, IDbTransaction transaction = null)
    {
        var connection = await GetConnectionAsync();
        return await connection.QuerySingleAsync<T>(sql, param, transaction, commandTimeout, commandType);
    }

    public virtual async Task<T> QueryFirstOrDefaultAsync(string sql, object param = null, CommandType commandType = CommandType.Text, int? commandTimeout = null, IDbTransaction transaction = null)
    {
        var connection = await GetConnectionAsync();
        return await connection.QueryFirstOrDefaultAsync<T>(sql, param, transaction, commandTimeout, commandType);
    }

    public virtual async Task<T> QueryFirstAsync(string sql, object param = null, CommandType commandType = CommandType.Text, int? commandTimeout = null, IDbTransaction transaction = null)
    {
        var connection = await GetConnectionAsync();
        return await connection.QueryFirstAsync<T>(sql, param, transaction, commandTimeout, commandType);
    }

    public virtual async Task<int> ExecuteAsync(string sql, object param = null, CommandType commandType = CommandType.Text, int? commandTimeout = null, IDbTransaction transaction = null)
    {
        var connection = await GetConnectionAsync();
        return await connection.ExecuteAsync(sql, param, transaction, commandTimeout, commandType);
    }

    public virtual async Task<TResult> ExecuteScalarAsync<TResult>(string sql, object param = null, CommandType commandType = CommandType.Text, int? commandTimeout = null, IDbTransaction transaction = null)
    {
        var connection = await GetConnectionAsync();
        return await connection.ExecuteScalarAsync<TResult>(sql, param, transaction, commandTimeout, commandType);
    }

    public virtual async Task<object> QueryMultipleAsync(string sql, object param = null, CommandType commandType = CommandType.Text, int? commandTimeout = null, IDbTransaction transaction = null)
    {
        var connection = await GetConnectionAsync();
        return await connection.QueryMultipleAsync(sql, param, transaction, commandTimeout, commandType);
    }

    protected virtual async Task<IDbConnection> GetConnectionAsync()
        => await _connectionManager.GetDbConnectionAsync();

    #endregion

    #region Public CRUD Methods

    public virtual async Task<IEnumerable<T>> GetAllAsync()
    {
        var sql = $"SELECT * FROM {_tableName}";
        return await QueryAsync(sql);
    }

    public virtual async Task<T> GetByIdAsync(TKey id)
    {
        var sql = $"SELECT * FROM {_tableName} WHERE Id = @Id";
        return await QuerySingleOrDefaultAsync(sql, new { Id = id });
    }

    public virtual async Task<int> InsertAsync(T entity)
    {
        // TODO: Bạn có thể thay bằng dynamic SQL hoặc gọi Stored Procedure
        var sql = $"INSERT INTO {_tableName} ...";
        return await ExecuteAsync(sql, entity);
    }

    public virtual async Task<int> UpdateAsync(T entity)
    {
        var sql = $"UPDATE {_tableName} SET ... WHERE Id = @Id";
        return await ExecuteAsync(sql, entity);
    }

    public virtual async Task<int> DeleteAsync(TKey id)
    {
        var sql = $"DELETE FROM {_tableName} WHERE Id = @Id";
        return await ExecuteAsync(sql, new { Id = id });
    }

    #endregion
}
