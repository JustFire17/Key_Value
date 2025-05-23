#!/bin/bash

echo "🔍 Iniciando testes de consistência..."

# Função para inserir um valor
insert_value() {
    local key=$1
    local value=$2
    echo "Inserindo $key=$value..."
    curl -s -X PUT http://localhost/ \
        -H "Content-Type: application/json" \
        -d "{\"key\":\"$key\",\"value\":\"$value\"}"
    echo
}

# Função para buscar um valor
get_value() {
    local key=$1
    echo "Buscando $key..."
    curl -s http://localhost/$key
    echo
}

# Função para remover um valor
delete_value() {
    local key=$1
    echo "Removendo $key..."
    curl -s -X DELETE http://localhost/$key
    echo
}

# Função para verificar valor no Redis
check_redis() {
    local key=$1
    echo "Verificando $key no Redis..."
    docker exec key_value-redis1-1 redis-cli GET $key
    echo
}

# Função para verificar valor no CockroachDB
check_cockroachdb() {
    local key=$1
    echo "Verificando $key no CockroachDB..."
    docker exec key_value-crdb1-1 cockroach sql --insecure -e "SELECT value FROM key_value WHERE key = '$key';"
    echo
}

# Teste 1: Inserção e verificação
echo -e "\n📝 Teste 1: Inserção e verificação"
insert_value "test_key" "test_value"
sleep 2
echo "Verificando consistência após inserção..."
check_redis "test_key"
check_cockroachdb "test_key"

# Teste 2: Atualização e verificação
echo -e "\n📝 Teste 2: Atualização e verificação"
insert_value "test_key" "new_value"
sleep 2
echo "Verificando consistência após atualização..."
check_redis "test_key"
check_cockroachdb "test_key"

# Teste 3: Remoção e verificação
echo -e "\n📝 Teste 3: Remoção e verificação"
delete_value "test_key"
sleep 2
echo "Verificando consistência após remoção..."
check_redis "test_key"
check_cockroachdb "test_key"

# Teste 4: Múltiplas operações
echo -e "\n📝 Teste 4: Múltiplas operações"
for i in {1..5}; do
    insert_value "key$i" "value$i"
done
sleep 2
echo "Verificando consistência após múltiplas inserções..."
for i in {1..5}; do
    echo "Verificando key$i..."
    check_redis "key$i"
    check_cockroachdb "key$i"
done

# Teste 5: Remoção em massa
echo -e "\n📝 Teste 5: Remoção em massa"
for i in {1..5}; do
    delete_value "key$i"
done
sleep 2
echo "Verificando consistência após múltiplas remoções..."
for i in {1..5}; do
    echo "Verificando key$i..."
    check_redis "key$i"
    check_cockroachdb "key$i"
done

echo -e "\n✅ Testes de consistência concluídos!" 