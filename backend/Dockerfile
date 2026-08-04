FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

FROM node:18-alpine
WORKDIR /app

RUN apk update && apk upgrade --no-cache

COPY --from=builder /app /app

RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm \
           /usr/local/bin/npx \
           /usr/local/bin/corepack \
           /usr/local/lib/node_modules/corepack \
           /opt/yarn-v*

EXPOSE 5000

CMD ["node", "server.js"]
