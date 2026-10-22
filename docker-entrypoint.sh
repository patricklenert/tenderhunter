#!/bin/sh
set -e

mode="${1:-app}"

echo "Running database migration..."
npm run migrate

if [ "$mode" = "worker" ]; then
  echo "Starting worker..."
  exec node --import tsx scripts/worker.ts
fi

echo "Starting application..."
exec npm run start -- -H 0.0.0.0 -p 3000
