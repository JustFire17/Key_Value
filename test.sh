#!/bin/bash

echo "🧪 Iniciando testes da API Key-Value Store"

# Função para verificar resposta
check_response() {
    local response=$1
    if [[ $response == *"error"* ]]; then
        echo -e "\e[31mErro: $response\e[0m"
        return 1
    else
        echo -e "\e[32mSucesso: $response\e[0m"
        return 0
    fi
}

# Teste 1: Health Check
echo "📋 Teste 1: Health Check"
curl -s http://localhost/health
echo -e "\n"

# Teste 2: PUT - Inserir chave-valor
echo "📋 Teste 2: PUT - Inserir chave-valor"
curl -X PUT -H "Content-Type: application/json" -d '{"key":"teste","value":"valor_teste"}' http://localhost/
echo -e "\n"

# Teste 3: GET - Buscar chave inserida
echo "📋 Teste 3: GET - Buscar chave inserida"
curl -s http://localhost/teste
echo -e "\n"

# Teste 4: DELETE - Remover chave
echo "📋 Teste 4: DELETE - Remover chave"
curl -X DELETE http://localhost/teste
echo -e "\n"

# Teste 5: GET - Verificar se chave foi removida
echo "📋 Teste 5: GET - Verificar se chave foi removida"
curl -s http://localhost/teste
echo -e "\n"

echo "✅ Testes concluídos!" 