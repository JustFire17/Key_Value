Write-Host "Iniciando testes funcionais..." -ForegroundColor Green

# Teste 1: Health Check
Write-Host "`nTeste 1: Health Check" -ForegroundColor Yellow
Invoke-RestMethod -Uri "http://localhost:80/health" -Method Get

# Teste 2: PUT - Inserir chave-valor
Write-Host "`nTeste 2: PUT - Inserir chave-valor" -ForegroundColor Yellow
$body = @{
    key = "test_key"
    value = "test_value"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:80/api" -Method Put -Body $body -ContentType "application/json"

# Aguardar 2 segundos para processamento
Start-Sleep -Seconds 2

# Teste 3: GET - Buscar chave
Write-Host "`nTeste 3: GET - Buscar chave" -ForegroundColor Yellow
Invoke-RestMethod -Uri "http://localhost:80/api/test_key" -Method Get

# Teste 4: PUT - Atualizar chave existente
Write-Host "`nTeste 4: PUT - Atualizar chave existente" -ForegroundColor Yellow
$body = @{
    key = "test_key"
    value = "updated_value"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:80/api" -Method Put -Body $body -ContentType "application/json"

# Aguardar 2 segundos para processamento
Start-Sleep -Seconds 2

# Teste 5: GET - Verificar valor atualizado
Write-Host "`nTeste 5: GET - Verificar valor atualizado" -ForegroundColor Yellow
Invoke-RestMethod -Uri "http://localhost:80/api/test_key" -Method Get

# Teste 6: DELETE - Remover chave
Write-Host "`nTeste 6: DELETE - Remover chave" -ForegroundColor Yellow
Invoke-RestMethod -Uri "http://localhost:80/api/test_key" -Method Delete

# Aguardar 2 segundos para processamento
Start-Sleep -Seconds 2

# Teste 7: GET - Verificar se chave foi removida
Write-Host "`nTeste 7: GET - Verificar se chave foi removida" -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "http://localhost:80/api/test_key" -Method Get
} catch {
    Write-Host "Chave nao encontrada (esperado)" -ForegroundColor Green
}

Write-Host "`nTestes concluidos!" -ForegroundColor Green 