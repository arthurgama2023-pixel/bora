FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala dependências do frontend e builda o React
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Instala dependências do backend
WORKDIR /app/server
RUN npm ci

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/index.js"]
