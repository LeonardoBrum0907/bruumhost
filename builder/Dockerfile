# Define a imagem base como Ubuntu 20.04 (Focal Fossa)
FROM ubuntu:focal 

# Atualiza a lista de pacotes do apt
RUN apt-get update
# Instala o curl -y significa que o apt-get vai instalar o curl sem perguntar nada
RUN apt-get install -y curl
# Baixa e executa o script NodeSource para adicionar o repo do Node.js 22.x
RUN curl -sL https://deb.nodesource.com/setup_22.x | bash -
# Atualiza os pacotes do apt
RUN apt-get upgrade -y
# Instala o Node.js 22.x conforme o script NodeSource
RUN apt-get install -y nodejs

# Instala o git
RUN apt-get install git -y

# Define o diretório de trabalho como /home/app (cria se não existir)
WORKDIR /home/app

# Copia os arquivos do projeto para o container
COPY main.sh main.sh
COPY script.js script.js
COPY tsconfig.json tsconfig.json
COPY package*.json .

# Instala as dependências do projeto
RUN npm install

# Executa o script de build do projeto para converter o TypeScript para JavaScript
RUN npm run build

# Torna o script main.sh executável
RUN chmod +x main.sh

# Define o comando de entrada para o container
ENTRYPOINT ["/home/app/main.sh"]

# O comando de entrada é o comando que será executado quando o container for iniciado
# Neste caso, o comando de entrada é o script main.sh
