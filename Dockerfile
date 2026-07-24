# Build the React frontend
FROM node:22-alpine AS frontend
WORKDIR /app
COPY client/package.json client/package-lock.json ./client/
RUN npm install --prefix client
COPY client ./client
RUN npm run build --prefix client

# Production image: Express serves API + static frontend
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY server ./server
COPY --from=frontend /app/client/dist ./client/dist

EXPOSE 8080
CMD ["node", "server/index.js"]
