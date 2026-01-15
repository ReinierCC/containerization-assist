# Multi-stage build for Node.js application
# Demonstrates best practices: multi-stage, non-root user, health check

# Build stage (not needed for this simple app, but demonstrates pattern)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies (would use npm ci in real app)
RUN npm install --production

# Copy source
COPY . .

# Runtime stage
FROM node:20-alpine AS runtime

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy from builder
COPY --from=builder --chown=nodejs:nodejs /app .

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Build args for metadata
ARG NODE_ENV=production
ARG VERSION=1.0.0
ENV NODE_ENV=$NODE_ENV
ENV VERSION=$VERSION

# Start application
CMD ["node", "index.js"]
