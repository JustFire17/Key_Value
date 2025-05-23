# Documentação dos Scripts

## Scripts de Teste

### 1. consistency_test.sh

Este script testa a consistência entre Redis e CockroachDB.

**Funcionalidades:**
- Testa operações de inserção
- Testa operações de atualização
- Testa operações de múltiplas inserções
- Verifica se os dados estão consistentes entre Redis e CockroachDB

**Uso:**
```bash
./consistency_test.sh
```

**Saída:**
- ✅ para testes bem-sucedidos
- ❌ para inconsistências detectadas
- Detalhes das operações e valores em cada banco de dados

### 2. load_test.sh

Este script executa testes de carga na API usando Artillery.

**Funcionalidades:**
- Testa a API sob carga
- Simula múltiplos usuários
- Mede tempos de resposta
- Gera relatório de performance

**Uso:**
```bash
./load_test.sh
```

**Configuração:**
O teste é configurado no arquivo `load-test.yml` com:
- Fase de aumento gradual (ramp up)
- Fase de carga sustentada
- Cenários de teste (PUT, GET, DELETE)

**Saída:**
- Métricas de performance
- Taxa de requisições
- Tempos de resposta
- Códigos de status HTTP
- Estatísticas de usuários virtuais

## Arquivos de Configuração

### load-test.yml

Arquivo de configuração do Artillery que define:
- Target: URL da API
- Phases: Fases do teste de carga
- Scenarios: Cenários de teste
- Headers: Configurações de cabeçalho
- Expect: Validações de resposta

**Estrutura:**
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

## Notas Importantes

1. **Pré-requisitos:**
   - Docker e containers rodando
   - API e Consumer em execução
   - Node.js e npm instalados

2. **Ordem de Execução:**
   - Primeiro execute os testes de consistência
   - Depois execute os testes de carga
   - Verifique os logs para detalhes

3. **Interpretação dos Resultados:**
   - Consistência: Verifique se Redis e CockroachDB têm os mesmos valores
   - Carga: Analise os tempos de resposta e taxas de erro
   - Performance: Compare com os requisitos do sistema 