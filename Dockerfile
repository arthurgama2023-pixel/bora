FROM node:20

WORKDIR /app

# Instala dependências do frontend e builda o React
# Usa npm install (não npm ci) para evitar conflito de hashes
# entre package-lock.json gerado no Windows e binários Linux
COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Instala dependências do backend
# PUPPETEER_SKIP_DOWNLOAD evita que whatsapp-web.js baixe Chrome (~300MB)
WORKDIR /app/server
RUN PUPPETEER_SKIP_DOWNLOAD=true PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/index.js"]
