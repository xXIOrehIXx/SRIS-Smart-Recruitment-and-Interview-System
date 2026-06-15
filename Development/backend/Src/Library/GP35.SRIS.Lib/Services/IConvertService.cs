using System.Globalization;
using System.Runtime.Serialization;
using System;
using System.Collections.Generic;


namespace GP35.SRIS.Lib.Services;

public interface IConvertService
{
  /// <summary>
  /// Chuyển PascalCase thành snake_case
  /// </summary>
  /// <param name="input"></param>
  /// <returns></returns>
  string PascalCaseToSnakeCase(string input);
  /// <summary>
  /// Chuyển object thành string
  /// </summary>
  /// <param name="input">object đầu vào</param>
  string Serialize(object input);
  /// <summary>
  /// Chuyển string thành object
  /// </summary>
  /// <typeparam name="T">Kiểu dữ liệu trả về</typeparam>
  /// <param name="input">string đầu vào</param>
  T Deserialize<T>(string input);

  /// <summary>
  /// Hàm chuyển tiếng việt có dấu về không dấu
  /// </summary>
  /// <param name="input"></param>
  /// <returns></returns>
  string ConvertToUnSign3(string input);
  /// <summary>
  /// Convert string to datetime
  /// </summary>
  /// <param name="dateString"></param>
  /// <returns></returns>
  DateTime GetDateTimeDefault(string dateString);
}
