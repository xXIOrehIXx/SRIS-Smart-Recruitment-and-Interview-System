using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;

namespace GP35.SRIS.Lib.Services;

public class TypeService : ITypeService
{
  public T Create<T>()
  {
    return Activator.CreateInstance<T>();
  }
  public object Create(Type type)
  {
    return Activator.CreateInstance(type);
  }

  public Type GetTypeInList(Type listType)
  {
    if (this.IsList(listType))
    {
      Type type = listType.GetGenericArguments()[0];
      return type;
    }

    return null;
  }

  public bool IsList(Type type)
  {
    return type.IsGenericType && type.GetGenericTypeDefinition() == typeof(List<>);
  }

  public TDes MapData<TDes>(object origin)
  {
    return (TDes)this.MapData(origin, typeof(TDes));
  }

  public object MapData(object origin, Type desType)
  {
    if (origin == null || desType == null)
    {
      return null;
    }

    var des = Activator.CreateInstance(desType);
    var prsOrigin = origin.GetType().GetProperties();
    var prsDes = desType.GetProperties();

    foreach (var pro in prsOrigin)
    {
      var prd = prsDes.FirstOrDefault(n => n.Name == pro.Name);
      if (prd != null)
      {
        prd.SetValue(des, pro.GetValue(origin));
      }
    }

    return des;
  }

  //private ConcurrentDictionary<string, Dictionary<string, Dictionary<PropertyInfo, Attribute>>> _modelAttributes = new ConcurrentDictionary<string, Dictionary<string, Dictionary<PropertyInfo, Attribute>>>();
  /// <summary>
  /// Lấy danh sách các thuộc tính theo attribute
  /// </summary>
  /// <typeparam name="TAttribute">Attribute</typeparam>
  /// <param name="entityType">Model</param>
  public Dictionary<PropertyInfo, TAttribute> GetPropertys<TAttribute>(Type entityType)
      where TAttribute : Attribute
  {
    if (entityType == null)
    {
      return null;
    }

    //var entityTypeKey = entityType.FullName;
    //if (!_modelAttributes.ContainsKey(entityTypeKey))
    //{
    //    _modelAttributes[entityTypeKey] = new Dictionary<string, Dictionary<PropertyInfo, Attribute>>();
    //}

    //TODO từng ghi nhận log ELK lỗi type này trả về null rồi nên thêm kiểm tra
    var attrType = typeof(TAttribute);
    if (attrType == null)
    {
      return null;
    }
    //var attrTypeKey = attrType.FullName;
    //var attrs = _modelAttributes[entityTypeKey];
    //if (!attrs.ContainsKey(attrTypeKey))
    //{
    var result = new Dictionary<PropertyInfo, TAttribute>();
    var prs = GetProperties(entityType);
    foreach (var pr in prs)
    {
      var attr = pr.GetCustomAttribute<TAttribute>();
      if (attr != null)
      {
        result.Add(pr, attr);
      }
    }
    return result;
    //    attrs[attrTypeKey] = result;
    //}

    //return attrs[attrTypeKey];
  }

  //private ConcurrentDictionary<string, List<PropertyInfo>> _entityProperties = new ConcurrentDictionary<string, List<PropertyInfo>>();
  /// <summary>
  /// Lấy thông tin property của class model
  /// </summary>
  /// <param name="type">Model</param>
  protected List<PropertyInfo> GetProperties(Type type)
  {
    if (type == null)
    {
      return null;
    }

    return type.GetProperties().ToList();

    //var typeKey = type.FullName;
    //if (!_entityProperties.ContainsKey(typeKey))
    //{
    //    _entityProperties[typeKey] = type.GetProperties().ToList();
    //}

    //return _entityProperties[typeKey];
  }

  public bool RequiredFail(object value)
  {
    if (value == null
            || (value is Guid && Guid.Empty.Equals(value))
            || (value is string && string.Empty.Equals(value))
            || ((value is decimal || value is float || value is int || value is long) && 0.Equals(value))   //TODO case này tùy thuộc vào nghiệp vụ có muốn không
            )
    {
      return true;
    }

    return false;

  }

  public TAttribute GetCustomAttribute<TAttribute>(Type type)
      where TAttribute : Attribute
  {
    return type.GetCustomAttribute<TAttribute>();
  }

  List<PropertyInfo> ITypeService.GetProperties(Type type)
  {
    return type.GetProperties().ToList();
  }

  public List<string> GetPropertyFields<TAttribute>(Type entityType) where TAttribute : Attribute
  {
    var data = this.GetPropertys<TAttribute>(entityType);
    if (data == null || data.Count == null)
    {
      return null;
    }

    return data.Keys.Select(n => n.Name).ToList();
  }
  public List<PropertyInfo> GetPropertyInfos<TAttribute>(Type entityType) where TAttribute : Attribute
  {
    var data = this.GetPropertys<TAttribute>(entityType);
    if (data == null || data.Count == null)
    {
      return null;
    }

    return data.Keys.ToList();
  }
}
