# Sistema Key-Value Distribuído

Este é um sistema distribuído de armazenamento key-value com alta disponibilidade, utilizando Redis como cache, CockroachDB como banco de dados persistente, e RabbitMQ para processamento assíncrono.

## 🏗️ Arquitetura

O sistema é composto por:

- **API**: Serviço REST que recebe requisições PUT, GET e DELETE
- **Consumer**: Processa mensagens da fila RabbitMQ e atualiza Redis/CockroachDB
- **Redis**: Cache distribuído com dois nós (master/replica)
- **CockroachDB**: Banco de dados distribuído com três nós
- **RabbitMQ**: Message broker com cluster de três nós
- **HAProxy**: Load balancer para todos os serviços

## 🚀 Como Executar

1. Clone o repositório
2. Execute:
   ```bash
   docker-compose up -d
   ```

## 📝 Endpoints da API

- `PUT /api`: Adiciona/atualiza uma chave-valor
  ```json
  {
    "key": "chave",
    "value": "valor"
  }
  ```
- `GET /api/{key}`: Recupera o valor de uma chave
- `DELETE /api/{key}`: Remove uma chave
- `GET /health`: Verifica a saúde do sistema

## 🧪 Testes

### Testes Funcionais
```bash
powershell -File test.ps1
```

### Testes de Carga
```bash
powershell -File load_test.ps1
```

## 🔄 Alta Disponibilidade

O sistema é resiliente a falhas:
- RabbitMQ: Cluster de 3 nós com filas quorum
- Redis: Master/replica com HAProxy
- CockroachDB: Cluster de 3 nós
- API: Múltiplas instâncias com HAProxy
- Consumer: Processamento assíncrono com prefetch_count otimizado

## ⚙️ Configurações

- **Redis**: Cache com dois nós
- **CockroachDB**: Banco de dados distribuído
- **RabbitMQ**: Cluster com três nós
- **HAProxy**: Load balancing para todos os serviços

## 📊 Monitoramento

- RabbitMQ: http://localhost:15673
- CockroachDB: http://localhost:8081
- HAProxy Stats:
  - API: http://localhost:8402
  - Redis: http://localhost:8403
  - RabbitMQ: http://localhost:8404
  - CockroachDB: http://localhost:8405

## 🔧 Otimizações

- Prefetch count do consumer: 5 mensagens
- Cache Redis para leituras frequentes
- Filas quorum no RabbitMQ
- Load balancing com HAProxy 