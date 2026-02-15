#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting failover tests..."

# Test API
test_api() {
    echo "Testing API..."
    local code1 code2 codeN
    for _ in {1..5}; do
        code1=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/health || true)
        code2=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/health || true)
        codeN=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health || true)
        if [[ "$code1" == "200" || "$code2" == "200" ]]; then
            break
        fi
        sleep 2
    done
    echo "API1 health: HTTP $code1"
    echo "API2 health: HTTP $code2"
    echo "Nginx health: HTTP $codeN"
    echo
}

# Test RabbitMQ
test_rabbitmq() {
    echo "Testing RabbitMQ..."
    local code
    for _ in {1..5}; do
        code=$(curl -s -o /dev/null -w "%{http_code}" -u admin:admin http://localhost:15673/api/overview || true)
        if [[ "$code" == "200" ]]; then
            break
        fi
        sleep 2
    done
    echo "RabbitMQ status: HTTP $code"
    echo
}

# Test Redis
test_redis() {
    echo "Testing Redis..."
    local code
    for _ in {1..5}; do
        code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8403/stats || true)
        if [[ "$code" == "200" ]]; then
            break
        fi
        sleep 2
    done
    echo "HAProxy Redis stats: HTTP $code"
    echo
}

# Test CockroachDB
test_cockroachdb() {
    echo "Testing CockroachDB..."
    local code
    for _ in {1..5}; do
        code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/health || true)
        if [[ "$code" == "200" ]]; then
            break
        fi
        sleep 2
    done
    echo "CockroachDB health: HTTP $code"
    echo
}

# Initial check
echo "Initial system status:"
test_api
test_rabbitmq
test_redis
test_cockroachdb

# API failover
echo -e "\nTesting API failover..."
docker stop key_value-api1-1
echo "API1 stopped. Checking if API2 takes over..."
sleep 5
test_api
docker start key_value-api1-1
echo "API1 restarted. Checking if both are healthy..."
sleep 5
test_api

# RabbitMQ failover
echo -e "\nTesting RabbitMQ failover..."
docker stop key_value-rabbit1-1
echo "RabbitMQ1 stopped. Checking if the cluster continues..."
sleep 5
test_rabbitmq
docker start key_value-rabbit1-1
echo "RabbitMQ1 restarted. Checking if the cluster is healthy..."
sleep 5
test_rabbitmq

# Redis failover
echo -e "\nTesting Redis failover..."
docker stop key_value-redis1-1
echo "Redis1 stopped. Checking if Redis2 takes over..."
sleep 5
test_redis
docker start key_value-redis1-1
echo "Redis1 restarted. Checking if both are healthy..."
sleep 5
test_redis

# CockroachDB failover
echo -e "\nTesting CockroachDB failover..."
docker stop crdb1
echo "CockroachDB1 stopped. Checking if the cluster continues..."
sleep 5
test_cockroachdb
docker start crdb1
echo "CockroachDB1 restarted. Checking if the cluster is healthy..."
sleep 5
test_cockroachdb

echo -e "\nFailover tests completed"