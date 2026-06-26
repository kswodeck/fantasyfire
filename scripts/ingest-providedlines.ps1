# FantasyFire — scheduled "provided lines" ingest (PrizePicks + Underdog).
#
# Local helper for a Windows Scheduled Task. MUST run off a residential / non-cloud
# IP: the DFS endpoints IP-block datacenters (same reason the NBA ingest doesn't run
# on Vercel/Actions). Appends output to logs/providedlines.log.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ingest-providedlines.ps1          # DEV (local .env) — default
#   ... -File scripts\ingest-providedlines.ps1 -Prod        # PROD only (.env.prod.local)  <-- the scheduled task uses this
#   ... -File scripts\ingest-providedlines.ps1 -Prod -Dev   # both
#
# -Prod requires .env.prod.local (gitignored) AND the ProvidedLine migration applied
# to the prod DB (pnpm db:deploy:prod, or a merge to main). The ingest is fail-safe:
# if prod isn't migrated yet it logs the error and exits non-fatally.
param([switch]$Prod, [switch]$Dev)
$ErrorActionPreference = 'Continue'

# No target flag → DEV (manual local default). The scheduled task passes -Prod, so
# it targets PRODUCTION only.
$runDev = $Dev.IsPresent -or (-not $Prod.IsPresent -and -not $Dev.IsPresent)
$runProd = $Prod.IsPresent

$repo = Split-Path -Parent $PSScriptRoot           # scripts/ -> repo root
# Prefer the portable Node 22 toolchain; fall back to whatever node is on PATH.
$toolchain = 'C:\Development\.toolchain\node-v22.23.1-win-x64'
if (Test-Path $toolchain) { $env:Path = "$toolchain;" + $env:Path }

Set-Location $repo
$logDir = Join-Path $repo 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$log = Join-Path $logDir 'providedlines.log'
Add-Content -Path $log -Value "`n===== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  ingest:providedlines (dev=$runDev prod=$runProd) ====="

if ($runDev) {
  Add-Content -Path $log -Value "--- dev (local .env) ---"
  pnpm ingest:providedlines *>> $log
}
if ($runProd -and (Test-Path (Join-Path $repo '.env.prod.local'))) {
  Add-Content -Path $log -Value "--- prod (.env.prod.local) ---"
  pnpm ingest:providedlines:prod *>> $log
}

Add-Content -Path $log -Value "done $(Get-Date -Format 'HH:mm:ss')"
