#!/bin/bash
set -e  # Parar em caso de erro

export GITHUB_REPOSITORY_URL="$GITHUB_REPOSITORY_URL"

echo "Iniciando build..."
echo "Clonando repositório: $GITHUB_REPOSITORY_URL"
git clone "$GITHUB_REPOSITORY_URL" /home/app/output
echo "Repositório clonado com sucesso"

exec node dist/script.js