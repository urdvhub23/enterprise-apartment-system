FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

FROM node:18-alpine
WORKDIR /app

RUN apk update && apk upgrade --no-cache

COPY --from=builder /app /app

EXPOSE 5000

CMD ["node", "server.js"]
