$ErrorActionPreference = "Stop"
$root = $PSScriptRoot.TrimEnd("\")
$portableNode = Get-ChildItem -Path (Join-Path $root ".workpath-runtime") -Filter "node.exe" -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Directory.Name -like "node-v24*-win-x64" } |
    Select-Object -First 1

if ($portableNode) {
    Push-Location $root
    try {
        Write-Host "Using WorkPath's included Node.js runtime. Nothing needs to be installed."
        & $portableNode.FullName "$root\run-workpath.mjs"
        exit $LASTEXITCODE
    }
    catch {
        Write-Host "Could not start WorkPath: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
    finally { Pop-Location }
}

$wslPath = [regex]::Match($root, '^\\\\wsl(?:\.localhost|\$)\\(?<distro>[^\\]+)(?<path>\\.*)$', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

if ($wslPath.Success) {
    $distro = $wslPath.Groups["distro"].Value
    $linuxPath = $wslPath.Groups["path"].Value.Replace("\", "/")
    Write-Host "WorkPath is stored in WSL. Starting it with $distro..."
    & wsl.exe -d $distro --cd $linuxPath bash -lic './run-workpath.sh'
    exit $LASTEXITCODE
}

Push-Location $root
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js is required. Install Node.js, then run this file again."
    }
    & node "$root\run-workpath.mjs"
    exit $LASTEXITCODE
}
catch {
    Write-Host "Could not start WorkPath: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}
