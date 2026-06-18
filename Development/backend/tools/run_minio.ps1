<#
=====================================================================
 SRIS - Script chay MinIO (luu file CV goc cho API /upload)
---------------------------------------------------------------------
 Tu dong: tai minio.exe (neu chua co) -> chay MinIO server o port 9000
          voi user/pass khop appsettings (minioadmin / minioadmin).

 Bucket 'sris-cv' KHONG can tao tay: app tu tao khi upload lan dau.

 Cach dung (mo PowerShell, dung dau cham):
   .\run_minio.ps1            # tai (neu can) roi chay MinIO
   .\run_minio.ps1 -Force     # neu port 9000 ban -> kill tien trinh cu
   .\run_minio.ps1 -DataDir "D:\sris-minio-data"   # doi cho luu data

 Sau khi chay:
   - API S3:     http://127.0.0.1:9000
   - Web Console http://127.0.0.1:9001  (dang nhap minioadmin / minioadmin)
 De cua so nay chay nen. Ctrl+C de dung.
=====================================================================
#>
[CmdletBinding()]
param(
    [int]$Port        = 9000,
    [int]$ConsolePort = 9001,
    [string]$DataDir  = '',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path   # ...\backend\tools
$MinioDir = Join-Path $Root 'minio'
$MinioExe = Join-Path $MinioDir 'minio.exe'
if ([string]::IsNullOrWhiteSpace($DataDir)) { $DataDir = Join-Path $MinioDir 'data' }

function Info($m) { Write-Host "[ ] $m"  -ForegroundColor Cyan }
function Ok($m)   { Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "[!] $m"  -ForegroundColor Yellow }
function Die($m)  { Write-Host "[X] $m"  -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------
# 1) Tai minio.exe neu chua co
# ---------------------------------------------------------------
if (-not (Test-Path $MinioExe)) {
    New-Item -ItemType Directory -Force -Path $MinioDir | Out-Null
    $url = 'https://dl.min.io/server/minio/release/windows-amd64/minio.exe'
    Info "Chua co minio.exe -> dang tai (~100MB) tu $url ..."
    try {
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $url -OutFile $MinioExe
    } catch {
        Die "Tai minio.exe that bai: $_`n    -> Tai tay tu $url roi dat vao $MinioExe"
    }
    Ok "Da tai minio.exe -> $MinioExe"
} else {
    Ok "Da co minio.exe."
}

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

# ---------------------------------------------------------------
# 2) Giai phong port neu can
# ---------------------------------------------------------------
$busy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    $owner = ($busy | Select-Object -ExpandProperty OwningProcess -Unique)
    if ($Force) {
        Warn "Port $Port dang ban (PID $owner) -> kill (do -Force)."
        $owner | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
        Start-Sleep -Seconds 1
    } else {
        Die "Port $Port dang bi chiem (PID $owner). Tat no, hoac chay lai voi -Force."
    }
}

# ---------------------------------------------------------------
# 3) Chay MinIO (user/pass KHOP appsettings: Storage:Minio)
# ---------------------------------------------------------------
$env:MINIO_ROOT_USER     = 'minioadmin'
$env:MINIO_ROOT_PASSWORD = 'minioadmin'

Ok "Khoi dong MinIO:"
Info "  - Data dir : $DataDir"
Info "  - S3 API   : http://127.0.0.1:$Port   (app .NET noi vao day)"
Info "  - Console  : http://127.0.0.1:$ConsolePort  (dang nhap minioadmin / minioadmin)"
Info "  Bucket 'sris-cv' se tu tao khi upload CV lan dau. Ctrl+C de dung."

& $MinioExe server $DataDir --address ":$Port" --console-address ":$ConsolePort"
