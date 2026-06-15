using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

using GP35.SRIS.Domain.Shared.Extensions;

using Newtonsoft.Json;

using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using System.Web;
using Serilog;

namespace GP35.SRIS.Lib.Services
{
  [ExcludeFromCodeCoverage]
  public class HttpService : IHttpService
  {
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger _logger;
    public HttpService(IServiceProvider serviceProvider)
    {
      _httpClientFactory = serviceProvider.GetRequiredService<IHttpClientFactory>();
      _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<HttpService>();
    }

    private HttpClient GetHttpClient()
    {
      var client = _httpClientFactory.CreateClient("IgnoreCertValidation");
      var handler = new HttpClientHandler();
      handler.ServerCertificateCustomValidationCallback = (sender, cert, chain, policy) => { return true; };
      return client;
    }

    public string BuildUriParam(string baseUrl, Dictionary<string, object> param)
    {
      if (string.IsNullOrEmpty(baseUrl))
      {
        throw new ArgumentNullException(nameof(baseUrl));
      }
      var result = new StringBuilder();
      result.Append(baseUrl);
      int i = 0;
      foreach (var item in param)
      {
        if (i == 0)
        {
          result.Append("?");
          i++;
        }
        else
        {
          result.Append("&");
        }
        if (item.Value != null)
        {
          result.Append(item.Key + "=" + HttpUtility.UrlPathEncode(item.Value.ToString()));
        }
      }
      return result.ToString();
    }

    public string GetIp(HttpRequest request)
    {
      return request.HttpContext.Connection.RemoteIpAddress.ToString().Replace("::ffff:", "");
    }

    public string GetUserAgent(HttpRequest request)
    {
      return request.Headers["User-Agent"].ToString();
    }

    public async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, Dictionary<string, string> headers = null, object data = null)
    {
      var requestMessage = new HttpRequestMessage();
      requestMessage.Method = method;
      var requestUrl = url;
      if (headers != null)
      {
        foreach (var item in headers)
        {
          this.SetRequestHeader(requestMessage.Headers, item.Key, item.Value);
        }
      }

      if (data != null)
      {
        if (method == HttpMethod.Get)
        {
          if (data is string)
          {
            //nếu là string thì đây là chuỗi tham số rồi -> nhắm mắt + vào url
            requestUrl += (string)data;
          }
          else
          {
            Dictionary<string, object> tempData;
            if (data is Dictionary<string, object>)
            {
              tempData = (Dictionary<string, object>)data;
            }
            else
            {
              tempData = JsonConvert.DeserializeObject<Dictionary<string, object>>(JsonConvert.SerializeObject(data));
            }

            var sb = new StringBuilder(requestUrl);
            if (!requestUrl.Contains("?"))
            {
              sb.Append("?");
            }

            foreach (var ditem in tempData)
            {
              sb.Append($"&{ditem.Key}={ditem.Value}");
            }
            requestUrl = sb.ToString();
          }
        }
        else
        {
          if (data is string)
          {
            requestMessage.Content = new StringContent(data as string, System.Text.Encoding.UTF8, "application/json");
          }
          else
          {
            requestMessage.Content = new StringContent(JsonConvert.SerializeObject(data), System.Text.Encoding.UTF8, "application/json");
          }
        }
      }
      requestMessage.RequestUri = new Uri(requestUrl);
      var httpClient = GetHttpClient();
      var response = await httpClient.SendAsync(requestMessage);
      return response;
    }

    public async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, TimeSpan timeout, Dictionary<string, string> headers = null, object data = null)
    {
      var requestMessage = new HttpRequestMessage();
      requestMessage.Method = method;
      var requestUrl = url;
      if (headers != null)
      {
        foreach (var item in headers)
        {
          this.SetRequestHeader(requestMessage.Headers, item.Key, item.Value);
        }
      }

      if (data != null)
      {
        if (method == HttpMethod.Get)
        {
          if (data is string)
          {
            //nếu là string thì đây là chuỗi tham số rồi -> nhắm mắt + vào url
            requestUrl += (string)data;
          }
          else
          {
            Dictionary<string, object> tempData;
            if (data is Dictionary<string, object>)
            {
              tempData = (Dictionary<string, object>)data;
            }
            else
            {
              tempData = JsonConvert.DeserializeObject<Dictionary<string, object>>(JsonConvert.SerializeObject(data));
            }

            var sb = new StringBuilder(requestUrl);
            if (!requestUrl.Contains("?"))
            {
              sb.Append("?");
            }

            foreach (var ditem in tempData)
            {
              sb.Append($"&{ditem.Key}={ditem.Value}");
            }
            requestUrl = sb.ToString();
          }
        }
        else
        {
          if (data is string)
          {
            requestMessage.Content = new StringContent(data as string, System.Text.Encoding.UTF8, "application/json");
          }
          else
          {
            requestMessage.Content = new StringContent(JsonConvert.SerializeObject(data), System.Text.Encoding.UTF8, "application/json");
          }
        }
      }
      requestMessage.RequestUri = new Uri(requestUrl);
      var httpClient = GetHttpClient();
      httpClient.Timeout = timeout;
      var response = await httpClient.SendAsync(requestMessage);
      return response;
    }


    public async Task<T> SendAsync<T>(HttpMethod method, string url, Dictionary<string, string> headers = null, object data = null)
    {

      var response = await this.SendAsync(method, url, headers, data);
      if (response.IsSuccessStatusCode)
      {
        var content = await response.Content.ReadAsStringAsync();
        try
        {
          if (typeof(T) == typeof(string))
          {
            return (T)(object)content;
          }

          var result = JsonConvert.DeserializeObject<T>(content);
          return result;
        }
        catch (Exception ex)
        {
          _logger.Here().Error(ex, "SendAsync_Ex");
          if (typeof(T) == typeof(string))
          {
            return (T)(object)content;
          }
        }
      }

      return default(T);
    }

    public async Task<HttpResponseMessage> HttpResponseSendAsync(HttpMethod method, string url, Dictionary<string, string> headers = null, object data = null)
    {

      var response = await this.SendAsync(method, url, headers, data);
      return response;
    }


    /// <summary>
    /// Gán header
    /// </summary>
    /// <param name="header">header</param>
    /// <param name="key">key</param>
    /// <param name="value">value</param>
    private void SetRequestHeader(HttpRequestHeaders header, string key, string value)
    {
      var lowerKey = key.ToLower();
      switch (lowerKey)
      {
        case "accept":
        case "content-length":
        case "content-type":
          header.TryAddWithoutValidation(key, value);
          break;
        case "host":
          //ignore
          break;
        default:
          header.TryAddWithoutValidation(key, value);
          break;
      }
    }
  }
}
