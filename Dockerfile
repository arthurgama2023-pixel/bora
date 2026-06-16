FROM node:20

WORKDIR /app

# Instala dependências do frontend e builda o React
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

# Tenta subir o servidor; se crashar, expõe o erro via HTTP para diagnóstico
CMD ["sh", "-c", "node server/index.js 2>&1 | tee /tmp/server.log || (node -e \"const h=require('http'),fs=require('fs');h.createServer((_,r)=>{r.writeHead(200,{'Content-Type':'text/plain'});r.end(fs.readFileSync('/tmp/server.log','utf8'))}).listen(3000,()=>console.log('Error server on 3000'))\" )"]
