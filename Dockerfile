
FROM node:22-bookworm-slim

WORKDIR /app

# Install production dependencies
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# Copy Express backend
COPY --chown=node:node server/ ./

# Production settings
ENV NODE_ENV=production
ENV PORT=8080

USER node

EXPOSE 8080

CMD ["node", "index.js"]
