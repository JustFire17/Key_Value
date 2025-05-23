#!/bin/bash

echo "🧪 Iniciando testes funcionais..."

# Teste 1: Health Check
echo "📋 Teste 1: Health Check"
curl -s http://localhost:80/health
echo -e "\n"

# Teste 2: PUT - Inserir chave-valor
echo "📋 Teste 2: PUT - Inserir chave-valor"
curl -X PUT http://localhost:80/api \
  -H "Content-Type: application/json" \
  -d '{"data": {"key": "test_key", "value": "test_value"}}'
echo -e "\n"

# Aguardar 2 segundos para processamento
sleep 2

# Teste 3: GET - Buscar chave
echo "📋 Teste 3: GET - Buscar chave"
curl -s http://localhost:80/api/test_key
echo -e "\n"

# Teste 4: PUT - Atualizar chave existente
echo "📋 Teste 4: PUT - Atualizar chave existente"
curl -X PUT http://localhost:80/api \
  -H "Content-Type: application/json" \
  -d '{"data": {"key": "test_key", "value": "updated_value"}}'
echo -e "\n"

# Aguardar 2 segundos para processamento
sleep 2

# Teste 5: GET - Verificar valor atualizado
echo "📋 Teste 5: GET - Verificar valor atualizado"
curl -s http://localhost:80/api/test_key
echo -e "\n"

# Teste 6: DELETE - Remover chave
echo "📋 Teste 6: DELETE - Remover chave"
curl -X DELETE http://localhost:80/api/test_key
echo -e "\n"

# Aguardar 2 segundos para processamento
sleep 2

# Teste 7: GET - Verificar se chave foi removida
echo "📋 Teste 7: GET - Verificar se chave foi removida"
curl -s http://localhost:80/api/test_key
echo -e "\n"

echo "✅ Testes concluídos!" 