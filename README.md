# 🚀 BruumHost

> Plataforma open-source de deploy automatizado estilo Vercel. Faça deploy de projetos do GitHub com um clique e obtenha uma URL de preview instantânea.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

*<sub>Documentação criada com assistência de IA</sub>*

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades](#-funcionalidades)
- [Arquitetura](#-arquitetura)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Uso](#-uso)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Configuração Avançada](#-configuração-avançada)
- [Desenvolvimento](#-desenvolvimento)
- [Troubleshooting](#-troubleshooting)
- [Contribuindo](#-contribuindo)
- [Licença](#-licença)

## 🎯 Sobre o Projeto

BruumHost é uma plataforma de deploy automatizado que permite fazer deploy de projetos do GitHub de forma simples e rápida, nessa versão ainda só é possível fazer deploy de projetos Vite. Basta fornecer a URL do repositório e o sistema automaticamente:

- Clona o repositório
- Instala as dependências
- Executa o build
- Faz upload dos arquivos para armazenamento
- Gera uma URL de preview única

Tudo isso com logs em tempo real e interface visual moderna.

## ✨ Funcionalidades

- 🚀 **Deploy com um clique**: Apenas cole a URL do GitHub de um projeto Vite e clique em deploy
- 📊 **Logs em tempo real**: Acompanhe o processo de build em tempo real via WebSocket
- 🎨 **Interface moderna**: UI responsiva com animações e feedback visual
- 🐳 **Builds isolados**: Cada deploy roda em um container Docker isolado
- 💾 **Armazenamento S3**: Arquivos buildados são armazenados em MinIO/S3
- 🔄 **Auto-cleanup**: Projetos expirados são removidos automaticamente
- 🌐 **Reverse Proxy**: Servir múltiplos projetos através de subdomínios

## 🏗️ Arquitetura

O projeto é composto por 4 serviços principais:

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│  Frontend   │─────▶│  API Server  │─────▶│   Docker    │
│  (React)    │      │  (Express)   │      │  (Builder)   │
└─────────────┘      └──────────────┘      └─────────────┘
      │                     │                       │
      │                     ▼                       ▼
      │              ┌──────────────┐      ┌─────────────┐
      │              │    Redis     │      │    MinIO    │
      │              │  (Pub/Sub)   │      │   (S3 API)  │
      │              └──────────────┘      └─────────────┘
      │
      └─────────────▶┌──────────────┐
                     │   Reverse    │
                     │    Proxy     │
                     └──────────────┘
```

### Componentes

1. **Frontend** (React + TypeScript): Interface web para fazer deploy
2. **API Server** (Node.js + Express): Gerencia deploys e WebSocket
3. **Builder** (Docker): Container que executa o build dos projetos
4. **Reverse Proxy** (Node.js + Express): Serve os projetos deployados

## 📦 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Docker** e Docker Compose (ou Docker Desktop)
- **Git**

> **Nota**: Todos os serviços (Redis, MinIO, API Server, Frontend, Reverse Proxy) são executados via Docker Compose, então não é necessário instalar Node.js, Redis ou MinIO manualmente.

## 🛠️ Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/LeonardoBrum0907/bruumhost.git
cd bruumhost
```

### 2. Construa a imagem Docker do Builder

Antes de iniciar os serviços, é necessário construir a imagem do builder:

```bash
cd builder
docker build -t bruumhost-builder:latest .
cd ..
```

### 3. Configure variáveis de ambiente (opcional)

O projeto já vem com um arquivo `docker-compose.yml` configurado. Se quiser customizar, você pode criar um arquivo `.env` na raiz do projeto para sobrescrever valores padrão.

**Variáveis opcionais para o frontend:**
- `VITE_API_URL`: URL da API (padrão: `http://localhost:9000`)
- `VITE_SOCKET_URL`: URL do WebSocket (padrão: `http://localhost:9000`)

Exemplo de `.env` na raiz:
```env
VITE_API_URL=http://localhost:9000
VITE_SOCKET_URL=http://localhost:9000
```

> **Nota**: As variáveis de ambiente dos serviços estão configuradas diretamente no `docker-compose.yml`. Para desenvolvimento, você normalmente não precisa alterá-las.

### 4. Inicie todos os serviços com Docker Compose

O arquivo `docker-compose.yml` na raiz já está configurado com todos os serviços necessários:

```bash
# Iniciar todos os serviços em background
docker compose up -d

# Ou para ver os logs em tempo real
docker compose up
```

Isso irá iniciar:
- ✅ Redis (porta 6379)
- ✅ MinIO (API na porta 8080, Console na porta 8081)
- ✅ API Server (porta 9000)
- ✅ Frontend (porta 80)
- ✅ Reverse Proxy (porta 8000)

### 5. Configure o bucket do MinIO

Após iniciar os serviços, acesse o console do MinIO para criar o bucket:

1. Acesse: `http://localhost:8081`
2. Login: `minioadmin` / `minioadmin`
3. Clique em **Buckets** → **Create Bucket**
4. Nome do bucket: `bruumhost`
5. Clique em **Create Bucket**

> **Dica**: O bucket será criado automaticamente pelo builder na primeira execução, mas é recomendável criá-lo manualmente para garantir que as permissões estejam corretas.

## 🚀 Uso

### Verificar status dos serviços

```bash
# Ver status de todos os serviços
docker compose ps

# Ver logs de todos os serviços
docker compose logs -f

# Ver logs de um serviço específico
docker compose logs -f api-server
```

### Fazer um deploy

1. Acesse `http://localhost` (Frontend)
2. Cole a URL do repositório GitHub (ex: `https://github.com/LeonardoBrum0907/vite-project`)
3. Clique em **Deploy**
4. Acompanhe os logs em tempo real no frontend
5. Quando concluído, você receberá uma URL de preview

### Acessar o projeto deployado

Após o deploy, você receberá uma URL no formato:
```
http://{slug}.localhost:8000
```

### Testar a instalação

Para verificar se tudo está funcionando:

1. **Verificar se todos os serviços estão rodando:**
   ```bash
   docker compose ps
   ```
   Todos devem estar com status "Up (healthy)" ou "Up"

2. **Acessar o frontend:**
   - Abra: `http://localhost`
   - Você deve ver a interface do BruumHost

3. **Acessar o console do MinIO:**
   - Abra: `http://localhost:8081`
   - Login: `minioadmin` / `minioadmin`
   - Verifique se o bucket `bruumhost` existe

4. **Fazer um deploy de teste:**
   - Use um repositório simples (ex: `https://github.com/LeonardoBrum0907/vite-project`)
   - Acompanhe os logs em tempo real
   - Verifique se recebe a URL de preview

### Comandos úteis do Docker Compose

```bash
# Parar todos os serviços
docker compose stop

# Parar e remover containers (mantém volumes)
docker compose down

# Parar e remover containers + volumes (CUIDADO: remove dados)
docker compose down -v

# Rebuild de um serviço específico
docker compose build api-server
docker compose up -d --build api-server

# Ver logs em tempo real
docker compose logs -f

# Reiniciar um serviço
docker compose restart api-server
```

### Testar o builder manualmente

Para testar o builder isoladamente:

```bash
docker run -it --rm \
  --network bruumhost_bruumhost-network \
  --name builder-test-$(date +%s) \
  -e REDIS_URL="redis://redis:6379" \
  -e PROJECT_ID="test-project-123" \
  -e MINIO_ENDPOINT="http://minio:8080" \
  -e MINIO_ACCESS_KEY="minioadmin" \
  -e MINIO_SECRET_KEY="minioadmin" \
  -e MINIO_BUCKET="bruumhost" \
  -e GITHUB_REPOSITORY_URL="https://github.com/seu-usuario/seu-repo.git" \
  bruumhost-builder:latest
```

## 📁 Estrutura do Projeto

```
bruumhost/
├── frontend/              # Interface React
│   ├── src/
│   │   ├── App.tsx       # Componente principal
│   │   ├── components/   # Componentes React
│   │   └── utils/        # Utilitários
│   └── package.json
│
├── api-server/           # API REST e WebSocket
│   ├── index.ts          # Servidor Express
│   ├── services/         # Serviços auxiliares
│   └── package.json
│
├── builder/              # Container de build
│   ├── Dockerfile        # Imagem Docker
│   ├── main.sh          # Script de entrada
│   ├── script.ts        # Lógica de build
│   └── package.json
│
├── reverse-proxy/        # Proxy reverso
│   ├── index.ts         # Servidor proxy
│   └── package.json

```

## 🔧 Configuração Avançada

### Variáveis de Ambiente Detalhadas

#### API Server

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta do servidor API | `9000` |
| `REDIS_URL` | URL de conexão do Redis | - |
| `DOCKER_SOCKET` | Caminho do socket Docker | `/var/run/docker.sock` |
| `BUILD_IMAGE_NAME` | Nome da imagem Docker do builder | `bruumhost-builder:latest` |
| `MINIO_ENDPOINT` | Endpoint do MinIO | `http://minio:8080` |
| `MINIO_ACCESS_KEY` | Chave de acesso do MinIO | `minioadmin` |
| `MINIO_SECRET_KEY` | Chave secreta do MinIO | `minioadmin` |
| `MINIO_BUCKET` | Nome do bucket S3 | `bruumhost` |
| `REVERSE_PROXY_DOMAIN` | Domínio do reverse proxy | `localhost` |
| `USE_HTTPS` | Usar HTTPS | `false` |
| `SERVER_IP` | IP do servidor | `localhost` |
| `TTL_MINUTES` | Tempo de vida dos projetos (horas) | `24` |

**Nota**: No docker-compose, as variáveis estão configuradas para comunicação interna entre containers. Para desenvolvimento local, normalmente não é necessário alterá-las.

### Build da Imagem Docker

Para reconstruir a imagem do builder após mudanças:

```bash
cd builder
docker build -t bruumhost-builder:latest .
cd ..
```

Depois, reinicie o API Server para usar a nova imagem:

```bash
docker compose restart api-server
```

### Rebuild completo dos serviços

Para reconstruir todos os serviços após mudanças no código:

```bash
# Rebuild e reiniciar todos os serviços
docker compose up -d --build

# Ou apenas serviços específicos
docker compose up -d --build api-server frontend
```

### Limpeza Automática

O sistema possui um serviço de limpeza automática que remove projetos expirados baseado no `TTL_MINUTES` (padrão: 24 horas). O cleanup roda automaticamente no API Server a cada 20 minutos.

## 🧪 Desenvolvimento

### Desenvolvimento Local vs Docker Compose

Para desenvolvimento, você tem duas opções:

**Opção 1: Desenvolvimento com Docker Compose (Recomendado)**
- Todos os serviços rodam em containers
- Mais próximo do ambiente de produção
- Não precisa instalar Node.js localmente

**Opção 2: Desenvolvimento Local**
- Instale as dependências manualmente (`npm install` em cada serviço)
- Execute cada serviço localmente (`npm run dev`)
- Útil para debug mais detalhado

### Rodar testes

```bash
# Testes do frontend (desenvolvimento local)
cd frontend
npm install
npm run test

# Testes com coverage
npm run test:coverage
```

### Lint

```bash
# Lint do frontend (desenvolvimento local)
cd frontend
npm install
npm run lint

# Lint com auto-fix
npm run lint:fix
```

### Git Hooks

O projeto usa Husky para executar lint e testes antes de commits e pushes:

- **pre-commit**: Executa lint e testes nos arquivos alterados
- **pre-push**: Validações adicionais antes do push

Para habilitar os git hooks, instale as dependências do root:
```bash
npm install
```

### Debugging

**Ver logs de um container específico:**
```bash
docker compose logs -f api-server
```

**Entrar em um container:**
```bash
docker compose exec api-server sh
```

**Verificar conectividade entre serviços:**
```bash
# Testar Redis
docker compose exec api-server ping redis

# Testar MinIO
docker compose exec api-server curl http://minio:8080/minio/health/live
```

**Verificar status dos health checks:**
```bash
docker compose ps
```

## 🔍 Troubleshooting

### Problemas Comuns

#### 1. Container builder falha ao conectar no Redis/MinIO

**Erro**: `socket hang up` ou `Connection refused`

**Solução**: Certifique-se de que o builder está na mesma rede do docker-compose:
- O API Server já passa a rede correta automaticamente
- Para testes manuais, use: `--network bruumhost_bruumhost-network`

#### 2. MinIO não está acessível

**Erro**: `Failed to connect to minio port 8080`

**Solução**: 
- Verifique se o MinIO está rodando: `docker compose ps minio`
- Verifique se está na porta correta: `curl http://localhost:8080/minio/health/live`
- Verifique os logs: `docker compose logs minio`

#### 3. Frontend não carrega

**Solução**:
- Verifique se o frontend está rodando: `docker compose ps frontend`
- Verifique os logs: `docker compose logs frontend`
- Acesse `http://localhost` (porta 80)

#### 4. Deploy falha silenciosamente

**Solução**:
- Verifique os logs do API Server: `docker compose logs -f api-server`
- Verifique se a imagem do builder existe: `docker images | grep bruumhost-builder`
- Teste o builder manualmente (veja seção "Testar o builder manualmente")

#### 5. Projetos deployados não aparecem

**Solução**:
- Verifique se o reverse proxy está rodando: `docker compose ps reverse-proxy`
- Verifique se o bucket existe no MinIO (acesse `http://localhost:8081`)
- Verifique os logs: `docker compose logs reverse-proxy`

#### 6. Docker socket não encontrado (Windows/Mac)

**Solução**:
- Certifique-se de que o Docker Desktop está rodando
- O docker-compose já está configurado para usar o socket corretamente

### Limpar tudo e reiniciar

Se tiver problemas persistentes, você pode limpar tudo e começar do zero:

```bash
# Parar e remover todos os containers e volumes
docker compose down -v

# Remover imagens construídas (opcional)
docker rmi bruumhost-builder:latest

# Reconstruir tudo
cd builder && docker build -t bruumhost-builder:latest . && cd ..
docker compose up -d --build
```

### Verificar conectividade entre serviços

```bash
# Testar Redis
docker compose exec api-server ping -c 3 redis

# Testar MinIO
docker compose exec api-server curl -f http://minio:8080/minio/health/live

# Ver logs de todos os serviços
docker compose logs --tail=100
```

### Mais ajuda

Se ainda tiver problemas, verifique:
- Issues no GitHub: [GitHub Issues](https://github.com/LeonardoBrum0907/bruumhost/issues)

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:

1. Fazer fork do projeto
2. Criar uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abrir um Pull Request

### Padrões de Código

- Use TypeScript
- Siga as regras do ESLint
- Escreva testes para novas funcionalidades
- Documente funções complexas

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🙏 Agradecimentos

- [Vercel](https://vercel.com) pela inspiração
- Comunidade open-source

## 📧 Contato

- **GitHub**: [@LeonardoBrum0907](https://github.com/LeonardoBrum0907)
- **Issues**: [GitHub Issues](https://github.com/LeonardoBrum0907/bruumhost/issues)

---

⭐ Se este projeto foi útil para você, considere dar uma estrela!
