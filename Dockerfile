FROM node:18-alpine

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package.json and pnpm lock file
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the source code
COPY . .

# Build the application
RUN pnpm build

# Expose the port
EXPOSE 3002

# Define the command to run the app
CMD ["pnpm", "start"]