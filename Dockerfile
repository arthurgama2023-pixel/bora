FROM node:20

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

# Redireciona output para arquivo; se crashar, exibe o erro via HTTP
CMD ["sh", "-c", "node server/index.js > /tmp/server.log 2>&1 || node -e \"require('http').createServer((_,r)=>{r.writeHead(200,{'Content-Type':'text/plain'});r.end(require('fs').readFileSync('/tmp/server.log','utf8'))}).listen(3000)\""]
