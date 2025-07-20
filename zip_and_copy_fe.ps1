# Set the output zip file and target directory
$zipPath = "$PWD\fe.zip"
$targetDir = "c:\Users\TalTe\Downloads\"

# List of files/folders to include
$itemsToZip = @(
    ".\public",
    ".\src",
    ".\index.html",
    ".\package.json",
    ".\tailwind.config.js",
    ".\vite.config.js"
)

# Create the zip
if (Test-Path $zipPath) { Remove-Item $zipPath }
Compress-Archive -Path $itemsToZip -DestinationPath $zipPath

# Copy it to target directory
Copy-Item -Path $zipPath -Destination $targetDir -Force

Write-Host "✅ Successfully copied to $targetDir"
