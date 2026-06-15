using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using GP35.SRIS.Lib.Models;
using GP35.SRIS.Domain.Shared.Enums;
using GP35.SRIS.Domain.Shared.Configs;
using System.Text;
using Serilog;

namespace GP35.SRIS.Lib.Services;

public class EmailService : IEmailService
{
  private readonly IHttpService _httpService;
  private readonly ILogger _logger;
  private readonly DefaultConfig _config;
  private readonly string[] _listBccEmailDefault;
  public EmailService(IServiceProvider serviceProvider)
  {
    _config = serviceProvider.GetRequiredService<DefaultConfig>();
    _httpService = serviceProvider.GetRequiredService<IHttpService>();
    _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<EmailService>();
  }
  public async Task<string> SendEmailAsync(string subject, string body, string toEmail, string ccEmail)
  {

    var objRes = string.Empty;
    try
    {
      //đường dẫn send email notifycationcenter
      var sendEmailUrl = _config.EmailService.EmailURL;
      //tham số truyền sang NotifycationCenter
      var emailReq = new SendEmailServiceReq()
      {
        Subject = subject,
        Body = body,
        IsBodyHtml = true,
        Recipients = new List<Recipient>()
      };

      if (!string.IsNullOrEmpty(toEmail))
      {
        var toRecipient = new Recipient()
        {
          RecipientAddress = toEmail

        };
        emailReq.Recipients.Add(toRecipient);
      }

      if (!string.IsNullOrEmpty(ccEmail))
      {
        var ccRecipient = new Recipient()
        {
          RecipientAddress = ccEmail,
          RecipientType = (int)RecipentType.CC
        };
        emailReq.Recipients.Add(ccRecipient);
      }

      //emailReq.Recipients = emailReq.Recipients.Distinct((x, y) => x.RecipientAddress == y.RecipientAddress).ToList();
      emailReq.Recipients = emailReq.Recipients.GroupBy(e => e.RecipientAddress).Select(e => e.FirstOrDefault()).ToList();


      //_logger.Debug($"EmailServiceOptions SendEmail-Req:{JsonConvert.SerializeObject(emailReq)}");

      //Gọi sang NotifycationCenter
      //objRes = CallService.CallRestService($"{sendEmailUrl}/api/email", "POST", JsonConvert.SerializeObject(emailReq));
      objRes = await _httpService.SendAsync<string>(HttpMethod.Post, $"{sendEmailUrl}{_config.EmailService.PathApiSendEmail}", null, JsonConvert.SerializeObject(emailReq));

      _logger.Debug($"EmailServiceOptions SendEmail-Res:{objRes}");
    }
    catch (Exception e)
    {
      _logger.Error($"EmailServiceOptions SendEmail-Ex:{e}");
      return objRes;
    }
    return objRes;
  }
  public async Task<string> SendEmailAttachmentAsync(string subject, string body, List<string> toEmails, List<string> ccEmails, List<EmailAttachment> attachments)
  {
    var objRes = string.Empty;
    try
    {
      //đường dẫn send email notifycationcenter
      var sendEmailUrl = _config.EmailService.EmailURL;

      //tham số truyền sang NotifycationCenter
      var emailReq = new SendEmailServiceReq()
      {
        Subject = subject,
        Body = body,
        IsBodyHtml = true,
        IsAttachment = true,
        Recipients = new List<Recipient>(),
        FileAttachments = new List<FileAttachment>()
      };

      if (toEmails != null && toEmails.Count > 0)
      {
        foreach (var item in toEmails)
        {
          var toRecipient = new Recipient()
          {
            RecipientAddress = item,
            RecipientType = (int)RecipentType.To
          };
          emailReq.Recipients.Add(toRecipient);
        }
      }

      if (ccEmails != null && ccEmails.Count > 0)
      {
        foreach (var item in ccEmails)
        {
          var ccRecipient = new Recipient()
          {
            RecipientAddress = item,
            RecipientType = (int)RecipentType.CC
          };
          emailReq.Recipients.Add(ccRecipient);
        }
      }

      if (attachments != null && attachments.Count > 0)
      {
        foreach (var item in attachments)
        {
          var att = new FileAttachment
          {
            AttachmentName = item.FileName,
            Content = item.FileContent,
            MimeType = "application/msword"
          };
          emailReq.FileAttachments.Add(att);
        }
      }

      //_logger.Debug($"EmailServiceOptions SendEmail-Req:{JsonConvert.SerializeObject(emailReq)}");

      //Gọi sang NotifycationCenter
      //objRes = CallService.CallRestService($"{sendEmailUrl}/api/email", "POST", JsonConvert.SerializeObject(emailReq));
      objRes = await _httpService.SendAsync<string>(HttpMethod.Post, $"{sendEmailUrl}/api/email", null, JsonConvert.SerializeObject(emailReq));

      _logger.Debug($"EmailServiceOptions SendEmail-Res:{objRes}");
    }
    catch (Exception e)
    {
      _logger.Error($"EmailServiceOptions SendEmail-Ex:{e}");
      return objRes;
    }
    return objRes;
  }
  public async Task<string> SendEmailAttachmentOnlyAsync(string subject, string body, string toEmail, List<string> ccEmail, List<EmailAttachment> attachments)
  {
    var objRes = string.Empty;
    _logger.Debug($"EmailServiceOptions toEmail-req:{toEmail}");
    try
    {
      //đường dẫn send email notifycationcenter
      var sendEmailUrl = _config.EmailService.EmailURL;

      //tham số truyền sang NotifycationCenter
      var emailReq = new SendEmailServiceReq()
      {
        Subject = subject,
        Body = body,
        IsBodyHtml = true,
        IsAttachment = true,
        Recipients = new List<Recipient>(),
        FileAttachments = new List<FileAttachment>()
      };

      if (!string.IsNullOrEmpty(toEmail))
      {
        var toRecipient = new Recipient()
        {
          RecipientAddress = toEmail

        };
        emailReq.Recipients.Add(toRecipient);
        _logger.Debug($"EmailServiceOptions toEmail-Recipients:{JsonConvert.SerializeObject(emailReq.Recipients)}");
      }

      if (ccEmail != null && ccEmail.Count > 0)
      {
        foreach (var item in ccEmail)
        {
          var ccRecipient = new Recipient()
          {
            RecipientAddress = item,
          };
          emailReq.Recipients.Add(ccRecipient);
        }
      }

      //_logger.Debug($"EmailServiceOptions SendEmail-Req:{JsonConvert.SerializeObject(emailReq)}");

      // bổ sung bcc email về dự án
      //if (_listBccEmailDefault != null && _listBccEmailDefault.Length > 0)
      //    for (int i = 0; i < _listBccEmailDefault.Length; i++)
      //    {
      //        emailReq.Recipients.Add(new Recipient()
      //        {
      //            RecipientAddress = _listBccEmailDefault[i].Trim(),
      //            RecipientName = "Dự án eSign",
      //            RecipientType = (int)RecipentType.BCC
      //        });
      //    }

      if (attachments != null && attachments.Count > 0)
      {
        foreach (var item in attachments)
        {
          var att = new FileAttachment
          {
            AttachmentName = item.FileName,
            Content = item.FileContent,
            MimeType = "application/msword"
          };
          emailReq.FileAttachments.Add(att);
        }
      }


      //Gọi sang NotifycationCenter
      //objRes = CallService.CallRestService($"{sendEmailUrl}/api/email", "POST", JsonConvert.SerializeObject(emailReq));
      objRes = await _httpService.SendAsync<string>(HttpMethod.Post, $"{sendEmailUrl}/api/email", null, JsonConvert.SerializeObject(emailReq));

      _logger.Debug($"EmailServiceOptions SendEmail-Res {objRes}");
    }
    catch (Exception e)
    {
      _logger.Error($"EmailServiceOptions SendEmail-Ex: {e}");
      return objRes;
    }
    return objRes;
  }
  public async Task<string> BuilTemplateEmailAsync(string fileName)
  {
    var pathToTemplate = Path.Combine(".", "Templates", fileName);
    var builder = new StringBuilder();
    using (var reader = System.IO.File.OpenText(pathToTemplate))
    {
      builder.Append(await reader.ReadToEndAsync());
    }
    var template = builder.ToString();
    return template;
  }
}
