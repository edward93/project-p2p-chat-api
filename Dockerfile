# Base image
FROM node:22

# Create app directory
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Build TS (if you had a separate build step)
# RUN npm run build

# Start app
CMD ["npm", "run", "start"]