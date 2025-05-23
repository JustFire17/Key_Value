# Manual da API Key-Value Store

## Endpoints

### PUT /api
Insere ou atualiza um par chave-valor.

**Request:**
```json
{
    "key": "string",
    "value": "string"
}
```

**Response (200):**
```json
{
    "message": "Chave-valor inserido com sucesso"
}
```

### GET /api/:key
Recupera o valor associado a uma chave.

**Response (200):**
```json
{
    "data": {
        "value": "string"
    }
}
```

**Response (404):**
```json
{
    "error": "Chave não encontrada"
}
```

### DELETE /api/:key
Remove um par chave-valor.

**Response (200):**
```json
{
    "message": "Chave removida com sucesso"
}
```

**Response (404):**
```json
{
    "error": "Chave não encontrada"
}
```

## Exemplos de Uso

### Inserir um valor
```bash
curl -X PUT http://localhost:3003/api/ \
  -H "Content-Type: application/json" \
  -d '{"key":"test_key","value":"test_value"}'
```

### Recuperar um valor
```bash
curl http://localhost:3003/api/test_key
```

### Remover um valor
```bash
curl -X DELETE http://localhost:3003/api/test_key
```

## Notas
- A API usa Redis como cache e CockroachDB como banco de dados persistente
- As operações são assíncronas através do RabbitMQ
- A consistência entre Redis e CockroachDB é mantida pelo consumer 