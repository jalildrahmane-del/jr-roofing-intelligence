# JR Roofing Intelligence — Windows owner-preview packaging
# Creates a source ZIP for local use; never embeds accounts, local databases, secrets or dependencies.
$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git is required to create a clean preview ZIP." }
$branch = (& git branch --show-current).Trim()
if ($branch -ne "feature/owner-command-centre-expansion") { throw "Wrong branch: $branch" }
if ((& git status --porcelain).Length -gt 0) { throw "Uncommitted changes detected. Packaging cancelled." }
$sha = (& git rev-parse --short HEAD).Trim()
$target = Join-Path (Get-Location) "JR-Roofing-Owner-Preview-$sha.zip"
if (Test-Path $target) { throw "Archive already exists: $target" }
& git archive --format=zip "--output=$target" HEAD
if ($LASTEXITCODE -ne 0) { throw "Git archive failed." }
Write-Host "Created $target"
Write-Host "This archive contains source and a Windows launcher. Node.js 24+ is required."
Write-Host "No real project data, database, passwords, node_modules or build outputs are included."
