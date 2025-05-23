#!/bin/bash

echo "🚀 Iniciando teste de carga..."
npx artillery run load-test.yml
echo "✅ Teste de carga concluído!" 