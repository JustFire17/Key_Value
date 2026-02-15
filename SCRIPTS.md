# Scripts and Test Utilities

This project includes a small set of useful, maintained scripts for validation and load testing. All scripts assume Docker services are running and the API/Consumer are started.

## Scripts

### 1. consistency_test.sh
Validates data consistency between Redis and CockroachDB.

**What it does:**
- Inserts and updates keys
- Verifies Redis and CockroachDB values match
- Retries to account for eventual consistency

**Run:**
```bash
./consistency_test.sh
```

**Output:**
- ✅ on successful checks
- ❌ when inconsistencies are detected
- Prints values from both Redis and CockroachDB

---

### 2. load_test.sh
Runs a load test with Artillery using `load-test.yml`.

**What it does:**
- Simulates concurrent users
- Measures response times and throughput
- Verifies basic status codes

**Run:**
```bash
./load_test.sh
```

**Notes:**
- Uses `npx artillery`, so Node.js is required
- Default target is `http://localhost:3003`

---

### 3. failover_test.sh
Checks API/Redis/RabbitMQ/CockroachDB health and simulates container failover.

**What it does:**
- Calls health/status endpoints
- Stops and restarts containers to test resilience

**Run (use with caution):**
```bash
./failover_test.sh
```

**Note:** API containers have a built-in startup delay (~60s). During failover, `API1 health: HTTP 000` can appear briefly until the API finishes its startup.

---

## Configuration Files

### load-test.yml
Artillery config for load testing.

**Key fields:**
- `config.target`: API base URL
- `phases`: ramp-up + sustained load
- `scenarios`: PUT, GET, DELETE flows

**Example:**
```yaml
config:
  target: "http://localhost:3003"
  phases:
    - duration: 60
      arrivalRate: 5
      rampTo: 20
    - duration: 120
      arrivalRate: 20
  defaults:
    headers:
      Content-Type: "application/json"
```

---

## Requirements

- Docker services running (`docker compose up -d`)
- API + Consumer running
- Node.js and npm installed

## Recommended Order

1. Run `./consistency_test.sh`
2. Run `./load_test.sh`
3. (Optional) Run `./failover_test.sh`