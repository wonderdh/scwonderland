param(
  [Parameter(Mandatory = $true)]
  [string]$Kind
)

$ErrorActionPreference = "Stop"

$project = $env:CLAUDE_PROJECT_DIR
if ([string]::IsNullOrWhiteSpace($project)) {
  $project = (Get-Location).Path
}

$script = Join-Path $project "scripts\harness.mjs"
$stdin = [Console]::In.ReadToEnd()

if ($stdin.Length -gt 0) {
  $stdin | & node $script hook $Kind
} else {
  & node $script hook $Kind
}

exit $LASTEXITCODE
