using GP35.SRIS.DbMigrator;
using Microsoft.Extensions.Configuration;

// =====================================================================
//  GP35.SRIS DB Migrator (DbUp) — CLI, tương tự Flyway cho .NET.
//
//  Lệnh:
//    (không tham số)  -> migrate: chạy các script CHƯA chạy
//    mark | baseline  -> đánh dấu các script hiện có là ĐÃ chạy (không chạy lại)
//    list | status    -> liệt kê các script đang chờ chạy
//
//  Connection: ConnectionStrings:DefaultConnection trong dbmigrator.json,
//  ghi đè bằng biến môi trường ConnectionStrings__DefaultConnection.
//
//  (Host tự gọi SrisMigrator.MigrateOrThrow lúc khởi động — xem Hosts/GP35.SRIS/Program.cs.)
// =====================================================================

var config = new ConfigurationBuilder()
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("dbmigrator.json", optional: true)
    .AddEnvironmentVariables()
    .Build();

var connectionString = config.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.Error.WriteLine(
        "Thiếu connection string. Đặt ConnectionStrings:DefaultConnection trong dbmigrator.json " +
        "hoặc biến môi trường ConnectionStrings__DefaultConnection.");
    return -1;
}

return SrisMigrator.RunCli(connectionString, args.FirstOrDefault()?.ToLowerInvariant());
