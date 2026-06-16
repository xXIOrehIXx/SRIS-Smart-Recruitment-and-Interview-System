using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

using Newtonsoft.Json;

namespace GP35.SRIS.Domain.Shared.Exceptions
{

  /// <summary>
  /// Lớp dùng chung mô tả lỗi trả về khi mã lỗi 400-500
  /// </summary>
  [ExcludeFromCodeCoverage]
  public class ErrorObjectCommon
  {

    /// <summary>
    /// Định danh của mã lỗi nội bộ
    /// </summary>
    /// <value>Định danh của mã lỗi nội bộ</value>
    public string ErrorCode { get; set; }

    /// <summary>
    /// Thông báo cho Dev. Thông báo ngắn gọn để thông báo cho Dev biết vấn đề đang gặp phải.
    /// </summary>
    /// <value>Thông báo cho Dev. Thông báo ngắn gọn để thông báo cho Dev biết vấn đề đang gặp phải.</value>
    public string DevMsg { get; set; }

    /// <summary>
    /// Thông báo cho user. Không bắt buộc, tùy theo đặc thù từng dịch vụ và client tích hợp
    /// </summary>
    /// <value>Thông báo cho user. Không bắt buộc, tùy theo đặc thù từng dịch vụ và client tích hợp</value>
    public string UserMsg { get; set; }

    /// <summary>
    /// Thông tin chi tiết hơn về vấn đề
    /// </summary>
    /// <value>Thông tin chi tiết hơn về vấn đề</value>
    public string MoreInfo { get; set; }

    /// <summary>
    /// Mã để tra cứu thông tin log
    /// </summary>
    /// <value>Mã để tra cứu thông tin log</value>
    public string TraceId { get; set; }

    /// <summary>
    /// Thông tin chi tiết các lỗi liên quan tới validate dữ liệu đầu vào
    /// </summary>
    public List<ErrorValidationFailures> ValidationFailures { get; set; }

    public ErrorObjectCommon(string errCode, string devMsg, string userMsg)
    {
      ErrorCode = errCode;
      DevMsg = devMsg;
      UserMsg = userMsg;
    }

    public ErrorObjectCommon(string errCode, string msg)
    {
      ErrorCode = errCode;
      DevMsg = msg;
      UserMsg = msg;
    }

    public ErrorObjectCommon()
    {
    }

    public override string ToString()
    {
      return JsonConvert.SerializeObject(this);
    }

  }

  [DataContract]
  [ExcludeFromCodeCoverage]
  public class ErrorValidationFailures : IEquatable<ErrorValidationFailures>, IValidatableObject
  {
    /// <summary>
    /// Initializes a new instance of the <see cref="ErrorValidationFailures" /> class.
    /// </summary>
    /// <param name="property">Tên thuộc tính.</param>
    /// <param name="failureReason">Lý do validate lỗi.</param>
    public ErrorValidationFailures(string property = default(string), string failureReason = default(string))
    {
      this.Property = property;
      this.FailureReason = failureReason;
    }

    /// <summary>
    /// Tên thuộc tính
    /// </summary>
    /// <value>Tên thuộc tính</value>
    [DataMember(Name = "Property", EmitDefaultValue = false)]
    public string Property { get; set; }

    /// <summary>
    /// Lý do validate lỗi
    /// </summary>
    /// <value>Lý do validate lỗi</value>
    [DataMember(Name = "FailureReason", EmitDefaultValue = false)]
    public string FailureReason { get; set; }

    /// <summary>
    /// Returns the string presentation of the object
    /// </summary>
    /// <returns>String presentation of the object</returns>
    public override string ToString()
    {
      var sb = new StringBuilder();
      sb.Append("class ErrorValidationFailures {\n");
      sb.Append("  Property: ").Append(Property).Append("\n");
      sb.Append("  FailureReason: ").Append(FailureReason).Append("\n");
      sb.Append("}\n");
      return sb.ToString();
    }

    /// <summary>
    /// Returns the JSON string presentation of the object
    /// </summary>
    /// <returns>JSON string presentation of the object</returns>
    public virtual string ToJson()
    {
      return JsonConvert.SerializeObject(this, Formatting.Indented);
    }

    /// <summary>
    /// Returns true if objects are equal
    /// </summary>
    /// <param name="obj">Object to be compared</param>
    /// <returns>Boolean</returns>
    public override bool Equals(object obj)
    {
      return this.Equals(obj as ErrorValidationFailures);
    }

    /// <summary>
    /// Returns true if ErrorValidationFailures instances are equal
    /// </summary>
    /// <param name="input">Instance of ErrorValidationFailures to be compared</param>
    /// <returns>Boolean</returns>
    public bool Equals(ErrorValidationFailures input)
    {
      if (input == null)
        return false;

      return
          (
              this.Property == input.Property ||
              (this.Property != null &&
              this.Property.Equals(input.Property))
          ) &&
          (
              this.FailureReason == input.FailureReason ||
              (this.FailureReason != null &&
              this.FailureReason.Equals(input.FailureReason))
          );
    }

    /// <summary>
    /// Gets the hash code
    /// </summary>
    /// <returns>Hash code</returns>
    public override int GetHashCode()
    {
      unchecked // Overflow is fine, just wrap
      {
        int hashCode = 41;
        if (this.Property != null)
          hashCode = hashCode * 59 + this.Property.GetHashCode();
        if (this.FailureReason != null)
          hashCode = hashCode * 59 + this.FailureReason.GetHashCode();
        return hashCode;
      }
    }

    /// <summary>
    /// To validate all properties of the instance
    /// </summary>
    /// <param name="validationContext">Validation context</param>
    /// <returns>Validation Result</returns>
    IEnumerable<System.ComponentModel.DataAnnotations.ValidationResult> IValidatableObject.Validate(ValidationContext validationContext)
    {
      yield break;
    }
  }
}
