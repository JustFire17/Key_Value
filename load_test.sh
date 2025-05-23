#!/bin/bash

# Configurações do teste
NUM_REQUESTS=200
CONCURRENT_REQUESTS=10
BASE_URL="http://localhost:80/api"
SLEEP_BETWEEN_BATCHES=0.2
INITIAL_KEYS=50

echo -e "\e[32mIniciando testes de carga...\e[0m"

# Array para armazenar chaves existentes
declare -a existing_keys

# Função para gerar uma chave aleatória
generate_random_key() {
    echo "key_$((RANDOM % 9000 + 1000))"
}

# Função para executar uma requisição PUT
do_put_request() {
    local key=$1
    local value="value_$((RANDOM % 9000 + 1000))"
    local start_time=$(date +%s%N)
    
    response=$(curl -s -X PUT "$BASE_URL" \
        -H "Content-Type: application/json" \
        -d "{\"key\":\"$key\",\"value\":\"$value\"}")
    
    local end_time=$(date +%s%N)
    local duration=$((($end_time - $start_time)/1000000))
    
    if [[ $response == *"sucesso"* ]] || [[ $response == *"inserido"* ]]; then
        existing_keys+=("$key")
        echo "SUCCESS:$duration"
        return 0
    else
        echo "FAIL:$duration ($response)"
        return 1
    fi
}

# Função para executar uma requisição GET
do_get_request() {
    local key=$1
    local start_time=$(date +%s%N)
    
    response=$(curl -s "$BASE_URL/$key")
    
    local end_time=$(date +%s%N)
    local duration=$((($end_time - $start_time)/1000000))
    
    if [[ $response == *"value"* ]]; then
        echo "SUCCESS:$duration"
        return 0
    else
        echo "FAIL:$duration ($response)"
        return 1
    fi
}

# Função para executar uma requisição DELETE
do_delete_request() {
    local key=$1
    local start_time=$(date +%s%N)
    
    response=$(curl -s -X DELETE "$BASE_URL/$key")
    
    local end_time=$(date +%s%N)
    local duration=$((($end_time - $start_time)/1000000))
    
    if [[ $response == *"sucesso"* ]] || [[ $response == *"removida"* ]]; then
        # Remover a chave do array de chaves existentes
        for i in "${!existing_keys[@]}"; do
            if [[ "${existing_keys[$i]}" == "$key" ]]; then
                unset 'existing_keys[$i]'
                break
            fi
        done
        echo "SUCCESS:$duration"
        return 0
    else
        echo "FAIL:$duration ($response)"
        return 1
    fi
}

# Função para verificar se a API está pronta
check_api_ready() {
    local max_retries=5
    local retry_count=0
    local ready=false
    
    while [ $retry_count -lt $max_retries ] && [ "$ready" = false ]; do
        if curl -s "$BASE_URL/health" > /dev/null; then
            ready=true
        else
            echo "Aguardando API ficar pronta... (tentativa $((retry_count + 1))/$max_retries)"
            sleep 2
            ((retry_count++))
        fi
    done
    
    if [ "$ready" = false ]; then
        echo "Erro: API não está respondendo após $max_retries tentativas"
        exit 1
    fi
}

# Verificar se a API está pronta
check_api_ready

# Arrays para armazenar resultados
declare -a success_durations
declare -a error_durations
declare -a error_types
declare -a operation_types
declare -a operation_durations
success_count=0
error_count=0

# Arrays para armazenar resultados por operação
declare -A op_success_count
declare -A op_error_count
declare -A op_success_durations
declare -A op_error_durations

echo -e "\n\e[33mExecutando $NUM_REQUESTS requisições ($CONCURRENT_REQUESTS simultâneas)...\e[0m"

# Fase 1: Criar chaves iniciais
echo "Fase 1: Criando chaves iniciais..."
for ((i=0; i<INITIAL_KEYS; i++)); do
    key=$(generate_random_key)
    result=$(do_put_request "$key")
    if [[ $result == SUCCESS* ]]; then
        echo -n "."
    else
        echo -e "\nErro ao criar chave inicial: $result"
        exit 1
    fi
    sleep 0.1  # Pequena pausa entre criações
done
echo -e "\nChaves iniciais criadas: ${#existing_keys[@]}"

# Verificar se as chaves foram criadas corretamente
echo "Verificando chaves criadas..."
for key in "${existing_keys[@]}"; do
    result=$(do_get_request "$key")
    if [[ $result != SUCCESS* ]]; then
        echo -e "\nErro: Chave $key não está acessível após criação"
        exit 1
    fi
done
echo "Todas as chaves iniciais verificadas com sucesso!"

# Fase 2: Executar requisições em lotes
for ((i=0; i<NUM_REQUESTS; i+=CONCURRENT_REQUESTS)); do
    batch_size=$((NUM_REQUESTS - i < CONCURRENT_REQUESTS ? NUM_REQUESTS - i : CONCURRENT_REQUESTS))
    
    # Array para armazenar PIDs dos processos
    pids=()
    results=()
    
    # Iniciar requisições em background
    for ((j=0; j<batch_size; j++)); do
        # Distribuir operações: 30% PUT, 50% GET, 20% DELETE
        operation=$((RANDOM % 100))
        if [ $operation -lt 30 ]; then
            key=$(generate_random_key)
            result=$(do_put_request "$key")
            op_type="PUT"
        elif [ $operation -lt 80 ]; then
            # Para GET, usar uma chave existente 90% das vezes
            if [ ${#existing_keys[@]} -gt 0 ] && [ $((RANDOM % 100)) -lt 90 ]; then
                key=${existing_keys[$((RANDOM % ${#existing_keys[@]}))]}
            else
                key=$(generate_random_key)
            fi
            result=$(do_get_request "$key")
            op_type="GET"
        else
            # Para DELETE, usar uma chave existente 90% das vezes
            if [ ${#existing_keys[@]} -gt 0 ] && [ $((RANDOM % 100)) -lt 90 ]; then
                key=${existing_keys[$((RANDOM % ${#existing_keys[@]}))]}
            else
                key=$(generate_random_key)
            fi
            result=$(do_delete_request "$key")
            op_type="DELETE"
        fi
        
        operation_types+=("$op_type")
        results+=("$result")
        
        if [[ $result == SUCCESS* ]]; then
            ((success_count++))
            ((op_success_count[$op_type]++))
            duration=$(echo $result | cut -d':' -f2)
            success_durations+=($duration)
            op_success_durations[$op_type]+="$duration "
        else
            ((error_count++))
            ((op_error_count[$op_type]++))
            duration=$(echo $result | cut -d':' -f2 | cut -d' ' -f1)
            error_durations+=($duration)
            op_error_durations[$op_type]+="$duration "
            error_type=$(echo $result | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
            if [[ ! " ${error_types[@]} " =~ " ${error_type} " ]]; then
                error_types+=("$error_type")
            fi
        fi
    done
    
    # Aguardar entre os lotes
    sleep $SLEEP_BETWEEN_BATCHES
done

# Calcular estatísticas
success_rate=$(echo "scale=2; ($success_count / $NUM_REQUESTS) * 100" | bc)

# Calcular médias de duração
success_avg=0
if [[ ${#success_durations[@]} -gt 0 ]]; then
    sum=0
    for duration in "${success_durations[@]}"; do
        sum=$((sum + duration))
    done
    success_avg=$(echo "scale=2; $sum / ${#success_durations[@]}" | bc)
fi

error_avg=0
if [[ ${#error_durations[@]} -gt 0 ]]; then
    sum=0
    for duration in "${error_durations[@]}"; do
        sum=$((sum + duration))
    done
    error_avg=$(echo "scale=2; $sum / ${#error_durations[@]}" | bc)
fi

# Exibir resultados
echo -e "\n\e[32mResultados dos testes de carga:\e[0m"
echo "Total de requisições: $NUM_REQUESTS"
echo "Requisições simultâneas: $CONCURRENT_REQUESTS"
echo "Requisições com sucesso: $success_count"
echo "Requisições com erro: $error_count"
echo "Taxa de sucesso: $success_rate%"
echo "Duração média (sucesso): ${success_avg}ms"
echo "Duração média (erro): ${error_avg}ms"

echo -e "\n\e[33mResultados por operação:\e[0m"
for op in "PUT" "GET" "DELETE"; do
    total=$((op_success_count[$op] + op_error_count[$op]))
    success_rate=$(echo "scale=2; (${op_success_count[$op]} / $total) * 100" | bc)
    
    # Calcular média de duração para sucessos
    success_avg=0
    if [[ ${op_success_count[$op]} -gt 0 ]]; then
        sum=0
        count=0
        for duration in ${op_success_durations[$op]}; do
            sum=$((sum + duration))
            ((count++))
        done
        success_avg=$(echo "scale=2; $sum / $count" | bc)
    fi
    
    echo "$op:"
    echo "  Total: $total"
    echo "  Sucessos: ${op_success_count[$op]} ($success_rate%)"
    echo "  Erros: ${op_error_count[$op]}"
    echo "  Duração média (sucesso): ${success_avg}ms"
done

if [[ ${#error_types[@]} -gt 0 ]]; then
    echo -e "\n\e[33mTipos de erros encontrados:\e[0m"
    for error in "${error_types[@]}"; do
        echo "- $error"
    done
fi

# Calcular percentis para sucessos
if [[ ${#success_durations[@]} -gt 0 ]]; then
    IFS=$'\n' sorted=($(sort -n <<<"${success_durations[*]}"))
    unset IFS
    
    p50_idx=$(( ${#sorted[@]} * 50 / 100 ))
    p90_idx=$(( ${#sorted[@]} * 90 / 100 ))
    p95_idx=$(( ${#sorted[@]} * 95 / 100 ))
    p99_idx=$(( ${#sorted[@]} * 99 / 100 ))
    
    echo -e "\n\e[33mPercentis de duração (sucesso):\e[0m"
    echo "P50: ${sorted[$p50_idx]}ms"
    echo "P90: ${sorted[$p90_idx]}ms"
    echo "P95: ${sorted[$p95_idx]}ms"
    echo "P99: ${sorted[$p99_idx]}ms"
fi

echo -e "\n\e[32mTestes de carga concluídos!\e[0m" 