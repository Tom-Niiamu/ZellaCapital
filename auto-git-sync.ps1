<#
  auto-git-sync.ps1
  ----------------------------------------------------------------------------
  ZellaCapital — automatic GitHub sync.
  Watches the repository folder (recursively) for any file change, waits a
  short debounce window, then stages + commits + pushes to origin/main.

  Run it:
    powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File ".\auto-git-sync.ps1"
  Or just double-click it. It keeps running until you close its window /
  stop the process. All activity is logged to auto-git-sync.log next to it.

  NOTE: PowerShell FileSystemWatcher event actions run in a SEPARATE runspace,
  so they cannot see the script's normal variables. We share state through a
  thread-safe (Synchronized) hashtable that both the events and the main loop
  reference.
#>

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$logFile  = Join-Path $repoRoot 'auto-git-sync.log'

function Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    try { Add-Content -Path $logFile -Value $line } catch { }
    Write-Host $line
}

Log "Watcher started. Monitoring: $repoRoot"

# Shared state across runspaces (thread-safe hashtable).
$sync = [System.Collections.Hashtable]::Synchronized(@{
    Pending    = $false
    LastChange = [DateTime]::MinValue
})

# ---- FileSystemWatcher ----
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path                  = $repoRoot
$watcher.IncludeSubdirectories = $true
$watcher.NotifyFilter          = [System.IO.NotifyFilters]::FileName -bor
                                 [System.IO.NotifyFilters]::DirectoryName -bor
                                 [System.IO.NotifyFilters]::LastWrite -bor
                                 [System.IO.NotifyFilters]::CreationTime
$watcher.Filter                = '*'
$watcher.EnableRaisingEvents   = $true

$touched = {
    param($path)
    # Ignore anything inside .git so commits/checkouts don't re-trigger a loop.
    if ($path -match '[\\/]\.git([\\/]|$)') { return }
    # Ignore this watcher's own artifacts (its log + the script itself) so writing
    # the log does not start an infinite commit loop.
    $name = Split-Path -Leaf $path
    if ($name -eq 'auto-git-sync.log' -or $name -eq 'auto-git-sync.ps1') { return }
    $sync.Pending    = $true
    $sync.LastChange = [DateTime]::Now
}

Register-ObjectEvent -InputObject $watcher -EventName Changed -Action { & $touched $Event.SourceEventArgs.FullPath } | Out-Null
Register-ObjectEvent -InputObject $watcher -EventName Created -Action { & $touched $Event.SourceEventArgs.FullPath } | Out-Null
Register-ObjectEvent -InputObject $watcher -EventName Deleted -Action { & $touched $Event.SourceEventArgs.FullPath } | Out-Null
Register-ObjectEvent -InputObject $watcher -EventName Renamed -Action { & $touched $Event.SourceEventArgs.FullPath } | Out-Null

Log "Events registered. Waiting for changes..."

# ---- Main loop ----
try {
    $debounceMs = 3000
    while ($true) {
        Start-Sleep -Milliseconds 500

        $doSync = $false
        if ($sync.Pending -and (([DateTime]::Now - $sync.LastChange).TotalMilliseconds -ge $debounceMs)) {
            $doSync = $true
        }
        if (-not $doSync) { continue }

        # Reset the flag BEFORE doing work so new edits during sync are caught.
        $sync.Pending = $false

        try {
            Push-Location $repoRoot
            $status = (git status --porcelain)
            if (-not $status) { continue }

            $stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
            git add -A
            git commit -m "auto-sync: update $stamp" 2>&1 | ForEach-Object { Log $_ }
            git push origin main 2>&1 | ForEach-Object { Log $_ }
            Log "Synced to GitHub (origin/main)."
        } catch {
            Log "ERROR: $_"
        } finally {
            Pop-Location
        }
    }
} finally {
    $watcher.Dispose()
    Log "Watcher stopped."
}
