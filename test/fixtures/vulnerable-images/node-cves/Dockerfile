# Test Case: Node.js with Known CVEs
# Expected: Critical 8-12, High 25-35, Medium 40-60
# Base image: node:14.15.0 has known CVEs in Node.js core and OpenSSL
# ⚠️ INTENTIONALLY VULNERABLE - FOR TESTING ONLY
FROM node:14.15.0

WORKDIR /app

# Copy vulnerable package.json
COPY package.json package-lock.json ./

# Install dependencies (includes vulnerable packages)
RUN npm ci --omit=dev

# Copy application
COPY index.js ./

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "index.js"]
