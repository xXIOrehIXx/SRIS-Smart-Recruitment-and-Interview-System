using System.Collections.Generic;
using GP35.SRIS.Lib.Models;
using System.Threading.Tasks;

namespace GP35.SRIS.Lib.Services;

public interface IEmailService
{
  /// <summary>
  /// Service gửi mail có file đính kèm nhưng chỉ có 1 người nhận
  /// </summary>
  /// <param name="subject"></param>
  /// <param name="body"></param>
  /// <param name="toEmail"></param>
  /// <param name="ccEmail"></param>
  /// <param name="attachments"></param>
  /// <returns></returns>
  Task<string> SendEmailAttachmentAsync(string subject, string body, List<string> toEmails, List<string> ccEmails, List<EmailAttachment> attachments);
  /// <summary>
  /// Service gửi mail có file đính kèm nhưng chỉ có 1 người nhận
  /// </summary>
  /// <param name="subject"></param>
  /// <param name="body"></param>
  /// <param name="toEmail"></param>
  /// <param name="ccEmail"></param>
  /// <param name="attachments"></param>
  /// <returns></returns>
  Task<string> SendEmailAttachmentOnlyAsync(string subject, string body, string toEmail, List<string> ccEmail, List<EmailAttachment> attachments);
  /// <summary>
  /// Service gửi mail 
  /// </summary>
  /// <param name="subject"></param>
  /// <param name="body"></param>
  /// <param name="toEmail"></param>
  /// <param name="ccEmail"></param>
  /// <param name="attachments"></param>
  /// <returns></returns>
  Task<string> SendEmailAsync(string subject, string body, string toEmail, string ccEmail);

  /// <summary>
  /// Build template cho email
  /// </summary>
  /// <param name="fileName">Tên file template</param>
  /// <returns></returns>
  Task<string> BuilTemplateEmailAsync(string fileName);
}
