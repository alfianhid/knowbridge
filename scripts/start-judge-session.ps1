# Operator-only: run from the repository root. Never enable PowerShell transcription for this session.
$ErrorActionPreference = 'Stop'
$projectId = 'project-abfa2050-4777-4f90-bf0'
$signerAccount = "gcp-sa@$projectId.iam.gserviceaccount.com"
$keyName = 'projects/208529907910/locations/global/keys/21f0fe91-0d21-4cc0-ac63-cfafaecf8192'
$repoRoot = Split-Path -Parent $PSScriptRoot
$signerFile = Join-Path $repoRoot ".data/judge-signer-$([guid]::NewGuid().ToString('N')).json"
$createdKey = $false
try {
    $apiKey = gcloud.cmd services api-keys get-key-string $keyName --project=$projectId --format='value(keyString)'
    if ($LASTEXITCODE -ne 0 -or -not $apiKey) { throw 'Firebase API key lookup failed.' }
    $env:KNOWBRIDGE_FIREBASE_API_KEY = $apiKey.Trim()
    New-Item -ItemType Directory -Path (Split-Path -Parent $signerFile) -Force | Out-Null
    # This CLI has no key-expiry flag. Cleanup below deletes the temporary key immediately after use.
    gcloud.cmd iam service-accounts keys create $signerFile --iam-account=$signerAccount --project=$projectId --key-file-type=json --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Temporary signer creation failed.' }
    $createdKey = $true
    $env:KNOWBRIDGE_TOKEN_SIGNER_FILE = $signerFile
    node (Join-Path $PSScriptRoot 'prepare-judge-access.cjs') --clipboard
    if ($LASTEXITCODE -ne 0) { throw 'Judge access preparation failed. See safe diagnostic above.' }
} finally {
    Remove-Item Env:KNOWBRIDGE_FIREBASE_API_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:KNOWBRIDGE_TOKEN_SIGNER_FILE -ErrorAction SilentlyContinue
    $apiKey = $null
    if ($createdKey) {
        $keyId = (Get-Content -LiteralPath $signerFile -Raw | ConvertFrom-Json).private_key_id
        gcloud.cmd iam service-accounts keys delete $keyId --iam-account=$signerAccount --project=$projectId --quiet
        if ($LASTEXITCODE -eq 0) {
            Remove-Item -LiteralPath $signerFile -Force
            Write-Output 'Temporary cloud signer key and local copy deleted.'
        } else {
            throw "Temporary signer cleanup failed. Delete the cloud key and local file: $signerFile"
        }
    }
}
