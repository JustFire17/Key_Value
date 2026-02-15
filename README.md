# Distributed Key-Value Store

> A distributed key-value store with high availability, eventual consistency, and horizontal scalability.

## 🎯 Overview

This project implements a **distributed key-value store** with:

- **REST API** in Node.js
- **Cache** in Redis (with replication)
- **Message Broker** with RabbitMQ (cluster)
- **Persistence** in CockroachDB (distributed)
- **Load Balancing** with HAProxy and Nginx
- **Asynchronous Consumer** for consistency

## ✨ Features

| Feature | Description |
|---------|-----------|
| **High Availability** | 3 CockroachDB nodes, 3 RabbitMQ nodes, 2 Redis nodes, multiple APIs with HAProxy |
| **Eventual Consistency** | Consumer ensures Redis ↔ CockroachDB synchronization |
| **Low Latency** | Reads served from Redis; writes async |
| **Scalability** | Independent components, each scalable |
| **API Documented** | Swagger/OpenAPI built-in |

## 📋 Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org/))
- **Docker** and **Docker Compose** ([download](https://www.docker.com/products/docker-desktop))
- Terminal (CMD, PowerShell, Git Bash, Zsh, etc.)

**Windows note:** use Git Bash or WSL to run the `.sh` scripts.

## 🚀 Quick Start

### 1. Clone and enter the project
```bash
git clone https://github.com/JustFire17/Key_VALUE.git
cd Key_VALUE
```

### 2. Set up environment variables
```bash
cp .env.example .env
# Edit .env if you need custom values (optional)
```

### 3. Start the infrastructure
```bash
docker compose up -d
```

**Wait ~60 seconds** for the API/Consumer containers to finish their startup delay.

### 4. Install dependencies (optional, for local dev)
```bash
cd api && npm install && cd ..
cd consumer && npm install && cd ..
```

### 5. Start the services (optional, for local dev)

**Terminal 1 — API:**
```bash
cd api && npm start
```

**Terminal 2 — Consumer:**
```bash
cd consumer && npm start
```

### 6. Test the API
```bash
# PUT (insert/update)
curl -X PUT http://localhost:3003/api/ \
  -H "Content-Type: application/json" \
  -d '{"key":"key1","value":"value1"}'

# GET (retrieve)
curl http://localhost:3003/api/key1

# DELETE (remove)
curl -X DELETE http://localhost:3003/api/key1
```

### 7. Run scripts (optional)
```bash
./consistency_test.sh
./load_test.sh
./failover_test.sh
```

## 📚 Documentation

- [**API Manual**](API_MANUAL.md) — Endpoints and examples
- [**Architecture**](ARCHITECTURE.md) — Diagram and components
- [**Scripts**](SCRIPTS.md) — Testing and monitoring

## 🧪 Testing

### Consistency
Verifies if PUT/GET/DELETE synchronize between Redis and CockroachDB:
```bash
./consistency_test.sh
```

### Load Testing
Simulates multiple users with Artillery:
```bash
./load_test.sh
```

## 🧰 Scripts

- `./consistency_test.sh` — Checks Redis vs CockroachDB consistency
- `./load_test.sh` — Runs Artillery load tests (uses `load-test.yml`)
- `./failover_test.sh` — Simulates container failover and checks health

## ⚙️ Configuration

Copy `.env.example` to `.env` and customize if needed:

```bash
cp .env.example .env
```

Key variables:

| Variable | Default | Purpose |
|----------|---------|----------|
| `PORT` | 3000 | API server port (local) |
| `REDIS_URL` | redis://haproxy-redis:6379 | Redis connection (Docker) |
| `RABBITMQ_URL` | amqp://admin:admin@haproxy-rabbit:5672 | RabbitMQ connection |
| `COCKROACH_URL` | postgresql://root@haproxy-crdb:26260 | CockroachDB connection |
| `INIT_QUEUES` | true | Initialize RabbitMQ queues |

## 🔍 Monitoring and Debugging

### View logs
```bash
docker logs key_value-api1-1 -f       # API 1
docker logs key_value-api2-1 -f       # API 2
docker logs key_value-consumer-1 -f   # Consumer
docker logs key_value-rabbit1-1 -f    # RabbitMQ
docker logs crdb1 -f                  # CockroachDB
```

### Access web interfaces
| Service | URL | Credentials |
|---------|-----|------------|
| Swagger API | http://localhost:80/api-docs | - |
| CockroachDB Admin | http://localhost:8081 | - |
| RabbitMQ Management | http://localhost:15673 | admin/admin |

## 🛠️ Troubleshooting (Quick)

```bash
docker compose ps
docker compose logs -f
curl http://localhost:3003/health
```

Common causes: ports already in use, Docker daemon not running, low disk space.

## 🛑 Stop services
```bash
docker compose down          # Stop containers but keep volumes
docker compose down -v       # Stop containers and remove volumes
```

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## ⚠️ Development Notes

- This project was developed as an academic work in **Parallel and Distributed Systems**
- Intended as a learning/demo system, not production-hardened
- For production use, review:
  - Credentials and secrets (use HashiCorp Vault, AWS Secrets Manager, etc.)
  - TLS/SSL for communications
  - Rate limiting and authentication
  - Backup and disaster recovery

## 📞 Support

Found a bug? Open an [issue](https://github.com/JustFire17/Key_VALUE/issues).

---

**Last updated:** 2026-02-15  
**Version:** 1.0.0 