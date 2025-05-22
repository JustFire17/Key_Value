# Key-Value Store Distribuído

Sistema distribuído de armazenamento key-value, com API REST, cache (Redis), fila (RabbitMQ), base de dados (CockroachDB) e balanceador de carga (Nginx).

## Estrutura do Projeto

```
Key_VALUE/
│
├── api/                # Código da API REST (NodeJS)
│   ├── Dockerfile
│   └── ...
│
├── consumer/           # Código dos consumidores (processam fila e escrevem na DB)
│   ├── Dockerfile
│   └── ...
│
├── nginx/              # Configuração do Nginx (balanceador de carga)
│   └── nginx.conf
│
├── docker-compose.yml  # Orquestração de todos os serviços
├── start.sh            # Script para arrancar tudo
└── README.md           # Documentação
```

## Como Arrancar o Projeto

1. Certifica-te que o Docker Desktop está a correr.
2. Abre um terminal WSL na pasta `Key_VALUE`.
3. Executa:
   ```bash
   chmod +x start.sh
   ./start.sh
   ```

## Endpoints Disponíveis

- API: http://localhost:80
- Swagger UI: http://localhost:80/api-docs
- RabbitMQ Management: http://localhost:15672 (guest/guest)
- CockroachDB UI: http://localhost:8080

## Requisitos

- Docker Desktop (Windows, macOS ou Linux)
- WSL (Windows Subsystem for Linux) - para Windows
- Git (opcional, para versionamento) 