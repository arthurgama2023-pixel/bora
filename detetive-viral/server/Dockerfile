FROM node:20

WORKDIR /app

# Copiar package.json e instalar dependências
COPY package*.json ./
RUN npm install --production

# Copiar código da aplicação
COPY . .

# Expor porta
EXPOSE 3003

# Iniciar servidor
CMD ["node", "index.js"]
