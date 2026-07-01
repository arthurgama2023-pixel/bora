FROM node:22

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

WORKDIR /app/server
RUN PUPPETEER_SKIP_DOWNLOAD=true PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Seed-on-boot: popula o disco persistente (data/) com os arquivos-semente
# apenas se ainda não existirem (cp -n = no-clobber). Preserva disco existente.
# Depois inicia o server; se crashar, expõe o log via HTTP pra debug.
CMD ["sh", "-c", "mkdir -p /app/server/data && cp -rn /app/server/data-seed/. /app/server/data/ 2>/dev/null; node server/index.js > /tmp/server.log 2>&1 || node -e \"require('http').createServer((_,r)=>{r.writeHead(200,{'Content-Type':'text/plain'});r.end(require('fs').readFileSync('/tmp/server.log','utf8'))}).listen(3000)\""]
