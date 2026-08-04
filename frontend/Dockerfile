# Frontend dev image — runs the Vite dev server with hot-reload.
# Source is volume-mounted in docker-compose.yml, so this Dockerfile just
# sets up the runtime; code changes on your host are picked up live.
# For a production image, swap this for a multi-stage build that runs
# `npm run build` and serves the static output via nginx instead.
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# host 0.0.0.0 is required so the container's network interface is reachable
# from outside the container (matches the docker-compose port mapping).
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
