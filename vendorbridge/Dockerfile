# VendorBridge — production image
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# App source
COPY . .

EXPOSE 4000
# Container-level health check hits the app's health endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["node", "server/index.js"]
