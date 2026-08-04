# Backend API gateway image.
# Build from the backend/ directory: docker build -t apartment-backend .
FROM node:18-alpine

WORKDIR /app

# Install dependencies first so Docker can cache this layer
# and skip reinstalling when only source files change.
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the backend source.
COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
