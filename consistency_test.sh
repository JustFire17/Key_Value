#!/bin/bash

echo "🔍 Iniciando testes de consistência..."

# Verificar se os containers estão rodando
echo "Verificando status dos containers..."
if ! docker ps | grep -q "crdb1"; then
    echo "❌ Container CockroachDB não está rodando!"
    exit 1
fi

if ! docker ps | grep -q "key_value-redis1-1"; then
    echo "❌ Container Redis não está rodando!"
    exit 1
fi

# Função para verificar se uma operação foi bem sucedida
check_operation() {
    local response=$1
    if [[ $response == *"sucesso"* ]]; then
        return 0
    elif [[ $response == *"Chave não encontrada"* ]]; then
        echo "ℹ️ Chave não existe"
        return 0
    else
        echo "❌ Operação falhou: $response"
        return 1
    fi
}

# Função para verificar se uma chave existe
check_key_exists() {
    local key=$1
    local response=$(curl -s http://localhost:3003/api/$key)
    if [[ $response == *"error"* ]]; then
        return 1
    else
        return 0
    fi
}

# Função para inserir um valor com retry
insert_value() {
    local key=$1
    local value=$2
    local max_retries=3
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        echo "Inserindo $key=$value... (Tentativa $((retry_count + 1)))"
        response=$(curl -s -X PUT http://localhost:3003/api/ \
            -H "Content-Type: application/json" \
            -d "{\"key\":\"$key\",\"value\":\"$value\"}")
        
        if check_operation "$response"; then
            echo "✅ Inserção bem sucedida"
            sleep 8  # Aumentado tempo de espera para sincronização
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        sleep 2
    done
    
    echo "❌ Falha na inserção após $max_retries tentativas"
    return 1
}

# Função para verificar consistência com retry
check_consistency() {
    local key=$1
    local expected_value=$2
    local max_retries=3
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        local redis_value=$(docker exec key_value-redis1-1 redis-cli GET "$key")
        local crdb_output=$(docker exec crdb1 cockroach sql --insecure -e "SELECT value FROM key_value WHERE key = '$key';")
        local crdb_value=$(echo "$crdb_output" | tail -n 1 | tr -d ' ')
        
        echo "Redis[$key]: $redis_value"
        echo "CockroachDB[$key]: $crdb_value"
        
        if [ "$redis_value" = "$expected_value" ] && [ "$crdb_value" = "$expected_value" ]; then
            echo "✅ Consistência verificada para $key"
            return 0
        fi
        
        echo "❌ Inconsistência detectada para $key (Tentativa $((retry_count + 1)))"
        echo "Esperado: $expected_value"
        
        retry_count=$((retry_count + 1))
        if [ $retry_count -lt $max_retries ]; then
            echo "Aguardando sincronização..."
            sleep 5
        fi
    done
    
    return 1
}

# Teste 1: Inserção e verificação
echo -e "\n📝 Teste 1: Inserção e verificação"
insert_value "test_key" "test_value"
echo "Verificando consistência após inserção..."
check_consistency "test_key" "test_value"

# Teste 2: Atualização e verificação
echo -e "\n📝 Teste 2: Atualização e verificação"
insert_value "test_key" "new_value"
echo "Verificando consistência após atualização..."
check_consistency "test_key" "new_value"

# Teste 3: Múltiplas operações
echo -e "\n📝 Teste 3: Múltiplas operações"
for i in {1..5}; do
    insert_value "key$i" "value$i"
done
echo "Verificando consistência após múltiplas inserções..."
for i in {1..5}; do
    check_consistency "key$i" "value$i"
done

echo -e "\n✅ Testes de consistência concluídos!" 