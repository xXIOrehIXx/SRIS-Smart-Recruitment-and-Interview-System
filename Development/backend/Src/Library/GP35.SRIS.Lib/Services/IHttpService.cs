using Microsoft.AspNetCore.Http;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;

namespace GP35.SRIS.Lib.Services;

/// <summary>
/// Xử lý gọi http
/// </summary>
public interface IHttpService
{
  /// <summary>
  /// Call http
  /// </summary>
  /// <param name="method">method</param>
  /// <param name="url">Địa chỉ service</param>
  /// <param name="data">dữ liệu</param>
  /// <param name="headers">header</param>
  Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, Dictionary<string, string> headers = null, object data = null);

  /// <summary>
  /// Call http
  /// </summary>
  /// <param name="method">method</param>
  /// <param name="url">Địa chỉ service</param>
  /// <param name="data">dữ liệu</param>
  /// <param name="headers">header</param>
  Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, TimeSpan timeout, Dictionary<string, string> headers = null, object data = null);

  /// <summary>
  /// Call http
  /// </summary>
  /// <param name="method">method</param>
  /// <param name="url">Địa chỉ service</param>
  /// <param name="data">dữ liệu</param>
  /// <param name="headers">header</param>
  /// <returns>Parse response content trả về</returns>
  Task<T> SendAsync<T>(HttpMethod method, string url, Dictionary<string, string> headers = null, object data = null);

  /// <summary>
  /// Lấy thông tin user agent của request
  /// </summary>
  string GetUserAgent(HttpRequest request);
  /// <summary>
  /// Lấy thông tin ip của request
  /// </summary>
  string GetIp(HttpRequest request);

  /// <summary>
  /// Build Uri param
  /// NVKHAI 26.12.2022
  /// </summary>
  string BuildUriParam(string baseUrl, Dictionary<string, object> param);

  /// <summary>
  /// Call http nhận về HttpResponseMessage
  /// </summary>
  /// <param name="method"></param>
  /// <param name="url"></param>
  /// <param name="headers"></param>
  /// <param name="data"></param>
  /// <returns></returns>
  Task<HttpResponseMessage> HttpResponseSendAsync(HttpMethod method, string url, Dictionary<string, string> headers = null, object data = null);
}
