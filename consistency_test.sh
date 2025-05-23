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

# Função para inserir um valor
insert_value() {
    local key=$1
    local value=$2
    echo "Inserindo $key=$value..."
    curl -s -X PUT http://localhost:3003/api/ \
        -H "Content-Type: application/json" \
        -d "{\"key\":\"$key\",\"value\":\"$value\"}"
    echo
    sleep 5  # Aumentado tempo de espera para sincronização
}

# Função para buscar um valor
get_value() {
    local key=$1
    echo "Buscando $key..."
    curl -s http://localhost:3003/api/$key
    echo
}

# Função para remover um valor
delete_value() {
    local key=$1
    echo "Removendo $key..."
    curl -s -X DELETE "http://localhost:3003/api/$key" \
        -H "Content-Type: application/json"
    echo
    sleep 5  # Aumentado tempo de espera para sincronização
}

# Função para verificar valor no Redis
check_redis() {
    local key=$1
    echo "Verificando $key no Redis..."
    docker exec key_value-redis1-1 redis-cli GET "$key"
    echo
}

# Função para verificar valor no CockroachDB
check_cockroachdb() {
    local key=$1
    echo "Verificando $key no CockroachDB..."
    docker exec crdb1 cockroach sql --insecure -e "SELECT value FROM key_value WHERE key = '$key';"
    echo
}

# Função para verificar consistência
check_consistency() {
    local key=$1
    local expected_value=$2
    local redis_value=$(docker exec key_value-redis1-1 redis-cli GET "$key")
    local crdb_output=$(docker exec crdb1 cockroach sql --insecure -e "SELECT value FROM key_value WHERE key = '$key';")
    local crdb_value=$(echo "$crdb_output" | tail -n 1 | tr -d ' ')
    
    if [ "$redis_value" = "$expected_value" ] && [ "$crdb_value" = "$expected_value" ]; then
        echo "✅ Consistência verificada para $key"
    else
        echo "❌ Inconsistência detectada para $key"
        echo "Redis: $redis_value"
        echo "CockroachDB: $crdb_value"
        echo "Esperado: $expected_value"
    fi
}

# Limpar dados existentes
echo "Limpando dados existentes..."
for i in {1..5}; do
    delete_value "key$i"
done
delete_value "test_key"
sleep 5

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

# Teste 3: Remoção e verificação
echo -e "\n📝 Teste 3: Remoção e verificação"
delete_value "test_key"
echo "Verificando consistência após remoção..."
check_consistency "test_key" ""

# Teste 4: Múltiplas operações
echo -e "\n📝 Teste 4: Múltiplas operações"
for i in {1..5}; do
    insert_value "key$i" "value$i"
done
echo "Verificando consistência após múltiplas inserções..."
for i in {1..5}; do
    check_consistency "key$i" "value$i"
done

# Teste 5: Remoção em massa
echo -e "\n📝 Teste 5: Remoção em massa"
for i in {1..5}; do
    delete_value "key$i"
done
echo "Verificando consistência após múltiplas remoções..."
for i in {1..5}; do
    check_consistency "key$i" ""
done

echo -e "\n✅ Testes de consistência concluídos!" 