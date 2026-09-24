#!/bin/sh
set -e

echo "Applying migrations..."
npx prisma migrate deploy

echo "Seeding (idempotent)..."
node dist/prisma/seed.js

echo "Starting API..."
exec node dist/main.js
