param(
  [Parameter(Mandatory=$true)]
  [string]$Origem,

  [Parameter(Mandatory=$true)]
  [ValidateRange(1,8)]
  [int]$Quadra
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$quadraNome = 'quadra-{0:D2}' -f $Quadra
$destino = Join-Path $repoRoot "imagens\$quadraNome"
$manifestPath = Join-Path $repoRoot 'data\imoveis-importados.js'

if (-not (Test-Path $Origem)) {
  throw "Pasta de origem não encontrada: $Origem"
}

New-Item -ItemType Directory -Force -Path $destino | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $manifestPath -Parent) | Out-Null

$extensoes = @('.jpg', '.jpeg', '.png', '.webp')
$fotos = Get-ChildItem -Path $Origem -File | Where-Object { $extensoes -contains $_.Extension.ToLower() } | Sort-Object Name
$heic = Get-ChildItem -Path $Origem -File | Where-Object { $_.Extension.ToLower() -eq '.heic' }

if ($heic.Count -gt 0) {
  Write-Warning "$($heic.Count) arquivo(s) HEIC ignorado(s). Converta para JPG/WEBP antes de importar para garantir exibição no navegador."
}

if ($fotos.Count -eq 0) {
  throw 'Nenhuma imagem JPG, JPEG, PNG ou WEBP encontrada na pasta informada.'
}

$existentes = Get-ChildItem -Path $destino -File -ErrorAction SilentlyContinue
$contador = $existentes.Count + 1
$novos = @()

foreach ($foto in $fotos) {
  $ext = $foto.Extension.ToLower()
  $novoNome = 'imovel-{0:D4}{1}' -f $contador, $ext
  $destinoArquivo = Join-Path $destino $novoNome
  Copy-Item $foto.FullName $destinoArquivo

  $novos += [PSCustomObject]@{
    id = "$quadraNome-$('{0:D4}' -f $contador)"
    quadra = $Quadra
    foto = "imagens/$quadraNome/$novoNome"
    endereco = "Imóvel $contador — preencher endereço"
    situacao = 'Fechada'
    telefone = ''
  }
  $contador++
}

$dadosExistentes = @()
if (Test-Path $manifestPath) {
  $texto = Get-Content $manifestPath -Raw
  $json = $texto -replace '^window\.IMOVEIS_IMPORTADOS\s*=\s*', '' -replace ';\s*$', ''
  if ($json.Trim()) { $dadosExistentes = @($json | ConvertFrom-Json) }
}

$todos = @($dadosExistentes) + @($novos)
$jsonFinal = $todos | ConvertTo-Json -Depth 5
"window.IMOVEIS_IMPORTADOS = $jsonFinal;" | Set-Content -Path $manifestPath -Encoding UTF8

Write-Host ""
Write-Host "Importação concluída: $($novos.Count) fotos adicionadas à $quadraNome."
Write-Host "Fotos: $destino"
Write-Host "Manifesto: $manifestPath"
Write-Host ""
Write-Host 'Próximo passo: revise os arquivos e execute git add ., git commit e git push.'
