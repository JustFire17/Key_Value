# Key-Value Store Distribuído

Este projeto implementa um sistema de armazenamento chave-valor distribuído com alta disponibilidade e consistência eventual.

## Visão Geral

O sistema é composto por:
- API REST em Node.js
- Cache em Redis
- Mensageria com RabbitMQ
- Armazenamento persistente em CockroachDB
- Consumer para processamento assíncrono

## Documentação

A documentação completa do projeto está organizada nos seguintes arquivos:

1. [Manual da API](API_MANUAL.md) - Documentação detalhada dos endpoints
2. [Arquitetura](ARCHITECTURE.md) - Diagrama e descrição da arquitetura
3. [Instalação](SETUP.md) - Guia de instalação e configuração
4. [Scripts](SCRIPTS.md) - Documentação dos scripts de teste

## Características Principais

- **Alta Disponibilidade**: Sistema distribuído com redundância
- **Baixa Latência**: Cache em memória para operações rápidas
- **Consistência Eventual**: Garantia de consistência entre Redis e CockroachDB
- **Escalabilidade**: Componentes independentes e escaláveis
- **Persistência**: Armazenamento duradouro dos dados

## Requisitos

- Node.js v18+
- Docker e Docker Compose
- npm

## Início Rápido

1. Clone o repositório
2. Configure o arquivo `.env` com as seguintes variáveis:
   ```env
   PORT=3003
   REDIS_HOST=localhost
   REDIS_PORT=6379
   RABBITMQ_URL=amqp://localhost
   COCKROACH_HOST=localhost
   COCKROACH_PORT=26257
   COCKROACH_USER=root
   COCKROACH_DATABASE=key_value
   ```
3. Execute `docker-compose up -d`
4. Instale as dependências: `npm install`
5. Inicie a API: `npm run start:api`
6. Inicie o Consumer: `npm run start:consumer`

## Testes

O projeto inclui dois tipos de testes:

1. **Testes de Consistência**
   ```bash
   ./consistency_test.sh
   ```
   - Testa operações de inserção, atualização e remoção
   - Verifica consistência entre Redis e CockroachDB
   - Gera relatório detalhado das operações

2. **Testes de Carga**
   ```bash
   ./load_test.sh
   ```
   - Usa Artillery para simular carga
   - Testa operações PUT, GET e DELETE
   - Gera métricas de performance

## Monitoramento

- API: `docker logs key_value-api-1`
- Consumer: `docker logs key_value-consumer-1`
- Redis: `docker logs key_value-redis-1`
- RabbitMQ: `docker logs key_value-rabbitmq-1`
- CockroachDB: `docker logs crdb1`

## Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT. 