$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 8766
$Prefix = "http://localhost:$Port/"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($Prefix)

try {
  $listener.Start()
} catch {
  Write-Host "Impossible de demarrer le serveur local. Essaie d'ouvrir PowerShell en administrateur."
  Write-Host $_.Exception.Message
  exit 1
}

Write-Host "MJSL webapp lancee sur ${Prefix}site/index.html"
Write-Host "Ferme cette fenetre pour arreter le serveur."
Start-Process "${Prefix}site/index.html"

function Decode-Url {
  param([string]$encoded)
  # Simple percent-decoding without System.Web dependency
  $result = $encoded.Replace("+", " ")
  [regex]::Replace($result, "%([0-9A-Fa-f]{2})", {
    param($match)
    [char][convert]::ToByte($match.Groups[1].Value, 16)
  })
}

function Resolve-SafePath {
  param([string]$requested, [string]$rootPath)
  $segments = $requested -split "[/\\]" | Where-Object { $_ -ne "" -and $_ -ne "." }
  $safe = [System.Collections.Generic.List[string]]::new()
  foreach ($segment in $segments) {
    if ($segment -eq "..") {
      if ($safe.Count -gt 0) { $safe.RemoveAt($safe.Count - 1) }
    } else {
      $safe.Add($segment)
    }
  }
  $resolved = [string]::Join([System.IO.Path]::DirectorySeparatorChar, $safe)
  $fullFile = [System.IO.Path]::GetFullPath((Join-Path $rootPath $resolved))
  $fullRoot = [System.IO.Path]::GetFullPath($rootPath)
  if (-not $fullFile.StartsWith($fullRoot + [System.IO.Path]::DirectorySeparatorChar) -and $fullFile -ne $fullRoot) {
    return $null
  }
  return $fullFile
}

$mimeTypes = @{
  ".html"    = "text/html; charset=utf-8"
  ".css"     = "text/css; charset=utf-8"
  ".js"      = "application/javascript; charset=utf-8"
  ".json"    = "application/json; charset=utf-8"
  ".geojson" = "application/geo+json; charset=utf-8"
  ".csv"     = "text/csv; charset=utf-8"
  ".png"     = "image/png"
  ".jpg"     = "image/jpeg"
  ".svg"     = "image/svg+xml"
}

while ($listener.IsListening) {
  $context = $null
  try {
    $context = $listener.GetContext()
    $localPath = $context.Request.Url.LocalPath.TrimStart("/")
    $requestPath = Decode-Url $localPath

    if ([string]::IsNullOrWhiteSpace($requestPath)) {
      $requestPath = "site/index.html"
    }

    $fullFile = Resolve-SafePath $requestPath $Root

    if ($null -eq $fullFile) {
      $context.Response.StatusCode = 403
      $context.Response.Close()
      continue
    }

    if (-not (Test-Path $fullFile -PathType Leaf)) {
      $context.Response.StatusCode = 404
      $context.Response.Close()
      continue
    }

    $extension = [System.IO.Path]::GetExtension($fullFile).ToLowerInvariant()
    $mime = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { "application/octet-stream" }

    $bytes = [System.IO.File]::ReadAllBytes($fullFile)
    $context.Response.ContentType = $mime
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.Headers.Add("Access-Control-Allow-Origin", "*")
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.Close()
  } catch {
    try {
      if ($context -and $context.Response) {
        $context.Response.StatusCode = 500
        $context.Response.Close()
      }
    } catch {}
  }
}
