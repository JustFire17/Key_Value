#!/bin/bash

echo -e "\e[32mIniciando testes funcionais...\e[0m"

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
echo -e "\n\e[33mTeste 1: Health Check\e[0m"
response=$(curl -s http://localhost:80/health)
check_response "$response"

# Teste 2: PUT - Inserir chave-valor
echo -e "\n\e[33mTeste 2: PUT - Inserir chave-valor\e[0m"
response=$(curl -s -X PUT http://localhost:80/api \
  -H "Content-Type: application/json" \
  -d '{"key":"test_key","value":"test_value"}')
check_response "$response"

# Aguardar 2 segundos para processamento
sleep 2

# Teste 3: GET - Buscar chave
echo -e "\n\e[33mTeste 3: GET - Buscar chave\e[0m"
response=$(curl -s http://localhost:80/api/test_key)
check_response "$response"

# Teste 4: PUT - Atualizar chave existente
echo -e "\n\e[33mTeste 4: PUT - Atualizar chave existente\e[0m"
response=$(curl -s -X PUT http://localhost:80/api \
  -H "Content-Type: application/json" \
  -d '{"key":"test_key","value":"updated_value"}')
check_response "$response"

# Aguardar 2 segundos para processamento
sleep 2

# Teste 5: GET - Verificar valor atualizado
echo -e "\n\e[33mTeste 5: GET - Verificar valor atualizado\e[0m"
response=$(curl -s http://localhost:80/api/test_key)
check_response "$response"

# Teste 6: DELETE - Remover chave
echo -e "\n\e[33mTeste 6: DELETE - Remover chave\e[0m"
response=$(curl -s -X DELETE http://localhost:80/api/test_key)
check_response "$response"

# Aguardar 2 segundos para processamento
sleep 2

# Teste 7: GET - Verificar se chave foi removida
echo -e "\n\e[33mTeste 7: GET - Verificar se chave foi removida\e[0m"
response=$(curl -s http://localhost:80/api/test_key)
if [[ $response == *"error"* ]]; then
    echo -e "\e[32mChave não encontrada (esperado)\e[0m"
else
    echo -e "\e[31mErro: Chave ainda existe\e[0m"
fi

echo -e "\n\e[32mTestes concluídos!\e[0m" 