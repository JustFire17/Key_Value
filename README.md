# Sistema Key-Value Distribuído

Este é um sistema distribuído de armazenamento key-value que utiliza múltiplos serviços para garantir alta disponibilidade e escalabilidade.

## 🏗 Arquitetura

O sistema é composto pelos seguintes componentes:

- **APIs**: Duas instâncias da API para balanceamento de carga
- **RabbitMQ**: Cluster de 3 nós para processamento assíncrono
- **Redis**: Cache distribuído com replicação
- **CockroachDB**: Banco de dados distribuído
- **HAProxy**: Balanceamento de carga para todos os serviços
- **Nginx**: Proxy reverso para as APIs

## 🚀 Como Executar

1. Certifique-se de ter o Docker e Docker Compose instalados
2. Clone o repositório
3. Execute:
```bash
docker-compose up -d
```

## 📊 Endpoints da API

- `GET /`: Página inicial
- `GET /health`: Status de saúde da API
- `GET /api-docs`: Documentação Swagger
- `GET /{key}`: Buscar valor por chave
- `PUT /`: Inserir/atualizar chave-valor
- `DELETE /{key}`: Remover chave

## 🧪 Testes

### Testes Funcionais
Execute o script de testes básicos:
```bash
chmod +x test.sh
./test.sh
```

### Testes de Carga
Execute o script de testes de carga:
```bash
chmod +x load_test.sh
./load_test.sh
```

### Testes de Failover
Execute o script de testes de failover:
```bash
chmod +x failover_test.sh
./failover_test.sh
```

### Testes de Consistência
Execute o script de testes de consistência:
```bash
chmod +x consistency_test.sh
./consistency_test.sh
```

## 🔍 Monitoramento

- RabbitMQ: http://localhost:15673 (admin/admin)
- CockroachDB: http://localhost:8081
- HAProxy Stats:
  - API: http://localhost:8402
  - Redis: http://localhost:8403
  - RabbitMQ: http://localhost:8404
  - CockroachDB: http://localhost:8405

## 🔄 Fluxo de Dados

1. Cliente faz requisição para a API
2. API verifica cache no Redis
3. Se não encontrar, busca no CockroachDB
4. Operações de escrita são enviadas para o RabbitMQ
5. Consumers processam as mensagens e atualizam Redis e CockroachDB

## 🛡 Alta Disponibilidade

- APIs: Balanceamento de carga via Nginx
- RabbitMQ: Cluster de 3 nós
- Redis: Replicação master-slave
- CockroachDB: Cluster de 3 nós

## 📝 Dependências

- Node.js 18+
- Docker
- Docker Compose
- Apache Bench (para testes de carga) 