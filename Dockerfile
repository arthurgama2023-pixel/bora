FROM node:20

WORKDIR /app

# Copiar apenas o servidor
COPY detetive-viral/server/package*.json ./

# Instalar dependências
RUN npm install --production

# Copiar código
COPY detetive-viral/server/ .

# Expor porta
EXPOSE 3003

# Iniciar
CMD ["node", "index.js"]
