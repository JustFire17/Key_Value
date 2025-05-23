#!/bin/bash

echo "🧪 Iniciando testes de failover..."

# Função para testar a API
test_api() {
    echo "Testando API..."
    curl -s http://localhost/health
    echo
}

# Função para testar RabbitMQ
test_rabbitmq() {
    echo "Testando RabbitMQ..."
    curl -s -u admin:admin http://localhost:15673/api/overview
    echo
}

# Função para testar Redis
test_redis() {
    echo "Testando Redis..."
    curl -s http://localhost:8403/stats
    echo
}

# Função para testar CockroachDB
test_cockroachdb() {
    echo "Testando CockroachDB..."
    curl -s http://localhost:8081/health
    echo
}

# Teste inicial
echo "📊 Estado inicial do sistema:"
test_api
test_rabbitmq
test_redis
test_cockroachdb

# Teste de failover da API
echo -e "\n🔄 Testando failover da API..."
docker stop key_value-api1-1
echo "API1 parada. Verificando se API2 assume..."
sleep 5
test_api
docker start key_value-api1-1
echo "API1 reiniciada. Verificando se ambas estão funcionando..."
sleep 5
test_api

# Teste de failover do RabbitMQ
echo -e "\n🔄 Testando failover do RabbitMQ..."
docker stop key_value-rabbit1-1
echo "RabbitMQ1 parado. Verificando se o cluster continua funcionando..."
sleep 5
test_rabbitmq
docker start key_value-rabbit1-1
echo "RabbitMQ1 reiniciado. Verificando se o cluster está completo..."
sleep 5
test_rabbitmq

# Teste de failover do Redis
echo -e "\n🔄 Testando failover do Redis..."
docker stop key_value-redis1-1
echo "Redis1 parado. Verificando se Redis2 assume..."
sleep 5
test_redis
docker start key_value-redis1-1
echo "Redis1 reiniciado. Verificando se ambos estão funcionando..."
sleep 5
test_redis

# Teste de failover do CockroachDB
echo -e "\n🔄 Testando failover do CockroachDB..."
docker stop key_value-crdb1-1
echo "CockroachDB1 parado. Verificando se o cluster continua funcionando..."
sleep 5
test_cockroachdb
docker start key_value-crdb1-1
echo "CockroachDB1 reiniciado. Verificando se o cluster está completo..."
sleep 5
test_cockroachdb

echo -e "\n✅ Testes de failover concluídos!" 