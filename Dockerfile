FROM node:20

WORKDIR /app

# Instala dependências do frontend e builda o React
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Instala dependências do backend
# PUPPETEER_SKIP_DOWNLOAD evita que whatsapp-web.js tente baixar Chrome durante npm ci
# (Chrome não é necessário para o servidor — WhatsApp usa Chrome do sistema, se disponível)
WORKDIR /app/server
RUN PUPPETEER_SKIP_DOWNLOAD=true npm ci

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/index.js"]
