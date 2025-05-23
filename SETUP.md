# Guia de Instalação e Configuração

## Pré-requisitos

- Node.js (v18 ou superior)
- Docker e Docker Compose
- npm (gerenciador de pacotes do Node.js)

## Instalação

1. **Clone o repositório**
```bash
git clone [URL_DO_REPOSITÓRIO]
cd Key_VALUE
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:
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

4. **Inicie os containers Docker**
```bash
docker-compose up -d
```

## Estrutura de Diretórios

```
Key_VALUE/
├── src/
│   ├── api/           # Código da API
│   ├── consumer/      # Código do Consumer
│   └── shared/        # Código compartilhado
├── tests/             # Scripts de teste
├── docker-compose.yml # Configuração dos containers
└── package.json       # Dependências do projeto
```

## Scripts Disponíveis

- `npm start`: Inicia a API
- `npm run consumer`: Inicia o Consumer
- `npm test`: Executa os testes
- `./consistency_test.sh`: Executa testes de consistência
- `./load_test.sh`: Executa testes de carga

## Verificação da Instalação

1. **Verifique se os containers estão rodando**
```bash
docker ps
```
Você deve ver containers para:
- Redis
- RabbitMQ
- CockroachDB

2. **Teste a API**
```bash
curl http://localhost:3003/api/test_key
```

3. **Execute os testes de consistência**
```bash
./consistency_test.sh
```

## Solução de Problemas

### Problemas Comuns

1. **Containers não iniciam**
   - Verifique se o Docker está rodando
   - Verifique as portas disponíveis
   - Verifique os logs: `docker-compose logs`

2. **Erro de conexão com Redis**
   - Verifique se o Redis está rodando: `docker ps | grep redis`
   - Verifique as credenciais no arquivo `.env`

3. **Erro de conexão com RabbitMQ**
   - Verifique se o RabbitMQ está rodando: `docker ps | grep rabbitmq`
   - Verifique a URL no arquivo `.env`

4. **Erro de conexão com CockroachDB**
   - Verifique se o CockroachDB está rodando: `docker ps | grep cockroach`
   - Verifique as credenciais no arquivo `.env`

### Logs

- API: `docker logs key_value-api-1`
- Consumer: `docker logs key_value-consumer-1`
- Redis: `docker logs key_value-redis-1`
- RabbitMQ: `docker logs key_value-rabbitmq-1`
- CockroachDB: `docker logs crdb1` 