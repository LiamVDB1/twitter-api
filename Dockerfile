# Stage 1: Build the application
FROM node:18-slim AS builder

# Install build tools needed for native modules like better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm and node-gyp globally
RUN npm i -g pnpm node-gyp

# Set working directory
WORKDIR /usr/src/app

# Copy dependency definition files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev dependencies for build)
RUN pnpm install --prod=false

# Copy source code and config files
COPY src/ ./src/
COPY tsconfig.json ./

# Build the TypeScript project
RUN pnpm run build

# Prune dev dependencies
RUN pnpm prune --prod

# Rebuild better-sqlite3 to ensure native bindings are available
RUN cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 && npm run build-release


# Stage 2: Production image
FROM node:18-slim

# Set working directory
WORKDIR /usr/src/app

# Copy production dependencies from builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./

# Copy the compiled code from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Create a non-root user for security.
# --system creates a user without a home directory or password.
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# Create directories for logs and database, and set permissions
# These directories are created as root, then ownership is changed to the appuser.
# This must be done before switching to the non-root user.
RUN mkdir -p logs && \
    touch db.sqlite && \
    chown -R appuser:appgroup /usr/src/app

# Switch to the non-root user
USER appuser

# Expose the application port
EXPOSE 3000

# The command to run the application
CMD ["node", "dist/index.js"] 