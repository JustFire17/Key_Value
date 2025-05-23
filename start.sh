#!/bin/bash

echo "🚀 Iniciando o sistema distribuído key-value..."

# Verifica se o Docker está a correr
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker não está a correr. Por favor, inicia o Docker Desktop primeiro."
    exit 1
fi

# Para containers existentes (se houver)
echo "🔄 Parando containers existentes..."
docker-compose down

# Remove volumes antigos (opcional, descomenta se precisares)
# echo "🧹 Removendo volumes antigos..."
# docker-compose down -v

# Constrói e inicia os containers
echo "🏗️  Construindo e iniciando os containers..."
docker-compose up -d --build

# Verifica se os containers arrancaram
if [ $? -eq 0 ]; then
    echo "✅ Sistema iniciado com sucesso!"
    echo "📝 Endpoints disponíveis:"
    echo "   - API: http://localhost:3001"
    echo "   - Swagger UI: http://localhost:3001/api-docs"
    echo "   - RabbitMQ Management: http://localhost:15673 (admin/admin)"
    echo "   - CockroachDB UI: http://localhost:8081"
else
    echo "❌ Erro ao iniciar o sistema. Verifica os logs com 'docker-compose logs'."
    exit 1
fi

# Mostra os logs
echo "📋 Logs do sistema (Ctrl+C para sair):"
docker-compose logs -f 