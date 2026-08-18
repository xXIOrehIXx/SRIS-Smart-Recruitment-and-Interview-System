<#
=====================================================================
 SRIS - Script chay AI service
---------------------------------------------------------------------
 Tu dong: tim Python -> tao venv -> cai thu vien -> chay uvicorn.

 Cach dung (mo PowerShell, dung dau cham):
   .\run_ai.ps1            # setup (neu can) roi chay AI service o port 8000
   .\run_ai.ps1 -Port 8001 # chay o port khac
   .\run_ai.ps1 -Setup     # CHI cai dat, khong chay
   .\run_ai.ps1 -Force     # neu port dang ban -> tu kill tien trinh cu
   .\run_ai.ps1 -Reinstall # cai lai thu vien (khi loi/hong venv)

 Thu vien rat nhe (fastapi + uvicorn + ollama + pydantic) - KHONG con torch,
 KHONG con sentence-transformers: model nam trong Ollama, service chi goi sang.

 YEU CAU: Ollama dang chay + da pull 2 model:
   ollama pull qwen2.5     # boc tieu chi tu JD      (doi qua env SRIS_LLM_MODEL)
   ollama pull qwen3:8b    # sang loc CV theo JD     (doi qua env SRIS_CV_MODEL)
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
# 1) Dam bao co venv
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
        Die ("Khong tim thay Python 3.11/3.12/3.13.`n" +
             "    -> Cai Python 3.12 tai https://www.python.org/downloads/windows/ roi chay lai script nay.")
    }

    Ok "Dung Python $chosen de tao venv."
    & py "-$chosen" -m venv $VenvDir
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $VenvPython)) { Die "Tao venv that bai." }
    Ok "Da tao venv tai .venv"
}

$pyVer = (& $VenvPython -c "import sys; print('%d.%d' % sys.version_info[:2])").Trim()
Ok "venv Python = $pyVer"

# ---------------------------------------------------------------
# 2) Cai thu vien neu thieu (idempotent)
# ---------------------------------------------------------------
# Wrap trong try/catch: tren Windows PowerShell 5.1, stderr cua python (khi import loi
# o venv moi) bi boc thanh NativeCommandError + ErrorActionPreference='Stop' -> dung ngang
# script. Catch de coi nhu "chua co deps" roi di cai tiep.
$depsOk = $false
try {
    & $VenvPython -c "import fastapi, uvicorn, ollama, pydantic" 2>$null
    $depsOk = ($LASTEXITCODE -eq 0)
} catch {
    $depsOk = $false
}

if ($Reinstall -or -not $depsOk) {
    Info "Cai/cap nhat thu vien (fastapi, uvicorn, ollama, pydantic)..."
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
        Die ("Port $Port dang bi chiem boi PID $owner.`n" +
             "    -> Tat tien trinh do, hoac chay lai voi -Force, hoac doi -Port khac.")
    }
}

# ---------------------------------------------------------------
# 4) Chay AI service (chiem cua so nay - Ctrl+C de dung)
# ---------------------------------------------------------------
Ok "Khoi dong AI service tai http://127.0.0.1:$Port  (Ctrl+C de dung)"
Warn "Nho: Ollama phai dang chay va da pull 'qwen2.5' (boc tieu chi) + 'qwen3:8b' (sang loc CV)."
Warn "Lan goi DAU TIEN cua moi endpoint phai nap model vao RAM (~5GB/model) -> cham hon han."
Warn "Hai endpoint dung hai model khac nhau nen phai lam nong RIENG tung cai:"
Warn "  ban thu 1 lan /extract-criteria VA 1 lan /screen-cv truoc khi demo."
& $VenvPython -m uvicorn main:app --port $Port
