Get-ChildItem input/* -File | ForEach-Object {
    $file = $_.FullName
    $basename = $_.Name
    Write-Host "Processing $basename"
    $output = & py run.py $file --no-show 2>&1
    if ($output -match "Khong detect duoc bien so nao\.") {
        Copy-Item $file input-not-detect/
        Write-Host "Copied $basename to input-not-detect"
    }
}