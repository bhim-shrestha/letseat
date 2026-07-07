FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests first for Docker layer caching
COPY package*.json ./

# Install all dependencies including devDependencies (needed for build)
RUN npm ci

# Copy source
COPY . .

# Build Vite frontend + esbuild server bundle
RUN npm run build

# Strip devDependencies from final image
RUN npm prune --omit=dev

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "start"]
