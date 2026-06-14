using System.Data;

namespace GP35.SRIS.Domain;

public interface IBaseRepo<TKey, T> where T : BaseEntity<TKey>
{
    // ==================== QUERY ====================
    Task<IEnumerable<T>> QueryAsync(string sql, object param = null, CommandType commandType = CommandType.Text, int? commandTimeout = null, IDbTransaction transaction = null);
    Task<IEnumerable<dynamic>> QueryAsyncDynamic(string sql, object param = null, CommandType commandType = CommandType.Text, int? commandTimeout = null, IDbTransaction transaction = null);
    Task<T> QuerySingleOrDefaultAsync(string sql, object param = null, CommandType commandType = CommandType.Text, int? commandTimeout = null, IDbTransaction transaction = null);
    Task<T> QuerySingleAsync(string sql, object param = null, CommandType commandType = CommandType.Text, int? commandTimeout = null, IDbTransaction transaction = null);
    Task<T> QueryFirstOrDefaultAsync(string sql, object param = null, CommandType commandType = CommandType.Text, int? commandTimeout = null, IDbTransaction transaction = null);
    Task<T> QueryFirstAsync(string sql, object param = null, CommandType commandType = CommandType.Text, int? commandTimeout = null, IDbTransaction transaction = null);

    // ==================== EXECUTE ====================
    Task<int> ExecuteAsync(string sql, object param = null, CommandType commandType = CommandType.Text, int? commandTimeout = null, IDbTransaction transaction = null);

    // ==================== EXECUTE SCALAR ====================
    Task<TResult> ExecuteScalarAsync<TResult>(string sql, object param = null, CommandType commandType = CommandType.Text, int? commandTimeout = null, IDbTransaction transaction = null);

    // ==================== QUERY MULTIPLE ====================
    //Task<SqlMapper.GridReader> QueryMultipleAsync(string sql, object param = null, CommandType commandType = CommandType.Text, int? commandTimeout = null, IDbTransaction transaction = null);

    // ==================== CRUD Methods ====================
    Task<IEnumerable<T>> GetAllAsync();
    Task<T> GetByIdAsync(TKey id);
    Task<int> InsertAsync(T entity);
    Task<int> UpdateAsync(T entity);
    Task<int> DeleteAsync(TKey id);
}
