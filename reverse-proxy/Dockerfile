FROM node:18-alpine

RUN apk add --no-cache certbot certbot-dns-rfc2136

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . . 

RUN npm run build

EXPOSE 8000 80 443

CMD ["node", "dist/index.js"]