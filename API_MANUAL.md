# API Manual - Key-Value Store

## Base URL
```
http://localhost:3003/api
http://localhost:3002/api (failover)
```

## Overview
All endpoints require `Content-Type: application/json`. Operations are asynchronous through RabbitMQ, with eventual consistency between Redis and CockroachDB.

---

## Endpoints

### PUT /api — Insert or Update
Inserts a new key-value pair or updates an existing one.

**Request:**
```bash
curl -X PUT http://localhost:3003/api/ \
  -H "Content-Type: application/json" \
  -d '{"key":"user:123","value":"John Doe"}'
```

**Request Body:**
```json
{
    "key": "string (required, max 255 chars)",
    "value": "string (required, any length)"
}
```

**Responses:**

| Status | Body | Description |
|--------|------|-------------|
| **200** | `{"message": "Key-value inserted successfully"}` | Successfully queued for storage |
| **400** | `{"error": "Key and value are required"}` | Missing or invalid request body |
| **500** | `{"error": "Internal error"}` | Server error or RabbitMQ unavailable |

**Behavior:**
- Returns immediately (async operation)
- Consumer processes in background
- Check GET endpoint for confirmation

---

### GET /api/:key — Retrieve
Retrieves the value associated with a key.

**Request:**
```bash
curl http://localhost:3003/api/user:123
```

**Responses:**

| Status | Body | Description |
|--------|------|-------------|
| **200** | `{"data": {"value": "John Doe"}}` | Key found in Redis or CockroachDB |
| **404** | `{"error": "Key not found"}` | Key does not exist |
| **500** | `{"error": "Internal error"}` | Server error (Redis/DB unavailable) |

**Behavior:**
- First checks Redis (fast cache)
- Falls back to CockroachDB if not cached
- Returns from whichever source finds it

---

### DELETE /api/:key — Remove
Removes a key-value pair from the system.

**Request:**
```bash
curl -X DELETE http://localhost:3003/api/user:123
```

**Responses:**

| Status | Body | Description |
|--------|------|-------------|
| **200** | `{"message": "Key removed successfully"}` | Successfully queued for removal |
| **404** | `{"error": "Key not found"}` | Key does not exist |
| **500** | `{"error": "Internal error"}` | Server error or RabbitMQ unavailable |

**Behavior:**
- Queues deletion in RabbitMQ
- Consumer removes from both Redis and CockroachDB
- Returns immediately (async)

---

## Usage Examples

### Example 1: Insert and Retrieve
```bash
# Insert
curl -X PUT http://localhost:3003/api/ \
  -H "Content-Type: application/json" \
  -d '{"key":"session:abc123","value":"{\"user\":\"alice\",\"ttl\":3600}"}'

# Response
{"message": "Key-value inserted successfully"}

# Retrieve
curl http://localhost:3003/api/session:abc123

# Response
{"data": {"value": "{\"user\":\"alice\",\"ttl\":3600}"}}
```

### Example 2: Delete
```bash
curl -X DELETE http://localhost:3003/api/session:abc123

# Response
{"message": "Key removed successfully"}
```

### Example 3: Multiple Operations (Shell Script)
```bash
#!/bin/bash

# Insert multiple keys
for i in {1..5}; do
  curl -X PUT http://localhost:3003/api/ \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"key_$i\",\"value\":\"value_$i\"}"
done

# Retrieve one
curl http://localhost:3003/api/key_1
```

---

## Error Handling

### Common Errors

**Empty Request:**
```bash
curl -X PUT http://localhost:3003/api/ \
  -H "Content-Type: application/json" \
  -d '{}'

# Response
{"error": "Key and value are required"}
```

**RabbitMQ Unavailable:**
```bash
# Response (if RabbitMQ is down)
{"error": "Internal error"}
```

**Non-existent Key:**
```bash
curl http://localhost:3003/api/nonexistent

# Response
{"error": "Key not found"}
```

---

## Architecture Notes

- **PUT/DELETE**: Queued in RabbitMQ, processed asynchronously by Consumer
- **GET**: Served from Redis cache or CockroachDB
- **Consistency**: Eventual (Consumer ensures Redis ↔ CockroachDB sync)
- **Failover**: Nginx balances between API1 (3003) and API2 (3002); direct ports are also exposed
- **Timeouts**: Controlled by reverse proxy configs (see `nginx/nginx.conf` and `haproxy/*.cfg`)

---

## Rate Limiting & Quotas

Currently **no rate limiting** is enforced. For production, implement:
- Per-IP rate limit (e.g., 1000 req/min)
- Per-key quota (e.g., 100MB per key)
- Connection pool limits

---

## Testing

**Manual Test:**
```bash
bash ./consistency_test.sh
```

**Load Test:**
```bash
bash ./load_test.sh
```

**Health Check:**
```bash
curl http://localhost:3003/health
``` 