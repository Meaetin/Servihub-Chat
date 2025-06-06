FROM node:22-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package files first
COPY package.json package-lock.json tsconfig.json ./

# Install dependencies
RUN npm ci --only=production=false

# Copy the rest of the application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Expose the port that the app runs on
EXPOSE 3001

# Start the application
CMD ["node", "dist/index.js"]

