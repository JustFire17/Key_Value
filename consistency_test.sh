#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting consistency tests..."

# Verificar se os containers estão rodando
echo "Checking container status..."
if ! docker ps | grep -q "crdb1"; then
    echo "CockroachDB container is not running!"
    exit 1
fi

if ! docker ps | grep -q "key_value-redis1-1"; then
    echo "Redis container is not running!"
    exit 1
fi

# Função para verificar se uma operação foi bem sucedida
check_operation() {
    local response=$1
    if [[ $response == *"sucesso"* ]]; then
        return 0
    elif [[ $response == *"Chave não encontrada"* ]]; then
        echo "Info: key does not exist"
        return 0
    else
        echo "Operation failed: $response"
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
        echo "Inserting $key=$value... (Attempt $((retry_count + 1)))"
        response=$(curl -s -X PUT http://localhost:3003/api/ \
            -H "Content-Type: application/json" \
            -d "{\"key\":\"$key\",\"value\":\"$value\"}")
        
        if check_operation "$response"; then
            echo "Insert succeeded"
            sleep 2
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        sleep 2
    done
    
    echo "Insert failed after $max_retries attempts"
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
            echo "Consistency verified for $key"
            return 0
        fi
        
        echo "Inconsistency detected for $key (Attempt $((retry_count + 1)))"
        echo "Expected: $expected_value"
        
        retry_count=$((retry_count + 1))
        if [ $retry_count -lt $max_retries ]; then
            echo "Waiting for synchronization..."
            sleep 5
        fi
    done
    
    return 1
}

# Teste 1: Inserção e verificação
echo -e "\nTest 1: Insert and verify"
insert_value "test_key" "test_value"
echo "Checking consistency after insert..."
check_consistency "test_key" "test_value"

# Test 2: Update and verify
echo -e "\nTest 2: Update and verify"
insert_value "test_key" "new_value"
echo "Checking consistency after update..."
check_consistency "test_key" "new_value"

# Test 3: Multiple operations
echo -e "\nTest 3: Multiple operations"
for i in {1..5}; do
    insert_value "key$i" "value$i"
done
echo "Checking consistency after multiple inserts..."
for i in {1..5}; do
    check_consistency "key$i" "value$i"
done

echo -e "\nConsistency tests completed"