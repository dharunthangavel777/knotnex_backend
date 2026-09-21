# Use official Node.js 20 LTS slim image
FROM node:20-slim

# Create and change to the app directory
WORKDIR /usr/src/app

# Copy package manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Set default environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Cloud Run binds to PORT (default 8080)
EXPOSE 8080

# Start server
CMD ["node", "src/server.js"]
