FROM node:20-bullseye-slim
WORKDIR /app

# GDAL CLI needed for previews (gdal_translate)
RUN apt-get update && apt-get install -y gdal-bin && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY src ./src
EXPOSE 8080
CMD ["node", "src/index.js"]
