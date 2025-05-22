# SPD_DISTRIBUIDO

Sistema distribuído de armazenamento key-value, com API REST, cache (Redis), fila (RabbitMQ), base de dados (CockroachDB) e balanceador de carga (Nginx).

## Estrutura do Projeto

```
SPD_DISTRIBUIDO/
│
├── api/                # Código da API REST (ex: NodeJS ou Python)
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
2. Abre um terminal na pasta `SPD_DISTRIBUIDO`.
3. Executa o script `start.sh` (ou `docker-compose up -d`).

## Requisitos

- Docker Desktop (Windows, macOS ou Linux)
- Git (opcional, para versionamento) 