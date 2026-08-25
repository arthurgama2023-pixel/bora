FROM node:20

WORKDIR /app

# yt-dlp (recurso de "gerar roteiro de um link") — precisa de python3 + o binário.
# No Linux o servidor chama 'yt-dlp' pelo PATH (ytDlpPath() em index.js).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 ca-certificates \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*

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
