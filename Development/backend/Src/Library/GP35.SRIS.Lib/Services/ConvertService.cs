using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using Microsoft.Extensions.DependencyInjection;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

using GP35.SRIS.Domain.Shared.Configs;

namespace GP35.SRIS.Lib.Services;

public class ConvertService : IConvertService
{
  private readonly string DateTimeFormatDefault = "dd/MM/yyyy HH:mm:ss fff";
  private readonly string DateFormatDefault = "dd/MM/yyyy";
  private readonly string DateTimeFormat = "dd/MM/yyyy HH:mm:ss";
  private readonly string DateTimeFormatRM = "MM/dd/yyyy HH:mm:ss";
  private readonly DefaultConfig _config;
  public ConvertService(IServiceProvider serviceProvider)
  {
    _config = serviceProvider.GetRequiredService<DefaultConfig>();
  }

  public string PascalCaseToSnakeCase(string input)
  {
    if (string.IsNullOrEmpty(input))
      return input;

    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < input.Length; i++)
    {
      char currentChar = input[i];

      if (char.IsUpper(currentChar))
      {
        if (i > 0 && input[i - 1] != '_')
          sb.Append('_');

        sb.Append(char.ToLower(currentChar));
      }
      else
      {
        sb.Append(currentChar);
      }
    }

    return sb.ToString();
  }

  /// <summary>
  /// Hàm chuyển tiếng việt có dấu về không dấu
  /// </summary>
  /// <param name="input"></param>
  /// <returns></returns>
  public string ConvertToUnSign3(string input)
  {
    Regex regex = new Regex("\\p{IsCombiningDiacriticalMarks}+");
    string temp = input.Normalize(NormalizationForm.FormD);
    return regex.Replace(temp, String.Empty).Replace('\u0111', 'd').Replace('\u0110', 'D');
  }
  public DateTime GetDateTimeDefault(string dateString)
  {
    var result = new DateTime();

    if (string.IsNullOrEmpty(dateString))
      return result;
    try
    {
      result = DateTime.ParseExact(dateString, DateTimeFormat, CultureInfo.InvariantCulture);
    }
    catch (Exception e)
    {
    }
    return result;
  }
  public T Deserialize<T>(string input)
  {
    return JsonConvert.DeserializeObject<T>(input);
  }

  public string Serialize(object input)
  {
    return JsonConvert.SerializeObject(input);
  }
}
