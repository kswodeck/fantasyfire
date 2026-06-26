# FantasyFire — scheduled "provided lines" ingest (PrizePicks + Underdog).
#
# Local helper for a Windows Scheduled Task. MUST run off a residential / non-cloud
# IP: the DFS endpoints IP-block datacenters (same reason the NBA ingest doesn't run
# on Vercel/Actions). Appends output to logs/providedlines.log.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ingest-providedlines.ps1
#   ... -File scripts\ingest-providedlines.ps1 -Prod    # ALSO refresh the prod DB
#
# -Prod requires .env.prod.local (gitignored) AND the ProvidedLine migration applied
# to prod (pnpm db:deploy:prod, or a merge to main). Without -Prod it refreshes the
# DEV database that your local .env points at.
param([switch]$Prod)
$ErrorActionPreference = 'Continue'

$repo = Split-Path -Parent $PSScriptRoot           # scripts/ -> repo root
# Prefer the portable Node 22 toolchain; fall back to whatever node is on PATH.
$toolchain = 'C:\Development\.toolchain\node-v22.23.1-win-x64'
if (Test-Path $toolchain) { $env:Path = "$toolchain;" + $env:Path }

Set-Location $repo
$logDir = Join-Path $repo 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$log = Join-Path $logDir 'providedlines.log'
Add-Content -Path $log -Value "`n===== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  ingest:providedlines (Prod=$Prod) ====="

# DEV (local .env) — keeps the dev DB (and a DEV-pointed preview) fresh.
pnpm ingest:providedlines *>> $log

# PROD (only when asked, prod creds present, and prod schema migrated).
if ($Prod -and (Test-Path (Join-Path $repo '.env.prod.local'))) {
  Add-Content -Path $log -Value "--- prod ---"
  pnpm ingest:providedlines:prod *>> $log
}

Add-Content -Path $log -Value "done $(Get-Date -Format 'HH:mm:ss')"
