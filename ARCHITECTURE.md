# System Architecture - Key-Value Store

## Overview

This is a **distributed, fault-tolerant key-value store** with eventual consistency. The system uses:
- **API layer**: Two Node.js instances with load balancing
- **Cache layer**: Redis cluster with replication
- **Message queue**: RabbitMQ cluster for async operations
- **Storage layer**: CockroachDB cluster for persistence
- **Load balancers**: HAProxy for each component, Nginx for client routing

---

## System Diagram

Note: In the default `docker-compose.yml`, Nginx routes directly to `api1` and `api2`. The HAProxy-API service is available as an optional layer but is not wired into Nginx by default.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  HTTP Clients / Test Tools / Monitoring                         │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP (port 80, 3004)
                     ↓
        ┌────────────────────────┐
        │    Nginx Load Balancer │
        │    (port 80)           │
        └────────────┬───────────┘
                     │
        ┌────────────┴────────────┐
        ↓                         ↓
    ┌────────┐               ┌────────┐
    │ API-1  │               │ API-2  │
    │ :3003  │               │ :3002  │
    └────┬───┘               └───┬────┘
         │                       │
         │  HAProxy-API          │
         │  (port 3004)          │
         └───────────┬───────────┘
                     │
     ┌───────────────┼───────────────┐
     ↓               ↓               ↓
┌──────────┐ ┌──────────┐ ┌──────────┐
│  Redis-1 │ │  Redis-2 │ │  Cache   │
│  (Master)│─┤(Replica) │ │  Layer   │
└──────────┘ └──────────┘ └──────────┘
     │
  Replica → Redis-2

     ┌──────────────────┐
     │ HAProxy-Redis    │
     │ (port 6379)      │
     └──────────────────┘
             │
     ┌───────┴───────┬──────────┐
     ↓               ↓          ↓
┌──────────┐   ┌──────────┐  ┌──────────┐
│RabbitMQ-1│───│RabbitMQ-2│──│RabbitMQ-3│
│(Cluster) │   │(Cluster) │  │(Cluster) │
└──────────┘   └──────────┘  └──────────┘
     │
  HAProxy-Rabbit
  (port 5672)
     │
     ↓
┌──────────────┐
│ Consumer Node│ ← Consumes messages from RabbitMQ
│ (background) │
└──────┬───────┘
       │
    ┌──┴─────────────┐
    ↓                ↓
 [Redis]          [CockroachDB]
[Updates]      [Persistence]
    ↑                ↑
    │                │
    │          ┌─────┴──────┬──────────┐
    │          ↓            ↓          ↓
    │      ┌──────────┐ ┌──────────┐ ┌──────────┐
    │      │  CRDB-1  │─│  CRDB-2  │─│  CRDB-3  │
    │      │(Leader)  │ │(Replica) │ │(Replica) │
    │      └──────────┘ └──────────┘ └──────────┘
    │          │
    │    HAProxy-CRDB
    │    (port 26260)
    │
    └──────────────────┘
```

---

## Components

### 1. **Nginx (Client Entry Point)**
- Reverse proxy on port 80
- Forwards traffic directly to `api1` and `api2` (see `nginx/nginx.conf`)
- SSL termination ready (not configured)

### 2. **HAProxy-API (API Load Balancer)**
- Optional load balancer for API instances
- Health checks on `/health` endpoint
- Not used by Nginx in the default compose setup

### 3. **API Servers** (Node.js + Express)

**API-1 (port 3003)** and **API-2 (port 3002)**

Functions:
- Handle REST requests (PUT, GET, DELETE)
- Synchronously read from Redis cache
- Queue write/delete operations to RabbitMQ
- Return responses to clients

Implementation:
- Express.js REST server
- Redis client connection
- RabbitMQ publisher
- Swagger/OpenAPI documentation

### 4. **HAProxy-Redis (Redis Load Balancer)**
- Routes to Redis primary (read-write) or replicas (read-only)
- Health monitoring
- Port 6379

### 5. **Redis Cluster**

**Redis-1 (Master)**: Accepts writes, replicates to Redis-2
**Redis-2 (Replica)**: Read-only, receives replication updates

Features:
- In-memory cache for fast reads
- Persistence with AOF (Append-Only File)
- Replication for redundancy
- TTL support (keys can auto-expire)

### 6. **HAProxy-RabbitMQ (RabbitMQ Load Balancer)**
- Routes messages to healthy RabbitMQ nodes
- Port 5672 (AMQP)
- Cluster support

### 7. **RabbitMQ Cluster**

**Rabbit-1, Rabbit-2, Rabbit-3**: Full cluster mesh

Features:
- Message durability (queues persist on disk)
- Quorum queues for consistency
- Automatic failover
- Dead-letter exchange for failed messages

Queues:
- `key-value-queue`: Primary work queue (PUT, DELETE operations)

### 8. **Consumer** (Node.js Background Service)

Functions:
- Consumes messages from RabbitMQ
- Processes PUT operations → Insert/update in CockroachDB
- Processes DELETE operations → Remove from CockroachDB
- Keeps Redis synchronized
- Implements retry logic and error handling

Features:
- Idempotent message processing
- Timestamp-based conflict resolution
- Graceful shutdown
- Automatic reconnection

### 9. **HAProxy-CockroachDB (Database Load Balancer)**
- Routes SQL connections to CRDB cluster
- Read balancing across replicas
- Port 26260

### 10. **CockroachDB Cluster**

**CRDB-1 (Leader), CRDB-2, CRDB-3 (Replicas)**: Raft consensus

Features:
- Distributed SQL database
- ACID transactions
- Automatic replication (3x by default)
- Fault tolerance (survives 1 node failure)
- Built-in backups

Schema:
```sql
CREATE TABLE key_value (
    key TEXT PRIMARY KEY,
    value TEXT,
    timestamp BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Data Flow

### PUT Operation
```
Client HTTP PUT
    ↓
    Nginx → HAProxy-API → API Instance
    ↓
    1. Check if key exists in Redis
    2. Queue message to RabbitMQ: {key, value, timestamp}
    3. Return 200 immediately (async)
    ↓
    Consumer (background)
    ↓
    1. Receive message from RabbitMQ
    2. Check timestamp (ignore if older update exists)
    3. INSERT/UPDATE in CockroachDB via HAProxy-CRDB
    4. Update Redis via HAProxy-Redis (or direct)
    5. ACK message to RabbitMQ
```

### GET Operation
```
Client HTTP GET /api/:key
    ↓
    Nginx → HAProxy-API → API Instance
    ↓
    1. Query Redis via HAProxy-Redis
    2. If found → Return immediately
    3. If not found → Query CockroachDB via HAProxy-CRDB
    4. If found → Update Redis cache + Return
    5. If not found → Return 404
```

### DELETE Operation
```
Client HTTP DELETE /api/:key
    ↓
    Nginx → HAProxy-API → API Instance
    ↓
    1. Check if key exists (Redis or CRDB)
    2. Queue message to RabbitMQ: {key, timestamp, action:delete}
    3. Return 200 immediately (async)
    ↓
    Consumer (background)
    ↓
    1. Receive delete message
    2. DELETE from CockroachDB
    3. DELETE from Redis
    4. ACK message to RabbitMQ
```

---

## Key Properties

| Property | Mechanism |
|----------|----------|
| **High Availability** | 3-node CRDB cluster, 3-node RabbitMQ cluster, 2-node Redis, multiple APIs |
| **Fault Tolerance** | CRDB survives 1 node failure; RabbitMQ survives 1-2 node failures |
| **Eventual Consistency** | Redis may be behind CRDB temporarily; Consumer synchronizes |
| **Low Latency** | Reads from Redis cache (µs); Writes async to CRDB |
| **Scalability** | Each component can scale independently (more APIs, more CRDB nodes, etc.) |
| **Durability** | Data persisted in CRDB + RabbitMQ queues |

---

## Monitoring & Debugging

**Docker Logs:**
```bash
docker compose logs -f api1           # API-1
docker compose logs -f api2           # API-2
docker compose logs -f consumer       # Consumer
docker compose logs -f rabbit1        # RabbitMQ
docker compose logs -f crdb1          # CockroachDB
```

**Web Interfaces:**
- CockroachDB Admin: http://localhost:8081
- RabbitMQ Management: http://localhost:15673 (user: admin, pass: admin)
- Swagger API: http://localhost:80/api-docs

**Health Checks:**
```bash
curl http://localhost:3003/health     # API-1 health
curl http://localhost:3002/health     # API-2 health
``` 