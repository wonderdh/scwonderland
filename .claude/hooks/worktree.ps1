# Claude Code WorktreeCreate / WorktreeRemove hook (Windows / PowerShell)
#
# 책임:
#   - WorktreeCreate: repo 와 형제 디렉토리(..\worktrees\<name>) 에 worktree 생성,
#     .env.local / .env.development.local 복사, 별도 pwsh 창에서 `pnpm dev` 기동.
#     stdout 마지막에 worktree 절대 경로만 출력 (Claude Code 가 새 세션의 cwd 로 사용).
#   - WorktreeRemove: `git worktree remove --force` + `worktree-<name>` 브랜치 삭제.
#
# 로그: .claude\hooks\worktree.log 에 한 줄 append (다른 훅들과 컨벤션 통일).

$ErrorActionPreference = 'Stop'

# ---------- stdin payload ----------
$raw = [Console]::In.ReadToEnd()
try {
    $payload = $raw | ConvertFrom-Json -ErrorAction Stop
} catch {
    [Console]::Error.WriteLine("[worktree-hook] FATAL: stdin parse failed: $_")
    exit 2
}

$eventName  = [string]$payload.hook_event_name
$wtName     = [string]$payload.name
$wtPathIn   = [string]$payload.worktree_path

$projectDir = $env:CLAUDE_PROJECT_DIR
if ([string]::IsNullOrWhiteSpace($projectDir)) { $projectDir = (Get-Location).Path }
$projectDir = (Resolve-Path -LiteralPath $projectDir).Path

# ---------- paths ----------
# payload 가 worktree_path 를 줬으면 그걸 신뢰. 아니면 ..\worktrees\<name> 으로 계산.
if (-not [string]::IsNullOrWhiteSpace($wtPathIn)) {
    $worktreePath = $wtPathIn
} else {
    $parentDir    = Split-Path -Parent $projectDir
    $worktreeRoot = Join-Path $parentDir 'worktrees'
    $worktreePath = Join-Path $worktreeRoot $wtName
}
# 절대 경로로 정규화 (없을 수도 있으니 수동)
if (-not [System.IO.Path]::IsPathRooted($worktreePath)) {
    $worktreePath = Join-Path $projectDir $worktreePath
}

$branchName = "worktree-$wtName"

# ---------- logging ----------
$logFile = Join-Path $projectDir '.claude\hooks\worktree.log'
$ts      = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'
function Write-WtLog([string]$msg) {
    try { Add-Content -LiteralPath $logFile -Value "$ts $eventName $msg" } catch {}
}

# ---------- dispatch ----------
try {
    Push-Location -LiteralPath $projectDir

    switch ($eventName) {
        'WorktreeCreate' {
            # 부모 디렉토리 보장
            $wtParent = Split-Path -Parent $worktreePath
            if (-not (Test-Path -LiteralPath $wtParent)) {
                New-Item -ItemType Directory -Path $wtParent -Force | Out-Null
            }

            # git worktree add (이미 있으면 add 실패 → 그대로 후속 단계로)
            if (-not (Test-Path -LiteralPath $worktreePath)) {
                $addOut = & git worktree add -b $branchName -- "$worktreePath" 2>&1
                if ($LASTEXITCODE -ne 0) {
                    Write-WtLog "git-add-failed code=$LASTEXITCODE out=$addOut"
                    [Console]::Error.WriteLine("[worktree-hook] git worktree add failed: $addOut")
                    exit 1
                }
            }

            # env 파일 복사 (있으면)
            $copied = @()
            foreach ($f in @('.env.local', '.env.development.local')) {
                $src = Join-Path $projectDir $f
                if (Test-Path -LiteralPath $src) {
                    Copy-Item -LiteralPath $src -Destination (Join-Path $worktreePath $f) -Force
                    $copied += $f
                }
            }

            # node_modules junction (main repo 의 node_modules 공유 → 즉시, 디스크 0, native-binary 호환)
            $srcNm = Join-Path $projectDir 'node_modules'
            $dstNm = Join-Path $worktreePath 'node_modules'
            $nmStatus = 'skip'
            if (-not (Test-Path -LiteralPath $dstNm)) {
                if (Test-Path -LiteralPath $srcNm) {
                    try {
                        $srcNmAbs = (Resolve-Path -LiteralPath $srcNm).Path
                        New-Item -ItemType Junction -Path $dstNm -Target $srcNmAbs -ErrorAction Stop | Out-Null
                        $nmStatus = 'junction'
                    } catch {
                        $nmStatus = "junction-failed"
                        Write-WtLog "WARN junction failed: $($_.Exception.Message)"
                    }
                } else {
                    $nmStatus = 'no-source'
                }
            }

            # worktree 이름 해시 → 포트 오프셋 (3000~3099, 충돌 회피)
            $hash = 0
            foreach ($ch in $wtName.ToCharArray()) {
                $hash = (($hash * 31) + [int][char]$ch) -band 0x7fffffff
            }
            $port = 3000 + ($hash % 100)

            # 별도 pwsh 창에서 dev 서버 기동.
            # node_modules 가 어쩌다 없으면 (junction 실패 / 소스 미설치) install 부터 자동 실행.
            $devCmd = @"
Set-Location -LiteralPath '$worktreePath'
`$env:PORT = '$port'
`$Host.UI.RawUI.WindowTitle = 'dev: $wtName (port $port)'
if (-not (Test-Path -LiteralPath 'node_modules')) {
    Write-Host '[worktree] node_modules missing, running pnpm install...' -ForegroundColor Yellow
    pnpm install --prefer-offline
}
pnpm dev
"@
            Start-Process pwsh `
                -ArgumentList @('-NoExit', '-NoProfile', '-Command', $devCmd) `
                -WorkingDirectory $worktreePath | Out-Null

            Write-WtLog "OK path=$worktreePath branch=$branchName port=$port env=$($copied -join ',') nm=$nmStatus"

            # stdout: 절대 경로만. Claude Code 가 이걸 새 세션 cwd 로 사용.
            [Console]::Out.Write($worktreePath)
        }

        'WorktreeRemove' {
            $rmOut = & git worktree remove --force -- "$worktreePath" 2>&1
            $rmCode = $LASTEXITCODE
            $brOut = & git branch -D $branchName 2>&1
            $brCode = $LASTEXITCODE
            Write-WtLog "OK path=$worktreePath branch=$branchName rm=$rmCode br=$brCode"
        }

        default {
            Write-WtLog "SKIP unknown-event"
        }
    }
}
catch {
    Write-WtLog "FATAL $($_.Exception.Message)"
    [Console]::Error.WriteLine("[worktree-hook] $($_.Exception.Message)")
    exit 1
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
}
