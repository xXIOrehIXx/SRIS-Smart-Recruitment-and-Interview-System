using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace GP35.SRIS.Domain.Shared.Configs
{
    public class DefaultConfig
    {
        public AuthOptions Auth { get; set; }
        public EmailServiceOptions EmailService { get; set; }
        public AiServiceOptions AiService { get; set; }
        public StorageOptions Storage { get; set; }
    }

    public class StorageOptions
    {
        public MinioOptions Minio { get; set; }
    }

    /// <summary>Cấu hình MinIO (tương thích S3). Deploy thật chỉ cần đổi các giá trị này sang S3.</summary>
    public class MinioOptions
    {
        /// <summary>Host:port của MinIO, vd "localhost:9000" (S3: "s3.amazonaws.com").</summary>
        public string Endpoint { get; set; }
        public string AccessKey { get; set; }
        public string SecretKey { get; set; }
        /// <summary>Tên bucket chứa file (vd "sris-cv").</summary>
        public string Bucket { get; set; }
        /// <summary>true nếu dùng HTTPS (S3 = true; MinIO local thường false).</summary>
        public bool UseSSL { get; set; }
    }

    public class AiServiceOptions
    {
        /// <summary>Base URL của Python AI service (vd http://127.0.0.1:8000).</summary>
        public string BaseUrl { get; set; }
    }

    public class AuthOptions
    {
        public string Key { get; set; }
        public string Issuer { get; set; }
        public string Audience { get; set; }
        public string ExpirationMinutes { get; set; }
    }

    public class EmailServiceOptions
    {
        public string EmailURL { get; set; }
        public string PathApiSendEmail { get; set; }
    }
}
