# Silverstone full-lap capture pair (run A, then run B, then --compare). Approved by Matthew 2026-10-26:
# parameter search on the ladder, Silverstone tested over a full lap before and after. No paid calls here.
# 18,600 steps at 0.01 s (186 s simulated) covers the 446.2 m raceline at about 2.45 m/s plus a few metres.
param([Parameter(Mandatory=$true)][ValidateSet('baseline','retest')][string]$Label,
      [Parameter(Mandatory=$true)][string]$Gain, [Parameter(Mandatory=$true)][string]$Lookahead)
$ErrorActionPreference = 'Stop'
$env:PYTHONDONTWRITEBYTECODE = '1'
$Python = 'C:\Users\matth\projects\f1tenth-mcp\.venv\Scripts\python.exe'
$Root = 'C:\Users\matth\Documents\Codex\2026-10-26\blurr-f1tenth-sweep'
$Runner = Join-Path $Root 'scripts\capture_f1tenth_reconstructed.py'
$Core = Join-Path $Root 'scripts\f1tenth_capture_core.py'
$Outputs = Join-Path $Root ('outputs\Silverstone-' + $Label)
$Source = 'C:\Users\matth\Documents\Codex\2026-10-08\task\worktrees\f1tenth-raceline-reference'
$Gym = 'C:\Users\matth\projects\f1tenth_gym'
$RunnerHash = 'ba8bba80878ffb0c3654d764d1996959425c518b703ec518dd0a72522fa6cd0f'
$CoreHash = 'f4e81d601d6ad00364d72201f49a3289aff0ee478e51cdcb8d909ccf4c0307a6'
if ((Get-FileHash -LiteralPath $Runner -Algorithm SHA256).Hash.ToLowerInvariant() -ne $RunnerHash) { throw 'Runner bytes differ from review' }
if ((Get-FileHash -LiteralPath $Core -Algorithm SHA256).Hash.ToLowerInvariant() -ne $CoreHash) { throw 'Core bytes differ from review' }
if (Test-Path -LiteralPath $Outputs) { throw 'Output folder exists; use a fresh one' }
New-Item -ItemType Directory -Path $Outputs | Out-Null
$Common = @('--run','--track','Silverstone','--source-root',$Source,'--gym-root',$Gym,'--seed','20261009','--steps','18600','--timeout','1200',
            '--gain',$Gain,'--lookahead',$Lookahead,'--expected-runner-sha256',$RunnerHash,'--expected-core-sha256',$CoreHash)
foreach ($Run in 'run-a','run-b') {
  $Started = Get-Date
  & $Python -s $Runner @Common --output (Join-Path $Outputs $Run)
  if ($LASTEXITCODE -ne 0) { throw "$Run failed" }
  "$Run seconds: " + [int]((Get-Date) - $Started).TotalSeconds
}
& $Python -s $Runner --compare (Join-Path $Outputs 'run-a') (Join-Path $Outputs 'run-b')
if ($LASTEXITCODE -ne 0) { throw 'Capture comparison failed' }
(Get-Content -LiteralPath (Join-Path $Outputs 'run-a\session.json') -Raw | ConvertFrom-Json).outcome | ConvertTo-Json -Compress
