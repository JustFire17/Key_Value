Write-Host "Iniciando testes de carga..." -ForegroundColor Green

# Configurações do teste
$numRequests = 100  # Número total de requisições
$concurrentRequests = 10  # Número de requisições simultâneas
$baseUrl = "http://localhost:80/api"

# Função para gerar uma chave aleatória
function Get-RandomKey {
    return "key_" + (Get-Random -Minimum 1000 -Maximum 9999)
}

# Função para executar uma requisição PUT
function Test-PutRequest {
    param($key, $value)
    $body = @{
        key = $key
        value = $value
    } | ConvertTo-Json
    
    $startTime = Get-Date
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl" -Method Put -Body $body -ContentType "application/json"
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds
        return @{
            Success = $true
            Duration = $duration
        }
    }
    catch {
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds
        return @{
            Success = $false
            Duration = $duration
        }
    }
}

# Função para executar uma requisição GET
function Test-GetRequest {
    param($key)
    $startTime = Get-Date
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/$key" -Method Get
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds
        return @{
            Success = $true
            Duration = $duration
        }
    }
    catch {
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds
        return @{
            Success = $false
            Duration = $duration
        }
    }
}

# Lista para armazenar resultados
$results = @()
$successCount = 0
$totalDuration = 0

Write-Host "`nExecutando $numRequests requisições ($concurrentRequests simultâneas)..." -ForegroundColor Yellow

# Executar requisições em lotes
for ($i = 0; $i -lt $numRequests; $i += $concurrentRequests) {
    $batchSize = [Math]::Min($concurrentRequests, $numRequests - $i)
    $jobs = @()
    
    # Criar jobs para requisições PUT
    for ($j = 0; $j -lt $batchSize; $j++) {
        $key = Get-RandomKey
        $value = "value_$((Get-Random -Minimum 1000 -Maximum 9999))"
        $jobs += Start-Job -ScriptBlock {
            param($url, $k, $v)
            $body = @{
                key = $k
                value = $v
            } | ConvertTo-Json
            $startTime = Get-Date
            try {
                $response = Invoke-RestMethod -Uri "$url" -Method Put -Body $body -ContentType "application/json"
                $endTime = Get-Date
                $duration = ($endTime - $startTime).TotalMilliseconds
                return @{
                    Success = $true
                    Duration = $duration
                }
            }
            catch {
                $endTime = Get-Date
                $duration = ($endTime - $startTime).TotalMilliseconds
                return @{
                    Success = $false
                    Duration = $duration
                }
            }
        } -ArgumentList $baseUrl, $key, $value
    }
    
    # Aguardar conclusão dos jobs
    $batchResults = $jobs | Wait-Job | Receive-Job
    $jobs | Remove-Job
    
    # Processar resultados
    foreach ($result in $batchResults) {
        if ($result.Success) {
            $successCount++
            $totalDuration += $result.Duration
        }
    }
    
    # Aguardar um pouco entre os lotes para não sobrecarregar o sistema
    Start-Sleep -Milliseconds 100
}

# Calcular estatísticas
$successRate = ($successCount / $numRequests) * 100
$avgDuration = if ($totalDuration -gt 0) { $totalDuration / $successCount } else { 0 }

# Exibir resultados
Write-Host "`nResultados dos testes de carga:" -ForegroundColor Green
Write-Host "Total de requisições: $numRequests"
Write-Host "Requisições simultâneas: $concurrentRequests"
Write-Host "Taxa de sucesso: $successRate%"
Write-Host "Duração média: $avgDuration ms"

Write-Host "`nTestes de carga concluídos!" -ForegroundColor Green 