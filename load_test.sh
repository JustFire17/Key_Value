#!/bin/bash

echo "🚀 Iniciando testes de carga..."

# Teste de carga para PUT
echo "📝 Teste de carga - PUT"
ab -n 1000 -c 10 -p test_data.json -T 'application/json' http://localhost/put

# Teste de carga para GET
echo "📖 Teste de carga - GET"
ab -n 1000 -c 10 http://localhost/get/test_key

# Teste de carga para DELETE
echo "🗑️ Teste de carga - DELETE"
ab -n 1000 -c 10 -X DELETE http://localhost/delete/test_key

echo "✅ Testes de carga concluídos!" 