FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Render só passa as env vars do painel pro build se houver um ARG com o
# mesmo nome — sem isso, npm run build roda sem NEXT_PUBLIC_* (que são
# embutidas no bundle em build-time) e o app cai no fallback de localhost.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "run", "start"]
