Write-Host "🧪 Iniciando testes funcionais..." -ForegroundColor Green

# Teste 1: Health Check
Write-Host "`n📋 Teste 1: Health Check" -ForegroundColor Yellow
Invoke-RestMethod -Uri "http://localhost:80/health" -Method Get

# Teste 2: PUT - Inserir chave-valor
Write-Host "`n📋 Teste 2: PUT - Inserir chave-valor" -ForegroundColor Yellow
$body = @{
    data = @{
        key = "test_key"
        value = "test_value"
    }
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:80/api" -Method Put -Body $body -ContentType "application/json"

# Aguardar 2 segundos para processamento
Start-Sleep -Seconds 2

# Teste 3: GET - Buscar chave
Write-Host "`n📋 Teste 3: GET - Buscar chave" -ForegroundColor Yellow
Invoke-RestMethod -Uri "http://localhost:80/api/test_key" -Method Get

# Teste 4: PUT - Atualizar chave existente
Write-Host "`n📋 Teste 4: PUT - Atualizar chave existente" -ForegroundColor Yellow
$body = @{
    data = @{
        key = "test_key"
        value = "updated_value"
    }
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:80/api" -Method Put -Body $body -ContentType "application/json"

# Aguardar 2 segundos para processamento
Start-Sleep -Seconds 2

# Teste 5: GET - Verificar valor atualizado
Write-Host "`n📋 Teste 5: GET - Verificar valor atualizado" -ForegroundColor Yellow
Invoke-RestMethod -Uri "http://localhost:80/api/test_key" -Method Get

# Teste 6: DELETE - Remover chave
Write-Host "`n📋 Teste 6: DELETE - Remover chave" -ForegroundColor Yellow
Invoke-RestMethod -Uri "http://localhost:80/api/test_key" -Method Delete

# Aguardar 2 segundos para processamento
Start-Sleep -Seconds 2

# Teste 7: GET - Verificar se chave foi removida
Write-Host "`n📋 Teste 7: GET - Verificar se chave foi removida" -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "http://localhost:80/api/test_key" -Method Get
} catch {
    Write-Host "Chave não encontrada (esperado)" -ForegroundColor Green
}

Write-Host "`n✅ Testes concluídos!" -ForegroundColor Green 