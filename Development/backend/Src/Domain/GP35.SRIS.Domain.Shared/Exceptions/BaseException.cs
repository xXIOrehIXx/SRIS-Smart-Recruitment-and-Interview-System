using System.Net;

using Newtonsoft.Json;

namespace GP35.SRIS.Domain.Shared.Exceptions;

public class BaseException : Exception
{
  public BaseException() { }

  public BaseException(string message) : base(message) { }

  /// <summary>
  /// Nếu có thông tin này trả về thì sẽ hiển thị cho người dùng
  /// </summary>
  public string ErrorMessage { get; set; }
  /// <summary>
  /// Mã lỗi
  /// Phần lớn sẽ sử dụng thông tin này để client dựa theo đó hiển thị message tương ứng
  /// </summary>
  public string ErrorCode { get; set; }
  /// <summary>
  /// Dữ liệu trả về kèm để client hiển thị thông báo hoặc callback tương ứng
  /// Việc này sẽ phụ thuộc và ErrorCode
  /// </summary>
  public object ErrorData { get; set; }
  public int HttpStatus { get; set; } = (int)HttpStatusCode.InternalServerError;

  public virtual string GetClientReturn()
  {
    return JsonConvert.SerializeObject(this);
  }
}
