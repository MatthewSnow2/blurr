# 100-setting parameter sweep on one ladder rung. Approved by Matthew 2026-10-26 (parameter search, 100 runs per rung).
# Grid: gain 0.35..1.25 step 0.1 x lookahead 6..24 points step 2 (includes the 0.65 / 14 baseline). Seed 20261009 and
# 600 steps for every run, so only the controller setting differs. A failed run is recorded and the sweep continues.
# No paid calls here.
param([Parameter(Mandatory=$true)][ValidateSet('Circle','Turn','TwoTurns','Chicane')][string]$Track)
$ErrorActionPreference = 'Stop'
$env:PYTHONDONTWRITEBYTECODE = '1'
$Python = 'C:\Users\matth\projects\f1tenth-mcp\.venv\Scripts\python.exe'
$Root = 'C:\Users\matth\Documents\Codex\2026-10-26\blurr-f1tenth-sweep'
$Runner = Join-Path $Root 'scripts\capture_f1tenth_reconstructed.py'
$Core = Join-Path $Root 'scripts\f1tenth_capture_core.py'
$Outputs = Join-Path $Root ('outputs\' + $Track + '-sweep')
$Summary = Join-Path $Outputs 'summary.jsonl'
$Source = 'C:\Users\matth\Documents\Codex\2026-10-08\task\worktrees\f1tenth-raceline-reference'
$Gym = 'C:\Users\matth\projects\f1tenth_gym'
$RunnerHash = 'ba8bba80878ffb0c3654d764d1996959425c518b703ec518dd0a72522fa6cd0f'
$CoreHash = 'f4e81d601d6ad00364d72201f49a3289aff0ee478e51cdcb8d909ccf4c0307a6'
if ((Get-FileHash -LiteralPath $Runner -Algorithm SHA256).Hash.ToLowerInvariant() -ne $RunnerHash) { throw 'Runner bytes differ from review' }
if ((Get-FileHash -LiteralPath $Core -Algorithm SHA256).Hash.ToLowerInvariant() -ne $CoreHash) { throw 'Core bytes differ from review' }
if (Test-Path -LiteralPath $Outputs) { throw 'Output folder exists; use a fresh one' }
New-Item -ItemType Directory -Path $Outputs | Out-Null
$Gains = '0.35','0.45','0.55','0.65','0.75','0.85','0.95','1.05','1.15','1.25'
$Lookaheads = '6','8','10','12','14','16','18','20','22','24'
foreach ($Gain in $Gains) { foreach ($Lookahead in $Lookaheads) {
  $Name = "g$Gain-l$Lookahead"
  $Out = Join-Path $Outputs $Name
  & $Python -s $Runner --run --track $Track --source-root $Source --gym-root $Gym --seed 20261009 --steps 600 --timeout 120 `
      --gain $Gain --lookahead $Lookahead --expected-runner-sha256 $RunnerHash --expected-core-sha256 $CoreHash --output $Out 2>&1 | Out-Null
  $Row = [ordered]@{ track = $Track; gain = [double]$Gain; lookahead_points = [int]$Lookahead; exit_code = $LASTEXITCODE }
  $SessionPath = Join-Path $Out 'session.json'
  if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $SessionPath)) {
    $Doc = Get-Content -LiteralPath $SessionPath -Raw | ConvertFrom-Json
    if ($Doc.controller.steering_gain -ne [double]$Gain -or $Doc.controller.lookahead_points -ne [int]$Lookahead) { throw "$Name sealed a different controller" }
    $Row.sample_count = $Doc.outcome.sample_count
    $Row.stop_reason = $Doc.outcome.stop_reason
    $Row.mean_abs_raceline_deviation_m = $Doc.outcome.mean_abs_raceline_deviation_m
    $Row.max_abs_raceline_deviation_m = $Doc.outcome.max_abs_raceline_deviation_m
    $Row.session_sha256 = (Get-FileHash -LiteralPath $SessionPath -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  ($Row | ConvertTo-Json -Compress) | Add-Content -LiteralPath $Summary -Encoding utf8
}}
"rows: " + (Get-Content -LiteralPath $Summary).Count
