using System;
using System.Collections.Generic;
using System.Reflection;

namespace GP35.SRIS.Lib.Services;

public interface ITypeService
{
  /// <summary>
  /// Có phải list không
  /// </summary>
  bool IsList(Type type);

  /// <summary>
  /// Lấy kiểu dữ liệu trong list
  /// </summary>
  /// <param name="listType">Kiểu dữ liệu của List</param>
  Type GetTypeInList(Type listType);

  /// <summary>
  /// Chuyển dữ liệu từ origin ra T
  /// Sử dụng để map từ dto -> entity hoặc clone dữ liệu
  /// </summary>
  /// <typeparam name="TDes">Kiểu dữ liệu đích</typeparam>
  /// <param name="origin">Dữ liệu nguồn</param>
  /// <returns>Kết quả</returns>
  TDes MapData<TDes>(object origin);

  /// <summary>
  /// Chuyển dữ liệu từ origin ra T
  /// </summary>
  /// <param name="origin">Dữ liệu nguồn</param>
  /// <param name="desType">Kiểu dữ liệu đích</param>
  /// <returns>Kết quả</returns>
  object MapData(object origin, Type desType);

  /// <summary>
  /// Lấy danh sách các thuộc tính theo attribute
  /// </summary>
  /// <typeparam name="TAttribute">Attribute</typeparam>
  /// <param name="entityType">Model</param>
  Dictionary<PropertyInfo, TAttribute> GetPropertys<TAttribute>(Type entityType)
     where TAttribute : Attribute;

  /// <summary>
  /// Lấy danh sách tên các thuộc tính có cấu hình attribute
  /// </summary>
  /// <typeparam name="TAttribute">Attribute</typeparam>
  /// <param name="entityType">Model</param>
  List<string> GetPropertyFields<TAttribute>(Type entityType)
     where TAttribute : Attribute;

  /// <summary>
  /// Lấy danh sách propertyInfo các thuộc tính có cấu hình attribute
  /// </summary>
  /// <typeparam name="TAttribute">Attribute</typeparam>
  /// <param name="entityType">Model</param>
  List<PropertyInfo> GetPropertyInfos<TAttribute>(Type entityType)
     where TAttribute : Attribute;

  /// <summary>
  /// Khởi tạo đối tượng
  /// </summary>
  /// <typeparam name="T">Kiểu dữ liệu</typeparam>
  T Create<T>();

  /// <summary>
  /// Khởi tạo đối tượng
  /// </summary>
  /// <param name="type">Kiểu dữ liệu</param>
  object Create(Type type);

  /// <summary>
  /// Kiểm tra dữ liệu nó không
  /// </summary>
  /// <param name="value">Giá trị kiểm tra</param>
  /// <returns>true: dữ liệu không pass điều kiện required</returns>
  bool RequiredFail(object value);

  /// <summary>
  /// Lấy thông tin custom attribute của đối tượng
  /// </summary>
  /// <typeparam name="TAttribute">Attribute</typeparam>
  /// <param name="type">Dữ liệu nào</param>
  TAttribute GetCustomAttribute<TAttribute>(Type type)
      where TAttribute : Attribute;

  /// <summary>
  /// Lấy danh sách thuộc tính của kiểu dữ liệu
  /// </summary>
  /// <param name="type">Dữ liệu nào</param>
  List<PropertyInfo> GetProperties(Type type);
}
