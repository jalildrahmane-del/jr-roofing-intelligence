# Private local owner onboarding. Never passes the password in command arguments or writes it to disk.
$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js 24 or newer is required." }
$major = [int]((& node -p "process.versions.node.split('.')[0]").Trim())
if ($major -lt 24) { throw "Node.js 24 or newer is required." }
Write-Host "Create a private local manager account named 'owner'."
Write-Host "Use fictional project information during the preview."
$secure = Read-Host "Choose a password (at least 12 characters)" -AsSecureString
$bstr = [IntPtr]::Zero
$password = $null
try {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  if ($password.Length -lt 12) { throw "Password must contain at least 12 characters." }
  $password | & node "scripts/create-user.ts" "owner" "manager"
  if ($LASTEXITCODE -ne 0) { throw "Could not create account. Existing data was not reset." }
  Write-Host "Manager account created. Username: owner"
} finally {
  $password = $null
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  $secure.Dispose()
}
