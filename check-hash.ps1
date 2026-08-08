Add-Type -AssemblyName System.Security
function Sha($s) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($s)
  $h = [System.Security.Cryptography.SHA256]::Create()
  $hash = $h.ComputeHash($bytes)
  return [Convert]::ToBase64String($hash)
}
Write-Output "Admin123 = $(Sha 'Admin123salt')"
Write-Output "123456   = $(Sha '123456salt')"
Write-Output "Admin123 (no salt) = $(Sha 'Admin123')"
