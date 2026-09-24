# ---- build stage: full deps, compile TS, generate Prisma client ----
FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ---- production stage: runtime deps + dist only ----
FROM node:22-alpine AS production
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# prisma CLI is needed at runtime for `migrate deploy`
RUN npm ci --omit=dev && npm install --no-save prisma@6.19.3 && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY docker-entrypoint.sh ./
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
