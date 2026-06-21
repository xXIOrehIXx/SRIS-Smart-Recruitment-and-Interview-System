<#
=====================================================================
 SRIS - Script chay AI service THAT (embedding model)
---------------------------------------------------------------------
 Tu dong: tim Python 3.11/3.12/3.13 -> tao venv -> cai thu vien
          -> chay uvicorn (model that, KHONG phai stub).

 Cach dung (mo PowerShell, dung dau cham):
   .\run_ai.ps1            # setup (neu can) roi chay AI service o port 8000
   .\run_ai.ps1 -Port 8001 # chay o port khac
   .\run_ai.ps1 -Setup     # CHI cai dat, khong chay
   .\run_ai.ps1 -Force     # neu port dang ban -> tu kill tien trinh cu
   .\run_ai.ps1 -Reinstall # cai lai thu vien (khi loi/hong venv)

 Lan dau chay se tai torch (~200-300MB) + model (~120MB) -> doi vai phut.
=====================================================================
#>
[CmdletBinding()]
param(
    [int]$Port = 8000,
    [switch]$Setup,
    [switch]$Force,
    [switch]$Reinstall
)

$ErrorActionPreference = 'Stop'

# Luon lam viec trong thu muc chua script nay (ai-service).
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$VenvDir    = Join-Path $Root '.venv'
$VenvPython = Join-Path $VenvDir 'Scripts\python.exe'

function Info($m)  { Write-Host "[ ] $m" -ForegroundColor Cyan }
function Ok($m)    { Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m)  { Write-Host "[!] $m" -ForegroundColor Yellow }
function Die($m)   { Write-Host "[X] $m" -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------
# 1) Dam bao co venv chay bang Python 3.11/3.12/3.13 (KHONG 3.14)
# ---------------------------------------------------------------
if ($Reinstall -and (Test-Path $VenvDir)) {
    Warn "Xoa venv cu de cai lai..."
    Remove-Item -Recurse -Force $VenvDir
}

if (-not (Test-Path $VenvPython)) {
    Info "Chua co venv. Dang tim Python phu hop (3.12 -> 3.13 -> 3.11)..."

    $chosen = $null
    foreach ($v in '3.12', '3.13', '3.11') {
        try {
            # py launcher se chon dung ban version yeu cau neu da cai.
            & py "-$v" -c "import sys; print(sys.version.split()[0])" 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) { $chosen = $v; break }
        } catch { }
    }

    if (-not $chosen) {
        Die ("Khong tim thay Python 3.11/3.12/3.13. May dang co Python 3.14 (torch chua ho tro).`n" +
             "    -> Cai Python 3.12 tai https://www.python.org/downloads/windows/ roi chay lai script nay.")
    }

    Ok "Dung Python $chosen de tao venv."
    & py "-$chosen" -m venv $VenvDir
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $VenvPython)) { Die "Tao venv that bai." }
    Ok "Da tao venv tai .venv"
}

# Version sanity check (chan 3.14+ lot vao - torch chua ho tro)
$pyVer   = (& $VenvPython -c "import sys; print('%d.%d' % sys.version_info[:2])").Trim()
$pyMinor = [int](& $VenvPython -c "import sys; print(sys.version_info[1])").Trim()
if ($pyMinor -ge 14) {
    Die "venv dang dung Python $pyVer (qua moi cho torch). Xoa .venv va cai Python 3.12, roi chay -Reinstall."
}
Ok "venv Python = $pyVer"

# ---------------------------------------------------------------
# 2) Cai thu vien neu thieu (idempotent)
# ---------------------------------------------------------------
# Wrap trong try/catch: tren Windows PowerShell 5.1, stderr cua python (khi import loi
# o venv moi) bi boc thanh NativeCommandError + ErrorActionPreference='Stop' -> dung ngang
# script. Catch de coi nhu "chua co deps" roi di cai tiep.
$depsOk = $false
try {
    & $VenvPython -c "import fastapi, uvicorn, sentence_transformers" 2>$null
    $depsOk = ($LASTEXITCODE -eq 0)
} catch {
    $depsOk = $false
}

if ($Reinstall -or -not $depsOk) {
    Info "Cai/cap nhat thu vien (fastapi, uvicorn, sentence-transformers, torch)..."
    Info "Lan dau se tai torch ~200-300MB, vui long doi..."
    & $VenvPython -m pip install --upgrade pip
    & $VenvPython -m pip install -r (Join-Path $Root 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { Die "pip install that bai. Kiem tra mang/Python roi chay lai voi -Reinstall." }
    Ok "Cai thu vien xong."
} else {
    Ok "Thu vien da co san."
}

if ($Setup) { Ok "Setup hoan tat. Chay lai khong kem -Setup de khoi dong AI service."; exit 0 }

# ---------------------------------------------------------------
# 3) Giai phong port neu can
# ---------------------------------------------------------------
$busy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    $owner = ($busy | Select-Object -ExpandProperty OwningProcess -Unique)
    if ($Force) {
        Warn "Port $Port dang ban (PID $owner) -> kill (do -Force)."
        $owner | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
        Start-Sleep -Seconds 1
    } else {
        Die ("Port $Port dang bi chiem boi PID $owner (co the la stub_embed.py).`n" +
             "    -> Tat tien trinh do, hoac chay lai voi -Force, hoac doi -Port khac.")
    }
}

# ---------------------------------------------------------------
# 4) Chay AI service (chiem cua so nay - Ctrl+C de dung)
# ---------------------------------------------------------------
Ok "Khoi dong AI service THAT tai http://127.0.0.1:$Port  (Ctrl+C de dung)"
Info "Lan dau se tai model ~120MB; doi den khi thay 'Model san sang. So chieu vector = 384'."
& $VenvPython -m uvicorn main:app --port $Port
