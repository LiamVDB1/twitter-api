FROM node:18-alpine

WORKDIR /app

# Copy dependency definitions
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy the source code
COPY . .

# Build the application
RUN npm run build

# Expose the port
EXPOSE 3000

# Define the command to run the app
CMD ["npm", "start"]